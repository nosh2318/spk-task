// Supabase Edge Function: mypage-request-remind（main / ckrxttbnawkclshczsia）
// マイページの依頼（変更・キャンセル・早め回収など）を「返事の目安」を過ぎないように Slack で再通知する。
//   経過時間は受付から数える（JST 9:00〜19:00）。夜間（19:00〜翌9:00）の受付は次の 9:00 から数える。
//   未処理のまま 30分経過で1回目、90分経過で2回目を店ごとの Slack に出す（2026-11-07 nosh 指示。mypage_request_reminders で重複防止）。
//   依頼の一覧は mypage-active.html のアクションタブと同じ RPC（main: mpadmin_pending / BT: mpadmin_pending_bt）。
// 起動: pg_cron が 5分ごとに x-cron-secret 付きで POST。
// deploy: functions deploy mypage-request-remind --no-verify-jwt（secrets: CRON_SECRET, SLACK_BOT_TOKEN は既存）

function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const BT_URL = "https://ggqugvyskyiblxiycpci.supabase.co";
// BT の公開(anon)キー。mypage-active.html / mypage-admin と同じ値（anon RPC のみ使用）
const BT_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncXVndnlza3lpYmx4aXljcGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDc3NjksImV4cCI6MjA5MzY4Mzc2OX0.uNhWcBd_Dl5nzemZDQfJ8mQV6iY73MwystGGpTRPC18";
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const PAGE = "https://nosh2318.github.io/spk-task/mypage-active.html";

// 店ごとの通知先（各店のマイページ通知と同じチャンネル。環境変数で上書き可）
const CH: Record<string, string> = {
  hdm_spk: Deno.env.get("SLACK_MYPAGE_CHANNEL") || "C0BER0YC6AK",
  hdm_nha: Deno.env.get("SLACK_NHA_USER_CHANNEL") || "C06L91W6T08",
  hdm_tkm: Deno.env.get("SLACK_TKM_CHANNEL") || "C0BFMBLEJGZ",
  but_tkm: Deno.env.get("SLACK_TKM_CHANNEL") || "C0BFMBLEJGZ",
  key_spk: Deno.env.get("SLACK_KEYDROP_CHANNEL") || "C08TDTPEB36",
  key_nha: Deno.env.get("SLACK_KEYDROP_CHANNEL") || "C08TDTPEB36",
};
const STORE_JP: Record<string, string> = { hdm_spk: "HDM 札幌", hdm_nha: "HDM 那覇", hdm_tkm: "HDM 高松", but_tkm: "BUT 高松", key_spk: "KEY 札幌", key_nha: "KEY 那覇" };
const FLD: Record<string, string> = { del_place: "届け先の場所の変更", col_place: "回収の場所の変更", lend_time: "貸出の時間の変更", return_time: "返却の時間の変更", ready: "早めの回収", option: "オプションの変更", cancel: "キャンセル" };

function json(o: unknown, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } }); }

// 経過を数え始める時刻：営業時間内の受付はその時刻、夜間の受付は次の 9:00 JST
function baseOf(at: string): number | null {
  const t = new Date(at); if (isNaN(+t)) return null;
  const j = new Date(+t + 9 * 3600e3), h = j.getUTCHours() + j.getUTCMinutes() / 60;
  if (h >= 9 && h < 19) return +t;
  const day = Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate() + (h < 9 ? 0 : 1));
  return day + 9 * 3600e3 - 9 * 3600e3; // その日の 9:00 JST
}
const STAGES = [{ n: 1, min: 30 }, { n: 2, min: 90 }];

async function rpc(base: string, key: string, fn: string): Promise<any[]> {
  try {
    const r = await fetch(`${base}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: "{}" });
    if (!r.ok) { console.error("[rpc]", fn, r.status); return []; }
    const j = await r.json(); return Array.isArray(j) ? j : [];
  } catch (e) { console.error("[rpc]", fn, String(e)); return []; }
}

async function slack(channel: string, text: string): Promise<boolean> {
  const token = Deno.env.get("SLACK_BOT_TOKEN"); if (!token) { console.log("[slack skip]", text); return false; }
  try {
    const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel, text }) });
    const d = await r.json().catch(() => ({})); if (!d.ok) console.error("[slack]", channel, d.error); return !!d.ok;
  } catch (e) { console.error("[slack]", String(e)); return false; }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) return new Response("unauthorized", { status: 401 });
  let dry = false; try { const b = await req.json(); dry = !!(b && b.dry); } catch { /* none */ }

  const [a, b] = await Promise.all([rpc(SB_URL, SB_KEY, "mpadmin_pending"), rpc(BT_URL, BT_ANON, "mpadmin_pending_bt")]);
  const now = Date.now();
  const hot: { x: any; st: number; el: number }[] = [];
  for (const x of a.concat(b)) {
    if (!x || x.status !== "requested") continue;
    const base = baseOf(String(x.at || "")); if (base == null) continue;
    const el = Math.floor((now - base) / 60e3);
    const st = STAGES.filter((s) => el >= s.min).pop(); if (st) hot.push({ x, st: st.n, el });
  }
  if (!hot.length) return json({ ok: true, hot: 0, sent: 0 });

  const done = new Set<string>();
  const r0 = await fetch(`${SB_URL}/rest/v1/mypage_request_reminders?select=bucket,change_id,stage&reminded_at=gte.${encodeURIComponent(new Date(now - 14 * 864e5).toISOString())}`, { headers: H });
  if (r0.ok) for (const r of await r0.json()) done.add(r.bucket + "|" + r.change_id + "|" + r.stage);

  let sent = 0; const out: unknown[] = [];
  for (const { x, st, el } of hot) {
    const key = x.bucket + "|" + x.id + "|" + st; if (done.has(key)) continue;
    // 2回目の時点で1回目が未送信なら、2回目だけ出す（1回目は記録だけ）
    const elTxt = el >= 120 ? `${Math.floor(el / 60)}時間${el % 60 ? (el % 60) + "分" : ""}` : `${el}分`;
    const link = `${PAGE}?tab=action&bucket=${encodeURIComponent(x.bucket)}&rid=${encodeURIComponent(x.rid)}`;
    const head = st === 1 ? "⏰ *返事がまだの依頼（受付から" + elTxt + "）*" : "🚨 *2回目：返事がまだの依頼（受付から" + elTxt + "）*";
    const text = `${head}（${STORE_JP[x.bucket] || x.bucket}）\n${x.name || "お客様"} 様・${FLD[x.field] || x.field}${x.newv ? `：${x.newv}` : ""}\n👉 <${link}|アクションタブで返事する>`;
    if (dry) { out.push({ key, channel: CH[x.bucket], text }); continue; }
    const ok = await slack(CH[x.bucket] || CH.hdm_spk, text);
    if (ok) {
      sent++;
      const recs = [{ bucket: x.bucket, change_id: String(x.id), stage: st }]; if (st === 2) recs.push({ bucket: x.bucket, change_id: String(x.id), stage: 1 });
      await fetch(`${SB_URL}/rest/v1/mypage_request_reminders`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(recs) });
    }
  }
  return json({ ok: true, hot: hot.length, sent, dry: dry ? out : undefined });
});
