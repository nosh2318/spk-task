// staff-chat（2026-11-11 nosh「担当のチャットを個別URLでバイトスタッフが見られるか」）
// 札幌：個別URL（staff.html?t=）から、自分が担当（お届け DEL／回収 COL）の予約に来た「スタッフに聞く」チャットを見るだけ。
//   ・読むだけ。cs_chat_threads / cs_chat_messages には一切書かない（既読・未対応の数・AI回答案・Slack #omni は今のまま）
//   ・本人確認は staff.share_token（staff-decide と同じ）。担当でない予約のチャットは返さない。
// action: list {token}
const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const STORE = "spk";
async function get(path: string) { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json() : []; }
async function me(token: string) {
  if (!/^[0-9a-f-]{20,}$/i.test(token)) return null;
  const s = (await get(`staff?share_token=eq.${token}&select=name,active`))[0];
  return s && s.active !== false ? String(s.name) : null;
}
const jstDate = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let b: any; try { b = await req.json(); } catch { return j({ ok: false, error: "bad json" }, 400); }
  const name = await me(String(b.token || ""));
  if (!name) return j({ ok: false, error: "invalid token" }, 403);
  if (b.action !== "list") return j({ ok: false, error: "unknown action" }, 400);
  // 自分が担当のお届け・回収タスク（昨日〜30日先）
  const now = Date.now(), from = jstDate(now - 864e5), to = jstDate(now + 30 * 864e5);
  const tasks = await get(`tasks?assignee=eq.${encodeURIComponent(name)}&date=gte.${from}&date=lte.${to}&deleted=not.is.true&select=reservation_id,type,date,time&limit=300`);
  const mine = new Map<string, { kind: string[]; date: string }>();
  for (const t of tasks) {
    const rid = String(t.reservation_id || "").trim(); const ty = String(t.type || "").toUpperCase();
    if (!rid || !(ty.startsWith("DEL") || ty.startsWith("COL"))) continue;
    const e = mine.get(rid) || { kind: [], date: String(t.date || "") };
    const k = ty.startsWith("DEL") ? "お届け" : "回収"; if (!e.kind.includes(k)) e.kind.push(k);
    if (String(t.date || "") < e.date) e.date = String(t.date || "");
    mine.set(rid, e);
  }
  if (!mine.size) return j({ ok: true, me: name, threads: [] });
  const ids = [...mine.keys()].map((x) => `"${x.replace(/"/g, "")}"`).join(",");
  const th = await get(`cs_chat_threads?store=eq.${STORE}&reservation_id=in.(${encodeURIComponent(ids)})&select=id,reservation_id,cust_name,last_msg_at&order=last_msg_at.desc.nullslast&limit=30`);
  const out = [];
  for (const t of th) {
    const msgs = await get(`cs_chat_messages?thread_id=eq.${t.id}&select=id,sender,body,image_url,created_at&order=id.desc&limit=30`);
    if (!msgs.length) continue;
    msgs.reverse();
    const last = msgs[msgs.length - 1];
    const m = mine.get(String(t.reservation_id))!;
    out.push({ rid: t.reservation_id, cust: t.cust_name || "", kind: m.kind.join("・"), date: m.date, last_at: last.created_at,
      waiting: last.sender === "customer", // 最後がお客様＝本部の返事待ち
      msgs: msgs.map((x: any) => ({ id: x.id, who: x.sender === "customer" ? "c" : "s", body: String(x.body || "").slice(0, 1500), img: x.image_url || "", at: x.created_at })) });
  }
  return j({ ok: true, me: name, threads: out });
});
