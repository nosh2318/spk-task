// Supabase Edge Function: returnday-reminder (店舗対応: 主に nha)
// 返却日の朝9:00(JST)に、返却区分(BDB=送迎シャトル / 返却=店頭返却 / COL=デリバリー回収)ごとに
// LINEリマインドを line-push 経由で送信（1予約1回・LINE連携客のみ）。
// pg_cron が x-cron-secret + body{store} で起動。returnday_enabled(or test_mode)がONの時のみ動作。
// deploy: functions deploy returnday-reminder --no-verify-jwt （secrets: FUNC_SECRET, CRON_SECRET）

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNC_SECRET = Deno.env.get("FUNC_SECRET")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
async function sbGet(p: string) { const r = await fetch(`${SB_URL}/rest/v1/${p}`, { headers: H }); return r.ok ? await r.json() : []; }
function json(o: unknown) { return new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } }); }
const enc = encodeURIComponent;

const STORES: Record<string, any> = {
  spk: { resv: "reservations",     retCol: "return_date", links: "spk_line_links", sends: "spk_line_sends", cfg: "spk_line_config", label: "札幌" },
  nha: { resv: "nha_reservations", retCol: "end_date",    links: "nha_line_links", sends: "nha_line_sends", cfg: "nha_line_config", label: "那覇" },
};

const FOOTER = "\n\n※お時間の変更等が発生しました場合は、必ずご連絡をお願いいたします。";

function buildMsg(label: string, name: string, retType: string): string {
  const cn = name ? name + "様" : "お客様";
  const head = "【HANDYMAN" + label + "店｜本日ご返却のご案内】\n" + cn + "\n\n本日はご返却日です。この度はご利用いただき誠にありがとうございます。\n";
  if (retType === "BDB") {
    return head +
      "\n■ 送迎シャトルをご利用のお客様\n" +
      "・返却駐車場へ到着されましたら、お忘れ物がないよう車内をご確認ください。\n" +
      "・送迎シャトルは定刻までに到着いたします。お時間まで、お車にてエンジンをかけたままお待ちください。\n" +
      "・スタッフの常駐はございませんので、定刻のお時間までお待ちくださいませ。" + FOOTER;
  }
  if (retType === "COL") {
    return head +
      "\n■ デリバリー回収のお客様\n" +
      "・回収場所に到着されましたら、ご一報のほどお願いいたします。\n" +
      "・スタッフが到着次第、ご連絡いたします。" + FOOTER;
  }
  // 返却（店頭・返却のみ）
  return head +
    "\n■ ご返却のお客様\n" +
    "・お忘れ物がないか、再度ご確認ください。\n" +
    "・ガソリンの給油のお忘れがないか、今一度ご確認ください。\n" +
    "・運転席ドアポケットに鍵をお入れいただき、LINEにてご一報いただきますようお願いいたします。" + FOOTER;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) return new Response("unauthorized", { status: 401 });
  let store = "nha";
  try { const b = await req.json(); if (b && b.store === "spk") store = "spk"; } catch { /* default nha */ }
  const S = STORES[store];

  const cfg = (await sbGet(`${S.cfg}?id=eq.1&select=*`))[0] || {};
  if (cfg.returnday_enabled !== true && cfg.test_mode !== true) return json({ ok: true, store, skipped: "disabled" });

  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  // 本日返却・対象区分(BDB/返却/COL)・キャンセル除外
  const resvs = await sbGet(`${S.resv}?${enc(S.retCol)}=eq.${today}&select=id,status,return_type`);
  const active = (resvs as any[]).filter((r) => {
    const s = String(r.status || "").toLowerCase();
    if (s.includes("cancel") || String(r.status || "").includes("キャンセル")) return false;
    return ["BDB", "返却", "COL"].includes(String(r.return_type || ""));
  });
  if (!active.length) return json({ ok: true, store, targets: 0 });
  const typeMap: Record<string, string> = {};
  active.forEach((r) => { typeMap[r.id] = String(r.return_type || ""); });
  const ids = active.map((r) => r.id);

  // LINE連携客のみ
  const links = await sbGet(`${S.links}?resv_no=in.(${ids.map(enc).join(",")})&select=resv_no,cust_name`);
  if (!links.length) return json({ ok: true, store, targets: active.length, registered: 0 });

  // 本日 既送信は除外
  const linkIds = (links as any[]).map((l) => l.resv_no);
  const sent = await sbGet(`${S.sends}?action=eq.returnday_reminder&status=eq.sent&resv_no=in.(${linkIds.map(enc).join(",")})&select=resv_no,created_at`);
  const sentSet = new Set((sent as any[]).filter((s) => String(s.created_at || "").slice(0, 10) >= today).map((s) => s.resv_no));

  const results: any[] = [];
  for (const l of links as any[]) {
    if (sentSet.has(l.resv_no)) continue;
    const rt = typeMap[l.resv_no] || "返却";
    const msg = buildMsg(S.label, l.cust_name || "", rt);
    const r = await fetch(`${SB_URL}/functions/v1/line-push`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: FUNC_SECRET, store, resv_no: l.resv_no, action: "returnday_reminder", message: msg }),
    });
    const jr = await r.json().catch(() => ({}));
    results.push({ resv: l.resv_no, type: rt, ...jr });
  }
  return json({ ok: true, store, date: today, targets: active.length, processed: results.length, results });
});
