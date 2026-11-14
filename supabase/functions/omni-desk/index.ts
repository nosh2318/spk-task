// オムニの机（マイページ管理の中でオムニの案を1回押しで決める）— 2026-11-14 nosh「一歩手前まで」段階1
// POST {admin_pin, action:"chat_list"}  → {ok, rows:[...]}   返事待ちのチャットとオムニの案（店・自信・見た材料・会話）
// POST {admin_pin, action:"chat_decide", id, outcome:"same"|"edited"|"rejected", text?} → {ok}
//      same/edited＝お客様に送る（cs_chat_messages に staff として入れる → 既存トリガーでお客様に「お返事が届きました」）
//      rejected＝送らない（チャットは未対応のまま、人がチャット管理で返す）
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

async function chatList() {
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const ds = await get("cs_chat_drafts", `status=eq.pending&created_at=gte.${since}&order=id.desc&select=id,store,thread_id,reservation_id,cust_name,question,draft,orig_draft,created_at`);
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
    const c = confOf(String(d.question || ""), String(d.draft || ""));
    out.push({ id: d.id, store: d.store, rid: d.reservation_id, name: d.cust_name, q: d.question, draft: d.draft, edited_in_slack: !!d.orig_draft && d.orig_draft !== d.draft, at: d.created_at, lang: langOf(d.question), conf: c.conf, why: c.why, resv: await resvOf(d.store, d.reservation_id, th), msgs: ms.reverse().filter((m: any) => m.body !== AUTO_ACK).map((m: any) => ({ s: m.sender, b: m.body, img: !!m.image_url, at: m.created_at })) });
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
  const c = confOf(String(d.question || ""), String(d.draft || ""));
  const now = new Date().toISOString();
  // 先に案を「決まった」にする（status=pending の時だけ）→ Slack の OK と同時に押しても二重に送らない
  const up = await patch("cs_chat_drafts", `id=eq.${id}&status=eq.pending`, { status: oc === "rejected" ? "rejected" : "approved", final_answer: oc === "rejected" ? null : text, decided_by: "admin:マイページ管理", decided_at: now, conf: c.conf, conf_reason: c.why.join(" / "), ...(d.orig_draft ? {} : { orig_draft: d.draft }) });
  if (!up.length) return { ok: false, error: "もう決まっています（Slack などで）" };
  if (oc === "rejected") { await slackNote(d.slack_ts, "🚫 マイページ管理で「却下（送らない）」になりました。返事はチャット管理から人が送ります。"); return { ok: true }; }
  await ins("cs_chat_messages", { thread_id: d.thread_id, sender: "staff", body: text, image_url: null });
  const th = (await get("cs_chat_threads", `id=eq.${d.thread_id}&select=unread_cust,work_status&limit=1`))[0] || {};
  await patch("cs_chat_threads", `id=eq.${d.thread_id}`, { unread_cust: (th.unread_cust || 0) + 1, last_msg: text.slice(0, 120), last_msg_at: now, ...(th.work_status === "完了" ? {} : { work_status: "対応中" }) });
  try { await ins("cs_chat_qa", { store: d.store, reservation_id: d.reservation_id, question: d.question, answer: text, source: oc === "same" ? "approved" : "corrected" }); } catch (_) { /* 学び */ }
  await slackNote(d.slack_ts, oc === "same" ? "✅ マイページ管理から「このまま」送りました。" : "✏️ マイページ管理で直して送りました：\n" + text);
  return { ok: true };
}

async function stats(days: number) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const rs = await get("omni_decisions", `decided_at=gte.${since}&select=kind,store,outcome,conf,via&limit=5000`);
  const m = new Map<string, any>();
  for (const r of rs) { const k = r.kind + "|" + (r.store || ""); const o = m.get(k) || { kind: r.kind, store: r.store, same: 0, edited: 0, rejected: 0 }; o[r.outcome] = (o[r.outcome] || 0) + 1; m.set(k, o); }
  return [...m.values()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const p = await req.json();
    const PIN = Deno.env.get("ADMIN_PIN") || "";
    if (!PIN || String(p.admin_pin || "") !== PIN) return J({ ok: false, error: "pin" }, 401);
    if (p.action === "chat_list") return J({ ok: true, rows: await chatList() });
    if (p.action === "chat_decide") return J(await chatDecide(p));
    if (p.action === "stats") return J({ ok: true, rows: await stats(Math.min(90, Math.max(1, +p.days || 14))) });
    return J({ ok: false, error: "action" }, 400);
  } catch (e) { return J({ ok: false, error: String((e as Error).message || e) }, 500); }
});
