// マイページアクティブ管理（main）: 那覇・札幌の予約一覧＋全店の閲覧集計
// POST {admin_pin, action:"list", from, to}  → {ok, rows:[...]}  （那覇 HDM/KEY・札幌 HDM/KEY）
// POST {admin_pin, action:"agg", tokens:[...]} → {ok, agg:{token:{...}}}（高松の行を BT 側から取った後に使う）
// 判定（段階・6項目）は画面側の1か所で行う。ここは事実だけ返す。
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB = Deno.env.get("SUPABASE_URL")!;
const SR = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const CANCEL = /cancel|キャンセル/i;
const isKD = (r: any) => r.ota === "KEYDROP" || /^(KDN|KD)-/i.test(String(r.id || ""));

async function agg(sb: any, tokens: string[]) {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < tokens.length; i += 300) {
    const { data, error } = await sb.rpc("mpactive_event_agg", { p_tokens: tokens.slice(i, i + 300) });
    if (error) throw error;
    for (const a of data || []) out[a.token] = a;
  }
  return out;
}
async function inChunks(sb: any, table: string, cols: string, key: string, ids: string[], extra?: (q: any) => any) {
  const rows: any[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    let q = sb.from(table).select(cols).in(key, ids.slice(i, i + 300));
    if (extra) q = extra(q);
    const { data } = await q;
    rows.push(...(data || []));
  }
  return rows;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const p = await req.json();
    const PIN = Deno.env.get("ADMIN_PIN") || "";
    if (!PIN || String(p.admin_pin || "") !== PIN) return J({ ok: false, error: "pin" }, 401);
    const sb = createClient(SB, SR);

    if (p.action === "agg") {
      const tokens = (Array.isArray(p.tokens) ? p.tokens : []).map(String).filter(Boolean).slice(0, 3000);
      return J({ ok: true, agg: await agg(sb, tokens) });
    }

    const from = String(p.from || "").slice(0, 10), to = String(p.to || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return J({ ok: false, error: "from/to" }, 400);

    const [nhaR, spkR] = await Promise.all([
      sb.from("nha_reservations").select("id,name,start_date,start_time,end_date,end_time,visit_type,return_type,del_place,col_place,del_flight,col_flight,del_lat,col_lat,people,ota,mail,tel,mypage_token,status,payment").gte("start_date", from).lte("start_date", to),
      sb.from("reservations").select("id,name,lend_date,lend_time,return_date,return_time,visit_type,return_type,del_place,col_place,flight,del_lat,col_lat,people,ota,mail,tel,mypage_token,status").gte("lend_date", from).lte("lend_date", to),
    ]);
    const rows: any[] = [];
    for (const r of nhaR.data || []) {
      if (CANCEL.test(String(r.status || ""))) continue;
      rows.push({ store: "nha", bucket: isKD(r) ? "key_nha" : "hdm_nha", rid: r.id, name: r.name, sd: r.start_date, st: r.start_time, ed: r.end_date, et: r.end_time,
        vt: r.visit_type, rt: r.return_type, del_place: r.del_place, col_place: r.col_place, del_flight: r.del_flight, col_flight: r.col_flight,
        del_lat: r.del_lat, col_lat: r.col_lat, people: r.people, ota: r.ota, mail: !!r.mail, tel: !!r.tel, token: r.mypage_token, payment: r.payment });
    }
    for (const r of spkR.data || []) {
      if (CANCEL.test(String(r.status || ""))) continue;
      rows.push({ store: "spk", bucket: isKD(r) ? "key_spk" : "hdm_spk", rid: r.id, name: r.name, sd: r.lend_date, st: r.lend_time, ed: r.return_date, et: r.return_time,
        vt: r.visit_type, rt: r.return_type, del_place: r.del_place, col_place: r.col_place, del_flight: r.flight, col_flight: null,
        del_lat: r.del_lat, col_lat: r.col_lat, people: r.people, ota: r.ota, mail: !!r.mail, tel: !!r.tel, token: r.mypage_token, payment: null });
    }
    const ids = { nha: rows.filter((r) => r.store === "nha").map((r) => r.rid), spk: rows.filter((r) => r.store === "spk").map((r) => r.rid) };
    const all = [...ids.nha, ...ids.spk];
    const [lic, nl, sl, chg, pm, jp, njp] = await Promise.all([
      inChunks(sb, "license_uploads", "reservation_id,store,cnt,drivers", "reservation_id", all),
      inChunks(sb, "nha_line_links", "resv_no", "resv_no", ids.nha),
      inChunks(sb, "spk_line_links", "resv_no", "resv_no", ids.spk),
      inChunks(sb, "mypage_changes", "reservation_id,store,field,status", "reservation_id", all),
      inChunks(sb, "ota_pay_method", "reservation_id,store,method", "reservation_id", all),
      inChunks(sb, "jalan_payments", "reservation_id,status,paid_at", "reservation_id", ids.spk),
      inChunks(sb, "nha_jalan_payments", "reservation_id,status,paid_at,local_paid_at", "reservation_id", ids.nha),
    ]);
    const lineSet = new Set([...nl.map((x) => "nha|" + x.resv_no), ...sl.map((x) => "spk|" + x.resv_no)]);
    const k = (s: string, id: string) => s + "|" + id;
    const licM: Record<string, any> = {}; for (const x of lic) licM[k(x.store, x.reservation_id)] = { cnt: x.cnt, drivers: x.drivers };
    const pmM: Record<string, string> = {}; for (const x of pm) pmM[k(x.store, x.reservation_id)] = x.method;
    const jpM: Record<string, boolean> = {};
    for (const x of jp) jpM[k("spk", x.reservation_id)] = jpM[k("spk", x.reservation_id)] || !!x.paid_at || x.status === "paid";
    for (const x of njp) jpM[k("nha", x.reservation_id)] = jpM[k("nha", x.reservation_id)] || !!x.paid_at || !!x.local_paid_at || x.status === "paid";
    const chgM: Record<string, { pending: number; fields: string[] }> = {};
    for (const x of chg) {
      const kk = k(x.store, x.reservation_id); const c = chgM[kk] || (chgM[kk] = { pending: 0, fields: [] });
      if (x.status === "requested") c.pending++;
      else if (x.status === "approved" || x.status === "applied") c.fields.push(x.field);
    }
    const ag = await agg(sb, rows.map((r) => r.token).filter(Boolean));
    for (const r of rows) {
      const kk = k(r.store, r.rid);
      r.line = lineSet.has(kk); r.lic = licM[kk] || null; r.pay_method = pmM[kk] || null;
      r.jalan_paid = kk in jpM ? jpM[kk] : null; r.chg = chgM[kk] || { pending: 0, fields: [] };
      r.ev = (r.token && ag[r.token]) || null;
    }
    return J({ ok: true, rows });
  } catch (e) {
    return J({ ok: false, error: String(e) }, 500);
  }
});
