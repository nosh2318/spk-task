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
// ★2026-11-13 nosh「約款 傷 マイページ は登録できなかったら必要」：handover_signatures に書けなかった時だけ Slack に出す（お客様への返事は今のまま）。
//   同じ予約・同じ種類は12時間に1回（この関数が動いている間の記憶）。409（同じ署名が既にある）は失敗にしない
async function sbPostOk(t: string, b: unknown): Promise<boolean> {
  try { const r = await fetch(`${SB_URL}/rest/v1/${t}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(b) }); if (r.ok || r.status === 409) return true; console.error(`POST ${t}`, r.status, await r.text()); return false; }
  catch (e) { console.error(`POST ${t}`, e); return false; }
}
const FAIL_SENT = new Map<string, number>();
async function failNotify(rid: string, kind: string, what: string) {
  const k = `${rid}|${kind}`, now = Date.now();
  if (now - (FAIL_SENT.get(k) || 0) < 12 * 3600e3) return;
  FAIL_SENT.set(k, now);
  try { const m = await hdmMsg({ emoji: "⚠️", store: "tkm", title: `お客様の${kind}を登録できませんでした`, rid, side: "go", body: [what] }); await slackPost(m.text, m.blocks); } catch (e) { console.error("failNotify", e); }
}
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

// ★2026-11-09 nosh「全ての通知に統一全店」：Slack 2行目＝予約ID｜🚗車両名 ナンバー｜👤予約者名 様（bt_fleet→bt_vehicles が正）
async function resvLabel(id: unknown): Promise<string> {
  const rid = String(id ?? "").trim(); if (!rid) return "";
  const fb = "予約 " + rid;
  try {
    const url = Deno.env.get("SUPABASE_URL"), key = (()=>{ try { return (JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}") as Record<string, string>).edge || ""; } catch { return ""; } })() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return fb;
    const hd: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
    if (key.startsWith("eyJ")) hd.Authorization = "Bearer " + key;
    const r = await fetch(`${url}/rest/v1/rpc/bt_resv_label`, { method: "POST", headers: hd, body: JSON.stringify({ p_resv: rid }) });
    if (!r.ok) return fb;
    const v = await r.json();
    return typeof v === "string" && v ? v : fb;
  } catch { return fb; }
}

// ★2026-11-10 nosh「担当が紐づいてる場合は担当者名も出して」：承認待ちのSlackに OPシートの担当（d-＝貸出／c-＝返却）。無人・乗り捨てなど人でない担当は出さない
async function tantoLine(resId: string, side: "go" | "back" | "" = ""): Promise<string> { // ★2026-11-10 side：行き＝貸出(d-)だけ／帰り＝返却(c-)だけ
  try {
    const ts = await sbGet("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&deleted=not.is.true&select=_id,${encodeURIComponent("担当")}`);
    const pick = (p: string) => { const t = ts.find((x: any) => String(x._id || "").startsWith(p)); const a = String(t?.["担当"] ?? "").trim(); return a && !/無人|乗り?捨|洗車|^[（(]/.test(a) ? a : ""; };
    const d = side === "back" ? "" : pick("d-"), c = side === "go" ? "" : pick("c-");
    const parts = d && d === c ? [`貸出・返却 ${d}`] : [d ? `貸出 ${d}` : "", c ? `返却 ${c}` : ""].filter(Boolean);
    return parts.length ? `👷 *担当*　${parts.join("／")}` : "";
  } catch { return ""; }
}
// ★2026-11-10 nosh「担当でてない 管理ページリンクない」：お客様の操作の通知に 担当＋管理ページ（該当予約が開く・高松HDM=hdm_tkm）
const listUrl = (rid: string) => `https://nosh2318.github.io/spk-task/mypage-active.html?tab=list&bucket=hdm_tkm&rid=${encodeURIComponent(rid)}`;
async function tlx(resId: string, side: "go" | "back" | "", url = ""): Promise<string> { const t = await tantoLine(resId, side); return [t, `🔗 管理ページ：${url || listUrl(resId)}`].filter(Boolean).join("\n"); }
async function sbDelete(t: string, q: string): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { method: "DELETE", headers: H }); if (!r.ok) console.error(`DELETE ${t}`, await r.text()); }

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

// 顧客へメール通知（reserve@rent-handyman.com・BTプロジェクトのRESEND_API_KEYで送信）
// 2026-10-28 HDM2: site='hdm2'（新サイト予約）だけ送り元・返信先・本文の旧アドレスを reserve@hdm-rentacar.jp に。それ以外は従来どおり。
async function mailCustomer(to: string, subject: string, text: string, site?: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY"); if (!key) { console.log("[mail skip] no RESEND_API_KEY"); return false; }
  const t = String(to || "").trim();
  if (!t || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) { console.log("[mail skip] no valid email", to); return false; }
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
const FLD_JP: Record<string, string> = { mp_pickup: "行き（空港お迎え）", mp_visit: "行きの方法", mp_dropoff: "帰り（空港へ送迎）", mp_store_return: "帰りの方法", option: "子ども用シート", insurance: "補償", extend: "日を延ばす", cancel: "キャンセル" };
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
// ==== 2026-11-09 シート・補償の追加（承認制・差額はSquare。那覇・札幌と同じ形）。依頼行は bt_reservation_changes（change_type=option/insurance）
async function tkmApplyExtra(resId: string, kind: string, target: any, actor: string, changeId: unknown): Promise<{ ok: boolean; error?: string; data?: any }> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/bt_apply_mypage_extra`, { method: "POST", headers: H,
      body: JSON.stringify({ p_res: resId, p_kind: kind, p_target: target || {}, p_actor: actor, p_change_id: Number(changeId) || null }) });
    const tx = await r.text();
    if (!r.ok) { console.error("[extra]", tx); let m = tx; try { m = JSON.parse(tx).message || tx; } catch { /* noop */ } return { ok: false, error: String(m).slice(0, 300) }; }
    return { ok: true, data: JSON.parse(tx) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 300) }; }
}
// ==== 2026-11-14 日を延ばす（nosh「同じクラスの公式サイト価格との差額・日単位・同じクラスのみ」。承認制・差額はSquare）====
//   見積もりと反映は DB 関数 bt_mypage_extend（p_apply=false は何も書かない）
async function tkmExtend(resId: string, days: number, apply: boolean, actor = "", changeId?: unknown): Promise<{ ok: boolean; error?: string; data?: any }> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/bt_mypage_extend`, { method: "POST", headers: H,
      body: JSON.stringify({ p_res: resId, p_days: days, p_apply: apply, p_actor: actor, p_change_id: changeId == null || changeId === "" ? null : (Number(changeId) || null) }) });
    const tx = await r.text();
    if (!r.ok) { console.error("[tkm extend]", r.status, tx); let m = tx; try { m = JSON.parse(tx).message || tx; } catch { /* noop */ } return { ok: false, error: String(m).slice(0, 300) }; }
    return { ok: true, data: JSON.parse(tx) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 300) }; }
}
async function squareLinkTkm(name: string, amount: number, resId: string): Promise<{ url: string; orderId: string } | null> {
  const token = Deno.env.get("SQUARE_ACCESS_TOKEN") || "";
  if (!token || amount <= 0) return null;
  const loc = Deno.env.get("SQUARE_LOCATION_ID") || "L8N7J9RKPN3WH";
  try {
    const r = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", { method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", "Square-Version": "2024-06-04" },
      body: JSON.stringify({ idempotency_key: `mypxtra-tkm-${resId}-${Date.now()}`, quick_pay: { name: `高松空港店 ${name}様（${resId}）追加 子ども用シート/補償`, price_money: { amount, currency: "JPY" }, location_id: loc } }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.payment_link?.url) { console.log("[square link]", JSON.stringify(d)); return null; }
    return { url: d.payment_link.url, orderId: d.payment_link.order_id || "" };
  } catch (e) { console.error("[square link]", String(e)); return null; }
}
function lendStartMs(sd: string, st: string): number { const t = /^\d{1,2}:\d{2}$/.test(String(st || "")) ? String(st).padStart(5, "0") : "00:00"; return Date.parse(`${sd}T${t}:00+09:00`); }

async function tkmApply(resId: string, ctype: string, val: string, flight: string, actor: string, changeId: unknown): Promise<{ ok: boolean; error?: string }> {
  const f = MP_TYPES[ctype]; if (!f) return { ok: false, error: "反映できない種類です" };
  const r = await fetch(`${SB_URL}/rest/v1/rpc/bt_apply_mypage_change`, { method: "POST", headers: H,
    body: JSON.stringify({ p_res: resId, p_field: f, p_val: val, p_actor: actor, p_change_id: Number(changeId) || null, p_flight: flight || null }) });
  if (!r.ok) { const tx = await r.text(); console.error("[apply]", tx); let m = tx; try { m = JSON.parse(tx).message || tx; } catch { /* noop */ } return { ok: false, error: String(m).slice(0, 300) }; }
  return { ok: true };
}

// ★2026-11-14 nosh「一次判断をOMNI→共有①社員＝Slack 共有②担当者＝個別URL（承認待ち）→社員承認→全体反映＝通知」
//   時間・場所の依頼が来たら、まずオムニ（omni-desk chg_ask）に判断させ、Slack には「〜で承認していいですか？」として出す（元の「承認待ち」の文の代わり）。
//   オムニが答えられない時は今までの文のまま
async function omniAsk(store: string, ids: (number | string)[]): Promise<any[]> {
  try {
    const base = /ggqugvyskyiblxiycpci/.test(String(Deno.env.get("SUPABASE_URL") || "")) ? (Deno.env.get("MAIN_URL") || "https://ckrxttbnawkclshczsia.supabase.co") : String(Deno.env.get("SUPABASE_URL") || "");
    const r = await fetch(`${base}/functions/v1/omni-desk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "chg_ask", admin_pin: Deno.env.get("ADMIN_PIN") || "", store, ids: ids.map(Number).filter(Boolean) }) });
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
  if (action === "ping") return json({ ok: true, warm: true, store: "tkm" }, 200, origin);

  // ==== キャンセル承認/却下（スタッフ・承認必須。返金は手動）====
  if (action === "decide") {
    // 認証: (a) 共通PIN（全店ダッシュボード・目視承認）／(b) スタッフJWT
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
        { const m = await hdmMsg({ emoji: "💬", store: "tkm", title: `代わりの案を送りました（${lbl}）`, rid: rid, side: (MP_GO.includes(ctype) ? "go" : "back"), body: [`🔁 ${ptext}`, `⏳ お客様の返事待ち（${jstMdHm(exp)}まで）`, `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(m.text, m.blocks); }
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
        { const m = await hdmMsg({ emoji: "🚫", store: "tkm", title: `送迎の依頼をお断りしました（${lbl}）`, rid: rid, side: (MP_GO.includes(ctype) ? "go" : "back"), body: [`👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(m.text, m.blocks); }
        return json({ ok: true, decided: "rejected" }, 200, origin);
      }
      // 承認：DB関数で反映（依頼行も同じトランザクションで approved）。失敗なら 500・メールしない・依頼は受付のまま
      const val = MP_TIME.includes(ctype) ? String(pl0.time || "") : (ctype === "mp_visit" ? "来店" : "返却");
      const ap = await tkmApply(rid, ctype, val, ctype === "mp_pickup" ? String(pl0.flight || "") : "", actor, changeId);
      if (!ap.ok) { try { const fm = await hdmMsg({ emoji: "⚠️", store: "tkm", cat: "依頼に返事／反映できない", title: "承認したが予約に反映できませんでした", rid: rid, body: [String(ap.error || ""), "何も変更していません。管理画面でもう一度承認するか手で直してください", `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(fm.text, fm.blocks); } catch (_e) { /* */ } return json({ error: "反映できませんでした（何も変更していません）：" + (ap.error || ""), apply_failed: true }, 500, origin); }
      const tmv = okTime(val);
      const what = ctype === "mp_pickup" ? `行き：空港へのお迎え ${md(rv.start_date)} ${tmv}〜${pl0.flight ? `（ご搭乗便 ${pl0.flight}）` : ""}`
        : ctype === "mp_visit" ? "行き：店舗へご来店"
        : ctype === "mp_dropoff" ? `帰り：店舗から空港へのお送り ${md(rv.end_date)} ${tmv}〜` : "帰り：店舗でご返却";
      await mailCustomer(rv.mail, `【HANDYMAN高松空港店】ご予約 ${rid} ご依頼の結果`,
        nm + `【HANDYMAN 高松】ご依頼を承り、反映いたしました。\n${what}\n\nマイページでご確認いただけます。\n${url}` + FOOT, rv.site);
      // ★2026-11-14 nosh「承認して反映できた時は不要・反映できない時に通知」：反映できた承認は Slack に出さない（記録は bt_reservation_changes）
      if (false)       { const m = await hdmMsg({ emoji: "✅", store: "tkm", title: `送迎の依頼を承認して反映しました（${lbl}）`, rid: rid, side: (MP_GO.includes(ctype) ? "go" : "back"), body: [what, `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(m.text, m.blocks); }
      return json({ ok: true, decided: "approved" }, 200, origin);
    }
    // ==== 2026-11-09 シート・補償（option / insurance）：承認＝DB関数で反映＋差額はSquareリンク / お断り ====
    if (ctype === "option" || ctype === "insurance" || ctype === "extend") {
      const rv = (await sbGet("bt_reservations", `id=eq.${encodeURIComponent(rid)}&select=id,name,brand,mail,site,mypage_token`))[0];
      if (!rv) return json({ error: "予約が見つかりません" }, 404, origin);
      const lbl = FLD_JP[ctype], url = myUrl(String(rv.mypage_token || "")), nm = `${rv.name || "お客様"} 様\n\n`;
      if (decision === "proposed") return json({ error: "この種類の依頼は文でお返事します（decision=rejected＋alt_text）" }, 400, origin);
      if (decision === "rejected") {
        if (!altText && !keep) return json({ error: "代わりにできること（〜ならできます）を書いてください" }, 400, origin);
        let body = staffText(p, url);
        if (!body) { body = declineMsg("【HANDYMAN 高松】", lbl, ctype, String(c.new_value || ""), String(c.old_value || ""), rejectLine(rejCode, rejText, ctype), keep ? "" : altText, keep ? "" : "こちらでよろしければ、マイページから改めてご依頼ください。", url); if (keep) body = body.replace(/はそのままです。/, "のままでのご利用をお願いできますでしょうか。"); }
        await mailCustomer(rv.mail, `【HANDYMAN高松空港店】ご予約 ${rid} ご依頼の結果`, nm + body + FOOT, rv.site);
        await sbPatch("bt_reservation_changes", `id=eq.${cid}`, { status: "rejected", decided_by: actor, decided_at: new Date().toISOString(),
          payload: { ...pl0, reject: { reason: rejCode || "other", text: rejText, alt: altText, ...(keep ? { keep: true } : {}), by: actor, at: new Date().toISOString(), sent: body.slice(0, 2000) } } });
        { const m = await hdmMsg({ emoji: "🚫", store: "tkm", title: `${lbl}の依頼をお断りしました`, rid: rid, side: "", body: [`👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(m.text, m.blocks); }
        return json({ ok: true, decided: "rejected" }, 200, origin);
      }
      const tg = ctype === "insurance" ? { insurance: String(pl0.insurance || "") } : { opt_b: pl0.opt_b, opt_c: pl0.opt_c, opt_j: pl0.opt_j };
      const ax = ctype === "extend" ? await tkmExtend(rid, Number(pl0.days) || 0, true, actor, changeId) : await tkmApplyExtra(rid, ctype, tg, actor, changeId);
      if (!ax.ok) { try { const fm = await hdmMsg({ emoji: "⚠️", store: "tkm", cat: "依頼に返事／反映できない", title: "承認したが予約に反映できませんでした", rid: rid, body: [String(ax.error || ""), "何も変更していません。管理画面でもう一度承認するか手で直してください", `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(fm.text, fm.blocks); } catch (_e) { /* */ } return json({ error: "反映できませんでした（何も変更していません）：" + (ax.error || ""), apply_failed: true }, 500, origin); }
      const ex = ax.data || {}; const amt = Number(ex.amount || 0), det = String(ex.detail || "");
      let body = staffText(p, url) || `【HANDYMAN 高松】ご依頼の${ctype === "extend" ? "延長" : lbl + "の変更"}を承り、反映いたしました。\n${det}${amt > 0 ? "\n追加のお支払いは、マイページの「お支払い」からお願いいたします。" : ""}\n\nマイページでご確認いただけます。\n${url}`;
      let xl = "";
      try {
        if (amt > 0) {
          const lk = await squareLinkTkm(String(rv.name || ""), amt, rid);
          await sbPost("bt_extra_payments", { reservation_id: rid, change_id: String(changeId), kind: ctype, detail: det, amount: amt, direction: "charge", square_order_id: lk?.orderId || null, square_url: lk?.url || null, status: lk ? "unpaid" : "link_failed" });
          if (lk?.url) { body += `\n\nお支払い（¥${amt.toLocaleString()}）はこちらからもできます。\n${lk.url}`; xl = `💳 追加 ¥${amt.toLocaleString()}（リンク送信済み・未入金）`; }
          else xl = `⚠️ 追加 ¥${amt.toLocaleString()}（リンクを作れませんでした＝手動でリンクを作って送ってください）`;
        } else if (amt < 0) {
          await sbPost("bt_extra_payments", { reservation_id: rid, change_id: String(changeId), kind: ctype, detail: det, amount: amt, direction: "refund", status: "refund_pending" });
          xl = `↩️ 返金 ¥${Math.abs(amt).toLocaleString()}（手動で返金してください）`;
        }
      } catch (e) { console.error("[extra-payment]", String(e)); xl = "⚠️ 差額の処理でエラー（手動で確認）"; }
      await mailCustomer(rv.mail, `【HANDYMAN高松空港店】ご予約 ${rid} ご依頼の結果`, nm + body + FOOT, rv.site);
      await sbPatch("bt_reservation_changes", `id=eq.${cid}`, { status: "approved", decided_by: actor, decided_at: new Date().toISOString(), payload: { ...pl0, applied: ex, sent: body.slice(0, 2000) } });
      // ★2026-11-14 nosh「承認して反映できた時は不要・反映できない時に通知」：差額の手動対応がある時だけ出す
      if (/⚠️|↩️/.test(xl))       { const m = await hdmMsg({ emoji: "✅", store: "tkm", title: `${lbl}の依頼を承認して反映しました`, rid: rid, side: "", body: [det ? `📝 ${det}` : "", xl, `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(m.text, m.blocks); }
      return json({ ok: true, decided: "approved", amount: amt }, 200, origin);
    }
    // ---- 以下キャンセル（従来どおり）。代わりの案の「文で返す」お断り（alt_text／message_text）にも対応 ----
    if (decision === "proposed") return json({ error: "キャンセルは「この案でOK」ではなく文でお返事します（decision=rejected＋alt_text）" }, 400, origin);
    const rejPl = decision === "rejected" && (rejCode || altText || keep || p.message_text) ? { payload: { ...pl0, reject: { reason: rejCode || "other", text: rejText, alt: altText, ...(keep ? { keep: true } : {}), by: actor, at: new Date().toISOString() } } } : {};
    await sbPatch("bt_reservation_changes", `id=eq.${encodeURIComponent(String(changeId))}`, { status: decision, decided_by: actor, decided_at: new Date().toISOString(), ...rejPl });
    const rr = (await sbGet("bt_reservations", `id=eq.${encodeURIComponent(rid)}&select=id,name,ota,start_date,end_date,vehicle_class,price,mail,site,square_order_id`))[0] || { id: rid };
    const _nt = String(rr.ota || "") === "HANDYMAN" ? "（🆕NEW リニューアル公式サイト rent-handyman.com）" : "";  // 新サイト(.com)判定
    const _rl = await resvLabel(rid); // ★2026-11-09 Slack 2行目＝予約ID｜車両 ナンバー｜予約者名（配車解放より前に引く）
    if (decision === "approved") {
      // 承認＝キャンセル確定＋配車解放（返金はスタッフが規定に沿って手動でSquare返金）
      await sbPatch("bt_reservations", `id=eq.${encodeURIComponent(rid)}`, { status: "キャンセル", updated_at: new Date().toISOString() });
      await sbDelete("bt_fleet", `reservation_id=eq.${encodeURIComponent(rid)}`);
      await mailCustomer(rr.mail, `【HANDYMAN高松空港店】ご予約 ${rid} キャンセル受付のご連絡`,
        `${rr.name || "お客様"} 様\n\nこの度はご連絡いただきありがとうございます。\nご予約 ${rid}（${rr.start_date || ""}〜${rr.end_date || ""}）のキャンセルを承りました。\n\n返金がある場合は、規定に沿って別途手続きのうえご連絡いたします。\nまたのご利用を心よりお待ちしております。\n\nHANDYMAN高松空港店\nreserve@rent-handyman.com`, rr.site);
      // ★2026-11-06 支払完了日を通知に出す（Square返金時に探しやすく）。読取のみ・失敗しても承認は止めない。
      const paidAt = await paidAtJst(rid, String(rr.square_order_id || ""));
      { const m = await hdmMsg({ emoji: "✅", store: "tkm", title: `キャンセル承認（確定）${_nt ? "（🆕NEW 公式サイト）" : ""}`, rid, label: _rl, // ★2026-11-10 共通の型
        body: [`💴 ¥${Number(rr.price || 0).toLocaleString()}　支払完了日 ${paidAt}`, "キャンセル確定・配車解放済み", "⚠️ 返金は規定（7日前無料/6-3日20%/2日前・前日30%/当日50%）に沿って Square で手動返金", `👤 対応 ${actor}`] });
      await slackResv(m.text, m.blocks); }
    } else {
      // 2026-11-08 アクションタブの「代わりの案」から来たお断りは、スタッフの文（message_text）か理由＋代わりの案の文で送る。無ければ従来の文
      const rl = rejectLine(rejCode, rejText, "cancel");
      let body = staffText(p, "");
      if (!body && (altText || keep)) { body = declineMsg("", "キャンセル", "cancel", "", "", rl, keep ? "" : altText, "", ""); if (keep) body = body.replace(/はそのままです。/, "のままでのご利用をお願いできますでしょうか。"); }
      if (!body) body = `お問い合わせいただいたご予約 ${rid} のキャンセルにつきまして、恐れ入りますが今回はお受けいたしかねます。\n詳細は担当より別途ご連絡いたします。`;
      await mailCustomer(rr.mail, `【HANDYMAN高松空港店】ご予約 ${rid} キャンセルのご相談につきまして`,
        `${rr.name || "お客様"} 様\n\n${body}\n\nHANDYMAN高松空港店\nreserve@rent-handyman.com`, rr.site);
      if ((rejPl as any).payload) await sbPatch("bt_reservation_changes", `id=eq.${cid}`, { payload: { ...(rejPl as any).payload, reject: { ...(rejPl as any).payload.reject, sent: body.slice(0, 2000) } } });
      { const m = await hdmMsg({ emoji: "🚫", store: "tkm", title: `キャンセル却下${_nt ? "（🆕NEW 公式サイト）" : ""}`, rid, body: [`👤 対応 ${actor}`] }); await slackResv(m.text, m.blocks); }
    }
    return json({ ok: true, decision }, 200, origin);
  }

  // ==== 2026-11-09 追加分の入金確認（cron）：高松の未入金を Square で照合 → 入金済みにしてお礼のメール ====
  // ==== 2026-11-10 返金待ちの一覧（アクションタブ）：減った分は手で返す → 返したらスタッフが押す（refund_pending → refunded） ====
  if (action === "refunds" || action === "refund_done") {
    const ADMIN_PIN_R = Deno.env.get("ADMIN_PIN") || "";
    if (!ADMIN_PIN_R || String(p.admin_pin || "") !== ADMIN_PIN_R) return json({ error: "PINが違います" }, 401, origin);
    if (action === "refunds") {
      const rows = await sbGet("bt_extra_payments", `direction=eq.refund&status=in.(refund_pending,refunded)&select=id,reservation_id,kind,detail,amount,status,created_at,paid_at&order=created_at.desc&limit=100`);
      return json({ ok: true, rows: rows.filter((x: any) => x.status === "refund_pending" || Date.now() - Date.parse(x.paid_at || x.updated_at || x.created_at || "") < 14 * 864e5) }, 200, origin);
    }
    const id = String(p.id || "").trim();
    if (!/^\d+$/.test(id) && !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "id が不正です" }, 400, origin);
    const cur = (await sbGet("bt_extra_payments", `id=eq.${encodeURIComponent(id)}&direction=eq.refund&select=id,status,reservation_id,amount,detail`))[0];
    if (!cur) return json({ error: "見つかりません" }, 404, origin);
    if (cur.status === "refunded") return json({ ok: true, already: true }, 200, origin);
    await sbPatch("bt_extra_payments", `id=eq.${encodeURIComponent(id)}&status=eq.refund_pending`, { status: "refunded", paid_at: new Date().toISOString() });
    { const m = await hdmMsg({ emoji: "↩️", store: "tkm", title: "返金しました", rid: String(cur.reservation_id || ""), side: "", body: [`${cur.detail || ""} ¥${Math.abs(Number(cur.amount) || 0).toLocaleString()}`] }); await slackPost(m.text, m.blocks); }
    return json({ ok: true, refunded: true }, 200, origin);
  }

  // ==== 2026-11-10 未払いの一覧（アクションタブの赤い帯）：高松の 追加分（シート・補償など）＋じゃらん事前決済の期限切れ／期限まで24時間 ====
  if (action === "unpaid") {
    const ADMIN_PIN_U = Deno.env.get("ADMIN_PIN") || "";
    if (!ADMIN_PIN_U || String(p.admin_pin || "") !== ADMIN_PIN_U) return json({ error: "PINが違います" }, 401, origin);
    const now = Date.now(), out: any[] = [];
    const KJ: Record<string, string> = { option: "シート", insurance: "補償", method: "受け取り方" };
    const xs = await sbGet("bt_extra_payments", `direction=neq.refund&status=in.(unpaid,link_failed,paid)&select=id,reservation_id,kind,detail,amount,status,square_url,created_at,paid_at&order=created_at.desc&limit=300`);
    for (const x of xs) { if (x.status === "paid" && now - Date.parse(x.paid_at || x.created_at || "") > 14 * 864e5) continue;
      out.push({ src: "extra", kind: x.kind, kind_jp: KJ[String(x.kind)] || "追加", store: "tkm", id: x.id, reservation_id: x.reservation_id, detail: x.detail, amount: Number(x.amount) || 0, status: x.status }); }
    const today = new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
    const js = await sbGet("bt_reservations", `brand=eq.HDM&ota=like.*${encodeURIComponent("じゃらん")}*&paid=is.false&pay_url=not.is.null&start_date=gte.${today}&select=id,name,start_date,price,amount,status&limit=500`);
    for (const j of js) { if (/cancel|キャンセル/i.test(String(j.status || ""))) continue;
      const d = new Date(`${j.start_date}T19:00:00+09:00`); d.setUTCDate(d.getUTCDate() - 3); const due = d.getTime(); if (due - now > 24 * 3600e3) continue;
      out.push({ src: "jalan", kind: "jalan", kind_jp: "じゃらん事前決済", store: "tkm", id: j.id, reservation_id: j.id, detail: due < now ? "事前決済の期限切れ" : "事前決済の期限まで24時間以内", amount: Number(j.price || j.amount) || 0, status: due < now ? "overdue" : "due_soon", due: d.toISOString(), res: { name: j.name, start_date: j.start_date } }); }
    const ids = [...new Set(out.filter((x) => !x.res).map((x) => String(x.reservation_id)))];
    const RM: Record<string, any> = {};
    if (ids.length) { const rs = await sbGet("bt_reservations", `id=in.(${ids.map((v) => `"${v}"`).join(",")})&select=id,name,start_date,status`); for (const r of rs) RM[String(r.id)] = r; }
    const rows = out.filter((x) => !(RM[String(x.reservation_id)] && /cancel|キャンセル/i.test(String(RM[String(x.reservation_id)].status || ""))))
      .map((x) => x.res ? x : ({ ...x, res: RM[String(x.reservation_id)] ? { name: RM[String(x.reservation_id)].name, start_date: RM[String(x.reservation_id)].start_date } : null }));
    return json({ ok: true, rows }, 200, origin);
  }

  if (action === "checkExtra") {
    const cs = Deno.env.get("CRON_SECRET");
    if (!cs || (req.headers.get("x-cron-secret") !== cs && String(p.secret || "") !== cs)) return json({ error: "認証がありません" }, 401, origin);
    const tk = Deno.env.get("SQUARE_ACCESS_TOKEN") || "";
    if (!tk) return json({ error: "SQUARE未設定" }, 503, origin);
    const rows = await sbGet("bt_extra_payments", `status=eq.unpaid&direction=eq.charge&square_order_id=not.is.null&select=id,reservation_id,square_order_id,amount,detail&limit=100`);
    if (!rows.length) return json({ ok: true, checked: 0, paid: 0 }, 200, origin);
    const br = await fetch("https://connect.squareup.com/v2/orders/batch-retrieve", { method: "POST",
      headers: { Authorization: `Bearer ${tk}`, "content-type": "application/json", "Square-Version": "2024-06-04" },
      body: JSON.stringify({ location_ids: [Deno.env.get("SQUARE_LOCATION_ID") || "L8N7J9RKPN3WH"], order_ids: rows.map((x: any) => String(x.square_order_id)) }) });
    const bd = await br.json().catch(() => ({}));
    const os = Array.isArray(bd?.orders) ? bd.orders : [];
    const paid = new Set(os.filter((o: any) => o.state === "COMPLETED" || (Array.isArray(o.tenders) && o.tenders.length > 0) || (o.net_amount_due_money && Number(o.net_amount_due_money.amount) === 0 && Number(o.total_money?.amount || 0) > 0)).map((o: any) => String(o.id)));
    let n = 0;
    for (const row of rows) {
      if (!paid.has(String(row.square_order_id))) continue;
      await sbPatch("bt_extra_payments", `id=eq.${encodeURIComponent(String(row.id))}`, { status: "paid", paid_at: new Date().toISOString() });
      const rv = (await sbGet("bt_reservations", `id=eq.${encodeURIComponent(String(row.reservation_id))}&select=name,mail,site`))[0] || {};
      await mailCustomer(rv.mail, `【HANDYMAN高松空港店】ご予約 ${row.reservation_id} 追加分のご入金確認`, `${rv.name || "お客様"} 様\n\n【HANDYMAN 高松】追加分（${row.detail}）¥${Number(row.amount).toLocaleString()} のご入金を確認いたしました。ありがとうございます。` + FOOT, rv.site);
      n++;
    }
    return json({ ok: true, checked: rows.length, paid: n }, 200, origin);
  }

  if (action !== "lookup" && action !== "request" && action !== "extend_quote" && action !== "license_uploaded" && action !== "terms_signed" && action !== "damage_approved" && action !== "set_pickup" && action !== "set_return" && action !== "cancel_request" && action !== "proposal_reply") return json({ error: "unsupported action" }, 400, origin);

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
        { type: "mrkdwn", text: `*ご予約元:*\n${otaJp(r.ota)}` },
        { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
        { type: "mrkdwn", text: `*車両クラス:*\n${r.vehicle_class || r.vehicle_name || "-"}` },
        { type: "mrkdwn", text: `*アップ枚数:*\n今回${cnt}枚（運転者${drivers}名）／累計${totCnt}枚（${totDrv}名）` },
      ] },
      { type: "context", elements: [ { type: "mrkdwn", text: "Googleドライブ（高松フォルダ）に保存済み。貸渡手続きにご利用ください。" } ] },
    ];
    try { await fetch(`${SB_URL}/rest/v1/license_uploads?on_conflict=reservation_id`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ reservation_id: resId, store: "tkm", cnt: totCnt, drivers: totDrv, names: allNames, last_at: nowIso }) }); } catch (_) { /* noop */ }
    // ★2026-11-09 nosh「免許証以後通知不用」：お客様の免許証アップロードはSlackに出さない（全店）。DB記録(license_uploads)はそのまま。
    void blocks;
    return json({ ok: true, license: { cnt: totCnt, drivers: totDrv, names: allNames } }, 200, origin);
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
    const m = await hdmMsg({ emoji: "🔴", store: "tkm", title: `キャンセル申請（承認待ち）${_nt ? "（🆕NEW 公式サイト）" : ""}`, rid: resId, url: actUrl(resId), // ★2026-11-10 共通の型
      body: [dateLine(r.start_date, r.end_date), `📝 ${reason || "（理由の記載なし）"}`, `💴 ¥${Number(r.price || 0).toLocaleString()}`, "⚠️ 要承認：承認＝キャンセル確定＋配車解放＋お客様へメール（返金は規定に沿って手動Square返金）"], buttons: [{ text: "✅ キャンセル処理を開く", url: actUrl(resId) }] });
    await slackResv(m.text, m.blocks); }
    return json({ ok: true, requested: true }, 200, origin);
  }

  // ---- request: シート・補償の依頼（承認制・即反映しない）。同じ種類が確認中なら受付済みを返すだけ（Slackへ再送しない） ----
  // ★2026-11-14 日を延ばす：見積もり（何も書かない）と依頼（承認制・同じ内容の再送は Slack に出さない）
  if (action === "extend_quote" || (action === "request" && String(p.req_type || "") === "extend")) {
    if (!isHdm(r)) return json({ error: "このご予約では受け付けていません" }, 400, origin);
    const days = Math.round(Number(p.days) || 0);
    if (days < 1 || days > 7) return json({ error: "延ばせるのは1〜7日です" }, 400, origin);
    const q = await tkmExtend(resId, days, false);
    if (!q.ok) return json({ error: q.error || "料金を出せませんでした" }, 200, origin);
    const d: any = q.data || {};
    if (action === "extend_quote") return json({ ok: true, quote: { days, priced: !!d.priced, amount: d.amount, vehicle_amount: d.vehicle_amount, insurance_amount: d.insurance_amount, old_end: d.old_end, new_end: d.new_end, lines: d.lines || [] } }, 200, origin);
    const detail = `返却日 ${md(d.old_end)}→${md(d.new_end)}（${days}日）${d.priced ? `　+¥${Number(d.amount).toLocaleString()}` : "　料金はスタッフから"}`;
    const ex = await sbGet("bt_reservation_changes", `reservation_id=eq.${encodeURIComponent(resId)}&source=eq.mypage&change_type=eq.extend&status=eq.requested&select=id,new_value&limit=1`);
    if (ex[0] && String(ex[0].new_value || "") === detail) return json({ ok: true, alreadyRequested: true, message: "同じ内容の依頼を受付済みです" }, 200, origin);
    const payload = { days, quote: d };
    if (ex[0]) await sbPatch("bt_reservation_changes", `id=eq.${ex[0].id}&status=eq.requested`, { new_value: detail, payload });
    else await sbPost("bt_reservation_changes", { reservation_id: resId, change_type: "extend", field_name: "end_date", old_value: `返却日 ${md(d.old_end)}`, new_value: detail, status: "requested", changed_by: "customer", source: "mypage", payload });
    { const m = await hdmMsg({ emoji: "🟡", store: "tkm", title: "日を延ばす依頼（承認待ち）", rid: resId, url: actUrl(resId), body: [dateLine(r.start_date, r.end_date), `希望　${detail}`,
        d.conflict ? `⚠️ 同じ車の次の予約 ${md(d.next_date)}（車の入れ替えが要ります）` : (d.next_date ? `次の予約 ${md(d.next_date)}` : "同じ車の次の予約なし"),
        d.priced ? "⚠️ 要承認：承認で返却日を延ばし、差額はSquareリンク" : "⚠️ 要承認：公式サイトの値段がないクラス＝金額は手動で"], buttons: [{ text: "✅ 承認／お断りを開く", url: actUrl(resId) }] });
      await slackPost(m.text, m.blocks); }
    return json({ ok: true, requested: true, amount: d.amount ?? null }, 200, origin);
  }
  if (action === "request") {
    if (!isHdm(r)) return json({ error: "このご予約では受け付けていません" }, 400, origin);
    const reqType = String(p.req_type || "").trim();
    if (reqType !== "option" && reqType !== "insurance") return json({ error: "リクエスト種別が不正です" }, 400, origin);
    const detail = String(p.detail || "").trim().slice(0, 300);
    if (!detail) return json({ error: "変更内容を入力してください" }, 400, origin);
    if (reqType === "insurance" && Date.now() >= lendStartMs(r.start_date, r.pickup_time || r.start_time || r.del_time)) return json({ error: "ご利用開始後は、補償プランを変更できません。" }, 409, origin);
    const tg: any = (p.target && typeof p.target === "object") ? p.target : {};
    const payload = reqType === "insurance" ? { insurance: String(tg.insurance || "") } : { opt_b: Number(tg.opt_b) || 0, opt_c: Number(tg.opt_c) || 0, opt_j: Number(tg.opt_j) || 0 };
    const already = await sbGet("bt_reservation_changes", `reservation_id=eq.${encodeURIComponent(resId)}&source=eq.mypage&change_type=eq.${reqType}&status=eq.requested&select=id&limit=1`);
    if (already[0]) return json({ ok: true, alreadyRequested: true, message: "同じ内容の依頼を受付済みです" }, 200, origin);
    const oldV = reqType === "insurance" ? String(r.insurance || "") : `ベビー${Number(r.opt_b) || 0}・チャイルド${Number(r.opt_c) || 0}・ジュニア${Number(r.opt_j) || 0}`;
    await sbPost("bt_reservation_changes", { reservation_id: resId, change_type: reqType, field_name: reqType === "insurance" ? "insurance" : "opt", old_value: oldV, new_value: detail, status: "requested", changed_by: "customer", source: "mypage", payload });
    { const m = await hdmMsg({ emoji: "🟡", store: "tkm", title: `${FLD_JP[reqType]}の依頼（承認待ち）`, rid: resId, url: actUrl(resId), body: [dateLine(r.start_date, r.end_date), `今　${oldV}`, `希望　${detail}`, "⚠️ 要承認：承認で反映・差額はSquareリンク"], buttons: [{ text: "✅ 承認／お断りを開く", url: actUrl(resId) }] }); // ★2026-11-10 共通の型
    await slackPost(m.text, m.blocks); }
    return json({ ok: true, requested: true }, 200, origin);
  }

  // ---- terms_signed: お客様がマイページで貸渡約款に同意署名（じゃらんHDMは必須）→ OPシート反映 ＋ Slack通知 ----
  if (action === "terms_signed") {
    const signName = String(p.name || r.name || "").trim().slice(0, 60);
    const at = nowJst();
    // OPシート「約款」列に署名を反映（予約番号一致の全タスク・墓標除外）
    try { await sbPatch("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&deleted=not.is.true`, { [("約款")]: `同意(${signName}) ${at.slice(5, 16).replace("T", " ")}` }); } catch (_) { /* noop */ }
    // ★2026-08-09 約款の正本 handover_signatures(terms_agree) にも記録＝OPシート約款バッジ(_signMap)・bt-mail-cron が読む正本。bt_tasks.約款 はアプリ再生成で boolean false に戻り得る(R0WGF9I8で発覚)→バッジに反映されなかった。handover_signatures は永続。
    if (!(await sbPostOk("handover_signatures", { reservation_id: resId, sign_type: "terms_agree", signer_name: signName, signed_at: at, device: "mypage-tkm", signature_data: "(マイページ同意)" }))) await failNotify(resId, "約款同意", `✍️ ${signName || "-"}（約款に同意署名）`);
    // ★2026-11-13 nosh「不用停止」：この通知は Slack に出さない（記録は handover_signatures／mypage_info に残る）
    return json({ ok: true, signed: true, at }, 200, origin);
  }

  // ---- damage_approved: お客様が傷チェック（車両状態）を確認・承認署名 → 正本 handover_signatures ＋ Slack通知 ----
  if (action === "damage_approved") {
    const signName = String(p.name || r.name || "").trim().slice(0, 60);
    const at = nowJst();
    if (!(await sbPostOk("handover_signatures", { reservation_id: resId, sign_type: "damage_approve", signer_name: signName, signed_at: at, device: "mypage-tkm", signature_data: "(マイページ傷承認)" }))) await failNotify(resId, "傷チェック承認", `✍️ ${signName || "-"}（車両状態を確認・承認）`);
    // ★2026-11-13 nosh「不用停止」：この通知は Slack に出さない（記録は handover_signatures／mypage_info に残る）
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
    const _pm = (emoji: string, title: string, body: string[]) => hdmMsg({ emoji, ...(/自動反映に失敗/.test(title) ? { cat: "依頼に返事／反映できない" } : {}), store: "tkm", title, rid: resId, side: MP_GO.includes(pc.change_type) ? "go" : MP_RT.includes(pc.change_type) ? "back" : "", body }); // ★2026-11-10 共通の型
    if (ans === "decline") {
      await sbPatch("bt_reservation_changes", `id=eq.${encodeURIComponent(pcid)}`, { status: "declined_by_guest", decided_at: nowIso, payload: { ...ppl, proposal: { ...pr, answer: "decline", answered_at: nowIso } } });
      { const m = await _pm("↩️", `お客様が代わりの案を見送りました（${fj}）`, ["今の予約のまま"]); await slackPost(m.text, m.blocks); }
      return json({ ok: true, answered: "decline" }, 200, origin);
    }
    // accept：案の時間に差し替えて requested に戻し、スタッフ承認と同じ decide を内部で呼ぶ（DB関数で反映＋メール）
    const nv = okTime(String(pr.value || ""));
    if (!nv) return json({ error: "ご提案の時間が読めませんでした。お手数ですが店舗へご連絡ください。" }, 400, origin);
    await sbPatch("bt_reservation_changes", `id=eq.${encodeURIComponent(pcid)}`, { status: "requested", new_value: `${nv}〜`, payload: { ...ppl, time: nv, proposal: { ...pr, answer: "accept", answered_at: nowIso } } });
    const dr2 = await fetch(`${SB_URL}/functions/v1/handyman-mypage-tkm`, { method: "POST", headers: { "content-type": "application/json", apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify({ action: "decide", admin_pin: Deno.env.get("ADMIN_PIN") || "", change_id: Number(pcid) || pcid, decision: "approved" }) });
    const dj: any = await dr2.json().catch(() => ({}));
    if (!dr2.ok || !dj.ok) { console.error("[proposal accept]", dr2.status, JSON.stringify(dj)); { const m = await _pm("⚠️", `お客様が代わりの案にOK→自動反映に失敗（${fj}）`, [dateLine(r.start_date, r.end_date, MP_GO.includes(pc.change_type) ? "go" : MP_RT.includes(pc.change_type) ? "back" : ""), String(dj.error || "").slice(0, 200), "⚠️ 要承認：アクションタブで承認してください"]); await slackPost(m.text, m.blocks); } return json({ ok: true, answered: "accept", pending: true }, 200, origin); }
    { const m = await _pm("✅", `お客様が代わりの案にOK→確定しました（${fj}）`, [`🔁 ${pr.text || nv}`]); await slackPost(m.text, m.blocks); }
    return json({ ok: true, answered: "accept" }, 200, origin);
  }

  // ---- 2026-11-08 HDM高松：set_pickup / set_return は「依頼」として受け付ける（即反映しない）。アクションタブで承認→DB関数で反映→メール ----
  //   BUDDICAブランド（このEFでは上の越境ガードで止まる）・ブランド未確定は下の従来処理（即反映）のまま。
  // 2026-11-08 出発（貸出日時 JST）を過ぎたら、行き（空港お迎え／来店）の変更は受け付けない。依頼（HDM）と即反映（ブランド未確定）の両方。帰り（set_return）はこれまでどおり
  if (action === "set_pickup" && r.start_date) { const _hm = String(r.pickup_time || r.start_time || r.del_time || "").match(/(\d{1,2}):(\d{2})/); const _go = Date.parse(`${r.start_date}T${_hm ? _hm[1].padStart(2, "0") + ":" + _hm[2] : "09:00"}:00+09:00`);
    if (!isNaN(_go) && Date.now() >= _go) return json({ error: "出発後はお届け・お迎えの時間と場所は変更できません" }, 409, origin); }
  // ★2026-11-09 nosh「最初は必ず確定。変更は24時間前まで申請なし。それ以降は申請あり必ず」（HDM 高松）
  //   最初の登録（行き＝お迎え時間なし・来店でもない／帰り＝送迎時間なし・店舗返却でもない）と、今の時刻・新しい時刻のどちらも24時間以上先の変更は、
  //   承認と同じ DB 関数 bt_apply_mypage_change でその場で確定（ガード・上書き防止ロック・読み直し確認つき。失敗したら何も変えずにエラー）。
  //   それ以外（24時間を切った変更）は下の依頼（承認制）。omni-review 2026-11-09 条件付き→条件1・2対応。
  if ((action === "set_pickup" || action === "set_return") && isHdm(r)) {
    const go = action === "set_pickup", want = p.want !== false;
    const legDate = go ? r.start_date : r.end_date;
    const atOf = (hm: string) => { const m = String(hm || "").match(/(\d{1,2}):(\d{2})/); return legDate ? Date.parse(`${legDate}T${m ? m[1].padStart(2, "0") + ":" + m[2] : "09:00"}:00+09:00`) : NaN; };
    const curAt = atOf(go ? (r.pickup_time || r.start_time || r.del_time || "") : (r.dropoff_time || r.end_time || r.col_time || ""));
    const tmD = want ? okTime(String(p.time || "")) : "";
    if (want && !tmD) return json({ error: "時間は 9:00〜18:50（15分刻み）から選んでください" }, 400, origin);
    const newAt = want ? atOf(tmD) : curAt;
    const firstReg = go ? (!String(r.pickup_time || "").trim() && r.visit_type !== "来店") : (!String(r.dropoff_time || "").trim() && r.return_type !== "返却");
    const lim = Date.now() + 24 * 3600 * 1000;
    const early = !isNaN(curAt) && !isNaN(newAt) && curAt > lim && newAt > lim;
    if (firstReg || early) {
      const field = go ? (want ? "pickup" : "visit") : (want ? "dropoff" : "store_return");
      const flightD = go && want ? String(p.flight || "").trim().slice(0, 40) : "";
      const sameD = field === "pickup" ? (r.visit_type === "PU" && r.pickup_time === tmD && (!flightD || r.del_flight === flightD))
        : field === "visit" ? (r.visit_type === "来店" && !r.pickup_time)
        : field === "dropoff" ? (r.return_type === "BD" && r.dropoff_time === tmD) : (r.return_type === "返却" && !r.dropoff_time);
      if (sameD) return json({ ok: true, noChange: true }, 200, origin);
      const ar = await fetch(`${SB_URL}/rest/v1/rpc/bt_apply_mypage_change`, { method: "POST", headers: H, body: JSON.stringify({ p_res: resId, p_field: field, p_val: want ? tmD : "", p_actor: "customer:mypage", p_flight: flightD || null }) });
      const aj: any = await ar.json().catch(() => null);
      if (!ar.ok || !aj || aj.ok !== true) {
        console.error("bt_apply_mypage_change", ar.status, JSON.stringify(aj));
        { const m = await hdmMsg({ emoji: "⚠️", store: "tkm", title: "マイページの送迎登録を反映できませんでした", rid: resId, side: go ? "go" : "back", body: [`${field} ${tmD}`, "お客様には「反映できませんでした」と表示。必要なら手で直してください"] }); await slackPost(m.text, m.blocks); }
        return json({ error: "反映できませんでした。少し時間をおいて、もう一度お試しください" }, 500, origin);
      }
      // 反映できた後で、同じ行き／帰りの受付中の依頼・返事待ちの案を取り下げ扱いに（古い依頼が後から承認されないように）
      const nowD = new Date().toISOString();
      const exD = await sbGet("bt_reservation_changes", `reservation_id=eq.${encodeURIComponent(resId)}&source=eq.mypage&change_type=in.(${(go ? MP_GO : MP_RT).join(",")})&status=in.(requested,proposed)&select=id,payload`);
      for (const e of exD) { const epl: any = (e.payload && typeof e.payload === "object") ? e.payload : {}; await sbPatch("bt_reservation_changes", `id=eq.${e.id}`, { status: "declined_by_guest", decided_at: nowD, payload: { ...epl, superseded_by: "direct", superseded_at: nowD } }); }
      const lblD = { pickup: `🚐 空港お迎え ${tmD}〜${flightD ? " / " + flightD : ""}`, visit: "🏬 ご来店（送迎なし）", dropoff: `🚙 空港までお送り ${tmD}〜`, store_return: "🏬 店舗で返却（送迎なし）" }[field];
      // ★2026-11-10 共通の型
      // ★2026-11-14 nosh「停止」：最初の登録は Slack に出さない（予約・OPシートへの反映と記録はそのまま）。24時間前までの変更は今まで通り出す
      if (!firstReg) { const m = await hdmMsg({ emoji: "✅", store: "tkm", title: `お客様がマイページで確定（${firstReg ? "最初の登録" : "24時間前までの変更"}）`, rid: resId, side: go ? "go" : "back", body: [lblD, "予約・OPシートに反映済み（承認は不要）"] }); await slackPost(m.text, m.blocks); }
      return json({ ok: true, direct: true, field, visit_type: go ? (want ? "PU" : "来店") : undefined, return_type: go ? undefined : (want ? "BD" : "返却"), time: tmD }, 200, origin);
    }
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
    const ex = await sbGet("bt_reservation_changes", `reservation_id=eq.${encodeURIComponent(resId)}&source=eq.mypage&change_type=in.(${legs.join(",")})&status=in.(requested,proposed)&select=id,status,payload,change_type,new_value&order=id.desc`);
    for (const e of ex.filter((x: any) => x.status === "proposed")) {
      const epl: any = (e.payload && typeof e.payload === "object") ? e.payload : {};
      await sbPatch("bt_reservation_changes", `id=eq.${e.id}`, { status: "declined_by_guest", decided_at: nowIso, payload: { ...epl, proposal: { ...(epl.proposal || {}), answer: "superseded", answered_at: nowIso } } });
    }
    const req0 = ex.find((x: any) => x.status === "requested");
    // 2026-11-09 連打・再送対策: 受付中の依頼と同じ内容なら何もしない（Slackも出さない）
    if (req0 && !ex.some((x: any) => x.status === "proposed") && req0.change_type === ctype && String(req0.new_value || "") === newV && String((req0.payload || {}).flight || "") === flight)
      return json({ ok: true, pendingApproval: true, already: true, requested: ctype }, 200, origin);
    const oldV = go ? curGo(r) : curRt(r);
    const row = { change_type: ctype, field_name: go ? "visit_type" : "return_type", old_value: oldV, new_value: newV, payload: pay, changed_at: nowIso };
    if (req0) await sbPatch("bt_reservation_changes", `id=eq.${req0.id}`, row);
    else await sbPost("bt_reservation_changes", { reservation_id: resId, ...row, status: "requested", changed_by: "customer", source: "mypage" });
    const lbl = FLD_JP[ctype];
    const _om = want ? omniText(await omniAsk("tkm", (await sbGet("bt_reservation_changes", `reservation_id=eq.${encodeURIComponent(resId)}&source=eq.mypage&change_type=eq.${ctype}&status=eq.requested&select=id`)).map((x: any) => x.id))) : null;
    { const m = await hdmMsg({ emoji: "🟡", store: "tkm", title: _om ? _om.title : `送迎の変更依頼（承認待ち）`, cat: "依頼に返事／受け取り方・送迎", rid: resId, side: go ? "go" : "back", url: actUrl(resId), // ★2026-11-10 共通の型
      body: [dateLine(r.start_date, r.end_date, go ? "go" : "back"), `${lbl}　${oldV || "（未選択）"} → ${newV}`, flight ? `✈️ ご搭乗便 ${flight}` : "", ...(_om ? _om.lines : ["⚠️ 要承認：承認＝予約・OPシートへ反映＋お客様へメール／できない時は「代わりの案」"])], buttons: [{ text: "✅ 承認画面を開く", url: actUrl(resId) }] });
    await slackPost(m.text, m.blocks); }
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
        await sbPatch("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.d-*&deleted=not.is.true`, { [("内容")]: "PU", [("時間")]: tm, [("変更")]: tm, ...(flight ? { [("便名")]: flight } : {}), changed_json: _ncj }); // ★2026-11-13 お客様が入れた到着便をタスクの便名にも
      } catch (_) { /* noop */ }
      { const m = await hdmMsg({ emoji: "🚐", store: "tkm", title: "お客様が空港お迎えを希望", rid: resId, side: "go", body: [`🕐 ${tm}〜`, `✈️ ご搭乗便 ${flight || "（未入力）"}`, "OPシート d-タスクの送迎時間に反映済み"] }); await slackPost(m.text, m.blocks); } // ★2026-11-10 共通の型
      return json({ ok: true, visit_type: "PU", pickup_time: tm, del_flight: flight }, 200, origin);
    } else {
      // 店舗へ行く（来店・送迎なし）
      try { await sbPatch("bt_reservations", `id=eq.${encodeURIComponent(resId)}`, { visit_type: "来店", pickup_time: null, updated_at: new Date().toISOString() }); } catch (_) { /* noop */ }
      try {
        const _dts = await sbGet("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.d-*&deleted=not.is.true&select=_id,changed_json`);
        const _ncj = JSON.stringify({ ...(_dts[0] ? parseCj(_dts[0]) : {}), _src: "customer" });
        await sbPatch("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.d-*&deleted=not.is.true`, { [("内容")]: "来店", changed_json: _ncj });
      } catch (_) { /* noop */ }
      { const m = await hdmMsg({ emoji: "🏬", store: "tkm", title: "お客様が店舗へ来店（送迎なし）", rid: resId, side: "go", body: ["OPシート d-タスクを来店に反映済み"] }); await slackPost(m.text, m.blocks); } // ★2026-11-10 共通の型
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
      { const m = await hdmMsg({ emoji: "🚙", store: "tkm", title: "お客様が返却送迎（店舗→空港）を希望", rid: resId, side: "back", body: [`🕐 ${tm}〜`, "OPシート c-タスクの送迎時間に反映済み"] }); await slackPost(m.text, m.blocks); } // ★2026-11-10 共通の型
      return json({ ok: true, return_type: "BD", dropoff_time: tm }, 200, origin);
    } else {
      // 店舗で返却（送迎なし）
      try { await sbPatch("bt_reservations", `id=eq.${encodeURIComponent(resId)}`, { return_type: "返却", dropoff_time: null, updated_at: new Date().toISOString() }); } catch (_) { /* noop */ }
      try {
        const _cts = await sbGet("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.c-*&deleted=not.is.true&select=_id,changed_json`);
        const _ncj = JSON.stringify({ ...(_cts[0] ? parseCj(_cts[0]) : {}), _src: "customer" });
        await sbPatch("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&_id=like.c-*&deleted=not.is.true`, { [("内容")]: "返却", changed_json: _ncj });
      } catch (_) { /* noop */ }
      { const m = await hdmMsg({ emoji: "🏬", store: "tkm", title: "お客様が店舗で返却（送迎なし）", rid: resId, side: "back", body: ["OPシート c-タスクを返却に反映済み"] }); await slackPost(m.text, m.blocks); } // ★2026-11-10 共通の型
      return json({ ok: true, return_type: "返却", dropoff_time: "" }, 200, origin);
    }
  }

  // OPタスク（予約番号一致・墓標除外）＋免許アップ状態
  // ★2026-11-09 速く（nosh「読み込みが遅い」）：高松DBは混みやすく、6〜8回に分けると受付で順番待ちになる→1回にまとめる（bt_mypage_bundle）。
  //   関数が無い・失敗した時は今までの読み方に戻る（bundle=null）。
  // 2026-11-09 ETC: マイページのETCの場所（写真）。VEH.specs、車両マスタで登録。読むだけ・失敗はnull
  const carP: Promise<any> = (async () => {
    try {
      const fl = await sbGet("bt_fleet", `reservation_id=eq.${encodeURIComponent(resId)}&select=vehicle_code`);
      const code = fl[0]?.vehicle_code; if (!code) return null;
      const vs = await sbGet("bt_vehicles", `code=eq.${encodeURIComponent(code)}&select=specs&limit=1`);
      const sp = (vs[0] && vs[0].specs) || {};
      return { etc_location: sp.etc_location || null, etc_image: sp.etc_image || null, fuel: sp.fuel || null };
    } catch (_) { return null; }
  })();
  const bundle: any = await fetch(`${SB_URL}/rest/v1/rpc/bt_mypage_bundle`, { method: "POST", headers: H, body: JSON.stringify({ p_res: resId, p_mp_types: [...MP_LIST.split(","), "option", "insurance", "extend"], p_hdm: isHdm(r) }) })
    .then((x) => x.ok ? x.json() : null).then((j) => (j && typeof j === "object" && Array.isArray(j.tasks)) ? j : null).catch(() => null);
  const opTasksP = () => sbGet("bt_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&deleted=not.is.true&select=_id,${encodeURIComponent("内容")},${encodeURIComponent("時間")},${encodeURIComponent("送迎場所")},${encodeURIComponent("集客")},${encodeURIComponent("返却")},${encodeURIComponent("送迎")},${encodeURIComponent("確定")},${encodeURIComponent("便名")},${encodeURIComponent("変更")},${encodeURIComponent("約款")},changed_json`);
  const licP = () => sbGet("license_uploads", `reservation_id=eq.${encodeURIComponent(resId)}&select=cnt,drivers,names`);
  const signP = () => sbGet("handover_signatures", `reservation_id=eq.${encodeURIComponent(resId)}&sign_type=eq.terms_agree&select=id`);
  // ★2026-08-13 傷チェック承認署名の正本 handover_signatures(damage_approve)。じゃらんHDMマイページで傷確認→承認署名を追加。
  const dmgSignP = () => sbGet("handover_signatures", `reservation_id=eq.${encodeURIComponent(resId)}&sign_type=eq.damage_approve&select=signer_name,signed_at&order=signed_at.desc&limit=1`);
  const [opTasksRaw, licRows, signRows, dmgSignRows] = bundle ? [bundle.tasks, bundle.lic, bundle.sign, bundle.dmg] : await Promise.all([opTasksP(), licP(), signP(), dmgSignP()]);
  const carInfo = await carP;
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
  const effRaw = bundle ? (bundle.eff ?? null) : isHdm(r) ? await fetch(`${SB_URL}/rest/v1/rpc/bt_res_effective`, { method: "POST", headers: H, body: JSON.stringify({ p_res: resId }) }).then((x) => x.ok ? x.json() : null).catch(() => null) : null;
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
  const pcRows = bundle ? bundle.pc : await sbGet("bt_reservation_changes", `reservation_id=eq.${encodeURIComponent(resId)}&change_type=eq.cancel&status=eq.requested&select=id&limit=1`);
  const pendingCancel = !!pcRows[0];
  // 2026-11-08 HDM高松：送迎の依頼（承認待ち・代わりの案・お断り）をマイページに返す（my-tkm.html reqReplyCard / 承認待ち表示）
  const mpRows = bundle ? bundle.mp : isHdm(r) ? await sbGet("bt_reservation_changes", `reservation_id=eq.${encodeURIComponent(resId)}&source=eq.mypage&change_type=in.(${MP_LIST},option,insurance,extend)&order=id.desc&limit=10&select=id,change_type,old_value,new_value,status,payload,changed_at,decided_at`) : [];
  const recentChanges = mpRows.map((x: any) => ({ id: x.id, field: x.change_type, old_value: x.old_value, new_value: x.new_value, status: x.status, payload: x.payload || {}, created_at: x.changed_at || null, decided_at: x.decided_at || null }));
  const pendOf = (legs: string[]) => { const x = mpRows.find((y: any) => legs.includes(y.change_type) && y.status === "requested"); return x ? { type: x.change_type, value: x.new_value, time: (x.payload || {}).time || "", flight: (x.payload || {}).flight || "" } : null; };
  const pendingTransfer = { go: pendOf(MP_GO), rt: pendOf(MP_RT) };

  // 2026-11-09 シートの残り台数（この予約の期間・この予約の分は除く・両ブランド合算）。取れなければ出さない
  let seatLeft: any = null;
  if (bundle) seatLeft = bundle.seat ?? null;
  else try { const sr = await fetch(`${SB_URL}/rest/v1/rpc/bt_seat_left`, { method: "POST", headers: H, body: JSON.stringify({ p_res: resId }) }); if (sr.ok) seatLeft = await sr.json(); } catch { /* noop */ }

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
    license: { cnt: licCnt, drivers: licDrivers, names: (licRows[0] && Array.isArray(licRows[0].names)) ? licRows[0].names.map((x: any) => ({ n: String((x && x.n) || "") })).filter((x: any) => x.n) : [] },
    car: carInfo,
    terms: { required: true, signed: termsSigned, detail: termsRaw },
    // ★2026-08-09 事前決済：マイページ内に請求欄＋Squareリンク（じゃらんHDMは事前決済）。入金は checkBtPayments が自動確認→paid反映。
    payment: { required: !!r.pay_url, amount: Number(r.price || 0), pay_url: r.pay_url || "", paid: !!r.paid },
    pendingCancel: pendingCancel, readyPending: false, pendingTransfer,
    recentChanges, history: historyTop,
    seat_stock: seatLeft,
    at: nowJst(),
  }, 200, origin);
});
