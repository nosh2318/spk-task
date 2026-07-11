// ============================================================
// mypage-notify-nha : 那覇 マイページURLを初回自動送信（cron）
// 2026-07-08 / omni  ※札幌 mypage-notify を那覇(nha)へ移植。今回は【A 初回送付(mypage_initial)】のみ。
//  安全: nha_line_config.mypage_notify_enabled=true の時のみ本番送信。test_mode時は test_user_id のみ。
//  重複防止: nha_line_sends に (resv_no, action='mypage_initial', status='sent') があれば再送しない。
//  認証: x-cron-secret = CRON_SECRET（cron）。line-push へ委譲（mypage_ は日付ガード迂回）。
//  KEYDROPは自前マイページ(keydrop.jp)を使うため対象外（札幌と同じ）。
// ============================================================
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

// テンプレ（日本語＋English）＋ URL
const TPL_INITIAL = (u: string) =>
  `【HANDYMAN 那覇空港店】\nご予約ありがとうございます。専用マイページで、ご予約内容・受け渡し／送迎・車両状態(傷)チェックをご確認いただけます👇\nThank you for your booking! Check your reservation, transfer details & vehicle condition here 👇\n${u}`;

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

  const today = dstr(0);
  // 対象＝返却(end_date)が今日以降・未キャンセル・KEYDROP除外
  const resvsAll = await sbGetAll("nha_reservations", `end_date=gte.${today}&status=not.in.("キャンセル",cancelled,cancel)&select=id,name,ota,start_date,end_date,mypage_token`);
  const resvs = resvsAll.filter((r: any) => String(r.ota || "").toUpperCase() !== "KEYDROP");
  // LINE連携済み（userIdあり）だけが対象
  const links = await sbGetAll(`${STORE}_line_links`, `select=resv_no,line_user_id`);
  const linked = new Set(links.filter((l: any) => l.resv_no && l.line_user_id).map((l: any) => l.resv_no));
  // 既送信（mypage_initial=sent）マップ
  const sends = await sbGetAll(`${STORE}_line_sends`, `action=eq.mypage_initial&status=eq.sent&select=resv_no`);
  const sentSet = new Set(sends.map((s: any) => s.resv_no));

  const results: any[] = [];
  for (const r of resvs) {
    if (results.filter((x) => x.ok).length >= cap) break;
    if (!linked.has(r.id) || !r.mypage_token) continue;
    if (sentSet.has(r.id)) continue;
    const url = URLBASE + r.mypage_token;
    const res = await callLinePush(r.id, "mypage_initial", TPL_INITIAL(url));
    results.push({ id: r.id, ok: !!res.ok, reason: res.reason || null });
    if (res.ok) sentSet.add(r.id);
  }
  return new Response(JSON.stringify({ ok: true, enabled, testMode, cap, candidates: resvs.filter((r: any) => linked.has(r.id) && r.mypage_token && !sentSet.has(r.id)).length, sent: results.filter((x) => x.ok).length, results: results.slice(0, 20) }), { headers: { "content-type": "application/json" } });
});
