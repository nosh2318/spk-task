// Supabase Edge Function: license-overdue-alert (全店 免許証 未提出アラート)
// 当日〜2日先に出発する予約のうち、免許証が「未提出(license_uploads cnt=0)」かつ「未対応(license_ack無し)」を全店集計してSlack通知。
//   札幌(spk)/那覇(nha)=main DB、高松(bt)=BT DB。予約番号キーで license_uploads を照合（どの導線のアップも反映）。
//   未提出ゼロなら静か（投稿しない）。pg_cron が x-cron-secret で 1日1回起動。
// deploy: functions deploy license-overdue-alert --no-verify-jwt  (secrets: CRON_SECRET, SLACK_BOT_TOKEN, BT_URL, BT_SERVICE_KEY)

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const SLACK_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";
const SLACK_CHANNEL = "C07B5G3PV7C"; // #handyman_development
const BT_URL = Deno.env.get("BT_URL") || "https://ggqugvyskyiblxiycpci.supabase.co";
const BT_KEY = Deno.env.get("BT_SERVICE_KEY") || "";
// 高松(BT)の通知は別Slack(BUDDICAワークスペース)の #operation-高松空港店 へ
const BT_SLACK_TOKEN = Deno.env.get("BT_SLACK_TOKEN") || "";
const BT_SLACK_CHANNEL = "C0BFMBLEJGZ"; // #operation-高松空港店 (buddica-tourism)

const STORES = [
  { key: "spk", label: "🟦 札幌", url: SB_URL, k: SB_KEY, resv: "reservations", dateCol: "lend_date", timeCol: "lend_time", sends: "spk_line_sends", lic: "spk" },
  { key: "nha", label: "🟩 那覇", url: SB_URL, k: SB_KEY, resv: "nha_reservations", dateCol: "start_date", timeCol: "start_time", sends: "nha_line_sends", lic: "nha" },
  { key: "bt",  label: "🟧 高松", url: BT_URL, k: BT_KEY, resv: "bt_reservations", dateCol: "start_date", timeCol: "start_time", sends: "bt_line_sends", lic: "bt" },
];

const enc = encodeURIComponent;
function json(o: unknown) { return new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } }); }
async function get(url: string, key: string, path: string) {
  if (!key) return [];
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  return r.ok ? await r.json() : [];
}
async function slackTo(token: string, channel: string, text: string) {
  if (!token) return false;
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ channel, text, unfurl_links: false }),
  });
  const j = await r.json().catch(() => ({}));
  return !!j.ok;
}
function storeBlock(r: any) {
  let t = `\n*${r.label}｜未提出 ${r.unsub.length}件*\n`;
  t += r.unsub.slice(0, 20).map((u: any) => `・${u.date} ${u.time}　${u.name}`).join("\n");
  if (r.unsub.length > 20) t += `\n…ほか ${r.unsub.length - 20}件`;
  return t + "\n";
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) return new Response("unauthorized", { status: 401 });

  const nowJST = new Date(Date.now() + 9 * 3600 * 1000);
  const dstr = (off: number) => new Date(nowJST.getTime() + off * 86400000).toISOString().slice(0, 10);
  const targets = [dstr(0), dstr(1), dstr(2)]; // 当日〜2日先

  const results: any[] = [];
  for (const S of STORES) {
    try {
      const inDates = targets.map((d) => `"${d}"`).join(",");
      const resvs = await get(S.url, S.k, `${S.resv}?${S.dateCol}=in.(${inDates})&select=id,name,status,${S.dateCol},${S.timeCol}`);
      const alive = (resvs as any[]).filter((r) => {
        const st = String(r.status || "").toLowerCase();
        return r.id && !st.includes("cancel") && !st.includes("キャンセル");
      });
      if (!alive.length) { results.push({ store: S.key, total: 0, unsub: [] }); continue; }
      const ids = alive.map((r) => r.id);
      const idIn = ids.map((x: string) => enc(x)).join(",");
      const lu = await get(S.url, S.k, `license_uploads?reservation_id=in.(${idIn})&select=reservation_id,cnt`);
      const doneSet = new Set((lu as any[]).filter((x) => (x.cnt || 0) > 0).map((x) => x.reservation_id));
      const ack = await get(S.url, S.k, `${S.sends}?action=eq.license_ack&resv_no=in.(${idIn})&select=resv_no,status`);
      const ackSet = new Set((ack as any[]).filter((x) => x.status === "manual_done").map((x) => x.resv_no));
      const unsub = alive
        .filter((r) => !doneSet.has(r.id) && !ackSet.has(r.id))
        .map((r) => ({ name: r.name || "名前なし", date: String(r[S.dateCol]).slice(5), time: r[S.timeCol] || "" }))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      results.push({ store: S.key, label: S.label, total: alive.length, unsub });
    } catch (e) {
      results.push({ store: S.key, error: String(e) });
    }
  }

  const totalUnsub = results.reduce((n, r) => n + (r.unsub ? r.unsub.length : 0), 0);
  const posted: string[] = [];
  // 札幌・那覇 → #handyman_development(HANDYMAN GL)
  const mainStores = results.filter((r) => (r.store === "spk" || r.store === "nha") && r.unsub && r.unsub.length);
  if (mainStores.length) {
    const n = mainStores.reduce((a, r) => a + r.unsub.length, 0);
    let text = `🪪 *免許証 未提出アラート（札幌・那覇｜当日〜2日先）* — 合計 *${n}件*\n免許証をまだアップしていないお客様です。免許証チェックリストで対応（連絡/消し込み）をお願いします。\n`;
    text += mainStores.map(storeBlock).join("");
    if (await slackTo(SLACK_TOKEN, SLACK_CHANNEL, text)) posted.push("gl");
  }
  // 高松 → #operation-高松空港店(BUDDICA)
  const bt = results.find((r) => r.store === "bt");
  if (bt && bt.unsub && bt.unsub.length) {
    let text = `🪪 *免許証 未提出アラート（高松｜当日〜2日先）* — *${bt.unsub.length}件*\n免許証をまだアップしていないお客様です。ご利用ガイドの案内・対応（📋コピー/✅対応済）をお願いします。\n`;
    text += storeBlock(bt);
    if (await slackTo(BT_SLACK_TOKEN, BT_SLACK_CHANNEL, text)) posted.push("bt");
  }
  return json({ ok: true, totalUnsub, posted, results });
});
