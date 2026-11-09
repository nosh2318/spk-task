// hdm-tkm-send-mail — じゃらんHANDYMAN高松空港店 メール送信ワーカー（KEYDROP同型）
// 役割: hdm_tkm_notifications(sent=false) を回収し、Resend API で
//       reserve@rent-handyman.com（HANDYMAN専用ドメイン）から送信して sent=true にする。
//   - pg_cron が1分ごとに net.http_post で起動（x-cron-secret 認証）。
//   - verify_jwt=false でデプロイ。CRON_SECRET 一致時のみ実行。
// ★安全ゲート HDM_TKM_MODE:
//     "off"(既定)  = 一切送らない（基盤は動くが顧客に飛ばさない＝テスト前の待機状態）
//     "test"       = 実顧客に送らず HDM_TKM_TEST_MAIL へ送る（パイプライン検証用）
//     "live"       = 実顧客(to_email)へ送る（十分テスト後にここへ切替）
// 必要な Supabase Secrets: RESEND_API_KEY(送信専用) / CRON_SECRET / HDM_TKM_FROM / HDM_TKM_MODE / HDM_TKM_TEST_MAIL / SUPABASE_SERVICE_ROLE_KEY(自動)
// 2026-11-09 開封の計測：HTML版（開封の印＋リンク計測 mail-track）を付ける。本文・送る条件は変えない。

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const FROM = Deno.env.get("HDM_TKM_FROM") || "HANDYMAN 高松空港店 <reserve@rent-handyman.com>";
const REPLY_TO = Deno.env.get("HDM_TKM_REPLY") || "reserve@rent-handyman.com";
const MODE = (Deno.env.get("HDM_TKM_MODE") || "off").toLowerCase(); // off | test | live
const TEST_MAIL = Deno.env.get("HDM_TKM_TEST_MAIL") || "";
// ===== 2026-11-09 開封の計測（mail-track）：本文はそのまま、同じ内容のHTML版に「開封の印」と「リンクの計測」を付ける =====
const TRK = "https://ckrxttbnawkclshczsia.supabase.co/functions/v1/mail-track";
const midOf = (store: string, kind: string, resv: string) => btoa(unescape(encodeURIComponent(`${store}|${kind}|${resv}`))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function htmlOf(text: string, mid: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const body = esc(text).replace(/https:\/\/[^\s<>"）」、。]+/g, (u) => {
    const raw = u.replace(/&amp;/g, "&");
    return `<a href="${TRK}?c=${mid}&amp;u=${encodeURIComponent(raw)}" style="color:#0a58c2">${u}</a>`;
  }).replace(/\n/g, "<br>");
  return `<div style="font-family:-apple-system,'Hiragino Sans',sans-serif;font-size:15px;line-height:1.7;color:#111">${body}</div><img src="${TRK}?o=${mid}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">`;
}

async function sbGet(path: string): Promise<any[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) { console.error("sbGet", r.status, await r.text()); return []; }
  return await r.json();
}
async function sbPatch(path: string, body: unknown): Promise<void> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) console.error("sbPatch", r.status, await r.text());
}
async function resendSend(to: string, subject: string, text: string, mid = ""): Promise<{ ok: boolean; id?: string; err?: string }> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: [REPLY_TO], subject, text, ...(mid ? { html: htmlOf(text, mid) } : {}) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, err: (j && (j as any).message) || `http ${r.status}` };
  return { ok: true, id: (j as any).id };
}
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

Deno.serve(async (req) => {
  // pg_cron からの呼び出しのみ許可（CRON_SECRET）
  const sec = req.headers.get("x-cron-secret") || "";
  if (!CRON_SECRET || sec !== CRON_SECRET) return new Response("forbidden", { status: 403 });

  // ★モードoff＝送信しない（キューはそのまま・待機）。テスト前の既定。
  if (MODE === "off") {
    const pend = await sbGet("hdm_tkm_notifications?sent=eq.false&select=id");
    return new Response(JSON.stringify({ ok: true, mode: "off", pending: pend.length, note: "自動送信オフ（HDM_TKM_MODE=test/liveで有効化）" }), { headers: { "content-type": "application/json" } });
  }
  if (!RESEND_KEY) return new Response(JSON.stringify({ error: "RESEND_API_KEY未設定" }), { status: 503, headers: { "content-type": "application/json" } });
  if (MODE === "test" && !TEST_MAIL) return new Response(JSON.stringify({ error: "test中だがHDM_TKM_TEST_MAIL未設定" }), { status: 503, headers: { "content-type": "application/json" } });

  const rows = await sbGet("hdm_tkm_notifications?sent=eq.false&order=created_at.asc&limit=50&select=*");
  let ok = 0, ng = 0, i = 0;
  for (const n of rows) {
    try {
      const realTo = String(n.to_email || "").trim();
      if (!realTo) { await sbPatch(`hdm_tkm_notifications?id=eq.${n.id}`, { error: "宛先なし" }); ng++; continue; }
      const to = MODE === "test" ? TEST_MAIL : realTo;
      const subject = MODE === "test" ? `[TEST→${realTo}] ${n.subject}` : n.subject;
      const r = await resendSend(to, subject, n.body || "", midOf("tkm", String(n.kind || "other"), String(n.reservation_id || "")));
      if (!r.ok) throw new Error("resend: " + r.err);
      await sbPatch(`hdm_tkm_notifications?id=eq.${n.id}`, { sent: true, sent_at: new Date().toISOString(), resend_id: r.id || null, error: null });
      // ★2026-09-30: welcome(初手メール=決済リンク入り)を実顧客へ送ったら、じゃらん事前決済のstatusをlink_created→email_sentへ同期（画面の「未送信」誤表示・未入金アラート誤発火を防ぐ）。testモードは実顧客に送らないので更新しない。
      if (MODE === "live" && n.kind === "welcome" && n.reservation_id) {
        await sbPatch(`bt_jalan_payments?reservation_id=eq.${encodeURIComponent(String(n.reservation_id))}&status=eq.link_created`, { status: "email_sent", email_sent_at: new Date().toISOString() });
      }
      ok++;
    } catch (e) {
      await sbPatch(`hdm_tkm_notifications?id=eq.${n.id}`, { error: String(e).slice(0, 480) });
      ng++;
    }
    if (++i < rows.length) await sleep(600); // Resend 2通/秒制限回避
  }
  console.log(`[hdm-tkm-send-mail] mode=${MODE} sent=${ok} failed=${ng}`);
  return new Response(JSON.stringify({ ok: true, mode: MODE, sent: ok, failed: ng }), { headers: { "content-type": "application/json" } });
});
