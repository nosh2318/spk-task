// parking-card Edge Function
// 駐車場(trustpark)決済用: 会社カードをAES-256-GCMで暗号化保管し、PIN認証で復号して返す。
// 鍵はEF secret(PARKING_CARD_KEY)のみ・DBには暗号文だけ。全アクセスをparking_card_access_logに監査記録。
// 正本: ~/spk-task/line_auto/parking-card/index.ts → deploy実体 ~/hdm-car-delivery/supabase/functions/parking-card/
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY_B64 = Deno.env.get("PARKING_CARD_KEY") || "";
const ADMIN_KEY = Deno.env.get("PARKING_ADMIN_KEY") || "";

const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": o || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});

function b64d(s: string): Uint8Array { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function b64e(b: Uint8Array): string { return btoa(String.fromCharCode(...b)); }

async function aesKey(): Promise<CryptoKey> {
  const raw = b64d(ENC_KEY_B64) as unknown as BufferSource;
  return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function enc(plain: string): Promise<string> {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv } as AesGcmParams, key, new TextEncoder().encode(plain) as unknown as BufferSource));
  return b64e(iv) + "." + b64e(ct);
}
async function dec(blob: string): Promise<string> {
  const [ivS, ctS] = blob.split(".");
  const key = await aesKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(ivS) } as AesGcmParams, key, b64d(ctS) as unknown as BufferSource);
  return new TextDecoder().decode(pt);
}
async function sha256hex(s: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s) as unknown as BufferSource));
  return [...h].map(b => b.toString(16).padStart(2, "0")).join("");
}
// タイミング安全比較
function ctEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function pinHash(pin: string): Promise<string> { return sha256hex(pin + "::" + ADMIN_KEY); }

function brandOf(num: string): string {
  const n = (num || "").replace(/\D/g, "");
  if (/^3[47]/.test(n)) return "AMEX";
  if (/^4/.test(n)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "Mastercard";
  if (/^(352[89]|35[3-8])/.test(n)) return "JCB";
  if (/^3(0[0-5]|[68])/.test(n)) return "Diners";
  if (/^6/.test(n)) return "Discover";
  return "CARD";
}
function labelOf(num: string): string {
  const n = (num || "").replace(/\D/g, "");
  return brandOf(n) + " ****" + n.slice(-4);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  const H = cors(origin);
  const sb = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const action = body.action || "status";

  const log = async (act: string, ok: boolean, note = "", actor = "") => {
    try { await sb.from("parking_card_access_log").insert({ action: act, ok, note, ip, actor }); } catch { /* */ }
  };

  try {
    if (!ENC_KEY_B64) return new Response(JSON.stringify({ ok: false, error: "server_not_configured" }), { status: 500, headers: H });

    // ---- status: 登録有無とラベルだけ(PIN不要・UI表示用) ----
    if (action === "status") {
      const { data } = await sb.from("parking_card_vault").select("label,updated_at").eq("id", 1).maybeSingle();
      return new Response(JSON.stringify({ ok: true, registered: !!(data && data.label), label: data?.label || "", updated_at: data?.updated_at || null }), { headers: H });
    }

    // ---- register: 管理キーでゲート(オーナーのみ)。カード暗号化保管＋PIN設定 ----
    if (action === "register") {
      if (!ADMIN_KEY || !ctEq(String(body.admin_key || ""), ADMIN_KEY)) {
        await log("register", false, "bad_admin_key");
        return new Response(JSON.stringify({ ok: false, error: "bad_admin_key" }), { status: 403, headers: H });
      }
      const c = body.card || {};
      const num = String(c.number || "").replace(/\s/g, "");
      const pin = String(body.pin || "");
      if (!num || !c.exp || !c.cvc || !c.name) return new Response(JSON.stringify({ ok: false, error: "missing_fields" }), { status: 400, headers: H });
      if (!/^\d{4,6}$/.test(pin)) return new Response(JSON.stringify({ ok: false, error: "pin_must_be_4_6_digits" }), { status: 400, headers: H });
      const payload = JSON.stringify({ name: c.name, number: num, exp: c.exp, cvc: String(c.cvc) });
      const encBlob = await enc(payload);
      const ph = await pinHash(pin);
      const { error } = await sb.from("parking_card_vault").upsert({ id: 1, enc: encBlob, label: labelOf(num), pin_hash: ph, updated_at: new Date().toISOString(), updated_by: "admin" }, { onConflict: "id" });
      if (error) throw error;
      await log("register", true, labelOf(num), "admin");
      return new Response(JSON.stringify({ ok: true, label: labelOf(num) }), { headers: H });
    }

    // ---- reveal: PIN認証でカード復号 ----
    if (action === "reveal") {
      const pin = String(body.pin || "");
      // レート制限: 直近10分でreveal失敗5回以上ならブロック
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await sb.from("parking_card_access_log").select("*", { count: "exact", head: true })
        .eq("action", "reveal").eq("ok", false).gte("ts", since);
      if ((count || 0) >= 5) {
        await log("reveal", false, "rate_limited");
        return new Response(JSON.stringify({ ok: false, error: "rate_limited", msg: "PIN失敗が続いたため一時ロックしました。10分後に再試行してください。" }), { status: 429, headers: H });
      }
      const { data } = await sb.from("parking_card_vault").select("enc,pin_hash,label").eq("id", 1).maybeSingle();
      if (!data || !data.enc) { await log("reveal", false, "no_card"); return new Response(JSON.stringify({ ok: false, error: "no_card", msg: "カードが未登録です。" }), { status: 404, headers: H }); }
      const ph = await pinHash(pin);
      if (!ctEq(ph, data.pin_hash || "")) { await log("reveal", false, "bad_pin", body.actor || ""); return new Response(JSON.stringify({ ok: false, error: "bad_pin", msg: "PINが違います。" }), { status: 403, headers: H }); }
      const card = JSON.parse(await dec(data.enc));
      await log("reveal", true, data.label || "", body.actor || "");
      return new Response(JSON.stringify({ ok: true, card, label: data.label }), { headers: H });
    }

    // ---- log_payment: 決済完了の記録(目視確認・未払い出庫ガード用) ----
    if (action === "log_payment") {
      const row = {
        staff: String(body.staff || "").slice(0, 40),
        car_id: body.car_id ? String(body.car_id).slice(0, 60) : null,
        plate: body.plate ? String(body.plate).slice(0, 30) : null,
        amount: body.amount != null ? parseInt(body.amount, 10) || null : null,
        order_no: body.order_no ? String(body.order_no).slice(0, 60) : null,
        spot_no: body.spot_no ? String(body.spot_no).slice(0, 20) : null,
        note: body.note ? String(body.note).slice(0, 200) : null,
        confirmed: true,
      };
      const { error } = await sb.from("parking_payment_log").insert(row);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: H });
    }

    // ---- payments_today: 本日の決済完了記録(出庫ガード判定用) ----
    if (action === "payments_today") {
      const since = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
      const { data } = await sb.from("parking_payment_log").select("car_id,plate,amount,order_no,spot_no,ts").gte("ts", since).order("ts", { ascending: false });
      return new Response(JSON.stringify({ ok: true, rows: data || [] }), { headers: H });
    }

    return new Response(JSON.stringify({ ok: false, error: "unknown_action" }), { status: 400, headers: H });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e && (e as any).message || e) }), { status: 500, headers: H });
  }
});
