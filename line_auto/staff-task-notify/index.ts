// Supabase Edge Function: staff-task-notify (SPK専用)
// 札幌スタッフのタスク担当付け外しを spk_staff_task_notify(キュー) から拾い、LINEで本人に通知。
//  - instant型(三國/高橋/長谷川): 変更を即時push（付=タスク依頼 / 外=タスク調整）
//  - hourly型(武山瞳/三木/加藤/えりちゃん): 1hまとめ・staff×日で最新状態のみ・付いて→外れは相殺(通知しない)
//  - test: body.staff[] に直接テスト送信（キュー無視）
//  - announce: body.staff[] へ body.message を1人1通送信（キュー無視・任意お知らせ用）
// body: { secret, mode:'instant'|'hourly'|'test'|'announce', staff?:string[], message?:string }
// deploy: functions deploy staff-task-notify --no-verify-jwt   secrets: LINE_CHANNEL_TOKEN, FUNC_SECRET
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNC_SECRET = Deno.env.get("FUNC_SECRET")!;
const LINE_TOKEN = Deno.env.get("LINE_CHANNEL_TOKEN") || "";
const APP_URL = "https://nosh2318.github.io/spk-task/";
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
function json(o: unknown, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } }); }
async function sbGet(p: string) { const r = await fetch(`${SB_URL}/rest/v1/${p}`, { headers: H }); return r.ok ? await r.json() : []; }
async function sbPatch(p: string, b: unknown) { await fetch(`${SB_URL}/rest/v1/${p}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(b) }); }
function mmdd(d: string) { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[2]}/${+m[3]}` : String(d || ""); }
async function push(to: string, text: string) {
  if (!LINE_TOKEN) return { ok: false, err: "no_line_token" };
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
  return r.ok ? { ok: true } : { ok: false, err: (await r.text()).slice(0, 200) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  let body: any; try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
  if (body.secret !== FUNC_SECRET) return json({ ok: false, error: "unauthorized" }, 401);
  const mode = String(body.mode || "instant");

  // === テスト送信（キュー無視・指定スタッフへ直接） ===
  if (mode === "test") {
    const names: string[] = Array.isArray(body.staff) ? body.staff : [];
    const links = await sbGet(`spk_staff_line_links?select=staff_name,line_user_id`);
    const norm = (s: string) => String(s || "").replace(/さん$/, "").trim();
    const out: any[] = [];
    for (const n of names) {
      const l = links.find((x: any) => norm(x.staff_name) === norm(n));
      if (!l?.line_user_id) { out.push({ staff: n, ok: false, reason: "no_userid" }); continue; }
      const r = await push(l.line_user_id, `【テスト送信】\nHANDYMAN札幌 タスク通知の接続確認です。\nこの通知が届いていれば設定完了です。🔗\n${APP_URL}`);
      out.push({ staff: n, ...r });
    }
    return json({ ok: true, mode: "test", results: out });
  }

  // === announce: 指定スタッフへ任意メッセージを1人1通送信（キュー無視） ===
  // body: { secret, mode:'announce', staff:string[], message:string }
  if (mode === "announce") {
    const names: string[] = Array.isArray(body.staff) ? body.staff : [];
    const message = String(body.message || "").trim();
    if (!message) return json({ ok: false, error: "no message" }, 400);
    if (!names.length) return json({ ok: false, error: "no staff" }, 400);
    const links = await sbGet(`spk_staff_line_links?select=staff_name,line_user_id`);
    const norm = (s: string) => String(s || "").replace(/さん$/, "").trim();
    const out: any[] = [];
    const seen = new Set<string>();
    for (const n of names) {
      const l = links.find((x: any) => norm(x.staff_name) === norm(n));
      if (!l?.line_user_id) { out.push({ staff: n, ok: false, reason: "no_userid" }); continue; }
      if (seen.has(l.line_user_id)) { out.push({ staff: n, ok: false, reason: "duplicate_uid_skipped" }); continue; }
      seen.add(l.line_user_id);
      const r = await push(l.line_user_id, message);
      out.push({ staff: n, uid: l.line_user_id.slice(0, 10) + "…", ...r });
    }
    return json({ ok: true, mode: "announce", sent: out.filter((x) => x.ok).length, results: out });
  }

  // === instant: 未送信のinstant行を staff×日 でまとめて即時通知 ===
  if (mode === "instant") {
    const rows = await sbGet(`spk_staff_task_notify?sent=eq.false&notify_type=eq.instant&select=*&order=created_at.asc`);
    const grp: Record<string, any> = {};
    for (const r of rows) { const k = `${r.staff_name}|${r.work_date}`; if (!grp[k]) grp[k] = { ids: [], list: [], line_user_id: r.line_user_id, staff: r.staff_name, date: r.work_date }; grp[k].ids.push(r.id); grp[k].list.push(r); }
    const out: any[] = [];
    for (const k of Object.keys(grp)) {
      const g = grp[k]; const last = g.list[g.list.length - 1];
      const d = mmdd(g.date);
      const text = last.action === "assign" ? `${d} タスク依頼がありました 🔗\n${APP_URL}` : `${d} タスク調整がありました\n${APP_URL}`;
      let res = { ok: false, err: "no_userid" } as any;
      if (g.line_user_id) res = await push(g.line_user_id, text);
      await sbPatch(`spk_staff_task_notify?id=in.(${g.ids.join(",")})`, { sent: true, sent_at: new Date().toISOString() });
      out.push({ staff: g.staff, date: d, action: last.action, ...res });
    }
    return json({ ok: true, mode: "instant", groups: out.length, results: out });
  }

  // === hourly: 未送信のhourly行を staff×日 で集約・最新状態のみ・相殺(付→外で純ゼロ)は送らない ===
  if (mode === "hourly") {
    const rows = await sbGet(`spk_staff_task_notify?sent=eq.false&notify_type=eq.hourly&select=*&order=created_at.asc`);
    const grp: Record<string, any> = {};
    for (const r of rows) { const k = `${r.staff_name}|${r.work_date}`; if (!grp[k]) grp[k] = { ids: [], list: [], line_user_id: r.line_user_id, staff: r.staff_name, date: r.work_date }; grp[k].ids.push(r.id); grp[k].list.push(r); }
    const out: any[] = [];
    for (const k of Object.keys(grp)) {
      const g = grp[k]; const d = mmdd(g.date);
      const first = g.list[0].action, last = g.list[g.list.length - 1].action;
      const hasAssign = g.list.some((x: any) => x.action === "assign");
      const hasUnassign = g.list.some((x: any) => x.action === "unassign");
      let text = ""; let skip = false;
      if (first === "assign" && last === "unassign") { skip = true; }        // 付いて→外れ＝相殺
      else if (last === "assign") text = `${d} 出勤依頼 スタッフリンク確認ください 🔗\n${APP_URL}`;
      else if (last === "unassign") text = `${d} 出勤不要になりました`;
      if (hasAssign && hasUnassign && !skip && last === "assign") text = `${d} タスク調整がありました 🔗\n${APP_URL}`;
      let res: any = { skipped: true };
      if (!skip && text) { res = g.line_user_id ? await push(g.line_user_id, text) : { ok: false, err: "no_userid" }; }
      await sbPatch(`spk_staff_task_notify?id=in.(${g.ids.join(",")})`, { sent: true, sent_at: new Date().toISOString() });
      out.push({ staff: g.staff, date: d, net: skip ? "cancelled_out" : last, ...res });
    }
    return json({ ok: true, mode: "hourly", groups: out.length, results: out });
  }
  return json({ ok: false, error: "unknown mode" }, 400);
});
