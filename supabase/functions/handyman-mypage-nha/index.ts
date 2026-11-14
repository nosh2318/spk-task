// ===== ★2026-11-14 nosh「通知スタイル統一・全通知に管理画面ダイレクトリンク」：送る直前に4行の形へそろえる（hdmMsg を通らない通知用・全送り元で同じ規則） =====
//   既に【店｜種類】で始まる文はそのまま。スレッド返信（その場の返事）には使わない。文の中身は捨てず、4行に詰め直すだけ
const HDMN_BK: [RegExp, string, string][] = [[/KEYDROP\s*札幌/, "key_spk", "KEYDROP札幌"], [/KEYDROP\s*那覇/, "key_nha", "KEYDROP那覇"], [/BUDDICA/, "but_tkm", "BUDDICA高松"], [/札幌|SPK/i, "hdm_spk", "札幌"], [/那覇|沖縄|NHA/i, "hdm_nha", "那覇"], [/高松|BT\b|TKM/i, "hdm_tkm", "高松"]];
function hdmnCat(t: string): string {
  const R: [RegExp, string][] = [
    [/(取込|取り込|GAS|Gmail).*(停止|止ま)|heartbeat|ハートビート|取得失敗|読めません|パース/i, "システム／予約取込"], [/停止中|止まって|起動できて|心拍|代わりに動き/, "システム／ボット・サーバー"], [/値段|料金.*(上げ|下げ)|値上げ|値下げ/, "依頼に返事／価格の承認"], [/HP .*(登録|変更|キャンセル)|admin|管理画面/i, "配車・取込／在庫・OTA"], [/免許/, "準備が足りない／免許証"], [/傷チェック|傷/, "準備が足りない／傷チェック"],
    [/取込漏れ|取り込み漏れ|補填|取込失敗|取り込み失敗|取り込めません|取込めません/, "配車・取込／取込漏れ"], [/新規予約|自動取込|予約登録|再配車|取込|取り込/, "配車・取込／配車"],
    [/相談/, "依頼に返事／担当からの相談"], [/チャット/, "お客様の知らせ／チャット"], [/代車/, "依頼に返事／代車"], [/早め回収/, "依頼に返事／早め回収"],
    [/返金/, "お金／返金"], [/決済リンク|リンク停止|リンクを止め/, "お金／決済リンク"], [/消し込み|会計|クーポン|不整合|ずれ|二重/, "お金／会計のずれ"], [/未入金|未払|未決済|領収書|レシート|立替/, "お金／未払い・入金"],
    [/着きました|遅れ|到着|合流|受け取り完了|お客様から「/, "お客様の知らせ／着きました・遅れます"], [/問い合わせ|お問合せ|未返信/, "お客様の知らせ／問い合わせ"],
    [/押されていません|押し忘れ|時刻を過ぎ/, "タスクの遅れ／ボタンの押し忘れ"], [/送迎の通知|お知らせ.*届いて/, "タスクの遅れ／送迎のお知らせ"], [/未確認|タスク.*確認/, "タスクの遅れ／今日のタスク未確認"],
    [/返事がまだ|引き受け|スキップ|タスク完了|打刻|出勤|退勤/, "タスクの遅れ／担当の返事"],
    [/登録できません|反映できません|反映に失敗|情報のずれ|不一致/, "配車・取込／情報のずれ"],
    [/キャンセル(処理|削除|を反映|反映|対象)|キャンセル.*(取込|取り込)/, "配車・取込／配車"], [/キャンセル/, "依頼に返事／キャンセル"], [/シート|補償|オプション/, "依頼に返事／オプション・補償"],
    [/送迎|来店|店舗で返却|受け取り方|お迎え/, "依頼に返事／受け取り方・送迎"], [/時間|場所|お届け先|回収先|日程|変更|承認|却下|差し戻|別の案|代わりの案/, "依頼に返事／時間・場所"],
    [/価格/, "依頼に返事／価格の承認"], [/入庫|車両登録|協力会社/, "依頼に返事／車の入庫・登録"],
    [/入金|決済|支払|Square/i, "お金／未払い・入金"], [/在庫|OTA|売り止め|管理画面|admin/i, "配車・取込／在庫・OTA"], [/配車|空車|エリア|満席|定員|バス/, "配車・取込／配車"],
    [/オイル|整備|車検|点検|メンテ/, "配車・取込／車の手入れ"], [/個人情報|免許証データ/, "配車・取込／個人情報"],
    [/テスト|test/i, "システム／テスト"], [/メール送信|自動返信|リマインダ|案内メール|送信完了|送れません|送信途中/, "システム／自動送信"], [/重複|クリーンアップ|整合|整理|パトロール/, "システム／情報整理"],
    [/取込|GAS|Gmail/i, "システム／予約取込"], [/お客様/, "お客様の知らせ／チャット"],
  ];
  for (const [re, c] of R) if (re.test(t)) return (/確認しました|完了|承認して反映|反映しました|承認しました|見送りました|確定しました|送りました|返金しました|登録しました|取込しました|取り込みました|削除済み|処理済み/.test(String(t || "")) && !/^\s*(⚠️|🔴|🚨|❌|🟡)|要(対応|返金|確認)|早め回収|返却準備完了|未完了|完了してい|失敗|できません|できない|未入金|未決済|未払|未配車|未登録|漏れ|障害|止ま|ください|まだ|戻っていません|スキップ|不一致|ずれ|期限切れ/u.test(String(t || "")) && !/^システム/.test(c) ? "済んだこと／記録" : c); // ★2026-11-14 済んだことは行動要の種類にしない
  return "システム／ボット・サーバー";
}
// text＝今の本文 ／ d＝送り元の既定（店名・リンク先）
function hdmNorm(text: string, d: { store?: string; url?: string } = {}): string {
  const src = String(text || "").trim(); if (!src) return src;
  if (/^【[^】\n]*｜[^】\n]*】/.test(src)) return src;
  if (/^[^\n]{0,6}(日報|号機)/.test(src)) return src; // 日報・号機の会話は形を変えない
  const ls = src.split("\n").map((x) => x.trim()).filter(Boolean);
  let first = ls.shift() || "";
  first = first.replace(/^[*_~`]+|[*_~`]+$/g, "").replace(/^[^\p{L}\p{N}【\[(（「]+/u, "").trim();
  let store = d.store || "", title = first;
  const mb = first.match(/^(.*?)【([^】]+)】\s*(.*)$/);
  if (mb) { store = mb[2].trim() || store; title = (mb[1].replace(/^[^\p{L}\p{N}]+/u, "") + " " + mb[3]).trim(); }
  title = title.replace(/^[*_]+|[*_]+$/g, "").trim() || "お知らせ";
  const bk = HDMN_BK.find(([re]) => re.test(store)) || HDMN_BK.find(([re]) => re.test(d.store || ""));
  const storeJp = store || (bk ? bk[2] : "本部");
  let rid = "", url = ""; const meta: string[] = [], det: string[] = [];
  for (const l0 of ls) {
    let l = l0.replace(/^[*_]+|[*_]+$/g, "");
    const u = l.match(/<(https?:\/\/[^|>\s]+)(\|[^>]*)?>|(https?:\/\/[!-~]+?)(?=[\s)>|]|$|[^!-~])/); const adm = u && /nosh2318\.github\.io|buddica-touring\.github\.io|daisha-admin|handyman-inquiry|console\.cloud\.google|supabase\.com\/dashboard|script\.google\.com/.test(u[1] || u[3] || ""); if (u && adm && !url) url = u[1] || u[3];
    if (/^🔗/.test(l) || (/^(管理|APP|URL|リンク)/.test(l) && adm)) continue;
    const r = l.match(/^予約(番号)?\s*[:：]?\s*([A-Za-z0-9][A-Za-z0-9_-]{3,})/); if (r && !rid) rid = r[2];
    if (/^(予約(番号)?\s*[:：]?\s*[A-Za-z0-9_-]{4,}\s*)?[｜|]?\s*(📅|🚗|👤|👷)/.test(l) || /^予約\s+[A-Za-z0-9_-]{4,}｜/.test(l)) {
      for (const p of l.split(/[｜|]/)) { const q = p.trim(); if (!q || /^予約(番号)?\s*[:：]?\s*[A-Za-z0-9_-]+$/.test(q) || /車両未割当|名前なし/.test(q)) continue; meta.push(q.replace(/^👷\s*担当\s*/, "👷 ")); }
      continue;
    }
    l = l.replace(/<(https?:\/\/[^|>]+)\|([^>]*)>/g, "$2"); if (adm) l = l.replace(/https?:\/\/[!-~]+/g, ""); l = l.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "").replace(/(?<!\d)0\d{1,4}-\d{1,4}-\d{3,4}(?!\d)|(?<!\d)0[789]0\d{8}(?!\d)/g, "");
    if (rid) l = l.split(rid).join("");
    l = l.replace(/予約(番号)?\s*[:：]?\s*(?=[｜|／\s]|$)/g, "").replace(/^[•・｜|\-\s]+/, "").replace(/[ 　]{2,}/g, " ").trim();
    if (l && !/^[-─━=]+$/.test(l)) det.push(l);
  }
  if (!meta.some((x) => /^👷/.test(x))) meta.push("👷 本部");
  const b = bk ? bk[1] : "";
  if (!url) url = rid && b ? `https://nosh2318.github.io/spk-task/mypage-active.html?tab=${/^依頼に返事/.test(hdmnCat(title)) ? "action" : "list"}&bucket=${b}&rid=${encodeURIComponent(rid)}` : (d.url || "https://nosh2318.github.io/spk-task/hq.html");
  const c0 = hdmnCat(title), cat = c0 === "システム／ボット・サーバー" ? hdmnCat(title + " " + det.join(" ")) : c0;
  return [`【${storeJp}｜${cat}】${title}`, (det.join("／").slice(0, 700) || "—"), meta.join("｜"), `🔗 ${url}`].join("\n").slice(0, 2900);
}
// ===== ここまで送る直前の形 =====
// 送る直前に通す（chat.postMessage だけ・スレッド返信は形を変えない）
// ★2026-11-14 nosh⑤「やることは店ごとのオペレーションの部屋・システムは開発の部屋・1件は1つの部屋だけ」：店と種類で送り先を選び直す
//   動かすのは下の「動かす部屋」宛ての新規投稿だけ（#在庫調整・領収書・日報・SNS・号機・スレッド返信は今のまま）。新しい部屋へ送れなければ元の部屋へ送る
const HDMR_H = ["C0AQL6HGG3E", "C0AP2S5B147", "C08TDTPEB36", "C06KZ56NTDF", "C0BER0YC6AK", "C07B5G3PV7C", "C06L91W6T08", "C0AS5K1JZNJ", "C0B66BVCSPM"];
const HDMR_B = ["C0BFDJ1HRC3", "C0BFKEL4D1Q", "C0BFMBLEJGZ", "C0BFD773PJP", "C0BFD7U097V"];
const HDMR_MOVE = new Set([...HDMR_H, ...HDMR_B]);
const HDMR_SYSONLY_KEEP = new Set(["C0B66BVCSPM"]); // 号機の部屋：システムの知らせは置いたまま、お客様・店の知らせだけ店の部屋へ
const hdmrEnv = (k: string) => { try { return Deno.env.get(k) || ""; } catch (_e) { return ""; } };
const HDMR_IS_BT = /ggqugvyskyiblxiycpci/.test(hdmrEnv("SUPABASE_URL"));
const HDMR_TOK_B = [hdmrEnv("BT_SLACK_TOKEN"), hdmrEnv("BT_SLACK_BOT_TOKEN"), HDMR_IS_BT ? hdmrEnv("SLACK_BOT_TOKEN") : ""].filter(Boolean);
const HDMR_TOK_H = [HDMR_IS_BT ? "" : hdmrEnv("SLACK_BOT_TOKEN"), hdmrEnv("INQUIRY_SLACK_TOKEN"), hdmrEnv("GOGO_SLACK_TOKEN")].filter(Boolean);
const HDMR_SENT = new Map<string, { ch: string; auth: string }>(); // 付け替えた投稿の ts → 送った部屋（同じ処理の中のスレッド返信・更新を同じ部屋へ）
function hdmrPick(text: string, ch: string): { ws: string; ch: string } | null {
  const m = String(text || "").match(/^【([^｜】\n]+)｜([^／】\n]+)/); if (!m || !HDMR_MOVE.has(ch)) return null;
  const store = m[1], sys = /^システム/.test(m[2]);
  if (sys && HDMR_SYSONLY_KEEP.has(ch)) return null;
  const tkm = /高松|BUDDICA/.test(store);
  if (sys) return tkm ? { ws: "B", ch: "C0BFD7U097V" } : { ws: "H", ch: "C07B5G3PV7C" };
  if (tkm) return { ws: "B", ch: "C0BFMBLEJGZ" };
  if (/那覇|沖縄/.test(store)) return { ws: "H", ch: "C06L91W6T08" };
  if (/札幌/.test(store)) return { ws: "H", ch: "C0AS5K1JZNJ" };
  if (/KEYDROP/i.test(store)) return ch === "C06KZ56NTDF" ? { ws: "H", ch: "C06L91W6T08" } : { ws: "H", ch: "C0AS5K1JZNJ" }; // 店の書いていない KEYDROP：那覇の部屋から来たら那覇・ほかは札幌
  return null; // 本部・KEYDROP（店が分からない）などは元の部屋のまま
}
const HDMN_DEF: { store?: string; url?: string } = {};
const _hdmnFetch0 = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  let alt: any = null; // 付け替えた時の元の送り方（失敗したらこちらで送る）
  try {
    const u = String(input?.url || input);
    if ((u.startsWith("https://slack.com/api/chat.postMessage") || u.startsWith("https://slack.com/api/chat.update")) && init && typeof init.body === "string") {
      const j = JSON.parse(init.body);
      const hd = new Headers(init.headers || {}); const auth = hd.get("Authorization") || ""; const tok = auth.replace(/^Bearer\s+/i, "");
      if (j && !j.thread_ts && u.includes("postMessage")) {
        const b0 = Array.isArray(j.blocks) ? j.blocks.find((b: any) => b && b.type === "section" && b.text && typeof b.text.text === "string") : null;
        const base = b0 ? b0.text.text : (typeof j.text === "string" ? j.text : "");
        const n = base ? hdmNorm(base, HDMN_DEF) : base;
        if (n && n !== base) { if (b0) b0.text.text = n; j.text = n; init = { ...init, body: JSON.stringify(j) }; }
        const to = hdmrPick(n || base, String(j.channel || ""));
        if (to && to.ch !== j.channel) {
          const srcWs = HDMR_TOK_B.includes(tok) ? "B" : HDMR_TOK_H.includes(tok) ? "H" : HDMR_B.includes(String(j.channel)) ? "B" : "H";
          const nt = to.ws === srcWs ? tok : (to.ws === "B" ? HDMR_TOK_B[0] : HDMR_TOK_H[0]);
          if (nt) {
            alt = init; hd.set("Authorization", `Bearer ${nt}`);
            init = { ...init, headers: hd, body: JSON.stringify({ ...j, channel: to.ch }) };
          }
        }
      } else if (j && (j.thread_ts || u.includes("chat.update"))) {
        const k = String(j.thread_ts || j.ts || ""); const hit = HDMR_SENT.get(k);
        if (hit && hit.ch !== j.channel) { hd.set("Authorization", hit.auth); init = { ...init, headers: hd, body: JSON.stringify({ ...j, channel: hit.ch }) }; }
      }
    }
  } catch (_e) { /* 形をそろえられない時は元のまま送る */ }
  if (!alt) return _hdmnFetch0(input, init);
  try {
    const r = await _hdmnFetch0(input, init); const t = await r.clone().text(); const jj = JSON.parse(t);
    if (jj && jj.ok) { try { HDMR_SENT.set(String(jj.ts || ""), { ch: String(jj.channel || ""), auth: new Headers(init.headers).get("Authorization") || "" }); } catch (_e) { /* */ } return r; }
    console.log("hdm-route fallback", jj && jj.error);
  } catch (_e) { console.log("hdm-route fallback (error)"); }
  return _hdmnFetch0(input, alt);
}) as typeof fetch;
// 2026-10-23 新API鍵移行：新形式の鍵を優先し、無ければ旧鍵（移行期間の保険・旧鍵の無効化前に外す）
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
console.log("[keymig]", __newKey("SUPABASE_SECRET_KEYS", "edge") ? "secret" : "legacy");
// ============================================================
// handyman-mypage-nha : HANDYMAN 統合マイページ 那覇（内部カルテ閲覧・lookup専用）
// 2026-07-08 / omni  ※札幌 handyman-mypage を複製元に、那覇の日本語列・受け渡し区分へ作り替え。
// 一旦のゴール（オーナー確定 2026-07-08）＝内部カルテ閲覧まで。顧客への開示/通知は範囲外。
// ※当初は lookup / ping のみ。以後 decide・cancel_request・ready・proposal_reply を追加し、2026-11-07 に update（場所・時間の依頼・承認制）を追加。
// 設計思想:
//  ・token(=mypage_token) 所持＝本人。URLはスタッフが ro=1 で閲覧専用に開く前提。
//  ・場所/時間は「nha_reservations と nha_tasks の実値ある方」を採る（札幌 resolveTaskPlace/Time と同思想）。
//  ・受け渡し区分(visit_type/return_type)はそのまま返す。表示分岐(バス/個別時間)はページ側(my-nha.html)。
//  ・service_role は関数内のみ。deploy: --no-verify-jwt
// 那覇の箱:
//  nha_reservations : id,ota,name,start_date,start_time,end_date,end_time,vehicle_class,vehicle_name,
//                     insurance,people,price,status,visit_type,return_type,del_time,del_place,col_time,col_place,
//                     del_flight,opt_b,opt_c,opt_j,opt_usb,mypage_token
//  nha_tasks(日本語列): _id(d-/c-/w-),内容,時間,予約者,担当,予約番号,送迎場所(place),集客(colPlace),
//                     返却(returnTime),送迎(returnType),クラス,確定(insurance),便名,変更(timeChange),changed_json(text)
// ============================================================

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" };
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

const ALLOWED = ["https://nosh2318.github.io", "https://keydrop.jp", "https://rent-handyman.com"];
function cors(o: string | null) {
  const allow = o && ALLOWED.includes(o) ? o : ALLOWED[0];
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Vary": "Origin" };
}
function json(b: unknown, s: number, o: string | null) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors(o), "content-type": "application/json" } }); }

async function sbGet(t: string, q: string): Promise<any[]> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { headers: H }); if (!r.ok) { console.error(`GET ${t}`, await r.text()); return []; } return await r.json(); }
async function sbPost(t: string, b: unknown): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(b) }); if (!r.ok) console.error(`POST ${t}`, await r.text()); }
async function sbPatch(t: string, q: string, b: unknown): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(b) }); if (!r.ok) console.error(`PATCH ${t}`, await r.text()); }
async function sbDelete(t: string, q: string): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { method: "DELETE", headers: H }); if (!r.ok) console.error(`DELETE ${t}`, await r.text()); }
// 予約完了・キャンセルは予約通知ch #okinawa_reservation_notification
async function slackResv(text: string, blocks?: unknown): Promise<boolean> {
  const token = Deno.env.get("SLACK_BOT_TOKEN"); const ch = Deno.env.get("SLACK_NHA_RESV_CHANNEL") || "C06KZ56NTDF";
  if (!token) return false;
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: ch, text, blocks }) }); const j = await r.json(); return !!j.ok; } catch { return false; }
}

// ★2026-11-09 nosh「全ての通知に統一全店」：Slack 2行目＝予約ID｜🚗車両名 ナンバー｜👤予約者名 様（配車表→車両表が正）
async function resvLabel(store: string, id: unknown): Promise<string> {
  const rid = String(id ?? "").trim(); if (!rid) return "";
  const fb = "予約 " + rid;
  try {
    const bt = store === "tkm";
    const url = bt ? Deno.env.get("BT_URL") : Deno.env.get("SUPABASE_URL");
    const key = bt ? Deno.env.get("BT_SERVICE_KEY") : ((()=>{ try { return (JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}") as Record<string, string>).edge || ""; } catch { return ""; } })() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    if (!url || !key) return fb;
    const hd: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
    if (key.startsWith("eyJ")) hd.Authorization = "Bearer " + key;
    const r = await fetch(`${url}/rest/v1/rpc/${bt ? "bt_resv_label" : "hdm_resv_label"}`, { method: "POST", headers: hd, body: JSON.stringify(bt ? { p_resv: rid } : { p_store: store, p_resv: rid }) });
    if (!r.ok) return fb;
    const v = await r.json();
    return typeof v === "string" && v ? v : fb;
  } catch { return fb; }
}

// ★2026-11-10 nosh「担当が紐づいてる場合は担当者名も出して」：承認待ちのSlackに OPシートの担当（d-＝貸出／c-＝返却）。無人・乗り捨てなど人でない担当は出さない
async function tantoLine(resId: string, side: "go" | "back" | "" = ""): Promise<string> { // ★2026-11-10 side：受け取り系＝貸出(d-)だけ／返却系＝返却(c-)だけ
  try {
    const ts = await sbGet("nha_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&deleted=not.is.true&select=_id,${encodeURIComponent("担当")}`);
    const pick = (p: string) => { const t = ts.find((x: any) => String(x._id || "").startsWith(p)); const a = String(t?.["担当"] ?? "").trim(); return a && !/無人|乗り?捨|洗車|^[（(]/.test(a) ? a : ""; };
    const d = side === "back" ? "" : pick("d-"), c = side === "go" ? "" : pick("c-");
    const parts = d && d === c ? [`貸出・返却 ${d}`] : [d ? `貸出 ${d}` : "", c ? `返却 ${c}` : ""].filter(Boolean);
    return parts.length ? `👷 *担当*　${parts.join("／")}` : "";
  } catch { return ""; }
}
// ★2026-11-10 nosh「担当でてない 管理ページリンクない」：お客様の操作の通知に 担当＋管理ページ（該当予約が開く）
const listUrl = (rid: string) => `https://nosh2318.github.io/spk-task/mypage-active.html?tab=list&bucket=hdm_nha&rid=${encodeURIComponent(rid)}`;
async function tlx(resId: string, side: "go" | "back" | "", url = ""): Promise<string> { const t = await tantoLine(resId, side); return [t, `🔗 管理ページ：${url || listUrl(resId)}`].filter(Boolean).join("\n"); }
const sideOf = (f: string): "go" | "back" | "" => /^(del_place|lend_time|start_time|received)$/.test(f) ? "go" : /^(col_place|return_time|end_time|ready)$/.test(f) ? "back" : "";
// ===== ★2026-11-14 nosh「通知スタイル統一・全通知に管理画面ダイレクトリンク」：Slack 通知の共通の型 v2（全店・全関数で同じものをコピー。名前と並びを変えない） =====
//   1行目 【店｜種類／小分け】何が起きたか ／ 2行目 詳細ひとこと ／ 3行目 📅 日程｜🚗 車両 ナンバー｜👤 名前 様｜👷 担当（なければ本部） ／ 4行目 🔗 管理画面の直リンク（必ず付ける）
//   予約番号・電話・メールは出さない（予約番号はリンクに入っている）。承認ボタンは最後に残してよい。引けない値は出さないだけで通知は必ず組む
type HdmStore = "spk" | "nha" | "tkm" | "kd_spk" | "kd_nha" | "but";
type HdmMsg = { emoji?: string; store: HdmStore | string; title: string; cat?: string; rid?: string; side?: "go" | "back" | ""; body?: (string | false | null | undefined)[]; url?: string; buttons?: { text: string; url: string }[]; noLink?: boolean; label?: string; tab?: "action" | "list" };
const HDM_ST: Record<string, { jp: string; db: "spk" | "nha" | "tkm"; bucket: string }> = {
  spk: { jp: "札幌", db: "spk", bucket: "hdm_spk" }, nha: { jp: "那覇", db: "nha", bucket: "hdm_nha" }, tkm: { jp: "高松", db: "tkm", bucket: "hdm_tkm" },
  kd_spk: { jp: "KEYDROP札幌", db: "spk", bucket: "key_spk" }, kd_nha: { jp: "KEYDROP那覇", db: "nha", bucket: "key_nha" }, but: { jp: "BUDDICA高松", db: "tkm", bucket: "but_tkm" },
};
function hdmDb(db: string): { url: string; key: string } {
  const own = String(Deno.env.get("SUPABASE_URL") || ""), ownBt = own.includes("ggqugvyskyiblxiycpci");
  const ownKey = ((() => { try { return (JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}") as Record<string, string>).edge || ""; } catch { return ""; } })() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  if (db === "tkm") return ownBt ? { url: own, key: ownKey } : { url: Deno.env.get("BT_URL") || "", key: Deno.env.get("BT_SERVICE_KEY") || "" };
  return ownBt ? { url: Deno.env.get("MAIN_URL") || "https://ckrxttbnawkclshczsia.supabase.co", key: Deno.env.get("MAIN_SERVICE_KEY") || Deno.env.get("MAIN_SERVICE") || "" } : { url: own, key: ownKey };
}
async function hdmFetch(db: string, path: string, body?: unknown): Promise<any> {
  const { url, key } = hdmDb(db); if (!url || !key) return null;
  const hd: Record<string, string> = { apikey: key, "Content-Type": "application/json" }; if (key.startsWith("eyJ")) hd.Authorization = "Bearer " + key;
  const r = await fetch(`${url}/rest/v1/${path}`, body === undefined ? { headers: hd } : { method: "POST", headers: hd, body: JSON.stringify(body) });
  return r.ok ? await r.json().catch(() => null) : null;
}
async function hdmLabel(store: string, rid: string): Promise<string> {
  const db = (HDM_ST[store] || HDM_ST.spk).db;
  try { const v = await hdmFetch(db, `rpc/${db === "tkm" ? "bt_resv_label" : "hdm_resv_label"}`, db === "tkm" ? { p_resv: rid } : { p_store: db, p_resv: rid }); return typeof v === "string" && v ? v : ""; } catch { return ""; }
}
async function hdmDates(store: string, rid: string): Promise<string> {
  try {
    const db = (HDM_ST[store] || HDM_ST.spk).db;
    const [tbl, a, b, at, bt] = db === "spk" ? ["reservations", "lend_date", "return_date", "lend_time", "return_time"] : [db === "tkm" ? "bt_reservations" : "nha_reservations", "start_date", "end_date", "start_time", "end_time"];
    const v = await hdmFetch(db, `${tbl}?id=eq.${encodeURIComponent(rid)}&select=${a},${b},${at},${bt}&limit=1`);
    const r = Array.isArray(v) ? v[0] : null; if (!r || !r[a]) return "";
    const md = (d: unknown) => { const m = String(d || "").match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${+m[1]}/${+m[2]}` : ""; };
    const hm = (t: unknown) => { const m = String(t || "").match(/^(\d{1,2}):(\d{2})/); return m ? `${+m[1]}:${m[2]}` : ""; };
    return `📅 ${[md(r[a]), hm(r[at])].filter(Boolean).join(" ")}〜${[md(r[b]), hm(r[bt])].filter(Boolean).join(" ")}`;
  } catch { return ""; }
}
async function hdmTanto(store: string, rid: string, side: "go" | "back" | "" = ""): Promise<string> {
  try {
    const db = (HDM_ST[store] || HDM_ST.spk).db;
    const [tbl, col, aCol] = db === "spk" ? ["tasks", "reservation_id", "assignee"] : [db === "tkm" ? "bt_tasks" : "nha_tasks", "予約番号", "担当"];
    const ts = await hdmFetch(db, `${tbl}?${encodeURIComponent(col)}=eq.${encodeURIComponent(rid)}&deleted=not.is.true&select=_id,${encodeURIComponent(aCol)}`);
    const list = Array.isArray(ts) ? ts : [];
    const pick = (p: string) => { const t = list.find((x: any) => String(x._id || "").startsWith(p)); const a = String(t?.[aCol] ?? "").trim(); return a && !/無人|乗り?捨|洗車|^[（(]/.test(a) ? a : ""; };
    const d = side === "back" ? "" : pick("d-"), c = side === "go" ? "" : pick("c-");
    const [wd, wc] = db === "spk" ? ["お届け", "回収"] : ["貸出", "返却"];
    const parts = d && d === c ? [`${wd}・${wc} ${d}`] : [d ? `${wd} ${d}` : "", c ? `${wc} ${c}` : ""].filter(Boolean);
    return parts.length ? `👷 ${parts.join("／")}` : "";
  } catch { return ""; }
}
// 種類／小分け（タイトルの【】に入れる）。呼び出し側が cat を渡さない時だけ、見出しの言葉から決める
function hdmCat(t: string): string {
  const s = String(t || "");
  const R: [RegExp, string][] = [
    [/免許/, "準備が足りない／免許証"], [/傷チェック|傷/, "準備が足りない／傷チェック"],
    [/新規予約|自動取込|予約登録|再配車/, "配車・取込／配車"], [/補填|取込漏れ|取り込み漏れ/, "配車・取込／取込漏れ"],
    [/相談/, "依頼に返事／担当からの相談"], [/チャット/, "お客様の知らせ／チャット"], [/代車/, "依頼に返事／代車"], [/早め回収/, "依頼に返事／早め回収"],
    [/返金/, "お金／返金"], [/決済リンク|リンク停止/, "お金／決済リンク"], [/消し込み|会計|クーポン/, "お金／会計のずれ"], [/未入金|未払|領収書/, "お金／未払い・入金"],
    [/着きました|遅れ|到着|合流|受け取り完了|お客様から「/, "お客様の知らせ／着きました・遅れます"], [/問い合わせ/, "お客様の知らせ／問い合わせ"],
    [/押されていません|押し忘れ|時刻を過ぎ/, "タスクの遅れ／ボタンの押し忘れ"], [/送迎の通知|お知らせ.*届いて/, "タスクの遅れ／送迎のお知らせ"], [/未確認|タスク.*確認/, "タスクの遅れ／今日のタスク未確認"],
    [/返事がまだ|引き受け|スキップ|タスク完了|打刻/, "タスクの遅れ／担当の返事"],
    [/登録できません|反映できません|反映に失敗/, "配車・取込／情報のずれ"],
    [/キャンセル/, "依頼に返事／キャンセル"], [/シート|補償|オプション/, "依頼に返事／オプション・補償"],
    [/送迎|来店|店舗で返却|受け取り方|お迎え/, "依頼に返事／受け取り方・送迎"], [/時間|場所|お届け先|回収先|日程|変更|承認|却下|差し戻|別の案|代わりの案/, "依頼に返事／時間・場所"],
    [/価格/, "依頼に返事／価格の承認"], [/入庫|車両登録/, "依頼に返事／車の入庫・登録"], [/エリア|満席|定員|配車/, "配車・取込／配車"],
    [/入金|決済/, "お金／未払い・入金"], [/在庫|OTA|売り止め/, "配車・取込／在庫・OTA"], [/オイル|整備|車検|点検|メンテ/, "配車・取込／車の手入れ"],
    [/API|サーバ|ボット|停止|エラー/, "システム／ボット・サーバー"],
  ];
  for (const [re, c] of R) if (re.test(s)) return (/確認しました|完了|承認して反映|反映しました|承認しました|見送りました|確定しました|送りました|返金しました|登録しました|取込しました|取り込みました|削除済み|処理済み/.test(String(s || "")) && !/^\s*(⚠️|🔴|🚨|❌|🟡)|要(対応|返金|確認)|早め回収|返却準備完了|未完了|完了してい|失敗|できません|できない|未入金|未決済|未払|未配車|未登録|漏れ|障害|止ま|ください|まだ|戻っていません|スキップ|不一致|ずれ|期限切れ/u.test(String(s || "")) && !/^システム/.test(c) ? "済んだこと／記録" : c); // ★2026-11-14 済んだことは行動要の種類にしない
  return "システム／自動送信";
}
const hdmStoreOf = (store: string, ota?: unknown) => String(ota || "") === "KEYDROP" && (store === "spk" || store === "nha") ? "kd_" + store : store; // KEYDROP の予約は KEYDROP の店名・タブ
const HDM_APP: Record<string, string> = { spk: "https://nosh2318.github.io/spk-task/", nha: "https://nosh2318.github.io/naha-project/", tkm: "https://buddica-touring.github.io/app/" }; // 予約に紐づかない通知の直リンク（その店のAPP）
const hdmWho = (actor: unknown, name?: unknown) => { const a = String(actor || "").replace(/^staff:/, "").replace(/@.*$/, "").trim(); return !a || a === "admin_pin" ? (String(name || "").trim().slice(0, 40) || "本部") : a; }; // 対応者の表示（内部の言葉 admin_pin は出さない。共通PIN経由のときだけ呼び出し元の名前）
const hdmUrl = (store: string, rid?: string, tab: "action" | "list" = "list") => `https://nosh2318.github.io/spk-task/mypage-active.html?tab=${tab}&bucket=${(HDM_ST[store] || HDM_ST.spk).bucket}${rid ? "&rid=" + encodeURIComponent(rid) : ""}`;
const hdmScrub = (s: string, rid: string) => { let t = s; if (rid) t = t.split(rid).join(""); // 予約番号は出さない（リンクに入っている）・電話とメールも出さない
  return t.replace(/予約(番号)?\s*[:：]?\s*(?=[｜|／\s]|$)/g, "").replace(/(?<!\d)0\d{1,4}-\d{1,4}-\d{3,4}(?!\d)|(?<!\d)0[789]0\d{8}(?!\d)/g, "").replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "").replace(/[ 　]{2,}/g, " ").replace(/^[｜|／\s]+|[｜|／\s]+$/g, "").trim(); };
async function hdmMsg(m: HdmMsg): Promise<{ text: string; blocks: unknown[] }> {
  const st = HDM_ST[m.store] || { jp: String(m.store || ""), db: "spk", bucket: "" };
  const rid = String(m.rid || "").trim();
  const title = String(m.title || "").trim();
  const cat = m.cat || hdmCat(title);
  const tab = m.tab || (/^依頼に返事/.test(cat) ? "action" : "list");
  const lines: string[] = [`【${st.jp}｜${cat}】${title}`];
  const detail = (m.body || []).filter(Boolean).map((b) => hdmScrub(String(b), rid)).filter((b) => b && !/^⚠️\s*要承認/.test(b)).join("／");
  lines.push(detail || "—");
  let meta: string[] = [];
  if (rid) {
    const [lb, tt, dt] = await Promise.all([m.label || hdmLabel(String(m.store), rid), hdmTanto(String(m.store), rid, m.side || ""), hdmDates(String(m.store), rid)]);
    const lbp = String(lb || "").split("｜").filter((p) => !/^予約\s/.test(p.trim()) && !/車両未割当|名前なし/.test(p));
    meta = [dt, ...lbp, tt || "👷 本部"].filter(Boolean);
  }
  lines.push(meta.length ? meta.join("｜") : "👷 本部");
  lines.push(`🔗 ${m.url || (rid ? hdmUrl(String(m.store), rid, tab) : (HDM_APP[st.db] || "https://nosh2318.github.io/spk-task/hq.html"))}`);
  const text = lines.join("\n").slice(0, 2900);
  const blocks: unknown[] = [{ type: "section", text: { type: "mrkdwn", text } }];
  if (m.buttons && m.buttons.length) blocks.push({ type: "actions", elements: m.buttons.slice(0, 5).map((b, i) => ({ type: "button", text: { type: "plain_text", text: b.text, emoji: true }, url: b.url, ...(i === 0 ? { style: "primary" } : {}) })) });
  return { text, blocks };
}
// ===== ここまで共通の型 =====
// ★2026-11-12 依頼者「承認依頼に該当の日付（貸出or返却）も記載して。どれだけ急ぐか開かなきゃ判断できない」
//   承認待ちの通知に 📅 該当日（貸出側=貸出日／返却側=返却日／両方=両方）＋【今日】【明日】。表記は札幌 handyman-mypage の dateLine と同じ
function dateLine(sd: unknown, ed: unknown, side: string = "", wd: [string, string] = ["貸出日", "返却日"]): string {
  const j = new Date(Date.now() + 9 * 3600e3), td = j.toISOString().slice(0, 10), tm = new Date(+j + 864e5).toISOString().slice(0, 10);
  const f = (v: unknown) => { const s = String(v || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ""; const d = new Date(s + "T00:00:00Z"); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${"日月火水木金土"[d.getUTCDay()]})${s === td ? "【今日】" : s === tm ? "【明日】" : ""}`; };
  const g = f(sd), b = f(ed);
  const p = (side === "go" ? [g && `*${wd[0]}*　${g}`] : side === "back" ? [b && `*${wd[1]}*　${b}`] : [g && `*${wd[0]}*　${g}`, b && `*${wd[1]}*　${b}`]).filter(Boolean);
  return p.length ? `📅 ${p.join("　／　")}` : "";
}

// 顧客へメール通知（LINEは当面使わずメールのみ・2026-08-27 オーナー指示）
// rent-handyman.com は MAIN の Resend では送れないため BT project の notice-mail-send 経由で送る。
const BT_NOTICE_URL = "https://ggqugvyskyiblxiycpci.supabase.co/functions/v1/notice-mail-send";
const BT_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncXVndnlza3lpYmx4aXljcGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDc3NjksImV4cCI6MjA5MzY4Mzc2OX0.uNhWcBd_Dl5nzemZDQfJ8mQV6iY73MwystGGpTRPC18";
async function mailCustomer(resvNo: string, subject: string, text: string): Promise<void> {
  const secret = Deno.env.get("NOTICE_MAIL_SECRET");
  if (!secret) { console.log("[mail skip] no NOTICE_MAIL_SECRET", resvNo); return; }
  try {
    const r = await fetch(BT_NOTICE_URL, {
      method: "POST", headers: { "content-type": "application/json", apikey: BT_ANON, Authorization: `Bearer ${BT_ANON}` },
      body: JSON.stringify({ secret, store: "nha", resv_no: resvNo, subject, text, allow_cancel: true }),
    });
    const d = await r.json().catch(() => ({})); if (!(d as any).ok) console.log("[notice-mail]", JSON.stringify(d));
  } catch (e) { console.error("[notice-mail]", String(e)); }
}
// 顧客へLINE通知（line-push・store=nha・mypage_decision）
async function pushLineNha(resvNo: string, message: string): Promise<void> {
  const secret = Deno.env.get("LINEPUSH_SECRET"); if (!secret) return;
  try {
    await fetch(`${SB_URL}/functions/v1/line-push`, { method: "POST", headers: { "content-type": "application/json", apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify({ secret, store: "nha", resv_no: resvNo, action: "mypage_decision", message }) });
  } catch (e) { console.error("[line-push]", String(e)); }
}
// 通知の振り分け：LINE連携済み(nha_line_links)ならLINE、未連携ならメール
async function notifyCust(resvNo: string, subject: string, text: string): Promise<void> {
  const lk = (await sbGet("nha_line_links", `resv_no=eq.${encodeURIComponent(resvNo)}&select=line_user_id&limit=1`))[0];
  if (lk && String((lk as any).line_user_id || "").trim()) await pushLineNha(resvNo, text.replace(/reserve@rent-handyman\.com/g, "").trim());
  else await mailCustomer(resvNo, subject, text);
}
// Slack通知（那覇のマイページ操作＝#okinawa_operations-team / 環境変数で上書き可）
async function slackPost(text: string, blocks?: unknown): Promise<boolean> {
  const token = Deno.env.get("SLACK_BOT_TOKEN"); const ch = Deno.env.get("SLACK_NHA_USER_CHANNEL") || "C06L91W6T08";
  if (!token || !ch) return false;
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: ch, text, blocks }) }); const j = await r.json(); return !!j.ok; } catch { return false; }
}

// 予約もと（OTA）ラベル
const OTA_JP: Record<string, string> = { J: "じゃらん", R: "楽天", S: "skyticket", O: "エアトリ", RC: "レンタカーcom", G: "GoGoOut", HP: "オフィシャル(HP)", SP: "オフィシャル(HP)", direct: "直販", KEYDROP: "KEYDROP" };
function otaJp(o?: string): string { const k = String(o || ""); return OTA_JP[k] || k || "—"; }
// 2026-11-07 キャンセル申請などは該当予約をアクションタブで直接開く（那覇=hdm_nha）
const actUrl = (rid: string) => `https://nosh2318.github.io/spk-task/mypage-active.html?tab=action&bucket=hdm_nha&rid=${encodeURIComponent(rid)}`;

function nowJst(slice = false): string { const s = new Date(Date.now() + 9 * 3600 * 1000).toISOString(); return slice ? s.slice(5, 16).replace("T", " ") : s.replace("Z", "+09:00"); }

// changed_json は text型 → JSON.parse 必須。オブジェクトならそのまま。
function parseCj(t: any): any {
  let cj = t && t.changed_json;
  if (typeof cj === "string") { try { cj = JSON.parse(cj); } catch { cj = {}; } }
  return cj || {};
}
// OPシート/my-admin と同一の場所解決式（那覇：place=送迎場所）。
// _placeSource==="manual" なら手入力(place)を優先、それ以外は SSパトロール値(_ssPlace) を優先。
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
  return String(t.timeChange || cj._timeChange || cj._ssTime || t.time || "");  // OPシートと同じ優先(OPの「変更」列=timeChangeを最優先)
}
function taskOptNum(t: any, key: string): number {
  if (!t) return 0;
  const cj = parseCj(t);
  return Number(cj[key]) || 0;
}

// ==== 2026-11-07 別の案・お断り理由（アクションタブ仕様。マイページ側の「この案でOK／やめる」と対） ====
// decide: decision=proposed（proposal_text 必須・proposal_value 任意）→ status=proposed, payload.proposal
//         decision=rejected（reject_reason / reject_text 任意）→ 通知文に理由、payload.reject
// proposal_reply（お客様・token）: accept→その値で承認と同じ処理 / decline→declined_by_guest / 期限切れ→expired
const REJ_JP: Record<string, string> = {  // 11/7 nosh「理由は明確に（予約状況の兼ね合いにて・回収スタッフ状況など）」
  no_vehicle: "誠に恐れ入りますが、予約状況の兼ね合いにより、ご希望の日時にご用意できるお車がございません。",
  full_slot: "誠に恐れ入りますが、{staff}の状況により、ご希望のお時間に伺うことができません。",
  out_of_area: "ご希望の場所は、お届け・回収の対象エリア外のため、伺うことができません。",
  out_of_stock: "誠に恐れ入りますが、在庫状況により、ご希望のオプションをご用意できる数がございません。",
  past_deadline: "変更の受付締切を過ぎているため、ご変更を承ることができません。",
  other: "",
};
function staffOf(field: string): string { return ["del_place", "lend_time"].includes(field) ? "お届けスタッフ" : ["col_place", "return_time", "ready"].includes(field) ? "回収スタッフ" : "担当スタッフ"; }
function rejectLine(code: string, text: string, field = ""): string { const a = (REJ_JP[code] || "").replace("{staff}", staffOf(field)); const t = String(text || "").trim().slice(0, 200); return [a, t].filter(Boolean).join("\n"); }
const PROP_FIELDS_END = ["col_place", "return_time", "ready"];
// 期限：今から24時間、ただし受け渡しの2時間前まで（最短30分）
function proposalExpires(field: string, sd: string, st: string, ed: string, et: string): string {
  const now = Date.now(); let exp = now + 24 * 3600e3;
  const d = PROP_FIELDS_END.includes(field) ? ed : sd, t = PROP_FIELDS_END.includes(field) ? et : st;
  if (d) { const hm = String(t || "09:00").match(/(\d{1,2}):(\d{2})/); const h = hm ? +hm[1] : 9, m = hm ? +hm[2] : 0;
    const hand = Date.parse(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+09:00`); if (!isNaN(hand)) exp = Math.min(exp, hand - 2 * 3600e3); }
  return new Date(Math.max(exp, now + 30 * 60e3)).toISOString();
}
// お断り＝「できない理由＋代わりにできること＋今のご予約はそのまま」の1通（別の案・お断り共通の文面）
function declineMsg(head: string, label: string, field: string, newV: string, oldV: string, why: string, alt: string, next: string, url: string): string {
  // 11/7 nosh「返信の内容には気を付ける 丁寧な内容で」
  const want = field === "cancel" ? "ご予約のキャンセル" : field === "ready" ? "早めの回収" : `${label}の変更${newV ? `（${newV}）` : ""}`;
  const lines = [`${head}ご依頼いただいた${want}につきまして、ご連絡いたします。`];
  if (why) lines.push(why);
  if (alt) lines.push(`代わりに、${alt}${/[。！？!?]$/.test(alt) ? "" : "。"}`);
  if (next) lines.push(next);
  lines.push(field === "cancel" || !oldV ? "今のご予約はそのままです。" : `今のご予約（${label}：${oldV}）はそのままです。`);
  lines.push("ご不便をおかけいたしますが、何卒よろしくお願いいたします。");
  if (url) lines.push(url);
  return lines.join("\n");
}
// ==== 2026-11-07 nosh「全てマイページから申請し運営が可否→ユーザーに戻る」：那覇の場所・時間の変更（承認時に反映） ====
const PT_FIELDS = ["del_place", "col_place", "lend_time", "return_time"];
// OPシート(nha_tasks)の手入力と同じ形で書く（場所＝_placeSource:manual、時間＝「変更」列）。SSパトロールで戻されないため。
// 2026-11-08 反映は DB 関数 nha_apply_mypage_change に一本化（予約・OPタスク・記録を1トランザクションで書き、
//   OPシート/タスクサマリー/個別URLと同じ読み方で読み直して一致しなければ全部取り消す。承認値は取込・自動取得・古い画面の保存で戻らないようロック）
async function nhaApplyChange(resId: string, field: string, val: string, actor: string, changeId?: unknown): Promise<{ ok: boolean; error?: string }> {
  const v = String(val || "").trim(); if (!PT_FIELDS.includes(field)) return { ok: true };
  if (!v) return { ok: false, error: "反映する値が空です" };
  const r = await fetch(`${SB_URL}/rest/v1/rpc/nha_apply_mypage_change`, { method: "POST", headers: H,
    body: JSON.stringify({ p_res: resId, p_field: field, p_val: v, p_actor: actor, p_change_id: Number(changeId) || null }) });
  if (!r.ok) { const tx = await r.text(); console.error("apply", tx); let m = tx; try { m = JSON.parse(tx).message || tx; } catch { /* noop */ } return { ok: false, error: String(m).slice(0, 300) }; }
  return { ok: true };
}
// ==== 2026-11-14 日を延ばす（nosh「同じクラスの公式サイト価格との差額・日単位・同じクラスのみ」。承認制・差額はSquare）====
//   見積もりと反映は DB 関数 hdm_mypage_extend（p_apply=false は何も書かない）
async function nhaExtend(resId: string, days: number, apply: boolean, actor = "", changeId?: unknown): Promise<{ ok: boolean; error?: string; data?: any }> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/hdm_mypage_extend`, { method: "POST", headers: H,
      body: JSON.stringify({ p_store: "nha", p_res: resId, p_days: days, p_apply: apply, p_actor: actor, p_change_id: Number(changeId) || null }) });
    const tx = await r.text();
    if (!r.ok) { console.error("extend", tx); let m = tx; try { m = JSON.parse(tx).message || tx; } catch { /* noop */ } return { ok: false, error: String(m).slice(0, 300) }; }
    return { ok: true, data: JSON.parse(tx) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 300) }; }
}
// ==== 2026-11-09 シート・補償の追加（承認制・差額はSquare。札幌と同じ形） ====
//   反映は DB 関数 hdm_apply_mypage_extra（予約に入れ、取込・シートで戻らない印。差額と内訳も返す）
async function nhaApplyExtra(resId: string, kind: string, target: any, actor: string, changeId?: unknown): Promise<{ ok: boolean; error?: string; data?: any }> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/hdm_apply_mypage_extra`, { method: "POST", headers: H,
      body: JSON.stringify({ p_store: "nha", p_res: resId, p_kind: kind, p_target: target || {}, p_actor: actor, p_change_id: Number(changeId) || null }) });
    const tx = await r.text();
    if (!r.ok) { console.error("extra", tx); let m = tx; try { m = JSON.parse(tx).message || tx; } catch { /* noop */ } return { ok: false, error: String(m).slice(0, 300) }; }
    return { ok: true, data: JSON.parse(tx) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 300) }; }
}
// ==== 2026-11-10 受け取り方・返し方の変更（承認制・差額はSquare。シート・補償と同じ形）====
//   反映は DB 関数 hdm_apply_mypage_method（予約とタスクに入れ、取込・シートで戻らない印。差額と内訳も返す）
async function nhaApplyMethod(resId: string, target: any, actor: string, changeId?: unknown): Promise<{ ok: boolean; error?: string; data?: any }> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/hdm_apply_mypage_method`, { method: "POST", headers: H,
      body: JSON.stringify({ p_res: resId, p_target: target || {}, p_actor: actor, p_change_id: Number(changeId) || null }) });
    const tx = await r.text();
    if (!r.ok) { console.error("method", tx); let m = tx; try { m = JSON.parse(tx).message || tx; } catch { /* noop */ } return { ok: false, error: String(m).slice(0, 300) }; }
    return { ok: true, data: JSON.parse(tx) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 300) }; }
}
// 1回の単価：公式サイト予約 1,000円／ほかのサイト 1,500円（公式サイト FAQ）。DB 関数 hdm_method_unit と同じ
function methodUnit(ota: unknown, resId: string): number { return ["HP", "HANDYMAN", "direct", "直予約", "SP"].includes(String(ota || "")) || /^HDMN/.test(resId) ? 1000 : 1500; }
async function squareLinkNha(name: string, amount: number, resId: string): Promise<{ url: string; orderId: string } | null> {
  const token = Deno.env.get("SQUARE_ACCESS_TOKEN") || "";
  if (!token || amount <= 0) return null;
  const loc = Deno.env.get("SQUARE_LOCATION_ID_NHA") || Deno.env.get("SQUARE_LOCATION_ID") || "L8N7J9RKPN3WH";
  try {
    const r = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", "Square-Version": "2024-06-04" },
      body: JSON.stringify({ idempotency_key: `mypxtra-nha-${resId}-${Date.now()}`, quick_pay: { name: `那覇空港店 ${name}様（${resId}）追加 シート/補償/お届け`, price_money: { amount, currency: "JPY" }, location_id: loc } }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.payment_link?.url) { console.log("[square link]", JSON.stringify(d)); return null; }
    return { url: d.payment_link.url, orderId: d.payment_link.order_id || "" };
  } catch (e) { console.error("[square link]", String(e)); return null; }
}
// 貸出の開始（JST）。補償はここまで
function lendStartMs(sd: string, st: string): number { const t = /^\d{1,2}:\d{2}$/.test(String(st || "")) ? String(st).padStart(5, "0") : "00:00"; return Date.parse(`${sd}T${t}:00+09:00`); }

// 2026-11-08 nosh「スタッフ編集できるように」：アクションタブの確認画面でスタッフが直した文（message_text）があれば、その文をそのまま送る
function staffText(p: any, url: string): string { const s = String(p?.message_text || "").replace(/\r\n/g, "\n").trim().slice(0, 2000); if (!s) return ""; return s.replace(/（マイページのURL）/g, url || "").replace(/\n{3,}/g, "\n\n").trim(); }
function expOverride(p: any, fallback: string): string { const e = Date.parse(String(p?.expires_at || "")), now = Date.now(); return (!isNaN(e) && e >= now + 25 * 60e3 && e <= now + 24 * 3600e3 + 10 * 60e3) ? new Date(e).toISOString() : fallback; }
function jstMdHm(iso: string): string { const j = new Date(Date.parse(iso) + 9 * 3600e3); return `${j.getUTCMonth() + 1}/${j.getUTCDate()} ${String(j.getUTCHours()).padStart(2, "0")}:${String(j.getUTCMinutes()).padStart(2, "0")}`; }
const FLD_JP: Record<string, string> = { del_place: "お届け場所", col_place: "回収場所", lend_time: "貸出の時間", return_time: "返却の時間", ready: "早めの回収", option: "子ども用シート", insurance: "補償", cancel: "キャンセル", method: "受け取り・返却の方法", extend: "日を延ばす" };

// ★2026-11-14 nosh「一次判断をOMNI→共有①社員＝Slack 共有②担当者＝個別URL（承認待ち）→社員承認→全体反映＝通知」
//   時間・場所の依頼が来たら、まずオムニ（omni-desk chg_ask）に判断させ、Slack には「〜で承認していいですか？」として出す（元の「承認待ち」の文の代わり）。
//   オムニが答えられない時は今までの文のまま
async function omniAsk(store: string, ids: (number | string)[]): Promise<any[]> {
  try {
    const base = /ggqugvyskyiblxiycpci/.test(String(Deno.env.get("SUPABASE_URL") || "")) ? (Deno.env.get("MAIN_URL") || "https://ckrxttbnawkclshczsia.supabase.co") : String(Deno.env.get("SUPABASE_URL") || "");
    const r = await fetch(`${base}/functions/v1/omni-desk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "chg_ask", admin_pin: Deno.env.get("ADMIN_PIN") || "", store, ids: ids.map(Number).filter(Boolean) }), signal: AbortSignal.timeout(8000) }); // ★2026-11-14 nosh「OMNI止まったらスタッフは動きを把握できなくなる」：8秒で打ち切り、元の文で必ず社員へ出す
    const j = await r.json().catch(() => null); return j && j.ok ? Object.values(j.map || {}) : [];
  } catch { return []; }
}
function omniText(S: any[]): { title: string; lines: string[] } | null {
  if (!S.length) return null;
  const asks = S.map((s: any) => s.verdict === "human" || !s.ask ? "" : String(s.ask)).filter(Boolean);
  const human = S.some((s: any) => s.verdict === "human" || !s.ask);
  const who = String((S.find((s: any) => s.who) || {}).who || "");
  const title = human ? "🤖 オムニ：迷うので社員が決めてください" : "🤖 " + asks.join("／");
  const why = [...new Set(S.flatMap((s: any) => Array.isArray(s.why) ? s.why : []))].slice(0, 6).map((w) => "・" + w);
  return { title, lines: [...why, `👷 担当${who ? " " + who + "さん" : "なし"}の個別URLにも「社員の承認待ち」で出ています`, "✅ 社員が承認画面で「はい」→ 予約・タスク・お客様へ自動で反映"] };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  let p: any; try { p = await req.json(); } catch { return json({ error: "bad json" }, 400, origin); }

  const action = String(p.action || "lookup").trim();

  // ==== keep-warm ping（DB不使用・即応答）====
  if (action === "ping") return json({ ok: true, warm: true, store: "nha" }, 200, origin);

  // ==== 承認/却下（スタッフ操作・早め回収リクエスト等）＝📲マイページ利用状況から呼ぶ ====
  if (action === "decide") {
    // 認証: (a) 共通PIN（全店ダッシュボード・目視承認）／(b) スタッフJWT。どちらか一方でOK。
    const ADMIN_PIN = Deno.env.get("ADMIN_PIN") || "";
    const adminPin = String(p.admin_pin || "");
    let actor = "";
    if (ADMIN_PIN && adminPin && adminPin === ADMIN_PIN) { actor = "staff:" + (String(p.actor_name || "").replace(/[\s:]+/g, " ").trim().slice(0, 30) || "admin_pin"); } // ★2026-11-14 承認した人の名前を残す
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
    if (!changeId || (decision !== "approved" && decision !== "rejected" && decision !== "acknowledged" && decision !== "proposed")) return json({ error: "パラメータ不正" }, 400, origin);
    const cRows = await sbGet("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}&store=eq.nha&select=id,reservation_id,field,old_value,new_value,status,payload`);
    const c = cRows[0];
    if (!c) return json({ error: "対象が見つかりません" }, 404, origin);
    if (c.status !== "requested") return json({ error: "処理済みです", status: c.status }, 409, origin);
    // 確認済み（対応不要・アーカイブのみ。反映も通知もしない）
    if (decision === "acknowledged") { await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}`, { status: "acknowledged", actor }); return json({ ok: true, decided: "acknowledged" }, 200, origin); }
    const resId2 = String(c.reservation_id);
    const pl0: any = (c.payload && typeof c.payload === "object") ? c.payload : {};
    const rejCode = String(p.reject_reason || ""), rejText = String(p.reject_text || "").trim().slice(0, 200);
    const rejLine = decision === "rejected" ? rejectLine(rejCode, rejText, String(c.field)) : "";
    const altText = String(p.alt_text || "").trim().slice(0, 300);
    const keep = p.keep_as_is === true || p.keep_as_is === "true";  // 11/7 nosh「NGだけもあり得る＝既存予約のままでお願いします」
    // 2026-11-07 nosh決定「お断り＝できないが〜ならできます」：代わりの案なしのお断りは受け付けない（早め回収＝予定通り回収 は例外）
    if (decision === "rejected" && !altText && !keep) return json({ error: "代わりにできること（〜ならできます）を書いてください" }, 400, origin);
    const rejPayload = decision === "rejected" ? { payload: { ...pl0, reject: { reason: rejCode || "other", text: rejText, alt: altText, ...(keep ? { keep: true } : {}), by: actor, at: new Date().toISOString() } } } : {};
    const lbl = FLD_JP[c.field] || c.field;
    const _rl = await resvLabel("nha", resId2); // ★2026-11-09 Slack 2行目＝予約ID｜車両 ナンバー｜予約者名（キャンセル承認の配車解放より前に引く）
    // ---- 別の案（お客様がマイページで「この案でOK」を押すと承認と同じ処理で確定）----
    if (decision === "proposed") {
      const ptext = String(p.proposal_text || "").trim().slice(0, 300); const pval = String(p.proposal_value || "").trim().slice(0, 100);
      if (!ptext) return json({ error: "別の案の内容を書いてください" }, 400, origin);
      if (c.field === "ready" && !/^\d{1,2}:\d{2}$/.test(pval)) return json({ error: "回収できる時間を 15:00 の形で入れてください" }, 400, origin);  // 11/7 nosh「早め回収も〜時ならOK」
      if (!["del_place", "col_place", "lend_time", "return_time", "ready"].includes(String(c.field))) return json({ error: "この種類の依頼は、マイページのボタンではなく文でお返事します（decision=rejected＋alt_text）" }, 400, origin);
      const rv = (await sbGet("nha_reservations", `id=eq.${encodeURIComponent(resId2)}&select=name,ota,start_date,start_time,end_date,end_time,mypage_token`))[0] || {};
      const exp = expOverride(p, proposalExpires(String(c.field), rv.start_date, rv.start_time, rv.end_date, rv.end_time));
      const url = rv.mypage_token ? `https://nosh2318.github.io/naha-project/my-nha.html?t=${rv.mypage_token}` : "";
      const pBody = staffText(p, url) || declineMsg("【HANDYMAN 那覇】", lbl, String(c.field), String(c.new_value || ""), String(c.old_value || ""), rejectLine(rejCode, rejText, String(c.field)), ptext, `マイページで「この案でOK」を押すと確定します（${jstMdHm(exp)}まで）。ご都合が合わなければ「やめる」を押してください。`, url);
      // 2026-11-08 送った文そのものを記録（アーカイブで確認できるように）
      await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}`, { status: "proposed", actor, payload: { ...pl0, proposal: { text: ptext, value: pval, reason: rejCode || "", reason_text: rejText, expires_at: exp, by: actor, at: new Date().toISOString(), sent: pBody.slice(0, 2000) } } });
      await notifyCust(resId2, `【HANDYMAN那覇空港店】ご予約 ${resId2} ご依頼について別の案のご提案`, pBody + `\n\nHANDYMAN那覇空港店\nreserve@rent-handyman.com`);
      { const m = await hdmMsg({ emoji: "💬", store: "nha", title: `別の案を送りました（${FLD_JP[c.field] || c.field}）`, rid: resId2, side: sideOf(String(c.field)), body: [`🔁 ${ptext}`, `⏳ お客様の返事待ち（${jstMdHm(exp)}まで）`, `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(m.text, m.blocks); }
      return json({ ok: true, decided: "proposed", expires_at: exp }, 200, origin);
    }
    // ---- キャンセル承認/却下（HP直販・承認必須。返金は手動Square）----
    if (c.field === "cancel") {
      await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}`, { status: decision, actor, ...rejPayload });
      const cr = (await sbGet("nha_reservations", `id=eq.${encodeURIComponent(resId2)}&select=name,ota,start_date,end_date,vehicle_class,price`))[0] || {};
      if (decision === "approved") {
        await sbPatch("nha_reservations", `id=eq.${encodeURIComponent(resId2)}`, { status: "キャンセル" });
        await sbDelete("nha_fleet", `reservation_id=eq.${encodeURIComponent(resId2)}`);
        await notifyCust(resId2, `【HANDYMAN那覇空港店】ご予約 ${resId2} キャンセル受付のご連絡`,
          `${cr.name || "お客様"} 様\n\nこの度はご連絡いただきありがとうございます。\nご予約 ${resId2}（${cr.start_date || ""}〜${cr.end_date || ""}）のキャンセルを承りました。\n\n返金がある場合は、規定に沿って別途手続きのうえご連絡いたします。\nまたのご利用を心よりお待ちしております。\n\nHANDYMAN那覇空港店\nreserve@rent-handyman.com`);
        { const _nw = String(cr.ota||"")==="HANDYMAN"||/^HDMN/.test(resId2); const _nt = _nw?"（🆕NEW リニューアル公式サイト rent-handyman.com）":"";
        const m = await hdmMsg({ emoji: "✅", store: "nha", title: `キャンセル承認（確定）${_nw ? "（🆕NEW 公式サイト）" : ""}`, rid: resId2, label: _rl, body: [`💴 ¥${Number(cr.price || 0).toLocaleString()}`, "キャンセル確定・配車解放済み", "⚠️ 返金は規定（7日前無料/6-3日20%/2日前・前日30%/当日50%）に沿って Square で手動返金", `👤 対応 ${hdmWho(actor, p.actor_name)}`] });
        await slackResv(m.text, m.blocks); }
      } else {
        await notifyCust(resId2, `【HANDYMAN那覇空港店】ご予約 ${resId2} キャンセルのご相談につきまして`,
          `${cr.name || "お客様"} 様\n\n` + (staffText(p, "") || (keep ? declineMsg("", "キャンセル", "cancel", "", "", rejLine, "", "", "").replace(/はそのままです。/, "のままでのご利用をお願いできますでしょうか。") : declineMsg("", "キャンセル", "cancel", "", "", rejLine, altText, "", ""))) + `\n\nHANDYMAN那覇空港店\nreserve@rent-handyman.com`);
        { const m = await hdmMsg({ emoji: "🚫", store: "nha", title: `キャンセル却下${(String(cr.ota||"")==="HANDYMAN"||/^HDMN/.test(resId2)) ? "（🆕NEW 公式サイト）" : ""}`, rid: resId2, body: [`👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackResv(m.text, m.blocks); }
      }
      return json({ ok: true, decided: decision }, 200, origin);
    }
    // 場所・時間の依頼を承認 → 予約・OPタスク・マイページ表示へ反映（お客様の「この案でOK」も同じ道を通る）
    if (decision === "approved" && PT_FIELDS.includes(String(c.field))) {
      const pl1: any = (c.payload && typeof c.payload === "object") ? c.payload : {};
      const ap = await nhaApplyChange(resId2, String(c.field), String(pl1[c.field] || c.new_value || ""), actor, changeId);
      // 反映できなければ承認しない（お客様へも送らない・依頼は「受付」のまま残す）
      if (!ap.ok) { try { const fm = await hdmMsg({ emoji: "⚠️", store: "nha", cat: "依頼に返事／反映できない", title: "承認したが予約に反映できませんでした", rid: resId2, body: [String(ap.error || ""), "何も変更していません。管理画面でもう一度承認するか手で直してください", `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(fm.text, fm.blocks); } catch (_e) { /* */ } return json({ error: "反映できませんでした（何も変更していません）：" + (ap.error || ""), apply_failed: true }, 500, origin); }
    }
    // ★ 早め回収(ready)を承認し、希望時間(HH:MM)がある場合は諸々の表示へ自動反映
    //   ①nha_reservations.col_time/end_time ②nha_tasks の c-<予約>「変更」(＋「時間」) ③mypage_changes field=return_time status=applied
    if (decision === "approved" && c.field === "ready") {
      const hopeR = String(c.new_value || "").match(/(\d{1,2}:\d{2})/);
      if (hopeR) {
        const hope = hopeR[1];
        // 2026-11-08 早め回収の承認も「返却の時間」と同じ反映処理（1トランザクション・読み直し確認・戻し防止ロック）を通す
        const apR = await nhaApplyChange(resId2, "return_time", hope, actor, changeId);
        if (!apR.ok) { try { const fm = await hdmMsg({ emoji: "⚠️", store: "nha", cat: "依頼に返事／反映できない", title: "承認したが予約に反映できませんでした", rid: resId2, body: [String(apR.error || ""), "何も変更していません。管理画面でもう一度承認するか手で直してください", `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(fm.text, fm.blocks); } catch (_e) { /* */ } return json({ error: "反映できませんでした（何も変更していません）：" + (apR.error || ""), apply_failed: true }, 500, origin); }
      }
    }
    if (c.field === "option" || c.field === "insurance" || c.field === "method" || c.field === "extend") {
      const rv = (await sbGet("nha_reservations", `id=eq.${encodeURIComponent(resId2)}&select=name,ota,start_date,end_date,mypage_token`))[0] || {};
      const url = rv.mypage_token ? `https://nosh2318.github.io/naha-project/my-nha.html?t=${rv.mypage_token}` : "";
      let ex: any = null, m2 = "";
      if (decision === "approved") {
        const tg = c.field === "insurance" ? { insurance: String(pl0.insurance || "") } : c.field === "method" ? (pl0.target || {}) : { opt_b: pl0.opt_b, opt_c: pl0.opt_c, opt_j: pl0.opt_j };
        let ax = c.field === "extend" ? await nhaExtend(resId2, Number(pl0.days) || 0, true, actor, changeId) : c.field === "method" ? await nhaApplyMethod(resId2, tg, actor, changeId) : await nhaApplyExtra(resId2, String(c.field), tg, actor, changeId);
        // ★2026-11-14 nosh「これはバグだろ」：「変える内容がありません」＝DB が希望と今の予約を比べて同じだった時だけ出す（hdm_apply_mypage_method）→ 失敗ではなく反映済み扱い（記録だけ・承認を進める）
        if (!ax.ok && /変える内容がありません/.test(String(ax.error || ""))) ax = { ok: true, data: { detail: "今のご予約と同じ内容のため、変更はありません", amount: 0, unchanged: true } } as any;
        if (!ax.ok) { try { const fm = await hdmMsg({ emoji: "⚠️", store: "nha", cat: "依頼に返事／反映できない", title: "承認したが予約に反映できませんでした", rid: resId2, body: [String(ax.error || ""), "何も変更していません。管理画面でもう一度承認するか手で直してください", `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(fm.text, fm.blocks); } catch (_e) { /* */ } return json({ error: "反映できませんでした（何も変更していません）：" + (ax.error || ""), apply_failed: true }, 500, origin); }
        ex = ax.data;
        m2 = staffText(p, url) || `【HANDYMAN 那覇】ご依頼の${lbl}の変更を承り、反映いたしました。\n${ex?.detail || ""}${Number(ex?.amount) > 0 ? "\n追加のお支払いは、マイページの「お支払い」からお願いいたします。" : ""}${url ? "\n" + url : ""}`;
      } else {
        m2 = staffText(p, url) || declineMsg("【HANDYMAN 那覇】", lbl, String(c.field), String(c.new_value || ""), String(c.old_value || ""), rejLine, keep ? "" : altText, keep ? "" : "こちらでよろしければ、マイページから改めてご依頼ください。", url);
        if (keep) m2 = m2.replace(/はそのままです。/, "のままでのご利用をお願いできますでしょうか。");
      }
      // 差額：プラス＝Squareリンク（マイページの「お支払い」に出る）／マイナス＝返金保留（手動）
      let xl = "";
      try {
        const amt = Number(ex?.amount || 0), det = String(ex?.detail || "");
        if (decision === "approved" && amt > 0) {
          const lk = await squareLinkNha(rv.name || "", amt, resId2);
          await sbPost("mypage_extra_payments", { reservation_id: resId2, store: "nha", change_id: String(changeId), kind: c.field, detail: det, amount: amt, direction: "charge", square_order_id: lk?.orderId || null, square_url: lk?.url || null, status: lk ? "unpaid" : "link_failed" });
          if (lk?.url) { m2 += `\n\nお支払い（¥${amt.toLocaleString()}）はこちらからもできます。\n${lk.url}`; xl = `💳 追加 ¥${amt.toLocaleString()}（リンク送信済み・未入金）`; }
          else xl = `⚠️ 追加 ¥${amt.toLocaleString()}（リンクを作れませんでした＝手動でリンクを作って送ってください）`;
        } else if (decision === "approved" && amt < 0) {
          await sbPost("mypage_extra_payments", { reservation_id: resId2, store: "nha", change_id: String(changeId), kind: c.field, detail: det, amount: amt, direction: "refund", status: "refund_pending" });
          xl = `↩️ 返金 ¥${Math.abs(amt).toLocaleString()}（手動で返金してください）`;
        }
      } catch (e) { console.error("[extra-payment]", String(e)); xl = "⚠️ 差額の処理でエラー（手動で確認）"; }
      await notifyCust(resId2, `【HANDYMAN那覇空港店】ご予約 ${resId2} ご依頼の結果`, m2 + `\n\nHANDYMAN那覇空港店\nreserve@rent-handyman.com`);
      await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}`, { status: decision, actor, payload: { ...pl0, ...(decision === "rejected" ? (rejPayload as any).payload : {}), sent: m2.slice(0, 2000), ...(ex ? { applied: ex } : {}) } });
      // ★2026-11-14 nosh「承認して反映できた時は不要・反映できない時に通知」：反映できた承認は Slack に出さない（差額の手動対応がある時だけ出す・記録は mypage_changes）
      if (decision !== "approved" || /⚠️|↩️/.test(xl)) { const m = await hdmMsg({ emoji: decision === "approved" ? "✅" : "🚫", store: "nha", title: `${decision === "approved" ? "承認して反映しました" : "お断りしました"}（${lbl}）`, rid: resId2, body: [ex?.detail ? `📝 ${ex.detail}` : "", xl, `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(m.text, m.blocks); }
      return json({ ok: true, decided: decision, amount: Number(ex?.amount || 0) }, 200, origin);
    }
    let msg: string;
    if (decision === "approved") {
      msg = c.field === "ready"
        ? `【HANDYMAN 那覇】早めのご返却（回収）を承りました。\nスケジュールを調整し、回収時間が早まる場合は改めてご連絡いたします。`
        : `【HANDYMAN 那覇】ご依頼を承り、反映いたしました。マイページよりご確認ください。`;
    } else {
      if (c.field === "ready" && (keep || !altText)) msg = `【HANDYMAN 那覇】ご連絡ありがとうございます。誠に申し訳ございませんが、今回は予定のお時間での回収とさせていただきます。${rejLine ? "\n" + rejLine : ""}\n何卒ご理解いただけますと幸いです。`;
      else { const rv2 = (await sbGet("nha_reservations", `id=eq.${encodeURIComponent(resId2)}&select=mypage_token`))[0] || {}; msg = declineMsg("【HANDYMAN 那覇】", lbl, String(c.field), String(c.new_value || ""), String(c.old_value || ""), rejLine, keep ? "" : altText, keep ? "" : "こちらでよろしければ、マイページから改めてご依頼ください。", rv2.mypage_token ? `https://nosh2318.github.io/naha-project/my-nha.html?t=${rv2.mypage_token}` : ""); if (keep) msg = msg.replace(/はそのままです。/, "のままでのご利用をお願いできますでしょうか。"); }
    }
    if (decision === "rejected") { const rv3 = (await sbGet("nha_reservations", `id=eq.${encodeURIComponent(resId2)}&select=mypage_token`))[0] || {}; const st3 = staffText(p, rv3.mypage_token ? `https://nosh2318.github.io/naha-project/my-nha.html?t=${rv3.mypage_token}` : ""); if (st3) msg = st3; }
    await notifyCust(resId2, `【HANDYMAN那覇空港店】ご予約 ${resId2} ご依頼の結果`, msg.replace(/公式LINE/g, "担当") + `\n\nHANDYMAN那覇空港店\nreserve@rent-handyman.com`);  // 予約有効なうちに先に送る
    await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}`, { status: decision, actor, ...(decision === "rejected" ? { payload: { ...(rejPayload as any).payload, reject: { ...(rejPayload as any).payload.reject, sent: msg.slice(0, 2000) } } } : rejPayload) });  // 2026-11-08 送った文も記録
    const dRows = await sbGet("nha_reservations", `id=eq.${encodeURIComponent(resId2)}&select=name,ota,col_time,end_time`);
    const dr = dRows[0] || {};
    const hopeM = String(c.new_value || "").match(/(\d{1,2}:\d{2})/);
    const staffName = hdmWho(actor, p.actor_name);
    const ok2 = decision === "approved";
    { const m = await hdmMsg({ emoji: ok2 ? "✅" : "🚫", store: "nha", title: ok2 ? "早め回収を承認しました" : "早め回収を見送りました", rid: resId2, side: "back", // ★2026-11-10 共通の型
      body: [`🕐 予定の回収 ${dr.col_time || dr.end_time || "-"} → 希望 ${hopeM ? `${hopeM[1]}〜` : "指定なし"}`, ok2 ? "📩 お客様へ「早めの回収を承りました」と送信済み" : "📩 お客様へ「予定のお時間で回収します」と送信済み", `👤 対応 ${staffName}`] });
    await slackPost(m.text, m.blocks); }
    return json({ ok: true, decided: decision }, 200, origin);
  }

  // ==== 2026-11-09 追加分の入金確認（cron）：那覇の未入金を Square で照合 → 入金済みにしてお礼を送る ====
  // ==== 2026-11-10 返金待ちの一覧（アクションタブ）：減った分は手で返す → 返したらスタッフが押す（refund_pending → refunded） ====
  if (action === "refunds" || action === "refund_done") {
    const ADMIN_PIN_R = Deno.env.get("ADMIN_PIN") || "";
    if (!ADMIN_PIN_R || String(p.admin_pin || "") !== ADMIN_PIN_R) return json({ error: "PINが違います" }, 401, origin);
    if (action === "refunds") {
      const rows = await sbGet("mypage_extra_payments", `direction=eq.refund&status=in.(refund_pending,refunded)&select=id,reservation_id,store,kind,detail,amount,status,created_at,updated_at,paid_at&order=created_at.desc&limit=100`);
      return json({ ok: true, rows: rows.filter((x: any) => x.status === "refund_pending" || Date.now() - Date.parse(x.paid_at || x.updated_at || x.created_at || "") < 14 * 864e5) }, 200, origin);
    }
    const id = String(p.id || "").trim();
    if (!/^\d+$/.test(id) && !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "id が不正です" }, 400, origin);
    const cur = (await sbGet("mypage_extra_payments", `id=eq.${encodeURIComponent(id)}&direction=eq.refund&select=id,status,reservation_id,store,amount,detail`))[0];
    if (!cur) return json({ error: "見つかりません" }, 404, origin);
    if (cur.status === "refunded") return json({ ok: true, already: true }, 200, origin);
    await sbPatch("mypage_extra_payments", `id=eq.${encodeURIComponent(id)}&status=eq.refund_pending`, { status: "refunded", paid_at: new Date().toISOString() });
    { const m = await hdmMsg({ emoji: "↩️", store: cur.store === "spk" ? "spk" : "nha", title: "返金しました", rid: String(cur.reservation_id || ""), body: [`${cur.detail || ""} ¥${Math.abs(Number(cur.amount) || 0).toLocaleString()}`] }); await slackPost(m.text, m.blocks); }
    return json({ ok: true, refunded: true }, 200, origin);
  }

  // ==== 2026-11-10 未払いの一覧（アクションタブの赤い帯）：那覇・札幌（main）の 追加分（お届け・シート・補償・受け取り方）＋じゃらん事前決済の期限切れ／期限まで24時間 ====
  if (action === "unpaid") {
    const ADMIN_PIN_U = Deno.env.get("ADMIN_PIN") || "";
    if (!ADMIN_PIN_U || String(p.admin_pin || "") !== ADMIN_PIN_U) return json({ error: "PINが違います" }, 401, origin);
    const now = Date.now(), out: any[] = [];
    const KJ: Record<string, string> = { unpaid_delivery: "お届け", option: "シート", insurance: "補償", method: "受け取り方" };
    const xs = await sbGet("mypage_extra_payments", `store=in.(nha,spk)&direction=eq.charge&status=in.(unpaid,link_failed,paid)&select=id,reservation_id,store,kind,detail,amount,status,square_url,created_at,paid_at&order=created_at.desc&limit=300`);
    for (const x of xs) { if (x.status === "paid" && now - Date.parse(x.paid_at || x.created_at || "") > 14 * 864e5) continue;
      out.push({ src: "extra", kind: x.kind, kind_jp: KJ[String(x.kind)] || "追加", store: x.store, id: x.id, reservation_id: x.reservation_id, detail: x.detail, amount: Number(x.amount) || 0, status: x.status === "paid" ? "paid" : x.status }); }
    const jdue = (ld: string) => { const d = new Date(`${ld}T19:00:00+09:00`); d.setUTCDate(d.getUTCDate() - 3); return d.getTime(); };
    const today = new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
    for (const [tb, st] of [["nha_jalan_payments", "nha"], ["jalan_payments", "spk"]]) {
      const js = await sbGet(tb, `status=in.(email_sent,link_created)&lend_date=gte.${today}&select=id,reservation_id,amount,status,lend_date&limit=500`);
      for (const j of js) { const due = jdue(String(j.lend_date)); if (due - now > 24 * 3600e3) continue;
        out.push({ src: "jalan", kind: "jalan", kind_jp: "じゃらん事前決済", store: st, id: j.id, reservation_id: j.reservation_id, detail: due < now ? "事前決済の期限切れ" : "事前決済の期限まで24時間以内", amount: Number(j.amount) || 0, status: due < now ? "overdue" : "due_soon", due: new Date(due).toISOString() }); }
    }
    // 予約（名前・出発日）。キャンセル済みは外す
    const RM: Record<string, any> = {};
    for (const [tb, st] of [["nha_reservations", "nha"], ["reservations", "spk"]]) {
      const ids = [...new Set(out.filter((x) => x.store === st).map((x) => String(x.reservation_id)))];
      for (let i = 0; i < ids.length; i += 80) { const part = ids.slice(i, i + 80);
        const rs = await sbGet(tb, `id=in.(${part.map((v) => `"${v}"`).join(",")})&select=id,name,start_date,status`);
        for (const r of rs) RM[st + ":" + r.id] = r; }
    }
    const rows = out.filter((x) => { const r = RM[x.store + ":" + x.reservation_id]; return !(r && /cancel|キャンセル/i.test(String(r.status || ""))); })
      .map((x) => ({ ...x, res: RM[x.store + ":" + x.reservation_id] ? { name: RM[x.store + ":" + x.reservation_id].name, start_date: RM[x.store + ":" + x.reservation_id].start_date } : null }));
    return json({ ok: true, rows }, 200, origin);
  }

  if (action === "checkExtra") {
    const cs = Deno.env.get("CRON_SECRET");
    if (!cs || (req.headers.get("x-cron-secret") !== cs && String(p.secret || "") !== cs)) return json({ error: "認証がありません" }, 401, origin);
    const tk = Deno.env.get("SQUARE_ACCESS_TOKEN") || "";
    if (!tk) return json({ error: "SQUARE未設定" }, 503, origin);
    // 未払いのお届け：新しく見つかった分は支払いリンクを作ってマイページに出し、スタッフへ1件1回だけ知らせる。
    //   お客様が送迎・来店に戻した（＝もう未払いでない）分は取り下げる。お客様へのメッセージは送らない（マイページに出すだけ）。
    let unpNew = 0, unpDrop = 0;
    try {
      const lr = await fetch(`${SB_URL}/rest/v1/rpc/hdm_unpaid_delivery_list`, { method: "POST", headers: H, body: "{}" });
      const list: any[] = lr.ok ? await lr.json() : [];
      if (lr.ok) {
        const cur = await sbGet("mypage_extra_payments", `store=eq.nha&kind=eq.unpaid_delivery&direction=eq.charge&status=in.(unpaid,link_failed)&select=id,reservation_id,amount,detail`);
        const LM: Record<string, any> = {}; for (const x of list) LM[String(x.reservation_id)] = x;
        const paidRows = await sbGet("mypage_extra_payments", `store=eq.nha&kind=eq.unpaid_delivery&direction=eq.charge&status=eq.paid&select=reservation_id,amount`);
        const PAIDM: Record<string, number> = {}; for (const x of paidRows) PAIDM[String(x.reservation_id)] = (PAIDM[String(x.reservation_id)] || 0) + Number(x.amount || 0);
        for (const row of cur) {
          const it = LM[String(row.reservation_id)];
          const need = it ? Number(it.amount) - (PAIDM[String(row.reservation_id)] || 0) : 0;
          if (need === Number(row.amount)) { delete LM[String(row.reservation_id)]; continue; }
          await sbPatch("mypage_extra_payments", `id=eq.${encodeURIComponent(String(row.id))}&status=in.(unpaid,link_failed)`, { status: "cancelled", updated_at: new Date().toISOString() });
          if (need <= 0) { unpDrop++; { const m = await hdmMsg({ emoji: "↩️", store: "nha", title: "未払いのお届け 取り下げ", rid: String(row.reservation_id), side: "go", body: [`お客様が受け取り方を変えたため、¥${Number(row.amount).toLocaleString()} の支払いボタンを消しました`] }); await slackPost(m.text, m.blocks); } delete LM[String(row.reservation_id)]; }
        }
        for (const id of Object.keys(LM)) {
          const it = LM[id], amt = Number(it.amount) - (PAIDM[id] || 0);
          if (amt <= 0) continue;
          const lk = await squareLinkNha(String(it.name || ""), amt, id);
          await sbPost("mypage_extra_payments", { reservation_id: id, store: "nha", change_id: null, kind: "unpaid_delivery", detail: String(it.detail || "お届けの料金"), amount: amt, direction: "charge", square_order_id: lk?.orderId || null, square_url: lk?.url || null, status: lk ? "unpaid" : "link_failed" });
          unpNew++;
          const sd = String(it.start_date || "");
          { const m = await hdmMsg({ emoji: "💳", store: "nha", title: "未払いのお届け", rid: id, side: "go", body: [`${it.detail} ¥${amt.toLocaleString()}`, lk ? "マイページに支払いボタンを出しました（お客様へは未連絡）" : "⚠️ 支払いリンクを作れませんでした（手で作成）"] }); await slackPost(m.text, m.blocks); }
        }
      }
    } catch (e) { console.error("[unpaid-delivery]", String(e)); }
    const rows = await sbGet("mypage_extra_payments", `store=eq.nha&status=eq.unpaid&direction=eq.charge&square_order_id=not.is.null&select=id,reservation_id,square_order_id,amount,detail&limit=100`);
    if (!rows.length) return json({ ok: true, checked: 0, paid: 0, unpaid_new: unpNew, unpaid_drop: unpDrop }, 200, origin);
    const br = await fetch("https://connect.squareup.com/v2/orders/batch-retrieve", { method: "POST",
      headers: { Authorization: `Bearer ${tk}`, "content-type": "application/json", "Square-Version": "2024-06-04" },
      body: JSON.stringify({ location_ids: [Deno.env.get("SQUARE_LOCATION_ID_NHA") || Deno.env.get("SQUARE_LOCATION_ID") || "L8N7J9RKPN3WH"], order_ids: rows.map((x: any) => String(x.square_order_id)) }) });
    const bd = await br.json().catch(() => ({}));
    const os = Array.isArray(bd?.orders) ? bd.orders : [];
    const paid = new Set(os.filter((o: any) => o.state === "COMPLETED" || (Array.isArray(o.tenders) && o.tenders.length > 0) || (o.net_amount_due_money && Number(o.net_amount_due_money.amount) === 0 && Number(o.total_money?.amount || 0) > 0)).map((o: any) => String(o.id)));
    let n = 0;
    for (const row of rows) {
      if (!paid.has(String(row.square_order_id))) continue;
      await sbPatch("mypage_extra_payments", `id=eq.${encodeURIComponent(String(row.id))}`, { status: "paid", paid_at: new Date().toISOString() });
      await notifyCust(String(row.reservation_id), `【HANDYMAN那覇空港店】ご予約 ${row.reservation_id} 追加分のご入金確認`, `【HANDYMAN 那覇】追加分（${row.detail}）¥${Number(row.amount).toLocaleString()} のご入金を確認いたしました。ありがとうございます。\n\nHANDYMAN那覇空港店\nreserve@rent-handyman.com`);
      n++;
    }
    return json({ ok: true, checked: rows.length, paid: n, unpaid_new: unpNew, unpaid_drop: unpDrop }, 200, origin);
  }

  if (action !== "lookup" && action !== "request" && action !== "license_uploaded" && action !== "ready" && action !== "cancel_request" && action !== "proposal_reply" && action !== "update" && action !== "extend_quote") return json({ error: "unsupported action" }, 400, origin);

  const token = String(p.token || "").trim();
  if (!token || token.length < 20) return json({ error: "アクセスキーが不正です" }, 400, origin);

  // token で予約特定（那覇 nha_reservations）
  const SEL = "id,ota,name,start_date,start_time,end_date,end_time,vehicle_class,vehicle_name,insurance,people,price,status,visit_type,return_type,del_time,del_place,col_time,col_place,del_flight,opt_b,opt_c,opt_j,opt_usb,mypage_token,kd_status,kd_track_token,del_lat,del_lng,col_lat,col_lng";
  const rows = await sbGet("nha_reservations", `mypage_token=eq.${encodeURIComponent(token)}&select=${SEL}`);
  const r = rows[0];
  if (!r) return json({ error: "予約が見つかりません" }, 404, origin);
  const resId = String(r.id);
  // ★CANCELLED_ONLY_1030 キャンセル済みは「M月D日にキャンセル済みです」だけを返す（予約の中身は一切返さない／全アクション共通）
  { const _cs = String(r.status || ""); if (/cancel/i.test(_cs) || _cs.indexOf("キャンセル") >= 0) {
    let _at = "";
    try { const _lg = await sbGet("reservation_cancel_ledger", `reservation_id=eq.${encodeURIComponent(resId)}&event=eq.cancel&order=changed_at.desc&limit=1&select=changed_at`); _at = String((_lg[0] && _lg[0].changed_at) || ""); } catch (_) { /* noop */ }
    if (!_at) { try { const _u = await sbGet("nha_reservations", `id=eq.${encodeURIComponent(resId)}&select=updated_at`); _at = String((_u[0] && _u[0].updated_at) || ""); } catch (_) { /* noop */ } }
    const _t = _at ? new Date(_at).getTime() : NaN;
    const _cd = isNaN(_t) ? "" : new Date(_t + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const _msg = _cd ? `${+_cd.slice(5, 7)}月${+_cd.slice(8, 10)}日にキャンセル済みです` : "キャンセル済みです";
    return json({ ok: false, cancelled: true, cancel_date: _cd, error: _msg }, 200, origin);
  } }

  // ---- license_uploaded: お客様がマイページから免許証をアップした完了通知（Slack・那覇） ----
  if (action === "license_uploaded") {
    const cnt = Math.max(1, Math.min(20, parseInt(String(p.count || 1), 10) || 1));
    const drivers = Math.max(1, Math.min(10, parseInt(String(p.drivers || 1), 10) || 1));
    // ★2026-11-10 追加アップは既存の枚数・人数に積み上げ（旧：毎回上書き＝1人ずつ登録すると最後の1人分だけになった。高松と同じ形に）
    let totCnt = cnt, totDrv = drivers;
    try { const prev = await sbGet("license_uploads", `reservation_id=eq.${encodeURIComponent(resId)}&select=cnt,drivers`); if (prev[0]) { totCnt += Number(prev[0].cnt) || 0; totDrv += Number(prev[0].drivers) || 0; } } catch (_) { /* noop */ }
    // ★2026-11-10 お名前（マイページで1人ずつ「受け取りました」と出す）
    const inNames: string[] = (Array.isArray(p.names) ? p.names : []).map((x: unknown) => String(x || "").replace(/\s+/g, " ").trim().slice(0, 40)).filter((x: string) => x).slice(0, 10);
    let prevNames: any[] = [];
    try { const pv = await sbGet("license_uploads", `reservation_id=eq.${encodeURIComponent(resId)}&select=names`); if (pv[0] && Array.isArray(pv[0].names)) prevNames = pv[0].names; } catch (_) { /* noop */ }
    const nowIso = new Date().toISOString();
    const allNames = prevNames.concat(inNames.map((n) => ({ n, at: nowIso })));
    const blocks = [
      { type: "header", text: { type: "plain_text", text: "🪪 免許証アップロード（お客様）", emoji: true } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"}` },
        { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
        { type: "mrkdwn", text: `*ご予約元:*\n${r.ota || "-"}` },
        { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
        { type: "mrkdwn", text: `*車両クラス:*\n${r.vehicle_class || r.vehicle_name || "-"}` },
        { type: "mrkdwn", text: `*アップ枚数:*\n${cnt}枚（運転者${drivers}名）` },
      ] },
      { type: "context", elements: [ { type: "mrkdwn", text: "Googleドライブ（那覇フォルダ）に保存済み。貸渡手続きにご利用ください。" } ] },
    ];
    // OPシート「🪪免許OK」表示用にDB記録（upsert）
    try { await fetch(`${SB_URL}/rest/v1/license_uploads?on_conflict=reservation_id`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ reservation_id: resId, store: "nha", cnt: totCnt, drivers: totDrv, names: allNames, last_at: nowIso }) }); } catch (_) { /* noop */ }
    // ★2026-11-09 nosh「免許証以後通知不用」：お客様の免許証アップロードはSlackに出さない（全店）。DB記録(license_uploads)はそのまま。
    void blocks;
    return json({ ok: true, license: { cnt: totCnt, drivers: totDrv, names: allNames } }, 200, origin);
  }

  // ---- proposal_reply: お客様が別の案に返事（accept=この案でOK / decline=やめる）----
  if (action === "proposal_reply") {
    const cid = String(p.change_id || ""); const ans = String(p.answer || "");
    if (!cid || (ans !== "accept" && ans !== "decline")) return json({ error: "パラメータ不正" }, 400, origin);
    const pc = (await sbGet("mypage_changes", `id=eq.${encodeURIComponent(cid)}&store=eq.nha&reservation_id=eq.${encodeURIComponent(resId)}&select=id,field,new_value,status,payload`))[0];
    if (!pc) return json({ error: "ご提案が見つかりません" }, 404, origin);
    if (pc.status !== "proposed") return json({ ok: true, already: pc.status }, 200, origin);
    const ppl: any = (pc.payload && typeof pc.payload === "object") ? pc.payload : {}; const pr: any = ppl.proposal || {};
    const fj = FLD_JP[pc.field] || pc.field;
    if (pr.expires_at && Date.parse(pr.expires_at) < Date.now()) {
      await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(cid)}`, { status: "expired", payload: { ...ppl, proposal: { ...pr, answer: "expired", answered_at: new Date().toISOString() } } });
      return json({ ok: false, expired: true, error: "ご提案の期限が過ぎました。今のご予約のままです。" }, 200, origin);
    }
    const _pm = (emoji: string, title: string, body: string[]) => hdmMsg({ emoji, ...(/自動反映に失敗/.test(title) ? { cat: "依頼に返事／反映できない" } : {}), store: "nha", title, rid: resId, side: sideOf(pc.field), body }); // ★2026-11-10 共通の型
    if (ans === "decline") {
      await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(cid)}`, { status: "declined_by_guest", payload: { ...ppl, proposal: { ...pr, answer: "decline", answered_at: new Date().toISOString() } } });
      { const m = await _pm("↩️", `お客様が別の案を見送りました（${fj}）`, ["今の予約のまま"]); await slackPost(m.text, m.blocks); }
      return json({ ok: true, answered: "decline" }, 200, origin);
    }
    // accept：値を差し替えて requested に戻し、スタッフ承認と同じ decide を内部で呼ぶ（反映＋承認通知）
    const nv = String(pr.value || "").trim();
    await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(cid)}`, { status: "requested", ...(nv ? { new_value: pc.field === "ready" ? `返却準備完了(早め回収OK) 希望時間 ${nv}〜` : nv } : {}), payload: { ...ppl, ...(nv && pc.field !== "ready" ? { [pc.field]: nv } : {}), proposal: { ...pr, answer: "accept", answered_at: new Date().toISOString() } } });
    const ADMIN_PIN2 = Deno.env.get("ADMIN_PIN") || "";
    const dr2 = await fetch(`${SB_URL}/functions/v1/handyman-mypage-nha`, { method: "POST", headers: { "content-type": "application/json", apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, body: JSON.stringify({ action: "decide", admin_pin: ADMIN_PIN2, change_id: Number(cid) || cid, decision: "approved" }) });
    const dj: any = await dr2.json().catch(() => ({}));
    if (!dr2.ok || !dj.ok) { console.error("[proposal accept]", dr2.status, JSON.stringify(dj)); { const m = await _pm("⚠️", `お客様が別の案にOK→自動反映に失敗（${fj}）`, [dateLine(r.start_date, r.end_date, sideOf(pc.field)), "⚠️ 要承認：アクションタブで承認してください"]); await slackPost(m.text, m.blocks); } return json({ ok: true, answered: "accept", pending: true }, 200, origin); }
    { const m = await _pm("✅", `お客様が別の案にOK→確定しました（${fj}）`, [`🔁 ${pr.text || nv}`]); await slackPost(m.text, m.blocks); }
    return json({ ok: true, answered: "accept" }, 200, origin);
  }

  // ---- update: 場所・時間の変更依頼（即反映しない。アクションタブで承認→反映＋お客様へ通知）----
  //   2026-11-07 nosh：3店とも全て承認制。期限（お届け系＝出発24時間前／回収系＝返却2時間前）は目安で、期限後も受け付ける。
  if (action === "update") {
    const has = (k: string) => Object.prototype.hasOwnProperty.call(p, k);
    const vals: Record<string, string> = {};
    for (const f of PT_FIELDS) if (has(f)) vals[f] = String(p[f] || "").trim().slice(0, 200);
    if (!Object.keys(vals).length) return json({ error: "変更内容がありません" }, 400, origin);
    for (const f of ["del_place", "col_place"]) if (vals[f] !== undefined && vals[f].length < 2) return json({ error: "場所を入力してください" }, 400, origin);
    for (const f of ["lend_time", "return_time"]) if (vals[f] !== undefined && !/^\d{1,2}:\d{2}$/.test(vals[f])) return json({ error: "時間は 10:00 の形で指定してください" }, 400, origin);
    // 2026-11-08 出発（貸出日時 JST）を過ぎたら、お届け側（del_place / lend_time）の変更依頼は受け付けない（回収側はこれまでどおり）
    if ((vals.del_place !== undefined || vals.lend_time !== undefined) && r.start_date) { const _hm = String(r.start_time || r.del_time || "").match(/(\d{1,2}):(\d{2})/); const _go = Date.parse(`${r.start_date}T${_hm ? _hm[1].padStart(2, "0") + ":" + _hm[2] : "09:00"}:00+09:00`);
      if (!isNaN(_go) && Date.now() >= _go) return json({ error: "出発後はお届け・お迎えの時間と場所は変更できません" }, 409, origin); }
    // 来店のご予約はお届け場所を変更できない
    if (vals.del_place !== undefined && String(r.visit_type || "").trim() === "来店") return json({ error: "来店のご予約はお届け場所を変更できません" }, 409, origin);
    const oldOf = (f: string) => String((f === "del_place" ? r.del_place : f === "col_place" ? r.col_place : f === "lend_time" ? (r.del_time || r.start_time) : (r.col_time || r.end_time)) || "");
    const lines: string[] = [];
    const _nz = (s: unknown) => { const t = String(s ?? "").trim(); const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/); return m ? m[1].padStart(2, "0") + ":" + m[2] : t; }; const _chg = (n: string | null, c: unknown) => n !== null && _nz(n) !== _nz(c); // ★2026-11-10 変わっていない項目は依頼にも通知にも出さない
    for (const [f, v] of Object.entries(vals)) {
      if (!_chg(v, oldOf(f))) continue;
      const pay: Record<string, unknown> = { [f]: v };
      if (f === "del_place" && p.del_lat != null && p.del_lng != null) { pay.del_lat = Number(p.del_lat); pay.del_lng = Number(p.del_lng); }
      if (f === "col_place" && p.col_lat != null && p.col_lng != null) { pay.col_lat = Number(p.col_lat); pay.col_lng = Number(p.col_lng); }
      const ex = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.nha&field=eq.${f}&status=eq.requested&select=id,new_value&order=id.asc&limit=1`);
      // 2026-11-09 連打・再送対策: 受付中の依頼と同じ内容なら書き換えず、Slackにも出さない
      if (ex[0] && String(ex[0].new_value || "").trim() === v) continue;
      if (ex[0]) await sbPatch("mypage_changes", `id=eq.${ex[0].id}`, { new_value: v, payload: pay });
      else await sbPost("mypage_changes", { reservation_id: resId, store: "nha", field: f, old_value: oldOf(f), new_value: v, source: "customer", status: "requested", note: `${FLD_JP[f] || f}の変更（承認制）`, payload: pay });
      lines.push(`*${FLD_JP[f] || f}*　${oldOf(f) || "（未設定）"} → *${v}*`);
    }
    if (!lines.length) return json({ ok: true, pendingApproval: true, already: true, requested: Object.keys(vals) }, 200, origin);
    { const ks = Object.keys(vals), sd = ks.every((f) => /^(del_place|lend_time)$/.test(f)) ? "go" : ks.every((f) => /^(col_place|return_time)$/.test(f)) ? "back" : "";
    const _om = omniText(await omniAsk("nha", (await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.nha&status=eq.requested&field=in.(lend_time,return_time,del_place,col_place)&select=id`)).map((x: any) => x.id)));
    const m = await hdmMsg({ emoji: "🟡", store: "nha", title: _om ? _om.title : "場所・時間の変更依頼（承認待ち・⚠️オムニ未判断）", cat: "依頼に返事／時間・場所", rid: resId, side: sd, url: actUrl(resId), body: [dateLine(r.start_date, r.end_date, sd), ...lines, ...(_om ? _om.lines : ["⚠️ 要承認：承認で反映＋お客様へ連絡"])], buttons: [{ text: "✅ 承認画面を開く", url: actUrl(resId) }] }); // ★2026-11-10 共通の型
    await slackResv(m.text, m.blocks); }
    return json({ ok: true, pendingApproval: true, requested: Object.keys(vals) }, 200, origin);
  }

  // ---- cancel_request: HP直販予約のキャンセル申請（承認必須）。OTA予約は各OTAから申請＝受け付けない ----
  if (action === "cancel_request") {
    const st0 = String(r.status || "");
    if (st0 === "キャンセル" || st0 === "cancelled" || st0 === "cancel") return json({ ok: true, alreadyCancelled: true }, 200, origin);
    const isHP = ["HANDYMAN", "KEYDROP", "HP", "SP", "direct"].includes(String(r.ota || "")) || resId.indexOf("HDMN") === 0;
    if (!isHP) return json({ error: "OTAでご予約の場合は、ご予約された各OTAサイトからキャンセルをお申し込みください。", otaOnly: true }, 400, origin);
    const reason = String(p.reason || "").trim().slice(0, 300);
    const already = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.nha&field=eq.cancel&status=eq.requested&select=id&limit=1`);
    if (already[0]) return json({ ok: true, alreadyRequested: true }, 200, origin);
    await sbPost("mypage_changes", { reservation_id: resId, store: "nha", field: "cancel", old_value: st0, new_value: "キャンセル依頼", source: "customer", status: "requested", note: reason });
    { const _nw = String(r.ota||"")==="HANDYMAN"||/^HDMN/.test(resId);
    const m = await hdmMsg({ emoji: "🔴", store: "nha", title: `キャンセル申請（承認待ち）${_nw ? "（🆕NEW 公式サイト）" : ""}`, rid: resId, url: actUrl(resId), // ★2026-11-10 共通の型
      body: [dateLine(r.start_date, r.end_date), `📝 ${reason || "（理由の記載なし）"}`, `💴 ¥${Number(r.price || 0).toLocaleString()}`, "⚠️ 要承認：承認＝キャンセル確定＋配車解放＋お客様へ連絡（返金は規定に沿って手動Square返金）"], buttons: [{ text: "✅ キャンセル処理を開く", url: actUrl(resId) }] });
    await slackResv(m.text, m.blocks); }
    return json({ ok: true, requested: true }, 200, origin);
  }

  // ---- request: シート・補償の依頼（承認制・即反映しない）。同じ種類が確認中なら受付済みを返すだけ（Slackへ再送しない） ----
  // ★2026-11-14 日を延ばす：見積もり（何も書かない）
  if (action === "extend_quote") {
    const days = Math.round(Number(p.days) || 0);
    if (days < 1 || days > 7) return json({ error: "延ばせるのは1〜7日です" }, 400, origin);
    const q = await nhaExtend(resId, days, false);
    if (!q.ok) return json({ error: q.error || "料金を出せませんでした" }, 200, origin);
    const d = q.data || {};
    return json({ ok: true, quote: { days, priced: !!d.priced, amount: d.amount, vehicle_amount: d.vehicle_amount, insurance_amount: d.insurance_amount, old_end: d.old_end, new_end: d.new_end, lines: d.lines || [] } }, 200, origin);
  }
  if (action === "request") {
    const st0 = String(r.status || "");
    if (st0 === "キャンセル" || st0 === "cancelled" || st0 === "cancel") return json({ error: "キャンセル済みの予約は変更できません" }, 409, origin);
    const reqType = String(p.req_type || "").trim();
    // ★2026-11-14 日を延ばす（承認制）。料金は DB の見積もり（公式サイトの同じクラス・延ばす日の値段＋補償の1日分）
    if (reqType === "extend") {
      const days = Math.round(Number(p.days) || 0);
      if (days < 1 || days > 7) return json({ error: "延ばせるのは1〜7日です" }, 400, origin);
      const q = await nhaExtend(resId, days, false);
      if (!q.ok) return json({ error: q.error || "料金を出せませんでした" }, 200, origin);
      const d: any = q.data || {};
      const md = (x: unknown) => { const m = String(x || "").match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${+m[1]}/${+m[2]}` : String(x || ""); };
      const detail = `返却日 ${md(d.old_end)}→${md(d.new_end)}（${days}日）${d.priced ? `　+¥${Number(d.amount).toLocaleString()}` : "　料金はスタッフから"}`;
      const ex = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.nha&field=eq.extend&status=eq.requested&select=id,new_value&limit=1`);
      if (ex[0] && String(ex[0].new_value || "") === detail) return json({ ok: true, alreadyRequested: true, message: "同じ内容の依頼を受付済みです" }, 200, origin);
      const payload = { days, quote: d };
      if (ex[0]) await sbPatch("mypage_changes", `id=eq.${ex[0].id}`, { new_value: detail, payload });
      else await sbPost("mypage_changes", { reservation_id: resId, store: "nha", field: "extend", old_value: `返却日 ${md(d.old_end)}`, new_value: detail, source: "customer", status: "requested", note: "日を延ばす（承認制）", payload });
      { const m = await hdmMsg({ emoji: "🟡", store: "nha", title: "日を延ばす依頼（承認待ち）", rid: resId, side: "back", url: actUrl(resId), body: [dateLine(r.start_date, r.end_date), `希望　${detail}`, d.conflict ? `⚠️ 同じ車の次の予約 ${md(d.next_date)}（車の入れ替えが要ります）` : (d.next_date ? `次の予約 ${md(d.next_date)}` : "同じ車の次の予約なし"), d.priced ? "承認で返却日を延ばし、差額はSquareリンク" : "⚠️ 公式サイトの値段がないクラス：金額は手動で", "⚠️ 要承認"], buttons: [{ text: "✅ 承認／お断りを開く", url: actUrl(resId) }] });
      await slackPost(m.text, m.blocks); }
      return json({ ok: true, requested: true, amount: d.amount ?? null }, 200, origin);
    }
    // ★2026-11-10 nosh「進めて」：受け取り方・返し方の変更（送迎⇔お届け⇔来店）。料金はお店で決める（公式 1,000円／ほか 1,500円・1回ごと）
    if (reqType === "method") {
      const tg: any = (p.target && typeof p.target === "object") ? p.target : {};
      const V = ["DEL", "PUB", "来店"], R = ["COL", "BDB", "返却"], tmOk = (v: string) => /^\d{1,2}:\d{2}$/.test(v);
      const t: Record<string, string> = {};
      for (const k of ["visit_type", "del_place", "lend_time", "return_type", "col_place", "return_time"]) if (tg[k] != null && String(tg[k]).trim() !== "") t[k] = String(tg[k]).trim().slice(0, 200);
      if (t.visit_type && !V.includes(t.visit_type)) return json({ error: "受け取り方が不正です" }, 400, origin);
      if (t.return_type && !R.includes(t.return_type)) return json({ error: "返し方が不正です" }, 400, origin);
      if ((t.lend_time && !tmOk(t.lend_time)) || (t.return_time && !tmOk(t.return_time))) return json({ error: "時間は 10:00 の形で指定してください" }, 400, origin);
      const nv = t.visit_type || String(r.visit_type || ""), nr = t.return_type || String(r.return_type || "");
      if (nv === "DEL" && !(t.del_place || r.del_place)) return json({ error: "お届けの場所を入れてください" }, 400, origin);
      if (nr === "COL" && !(t.col_place || r.col_place)) return json({ error: "回収の場所を入れてください" }, 400, origin);
      if ((nv === "DEL" && t.del_place && /空港/.test(t.del_place) && !/無料送迎/.test(t.del_place)) || (nr === "COL" && t.col_place && /空港/.test(t.col_place) && !/無料送迎/.test(t.col_place))) return json({ error: "那覇空港ではお渡しできません（条例）。赤嶺駅などをお選びください" }, 400, origin);
      // 出発後は行きを変えられない（帰りはこれまでどおり）
      if ((t.visit_type || t.del_place || t.lend_time) && Date.now() >= lendStartMs(r.start_date, r.del_time || r.start_time)) return json({ error: "出発後は受け取り方を変えられません" }, 409, origin);
      const unit = methodUnit(r.ota, resId);
      const amt = ((nv === "DEL" ? 1 : 0) - (r.visit_type === "DEL" ? 1 : 0)) * unit + ((nr === "COL" ? 1 : 0) - (r.return_type === "COL" ? 1 : 0)) * unit;
      const W: Record<string, string> = { DEL: "お届け", PUB: "無料送迎", 来店: "来店", COL: "回収", BDB: "無料送迎", 返却: "返却のみ" };
      const ps: string[] = [];
      if (t.visit_type || t.del_place || t.lend_time) ps.push(`行き ${W[String(r.visit_type)] || "未定"}→${W[nv] || nv}${t.del_place ? "（" + t.del_place + "）" : ""}${t.lend_time ? " " + t.lend_time + "ごろ" : ""}`);
      if (t.return_type || t.col_place || t.return_time) ps.push(`帰り ${W[String(r.return_type)] || "未定"}→${W[nr] || nr}${t.col_place ? "（" + t.col_place + "）" : ""}${t.return_time ? " " + t.return_time + "ごろ" : ""}`);
      if (!ps.length) return json({ error: "変更内容がありません" }, 400, origin);
      const detail = ps.join(" / ") + (amt ? `（${amt > 0 ? "+" : "−"}¥${Math.abs(amt).toLocaleString()}）` : "");
      const ex = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.nha&field=eq.method&status=eq.requested&select=id,new_value&limit=1`);
      // 連打・再送対策：受付中と同じ内容なら書き換えず、Slackにも出さない
      if (ex[0] && String(ex[0].new_value || "") === detail) return json({ ok: true, alreadyRequested: true, message: "同じ内容の依頼を受付済みです" }, 200, origin);
      const oldV = `行き ${W[String(r.visit_type)] || "未定"}${r.del_place ? "（" + r.del_place + "）" : ""} / 帰り ${W[String(r.return_type)] || "未定"}${r.col_place ? "（" + r.col_place + "）" : ""}`;
      const payload = { target: t, amount: amt, unit };
      if (ex[0]) await sbPatch("mypage_changes", `id=eq.${ex[0].id}`, { new_value: detail, payload });
      else await sbPost("mypage_changes", { reservation_id: resId, store: "nha", field: "method", old_value: oldV, new_value: detail, source: "customer", status: "requested", note: "受け取り方・返し方の変更（承認制）", payload });
      { const m = await hdmMsg({ emoji: "🟡", store: "nha", title: "受け取り方の変更（承認待ち）", rid: resId, url: actUrl(resId), body: [dateLine(r.start_date, r.end_date), `今　${oldV}`, `希望　${detail}`, "⚠️ 要承認：承認で反映・差額はSquareリンク"], buttons: [{ text: "✅ 承認／お断りを開く", url: actUrl(resId) }] }); // ★2026-11-10 共通の型
      await slackPost(m.text, m.blocks); }
      return json({ ok: true, requested: true, amount: amt }, 200, origin);
    }
    if (reqType !== "option" && reqType !== "insurance") return json({ error: "リクエスト種別が不正です" }, 400, origin);
    const detail = String(p.detail || "").trim().slice(0, 300);
    if (!detail) return json({ error: "変更内容を入力してください" }, 400, origin);
    // 補償は貸出が始まったら変えられない（シートは前日19:00が目安。過ぎても依頼として受け、スタッフが可否を返す）
    if (reqType === "insurance" && Date.now() >= lendStartMs(r.start_date, r.del_time || r.start_time)) return json({ error: "ご利用開始後は、補償プランを変更できません。" }, 409, origin);
    const tg: any = (p.target && typeof p.target === "object") ? p.target : {};
    const payload = reqType === "insurance" ? { insurance: String(tg.insurance || "") } : { opt_b: Number(tg.opt_b) || 0, opt_c: Number(tg.opt_c) || 0, opt_j: Number(tg.opt_j) || 0 };
    const already = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.nha&field=eq.${reqType}&status=eq.requested&select=id&limit=1`);
    if (already[0]) return json({ ok: true, alreadyRequested: true, message: "同じ内容の依頼を受付済みです" }, 200, origin);
    const oldV = reqType === "insurance" ? String(r.insurance || "") : `ベビー${Number(r.opt_b) || 0}・チャイルド${Number(r.opt_c) || 0}・ジュニア${Number(r.opt_j) || 0}`;
    await sbPost("mypage_changes", { reservation_id: resId, store: "nha", field: reqType, old_value: oldV, new_value: detail, source: "customer", status: "requested", note: reqType === "insurance" ? "補償の変更" : "子ども用シートの追加・変更", payload });
    { const m = await hdmMsg({ emoji: "🟡", store: "nha", title: `${reqType === "insurance" ? "補償" : "子ども用シート"}の依頼（承認待ち）`, rid: resId, url: actUrl(resId), body: [dateLine(r.start_date, r.end_date), `今　${oldV}`, `希望　${detail}`, "⚠️ 要承認：承認で反映・差額はSquareリンク"], buttons: [{ text: "✅ 承認／お断りを開く", url: actUrl(resId) }] }); // ★2026-11-10 共通の型
    await slackPost(m.text, m.blocks); }
    return json({ ok: true, requested: true }, 200, origin);
  }

  // ---- ready: お客様が「返却準備完了(早め回収OK)」を申請（DEL/COL）→ 承認待ち ＋ Slack通知 ----
  if (action === "ready") {
    if (r.status === "キャンセル" || r.status === "cancelled" || r.status === "cancel") return json({ error: "キャンセル済みの予約です" }, 409, origin);
    const already = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.nha&field=eq.ready&status=eq.requested&select=id&limit=1`);
    if (already[0]) return json({ ok: true, alreadyRequested: true }, 200, origin);
    const rdyTime = (typeof p.time === "string" && /^\d{1,2}:\d{2}$/.test(String(p.time).trim())) ? String(p.time).trim() : "";
    const newVal = rdyTime ? `返却準備完了(早め回収OK) 希望時間 ${rdyTime}〜` : "返却準備完了(早め回収OK)";
    await sbPost("mypage_changes", { reservation_id: resId, store: "nha", field: "ready", old_value: "", new_value: newVal, source: "customer", status: "requested", note: rdyTime ? `希望回収時間の目安 ${rdyTime}〜` : "予定時間より早い回収OK" });
    const planned = r.col_time || r.end_time || "-";
    { const m = await hdmMsg({ emoji: "🟢", store: "nha", title: "早め回収リクエスト（承認待ち）", rid: resId, side: "back", url: actUrl(resId), // ★2026-11-10 共通の型
      body: [dateLine(r.start_date, r.end_date, "back"), `🕐 予定の回収 ${planned} → 希望 ${rdyTime ? `${rdyTime}〜` : "指定なし"}`, "⚠️ 要承認：承認でお客様へメール通知"], buttons: [{ text: "✅ 承認画面を開く", url: actUrl(resId) }] });
    await slackPost(m.text, m.blocks); }
    return json({ ok: true }, 200, origin);
  }

  // 開封記録（best-effort）。★スタッフ閲覧(ro=1)は「顧客の開封」に数えない＝利用状況ダッシュボードの誤カウント防止。
  if (!p.ro) sbPost("rpc/mypage_touch_view", { p_rid: resId, p_store: "nha" }).catch(() => {});

  // OPタスク（予約番号一致・墓標除外）＋直近の変更履歴を並列取得
  const opTasksP = sbGet("nha_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&deleted=not.is.true&select=_id,${encodeURIComponent("内容")},${encodeURIComponent("時間")},${encodeURIComponent("送迎場所")},${encodeURIComponent("集客")},${encodeURIComponent("返却")},${encodeURIComponent("送迎")},${encodeURIComponent("確定")},${encodeURIComponent("便名")},${encodeURIComponent("変更")},changed_json`);
  const chgP = sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.nha&order=created_at.desc&limit=10&select=id,field,old_value,new_value,source,status,actor,created_at,payload`);
  const licP = sbGet("license_uploads", `reservation_id=eq.${encodeURIComponent(resId)}&select=cnt,drivers,names`);
  // 2026-11-08 OPシート/タスクサマリー/個別URLと同じ読み方の現在値（承認後にスタッフがOPで直した値もここに出る）
  const effP = fetch(`${SB_URL}/rest/v1/rpc/nha_res_effective`, { method: "POST", headers: H, body: JSON.stringify({ p_res: resId }) }).then((x) => x.ok ? x.json() : null).catch(() => null);
  // ★2026-11-09 速く（nosh「読み込みが遅い」）：シートの残り台数も最初から同時に読む（前は最後に1回待っていた）。失敗したら出さないのは同じ
  const seatP = fetch(`${SB_URL}/rest/v1/rpc/hdm_seat_left`, { method: "POST", headers: H, body: JSON.stringify({ p_store: "nha", p_res: resId }) }).then((sr) => sr.ok ? sr.json() : null).catch(() => null);
  // 2026-11-09 ETC: マイページのETCの場所（写真）。VEH.specs、車両マスタで登録。読むだけ・失敗はnull
  const carP: Promise<any> = (async () => {
    try {
      const fl = await sbGet("nha_fleet", `reservation_id=eq.${encodeURIComponent(resId)}&select=vehicle_code`);
      const code = fl[0]?.vehicle_code; if (!code) return null;
      const vs = await sbGet("nha_vehicles", `code=eq.${encodeURIComponent(code)}&select=specs&limit=1`);
      const sp = (vs[0] && vs[0].specs) || {};
      return { etc_location: sp.etc_location || null, etc_image: sp.etc_image || null, fuel: sp.fuel || null };
    } catch (_) { return null; }
  })();
  const [opTasksRaw, chg, licRows, effRaw, carInfo] = await Promise.all([opTasksP, chgP, licP, effP, carP]);
  const eff: any = (effRaw && typeof effRaw === "object") ? effRaw : {};
  const licCnt = (licRows[0] && licRows[0].cnt) || 0;
  const licDrivers = (licRows[0] && licRows[0].drivers) || 0;

  // 日本語列を札幌名に正規化して resolve* を再利用
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

  // 適用済み変更(applied)を最優先（マイページ変更ログの正本）
  //   承認済みの項目は、承認時の値ではなく「今OPシートに出ている値」を出す（承認後のスタッフ修正とズレない）
  const appliedChg = (field: string): string | null => {
    const c = chg.find((x: any) => x.field === field && x.status === "applied");
    if (!c) return null;
    const now = String(eff[field] || "").trim();
    if (now) return now;
    return String(c.new_value || "").trim() ? String(c.new_value).trim() : null;
  };

  // お届け(d-)：送迎場所＝place / 時間＝time。回収(c-)：回収場所は集客(colPlace) or _ssPlace、時間＝返却(returnTime) or time。
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

  const delPlaceR = appliedChg("del_place") ?? (resolveTaskPlace(dTask) || String(r.del_place || "").trim());
  const colPlaceR = appliedChg("col_place") ?? (cColResolve || String(r.col_place || "").trim());
  const lendTimeR = appliedChg("lend_time") ?? (resolveTaskTime(dTask) || r.start_time || r.del_time || "");
  const returnTimeR = appliedChg("return_time") ?? (cTimeResolve || r.end_time || r.col_time || "");

  // オプション：reservations と tasks の大きい方
  const optBR = Math.max(Number(r.opt_b) || 0, taskOptNum(dTask, "_optB"), taskOptNum(cTask, "_optB"));
  const optCR = Math.max(Number(r.opt_c) || 0, taskOptNum(dTask, "_optC"), taskOptNum(cTask, "_optC"));
  const optJR = Math.max(Number(r.opt_j) || 0, taskOptNum(dTask, "_optJ"), taskOptNum(cTask, "_optJ"));
  const optUSBR = Math.max(Number(r.opt_usb) || 0);
  // 補償：reservations が空なら tasks.確定 にフォールバック
  const insR = String(r.insurance || "").trim() || String(dTask?.insurance || cTask?.insurance || "").trim();

  const st = String(r.status || "");
  const cancelled = st === "cancelled" || st === "キャンセル" || st === "cancel";

  // 車両状態チェック（傷）：札幌と同じく出発日 8:00 以降のみ解禁。URLは nha_fleet→nha_vehicles.plate_no→vehicle_twins.display_label(ilike)→share_token。
  const jstIso = new Date(Date.now() + 9 * 3600 * 1000).toISOString();
  const today = jstIso.slice(0, 10);
  const hh = +jstIso.slice(11, 13);
  const damageReady = !!r.start_date && (r.start_date < today || (r.start_date === today && hh >= 8));
  let damageUrl: string | null = null;
  if (damageReady) {
    try {
      const fl = await sbGet("nha_fleet", `reservation_id=eq.${encodeURIComponent(resId)}&select=vehicle_code`);
      const code = fl[0]?.vehicle_code;
      if (code) {
        // 🔴 2026-09-28根治: vehicle_code=vehicle_twins.id 完全一致(那覇56台全一致)で確実に解決する。
        //   旧: nha_vehicles.plate_no→display_label ilike は、plate_noが短い車(VTZ03=「8」)だと
        //   「8を含む全twin(2878/8469…アルファード)」に誤ヒットしlimit1で別車を拾っていた(イマイ様C260801412→アルファード②2878誤表示)。
        let tw = await sbGet("vehicle_twins", `id=eq.${encodeURIComponent(code)}&store=eq.naha&share_enabled=eq.true&select=share_token&limit=1`);
        // fallback: id不一致の車のみ plate_no を「/ <plate>」末尾一致で照合(部分一致でなく末尾で誤爆防止)
        if (!tw[0]) {
          const vs = await sbGet("nha_vehicles", `code=eq.${encodeURIComponent(code)}&select=plate_no`);
          const plate = vs[0]?.plate_no;
          if (plate) tw = await sbGet("vehicle_twins", `display_label=ilike.*/ ${encodeURIComponent(plate)}&store=eq.naha&share_enabled=eq.true&select=share_token&limit=1`);
        }
        if (tw[0]?.share_token) damageUrl = `https://nosh2318.github.io/handyman-damage/v.html?t=${tw[0].share_token}&v=v3`;
      }
    } catch (_) { /* best-effort */ }
  }

  // 履歴：mypage_changes ＋ OPタスク由来（フォーム回答/担当編集の場所・時間）を統合（札幌 pushTaskHist と同思想）
  const history: any[] = [];
  for (const c of chg) history.push({ field: c.field, value: c.new_value, old: c.old_value, at: c.created_at, source: c.source === "staff" ? "staff" : "customer_mypage", status: c.status, actor: c.actor });
  const pushTaskHist = (task: any, placeVal: string, placeField: string, timeField: string) => {
    if (!task) return;
    const cj = parseCj(task);
    const src = cj._placeSource === "manual" ? "staff" : (cj._placeSource === "customer" ? "customer_mypage" : "customer_form");
    if (src !== "customer_mypage") {
      const pv = cj._placeSource === "manual" ? (placeVal || "") : (cj._ssPlace || placeVal || "");
      const pat = cj._manualPlaceAt || cj._ssPlaceAt || "";
      if (pv && pat) history.push({ field: placeField, value: pv, at: pat, source: src, status: "applied" });
      const tv = cj._ssTime || task.time || "";
      const tat = cj._manualTimeAt || cj._ssTimeAt || "";
      if (tv && tat) history.push({ field: timeField, value: tv, at: tat, source: src, status: "applied" });
    }
  };
  pushTaskHist(dTask, dTask?.place, "del_place", "lend_time");
  pushTaskHist(cTask, (cTask?.colPlace || cTask?.place), "col_place", "return_time");
  history.sort((a: any, b: any) => String(b.at || "").localeCompare(String(a.at || "")));
  const historyTop = history.slice(0, 10);
  // 2026-11-09 シートの残り台数（この予約の期間・この予約の分は除く）。取れなければ出さない
  let seatLeft: any = null;
  seatLeft = await seatP;

  // 札幌 my.html と同一の応答形（flat reservation）＝同一レンダラで表示統一。
  // 受け渡し区分(visit_type/return_type)を追加返却＝ページ側で PUB/BDB→バス時刻表 の分岐に使う。
  return json({
    ok: true, store: "nha", label: "那覇",
    reservation: {
      id: r.id, vehicle: r.vehicle_class, ota: r.ota,
      lend_date: r.start_date, return_date: r.end_date, lend_time: lendTimeR, return_time: returnTimeR,
      name: r.name, people: r.people, status: r.status, insurance: insR,
      del_place: delPlaceR, col_place: colPlaceR,
      del_lat: r.del_lat ?? null, del_lng: r.del_lng ?? null, col_lat: r.col_lat ?? null, col_lng: r.col_lng ?? null,
      opt_b: optBR, opt_c: optCR, opt_j: optJR, opt_usb: optUSBR,
      del_flight: r.del_flight || "",
      visit_type: r.visit_type || "", return_type: r.return_type || "",
      kd_status: r.kd_status || null,
      price: Number(r.price || 0),  // 2026-10-21 オーナー指示: マイページのご予約内容に料金を表示
    },
    damage: { ready: damageReady, url: damageUrl },
    tracking: { active: r.kd_status === "delivering" || r.kd_status === "collecting", kd_status: r.kd_status || null, token: r.kd_track_token || null },
    license: { cnt: licCnt, drivers: licDrivers, names: (licRows[0] && Array.isArray(licRows[0].names)) ? licRows[0].names.map((x: any) => ({ n: String((x && x.n) || "") })).filter((x: any) => x.n) : [] },
    car: carInfo,
    pendingCancel: chg.some((c: any) => c.field === "cancel" && c.status === "requested"), readyPending: chg.some((c: any) => c.field === "ready" && c.status === "requested"),
    recentChanges: chg, history: historyTop,
    seat_stock: seatLeft,
    at: nowJst(),
  }, 200, origin);
});
