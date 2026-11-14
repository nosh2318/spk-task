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
// handyman-mypage : HANDYMAN 統合マイページ（全予約ユニークURL・token認証）
// 2026-07-03 / omni  ※札幌(spk)先行。那覇(nha)は後追いで STORES に追加。
// 設計思想:
//  ・token(=mypage_token) 所持＝本人（URLはLINE個別送信のみ・非公開）。KEYDROP追跡URLと同じ信頼モデル。
//  ・変更は必ず mypage_changes に追記（上書き・消失しても検出&復元できる保険）。
//  ・確定項目は reservations.mypage_locked に印を付ける → GAS再取込/タスク自動生成は上書きしない(protect相乗り)。
//  ・変更・キャンセルは全て「申請→スタッフ承認」（2026-11-07 nosh：期限は目安・期限後も申請可・公式LINEへは誘導しない）。
//  ・service_role は関数内のみ。deploy: --no-verify-jwt
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

// 認証はbody内のmypage_token(推測不能UUID)のみ・Cookie/資格情報を一切使わない → CORSは全origin許可でよい。
// 旧実装は非allowlist origin(例:Apple Notesアプリ内WebView=Origin:null / 各種アプリ内ブラウザ)に対し固定でnosh2318.github.ioを返し、
// ブラウザ側でACAOミスマッチ→lookupがブロックされ「予約が見つかりません」になっていた(EF直叩きは成功するのに、が症状)。→ originをそのままエコー(無ければ*)。
const ALLOWED = ["https://nosh2318.github.io", "https://keydrop.jp"];
function cors(o: string | null) {
  const allow = o || "*";
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Vary": "Origin" };
}
function json(b: unknown, s: number, o: string | null) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors(o), "content-type": "application/json" } }); }

// x-hdm-actor: 監査ログ(_audit_actor)が「誰が書いたか」を区別するためのヘッダ。customer:<予約番号> / staff:<email> を載せる。
function withActor(actor?: string): Record<string, string> { return actor ? { ...H, "x-hdm-actor": actor } : H; }
async function sbGet(t: string, q: string): Promise<any[]> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { headers: H }); if (!r.ok) { console.error(`GET ${t}`, await r.text()); return []; } return await r.json(); }
async function sbPatch(t: string, q: string, b: unknown, actor?: string): Promise<boolean> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { method: "PATCH", headers: { ...withActor(actor), Prefer: "return=representation" }, body: JSON.stringify(b) }); if (!r.ok) { console.error(`PATCH ${t}`, await r.text()); return false; } const d = await r.json(); return Array.isArray(d) && d.length > 0; }
async function sbPost(t: string, b: unknown, actor?: string): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}`, { method: "POST", headers: { ...withActor(actor), Prefer: "return=minimal" }, body: JSON.stringify(b) }); if (!r.ok) console.error(`POST ${t}`, await r.text()); }

// 顧客へLINE通知（line-push 経由。誤送信ガード・userId解決・test_mode は line-push 側で担保）
async function pushLine(resvNo: string, message: string): Promise<void> {
  const secret = Deno.env.get("LINEPUSH_SECRET");
  if (!secret) { console.log("[line skip] no LINEPUSH_SECRET", resvNo); return; }
  try {
    const r = await fetch(`${SB_URL}/functions/v1/line-push`, {
      method: "POST", headers: { "content-type": "application/json", apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify({ secret, store: "spk", resv_no: resvNo, action: "mypage_decision", message }),
    });
    const d = await r.json().catch(() => ({})); if (!d.ok) console.log("[line-push]", JSON.stringify(d));
  } catch (e) { console.error("[line-push]", String(e)); }
}

async function slackPost(text: string, blocks?: unknown[]): Promise<void> {
  // マイページ関連の全通知（変更/依頼/キャンセル/承認却下/整合アラート）は #sapporo_user_action へ
  const token = Deno.env.get("SLACK_BOT_TOKEN"); const ch = Deno.env.get("SLACK_MYPAGE_CHANNEL") || "C0BER0YC6AK";
  if (!token) { console.log("[slack skip]", text); return; }
  const body: any = { channel: ch, text }; if (blocks) body.blocks = blocks;
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({})); if (!d.ok) console.error("[slack]", JSON.stringify(d)); } catch (e) { console.error("[slack]", String(e)); }
}
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

// ★新規予約(official-pay)の逆パターン：キャンセルも予約取込ch #sapporo_reservation に出す（那覇と統一）
async function slackResv(text: string, blocks?: unknown[]): Promise<void> {
  if (Deno.env.get("MYPAGE_SILENT") === "1") { console.log("[slackResv muted]", text); return; }
  const token = Deno.env.get("SLACK_BOT_TOKEN"); const ch = Deno.env.get("SLACK_SPK_RESV_CHANNEL") || "C08TDTPEB36";
  if (!token) { console.log("[slackResv skip]", text); return; }
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(blocks ? { channel: ch, text, blocks } : { channel: ch, text }) }); const d = await r.json().catch(() => ({})); if (!d.ok) console.error("[slackResv]", JSON.stringify(d)); } catch (e) { console.error("[slackResv]", String(e)); }
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

// ★2026-11-10 nosh「担当が紐づいてる場合は担当者名も出して」：承認待ちのSlackに OPシートの担当（d-＝お届け／c-＝回収）。無人・乗り捨てなど人でない担当は出さない
async function tantoLine(resId: string, side: "go" | "back" | "" = ""): Promise<string> { // ★2026-11-10 side：受け取り系＝お届け(d-)だけ／返却系＝回収(c-)だけ
  try {
    const ts = await sbGet("tasks", `reservation_id=eq.${encodeURIComponent(resId)}&deleted=not.is.true&select=_id,assignee`);
    const pick = (p: string) => { const t = ts.find((x: any) => String(x._id || "").startsWith(p)); const a = String(t?.["assignee"] ?? "").trim(); return a && !/無人|乗り?捨|洗車|^[（(]/.test(a) ? a : ""; };
    const d = side === "back" ? "" : pick("d-"), c = side === "go" ? "" : pick("c-");
    const parts = d && d === c ? [`お届け・回収 ${d}`] : [d ? `お届け ${d}` : "", c ? `回収 ${c}` : ""].filter(Boolean);
    return parts.length ? `👷 *担当*　${parts.join("／")}` : "";
  } catch { return ""; }
}
// ★2026-11-10 nosh「担当でてない 管理ページリンクない」：お客様の操作の通知すべてに 担当＋管理ページ（該当予約が開く）
const listUrl = (rid: string, ota?: string) => `https://nosh2318.github.io/spk-task/mypage-active.html?tab=list&bucket=${String(ota || "") === "KEYDROP" ? "key_spk" : "hdm_spk"}&rid=${encodeURIComponent(rid)}`;
async function tlx(resId: string, side: "go" | "back" | "", url = ""): Promise<string> { const t = await tantoLine(resId, side); return [t, `🔗 管理ページ：${url || listUrl(resId)}`].filter(Boolean).join("\n"); }
const sideOf = (f: string): "go" | "back" | "" => /^(del_place|lend_time|received)$/.test(f) ? "go" : /^(col_place|return_time|ready)$/.test(f) ? "back" : "";
// 新サイト(rent-handyman.com)判定＝ota'HANDYMAN' or id HDMS始まり
const isNewSite = (o?: string, id?: string) => String(o || "") === "HANDYMAN" || /^HDMS/.test(String(id || ""));
// 予約もと（OTA）ラベル
const OTA_JP: Record<string, string> = { J: "じゃらん", R: "楽天", S: "skyticket", O: "エアトリ", RC: "レンタカーcom", G: "GoGoOut", HP: "オフィシャル(HP)", SP: "オフィシャル(HP)", direct: "直販", KEYDROP: "KEYDROP" };
function otaJp(o?: string): string { const k = String(o || ""); return OTA_JP[k] || k || "—"; }
// 承認管理ページ（マイページ管理コンソール）URL＝承認待ちカードのボタンから飛べるように
const MGMT_URL = "https://nosh2318.github.io/spk-task/mypage-admin.html?bucket=but_tkm";
// 2026-11-07 キャンセル申請などは該当予約をアクションタブで直接開く（札幌=hdm_spk）
const actUrl = (rid: string) => `https://nosh2318.github.io/spk-task/mypage-active.html?tab=action&bucket=hdm_spk&rid=${encodeURIComponent(rid)}`;
// マイページ通知カード（統一フォーマット）＝ 見出し＋基本情報(お客様/予約番号/予約もと/利用/車両)＋内容＋対応の要否
const STAFF_CARD = /^(承認して反映|却下しました)/; // スタッフの承認・却下カード（担当＝承認者を出す）には付けない
type MpCard = { emoji: string; title: string; name: string; resId: string; ota?: string; period?: string; vehicle?: string; lines?: string[]; action: string; lbl?: string; side?: "go" | "back" | "" }; // lbl＝★2026-11-09 Slack 2行目＝予約ID｜車両 ナンバー｜予約者名
// ★2026-11-12 依頼者「承認依頼に該当の日付も。開かないと急ぎ度が分からない」：承認待ちの通知に 📅 該当日（お届け側=お届け日／回収側=回収日／両方=両方）＋今日・明日の目印。予約(reservations)の日付を1件読むだけ
async function dateLine(resId: string, side: "go" | "back" | "" = ""): Promise<string> {
  try {
    const rr = (await sbGet("reservations", `id=eq.${encodeURIComponent(resId)}&select=lend_date,return_date&limit=1`))[0]; if (!rr) return "";
    const td = jstToday(), tm = new Date(Date.parse(td + "T00:00:00Z") + 86400e3).toISOString().slice(0, 10);
    const f = (d: unknown) => { const s = String(d || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ""; const j = new Date(s + "T00:00:00Z"); return `${j.getUTCMonth() + 1}/${j.getUTCDate()}(${"日月火水木金土"[j.getUTCDay()]})${s === td ? "【今日】" : s === tm ? "【明日】" : ""}`; };
    const g = f(rr.lend_date), b = f(rr.return_date);
    const parts = side === "go" ? [g && `*お届け日*　${g}`] : side === "back" ? [b && `*回収日*　${b}`] : [g && `*お届け日*　${g}`, b && `*回収日*　${b}`];
    const p = parts.filter(Boolean); return p.length ? `📅 ${p.join("　／　")}` : "";
  } catch { return ""; }
}
async function mpCard(c: MpCard): Promise<{ text: string; blocks: unknown[] }> { // ★2026-11-10 共通の型（hdmMsg）で組む
  const req = /管理コンソール/.test(c.action) && !!c.resId;
  const dl = req ? await dateLine(c.resId, c.side || "") : "";
  return await hdmMsg({ emoji: c.emoji, store: String(c.ota || "") === "KEYDROP" ? "kd_spk" : "spk", title: c.title, rid: c.resId, side: STAFF_CARD.test(c.title) ? "" : (c.side || ""),
    body: [dl, ...(c.lines || []), c.action.replace(/\*?要(承認|対応)\*?：管理コンソール →「🔔変更依頼」で/, "要$1：")], url: req ? actUrl(c.resId) : undefined, buttons: req ? [{ text: "✅ 承認画面を開く", url: actUrl(c.resId) }] : undefined });
}
async function notifySlackCard(c: MpCard): Promise<void> {
  if (Deno.env.get("MYPAGE_SILENT") === "1") { console.log("[slack muted]", c.title); return; }
  const { text, blocks } = await mpCard(c); await slackPost(text, blocks);
}
async function notifySlack(text: string): Promise<void> {
  // 一時ミュート（MYPAGE_SILENT=1 の間はSlack通知を出さない＝開発/テスト中の混乱防止）
  if (Deno.env.get("MYPAGE_SILENT") === "1") { console.log("[slack muted]", text); return; }
  await slackPost(text);
}

// 店舗マップ（P1=spk）。那覇は resv:nha_reservations, 列エイリアスで札幌名に揃える。
const STORES: Record<string, any> = {
  spk: {
    resv: "reservations", fleet: "fleet", tasks: "tasks", label: "札幌",
    sel: "id,ota,vehicle,lend_date,return_date,lend_time,return_time,del_time,col_time,name,mail,people,price,status,insurance,opt_b,opt_c,opt_j,opt_usb,del_place,col_place,del_lat,del_lng,col_lat,col_lng,kd_status,kd_track_token,mypage_locked",
    lendTimeCol: "lend_time", returnTimeCol: "return_time",
  },
};

// 営業時間内・30分刻み（9:00〜19:00・曜日問わず）
function validTime(t: string): boolean { const m = /^(\d{1,2}):(\d{2})$/.exec(t); if (!m) return false; const h = +m[1], mi = +m[2]; if (mi % 30 !== 0) return false; const v = h * 60 + mi; return v >= 540 && v <= 1140; }
// 場所は札幌市内限定・新千歳空港(千歳市)は不可。lat/lngがあれば札幌市域で判定、無ければ「札幌」表記を要求。
function isChitose(s: string): boolean { return /新千歳|千歳空港|千歳市/i.test(s || "") || /(^|[^A-Za-z])CTS([^A-Za-z]|$)/.test(s || ""); }
function inSapporo(lat: number, lng: number): boolean { return lat >= 42.90 && lat <= 43.30 && lng >= 141.15 && lng <= 141.62; }
function placeError(place: string, lat: number | null, lng: number | null): string | null {
  if (isChitose(place)) return "新千歳空港・千歳市は対象外です。札幌市内の場所をご指定ください。";
  if (lat != null && lng != null) { return inSapporo(lat, lng) ? null : "札幌市内の場所をご指定ください（新千歳空港など市外は不可）。"; }
  // ピン座標が無い自由入力は「札幌」表記必須をやめる（すすきの/大通/丘珠/カタカナ名等の有効な場所が弾かれないように）。市外の明示(新千歳/千歳)のみ上でブロック。
  return null;
}
// 基準日時まで hours 時間以内か（JST基準・雑に安全側）。日付なしは false（=まだ余裕あり扱い）。
function withinHours(date: string, time: string, hours: number): boolean {
  if (!date) return false;
  const t = (time && /^\d{1,2}:\d{2}$/.test(time)) ? time : "09:00";
  const dep = new Date(`${date}T${t}:00+09:00`).getTime();
  return (dep - Date.now()) < hours * 3600 * 1000;
}
function within24h(lendDate: string, lendTime: string): boolean { return withinHours(lendDate, lendTime, 24); }
// オプション受付期限＝貸出前日19:00（= 貸出日00:00 の 5時間前）
function pastOptionDeadline(lendDate: string): boolean {
  if (!lendDate) return false;
  const cutoff = new Date(`${lendDate}T00:00:00+09:00`).getTime() - 5 * 3600 * 1000;
  return Date.now() >= cutoff;
}
// 補償受付期限＝貸出前まで（貸出開始後は不可）
function pastInsDeadline(lendDate: string, lendTime: string): boolean {
  if (!lendDate) return false;
  const t = (lendTime && /^\d{1,2}:\d{2}$/.test(lendTime)) ? lendTime : "09:00";
  return Date.now() >= new Date(`${lendDate}T${t}:00+09:00`).getTime();
}
// 2026-11-08 nosh「出発済みのユーザーがお届け場所や時間を変更しても意味がないのでロック」:
//   お届け(DEL)が終わった＝お届けタスク済／お客様の受取報告／貸出中以降(kd_status)／貸出日を過ぎた、のどれかなら
//   お届け場所・お届け時間の変更依頼は受け付けない（回収の場所・時間はこれまでどおり申請できる）。
function jstToday(): string { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
function delHandedOver(r: any, dTask: any, received: boolean): boolean {
  if (received) return true;
  if (dTask && dTask.done === true) return true;
  if (["active", "collecting", "completed"].includes(String(r.kd_status || ""))) return true;
  return !!r.lend_date && jstToday() > String(r.lend_date);
}
// ==== 差額決済（追加オプション/補償）====
const OPT_UNIT: Record<string, number> = { opt_c: 1000, opt_j: 500, opt_b: 1000 }; // 1レンタルあたり/台
const INS_DAY: Record<string, number> = { "なし": 0, "免責": 1100, "NOC": 1650 };  // 1日あたり
function insPriceOf(v: string): number { if (/フル|NOC|安心/.test(v)) return 1650; if (/免責|CDW/.test(v)) return 1100; return 0; }
// 暦日数：7/10 19:00-7/11 9:00 = 2日（= 日付差+1、最低1）
function calDays(lend: string, ret: string): number {
  if (!lend) return 1;
  const a = new Date(`${lend}T00:00:00+09:00`).getTime();
  const b = new Date(`${(ret || lend)}T00:00:00+09:00`).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}
async function squareLink(name: string, amount: number, resId: string): Promise<{ url: string; orderId: string } | null> {
  const token = Deno.env.get("SQUARE_ACCESS_TOKEN") || "";
  if (!token || amount <= 0) return null;
  const loc = Deno.env.get("SQUARE_LOCATION_ID") || "L8N7J9RKPN3WH";
  try {
    const r = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", "Square-Version": "2024-06-04" },
      body: JSON.stringify({ idempotency_key: `mypxtra-${resId}-${Date.now()}`, quick_pay: { name: `札幌店 ${name}様（${resId}）追加オプション/補償`, price_money: { amount, currency: "JPY" }, location_id: loc } }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.payment_link?.url) { console.log("[square link]", JSON.stringify(d)); return null; }
    return { url: d.payment_link.url, orderId: d.payment_link.order_id || "" };
  } catch (e) { console.error("[square link]", String(e)); return null; }
}
function nowJst(slice = false): string { const s = new Date(Date.now() + 9 * 3600 * 1000).toISOString(); return slice ? s.slice(5, 16).replace("T", " ") : s.replace("Z", "+09:00"); }

// OPシート/my-admin と同一の場所解決式。SPKでは実際の場所は reservations でなく tasks(changed_json._ssPlace) にある。
// _placeSource==="manual" なら手入力(place)を優先、それ以外は SSパトロール値(_ssPlace) を優先。
function resolveTaskPlace(t: any): string {
  if (!t) return "";
  let cj = t.changed_json;
  if (typeof cj === "string") { try { cj = JSON.parse(cj); } catch { cj = {}; } }
  cj = cj || {};
  const place = String(t.place || "");
  if (cj._placeSource === "manual") return place;
  return String(cj._ssPlace || place || "");
}
function resolveTaskTime(t: any): string {
  if (!t) return "";
  let cj = t.changed_json;
  if (typeof cj === "string") { try { cj = JSON.parse(cj); } catch { cj = {}; } }
  cj = cj || {};
  return String(cj._timeChange || cj._ssTime || t.time || "");  // OPシートと同じ優先(_timeChange最優先)
}
// オプション数量を tasks(changed_json._optB/_optC/_optJ) から取得（reservations と大きい方を採用）。
function taskOptNum(t: any, key: string): number {
  if (!t) return 0;
  let cj = t.changed_json;
  if (typeof cj === "string") { try { cj = JSON.parse(cj); } catch { cj = {}; } }
  cj = cj || {};
  return Number(cj[key]) || 0;
}

// 2026-11-08 場所・時間の反映は DB 関数 spk_apply_mypage_change に一本化（那覇 nha_apply_mypage_change と同じ設計）。
//   予約・OPタスク(d-/c-)・記録(mypage_changes applied 行＋依頼の approved)を1トランザクションで書き、OPシートと同じ読み方で
//   読み直して承認値になっていなければ全部取り消す。承認値は changed_json._mpLock で取込・SSパトロール・古い画面の保存から守る。
//   旧 applyPlaceTime / patchTasksSpk（予約 PATCH → applied 行 → タスク PATCH を別々に送り、途中失敗や後からの上書きで食い違っていた）は廃止。
const SPK_PT_FIELDS = ["del_place", "col_place", "lend_time", "return_time"];
async function spkApplyChange(resId: string, field: string, val: unknown, actor: string, changeId: unknown, lat: unknown, lng: unknown, hdrActor?: string): Promise<{ ok: boolean; error?: string; data?: any }> {
  const v = String(val ?? "").trim();
  if (!SPK_PT_FIELDS.includes(field)) return { ok: false, error: "反映できない項目です: " + field };
  if (!v) return { ok: false, error: "反映する値が空です" };
  const la = lat == null || lat === "" ? NaN : Number(lat), ln = lng == null || lng === "" ? NaN : Number(lng);
  const ll = Number.isFinite(la) && Number.isFinite(ln) && (field === "del_place" || field === "col_place");
  const cid = changeId == null || changeId === "" ? null : (Number(changeId) || null);
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/spk_apply_mypage_change`, { method: "POST", headers: withActor(hdrActor),
      body: JSON.stringify({ p_res: resId, p_field: field, p_val: v, p_actor: actor, p_change_id: cid, p_lat: ll ? la : null, p_lng: ll ? ln : null }) });
    const tx = await r.text();
    if (!r.ok) { console.error("[spk apply]", r.status, tx); let m = tx; try { m = JSON.parse(tx).message || tx; } catch { /* noop */ } return { ok: false, error: String(m).slice(0, 300) }; }
    let d: any = null; try { d = JSON.parse(tx); } catch { /* noop */ }
    return { ok: true, data: d };
  } catch (e) { console.error("[spk apply]", String(e)); return { ok: false, error: String(e).slice(0, 300) }; }
}

// ==== 2026-11-14 日を延ばす（nosh「同じクラスの公式サイト価格との差額・日単位・同じクラスのみ」。承認制・差額はSquare）====
//   見積もりと反映は DB 関数 hdm_mypage_extend（p_apply=false は何も書かない）
async function spkExtend(resId: string, days: number, apply: boolean, actor = "", changeId?: unknown, hdrActor?: string): Promise<{ ok: boolean; error?: string; data?: any }> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/hdm_mypage_extend`, { method: "POST", headers: withActor(hdrActor),
      body: JSON.stringify({ p_store: "spk", p_res: resId, p_days: days, p_apply: apply, p_actor: actor, p_change_id: changeId == null || changeId === "" ? null : (Number(changeId) || null) }) });
    const tx = await r.text();
    if (!r.ok) { console.error("[spk extend]", r.status, tx); let m = tx; try { m = JSON.parse(tx).message || tx; } catch { /* noop */ } return { ok: false, error: String(m).slice(0, 300) }; }
    return { ok: true, data: JSON.parse(tx) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 300) }; }
}
// ==== 2026-11-09 シート・補償の承認反映（hdm_apply_mypage_extra：予約＋タスクを1回で・取込で戻らない印つき・差額も返す） ====
async function applyExtra(resId: string, kind: string, target: any, actor: string, changeId: unknown, hdrActor?: string): Promise<{ ok: boolean; error?: string; data?: any }> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/hdm_apply_mypage_extra`, { method: "POST", headers: withActor(hdrActor),
      body: JSON.stringify({ p_store: "spk", p_res: resId, p_kind: kind, p_target: target || {}, p_actor: actor, p_change_id: changeId == null || changeId === "" ? null : (Number(changeId) || null) }) });
    const tx = await r.text();
    if (!r.ok) { console.error("[spk extra]", r.status, tx); let m = tx; try { m = JSON.parse(tx).message || tx; } catch { /* noop */ } return { ok: false, error: String(m).slice(0, 300) }; }
    return { ok: true, data: JSON.parse(tx) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 300) }; }
}

// ==== 2026-11-07 別の案・お断り理由（アクションタブ仕様。マイページ側の「この案でOK／やめる」と対。那覇・高松・KEYと同じ形） ====
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
// 2026-11-08 nosh「スタッフ編集できるように」：アクションタブの確認画面でスタッフが直した文（message_text）があれば、その文をそのまま送る
function staffText(p: any, url: string): string { const s = String(p?.message_text || "").replace(/\r\n/g, "\n").trim().slice(0, 2000); if (!s) return ""; return s.replace(/（マイページのURL）/g, url || "").replace(/\n{3,}/g, "\n\n").trim(); }
function expOverride(p: any, fallback: string): string { const e = Date.parse(String(p?.expires_at || "")), now = Date.now(); return (!isNaN(e) && e >= now + 25 * 60e3 && e <= now + 24 * 3600e3 + 10 * 60e3) ? new Date(e).toISOString() : fallback; }
function jstMdHm(iso: string): string { const j = new Date(Date.parse(iso) + 9 * 3600e3); return `${j.getUTCMonth() + 1}/${j.getUTCDate()} ${String(j.getUTCHours()).padStart(2, "0")}:${String(j.getUTCMinutes()).padStart(2, "0")}`; }

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

  // ==== keep-warm ping（DB不使用・即応答）＝cronでisolateを温めコールドスタート回避 ====
  if (action === "ping") return json({ ok: true, warm: true }, 200, origin);

  // ==== 追加決済の入金検知（cron/staff）: unpaid の charge を Square で照合→paid に更新＋顧客へ入金御礼LINE ====
  if (action === "checkExtra") {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const hdrSecret = req.headers.get("x-cron-secret");
    const bySecret = !!cronSecret && (hdrSecret === cronSecret || String(p.secret || "") === cronSecret);
    if (!bySecret) {
      const staffToken = String(p.staff_token || "").trim();
      if (!staffToken) return json({ error: "認証がありません" }, 401, origin);
      const who = await staffUser(staffToken);
      if (!who) return json({ error: "認証に失敗しました" }, 401, origin);
    }
    const token = Deno.env.get("SQUARE_ACCESS_TOKEN") || "";
    if (!token) return json({ error: "SQUARE未設定" }, 503, origin);
    const rows = await sbGet("mypage_extra_payments", `store=eq.spk&status=eq.unpaid&direction=eq.charge&square_order_id=not.is.null&select=id,reservation_id,square_order_id,amount,detail&limit=100`);
    if (!rows.length) return json({ ok: true, checked: 0, paid: 0 }, 200, origin);
    const ids = rows.map((x: any) => String(x.square_order_id));
    const br = await fetch("https://connect.squareup.com/v2/orders/batch-retrieve", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", "Square-Version": "2024-06-04" },
      body: JSON.stringify({ location_ids: [Deno.env.get("SQUARE_LOCATION_ID") || "L8N7J9RKPN3WH"], order_ids: ids }),
    });
    const bd = await br.json().catch(() => ({}));
    const orders = Array.isArray(bd?.orders) ? bd.orders : [];
    const paidSet = new Set(orders.filter((o: any) => o.state === "COMPLETED" || (Array.isArray(o.tenders) && o.tenders.length > 0) || (o.net_amount_due_money && Number(o.net_amount_due_money.amount) === 0 && Number(o.total_money?.amount || 0) > 0)).map((o: any) => String(o.id)));
    let paidCount = 0;
    for (const row of rows) {
      if (paidSet.has(String(row.square_order_id))) {
        await sbPatch("mypage_extra_payments", `id=eq.${encodeURIComponent(String(row.id))}`, { status: "paid", paid_at: new Date().toISOString() }, "cron:extra");
        await pushLine(String(row.reservation_id), `【HANDYMAN 札幌デリバリー】追加分（${row.detail}）¥${Number(row.amount).toLocaleString()} のご入金を確認いたしました。ありがとうございます。`);
        paidCount++;
      }
    }
    return json({ ok: true, checked: rows.length, paid: paidCount }, 200, origin);
  }

  // ==== notify_preview: 全通知パターンをサンプルデータでSlackへ（DB書込/LINEなし・リリース前確認用）====
  if (action === "notify_preview") {
    const who = await staffUser(String(p.staff_token || "").trim());
    if (!who) return json({ error: "unauthorized" }, 401, origin);
    const N = "山田 太郎", ID = "R0SAMPLE01", OT = "R", PD = "2026-07-10〜2026-07-12", V = "ノア（Bクラス）";
    const samples: MpCard[] = [
      { emoji: "✏️", title: "マイページで変更（即時反映済）", name: N, resId: ID, ota: OT, period: PD, vehicle: V,
        lines: ["📍 *お届け先*　（未設定） → *ススキノ ○○ホテル*", "🕐 *お届け時間*　10:00 → *11:00*", "📍 *回収先*　札幌駅 → *大通公園*"],
        action: "✅ OPシートに反映済み・*対応不要*（内容をご確認ください／🕘履歴にも記録）" },
      { emoji: "🟡", title: "お届け変更の承認待ち（お届け24時間以内）", name: N, resId: ID, ota: OT, period: PD, vehicle: V,
        lines: ["📍 *お届け先*（希望）　○○ホテル → *△△ホテル*", "🕐 *お届け時間*（希望）　10:00 → *09:30*", "↳ 回収側（回収時間）は即時反映済み"],
        action: "⚠️ *要承認*：管理コンソール →「🔔変更依頼」で承認（承認で反映＋顧客へLINE通知）" },
      { emoji: "🟡", title: "有料オプション(シート類)変更の依頼（承認待ち）", name: N, resId: ID, ota: OT, period: PD, vehicle: V,
        lines: ["📝 *依頼内容*\nチャイルドシート 1 → 2"], action: "⚠️ *要対応*：管理コンソール →「🔔変更依頼」で承認/却下（即時反映されていません）" },
      { emoji: "🟡", title: "補償(免責)変更の依頼（承認待ち）", name: N, resId: ID, ota: OT, period: PD, vehicle: V,
        lines: ["📝 *依頼内容*\n基本＋免責補償 → 安心ワイドパック（NOC）"], action: "⚠️ *要対応*：管理コンソール →「🔔変更依頼」で承認/却下（即時反映されていません）" },
      { emoji: "🟡", title: "貸出/返却方法(区分)変更の依頼（承認待ち）", name: N, resId: ID, ota: OT, period: PD, vehicle: V,
        lines: ["📝 *依頼内容*\nお届け → 来店受取に変更希望"], action: "⚠️ *要対応*：管理コンソール →「🔔変更依頼」で承認/却下（即時反映されていません）" },
      { emoji: "🔴", title: "キャンセル申請（承認待ち）", name: N, resId: ID, ota: OT, period: PD, vehicle: V,
        lines: ["📝 *理由*\n急な予定変更のため"], action: "⚠️ *要対応*：管理コンソール →「🔔変更依頼」で承認/却下（承認でキャンセル確定＋配車解除＋顧客LINE）" },
      { emoji: "🟢", title: "早め回収OK（返却準備完了）", name: N, resId: ID, ota: OT, period: PD, vehicle: V,
        lines: ["🕐 *予定回収*　12:00", "🕒 *お客様の希望*　*10:30〜*"], action: "💡 スケジュールに余裕があれば早めに回収をご検討ください（お客様には「確認中」と表示中）" },
      { emoji: "🟢", title: "早め回収OK（返却準備完了）", name: N, resId: ID, ota: OT, period: PD, vehicle: V,
        lines: ["🕐 *予定回収*　12:00", "🕒 *お客様の希望*　指定なし"], action: "💡 スケジュールに余裕があれば早めに回収をご検討ください（お客様には「確認中」と表示中）" },
      { emoji: "✅", title: "承認して反映しました（オプション）", name: N, resId: ID, ota: OT, period: PD, vehicle: V,
        lines: ["📝 チャイルドシート 1 → 2", "👤 対応 大下"], action: "✅ 顧客へLINE通知済み・予約に反映済み" },
      { emoji: "✅", title: "承認して反映しました（キャンセル）", name: N, resId: ID, ota: OT, period: PD, vehicle: V,
        lines: ["📝 キャンセル依頼", "👤 対応 大下"], action: "✅ 顧客へLINE通知済み＋キャンセル確定・配車解除" },
      { emoji: "🚫", title: "却下しました（補償）", name: N, resId: ID, ota: OT, period: PD, vehicle: V,
        lines: ["📝 安心ワイドパックへ変更希望", "👤 対応 大下"], action: "✅ 顧客へLINE通知済み（見送り）" },
    ];
    await slackPost("🧪【札幌】マイページ通知プレビュー（以下はサンプルで実データではありません）");
    for (const s of samples) { const { text, blocks } = await mpCard(s); await slackPost(text, blocks); }
    return json({ ok: true, sent: samples.length }, 200, origin);
  }

  // ==== 管理者アクション: decide（承認/却下→実反映＋顧客LINE通知）====
  // スタッフの本体ログインJWTを検証（token=mypage_tokenは使わない）。
  if (action === "decide") {
    // 認証: (a) 共通PIN（全店ダッシュボード mypage-admin） / (b) スタッフJWT。他店EFと統一。
    const ADMIN_PIN = Deno.env.get("ADMIN_PIN") || "";
    const adminPin = String(p.admin_pin || "");
    let actor = "";
    if (ADMIN_PIN && adminPin && adminPin === ADMIN_PIN) { actor = String(p.actor_name || "").replace(/[\s:]+/g, " ").trim().slice(0, 30) || "admin_pin"; } // ★2026-11-14 承認した人の名前を残す（本部は名前を選んでから承認）
    else {
      const staffToken = String(p.staff_token || "").trim();
      if (!staffToken) return json({ error: "スタッフ認証（PIN）が必要です" }, 401, origin);
      const who = await staffUser(staffToken);
      if (!who) return json({ error: "スタッフ認証に失敗しました" }, 401, origin);
      const user = who;
      actor = String(user?.email || user?.id || "staff");
    }
    const sAct = "staff:" + actor; // 監査ログ用（誰が＝担当個人）
    const changeId = p.change_id;
    const decision = String(p.decision || "").trim(); // approved | rejected | acknowledged | proposed
    if (!changeId || (decision !== "approved" && decision !== "rejected" && decision !== "acknowledged" && decision !== "proposed")) return json({ error: "パラメータ不正" }, 400, origin);
    const st0 = STORES.spk;
    const cRows = await sbGet("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}&select=id,reservation_id,field,old_value,new_value,note,status,payload`);
    const c = cRows[0];
    if (!c) return json({ error: "依頼が見つかりません" }, 404, origin);
    if (c.status !== "requested") return json({ error: "この依頼は既に処理済みです" }, 409, origin);
    // 確認済み（対応不要）＝反映も通知もせず、ステータスだけ更新してアーカイブ
    if (decision === "acknowledged") {
      await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}`, { status: "acknowledged", actor }, sAct);
      return json({ ok: true, decision, field: c.field }, 200, origin);
    }
    const resId2 = String(c.reservation_id);
    const rr = (await sbGet(st0.resv, `id=eq.${encodeURIComponent(resId2)}&select=id,name,ota,vehicle,lend_date,return_date,lend_time,return_time,del_place,col_place,insurance,opt_b,opt_c,opt_j,mypage_locked,mypage_token`))[0] || {};
    const myUrl = rr.mypage_token ? `https://nosh2318.github.io/spk-task/my.html?t=${rr.mypage_token}` : "";
    const _rl = await resvLabel("spk", resId2); // ★2026-11-09 Slack 2行目＝予約ID｜車両 ナンバー｜予約者名（キャンセル承認の配車解除より前に引く）
    const kindJp: Record<string, string> = { extend: "日を延ばす", option: "オプション", insurance: "補償", method: "受渡方法", cancel: "キャンセル", del_place: "お届け場所", col_place: "回収場所", lend_time: "お届け時間", return_time: "回収時間", ready: "早め回収(返却準備)" };
    const label = kindJp[c.field] || c.field;
    const pl = (c.payload && typeof c.payload === "object") ? c.payload : {};
    // ready(早め回収)の希望回収時刻を note/new_value から抽出（HH:MM）
    const rdyHM = c.field === "ready" ? ((String(c.note || "") + " " + String(c.new_value || "")).match(/(\d{1,2}:\d{2})/)?.[1] || "") : "";
    const rejCode = String(p.reject_reason || ""), rejText = String(p.reject_text || "").trim().slice(0, 200);
    const rejLine = decision === "rejected" ? rejectLine(rejCode, rejText, String(c.field)) : "";
    const altText = String(p.alt_text || "").trim().slice(0, 300);
    const keep = p.keep_as_is === true || p.keep_as_is === "true";  // 11/7 nosh「NGだけもあり得る＝既存予約のままでお願いします」
    // 2026-11-07 nosh決定「お断り＝できないが〜ならできます」：代わりの案なしのお断りは受け付けない（早め回収＝予定通り回収 は例外）
    if (decision === "rejected" && !altText && !keep) return json({ error: "代わりにできること（〜ならできます）を書いてください" }, 400, origin);
    const rejPayload = decision === "rejected" ? { payload: { ...pl, reject: { reason: rejCode || "other", text: rejText, alt: altText, ...(keep ? { keep: true } : {}), by: actor, at: new Date().toISOString() } } } : {};
    // ---- 別の案（お客様がマイページで「この案でOK」を押すと承認と同じ処理で確定）----
    if (decision === "proposed") {
      const ptext = String(p.proposal_text || "").trim().slice(0, 300); const pval = String(p.proposal_value || "").trim().slice(0, 100);
      if (!ptext) return json({ error: "別の案の内容を書いてください" }, 400, origin);
      if (c.field === "ready" && !/^\d{1,2}:\d{2}$/.test(pval)) return json({ error: "回収できる時間を 15:00 の形で入れてください" }, 400, origin);  // 11/7 nosh「早め回収も〜時ならOK」
      if (!["del_place", "col_place", "lend_time", "return_time", "ready"].includes(String(c.field))) return json({ error: "この種類の依頼は、マイページのボタンではなく文でお返事します（decision=rejected＋alt_text）" }, 400, origin);
      const exp = expOverride(p, proposalExpires(String(c.field), rr.lend_date, rr.lend_time, rr.return_date, rr.return_time));
      const whyP = rejectLine(rejCode, rejText, String(c.field));
      const pBody = staffText(p, myUrl) || declineMsg("【HANDYMAN 札幌デリバリー】", label, String(c.field), String(c.new_value || ""), String(c.old_value || ""), whyP, ptext, `マイページで「この案でOK」を押すと確定します（${jstMdHm(exp)}まで）。ご都合が合わなければ「やめる」を押してください。`, myUrl);
      // 2026-11-08 送った文そのものも記録（那覇と同じ・アーカイブで確認できるように）
      await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}`, { status: "proposed", actor, payload: { ...pl, proposal: { text: ptext, value: pval, reason: rejCode || "", reason_text: rejText, expires_at: exp, by: actor, at: new Date().toISOString(), sent: pBody.slice(0, 2000) } } }, sAct);
      await pushLine(resId2, pBody);
      { const m = await hdmMsg({ emoji: "💬", store: "spk", title: `別の案を送りました（${label}）`, rid: resId2, side: sideOf(String(c.field)), body: [`🔁 ${ptext}`, `⏳ お客様の返事待ち（${jstMdHm(exp)}まで）`, `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(m.text, m.blocks); }
      return json({ ok: true, decision: "proposed", expires_at: exp }, 200, origin);
    }

    let extraRes: any = null;
    // 2026-11-08 場所・時間（と希望時間つきの早め回収）の承認は、お客様へ送る前に DB 関数で反映する。
    //   反映できなければ承認しない＝お客様へも送らない・依頼は requested のまま（関数内で全部取り消し済み）。
    //   成功時は関数が applied 行・予約の mypage_locked・タスク同期・依頼の approved まで済ませている。
    if (decision === "approved" && SPK_PT_FIELDS.includes(String(c.field))) {
      const f = String(c.field);
      const ap = await spkApplyChange(resId2, f, pl[f] ?? c.new_value, actor, changeId,
        f === "del_place" ? pl.del_lat : f === "col_place" ? pl.col_lat : null,
        f === "del_place" ? pl.del_lng : f === "col_place" ? pl.col_lng : null, sAct);
      if (!ap.ok) { try { const fm = await hdmMsg({ emoji: "⚠️", store: "spk", cat: "依頼に返事／反映できない", title: "承認したが予約に反映できませんでした", rid: resId2, body: [String(ap.error || ""), "何も変更していません。管理画面でもう一度承認するか手で直してください", `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(fm.text, fm.blocks as unknown[]); } catch (_e) { /* */ } return json({ error: "反映できませんでした（何も変更していません）：" + (ap.error || ""), apply_failed: true }, 500, origin); }
    } else if (decision === "approved" && (c.field === "option" || c.field === "insurance" || c.field === "extend")) {
      const tg = c.field === "insurance" ? { insurance: String(pl.insurance || "") } : { opt_b: pl.opt_b, opt_c: pl.opt_c, opt_j: pl.opt_j };
      const ax = c.field === "extend" ? await spkExtend(resId2, Number(pl.days) || 0, true, actor, changeId, sAct) : await applyExtra(resId2, String(c.field), tg, actor, changeId, sAct);
      if (!ax.ok) { try { const fm = await hdmMsg({ emoji: "⚠️", store: "spk", cat: "依頼に返事／反映できない", title: "承認したが予約に反映できませんでした", rid: resId2, body: [String(ax.error || ""), "何も変更していません。管理画面でもう一度承認するか手で直してください", `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(fm.text, fm.blocks as unknown[]); } catch (_e) { /* */ } return json({ error: "反映できませんでした（何も変更していません）：" + (ax.error || ""), apply_failed: true }, 500, origin); }
      extraRes = ax.data;
    } else if (decision === "approved" && c.field === "ready" && rdyHM) {
      const apR = await spkApplyChange(resId2, "return_time", rdyHM, actor, changeId, null, null, sAct);
      if (!apR.ok) { try { const fm = await hdmMsg({ emoji: "⚠️", store: "spk", cat: "依頼に返事／反映できない", title: "承認したが予約に反映できませんでした", rid: resId2, body: [String(apR.error || ""), "何も変更していません。管理画面でもう一度承認するか手で直してください", `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackPost(fm.text, fm.blocks as unknown[]); } catch (_e) { /* */ } return json({ error: "反映できませんでした（何も変更していません）：" + (apR.error || ""), apply_failed: true }, 500, origin); }
    }

    // 顧客へLINE通知は「予約が有効なうち」に先に送る（キャンセル確定で cancelled になる前）。場所・時間・早め回収は上の反映が成功した後
    let msg: string;
    if (decision === "approved") {
      if (c.field === "cancel") msg = `【HANDYMAN 札幌デリバリー】ご予約 ${resId2} のキャンセルを承りました。\n担当より別途ご連絡いたします。ご利用ありがとうございました。`;
      else if (c.field === "ready") msg = rdyHM ? `【HANDYMAN 札幌デリバリー】早めのご返却（回収）を承りました。\n回収予定時間を ${rdyHM} に調整いたしました。マイページよりご確認ください。\n${myUrl}` : `【HANDYMAN 札幌デリバリー】早めのご返却（回収）を承りました。\nスケジュールを調整し、回収時間が早まる場合は改めてご連絡いたします。`;
      else if (c.field === "extend") msg = `【HANDYMAN 札幌デリバリー】ご依頼の延長を承り、反映いたしました。\n${extraRes?.detail || ""}${Number(extraRes?.amount) > 0 ? "\n追加のお支払いは、マイページの「お支払い」からお願いいたします。" : ""}\n${myUrl}`;
      else msg = `【HANDYMAN 札幌デリバリー】ご依頼の${label}変更を承り、反映いたしました。\nマイページよりご確認ください。\n${myUrl}`;
    } else {
      if (c.field === "ready" && (keep || !altText)) msg = `【HANDYMAN 札幌デリバリー】ご連絡ありがとうございます。誠に申し訳ございませんが、今回は予定のお時間での回収とさせていただきます。${rejLine ? "\n" + rejLine : ""}\n何卒ご理解いただけますと幸いです。`;
      else if (keep) msg = declineMsg("【HANDYMAN 札幌デリバリー】", label, String(c.field), String(c.new_value || ""), String(c.old_value || ""), rejLine, "", "", myUrl).replace(/はそのままです。/, "のままでのご利用をお願いできますでしょうか。");
      else msg = declineMsg("【HANDYMAN 札幌デリバリー】", label, String(c.field), String(c.new_value || ""), String(c.old_value || ""), rejLine, altText, c.field === "cancel" ? "" : "こちらでよろしければ、マイページから改めてご依頼ください。", myUrl);
      const st3 = staffText(p, myUrl); if (st3) msg = st3;
    }
    await pushLine(resId2, msg);

    // 承認時の実反映
    if (decision === "approved") {
      if (c.field === "option" || c.field === "insurance" || c.field === "extend") {
        // 2026-11-09 上の hdm_apply_mypage_extra で反映済み（予約・タスク・取込で戻らない印）。2026-11-14 延長は hdm_mypage_extend で反映済み
      } else if (SPK_PT_FIELDS.includes(String(c.field)) || c.field === "ready") {
        // 場所・時間・早め回収(希望時間つき)は、お客様へ送る前に spk_apply_mypage_change で反映済み
      } else if (c.field === "cancel") {
        await sbPatch(st0.resv, `id=eq.${encodeURIComponent(resId2)}`, { status: "cancelled" }, sAct);
        // 配車解除＋タスク墓標（1アクション=対象のみ・復活させない）
        await fetch(`${SB_URL}/rest/v1/${st0.fleet}?reservation_id=eq.${encodeURIComponent(resId2)}`, { method: "DELETE", headers: withActor(sAct) });
        const its = await sbGet(st0.tasks, `reservation_id=eq.${encodeURIComponent(resId2)}&deleted=not.is.true&select=_id`);
        for (const t of its) await sbPatch(st0.tasks, `_id=eq.${encodeURIComponent(String(t._id))}`, { deleted: true }, sAct);
      }
      // method は自由記述のため自動反映せず（スタッフが本体で対応）
    }

    // 差額決済（追加オプション/補償）: 承認時のみ。プラス=Square決済リンク発行＋LINE送信 / マイナス=返金保留（手動）
    let extraLine = "";
    try {
    if (decision === "approved" && (c.field === "option" || c.field === "insurance" || c.field === "extend")) {
      const amt = Number(extraRes?.amount || 0), det = String(extraRes?.detail || "");
      if (amt > 0) {
        const lk = await squareLink(rr.name || "", amt, resId2);
        await sbPost("mypage_extra_payments", { reservation_id: resId2, store: "spk", change_id: String(changeId), kind: c.field, detail: det, amount: amt, direction: "charge", square_order_id: lk?.orderId || null, square_url: lk?.url || null, status: lk ? "unpaid" : "link_failed" }, sAct);
        if (lk?.url) { await pushLine(resId2, `【HANDYMAN 札幌デリバリー】${det} の差額 ¥${amt.toLocaleString()} のお支払いをお願いいたします。\n下記リンクよりお手続きください。\n${lk.url}`); extraLine = `💳 *追加請求* ¥${amt.toLocaleString()}（決済リンク送信済・未決済）`; }
        else extraLine = `⚠️ *追加請求* ¥${amt.toLocaleString()}（リンク発行失敗＝手動でリンク作成・送信）`;
      } else if (amt < 0) {
        await sbPost("mypage_extra_payments", { reservation_id: resId2, store: "spk", change_id: String(changeId), kind: c.field, detail: det, amount: amt, direction: "refund", status: "refund_pending" }, sAct);
        extraLine = `↩️ *返金* ¥${Math.abs(amt).toLocaleString()}（手動で返金処理してください）`;
      }
    }
    } catch (e) { console.error("[extra-payment]", String(e)); extraLine = "⚠️ 差額決済の処理でエラー（手動確認）"; }

    // 2026-11-08 お断りは送った文そのものも記録（那覇と同じ）
    await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}`, { status: decision, actor, ...(decision === "rejected" ? { payload: { ...(rejPayload as any).payload, reject: { ...(rejPayload as any).payload.reject, sent: msg.slice(0, 2000) } } } : rejPayload) }, sAct);
    // ★2026-11-14 nosh「承認して反映できた時は不要・反映できない時に通知」：反映できた承認は Slack に出さない（差額の手動対応がある時だけ出す・記録は mypage_changes）
    if (decision !== "approved" || /⚠️|↩️/.test(extraLine)) await notifySlackCard({
      emoji: decision === "approved" ? "✅" : "🚫",
      title: decision === "approved" ? `承認して反映しました（${label}）` : `却下しました（${label}）`,
      name: rr.name || "", resId: resId2, ota: rr.ota,
      period: (rr.lend_date ? `${rr.lend_date}〜${rr.return_date}` : undefined),
      vehicle: rr.vehicle,
      lines: [`📝 ${c.note || c.new_value || "-"}`, `👤 対応 ${hdmWho(actor, p.actor_name)}`, ...(extraLine ? [extraLine] : []), ...(rejLine ? [`💬 *理由*　${rejLine.replace(/\n/g, " ")}`] : []), ...(altText || keep ? [`🔁 *代わりの案*　${altText || "今のご予約のまま"}`] : [])],
      action: decision === "approved"
        ? `✅ 顧客へLINE通知済み${c.field === "cancel" ? "＋キャンセル確定・配車解除" : "・予約に反映済み"}`
        : "✅ 顧客へLINE通知済み（見送り）",
    });
    // ★キャンセル(承認/却下)は予約取込chにも出す（新規予約の逆パターン・那覇と統一）
    if (c.field === "cancel") {
      const _nt = isNewSite(rr.ota, resId2) ? "（🆕NEW 公式サイト）" : "";
            { const m = await hdmMsg({ emoji: decision === "approved" ? "✅" : "🚫", store: "spk", title: decision === "approved" ? `キャンセル承認（確定）${_nt}` : `キャンセル却下${_nt}`, rid: resId2, label: _rl,
              body: [decision === "approved" ? "配車解放済・返金は規定に沿ってSquare手動返金" : "", `👤 対応 ${hdmWho(actor, p.actor_name)}`] }); await slackResv(m.text, m.blocks); }
    }
    return json({ ok: true, decision, field: c.field }, 200, origin);
  }

  // ==== 整合パトロール: 予約情報(reservations) と マイページ/OP(tasks) が一致しているか全予約突合 ====
  // 認証: スタッフJWT(オンデマンド) または CRON_SECRET(定期・Slackアラート)。
  // マイページ・マイページ管理・OPシートは同じ resolve を使うので、食い違いの根＝reservations と tasks の値が競合している予約を検出する。
  if (action === "patrol") {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const hdrSecret = req.headers.get("x-cron-secret");
    const bySecret = !!cronSecret && (hdrSecret === cronSecret || String(p.secret || "") === cronSecret);
    if (!bySecret) {
      const staffToken = String(p.staff_token || "").trim();
      if (!staffToken) return json({ error: "認証がありません" }, 401, origin);
      const who = await staffUser(staffToken);
      if (!who) return json({ error: "スタッフ認証に失敗しました" }, 401, origin);
    }
    const st0 = STORES.spk;
    const today = nowJst().slice(0, 10);
    const resvs = await sbGet(st0.resv, `return_date=gte.${today}&status=not.in.("キャンセル",cancelled,cancel)&select=id,name,del_place,col_place,lend_time,return_time,del_time,col_time,insurance,opt_b,opt_c,opt_j&limit=1000`);
    // tasks をまとめて取得
    const ids = resvs.map((r: any) => r.id);
    const taskByRes: Record<string, any[]> = {};
    for (let i = 0; i < ids.length; i += 60) {
      const chunk = ids.slice(i, i + 60).map((x: string) => encodeURIComponent(x)).join(",");
      const ts = await sbGet(st0.tasks, `reservation_id=in.(${chunk})&deleted=not.is.true&select=_id,reservation_id,place,time,insurance,changed_json`);
      for (const t of ts) (taskByRes[t.reservation_id] = taskByRes[t.reservation_id] || []).push(t);
    }
    const norm = (v: any) => String(v ?? "").trim();
    const conflicts: any[] = []; let checked = 0; let okCount = 0;
    for (const r of resvs) {
      const tk = taskByRes[r.id] || [];
      const dT = tk.find((t: any) => String(t._id || "").startsWith("d-"));
      const cT = tk.find((t: any) => String(t._id || "").startsWith("c-"));
      const rowConf: any[] = [];
      const cmpText = (field: string, resvV: string, taskV: string) => {
        const a = norm(resvV), b = norm(taskV);
        if (a && b && a !== b) rowConf.push({ field, reservations: a, op: b });
      };
      cmpText("del_place", r.del_place, resolveTaskPlace(dT));
      cmpText("col_place", r.col_place, resolveTaskPlace(cT));
      cmpText("lend_time", r.lend_time || r.del_time, resolveTaskTime(dT));
      cmpText("return_time", r.return_time || r.col_time, resolveTaskTime(cT));
      cmpText("insurance", r.insurance, (dT?.insurance || cT?.insurance || ""));
      // オプション（両方>0で不一致のみ）
      const optCmp = (field: string, resvN: number, key: string) => {
        const tN = Math.max(taskOptNum(dT, key), taskOptNum(cT, key));
        if (resvN > 0 && tN > 0 && resvN !== tN) rowConf.push({ field, reservations: String(resvN), op: String(tN) });
      };
      optCmp("opt_c", Number(r.opt_c) || 0, "_optC");
      optCmp("opt_j", Number(r.opt_j) || 0, "_optJ");
      optCmp("opt_b", Number(r.opt_b) || 0, "_optB");
      checked++;
      if (rowConf.length) conflicts.push({ id: r.id, name: r.name, fields: rowConf });
      else okCount++;
    }
    const report = { ok: true, checked, matched: okCount, conflictCount: conflicts.length, conflicts, at: nowJst() };
    // 監視アラートは MYPAGE_SILENT に関係なく必ず発報（slackPost で強制）
    if (conflicts.length > 0) {
      const lbls = await Promise.all(conflicts.slice(0, 15).map((c: any) => resvLabel("spk", c.id))); // ★2026-11-09 Slack 2行目＝予約ID｜車両 ナンバー｜予約者名
      const lines = conflicts.slice(0, 15).map((c: any, i: number) => `・${lbls[i] || `${c.name || ""}様 ${c.id}`}: ${c.fields.map((f: any) => `${f.field}[予約:${f.reservations}≠OP:${f.op}]`).join(" / ")}`).join("\n");
      await slackPost(`🔍【札幌】マイページ整合アラート\n照合${checked}件 → 一致${okCount} / 要対応 ${conflicts.length}件\n${lines}${conflicts.length > 15 ? `\n…他${conflicts.length - 15}件` : ""}\n🔗 管理ページ：https://nosh2318.github.io/spk-task/mypage-admin.html?bucket=hdm_spk（「🛠 対応」タブ）`);
    } else if (bySecret) {
      await slackPost(`🟢【札幌】マイページ整合パトロール：照合${checked}件すべて一致（予約情報＝マイページ＝OPシート）\n🔗 管理ページ：https://nosh2318.github.io/spk-task/mypage-admin.html?bucket=hdm_spk`);
    }
    return json(report, 200, origin);
  }

  // ==== resolve: 整合相違を「どちらかの値で統一」して解消（対応タブから）====
  if (action === "resolve") {
    const staffToken = String(p.staff_token || "").trim();
    if (!staffToken) return json({ error: "スタッフ認証がありません" }, 401, origin);
    const who = await staffUser(staffToken);
    if (!who) return json({ error: "スタッフ認証に失敗しました" }, 401, origin);
    const user = who; const actor = String(user?.email || "staff");
    const sAct = "staff:" + actor;
    const st0 = STORES.spk;
    const rid = String(p.reservation_id || "");
    const field = String(p.field || "");
    const value = String(p.value ?? "");
    const target = String(p.target || ""); // "resv"（予約に合わせる）| "op"（OP/マイページに合わせる）
    const FIELDS = ["del_place", "col_place", "lend_time", "return_time", "insurance", "opt_c", "opt_j", "opt_b"];
    if (!rid || !FIELDS.includes(field) || (target !== "resv" && target !== "op")) return json({ error: "パラメータ不正" }, 400, origin);
    const rr = (await sbGet(st0.resv, `id=eq.${encodeURIComponent(rid)}&select=id,${field.startsWith("opt") ? field : field},del_time,col_time,lend_time,return_time`))[0];
    if (!rr) return json({ error: "予約が見つかりません" }, 404, origin);
    // 2026-11-08 場所・時間は「予約に合わせる／OPに合わせる」のどちらも、統一する値を spk_apply_mypage_change で予約とOPタスクの両方へ
    //   1回で書く（読み直し確認・戻し防止ロック・applied 行の記録つき。依頼に紐づかないので p_change_id=null）
    if (SPK_PT_FIELDS.includes(field)) {
      const ap = await spkApplyChange(rid, field, value, actor, null, null, null, sAct);
      if (!ap.ok) return json({ error: "反映できませんでした（何も変更していません）：" + (ap.error || ""), apply_failed: true }, 500, origin);
      return json({ ok: true, field, value: (ap.data && ap.data.new) || value, target }, 200, origin);
    }
    if (target === "resv") {
      const rp: Record<string, unknown> = {};
      if (field.startsWith("opt")) rp[field] = Number(value) || 0;
      else rp[field] = value;
      await sbPatch(st0.resv, `id=eq.${encodeURIComponent(rid)}`, rp, sAct);
    } else { // op: tasksへ書いて予約情報側の値をOP/マイページに反映
      if (field === "insurance") { const its = await sbGet(st0.tasks, `reservation_id=eq.${encodeURIComponent(rid)}&deleted=not.is.true&select=_id`); for (const t of its) await sbPatch(st0.tasks, `_id=eq.${encodeURIComponent(String(t._id))}`, { insurance: value }, sAct); }
      else if (field.startsWith("opt")) { const key = "_opt" + field.slice(4).toUpperCase(); const its = await sbGet(st0.tasks, `reservation_id=eq.${encodeURIComponent(rid)}&deleted=not.is.true&select=_id,changed_json`); for (const t of its) { let cj: any = t.changed_json; if (typeof cj === "string") { try { cj = JSON.parse(cj); } catch { cj = {}; } } cj = cj || {}; cj[key] = Number(value) || 0; await sbPatch(st0.tasks, `_id=eq.${encodeURIComponent(String(t._id))}`, { changed_json: cj, ...(field === "opt_c" ? { opt_c: (Number(value) || 0) > 0 } : {}) }, sAct); } }
    }
    await sbPost("mypage_changes", { reservation_id: rid, store: "spk", field, old_value: "", new_value: value, source: "staff", status: "applied", actor, note: `整合統一(${target === "resv" ? "予約側を更新" : "OP側を更新"})` }, sAct);
    return json({ ok: true, field, value, target }, 200, origin);
  }

  const token = String(p.token || "").trim();
  if (!token || token.length < 20) return json({ error: "アクセスキーが不正です" }, 400, origin);

  // token で予約特定（P1=spk）。将来 nha も同 token 空間で探索。
  const store = STORES.spk;
  const rows = await sbGet(store.resv, `mypage_token=eq.${encodeURIComponent(token)}&select=${store.sel}`);
  const r = rows[0];
  if (!r) return json({ error: "予約が見つかりません" }, 404, origin);
  const resId = String(r.id);
  // ★CANCELLED_ONLY_1030 キャンセル済みは「M月D日にキャンセル済みです」だけを返す（予約の中身は一切返さない／全アクション共通）
  { const _cs = String(r.status || ""); if (/cancel/i.test(_cs) || _cs.indexOf("キャンセル") >= 0) {
    let _at = "";
    try { const _lg = await sbGet("reservation_cancel_ledger", `reservation_id=eq.${encodeURIComponent(resId)}&event=eq.cancel&order=changed_at.desc&limit=1&select=changed_at`); _at = String((_lg[0] && _lg[0].changed_at) || ""); } catch (_) { /* noop */ }
    if (!_at) { try { const _u = await sbGet(store.resv, `id=eq.${encodeURIComponent(resId)}&select=updated_at`); _at = String((_u[0] && _u[0].updated_at) || ""); } catch (_) { /* noop */ } }
    const _t = _at ? new Date(_at).getTime() : NaN;
    const _cd = isNaN(_t) ? "" : new Date(_t + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const _msg = _cd ? `${+_cd.slice(5, 7)}月${+_cd.slice(8, 10)}日にキャンセル済みです` : "キャンセル済みです";
    return json({ ok: false, cancelled: true, cancel_date: _cd, error: _msg }, 200, origin);
  } }

  // ---- proposal_reply: お客様が別の案に返事（accept=この案でOK / decline=やめる）----
  if (action === "proposal_reply") {
    const cid = String(p.change_id || ""); const ans = String(p.answer || "");
    if (!cid || (ans !== "accept" && ans !== "decline")) return json({ error: "パラメータ不正" }, 400, origin);
    const pc = (await sbGet("mypage_changes", `id=eq.${encodeURIComponent(cid)}&store=eq.spk&reservation_id=eq.${encodeURIComponent(resId)}&select=id,field,new_value,status,payload`))[0];
    if (!pc) return json({ error: "ご提案が見つかりません" }, 404, origin);
    if (pc.status !== "proposed") return json({ ok: true, already: pc.status }, 200, origin);
    const ppl: any = (pc.payload && typeof pc.payload === "object") ? pc.payload : {}; const pr: any = ppl.proposal || {};
    const fj: Record<string, string> = { option: "オプション", insurance: "補償", method: "受渡方法", cancel: "キャンセル", del_place: "お届け場所", col_place: "回収場所", lend_time: "お届け時間", return_time: "回収時間", ready: "早め回収" };
    const lb = fj[pc.field] || pc.field;
    if (pr.expires_at && Date.parse(pr.expires_at) < Date.now()) {
      await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(cid)}`, { status: "expired", payload: { ...ppl, proposal: { ...pr, answer: "expired", answered_at: new Date().toISOString() } } }, "customer");
      return json({ ok: false, expired: true, error: "ご提案の期限が過ぎました。今のご予約のままです。" }, 200, origin);
    }
    const _pm = (emoji: string, title: string, body: string[]) => hdmMsg({ emoji, ...(/自動反映に失敗/.test(title) ? { cat: "依頼に返事／反映できない" } : {}), store: "spk", title, rid: resId, side: sideOf(pc.field), body }); // ★2026-11-10 共通の型
    if (ans === "decline") {
      await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(cid)}`, { status: "declined_by_guest", payload: { ...ppl, proposal: { ...pr, answer: "decline", answered_at: new Date().toISOString() } } }, "customer");
      { const m = await _pm("↩️", `お客様が別の案を見送りました（${lb}）`, ["今の予約のまま"]); await slackPost(m.text, m.blocks); }
      return json({ ok: true, answered: "decline" }, 200, origin);
    }
    // accept：値を差し替えて requested に戻し、スタッフ承認と同じ decide を内部で呼ぶ（反映＋承認通知）
    const nv = String(pr.value || "").trim();
    await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(cid)}`, { status: "requested", ...(nv ? { new_value: pc.field === "ready" ? `返却準備完了(早め回収OK) 希望時間 ${nv}〜` : nv } : {}), ...(nv && pc.field === "ready" ? { note: `希望回収時間の目安 ${nv}〜` } : {}), payload: { ...ppl, ...(nv && pc.field !== "ready" ? { [pc.field]: nv } : {}), proposal: { ...pr, answer: "accept", answered_at: new Date().toISOString() } } }, "customer");
    const dr2 = await fetch(`${SB_URL}/functions/v1/handyman-mypage`, { method: "POST", headers: { "content-type": "application/json", apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, body: JSON.stringify({ action: "decide", admin_pin: Deno.env.get("ADMIN_PIN") || "", change_id: Number(cid) || cid, decision: "approved" }) });
    const dj: any = await dr2.json().catch(() => ({}));
    // 2026-11-08 内部 decide が反映まで成功した時だけ「確定」と返す（失敗時は依頼が requested のまま＝スタッフが確認。お客様には確定と見せない）
    if (!dr2.ok || !dj.ok) {
      console.error("[proposal accept]", dr2.status, JSON.stringify(dj));
      { const m = await _pm("⚠️", `お客様が別の案にOK→自動反映に失敗（${lb}）`, [await dateLine(resId, sideOf(pc.field)), dj && dj.apply_failed ? "何も変更していません：" + String(dj.error || "").slice(0, 200) : "", "⚠️ 要承認：アクションタブで承認してください"]); await slackPost(m.text, m.blocks); }
      return json({ ok: false, answered: "accept", pending: true, error: "ご返事を受け付けました。まだ確定していません。スタッフが確認のうえ、ご連絡いたします。" }, 200, origin);
    }
    { const m = await _pm("✅", `お客様が別の案にOK→確定しました（${lb}）`, [`🔁 ${pr.text || nv}`]); await slackPost(m.text, m.blocks); }
    return json({ ok: true, answered: "accept" }, 200, origin);
  }

  // ---- guide_log: スタッフ代理(staff=1)/お客様 の 免許アップ・時間/場所変更・依頼・受取 を時刻付き監査ログへ（RPC spk_guide_log が予約時刻(lend_time/return_time)をサーバ側でキャプチャ→来店/返却との相違に後から気づける）----
  if (action === "guide_log") {
    try {
      await fetch(`${SB_URL}/rest/v1/rpc/spk_guide_log`, { method: "POST", headers: H, body: JSON.stringify({
        p_token: token,
        p_action: String(p.gaction || "unknown").slice(0, 40),
        p_staff: !!p.staff,
        p_session: String(p.session || "").slice(0, 80),
        p_meta: (p.meta && typeof p.meta === "object") ? p.meta : {},
        p_device: String(p.device || "").slice(0, 120),
      }) });
    } catch (_) { /* ログ失敗で本処理を止めない */ }
    return json({ ok: true }, 200, origin);
  }

  // ---- license_uploaded: お客様がマイページから免許証をアップした完了通知（Slack） ----
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
        { type: "mrkdwn", text: `*利用期間:*\n${r.lend_date || "-"} 〜 ${r.return_date || "-"}` },
        { type: "mrkdwn", text: `*車両クラス:*\n${r.vehicle || "-"}` },
        { type: "mrkdwn", text: `*アップ枚数:*\n${cnt}枚（運転者${drivers}名）` },
      ] },
      { type: "context", elements: [ { type: "mrkdwn", text: "Googleドライブに保存済み。貸渡手続きにご利用ください。" } ] },
    ];
    // OPシート「🪪免許OK」表示用にDB記録（upsert）
    try { await fetch(`${SB_URL}/rest/v1/license_uploads?on_conflict=reservation_id`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ reservation_id: resId, store: "spk", cnt: totCnt, drivers: totDrv, names: allNames, last_at: nowIso }) }); } catch (_) { /* noop */ }
    // ★2026-11-09 nosh「免許証以後通知不用」：お客様の免許証アップロードはSlackに出さない（全店）。DB記録(license_uploads)はそのまま。
    void blocks;
    return json({ ok: true, license: { cnt: totCnt, drivers: totDrv, names: allNames } }, 200, origin);
  }

  // ---- lookup: マイページ表示（正本を1画面に集約）----
  if (action === "lookup") {
    // 開封記録（アクティブ/スルー可視化用）: 顧客がマイページを開いた＝lookup。RPCでupsert（応答をブロックしない・失敗無視）。
    sbPost("rpc/mypage_touch_view", { p_rid: resId, p_store: "spk" }).catch(() => {});
    // 傷チェック解禁: 出発日の8:00以降のみ（それ以前は準備中でぼかす）
    const today = nowJst().slice(0, 10);
    const hh = +nowJst().slice(11, 13);
    const damageReady = (!!r.lend_date && (r.lend_date < today || (r.lend_date === today && hh >= 8)));
    // ▼ 独立した3クエリを並列化（傷チェックURL解決・OPタスク・変更履歴）＝lookupの応答短縮
    const damageP: Promise<string | null> = damageReady ? (async () => {
      // fleet→vehicle_code→vehicles.plate→vehicle_twins.share_token（best-effort・内部は依存直列）
      try {
        const fl = await sbGet(store.fleet, `reservation_id=eq.${encodeURIComponent(resId)}&select=vehicle_code`);
        const code = fl[0]?.vehicle_code;
        if (!code) return null;
        // 🔴 2026-09-28根治: vehicle_code=vehicle_twins.id 完全一致(札幌21台全一致)を最優先。
        //   旧: plate_no→display_label ilike は、plate_noが短い車だと「その数字を含む全twin」に誤ヒットしlimit1で別車を拾う(那覇C260801412=ヴィッツ③plate"8"→アルファード②2878を誤表示した同型)。
        let tw = await sbGet("vehicle_twins", `id=eq.${encodeURIComponent(code)}&store=eq.sapporo&share_enabled=eq.true&select=share_token&limit=1`);
        if (!tw[0]) {
          const vs = await sbGet("vehicles", `code=eq.${encodeURIComponent(code)}&select=plate_no`);
          const plate = vs[0]?.plate_no;
          if (plate) tw = await sbGet("vehicle_twins", `display_label=ilike.*/ ${encodeURIComponent(plate)}&store=eq.sapporo&share_enabled=eq.true&select=share_token&limit=1`);
        }
        return tw[0]?.share_token ? `https://nosh2318.github.io/handyman-damage/v.html?t=${tw[0].share_token}&v=v3` : null;
      } catch (_) { return null; }
    })() : Promise.resolve(null);
    const opTasksP = sbGet(store.tasks, `reservation_id=eq.${encodeURIComponent(resId)}&deleted=not.is.true&select=_id,done,place,time,insurance,changed_json`);
    const chgP = sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&order=created_at.desc&limit=10&select=id,field,old_value,new_value,source,status,actor,created_at,payload`);
    // エルメ受付フォーム回答（予約番号完全一致）＝reservations/OPが空でも顧客の回答済み場所を表示
    const linkP = sbGet("spk_line_links", `resv_no=eq.${encodeURIComponent(resId)}&select=del_place,col_place,del_time,col_time&limit=1`);
    const licP = sbGet("license_uploads", `reservation_id=eq.${encodeURIComponent(resId)}&select=cnt,drivers,names`);
    // 2026-11-08 NOWCARD: 貸出直後カード用に車両のETC車載器位置・写真・燃料（vehicles.specs、管理APP車両マスタで登録）。読むだけ・失敗はnull
    const carP: Promise<any> = (async () => {
      try {
        const fl = await sbGet(store.fleet, `reservation_id=eq.${encodeURIComponent(resId)}&select=vehicle_code`);
        const code = fl[0]?.vehicle_code; if (!code) return null;
        const vs = await sbGet("vehicles", `code=eq.${encodeURIComponent(code)}&select=specs&limit=1`);
        const sp = (vs[0] && vs[0].specs) || {};
        return { etc_location: sp.etc_location || null, etc_image: sp.etc_image || null, fuel: sp.fuel || null };
      } catch (_) { return null; }
    })();
    // ★2026-11-09 速く（nosh「読み込みが遅い」）：シートの残り台数も最初から同時に読む（前は最後に1回待っていた）。失敗したら出さないのは同じ
    const seatP = fetch(`${SB_URL}/rest/v1/rpc/hdm_seat_left`, { method: "POST", headers: withActor(), body: JSON.stringify({ p_store: "spk", p_res: resId }) }).then((sr) => sr.ok ? sr.json() : null).catch(() => null);
    const [damageUrl, opTasks, chg, links, licRows, carInfo] = await Promise.all([damageP, opTasksP, chgP, linkP, licP, carP]);
    const link = links[0] || {};
    const licCnt = (licRows[0] && licRows[0].cnt) || 0; const licDrivers = (licRows[0] && licRows[0].drivers) || 0;
    // 場所/時間/オプション/補償は OPタスク(d-/c-)も見て「実値のある方」を採用（reservations 側が空のことが多い）。
    const dTask = opTasks.find((t: any) => String(t._id || "").startsWith("d-"));
    const cTask = opTasks.find((t: any) => String(t._id || "").startsWith("c-"));
    // 🔴 顧客/スタッフが確定した「適用済み変更(applied)」を最優先。
    // 理由: マイページで変更しても、SSパトロールが tasks._ssPlace/_ssTime をフォーム値に戻すため、
    // resolveTask* だけだと変更が表示に反映されない（お客様に古い値が見える／OP時間も戻る）。
    // mypage_changes(applied) は変更の正本ログなので、これを表示の最優先にする。
    const appliedChg = (field: string): string | null => {
      const c = chg.find((x: any) => x.field === field && x.status === "applied"); // chgは created_at desc=最新が先頭
      return c && String(c.new_value || "").trim() ? String(c.new_value).trim() : null;
    };
    const delPlaceR = appliedChg("del_place") ?? (resolveTaskPlace(dTask) || (r.del_place || "") || String(link.del_place || "").trim());
    const colPlaceR = appliedChg("col_place") ?? (resolveTaskPlace(cTask) || (r.col_place || "") || String(link.col_place || "").trim());
    // 🔴 2026-10-05 再発根治(複製ドリフト): 時間はapplied変更履歴より先にタスク実効値(resolveTaskTime)を見る。
    //   受付フォーム(spk_line_links)での時間変更はmypage_changesに行を作らずタスク_ssTimeだけ更新するため、
    //   applied履歴(例9/8の17:00)が古いまま最新のフォーム値(17:30=OP実表示)を追い越していた。
    //   タスクは承認反映時にも_timeChangeが入るのでappliedChg優先は冗長かつ有害→削除し実効値を正本に統一。
    const lendTimeR = resolveTaskTime(dTask) || appliedChg("lend_time") || r.lend_time || r.del_time || String(link.del_time || "").trim();
    const returnTimeR = resolveTaskTime(cTask) || appliedChg("return_time") || r.return_time || r.col_time || String(link.col_time || "").trim();
    // オプション：reservations と tasks の大きい方（どちらかにしか入っていないケースを両方拾う）
    const optBR = Math.max(Number(r.opt_b) || 0, taskOptNum(dTask, "_optB"), taskOptNum(cTask, "_optB"));
    const optCR = Math.max(Number(r.opt_c) || 0, taskOptNum(dTask, "_optC"), taskOptNum(cTask, "_optC"));
    const optJR = Math.max(Number(r.opt_j) || 0, taskOptNum(dTask, "_optJ"), taskOptNum(cTask, "_optJ"));
    // 補償：reservations が空なら tasks.insurance にフォールバック
    const insR = String(r.insurance || "").trim() || String(dTask?.insurance || cTask?.insurance || "").trim();
    const pendingCancel = chg.some((c: any) => c.field === "cancel" && c.status === "requested");
    const readyPending = chg.some((c: any) => c.field === "ready" && c.status === "requested");
    const receivedDone = chg.some((c: any) => c.field === "received" && c.status === "applied");
    // 履歴：mypage_changes（依頼/承認/マイページ即時）＋ OPタスク由来（フォーム回答・担当編集の場所/時間）を統合。
    const history: any[] = [];
    for (const c of chg) history.push({ field: c.field, value: c.new_value, old: c.old_value, at: c.created_at, source: c.source === "staff" ? "staff" : "customer_mypage", status: c.status, actor: c.actor });
    const pushTaskHist = (task: any, placeField: string, timeField: string) => {
      if (!task) return;
      let cj: any = task.changed_json; if (typeof cj === "string") { try { cj = JSON.parse(cj); } catch { cj = {}; } } cj = cj || {};
      const src = cj._placeSource === "manual" ? "staff" : (cj._placeSource === "customer" ? "customer_mypage" : "customer_form");
      // 場所（マイページ即時分=customerはmypage_changes側にあるので重複回避）
      if (src !== "customer_mypage") {
        const pv = cj._placeSource === "manual" ? (task.place || "") : (cj._ssPlace || task.place || "");
        const pat = cj._manualPlaceAt || cj._ssPlaceAt || "";
        if (pv && pat) history.push({ field: placeField, value: pv, at: pat, source: src, status: "applied" });
        const tv = cj._ssTime || task.time || "";
        const tat = cj._manualTimeAt || cj._ssTimeAt || "";
        if (tv && tat) history.push({ field: timeField, value: tv, at: tat, source: src, status: "applied" });
      }
    };
    pushTaskHist(dTask, "del_place", "lend_time");
    pushTaskHist(cTask, "col_place", "return_time");
    history.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
    const historyTop = history.slice(0, 10);
    // 2026-11-09 シートの残り台数（この予約の期間・この予約の分は除く）。取れなければ出さない
    let seatLeft: any = null;
    seatLeft = await seatP;
    return json({
      ok: true, store: "spk", label: store.label,
      reservation: {
        id: r.id, vehicle: r.vehicle, lend_date: r.lend_date, return_date: r.return_date,
        lend_time: lendTimeR, return_time: returnTimeR,
        name: r.name, people: r.people, status: r.status, insurance: insR, ota: r.ota,
        del_place: delPlaceR, col_place: colPlaceR,
        del_lat: r.del_lat ?? null, del_lng: r.del_lng ?? null, col_lat: r.col_lat ?? null, col_lng: r.col_lng ?? null,
        opt_b: optBR, opt_c: optCR, opt_j: optJR, opt_usb: r.opt_usb || 0,
        kd_status: r.kd_status || null,
        price: Number(r.price || 0),  // 2026-10-21 オーナー指示: マイページのご予約内容に料金を表示
      },
      damage: { ready: damageReady, url: damageUrl },
      tracking: { active: r.kd_status === "delivering" || r.kd_status === "collecting", kd_status: r.kd_status || null, token: r.kd_track_token || null },
      license: { cnt: licCnt, drivers: licDrivers, names: (licRows[0] && Array.isArray(licRows[0].names)) ? licRows[0].names.map((x: any) => ({ n: String((x && x.n) || "") })).filter((x: any) => x.n) : [] },
      car: carInfo,
      received: receivedDone,
      pendingCancel, readyPending, recentChanges: chg, history: historyTop,
      delLocked: delHandedOver(r, dTask, receivedDone),
      seat_stock: seatLeft,
    }, 200, origin);
  }

  const st = String(r.status || "");
  const cancelled = st === "cancelled" || st === "キャンセル" || st === "cancel";

  // ---- receive_done: お客様が「受け取り完了」を報告 → お届け(DEL)タスクを済(完了)にしてSlack通知 ----
  if (action === "receive_done") {
    if (cancelled) return json({ error: "キャンセル済みの予約です" }, 409, origin);
    const cAct = "customer:" + resId;
    // 二重報告ガード（既に受取完了なら何もせず成功を返す）
    const prev = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&field=eq.received&status=eq.applied&select=id&limit=1`);
    if (prev[0]) return json({ ok: true, received: true, already: true }, 200, origin);
    // お届け(d-)タスクを済(完了)に。無ければ先頭タスク。
    const tks = await sbGet(store.tasks, `reservation_id=eq.${encodeURIComponent(resId)}&deleted=not.is.true&select=_id,done,place,changed_json`);
    const delT = tks.find((t: any) => String(t._id || "").startsWith("d-")) || tks[0];
    if (delT && delT.done !== true) await sbPatch(store.tasks, `_id=eq.${encodeURIComponent(String(delT._id))}`, { done: true }, cAct);
    // 受け取り場所（お届け場所）を解決：OPタスク→予約→受付フォーム(spk_line_links)の順
    const linkRD = await sbGet("spk_line_links", `resv_no=eq.${encodeURIComponent(resId)}&select=del_place&limit=1`);
    const recvPlace = resolveTaskPlace(delT) || String(r.del_place || "").trim() || String((linkRD[0] && linkRD[0].del_place) || "").trim() || "（未設定）";
    // 監査ログ（受取完了を正本記録）
    await sbPost("mypage_changes", { reservation_id: resId, store: "spk", field: "received", old_value: "", new_value: "受取完了", source: "customer", status: "applied", note: "お客様がマイページで受け取り完了を報告→お届けタスクを完了(済)化" }, cAct);
    // Slack通知（#sapporo_user_action）
    const m = await hdmMsg({ emoji: "✅", store: String(r.ota || "") === "KEYDROP" ? "kd_spk" : "spk", title: "お客様が受け取り完了", rid: resId, side: "go", body: [`📍 ${recvPlace}`, "OPシートのお届けタスクを完了(済)にしました"] }); // ★2026-11-10 共通の型
    await slackPost(m.text, m.blocks);
    return json({ ok: true, received: true }, 200, origin);
  }

  // ---- update: 場所/時間のみ 即時反映（顧客が自分で確定できる低制約項目）----
  if (action === "update") {
    if (cancelled) return json({ error: "キャンセル済みの予約は変更できません" }, 409, origin);
    const has = (k: string) => Object.prototype.hasOwnProperty.call(p, k);
    const delPlace = has("del_place") ? String(p.del_place || "").trim() : null;
    const colPlace = has("col_place") ? String(p.col_place || "").trim() : null;
    const lendTime = has("lend_time") ? String(p.lend_time || "").trim() : null;
    const returnTime = has("return_time") ? String(p.return_time || "").trim() : null;
    // 24h判定は「お届け系＝お届け日時基準」「回収系＝回収日時基準」で別々に。
    // （本日お届けでも回収が数日後なら回収の変更は可能）
    const touchesDel = delPlace !== null || lendTime !== null;
    const touchesCol = colPlace !== null || returnTime !== null;
    if (delPlace !== null && delPlace.length < 2) return json({ error: "お届け場所が不正です" }, 400, origin);
    if (colPlace !== null && colPlace.length < 2) return json({ error: "回収場所が不正です" }, 400, origin);
    if (lendTime !== null && !validTime(lendTime)) return json({ error: "お届け時間は9:00〜19:00（30分刻み）で指定してください" }, 400, origin);
    if (returnTime !== null && !validTime(returnTime)) return json({ error: "回収時間は9:00〜19:00（30分刻み）で指定してください" }, 400, origin);
    if (delPlace === null && colPlace === null && lendTime === null && returnTime === null) return json({ error: "変更内容がありません" }, 400, origin);
    // 場所は札幌市内限定・新千歳空港不可（サーバー側で強制）
    { const dLat0 = (has("del_lat") && p.del_lat != null && p.del_lat !== "") ? Number(p.del_lat) : null; const dLng0 = (has("del_lng") && p.del_lng != null && p.del_lng !== "") ? Number(p.del_lng) : null;
      const cLat0 = (has("col_lat") && p.col_lat != null && p.col_lat !== "") ? Number(p.col_lat) : null; const cLng0 = (has("col_lng") && p.col_lng != null && p.col_lng !== "") ? Number(p.col_lng) : null;
      if (delPlace !== null) { const e = placeError(delPlace, dLat0, dLng0); if (e) return json({ error: e }, 400, origin); }
      if (colPlace !== null) { const e = placeError(colPlace, cLat0, cLng0); if (e) return json({ error: e }, 400, origin); } }

    // 受付ルール（オーナー確定 2026-08-21）:
    //  お届け/回収の【時間・場所変更は、時間制限に関係なく全て承認制】。
    //  お客様は自由に申請でき、スタッフが管理コンソール →「🔔変更依頼」で承認すると
    //  OPシート/タスクへ反映（spk_apply_mypage_change）＋お客様へLINE通知。即時反映はしない。
    // 締切（オーナー確定 2026-09-01・SPK）:
    //  お届け(DEL)の場所・時間変更は【貸出前日19:00（営業時間外）で受付終了】。
    //  以降（＝翌営業日1発目のタスク直前の変更）は申請不可→公式LINEへ誘導。
    //  ※回収(COL)は従来どおり承認制で時間制限なし。
    // 2026-11-07 nosh「全てマイページから申請し運営が可否→ユーザーに戻る」：期限（お届け＝出発24時間前）は目安。期限後も申請を受け付け、公式LINEへは誘導しない。
    const num = (k: string) => (has(k) && p[k] != null && p[k] !== "") ? Number(p[k]) : null;
    const dLat = num("del_lat"), dLng = num("del_lng"), cLat = num("col_lat"), cLng = num("col_lng");
    const cAct = "customer:" + resId;
    // 🔴 変更前(old_value)＆Slack通知は「OPシート/マイページと同じ実効値」を使う。
    //   予約の生値 r.return_time は当初値(例17:00)で古く、OP/マイページの実表示は resolveTaskTime(例16:00)。
    //   lookup(649-652)と同じ解決順： applied変更 > OPタスク(resolveTask*) > 予約生値 > (未設定)。
    const _uTasks = await sbGet(store.tasks, `reservation_id=eq.${encodeURIComponent(resId)}&deleted=not.is.true&select=_id,done,place,time,insurance,changed_json`);
    const _uChg = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&status=eq.applied&order=created_at.desc&limit=10&select=field,new_value`);
    const _uApplied = (f: string): string => { const c = _uChg.find((x: any) => x.field === f); return c && String(c.new_value || "").trim() ? String(c.new_value).trim() : ""; };
    const _dT = _uTasks.find((t: any) => String(t._id || "").startsWith("d-"));
    const _cT = _uTasks.find((t: any) => String(t._id || "").startsWith("c-"));
    if (touchesDel) {
      const _rcv = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&field=eq.received&status=eq.applied&select=id&limit=1`);
      if (delHandedOver(r, _dT, !!_rcv[0])) return json({ error: "お車のお届けが済んでいるため、お届け場所・お届け時間は変更できません。回収の場所・時間は変更できます。", delLocked: true }, 409, origin);
    }
    const curDelPlace = _uApplied("del_place") || resolveTaskPlace(_dT) || String(r.del_place || "").trim();
    const curColPlace = _uApplied("col_place") || resolveTaskPlace(_cT) || String(r.col_place || "").trim();
    // 🔴 2026-10-05 再発根治(複製ドリフト): 時間はapplied変更履歴より先にタスク実効値を見る(lookupと統一)。
    //   受付フォーム経由の時間変更はmypage_changesに残らずタスク_ssTimeだけ更新するため、古いapplied履歴が最新を追い越していた。
    const curLendTime = resolveTaskTime(_dT) || _uApplied("lend_time") || r.lend_time || r.del_time || "";
    const curReturnTime = resolveTaskTime(_cT) || _uApplied("return_time") || r.return_time || r.col_time || "";
    const oldOf = (f: string) => String((f === "del_place" ? curDelPlace : f === "col_place" ? curColPlace : f === "lend_time" ? curLendTime : curReturnTime) ?? "");
    const _nz = (s: unknown) => { const t = String(s ?? "").trim(); const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/); return m ? m[1].padStart(2, "0") + ":" + m[2] : t; }; const _chg = (n: string | null, c: unknown) => n !== null && _nz(n) !== _nz(c); // ★2026-11-10 変わっていない項目は依頼にも通知にも出さない
    const noteOf = (f: string) => f === "del_place" ? "お届け場所変更（承認制）" : f === "col_place" ? "回収場所変更（承認制）" : f === "lend_time" ? "お届け時間変更（承認制）" : "回収時間変更（承認制）";
    // 2026-11-09 連打・再送対策: 受付中の依頼と同じ内容なら何もしない（Slackも出さない）。違う内容なら同じ1件を書き換える
    let _reqChanged = false;
    const mkReq = async (field: string, newV: string, payload: any) => {
      const ex = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&field=eq.${field}&status=eq.requested&select=id,new_value&order=id.asc&limit=1`);
      if (ex[0]) { if (String(ex[0].new_value || "").trim() === newV) return; await sbPatch("mypage_changes", `id=eq.${ex[0].id}`, { new_value: newV, payload }, cAct); }
      else await sbPost("mypage_changes", { reservation_id: resId, store: "spk", field, old_value: oldOf(field), new_value: newV, source: "customer", status: "requested", note: noteOf(field), payload }, cAct);
      _reqChanged = true;
    };
    const reqLabels: string[] = [];
    if (_chg(delPlace, curDelPlace)) { await mkReq("del_place", delPlace, { del_place: delPlace, ...(dLat != null && dLng != null ? { del_lat: dLat, del_lng: dLng } : {}) }); reqLabels.push("お届け場所"); }
    if (_chg(lendTime, curLendTime)) { await mkReq("lend_time", lendTime, { lend_time: lendTime }); reqLabels.push("お届け時間"); }
    if (_chg(colPlace, curColPlace)) { await mkReq("col_place", colPlace, { col_place: colPlace, ...(cLat != null && cLng != null ? { col_lat: cLat, col_lng: cLng } : {}) }); reqLabels.push("回収場所"); }
    if (_chg(returnTime, curReturnTime)) { await mkReq("return_time", returnTime, { return_time: returnTime }); reqLabels.push("回収時間"); }
    if (!_reqChanged) return json({ ok: true, pendingApproval: true, already: true, requested: reqLabels }, 200, origin);
    const aLines: string[] = [];
    if (_chg(delPlace, curDelPlace)) aLines.push(`📍 *お届け先*（希望）　${curDelPlace || "（未設定）"} → *${delPlace}*`);
    if (_chg(lendTime, curLendTime)) aLines.push(`🕐 *お届け時間*（希望）　${curLendTime || "（未設定）"} → *${lendTime}*`);
    if (_chg(colPlace, curColPlace)) aLines.push(`📍 *回収先*（希望）　${curColPlace || "（未設定）"} → *${colPlace}*`);
    if (_chg(returnTime, curReturnTime)) aLines.push(`🕐 *回収時間*（希望）　${curReturnTime || "（未設定）"} → *${returnTime}*`);
    const _om = omniText(await omniAsk("spk", (await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.spk&status=eq.requested&field=in.(lend_time,return_time,del_place,col_place)&select=id`)).map((x: any) => x.id)));
    await notifySlackCard({ side: touchesDel && touchesCol ? "" : touchesDel ? "go" : "back", emoji: "🟡", title: _om ? _om.title : "場所・時間変更の承認待ち", name: r.name, resId, ota: r.ota, period: `${r.lend_date}〜${r.return_date}`, vehicle: r.vehicle, lines: _om ? [...aLines, ..._om.lines] : aLines, action: "⚠️ *要承認*：管理コンソール →「🔔変更依頼」で承認（承認で反映＋顧客へLINE通知）" });
    return json({ ok: true, pendingApproval: true, requested: reqLabels }, 200, origin);
  }

  // ---- request: 承認制の依頼（有料オプション/シート類・貸出返却方法(区分)変更）。即反映しない ----
  // ★2026-11-14 日を延ばす：見積もり（何も書かない）と依頼（承認制）
  if (action === "extend_quote" || (action === "request" && String(p.req_type || "") === "extend")) {
    if (cancelled) return json({ error: "キャンセル済みの予約は変更できません" }, 409, origin);
    const days = Math.round(Number(p.days) || 0);
    if (days < 1 || days > 7) return json({ error: "延ばせるのは1〜7日です" }, 400, origin);
    const q = await spkExtend(resId, days, false);
    if (!q.ok) return json({ error: q.error || "料金を出せませんでした" }, 200, origin);
    const d: any = q.data || {};
    if (action === "extend_quote") return json({ ok: true, quote: { days, priced: !!d.priced, amount: d.amount, vehicle_amount: d.vehicle_amount, insurance_amount: d.insurance_amount, old_end: d.old_end, new_end: d.new_end, lines: d.lines || [] } }, 200, origin);
    const md = (x: unknown) => { const m = String(x || "").match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${+m[1]}/${+m[2]}` : String(x || ""); };
    const detail = `返却日 ${md(d.old_end)}→${md(d.new_end)}（${days}日）${d.priced ? `　+¥${Number(d.amount).toLocaleString()}` : "　料金はスタッフから"}`;
    const ex = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.spk&field=eq.extend&status=eq.requested&select=id,new_value&limit=1`);
    if (ex[0] && String(ex[0].new_value || "") === detail) return json({ ok: true, alreadyRequested: true, message: "同じ内容の依頼を受付済みです" }, 200, origin);
    const payload = { days, quote: d };
    if (ex[0]) await sbPatch("mypage_changes", `id=eq.${ex[0].id}`, { new_value: detail, payload }, "customer:" + resId);
    else await sbPost("mypage_changes", { reservation_id: resId, store: "spk", field: "extend", old_value: `返却日 ${md(d.old_end)}`, new_value: detail, source: "customer", status: "requested", note: "日を延ばす（承認制）", payload }, "customer:" + resId);
    await notifySlackCard({ emoji: "🟡", title: "日を延ばす依頼（承認待ち）", name: r.name, resId, ota: r.ota, period: `${r.lend_date}〜${r.return_date}`, vehicle: r.vehicle,
      lines: [`📝 *希望*　${detail}`, d.conflict ? `⚠️ 同じ車の次の予約 ${md(d.next_date)}（車の入れ替えが要ります）` : (d.next_date ? `次の予約 ${md(d.next_date)}` : "同じ車の次の予約なし"), d.priced ? "承認で返却日を延ばし、差額はSquareリンク" : "⚠️ 公式サイトの値段がないクラス：金額は手動で"],
      action: "⚠️ *要対応*：管理画面のアクションタブで承認／お断り" });
    return json({ ok: true, requested: true, amount: d.amount ?? null }, 200, origin);
  }
  if (action === "request") {
    if (cancelled) return json({ error: "キャンセル済みの予約は変更できません" }, 409, origin);
    const reqType = String(p.req_type || "").trim(); // "option" | "method" | "insurance"
    const detail = String(p.detail || "").trim().slice(0, 300);
    const map: Record<string, string> = { option: "有料オプション(シート類)変更", method: "貸出/返却方法(区分)変更", insurance: "補償(免責)変更" };
    if (!map[reqType]) return json({ error: "リクエスト種別が不正です" }, 400, origin);
    if (detail.length < 1) return json({ error: "変更内容を入力してください" }, 400, origin);
    // 受付期限（種別ごと）: option=貸出前日19:00 / insurance=貸出前まで / method=出発2時間前
    // 2026-11-07 nosh：期限（オプション＝貸出前日19:00・方法＝出発24時間前）は目安。期限後も申請を受け付け、運営が可否を返す（公式LINEへは誘導しない）。
    // 補償だけは貸出開始後に変えられないため止める（当日はお渡しの際に変更可）。
    if (reqType === "insurance" && pastInsDeadline(r.lend_date, r.lend_time || r.del_time || ""))
      return json({ error: "ご利用開始後は、補償プランを変更できません。" }, 409, origin);
    const already = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&field=eq.${reqType}&status=eq.requested&select=id&limit=1`);
    if (already[0]) return json({ ok: true, alreadyRequested: true, message: "同じ内容の依頼を受付済みです" }, 200, origin);
    // 構造化ターゲット（承認時に自動反映するための値）: insurance={insurance:"NOC"} / option={opt_c:1,opt_j:0,...}
    const payload = (p.target && typeof p.target === "object") ? p.target : null;
    await sbPost("mypage_changes", { reservation_id: resId, store: "spk", field: reqType, old_value: "", new_value: detail, source: "customer", status: "requested", note: map[reqType], payload }, "customer:" + resId);
    await notifySlackCard({ emoji: "🟡", title: `${map[reqType]}の依頼（承認待ち）`, name: r.name, resId, ota: r.ota, period: `${r.lend_date}〜${r.return_date}`, vehicle: r.vehicle, lines: [`📝 *依頼内容*\n${detail}`], action: "⚠️ *要対応*：管理コンソール →「🔔変更依頼」で承認/却下（即時反映されていません）" });
    return json({ ok: true, requested: true, kind: map[reqType] }, 200, origin);
  }

  // ---- cancel_request: キャンセル依頼（即削除しない＝OTA予約の安全側。スタッフ承認制）----
  if (action === "cancel_request") {
    if (cancelled) return json({ ok: true, alreadyCancelled: true }, 200, origin);
    const reason = String(p.reason || "").trim().slice(0, 200);
    const already = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&field=eq.cancel&status=eq.requested&select=id&limit=1`);
    if (already[0]) return json({ ok: true, alreadyRequested: true }, 200, origin);
    await sbPost("mypage_changes", { reservation_id: resId, store: "spk", field: "cancel", old_value: st, new_value: "キャンセル依頼", source: "customer", status: "requested", note: reason }, "customer:" + resId);
    await notifySlackCard({ emoji: "🔴", title: "キャンセル申請（承認待ち）", name: r.name, resId, ota: r.ota, period: `${r.lend_date}〜${r.return_date}`, vehicle: r.vehicle, lines: [`📝 *理由*\n${reason || "（記載なし）"}`], action: "⚠️ *要対応*：管理コンソール →「🔔変更依頼」で承認/却下（承認でキャンセル確定＋配車解除＋顧客LINE）" });
    { const _nw = isNewSite(r.ota, resId);
    const m = await hdmMsg({ emoji: "🔴", store: "spk", title: `キャンセル申請（承認待ち）${_nw ? "（🆕NEW 公式サイト）" : ""}`, rid: resId, url: actUrl(resId), // ★2026-11-10 共通の型
          body: [await dateLine(resId, ""), `📝 ${reason || "（理由の記載なし）"}`, `💴 ¥${Number(r.price || 0).toLocaleString()}`, "⚠️ 要承認：承認＝キャンセル確定＋配車解除＋お客様へLINE（返金は規定に沿って手動Square返金）"], buttons: [{ text: "✅ キャンセル処理を開く", url: actUrl(resId) }] });
        await slackResv(m.text, m.blocks); }
    return json({ ok: true, requested: true }, 200, origin);
  }

  // ---- ready: 返却準備完了（予定より早く回収してOKの合図）。スケジュールに余裕があれば早める判断材料。----
  if (action === "ready") {
    if (cancelled) return json({ error: "キャンセル済みの予約です" }, 409, origin);
    const already = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&field=eq.ready&status=eq.requested&select=id&limit=1`);
    if (already[0]) return json({ ok: true, alreadyRequested: true }, 200, origin);
    const rdyTime = (typeof p.time === "string" && /^\d{1,2}:\d{2}$/.test(p.time.trim())) ? p.time.trim() : "";
    const newVal = rdyTime ? `返却準備完了(早め回収OK) 希望時間 ${rdyTime}〜` : "返却準備完了(早め回収OK)";
    await sbPost("mypage_changes", { reservation_id: resId, store: "spk", field: "ready", old_value: "", new_value: newVal, source: "customer", status: "requested", note: rdyTime ? `希望回収時間の目安 ${rdyTime}〜` : "予定時間より早い回収OK" }, "customer:" + resId);
    // 予定回収はOP/マイページと同じ resolveTaskTime(回収タスク) 優先（予約生値 return_time/col_time 直読みだと食い違う）
    const rdyTasks = await sbGet(store.tasks, `reservation_id=eq.${encodeURIComponent(resId)}&deleted=not.is.true&select=_id,place,time,insurance,changed_json`);
    const rdyCTask = rdyTasks.find((t: any) => String(t._id || "").startsWith("c-"));
    const schedCol = resolveTaskTime(rdyCTask) || r.return_time || r.col_time || "-";
    await notifySlackCard({ side: "back", emoji: "🟢", title: "早め回収OK（返却準備完了）", name: r.name, resId, ota: r.ota, period: `${r.lend_date}〜${r.return_date}`, vehicle: r.vehicle, lines: [`🕐 *予定回収*　${schedCol}`, `🕒 *お客様の希望*　${rdyTime ? `*${rdyTime}〜*` : "指定なし"}`], action: "💡 スケジュールに余裕があれば早めに回収をご検討ください（お客様には「確認中」と表示中）" });
    return json({ ok: true, requested: true }, 200, origin);
  }

  return json({ error: "unknown action" }, 400, origin);
});
