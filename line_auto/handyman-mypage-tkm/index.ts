// ============================================================
// handyman-mypage-tkm : HANDYMAN 統合マイページ 高松（じゃらん=HDMブランド・閲覧専用 lookup）
// 2026-08-08 / omni  ※那覇 handyman-mypage-nha を複製元に、BT DB(bt_reservations/bt_tasks)へ作り替え。
//   関係性: BUDDICA高松APPが物理・DBを持つ / じゃらん予約は「HANDYMAN 高松空港店」ブランド(HDM)で同一在庫を共有
//           = HDM↔KEYDROP と同じ構造。じゃらん(HDM)客にはHANDYMANブランドのマイページを"メール"で案内。
//   方針(オーナー確定 2026-08-08): 那覇マイページと同じ・閲覧専用・デリバリー無し(送迎/来店のみ)・メール(LINE無し)。
//   このEFは ping / lookup / license_uploaded のみ(読み取り＋免許アップ通知)。書込系(変更/承認)は作らない。
//   deploy: BTプロジェクト(ggqugvyskyiblxiycpci)へ  supabase functions deploy handyman-mypage-tkm --no-verify-jwt
//   BTの箱:
//     bt_reservations : id,ota,name,start_date,start_time,end_date,end_time,vehicle_class,vehicle_name,
//                       insurance,people,price,status,visit_type,return_type,del_time,del_place,col_time,col_place,
//                       del_flight,opt_b,opt_c,opt_j,opt_usb,mypage_token
//     bt_tasks(日本語列): _id(d-/c-/w-),内容,時間,予約者,担当,予約番号,送迎場所(place),集客(colPlace),
//                       返却(returnTime),送迎(returnType),クラス,確定(insurance),便名,変更(timeChange),changed_json(text)
// ============================================================

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" };

// マイページのホスト（HANDYMANブランド・高松版）。Apple Notes等 Origin:null も許可(認証はtokenのみ・Cookie不使用)。
function cors(o: string | null) {
  const allow = o || "*";
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Vary": "Origin" };
}
function json(b: unknown, s: number, o: string | null) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors(o), "content-type": "application/json" } }); }

async function sbGet(t: string, q: string): Promise<any[]> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { headers: H }); if (!r.ok) { console.error(`GET ${t}`, await r.text()); return []; } return await r.json(); }
async function sbPost(t: string, b: unknown): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(b) }); if (!r.ok) console.error(`POST ${t}`, await r.text()); }
// Slack通知（高松＝BUDDICAワークスペース #operation-高松空港店。SLACK_BOT_TOKEN=BUDDICA bot・未設定なら黙ってskip）
async function slackPost(text: string, blocks?: unknown): Promise<boolean> {
  const token = Deno.env.get("SLACK_BOT_TOKEN"); const ch = Deno.env.get("SLACK_TKM_CHANNEL") || "C0BFMBLEJGZ";
  if (!token || !ch) return false;
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: ch, text, blocks }) }); const j = await r.json(); return !!j.ok; } catch { return false; }
}

// 予約もと（OTA）ラベル
const OTA_JP: Record<string, string> = { "じゃらん": "じゃらん", "楽天": "楽天", "エアトリ": "エアトリ", "レンタカードットコム": "レンタカーcom", J: "じゃらん", R: "楽天", O: "エアトリ", RC: "レンタカーcom", HP: "オフィシャル(HP)", site: "オフィシャル(HP)", direct: "直販" };
function otaJp(o?: string): string { const k = String(o || ""); return OTA_JP[k] || k || "—"; }

function nowJst(): string { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace("Z", "+09:00"); }

// changed_json は text型 → JSON.parse 必須。
function parseCj(t: any): any {
  let cj = t && t.changed_json;
  if (typeof cj === "string") { try { cj = JSON.parse(cj); } catch { cj = {}; } }
  return cj || {};
}
function resolveTaskPlace(t: any): string {
  if (!t) return "";
  const cj = parseCj(t);
  const place = String(t.place || "");
  if (cj._placeSource === "manual") return place;
  return String(cj._ssPlace || place || "");
}
function resolveTaskTime(t: any): string {
  if (!t) return "";
  const cj = parseCj(t);
  return String(t.timeChange || cj._timeChange || cj._ssTime || t.time || "");
}
function taskOptNum(t: any, key: string): number {
  if (!t) return 0;
  const cj = parseCj(t);
  return Number(cj[key]) || 0;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  let p: any; try { p = await req.json(); } catch { return json({ error: "bad json" }, 400, origin); }

  const action = String(p.action || "lookup").trim();

  // ==== keep-warm ping（DB不使用・即応答）====
  if (action === "ping") return json({ ok: true, warm: true, store: "tkm" }, 200, origin);

  if (action !== "lookup" && action !== "license_uploaded") return json({ error: "unsupported action" }, 400, origin);

  const token = String(p.token || "").trim();
  if (!token || token.length < 20) return json({ error: "アクセスキーが不正です" }, 400, origin);

  // token で予約特定（高松 bt_reservations）
  const SEL = "id,ota,name,start_date,start_time,end_date,end_time,vehicle_class,vehicle_name,insurance,people,price,status,visit_type,return_type,del_time,del_place,col_time,col_place,del_flight,opt_b,opt_c,opt_j,opt_usb,mypage_token";
  const rows = await sbGet("bt_reservations", `mypage_token=eq.${encodeURIComponent(token)}&select=${SEL}`);
  const r = rows[0];
  if (!r) return json({ error: "予約が見つかりません" }, 404, origin);
  const resId = String(r.id);

  // ---- license_uploaded: お客様がマイページから免許証をアップした完了通知（Slack・高松） ----
  if (action === "license_uploaded") {
    const cnt = Math.max(1, Math.min(20, parseInt(String(p.count || 1), 10) || 1));
    const drivers = Math.max(1, Math.min(10, parseInt(String(p.drivers || 1), 10) || 1));
    const blocks = [
      { type: "header", text: { type: "plain_text", text: "🪪 免許証アップロード（お客様）", emoji: true } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"}` },
        { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
        { type: "mrkdwn", text: `*ご予約元:*\n${otaJp(r.ota)}` },
        { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
        { type: "mrkdwn", text: `*車両クラス:*\n${r.vehicle_class || r.vehicle_name || "-"}` },
        { type: "mrkdwn", text: `*アップ枚数:*\n${cnt}枚（運転者${drivers}名）` },
      ] },
      { type: "context", elements: [ { type: "mrkdwn", text: "Googleドライブ（高松フォルダ）に保存済み。貸渡手続きにご利用ください。" } ] },
    ];
    try { await fetch(`${SB_URL}/rest/v1/license_uploads?on_conflict=reservation_id`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ reservation_id: resId, store: "tkm", cnt, drivers, last_at: new Date().toISOString() }) }); } catch (_) { /* noop */ }
    await slackPost(`🪪 免許証アップロード完了 [高松] ${r.name || ""} / ${resId} / ${cnt}枚`, blocks);
    return json({ ok: true }, 200, origin);
  }

  // OPタスク（予約番号一致・墓標除外）＋免許アップ状態
  const opTasksP = sbGet("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&deleted=not.is.true&select=_id,${encodeURIComponent("内容")},${encodeURIComponent("時間")},${encodeURIComponent("送迎場所")},${encodeURIComponent("集客")},${encodeURIComponent("返却")},${encodeURIComponent("送迎")},${encodeURIComponent("確定")},${encodeURIComponent("便名")},${encodeURIComponent("変更")},changed_json`);
  const licP = sbGet("license_uploads", `reservation_id=eq.${encodeURIComponent(resId)}&select=cnt,drivers`);
  const [opTasksRaw, licRows] = await Promise.all([opTasksP, licP]);
  const licCnt = (licRows[0] && licRows[0].cnt) || 0;
  const licDrivers = (licRows[0] && licRows[0].drivers) || 0;

  // 日本語列を正規化して resolve* を再利用
  const opTasks = (opTasksRaw || []).map((t: any) => ({
    _id: t._id,
    place: t["送迎場所"],
    time: t["時間"],
    colPlace: t["集客"],
    returnTime: t["返却"],
    timeChange: t["変更"],
    insurance: t["確定"],
    changed_json: t.changed_json,
  }));
  const dTask = opTasks.find((t: any) => String(t._id || "").startsWith("d-"));
  const cTask = opTasks.find((t: any) => String(t._id || "").startsWith("c-"));

  const cColResolve = (() => {
    if (!cTask) return "";
    const cj = parseCj(cTask);
    if (cj._placeSource === "manual") return String(cTask.colPlace || cTask.place || "");
    return String(cj._ssPlace || cTask.colPlace || cTask.place || "");
  })();
  const cTimeResolve = (() => {
    if (!cTask) return "";
    const cj = parseCj(cTask);
    return String(cTask.timeChange || cj._timeChange || cj._ssTime || cTask.returnTime || cTask.time || "");
  })();

  const delPlaceR = resolveTaskPlace(dTask) || String(r.del_place || "").trim();
  const colPlaceR = cColResolve || String(r.col_place || "").trim();
  const lendTimeR = resolveTaskTime(dTask) || r.start_time || r.del_time || "";
  const returnTimeR = cTimeResolve || r.end_time || r.col_time || "";

  const optBR = Math.max(Number(r.opt_b) || 0, taskOptNum(dTask, "_optB"), taskOptNum(cTask, "_optB"));
  const optCR = Math.max(Number(r.opt_c) || 0, taskOptNum(dTask, "_optC"), taskOptNum(cTask, "_optC"));
  const optJR = Math.max(Number(r.opt_j) || 0, taskOptNum(dTask, "_optJ"), taskOptNum(cTask, "_optJ"));
  const optUSBR = Math.max(Number(r.opt_usb) || 0);
  const insR = String(r.insurance || "").trim() || String(dTask?.insurance || cTask?.insurance || "").trim();

  const st = String(r.status || "");
  const cancelled = st === "cancelled" || st === "キャンセル" || st === "cancel";

  // 車両状態チェック（傷）：出発日 8:00 以降のみ解禁。URLは bt_fleet→bt_vehicles.plate_no→vehicle_twins(BT)→share_token。
  // ★顧客に見せるURLはBUDDICAドメイン(handymanドメイン/文字列を顧客に出さない=BTブランド規約)。
  const jstIso = new Date(Date.now() + 9 * 3600 * 1000).toISOString();
  const today = jstIso.slice(0, 10);
  const hh = +jstIso.slice(11, 13);
  const damageReady = !cancelled && !!r.start_date && (r.start_date < today || (r.start_date === today && hh >= 8));
  let damageUrl: string | null = null;
  if (damageReady) {
    try {
      const fl = await sbGet("bt_fleet", `reservation_id=eq.${encodeURIComponent(resId)}&select=vehicle_code`);
      const code = fl[0]?.vehicle_code;
      if (code) {
        const vs = await sbGet("bt_vehicles", `code=eq.${encodeURIComponent(code)}&select=plate_no`);
        const plate = vs[0]?.plate_no;
        if (plate) {
          const tw = await sbGet("vehicle_twins", `display_label=ilike.*${encodeURIComponent(plate)}*&share_enabled=eq.true&select=share_token&limit=1`);
          if (tw[0]?.share_token) damageUrl = `https://buddica-touring.github.io/damage/v.html?t=${tw[0].share_token}&v=v3`;
        }
      }
    } catch (_) { /* best-effort */ }
  }

  // 履歴：OPタスク由来（フォーム回答/担当編集の場所・時間）
  const history: any[] = [];
  const pushTaskHist = (task: any, placeVal: string, placeField: string, timeField: string) => {
    if (!task) return;
    const cj = parseCj(task);
    const src = cj._placeSource === "manual" ? "staff" : (cj._placeSource === "customer" ? "customer_mypage" : "customer_form");
    const pv = cj._placeSource === "manual" ? (placeVal || "") : (cj._ssPlace || placeVal || "");
    const pat = cj._manualPlaceAt || cj._ssPlaceAt || "";
    if (pv && pat) history.push({ field: placeField, value: pv, at: pat, source: src, status: "applied" });
    const tv = cj._ssTime || task.time || "";
    const tat = cj._manualTimeAt || cj._ssTimeAt || "";
    if (tv && tat) history.push({ field: timeField, value: tv, at: tat, source: src, status: "applied" });
  };
  pushTaskHist(dTask, dTask?.place, "del_place", "lend_time");
  pushTaskHist(cTask, (cTask?.colPlace || cTask?.place), "col_place", "return_time");
  history.sort((a: any, b: any) => String(b.at || "").localeCompare(String(a.at || "")));
  const historyTop = history.slice(0, 10);

  // 那覇 my-nha.html と同一の応答形（flat reservation）＝同一レンダラで表示統一。
  return json({
    ok: true, store: "tkm", label: "高松",
    reservation: {
      id: r.id, vehicle: r.vehicle_class, ota: r.ota,
      lend_date: r.start_date, return_date: r.end_date, lend_time: lendTimeR, return_time: returnTimeR,
      name: r.name, people: r.people, status: r.status, insurance: insR,
      del_place: delPlaceR, col_place: colPlaceR,
      opt_b: optBR, opt_c: optCR, opt_j: optJR, opt_usb: optUSBR,
      del_flight: r.del_flight || "",
      visit_type: r.visit_type || "", return_type: r.return_type || "",
    },
    damage: { ready: damageReady, url: damageUrl },
    tracking: { active: false, kd_status: null, token: null },
    license: { cnt: licCnt, drivers: licDrivers },
    pendingCancel: false, readyPending: false,
    recentChanges: [], history: historyTop,
    at: nowJst(),
  }, 200, origin);
});
