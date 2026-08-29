// ================================================================
// daily-report Edge Function（3店 日報 自動投稿）
// 毎朝9:00 JST(pg_cron 0 0 * * * UTC) に前日フル(0:00〜23:59)の実績を
// APPの「日報→テキストコピー(buildDailyText)」6セクションと同じ計算で生成し、
// Slack #日報_handyman(C0BSXE4TKLG) に 那覇/札幌/高松 を各店別に投稿する。
//
// ★値をAPPと完全一致させるため index.src.html の buildDailyText / repSum を移植。
//   出力は6セクションのみ（累計 / 本日の流通 / チャネル別×2 / KEYDROP / リードタイム）。
//   月別推移 / CVチャネル構成比 / 車両ランキング はオーナー指定で除外。
//
// 認証: x-cron-secret == CRON_SECRET
// dry: body {dry:true} or ?dry=1 → 投稿せずテキストを返す。?store=nha で1店だけ。
// ================================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SLACK_CHANNEL = "C0BSXE4TKLG"; // #日報_handyman (HANDYMAN GL workspace)

const MAIN_URL = Deno.env.get("SUPABASE_URL")!;
const MAIN_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BT_URL = Deno.env.get("BT_URL") || "";
const BT_KEY = Deno.env.get("BT_SERVICE_KEY") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SLACK_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";

type Store = {
  key: string; name: string; emoji: string;
  resT: string; fleetT: string; vehT: string; acctT: string; maintT: string; kpiT: string;
  otaA2O: boolean; useMain: boolean;
};
const STORES: Store[] = [
  { key: "nha", name: "那覇", emoji: "🌺", resT: "nha_reservations", fleetT: "nha_fleet", vehT: "nha_vehicles", acctT: "nha_accounting", maintT: "nha_maintenance", kpiT: "nha_vehicle_monthly_kpi", otaA2O: false, useMain: true },
  { key: "spk", name: "札幌", emoji: "❄️", resT: "reservations",     fleetT: "fleet",     vehT: "vehicles",     acctT: "spk_accounting", maintT: "maintenance",     kpiT: "vehicle_monthly_kpi",     otaA2O: true,  useMain: true },
  { key: "bt",  name: "高松", emoji: "🍜", resT: "bt_reservations",  fleetT: "bt_fleet",  vehT: "bt_vehicles",  acctT: "bt_accounting",  maintT: "bt_maintenance",  kpiT: "bt_vehicle_monthly_kpi",  otaA2O: false, useMain: false },
];

// 稼働率＝【配車表(FleetTimeline)上段が表示している値】と同一のシンプル式（複雑な計算はしない）。
// 分子=配車で埋まった日数(月内・重複排除) / 分母=稼働台数×その月の日数。active車のみ。※配車表 totalUtil と完全一致。
const toLD = (ms: number): string => { const d = new Date(ms); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); };
function computeUtil(ym: string, data: any[], vehicles: any[], fleet: Record<string, string>, kpiRows: any[]): number | null {
  const [y, mo] = ym.split("-").map(Number);
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const msE = Date.UTC(y, mo - 1, 1), meE = Date.UTC(y, mo - 1, dim);
  // 稼働/除外フラグ（配車表と同じ：月次KPIの上書き→無ければ v.active!==false）
  const kpiFlags: Record<string, boolean> = {};
  (kpiRows || []).forEach(k => { if (k.year_month === ym) kpiFlags[k.vehicle_code] = (k.active !== false); });
  const isActive = (code: string) => kpiFlags[code] !== undefined ? kpiFlags[code] : ((vehicles.find(v => v.code === code)?.active) !== false);
  let totalDays = 0, activeCount = 0;
  vehicles.forEach(v => {
    if (!isActive(v.code)) return;
    activeCount++;
    const rentalDays = new Set<string>();
    data.forEach(r => {
      if (fleet[r.id] !== v.code) return;
      if (!r.lendDate || !r.returnDate) return;
      const ld = Date.parse(r.lendDate + "T00:00:00Z"), rd = Date.parse(r.returnDate + "T00:00:00Z"); if (isNaN(ld) || isNaN(rd)) return;
      const s = Math.max(ld, msE), e = Math.min(rd, meE);
      for (let d = s; d <= e; d += 86400000) rentalDays.add(toLD(d));
    });
    totalDays += rentalDays.size;
  });
  const maxDays = activeCount * dim;
  return maxDays > 0 ? Math.round(totalDays / maxDays * 100) : null;
}

// ---- helpers（APP index.src.html と同一ロジック）----
const norm = (d: any): string => { if (!d) return ""; const s = String(d).replace(/\//g, "-"); return s.length <= 10 ? s : s.substring(0, 10); };
const isCancel = (s: any): boolean => { const t = String(s || "").toLowerCase(); return t === "cancelled" || t.includes("キャンセル") || t === "cancel"; };
const revOf = (r: any): number => { const bp = Number(r.basePrice) || 0, op = Number(r.optionPrice) || 0, dc = Number(r.discount) || 0; return (bp > 0 || op > 0) ? (bp + op - dc) : (Number(r.price) || 0); };
// 自社HP=HP/SP/KEYDROP/direct/空 / OTA=J,R,S,O,RC,G / 他=その他
const CHof = (r: any): string => { const o = String(r.ota || "").trim(); return (o === "" || o === "HP" || o === "SP" || o === "KEYDROP" || o === "direct") ? "HP" : (["J", "R", "S", "O", "RC", "G"].indexOf(o) >= 0 ? "OTA" : "その他"); };
const labelOf = (r: any): string => { const o = String(r.ota || "").trim(); return (o === "" || o === "HP" || o === "SP" || o === "KEYDROP" || o === "direct") ? "HP" : (["J", "R", "S", "O", "RC", "G"].indexOf(o) >= 0 ? o : "その他"); };
const hpSub = (r: any): string => { const o = String(r.ota || "").trim(); return (o === "KEYDROP") ? "KEYDROP" : (o === "SP") ? "SP" : (o === "direct") ? "direct" : "公式HP"; };
const createdJst = (r: any): string => { const raw = r.createdAt || r.bookedAt || ""; if (!raw) return ""; const d = new Date(String(raw).replace(" ", "T")); if (isNaN(d.getTime())) return String(raw).slice(0, 10); const j = new Date(d.getTime() + 9 * 3600 * 1000); return j.getUTCFullYear() + "-" + String(j.getUTCMonth() + 1).padStart(2, "0") + "-" + String(j.getUTCDate()).padStart(2, "0"); };

async function sbFetchAll(base: string, key: string, table: string, query: string): Promise<any[]> {
  const out: any[] = [];
  let from = 0; const step = 1000;
  for (let i = 0; i < 50; i++) {
    const url = `${base}/rest/v1/${table}?${query}`;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + step - 1}` } });
    if (!res.ok) { const t = await res.text(); throw new Error(`${table} ${res.status} ${t.slice(0, 200)}`); }
    const rows = await res.json();
    out.push(...rows);
    if (!rows.length || rows.length < step) break;
    from += step;
  }
  return out;
}

function mapRes(d: any, store: Store) {
  const st = d.status;
  const normSt = (st === "キャンセル" || st === "cancel") ? "cancelled" : (st === "確定" || !st) ? "confirmed" : st;
  let ota = d.ota; if (store.otaA2O && ota === "A") ota = "O";
  const lend = norm(store.key === "spk" ? d.lend_date : d.start_date);
  const ret = norm(store.key === "spk" ? d.return_date : d.end_date);
  return {
    id: d.id, ota, name: d.name, lendDate: lend, returnDate: ret,
    price: Number(d.price) || 0, basePrice: Number(d.base_price) || 0, optionPrice: Number(d.option_price) || 0, discount: Number(d.discount) || 0,
    status: normSt, createdAt: d.created_at || "",
    bookedAt: store.key === "bt" ? (norm(d.booked_at || d.created_at) || "") : "",
  };
}

// repSum の6セクション用サブセットを計算（buildDailyText 準拠）
function buildReport(store: Store, data: any[], vehicles: any[], fleet: Record<string, string>, extraSales: { byM: Record<string, number>, byY: Record<string, number>, total: number }, reportDate: string, util: Record<string, number>): string {
  const units = (vehicles || []).filter(v => v && v.code).map(v => ({ code: v.code, type: v.type, name: v.name || "", no: v.no || v.plate_no || "" }));
  const codes = new Set(units.map(u => u.code));
  const fl = fleet || {};
  const curYM = reportDate.slice(0, 7);
  const curDay = reportDate;

  const byM: any = {}, byY: any = {}, byCh: any = {}, curCh: any = {}, curOta: any = {}, curHp: any = {}, kdByM: any = {};
  let total = 0;
  const dNew = { count: 0, sales: 0 }; const newBrk: any = {};
  const curFlowCh: any = {}, curFlowOta: any = {}, curFlowHp: any = {}; let curFlowTotal = 0;
  const leadByM: any = {};

  (data || []).forEach(r => {
    if (isCancel(r.status)) return;
    // リードタイム（発生月×HP/OTA・利用開始−発生。2026-03-29一括取込除外・2026-02以降・0〜400日）
    {
      const _bk = r.bookedAt || (r.createdAt && String(r.createdAt).slice(0, 10) !== "2026-03-29" ? r.createdAt : null);
      const _ld = norm(r.lendDate);
      if (_bk && _ld) { const _om = String(_bk).slice(0, 7); if (_om >= "2026-02") { const _lt = Math.round((new Date(_ld.slice(0, 10)).getTime() - new Date(String(_bk).slice(0, 10)).getTime()) / 86400000); if (_lt >= 0 && _lt <= 400) { const _c = CHof(r); if (_c === "HP" || _c === "OTA") { if (!leadByM[_om]) leadByM[_om] = { hp: [], ota: [] }; leadByM[_om][_c === "HP" ? "hp" : "ota"].push(_lt); } } } }
    }
    const _cj = createdJst(r);
    // KEYDROP 月別（利用月・DEMO/TEST/ZZ・テスト/デモ除外）
    if (r.ota === "KEYDROP") { const _kid = String(r.id || ""), _knm = String(r.name || ""); if (!/DEMO|TEST|^ZZ/i.test(_kid) && !/テスト|デモ/.test(_knm)) { const _klm = (norm(r.lendDate) || "").slice(0, 7); if (_klm) { if (!kdByM[_klm]) kdByM[_klm] = { count: 0, sales: 0 }; kdByM[_klm].count++; kdByM[_klm].sales += revOf(r); } } }
    // 本日の流通（取込日＝reportDate）
    if (_cj === curDay) { const _lb = labelOf(r), _rv = revOf(r); dNew.count++; dNew.sales += _rv; if (!newBrk[_lb]) newBrk[_lb] = { count: 0, sales: 0 }; newBrk[_lb].count++; newBrk[_lb].sales += _rv; }
    // 当月流通（取込月＝curYM）
    if (_cj.slice(0, 7) === curYM) { const _lb2 = labelOf(r), _ch2 = CHof(r), _rv2 = revOf(r); if (!curFlowCh[_ch2]) curFlowCh[_ch2] = { count: 0, sales: 0 }; curFlowCh[_ch2].count++; curFlowCh[_ch2].sales += _rv2; curFlowTotal += _rv2; if (_ch2 === "OTA") { if (!curFlowOta[_lb2]) curFlowOta[_lb2] = { count: 0, sales: 0 }; curFlowOta[_lb2].count++; curFlowOta[_lb2].sales += _rv2; } else if (_ch2 === "HP") { const _hs = hpSub(r); if (!curFlowHp[_hs]) curFlowHp[_hs] = { count: 0, sales: 0 }; curFlowHp[_hs].count++; curFlowHp[_hs].sales += _rv2; } }
    // 返却月ベース（配車済のみ）
    const code = fl[r.id]; if (!code || !codes.has(code)) return;
    const rd = norm(r.returnDate) || norm(r.lendDate); if (!rd) return;
    const rev = revOf(r), ym = rd.slice(0, 7), y = rd.slice(0, 4), ch = CHof(r);
    if (!byM[ym]) byM[ym] = { count: 0, sales: 0 }; byM[ym].count++; byM[ym].sales += rev;
    if (!byY[y]) byY[y] = { count: 0, sales: 0 }; byY[y].count++; byY[y].sales += rev;
    if (!byCh[ch]) byCh[ch] = { count: 0, sales: 0 }; byCh[ch].count++; byCh[ch].sales += rev; total += rev;
    if (ym === curYM) { if (!curCh[ch]) curCh[ch] = { count: 0, sales: 0 }; curCh[ch].count++; curCh[ch].sales += rev; if (ch === "OTA") { const on = String(r.ota || "").trim() || "OTA"; if (!curOta[on]) curOta[on] = { count: 0, sales: 0 }; curOta[on].count++; curOta[on].sales += rev; } else if (ch === "HP") { const _hs = hpSub(r); if (!curHp[_hs]) curHp[_hs] = { count: 0, sales: 0 }; curHp[_hs].count++; curHp[_hs].sales += rev; } }
  });
  // 予約外売上（extra_sales）を返却月ベース sales に合算
  Object.entries(extraSales.byM || {}).forEach(([ym, a]) => { if (!byM[ym]) byM[ym] = { count: 0, sales: 0 }; byM[ym].sales += a as number; });
  Object.entries(extraSales.byY || {}).forEach(([y, a]) => { if (!byY[y]) byY[y] = { count: 0, sales: 0 }; byY[y].sales += a as number; });

  // ---- テキスト生成（6セクション）----
  const dObj = new Date(reportDate + "T00:00:00");
  const wd = ["日", "月", "火", "水", "木", "金", "土"][isNaN(dObj.getTime()) ? 0 : dObj.getDay()];
  const yen = (n: number) => "¥" + Number(n || 0).toLocaleString("en-US");
  const fmtD = (n: number, y: boolean) => (n > 0 ? "+" : (n < 0 ? "−" : "±")) + (y ? yen(Math.abs(n)) : (Math.abs(n) + "件"));
  const _u = (o: any) => (o && o.count ? Math.round(o.sales / o.count) : 0);
  const L: string[] = [];
  L.push("━━━━━━━━━━━━━━━");
  L.push(store.emoji + " *" + store.name + "店*　日報");
  L.push("🗓 " + reportDate + "（" + wd + "）");
  L.push("━━━━━━━━━━━━━━━"); L.push("");

  const curYr = curYM.slice(0, 4);
  const yrD = byY[curYr] || { count: 0, sales: 0 };
  const curM = byM[curYM] || { count: 0, sales: 0 };
  const hp = curCh["HP"] || { count: 0, sales: 0 };
  const ota = curCh["OTA"] || { count: 0, sales: 0 };
  const oth = curCh["その他"] || { count: 0, sales: 0 };
  const yogai = Math.max(0, (curM.sales || 0) - hp.sales - ota.sales - oth.sales);
  const mm = curYM.slice(5) + "月";

  // ■ 件数・売上 累計
  L.push("■ 件数・売上 累計（返却月ベース・実績）");
  L.push("・" + curYr + "累計（返却月）：" + yrD.count + "件 / " + yen(yrD.sales));
  L.push("・当月累計（" + mm + "・返却月）：" + curM.count + "件 / " + yen(curM.sales));
  if (yogai > 0) L.push("　└ うち予約外売上（会計）：" + yen(yogai));
  // 当月＋翌月＋翌々月 の売上（返却月ベース・売上のみ）
  {
    const addMonth = (ym: string, n: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0"); };
    const ym1 = addMonth(curYM, 1), ym2 = addMonth(curYM, 2), ym3 = addMonth(curYM, 3);
    const m1 = byM[ym1] || { count: 0, sales: 0 }, m2 = byM[ym2] || { count: 0, sales: 0 }, m3 = byM[ym3] || { count: 0, sales: 0 };
    const uStr = (ym: string) => { const p = util[ym]; return (p === undefined || p === null) ? "" : "　｜ 稼働 *" + p + "%*"; };
    L.push("📊 *売上見通し（返却月）*");
    L.push("> 💰 *当月（" + mm + "）*　　*" + yen(curM.sales) + "*" + uStr(curYM));
    L.push("> 📈 *翌月（" + ym1.slice(5) + "月）*　" + m1.count + "件 / *" + yen(m1.sales) + "*" + uStr(ym1));
    L.push("> 📈 *翌々月（" + ym2.slice(5) + "月）*　" + m2.count + "件 / *" + yen(m2.sales) + "*" + uStr(ym2));
    L.push("> 📈 *翌々々月（" + ym3.slice(5) + "月）*　" + m3.count + "件 / *" + yen(m3.sales) + "*" + uStr(ym3));
    L.push("　※翌月以降は先行予約分（着地は変動）" + (Object.keys(util).length ? "／稼働率＝配車表と同じ値" : ""));
  }
  L.push("");

  // ■ 本日の流通
  L.push("■ 本日の流通（新規取込・取込日ベース）");
  L.push("・新規増（流通）：" + fmtD(dNew.count, false) + " / " + fmtD(dNew.sales, true));
  const _nbKeys = Object.keys(newBrk).sort((a, b) => (a === "HP" ? -1 : b === "HP" ? 1 : a === "その他" ? 1 : b === "その他" ? -1 : (newBrk[b].sales - newBrk[a].sales)));
  _nbKeys.forEach(k => { L.push("　└ " + k + "：" + fmtD(newBrk[k].count, false) + " / " + fmtD(newBrk[k].sales, true)); });
  L.push("");

  // ■ KEYDROP 月別（データがある店のみ表示。高松はKEYDROPなし→非表示）
  const _kdKeys = Object.keys(kdByM).sort();
  if (_kdKeys.length) {
    L.push("■ KEYDROP 月別（利用月ベース・グロス）");
    let _kdTc = 0, _kdTs = 0;
    _kdKeys.forEach(m => { L.push("・" + m.slice(5) + "月：" + kdByM[m].count + "本 / " + yen(kdByM[m].sales)); _kdTc += kdByM[m].count; _kdTs += kdByM[m].sales; });
    L.push("　└ グロス合計：" + _kdTc + "本 / " + yen(_kdTs));
  }
  return L.join("\n").replace(/\n+$/, "");
}

async function loadStore(store: Store, cutoffMs: number, reportDate: string): Promise<string> {
  const base = store.useMain ? MAIN_URL : BT_URL;
  const key = store.useMain ? MAIN_KEY : BT_KEY;
  if (!base || !key) throw new Error(store.key + ": url/key未設定");
  const [resRaw, fleetRaw, vehRaw, acctRaw] = await Promise.all([
    sbFetchAll(base, key, store.resT, "select=*"),
    sbFetchAll(base, key, store.fleetT, "select=reservation_id,vehicle_code"),
    sbFetchAll(base, key, store.vehT, "select=code,type,name,plate_no,active"),
    sbFetchAll(base, key, store.acctT, "select=date,amount,type&type=eq.extra_sales"),
  ]);
  // reservations → 共通shape ＋ cutoff（createdAtが前日23:59以降の取込を除外＝スナップショット）
  const data = resRaw.map(d => mapRes(d, store)).filter(r => {
    if (!r.createdAt) return true;
    const t = new Date(String(r.createdAt).replace(" ", "T")).getTime();
    if (isNaN(t)) return true;
    return t <= cutoffMs;
  });
  const fleet: Record<string, string> = {};
  fleetRaw.forEach(r => { if (r.reservation_id) fleet[r.reservation_id] = r.vehicle_code; });
  const vehicles = vehRaw.map(v => ({ code: v.code, type: v.type, name: v.name || "", no: v.plate_no || "", active: v.active !== false }));
  // extra_sales 集計（cutoffは返却月ベースの実績なので日付では絞らない＝APP同様に月/年合算）
  const byM: Record<string, number> = {}, byY: Record<string, number> = {}; let total = 0;
  acctRaw.forEach(r => { const d = String(r.date || "").slice(0, 10); if (!d) return; const a = Number(r.amount) || 0; byM[d.slice(0, 7)] = (byM[d.slice(0, 7)] || 0) + a; byY[d.slice(0, 4)] = (byY[d.slice(0, 4)] || 0) + a; total += a; });
  // 稼働率＝配車表(FleetTimeline)上段の値を各月(当月+翌月+翌々月)で算出（3店とも live・BTも可）
  const util: Record<string, number> = {};
  try {
    const cur = reportDate.slice(0, 7);
    const addM = (ym: string, n: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0"); };
    const yms = [cur, addM(cur, 1), addM(cur, 2), addM(cur, 3)];
    const kpiRows = await sbFetchAll(base, key, store.kpiT, `select=vehicle_code,year_month,active&year_month=in.(${yms.join(",")})`).catch(() => []);
    yms.forEach(ym => { const p = computeUtil(ym, data, vehicles, fleet, kpiRows); if (p !== null) util[ym] = p; });
  } catch (_) { /* 稼働率が取れなくても本体は出す */ }
  return buildReport(store, data, vehicles, fleet, { byM, byY, total }, reportDate, util);
}

async function slackPost(text: string): Promise<any> {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${SLACK_TOKEN}` },
    body: JSON.stringify({ channel: SLACK_CHANNEL, text, unfurl_links: false, unfurl_media: false }),
  });
  return await res.json();
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    let body: any = {};
    try { body = await req.json(); } catch (_) { /* GET/empty */ }
    const dry = url.searchParams.get("dry") === "1" || body.dry === true;
    const onlyStore = url.searchParams.get("store") || body.store || "";
    const secret = req.headers.get("x-cron-secret") || body.secret || "";

    if (!dry && CRON_SECRET && secret !== CRON_SECRET) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    // 前日フル（JST）: reportDate=昨日, cutoff=昨日23:59:59.999 JST(=昨日14:59:59.999 UTC)
    const nowJst = new Date(Date.now() + 9 * 3600 * 1000);
    const yUtc = new Date(Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate()) - 24 * 3600 * 1000);
    const ry = yUtc.getUTCFullYear(), rm = yUtc.getUTCMonth(), rd = yUtc.getUTCDate();
    // 上書き指定（検証用）: ?date=YYYY-MM-DD
    const dateOverride = url.searchParams.get("date") || body.date || "";
    let reportDate: string, cutoffMs: number;
    if (dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) {
      const [oy, om, od] = dateOverride.split("-").map(Number);
      reportDate = dateOverride;
      cutoffMs = Date.UTC(oy, om - 1, od, 14, 59, 59, 999);
    } else {
      reportDate = `${ry}-${String(rm + 1).padStart(2, "0")}-${String(rd).padStart(2, "0")}`;
      cutoffMs = Date.UTC(ry, rm, rd, 14, 59, 59, 999);
    }

    const results: any = {};
    const targets = STORES.filter(s => !onlyStore || s.key === onlyStore);
    for (const store of targets) {
      try {
        const text = await loadStore(store, cutoffMs, reportDate);
        if (dry) { results[store.key] = text; }
        else { const sr = await slackPost(text); results[store.key] = { ok: !!sr.ok, ts: sr.ts, error: sr.error }; }
      } catch (e) {
        results[store.key] = { ok: false, error: String(e && (e as any).message || e) };
      }
    }
    return new Response(JSON.stringify({ ok: true, reportDate, dry, results }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e && (e as any).message || e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
