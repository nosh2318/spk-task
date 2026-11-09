// hdm-tkm-enqueue — じゃらんHANDYMAN高松空港店 通知エンキュー（KEYDROP同型・決済(Square)組込）
// ★テンプレは DB(hdm_tkm_templates) 単一ソースから読む。文面更新は同テーブル1箇所でOK（手動タブと共通）。
// 役割: じゃらん予約ごとに各トリガー条件(日付+状態)を評価し、送るべき通知を
//       hdm_tkm_notifications にINSERT(log_keyでべき等)。実送信は hdm-tkm-send-mail(MODEゲート)が担当。
//   - pg_cron が15分ごとに起動（x-cron-secret）。verify_jwt=false。
// 2026-11-08 札幌・那覇と統一（全店統一）：前日(daybefore＝未了なしの人にも1通)・返却日朝(returnday)・返却3時間前(return3h)を追加。
//   文面に時間・場所は書かない（答えはマイページ1か所）。テンプレは hdm_tkm_templates に同キーで登録。

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const MYPAGE_BASE = "https://nosh2318.github.io/spk-task/my-tkm.html?t=";

async function sbGet(path: string): Promise<any[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) { console.error("sbGet", path, r.status, await r.text()); return []; }
  return await r.json();
}
async function enqueue(row: Record<string, unknown>): Promise<boolean> {
  const r = await fetch(`${SB_URL}/rest/v1/hdm_tkm_notifications`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json", Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify(row),
  });
  return r.ok;
}
const yen = (n: number) => "¥" + Number(n || 0).toLocaleString();
const MY = (tok: string) => MYPAGE_BASE + encodeURIComponent(tok || "");

async function sbPatch(path: string, body: unknown): Promise<void> {
  await fetch(`${SB_URL}/rest/v1/${path}`, { method: "PATCH", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body) });
}
async function sbPost2(path: string, body: unknown, prefer = ""): Promise<void> {
  await fetch(`${SB_URL}/rest/v1/${path}`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json", Prefer: "return=minimal" + (prefer ? "," + prefer : "") }, body: JSON.stringify(body) });
}
const SQ_TOKEN = Deno.env.get("SQUARE_ACCESS_TOKEN") || "";
const SQ_LOC = Deno.env.get("SQUARE_LOCATION_ID") || "L8N7J9RKPN3WH";
// 🔴 再発防止(2026-09-27): じゃらんHDMで決済リンク(pay_url)が空なら、welcome送信前にSquareリンクを補完する。
//   bt-importが取込時にSquare API一時失敗するとpay_url空のまま→決済ブロック欠落のwelcomeが飛ぶ。
//   ここで送信直前に作り直す二重保険。既にpay_url有 or じゃらん以外 or 入金済 or 価格0 はskip(副作用ゼロ)。失敗しても送信は止めない。
async function ensurePayLink(r: any): Promise<void> {
  if (String(r.ota) !== "じゃらん" || r.pay_url || r.paid) return;
  const price = Number(r.price || 0);
  if (price <= 0 || !SQ_TOKEN) return;
  try {
    const sqr = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
      method: "POST", headers: { "Square-Version": "2024-01-18", Authorization: "Bearer " + SQ_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ idempotency_key: crypto.randomUUID(), quick_pay: { name: `高松空港店 ${r.name || ""}様（${r.id}） じゃらん決済`, price_money: { amount: price, currency: "JPY" }, location_id: SQ_LOC } }) });
    if (!sqr.ok) { console.error("ensurePayLink square", r.id, sqr.status); return; }
    const d = await sqr.json(); const pl = d.payment_link || {};
    if (!pl.url) return;
    await sbPatch(`bt_reservations?id=eq.${encodeURIComponent(r.id)}`, { pay_url: pl.url, square_order_id: pl.order_id });
    await sbPost2(`bt_jalan_payments?on_conflict=reservation_id`, { reservation_id: r.id, status: "link_created", amount: price, square_payment_url: pl.url, square_order_id: pl.order_id, customer_name: r.name, customer_email: r.mail, lend_date: r.start_date, return_date: r.end_date, vehicle_class: r.vehicle_class || null, link_created_at: new Date().toISOString() }, "resolution=merge-duplicates");
    r.pay_url = pl.url; r.square_order_id = pl.order_id;
    console.log(`[hdm-tkm-enqueue] pay_link補完 ${r.id} ${pl.url}`);
  } catch (e) { console.error("ensurePayLink", r.id, String(e).slice(0, 80)); }
}

// 返却時刻(JST)まであと何分か。返却日でない・時刻不明は null。
function minsToReturn(r: any, nowMs: number, today: string): number | null {
  if (r.end_date !== today) return null;
  const t = String(r.dropoff_time || r.end_time || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null;
  return (new Date(`${r.end_date}T${t.padStart(5, "0")}:00+09:00`).getTime() - nowMs) / 60000;
}

// トリガー条件のみ（文面はDB）。d2s=出発まで日数, d2e=返却からの経過日数, jh=現在JST時。
// ★②③④⑤は「reminder」に統合＝未了項目(免許/約款/送迎/決済)だけを1通で並べる（複数未了でも常に1通）。
const anyPending = (r: any) => !r.licensed || !r.termsSigned || (r.hasPickup && !r.pickupSet) || (!!r.pay_url && !r.paid);
const DUE: Record<string, (r: any) => boolean> = {
  welcome: () => true,
  // 2026-11-08 自動の案内は JST 9〜21時だけ（深夜0時に届いていた）
  // 2026-11-09 nosh「全店統一 3/2/1」：4日前→3日前（札幌・那覇と同じ 3日前・2日前・前日）
  reminder: (r) => (r.d2s === 3 || r.d2s === 2) && r.jh >= 9 && r.jh < 21 && anyPending(r),
  remind: (r) => r.d2s === 1 && r.jh >= 9 && r.jh < 21 && anyPending(r),
  // 前日：未了がある人は remind が行くので、未了なしの人にだけ送る（1人1通）
  daybefore: (r) => r.d2s === 1 && r.jh >= 9 && r.jh < 21 && !anyPending(r),
  damage: (r) => r.d2s === 0 && r.jh >= 8,
  // 返却日の朝（9時以降・1回）
  returnday: (r) => r.d2e === 0 && r.jh >= 9 && r.jh < 21,
  // 返却3時間前（3時間前〜2時間半前の間に1回）
  return3h: (r) => r.m2r != null && r.m2r <= 180 && r.m2r > 150,
  thanks: (r) => r.d2e >= 1 && r.d2e <= 3 && r.jh >= 10 && r.jh < 21,
};

function buildItems(r: any): string {
  const it: string[] = [];
  if (r.hasPickup && !r.pickupSet) it.push("　・ご希望の送迎時間のご登録");
  if (!r.termsSigned) it.push("　・貸渡約款へのご同意・ご署名");
  if (!r.licensed) it.push("　・運転免許証のご登録（運転される方 全員分）");
  if (r.pay_url && !r.paid) it.push("　・事前決済（" + yen(r.price) + "／ご出発3日前19:00まで）");
  return it.join("\n");
}
function fill(body: string, r: any, payblock: string, footer: string): string {
  const pay = r.pay_url ? payblock.replace(/\{amount\}/g, yen(r.price)).replace(/\{pay_url\}/g, r.pay_url) : "";
  return body
    .replace(/\{name\}/g, r.name || "お客様")
    .replace(/\{mypage\}/g, MY(r.mypage_token))
    .replace(/\{amount\}/g, yen(r.price))
    .replace(/\{pay_url\}/g, r.pay_url || "")
    .replace(/\{start\}/g, r.start_date || "")
    .replace(/\{items\}/g, buildItems(r))
    .replace(/\{payline\}/g, (r.pay_url && !r.paid) ? ("\n▼ お支払い\n" + r.pay_url) : "")
    .replace(/\{payblock\}/g, pay)
    .replace(/\{footer\}/g, "\n\n" + footer);
}

Deno.serve(async (req) => {
  const sec = req.headers.get("x-cron-secret") || "";
  if (!CRON_SECRET || sec !== CRON_SECRET) return new Response("forbidden", { status: 403 });

  // テンプレ(単一ソース)
  const tpls = await sbGet("hdm_tkm_templates?select=key,subject,body,sort&order=sort.asc");
  const tmap: Record<string, any> = {}; tpls.forEach((t) => tmap[t.key] = t);
  const payblock = (tmap["_payblock"]?.body) || "";
  const footer = (tmap["_footer"]?.body) || "HANDYMAN 高松空港店";
  const keys = tpls.filter((t) => !t.key.startsWith("_")).map((t) => t.key);

  const nowMs = Date.now();
  const jstNow = new Date(nowMs + 9 * 3600 * 1000);
  const today = jstNow.toISOString().slice(0, 10);
  const jh = jstNow.getUTCHours();
  const dday = (ds: string) => { if (!ds) return null; return Math.round((new Date(ds + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86400000); };
  const from = new Date(jstNow.getTime() - 14 * 86400 * 1000).toISOString().slice(0, 10);
  // ★2026-09-02 オーナー指示: welcome(予約完了メール＝マイページ+お礼)は日程に関係なく予約完了時に送る。
  //   旧+60日窓は先の予約(例12/27)にwelcomeが届かない副作用があった(オーナー未承認のハードコード値)→実質無制限(+2年)に拡張。
  //   他トリガー(reminder/remind/damage/thanks)は各自のd2s/d2e条件でゲートされるので、窓拡張の影響はwelcome(()=>true)のみ＝先の予約にも予約完了メールが届く。
  const to = new Date(jstNow.getTime() + 730 * 86400 * 1000).toISOString().slice(0, 10);

  // ★対象=HDMブランドの高松予約(brand=HDM＝HANDYMAN公式/じゃらん/楽天/スカイチケット・単一正本trg_bt_set_brand)。
  //   公式(ota=HANDYMAN)は確定メールをofficial-pay-tkmが送信済→welcomeは重複回避(下でskip)。BUDDICA予約は絶対に拾わない。
  const resv = await sbGet(`bt_reservations?brand=eq.HDM&start_date=gte.${from}&start_date=lte.${to}&mail=not.is.null&mail=neq.&select=id,name,mail,ota,start_date,end_date,end_time,dropoff_time,price,pay_url,paid,mypage_token,visit_type,return_type,pickup_time,status,vehicle_class`);
  const alive = resv.filter((r) => !/cancel|キャンセル/i.test(String(r.status || "")));
  if (!alive.length) return new Response(JSON.stringify({ ok: true, reservations: 0, enqueued: 0 }), { headers: { "content-type": "application/json" } });
  const ids = alive.map((r) => r.id);
  const inList = "(" + ids.map((x) => `"${x}"`).join(",") + ")";

  const lic: Record<string, boolean> = {};
  (await sbGet(`license_uploads?reservation_id=in.${inList}&select=reservation_id,cnt`)).forEach((x) => { if (x.reservation_id && (x.cnt || 0) > 0) lic[x.reservation_id] = true; });
  const terms: Record<string, boolean> = {};
  (await sbGet(`handover_signatures?reservation_id=in.${inList}&sign_type=eq.terms_agree&select=reservation_id`)).forEach((x) => { if (x.reservation_id) terms[x.reservation_id] = true; });
  (await sbGet(`bt_tasks?${encodeURIComponent("予約番号")}=in.${inList}&deleted=not.is.true&select=${encodeURIComponent("予約番号")},${encodeURIComponent("約款")}`)).forEach((x: any) => { if (String(x["約款"] || "").indexOf("同意") >= 0) terms[x["予約番号"]] = true; });

  let enq = 0, cand = 0;
  for (const r of alive) {
    await ensurePayLink(r); // じゃらんHDMでpay_url空なら送信前に決済リンク補完(取込失敗の二重保険)
    const d2s = dday(r.start_date); const de = dday(r.end_date);
    const rr = { ...r, d2s: d2s == null ? 999 : d2s, d2e: de == null ? -999 : -de, jh, m2r: minsToReturn(r, nowMs, today), licensed: !!lic[r.id], termsSigned: !!terms[r.id], hasPickup: r.visit_type === "PU" || r.return_type === "BD", pickupSet: !!r.pickup_time };
    for (const key of keys) {
      if (!DUE[key] || !DUE[key](rr)) continue;
      if (key === "welcome" && String(r.ota) === "HANDYMAN") continue; // 公式は確定メール(official-pay-tkm)送信済→welcome重複回避
      cand++;
      const t = tmap[key];
      const lk = key === "reminder" ? (key + ":" + r.id + ":" + rr.d2s) : (key + ":" + r.id); // 統合リマインドは4日前/2日前で別
      const ok = await enqueue({ reservation_id: r.id, kind: key, to_email: r.mail, subject: t.subject, body: fill(t.body, rr, payblock, footer), log_key: lk });
      if (ok) enq++;
    }
  }
  console.log(`[hdm-tkm-enqueue] reservations=${alive.length} candidates=${cand} enqueued=${enq}`);
  return new Response(JSON.stringify({ ok: true, reservations: alive.length, candidates: cand, enqueued: enq }), { headers: { "content-type": "application/json" } });
});
