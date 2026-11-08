// nha-delivery-status — 那覇のお届け・回収の「今」をマイページに出す（2026-11-08 nosh 決定）
//   ・スタッフがボタン（出発/回収に向かう・遅延・到着）を押すだけで進む。お客様には何も求めない。
//   ・状態: prep(準備中) → onway(向かっています) → late(遅れています) → arrived(到着しました)
//   ・位置は「押した瞬間」の1回（staff-action が kd_driver_lat/lng/at に書く）。手段(kd_driver_mode)はお客様に出さない。
//   ・到着・遅延の記録は nha_line_sends（staff-action→line-push が必ず書くログ）から読む＝DB列を増やさない。
// action:
//   lookup { token }                     … マイページ（my-nha.html）から。mypage_token で予約を特定
//   watch  (header x-cron-secret)        … pg_cron 5分毎。出発の押し忘れを Slack に警告（15分前・時刻ちょうどの2回）
// deploy: --no-verify-jwt   secrets: CRON_SECRET, SLACK_BOT_TOKEN, STAFF_DONE_CHANNEL_NHA
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" };

const ALLOWED = ["https://nosh2318.github.io", "https://rent-handyman.com", "https://keydrop.jp"];
function cors(o: string | null) {
  const allow = o && ALLOWED.includes(o) ? o : ALLOWED[0];
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-cron-secret", "Vary": "Origin" };
}
function json(b: unknown, s: number, o: string | null) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors(o), "content-type": "application/json" } }); }
async function sbGet(path: string): Promise<any[]> { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H }); if (!r.ok) { console.error("GET", path, await r.text()); return []; } return await r.json(); }
async function rpc(fn: string, body: unknown): Promise<any> { const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(body) }); return r.ok ? await r.json().catch(() => null) : null; }
const enc = encodeURIComponent;

// JST の今日・時刻
function jstNow() { return new Date(Date.now() + 9 * 3600e3); }
function jstToday(): string { return jstNow().toISOString().slice(0, 10); }
function todayStartIso(): string { return new Date(Date.parse(`${jstToday()}T00:00:00+09:00`)).toISOString(); }
function hmToMs(date: string, hm: string): number | null { const m = String(hm || "").match(/(\d{1,2}):(\d{2})/); if (!m) return null; const t = Date.parse(`${date}T${m[1].padStart(2, "0")}:${m[2]}:00+09:00`); return isNaN(t) ? null : t; }
function isCancelled(st: string) { const s = String(st || "").toLowerCase(); return s.includes("cancel") || s.includes("キャンセル"); }

const SEL = "id,name,status,start_date,end_date,start_time,end_time,del_time,col_time,visit_type,return_type,del_place,col_place,kd_status,kd_status_at,kd_driver_lat,kd_driver_lng,kd_driver_at,kd_driver_mode,mypage_token";

// その予約の「今日の区間」と状態を組み立てる
async function build(r: any): Promise<any> {
  const today = jstToday(), t0 = todayStartIso();
  const hasDel = r.visit_type === "DEL" && r.start_date === today;
  const hasCol = r.return_type === "COL" && r.end_date === today;
  if (!hasDel && !hasCol) return { leg: null };
  const sends = await sbGet(`nha_line_sends?resv_no=eq.${enc(r.id)}&sent_at=gte.${enc(t0)}&action=in.(arrival,col_arrival,del_delay,col_delay,depart_mypage,collect_mypage)&select=action,message,sent_at&order=sent_at.asc`);
  const statusToday = !!r.kd_status_at && Date.parse(r.kd_status_at) >= Date.parse(t0);
  // 同じ日にお届けと回収がある場合：お届けが到着済み、または回収に向かうが押されたら回収の区間
  let leg: "del" | "col" = hasDel ? "del" : "col";
  if (hasDel && hasCol) {
    const delArrived = sends.some((x) => x.action === "arrival");
    if (delArrived || (r.kd_status === "collecting" && statusToday)) leg = "col";
  }
  const isDel = leg === "del";
  const departed = statusToday && r.kd_status === (isDel ? "delivering" : "collecting");
  const since = departed ? r.kd_status_at : t0;
  const after = sends.filter((x) => Date.parse(x.sent_at) >= Date.parse(since));
  const arr = after.filter((x) => x.action === (isDel ? "arrival" : "col_arrival")).pop();
  const dly = after.filter((x) => x.action === (isDel ? "del_delay" : "col_delay")).pop();
  let delayTo = "";
  if (dly) { const m = String(dly.message || "").match(/「([^」]+)」頃/); delayTo = m ? m[1].trim() : ""; if (delayTo === "（　）") delayTo = ""; }
  const state = arr ? "arrived" : dly ? "late" : departed ? "onway" : "prep";

  // 予定の時刻・場所（OPシート/タスクサマリーと同じ読み方）
  const eff = (await rpc("nha_res_effective", { p_res: r.id })) || {};
  const time = String((isDel ? (eff.lend_time || r.del_time || r.start_time) : (eff.return_time || r.col_time || r.end_time)) || "");
  const place = String((isDel ? (eff.del_place || r.del_place) : (eff.col_place || r.col_place)) || "");

  // 担当（OPタスク）と車（配車＝nha_fleet → 車両マスタ）
  const task = (await sbGet(`nha_tasks?_id=eq.${enc((isDel ? "d-" : "c-") + r.id)}&deleted=not.is.true&select=${enc("担当")},No&limit=1`))[0] || {};
  const fl = (await sbGet(`nha_fleet?reservation_id=eq.${enc(r.id)}&select=vehicle_code&limit=1`))[0];
  let car: any = {};
  if (fl && fl.vehicle_code) car = (await sbGet(`nha_vehicles?code=eq.${enc(fl.vehicle_code)}&select=plate_no,name,color&limit=1`))[0] || {};
  const plate = String(car.plate_no || task.No || "");
  const carName = String(car.name || "").replace(/[①-⑳]/g, "").trim();

  // スタッフ位置：今回の出発以降に押された1回分だけ使う
  let driver = null;
  if (departed && r.kd_driver_lat != null && r.kd_driver_lng != null && r.kd_driver_at && Date.parse(r.kd_driver_at) >= Date.parse(r.kd_status_at) - 60e3) {
    driver = { lat: Number(r.kd_driver_lat), lng: Number(r.kd_driver_lng), at: r.kd_driver_at };
  }
  return {
    leg, state, time, place,
    staff: String(task["担当"] || "").split(/\s/)[0] || "",
    plate, car: carName, color: String(car.color || ""),
    depart_at: departed ? r.kd_status_at : null,
    arrived_at: arr ? arr.sent_at : null,
    delay_to: delayTo,
    driver,
    mode: isDel ? "car" : (r.kd_driver_mode || "car"),  // 到着見込みの計算用（画面には出さない）
  };
}

async function slack(text: string): Promise<boolean> {
  const token = Deno.env.get("SLACK_BOT_TOKEN"); const ch = Deno.env.get("STAFF_DONE_CHANNEL_NHA") || Deno.env.get("SLACK_NHA_USER_CHANNEL") || "C06L91W6T08";
  if (!token || !ch) { console.log("[slack skip]", text); return false; }
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel: ch, text }) }); const d = await r.json().catch(() => ({})); return !!d.ok; } catch { return false; }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  let p: any = {}; try { p = await req.json(); } catch { /* cron は空でも可 */ }
  const action = String(p.action || "lookup");

  if (action === "watch") {
    const sec = req.headers.get("x-cron-secret") || "";
    if (!sec || sec !== (Deno.env.get("CRON_SECRET") || "")) return json({ error: "unauthorized" }, 401, origin);
    const today = jstToday(), now = Date.now();
    const tasks = await sbGet(`nha_tasks?date=eq.${today}&deleted=not.is.true&${enc("内容")}=in.(DEL,COL)&select=_id,${enc("内容")},${enc("担当")},${enc("予約番号")},${enc("予約者")},${enc("確認")}`);
    const out: string[] = [];
    for (const t of tasks) {
      if (String(t["確認"]) === "true") continue;
      const rid = String(t["予約番号"] || ""); if (!rid) continue;
      const r = (await sbGet(`nha_reservations?id=eq.${enc(rid)}&select=${SEL}`))[0];
      if (!r || isCancelled(r.status)) continue;
      const isDel = t["内容"] === "DEL";
      const eff = (await rpc("nha_res_effective", { p_res: rid })) || {};
      const hm = String((isDel ? (eff.lend_time || r.del_time || r.start_time) : (eff.return_time || r.col_time || r.end_time)) || "");
      const at = hmToMs(today, hm); if (at == null) continue;
      const minsLeft = (at - now) / 60e3;
      // 5分毎の実行で1回ずつ：15分前（10〜15分前の枠）と、時刻ちょうど（0〜5分過ぎの枠）
      const slot = (minsLeft > 10 && minsLeft <= 15) ? "pre" : (minsLeft > -5 && minsLeft <= 0) ? "late" : "";
      if (!slot) continue;
      const t0 = todayStartIso();
      const departed = !!r.kd_status_at && Date.parse(r.kd_status_at) >= Date.parse(t0) && r.kd_status === (isDel ? "delivering" : "collecting");
      if (departed) continue;
      const arrived = (await sbGet(`nha_line_sends?resv_no=eq.${enc(rid)}&sent_at=gte.${enc(t0)}&action=eq.${isDel ? "arrival" : "col_arrival"}&select=id&limit=1`))[0];
      if (arrived) continue;
      const who = String(t["担当"] || "").trim() || "担当未定";
      const kind = isDel ? "お届け" : "回収";
      const btn = isDel ? "出発" : "回収に向かう";
      const msg = slot === "pre"
        ? `⏰ ${hm} ${kind}（${r.name || ""}様）の「${btn}」がまだ押されていません。担当：${who}`
        : `🔴 ${hm} ${kind}（${r.name || ""}様）時刻を過ぎても「${btn}」が押されていません。お客様のマイページは「準備中」のままです。担当：${who}`;
      await slack(msg); out.push(rid + ":" + slot);
    }
    return json({ ok: true, alerted: out }, 200, origin);
  }

  if (action !== "lookup") return json({ error: "unsupported action" }, 400, origin);
  const token = String(p.token || "").trim();
  if (!token || token.length < 20) return json({ error: "bad token" }, 400, origin);
  const r = (await sbGet(`nha_reservations?mypage_token=eq.${enc(token)}&select=${SEL}`))[0];
  if (!r) return json({ error: "not found" }, 404, origin);
  if (isCancelled(r.status)) return json({ ok: true, delivery: null }, 200, origin);
  const d = await build(r);
  return json({ ok: true, delivery: d.leg ? d : null, now: new Date().toISOString() }, 200, origin);
});
