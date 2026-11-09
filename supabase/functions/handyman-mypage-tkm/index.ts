// ============================================================
// handyman-mypage-tkm : HANDYMAN 統合マイページ 高松（じゃらん=HDMブランド・閲覧専用 lookup）
// 2026-08-08 / omni  ※那覇 handyman-mypage-nha を複製元に、BT DB(bt_reservations/bt_tasks)へ作り替え。
//   関係性: BUDDICA高松APPが物理・DBを持つ / じゃらん予約は「HANDYMAN 高松空港店」ブランド(HDM)で同一在庫を共有
//           = HDM↔KEYDROP と同じ構造。じゃらん(HDM)客にはHANDYMANブランドのマイページを"メール"で案内。
//   方針(オーナー確定 2026-08-08): 那覇マイページと同じ・閲覧専用・デリバリー無し(送迎/来店のみ)・メール(LINE無し)。
//   ※当初は ping / lookup / license_uploaded のみ。以後 decide(キャンセル)・cancel_request・terms_signed・damage_approved・set_pickup/set_return を追加。
//   2026-11-08 HDMブランド：set_pickup/set_return は依頼（承認制）に。decide に送迎依頼の approved/rejected/proposed/acknowledged、proposal_reply を追加。
//     承認の反映は DB 関数 bt_apply_mypage_change（app リポ sql/bt_mypage_apply_lock.sql）1回。通知はメールのみ（高松は LINE 無し）。
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
// ★security 2026-10-23 スタッフ許可リスト：「ログインしていれば誰でも」→ 正規スタッフのメールドメインだけ通す。
//   BT(ggqugvyskyiblxiycpci) の auth.users ドメイン＝bt.hdm/buddica.co.jp（2026-10-23確認）。新規登録は無効(disable_signup=true)のためドメインで判定できる。EF は個別デプロイなので各 EF に同じ小関数をコピー。
const STAFF_EMAIL_RE = /@(bt\.hdm|buddica\.co\.jp)$/i;
async function staffUser(token: string): Promise<{ id: string; email: string } | null> {
  const t = String(token || "").replace(/^Bearer\s+/i, "").trim();
  if (!t) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${t}` } });
    if (!r.ok) return null;
    const u: any = await r.json().catch(() => null);
    const email = String(u?.email || "").trim();
    if (!u?.id || !STAFF_EMAIL_RE.test(email)) return null;
    return { id: String(u.id), email };
  } catch (_) { return null; }
}

// マイページのホスト（HANDYMANブランド・高松版）。Apple Notes等 Origin:null も許可(認証はtokenのみ・Cookie不使用)。
function cors(o: string | null) {
  const allow = o || "*";
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Vary": "Origin" };
}
function json(b: unknown, s: number, o: string | null) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors(o), "content-type": "application/json" } }); }

async function sbGet(t: string, q: string): Promise<any[]> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { headers: H }); if (!r.ok) { console.error(`GET ${t}`, await r.text()); return []; } return await r.json(); }
async function sbPost(t: string, b: unknown): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(b) }); if (!r.ok) console.error(`POST ${t}`, await r.text()); }
// ★2026-10-17 bt_tasks への書込は「お客様の操作」としてDBに伝える（x-bt-writer: customer）。DB の _bt_src_guard がこの書込を人の入力として扱い、スタッフの手入力より後なら反映する（オーナー了承）。
async function sbPatch(t: string, q: string, b: unknown): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal", ...(t === "bt_tasks" ? { "x-bt-writer": "customer" } : {}) }, body: JSON.stringify(b) }); if (!r.ok) console.error(`PATCH ${t}`, await r.text()); }
// Slack通知（高松＝BUDDICAワークスペース #operation-高松空港店。SLACK_BOT_TOKEN=BUDDICA bot・未設定なら黙ってskip）
async function slackPost(text: string, blocks?: unknown): Promise<boolean> {
  const token = Deno.env.get("SLACK_BOT_TOKEN"); const ch = Deno.env.get("SLACK_TKM_CHANNEL") || "C0BFMBLEJGZ";
  if (!token || !ch) return false;
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: ch, text, blocks }) }); const j = await r.json(); return !!j.ok; } catch { return false; }
}
// 予約完了・キャンセルは予約専用ch #reservation_notification-高松空港店
async function slackResv(text: string, blocks?: unknown): Promise<boolean> {
  const token = Deno.env.get("SLACK_BOT_TOKEN"); const ch = Deno.env.get("SLACK_TKM_RESV_CHANNEL") || "C0BFKEL4D1Q";
  if (!token) return false;
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: ch, text, blocks }) }); const j = await r.json(); return !!j.ok; } catch { return false; }
}
async function sbDelete(t: string, q: string): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { method: "DELETE", headers: H }); if (!r.ok) console.error(`DELETE ${t}`, await r.text()); }

// ===== 楽天の画面から送る（2026-11-09 nosh「楽天でLINEもメールもない人には、通知もその他の連絡も楽天経由で出す」） =====
//   楽天の予約はメール・電話がこちらに来ない。LINEもメール登録もない人への通知は main の rax_outbox に積み、
//   Mac mini（rax_line_mail.py）が楽天RAXの「予約者へメール送信」から送る。dkey が同じものは二度積まない。
const RAX_URL = "https://ckrxttbnawkclshczsia.supabase.co";
async function raxQueue(key: string, o: { store: string; resv_no: string; kind: string; subject: string; body: string; dkey?: string | null }): Promise<boolean> {
  if (!key) { console.log("[rax] no main key"); return false; }
  try {
    const r = await fetch(`${RAX_URL}/rest/v1/rax_outbox?on_conflict=dkey`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json", Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify({ store: o.store, resv_no: o.resv_no, kind: o.kind, subject: o.subject, body: o.body, dkey: o.dkey || null }),
    });
    if (!r.ok) console.error("[rax]", r.status, await r.text());
    return r.ok;
  } catch (e) { console.error("[rax]", String(e)); return false; }
}
// 顧客へメール通知（reserve@rent-handyman.com・BTプロジェクトのRESEND_API_KEYで送信）
// 2026-10-28 HDM2: site='hdm2'（新サイト予約）だけ送り元・返信先・本文の旧アドレスを reserve@hdm-rentacar.jp に。それ以外は従来どおり。
async function mailCustomer(to: string, subject: string, text: string, site?: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY"); if (!key) { console.log("[mail skip] no RESEND_API_KEY"); return false; }
  const t = String(to || "").trim();
  if (!t || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) {
    // 2026-11-09 楽天でメールがない予約は楽天の画面から送る（rax_outbox → Mac mini）。予約番号は件名「ご予約 {番号} …」から取る（呼び出し5か所とも同じ形）
    const rid = (String(subject).match(/ご予約 (\S+) /) || [])[1];
    if (rid) {
      const rv = (await sbGet("bt_reservations", `id=eq.${encodeURIComponent(rid)}&select=ota&limit=1`))[0];
      if (rv && String(rv.ota || "") === "楽天") return await raxQueue(Deno.env.get("MAIN_SERVICE") || "", { store: "tkm", resv_no: rid, kind: "mypage_decision", subject, body: text, dkey: null });
    }
    console.log("[mail skip] no valid email", to); return false;
  }
  const isHdm2 = String(site || "") === "hdm2";
  const from = isHdm2 ? "HANDYMAN高松空港店 <reserve@hdm-rentacar.jp>" : "HANDYMAN高松空港店 <reserve@rent-handyman.com>";
  const replyTo = isHdm2 ? "reserve@hdm-rentacar.jp" : "reserve@rent-handyman.com";
  if (isHdm2) text = String(text).replace(/reserve@rent-handyman\.(com|jp)/g, "reserve@hdm-rentacar.jp");
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [t], reply_to: [replyTo], subject, text }) });
    if (!r.ok) console.log("[mail] resend error", await r.text().catch(() => ""));
    return r.ok;
  } catch (e) { console.error("[mail]", String(e)); return false; }
}

// 予約もと（OTA）ラベル
const OTA_JP: Record<string, string> = { "じゃらん": "じゃらん", "楽天": "楽天", "エアトリ": "エアトリ", "レンタカードットコム": "レンタカーcom", J: "じゃらん", R: "楽天", O: "エアトリ", RC: "レンタカーcom", HP: "オフィシャル(HP)", site: "オフィシャル(HP)", direct: "直販" };
function otaJp(o?: string): string { const k = String(o || ""); return OTA_JP[k] || k || "—"; }
// 2026-11-07 キャンセル申請は該当予約をアクションタブで直接開く（高松HDM=hdm_tkm）
const actUrl = (rid: string) => `https://nosh2318.github.io/spk-task/mypage-active.html?tab=action&bucket=hdm_tkm&rid=${encodeURIComponent(rid)}`;

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
// 支払完了日（JST）。公式サイト＝Square 注文の完了時刻、じゃらん＝bt_jalan_payments.paid_at。読取のみ。
async function paidAtJst(rid: string, orderId: string): Promise<string> {
  const fmt = (iso: string) => { const d = new Date(new Date(iso).getTime() + 9 * 3600e3); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16).replace("T", " "); };
  try {
    if (orderId === "FREE-COUPON") return "支払なし（クーポン¥0）";
    const sq = Deno.env.get("SQUARE_ACCESS_TOKEN") || "";
    if (orderId && sq) {
      const r = await fetch(`https://connect.squareup.com/v2/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${sq}`, "Square-Version": "2024-06-04" }, signal: AbortSignal.timeout(5000) });
      if (r.ok) { const o = (await r.json())?.order; const t = o?.closed_at || o?.created_at; if (t && fmt(t)) return fmt(t); }
    }
    const jp = await sbGet("bt_jalan_payments", `reservation_id=eq.${encodeURIComponent(rid)}&status=eq.paid&paid_at=not.is.null&select=paid_at&order=paid_at.desc&limit=1`);
    if (jp[0]?.paid_at && fmt(jp[0].paid_at)) return fmt(jp[0].paid_at);
  } catch (e) { console.error("[paidAt]", e); }
  return "不明（Squareで予約番号を検索）";
}
function taskOptNum(t: any, key: string): number {
  if (!t) return 0;
  const cj = parseCj(t);
  return Number(cj[key]) || 0;
}

// ==== 2026-11-08 HDM高松：送迎の変更は「依頼 → アクションタブで承認 → DB関数1回で反映」（那覇 handyman-mypage-nha と同じ設計） ====
//   依頼行 = bt_reservation_changes（source='mypage'・change_type=下の4種）。承認で bt_apply_mypage_change を1回呼ぶ
//   （予約・OPタスク・依頼行を1トランザクションで書き、OPシートと同じ読み方で読み直し、不一致なら全部取り消し。承認値は戻し防止ロック）。
//   BUDDICAブランドはこの流れに乗らない（従来どおり即反映のまま）。
const MP_TYPES: Record<string, string> = { mp_pickup: "pickup", mp_visit: "visit", mp_dropoff: "dropoff", mp_store_return: "store_return" };
const MP_GO = ["mp_pickup", "mp_visit"], MP_RT = ["mp_dropoff", "mp_store_return"], MP_TIME = ["mp_pickup", "mp_dropoff"];
const MP_LIST = Object.keys(MP_TYPES).join(",");
const FLD_JP: Record<string, string> = { mp_pickup: "行き（空港お迎え）", mp_visit: "行きの方法", mp_dropoff: "帰り（空港へ送迎）", mp_store_return: "帰りの方法", cancel: "キャンセル" };
const isHdm = (r: any) => String(r?.brand || "") === "HDM";
const myUrl = (tk: string) => tk ? `https://nosh2318.github.io/spk-task/my-tkm.html?t=${tk}` : "";
const FOOT = `\n\nHANDYMAN高松空港店\nreserve@rent-handyman.com`;
// マイページの時間プルダウンと同じ：9:00〜18:45 の15分刻み＋18:50
function okTime(tm: string): string {
  const m = String(tm || "").trim().match(/^(\d{1,2}):(\d{2})$/); if (!m) return "";
  const v = +m[1] * 60 + +m[2]; if (!((v >= 540 && v <= 1125 && v % 15 === 0) || v === 1130)) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}
// お断り理由（アクションタブ RSN_L と同じ code）
const REJ_JP: Record<string, string> = {
  no_vehicle: "誠に恐れ入りますが、予約状況の兼ね合いにより、ご希望の日時にご用意できるお車がございません。",
  full_slot: "誠に恐れ入りますが、{staff}の状況により、ご希望のお時間に伺うことができません。",
  out_of_area: "ご希望の場所は、送迎の対象エリア外のため、伺うことができません。",
  out_of_stock: "誠に恐れ入りますが、在庫状況により、ご希望のオプションをご用意できる数がございません。",
  past_deadline: "変更の受付締切を過ぎているため、ご変更を承ることができません。",
  other: "",
};
function staffOf(f: string): string { return MP_TIME.includes(f) ? "送迎スタッフ" : "担当スタッフ"; }
function rejectLine(code: string, text: string, f = ""): string { const a = (REJ_JP[code] || "").replace("{staff}", staffOf(f)); const t = String(text || "").trim().slice(0, 200); return [a, t].filter(Boolean).join("\n"); }
// 代わりの案の期限：今から24時間、ただし受け渡しの2時間前まで（最短30分）
function proposalExpires(f: string, r: any): string {
  const now = Date.now(); let exp = now + 24 * 3600e3;
  const rt = MP_RT.includes(f); const d = rt ? r.end_date : r.start_date; const t = rt ? (r.dropoff_time || r.end_time) : (r.pickup_time || r.start_time);
  if (d) { const hm = String(t || "09:00").match(/(\d{1,2}):(\d{2})/); const h = hm ? +hm[1] : 9, m = hm ? +hm[2] : 0;
    const hand = Date.parse(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+09:00`); if (!isNaN(hand)) exp = Math.min(exp, hand - 2 * 3600e3); }
  return new Date(Math.max(exp, now + 30 * 60e3)).toISOString();
}
// アクションタブ pvMsg と同じ組み立て（スタッフが文を直さなかった時の既定文）
function declineMsg(head: string, label: string, f: string, newV: string, oldV: string, why: string, alt: string, next: string, url: string): string {
  const want = f === "cancel" ? "ご予約のキャンセル" : `${label}の変更${newV ? `（${newV}）` : ""}`;
  const lines = [`${head}ご依頼いただいた${want}につきまして、ご連絡いたします。`];
  if (why) lines.push(why);
  if (alt) lines.push(`代わりに、${alt}${/[。！？!?]$/.test(alt) ? "" : "。"}`);
  if (next) lines.push(next);
  lines.push(f === "cancel" || !oldV ? "今のご予約はそのままです。" : `今のご予約（${label}：${oldV}）はそのままです。`);
  lines.push("ご不便をおかけいたしますが、何卒よろしくお願いいたします。");
  if (url) lines.push(url);
  return lines.join("\n");
}
// アクションタブでスタッフが直した文（message_text）があれば、その文をそのまま送る
function staffText(p: any, url: string): string { const s = String(p?.message_text || "").replace(/\r\n/g, "\n").trim().slice(0, 2000); if (!s) return ""; return s.replace(/（マイページのURL）/g, url || "").replace(/\n{3,}/g, "\n\n").trim(); }
// 代わりの案の期限は画面に出した値（expires_at）を使う（25分後〜24時間10分後の範囲だけ受け付け）
function expOverride(p: any, fallback: string): string { const e = Date.parse(String(p?.expires_at || "")), now = Date.now(); return (!isNaN(e) && e >= now + 25 * 60e3 && e <= now + 24 * 3600e3 + 10 * 60e3) ? new Date(e).toISOString() : fallback; }
function jstMdHm(iso: string): string { const j = new Date(Date.parse(iso) + 9 * 3600e3); return `${j.getUTCMonth() + 1}/${j.getUTCDate()} ${String(j.getUTCHours()).padStart(2, "0")}:${String(j.getUTCMinutes()).padStart(2, "0")}`; }
function md(d: string): string { const m = String(d || "").match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${+m[1]}/${+m[2]}` : ""; }
// 今の状態（依頼の「変更前」・お断り文の「今のご予約」）
function curGo(r: any): string { return r.pickup_time ? `空港お迎え ${r.pickup_time}〜` : String(r.visit_type || "") === "来店" ? "店舗へ来店" : ""; }
function curRt(r: any): string { return r.dropoff_time ? `空港へ送迎 ${r.dropoff_time}〜` : String(r.return_type || "") === "返却" ? "店舗で返却" : ""; }
// 反映＝DB関数1回。失敗したら何も変わっていない（承認しない・お客様にも送らない）
async function tkmApply(resId: string, ctype: string, val: string, flight: string, actor: string, changeId: unknown): Promise<{ ok: boolean; error?: string }> {
  const f = MP_TYPES[ctype]; if (!f) return { ok: false, error: "反映できない種類です" };
  const r = await fetch(`${SB_URL}/rest/v1/rpc/bt_apply_mypage_change`, { method: "POST", headers: H,
    body: JSON.stringify({ p_res: resId, p_field: f, p_val: val, p_actor: actor, p_change_id: Number(changeId) || null, p_flight: flight || null }) });
  if (!r.ok) { const tx = await r.text(); console.error("[apply]", tx); let m = tx; try { m = JSON.parse(tx).message || tx; } catch { /* noop */ } return { ok: false, error: String(m).slice(0, 300) }; }
  return { ok: true };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  let p: any; try { p = await req.json(); } catch { return json({ error: "bad json" }, 400, origin); }

  const action = String(p.action || "lookup").trim();

  // ==== keep-warm ping（DB不使用・即応答）====
  if (action === "ping") return json({ ok: true, warm: true, store: "tkm" }, 200, origin);

  // ==== キャンセル承認/却下（スタッフ・承認必須。返金は手動）====
  if (action === "decide") {
    // 認証: (a) 共通PIN（全店ダッシュボード・目視承認）／(b) スタッフJWT
    const ADMIN_PIN = Deno.env.get("ADMIN_PIN") || "";
    const adminPin = String(p.admin_pin || "");
    let actor = "";
    if (ADMIN_PIN && adminPin && adminPin === ADMIN_PIN) { actor = "staff:admin_pin"; }
    else {
      const staffToken = String(p.staff_token || "").trim();
      if (!staffToken) return json({ error: "スタッフ認証（PIN）が必要です" }, 401, origin);
      const who = await staffUser(staffToken);
      if (!who) return json({ error: "認証に失敗しました" }, 401, origin);
      const wj: any = who;
      actor = "staff:" + (wj?.email || wj?.id || "unknown");
    }
    const changeId = p.change_id;
    const decision = String(p.decision || "").trim();
    if (!changeId || !["approved", "rejected", "acknowledged", "proposed"].includes(decision)) return json({ error: "パラメータ不正" }, 400, origin);
    const cRows = await sbGet("bt_reservation_changes", `id=eq.${encodeURIComponent(String(changeId))}&select=id,reservation_id,status,change_type,old_value,new_value,payload`);
    const c = cRows[0];
    if (!c) return json({ error: "対象が見つかりません" }, 404, origin);
    if (c.status !== "requested") return json({ error: "処理済みです", status: c.status }, 409, origin);
    const rid = String(c.reservation_id);
    const cid = encodeURIComponent(String(changeId));
    // 確認済み（対応不要・アーカイブのみ。反映も通知もしない）
    if (decision === "acknowledged") { await sbPatch("bt_reservation_changes", `id=eq.${cid}`, { status: "acknowledged", decided_by: actor, decided_at: new Date().toISOString() }); return json({ ok: true, decided: "acknowledged" }, 200, origin); }
    const ctype = String(c.change_type || "");
    const pl0: any = (c.payload && typeof c.payload === "object") ? c.payload : {};
    const rejCode = String(p.reject_reason || ""), rejText = String(p.reject_text || "").trim().slice(0, 200);
    const altText = String(p.alt_text || "").trim().slice(0, 300);
    const keep = p.keep_as_is === true || p.keep_as_is === "true";
    // ==== 2026-11-08 HDM高松 送迎の依頼（mp_*）：承認＝DB関数で反映 / 代わりの案 / お断り ====
    if (MP_TYPES[ctype]) {
      const rv = (await sbGet("bt_reservations", `id=eq.${encodeURIComponent(rid)}&select=id,name,brand,start_date,start_time,end_date,end_time,pickup_time,dropoff_time,visit_type,return_type,del_flight,mail,site,mypage_token`))[0];
      if (!rv) return json({ error: "予約が見つかりません" }, 404, origin);
      if (!isHdm(rv)) return json({ error: "HDMブランドの予約だけが対象です" }, 400, origin);
      const lbl = FLD_JP[ctype] || ctype, url = myUrl(String(rv.mypage_token || "")), nm = `${rv.name || "お客様"} 様\n\n`;
      const oldV = String(c.old_value || "") || (MP_GO.includes(ctype) ? curGo(rv) : curRt(rv));
      if (decision === "proposed") {
        if (!MP_TIME.includes(ctype)) return json({ error: "この種類の依頼は「この案でOK」ではなく文でお返事します（decision=rejected＋alt_text）" }, 400, origin);
        const ptext = String(p.proposal_text || "").trim().slice(0, 300); const pval = okTime(String(p.proposal_value || ""));
        if (!ptext) return json({ error: "代わりの案の内容を書いてください" }, 400, origin);
        if (!pval) return json({ error: "時間を 9:00〜18:50（15分刻み）から選んでください" }, 400, origin);
        const exp = expOverride(p, proposalExpires(ctype, rv));
        const body = staffText(p, url) || declineMsg("【HANDYMAN 高松】", lbl, ctype, String(c.new_value || ""), oldV, rejectLine(rejCode, rejText, ctype), ptext, `マイページで「この案でOK」を押すと確定します（${jstMdHm(exp)}まで）。ご都合が合わなければ「やめる」を押してください。`, url);
        await sbPatch("bt_reservation_changes", `id=eq.${cid}`, { status: "proposed", decided_by: actor, decided_at: new Date().toISOString(),
          payload: { ...pl0, proposal: { text: ptext, value: pval, reason: rejCode || "", reason_text: rejText, expires_at: exp, by: actor, at: new Date().toISOString(), sent: body.slice(0, 2000) } } });
        await mailCustomer(rv.mail, `【HANDYMAN高松空港店】ご予約 ${rid} ご依頼について代わりの案のご提案`, nm + body + FOOT, rv.site);
        await slackPost(`💬 代わりの案を送りました [高松] ${lbl} / ${rid}：${ptext}（お客様の返事待ち・${jstMdHm(exp)}まで）／ ${actor.replace(/^staff:/, "")}`);
        return json({ ok: true, decided: "proposed", expires_at: exp }, 200, origin);
      }
      if (decision === "rejected") {
        if (!altText && !keep) return json({ error: "代わりにできること（〜ならできます）を書いてください" }, 400, origin);
        const rl = rejectLine(rejCode, rejText, ctype);
        let body = staffText(p, url);
        if (!body) { body = declineMsg("【HANDYMAN 高松】", lbl, ctype, String(c.new_value || ""), oldV, rl, keep ? "" : altText, keep ? "" : "こちらでよろしければ、マイページから改めてご依頼ください。", url); if (keep) body = body.replace(/はそのままです。/, "のままでのご利用をお願いできますでしょうか。"); }
        await mailCustomer(rv.mail, `【HANDYMAN高松空港店】ご予約 ${rid} ご依頼の結果`, nm + body + FOOT, rv.site);
        await sbPatch("bt_reservation_changes", `id=eq.${cid}`, { status: "rejected", decided_by: actor, decided_at: new Date().toISOString(),
          payload: { ...pl0, reject: { reason: rejCode || "other", text: rejText, alt: altText, ...(keep ? { keep: true } : {}), by: actor, at: new Date().toISOString(), sent: body.slice(0, 2000) } } });
        await slackPost(`🚫 送迎の依頼をお断り [高松] ${lbl} / ${rid} ／ ${actor.replace(/^staff:/, "")}`);
        return json({ ok: true, decided: "rejected" }, 200, origin);
      }
      // 承認：DB関数で反映（依頼行も同じトランザクションで approved）。失敗なら 500・メールしない・依頼は受付のまま
      const val = MP_TIME.includes(ctype) ? String(pl0.time || "") : (ctype === "mp_visit" ? "来店" : "返却");
      const ap = await tkmApply(rid, ctype, val, ctype === "mp_pickup" ? String(pl0.flight || "") : "", actor, changeId);
      if (!ap.ok) return json({ error: "反映できませんでした（何も変更していません）：" + (ap.error || ""), apply_failed: true }, 500, origin);
      const tmv = okTime(val);
      const what = ctype === "mp_pickup" ? `行き：空港へのお迎え ${md(rv.start_date)} ${tmv}〜${pl0.flight ? `（ご搭乗便 ${pl0.flight}）` : ""}`
        : ctype === "mp_visit" ? "行き：店舗へご来店"
        : ctype === "mp_dropoff" ? `帰り：店舗から空港へのお送り ${md(rv.end_date)} ${tmv}〜` : "帰り：店舗でご返却";
      await mailCustomer(rv.mail, `【HANDYMAN高松空港店】ご予約 ${rid} ご依頼の結果`,
        nm + `【HANDYMAN 高松】ご依頼を承り、反映いたしました。\n${what}\n\nマイページでご確認いただけます。\n${url}` + FOOT, rv.site);
      await slackPost(`✅ 送迎の依頼を承認・反映 [高松] ${lbl} / ${rid}：${what} ／ ${actor.replace(/^staff:/, "")}`);
      return json({ ok: true, decided: "approved" }, 200, origin);
    }
    // ---- 以下キャンセル（従来どおり）。代わりの案の「文で返す」お断り（alt_text／message_text）にも対応 ----
    if (decision === "proposed") return json({ error: "キャンセルは「この案でOK」ではなく文でお返事します（decision=rejected＋alt_text）" }, 400, origin);
    const rejPl = decision === "rejected" && (rejCode || altText || keep || p.message_text) ? { payload: { ...pl0, reject: { reason: rejCode || "other", text: rejText, alt: altText, ...(keep ? { keep: true } : {}), by: actor, at: new Date().toISOString() } } } : {};
    await sbPatch("bt_reservation_changes", `id=eq.${encodeURIComponent(String(changeId))}`, { status: decision, decided_by: actor, decided_at: new Date().toISOString(), ...rejPl });
    const rr = (await sbGet("bt_reservations", `id=eq.${encodeURIComponent(rid)}&select=id,name,ota,start_date,end_date,vehicle_class,price,mail,site,square_order_id`))[0] || { id: rid };
    const _nt = String(rr.ota || "") === "HANDYMAN" ? "（🆕NEW リニューアル公式サイト rent-handyman.com）" : "";  // 新サイト(.com)判定
    if (decision === "approved") {
      // 承認＝キャンセル確定＋配車解放（返金はスタッフが規定に沿って手動でSquare返金）
      await sbPatch("bt_reservations", `id=eq.${encodeURIComponent(rid)}`, { status: "キャンセル", updated_at: new Date().toISOString() });
      await sbDelete("bt_fleet", `reservation_id=eq.${encodeURIComponent(rid)}`);
      await mailCustomer(rr.mail, `【HANDYMAN高松空港店】ご予約 ${rid} キャンセル受付のご連絡`,
        `${rr.name || "お客様"} 様\n\nこの度はご連絡いただきありがとうございます。\nご予約 ${rid}（${rr.start_date || ""}〜${rr.end_date || ""}）のキャンセルを承りました。\n\n返金がある場合は、規定に沿って別途手続きのうえご連絡いたします。\nまたのご利用を心よりお待ちしております。\n\nHANDYMAN高松空港店\nreserve@rent-handyman.com`, rr.site);
      // ★2026-11-06 支払完了日を通知に出す（Square返金時に探しやすく）。読取のみ・失敗しても承認は止めない。
      const paidAt = await paidAtJst(rid, String(rr.square_order_id || ""));
      await slackResv(`✅ キャンセル承認（確定）[高松]${_nt} ${rr.name || ""} / ${rid} ／ 支払完了日 ${paidAt} ／ ${actor}`, [
        { type: "header", text: { type: "plain_text", text: `✅ キャンセル承認（確定）${_nt ? " 🆕NEW" : ""}`, emoji: true } },
        { type: "section", fields: [
          { type: "mrkdwn", text: `*お客様:*\n${rr.name || "-"} 様` }, { type: "mrkdwn", text: `*予約番号:*\n${rid}` },
          { type: "mrkdwn", text: `*利用期間:*\n${rr.start_date || "-"} 〜 ${rr.end_date || "-"}` }, { type: "mrkdwn", text: `*金額:*\n¥${Number(rr.price || 0).toLocaleString()}` },
          { type: "mrkdwn", text: `*支払完了日:*\n${paidAt}` },
        ] },
        { type: "context", elements: [ { type: "mrkdwn", text: `キャンセル確定・配車解放済み。⚠️ 返金は規定（7日前無料/6-3日20%/2日前・前日30%/当日50%）に沿って Square で手動返金してください。承認: ${actor}` } ] },
      ]);
    } else {
      // 2026-11-08 アクションタブの「代わりの案」から来たお断りは、スタッフの文（message_text）か理由＋代わりの案の文で送る。無ければ従来の文
      const rl = rejectLine(rejCode, rejText, "cancel");
      let body = staffText(p, "");
      if (!body && (altText || keep)) { body = declineMsg("", "キャンセル", "cancel", "", "", rl, keep ? "" : altText, "", ""); if (keep) body = body.replace(/はそのままです。/, "のままでのご利用をお願いできますでしょうか。"); }
      if (!body) body = `お問い合わせいただいたご予約 ${rid} のキャンセルにつきまして、恐れ入りますが今回はお受けいたしかねます。\n詳細は担当より別途ご連絡いたします。`;
      await mailCustomer(rr.mail, `【HANDYMAN高松空港店】ご予約 ${rid} キャンセルのご相談につきまして`,
        `${rr.name || "お客様"} 様\n\n${body}\n\nHANDYMAN高松空港店\nreserve@rent-handyman.com`, rr.site);
      if ((rejPl as any).payload) await sbPatch("bt_reservation_changes", `id=eq.${cid}`, { payload: { ...(rejPl as any).payload, reject: { ...(rejPl as any).payload.reject, sent: body.slice(0, 2000) } } });
      await slackResv(`🚫 キャンセル却下 [高松]${_nt} ${rr.name || ""} / ${rid} ／ ${actor}`);
    }
    return json({ ok: true, decision }, 200, origin);
  }

  if (action !== "lookup" && action !== "license_uploaded" && action !== "terms_signed" && action !== "damage_approved" && action !== "set_pickup" && action !== "set_return" && action !== "cancel_request" && action !== "proposal_reply") return json({ error: "unsupported action" }, 400, origin);

  const token = String(p.token || "").trim();
  if (!token || token.length < 20) return json({ error: "アクセスキーが不正です" }, 400, origin);

  // token で予約特定（高松 bt_reservations）
  const SEL = "id,ota,source,brand,name,start_date,start_time,end_date,end_time,vehicle_class,vehicle_name,insurance,people,price,status,visit_type,return_type,del_time,del_place,col_time,col_place,del_flight,opt_b,opt_c,opt_j,opt_usb,mypage_token,pickup_time,dropoff_time,pay_url,paid";
  const rows = await sbGet("bt_reservations", `mypage_token=eq.${encodeURIComponent(token)}&select=${SEL}`);
  const r = rows[0];
  if (!r) return json({ error: "予約が見つかりません" }, 404, origin);
  // ★ブランド越境ガード: このEFはHANDYMAN(HDM)専用。BUDDICA予約は表示せず正しいご利用ガイドへ誘導
  if (String(r.brand || "") === "BUDDICA") {
    return json({ wrong_brand: true, brand: "BUDDICA", correct_url: "https://buddica-touring.github.io/app/guide/?t=" + encodeURIComponent(token), error: "このご予約はBUDDICA TOURINGです。ご利用ガイドは正しいページでご確認ください。" }, 200, origin);
  }
  const resId = String(r.id);
  // ★CANCELLED_ONLY_1030 キャンセル済みは「M月D日にキャンセル済みです」だけを返す（予約の中身は一切返さない／全アクション共通）
  { const _cs = String(r.status || ""); if (/cancel/i.test(_cs) || _cs.indexOf("キャンセル") >= 0) {
    let _at = "";
    try { const _lg = await sbGet("reservation_cancel_ledger", `reservation_id=eq.${encodeURIComponent(resId)}&event=eq.cancel&order=changed_at.desc&limit=1&select=changed_at`); _at = String((_lg[0] && _lg[0].changed_at) || ""); } catch (_) { /* noop */ }
    if (!_at) { try { const _u = await sbGet("bt_reservations", `id=eq.${encodeURIComponent(resId)}&select=updated_at`); _at = String((_u[0] && _u[0].updated_at) || ""); } catch (_) { /* noop */ } }
    const _t = _at ? new Date(_at).getTime() : NaN;
    const _cd = isNaN(_t) ? "" : new Date(_t + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const _msg = _cd ? `${+_cd.slice(5, 7)}月${+_cd.slice(8, 10)}日にキャンセル済みです` : "キャンセル済みです";
    return json({ ok: false, cancelled: true, cancel_date: _cd, error: _msg }, 200, origin);
  } }

  // ---- license_uploaded: お客様がマイページから免許証をアップした完了通知（Slack・高松） ----
  if (action === "license_uploaded") {
    const cnt = Math.max(1, Math.min(20, parseInt(String(p.count || 1), 10) || 1));
    const drivers = Math.max(1, Math.min(10, parseInt(String(p.drivers || 1), 10) || 1));
    // ★2026-10-11 追加アップは既存の枚数・人数に積み上げ(旧: 毎回上書き＝後から1名追加すると1名に戻った)
    let totCnt = cnt, totDrv = drivers;
    try { const prev = await sbGet("license_uploads", `reservation_id=eq.${encodeURIComponent(resId)}&select=cnt,drivers`); if (prev[0]) { totCnt += Number(prev[0].cnt) || 0; totDrv += Number(prev[0].drivers) || 0; } } catch (_) { /* noop */ }
    const blocks = [
      { type: "header", text: { type: "plain_text", text: "🪪 免許証アップロード（お客様）", emoji: true } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"}` },
        { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
        { type: "mrkdwn", text: `*ご予約元:*\n${otaJp(r.ota)}` },
        { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
        { type: "mrkdwn", text: `*車両クラス:*\n${r.vehicle_class || r.vehicle_name || "-"}` },
        { type: "mrkdwn", text: `*アップ枚数:*\n今回${cnt}枚（運転者${drivers}名）／累計${totCnt}枚（${totDrv}名）` },
      ] },
      { type: "context", elements: [ { type: "mrkdwn", text: "Googleドライブ（高松フォルダ）に保存済み。貸渡手続きにご利用ください。" } ] },
    ];
    try { await fetch(`${SB_URL}/rest/v1/license_uploads?on_conflict=reservation_id`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ reservation_id: resId, store: "tkm", cnt: totCnt, drivers: totDrv, last_at: new Date().toISOString() }) }); } catch (_) { /* noop */ }
    await slackPost(`🪪 免許証アップロード完了 [高松] ${r.name || ""} / ${resId} / ${cnt}枚`, blocks);
    return json({ ok: true }, 200, origin);
  }

  // ---- cancel_request: HP直販予約のキャンセル申請（承認必須）。OTA予約は各OTAから申請＝ここでは受け付けない ----
  if (action === "cancel_request") {
    const st0 = String(r.status || "");
    if (st0 === "キャンセル" || st0 === "cancelled" || st0 === "cancel") return json({ ok: true, alreadyCancelled: true }, 200, origin);
    // キャンセル申請できるのは自社HP直販（source≠ota）＝HANDYMAN公式・BUDDICA自社サイト・手動。OTA経由(source=ota)は各OTAへ。
    const isOta = String(r.source || "").toLowerCase() === "ota";
    if (isOta) return json({ error: "OTAでご予約の場合は、ご予約された各OTAサイトからキャンセルをお申し込みください。", otaOnly: true }, 400, origin);
    const reason = String(p.reason || "").trim().slice(0, 300);
    const already = await sbGet("bt_reservation_changes", `reservation_id=eq.${encodeURIComponent(resId)}&change_type=eq.cancel&status=eq.requested&select=id&limit=1`);
    if (already[0]) return json({ ok: true, alreadyRequested: true }, 200, origin);
    await sbPost("bt_reservation_changes", { reservation_id: resId, change_type: "cancel", field_name: "status", old_value: st0, new_value: "キャンセル依頼", status: "requested", changed_by: "customer", source: "mypage" });
    { const _nt = String(r.ota || "") === "HANDYMAN" ? "（🆕NEW リニューアル公式サイト rent-handyman.com）" : "";
    await slackResv(`🔴 キャンセル申請（承認待ち）[高松]${_nt} ${r.name || ""} / ${resId}`, [
      { type: "header", text: { type: "plain_text", text: `🔴 キャンセル申請（承認待ち）[高松]${_nt ? " 🆕NEW" : ""}`, emoji: true } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"} 様` }, { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
        { type: "mrkdwn", text: `*ご予約元:*\n${otaJp(r.ota)}` }, { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
        { type: "mrkdwn", text: `*車両:*\n${r.vehicle_class || r.vehicle_name || "-"}` }, { type: "mrkdwn", text: `*金額:*\n¥${Number(r.price || 0).toLocaleString()}` },
      ] },
      { type: "section", text: { type: "mrkdwn", text: `*理由:*\n${reason || "（記載なし）"}` } },
      { type: "actions", elements: [ { type: "button", text: { type: "plain_text", text: "✅ キャンセル処理を開く", emoji: true }, style: "primary", url: actUrl(resId) } ] },
      { type: "context", elements: [ { type: "mrkdwn", text: "⚠️ 承認制です。上のボタンでこの予約の承認/却下画面が開きます（承認＝キャンセル確定＋配車解放＋お客様へメール。返金は規定に沿って手動Square返金）。" } ] },
    ]); }
    return json({ ok: true, requested: true }, 200, origin);
  }

  // ---- terms_signed: お客様がマイページで貸渡約款に同意署名（じゃらんHDMは必須）→ OPシート反映 ＋ Slack通知 ----
  if (action === "terms_signed") {
    const signName = String(p.name || r.name || "").trim().slice(0, 60);
    const at = nowJst();
    // OPシート「約款」列に署名を反映（予約番号一致の全タスク・墓標除外）
    try { await sbPatch("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&deleted=not.is.true`, { [("約款")]: `同意(${signName}) ${at.slice(5, 16).replace("T", " ")}` }); } catch (_) { /* noop */ }
    // ★2026-08-09 約款の正本 handover_signatures(terms_agree) にも記録＝OPシート約款バッジ(_signMap)・bt-mail-cron が読む正本。bt_tasks.約款 はアプリ再生成で boolean false に戻り得る(R0WGF9I8で発覚)→バッジに反映されなかった。handover_signatures は永続。
    try { await sbPost("handover_signatures", { reservation_id: resId, sign_type: "terms_agree", signer_name: signName, signed_at: at, device: "mypage-tkm", signature_data: "(マイページ同意)" }); } catch (_) { /* noop */ }
    const blocks = [
      { type: "header", text: { type: "plain_text", text: "📄 貸渡約款に同意署名（お客様）", emoji: true } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"}` },
        { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
        { type: "mrkdwn", text: `*ご予約元:*\n${otaJp(r.ota)}` },
        { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
        { type: "mrkdwn", text: `*署名:*\n${signName || "-"}` },
        { type: "mrkdwn", text: `*署名日時:*\n${at.slice(0, 16).replace("T", " ")}` },
      ] },
      { type: "context", elements: [ { type: "mrkdwn", text: "貸渡約款にご同意いただきました。OPシート「約款」欄に反映済み。" } ] },
    ];
    await slackPost(`📄 約款同意署名 [高松] ${r.name || ""} / ${resId}`, blocks);
    return json({ ok: true, signed: true, at }, 200, origin);
  }

  // ---- damage_approved: お客様が傷チェック（車両状態）を確認・承認署名 → 正本 handover_signatures ＋ Slack通知 ----
  if (action === "damage_approved") {
    const signName = String(p.name || r.name || "").trim().slice(0, 60);
    const at = nowJst();
    try { await sbPost("handover_signatures", { reservation_id: resId, sign_type: "damage_approve", signer_name: signName, signed_at: at, device: "mypage-tkm", signature_data: "(マイページ傷承認)" }); } catch (_) { /* noop */ }
    const blocks = [
      { type: "header", text: { type: "plain_text", text: "🩹 車両状態チェックを確認・承認（お客様）", emoji: true } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"}` },
        { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
        { type: "mrkdwn", text: `*ご予約元:*\n${otaJp(r.ota)}` },
        { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
        { type: "mrkdwn", text: `*署名:*\n${signName || "-"}` },
        { type: "mrkdwn", text: `*承認日時:*\n${at.slice(0, 16).replace("T", " ")}` },
      ] },
      { type: "context", elements: [ { type: "mrkdwn", text: "車両状態（傷）をご確認・ご承認いただきました。" } ] },
    ];
    await slackPost(`🩹 傷チェック承認 [高松] ${r.name || ""} / ${resId}`, blocks);
    return json({ ok: true, approved: true, at }, 200, origin);
  }

  // ---- proposal_reply: お客様が代わりの案に返事（accept=この案でOK / decline=やめる）。HDM高松の送迎依頼だけ ----
  if (action === "proposal_reply") {
    if (!isHdm(r)) return json({ error: "unsupported action" }, 400, origin);
    const pcid = String(p.change_id || ""); const ans = String(p.answer || "");
    if (!pcid || (ans !== "accept" && ans !== "decline")) return json({ error: "パラメータ不正" }, 400, origin);
    const pc = (await sbGet("bt_reservation_changes", `id=eq.${encodeURIComponent(pcid)}&reservation_id=eq.${encodeURIComponent(resId)}&source=eq.mypage&change_type=in.(${MP_LIST})&select=id,change_type,new_value,status,payload`))[0];
    if (!pc) return json({ error: "ご提案が見つかりません" }, 404, origin);
    if (pc.status !== "proposed") return json({ ok: true, already: pc.status }, 200, origin);
    const ppl: any = (pc.payload && typeof pc.payload === "object") ? pc.payload : {}; const pr: any = ppl.proposal || {};
    const fj = FLD_JP[pc.change_type] || pc.change_type, nowIso = new Date().toISOString();
    if (pr.expires_at && Date.parse(pr.expires_at) < Date.now()) {
      await sbPatch("bt_reservation_changes", `id=eq.${encodeURIComponent(pcid)}`, { status: "expired", decided_at: nowIso, payload: { ...ppl, proposal: { ...pr, answer: "expired", answered_at: nowIso } } });
      return json({ ok: false, expired: true, error: "ご提案の期限が過ぎました。今のご予約のままです。" }, 200, origin);
    }
    if (ans === "decline") {
      await sbPatch("bt_reservation_changes", `id=eq.${encodeURIComponent(pcid)}`, { status: "declined_by_guest", decided_at: nowIso, payload: { ...ppl, proposal: { ...pr, answer: "decline", answered_at: nowIso } } });
      await slackPost(`↩️ お客様が代わりの案を見送りました [高松] ${fj} / ${resId}（今の予約のまま）`);
      return json({ ok: true, answered: "decline" }, 200, origin);
    }
    // accept：案の時間に差し替えて requested に戻し、スタッフ承認と同じ decide を内部で呼ぶ（DB関数で反映＋メール）
    const nv = okTime(String(pr.value || ""));
    if (!nv) return json({ error: "ご提案の時間が読めませんでした。お手数ですが店舗へご連絡ください。" }, 400, origin);
    await sbPatch("bt_reservation_changes", `id=eq.${encodeURIComponent(pcid)}`, { status: "requested", new_value: `${nv}〜`, payload: { ...ppl, time: nv, proposal: { ...pr, answer: "accept", answered_at: nowIso } } });
    const dr2 = await fetch(`${SB_URL}/functions/v1/handyman-mypage-tkm`, { method: "POST", headers: { "content-type": "application/json", apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify({ action: "decide", admin_pin: Deno.env.get("ADMIN_PIN") || "", change_id: Number(pcid) || pcid, decision: "approved" }) });
    const dj: any = await dr2.json().catch(() => ({}));
    if (!dr2.ok || !dj.ok) { console.error("[proposal accept]", dr2.status, JSON.stringify(dj)); await slackPost(`⚠️ お客様が代わりの案にOKしましたが自動反映に失敗 [高松] ${fj} / ${resId}（アクションタブで承認してください）：${String(dj.error || "").slice(0, 200)}`); return json({ ok: true, answered: "accept", pending: true }, 200, origin); }
    await slackPost(`✅ お客様が代わりの案にOK → 確定しました [高松] ${fj} / ${resId}：${pr.text || nv}`);
    return json({ ok: true, answered: "accept" }, 200, origin);
  }

  // ---- 2026-11-08 HDM高松：set_pickup / set_return は「依頼」として受け付ける（即反映しない）。アクションタブで承認→DB関数で反映→メール ----
  //   BUDDICAブランド（このEFでは上の越境ガードで止まる）・ブランド未確定は下の従来処理（即反映）のまま。
  if ((action === "set_pickup" || action === "set_return") && isHdm(r)) {
    const go = action === "set_pickup", want = p.want !== false;
    const ctype = go ? (want ? "mp_pickup" : "mp_visit") : (want ? "mp_dropoff" : "mp_store_return");
    const tm = want ? okTime(String(p.time || "")) : "";
    if (want && !tm) return json({ error: "時間は 9:00〜18:50（15分刻み）から選んでください" }, 400, origin);
    const flight = go && want ? String(p.flight || "").trim().slice(0, 40) : "";
    // 今と同じなら依頼にしない
    const same = ctype === "mp_pickup" ? (r.visit_type === "PU" && r.pickup_time === tm && (!flight || r.del_flight === flight))
      : ctype === "mp_visit" ? (r.visit_type === "来店" && !r.pickup_time)
      : ctype === "mp_dropoff" ? (r.return_type === "BD" && r.dropoff_time === tm) : (r.return_type === "返却" && !r.dropoff_time);
    if (same) return json({ ok: true, noChange: true }, 200, origin);
    const legs = go ? MP_GO : MP_RT;
    const newV = want ? `${tm}〜` : (ctype === "mp_visit" ? "店舗へ来店" : "店舗で返却");
    const pay: Record<string, unknown> = { want, ...(want ? { time: tm } : {}), ...(flight ? { flight } : {}), note: `${FLD_JP[ctype]}（承認制）` };
    const nowIso = new Date().toISOString();
    // 同じ「行き／帰り」の受付中の依頼は最新の内容に置き換え、返事待ちの代わりの案は取り下げ扱い
    const ex = await sbGet("bt_reservation_changes", `reservation_id=eq.${encodeURIComponent(resId)}&source=eq.mypage&change_type=in.(${legs.join(",")})&status=in.(requested,proposed)&select=id,status,payload&order=id.desc`);
    for (const e of ex.filter((x: any) => x.status === "proposed")) {
      const epl: any = (e.payload && typeof e.payload === "object") ? e.payload : {};
      await sbPatch("bt_reservation_changes", `id=eq.${e.id}`, { status: "declined_by_guest", decided_at: nowIso, payload: { ...epl, proposal: { ...(epl.proposal || {}), answer: "superseded", answered_at: nowIso } } });
    }
    const req0 = ex.find((x: any) => x.status === "requested");
    const oldV = go ? curGo(r) : curRt(r);
    const row = { change_type: ctype, field_name: go ? "visit_type" : "return_type", old_value: oldV, new_value: newV, payload: pay, changed_at: nowIso };
    if (req0) await sbPatch("bt_reservation_changes", `id=eq.${req0.id}`, row);
    else await sbPost("bt_reservation_changes", { reservation_id: resId, ...row, status: "requested", changed_by: "customer", source: "mypage" });
    const lbl = FLD_JP[ctype];
    await slackPost(`🟡 送迎の変更依頼（承認待ち）[高松] ${r.name || ""} / ${resId} / ${lbl}：${newV}`, [
      { type: "header", text: { type: "plain_text", text: "🟡 送迎の変更依頼（承認待ち）[高松]", emoji: true } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"} 様` }, { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
        { type: "mrkdwn", text: `*ご予約元:*\n${otaJp(r.ota)}` }, { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
      ] },
      { type: "section", text: { type: "mrkdwn", text: `*${lbl}*　${oldV || "（未選択）"} → *${newV}*${flight ? `\n✈️ ご搭乗便：${flight}` : ""}` } },
      { type: "actions", elements: [ { type: "button", text: { type: "plain_text", text: "✅ 承認画面を開く", emoji: true }, style: "primary", url: actUrl(resId) } ] },
      { type: "context", elements: [ { type: "mrkdwn", text: "まだ反映していません。承認＝予約・OPシートへ反映＋お客様へメール／できない時は「代わりの案」。" } ] },
    ]);
    return json({ ok: true, pendingApproval: true, requested: ctype }, 200, origin);
  }

  // ---- set_pickup: 行き＝空港お迎え(PU)を希望 or 店舗へ行く(来店)。visit_type(PU/来店)＋お迎え時間＋OPシート d-タスクへ反映 ----
  // 2026-08-12 omni: ガイド(BUDDICA)と同一の「行き選択」を移植。p.want!==false でお迎え希望（後方互換：want未指定＝お迎え）。
  if (action === "set_pickup") {
    const want = p.want !== false; // 既定 true（後方互換）
    if (want) {
      const tm = String(p.time || "").trim();
      if (!/^\d{1,2}:\d{2}$/.test(tm)) return json({ error: "時間の形式が不正です" }, 400, origin);
      const flight = String(p.flight || "").trim().slice(0, 40);
      // 予約：visit_type=PU / pickup_time / del_time（お迎え時間）/ del_flight（搭乗便名）を更新
      try { await sbPatch("bt_reservations", `id=eq.${encodeURIComponent(resId)}`, { visit_type: "PU", pickup_time: tm, del_time: tm, del_flight: flight, updated_at: new Date().toISOString() }); } catch (_) { /* noop */ }
      // OPシート：お届け(d-)タスクの「内容=PU」「時間」「変更」にも反映（OP表示と一致）
      // 🔴 changed_json(_src=customer/_timeChange/_ssTime)も更新＝_bt_src_guard②(cj未更新の時間/場所変更を旧値に巻き戻す)を正当通過し顧客の送迎時間を確実反映
      try {
        const _dts = await sbGet("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.d-*&deleted=not.is.true&select=_id,changed_json`);
        const _ncj = JSON.stringify({ ...(_dts[0] ? parseCj(_dts[0]) : {}), _src: "customer", _timeChange: tm, _ssTime: tm });
        await sbPatch("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.d-*&deleted=not.is.true`, { [("内容")]: "PU", [("時間")]: tm, [("変更")]: tm, changed_json: _ncj });
      } catch (_) { /* noop */ }
      const puBlocks = [
        { type: "header", text: { type: "plain_text", text: "🚐 空港お迎えを希望（お客様）", emoji: true } },
        { type: "section", fields: [
          { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"} 様` },
          { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
          { type: "mrkdwn", text: `*ご予約元:*\n${otaJp(r.ota)}` },
          { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
          { type: "mrkdwn", text: `*車両クラス:*\n${r.vehicle_class || r.vehicle_name || "-"}` },
          { type: "mrkdwn", text: `*🕐 お迎え希望時間:*\n*${tm} 〜*` },
          { type: "mrkdwn", text: `*✈️ ご搭乗便:*\n${flight || "（未入力）"}` },
        ] },
        { type: "context", elements: [ { type: "mrkdwn", text: "行き＝空港お迎え(PU)。OPシート d-タスクの送迎時間に反映済み。当日の送迎手配にご確認ください。" } ] },
      ];
      await slackPost(`🚐 お迎え希望 [高松] ${r.name || ""} / ${resId} / ${tm}〜${flight ? " / " + flight : ""}`, puBlocks);
      return json({ ok: true, visit_type: "PU", pickup_time: tm, del_flight: flight }, 200, origin);
    } else {
      // 店舗へ行く（来店・送迎なし）
      try { await sbPatch("bt_reservations", `id=eq.${encodeURIComponent(resId)}`, { visit_type: "来店", pickup_time: null, updated_at: new Date().toISOString() }); } catch (_) { /* noop */ }
      try {
        const _dts = await sbGet("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.d-*&deleted=not.is.true&select=_id,changed_json`);
        const _ncj = JSON.stringify({ ...(_dts[0] ? parseCj(_dts[0]) : {}), _src: "customer" });
        await sbPatch("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.d-*&deleted=not.is.true`, { [("内容")]: "来店", changed_json: _ncj });
      } catch (_) { /* noop */ }
      const puBlocks = [
        { type: "header", text: { type: "plain_text", text: "🏬 店舗へ行く（来店・送迎なし）（お客様）", emoji: true } },
        { type: "section", fields: [
          { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"} 様` },
          { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
          { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
        ] },
        { type: "context", elements: [ { type: "mrkdwn", text: "行き＝ご来店(送迎なし)。OPシート d-タスクを来店に反映済み。" } ] },
      ];
      await slackPost(`🏬 来店（送迎なし）[高松] ${r.name || ""} / ${resId}`, puBlocks);
      return json({ ok: true, visit_type: "来店", pickup_time: "" }, 200, origin);
    }
  }

  // ---- set_return: 帰り＝店舗→高松空港の送迎(BD)を希望 or 店舗で返却。return_type(BD/返却)＋送迎時間＋OPシート c-タスクへ反映 ----
  // 2026-08-12 omni: ガイド(BUDDICA)と同一の「帰り選択」を移植。p.want!==false で送迎希望。
  if (action === "set_return") {
    const want = p.want !== false;
    if (want) {
      const tm = String(p.time || "").trim();
      if (!/^\d{1,2}:\d{2}$/.test(tm)) return json({ error: "時間の形式が不正です" }, 400, origin);
      // 予約：return_type=BD / dropoff_time / col_time（送迎時間）を更新
      try { await sbPatch("bt_reservations", `id=eq.${encodeURIComponent(resId)}`, { return_type: "BD", dropoff_time: tm, col_time: tm, updated_at: new Date().toISOString() }); } catch (_) { /* noop */ }
      // OPシート：回収(c-)タスクの「内容=BD」「時間」「変更」「返却」にも反映（OP表示と一致）
      try {
        const _cts = await sbGet("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.c-*&deleted=not.is.true&select=_id,changed_json`);
        const _ncj = JSON.stringify({ ...(_cts[0] ? parseCj(_cts[0]) : {}), _src: "customer", _timeChange: tm, _ssTime: tm });
        await sbPatch("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.c-*&deleted=not.is.true`, { [("内容")]: "BD", [("時間")]: tm, [("変更")]: tm, [("返却")]: tm, changed_json: _ncj });
      } catch (_) { /* noop */ }
      const rtBlocks = [
        { type: "header", text: { type: "plain_text", text: "🚙 返却送迎を希望（店舗→空港）（お客様）", emoji: true } },
        { type: "section", fields: [
          { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"} 様` },
          { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
          { type: "mrkdwn", text: `*ご予約元:*\n${otaJp(r.ota)}` },
          { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
          { type: "mrkdwn", text: `*車両クラス:*\n${r.vehicle_class || r.vehicle_name || "-"}` },
          { type: "mrkdwn", text: `*🕐 送迎希望時間:*\n*${tm} 〜*` },
        ] },
        { type: "context", elements: [ { type: "mrkdwn", text: "帰り＝店舗→高松空港の送迎(BD)。OPシート c-タスクの送迎時間に反映済み。当日の送迎手配にご確認ください。" } ] },
      ];
      await slackPost(`🚙 返却送迎希望 [高松] ${r.name || ""} / ${resId} / ${tm}〜`, rtBlocks);
      return json({ ok: true, return_type: "BD", dropoff_time: tm }, 200, origin);
    } else {
      // 店舗で返却（送迎なし）
      try { await sbPatch("bt_reservations", `id=eq.${encodeURIComponent(resId)}`, { return_type: "返却", dropoff_time: null, updated_at: new Date().toISOString() }); } catch (_) { /* noop */ }
      try {
        const _cts = await sbGet("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.c-*&deleted=not.is.true&select=_id,changed_json`);
        const _ncj = JSON.stringify({ ...(_cts[0] ? parseCj(_cts[0]) : {}), _src: "customer" });
        await sbPatch("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.c-*&deleted=not.is.true`, { [("内容")]: "返却", changed_json: _ncj });
      } catch (_) { /* noop */ }
      const rtBlocks = [
        { type: "header", text: { type: "plain_text", text: "🏬 店舗で返却（送迎なし）（お客様）", emoji: true } },
        { type: "section", fields: [
          { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"} 様` },
          { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
          { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
        ] },
        { type: "context", elements: [ { type: "mrkdwn", text: "帰り＝店舗でご返却(送迎なし)。OPシート c-タスクを返却に反映済み。" } ] },
      ];
      await slackPost(`🏬 店舗で返却（送迎なし）[高松] ${r.name || ""} / ${resId}`, rtBlocks);
      return json({ ok: true, return_type: "返却", dropoff_time: "" }, 200, origin);
    }
  }

  // OPタスク（予約番号一致・墓標除外）＋免許アップ状態
  const opTasksP = sbGet("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&deleted=not.is.true&select=_id,${encodeURIComponent("内容")},${encodeURIComponent("時間")},${encodeURIComponent("送迎場所")},${encodeURIComponent("集客")},${encodeURIComponent("返却")},${encodeURIComponent("送迎")},${encodeURIComponent("確定")},${encodeURIComponent("便名")},${encodeURIComponent("変更")},${encodeURIComponent("約款")},changed_json`);
  const licP = sbGet("license_uploads", `reservation_id=eq.${encodeURIComponent(resId)}&select=cnt,drivers`);
  const signP = sbGet("handover_signatures", `reservation_id=eq.${encodeURIComponent(resId)}&sign_type=eq.terms_agree&select=id`);
  // ★2026-08-13 傷チェック承認署名の正本 handover_signatures(damage_approve)。じゃらんHDMマイページで傷確認→承認署名を追加。
  const dmgSignP = sbGet("handover_signatures", `reservation_id=eq.${encodeURIComponent(resId)}&sign_type=eq.damage_approve&select=signer_name,signed_at&order=signed_at.desc&limit=1`);
  const [opTasksRaw, licRows, signRows, dmgSignRows] = await Promise.all([opTasksP, licP, signP, dmgSignP]);
  const licCnt = (licRows[0] && licRows[0].cnt) || 0;
  const licDrivers = (licRows[0] && licRows[0].drivers) || 0;
  // 約款署名状態：正本 handover_signatures(terms_agree) 優先。無ければ後方互換で bt_tasks「約款」列の「同意」も見る（bt_tasksは再生成でfalseに戻り得るのでhandover_signaturesが正）。
  const termsRaw = (opTasksRaw || []).map((t: any) => String(t["約款"] || "")).find((v: string) => v.indexOf("同意") >= 0) || "";
  const termsSigned = (Array.isArray(signRows) && signRows.length > 0) || !!termsRaw;
  const damageApproved = Array.isArray(dmgSignRows) && dmgSignRows.length > 0;
  const damageApprovedDetail = damageApproved ? `承認(${dmgSignRows[0].signer_name || ""}) ${String(dmgSignRows[0].signed_at || "").slice(5, 16).replace("T", " ")}` : "";

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

  // 2026-11-08 HDM高松：OPシート/タスクサマリー/個別URLと同じ読み方の現在値（DB関数 bt_res_effective）を優先。取れなければ従来の解決式
  const effRaw = isHdm(r) ? await fetch(`${SB_URL}/rest/v1/rpc/bt_res_effective`, { method: "POST", headers: H, body: JSON.stringify({ p_res: resId }) }).then((x) => x.ok ? x.json() : null).catch(() => null) : null;
  const eff: any = (effRaw && typeof effRaw === "object") ? effRaw : {};
  const delPlaceR = String(eff.del_place || "").trim() || resolveTaskPlace(dTask) || String(r.del_place || "").trim();
  const colPlaceR = String(eff.col_place || "").trim() || cColResolve || String(r.col_place || "").trim();
  const lendTimeR = String(eff.lend_time || "").trim() || resolveTaskTime(dTask) || r.start_time || r.del_time || "";
  const returnTimeR = String(eff.return_time || "").trim() || cTimeResolve || r.end_time || r.col_time || "";

  const optBR = Math.max(Number(r.opt_b) || 0, taskOptNum(dTask, "_optB"), taskOptNum(cTask, "_optB"));
  const optCR = Math.max(Number(r.opt_c) || 0, taskOptNum(dTask, "_optC"), taskOptNum(cTask, "_optC"));
  const optJR = Math.max(Number(r.opt_j) || 0, taskOptNum(dTask, "_optJ"), taskOptNum(cTask, "_optJ"));
  const optUSBR = Math.max(Number(r.opt_usb) || 0);
  const insR = String(r.insurance || "").trim() || String(dTask?.insurance || cTask?.insurance || "").trim();

  const st = String(r.status || "");
  const cancelled = st === "cancelled" || st === "キャンセル" || st === "cancel";

  // 車両状態チェック（傷）：出発前日 20:00 以降に解禁（2026-08-13〜。旧=出発日8:00。直前すぎて未確認が多いため前倒し）。URLは bt_fleet→bt_vehicles.plate_no→vehicle_twins(BT)→share_token。
  // ★顧客に見せるURLはBUDDICAドメイン(handymanドメイン/文字列を顧客に出さない=BTブランド規約)。
  const jstIso = new Date(Date.now() + 9 * 3600 * 1000).toISOString();
  const today = jstIso.slice(0, 10);
  const tomorrow = new Date(Date.now() + 9 * 3600 * 1000 + 86400000).toISOString().slice(0, 10);
  const hh = +jstIso.slice(11, 13);
  const damageReady = !cancelled && !!r.start_date && (r.start_date <= today || (r.start_date === tomorrow && hh >= 20));
  let damageUrl: string | null = null;
  if (damageReady) {
    try {
      const fl = await sbGet("bt_fleet", `reservation_id=eq.${encodeURIComponent(resId)}&select=vehicle_code`);
      const code = fl[0]?.vehicle_code;
      if (code) {
        // ★BT: vehicle_twins.id = 車両コード(bt_fleet.vehicle_code) で厳密一致(display_labelはコード番号でplateと不一致のため)
        let tw = await sbGet("vehicle_twins", `id=eq.${encodeURIComponent(code)}&share_enabled=eq.true&select=share_token&limit=1`);
        if (!tw[0]) { // フォールバック: ナンバー(plate)で display_label 照合
          const vs = await sbGet("bt_vehicles", `code=eq.${encodeURIComponent(code)}&select=plate_no`);
          const plate = vs[0]?.plate_no;
          if (plate) tw = await sbGet("vehicle_twins", `display_label=ilike.*${encodeURIComponent(plate)}*&share_enabled=eq.true&select=share_token&limit=1`);
        }
        if (tw[0]?.share_token) damageUrl = `https://buddica-touring.github.io/damage/v.html?t=${tw[0].share_token}&v=v3`;
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

  // キャンセル申請中か（承認待ち＝bt_reservation_changes change_type=cancel status=requested）
  const pcRows = await sbGet("bt_reservation_changes", `reservation_id=eq.${encodeURIComponent(resId)}&change_type=eq.cancel&status=eq.requested&select=id&limit=1`);
  const pendingCancel = !!pcRows[0];
  // 2026-11-08 HDM高松：送迎の依頼（承認待ち・代わりの案・お断り）をマイページに返す（my-tkm.html reqReplyCard / 承認待ち表示）
  const mpRows = isHdm(r) ? await sbGet("bt_reservation_changes", `reservation_id=eq.${encodeURIComponent(resId)}&source=eq.mypage&change_type=in.(${MP_LIST})&order=id.desc&limit=10&select=id,change_type,old_value,new_value,status,payload,changed_at,decided_at`) : [];
  const recentChanges = mpRows.map((x: any) => ({ id: x.id, field: x.change_type, old_value: x.old_value, new_value: x.new_value, status: x.status, payload: x.payload || {}, created_at: x.changed_at || null, decided_at: x.decided_at || null }));
  const pendOf = (legs: string[]) => { const x = mpRows.find((y: any) => legs.includes(y.change_type) && y.status === "requested"); return x ? { type: x.change_type, value: x.new_value, time: (x.payload || {}).time || "", flight: (x.payload || {}).flight || "" } : null; };
  const pendingTransfer = { go: pendOf(MP_GO), rt: pendOf(MP_RT) };

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
      pickup_time: r.pickup_time || "", dropoff_time: r.dropoff_time || "",
    },
    damage: { ready: damageReady, url: damageUrl, approved: damageApproved, approved_detail: damageApprovedDetail },
    tracking: { active: false, kd_status: null, token: null },
    license: { cnt: licCnt, drivers: licDrivers },
    terms: { required: true, signed: termsSigned, detail: termsRaw },
    // ★2026-08-09 事前決済：マイページ内に請求欄＋Squareリンク（じゃらんHDMは事前決済）。入金は checkBtPayments が自動確認→paid反映。
    payment: { required: !!r.pay_url, amount: Number(r.price || 0), pay_url: r.pay_url || "", paid: !!r.paid },
    pendingCancel: pendingCancel, readyPending: false, pendingTransfer,
    recentChanges, history: historyTop,
    at: nowJst(),
  }, 200, origin);
});
