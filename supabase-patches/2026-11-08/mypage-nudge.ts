// mypage-nudge — 新マイページ「スタッフに知らせる」（着きました／少し遅れます／見つからない／車を停めました）
//   2026-11-08 nosh「電話が一番面倒」→ ボタンで即スタッフへ。電話・準備中の文言はなし。
//   ・本人確認：nha/spk は mypage_token、tkm は高松の handyman-mypage-tkm に lookup(ro:1) して確認
//   ・届け先：Slack（店ごと）に即投稿＋ nha/spk は CSチャット（cs_chat_*）にも記録＝スタッフがそのまま返信できる
//   ・同じ予約・同じ種類は2分に1回まで（連打対策）
// deploy: --no-verify-jwt   secrets: SLACK_BOT_TOKEN, (任意) NUDGE_CH_NHA / NUDGE_CH_SPK / NUDGE_CH_TKM
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" };
const TKM_FN = "https://ggqugvyskyiblxiycpci.supabase.co/functions/v1/handyman-mypage-tkm";
const RESV: Record<string, string> = { spk: "reservations", nha: "nha_reservations" };
const CH: Record<string, string> = {
  nha: Deno.env.get("NUDGE_CH_NHA") || Deno.env.get("STAFF_DONE_CHANNEL_NHA") || "C06L91W6T08",
  spk: Deno.env.get("NUDGE_CH_SPK") || "C0B66BVCSPM",
  tkm: Deno.env.get("NUDGE_CH_TKM") || "C0B66BVCSPM",
};
const LABEL: Record<string, string> = { nha: "那覇", spk: "札幌", tkm: "高松" };
const KIND: Record<string, string> = { arrived: "着きました", late: "少し遅れます", lost: "スタッフが見つかりません", parked: "車を停めました" };
const ALLOWED = ["https://nosh2318.github.io", "https://rent-handyman.com", "https://keydrop.jp", "https://hdm-rentacar.jp"];
function cors(o: string | null) { const a = o && ALLOWED.includes(o) ? o : ALLOWED[0]; return { "Access-Control-Allow-Origin": a, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Vary": "Origin" }; }
function json(b: unknown, s: number, o: string | null) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors(o), "content-type": "application/json" } }); }
const enc = encodeURIComponent;
const S = (v: unknown, n = 300) => String(v ?? "").trim().slice(0, n);
async function sbGet(path: string): Promise<any[]> { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json().catch(() => []) : []; }
async function sbInsert(t: string, b: unknown): Promise<any> { const r = await fetch(`${SB_URL}/rest/v1/${t}`, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(b) }); if (!r.ok) { console.error("insert", t, await r.text()); return null; } const d = await r.json().catch(() => []); return Array.isArray(d) ? d[0] : d; }
async function sbPatch(t: string, q: string, b: unknown) { await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { method: "PATCH", headers: H, body: JSON.stringify(b) }); }
async function slack(ch: string, text: string): Promise<boolean> {
  const tk = Deno.env.get("SLACK_BOT_TOKEN"); if (!tk) { console.log("[slack skip]", text); return false; }
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel: ch, text }) }); const d = await r.json().catch(() => ({})); if (!d.ok) console.error("slack", JSON.stringify(d)); return !!d.ok; } catch (e) { console.error("slack", String(e)); return false; }
}
async function uploadImg(threadId: string, dataUrl: string): Promise<string | null> {
  const m = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/i.exec(dataUrl || ""); if (!m) return null;
  const bin = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)); if (bin.length > 6_000_000) return null;
  const path = `${threadId}/${Date.now()}.${m[2].toLowerCase() === "jpeg" ? "jpg" : m[2].toLowerCase()}`;
  const r = await fetch(`${SB_URL}/storage/v1/object/cs-chat/${path}`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": m[1], "x-upsert": "true" }, body: bin });
  return r.ok ? `${SB_URL}/storage/v1/object/public/cs-chat/${path}` : null;
}
const recent = new Map<string, number>();

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  let p: any = {}; try { p = await req.json(); } catch { return json({ error: "invalid json" }, 400, origin); }
  const store = ["nha", "spk", "tkm"].includes(p.store) ? p.store : "";
  const token = S(p.token, 200), kind = S(p.kind, 20), note = S(p.note, 300), leg = p.leg === "back" ? "back" : "go";
  const isStatus = p.action === "status";
  if (!store || token.length < 16 || (!isStatus && !KIND[kind])) return json({ ok: false, error: "bad request" }, 400, origin);

  // 本人確認
  let r: any = null;
  if (store === "tkm") {
    try { const x = await fetch(TKM_FN, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "lookup", token, ro: 1 }) }); const j = await x.json().catch(() => null); r = j && j.reservation ? j.reservation : null; } catch { r = null; }
  } else {
    r = (await sbGet(`${RESV[store]}?mypage_token=eq.${enc(token)}&select=*&limit=1`))[0] || null;
  }
  if (!r) return json({ ok: false, error: "予約が見つかりません" }, 200, origin);

  // ★2026-11-08 お客様の画面：最新の連絡と「スタッフが確認しました（時刻）」
  if (isStatus) {
    const n = (await sbGet(`mypage_nudges?store=eq.${store}&reservation_id=eq.${enc(String(r.id))}&created_at=gt.${enc(new Date(Date.now() - 12 * 3600e3).toISOString())}&select=kind,leg,created_at,acked_at&order=created_at.desc&limit=1`))[0] || null;
    return json({ ok: true, nudge: n }, 200, origin);
  }
  const key = `${store}:${r.id}:${kind}`, now = Date.now();
  if ((recent.get(key) || 0) > now - 120e3) return json({ ok: true, dup: true }, 200, origin);
  recent.set(key, now);

  const isBack = leg === "back";
  const time = S(isBack ? (r.return_time || r.end_time || r.col_time) : (r.lend_time || r.start_time || r.del_time), 10);
  const place = S(isBack ? (r.col_place || "") : (r.del_place || ""), 120);
  const head = `🙋 お客様から【${KIND[kind]}】${LABEL[store]}・${isBack ? "返却/回収" : "受け取り/お届け"} ${time}${place ? " " + place : ""}`;

  // nha/spk：CSチャットにも残す（スタッフはそのまま返信できる）
  let chat = false, img = false;
  if (store !== "tkm") {
    let th = (await sbGet(`cs_chat_threads?store=eq.${store}&reservation_id=eq.${enc(r.id)}&limit=1`))[0];
    if (!th) th = await sbInsert("cs_chat_threads", { store, reservation_id: r.id, source: "mypage", cust_name: r.name || "", status: "open", unread_staff: 0, unread_cust: 0 });
    if (th) {
      const url = typeof p.image === "string" && p.image.startsWith("data:image/") ? await uploadImg(th.id, p.image) : null;
      img = !!url;
      const body = `【${isBack ? "返却" : "受け取り"}・${KIND[kind]}】${note ? "\n" + note : ""}`;
      await sbInsert("cs_chat_messages", { thread_id: th.id, sender: "customer", body, image_url: url });
      await sbPatch("cs_chat_threads", `id=eq.${th.id}`, { unread_staff: (th.unread_staff || 0) + 1, status: "open", work_status: "未対応", last_msg: body.slice(0, 120), last_msg_at: new Date().toISOString() });
      chat = true;
    }
  }
  // スタッフ画面（バイトURL・タスクサマリー）用の記録：種類と時刻だけ
  await sbInsert("mypage_nudges", { store, reservation_id: String(r.id), kind, leg, note: note || null });
  const sent = await slack(CH[store], `${head}\n予約 ${r.id}${note ? "\n「" + note + "」" : ""}${img ? "\n📷 写真あり（CSチャットで確認）" : ""}${chat ? "\n返信：https://nosh2318.github.io/spk-task/cs-chat-admin.html" : ""}`);
  return json({ ok: true, slack: sent, chat }, 200, origin);
});
