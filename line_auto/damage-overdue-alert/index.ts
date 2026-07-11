// Supabase Edge Function: damage-overdue-alert (店舗対応: spk / nha)
// 傷チェック手動送信リスト（DamageSendList）で、出発時刻を過ぎても未対応の
// 「📱手動（LINE未連携）」タスクを検知し、Slack #handyman_development へアラート。
//   SPK: tasks type=DEL / time / reservations
//   NHA: nha_tasks 内容 in (PUB,DEL,来店) / 時間 / nha_reservations
// 判定（DamageSendList と同一定義）:
//   対象   = 本日の傷チェック対象タスク（予約番号あり・キャンセル除外）
//   出発超過 = 出発時刻(HH:MM) <= 現在時刻(JST)  ← graceは出発時刻ちょうど
//   📱手動  = {store}_line_links に resv_no が無い（＝LINE未連携）
//   未対応  = {store}_line_sends に action=damage_check で status in (sent,manual_done) が無い
//   dedup   = {store}_line_sends に action=overdue_alert が無い（同一予約は1回だけ通知）
// 既存の自動送信(damage-check-cron)には一切手を入れない。監視・通知のみ。
// pg_cron が x-cron-secret + body{store} で起動。
// deploy: functions deploy damage-overdue-alert --no-verify-jwt
//   secrets: CRON_SECRET, SLACK_BOT_TOKEN

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const SLACK_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";
const SLACK_CHANNEL = "C07B5G3PV7C"; // #handyman_development
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
async function sbGet(p: string) { const r = await fetch(`${SB_URL}/rest/v1/${p}`, { headers: H }); return r.ok ? await r.json() : []; }
function json(o: unknown) { return new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } }); }
const enc = encodeURIComponent;

const STORES: Record<string, any> = {
  spk: { label: "札幌", tasks: "tasks", typeCol: "type", typeVals: ["DEL"], timeCol: "time", nameCol: "name", resvCol: "reservation_id", assigneeCol: "assignee", links: "spk_line_links", sends: "spk_line_sends", doneCol: "done", resv: "reservations" },
  nha: { label: "那覇", tasks: "nha_tasks", typeCol: "内容", typeVals: ["PUB", "DEL", "来店"], timeCol: "時間", nameCol: "予約者", resvCol: "予約番号", assigneeCol: "担当", links: "nha_line_links", sends: "nha_line_sends", doneCol: null, resv: "nha_reservations" },
};

async function slackPost(text: string, blocks?: unknown[]): Promise<boolean> {
  if (!SLACK_TOKEN) { console.error("[slack] no SLACK_BOT_TOKEN"); return false; }
  const body: any = { channel: SLACK_CHANNEL, text };
  if (blocks) body.blocks = blocks;
  try {
    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${SLACK_TOKEN}`, "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!d.ok) { console.error("[slack]", JSON.stringify(d)); return false; }
    return true;
  } catch (e) { console.error("[slack]", String(e)); return false; }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) return new Response("unauthorized", { status: 401 });
  let store = "spk";
  let testMode = false;
  try { const b = await req.json(); if (b && b.store === "nha") store = "nha"; if (b && b.test === true) testMode = true; } catch { /* default spk */ }
  const S = STORES[store];

  // Slack疎通テスト: DBに一切書かず #handyman_development へサンプル投稿のみ（bot招待確認用）
  if (testMode) {
    const posted = await slackPost("🧪 傷チェック未対応アラート 疎通テスト（実データではありません）", [
      { type: "header", text: { type: "plain_text", text: `🧪 傷チェック未対応アラート 疎通テスト — ${S.label}店`, emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: "これは #handyman_development への投稿疎通テストです（DBには何も書き込みません）。\n• *09:00* [DEL] サンプル 太郎（TESTRESV）👤担当未定" } },
      { type: "divider" },
    ]);
    return json({ ok: true, store, test: true, posted });
  }

  const nowJST = new Date(Date.now() + 9 * 3600 * 1000);
  const today = nowJST.toISOString().slice(0, 10);
  const nowMin = nowJST.getUTCHours() * 60 + nowJST.getUTCMinutes();

  // 本日の傷チェック対象タスク（DamageSendlist と同じ抽出）
  let q = `${S.tasks}?date=eq.${today}&${enc(S.typeCol)}=in.(${S.typeVals.map(enc).join(",")})&${enc(S.resvCol)}=not.is.null&select=${enc(S.resvCol)},${enc(S.timeCol)},${enc(S.nameCol)},${enc(S.assigneeCol)},${enc(S.typeCol)}`;
  if (S.doneCol) q += `&${enc(S.doneCol)}=eq.false`;
  const tasks = await sbGet(q);
  const cands = (tasks as any[])
    .map((t) => ({ resv: t[S.resvCol], time: t[S.timeCol], name: t[S.nameCol] || "", asg: t[S.assigneeCol] || "", type: t[S.typeCol] }))
    .filter((t) => {
      if (!t.resv) return false;
      if (!t.time || !/^\d{1,2}:\d{2}/.test(String(t.time))) return false; // 時間未定は判定不能→除外
      const [h, m] = String(t.time).split(":").map(Number);
      return (h * 60 + m) <= nowMin; // 出発時刻ちょうどを過ぎた（grace=0）
    });
  if (!cands.length) return json({ ok: true, store, overdue: 0, reason: "no_time_passed_tasks" });

  const resvList = [...new Set(cands.map((t) => t.resv))];
  const inList = resvList.map(enc).join(",");

  // 予約状態（キャンセル除外）
  const resvRows = await sbGet(`${S.resv}?id=in.(${inList})&select=id,status`);
  const cancelled = new Set((resvRows as any[]).filter((r) => {
    const st = String(r.status || "").toLowerCase();
    return st.includes("cancel") || st.includes("キャンセル");
  }).map((r) => r.id));

  // LINE連携済み（📱OK）= links に resv_no がある
  const links = await sbGet(`${S.links}?resv_no=in.(${inList})&select=resv_no`);
  const linkedSet = new Set((links as any[]).map((l) => l.resv_no));

  // 送信ログ（対応済み判定 damage_check、dedup判定 overdue_alert）
  const sends = await sbGet(`${S.sends}?resv_no=in.(${inList})&action=in.(damage_check,overdue_alert)&select=resv_no,action,status`);
  const doneSet = new Set(); // 手動対応済み or 自動送信済み
  const alertedSet = new Set(); // 既にアラート済み
  (sends as any[]).forEach((s) => {
    if (s.action === "damage_check" && (s.status === "sent" || s.status === "manual_done")) doneSet.add(s.resv_no);
    if (s.action === "overdue_alert") alertedSet.add(s.resv_no);
  });

  // 未対応アラート対象を確定
  const overdue = cands.filter((t) =>
    !cancelled.has(t.resv) &&   // キャンセル除外
    !linkedSet.has(t.resv) &&   // 📱手動（LINE未連携）のみ
    !doneSet.has(t.resv) &&     // 未対応（自動送信/手動対応がまだ）
    !alertedSet.has(t.resv)     // 未通知（1回だけ）
  );
  if (!overdue.length) return json({ ok: true, store, overdue: 0 });

  // 時刻順で整列
  overdue.sort((a, b) => String(a.time || "99:99").localeCompare(String(b.time || "99:99")));

  // Slack Block Kit で投稿
  const lines = overdue.map((t) => {
    const asg = t.asg ? ` 👤${t.asg}` : " 👤担当未定";
    return `• *${t.time}* [${t.type}] ${t.name || "名前なし"}（${t.resv}）${asg}`;
  });
  const header = `🚨 傷チェック手動送信 未対応アラート — ${S.label}店（未対応 ${overdue.length}件）`;
  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: header, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: `本日 *${today}* の傷チェック対象で、出発時刻を過ぎても *📱手動送信が未対応* の予約です（LINE未連携）。\nエルメ/LINEで傷チェック案内を手動送信し、リストで「✅対応」を押してください。` } },
    { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
    { type: "context", elements: [{ type: "mrkdwn", text: `👉 ${store === "nha" ? "那覇" : "札幌"}APP TOP →「🩹 傷チェック送信」で対応・0件になるまで` }] },
    { type: "divider" },
  ];
  const posted = await slackPost(header, blocks);

  // dedup 記録（overdue_alert を積む＝同一予約は1回だけ通知）。Slack投稿成功時のみ。
  if (posted) {
    for (const t of overdue) {
      await fetch(`${SB_URL}/rest/v1/${S.sends}`, {
        method: "POST", headers: { ...H, Prefer: "return=minimal" },
        body: JSON.stringify({ resv_no: t.resv, action: "overdue_alert", status: "sent", message: `傷チェック未対応アラート ${t.time} ${t.name}` }),
      });
    }
  }
  return json({ ok: true, store, overdue: overdue.length, posted, items: overdue.map((t) => ({ resv: t.resv, time: t.time, name: t.name })) });
});
