// 2026-10-23 新API鍵移行：新形式の鍵を優先し、無ければ旧鍵（移行期間の保険・旧鍵の無効化前に外す）
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
console.log("[keymig]", __newKey("SUPABASE_SECRET_KEYS", "edge") ? "secret" : "legacy");
// ============================================================
// mypage-notify : マイページURLを最適タイミングで自動送信（cron）
// 2026-07-05 / omni  ※札幌(spk)先行。テンプレ＋マイページURLを line-push で送る。
//  タイミング: ①初動(LINE ID取得後) ②出発3日前・2日前(足りない物がある人だけ) ③前日(一覧か短い1通) ④返却3時間前  ※2026-11-09 全店統一 3/2/1
//  安全: spk_line_config.mypage_notify_enabled=true の時のみ本番送信。test_mode時は test_user_id のみ。
//  重複防止: {store}_line_sends に (resv_no, action, status='sent') があれば再送しない。
//  認証: x-cron-secret = CRON_SECRET（cron）。
// ============================================================
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" };
const URLBASE = "https://nosh2318.github.io/spk-task/my.html?t=";

async function sbGet(t: string, q: string): Promise<any[]> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { headers: H }); if (!r.ok) { console.error(`GET ${t}`, await r.text()); return []; } return await r.json(); }
function jstNow(): Date { return new Date(Date.now() + 9 * 3600 * 1000); }
function dstr(off: number): string { const d = jstNow(); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); }
// OP/マイページと同じ時刻解決（c-/d-タスクの _timeChange最優先→_ssTime→time）。予約生値(return_time/col_time)を直読みしない。
function resolveTaskTime(t: any): string {
  if (!t) return "";
  let cj = t.changed_json; if (typeof cj === "string") { try { cj = JSON.parse(cj); } catch { cj = {}; } } cj = cj || {};
  return String(cj._timeChange || cj._ssTime || t.time || "");
}

// ===== 出発前の「足りない物」（2026-11-09 nosh「全店統一 3/2/1」） =====
//   3日前・2日前＝足りない物がある人にだけ一覧を1通／前日＝一覧、なければ短い1通（高松 hdm-tkm-enqueue と同じ形）。
//   旧：免許証の催促(license-reminder-cron)・場所の催促(mypage_place/mail_place)・前日案内 → この1通にまとめた。
//   見方は新マイページの「必須」と同じ（免許証・時間・お届け場所/到着便・回収場所・人数・お支払い）。帰りの便は催促しない。
const arrOk = (v: any) => { const p = String(v || "").replace(/／/g, "/").split("/").map((x) => x.trim()); return p.length > 1 ? /[A-Za-z]{2,3}\s*\d{1,4}|\d[A-Za-z]\d{3,4}/.test(p[0]) : p[0].length > 1; };
async function prepMissing(store: string, r: any): Promise<string[]> {
  const id = encodeURIComponent(String(r.id));
  let e: any = {};
  try {
    const x = await fetch(`${SB_URL}/rest/v1/rpc/${store}_res_effective`, { method: "POST", headers: H, body: JSON.stringify({ p_res: String(r.id) }) });
    if (x.ok) e = (await x.json()) || {};
  } catch { /* 予約の値で見る */ }
  const [lic, info, pay] = await Promise.all([
    sbGet("license_uploads", `store=eq.${store}&reservation_id=eq.${id}&select=cnt`),
    sbGet("mypage_info", `store=eq.${store}&reservation_id=eq.${id}&select=people,flight_out`),
    sbGet(store === "nha" ? "nha_jalan_payments" : "jalan_payments", `reservation_id=eq.${id}&select=status${store === "nha" ? ",local_paid_at" : ""}`),
  ]);
  const I = info[0] || {};
  const vt = String(r.visit_type || ""), rt = String(r.return_type || "");
  const del = store !== "nha" || !/^(PUB|PU\(バス\)|airport|PU|来店)$/.test(vt);
  const col = store !== "nha" || !/^(BDB|BD\(バス\)|BD|返却)$/.test(rt);
  const has = (v: any) => String(v || "").trim().length > 1;
  const m: string[] = [];
  if (!lic.some((x: any) => Number(x.cnt) > 0)) m.push("運転する方の免許証");
  if (!/\d{1,2}:\d{2}/.test(String(e.lend_time || r.lend_time || r.start_time || ""))) m.push(del ? "お届けの時間" : /PUB/.test(vt) ? "お迎えの時間" : "受け取りの時間");
  if (del) { if (!has(e.del_place) && !has(r.del_place)) m.push("お届け場所"); }
  // 2026-11-09 便欄が「行き / 帰り」のとき、行きが便名でなければ（例「出発便: / ご確認の程を…」）到着便は未登録
  else if (vt !== "来店" && !arrOk(r.del_flight)) m.push("到着便");
  if (col && !has(e.col_place) && !has(r.col_place)) m.push("回収場所");
  if (!(Number(I.people || r.people || 0) > 0)) m.push("ご利用人数");
  // 帰りの便は催促しない（2026-11-09 nosh「帰りの便は予約に必須ではない。来る便がわからない時だけ確認」）
  if (pay.some((p: any) => ["link_created", "email_sent", "reminded"].includes(String(p.status)) && !p.local_paid_at)) m.push("事前決済のお支払い");
  return m;
}
const prepLine = (shop: string, n: number, u: string, miss: string[]) => miss.length
  ? `【HANDYMAN ${shop}】ご出発まで${n === 1 ? "明日" : "あと" + n + "日"}です。まだ登録されていないものがあります👇\n${miss.map((x) => "・" + x).join("\n")}\nマイページからご登録ください。\nSome details are still missing. Please complete them here 👇\n${u}`
  : `【HANDYMAN ${shop}】明日がご利用日です。ご準備はすべて整っています。当日の流れはマイページでご確認ください👇\nYour rental starts tomorrow. You're all set. Check the details here 👇\n${u}`;
// テンプレ（日本語＋English）＋ URL
const TPL: Record<string, (u: string, r: any) => string> = {
  mypage_initial: (u) => `【HANDYMAN 札幌デリバリー】\nご予約ありがとうございます。専用マイページで、お届け／回収の日時・場所の確認・変更ができます👇\nThank you for your booking! Check & edit your delivery/pickup details here 👇\n${u}`,
  mypage_place: (u) => `【HANDYMAN 札幌デリバリー】お届け／回収の場所がまだ未設定です。スムーズなお引き渡しのため、マイページからご登録をお願いします👇\nYour delivery/pickup location is not set yet. Please set it from your page 👇\n${u}`,
  // 2026-11-09 出発前は1日1通（3日前・2日前＝足りない人だけ／前日＝一覧か短い1通）。旧 mypage_place と免許証の催促はここにまとめた
  mypage_prep_d3: (u, r) => prepLine("札幌デリバリー", 3, u, r.__miss || []),
  mypage_prep_d2: (u, r) => prepLine("札幌デリバリー", 2, u, r.__miss || []),
  mypage_daybefore: (u, r) => prepLine("札幌デリバリー", 1, u, r.__miss || []),
  mypage_return3h: (u) => `【HANDYMAN 札幌デリバリー】まもなくご返却のお時間です（約3時間後）。回収の場所・時間をご確認ください👇\nPickup is in about 3 hours. Please review the pickup place & time 👇\n${u}`,
  // 返却日の朝に送る（返却案内＋早め回収ボタンの使い方・訴求）
  // 返却日の朝に送る（早め回収ボタンの訴求）。2026-11-08 時刻は書かない＝送信後に早め回収等で変わると文面が古くなるため（答えはマイページ1か所）
  mypage_returnday: (u) => `【HANDYMAN 札幌デリバリー】本日がご返却日です🚗\n予定より早く返却の準備ができたら、マイページの【🟢 返却の準備ができました（早めの回収OK）】を押してください（空きがあれば早めに伺います）。\n回収の場所・時間はマイページでご確認ください👇\nToday is your return day. If you're ready early, tap the green "Ready for pickup" button. Check details here 👇\n${u}`,
};

// 無人貸出・乗り捨ての担当が付いた予約は、貸出/返却リマインドを自動送信しない（スタッフ手動運用）。
//   貸出担当(d-タスク)が無人/乗り捨て → 場所未設定(②)・前日(③)リマインドを止める
//   返却担当(c-タスク)が乗り捨て/無人 → 返却3時間前(④)リマインドを止める
//   ①初動のマイページ案内は残す。将来 全体自動ONでもこの2種は除外を維持する。
const UNATTENDED_RE = /無人|乗り?捨/;

async function callLinePush(store: string, resvNo: string, action: string, message: string): Promise<any> {
  const secret = Deno.env.get("LINEPUSH_SECRET");
  if (!secret) return { ok: false, reason: "no_secret" };
  try {
    const r = await fetch(`${SB_URL}/functions/v1/line-push`, {
      method: "POST", headers: { "content-type": "application/json", apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify({ secret, store, resv_no: resvNo, action, message }),
    });
    return await r.json().catch(() => ({ ok: false }));
  } catch (e) { return { ok: false, reason: String(e) }; }
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const hdr = req.headers.get("x-cron-secret");
  let body: any = {}; try { body = await req.json(); } catch { /* ignore */ }
  const bySecret = !!cronSecret && (hdr === cronSecret || body?.secret === cronSecret);
  if (!bySecret) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

  const store = "spk"; // P1
  const cfg = (await sbGet(`${store}_line_config`, `id=eq.1&select=*`))[0] || {};
  const enabled = cfg.mypage_notify_enabled === true;
  const testMode = cfg.test_mode === true;
  if (!enabled && !testMode) return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), { headers: { "content-type": "application/json" } });

  const today = dstr(0), d1 = dstr(1), d2 = dstr(2), d3 = dstr(3);
  const RESV = "reservations";
  // 対象＝返却が今日以降・未キャンセル
  const resvsAll = await sbGet(RESV, `return_date=gte.${today}&status=not.in.("キャンセル",cancelled,cancel)&select=id,name,ota,lend_date,lend_time,return_date,return_time,del_time,col_time,del_place,col_place,visit_type,return_type,people,mypage_token&limit=1000`);
  // KEYDROPは独自マイページ(keydrop.jp)を使うため、HANDYMANマイページの送信対象から除外
  const resvs = resvsAll.filter((r: any) => String(r.ota || "").toUpperCase() !== "KEYDROP");
  // LINE連携済み（userIdあり）だけが対象
  const links = await sbGet(`${store}_line_links`, `select=resv_no,line_user_id&limit=5000`);
  const linked = new Set(links.filter((l: any) => l.resv_no && l.line_user_id).map((l: any) => l.resv_no));
  // 既送信（sent）マップ
  const sends = await sbGet(`${store}_line_sends`, `action=like.mypage_*&status=eq.sent&select=resv_no,action&order=id.desc&limit=20000`);
  const sentSet = new Set(sends.map((s: any) => s.resv_no + "|" + s.action));

  // 無人貸出・乗り捨て判定用: リマインド候補予約の d-(貸出) / c-(返却) タスク担当を取得
  const remIds = resvs
    .filter((r: any) => linked.has(r.id) && r.mypage_token &&
      (r.lend_date === d1 || r.lend_date === d2 || r.lend_date === d3 || r.return_date === today || r.return_date === d1))
    .map((r: any) => r.id);
  const lendAsg: Record<string, string> = {};
  const colAsg: Record<string, string> = {};
  const colTimeByRes: Record<string, string> = {}; // c-(返却)タスクの解決時刻（OP/マイページと一致）
  for (let i = 0; i < remIds.length; i += 60) {
    const chunk = remIds.slice(i, i + 60).map((x: string) => encodeURIComponent(x)).join(",");
    if (!chunk) continue;
    const ts = await sbGet("tasks", `reservation_id=in.(${chunk})&deleted=not.is.true&select=reservation_id,_id,assignee,time,changed_json`);
    for (const t of ts) {
      const id = String(t._id || "");
      if (id.startsWith("d-")) lendAsg[t.reservation_id] = String(t.assignee || "");
      else if (id.startsWith("c-")) { colAsg[t.reservation_id] = String(t.assignee || ""); const ct = resolveTaskTime(t); if (ct) colTimeByRes[t.reservation_id] = ct; }
    }
  }
  const unLend = (id: string) => lendAsg[id] && UNATTENDED_RE.test(lendAsg[id]);
  const unCol = (id: string) => colAsg[id] && UNATTENDED_RE.test(colAsg[id]);

  const nowMs = Date.now();
  const jstHour = new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
  const daytime = jstHour >= 9 && jstHour < 21; // 深夜送信防止（JST 9〜21時のみ・初動/場所/前日）
  const results: any[] = [];
  const push = async (r: any, action: string) => {
    const key = r.id + "|" + action;
    if (sentSet.has(key)) return;
    const url = URLBASE + r.mypage_token;
    const msg = TPL[action](url, r);
    const res = await callLinePush(store, r.id, action, msg);
    results.push({ id: r.id, action, ok: !!res.ok, reason: res.reason || null });
    if (res.ok) sentSet.add(key);
  };

  for (const r of resvs) {
    if (!linked.has(r.id) || !r.mypage_token) continue;
    // 回収予定時刻＝OP/マイページと同じ解決値(c-タスク _timeChange/_ssTime優先)。予約生値(return_time/col_time)より優先。
    r._colTimeResolved = colTimeByRes[r.id] || "";
    // ① 初動（LINE ID取得後、まだ送っていなければ）※深夜は送らない
    if (daytime) await push(r, "mypage_initial");
    // ②③ 出発前（2026-11-09 全店統一 3/2/1）：3日前・2日前＝足りない物がある人だけ、前日＝一覧か短い1通 ※無人貸出は除外・深夜は送らない
    for (const [n, dd, act] of [[3, d3, "mypage_prep_d3"], [2, d2, "mypage_prep_d2"], [1, d1, "mypage_daybefore"]] as [number, string, string][]) {
      if (r.lend_date !== dd || unLend(r.id) || !daytime || sentSet.has(r.id + "|" + act)) continue;
      r.__miss = await prepMissing("spk", r);
      if (n > 1 && !r.__miss.length) continue;
      await push(r, act);
    }
    // ③' 返却日の朝(9時以降)に「本日返却日＋早め回収ボタンの使い方・訴求」を1回（札幌のみ・乗り捨て/無人返却は除外）※8時=傷チェックと被らせないため9時
    if (r.return_date === today && new Date(Date.now() + 9 * 3600 * 1000).getUTCHours() >= 9 && !unCol(r.id)) await push(r, "mypage_returnday");
    // ④ 返却3時間前（返却日時が now〜now+3h+window内）※乗り捨て/無人返却は除外
    if (r.return_date && r.return_date >= today && !unCol(r.id)) {
      const rt = (r._colTimeResolved || r.return_time || r.col_time || "18:00");
      if (/^\d{1,2}:\d{2}$/.test(rt)) {
        const dep = new Date(`${r.return_date}T${rt}:00+09:00`).getTime();
        const win = (cfg.window_min || 30) * 60000;
        if (dep - nowMs <= 3 * 3600000 && dep - nowMs > 3 * 3600000 - Math.max(win, 30 * 60000)) await push(r, "mypage_return3h");
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, enabled, testMode, sent: results.filter((x) => x.ok).length, results }), { headers: { "content-type": "application/json" } });
});
