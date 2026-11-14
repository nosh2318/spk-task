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
// staff-decide（2026-11-10 nosh「自分の担当ユーザーからのリクエストを受けて回答するのが目的（場所や時間）」）
// 個別URL（staff.html?t=）から、自分が担当のタスクに来たお客様の「時間・場所の変更依頼」を見て、
//   承認＝アクションタブと同じ handyman-mypage(-nha) の decide を呼ぶ（反映・お客様通知・OPシートまで同じ処理）
//   難しい＝Slack（店のマイページ依頼チャンネル）に相談を出す。依頼はそのまま残り、社員がアクションタブで返す。
// 担当が決まっていない依頼は、だれでも対応できる。
// 2026-11-11 nosh「那覇にも同じ仕組みを」→ store（spk=札幌・既定／nha=那覇）で名簿・タスク・予約・承認先・Slackを切り替える（v6）。
// 2026-11-11 nosh「まず全店個別URLを登録すれば通知が届くように」→ 高松（tkm）も「未確認のお知らせ」だけ同じにした（v8）。名簿は BT の bt_staff。
//   高松の変更依頼（送迎・来店の受け取り方だけ・BT の bt_reservation_changes）は那覇の送迎・来店と同じく本部だけで返す（個別URLに出さない・decide は受けない）。
// 2026-11-11 「確認しました」を押したお知らせがお客様の「スタッフに知らせる」なら、お客様のマイページにも「スタッフが確認しました」を出す（mypage_nudges.acked_at）。
// 2026-11-11 v7：変更の依頼は赤い枠の「確認しました」をやめ、黄色いカードの返事（承認・代わりの案・社員に相談）で全員分のお知らせを閉じる。
// 2026-11-11 v9 nosh「時間を早められる場合のアクションも」「おくれます や他のパターンも」：お客様の「スタッフに知らせる」（ref nud:<id>）に、担当が返事を選べる（list の inbox に nud.options、action reply）。
//   返事は mypage_nudges の reply / reply_time / reply_at / reply_by に記録するだけ（ご予約の時刻は書き換えない）。押すと確認済み（acked_at）・同じお知らせは全員分閉じる。
// action: list {token, store?} / seen {token, store?, id|ids} / reply {token, store?, id, reply, time} / decide {token, store?, change_id, decision: "approved"|"consult"|"proposed"|"rejected", note?, reject_reason?, proposal_text?, proposal_value?, message_text?, expires_at?}
const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const FIELDS = ["lend_time", "del_place", "return_time", "col_place"];
const LABEL: Record<string, string> = { lend_time: "お届けの時間", del_place: "お届けの場所", return_time: "回収の時間", col_place: "回収の場所" };
const TT = (f: string) => (f === "lend_time" || f === "del_place") ? "DEL" : "COL";
// 店ごとの違い
const SD: Record<string, { roster: string; ef: string; ch: string }> = {
  spk: { roster: "staff", ef: "handyman-mypage", ch: Deno.env.get("SLACK_MYPAGE_CHANNEL") || "C0BER0YC6AK" },
  nha: { roster: "nha_staff", ef: "handyman-mypage-nha", ch: Deno.env.get("SLACK_NHA_USER_CHANNEL") || "C06L91W6T08" },
  tkm: { roster: "bt_staff", ef: "", ch: "C0BFMBLEJGZ" },
};
async function getB(path: string) {
  const u = Deno.env.get("BT_URL"), k = Deno.env.get("BT_SERVICE_KEY"); if (!u || !k) return [];
  const hd: Record<string, string> = { apikey: k }; if (k.startsWith("eyJ")) hd.Authorization = `Bearer ${k}`;
  const r = await fetch(`${u}/rest/v1/${path}`, { headers: hd }); return r.ok ? await r.json() : [];
}
// 変更の依頼のお知らせを確認済みにする（ids 指定 or 依頼ID で全員分）。返事が済んだら赤い枠・追いかけから消す
async function closeInbox(store: string, o: { ids?: number[]; chg?: number }) {
  const q = o.ids?.length ? `id=in.(${o.ids.join(",")})` : o.chg ? `ref=eq.chg:${o.chg}` : ""; if (!q) return;
  await fetch(`${SB}/rest/v1/staff_inbox?${q}&store=eq.${store}&kind=eq.change&title=like.*${encodeURIComponent("変更の依頼")}*&seen_at=is.null`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ seen_at: new Date().toISOString() }) }).catch(() => {});
}
// ===== 2026-11-11 v9 お客様の「スタッフに知らせる」への返事（表：着きました・見つからない・遅れます × 送迎・お届け・回収・来店 × 前/ちょうど/後） =====
const NBUS = { go: { m: 0, first: 9, last: 19 }, back: { m: 30, first: 9, last: 18 } }; // 那覇の送迎バス（行き＝空港 11-B 発 毎時00分／帰り＝店発 毎時30分）
const hhmm = (s: unknown) => { const m = String(s || "").match(/(\d{1,2}):(\d{2})/); return m ? String(+m[1]).padStart(2, "0") + ":" + m[2] : ""; };
const jday = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const jhm = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(11, 16);
const atJ = (d: string, t: string) => Date.parse(`${d}T${t}:00+09:00`);
const up5 = (ms: number) => Math.ceil(ms / 300e3) * 300e3, up15 = (ms: number) => Math.ceil(ms / 900e3) * 900e3;
async function nudPlan(store: string, nid: number): Promise<any> {
  const n = (await get(`mypage_nudges?id=eq.${nid}&store=eq.${store}&select=id,kind,leg,reservation_id`))[0]; if (!n) return null;
  const back = n.leg === "back", rid = encodeURIComponent(String(n.reservation_id));
  let d = "", t = "", vt = "", rt = "", shuttle = false;
  if (store === "tkm") {
    const r = (await getB(`bt_reservations?id=eq.${rid}&select=start_date,start_time,pickup_time,end_date,end_time,dropoff_time,visit_type,return_type`))[0]; if (!r) return null;
    d = String((back ? r.end_date : r.start_date) || ""); t = hhmm(back ? r.end_time : (r.pickup_time || r.start_time)); vt = r.visit_type || ""; rt = r.return_type || ""; // 帰りはご返却の時刻（空港へお送りする時刻ではない）
    shuttle = back ? (!!hhmm(r.dropoff_time) || /BD/i.test(rt)) : !!hhmm(r.pickup_time);
  } else if (store === "nha") {
    const r = (await get(`nha_reservations?id=eq.${rid}&select=start_date,start_time,end_date,end_time,visit_type,return_type`))[0]; if (!r) return null;
    d = String((back ? r.end_date : r.start_date) || ""); t = hhmm(back ? r.end_time : r.start_time); vt = r.visit_type || ""; rt = r.return_type || "";
  } else {
    const r = (await get(`reservations?id=eq.${rid}&select=lend_date,lend_time,return_date,return_time,visit_type,return_type`))[0]; if (!r) return null;
    d = String((back ? r.return_date : r.lend_date) || ""); t = hhmm(back ? r.return_time : r.lend_time); vt = r.visit_type || ""; rt = r.return_type || "";
  }
  d = d.slice(0, 10);
  const bus = store === "nha" && (back ? /BDB/i.test(rt) : /PUB/i.test(vt));
  const means = bus ? "bus" : shuttle ? "shuttle" : (back ? /COL/i.test(rt) : /DEL/i.test(vt)) ? (back ? "col" : "del") : "visit";
  const out = { id: nid, kind: n.kind, leg: n.leg, means, due: t, options: [] as any[] };
  const now = Date.now(), due = t && d ? atJ(d, t) : NaN; if (isNaN(due) || d !== jday(now)) return out;
  const B = NBUS[back ? "back" : "go"], my = bus ? Math.min(B.last, Math.max(B.first, +t.split(":")[0])) : -1;
  const busAt = (h: number) => atJ(d, String(h).padStart(2, "0") + ":" + String(B.m).padStart(2, "0"));
  const add = (reply: string, ms: number, label: string) => { const tm = jhm(ms); if (!out.options.some((o) => o.reply === reply && o.time === tm)) out.options.push({ reply, time: tm, label: label.replace("{t}", tm) }); };
  if (n.kind === "arrived" && now < due - 15 * 60e3) {
    if (bus) { for (let h = B.first; h < my && out.options.length < 2; h++) if (busAt(h) >= now + 10 * 60e3) add("early_bus", busAt(h), "前の便でお送りします（{t}発）"); }
    else if (means !== "visit") {
      const snd = back && means === "shuttle"; // 高松の返却＝店に戻った方を空港へお送りする
      add("early_go", up5(now + 15 * 60e3), snd ? "今からお送りできます（{t}前後）" : "今から向かいます（{t}前後）"); add("early_go", up5(now + 30 * 60e3), snd ? "今からお送りできます（{t}前後）" : "今から向かいます（{t}前後）");
      for (let s = up15(now + 45 * 60e3), k = 0; s <= due - 15 * 60e3 && k < 3; s += 15 * 60e3, k++) add("early_go", s, snd ? "{t}にお送りできます" : "{t}に伺えます");
    }
  } else if (n.kind === "lost") add("lost_go", now, "今から声をかけます");
  else if (n.kind === "late") {
    if (bus) { for (let h = Math.max(my + 1, B.first); h <= B.last && out.options.length < 2; h++) if (busAt(h) >= now) add("late_bus", busAt(h), "次の便でご案内します（{t}発）"); }
    else for (let k = 1; k <= 3; k++) add("late_wait", Math.max(due, up15(now)) + k * 15 * 60e3, "{t}までお待ちします");
  }
  return out;
}
async function withNud(store: string, inbox: any[]) {
  for (const x of inbox) { const m = String(x.ref || "").match(/^nud:(\d+)$/); if (m) x.nud = await nudPlan(store, Number(m[1])).catch(() => null); }
  return inbox;
}
async function get(path: string) { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json() : []; }
// ★2026-11-13 v10 nosh「意味のない履歴情報。必要なのはDBだけ」：タスクの付いた・変わった・外れたは赤い枠に出さない（カードがいつも最新・履歴は audit_log）。
//   前から残っていた分はここで確認済みにして消す
//   11/13 nosh「関連通知だけ残す あとは邪魔」：赤い枠に残すのは、担当が返事・行動するお客様の知らせ（着きました・遅れます等）と変更の依頼だけ。
//   チャットは下の「担当のお客様のチャット」、お客様が変更しました（反映済み）はカードが最新なので、どちらも枠に出さない
const NOTASK = "&kind=not.in.(task,task_today,chat)&title=not.like.*" + encodeURIComponent("反映済み") + "*";
async function dropTaskNotes(store: string, name: string) {
  const base = `${SB}/rest/v1/staff_inbox?store=eq.${store}&staff_name=eq.${encodeURIComponent(name)}&seen_at=is.null`;
  const o = { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ seen_at: new Date().toISOString() }) };
  await fetch(`${base}&kind=in.(task,task_today,chat)`, o).catch(() => {});
  await fetch(`${base}&kind=eq.change&title=like.*${encodeURIComponent("反映済み")}*`, o).catch(() => {});
}
// ★v11 nosh「なぜ過去分必要なのか」：前の日（JST）の知らせと、だれかがもう確認・返事した知らせ（mypage_nudges.acked_at）は自動で確認済みにして出さない
async function dropStale(store: string, inbox: any[]) {
  const day0 = Date.parse(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) + "T00:00:00+09:00");
  const nid = inbox.map((n: any) => String(n.ref || "").match(/^nud:(\d+)$/)?.[1]).filter(Boolean);
  const acked = new Set(nid.length ? (await get(`mypage_nudges?id=in.(${nid.join(",")})&acked_at=not.is.null&select=id`)).map((x: any) => `nud:${x.id}`) : []);
  const old = inbox.filter((n: any) => n.kind !== "change" && (Date.parse(n.created_at) < day0 || acked.has(n.ref)));
  if (old.length) await fetch(`${SB}/rest/v1/staff_inbox?id=in.(${old.map((n: any) => n.id).join(",")})&store=eq.${store}&seen_at=is.null`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ seen_at: new Date().toISOString() }) }).catch(() => {});
  const gone = new Set(old.map((n: any) => n.id));
  return inbox.filter((n: any) => !gone.has(n.id));
}
async function me(store: string, token: string) {
  if (!/^[0-9a-f-]{20,}$/i.test(token)) return null;
  const s = (await (store === "tkm" ? getB : get)(`${SD[store].roster}?share_token=eq.${token}&select=name,active`))[0];
  return s && s.active !== false ? String(s.name) : null;
}
async function slack(store: string, text: string, blocks?: unknown[]) {
  const tk = Deno.env.get("SLACK_BOT_TOKEN"); const ch = SD[store].ch;
  if (!tk) return false;
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: ch, text, ...(blocks ? { blocks } : {}) }) }); return (await r.json()).ok === true; } catch { return false; }
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

// 「無人」「乗り捨て」など人でない担当は担当なし扱い
async function realStaff(store: string, a: string) { if (!a) return ""; const n = await get(`${SD[store].roster}?name=eq.${encodeURIComponent(a)}&select=name`); return n.length ? a : ""; }
// 依頼1件に、担当（DEL/COLタスクの担当者）と予約の情報を付ける
async function enrich(store: string, c: any) {
  const tt = TT(c.field);
  let t: any = null, r: any = {};
  if (store === "nha") {
    const tasks = await get(`nha_tasks?予約番号=eq.${encodeURIComponent(c.reservation_id)}&deleted=not.is.true&select=_id,内容,date,時間,担当&order=date.desc`);
    const x = tasks.find((y: any) => String(y["内容"] || "").toUpperCase().startsWith(tt)) || null;
    t = x ? { date: x.date, assignee: x["担当"] } : null;
    const v = (await get(`nha_reservations?id=eq.${encodeURIComponent(c.reservation_id)}&select=name,start_date,start_time,end_date,end_time,del_place,col_place`))[0] || {};
    r = { name: v.name, lend_date: v.start_date, lend_time: v.start_time, return_date: v.end_date, return_time: v.end_time, del_place: v.del_place, col_place: v.col_place };
  } else {
    const tasks = await get(`tasks?reservation_id=eq.${encodeURIComponent(c.reservation_id)}&select=id,type,date,time,assignee&order=date.desc`);
    t = tasks.find((x: any) => String(x.type || "").toUpperCase().startsWith(tt)) || null;
    r = (await get(`reservations?id=eq.${encodeURIComponent(c.reservation_id)}&select=name,lend_date,lend_time,return_date,return_time,del_place,col_place`))[0] || {};
  }
  return { id: c.id, field: c.field, label: LABEL[c.field] || c.field, old: c.old_value || "", new: c.new_value || "", at: c.created_at, resv: c.reservation_id,
    cust: r.name || "", date: tt === "DEL" ? (r.lend_date || t?.date || "") : (r.return_date || t?.date || ""), kind: tt === "DEL" ? "お届け" : "回収",
    assignee: await realStaff(store, String(t?.assignee || "").trim()),
    hasTask: !!t,
    sd: r.lend_date || "", st: r.lend_time || "", ed: r.return_date || "", et: r.return_time || "", delp: r.del_place || "" };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let b: any; try { b = await req.json(); } catch { return j({ ok: false, error: "bad json" }, 400); }
  const store = b.store === "nha" || b.store === "tkm" ? b.store : "spk";
  const name = await me(store, String(b.token || ""));
  if (!name) return j({ ok: false, error: "invalid token" }, 403);
  // ★2026-11-13 nosh「担当タスクに関しての変更履歴だけでいい」「最新の情報だけ」：自分の担当タスク（今日以降）の、直近24時間の変更を1行で（カードに小さく出す）。
  //   同じ項目の付け替えは「最初→最後」にまとめ、元に戻ったものは出さない。車はコードを出さず「車」とだけ（カードに今の車が出ている）
  if (b.action === "chg") {
    const T = store === "spk" ? { tbl: "tasks", asg: "assignee", f: { date: "日付", time: "時間", place: "場所", col_place: "場所", return_time: "返却", assigned_vehicle: "車" } as Record<string, string> }
      : { tbl: store === "tkm" ? "bt_tasks" : "nha_tasks", asg: "担当", f: { date: "日付", "時間": "時間", "変更": "時間", "送迎場所": "場所", "返却日": "返却日", "返却": "返却", assigned_vehicle: "車" } as Record<string, string> };
    const g = store === "tkm" ? getB : get;
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const mine = (await g(`${T.tbl}?${encodeURIComponent(T.asg)}=eq.${encodeURIComponent(name)}&date=gte.${today}&deleted=not.is.true&select=_id&limit=200`)).map((x: any) => String(x._id));
    if (!mine.length) return j({ ok: true, chg: {} });
    const since = new Date(Date.now() - 24 * 3600e3).toISOString();
    const out: Record<string, { at: string; text: string; kind?: string }> = {};
    for (let i = 0; i < mine.length; i += 60) {
      const ids = mine.slice(i, i + 60).map((x: string) => `"${x.replace(/"/g, "")}"`).join(",");
      const rows = await g(`audit_log?tbl=eq.${T.tbl}&op=in.(UPDATE,INSERT)&row_id=in.(${ids})&changed_at=gt.${since}&select=row_id,op,diff,changed_at,actor&order=id.asc&limit=1000`);
      const by = new Map<string, { at: string; ch: Record<string, { o: string; n: string }> }>();
      for (const r of rows) {
        if (!(r.actor === "staff" || String(r.actor || "").startsWith("staff:"))) continue;
        const d = r.diff || {}; const x: any = by.get(r.row_id) || { at: "", ch: {} };
        // ★v11 新規＝この24時間に自分の担当になった（新しいタスク・ほかの人からの付け替え）
        { const an = (v: unknown) => String(v ?? "").trim(); const a = d[T.asg];
          if ((r.op === "INSERT" && an(a) === name) || (a && typeof a === "object" && an(a.new) === name && an(a.old) !== name)) { x.nw = true; x.at = r.changed_at; } }
        if (r.op === "INSERT") { by.set(r.row_id, x); continue; }
        for (const k of Object.keys(T.f)) if (d[k] && typeof d[k] === "object" && "new" in d[k]) { const lb = T.f[k]; if (x.ch[lb]) x.ch[lb].n = String(d[k].new ?? ""); else x.ch[lb] = { o: String(d[k].old ?? ""), n: String(d[k].new ?? "") }; x.at = r.changed_at; }
        by.set(r.row_id, x);
      }
      const md = (v: string) => { const m = v.match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${+m[1]}/${+m[2]}` : v; };
      const ct = (v: string) => { const s = md(v.trim()); return s.length > 14 ? s.slice(0, 14) + "…" : s || "なし"; };
      for (const [id, x] of by) {
        const parts = Object.entries(x.ch).filter(([, v]) => v.o.trim() !== v.n.trim()).map(([k, v]) => k === "車" ? "車" : `${k} ${ct(v.o)}→${ct(v.n)}`);
        const nw = !!(x as any).nw; if (!parts.length && !nw) continue;
        const t = new Date(Date.parse(x.at) + 9 * 3600e3).toISOString();
        // ★v11 札：🆕新規（自分の担当になった）／🔁入替（車が替わった）／✏️変更（日付・時間・場所・返却）。新規の時は前の変更は出さない
        const car = parts.includes("車"), other = [...new Set(parts.filter((q) => q !== "車"))];
        const tag = nw ? "🆕 新規" : [car ? "🔁 入替（車）" : "", other.length ? "✏️ 変更 " + other.join("・") : ""].filter(Boolean).join("　");
        out[id] = { at: x.at, kind: nw ? "new" : car && !other.length ? "swap" : "chg", text: `${tag}　${+t.slice(5, 7)}/${+t.slice(8, 10)} ${t.slice(11, 16)}` };
      }
    }
    return j({ ok: true, chg: out });
  }
  if (b.action === "list" && store === "tkm") {
    await dropTaskNotes(store, name);
    let inbox = await get(`staff_inbox?store=eq.tkm&staff_name=eq.${encodeURIComponent(name)}&seen_at=is.null${NOTASK}&select=id,kind,ref,title,body,reservation_id,created_at&order=id.asc&limit=100`);
    inbox = await dropStale(store, inbox);
    return j({ ok: true, me: name, store, items: [], inbox: (await withNud(store, inbox)).map(({ ref, ...n }: any) => n) });
  }
  if (b.action === "list") {
    const rows = await get(`mypage_changes?store=eq.${store}&status=eq.requested&field=in.(${FIELDS.join(",")})&select=id,reservation_id,field,old_value,new_value,created_at&order=id.asc&limit=40`);
    const out = [];
    // 那覇は送迎・来店の予約にも「受け取りの時間」の依頼が来る。個別URLで返すのはお届け・回収（DEL/COLタスクがある予約）だけ。ほかは今までどおり本部
    for (const c of rows) { const e = await enrich(store, c); if (store === "nha" && !e.hasTask) continue; if (!e.assignee || e.assignee === name) out.push({ ...e, mine: e.assignee === name }); }
    await dropTaskNotes(store, name);
    let inbox = await get(`staff_inbox?store=eq.${store}&staff_name=eq.${encodeURIComponent(name)}&seen_at=is.null${NOTASK}&select=id,kind,ref,title,body,reservation_id,created_at&order=id.asc&limit=100`);
    inbox = await dropStale(store, inbox);
    // ★2026-11-11 nosh「確認しました は不要。承認しに行くのが連携のあるべき形」：変更の依頼は赤い枠に出さず、黄色いカード（承認・代わりの案）だけで返す。
    //   黄色いカードに出ない依頼（返事済み・那覇の送迎/来店＝本部だけ）は、ここで確認済みにして消す
    const shown = new Set(out.map((x: any) => `chg:${x.id}`)), pend = new Set(rows.map((c: any) => `chg:${c.id}`));
    const isReq = (n: any) => n.kind === "change" && /変更の依頼/.test(n.title || ""); // 「お客様が変更しました（反映済み）」はただのお知らせ＝今までどおり確認しました
    const drop = inbox.filter((n: any) => isReq(n) && !(shown.has(n.ref) || (pend.has(n.ref) && store !== "nha")));
    if (drop.length) await closeInbox(store, { ids: drop.map((n: any) => n.id) });
    inbox = (await withNud(store, inbox.filter((n: any) => !isReq(n)))).map(({ ref, ...n }: any) => n);
    return j({ ok: true, me: name, store, items: out, inbox });
  }
  // 未確認のお知らせを「確認しました」にする（本人の分だけ）
  if (b.action === "seen") {
    const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).map((x: any) => Number(x)).filter((x: number) => x > 0).slice(0, 100);
    if (!ids.length) return j({ ok: false }, 400);
    const now = new Date().toISOString();
    const r = await fetch(`${SB}/rest/v1/staff_inbox?id=in.(${ids.join(",")})&store=eq.${store}&staff_name=eq.${encodeURIComponent(name)}&seen_at=is.null`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify({ seen_at: now }) });
    const done = r.ok ? await r.json().catch(() => []) : [];
    // お客様の「スタッフに知らせる」（ref nud:<id>）なら、マイページに「スタッフが確認しました」を出す（まだ確認されていない時だけ）
    const nud = done.map((x: any) => String(x.ref || "").match(/^nud:(\d+)$/)?.[1]).filter(Boolean);
    if (nud.length) await fetch(`${SB}/rest/v1/mypage_nudges?id=in.(${nud.join(",")})&store=eq.${store}&acked_at=is.null`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ acked_at: now }) });
    return j({ ok: r.ok });
  }
  // ★v9 お客様の「スタッフに知らせる」に返事（表のとおり・選べるものは nudPlan が出したものだけ）
  if (b.action === "reply") {
    const row = (await get(`staff_inbox?id=eq.${Number(b.id) || 0}&store=eq.${store}&staff_name=eq.${encodeURIComponent(name)}&select=id,ref`))[0];
    const nid = Number(String(row?.ref || "").match(/^nud:(\d+)$/)?.[1] || 0); if (!nid) return j({ ok: false, error: "お知らせが見つかりません" }, 404);
    const p = await nudPlan(store, nid), o = p && p.options.find((x: any) => x.reply === b.reply && x.time === b.time);
    if (!o) return j({ ok: false, error: "この返事は今は選べません。画面を読み直してください" }, 409);
    const now = new Date().toISOString();
    // 返事は1回だけ（先に返した人の返事を上書きしない）
    const r = await fetch(`${SB}/rest/v1/mypage_nudges?id=eq.${nid}&store=eq.${store}&reply=is.null`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify({ reply: o.reply, reply_time: o.time, reply_at: now, reply_by: name }) });
    if (!r.ok) return j({ ok: false, error: "記録できませんでした" }, 500);
    const w = await r.json().catch(() => []); if (!w.length) return j({ ok: false, error: "ほかの担当がもう返事をしました。画面を読み直してください" }, 409);
    await fetch(`${SB}/rest/v1/mypage_nudges?id=eq.${nid}&store=eq.${store}&acked_at=is.null`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ acked_at: now }) });
    await fetch(`${SB}/rest/v1/staff_inbox?ref=eq.nud:${nid}&store=eq.${store}&seen_at=is.null`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ seen_at: now }) });
    return j({ ok: true, reply: o });
  }
  if (b.action === "decide" && store === "tkm") return j({ ok: false, error: "高松の変更依頼は本部が返します" }, 403);
  if (b.action === "decide") {
    const cid = Number(b.change_id);
    const c = (await get(`mypage_changes?id=eq.${cid}&store=eq.${store}&select=id,reservation_id,field,old_value,new_value,status,created_at`))[0];
    if (!c || !FIELDS.includes(c.field)) return j({ ok: false, error: "依頼が見つかりません" }, 404);
    if (c.status !== "requested") return j({ ok: false, error: "この依頼はもう処理されています" }, 409);
    const e = await enrich(store, c);
    if (e.assignee && e.assignee !== name) return j({ ok: false, error: `この依頼は${e.assignee}さんの担当です` }, 403);
    if (store === "nha" && !e.hasTask) return j({ ok: false, error: "お届け・回収ではない依頼です。本部がアクションタブで返します" }, 403);
    const sd = TT(c.field) === "DEL" ? "go" : "back", rid0 = String(c.reservation_id), ACT = hdmUrl(store, rid0).replace("tab=list", "tab=action"); // ★2026-11-10 共通の型
    const chg = `${e.label}：${e.old || "（なし）"} → ${e.new}`;
    const EF = `${SB}/functions/v1/${SD[store].ef}`;
    // ★2026-11-14 nosh「一次判断をOMNI→共有①社員＝Slack 共有②担当者＝個別URL→社員承認→全体反映＝通知」：
    //   いまは社員だけが承認・代わりの案・お断りを決める。担当の個別URLは見るだけ（オムニの案を「社員の承認待ち」で出す）。相談は今までどおり
    if (b.decision === "approved" || b.decision === "proposed" || b.decision === "rejected") return j({ ok: false, error: "いまは社員が承認します。この画面では見るだけです（迷う時は「社員に相談」）" }, 403);
    if (b.decision === "approved") {
      const r = await fetch(EF, { method: "POST", headers: H, body: JSON.stringify({ action: "decide", admin_pin: Deno.env.get("ADMIN_PIN") || "", actor_name: name, change_id: cid, decision: "approved" }) });
      const jr = await r.json().catch(() => ({}));
      if (!r.ok || !jr.ok) return j({ ok: false, error: jr.error || `承認できませんでした（${r.status}）` }, 500);
      { const m = await hdmMsg({ emoji: "✅", store, title: `${e.kind}の変更を承認しました（個別URL）`, rid: rid0, side: sd, body: [chg, `👤 対応 ${name}`] }); await slack(store, m.text, m.blocks); }
      await closeInbox(store, { chg: cid });
      return j({ ok: true, decision: "approved" });
    }
    if (b.decision === "consult") {
      const note = String(b.note || "").trim().slice(0, 200);
      const m = await hdmMsg({ emoji: "🆘", store, title: "担当から相談：この変更は難しい", rid: rid0, side: sd, url: ACT, body: [chg, note ? `💬「${note}」` : "", `👤 ${name}`, "⚠️ 要対応：社員がアクションタブで返事"] }); const ok = await slack(store, m.text, m.blocks);
      await closeInbox(store, { chg: cid });
      return j({ ok, decision: "consult" });
    }
    // 2026-11-10 nosh「代わりの案も個別URLに」：アクションタブと同じ「代わりの案」（proposed）／「今のご予約のまま」（rejected＋keep）
    if (b.decision === "proposed" || b.decision === "rejected") {
      const RS = ["no_vehicle", "full_slot", "out_of_area", "past_deadline"];
      const reason = String(b.reject_reason || ""); if (!RS.includes(reason)) return j({ ok: false, error: "できない理由を選んでください" }, 400);
      const msg = String(b.message_text || "").trim().slice(0, 2000); if (!msg) return j({ ok: false, error: "お客様に届く文が空です" }, 400);
      const prop = b.decision === "proposed";
      const ptext = String(b.proposal_text || "").trim().slice(0, 200); if (prop && !ptext) return j({ ok: false, error: "代わりの案を選んでください" }, 400);
      const body: any = { action: "decide", admin_pin: Deno.env.get("ADMIN_PIN") || "", actor_name: name, change_id: cid, decision: b.decision, reject_reason: reason, reject_text: "", message_text: msg };
      if (prop) Object.assign(body, { proposal_text: ptext, proposal_value: String(b.proposal_value || "").slice(0, 200), expires_at: String(b.expires_at || "") });
      else Object.assign(body, { alt_text: "", keep_as_is: true, expires_at: "" });
      const r = await fetch(EF, { method: "POST", headers: H, body: JSON.stringify(body) });
      const jr = await r.json().catch(() => ({}));
      if (!r.ok || !jr.ok) return j({ ok: false, error: jr.error || `送れませんでした（${r.status}）` }, 500);
      { const m = await hdmMsg({ emoji: "💬", store, title: prop ? `${e.kind}の変更に代わりの案を送りました（個別URL）` : `${e.kind}の変更に「今のご予約のまま」と返事しました（個別URL）`, rid: rid0, side: sd, body: [chg, prop ? `🔁 ${ptext}（お客様の返事待ち）` : "", `👤 対応 ${name}`] }); await slack(store, m.text, m.blocks); }
      await closeInbox(store, { chg: cid });
      return j({ ok: true, decision: b.decision });
    }
    return j({ ok: false, error: "decision 不正" }, 400);
  }
  return j({ ok: false, error: "unknown action" }, 400);
});
