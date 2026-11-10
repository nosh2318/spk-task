// push-test（テスト専用・2026-11-10）：個別URLのWebプッシュが実機で届くかを確かめるだけ。既存の通知には関係しない。
// action: save {name, sub, ua, standalone} / send {endpoint, delay}（delay秒後に1通。最大120秒）
//         scan {secret}（1分おきのcron）：新しい「マイページの変更依頼」「スタッフに知らせる」「チャットのお客様発言」を全テスト端末へ。読むだけで既存の表は変えない。
import webpush from "npm:web-push@3.6.7";
const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
let ready = false;
async function init() {
  if (ready) return;
  const r = await fetch(`${SB}/rest/v1/push_test_config?select=k,v`, { headers: H });
  const m: Record<string, string> = {}; for (const x of await r.json()) m[x.k] = x.v;
  webpush.setVapidDetails("https://nosh2318.github.io/spk-task/push-test/", m.vapid_pub, m.vapid_pri);
  ready = true;
}
async function patch(endpoint: string, b: unknown) {
  await fetch(`${SB}/rest/v1/push_test_subs?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(b) });
}
const ST: Record<string, string> = { spk: "札幌", nha: "那覇", tkm: "高松", test: "テスト" };
const FLD: Record<string, string> = { lend_time: "お届け時間", return_time: "回収・返却時間", del_place: "お届け場所", col_place: "回収場所", ready: "早め回収OK", received: "受け取り", cancel: "キャンセル", option: "オプション" };
const NUD: Record<string, string> = { arrived: "着きました", late: "遅れます", lost: "見つからない", parked: "停めました", not_found: "見つからない" };
const cut = (v: unknown, n = 40) => { const s = String(v ?? "").replace(/\s*\(.*?\)\s*$/, ""); return s.length > n ? s.slice(0, n) + "…" : s; };
async function get(path: string) { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json() : []; }
async function cfg() { const m: Record<string, string> = {}; for (const x of await get("push_test_config?select=k,v")) m[x.k] = x.v; return m; }
async function setCfg(k: string, v: string) { await fetch(`${SB}/rest/v1/push_test_config?on_conflict=k`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ k, v }) }); }
// 札幌の勤務中（出勤打刻あり・退勤打刻なし）の名前→出勤時刻(ms)
async function dutyMap(): Promise<Map<string, number>> {
  const d = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const rows = await get(`spk_attendance?date=eq.${d}&select=staff_name,start_time,end_time,memo`);
  const m = new Map<string, number>();
  for (const r of rows) if ((r.start_time || "") !== "" && (r.end_time || "") === "" && /^(打刻|打刻中|仮申請|協議中)/.test(r.memo || "")) {
    const t = Date.parse(`${d}T${String(r.start_time).slice(0, 5)}:00+09:00`); m.set(r.staff_name, isNaN(t) ? 0 : t); }
  return m;
}
async function onDuty(): Promise<Set<string>> { return new Set((await dutyMap()).keys()); }
// 札幌：依頼・「知らせる」は、その予約の担当（DEL=お届け／COL=回収）だけへ。担当なしは勤務中の全員へ
async function assignee(resv: string, tt: string) {
  const ts = await get(`tasks?reservation_id=eq.${encodeURIComponent(resv)}&select=type,assignee&order=date.desc`);
  const t = ts.find((x: any) => String(x.type || "").toUpperCase().startsWith(tt));
  const a = String(t?.assignee || "").trim(); if (!a) return "";
  const names = (await get(`staff?select=name&active=not.is.false`)).map((x: any) => String(x.name));
  return names.includes(a) ? a : ""; // 「無人」「乗り捨て」など人でない担当は担当なし扱い
}
// 未確認のお知らせを札幌スタッフ別にためる（担当あり＝担当者へ・勤務外でも残す／担当なし＝勤務中の全員へ）
async function stock(msgs: { title: string; body: string; store?: string; target?: string; kind?: string; resv?: string; ref?: string }[]) {
  const sp = msgs.filter((m) => m.store === "spk" && m.ref); if (!sp.length) return;
  const duty = [...(await onDuty())];
  const rows: any[] = [];
  for (const m of sp) for (const nm of (m.target ? [m.target] : duty)) rows.push({ store: "spk", staff_name: nm, kind: m.kind || "", title: m.title, body: m.body, reservation_id: m.resv || null, ref: m.ref });
  if (rows.length) await fetch(`${SB}/rest/v1/staff_inbox?on_conflict=staff_name,ref`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(rows) });
}
async function toAll(msgs: { title: string; body: string; store?: string; target?: string; only?: boolean }[]) {
  if (!msgs.length) return 0;
  await init();
  const subs = await get("push_test_subs?select=endpoint,sub,store,staff_name&paused=eq.false");
  const duty = await onDuty();
  let n = 0;
  for (const m of msgs.slice(0, 10)) for (const s of subs) {
    if (s.store && m.store && s.store !== m.store) continue;
    if (s.staff_name && !duty.has(s.staff_name)) continue; // 札幌：出勤打刻〜退勤打刻の間だけ受ける
    if (s.staff_name && m.target && m.target !== s.staff_name) continue; // 担当者だけ
    if (m.only && !s.staff_name) continue; // 再通知は本人の端末だけ
    let res = "ok";
    try { await webpush.sendNotification(s.sub, JSON.stringify({ title: m.title, body: m.body, url: "./" }), { TTL: 3600, urgency: "high" }); n++; }
    catch (e: any) { res = `err ${e?.statusCode || ""} ${String(e?.body || e?.message || e).slice(0, 120)}`; }
    if (/^err (404|410)/.test(res)) await fetch(`${SB}/rest/v1/push_test_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE", headers: H });
    else await patch(s.endpoint, { last_sent_at: new Date().toISOString(), last_result: res });
  }
  return n;
}
// 押されるまで追いかける（札幌・勤務中の人だけ。時間は「届いた時刻」と「出勤打刻」の遅い方から数える）
//  10分：もう一度プッシュ／20分：本人LINE（登録者のみ）／30分：Slack（マイページ依頼チャンネル）で社員へ
const nz = (s: string) => String(s || "").replace(/\s|さん$/g, "");
async function linePush(to: string, text: string) {
  const tk = Deno.env.get("LINE_CHANNEL_TOKEN"); if (!tk) return false;
  const r = await fetch("https://api.line.me/v2/bot/message/push", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` }, body: JSON.stringify({ to, messages: [{ type: "text", text }] }) });
  return r.ok;
}
async function slackPost(text: string) {
  const tk = Deno.env.get("SLACK_BOT_TOKEN"); if (!tk) return false;
  const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: Deno.env.get("SLACK_MYPAGE_CHANNEL") || "C0BER0YC6AK", text }) });
  return (await r.json().catch(() => ({}))).ok === true;
}
async function mark(ids: number[], col: string) {
  if (ids.length) await fetch(`${SB}/rest/v1/staff_inbox?id=in.(${ids.join(",")})`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ [col]: new Date().toISOString() }) });
}
async function chase() {
  const rows = await get(`staff_inbox?store=eq.spk&seen_at=is.null&created_at=gt.${new Date(Date.now() - 24 * 3600e3).toISOString()}&select=id,staff_name,kind,ref,title,body,created_at,repush_at,line_at,slack_at&order=id.asc&limit=300`);
  if (!rows.length) return { repush: 0, line: 0, slack: 0 };
  const duty = await dutyMap(); const now = Date.now();
  const by = new Map<string, any[]>();
  for (const r of rows) { if (!duty.has(r.staff_name)) continue; const age = (now - Math.max(Date.parse(r.created_at), duty.get(r.staff_name) || 0)) / 60000; (by.get(r.staff_name) || by.set(r.staff_name, []).get(r.staff_name)!).push({ ...r, age }); }
  const links = by.size ? await get(`spk_staff_line_links?select=staff_name,line_user_id&line_user_id=not.is.null`) : [];
  const out = { repush: 0, line: 0, slack: 0 };
  const late: any[] = [];
  for (const [nm, list] of by) {
    const a = list.filter((r) => r.age >= 10 && !r.repush_at);
    if (a.length) { out.repush += await toAll([{ title: `【札幌】未確認のお知らせ ${list.length}件`, body: `${a[0].title}\n個別URLを開いて「確認しました」を押してください`, store: "spk", target: nm, only: true }]); await mark(a.map((r) => r.id), "repush_at"); }
    // LINE・Slack は「依頼」「知らせる」だけ（チャットは今のSlackの流れのまま）
    const b = list.filter((r) => r.kind !== "chat" && r.age >= 20 && !r.line_at);
    if (b.length) { const l = links.find((x: any) => nz(nm).startsWith(nz(x.staff_name)));
      if (l && await linePush(l.line_user_id, `【HANDYMAN札幌】${nm}さん、お客様からのお知らせが ${b.length}件 未確認です。\n${b.slice(0, 3).map((r) => "・" + r.title.replace(/^【札幌】/, "")).join("\n")}\n個別URLを開いて確認してください。`)) out.line++;
      await mark(b.map((r) => r.id), "line_at"); }
    late.push(...list.filter((r) => r.kind !== "chat" && r.age >= 30 && !r.slack_at));
  }
  if (late.length) {
    // 同じお知らせを複数人に配った場合は、だれか1人でも確認済みなら社員へは回さない。1回のまとめ投稿にする
    const refs = [...new Set(late.map((r) => r.ref))];
    const done = new Set((await get(`staff_inbox?ref=in.(${refs.map((x) => `"${x}"`).join(",")})&seen_at=not.is.null&select=ref`)).map((x: any) => x.ref));
    const lines: string[] = [];
    for (const ref of refs) { if (done.has(ref)) continue; const rs = late.filter((r) => r.ref === ref);
      lines.push(`・${rs[0].title.replace(/^【札幌】/, "")}　${String(rs[0].body).split("\n")[0]}　（未確認：${rs.map((r) => r.staff_name + "さん").join("・")}）`); }
    if (lines.length && await slackPost(`⏰ 個別URLで30分以上 未確認のお知らせがあります → 社員で確認・対応をお願いします\n${lines.slice(0, 10).join("\n")}`)) out.slack++;
    await mark(late.map((r) => r.id), "slack_at");
  }
  return out;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let b: any; try { b = await req.json(); } catch { return j({ ok: false, error: "bad json" }, 400); }
  if (b.action === "save") {
    const sub = b.sub; if (!sub?.endpoint) return j({ ok: false, error: "no sub" }, 400);
    // 個別URL（staff.html?t=）から来た時は、トークンで本人を特定する（名前を選ばせない）
    if (b.token) {
      const st = (await get(`staff?share_token=eq.${encodeURIComponent(String(b.token))}&select=name,active`))[0];
      if (!st || st.active === false) return j({ ok: false, error: "invalid token" }, 403);
      b.name = st.name; b.staff = st.name; b.store = "spk";
    }
    const r = await fetch(`${SB}/rest/v1/push_test_subs?on_conflict=endpoint`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ name: String(b.name || "").slice(0, 40), endpoint: sub.endpoint, sub, ua: String(b.ua || "").slice(0, 200), standalone: !!b.standalone, store: /^(spk|nha|tkm)$/.test(b.store) ? b.store : null, staff_name: b.store === "spk" && b.staff ? String(b.staff).slice(0, 40) : null }) });
    return j({ ok: r.ok });
  }
  if (b.action === "staff") {
    const rows = await get(`staff?select=name,active&order=name.asc`);
    return j({ ok: true, names: rows.filter((r: any) => r.active !== false).map((r: any) => r.name) });
  }
  if (b.action === "pause") {
    const ep = String(b.endpoint || ""); if (!ep) return j({ ok: false }, 400);
    await patch(ep, { paused: !!b.paused });
    return j({ ok: true, paused: !!b.paused });
  }
  if (b.action === "state") {
    const row = (await get(`push_test_subs?endpoint=eq.${encodeURIComponent(String(b.endpoint || ""))}&select=paused,staff_name`))[0];
    const duty = row?.staff_name ? (await onDuty()).has(row.staff_name) : null;
    return j({ ok: !!row, paused: row ? row.paused : false, staff: row?.staff_name || null, on_duty: duty });
  }
  if (b.action === "send") {
    const ep = String(b.endpoint || "");
    const r = await fetch(`${SB}/rest/v1/push_test_subs?endpoint=eq.${encodeURIComponent(ep)}&select=sub,name`, { headers: H });
    const row = (await r.json())[0]; if (!row) return j({ ok: false, error: "not saved" }, 404);
    const delay = Math.max(0, Math.min(120, +b.delay || 0));
    await init();
    const job = (async () => {
      await new Promise((res) => setTimeout(res, delay * 1000));
      const t = new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16);
      let res = "ok";
      try {
        await webpush.sendNotification(row.sub, JSON.stringify({ title: "【テスト】お客様から変更の依頼", body: `11/12 回収 山田様 時間 15:00→17:00（${t} 送信）`, url: "./" }), { TTL: 3600, urgency: "high" });
      } catch (e: any) { res = `err ${e?.statusCode || ""} ${String(e?.body || e?.message || e).slice(0, 150)}`; }
      await patch(ep, { last_sent_at: new Date().toISOString(), last_result: res });
    })();
    // @ts-ignore EdgeRuntime
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(job); else await job;
    return j({ ok: true, delay });
  }
  if (b.action === "scan") {
    const c = await cfg(); if (!c.scan_secret || b.secret !== c.scan_secret) return j({ ok: false }, 401);
    const msgs: { title: string; body: string; store?: string; target?: string; kind?: string; resv?: string; ref?: string }[] = [];
    const ch = await get(`mypage_changes?id=gt.${+c.last_chg || 0}&select=id,store,reservation_id,field,old_value,new_value,status,source,actor&order=id.asc&limit=50`);
    for (const x of ch) {
      if (x.source === "staff" || (x.status === "applied" && x.actor)) continue; // スタッフ側の記録・承認後の反映記録は通知しない
      const direct = x.status === "applied"; const tt = /^(lend_time|del_place)$/.test(x.field) ? "DEL" : "COL"; const tg = x.store === "spk" ? await assignee(x.reservation_id, tt) : "";
      msgs.push({ title: `【${ST[x.store] || x.store}】${direct ? "お客様が変更しました（反映済み）" : "お客様から変更の依頼"}`, body: `${FLD[x.field] || x.field}：${cut(x.old_value) || "（なし）"} → ${cut(x.new_value)}\n予約 ${x.reservation_id}${tg ? `（担当 ${tg}）` : ""}`, store: x.store, target: tg, kind: "change", resv: x.reservation_id, ref: `chg:${x.id}` }); }
    const nd = await get(`mypage_nudges?id=gt.${+c.last_nudge || 0}&select=id,store,reservation_id,kind,leg,note&order=id.asc&limit=50`);
    for (const x of nd) { const tg = x.store === "spk" ? await assignee(x.reservation_id, x.leg === "back" ? "COL" : "DEL") : "";
      msgs.push({ title: `【${ST[x.store] || x.store}】お客様から「${NUD[x.kind] || x.kind}」`, body: `${x.leg === "back" ? "返却・回収" : "受け取り"}${x.note ? "　" + cut(x.note) : ""}\n予約 ${x.reservation_id}`, store: x.store, target: tg, kind: "nudge", resv: x.reservation_id, ref: `nud:${x.id}` }); }
    const cm = await get(`cs_chat_messages?id=gt.${+c.last_chat || 0}&sender=eq.customer&select=id,thread_id,body&order=id.asc&limit=50`);
    const cmax = (await get(`cs_chat_messages?select=id&order=id.desc&limit=1`))[0]?.id;
    for (const x of cm) { const t = (await get(`cs_chat_threads?id=eq.${x.thread_id}&select=store,cust_name,reservation_id`))[0] || {}; msgs.push({ title: `【${ST[t.store] || t.store || ""}】チャット：${t.cust_name || "お客様"}`, body: cut(x.body, 60) || "（画像）", store: t.store, kind: "chat", resv: t.reservation_id, ref: `chat:${x.id}` }); }
    if (ch.length) await setCfg("last_chg", String(ch[ch.length - 1].id));
    if (nd.length) await setCfg("last_nudge", String(nd[nd.length - 1].id));
    if (cmax) await setCfg("last_chat", String(cmax));
    await stock(msgs);
    const sent = await toAll(msgs);
    const ch2 = await chase();
    return j({ ok: true, events: msgs.length, sent, chase: ch2 });
  }
  return j({ ok: false, error: "unknown action" }, 400);
});
