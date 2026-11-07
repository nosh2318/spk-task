// Supabase Edge Function: mypage-request-remind（main / ckrxttbnawkclshczsia）
// マイページの依頼（変更・キャンセル・早め回収など）を「返事の目安」を過ぎないように Slack で再通知する。
//   返事の目安 = 受付から30分（JST 9:00〜19:00）。夜間（19:00〜翌9:00）の受付は次の 9:30。
//   目安まで15分を切った「未処理」の依頼を、店ごとの Slack チャンネルに1回だけ再通知する（mypage_request_reminders で重複防止）。
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

// 返事の目安（mypage-active.html の dueOf と同じ規則）
function dueOf(at: string): number | null {
  const t = new Date(at); if (isNaN(+t)) return null;
  const j = new Date(+t + 9 * 3600e3), h = j.getUTCHours() + j.getUTCMinutes() / 60;
  if (h >= 9 && h < 19) return +t + 30 * 60e3;
  const day = new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate() + (h < 9 ? 0 : 1)));
  return +day + 9.5 * 3600e3 - 9 * 3600e3; // その日の 9:30 JST
}

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
  const hot = a.concat(b).filter((x) => x && x.status === "requested").map((x) => ({ x, due: dueOf(String(x.at || "")) }))
    .filter((o) => o.due != null && (o.due as number) - now <= 15 * 60e3);
  if (!hot.length) return json({ ok: true, hot: 0, sent: 0 });

  // 既に再通知したもの
  const done = new Set<string>();
  const r0 = await fetch(`${SB_URL}/rest/v1/mypage_request_reminders?select=bucket,change_id&reminded_at=gte.${encodeURIComponent(new Date(now - 7 * 864e5).toISOString())}`, { headers: H });
  if (r0.ok) for (const r of await r0.json()) done.add(r.bucket + "|" + r.change_id);

  let sent = 0; const out: unknown[] = [];
  for (const { x, due } of hot) {
    const key = x.bucket + "|" + x.id; if (done.has(key)) continue;
    const m = Math.round(((due as number) - now) / 60e3);
    const left = m >= 0 ? `残り${m}分` : `目安を${-m}分過ぎています`;
    const link = `${PAGE}?tab=action&bucket=${encodeURIComponent(x.bucket)}&rid=${encodeURIComponent(x.rid)}`;
    const text = `⏰ *返事の目安まで${left}*（${STORE_JP[x.bucket] || x.bucket}）\n${x.name || "お客様"} 様・${FLD[x.field] || x.field}${x.newv ? `：${x.newv}` : ""}\n👉 <${link}|アクションタブで返事する>`;
    if (dry) { out.push({ key, channel: CH[x.bucket], text }); continue; }
    const ok = await slack(CH[x.bucket] || CH.hdm_spk, text);
    if (ok) {
      sent++;
      await fetch(`${SB_URL}/rest/v1/mypage_request_reminders`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ bucket: x.bucket, change_id: String(x.id) }) });
    }
  }
  return json({ ok: true, hot: hot.length, sent, dry: dry ? out : undefined });
});
