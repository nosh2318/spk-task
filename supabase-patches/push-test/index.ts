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
async function toAll(msgs: { title: string; body: string; store?: string }[]) {
  if (!msgs.length) return 0;
  await init();
  const subs = await get("push_test_subs?select=endpoint,sub,store&paused=eq.false");
  let n = 0;
  for (const m of msgs.slice(0, 10)) for (const s of subs) {
    if (s.store && m.store && s.store !== m.store) continue;
    let res = "ok";
    try { await webpush.sendNotification(s.sub, JSON.stringify({ title: m.title, body: m.body, url: "./" }), { TTL: 3600, urgency: "high" }); n++; }
    catch (e: any) { res = `err ${e?.statusCode || ""} ${String(e?.body || e?.message || e).slice(0, 120)}`; }
    if (/^err (404|410)/.test(res)) await fetch(`${SB}/rest/v1/push_test_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE", headers: H });
    else await patch(s.endpoint, { last_sent_at: new Date().toISOString(), last_result: res });
  }
  return n;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let b: any; try { b = await req.json(); } catch { return j({ ok: false, error: "bad json" }, 400); }
  if (b.action === "save") {
    const sub = b.sub; if (!sub?.endpoint) return j({ ok: false, error: "no sub" }, 400);
    const r = await fetch(`${SB}/rest/v1/push_test_subs?on_conflict=endpoint`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ name: String(b.name || "").slice(0, 40), endpoint: sub.endpoint, sub, ua: String(b.ua || "").slice(0, 200), standalone: !!b.standalone, store: /^(spk|nha|tkm)$/.test(b.store) ? b.store : null }) });
    return j({ ok: r.ok });
  }
  if (b.action === "pause") {
    const ep = String(b.endpoint || ""); if (!ep) return j({ ok: false }, 400);
    await patch(ep, { paused: !!b.paused });
    return j({ ok: true, paused: !!b.paused });
  }
  if (b.action === "state") {
    const row = (await get(`push_test_subs?endpoint=eq.${encodeURIComponent(String(b.endpoint || ""))}&select=paused`))[0];
    return j({ ok: !!row, paused: row ? row.paused : false });
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
    const msgs: { title: string; body: string; store?: string }[] = [];
    const ch = await get(`mypage_changes?id=gt.${+c.last_chg || 0}&select=id,store,reservation_id,field,old_value,new_value&order=id.asc&limit=50`);
    for (const x of ch) msgs.push({ title: `【${ST[x.store] || x.store}】お客様から変更の依頼`, body: `${FLD[x.field] || x.field}：${cut(x.old_value) || "（なし）"} → ${cut(x.new_value)}\n予約 ${x.reservation_id}`, store: x.store });
    const nd = await get(`mypage_nudges?id=gt.${+c.last_nudge || 0}&select=id,store,reservation_id,kind,leg,note&order=id.asc&limit=50`);
    for (const x of nd) msgs.push({ title: `【${ST[x.store] || x.store}】お客様から「${NUD[x.kind] || x.kind}」`, body: `${x.leg === "back" ? "返却・回収" : "受け取り"}${x.note ? "　" + cut(x.note) : ""}\n予約 ${x.reservation_id}`, store: x.store });
    const cm = await get(`cs_chat_messages?id=gt.${+c.last_chat || 0}&sender=eq.customer&select=id,thread_id,body&order=id.asc&limit=50`);
    const cmax = (await get(`cs_chat_messages?select=id&order=id.desc&limit=1`))[0]?.id;
    for (const x of cm) { const t = (await get(`cs_chat_threads?id=eq.${x.thread_id}&select=store,cust_name,reservation_id`))[0] || {}; msgs.push({ title: `【${ST[t.store] || t.store || ""}】チャット：${t.cust_name || "お客様"}`, body: cut(x.body, 60) || "（画像）", store: t.store }); }
    if (ch.length) await setCfg("last_chg", String(ch[ch.length - 1].id));
    if (nd.length) await setCfg("last_nudge", String(nd[nd.length - 1].id));
    if (cmax) await setCfg("last_chat", String(cmax));
    const sent = await toAll(msgs);
    return j({ ok: true, events: msgs.length, sent });
  }
  return j({ ok: false, error: "unknown action" }, 400);
});
