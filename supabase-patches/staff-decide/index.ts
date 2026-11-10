// staff-decide（2026-11-10 nosh「自分の担当ユーザーからのリクエストを受けて回答するのが目的（場所や時間）」）
// 札幌：個別URL（staff.html?t=）から、自分が担当のタスクに来たお客様の「時間・場所の変更依頼」を見て、
//   承認＝アクションタブと同じ handyman-mypage の decide を呼ぶ（反映・お客様通知・OPシートまで同じ処理）
//   難しい＝Slack（マイページ依頼チャンネル）に相談を出す。依頼はそのまま残り、社員がアクションタブで返す。
// 担当が決まっていない依頼は、だれでも対応できる。
// action: list {token} / decide {token, change_id, decision: "approved"|"consult", note?}
const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const FIELDS = ["lend_time", "del_place", "return_time", "col_place"];
const LABEL: Record<string, string> = { lend_time: "お届けの時間", del_place: "お届けの場所", return_time: "回収の時間", col_place: "回収の場所" };
const TT = (f: string) => (f === "lend_time" || f === "del_place") ? "DEL" : "COL";
async function get(path: string) { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json() : []; }
async function me(token: string) {
  if (!/^[0-9a-f-]{20,}$/i.test(token)) return null;
  const s = (await get(`staff?share_token=eq.${token}&select=name,active`))[0];
  return s && s.active !== false ? String(s.name) : null;
}
async function slack(text: string) {
  const tk = Deno.env.get("SLACK_BOT_TOKEN"); const ch = Deno.env.get("SLACK_MYPAGE_CHANNEL") || "C0BER0YC6AK";
  if (!tk) return false;
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: ch, text }) }); return (await r.json()).ok === true; } catch { return false; }
}
async function label(resv: string) {
  try { const r = await fetch(`${SB}/rest/v1/rpc/hdm_resv_label`, { method: "POST", headers: H, body: JSON.stringify({ p_store: "spk", p_resv: resv }) }); return r.ok ? String(await r.json()) : resv; } catch { return resv; }
}
// 依頼1件に、担当（DEL/COLタスクの担当者）と予約の情報を付ける
async function enrich(c: any) {
  const tt = TT(c.field);
  const tasks = await get(`tasks?reservation_id=eq.${encodeURIComponent(c.reservation_id)}&select=id,type,date,time,assignee&order=date.desc`);
  const t = tasks.find((x: any) => String(x.type || "").toUpperCase().startsWith(tt)) || null;
  const r = (await get(`reservations?id=eq.${encodeURIComponent(c.reservation_id)}&select=name,lend_date,lend_time,return_date,return_time,del_place,col_place`))[0] || {};
  return { id: c.id, field: c.field, label: LABEL[c.field] || c.field, old: c.old_value || "", new: c.new_value || "", at: c.created_at, resv: c.reservation_id,
    cust: r.name || "", date: tt === "DEL" ? (r.lend_date || t?.date || "") : (r.return_date || t?.date || ""), kind: tt === "DEL" ? "お届け" : "回収",
    assignee: String(t?.assignee || "").trim() };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let b: any; try { b = await req.json(); } catch { return j({ ok: false, error: "bad json" }, 400); }
  const name = await me(String(b.token || ""));
  if (!name) return j({ ok: false, error: "invalid token" }, 403);
  if (b.action === "list") {
    const rows = await get(`mypage_changes?store=eq.spk&status=eq.requested&field=in.(${FIELDS.join(",")})&select=id,reservation_id,field,old_value,new_value,created_at&order=id.asc&limit=40`);
    const out = [];
    for (const c of rows) { const e = await enrich(c); if (!e.assignee || e.assignee === name) out.push({ ...e, mine: e.assignee === name }); }
    const inbox = await get(`staff_inbox?staff_name=eq.${encodeURIComponent(name)}&seen_at=is.null&select=id,kind,title,body,reservation_id,created_at&order=id.asc&limit=100`);
    return j({ ok: true, me: name, items: out, inbox });
  }
  // 未確認のお知らせを「確認しました」にする（本人の分だけ）
  if (b.action === "seen") {
    const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).map((x: any) => Number(x)).filter((x: number) => x > 0).slice(0, 100);
    if (!ids.length) return j({ ok: false }, 400);
    const r = await fetch(`${SB}/rest/v1/staff_inbox?id=in.(${ids.join(",")})&staff_name=eq.${encodeURIComponent(name)}&seen_at=is.null`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ seen_at: new Date().toISOString() }) });
    return j({ ok: r.ok });
  }
  if (b.action === "decide") {
    const cid = Number(b.change_id);
    const c = (await get(`mypage_changes?id=eq.${cid}&store=eq.spk&select=id,reservation_id,field,old_value,new_value,status,created_at`))[0];
    if (!c || !FIELDS.includes(c.field)) return j({ ok: false, error: "依頼が見つかりません" }, 404);
    if (c.status !== "requested") return j({ ok: false, error: "この依頼はもう処理されています" }, 409);
    const e = await enrich(c);
    if (e.assignee && e.assignee !== name) return j({ ok: false, error: `この依頼は${e.assignee}さんの担当です` }, 403);
    const lb = await label(c.reservation_id);
    const chg = `${e.label}：${e.old || "（なし）"} → ${e.new}`;
    if (b.decision === "approved") {
      const r = await fetch(`${SB}/functions/v1/handyman-mypage`, { method: "POST", headers: H, body: JSON.stringify({ action: "decide", admin_pin: Deno.env.get("ADMIN_PIN") || "", change_id: cid, decision: "approved" }) });
      const jr = await r.json().catch(() => ({}));
      if (!r.ok || !jr.ok) return j({ ok: false, error: jr.error || `承認できませんでした（${r.status}）` }, 500);
      await slack(`✅ ${name}さんが個別URLで承認しました（${e.kind}）\n${lb}\n${chg}`);
      return j({ ok: true, decision: "approved" });
    }
    if (b.decision === "consult") {
      const note = String(b.note || "").trim().slice(0, 200);
      const ok = await slack(`🆘 ${name}さん「この変更は難しい」→ 社員の対応をお願いします（アクションタブで返事）\n${lb}\n${chg}${note ? `\nひとこと：${note}` : ""}`);
      return j({ ok, decision: "consult" });
    }
    return j({ ok: false, error: "decision 不正" }, 400);
  }
  return j({ ok: false, error: "unknown action" }, 400);
});
