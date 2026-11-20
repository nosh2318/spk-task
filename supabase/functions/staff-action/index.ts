// ===== ★2026-11-14 nosh「通知スタイル統一・全通知に管理画面ダイレクトリンク」：送る直前に4行の形へそろえる（hdmMsg を通らない通知用・全送り元で同じ規則） =====
//   既に【店｜種類】で始まる文はそのまま。スレッド返信（その場の返事）には使わない。文の中身は捨てず、4行に詰め直すだけ
const HDMN_BK: [RegExp, string, string][] = [[/KEYDROP\s*札幌/, "key_spk", "KEYDROP札幌"], [/KEYDROP\s*那覇/, "key_nha", "KEYDROP那覇"], [/BUDDICA/, "but_tkm", "BUDDICA高松"], [/札幌|SPK/i, "hdm_spk", "札幌"], [/那覇|沖縄|NHA/i, "hdm_nha", "那覇"], [/高松|BT\b|TKM/i, "hdm_tkm", "高松"]];
function hdmnCat(t: string): string {
  const R: [RegExp, string][] = [
    [/(取込|取り込|GAS|Gmail).*(停止|止ま)|heartbeat|ハートビート|取得失敗|読めません|パース/i, "システム／予約取込"], [/停止中|止まって|起動できて|心拍|代わりに動き/, "システム／ボット・サーバー"], [/値段|料金.*(上げ|下げ)|値上げ|値下げ/, "依頼に返事／価格の承認"], [/HP .*(登録|変更|キャンセル)|admin|管理画面/i, "配車・取込／在庫・OTA"], [/免許/, "準備が足りない／免許証"], [/傷チェック|傷/, "準備が足りない／傷チェック"],
    [/取込漏れ|取り込み漏れ|補填|取込失敗|取り込み失敗|取り込めません|取込めません/, "配車・取込／取込漏れ"], [/新規予約|自動取込|予約登録|再配車|取込|取り込/, "配車・取込／配車"],
    [/相談/, "依頼に返事／担当からの相談"], [/チャット/, "お客様の知らせ／チャット"], [/代車/, "依頼に返事／代車"], [/早め回収/, "依頼に返事／早め回収"],
    [/返金/, "お金／返金"], [/決済リンク|リンク停止|リンクを止め/, "お金／決済リンク"], [/消し込み|会計|クーポン|不整合|ずれ|二重/, "お金／会計のずれ"], [/未入金|未払|未決済|領収書|レシート|立替/, "お金／未払い・入金"],
    [/遅れて完了|タスク完了/, "タスクの遅れ／完了"], [/着きました|遅れ|到着|合流|受け取り完了|お客様から「/, "お客様の知らせ／着きました・遅れます"], [/問い合わせ|お問合せ|未返信/, "お客様の知らせ／問い合わせ"],
    [/押されていません|押し忘れ|時刻を過ぎ/, "タスクの遅れ／ボタンの押し忘れ"], [/送迎の通知|お知らせ.*届いて/, "タスクの遅れ／送迎のお知らせ"], [/未確認|タスク.*確認/, "タスクの遅れ／今日のタスク未確認"],
    [/返事がまだ|引き受け|スキップ|打刻|出勤|退勤/, "タスクの遅れ／担当の返事"],
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
// 2026-10-23 新API鍵移行：新形式の鍵を優先し、無ければ旧鍵（移行期間の保険・旧鍵の無効化前に外す）
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
console.log("[keymig]", __newKey("SUPABASE_SECRET_KEYS", "edge") ? "secret" : "legacy");
// staff-action — バイト個人ページ(staff.html)用のアクションEF
// body: { token(staff share_token), store?("spk"|"nha"), resv_no, action }
//   action: depart | collect | arrival | col_arrival | dropoff | done | approve | skip | delay_del | delay_col
//           | pu_depart | pu_at_stop | pu_met | bd_depart | bd_at_airport（2026-11-08 送迎・那覇のみ・task_id 必須）
//           | pu_jam | bd_jam（渋滞 +min分）| sh_vehicle（送迎車の登録）。出発は送迎車(vehicle)が決まっていないと記録しない（2026-11-08 nosh 送迎車を必須情報に）
// 認証: staff.share_token（ログイン不要）→ 内部でline-push(FUNC_SECRET)を呼びLINE自動送信
// deploy: functions deploy staff-action --no-verify-jwt
//   secrets: FUNC_SECRET（line-pushと共有）, SLACK_BOT_TOKEN, STAFF_DONE_CHANNEL, STAFF_DONE_CHANNEL_NHA
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const FUNC_SECRET = Deno.env.get("FUNC_SECRET")!;

// === 店舗別コンフィグ（SPK既定＝従来動作を1文字も変えない） ===
type Cfg = {
  staffTbl: string; tasksTbl: string; resvTbl: string;
  pushStore: string; mypageBase: string; slackChKey: string;
  assigneeCol: string; donePatch: Record<string, unknown>;
  // select別名（Japanese列→英語キーに正規化）
  selApprove: string; selSkip: string; selDone: string; selPlate: string;
};
const CFGS: Record<string, Cfg> = {
  spk: {
    staffTbl: "staff", tasksTbl: "tasks", resvTbl: "reservations",
    pushStore: "spk", mypageBase: "https://nosh2318.github.io/spk-task/my.html", slackChKey: "STAFF_DONE_CHANNEL",
    assigneeCol: "assignee", donePatch: { done: true },
    selApprove: "_id,type,name,assigned_vehicle,plate_no,time,return_time,date,requested_to,assignee,reservation_id",
    selSkip: "_id,type,name,assigned_vehicle,plate_no,time,return_time,date,requested_to,assignee,skipped_by,reservation_id",
    selDone: "_id,type,name,assigned_vehicle,plate_no,time,return_time,assignee,date,reservation_id",
    selPlate: "plate_no,assigned_vehicle",
  },
  nha: {
    staffTbl: "nha_staff", tasksTbl: "nha_tasks", resvTbl: "nha_reservations",
    pushStore: "nha", mypageBase: "https://nosh2318.github.io/naha-project/my-nha.html", slackChKey: "STAFF_DONE_CHANNEL_NHA",
    assigneeCol: "担当", donePatch: { "確認": "true" },
    selApprove: "_id,type:内容,name:予約者,assigned_vehicle,plate_no:No,time:時間,return_time:変更,date,requested_to,assignee:担当,reservation_id:予約番号",
    selSkip: "_id,type:内容,name:予約者,assigned_vehicle,plate_no:No,time:時間,return_time:変更,date,requested_to,assignee:担当,skipped_by,reservation_id:予約番号",
    selDone: "_id,type:内容,name:予約者,assigned_vehicle,plate_no:No,time:時間,return_time:変更,assignee:担当,date,reservation_id:予約番号",
    selPlate: "plate_no:No,assigned_vehicle",
  },
};

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
    [/遅れて完了|タスク完了/, "タスクの遅れ／完了"], [/着きました|遅れ|到着|合流|受け取り完了|お客様から「/, "お客様の知らせ／着きました・遅れます"], [/問い合わせ/, "お客様の知らせ／問い合わせ"],
    [/押されていません|押し忘れ|時刻を過ぎ/, "タスクの遅れ／ボタンの押し忘れ"], [/送迎の通知|お知らせ.*届いて/, "タスクの遅れ／送迎のお知らせ"], [/未確認|タスク.*確認/, "タスクの遅れ／今日のタスク未確認"],
    [/返事がまだ|引き受け|スキップ|打刻/, "タスクの遅れ／担当の返事"],
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
// ★2026-11-09 タスク→予約ID：タスクの予約番号列（札幌 reservation_id／那覇 予約番号）を優先。無ければ task _id の
//   「d-/c-/w-/p-＋予約番号」（OPシートのタスク作成と同じ形）から取り出す。それ以外の形（s-/dr-/uid 等）は取れない＝""（2行目を入れない）。
function resvOfTask(T: any): string {
  const r = String((T && T.reservation_id) || "").trim(); if (r) return r;
  const m = String((T && T._id) || "").match(/^[dcwp]-(.+)$/); return m ? m[1] : "";
}
function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST,OPTIONS" } });
}
async function sbGet(path: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  return r.ok ? await r.json() : [];
}
async function sbPatch(path: string, body: unknown) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method: "PATCH", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body) });
  return r.ok;
}
function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "-" + Math.random())).replace(/-/g, ""); }
const TYPE: Record<string, string> = { DEL: "🚚お届け", COL: "🧭回収", "洗車": "🧽洗車", PU: "🚐送迎お迎え", PUB: "🚌バスお迎え", BD: "🚐お見送り", BDB: "🚌バスお見送り", "返却": "🔑返却", "来店": "🏠来店" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
  const token = String(body.token || "").trim();
  const store = (String(body.store || "spk").trim().toLowerCase() === "nha") ? "nha" : "spk";
  const CFG = CFGS[store];
  const resv_no = String(body.resv_no || "").trim();
  const action = String(body.action || "").trim();
  let LAST_CH = "";  // 2026-11-09 実際に届けた方法（line/mail/rakuten）
  if (!action) return json({ ok: false, error: "missing params" }, 400);
  if (action !== "done" && action !== "approve" && action !== "skip" && !/^(pu_|bd_)/.test(action) && action !== "sh_vehicle" && !resv_no) return json({ ok: false, error: "missing resv_no" }, 400);

  // 1) staff token 検証
  let staffName = "";
  if (token) {
    const staff = await sbGet(`${CFG.staffTbl}?share_token=eq.${encodeURIComponent(token)}&select=name,active&limit=1`);
    if (!staff[0] || staff[0].active === false) return json({ ok: false, error: "invalid_token" }, 401);
    staffName = staff[0].name;
  } else {
    // ★2026-11-09 nosh「こべつURLと同じか？ボタンあるか？」：タスクサマリー（ログイン中）からも同じボタン・同じ文面・同じ連打防止
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    let em = "";
    if (jwt && jwt !== SB_KEY) {
      try {
        const ur = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") || SB_KEY, Authorization: `Bearer ${jwt}` } });
        if (ur.ok) { const u = await ur.json(); em = String((u && u.email) || "").toLowerCase(); }
      } catch { /* noop */ }
    }
    if (!(em.endsWith(store === "nha" ? "@nha.hdm" : "@spk.hdm") || em.endsWith("@g-lines.jp"))) return json({ ok: false, error: "invalid_token" }, 401);
    staffName = em.split("@")[0];  // 押した人はログインから決める（自由入力の by は使わない）
  }
  const SLACK = Deno.env.get("SLACK_BOT_TOKEN") || "";
  const CH = Deno.env.get(CFG.slackChKey) || Deno.env.get("STAFF_DONE_CHANNEL") || "";

  // === 承認(approve): 依頼タスクを引き受け → assignee=自分 + requested_to クリア + Slack ===
  if (action === "approve") {
    const task_id = String(body.task_id || "").trim();
    if (!task_id) return json({ ok: false, error: "missing task_id" }, 400);
    const tk = await sbGet(`${CFG.tasksTbl}?_id=eq.${encodeURIComponent(task_id)}&select=${encodeURIComponent(CFG.selApprove)}&limit=1`);
    if (!tk[0]) return json({ ok: false, error: "task_not_found" }, 404);
    const T = tk[0];
    const reqTo: string[] = Array.isArray(T.requested_to) ? T.requested_to : [];
    const sur = staffName.split(" ")[0];
    const offered = reqTo.some((n: string) => n === staffName || n.replace(/\s/g, "") === staffName.replace(/\s/g, "") || n === sur);
    if (!offered) return json({ ok: false, error: "not_offered" }, 403);
    if (T.assignee && T.assignee.trim() && T.assignee.replace(/\s/g, "") !== staffName.replace(/\s/g, "") && T.assignee !== sur) {
      return json({ ok: false, error: "already_taken", taken_by: T.assignee });
    }
    const patch: Record<string, unknown> = { requested_to: null, approved_at: new Date().toISOString(), approved_by: staffName };
    patch[CFG.assigneeCol] = staffName;
    await sbPatch(`${CFG.tasksTbl}?_id=eq.${encodeURIComponent(task_id)}`, patch);
    const tlabel = TYPE[T.type] || T.type;
    const cust = T.name ? `${T.name}様` : "";
    const veh = T.assigned_vehicle ? `${T.assigned_vehicle}${T.plate_no ? " (" + T.plate_no + ")" : ""}` : "";
    const tmv = T.time || T.return_time || "";
    const md = (T.date || "").split("-"); const mdstr = md.length === 3 ? `${+md[1]}/${+md[2]}` : (T.date || "");
    let posted = false;
    if (SLACK && CH) {
      // ★2026-11-09 nosh「全ての通知に統一全店」：2行目＝予約ID｜🚗車両名 ナンバー｜👤予約者名 様。付いた時は内容の名前・車両(コード)欄を省く
      // ★2026-11-10 nosh「通知は全て内容統一して」：共通の型（予約に紐づかないタスクは内容欄に名前・車両を出す）
      const _rid = resvOfTask(T);
      const { text: sText, blocks } = await hdmMsg({ emoji: "🙋", store, title: `${staffName} が ${tlabel} を引き受けました`, rid: _rid, noLink: !_rid,
        body: [`🗓 ${mdstr}${tmv ? " " + tmv : ""}`, _rid ? "" : `${cust}${veh ? "　🚗 " + veh : ""}`] });
      try { const sr = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${SLACK}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: CH, text: sText, blocks }) }); const sj = await sr.json(); posted = !!sj.ok; } catch { /* noop */ }
    }
    return json({ ok: true, approved: true, posted, staff: staffName });
  }

  // === スキップ(skip): 依頼を辞退 → skipped_byに記録 + requested_toから自分を除外 + 残り0ならOP担当ブランク + Slack ===
  if (action === "skip") {
    const task_id = String(body.task_id || "").trim();
    if (!task_id) return json({ ok: false, error: "missing task_id" }, 400);
    const tk = await sbGet(`${CFG.tasksTbl}?_id=eq.${encodeURIComponent(task_id)}&select=${encodeURIComponent(CFG.selSkip)}&limit=1`);
    if (!tk[0]) return json({ ok: false, error: "task_not_found" }, 404);
    const T = tk[0];
    const sur = staffName.split(" ")[0];
    const reqTo: string[] = Array.isArray(T.requested_to) ? T.requested_to : [];
    const remain = reqTo.filter((n: string) => !(n === staffName || n.replace(/\s/g, "") === staffName.replace(/\s/g, "") || n === sur));
    const skp: string[] = Array.isArray(T.skipped_by) ? T.skipped_by.slice() : [];
    if (!skp.some((n: string) => n === staffName || n === sur)) skp.push(staffName);
    const patch: Record<string, unknown> = { skipped_by: skp };
    let blanked = false;
    if (remain.length > 0) {
      patch.requested_to = remain;
    } else {
      patch.requested_to = null;
      patch[CFG.assigneeCol] = "";
      patch.approved_at = null; patch.approved_by = null;
      blanked = true;
    }
    await sbPatch(`${CFG.tasksTbl}?_id=eq.${encodeURIComponent(task_id)}`, patch);
    const tlabel = TYPE[T.type] || T.type;
    const cust = T.name ? `${T.name}様` : "";
    const veh = T.assigned_vehicle ? `${T.assigned_vehicle}${T.plate_no ? " (" + T.plate_no + ")" : ""}` : "";
    const tmv = T.time || T.return_time || "";
    const md = (T.date || "").split("-"); const mdstr = md.length === 3 ? `${+md[1]}/${+md[2]}` : (T.date || "");
    let posted = false;
    if (SLACK && CH) {
      // ★2026-11-09 nosh「全ての通知に統一全店」：2行目＝予約ID｜🚗車両名 ナンバー｜👤予約者名 様。付いた時は内容の名前・車両(コード)欄を省く
      // ★2026-11-10 nosh「通知は全て内容統一して」：共通の型（予約に紐づかないタスクは内容欄に名前・車両を出す）
      const _rid = resvOfTask(T);
      const { text: sText, blocks } = await hdmMsg({ emoji: "⏭", store, title: `${staffName} が ${tlabel} をスキップしました${blanked ? "（OP担当ブランク）" : ""}`, rid: _rid, noLink: !_rid,
        body: [`🗓 ${mdstr}${tmv ? " " + tmv : ""}`, _rid ? "" : `${cust}${veh ? "　🚗 " + veh : ""}`, blanked ? "⚠️ 他に候補がいないため OPシートの担当はブランクに戻りました（要・再割当）" : `↩︎ 残りの候補（${remain.join("・")}）に依頼継続中`] });
      try { const sr = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${SLACK}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: CH, text: sText, blocks }) }); const sj = await sr.json(); posted = !!sj.ok; } catch { /* noop */ }
    }
    return json({ ok: true, skipped: true, blanked, posted, staff: staffName });
  }

  // === 完了(done): タスクをdone化 + Slack通知 ===
  if (action === "done") {
    const task_id = String(body.task_id || "").trim();
    if (!task_id) return json({ ok: false, error: "missing task_id" }, 400);
    const tk = await sbGet(`${CFG.tasksTbl}?_id=eq.${encodeURIComponent(task_id)}&select=${encodeURIComponent(CFG.selDone)}&limit=1`);
    if (!tk[0]) return json({ ok: false, error: "task_not_found" }, 404);
    const T = tk[0];
    await sbPatch(`${CFG.tasksTbl}?_id=eq.${encodeURIComponent(task_id)}`, CFG.donePatch);
    const tlabel = TYPE[T.type] || T.type;
    const cust = T.name ? `${T.name}様` : "";
    const veh = T.assigned_vehicle ? `${T.assigned_vehicle}${T.plate_no ? " (" + T.plate_no + ")" : ""}` : "未配車";
    // ★2026-11-14 那覇は「変更」（スタッフが変えた時刻）を先に見る（staff-task-check と同じ）。札幌の return_time は返却時刻なので今まで通り
    const tmv = (store === "nha" ? (T.return_time || T.time) : (T.time || T.return_time)) || "";
    const nowJ = new Date(Date.now() + 9 * 3600 * 1000);
    const hhmm = `${String(nowJ.getUTCHours()).padStart(2, "0")}:${String(nowJ.getUTCMinutes()).padStart(2, "0")}`;
    const md = (T.date || "").split("-"); const mdstr = md.length === 3 ? `${+md[1]}/${+md[2]}` : (T.date || "");
    let posted = false;
    // ★2026-11-14 nosh「タスク関連は未完了の時だけSlack」：予定どおり（予定＋20分以内）の完了は記録だけ。20分以上遅れた完了だけ出し、要点（何分遅れ・予定→完了）を先に
    const hm = String(tmv).match(/^(\d{1,2}):(\d{2})/);
    const plan = hm && /^\d{4}-\d{2}-\d{2}$/.test(String(T.date || "")) ? Date.parse(`${T.date}T${hm[1].padStart(2, "0")}:${hm[2]}:00+09:00`) : NaN;
    const lateMin = isNaN(plan) ? -1 : Math.floor((Date.now() - plan) / 60000);
    // ★2026-11-14 nosh 12:49「はい」「1」：「予定より◯分遅れて完了」は Slack に出さない（もう終わった件で誰も動けない）。
    //   改善の箱の「未処理事案」に押し忘れと同じ入れ方（staff_press_alerts・slot done:late・posted=false＝本人にも聞かない）で残す。
    //   戻し方：notify-unify-1114/backup_latedone/index.ts を deploy
    if (lateMin >= 20) {
      const _rid = resvOfTask(T) || task_id;
      const msg = `予定 ${+hm![1]}:${hm![2]} → 完了 ${+hhmm.slice(0, 2)}:${hhmm.slice(3)} ${tlabel}：完了の押し遅れ（${lateMin}分）\n👷 担当 ${staffName}`;
      try {
        await fetch(`${SB_URL}/rest/v1/staff_press_alerts`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ store, ref: `${_rid}|done:late`, kind: String(T.type || ""), slot: "done:late", message: msg, posted: false }) });
      } catch { /* noop */ }
    }
    return json({ ok: true, done: true, posted, staff: staffName });
  }

  // === 2026-11-08 送迎（PUB/BDB）ボタン：社内LINEの「PU出発／11-B到着／合流／BD」を置き換える（那覇のみ） ===
  //   押した記録を nha_tasks.sa_log に残す（全スタッフの画面・マイページに出る）。
  //   お客様へのLINEは「乗り場に着きました」(pu_at_stop) だけ。他は記録のみ。
  const SHUTTLE: Record<string, { types: string[]; push?: boolean }> = {
    pu_depart: { types: ["PUB", "PU"], push: true },
    pu_at_stop: { types: ["PUB", "PU"], push: true },
    pu_met: { types: ["PUB", "PU"] },
    bd_depart: { types: ["BDB", "BD"] },
    bd_at_airport: { types: ["BDB", "BD"], push: true },
    pu_jam: { types: ["PUB", "PU"], push: true },
    bd_jam: { types: ["BDB", "BD"] },
    sh_vehicle: { types: ["PUB", "PU", "BDB", "BD"] },
    sh_undo: { types: ["PUB", "PU", "BDB", "BD"] },  // ★2026-11-09 nosh「空港着おしたら戻らない」：押し間違いを取り消す（target の記録を消す）
    // ★2026-11-15 nosh「PUB→空港出発／BDB→ヤード出発」：合流できなかった・戻ってこなかったお客様へ「H:MM発のシャトルは定刻のため出発しました」（1組ずつ・時刻 body.time 必須）
    pu_left: { types: ["PUB", "PU"], push: true },
    bd_left: { types: ["BDB", "BD"], push: true },
  };
  if (SHUTTLE[action]) {
    if (store !== "nha") return json({ ok: false, error: "nha_only" }, 400);
    const task_id = String(body.task_id || "").trim();
    if (!task_id) return json({ ok: false, error: "missing task_id" }, 400);
    const sel = "_id,type:内容,name:予約者,resv:予約番号,sa_log,sh_vehicle,date";
    const tk = await sbGet(`nha_tasks?_id=eq.${encodeURIComponent(task_id)}&select=${encodeURIComponent(sel)}&limit=1`);
    if (!tk[0]) return json({ ok: false, error: "task_not_found" }, 404);
    const T = tk[0];
    if (!SHUTTLE[action].types.includes(String(T.type || ""))) return json({ ok: false, error: "wrong_type" }, 400);
    // ★2026-11-09 nosh「通知飛ぶだろこれ 間違ったらやばい」：未来の日のタスクは押せない（車の登録・取り消しは可）
    const todayJ = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    if (action !== "sh_vehicle" && action !== "sh_undo" && String(T.date || "").slice(0, 10) > todayJ) return json({ ok: false, error: "future_date" }, 400);
    if (action === "sh_undo") {
      const target = String(body.target || "").trim();
      if (!SHUTTLE[target] || target === "sh_vehicle" || target === "sh_undo" || !SHUTTLE[target].types.includes(String(T.type || ""))) return json({ ok: false, error: "bad_target" }, 400);
      const prev0: any[] = Array.isArray(T.sa_log) ? T.sa_log : [];
      if (!prev0.some((e: any) => e && e.a === target)) return json({ ok: true, shuttle: true, undone: false, staff: staffName });
      const okU = await sbPatch(`nha_tasks?_id=eq.${encodeURIComponent(task_id)}`, { sa_log: prev0.filter((e: any) => !(e && e.a === target)) });
      if (!okU) return json({ ok: false, error: "write_failed" }, 500);
      return json({ ok: true, shuttle: true, undone: true, target, staff: staffName });
    }
    // 送迎車（必須情報）：vehicle が来たら一覧にある車か確かめて登録。出発は車が決まっていないと記録しない
    const vreq = String(body.vehicle || "").trim();
    let veh = String(T.sh_vehicle || "");
    if (vreq) {
      const vv = await sbGet(`hdm_shuttle_vehicles?id=eq.${encodeURIComponent(vreq)}&store=eq.nha&active=eq.true&select=id&limit=1`);
      if (!vv[0]) return json({ ok: false, error: "bad_vehicle" }, 400);
      if (vreq !== veh) {
        const okV = await sbPatch(`nha_tasks?_id=eq.${encodeURIComponent(task_id)}`, { sh_vehicle: vreq });
        if (!okV) return json({ ok: false, error: "write_failed" }, 500);
      }
      veh = vreq;
    }
    if (action === "sh_vehicle") {
      if (!vreq) return json({ ok: false, error: "need_vehicle" }, 400);
      return json({ ok: true, shuttle: true, vehicle: veh, staff: staffName });
    }
    if ((action === "pu_depart" || action === "bd_depart") && !veh) return json({ ok: false, error: "need_vehicle" }, 400);
    const jamMin = Math.round(Number(body.min));
    if ((action === "pu_jam" || action === "bd_jam") && !(jamMin >= 5 && jamMin <= 60)) return json({ ok: false, error: "bad_min" }, 400);
    const leftM = String(body.time || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    const leftTm = leftM && +leftM[1] < 24 && +leftM[2] < 60 ? `${+leftM[1]}:${leftM[2]}` : "";
    if ((action === "pu_left" || action === "bd_left") && !leftTm) return json({ ok: false, error: "bad_time" }, 400);
    const la = Number(body.lat), ln = Number(body.lng);
    const pos = body.lat != null && body.lng != null && body.lat !== "" && body.lng !== "" && isFinite(la) && isFinite(ln) && !(la === 0 && ln === 0) ? { lat: la, lng: ln } : {};
    const ev = { a: action, at: new Date().toISOString(), by: staffName, ...pos, ...((action === "pu_jam" || action === "bd_jam") ? { min: jamMin } : {}), ...((action === "pu_left" || action === "bd_left") ? { tm: leftTm } : {}) };
    const prev: any[] = Array.isArray(T.sa_log) ? T.sa_log : [];
    const next = prev.filter((e: any) => e && e.a !== action).concat([ev]);  // 押し直しは最新時刻で上書き
    const okW = await sbPatch(`nha_tasks?_id=eq.${encodeURIComponent(task_id)}`, { sa_log: next });
    if (!okW) return json({ ok: false, error: "write_failed" }, 500);
    let sent = false, reason = "", msg = "";
    if (SHUTTLE[action].push && T.resv) {
      const rv = await sbGet(`nha_reservations?id=eq.${encodeURIComponent(T.resv)}&select=name,status,mypage_token`);
      const R = rv[0] || {};
      const st0 = String(R.status || "").toLowerCase();
      if (!(st0.includes("cancel") || st0.includes("キャンセル"))) {
        const url = R.mypage_token ? `${CFG.mypageBase}?t=${R.mypage_token}` : "";
        const cn2 = `${R.name || T.name || ""}様`;
        // 到着の目安：出発時刻＋決まった所要時間（nha_sh_eta_min）＋渋滞分。同じ便は全員同じ時刻
        const hm = (ms: number) => { const d = new Date(ms + 9 * 3600e3); return `${d.getUTCHours()}時${String(d.getUTCMinutes()).padStart(2, "0")}分`; };
        const dep = next.filter((e: any) => e && e.a === "pu_depart").pop();
        let etaTxt = "";
        if (dep && (action === "pu_depart" || action === "pu_jam")) {
          let base = 17;
          try { const er = await fetch(`${SB_URL}/rest/v1/rpc/nha_sh_eta_min`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_kind: "pu", p_dep: dep.at, p_lat: dep.lat ?? null, p_lng: dep.lng ?? null }) }); const ev2 = await er.json(); if (typeof ev2 === "number" && ev2 > 0) base = ev2; } catch { /* 17分のまま */ }
          etaTxt = hm(Date.parse(dep.at) + (base + (action === "pu_jam" ? jamMin : 0)) * 60e3);
        }
        const tail = url ? `\n\n乗り場の場所・送迎車の写真はマイページでご確認いただけます。\n${url}` : "";
        if (action === "pu_depart") msg = `【送迎のお知らせ】\n${cn2}\n\n送迎車が空港の乗り場へ出発しました。\n乗り場への到着は${etaTxt || "まもなく"}前後（目安）です。道路の状況で前後することがあります。` + tail;
        else if (action === "pu_jam") msg = `【送迎のお知らせ】\n${cn2}\n\n道路の混雑により、送迎車が約${jamMin}分遅れております。\n乗り場への到着は${etaTxt || "少し遅れて"}前後（目安）の見込みです。\nご迷惑をおかけし、誠に申し訳ございません。` + tail;
        else if (action === "pu_left" || action === "bd_left") msg = `【送迎のお知らせ】\n${cn2}\n\n${leftTm}発のシャトルは定刻のため出発しました。` + (url ? `\n\nマイページ\n${url}` : "");
        else if (action === "bd_at_airport") msg = `【HANDYMAN】\n${cn2}\n\n空港に到着いたしました。お忘れ物がないか、いま一度ご確認くださいませ。\nこの度はHANDYMANをご利用いただき、誠にありがとうございました。`;
        else msg = `【送迎のお知らせ】\n${R.name || T.name || ""}様\n\n送迎スタッフが乗り場に到着いたしました。\nお手荷物をお受け取りのうえ、乗り場までお越しくださいませ。\n乗り場の場所はマイページでご確認いただけます。` + (url ? `\n${url}` : "");
        try {
          const pr = await fetch(`${SB_URL}/functions/v1/line-push`, {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SB_KEY}` },
            body: JSON.stringify({ secret: FUNC_SECRET, store: "nha", resv_no: T.resv, action, message: msg }),
          });
          const pj = await pr.json().catch(() => ({}));
          sent = !!pj.ok; LAST_CH = String(pj.channel || (pj.ok ? "line" : "")); reason = pj.reason || "";
        } catch { reason = "send_error"; }
      }
    }
    let posted = false;
    const metDup = action === "pu_met" && prev.some((e: any) => e && e.a === "pu_met" && Date.now() - Date.parse(e.at) < 15 * 60e3);  // 15分以内の押し直しは流さない
    if (action === "pu_met" && SLACK && CH && !metDup) {
      const nowJ = new Date(Date.now() + 9 * 3600e3);
      const hhmm = `${String(nowJ.getUTCHours()).padStart(2, "0")}:${String(nowJ.getUTCMinutes()).padStart(2, "0")}`;
      const sText = (await hdmMsg({ emoji: "🤝", store: "nha", title: `${hhmm} お客様と合流しました（送迎：${staffName}）`, rid: String(T.resv || ""), noLink: !T.resv, side: "go", body: [T.resv ? "" : `${T.name || ""}様`] })).text; // ★2026-11-10 共通の型
      try { const sr = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${SLACK}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: CH, text: sText }) }); const sj = await sr.json(); posted = !!sj.ok; } catch { /* noop */ }
    }
    return json({ ok: true, shuttle: true, at: ev.at, sent, reason, channel: LAST_CH, message: msg, staff: staffName, vehicle: veh, posted });
  }

  // 2) 予約取得
  const resv = await sbGet(`${CFG.resvTbl}?id=eq.${encodeURIComponent(resv_no)}&select=*`);
  if (!resv[0]) return json({ ok: false, error: "reservation_not_found" }, 404);
  const r = resv[0];
  // ★2026-11-09 未来の日の予約には送らない（お届け系は貸出日、回収系は返却日が今日より先なら止める）
  {
    const todayJ = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const colAct = ["collect", "col_arrival", "delay_col", "dropoff"].includes(action);
    const ref = String((colAct ? (r.end_date || r.return_date) : (r.start_date || r.lend_date)) || "").slice(0, 10);
    if (ref && ref > todayJ) return json({ ok: false, error: "future_date" }, 400);
  }
  const st = String(r.status || "").toLowerCase();
  if (st.includes("cancel") || st.includes("キャンセル")) return json({ ok: false, error: "cancelled" });
  const cn = (r.name || "") + "様";
  // ★2026-11-09 nosh「自動送信メールの内容も問題ないか」：位置の表示はやめたので「スタッフの現在地」を消す・時刻は前後（目安）・乗り捨ての連絡はマイページへ（メールは返信できないため）
  const myUrl = r.mypage_token ? `${CFG.mypageBase}?t=${r.mypage_token}` : "";

  // プレート（到着メッセージ用）
  let plate = "";
  try {
    const pref = action === "arrival" ? "d-" : "c-";
    const tk = await sbGet(`${CFG.tasksTbl}?_id=eq.${encodeURIComponent(pref + resv_no)}&select=${encodeURIComponent(CFG.selPlate)}&limit=1`);
    plate = (tk[0] && (tk[0].plate_no || "")) || "";
  } catch { /* noop */ }

  // 2026-11-08 押した瞬間のスタッフ位置（staff.html が1回だけ送る）→ マイページの地図に出す。無ければ何もしない
  const _lat = Number(body.lat), _lng = Number(body.lng);
  const hasPos = body.lat != null && body.lng != null && body.lat !== "" && body.lng !== "" && isFinite(_lat) && isFinite(_lng) && Math.abs(_lat) <= 90 && Math.abs(_lng) <= 180 && !(_lat === 0 && _lng === 0);
  const posPatch: Record<string, unknown> = hasPos ? { kd_driver_lat: _lat, kd_driver_lng: _lng, kd_driver_at: new Date().toISOString() } : {};
  // 回収の手段（徒歩/車/公共交通）→ 到着見込みの計算用。お客様には出さない
  const _mode = String(body.mode || "").trim();
  const modeVal = ["walk", "car", "transit"].includes(_mode) ? _mode : null;

  // 3) アクション別: メッセージ + line-push action + 予約更新
  let msg = "", pushAction = "", driverUrl = "";
  if (action === "depart" || action === "collect") {
    const tkTrack = uuid(), tkDrv = uuid();
    await sbPatch(`${CFG.resvTbl}?id=eq.${encodeURIComponent(resv_no)}`, {
      kd_status: action === "depart" ? "delivering" : "collecting",
      kd_status_at: new Date().toISOString(),
      kd_track_token: tkTrack, kd_driver_token: tkDrv,
      kd_driver_mode: action === "depart" ? "car" : modeVal,
      // 前の区間の位置を残さない（位置が取れなかったときは空にする）
      ...(hasPos ? posPatch : { kd_driver_lat: null, kd_driver_lng: null, kd_driver_at: null }),
    });
    driverUrl = `https://keydrop.jp/handyman-driver.html?r=${encodeURIComponent(resv_no)}&d=${tkDrv}`;
    if (action === "depart") {
      pushAction = "depart_mypage";
      msg = `【HANDYMAN カーデリバリー】\n${cn}\nお届けに出発しました🚚\nご予約の時間前後（目安）にお伺いします。道路の状況で前後することがあります。\n受け取り場所・お車の情報はマイページでご確認いただけます（アプリ不要）。\n${myUrl}`;
    } else {
      pushAction = "collect_mypage";
      msg = `【HANDYMAN カーデリバリー】\n${cn}\nお車の回収に向かっています🧭\nご予約の時間前後（目安）にお伺いします。道路の状況で前後することがあります。\n待ち合わせ場所はマイページでご確認いただけます（アプリ不要）。\n${myUrl}`;
    }
  } else if (action === "arrival") {
    if (hasPos) await sbPatch(`${CFG.resvTbl}?id=eq.${encodeURIComponent(resv_no)}`, posPatch);
    pushAction = "arrival";
    msg = `【車両到着のお知らせ】\n${cn}\n\nお待たせいたしました。只今スタッフが到着いたしました。\nご準備整い次第、受け取り対応をお願いいたします。 引き続きどうぞ宜しくお願い申し上げます。` + (plate ? `\n\n対象車両のナンバーは ${plate} でございます。` : "");
  } else if (action === "col_arrival") {
    if (hasPos) await sbPatch(`${CFG.resvTbl}?id=eq.${encodeURIComponent(resv_no)}`, posPatch);
    pushAction = "col_arrival";
    msg = `【ご返却場所到着のお知らせ】\n${cn}\n\n回収スタッフがご返却場所に到着致しました。\nご準備できましたら対応のほどお願い申しあげます。\n何卒よろしくお願いいたします。`;
  } else if (action === "delay_del" || action === "delay_col") {
    if (hasPos) await sbPatch(`${CFG.resvTbl}?id=eq.${encodeURIComponent(resv_no)}`, posPatch);
    const t = String(body.time || "").trim() || "（　）";
    const isCol = action === "delay_col";
    pushAction = isCol ? "col_delay" : "del_delay";
    const midMsg = isCol ? "お車の回収に向かうスタッフの到着が予定より遅れております" : "お車のお届けに向かうスタッフの到着が予定より遅れております";
    const head = isCol ? "【回収時間について】" : "【お届け時間について】";
    msg = `${head}\n${cn}\n\nこの度はHANDYMANをご利用いただき、誠にありがとうございます。\nただいま道路状況・混雑状況により、${midMsg}。\nご迷惑をおかけし誠に申し訳ございません。\n到着は「${t}」前後（目安）を見込んでおります。\nお手数をおかけいたしますが、もう暫しお待ちくださいませ。`;
  } else if (action === "dropoff") {
    pushAction = "dropoff";
    // ★2026-11-09 nosh「乗り捨てボタン発動から何が送信されどうなるのか 画面も」：マイページを「乗り捨てでのご返却」に切り替える目印
    await sbPatch(`${CFG.resvTbl}?id=eq.${encodeURIComponent(resv_no)}`, { kd_status: "dropoff", kd_status_at: new Date().toISOString() });
    msg = `【乗り捨て対応のお願い】\n${cn}\n\nご返却時刻の混雑により、大変お手数ではございますが返却予定場所近隣駐車場に乗り捨て駐車いただきたく、ご連絡させていただきました。\nお待たせする時間回避の目的のためご協力の程何卒よろしくお願いいたします。\n\n✅駐車完了しましたら"鍵と駐車券"をダッシュボード内に格納し、鍵を開けた状態でそのままお降りくださいませ。\n✅燃料の給油とお忘れ物（ETCカード等）のないようご注意ください。\n✅停めたら、マイページの「車を停めました」から駐車場の名前か写真をお送りください。\n例：駐車場の看板の写真／駐車場名／●階など\n\n駐車後の車両トラブルに関しては一切の責任は問いませんのでご安心くださいませ。\n万一の盗難等の際にも弊社セキュリティにて追跡可能となっております。`;
  } else {
    return json({ ok: false, error: "unknown_action" }, 400);
  }

  // 4) line-push で自動送信（秘密はサーバ側）
  let sent = false, reason = "";
  try {
    const pr = await fetch(`${SB_URL}/functions/v1/line-push`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify({ secret: FUNC_SECRET, store: CFG.pushStore, resv_no, action: pushAction, message: msg }),
    });
    const pj = await pr.json().catch(() => ({}));
    sent = !!pj.ok; LAST_CH = String(pj.channel || (pj.ok ? "line" : "")); reason = pj.reason || "";
  } catch (e) { reason = "send_error"; }

  return json({ ok: true, sent, reason, channel: LAST_CH, message: msg, driver_url: "", staff: staffName });  // ★2026-11-09 位置情報は使わない（決定C）→位置送信ページへ飛ばさない
});
