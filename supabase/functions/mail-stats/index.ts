// mail-stats : 通知の開封率（通知の種類別×店舗別）をマイページ管理の「開封率」タブへ返す
// 2026-11-09 nosh「通知別の開封率を店舗別に可視化できるものをマイページ管理に新タブで」
// main（札幌・那覇）と BT（高松）に同じコードを置く。POST {admin_pin, days} → {ok, rows, unopened, track_since}
//   送った数 … 送信記録（{spk,nha}_line_sends の mailed=メール/sent=LINE、hdm_notifications、hdm_tkm_notifications）
//   開封     … メール内の開封の印が読まれた（mail-track・計測開始後に送ったメールだけ）
//   クリック … メール内のリンクが押された（mail-track）
//   24時間以内にマイページ … 送ってから24時間以内に、その予約のマイページが開かれた（どの経路でも。LINEも同じ物差し）
// 読むだけ。予約・タスクの値には触らない。
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const IS_BT = SB_URL.includes("ggqugvyskyiblxiycpci");
const MAIN_URL = "https://ckrxttbnawkclshczsia.supabase.co";
const MAIN_KEY = IS_BT ? (Deno.env.get("MAIN_SERVICE") || "") : SB_KEY;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const DAY = 86400000;

async function getAll(base: string, key: string, path: string, max = 50000): Promise<any[]> {
  const out: any[] = [];
  for (let off = 0; off < max; off += 1000) {
    const r = await fetch(`${base}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${off}-${off + 999}`, "Range-Unit": "items" } });
    if (!r.ok) throw new Error(`${path.split("?")[0]} ${r.status} ${(await r.text()).slice(0, 200)}`);
    const a = await r.json(); out.push(...a);
    if (a.length < 1000) break;
  }
  return out;
}
const norm = (k: string) => String(k || "").replace(/_20\d{6}$/, "");
type Send = { store: string; ch: "mail" | "line"; kind: string; rid: string; at: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const p = await req.json().catch(() => ({}));
    const PIN = Deno.env.get("ADMIN_PIN") || "";
    if (!PIN || String(p.admin_pin || "") !== PIN) return J({ ok: false, error: "pin" }, 401);
    const days = Math.min(Math.max(Number(p.days) || 14, 1), 60);
    const fetchDays = Math.max(days, 28); // KPI は直近4週を見る
    const since = new Date(Date.now() - fetchDays * DAY).toISOString();
    const rowsFrom = Date.now() - days * DAY;
    const sends: Send[] = [];
    const views: Record<string, number[]> = {};   // store|rid → 開いた時刻
    const addView = (k: string, t: number) => { (views[k] = views[k] || []).push(t); };

    if (!IS_BT) {
      for (const st of ["spk", "nha"]) {
        const rows = await getAll(SB_URL, SB_KEY, `${st}_line_sends?sent_at=gte.${since}&status=in.(mailed,sent)&select=resv_no,action,status,sent_at`);
        for (const r of rows) {
          const a = String(r.action || "");
          if (/^(track_|overdue_alert$|mypage_manual_done$)/.test(a)) continue; // スタッフ向け・記録用
          sends.push({ store: st, ch: r.status === "mailed" ? "mail" : "line", kind: norm(a), rid: String(r.resv_no), at: Date.parse(r.sent_at) });
        }
      }
      const hn = await getAll(SB_URL, SB_KEY, `hdm_notifications?created_at=gte.${since}&sent=eq.true&is_test=is.false&select=store,resv_no,action,sent_at`);
      for (const r of hn) sends.push({ store: String(r.store), ch: "mail", kind: "btn_" + String(r.action || ""), rid: String(r.resv_no), at: Date.parse(r.sent_at) });
      const ev = await getAll(SB_URL, SB_KEY, `mypage_events?created_at=gte.${since}&event=eq.page_view&page=eq.mypage&store=in.(spk,nha)&reservation_id=not.is.null&select=store,reservation_id,created_at`);
      for (const e of ev) addView(`${e.store}|${e.reservation_id}`, Date.parse(e.created_at));
    } else {
      const tn = await getAll(SB_URL, SB_KEY, `hdm_tkm_notifications?created_at=gte.${since}&sent=eq.true&select=reservation_id,kind,sent_at`);
      for (const r of tn) sends.push({ store: "tkm", ch: "mail", kind: String(r.kind || ""), rid: String(r.reservation_id), at: Date.parse(r.sent_at) });
      // 高松の閲覧記録は予約番号が空 → トークンで予約へ戻す
      const rids = [...new Set(sends.map((s) => s.rid))];
      const tok2rid: Record<string, string> = {};
      for (let i = 0; i < rids.length; i += 200) {
        const part = rids.slice(i, i + 200).map((x) => `"${x.replace(/"/g, "")}"`).join(",");
        const rs = await getAll(SB_URL, SB_KEY, `bt_reservations?id=in.(${encodeURIComponent(part)})&select=id,mypage_token`);
        for (const r of rs) if (r.mypage_token) tok2rid[String(r.mypage_token)] = String(r.id);
      }
      if (MAIN_KEY) {
        const ev = await getAll(MAIN_URL, MAIN_KEY, `mypage_events?created_at=gte.${since}&event=eq.page_view&page=eq.mypage&store=eq.tkm&select=token,created_at`);
        for (const e of ev) { const rid = tok2rid[String(e.token || "")]; if (rid) addView(`tkm|${rid}`, Date.parse(e.created_at)); }
      }
    }
    // 開封・クリック（どちらの記録も main にある）
    const stores = IS_BT ? ["tkm"] : ["spk", "nha"];
    const tr = MAIN_KEY ? await getAll(MAIN_URL, MAIN_KEY, `mail_track_events?created_at=gte.${since}&store=in.(${stores.join(",")})&select=ev,store,kind,resv_no,created_at`).catch(() => []) : [];
    let trackSince = Infinity;
    const opened = new Set<string>(), clicked = new Set<string>();
    for (const t of tr) {
      const k = `${t.store}|${norm(t.kind)}|${t.resv_no}`;
      (t.ev === "open" ? opened : clicked).add(k);
      if (t.ev === "click") opened.add(k); // 押した＝開いた
      trackSince = Math.min(trackSince, Date.parse(t.created_at));
    }
    const TRACK_FROM = Date.parse(Deno.env.get("MAIL_TRACK_FROM") || "2026-11-09T00:00:00+09:00");

    const agg: Record<string, any> = {};
    for (const s of sends) {
      if (!isFinite(s.at) || s.at < rowsFrom) continue;
      const key = `${s.store}|${s.ch}|${s.kind}`;
      const a = agg[key] || (agg[key] = { store: s.store, ch: s.ch, kind: s.kind, sent: 0, tracked: 0, open: 0, click: 0, mp24: 0, last: 0 });
      a.sent++; a.last = Math.max(a.last, s.at);
      const vs = views[`${s.store}|${s.rid}`] || [];
      if (vs.some((t) => t >= s.at - 60000 && t <= s.at + DAY)) a.mp24++;
      if (s.ch === "mail" && s.at >= TRACK_FROM) {
        a.tracked++;
        const k = `${s.store}|${s.kind}|${s.rid}`;
        if (opened.has(k)) a.open++;
        if (clicked.has(k)) a.click++;
      }
    }
    // 未開封の人（追いかけ用）：直近に通知を送ったのに、送ってからマイページを1度も開いていない予約
    const lastSend: Record<string, Send> = {};
    for (const s of sends) { const k = `${s.store}|${s.rid}`; if (!lastSend[k] || lastSend[k].at < s.at) lastSend[k] = s; }
    const firstSend: Record<string, number> = {};
    for (const s of sends) { const k = `${s.store}|${s.rid}`; firstSend[k] = Math.min(firstSend[k] ?? Infinity, s.at); }
    const unopened: Record<string, { n: number; mailOnly: number }> = {};
    const lineRid = new Set(sends.filter((s) => s.ch === "line").map((s) => `${s.store}|${s.rid}`));
    for (const k of Object.keys(lastSend)) {
      const st = k.split("|")[0];
      const u = unopened[st] || (unopened[st] = { n: 0, mailOnly: 0 });
      const vs = views[k] || [];
      if (!vs.some((t) => t >= firstSend[k] - 60000)) { u.n++; if (!lineRid.has(k)) u.mailOnly++; }
    }

    // ===== KPI（PDCA用・2026-11-09 nosh「主要KPIをまとめてTODOに」「PDCA」） =====
    // K1 初回の案内 → 24時間以内にマイページ（週ごと）／K2 出発前日までにマイページを開いた予約（週ごと）／K3 出発3日以内で一度も開いていない＝今日やること
    const jstToday = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const addD = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
    const wins = [0, 1, 2, 3].map((k) => ({ from: addD(jstToday, -7 * k - 6), to: addD(jstToday, -7 * k) })); // 0=今週(直近7日) 1=先週…
    const FIRST = new Set(["mail_welcome", "mail_confirm", "welcome", "mypage_initial"]);
    const k1: Record<string, { n: number; ok: number }[]> = {};
    for (const st of stores) k1[st] = wins.map(() => ({ n: 0, ok: 0 }));
    for (const s of sends) {
      if (!FIRST.has(s.kind) || !k1[s.store]) continue;
      const d = new Date(s.at + 9 * 3600000).toISOString().slice(0, 10);
      const wi = wins.findIndex((w) => d >= w.from && d <= w.to); if (wi < 0) continue;
      k1[s.store][wi].n++;
      const vs = views[`${s.store}|${s.rid}`] || [];
      if (vs.some((t) => t >= s.at - 60000 && t <= s.at + DAY)) k1[s.store][wi].ok++;
    }
    // 予約（出発が4週前〜3日後）
    type R = { store: string; rid: string; name: string; d: string; t: string; ota: string; tel: boolean; mail: boolean; token: string };
    const resv: R[] = [];
    const dFrom = wins[3].from, dTo = addD(jstToday, 3);
    const live = (x: any) => !/cancel|キャンセル/i.test(String(x.status || ""));
    if (!IS_BT) {
      for (const [st, tb, dc, tc] of [["spk", "reservations", "lend_date", "lend_time"], ["nha", "nha_reservations", "start_date", "start_time"]]) {
        const rs = await getAll(SB_URL, SB_KEY, `${tb}?${dc}=gte.${dFrom}&${dc}=lte.${dTo}&select=id,name,${dc},${tc},ota,tel,mail,status,mypage_token`);
        for (const x of rs) if (live(x)) resv.push({ store: st, rid: String(x.id), name: String(x.name || ""), d: String(x[dc] || "").slice(0, 10), t: String(x[tc] || ""), ota: String(x.ota || ""), tel: !!x.tel, mail: !!(x.mail && String(x.mail).includes("@")), token: String(x.mypage_token || "") });
      }
    } else {
      const rs = await getAll(SB_URL, SB_KEY, `bt_reservations?brand=eq.HDM&start_date=gte.${dFrom}&start_date=lte.${dTo}&select=id,name,start_date,start_time,pickup_time,ota,tel,mail,status,mypage_token`);
      for (const x of rs) if (live(x)) resv.push({ store: "tkm", rid: String(x.id), name: String(x.name || ""), d: String(x.start_date || "").slice(0, 10), t: String(x.pickup_time || x.start_time || ""), ota: String(x.ota || ""), tel: !!x.tel, mail: !!(x.mail && String(x.mail).includes("@")), token: String(x.mypage_token || "") });
    }
    // その予約のマイページ閲覧（期間を区切らず）
    const everV: Record<string, number[]> = {};
    if (!IS_BT) {
      for (const st of ["spk", "nha"]) {
        const ids = resv.filter((r) => r.store === st).map((r) => r.rid);
        for (let i = 0; i < ids.length; i += 150) {
          const part = ids.slice(i, i + 150).map((x) => `"${x.replace(/"/g, "")}"`).join(",");
          const ev = await getAll(SB_URL, SB_KEY, `mypage_events?event=eq.page_view&page=eq.mypage&store=eq.${st}&reservation_id=in.(${encodeURIComponent(part)})&select=reservation_id,created_at`);
          for (const e of ev) (everV[`${st}|${e.reservation_id}`] = everV[`${st}|${e.reservation_id}`] || []).push(Date.parse(e.created_at));
        }
      }
    } else if (MAIN_KEY) {
      const t2r: Record<string, string> = {}; for (const r of resv) if (r.token) t2r[r.token] = r.rid;
      const toks = Object.keys(t2r);
      for (let i = 0; i < toks.length; i += 150) {
        const part = toks.slice(i, i + 150).map((x) => `"${x.replace(/"/g, "")}"`).join(",");
        const ev = await getAll(MAIN_URL, MAIN_KEY, `mypage_events?event=eq.page_view&page=eq.mypage&store=eq.tkm&token=in.(${encodeURIComponent(part)})&select=token,created_at`);
        for (const e of ev) { const rid = t2r[String(e.token)]; if (rid) (everV[`tkm|${rid}`] = everV[`tkm|${rid}`] || []).push(Date.parse(e.created_at)); }
      }
    }
    const k2: Record<string, { n: number; ok: number }[]> = {};
    for (const st of stores) k2[st] = wins.map(() => ({ n: 0, ok: 0 }));
    const todo: any[] = [];
    const lineSet = new Set(sends.filter((s) => s.ch === "line").map((s) => `${s.store}|${s.rid}`));
    if (!IS_BT) { // LINEをつないでいる人（line_links）
      for (const st of ["spk", "nha"]) {
        const ids = resv.filter((r) => r.store === st && r.d >= jstToday).map((r) => `"${r.rid.replace(/"/g, "")}"`);
        for (let i = 0; i < ids.length; i += 150) {
          const lk = await getAll(SB_URL, SB_KEY, `${st}_line_links?resv_no=in.(${encodeURIComponent(ids.slice(i, i + 150).join(","))})&line_user_id=not.is.null&select=resv_no`).catch(() => []);
          for (const x of lk) lineSet.add(`${st}|${x.resv_no}`);
        }
      }
    }
    for (const r of resv) {
      const vs = everV[`${r.store}|${r.rid}`] || [];
      const wi = wins.findIndex((w) => r.d >= w.from && r.d <= w.to);
      if (wi >= 0 && k2[r.store]) {
        k2[r.store][wi].n++;
        const dep = Date.parse(r.d + "T00:00:00+09:00");
        if (vs.some((t) => t < dep)) k2[r.store][wi].ok++;
      }
      if (r.d >= jstToday && r.d <= dTo && !vs.length) {
        const ls = sends.filter((s) => s.store === r.store && s.rid === r.rid).sort((a, b) => b.at - a.at);
        todo.push({ store: r.store, rid: r.rid, name: r.name, d: r.d, t: r.t, ota: r.ota, tel: r.tel, mail: r.mail, line: lineSet.has(`${r.store}|${r.rid}`), sent: ls.length, last: ls[0] ? ls[0].kind : null });
      }
    }
    todo.sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
    return J({ ok: true, days, kpi: { wins, k1, k2 }, todo, rows: Object.values(agg), unopened, people: Object.keys(lastSend).length, track_since: isFinite(trackSince) ? new Date(trackSince).toISOString() : null });
  } catch (e) {
    return J({ ok: false, error: String(e) }, 500);
  }
});
