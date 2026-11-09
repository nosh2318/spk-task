// notice-mail-send — 札幌(HANDYMAN)お知らせカードから、予約者へ単発メールを送るブリッジ。
//  ・BTプロジェクト(ggqugvyskyiblxiycpci)にデプロイ（reserve@rent-handyman.com のRESEND_API_KEYがここに在るため）。
//  ・認証: 札幌アプリのログイン済みスタッフJWTを MAIN(ckrxttbnawkclshczsia) の /auth/v1/user で検証（クライアントに秘密を置かない）。
//  ・宛先はサーバ側で予約(reservations.mail)を引いて固定＝任意アドレスへは送れない（悪用防止）。
//  deploy: functions deploy notice-mail-send --project-ref ggqugvyskyiblxiycpci --no-verify-jwt
//  secrets(BT): RESEND_API_KEY(既存) / MAIN_SERVICE(main service_role) / NOTICE_MAIL_FROM(任意)
// 2026-11-09 楽天でメールがない予約は、楽天の画面から送る（main の rax_outbox に積む → Mac mini が送る）。
//   ※このファイルは本番 v19 をもとに、その1点だけを足したもの（spk-task リポジトリに初めて置いた）。
const MAIN_URL = "https://ckrxttbnawkclshczsia.supabase.co";
const MAIN_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcnh0dGJuYXdrY2xzaGN6c2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Nzg1NTAsImV4cCI6MjA4NzQ1NDU1MH0.kDC_UDVWvcrS97wzqQ3NXP79ewjgYwF4vSFdV7y06S8";
const MAIN_SERVICE = Deno.env.get("MAIN_SERVICE") || "";
// ★security 2026-10-23 スタッフ許可リスト：「ログインしていれば誰でも」→ 正規スタッフのメールドメインだけ通す。
//   main(ckrxttbnawkclshczsia) の auth.users ドメイン＝spk.hdm/nha.hdm/g-lines.jp/partner.hdm（2026-10-23確認）。協力会社 partner.hdm は不可。新規登録は無効(disable_signup=true)のためドメインで判定できる。EF は個別デプロイなので各 EF に同じ小関数をコピー。
const STAFF_EMAIL_RE = /@(spk\.hdm|nha\.hdm|g-lines\.jp)$/i;
async function staffUser(token: string): Promise<{ id: string; email: string } | null> {
  const t = String(token || "").replace(/^Bearer\s+/i, "").trim();
  if (!t) return null;
  try {
    const r = await fetch(`${MAIN_URL}/auth/v1/user`, { headers: { apikey: MAIN_ANON, Authorization: `Bearer ${t}` } });
    if (!r.ok) return null;
    const u: any = await r.json().catch(() => null);
    const email = String(u?.email || "").trim();
    if (!u?.id || !STAFF_EMAIL_RE.test(email)) return null;
    return { id: String(u.id), email };
  } catch (_) { return null; }
}
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("NOTICE_MAIL_FROM") || "HANDYMAN カーデリバリー <reserve@rent-handyman.com>";
const REPLY_TO = "reserve@rent-handyman.com";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" };
function j(o: unknown, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } }); }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "POST only" }, 405);
  const body = await req.json().catch(() => null);
  if (!body || !body.resv_no || !body.subject || !body.text) return j({ ok: false, error: "missing params" }, 400);
  if (!RESEND_KEY) return j({ ok: false, error: "no_resend_key" }, 503);
  if (!MAIN_SERVICE) return j({ ok: false, error: "no_main_service" }, 503);

  // ① 認証: (a) サーバ間はsecret（EF→EF）／(b) スタッフはMAINのJWT
  const secret = String(body.secret || "");
  const NOTICE_SECRET = Deno.env.get("NOTICE_MAIL_SECRET") || "";
  const secretOk = NOTICE_SECRET && secret && secret === NOTICE_SECRET;
  if (!secretOk) {
    const auth = req.headers.get("authorization") || "";
    const ur = await staffUser(auth); // ★security 2026-10-23 main のスタッフ許可リスト（呼出元=札幌APPのmainログインJWT）
    if (!ur) return j({ ok: false, error: "unauthorized" }, 401);
  }

  // ② 宛先はサーバ側で予約から取得（任意アドレス送信を禁止）。store で MAIN(spk/nha) を出し分け
  const store = String(body.store || "spk");
  const table = store === "nha" ? "nha_reservations" : "reservations";
  const rr = await fetch(`${MAIN_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(String(body.resv_no))}&select=mail,status,name,site,ota`, { headers: { apikey: MAIN_SERVICE, Authorization: `Bearer ${MAIN_SERVICE}` } });
  const rows = await rr.json().catch(() => []);
  const resv = Array.isArray(rows) ? rows[0] : null;
  if (!resv) return j({ ok: false, reason: "reservation_not_found" });
  const st = String(resv.status || "");
  // allow_cancel=true のときはキャンセル状態でも送る（キャンセル承認通知など）
  if (!body.allow_cancel && (st.includes("cancel") || st.includes("キャンセル"))) return j({ ok: false, reason: "cancelled" });
  const to = String(resv.mail || "").trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    // 2026-11-09 楽天はメールがこちらに来ない → 楽天の画面から送る（Mac mini）
    if (String(resv.ota || "") === "R") {
      const ok = await raxQueue(MAIN_SERVICE, { store: store === "nha" ? "nha" : "spk", resv_no: String(body.resv_no), kind: String(body.kind || "notice"), subject: String(body.subject), body: String(body.text), dkey: null });
      return j(ok ? { ok: true, via: "rakuten" } : { ok: false, reason: "rakuten_queue_failed" });
    }
    return j({ ok: false, reason: "no_valid_email" });
  }

  // ③ Resend送信（reserve@rent-handyman.com）
  // 2026-10-28 HDM2: 新サイト予約(site='hdm2')だけ送り元・返信先・本文署名の旧アドレスを reserve@hdm-rentacar.jp に。それ以外は従来どおり。
  const isHdm2 = String(resv.site || "") === "hdm2";
  const mFrom = isHdm2 ? "HANDYMAN RENTCAR <reserve@hdm-rentacar.jp>" : FROM;
  const mReply = isHdm2 ? "reserve@hdm-rentacar.jp" : REPLY_TO;
  const mText = isHdm2 ? String(body.text).replace(/reserve@rent-handyman\.(com|jp)/g, "reserve@hdm-rentacar.jp") : String(body.text);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: mFrom, to: [to], reply_to: [mReply], subject: String(body.subject), text: mText }),
  });
  const jr = await r.json().catch(() => ({}));
  if (!r.ok) return j({ ok: false, reason: "resend_error", detail: (jr && (jr as any).message) || `http ${r.status}` }, 502);
  return j({ ok: true, id: (jr as any).id }); // ★security 2026-10-23 応答に宛先メールを含めない（予約番号→メールアドレスの引当てに使われるため）
});
