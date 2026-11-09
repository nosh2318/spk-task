// hdm-tkm-send-one — じゃらん高松 手動 直接送信 / プレビュー / 開封状況（1予約×1テンプレ）
//  ・rent-handyman.com（reserve@rent-handyman.com）から顧客メールへ Resend で直接送信
//  ・スタッフJWT認証（BUDDICAアプリのログインセッション）
//  ・テンプレは DB(hdm_tkm_templates) 単一ソース。記録は hdm_tkm_notifications（開封状況の追跡に使う）
//  ・action: "preview"(送らず内容返す) / "send"(実送信+記録) / "status"(この予約の送信済み各通知の開封状況)
//  ・verify_jwt=false でデプロイ（自前でstaffトークン検証）
// 2026-11-09 楽天でメールがない予約は、楽天の画面から送る（main の rax_outbox に積む → Mac mini が送る）。
//   ※このファイルは本番 v21 をもとに、その1点と事前決済の締切（3日前19:00）だけを直したもの（spk-task リポジトリに初めて置いた）。
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// ★security 2026-10-23 スタッフ許可リスト：「ログインしていれば誰でも」→ 正規スタッフのメールドメインだけ通す。
//   BT(ggqugvyskyiblxiycpci) の auth.users ドメイン＝bt.hdm/buddica.co.jp（2026-10-23確認）。新規登録は無効(disable_signup=true)のためドメインで判定できる。EF は個別デプロイなので各 EF に同じ小関数をコピー。
const STAFF_EMAIL_RE = /@(bt\.hdm|buddica\.co\.jp)$/i;
async function staffUser(token: string): Promise<{ id: string; email: string } | null> {
  const t = String(token || "").replace(/^Bearer\s+/i, "").trim();
  if (!t) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${t}` } });
    if (!r.ok) return null;
    const u: any = await r.json().catch(() => null);
    const email = String(u?.email || "").trim();
    if (!u?.id || !STAFF_EMAIL_RE.test(email)) return null;
    return { id: String(u.id), email };
  } catch (_) { return null; }
}
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("HDM_TKM_FROM") || "HANDYMAN 高松空港店 <reserve@rent-handyman.com>";
const REPLY = Deno.env.get("HDM_TKM_REPLY") || "reserve@rent-handyman.com";
const MYPAGE_BASE = "https://nosh2318.github.io/spk-task/my-tkm.html?t=";
// ===== 楽天の画面から送る（2026-11-09 nosh「楽天でLINEもメールもない人には、通知もその他の連絡も楽天経由で出す」） =====
//   楽天の予約はメール・電話がこちらに来ない。LINEもメール登録もない人への通知は main の rax_outbox に積み、
//   Mac mini（rax_line_mail.py）が楽天RAXの「予約者へメール送信」から送る。dkey が同じものは二度積まない。
const RAX_URL = "https://ckrxttbnawkclshczsia.supabase.co";
async function raxQueue(key: string, o: { store: string; resv_no: string; kind: string; subject: string; body: string; dkey?: string | null }): Promise<boolean> {
  if (!key) { console.log("[rax] no main key"); return false; }
  try {
    const r = await fetch(`${RAX_URL}/rest/v1/rax_outbox?on_conflict=dkey`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json", Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify({ store: o.store, resv_no: o.resv_no, kind: o.kind, subject: o.subject, body: o.body, dkey: o.dkey || null }),
    });
    if (!r.ok) console.error("[rax]", r.status, await r.text());
    return r.ok;
  } catch (e) { console.error("[rax]", String(e)); return false; }
}

const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": o || "*",
  "Access-Control-Allow-Headers": "authorization,content-type,apikey,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
});
const json = (b: unknown, s: number, o: string | null) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors(o), "content-type": "application/json" } });
const enc = (v: string) => encodeURIComponent(v);

async function sbGet(path: string): Promise<any[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) { console.error("sbGet", path, r.status, await r.text()); return []; }
  return await r.json();
}
async function sbPost(path: string, body: unknown): Promise<void> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) console.error("sbPost", path, r.status, await r.text());
}
const yen = (n: number) => "¥" + Number(n || 0).toLocaleString();
const MY = (t: string) => MYPAGE_BASE + enc(t || "");

function buildItems(r: any): string {
  const it: string[] = [];
  if (r.hasPickup && !r.pickupSet) it.push("　・ご希望の送迎時間のご登録");
  if (!r.termsSigned) it.push("　・貸渡約款へのご同意・ご署名");
  if (!r.licensed) it.push("　・運転免許証のご登録（運転される方 全員分）");
  if (r.pay_url && !r.paid) it.push("　・事前決済（" + yen(r.price) + "／ご出発3日前19:00まで）"); // 2026-11-09 自動送信(hdm-tkm-enqueue)と同じ締切に
  return it.join("\n");
}
function fill(body: string, r: any, payblock: string, footer: string): string {
  const pay = r.pay_url ? payblock.replace(/\{amount\}/g, yen(r.price)).replace(/\{pay_url\}/g, r.pay_url) : "";
  return String(body)
    .replace(/\{name\}/g, r.name || "お客様")
    .replace(/\{mypage\}/g, MY(r.mypage_token))
    .replace(/\{amount\}/g, yen(r.price))
    .replace(/\{pay_url\}/g, r.pay_url || "")
    .replace(/\{start\}/g, r.start_date || "")
    .replace(/\{items\}/g, buildItems(r))
    .replace(/\{payline\}/g, (r.pay_url && !r.paid) ? ("\n▼ お支払い\n" + r.pay_url) : "")
    .replace(/\{payblock\}/g, pay)
    .replace(/\{footer\}/g, "\n\n" + footer);
}

async function verifyStaff(token: string): Promise<boolean> {
  return !!(await staffUser(token)); // ★security 2026-10-23 許可リスト判定（旧: /auth/v1/user が通れば誰でも）
}

Deno.serve(async (req) => {
  const o = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(o) });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!(await verifyStaff(token))) return json({ error: "unauthorized（ログインが必要です）" }, 401, o);

  const body = await req.json().catch(() => ({} as any));
  const action = body.action || "send";
  const rid = body.reservation_id;
  if (!rid) return json({ error: "reservation_id required" }, 400, o);

  // 予約 + ステータス（licensed/termsSigned/paid/pickup）
  const rr0 = await sbGet(`bt_reservations?id=eq.${enc(rid)}&select=id,name,mail,ota,start_date,end_date,price,pay_url,paid,mypage_token,visit_type,return_type,pickup_time,status&limit=1`);
  const r0 = rr0[0];
  if (!r0) return json({ error: "予約が見つかりません: " + rid }, 404, o);
  const licensed = (await sbGet(`license_uploads?reservation_id=eq.${enc(rid)}&select=cnt`)).some((x) => (x.cnt || 0) > 0);
  const terms1 = (await sbGet(`handover_signatures?reservation_id=eq.${enc(rid)}&sign_type=eq.terms_agree&select=reservation_id`)).length > 0;
  const terms2 = (await sbGet(`bt_tasks?${enc("予約番号")}=eq.${enc(rid)}&deleted=not.is.true&select=${enc("約款")}`)).some((x: any) => String(x["約款"] || "").indexOf("同意") >= 0);
  const paid = !!r0.paid || (await sbGet(`bt_jalan_payments?reservation_id=eq.${enc(rid)}&select=status`)).some((x) => x.status === "paid");
  const r = { ...r0, licensed, termsSigned: terms1 || terms2, hasPickup: (r0.visit_type === "PU" || r0.return_type === "BD"), pickupSet: !!r0.pickup_time, paid };

  // ── 開封状況（送信済み各通知の Resend last_event）
  if (action === "status") {
    const notes = await sbGet(`hdm_tkm_notifications?reservation_id=eq.${enc(rid)}&sent=eq.true&select=kind,sent_at,resend_id,error&order=sent_at.desc`);
    const out: any[] = [];
    for (const n of notes) {
      let ev: string | null = null, opened = false, delivered = false;
      if (n.resend_id && RESEND_KEY) {
        try {
          const er = await fetch(`https://api.resend.com/emails/${n.resend_id}`, { headers: { Authorization: `Bearer ${RESEND_KEY}` } });
          const ej = await er.json().catch(() => ({}));
          ev = (ej && (ej.last_event || ej.status)) || null;
          opened = ev === "opened" || ev === "clicked";
          delivered = ev === "delivered" || opened;
        } catch (_e) { /* ignore */ }
      }
      out.push({ kind: n.kind, sent_at: n.sent_at, event: ev, opened, delivered });
    }
    return json({ ok: true, items: out }, 200, o);
  }

  // ── テンプレ取得（DB単一ソース）
  const kind = body.kind;
  if (!kind) return json({ error: "kind required" }, 400, o);
  const tpls = await sbGet(`hdm_tkm_templates?select=key,subject,body`);
  const tmap: Record<string, any> = {}; tpls.forEach((t) => tmap[t.key] = t);
  const payblock = (tmap["_payblock"]?.body) || "";
  const footer = (tmap["_footer"]?.body) || "HANDYMAN 高松空港店";
  const t = tmap[kind];
  if (!t) return json({ error: "テンプレが見つかりません: " + kind }, 404, o);
  const subject: string = t.subject || "HANDYMAN 高松空港店";
  const text = fill(t.body, r, payblock, footer);
  const to = String(r.mail || "").trim();

  if (action === "preview") return json({ ok: true, subject, text, to, name: r.name || "" }, 200, o);

  // ── 実送信
  if (!to) {
    // 2026-11-09 楽天はメールがこちらに来ない → 楽天の画面から送る（Mac mini が数分以内に送る）
    if (String(r.ota || "") === "楽天") {
      const ok = await raxQueue(Deno.env.get("MAIN_SERVICE") || "", { store: "tkm", resv_no: String(rid), kind, subject, body: text, dkey: null });
      return ok ? json({ ok: true, via: "rakuten" }, 200, o) : json({ error: "楽天の画面から送る準備に失敗しました" }, 502, o);
    }
    return json({ error: "この予約には顧客メールアドレスが登録されていません" }, 400, o);
  }
  if (!RESEND_KEY) return json({ error: "RESEND_API_KEY 未設定" }, 503, o);
  const sr = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: [REPLY], subject, text }),
  });
  const sj = await sr.json().catch(() => ({} as any));
  if (!sr.ok) return json({ error: "Resend送信失敗: " + (sj?.message || ("http " + sr.status)) }, 502, o);
  await sbPost("hdm_tkm_notifications", {
    reservation_id: rid, kind, to_email: to, subject, body: text,
    log_key: "manual:" + kind + ":" + rid + ":" + Date.now(),
    sent: true, sent_at: new Date().toISOString(), resend_id: sj.id || null, error: null,
  });
  return json({ ok: true, resend_id: sj.id || null, to }, 200, o);
});
