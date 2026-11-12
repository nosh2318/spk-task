// line-kpi : LINE問い合わせ「マイページ前の平均」と「切替後の毎日の積み上げ」を返す（main のみ・読むだけ）
// 2026-11-12 nosh「マイページ前の平均を出しておいて、マイページ後は毎日の日々の積み立て」「マイページ対応に常にデータ出して」
// 画面：マイページ対応 → 利用実態（dashboard.html）の一番上のカード
// POST {admin_pin} → {ok, cut, pre_from, pre_to, line_through, stores:{nha|spk:{pre:{days,all,b}, post:[{d,all,b,cum_all,cum_b,cars}]}}}
//   数え方は mail-stats の「LINE問い合わせ」と同じ：その日エルメでお客様から書いてきた人数。
//   メニューのボタン（【〜】）・言語えらび・スタンプ・4文字未満は数えない。
//   b＝予約済みのお客様（エルメの友だち名が LINE をつないだ予約の名前・予約の名前と同じ）。all＝予約前の新規も含む全員。
//   cars＝その日に貸出中の台数（季節の増減を見るため）。
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const DAY = 86400000;
// 新マイページに切り替えた日（dashboard.html の CUT と同じ）と、比べる「前」の期間（切替前の90日）
const CUT = "2026-11-09";
const PRE_DAYS = 90;

async function getAll(path: string, max = 100000): Promise<any[]> {
  const out: any[] = [];
  for (let off = 0; off < max; off += 1000) {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Range: `${off}-${off + 999}`, "Range-Unit": "items" } });
    if (!r.ok) throw new Error(`${path.split("?")[0]} ${r.status} ${(await r.text()).slice(0, 200)}`);
    const a = await r.json(); out.push(...a);
    if (a.length < 1000) break;
  }
  return out;
}
const addD = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const jd = (t: string) => new Date(Date.parse(t) + 9 * 3600000).toISOString().slice(0, 10);
const nz = (x: unknown) => String(x || "").replace(/\s/g, "");
const NOTQ = /^\s*[（(【]?\s*(【|🇹🇼|中文|繁體|English|한국어|你好|スタンプを送信)/;
const r1 = (x: number) => Math.round(x * 10) / 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const p = await req.json().catch(() => ({}));
    const PIN = Deno.env.get("ADMIN_PIN") || "";
    if (!PIN || String(p.admin_pin || "") !== PIN) return J({ ok: false, error: "pin" }, 401);
    const preFrom = addD(CUT, -PRE_DAYS), preTo = addD(CUT, -1);
    const since = new Date(Date.parse(preFrom + "T00:00:00+09:00")).toISOString();
    const el = await getAll(`erume_chat_log?sent_at=gte.${since}&sender_type=eq.${encodeURIComponent("友だち")}&account=in.(okinawa,sapporo)&select=account,friend_id,friend_name,sent_at,body`);
    const lmax = await getAll(`erume_chat_log?account=in.(okinawa,sapporo)&select=sent_at&order=sent_at.desc&limit=1`, 1);
    const lineThrough = lmax[0] ? jd(lmax[0].sent_at) : null; // この日は途中まで→数えるのは前日まで
    // 予約済みの名前
    const booked: Record<string, Set<string>> = { nha: new Set(), spk: new Set() };
    for (const [st, lk, tb, ec] of [["nha", "nha_line_links", "nha_reservations", "end_date"], ["spk", "spk_line_links", "reservations", "return_date"]]) {
      for (const r of await getAll(`${lk}?select=cust_name`)) if (nz(r.cust_name)) booked[st].add(nz(r.cust_name));
      for (const r of await getAll(`${tb}?${ec}=gte.${addD(preFrom, -60)}&select=name`)) if (nz(r.name)) booked[st].add(nz(r.name));
    }
    const all: Record<string, Set<string>> = {}, bk: Record<string, Set<string>> = {};
    for (const x of el) {
      const body = String(x.body || "");
      if (NOTQ.test(body) || body.length < 4) continue;
      const st = x.account === "okinawa" ? "nha" : "spk";
      const k = `${st}|${jd(x.sent_at)}`;
      (all[k] = all[k] || new Set()).add(String(x.friend_id));
      if (booked[st].has(nz(x.friend_name) || "-")) (bk[k] = bk[k] || new Set()).add(String(x.friend_id));
    }
    // 貸出中の台数（キャンセル除く）
    const cars: Record<string, number> = {};
    const live = (x: any) => !/cancel|キャンセル/i.test(String(x.status || ""));
    for (const [st, tb, sc, ec] of [["nha", "nha_reservations", "start_date", "end_date"], ["spk", "reservations", "lend_date", "return_date"]]) {
      const rs = await getAll(`${tb}?${ec}=gte.${preFrom}&select=${sc},${ec},status`);
      for (const x of rs) {
        if (!live(x)) continue;
        const s = String(x[sc] || "").slice(0, 10), e = String(x[ec] || "").slice(0, 10);
        if (!s || !e) continue;
        for (let d = s < preFrom ? preFrom : s; d <= e; d = addD(d, 1)) cars[`${st}|${d}`] = (cars[`${st}|${d}`] || 0) + 1;
      }
    }
    const lastDay = lineThrough ? addD(lineThrough, -1) : null;
    const stores: Record<string, any> = {};
    for (const st of ["nha", "spk"]) {
      let pd = 0, pa = 0, pb = 0, pc = 0;
      for (let d = preFrom; d <= preTo; d = addD(d, 1)) { pd++; pa += (all[`${st}|${d}`]?.size || 0); pb += (bk[`${st}|${d}`]?.size || 0); pc += (cars[`${st}|${d}`] || 0); }
      const post: any[] = [];
      let n = 0, sa = 0, sb = 0, sc = 0;
      if (lastDay) for (let d = CUT; d <= lastDay; d = addD(d, 1)) {
        const a = all[`${st}|${d}`]?.size || 0, b = bk[`${st}|${d}`]?.size || 0, c = cars[`${st}|${d}`] || 0;
        n++; sa += a; sb += b; sc += c;
        post.push({ d, all: a, b, cars: c, cum_all: r1(sa / n), cum_b: r1(sb / n), cum_per100: sc ? r1(sa * 100 / sc) : null });
      }
      stores[st] = { pre: { days: pd, all: r1(pa / pd), b: r1(pb / pd), per100: pc ? r1(pa * 100 / pc) : null }, post };
    }
    return J({ ok: true, cut: CUT, pre_from: preFrom, pre_to: preTo, line_through: lineThrough, stores });
  } catch (e) {
    return J({ ok: false, error: String(e) }, 500);
  }
});
