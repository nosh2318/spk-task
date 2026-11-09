// 2026-10-23 新API鍵移行：新形式の鍵を優先し、無ければ旧鍵（移行期間の保険・旧鍵の無効化前に外す）
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
console.log("[keymig]", __newKey("SUPABASE_SECRET_KEYS", "edge") ? "secret" : "legacy");
// ============================================================
// mypage-notify-nha : 那覇 マイページURLを初回自動送信（cron）
// 2026-07-08 / omni  ※札幌 mypage-notify を那覇(nha)へ移植。今回は【A 初回送付(mypage_initial)】のみ。
//  安全: nha_line_config.mypage_notify_enabled=true の時のみ本番送信。test_mode時は test_user_id のみ。
//  重複防止: nha_line_sends に (resv_no, action='mypage_initial', status='sent') があれば再送しない。
//  認証: x-cron-secret = CRON_SECRET（cron）。line-push へ委譲（mypage_ は日付ガード迂回）。
//  KEYDROPは自前マイページ(keydrop.jp)を使うため対象外（札幌と同じ）。
// 2026-11-08 札幌と同じ3本を追加（全店統一）：前日(mypage_daybefore)・返却日朝(mypage_returnday)・返却3時間前(mypage_return3h)。
//  文面に時間・場所は書かない（変更が承認されても食い違わないよう、答えはマイページ1か所）。旧 returnday-reminder(那覇) は停止。
// ============================================================
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" };
const URLBASE = "https://nosh2318.github.io/naha-project/my-nha.html?t=";
const STORE = "nha";

async function sbGet(t: string, q: string): Promise<any[]> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { headers: H }); if (!r.ok) { console.error(`GET ${t}`, await r.text()); return []; } return await r.json(); }
// ページネーション対応（那覇は予約2500超＝PostgREST行上限を超えるため全件取得が必須）
async function sbGetAll(t: string, q: string): Promise<any[]> {
  const out: any[] = []; const PAGE = 1000;
  for (let from = 0; from < 100000; from += PAGE) {
    const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { headers: { ...H, Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items", Prefer: "count=none" } });
    if (!r.ok) { console.error(`GETALL ${t}`, await r.text()); break; }
    const rows = await r.json(); out.push(...rows);
    if (!Array.isArray(rows) || rows.length < PAGE) break;
  }
  return out;
}
function jstNow(): Date { return new Date(Date.now() + 9 * 3600 * 1000); }
function dstr(off: number): string { const d = jstNow(); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); }

// ===== 出発前の「足りない物」（2026-11-09 nosh「全店統一 3/2/1」） =====
//   3日前・2日前＝足りない物がある人にだけ一覧を1通／前日＝一覧、なければ短い1通（高松 hdm-tkm-enqueue と同じ形）。
//   旧：免許証の催促(license-reminder-cron)・場所の催促(mypage_place/mail_place)・前日案内 → この1通にまとめた。
//   見方は新マイページの「必須」と同じ（免許証・時間・お届け場所/到着便・回収場所・人数・お支払い）。帰りの便は催促しない。
async function prepMissing(store: string, r: any): Promise<string[]> {
  const id = encodeURIComponent(String(r.id));
  let e: any = {};
  try {
    const x = await fetch(`${SB_URL}/rest/v1/rpc/${store}_res_effective`, { method: "POST", headers: H, body: JSON.stringify({ p_res: String(r.id) }) });
    if (x.ok) e = (await x.json()) || {};
  } catch { /* 予約の値で見る */ }
  const [lic, info, pay] = await Promise.all([
    sbGet("license_uploads", `store=eq.${store}&reservation_id=eq.${id}&select=cnt`),
    sbGet("mypage_info", `store=eq.${store}&reservation_id=eq.${id}&select=people,flight_out`),
    sbGet(store === "nha" ? "nha_jalan_payments" : "jalan_payments", `reservation_id=eq.${id}&select=status${store === "nha" ? ",local_paid_at" : ""}`),
  ]);
  const I = info[0] || {};
  const vt = String(r.visit_type || ""), rt = String(r.return_type || "");
  const del = store !== "nha" || !/^(PUB|PU\(バス\)|airport|PU|来店)$/.test(vt);
  const col = store !== "nha" || !/^(BDB|BD\(バス\)|BD|返却)$/.test(rt);
  const has = (v: any) => String(v || "").trim().length > 1;
  const m: string[] = [];
  if (!lic.some((x: any) => Number(x.cnt) > 0)) m.push("運転する方の免許証");
  if (!/\d{1,2}:\d{2}/.test(String(e.lend_time || r.lend_time || r.start_time || ""))) m.push(del ? "お届けの時間" : /PUB/.test(vt) ? "お迎えの時間" : "受け取りの時間");
  if (del) { if (!has(e.del_place) && !has(r.del_place)) m.push("お届け場所"); }
  else if (vt !== "来店" && !has(r.del_flight)) m.push("到着便");
  if (col && !has(e.col_place) && !has(r.col_place)) m.push("回収場所");
  if (!(Number(I.people || r.people || 0) > 0)) m.push("ご利用人数");
  // 帰りの便は催促しない（2026-11-09 nosh「帰りの便は予約に必須ではない。来る便がわからない時だけ確認」）
  if (pay.some((p: any) => ["link_created", "email_sent", "reminded"].includes(String(p.status)) && !p.local_paid_at)) m.push("事前決済のお支払い");
  return m;
}
const prepLine = (shop: string, n: number, u: string, miss: string[]) => miss.length
  ? `【HANDYMAN ${shop}】ご出発まで${n === 1 ? "明日" : "あと" + n + "日"}です。まだ登録されていないものがあります👇\n${miss.map((x) => "・" + x).join("\n")}\nマイページからご登録ください。\nSome details are still missing. Please complete them here 👇\n${u}`
  : `【HANDYMAN ${shop}】明日がご利用日です。ご準備はすべて整っています。受け取りの流れはマイページでご確認ください👇\nYour rental starts tomorrow. You're all set. Check the details here 👇\n${u}`;
// テンプレ（日本語＋English）＋ URL
const TPL: Record<string, (u: string, r?: any) => string> = {
  // 2026-11-09 出発前は1日1通（3日前・2日前＝足りない人だけ／前日＝一覧か短い1通）。免許証の催促はここにまとめた
  mypage_prep_d3: (u, r) => prepLine("那覇空港店", 3, u, (r && r.__miss) || []),
  mypage_prep_d2: (u, r) => prepLine("那覇空港店", 2, u, (r && r.__miss) || []),
  mypage_initial: (u) => `【HANDYMAN 那覇空港店】\nご予約ありがとうございます。専用マイページで、ご予約内容・受け渡し／送迎・車両状態(傷)チェックをご確認いただけます👇\nThank you for your booking! Check your reservation, transfer details & vehicle condition here 👇\n${u}`,
  mypage_daybefore: (u, r) => prepLine("那覇空港店", 1, u, (r && r.__miss) || []),
  mypage_returnday: (u) => `【HANDYMAN 那覇空港店】本日がご返却日です。返却の場所・時間・給油はマイページでご確認ください👇\nToday is your return day. Check the return details here 👇\n${u}`,
  mypage_return3h: (u) => `【HANDYMAN 那覇空港店】まもなくご返却のお時間です（約3時間後）。返却の流れはマイページでご確認ください👇\nReturn is in about 3 hours. Check the details here 👇\n${u}`,
};

async function callLinePush(resvNo: string, action: string, message: string): Promise<any> {
  const secret = Deno.env.get("LINEPUSH_SECRET");
  if (!secret) return { ok: false, reason: "no_secret" };
  try {
    const r = await fetch(`${SB_URL}/functions/v1/line-push`, {
      method: "POST", headers: { "content-type": "application/json", apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify({ secret, store: STORE, resv_no: resvNo, action, message }),
    });
    return await r.json().catch(() => ({ ok: false }));
  } catch (e) { return { ok: false, reason: String(e) }; }
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const hdr = req.headers.get("x-cron-secret");
  let body: any = {}; try { body = await req.json(); } catch { /* ignore */ }
  const bySecret = !!cronSecret && (hdr === cronSecret || body?.secret === cronSecret);
  if (!bySecret) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

  const cfg = (await sbGet(`${STORE}_line_config`, `id=eq.1&select=*`))[0] || {};
  const enabled = cfg.mypage_notify_enabled === true;
  const testMode = cfg.test_mode === true;
  if (!enabled && !testMode) return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), { headers: { "content-type": "application/json" } });

  // 1回の実行で送る最大件数。テスト時=1(誤爆防止)／本番=40(EFタイムアウト回避＋緩やかなロールアウト。残りは次のcronで送信)
  const cap = testMode ? Number(body?.limit ?? 1) : Number(body?.limit ?? 40);

  const today = dstr(0), d1 = dstr(1), d2 = dstr(2), d3 = dstr(3);
  // 対象＝返却(end_date)が今日以降・未キャンセル・KEYDROP除外
  const resvsAll = await sbGetAll("nha_reservations", `end_date=gte.${today}&status=not.in.("キャンセル",cancelled,cancel)&select=id,ota,start_date,start_time,end_date,end_time,col_time,del_place,col_place,del_flight,people,visit_type,return_type,mypage_token`);
  const resvs = resvsAll.filter((r: any) => String(r.ota || "").toUpperCase() !== "KEYDROP");
  // LINE連携済み（userIdあり）だけが対象
  const links = await sbGetAll(`${STORE}_line_links`, `select=resv_no,line_user_id`);
  const linked = new Set(links.filter((l: any) => l.resv_no && l.line_user_id).map((l: any) => l.resv_no));
  // 既送信（mypage_*=sent）マップ
  const sends = await sbGetAll(`${STORE}_line_sends`, `action=like.mypage_*&status=eq.sent&select=resv_no,action`);
  const sentSet = new Set(sends.map((s: any) => s.resv_no + "|" + s.action));
  // 切替日の二重送信防止：旧「本日ご返却のご案内」(returnday_reminder)を今日すでに受け取った予約には返却日案内を送らない
  const oldRd = await sbGetAll(`${STORE}_line_sends`, `action=eq.returnday_reminder&status=eq.sent&sent_at=gte.${today}T00:00:00%2B09:00&select=resv_no`);
  for (const o of oldRd) sentSet.add(o.resv_no + "|mypage_returnday");

  const nowMs = Date.now();
  const jstHour = jstNow().getUTCHours();
  const daytime = jstHour >= 9 && jstHour < 21; // 深夜送信防止（JST 9〜21時）
  const win = Math.max((cfg.window_min || 30) * 60000, 30 * 60000);
  const results: any[] = [];
  const okCount = () => results.filter((x) => x.ok).length;
  const push = async (r: any, action: string) => {
    if (okCount() >= cap) return;
    const key = r.id + "|" + action;
    if (sentSet.has(key)) return;
    const res = await callLinePush(r.id, action, TPL[action](URLBASE + r.mypage_token, r));
    results.push({ id: r.id, action, ok: !!res.ok, reason: res.reason || null });
    if (res.ok) sentSet.add(key);
  };

  for (const r of resvs) {
    if (okCount() >= cap) break;
    if (!linked.has(r.id) || !r.mypage_token) continue;
    // ① 初動（2026-11-08 深夜は送らない＝札幌と同じ JST 9〜21時）
    if (daytime) await push(r, "mypage_initial");
    // ② 出発前（2026-11-09 全店統一 3/2/1）：3日前・2日前＝足りない物がある人だけ、前日＝一覧か短い1通（JST 9〜21時）
    for (const [n, dd, act] of [[3, d3, "mypage_prep_d3"], [2, d2, "mypage_prep_d2"], [1, d1, "mypage_daybefore"]] as [number, string, string][]) {
      if (r.start_date !== dd || !daytime || sentSet.has(r.id + "|" + act) || okCount() >= cap) continue;
      r.__miss = await prepMissing("nha", r);
      if (n > 1 && !r.__miss.length) continue;
      await push(r, act);
    }
    // ③ 返却日の朝（9時以降・1回）
    if (r.end_date === today && jstHour >= 9) await push(r, "mypage_returnday");
    // ④ 返却3時間前（返却時刻の3時間前〜その30分後の間に1回）
    if (r.end_date === today) {
      const rt = String(r.col_time || r.end_time || "").trim();
      if (/^\d{1,2}:\d{2}$/.test(rt)) {
        const dep = new Date(`${r.end_date}T${rt.padStart(5, "0")}:00+09:00`).getTime();
        if (dep - nowMs <= 3 * 3600000 && dep - nowMs > 3 * 3600000 - win) await push(r, "mypage_return3h");
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, enabled, testMode, cap, sent: okCount(), results: results.slice(0, 30) }), { headers: { "content-type": "application/json" } });
});
