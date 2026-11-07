// マイページアクティブ管理（BUDDICA側 ggqugvyskyiblxiycpci）: 高松 HDM/BUT の予約一覧
// POST {admin_pin, from, to} → {ok, rows:[...]}。閲覧集計は main の mypage-active（action:"agg"）にトークンで問い合わせる。
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const p = await req.json();
    const PIN = Deno.env.get("ADMIN_PIN") || "";
    if (!PIN || String(p.admin_pin || "") !== PIN) return J({ ok: false, error: "pin" }, 401);
    const from = String(p.from || "").slice(0, 10), to = String(p.to || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return J({ ok: false, error: "from/to" }, 400);
    const sb = createClient(SB, SR);
    const { data: rs, error } = await sb.from("bt_reservations")
      .select("id,name,start_date,start_time,end_date,end_time,pickup_time,dropoff_time,visit_type,return_type,del_place,col_place,del_flight,col_flight,people,ota,mail,tel,mypage_token,status,payment,paid,brand")
      .gte("start_date", from).lte("start_date", to);
    if (error) throw error;
    const live = (rs || []).filter((r: any) => !/cancel|キャンセル/i.test(String(r.status || "")));
    const ids = live.map((r: any) => r.id);
    const lic: any[] = [], chg: any[] = [];
    for (let i = 0; i < ids.length; i += 300) {
      const part = ids.slice(i, i + 300);
      const [a, b] = await Promise.all([
        sb.from("license_uploads").select("reservation_id,cnt,drivers").in("reservation_id", part),
        sb.from("bt_reservation_changes").select("reservation_id,change_type,field_name,status").in("reservation_id", part),
      ]);
      lic.push(...(a.data || [])); chg.push(...(b.data || []));
    }
    const licM: Record<string, any> = {}; for (const x of lic) licM[x.reservation_id] = { cnt: x.cnt, drivers: x.drivers };
    const chgM: Record<string, { pending: number; fields: string[] }> = {};
    for (const x of chg) {
      const c = chgM[x.reservation_id] || (chgM[x.reservation_id] = { pending: 0, fields: [] });
      if (x.status === "requested" || x.status === "pending") c.pending++;
      else if (x.status === "approved" || x.status === "applied") c.fields.push(x.field_name || x.change_type);
    }
    const rows = live.map((r: any) => ({
      store: "tkm", bucket: String(r.brand || "BUDDICA") === "HDM" ? "hdm_tkm" : "but_tkm",
      rid: r.id, name: r.name, sd: r.start_date, st: r.pickup_time || r.start_time, ed: r.end_date, et: r.dropoff_time || r.end_time,
      vt: r.visit_type, rt: r.return_type, del_place: r.del_place, col_place: r.col_place, del_flight: r.del_flight, col_flight: r.col_flight,
      del_lat: null, col_lat: null, people: r.people, ota: r.ota, mail: !!r.mail, tel: !!r.tel, token: r.mypage_token ? String(r.mypage_token) : null,
      payment: r.payment, paid: !!r.paid, line: false, lic: licM[r.id] || null, pay_method: null, jalan_paid: null,
      chg: chgM[r.id] || { pending: 0, fields: [] }, ev: null,
    }));
    return J({ ok: true, rows });
  } catch (e) {
    return J({ ok: false, error: String(e) }, 500);
  }
});
