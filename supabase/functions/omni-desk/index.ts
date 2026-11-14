// オムニの机（マイページ管理の中でオムニの案を1回押しで決める）— 2026-11-14 nosh「一歩手前まで」段階1
// POST {admin_pin, action:"chat_list"}  → {ok, rows:[...]}   返事待ちのチャットとオムニの案（店・自信・見た材料・会話）
// POST {admin_pin, action:"chat_decide", id, outcome:"same"|"edited"|"rejected", text?} → {ok}
//      same/edited＝お客様に送る（cs_chat_messages に staff として入れる → 既存トリガーでお客様に「お返事が届きました」）
//      rejected＝送らない（チャットは未対応のまま、人がチャット管理で返す）
// POST {admin_pin, action:"chg_list", ids?} → {ok, map:{change_id（高松は "tkm:<id>"）:{verdict:"ok"|"alt"|"human", ask, why[], alt?, reason?}}}  変更依頼へのオムニの提案
// POST {token, store, action:"chg_for_staff", ids} → {ok, map}  スタッフ画面用（個別URLの share_token）
// POST {admin_pin, action:"stats", days?} → {ok, rows:[{kind, store, same, edited, rejected}]}  種類ごとの「そのまま採用率」
// 自動送信・自動承認はしない（nosh の言葉まで）。記録は cs_chat_drafts のトリガー → omni_decisions（Slack の OK も同じく記録）。
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
const SB = Deno.env.get("SUPABASE_URL")!;
const SR = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const SLACK = Deno.env.get("SLACK_BOT_TOKEN") || "";
const OMNI_CH = "C0B66BVCSPM"; // cs_autoreply.py の案の投稿先
const AUTO_ACK = "ご連絡ありがとうございます！AI・HANDYMANが対応させていただきますので暫しお待ちください！";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
async function get(t: string, q: string): Promise<any[]> { const r = await fetch(`${SB}/rest/v1/${t}?${q}`, { headers: H }); if (!r.ok) throw new Error(`${t} ${r.status}`); return await r.json(); }
async function patch(t: string, q: string, b: unknown): Promise<any[]> { const r = await fetch(`${SB}/rest/v1/${t}?${q}`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`${t} ${r.status} ${await r.text()}`); return await r.json(); }
async function ins(t: string, b: unknown) { const r = await fetch(`${SB}/rest/v1/${t}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`${t} ${r.status} ${await r.text()}`); }
const inList = (a: string[]) => "(" + a.map((x) => `"${String(x).replace(/"/g, "")}"`).join(",") + ")";

// ── 言語：お客様の文から（ハングル・かな・漢字だけ・英字） ──
function langOf(s: string): string {
  s = String(s || "");
  if (/[가-힯]/.test(s)) return "ko";
  if (/[぀-ヿ]/.test(s)) return "ja";
  if (/[一-鿿]/.test(s)) return "zh";
  if (/[a-z]{3,}/i.test(s)) return "en";
  return "ja";
}
const LANG_JP: Record<string, string> = { ja: "日本語", en: "英語", ko: "韓国語", zh: "中国語" };

// ── オムニの自信（いまは決まりで判断。Mac mini のオムニが自信を出すようになったらそれを優先） ──
//   go＝任せてよい／look＝人が見る／human＝人に回す（理由つき）。わからない・危ないものは必ず人へ（nosh 11/14）
const DANGER = /事故|ぶつけ|擦っ|こすっ|傷|故障|動かな|エンジン|バッテリー|パンク|警察|怪我|けが|救急|病院|鍵.*(なく|閉じ込|インロック)|クレーム|返金|キャンセル|払い戻|怒|ひど|最悪|訴/;
const MONEY = /料金|金額|円|支払|払い|決済|請求|延長|追加|オプション|チャイルド|ジュニア|保険|補償|NOC/;
const CHANGE = /変更|ずら|早め|遅れ|間に合|時間|場所|ホテル|空港|便|到着|お届け|回収|返却|ハリアー|アルファード|車種|クラス/;
const NOREPLY = /^(\s*(ありがとう|有難う|有り難う|了解|わかりました|分かりました|承知|解決しました|大丈夫です|よろしくお願いします|OK|ok|thank)[^?？]{0,30})$/i;
const PUNT = /担当より|担当者より|確認して(ご連絡|折り返)|改めて(ご連絡|お送り)|お問い合わせください|お電話/;
function confOf(q: string, d: string): { conf: string; why: string[] } {
  const why: string[] = [];
  const ql = langOf(q), dl = langOf(d);
  if (DANGER.test(q)) why.push("事故・故障・返金・キャンセルなどの話（人が判断）");
  if (PUNT.test(d)) why.push("案が「担当より確認」で終わっている（答えになっていない）");
  if (ql !== "ja" && dl === "ja") why.push(`お客様は${LANG_JP[ql]}、案は日本語`);
  if (why.length) return { conf: "human", why };
  if (NOREPLY.test(q.trim())) return { conf: "look", why: ["お礼・了解だけ。返事はいらないかも（却下でよい）"] };
  if (MONEY.test(q)) why.push("お金の話（料金・延長・オプション）");
  if (CHANGE.test(q)) why.push("時間・場所・車の話（予約と合っているか）");
  if (/\[画像/.test(q)) why.push("画像つき（中身は人が見る）");
  if (why.length) return { conf: "look", why };
  return { conf: "go", why: ["予約の記録で答えられる質問"] };
}

async function resvOf(store: string, rid: string, th: any) {
  try {
    if (store === "spk") { const r = (await get("reservations", `id=eq.${encodeURIComponent(rid)}&select=ota,lend_date,lend_time,return_date,return_time,vehicle,del_place,col_place,visit_type,return_type,status&limit=1`))[0]; if (r) return { ota: r.ota, from: `${r.lend_date || ""} ${r.lend_time || ""}`, to: `${r.return_date || ""} ${r.return_time || ""}`, car: r.vehicle, go: r.del_place || r.visit_type, back: r.col_place || r.return_type, status: r.status }; }
    if (store === "nha") { const r = (await get("nha_reservations", `id=eq.${encodeURIComponent(rid)}&select=ota,start_date,start_time,end_date,end_time,vehicle_class,vehicle_name,del_place,col_place,visit_type,return_type,status&limit=1`))[0]; if (r) return { ota: r.ota, from: `${r.start_date || ""} ${r.start_time || ""}`, to: `${r.end_date || ""} ${r.end_time || ""}`, car: [r.vehicle_class, r.vehicle_name].filter(Boolean).join(" "), go: r.del_place || r.visit_type, back: r.col_place || r.return_type, status: r.status }; }
    const s = th && th.resv_snapshot; // 高松はスレッドに予約の写しがある
    if (s) return { ota: s.ota, from: `${s.lend_date || ""} ${s.lend_time || ""}`, to: `${s.return_date || ""} ${s.return_time || ""}`, car: s.vehicle, go: s.del_place || s.visit_type, back: s.col_place || s.return_type };
  } catch (_) { /* 材料が取れなくても案は出す */ }
  return null;
}

// ★2026-11-14 Mac mini のオムニ（予約データ＋学習で判断）が conf・理由を cs_chat_drafts に書いたらそれを使う。
//   ただし決まり（事故・返金・「担当より確認」・言語ちがい）で「人に回す」になるものは、必ず人へ（安全の網）
function confPick(d: any): { conf: string; why: string[] } {
  const r = confOf(String(d.question || ""), String(d.draft || ""));
  if (!d.conf || !["go", "look", "human"].includes(String(d.conf))) return r;
  const why = String(d.conf_reason || "").split(/\s*\/\s*|\n/).map((x) => x.trim()).filter(Boolean);
  if (r.conf === "human" && d.conf !== "human") return { conf: "human", why: r.why.concat(why) };
  if (!String(d.draft || "").trim() && d.conf === "go") return { conf: "look", why: why.length ? why : ["返事はいらない（オムニの判断）"] };
  return { conf: String(d.conf), why: why.length ? why : r.why };
}

async function chatList() {
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const ds = await get("cs_chat_drafts", `status=eq.pending&created_at=gte.${since}&order=id.desc&select=id,store,thread_id,reservation_id,cust_name,question,draft,orig_draft,created_at,conf,conf_reason,omni_action`);
  const latest = new Map<string, any>(); for (const d of ds) if (!latest.has(d.thread_id)) latest.set(d.thread_id, d);
  const L = [...latest.values()]; if (!L.length) return [];
  const ths = await get("cs_chat_threads", `id=in.${inList(L.map((d) => d.thread_id))}&select=id,store,reservation_id,work_status,status,resv_snapshot`);
  const thm = new Map(ths.map((t: any) => [String(t.id), t]));
  const out: any[] = [];
  for (const d of L) {
    const th: any = thm.get(String(d.thread_id));
    if (!th || th.work_status === "完了" || th.status === "closed") continue; // もう終わったチャットは出さない
    const ms = await get("cs_chat_messages", `thread_id=eq.${d.thread_id}&order=id.desc&limit=8&select=sender,body,image_url,created_at`);
    if (ms.some((m: any) => m.sender === "staff" && m.body !== AUTO_ACK && m.created_at > d.created_at)) continue; // 人がもう返した
    const c = confPick(d);
    out.push({ action: d.omni_action || "", id: d.id, store: d.store, rid: d.reservation_id, name: d.cust_name, q: d.question, draft: d.draft, edited_in_slack: !!d.orig_draft && d.orig_draft !== d.draft, at: d.created_at, lang: langOf(d.question), conf: c.conf, why: c.why, resv: await resvOf(d.store, d.reservation_id, th), msgs: ms.reverse().filter((m: any) => m.body !== AUTO_ACK).map((m: any) => ({ s: m.sender, b: m.body, img: !!m.image_url, at: m.created_at })) });
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : 1));
}

async function slackNote(ts: string, text: string) {
  if (!SLACK || !ts) return;
  try { await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${SLACK}`, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel: OMNI_CH, thread_ts: ts, text }) }); } catch (_) { /* 記録が主、Slack は添え */ }
}

async function chatDecide(p: any) {
  const id = Number(p.id), oc = String(p.outcome || "");
  if (!id || !["same", "edited", "rejected"].includes(oc)) return { ok: false, error: "id/outcome" };
  const d = (await get("cs_chat_drafts", `id=eq.${id}&select=*&limit=1`))[0];
  if (!d) return { ok: false, error: "見つかりません" };
  if (d.status !== "pending") return { ok: false, error: "もう決まっています（Slack などで）", status: d.status };
  const text = oc === "same" ? String(d.draft || "") : oc === "edited" ? String(p.text || "").trim() : "";
  if (oc !== "rejected" && !text) return { ok: false, error: "送る文が空です" };
  const c = confPick(d);
  const now = new Date().toISOString();
  // 先に案を「決まった」にする（status=pending の時だけ）→ Slack の OK と同時に押しても二重に送らない
  const up = await patch("cs_chat_drafts", `id=eq.${id}&status=eq.pending`, { status: oc === "rejected" ? "rejected" : "approved", final_answer: oc === "rejected" ? null : text, decided_by: "admin:" + (String(p.actor_name || "").replace(/[\s:]+/g, " ").trim().slice(0, 30) || "マイページ管理"), decided_at: now, conf: c.conf, conf_reason: c.why.join(" / "), ...(d.orig_draft ? {} : { orig_draft: d.draft }) });
  if (!up.length) return { ok: false, error: "もう決まっています（Slack などで）" };
  if (oc === "rejected") { await slackNote(d.slack_ts, `🚫 マイページ管理で「却下（送らない）」になりました（${String(p.actor_name || "").trim().slice(0, 30) || "本部"}）。返事はチャット管理から人が送ります。`); return { ok: true }; }
  await ins("cs_chat_messages", { thread_id: d.thread_id, sender: "staff", body: text, image_url: null });
  const th = (await get("cs_chat_threads", `id=eq.${d.thread_id}&select=unread_cust,work_status&limit=1`))[0] || {};
  await patch("cs_chat_threads", `id=eq.${d.thread_id}`, { unread_cust: (th.unread_cust || 0) + 1, last_msg: text.slice(0, 120), last_msg_at: now, ...(th.work_status === "完了" ? {} : { work_status: "対応中" }) });
  try { await ins("cs_chat_qa", { store: d.store, reservation_id: d.reservation_id, question: d.question, answer: text, source: oc === "same" ? "approved" : "corrected" }); } catch (_) { /* 学び */ }
  const who = String(p.actor_name || "").trim().slice(0, 30) || "本部";
  await slackNote(d.slack_ts, oc === "same" ? `✅ マイページ管理から「このまま」送りました（${who}）。` : `✏️ マイページ管理で直して送りました（${who}）：\n` + text);
  return { ok: true };
}

async function stats(days: number) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const rs = await get("omni_decisions", `decided_at=gte.${since}&select=kind,store,outcome,conf,via&limit=5000`);
  const m = new Map<string, any>();
  for (const r of rs) { const k = r.kind + "|" + (r.store || ""); const o = m.get(k) || { kind: r.kind, store: r.store, same: 0, edited: 0, rejected: 0, human: 0 }; o[r.outcome] = (o[r.outcome] || 0) + 1; m.set(k, o); }
  return [...m.values()];
}

// ════ ② 時間・場所の変更依頼：オムニの提案「〜で承認していいですか？」（nosh 11/14「聞くではなく 〜で承認していいか？で 確率をここで測ろう」）════
//   決まり：締切（行き＝出発24時間前／帰り＝返却2時間前）・担当の予定（同じ日の別のお届け・回収・送迎と前後30分で重ならない）・
//          車（帰りを遅らせる時、同じ車の次の貸出まで60分あるか）・札幌のエリア（札幌駅から20km、地図の位置がある時）。
//   重なる時は、前後60分で空いている15分刻みの時刻を「代わりに〜を提案していいですか？」にする。わからない時は人へ（ask は出さない）。
//   提案は omni_suggestions に残し、承認・代わりの案・お断りになった時にトリガーで omni_decisions へ（スタッフ画面・本部どちらで押しても）。
const CHG_F = ["lend_time", "return_time", "del_place", "col_place", "method"];
const NOT_PERSON = /無人|乗り?捨|洗車|^[（(]|^$/;
const hm = (v: unknown) => { const m = String(v || "").match(/(\d{1,2}):(\d{2})/); return m ? String(+m[1]).padStart(2, "0") + ":" + m[2] : ""; };
const mins = (t: string) => { const m = t.match(/^(\d{2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : NaN; };
const tOf = (n: number) => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
const mdj = (d: string) => { const m = String(d || "").match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${+m[1]}/${+m[2]}` : ""; };
const atJst = (d: string, t: string) => Date.parse(`${d}T${t || "00:00"}:00+09:00`);
function kmFrom(lat: number, lng: number, la0: number, ln0: number) { const R = 6371, r = Math.PI / 180; const a = Math.sin((lat - la0) * r / 2) ** 2 + Math.cos(la0 * r) * Math.cos(lat * r) * Math.sin((lng - ln0) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); }

// その店のその日の担当のタスク（行き・帰り・送迎）と、時刻（タスクに無ければ予約の時刻）
async function dayTasks(store: string, date: string) {
  if (store === "spk") {
    const ts = await get("tasks", `date=eq.${date}&deleted=not.is.true&select=_id,type,time,assignee,reservation_id,assigned_vehicle`);
    const ids = [...new Set(ts.map((t: any) => t.reservation_id).filter(Boolean))];
    const rs = ids.length ? await get("reservations", `id=in.${inList(ids as string[])}&select=id,lend_time,return_time,lend_date,return_date`) : [];
    const rm = new Map(rs.map((r: any) => [r.id, r]));
    return ts.filter((t: any) => /^[dc]-/.test(t._id)).map((t: any) => { const r: any = rm.get(t.reservation_id) || {}; const back = t._id.startsWith("c-"); return { id: t._id, rid: t.reservation_id, who: String(t.assignee || "").trim(), t: hm(t.time) || hm(back ? r.return_time : r.lend_time), back, car: t.assigned_vehicle || "", kind: String(t.type || "") }; });
  }
  const ts = await get("nha_tasks", `date=eq.${date}&deleted=not.is.true&select=_id,${encodeURIComponent("内容")},${encodeURIComponent("時間")},${encodeURIComponent("担当")},${encodeURIComponent("予約番号")},assigned_vehicle`);
  const ids = [...new Set(ts.map((t: any) => t["予約番号"]).filter(Boolean))];
  const rs = ids.length ? await get("nha_reservations", `id=in.${inList(ids as string[])}&select=id,start_time,end_time`) : [];
  const rm = new Map(rs.map((r: any) => [r.id, r]));
  return ts.filter((t: any) => /^[dc]-/.test(t._id)).map((t: any) => { const r: any = rm.get(t["予約番号"]) || {}; const back = t._id.startsWith("c-"); return { id: t._id, rid: t["予約番号"], who: String(t["担当"] || "").trim(), t: hm(t["時間"]) || hm(back ? r.end_time : r.start_time), back, car: t.assigned_vehicle || "", kind: String(t["内容"] || "") }; });
}

async function chgSuggest(c: any) {
  const store = String(c.store), rid = String(c.reservation_id), f = String(c.field), pl = c.payload || {}, tg = pl.target || {};
  if (!["spk", "nha"].includes(store) || !CHG_F.includes(f)) return null;
  const R = store === "spk"
    ? (await get("reservations", `id=eq.${encodeURIComponent(rid)}&select=lend_date,lend_time,return_date,return_time,del_place,col_place&limit=1`))[0]
    : (await get("nha_reservations", `id=eq.${encodeURIComponent(rid)}&select=start_date,start_time,end_date,end_time,del_place,col_place&limit=1`))[0];
  if (!R) return { verdict: "human", ask: "", why: ["予約が見つからない"] };
  const sd = String(R.lend_date || R.start_date || "").slice(0, 10), st = hm(R.lend_time || R.start_time), ed = String(R.return_date || R.end_date || "").slice(0, 10), et = hm(R.return_time || R.end_time);
  const back = /^(return_time|col_place)$/.test(f) || (f === "method" && ("return_time" in tg || "col_place" in tg || /^帰り/.test(String(c.new_value || ""))));
  const date = back ? ed : sd, oldT = back ? et : st;
  const newT = /_time$/.test(f) ? hm(c.new_value) : hm(back ? tg.return_time : tg.lend_time) || "";
  const newP = /_place$/.test(f) ? String(c.new_value || "") : String((back ? tg.col_place : tg.del_place) || "");
  const t = newT || oldT, leg = back ? (store === "spk" ? "回収" : "返却") : (store === "spk" ? "お届け" : "貸出");
  const what = `「${mdj(date)} ${t}${newP ? "・" + newP.slice(0, 24) : ""}」の${leg}`;
  const why: string[] = [];
  // 締切
  const due = back ? atJst(ed, et) - 2 * 3600e3 : atJst(sd, st) - 24 * 3600e3;
  if (!isNaN(due) && Date.parse(c.created_at) > due) why.push(`⚠️ 締切（${back ? "返却2時間前" : "出発24時間前"}）を過ぎた依頼`);
  else why.push(`締切内（${back ? "返却2時間前" : "出発24時間前"}まで）`);
  if (!date || !t) return { verdict: "human", ask: "", why: why.concat(["日付か時刻が読めない"]), date, t };
  // 担当の予定
  const D = await dayTasks(store, date);
  const mine = D.find((x: any) => x.rid === rid && x.back === back);
  const who = mine && !NOT_PERSON.test(mine.who) ? mine.who : "";
  const isBus = (k: string) => /PUB|BDB/i.test(k), meBus = store === "nha" && mine && isBus(mine.kind);
  // 那覇の送迎バス（PUB・BDB）はまとめてお送りするので、バス同士は重ならない扱い
  const busy = (n: number) => who && !meBus ? D.filter((x: any) => x.who === who && x.rid !== rid && x.t && Math.abs(mins(x.t) - n) < 30) : [];
  const n0 = mins(t); let alt = "";
  const hit = isNaN(n0) ? [] : busy(n0);
  if (meBus) why.push("送迎バス（まとめてお送りするので担当の予定は重ならない）");
  else if (!who) why.push(mine ? "担当なし（だれでも行ける）" : "お届け・回収のタスクがない予約（送迎・来店）");
  else if (hit.length) { why.push(`⚠️ ${who}さんは ${hit.map((x: any) => x.t + " " + (x.back ? "回収" : "お届け")).join("・")} と重なる`); for (const d of [15, -15, 30, -30, 45, -45, 60, -60]) { const n = n0 + d; if (n >= 7 * 60 && n <= 21 * 60 && !busy(n).length) { alt = tOf(n); break; } } }
  else why.push(`${who}さんの予定と重ならない（前後30分）`);
  // 車：帰りを遅らせる時、同じ車の次の貸出
  if (back && newT && et && mins(newT) > mins(et) && mine && mine.car) {
    const nx = D.filter((x: any) => !x.back && x.car === mine.car && x.rid !== rid && x.t && mins(x.t) >= mins(et) - 30).sort((a: any, b: any) => mins(a.t) - mins(b.t))[0];
    if (nx && mins(nx.t) < mins(newT) + 60) why.push(`⚠️ 同じ車の次の貸出 ${nx.t}（60分あかない）`); else why.push("車：次の貸出まで間に合う");
  }
  // 札幌のエリア（地図の位置がある時だけ）
  if (store === "spk" && newP) {
    const la = +(pl.del_lat ?? pl.col_lat ?? tg.del_lat ?? tg.col_lat), ln = +(pl.del_lng ?? pl.col_lng ?? tg.del_lng ?? tg.col_lng);
    if (la && ln) { const km = kmFrom(la, ln, 43.0687, 141.3508); why.push(km > 20 ? `⚠️ 札幌駅から ${km.toFixed(1)}km（エリア外）` : `エリア内（札幌駅から ${km.toFixed(1)}km）`); if (km > 20) return { verdict: "alt", ask: `${newP.slice(0, 24)} はエリア外です。「対象エリア内の別の場所」を代わりの案として送っていいですか？`, why, reason: "out_of_area", date, t, who }; }
    else why.push("場所の地図の位置なし（エリアは人が見る）");
  }
  const bad = why.filter((w) => w.startsWith("⚠️"));
  if (!bad.length) return { verdict: "ok", ask: `${what}で承認していいですか？`, why, date, t, who };
  if (bad.length === 1 && hit.length && alt) return { verdict: "alt", ask: `${t}は担当の予定と重なります。代わりに「${alt}」を提案していいですか？`, why, reason: "full_slot", alt, date, t, who };
  return { verdict: "human", ask: "", why, date, t, who };
}

// ════ ②' 高松（BT の bt_reservation_changes・送迎の時間 mp_pickup / mp_dropoff）════ 2026-11-14 nosh「高松も統一せよ」
//   同じ決まり（締切・担当の予定・重なる時は代わりの時刻）。時刻は予約の送迎時刻（pickup_time / dropoff_time）。
//   キーは "tkm:<id>"（札幌・那覇の依頼番号と重ならないように）。決めた結果は BT 側にトリガーがないので、ここで照らし合わせて omni_decisions に入れる
const TKM_F = ["mp_pickup", "mp_dropoff"];
async function getB(t: string, q: string): Promise<any[]> {
  const u = Deno.env.get("BT_URL"), k = Deno.env.get("BT_SERVICE_KEY"); if (!u || !k) return [];
  const hd: Record<string, string> = { apikey: k }; if (k.startsWith("eyJ")) hd.Authorization = `Bearer ${k}`;
  const r = await fetch(`${u}/rest/v1/${t}?${q}`, { headers: hd }); return r.ok ? await r.json() : [];
}
async function chgSuggestTkm(c: any) {
  const rid = String(c.reservation_id), back = c.change_type === "mp_dropoff";
  const R = (await getB("bt_reservations", `id=eq.${encodeURIComponent(rid)}&select=start_date,start_time,pickup_time,end_date,end_time,dropoff_time&limit=1`))[0];
  if (!R) return { verdict: "human", ask: "", why: ["予約が見つからない"] };
  const sd = String(R.start_date || "").slice(0, 10), ed = String(R.end_date || "").slice(0, 10);
  const date = back ? ed : sd, oldT = hm(back ? (R.dropoff_time || R.end_time) : (R.pickup_time || R.start_time));
  const t = hm(c.payload?.time) || hm(c.new_value);
  const leg = back ? "空港へお送り" : "空港お迎え";
  const why: string[] = [];
  const due = back ? atJst(ed, hm(R.end_time)) - 2 * 3600e3 : atJst(sd, hm(R.start_time)) - 24 * 3600e3;
  if (!isNaN(due) && Date.parse(c.changed_at) > due) why.push(`⚠️ 締切（${back ? "返却2時間前" : "出発24時間前"}）を過ぎた依頼`);
  else why.push(`締切内（${back ? "返却2時間前" : "出発24時間前"}まで）`);
  if (!date || !t) return { verdict: "human", ask: "", why: why.concat(["日付か時刻が読めない"]) };
  // 担当の予定：その日の行き・帰りのタスク（時刻は各予約の送迎時刻）
  const ts = await getB("bt_tasks", `date=eq.${date}&deleted=not.is.true&select=_id,${encodeURIComponent("担当")},${encodeURIComponent("予約番号")}`);
  const L = ts.filter((x: any) => /^[dc]-/.test(x._id));
  const ids = [...new Set(L.map((x: any) => x["予約番号"]).filter(Boolean))] as string[];
  const rs = ids.length ? await getB("bt_reservations", `id=in.${inList(ids)}&select=id,start_time,pickup_time,end_time,dropoff_time`) : [];
  const rm = new Map(rs.map((r: any) => [r.id, r]));
  const D = L.map((x: any) => { const r: any = rm.get(x["予約番号"]) || {}; const b = x._id.startsWith("c-"); return { rid: x["予約番号"], who: String(x["担当"] || "").trim(), back: b, t: hm(b ? (r.dropoff_time || r.end_time) : (r.pickup_time || r.start_time)) }; });
  const mine = D.find((x: any) => x.rid === rid && x.back === back);
  const who = mine && !NOT_PERSON.test(mine.who) ? mine.who : "";
  const busy = (n: number) => who ? D.filter((x: any) => x.who === who && x.rid !== rid && x.t && Math.abs(mins(x.t) - n) < 30) : [];
  const n0 = mins(t), hit = isNaN(n0) ? [] : busy(n0); let alt = "";
  if (!who) why.push(mine ? "担当なし（だれでも行ける）" : "行き・帰りのタスクがまだない");
  else if (hit.length) { why.push(`⚠️ ${who}さんは ${hit.map((x: any) => x.t + " " + (x.back ? "お送り" : "お迎え")).join("・")} と重なる`); for (const d of [15, -15, 30, -30, 45, -45, 60, -60]) { const n = n0 + d; if (n >= 9 * 60 && n <= 18 * 60 + 50 && !busy(n).length) { alt = tOf(n); break; } } }
  else why.push(`${who}さんの予定と重ならない（前後30分）`);
  if (oldT) why.push(`いまの予約は ${oldT}`);
  const what = `「${mdj(date)} ${t}」の${leg}`;
  const bad = why.filter((w) => w.startsWith("⚠️"));
  if (!bad.length) return { verdict: "ok", ask: `${what}で承認していいですか？`, why, who };
  if (bad.length === 1 && hit.length && alt) return { verdict: "alt", ask: `${t}は担当の予定と重なります。代わりに「${alt}」を提案していいですか？`, why, reason: "full_slot", alt, who };
  return { verdict: "human", ask: "", why, who };
}
// 高松の提案のうち、まだ記録していないもの → BT の今の状態を見て決まっていれば omni_decisions へ（札幌・那覇のトリガーと同じ数え方）
async function tkmReconcile() {
  const S = await get("omni_suggestions", `kind=eq.chg&store=eq.tkm&select=ref_id,reservation_id,verdict,ask,why,alt,created_at&order=created_at.desc&limit=200`);
  if (!S.length) return;
  const done = new Set((await get("omni_decisions", `kind=eq.chg&store=eq.tkm&ref_id=in.${inList(S.map((s: any) => s.ref_id))}&select=ref_id`)).map((x: any) => x.ref_id));
  const todo = S.filter((s: any) => !done.has(s.ref_id)); if (!todo.length) return;
  const cs = await getB("bt_reservation_changes", `id=in.(${todo.map((s: any) => Number(String(s.ref_id).slice(4))).filter(Boolean).join(",")})&select=id,status,payload,decided_by,decided_at`);
  for (const c of cs) {
    if (!["approved", "proposed", "rejected"].includes(c.status)) continue;
    const s: any = todo.find((x: any) => x.ref_id === "tkm:" + c.id); if (!s) continue;
    const pv = String(c.payload?.proposal?.value || "");
    const oc = s.verdict === "ok" ? (c.status === "approved" ? "same" : "rejected")
      : s.verdict === "alt" ? (c.status === "proposed" ? (!s.alt || hm(pv) === s.alt ? "same" : "edited") : "rejected") : "human";
    try { await ins("omni_decisions", { kind: "chg", store: "tkm", ref_id: s.ref_id, reservation_id: s.reservation_id, proposal: s.ask, final: c.status + (pv ? " " + pv : ""), outcome: oc, conf: s.verdict === "human" ? "human" : "go", conf_reason: (s.why || []).join(" / "), via: "admin", decided_by: c.decided_by, proposed_at: s.created_at, decided_at: c.decided_at || new Date().toISOString() }); } catch (_) { /* 次の読み込みでもう一度 */ }
  }
}
async function saveSug(key: string, store: string, rid: string, s: any) {
  try { await fetch(`${SB}/rest/v1/omni_suggestions?on_conflict=kind,ref_id`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ kind: "chg", ref_id: key, store, reservation_id: rid, verdict: s.verdict, ask: s.ask, why: s.why, alt: s.alt || null, reason: s.reason || null, updated_at: new Date().toISOString() }) }); } catch (_) { /* 提案は出す */ }
}

async function chgList(ids?: number[]) {
  const q = ids && ids.length ? `id=in.(${ids.map(Number).filter(Boolean).join(",")})` : `status=eq.requested&store=in.(spk,nha)&field=in.(${CHG_F.join(",")})`;
  const rows = await get("mypage_changes", `${q}&select=id,store,reservation_id,field,old_value,new_value,payload,status,created_at&order=id.asc&limit=60`);
  const out: Record<string, any> = {};
  for (const c of rows) {
    if (c.status !== "requested") continue;
    let s: any = null; try { s = await chgSuggest(c); } catch (e) { s = { verdict: "human", ask: "", why: ["オムニが判断できなかった：" + String((e as Error).message || e).slice(0, 80)] }; }
    if (!s) continue;
    out[c.id] = s;
    await saveSug(String(c.id), c.store, c.reservation_id, s);
  }
  if (!ids) { // 本部の一覧だけ：高松も
    try { await tkmReconcile(); } catch (_) { /* 記録は次の読み込みで */ }
    const T = await getB("bt_reservation_changes", `status=eq.requested&change_type=in.(${TKM_F.join(",")})&select=id,reservation_id,change_type,new_value,old_value,payload,status,changed_at&order=id.asc&limit=60`);
    for (const c of T) {
      let s: any = null; try { s = await chgSuggestTkm(c); } catch (e) { s = { verdict: "human", ask: "", why: ["オムニが判断できなかった：" + String((e as Error).message || e).slice(0, 80)] }; }
      out["tkm:" + c.id] = s; await saveSug("tkm:" + c.id, "tkm", String(c.reservation_id), s);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const p = await req.json();
    // スタッフ画面（個別URL）：自分の画面に出ている変更依頼へのオムニの提案だけ返す（staff-decide と同じ share_token で本人確認）
    if (p.action === "chg_for_staff") {
      const store = p.store === "nha" ? "nha" : "spk", tok = String(p.token || "");
      if (!/^[0-9a-f-]{20,}$/i.test(tok)) return J({ ok: false, error: "token" }, 403);
      const me = (await get(store === "nha" ? "nha_staff" : "staff", `share_token=eq.${tok}&select=name,active&limit=1`))[0];
      if (!me || me.active === false) return J({ ok: false, error: "token" }, 403);
      const ids = (Array.isArray(p.ids) ? p.ids : []).map(Number).filter(Boolean).slice(0, 40);
      const m = ids.length ? await chgList(ids) : {};
      return J({ ok: true, map: Object.fromEntries(Object.entries(m).filter(([, v]: any) => v)) });
    }
    const PIN = Deno.env.get("ADMIN_PIN") || "";
    if (!PIN || String(p.admin_pin || "") !== PIN) return J({ ok: false, error: "pin" }, 401);
    if (p.action === "chat_list") return J({ ok: true, rows: await chatList() });
    if (p.action === "chat_decide") return J(await chatDecide(p));
    // ★2026-11-14 nosh「一次判断をOMNI→共有①社員＝Slack 共有②担当者＝個別URL→社員承認」：依頼が来た時に、受けた関数（札幌・那覇・高松）がこれを呼んで Slack の文にする
    if (p.action === "chg_ask") {
      const out: Record<string, any> = {};
      if (p.store === "tkm") {
        const ids = (Array.isArray(p.ids) ? p.ids : []).map(Number).filter(Boolean).slice(0, 10);
        const T = ids.length ? await getB("bt_reservation_changes", `id=in.(${ids.join(",")})&select=id,reservation_id,change_type,new_value,old_value,payload,status,changed_at`) : [];
        for (const c of T) { if (c.status !== "requested" || !TKM_F.includes(c.change_type)) continue; let s: any = null; try { s = await chgSuggestTkm(c); } catch (e) { s = { verdict: "human", ask: "", why: ["オムニが判断できなかった：" + String((e as Error).message || e).slice(0, 80)] }; } out[String(c.id)] = s; await saveSug("tkm:" + c.id, "tkm", String(c.reservation_id), s); }
        return J({ ok: true, map: out });
      }
      return J({ ok: true, map: await chgList(Array.isArray(p.ids) ? p.ids : []) });
    }
    if (p.action === "chg_list") return J({ ok: true, map: await chgList(Array.isArray(p.ids) ? p.ids : undefined) });
    if (p.action === "stats") { try { await tkmReconcile(); } catch (_) { /* */ } } if (p.action === "stats") return J({ ok: true, rows: await stats(Math.min(90, Math.max(1, +p.days || 14))) });
    return J({ ok: false, error: "action" }, 400);
  } catch (e) { return J({ ok: false, error: String((e as Error).message || e) }, 500); }
});
