// hdm-send-mail : HANDYMAN(札幌/那覇) LINE未連携者向けメール送信ワーカー
// hdm_notifications(sent=false) を Resend で送る。pg_cron が1分ごとに起動（x-cron-secret）。
// secrets: HDM_RESEND_API_KEY（Resend mileshare チーム。無ければ RESEND_API_KEY）, CRON_SECRET
// 送信元は既存のお客様メール（予約確認・御礼等）と同じ reserve@rent-handyman.com（2026-11-08 Resend の送信履歴で確認）
// ?check=domains（x-cron-secret 必須）で Resend の認証済みドメイン一覧だけ返す。
// 2026-11-09 開封の計測：HTML版（開封の印＋リンク計測 mail-track）を付ける。本文・送る条件は変えない。
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const RESEND_KEY = Deno.env.get("HDM_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const REPLY_TO = "reserve@rent-handyman.com";
const FROM: Record<string, string> = {
  spk: "HANDYMAN RENTCAR <reserve@rent-handyman.com>",
  nha: "HANDYMAN RENTCAR <reserve@rent-handyman.com>",
};
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
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

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return new Response("forbidden", { status: 403 });
  if (!RESEND_KEY) return j({ error: "RESEND_API_KEY未設定" }, 503);
  const u = new URL(req.url);
  if (u.searchParams.get("check") === "domains") {
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${RESEND_KEY}` } });
    const d = await r.json().catch(() => ({}));
    return j({ ok: r.ok, key: Deno.env.get("HDM_RESEND_API_KEY") ? "hdm" : "default", domains: (d?.data || []).map((x: any) => ({ name: x.name, status: x.status })) });
  }
  const rr = await fetch(`${SB_URL}/rest/v1/hdm_notifications?sent=eq.false&error=is.null&order=created_at.asc&limit=40&select=*`, { headers: H });
  const rows: any[] = rr.ok ? await rr.json() : [];
  let ok = 0, ng = 0;
  for (const n of rows) {
    const from = FROM[n.store] || "";
    let err: string | null = null;
    if (!from) err = "no_from(" + n.store + ")";
    else if (!n.to_email || String(n.to_email).indexOf("@") < 0) err = "bad_to";
    else {
      const mid = midOf(String(n.store || ""), "btn_" + String(n.action || "other"), String(n.resv_no || ""));
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [n.to_email], reply_to: REPLY_TO, subject: n.subject, text: n.body, ...(n.is_test ? {} : { html: htmlOf(String(n.body || ""), mid) }) }),
      });
      if (!r.ok) err = "resend: " + (await r.text()).slice(0, 400);
    }
    await fetch(`${SB_URL}/rest/v1/hdm_notifications?id=eq.${n.id}`, {
      method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify(err ? { error: err } : { sent: true, sent_at: new Date().toISOString(), error: null }),
    });
    err ? ng++ : ok++;
    await new Promise((res) => setTimeout(res, 600)); // Resend 2通/秒
  }
  return j({ ok: true, sent: ok, failed: ng });
});
