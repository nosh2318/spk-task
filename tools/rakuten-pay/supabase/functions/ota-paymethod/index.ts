// 楽天の決済方法をミニのロボから受け取る口（2026-11-07）。
//   1) handyman-deve の台帳 ota_pay_method に書く（RPC ota_pay_upsert・ロボの鍵が必須＝鍵が違えば何もしない）
//   2) 高松(tkm)の楽天予約は BUDDICA側 bt_reservations.payment を楽天の実際の値に合わせる
//      （取込 bt-import は楽天を一律「事前カード決済(支払済)」で入れるため、現地決済が混ざると配車表が誤表示になっていた）
//      直すのは payment が 空 / 事前カード決済(支払済) / 現地決済 のどれかの時だけ。スタッフが別の値を入れた予約には触らない。
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const SB_URL = Deno.env.get("SUPABASE_URL")!, SB_SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BT_URL = Deno.env.get("BT_URL")!, BT_SR = Deno.env.get("BT_SERVICE_KEY")!;
const hd = (k: string) => ({ apikey: k, Authorization: "Bearer " + k, "Content-Type": "application/json" });
const CARD = "事前カード決済(支払済)", ONSITE = "現地決済";
serve(async (req) => {
  let body: any = {}; try { body = await req.json(); } catch (_) { /**/ }
  const items: any[] = Array.isArray(body.items) ? body.items.slice(0, 3000) : [];
  const r = await fetch(SB_URL + "/rest/v1/rpc/ota_pay_upsert", { method: "POST", headers: hd(SB_SR), body: JSON.stringify({ p_token: String(body.token || ""), p_items: items }) });
  if (!r.ok) return new Response(JSON.stringify({ ok: false, err: "upsert " + r.status }), { status: r.status === 400 ? 403 : 500 });
  const n = await r.json();
  const bt: any[] = [];
  const tk = items.filter((x) => x && x.store === "tkm" && /^RC\d+$/.test(String(x.id || "")) && (x.method === "card" || x.method === "onsite"));
  for (let i = 0; i < tk.length; i += 50) {
    const chunk = tk.slice(i, i + 50);
    const ids = chunk.map((x) => '"' + x.id + '"').join(",");
    const rr = await fetch(BT_URL + "/rest/v1/bt_reservations?id=in.(" + encodeURIComponent(ids) + ")&select=id,ota,payment", { headers: hd(BT_SR) });
    if (!rr.ok) { bt.push({ err: "bt read " + rr.status }); continue; }
    const rows: any[] = await rr.json();
    for (const row of rows) {
      if (row.ota !== "楽天") continue;
      const want = chunk.find((x) => x.id === row.id)?.method === "onsite" ? ONSITE : CARD;
      const cur = row.payment ?? "";
      if (cur === want || !(cur === "" || cur === CARD || cur === ONSITE)) continue;
      const pr = await fetch(BT_URL + "/rest/v1/bt_reservations?id=eq." + encodeURIComponent(row.id), { method: "PATCH", headers: { ...hd(BT_SR), Prefer: "return=minimal" }, body: JSON.stringify({ payment: want }) });
      bt.push({ id: row.id, from: cur, to: want, ok: pr.ok });
    }
  }
  return new Response(JSON.stringify({ ok: true, upserted: n, bt }), { headers: { "content-type": "application/json" } });
});
