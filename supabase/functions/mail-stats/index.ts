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
      // 2026-11-09 楽天の画面から送ったメール（rax_outbox の送信済み。Mac mini rax_line_mail.py が送る）
      const rx = await getAll(SB_URL, SB_KEY, `rax_outbox?sent_at=gte.${since}&status=eq.sent&store=in.(spk,nha)&select=store,resv_no,kind,sent_at`);
      for (const r of rx) sends.push({ store: String(r.store), ch: "mail", kind: String(r.kind || ""), rid: String(r.resv_no), at: Date.parse(r.sent_at) });
      const ev = await getAll(SB_URL, SB_KEY, `mypage_events?created_at=gte.${since}&event=eq.page_view&page=eq.mypage&store=in.(spk,nha)&reservation_id=not.is.null&select=store,reservation_id,created_at`);
      for (const e of ev) addView(`${e.store}|${e.reservation_id}`, Date.parse(e.created_at));
    } else {
      const tn = await getAll(SB_URL, SB_KEY, `hdm_tkm_notifications?created_at=gte.${since}&sent=eq.true&select=reservation_id,kind,sent_at`);
      for (const r of tn) sends.push({ store: "tkm", ch: "mail", kind: String(r.kind || ""), rid: String(r.reservation_id), at: Date.parse(r.sent_at) });
      if (MAIN_KEY) { // 2026-11-09 楽天の画面から送ったメール（記録は main）
        const rx = await getAll(MAIN_URL, MAIN_KEY, `rax_outbox?sent_at=gte.${since}&status=eq.sent&store=eq.tkm&select=resv_no,kind,sent_at`);
        for (const r of rx) sends.push({ store: "tkm", ch: "mail", kind: String(r.kind || ""), rid: String(r.resv_no), at: Date.parse(r.sent_at) });
      }
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
    const FIRST = new Set(["mail_welcome", "mail_confirm", "welcome", "mypage_initial", "rax_welcome"]);
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

    // ===== LINE脱却KPI（2026-11-10 nosh「アクティブ率は今後の指標」「LINE問い合わせ数を検証」「チャット利用率も追加」） =====
    // 日ごと（JST・直近14日）：
    //   active … 出発3日前〜返却日の予約のうち、その日マイページを開いた予約（スタッフ閲覧 ro=1 は除く）
    //   chat   … その日「スタッフに聞く」で自分から書いたお客様の人数（【〜】で始まるボタン送信は除く）
    //   line   … その日エルメでお客様から発言があった人数（erume_chat_log。取り込んだ日まで）
    //   チャット利用率＝chat ÷ (chat＋line)（画面で計算）
    const SD = Math.min(Math.max(Number(p.kpi_days) || 14, 7), 30); // 画面から 7〜30日
    const sDays = Array.from({ length: SD }, (_, i) => addD(jstToday, i - SD)); // 昨日まで（今日は途中なので入れない）
    const sFrom = sDays[0];
    const shift: Record<string, any> = {};
    for (const st of stores) shift[st] = { active: sDays.map(() => ({ n: 0, ok: 0 })), chat: sDays.map(() => 0), line: sDays.map(() => null as number | null), line_b: sDays.map(() => null as number | null), line_n: sDays.map(() => null as number | null) };
    const jd = (t: string) => new Date(Date.parse(t) + 9 * 3600000).toISOString().slice(0, 10);
    const evSince = new Date(Date.parse(sFrom + "T00:00:00+09:00")).toISOString();
    type W = { store: string; key: string; sd: string; ed: string };
    const wr: W[] = [];
    if (!IS_BT) {
      for (const [st, tb, sc, ec] of [["spk", "reservations", "lend_date", "return_date"], ["nha", "nha_reservations", "start_date", "end_date"]]) {
        const rs = await getAll(SB_URL, SB_KEY, `${tb}?${ec}=gte.${sFrom}&${sc}=lte.${addD(jstToday, 3)}&select=id,${sc},${ec},status,mypage_token`);
        for (const x of rs) if (live(x)) wr.push({ store: st, key: String(x.id), sd: String(x[sc] || "").slice(0, 10), ed: String(x[ec] || "").slice(0, 10) });
      }
      const ev = await getAll(SB_URL, SB_KEY, `mypage_events?created_at=gte.${evSince}&event=eq.page_view&store=in.(spk,nha)&reservation_id=not.is.null&select=store,reservation_id,created_at,meta`);
      const seen = new Set<string>();
      for (const e of ev) { if (e.meta && String(e.meta.ro || "") === "1") continue; seen.add(`${e.store}|${e.reservation_id}|${jd(e.created_at)}`); }
      for (const w of wr) sDays.forEach((d, i) => { if (d >= addD(w.sd, -3) && d <= w.ed) { shift[w.store].active[i].n++; if (seen.has(`${w.store}|${w.key}|${d}`)) shift[w.store].active[i].ok++; } });
      // LINE（エルメ）：沖縄＝那覇、札幌＝札幌
      const el = await getAll(SB_URL, SB_KEY, `erume_chat_log?sent_at=gte.${evSince}&sender_type=eq.${encodeURIComponent("友だち")}&account=in.(okinawa,sapporo)&select=account,friend_id,friend_name,sent_at,body`).catch(() => []);
      const lmax = await getAll(SB_URL, SB_KEY, `erume_chat_log?account=in.(okinawa,sapporo)&select=sent_at&order=sent_at.desc&limit=1`, 1).catch(() => []);
      const lineThrough = lmax[0] ? jd(lmax[0].sent_at) : null;
      const lp: Record<string, Set<string>> = {};
      // 2026-11-10 予約済みのお客様／予約前の新規の方 を分ける（nosh「LINE問い合わせ数を検証」・11/9 台湾からの新規が急増したため）
      //   エルメの友だち名（お客様の登録名）が、LINEをつないだ予約の名前（*_line_links.cust_name）か予約の名前と同じなら「予約済み」。空白は無視
      const nz = (x: unknown) => String(x || "").replace(/\s/g, "");
      const booked: Record<string, Set<string>> = { nha: new Set(), spk: new Set() };
      const fname: Record<string, string> = {};
      for (const x of el) fname[`${x.account}|${x.friend_id}`] = nz(x.friend_name);
      if (el.length) {
        for (const [st, lk, tb, nc, ec] of [["nha", "nha_line_links", "nha_reservations", "name", "end_date"], ["spk", "spk_line_links", "reservations", "name", "return_date"]]) {
          for (const r of await getAll(SB_URL, SB_KEY, `${lk}?select=cust_name`).catch(() => [])) if (nz(r.cust_name)) booked[st].add(nz(r.cust_name));
          for (const r of await getAll(SB_URL, SB_KEY, `${tb}?${ec}=gte.${addD(sFrom, -60)}&select=${nc}`).catch(() => [])) if (nz(r[nc])) booked[st].add(nz(r[nc]));
        }
      }
      const lpB: Record<string, Set<string>> = {};
      // メニューのボタン（【新規予約】等）・言語えらび・スタンプ・4文字未満は「問い合わせ」に数えない（11/9 新しい友だち117人のボタン押しで膨らんだため）
      const NOTQ = /^\s*[（(【]?\s*(【|🇹🇼|中文|繁體|English|한국어|你好|スタンプを送信)/;
      for (const x of el) { if (NOTQ.test(String(x.body || "")) || String(x.body || "").length < 4) continue; const st = x.account === "okinawa" ? "nha" : "spk"; const k = `${st}|${jd(x.sent_at)}`; (lp[k] = lp[k] || new Set()).add(String(x.friend_id)); if (booked[st].has(fname[`${x.account}|${x.friend_id}`] || "-")) (lpB[k] = lpB[k] || new Set()).add(String(x.friend_id)); }
      for (const st of ["spk", "nha"]) sDays.forEach((d, i) => { if (lineThrough && d < lineThrough) { const all = (lp[`${st}|${d}`] || new Set()).size, b = (lpB[`${st}|${d}`] || new Set()).size; shift[st].line[i] = all; shift[st].line_b[i] = b; shift[st].line_n[i] = all - b; } });
      for (const st of stores) shift[st].line_through = lineThrough;
    } else if (MAIN_KEY) {
      const rs = await getAll(SB_URL, SB_KEY, `bt_reservations?brand=eq.HDM&end_date=gte.${sFrom}&start_date=lte.${addD(jstToday, 3)}&select=id,start_date,end_date,status,mypage_token`);
      for (const x of rs) if (live(x) && x.mypage_token) wr.push({ store: "tkm", key: String(x.mypage_token), sd: String(x.start_date || "").slice(0, 10), ed: String(x.end_date || "").slice(0, 10) });
      const ev = await getAll(MAIN_URL, MAIN_KEY, `mypage_events?created_at=gte.${evSince}&event=eq.page_view&store=eq.tkm&select=token,created_at,meta`);
      const seen = new Set<string>();
      for (const e of ev) { if (e.meta && String(e.meta.ro || "") === "1") continue; seen.add(`${e.token}|${jd(e.created_at)}`); }
      for (const w of wr) sDays.forEach((d, i) => { if (d >= addD(w.sd, -3) && d <= w.ed) { shift.tkm.active[i].n++; if (seen.has(`${w.key}|${d}`)) shift.tkm.active[i].ok++; } });
      shift.tkm.line_through = null; // 高松はLINEなし
    }
    // チャット（cs_chat は main にある）
    if (MAIN_KEY) {
      const th = await getAll(MAIN_URL, MAIN_KEY, `cs_chat_threads?store=in.(${stores.join(",")})&last_msg_at=gte.${evSince}&select=id,store`).catch(() => []);
      const t2s: Record<string, string> = {}; for (const t of th) t2s[String(t.id)] = String(t.store);
      const ids = Object.keys(t2s);
      const cp: Record<string, Set<string>> = {};
      for (let i = 0; i < ids.length; i += 150) {
        const ms = await getAll(MAIN_URL, MAIN_KEY, `cs_chat_messages?thread_id=in.(${encodeURIComponent(ids.slice(i, i + 150).join(","))})&sender=eq.customer&created_at=gte.${evSince}&select=thread_id,body,created_at`).catch(() => []);
        for (const m of ms) { if (/^【/.test(String(m.body || ""))) continue; const st = t2s[String(m.thread_id)]; const k = `${st}|${jd(m.created_at)}`; (cp[k] = cp[k] || new Set()).add(String(m.thread_id)); }
      }
      for (const st of stores) sDays.forEach((d, i) => { shift[st].chat[i] = (cp[`${st}|${d}`] || new Set()).size; });
      // 2026-11-10 AI案をそのまま使えた割合（AI回答スレッドの依頼。nosh「次のアクションはAI回答自動化」）
      //   cs_chat_drafts の案ごとに：status=approved か、案のあとチャットで最初にスタッフが送った文が案と同じ→そのまま(ai_same)
      //   違う文を送った→直して送信(ai_edit)／スタッフのチャット返信なし→ai_none。【〜】で始まる質問・40字未満のお礼/了解/画像だけ は返事不要として数えない
      for (const st of stores) { shift[st].ai_same = sDays.map(() => 0); shift[st].ai_edit = sDays.map(() => 0); shift[st].ai_none = sDays.map(() => 0); }
      const dr = await getAll(MAIN_URL, MAIN_KEY, `cs_chat_drafts?store=in.(${stores.join(",")})&created_at=gte.${evSince}&select=store,thread_id,question,draft,status,created_at`).catch(() => []);
      const NOREPLY = /(ありがと|有難|了解|承知|わかりました|分かりました|OK|ok|thank|謝謝|感謝|好的|画像|写真|スタンプ|📷|🙏|👍)/i;
      const want = dr.filter((x) => { const q = String(x.question || "").trim(); if (/^【/.test(q)) return false; if (q.length < 40 && (NOREPLY.test(q) || !q)) return false; return true; });
      const tids = [...new Set(want.map((x) => String(x.thread_id || "")).filter(Boolean))];
      const staff: Record<string, { at: number; body: string }[]> = {};
      for (let i = 0; i < tids.length; i += 150) {
        const ms = await getAll(MAIN_URL, MAIN_KEY, `cs_chat_messages?thread_id=in.(${encodeURIComponent(tids.slice(i, i + 150).join(","))})&sender=eq.staff&created_at=gte.${evSince}&select=thread_id,body,created_at&order=created_at.asc`).catch(() => []);
        for (const m of ms) (staff[String(m.thread_id)] = staff[String(m.thread_id)] || []).push({ at: Date.parse(m.created_at), body: String(m.body || "") });
      }
      const nb = (x: string) => x.replace(/\s/g, "");
      for (const x of want) {
        const i = sDays.indexOf(jd(x.created_at)); if (i < 0 || !shift[x.store]) continue;
        const t0 = Date.parse(x.created_at), first = (staff[String(x.thread_id)] || []).find((m) => m.at >= t0);
        if (x.status === "approved" || (first && nb(first.body) === nb(String(x.draft || "")))) shift[x.store].ai_same[i]++;
        else if (first) shift[x.store].ai_edit[i]++;
        else shift[x.store].ai_none[i]++;
      }
    }
    return J({ ok: true, days, kpi: { wins, k1, k2 }, shift: { days: sDays, stores: shift }, todo, rows: Object.values(agg), unopened, people: Object.keys(lastSend).length, track_since: isFinite(trackSince) ? new Date(trackSince).toISOString() : null });
  } catch (e) {
    return J({ ok: false, error: String(e) }, 500);
  }
});
