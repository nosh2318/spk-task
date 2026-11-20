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
  // ★2026-11-15 nosh「札幌・那覇の新規予約取り込み・キャンセル・キャンセル完了・新規予約受付は店の予約の部屋（札幌C08TDTPEB36・那覇C06KZ56NTDF）／システムと配車は C07B5G3PV7C」：高松はこの下の今まで通り
  if (!tkm && !sys && HDMR_H.includes(ch)) {
    const hm = String(text || "").match(/^【[^｜】\n]+｜([^】\n]+)】([^\n]*)/), kind = hm ? hm[1] : m[2], title = hm ? hm[2] : "";
    const nha = /那覇|沖縄/.test(store) || (!/札幌/.test(store) && /KEYDROP/i.test(store) && ch === "C06KZ56NTDF"), spk = !nha && /札幌|KEYDROP/i.test(store);
    if ((nha || spk) && (/^取込 (✅成功|❌失敗)$/.test(kind) || /^配車・取込／取込漏れ/.test(kind) || /新規予約|予約受付|予約登録|キャンセル(申請|承認|確定|完了|処理|受付|を?反映|通知|しました)/.test(title))) return { ws: "H", ch: nha ? "C06KZ56NTDF" : "C08TDTPEB36" };
    if ((nha || spk) && /^配車・取込/.test(kind)) return { ws: "H", ch: "C07B5G3PV7C" };
  }
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
// Supabase Edge Function: mypage-request-remind（main / ckrxttbnawkclshczsia）
// マイページの依頼（変更・キャンセル・早め回収など）を「返事の目安」を過ぎないように Slack で再通知する。
//   経過時間は受付から数える（JST 9:00〜19:00）。夜間（19:00〜翌9:00）の受付は次の 9:00 から数える。
//   未処理のまま 30分経過で1回目、90分経過で2回目を店ごとの Slack に出す（2026-11-07 nosh 指示。mypage_request_reminders で重複防止）。
//   依頼の一覧は mypage-active.html のアクションタブと同じ RPC（main: mpadmin_pending / BT: mpadmin_pending_bt）。
// 起動: pg_cron が 5分ごとに x-cron-secret 付きで POST。
// deploy: functions deploy mypage-request-remind --no-verify-jwt（secrets: CRON_SECRET, SLACK_BOT_TOKEN は既存）

function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const BT_URL = "https://ggqugvyskyiblxiycpci.supabase.co";
// BT の公開(anon)キー。mypage-active.html / mypage-admin と同じ値（anon RPC のみ使用）
const BT_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncXVndnlza3lpYmx4aXljcGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDc3NjksImV4cCI6MjA5MzY4Mzc2OX0.uNhWcBd_Dl5nzemZDQfJ8mQV6iY73MwystGGpTRPC18";
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const PAGE = "https://nosh2318.github.io/spk-task/mypage-active.html";

// 店ごとの通知先（各店のマイページ通知と同じチャンネル。環境変数で上書き可）
const CH: Record<string, string> = {
  hdm_spk: Deno.env.get("SLACK_MYPAGE_CHANNEL") || "C0BER0YC6AK",
  hdm_nha: Deno.env.get("SLACK_NHA_USER_CHANNEL") || "C06L91W6T08",
  hdm_tkm: Deno.env.get("SLACK_TKM_CHANNEL") || "C0BFMBLEJGZ",
  but_tkm: Deno.env.get("SLACK_TKM_CHANNEL") || "C0BFMBLEJGZ",
  key_spk: Deno.env.get("SLACK_KEYDROP_CHANNEL") || "C08TDTPEB36",
  key_nha: Deno.env.get("SLACK_KEYDROP_CHANNEL") || "C08TDTPEB36",
};
const STORE_JP: Record<string, string> = { hdm_spk: "HDM 札幌", hdm_nha: "HDM 那覇", hdm_tkm: "HDM 高松", but_tkm: "BUT 高松", key_spk: "KEY 札幌", key_nha: "KEY 那覇" };
const FLD: Record<string, string> = { del_place: "届け先の場所の変更", col_place: "回収の場所の変更", lend_time: "貸出の時間の変更", return_time: "返却の時間の変更", ready: "早めの回収", option: "オプションの変更", cancel: "キャンセル" };

function json(o: unknown, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } }); }

// 経過を数え始める時刻：営業時間内の受付はその時刻、夜間の受付は次の 9:00 JST
function baseOf(at: string): number | null {
  const t = new Date(at); if (isNaN(+t)) return null;
  const j = new Date(+t + 9 * 3600e3), h = j.getUTCHours() + j.getUTCMinutes() / 60;
  if (h >= 9 && h < 19) return +t;
  const day = Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate() + (h < 9 ? 0 : 1));
  return day + 9 * 3600e3 - 9 * 3600e3; // その日の 9:00 JST
}
const STAGES = [{ n: 1, min: 30 }, { n: 2, min: 90 }];

async function rpc(base: string, key: string, fn: string): Promise<any[]> {
  try {
    const r = await fetch(`${base}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: "{}" });
    if (!r.ok) { console.error("[rpc]", fn, r.status); return []; }
    const j = await r.json(); return Array.isArray(j) ? j : [];
  } catch (e) { console.error("[rpc]", fn, String(e)); return []; }
}

async function slack(channel: string, text: string): Promise<boolean> {
  const token = Deno.env.get("SLACK_BOT_TOKEN"); if (!token) { console.log("[slack skip]", text); return false; }
  try {
    const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel, text }) });
    const d = await r.json().catch(() => ({})); if (!d.ok) console.error("[slack]", channel, d.error); return !!d.ok;
  } catch (e) { console.error("[slack]", String(e)); return false; }
}

async function slackBuddica(channel: string, text: string): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/mpremind_slack_post_buddica`, { method: "POST", headers: H, body: JSON.stringify({ p_channel: channel, p_text: text }) });
    const j = await r.json().catch(() => null); if (!r.ok || j == null) console.error("[slack-buddica]", r.status, j); return r.ok && j != null;
  } catch (e) { console.error("[slack-buddica]", String(e)); return false; }
}

// ★2026-11-09 nosh「全ての通知に統一全店」：Slack 2行目＝予約ID｜🚗車両名 ナンバー｜👤予約者名 様（配車表→車両表が正）
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
//   📅 行：依頼の側（貸出側/返却側）の日付＋曜日＋【今日】【明日】。キャンセル等どちらでもない依頼は両方を出す。
function hdmWhen(store: string, field: unknown, sd: unknown, ed: unknown): string { // 表記は handyman-mypage の dateLine と同じ（2026-11-12 札幌で先行）
  const f = String(field || ""), dl = /spk$/.test(String(store)) ? ["お届け日", "回収日"] : ["貸出日", "返却日"];
  const j = new Date(Date.now() + 9 * 3600e3), td = j.toISOString().slice(0, 10), tm = new Date(+j + 864e5).toISOString().slice(0, 10);
  const one = (v: unknown) => { const s = String(v || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ""; const d = new Date(s + "T00:00:00Z"); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${"日月火水木金土"[d.getUTCDay()]})${s === td ? "【今日】" : s === tm ? "【明日】" : ""}`; };
  const go = /^(del_place|lend_time|mp_pickup|mp_visit)$/.test(f), back = /^(col_place|return_time|ready|mp_dropoff|mp_store_return)$/.test(f);
  const g = one(sd), b = one(ed);
  const p = (go ? [g && `*${dl[0]}*　${g}`] : back ? [b && `*${dl[1]}*　${b}`] : [g && `*${dl[0]}*　${g}`, b && `*${dl[1]}*　${b}`]).filter(Boolean);
  return p.length ? `📅 ${p.join("　／　")}` : "";
}

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

// ★2026-11-20 nosh「押し忘れても何も起きない→それはだめ」「スラック通知は必須」：無人貸出（札幌・那覇）で貸出時刻を30分過ぎても
//   「お車に乗りました」が押されていない予約を店の部屋に1回だけ知らせる（同意がまだ・停車場所の登録がまだ も同じ1回で知らせる）。
//   重複防止は mypage_request_reminders（bucket=hdm_spk/hdm_nha・change_id=ua-<無人行id>・stage=1）。新しい cron は作らない（この見回りに相乗り）
const UA_MIN = 30;
// レビュー条件（11/20 omni-review）：①分類は明示（題名の「受け取り完了」で済んだこと扱いにしない）②時刻はマイページと同じ順（札幌＝お届けタスク→適用済み変更→予約／那覇＝適用済み変更→お届けタスク→予約）
//   ③読めなかった時は「未受取・未通知」とみなさず、その回は見送る ④状態ごとに1回（1=停車場所が未登録・2=同意がまだ・3=押されていない）＝前の状態で鳴っても押し忘れは別に鳴る
//   ⑤お届けタスクが済（スタッフが手渡し等）なら鳴らさない
async function sbGetR(path: string): Promise<any[] | null> { try { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H }); if (!r.ok) { console.error("[ua get]", path.split("?")[0], r.status); return null; } const j = await r.json(); return Array.isArray(j) ? j : null; } catch (e) { console.error("[ua get]", String(e)); return null; } }
const uaCj = (v: unknown): any => { if (v && typeof v === "object") return v; try { return JSON.parse(String(v || "{}")) || {}; } catch { return {}; } };
const uaHm = (v: unknown): string => { const m = String(v || "").match(/(\d{1,2}):(\d{2})/); return m ? m[1].padStart(2, "0") + ":" + m[2] : ""; };
async function uaRemind(now: number, dry: boolean): Promise<{ hot: number; sent: number; skipped: number; out?: unknown[] }> {
  const rows = await sbGetR(`mypage_changes?field=eq.unattended&status=eq.applied&created_at=gte.${encodeURIComponent(new Date(now - 120 * 864e5).toISOString())}&select=id,reservation_id,store,payload&order=created_at.desc&limit=1000`);
  if (!rows) return { hot: 0, sent: 0, skipped: -1 };
  if (!rows.length) return { hot: 0, sent: 0, skipped: 0 };
  const dn = await sbGetR(`mypage_request_reminders?change_id=like.ua-*&select=bucket,change_id,stage`);
  if (!dn) return { hot: 0, sent: 0, skipped: -1 }; // 通知済みが読めない回は送らない（再送の嵐を防ぐ）
  const done = new Set(dn.map((r: any) => r.bucket + "|" + r.change_id + "|" + r.stage));
  const out: unknown[] = []; let hot = 0, sent = 0, skipped = 0;
  for (const u of rows) {
    const nha = u.store === "nha", bucket = nha ? "hdm_nha" : "hdm_spk", cid = "ua-" + u.id, rid = String(u.reservation_id || "");
    const py = u.payload || {}, stage = !py.placed_at ? 1 : !py.accepted_at ? 2 : 3;
    if (!rid || done.has(bucket + "|" + cid + "|" + stage)) continue;
    const q = encodeURIComponent(rid);
    const rr = await sbGetR(nha ? `nha_reservations?id=eq.${q}&select=id,status,ota,start_date,start_time` : `reservations?id=eq.${q}&select=id,status,ota,lend_date,lend_time`);
    if (!rr) { skipped++; continue; }
    const r = rr[0]; if (!r || /cancel|キャンセル/i.test(String(r.status || ""))) continue;
    const d = String((nha ? r.start_date : r.lend_date) || "").slice(0, 10);
    if (!d || now < Date.parse(`${d}T00:00:00+09:00`) - 864e5 || now > Date.parse(`${d}T00:00:00+09:00`) + 4 * 864e5) continue; // 貸出日の前日〜3日後だけ細かく読む
    const [tk, lc, rcv] = await Promise.all([
      sbGetR(nha ? `nha_tasks?${encodeURIComponent("予約番号")}=eq.${q}&_id=like.d-*&deleted=not.is.true&select=_id,${encodeURIComponent("確認")},${encodeURIComponent("時間")},${encodeURIComponent("変更")},changed_json&limit=1`
                 : `tasks?reservation_id=eq.${q}&_id=like.d-*&deleted=not.is.true&select=_id,done,time,changed_json&limit=1`),
      sbGetR(`mypage_changes?reservation_id=eq.${q}&field=eq.lend_time&status=eq.applied${nha ? "&store=eq.nha" : ""}&order=created_at.desc&limit=1&select=new_value`),
      sbGetR(`mypage_changes?reservation_id=eq.${q}&field=eq.received&status=eq.applied${nha ? "&store=eq.nha" : "&store=eq.spk"}&select=id&limit=1`),
    ]);
    if (!tk || !lc || !rcv) { skipped++; continue; }
    if (rcv.length) continue;
    const t = tk[0], cj = t ? uaCj(t.changed_json) : {};
    if (t && (nha ? String(t["確認"]) === "true" : t.done === true)) continue; // お届けタスクが済＝受け渡し済み
    const taskTime = t ? uaHm(nha ? (t["変更"] || cj._timeChange || cj._ssTime || t["時間"]) : (cj._timeChange || cj._ssTime || t.time)) : "";
    const chgTime = uaHm(lc[0] && lc[0].new_value), resvTime = uaHm(nha ? r.start_time : r.lend_time);
    const hm = nha ? (chgTime || taskTime || resvTime) : (taskTime || chgTime || resvTime);
    if (!hm) { skipped++; continue; } // 時刻が分からない予約は鳴らさない（09:00 扱いにしない）
    const at = Date.parse(`${d}T${hm}:00+09:00`); if (isNaN(at)) continue;
    if (now < at + UA_MIN * 60e3 || now > at + 3 * 864e5) continue;
    hot++;
    const pl = py.place || {}, spot = [pl.parking_name, pl.floor].filter(Boolean).join(" ");
    const title = stage === 1 ? "無人貸出：貸出時刻を過ぎても停車場所が登録されていません" : stage === 2 ? "無人貸出：貸出時刻を過ぎてもお客様の同意がありません" : "無人貸出：お客様が「お車に乗りました」をまだ押していません";
    const ask = stage === 1 ? "👉 停めた場所を「②停車場所」で送ってください" : "👉 お客様に受け取れたか確認してください（LINE・電話）";
    const link = `${PAGE}?bucket=${bucket}&rid=${encodeURIComponent(rid)}`;
    const store = nha ? "nha" : (String(r.ota || "") === "KEYDROP" ? "kd_spk" : "spk");
    const text = (await hdmMsg({ emoji: "🟡", store, cat: "タスクの遅れ／ボタンの押し忘れ", title, rid, side: "go", url: link, body: [spot ? `🅿️ ${spot}（${hm} からお受け取り）` : `貸出 ${hm}`, ask] })).text;
    if (dry) { out.push({ bucket, cid, stage, text }); continue; }
    if (await slack(CH[bucket], text)) {
      sent++;
      await fetch(`${SB_URL}/rest/v1/mypage_request_reminders`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify([{ bucket, change_id: cid, stage }]) });
    }
  }
  return { hot, sent, skipped, out: dry ? out : undefined };
}

// ★2026-11-20 nosh「乗り捨て 札幌 那覇 統一」：乗り捨てを発動したのに、返却時刻＋30分を過ぎてもお客様の「停めました」（dropoff_submit）が無ければ店の部屋に1回だけ知らせる（無人貸出と同じ見回り・新しい定期処理なし）
async function doRemind(now: number, dry: boolean): Promise<{ hot: number; sent: number; skipped: number; out?: unknown[] }> {
  const rows = await sbGetR(`mypage_changes?field=eq.dropoff&status=eq.applied&created_at=gte.${encodeURIComponent(new Date(now - 120 * 864e5).toISOString())}&select=id,reservation_id,store,payload&order=created_at.desc&limit=1000`);
  if (!rows) return { hot: 0, sent: 0, skipped: -1 };
  if (!rows.length) return { hot: 0, sent: 0, skipped: 0 };
  const dn = await sbGetR(`mypage_request_reminders?change_id=like.do-*&select=bucket,change_id`);
  if (!dn) return { hot: 0, sent: 0, skipped: -1 };
  const done = new Set(dn.map((r: any) => r.bucket + "|" + r.change_id));
  const out: unknown[] = []; let hot = 0, sent = 0, skipped = 0;
  for (const u of rows) {
    const nha = u.store === "nha", bucket = nha ? "hdm_nha" : "hdm_spk", cid = "do-" + u.id, rid = String(u.reservation_id || "");
    if (!rid || done.has(bucket + "|" + cid)) continue;
    const q = encodeURIComponent(rid);
    const rr = await sbGetR(nha ? `nha_reservations?id=eq.${q}&select=id,status,ota,end_date,end_time` : `reservations?id=eq.${q}&select=id,status,ota,return_date,return_time`);
    if (!rr) { skipped++; continue; }
    const r = rr[0]; if (!r || /cancel|キャンセル/i.test(String(r.status || ""))) continue;
    const d = String((nha ? r.end_date : r.return_date) || "").slice(0, 10);
    if (!d || now < Date.parse(`${d}T00:00:00+09:00`) - 864e5 || now > Date.parse(`${d}T00:00:00+09:00`) + 4 * 864e5) continue;
    const [tk, lc] = await Promise.all([
      sbGetR(nha ? `nha_tasks?${encodeURIComponent("予約番号")}=eq.${q}&_id=like.c-*&deleted=not.is.true&select=_id,${encodeURIComponent("確認")},${encodeURIComponent("時間")},${encodeURIComponent("変更")},changed_json&limit=1`
                 : `tasks?reservation_id=eq.${q}&deleted=not.is.true&type=in.(COL,返却,乗り捨て,乗捨回収)&select=_id,done,time,changed_json&limit=1`),
      sbGetR(`mypage_changes?reservation_id=eq.${q}&field=eq.return_time&status=eq.applied${nha ? "&store=eq.nha" : ""}&order=created_at.desc&limit=1&select=new_value`),
    ]);
    if (!tk || !lc) { skipped++; continue; }
    const t = tk[0], cj = t ? uaCj(t.changed_json) : {};
    if (t && (nha ? String(t["確認"]) === "true" : t.done === true)) continue; // 回収タスクが済＝回収済み
    const taskTime = t ? uaHm(nha ? (t["変更"] || cj._timeChange || cj._ssTime || t["時間"]) : (cj._timeChange || cj._ssTime || t.time)) : "";
    const chgTime = uaHm(lc[0] && lc[0].new_value), resvTime = uaHm(nha ? r.end_time : r.return_time);
    const hm = nha ? (chgTime || taskTime || resvTime) : (taskTime || chgTime || resvTime);
    if (!hm) { skipped++; continue; }
    const at0 = Date.parse(`${d}T${hm}:00+09:00`); if (isNaN(at0)) continue;
    const actAt = Date.parse(String((u.payload && u.payload.activated_at) || "")); const at = isNaN(actAt) ? at0 : Math.max(at0, actAt); // 返却時刻より後に発動した時は、発動から30分
    if (now < at + UA_MIN * 60e3 || now > at0 + 3 * 864e5) continue;
    hot++;
    const link = `${PAGE}?bucket=${bucket}&rid=${encodeURIComponent(rid)}`;
    const store = nha ? "nha" : (String(r.ota || "") === "KEYDROP" ? "kd_spk" : "spk");
    const text = (await hdmMsg({ emoji: "🟡", store, cat: "タスクの遅れ／ボタンの押し忘れ", title: "乗り捨て：返却時刻を過ぎても「停めました」の連絡がありません", rid, side: "back", url: link, body: [`🏁 ご返却 ${hm}`, "👉 お客様に停めたか確認してください（LINE・電話）"] })).text;
    if (dry) { out.push({ bucket, cid, text }); continue; }
    if (await slack(CH[bucket], text)) {
      sent++;
      await fetch(`${SB_URL}/rest/v1/mypage_request_reminders`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify([{ bucket, change_id: cid, stage: 1 }]) });
    }
  }
  return { hot, sent, skipped, out: dry ? out : undefined };
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) return new Response("unauthorized", { status: 401 });
  let dry = false, check = false; try { const b = await req.json(); dry = !!(b && b.dry); check = !!(b && b.check); } catch { /* none */ }
  // check: 各店チャンネルにボットが入っているかだけ調べる（投稿しない）
  if (check) {
    const token = Deno.env.get("SLACK_BOT_TOKEN") || ""; const res: Record<string, unknown> = {};
    for (const ch of [...new Set(Object.values(CH))]) {
      try { const r = await fetch(`https://slack.com/api/conversations.info?channel=${ch}`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); res[ch] = d.ok ? { name: d.channel?.name, is_member: d.channel?.is_member, private: d.channel?.is_private } : { error: d.error }; } catch (e) { res[ch] = { error: String(e) }; }
    }
    return json({ ok: true, channels: res });
  }

  const now = Date.now();
  let ua: unknown = null; try { ua = await uaRemind(now, dry); } catch (e) { console.error("[ua remind]", String(e)); ua = { error: String(e) }; }
  let dropoff: unknown = null; try { dropoff = await doRemind(now, dry); } catch (e) { console.error("[dropoff remind]", String(e)); dropoff = { error: String(e) }; }
  const [a, b] = await Promise.all([rpc(SB_URL, SB_KEY, "mpadmin_pending"), rpc(BT_URL, BT_ANON, "mpadmin_pending_bt")]);
  const hot: { x: any; st: number; el: number }[] = [];
  for (const x of a.concat(b)) {
    if (!x || x.status !== "requested") continue;
    // ★2026-11-14 nosh「高松も統一せよ」（再通知を止める件）：承認の案のカード（オムニ）が出た札幌・那覇は Slack の再通知を止める。件数は画面に出る。
    //   高松は下の行（HDM の送迎の時間だけ）。KEYDROP は今のまま。戻し方：notify-unify-1114/backup_remind/index.ts を deploy
    if (x.bucket === "hdm_spk" || x.bucket === "hdm_nha") continue;
    // ★2026-11-14 高松の案のカード（spk-task #326・HDM 高松の送迎の時間 mp_pickup / mp_dropoff だけ）が出たので、その種類だけ止める。
    //   ほかの種類（mp_visit・mp_store_return など）と BUDDICA（but_tkm）はカードが出ないので今のまま。戻し方：notify-unify-1114/backup_remind2/index.ts を deploy
    if (x.bucket === "hdm_tkm" && /^mp_(pickup|dropoff)$/.test(String(x.field || ""))) continue;
    const base = baseOf(String(x.at || "")); if (base == null) continue;
    const el = Math.floor((now - base) / 60e3);
    if (el > 3 * 24 * 60) continue; // 3日より前の放置分は対象外（初回起動時の一斉通知を防ぐ）
    const st = STAGES.filter((s) => el >= s.min).pop(); if (st) hot.push({ x, st: st.n, el });
  }
  if (!hot.length) return json({ ok: true, hot: 0, sent: 0, ua, dropoff });

  const done = new Set<string>();
  const r0 = await fetch(`${SB_URL}/rest/v1/mypage_request_reminders?select=bucket,change_id,stage&reminded_at=gte.${encodeURIComponent(new Date(now - 14 * 864e5).toISOString())}`, { headers: H });
  if (r0.ok) for (const r of await r0.json()) done.add(r.bucket + "|" + r.change_id + "|" + r.stage);

  let sent = 0; const out: unknown[] = [];
  for (const { x, st, el } of hot) {
    const key = x.bucket + "|" + x.id + "|" + st; if (done.has(key)) continue;
    // 2回目の時点で1回目が未送信なら、2回目だけ出す（1回目は記録だけ）
    const elTxt = el >= 120 ? `${Math.floor(el / 60)}時間${el % 60 ? (el % 60) + "分" : ""}` : `${el}分`;
    const link = `${PAGE}?tab=action&bucket=${encodeURIComponent(x.bucket)}&rid=${encodeURIComponent(x.rid)}`;
    // ★2026-11-10 nosh「通知は全て内容統一して」：共通の型（bucket→店。KEYDROP→KEYDROP札幌/那覇、BUDDICA→BUDDICA高松）
    const BK: Record<string, string> = { hdm_spk: "spk", hdm_nha: "nha", hdm_tkm: "tkm", key_spk: "kd_spk", key_nha: "kd_nha", but_tkm: "but" };
    const text = (await hdmMsg({ emoji: st === 1 ? "⏰" : "🚨", store: BK[x.bucket] || x.bucket, title: `${st === 1 ? "" : "2回目："}返事がまだの依頼（受付から${elTxt}）`, rid: String(x.rid), url: link,
      body: [hdmWhen(x.bucket, x.field, x.sd, x.ed), `${FLD[x.field] || x.field}${x.newv ? `：${x.newv}` : ""}`, "⚠️ 要対応：アクションタブで返事してください"] })).text;
    if (dry) { out.push({ key, channel: CH[x.bucket], text }); continue; }
    // 高松は別ワークスペース（buddica-tourism）。DB関数が Vault のボットトークンで pg_net 送信する
    const ok = /_tkm$/.test(x.bucket) ? await slackBuddica(CH[x.bucket], text) : await slack(CH[x.bucket] || CH.hdm_spk, text);
    if (ok) {
      sent++;
      const recs = [{ bucket: x.bucket, change_id: String(x.id), stage: st }]; if (st === 2) recs.push({ bucket: x.bucket, change_id: String(x.id), stage: 1 });
      await fetch(`${SB_URL}/rest/v1/mypage_request_reminders`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(recs) });
    }
  }
  return json({ ok: true, hot: hot.length, sent, ua, dropoff, dry: dry ? out : undefined });
});
