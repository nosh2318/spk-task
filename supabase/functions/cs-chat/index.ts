// 2026-10-23 新API鍵移行：新形式の鍵を優先し、無ければ旧鍵（移行期間の保険・旧鍵の無効化前に外す）
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
console.log("[keymig]", __newKey("SUPABASE_SECRET_KEYS", "edge") ? "secret" : "legacy");
// CS チャット（マイページ⇄CS部 直接コミュニケーション）
// お客様: cust_open / cust_send / cust_poll（mypage_token で本人認証＝予約に自動紐付け）
// スタッフ: staff_list / staff_thread / staff_send（本体ログインJWTで認証）
// ★2026-11-08 高松(tkm)対応：予約は高松のDB(ggqugvyskyiblxiycpci)にあるため handyman-mypage-tkm の lookup(ro:1) で本人確認。
//   高松は cs_autoreply.py の対象外なので、お客様の送信を Slack に即通知する（nha/spk は従来どおり）。
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
// ★security 2026-10-23 スタッフ許可リスト：「ログインしていれば誰でも」→ 正規スタッフのメールドメインだけ通す。
//   main(ckrxttbnawkclshczsia) の auth.users ドメイン＝spk.hdm/nha.hdm/g-lines.jp/partner.hdm（2026-10-23確認）。協力会社 partner.hdm は不可。新規登録は無効(disable_signup=true)のためドメインで判定できる。EF は個別デプロイなので各 EF に同じ小関数をコピー。
const STAFF_EMAIL_RE = /@(spk\.hdm|nha\.hdm|g-lines\.jp)$/i;
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
const SLACK_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";
const CH = { spk: "C0B66BVCSPM", nha: "C0B66BVCSPM", tkm: Deno.env.get("NUDGE_CH_TKM") || "C0B66BVCSPM" } as Record<string, string>; // 2026-09-06 CSチャット通知はC0B66BVCSPM一本に統一（旧: spk=#sapporo_user_action / nha=#okinawa_operations-team を廃止）
const RESV = { spk: "reservations", nha: "nha_reservations" } as Record<string, string>;
const TKM_FN = "https://ggqugvyskyiblxiycpci.supabase.co/functions/v1/handyman-mypage-tkm";
const ADMIN_URL = "https://nosh2318.github.io/spk-task/cs-chat-admin.html";
// ★2026-11-09 nosh「チャットならちゃんと実装して」：スタッフの返信（管理画面・Slack #omni の OK どちらでも）を
//   お客様に「お返事が届きました」と知らせる。DBトリガー cs_chat_notify_reply → このEFの notify_reply を呼ぶ。
//   那覇・札幌＝line-push（LINE→なければメール→楽天は楽天画面）。高松＝LINEなし→メール（楽天は楽天画面）。返信の中身は載せず、マイページへ誘導。
const AUTO_ACK = "ご連絡ありがとうございます！AI・HANDYMANが対応させていただきますので暫しお待ちください！";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const FUNC_SECRET = Deno.env.get("FUNC_SECRET") || "";
const RESEND_KEY = Deno.env.get("HDM_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY") || "";
const BT_URL = Deno.env.get("BT_URL") || "", BT_KEY = Deno.env.get("BT_SERVICE_KEY") || "";
const MY_URL: Record<string, string> = { spk: "https://nosh2318.github.io/spk-task/my.html?t=", nha: "https://nosh2318.github.io/naha-project/my-nha.html?t=", tkm: "https://nosh2318.github.io/spk-task/my-tkm.html?t=" };
const REPLY_GAP_MIN = 10; // 続けて返信したときは10分に1回だけ知らせる
const MAIL_OK = (m: string) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(m) && !/@(.*\.)?(rakuten\.co\.jp|rakuten\.com)$/i.test(m);
async function btGet(path: string): Promise<any[]> {
  if (!BT_URL || !BT_KEY) return [];
  const r = await fetch(`${BT_URL}/rest/v1/${path}`, { headers: { apikey: BT_KEY, Authorization: `Bearer ${BT_KEY}` } });
  return r.ok ? await r.json().catch(() => []) : [];
}
async function notifyReply(messageId: string): Promise<string> {
  const m = (await sbGet("cs_chat_messages", `id=eq.${encodeURIComponent(messageId)}&select=id,thread_id,sender,body,created_at&limit=1`))[0];
  if (!m || m.sender !== "staff" || String(m.body || "") === AUTO_ACK) return "skip:not_reply";
  const th = (await sbGet("cs_chat_threads", `id=eq.${m.thread_id}&select=id,store,reservation_id&limit=1`))[0];
  if (!th || !th.reservation_id) return "skip:no_resv";
  // 直前10分以内に別の返信で知らせていれば、もう送らない（続けて何通か返したとき1通にまとめる）
  const since = new Date(new Date(m.created_at).getTime() - REPLY_GAP_MIN * 60000).toISOString();
  const prev = await sbGet("cs_chat_messages", `thread_id=eq.${m.thread_id}&sender=eq.staff&id=lt.${m.id}&created_at=gte.${encodeURIComponent(since)}&select=body`);
  if (prev.some((x: any) => String(x.body || "") !== AUTO_ACK)) return "skip:recent";
  const store = st(String(th.store || "")), rid = String(th.reservation_id);
  const head = "スタッフからお返事が届きました。\nマイページの「スタッフに聞く」でご確認ください。";
  if (store === "spk" || store === "nha") {
    const r = (await sbGet(RESV[store], `id=eq.${encodeURIComponent(rid)}&select=mypage_token&limit=1`))[0];
    const url = r && r.mypage_token ? MY_URL[store] + r.mypage_token + "&via=line" : "";
    const x = await fetch(`${SB_URL}/functions/v1/line-push`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: FUNC_SECRET, store, resv_no: rid, action: "mypage_chat_reply", message: head + (url ? "\n" + url : "") }) });
    const j: any = await x.json().catch(() => null);
    return "line-push:" + (j ? (j.channel || (j.ok ? "line" : (j.reason || "ng"))) : "http" + x.status);
  }
  // 高松（BTのDB）
  const b = (await btGet(`bt_reservations?id=eq.${encodeURIComponent(rid)}&select=id,mail,ota,status,mypage_token&limit=1`))[0];
  if (!b) return "skip:tkm_not_found";
  if (/cancel|キャンセル/i.test(String(b.status || ""))) return "skip:cancelled";
  const subject = "【HANDYMAN】スタッフからお返事が届きました";
  const url = b.mypage_token ? MY_URL.tkm + b.mypage_token + "&via=mail" : "";
  const body = head + "\n\n――――――――\n" + (url ? "マイページ\n" + url + "\n\n" : "") + "HANDYMAN 高松空港店\n※このメールは送信専用です。ご質問はマイページの「聞く」からどうぞ。";
  const to = String(b.mail || "").trim().toLowerCase();
  if (MAIL_OK(to)) {
    if (!RESEND_KEY) return "ng:no_resend_key";
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: "HANDYMAN 高松空港店 <reserve@rent-handyman.com>", to: [to], reply_to: "reserve@rent-handyman.com", subject, text: body }) });
    const ok = r.ok; const err = ok ? null : (await r.text()).slice(0, 300);
    await sbInsert("hdm_notifications", { store: "tkm", resv_no: rid, action: "mypage_chat_reply", to_email: to, subject, body, is_test: false, sent: ok, sent_at: ok ? new Date().toISOString() : null, error: err });
    return ok ? "mail" : "ng:resend";
  }
  if (String(b.ota || "") === "楽天") {
    await sbInsert("rax_outbox", { store: "tkm", resv_no: rid, kind: "mypage_chat_reply", subject, body: body.replace("&via=mail", "&via=rakuten") });
    return "rakuten";
  }
  return "skip:no_contact";
}

function cors(o: string | null) {
  return { "Access-Control-Allow-Origin": o || "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, authorization" };
}
function json(b: unknown, s: number, o: string | null) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors(o), "content-type": "application/json" } });
}
async function sbGet(table: string, query: string): Promise<any[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) return [];
  return await r.json().catch(() => []);
}
async function sbInsert(table: string, body: unknown): Promise<any | null> {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(body) });
  if (!r.ok) { console.error(`INSERT ${table}:`, await r.text()); return null; }
  const d = await r.json().catch(() => []);
  return Array.isArray(d) ? d[0] : d;
}
async function sbPatch(table: string, query: string, body: unknown): Promise<void> {
  await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { method: "PATCH", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" }, body: JSON.stringify(body) });
}
async function sbRpc(fn: string, body: unknown): Promise<any> {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.ok ? await r.json().catch(() => null) : null;
}
async function slack(channel: string, text: string, blocks?: unknown) {
  if (!SLACK_TOKEN || !channel) return;
  try { await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${SLACK_TOKEN}`, "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel, text, blocks }) }); }
  catch (e) { console.error("slack", String(e)); }
}
async function verifyStaff(token: string): Promise<boolean> {
  return !!(await staffUser(token)); // ★security 2026-10-23 許可リスト判定（旧: /auth/v1/user が通れば誰でも）
}
const S = (v: unknown) => String(v ?? "").trim().slice(0, 4000);
const st = (s: string) => (s === "nha" ? "nha" : s === "tkm" ? "tkm" : "spk");

// mypage_token → 予約(id,name) を解決
async function resolveResv(store: string, token: string): Promise<any | null> {
  if (!token) return null;
  if (store === "tkm") {
    if (token.length < 16) return null;
    try {
      const x = await fetch(TKM_FN, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "lookup", token, ro: 1 }) });
      const j: any = await x.json().catch(() => null);
      const r = j && j.reservation; return r && r.id ? r : null;
    } catch { return null; }
  }
  const tbl = RESV[store]; if (!tbl) return null;
  const rows = await sbGet(tbl, `mypage_token=eq.${encodeURIComponent(token)}&select=*&limit=1`);
  return rows[0] || null;
}
// 予約に対応するスレッドを取得（create=true の時だけ無ければ作成）。開いただけで空スレッドを作らない
async function getThread(store: string, resv: any, create = false): Promise<any | null> {
  const ex = await sbGet("cs_chat_threads", `store=eq.${store}&reservation_id=eq.${encodeURIComponent(resv.id)}&limit=1`);
  if (ex[0]) return ex[0];
  if (!create) return null;
  const row = await sbInsert("cs_chat_threads", { store, reservation_id: resv.id, source: "mypage", cust_name: resv.name || "", status: "open", unread_staff: 0, unread_cust: 0 });
  return row;
}
// 2026-10-23 cs-chat バケット非公開化：保存済みURL(公開形式)から署名付きURL(1時間)を発行して返す
async function signImg(u: string | null): Promise<string | null> {
  if (!u) return u;
  const k = "/storage/v1/object/public/cs-chat/";
  const i = u.indexOf(k); if (i < 0) return u;
  const path = u.slice(i + k.length);
  try {
    const r = await fetch(`${SB_URL}/storage/v1/object/sign/cs-chat/${path}`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 3600 }) });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    return d && d.signedURL ? `${SB_URL}/storage/v1${d.signedURL}` : null;
  } catch { return null; }
}
async function msgs(threadId: string): Promise<any[]> {
  const rows = await sbGet("cs_chat_messages", `thread_id=eq.${threadId}&order=id.asc&select=id,sender,body,image_url,created_at`);
  for (const x of rows) if (x.image_url) x.image_url = await signImg(x.image_url);
  return rows;
}
// 画像(dataURL)を cs-chat バケットにアップロード→公開URLを返す（失敗時null）
async function uploadImage(threadId: string, dataUrl: string): Promise<string | null> {
  try {
    const m = /^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/i.exec(dataUrl || "");
    if (!m) return null;
    const ext = m[2].toLowerCase() === "jpeg" ? "jpg" : m[2].toLowerCase();
    const bin = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0));
    if (bin.length > 6_000_000) return null; // 6MB上限
    const path = `${threadId}/${Date.now()}.${ext}`;
    const r = await fetch(`${SB_URL}/storage/v1/object/cs-chat/${path}`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": m[1], "x-upsert": "true" },
      body: bin,
    });
    if (!r.ok) { console.error("upload", await r.text()); return null; }
    return `${SB_URL}/storage/v1/object/public/cs-chat/${path}`;
  } catch (e) { console.error("uploadImage", String(e)); return null; }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  let p: any = {};
  try { p = await req.json(); } catch { return json({ error: "invalid json" }, 400, origin); }
  const action = String(p.action || "");
  const store = st(S(p.store));

  // ── スタッフ返信のお知らせ（DBトリガーから。x-cron-secret 必須） ──
  if (action === "notify_reply") {
    if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ ok: false, error: "forbidden" }, 403, origin);
    let res = "";
    try { res = await notifyReply(S(p.message_id)); } catch (e) { res = "error:" + String(e).slice(0, 200); }
    console.log("[notify_reply]", S(p.message_id), res);
    return json({ ok: true, result: res }, 200, origin);
  }

  // ── お客様: スレッドを開く（予約に自動紐付け） ──
  if (action === "cust_open" || action === "cust_poll") {
    const resv = await resolveResv(store, S(p.mypage_token));
    if (!resv) return json({ ok: false, error: "予約が見つかりません" }, 200, origin);
    const th = await getThread(store, resv); // create=false：開いただけで空スレッドを作らない
    if (!th) return json({ ok: true, thread_id: null, cust_name: resv.name || "", messages: [] }, 200, origin); // まだ会話なし
    await sbPatch("cs_chat_threads", `id=eq.${th.id}`, { unread_cust: 0 }); // お客様は既読
    return json({ ok: true, thread_id: th.id, cust_name: resv.name || "", staff_seen_at: th.staff_seen_at || null, messages: await msgs(th.id) }, 200, origin);
  }

  // ── お客様: メッセージ送信（画像可） ──
  if (action === "cust_send") {
    const body = S(p.body); const hasImg = typeof p.image === "string" && p.image.startsWith("data:image/");
    if (!body && !hasImg) return json({ ok: false, error: "メッセージを入力してください" }, 400, origin);
    const resv = await resolveResv(store, S(p.mypage_token));
    if (!resv) return json({ ok: false, error: "予約が見つかりません" }, 200, origin);
    const th = await getThread(store, resv, true); // 送信時のみスレッド作成
    if (!th) return json({ ok: false, error: "送信に失敗" }, 500, origin);
    const imgUrl = hasImg ? await uploadImage(th.id, p.image) : null;
    if (hasImg && !imgUrl) return json({ ok: false, error: "画像の送信に失敗しました" }, 200, origin);
    await sbInsert("cs_chat_messages", { thread_id: th.id, sender: "customer", body, image_url: imgUrl });
    const last = body ? body.slice(0, 120) : "📷 画像";
    await sbPatch("cs_chat_threads", `id=eq.${th.id}`, { unread_staff: (th.unread_staff || 0) + 1, unread_cust: 0, status: "open", work_status: "未対応", last_msg: last, last_msg_at: new Date().toISOString() });
    // ★初動＝スレッド最初のメッセージなら全店共通の定型文を自動返信（対応状況は「未対応」のまま＝スタッフの対応を促す）
    if ((await msgs(th.id)).length === 1) {
      await sbInsert("cs_chat_messages", { thread_id: th.id, sender: "staff", body: AUTO_ACK, image_url: null });
    }
    // ★2026-09-06 EFの「CSチャット新着」即時通知は撤去（AI回答案の投稿が通知を兼ねるため重複）。通知はcs_autoreply.pyの回答案のみ。
    // ★2026-11-08 高松は cs_autoreply.py の対象外 → ここで即通知
    // ★2026-11-09 高松も Slack #omni のAI回答案（cs_autoreply.py）に乗せる。高松の予約はBTのDBなので、回答案に使う予約内容をスレッドに写しておく。
    if (store === "tkm") await sbPatch("cs_chat_threads", `id=eq.${th.id}`, { resv_snapshot: { id: resv.id, name: resv.name, ota: resv.ota, vehicle: resv.vehicle, lend_date: resv.lend_date, lend_time: resv.lend_time, return_date: resv.return_date, return_time: resv.return_time, del_place: resv.del_place, col_place: resv.col_place, visit_type: resv.visit_type, return_type: resv.return_type, pickup_time: resv.pickup_time, dropoff_time: resv.dropoff_time, del_flight: resv.del_flight, insurance: resv.insurance, opt_b: resv.opt_b, opt_c: resv.opt_c, opt_j: resv.opt_j, opt_usb: resv.opt_usb, people: resv.people } });
    return json({ ok: true, thread_id: th.id, messages: await msgs(th.id) }, 200, origin);
  }

  // ── スタッフ: 未対応スレッド一覧 ──
  if (action === "staff_list") {
    if (!await verifyStaff(S(p.staff_token))) return json({ ok: false, error: "認証が必要です" }, 401, origin);
    const scope = store; const onlyUnread = p.only_unread !== false;
    const box = S(p.box) || "active";
    const cols = "id,store,reservation_id,cust_name,unread_staff,last_msg,last_msg_at,status,work_status";
    // ★2026-09-06 完了BOX: 完了チャットは消さず別管理で見返せる（また連絡が来たら顧客送信で自動再オープン）
    if (box === "done") {
      const q = `store=eq.${scope}&work_status=eq.${encodeURIComponent("完了")}&order=last_msg_at.desc&select=${cols}&limit=300`;
      const list = await sbGet("cs_chat_threads", q);
      return json({ ok: true, threads: list, box: "done" }, 200, origin);
    }
    let q = `store=eq.${scope}&status=eq.open&order=last_msg_at.desc&select=${cols}&limit=200`;
    let list = await sbGet("cs_chat_threads", q);
    if (onlyUnread) list = list.filter((t: any) => t.work_status === "未対応" || t.work_status === "対応中");
    return json({ ok: true, threads: list, box: "active" }, 200, origin);
  }

  // ── スタッフ: スレッド取得（既読化＋予約詳細） ──
  if (action === "staff_thread") {
    if (!await verifyStaff(S(p.staff_token))) return json({ ok: false, error: "認証が必要です" }, 401, origin);
    const tid = S(p.thread_id); if (!tid) return json({ ok: false, error: "thread_id" }, 400, origin);
    const th = (await sbGet("cs_chat_threads", `id=eq.${tid}&limit=1`))[0];
    if (!th) return json({ ok: false, error: "スレッドが見つかりません" }, 200, origin);
    // ★開いただけでは「対応済」にしない（未対応のまま）。対応済はチェックボックス(staff_mark)のみ。
    // ★2026-11-08 お客様の画面に「スタッフが確認しました（時刻）」を出すため、開いた時刻を残す
    await sbPatch("cs_chat_threads", `id=eq.${tid}`, { staff_seen_at: new Date().toISOString() });
    let resv: any = null;
    if (th.reservation_id && RESV[th.store]) { const rows = await sbGet(RESV[th.store], `id=eq.${encodeURIComponent(th.reservation_id)}&select=*&limit=1`); resv = rows[0] || null; }
    // ★2026-11-09 高松は予約がBTのDB → 管理画面に予約内容（日付・車・送迎）を出す
    if (th.reservation_id && th.store === "tkm") { const b = (await btGet(`bt_reservations?id=eq.${encodeURIComponent(th.reservation_id)}&select=id,name,ota,vehicle_class,start_date,end_date,start_time,end_time,visit_type,return_type,pickup_time,dropoff_time,del_flight&limit=1`))[0]; if (b) resv = { ...b, lend_date: b.start_date, return_date: b.end_date, del_place: b.visit_type === "PU" ? "空港送迎（行き）" + (b.pickup_time ? " " + b.pickup_time : "") : "来店", col_place: b.return_type === "BD" ? "空港送迎（帰り）" + (b.dropoff_time ? " " + b.dropoff_time : "") : "来店" }; }
    return json({ ok: true, thread: th, reservation: resv, messages: await msgs(tid) }, 200, origin);
  }

  // ── スタッフ: 返信送信 ──
  if (action === "staff_send") {
    if (!await verifyStaff(S(p.staff_token))) return json({ ok: false, error: "認証が必要です" }, 401, origin);
    const tid = S(p.thread_id); const body = S(p.body);
    const hasImg = typeof p.image === "string" && p.image.startsWith("data:image/");
    if (!tid || (!body && !hasImg)) return json({ ok: false, error: "内容が空です" }, 400, origin);
    const th = (await sbGet("cs_chat_threads", `id=eq.${tid}&limit=1`))[0];
    if (!th) return json({ ok: false, error: "スレッドが見つかりません" }, 200, origin);
    const imgUrl = hasImg ? await uploadImage(tid, p.image) : null;
    if (hasImg && !imgUrl) return json({ ok: false, error: "画像の送信に失敗しました" }, 200, origin);
    await sbInsert("cs_chat_messages", { thread_id: tid, sender: "staff", body, image_url: imgUrl });
    // ★2026-11-09 nosh「管理画面を直せ」：返信したら「未対応」→「対応中」（Slack #omni の OK と同じ）。返信済みが赤い未対応に残らないように。完了はボタンのみ。
    await sbPatch("cs_chat_threads", `id=eq.${tid}`, { unread_cust: (th.unread_cust || 0) + 1, last_msg: body ? body.slice(0, 120) : "📷 画像", last_msg_at: new Date().toISOString(), ...(th.work_status === "完了" ? {} : { work_status: "対応中" }) });
    return json({ ok: true, messages: await msgs(tid) }, 200, origin);
  }

  // ── スタッフ: 対応ステータス設定（4状態: 未対応/対応中/対応済み/完了）──
  //   未対応・対応中＝アラート対象。完了＝スレッドをクローズ(一覧から外れる)。
  if (action === "staff_mark") {
    if (!await verifyStaff(S(p.staff_token))) return json({ ok: false, error: "認証が必要です" }, 401, origin);
    const tid = S(p.thread_id); if (!tid) return json({ ok: false, error: "thread_id" }, 400, origin);
    const VALID = ["未対応", "対応中", "完了"];
    let ws = S(p.work_status);
    if (!ws) ws = (p.handled !== false) ? "完了" : "未対応"; // 旧checkbox互換
    if (!VALID.includes(ws)) return json({ ok: false, error: "不正なステータス" }, 400, origin);
    const patch: any = { work_status: ws, unread_staff: ws === "未対応" ? 1 : 0, status: ws === "完了" ? "closed" : "open" };
    await sbPatch("cs_chat_threads", `id=eq.${tid}`, patch);
    return json({ ok: true, work_status: ws }, 200, origin);
  }

  // ── スタッフ: クローズ（=完了）──
  if (action === "staff_close") {
    if (!await verifyStaff(S(p.staff_token))) return json({ ok: false, error: "認証が必要です" }, 401, origin);
    const tid = S(p.thread_id); if (!tid) return json({ ok: false, error: "thread_id" }, 400, origin);
    await sbPatch("cs_chat_threads", `id=eq.${tid}`, { status: "closed", work_status: "完了", unread_staff: 0 });
    return json({ ok: true }, 200, origin);
  }

  return json({ error: "unknown action" }, 400, origin);
});
