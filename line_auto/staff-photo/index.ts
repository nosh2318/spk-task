// 2026-10-23 新API鍵移行：新形式の鍵を優先し、無ければ旧鍵（移行期間の保険・旧鍵の無効化前に外す）
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
console.log("[keymig]", __newKey("SUPABASE_SECRET_KEYS", "edge") ? "secret" : "legacy");
// staff-photo — スタッフ個人ページ(staff.html)の洗車タスク点検・タイヤ写真の「表示用URL」を出すだけのEF（2026-10-16 新設）
// body: { token(staff share_token), store: "spk"|"nha" }
// 返す: { ok, urls: { "<bucket>/<path>": { thumb, full } } }  ※本人担当の洗車タスク（今日-2〜+7日）に出ている写真だけ
// 写真置き場は非公開（anon は読めない・一覧も不可）。パスの絞り込みは DB 関数 <store>_wash_photo_paths（service_role のみ実行可）
// deploy: supabase functions deploy staff-photo --project-ref ckrxttbnawkclshczsia --no-verify-jwt
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL = 21600; // 6時間（画面は5時間で取り直す）

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST,OPTIONS" } });
}
async function signFull(bucket: string, paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!paths.length) return out;
  const r = await fetch(`${SB_URL}/storage/v1/object/sign/${bucket}`, { method: "POST", headers: H, body: JSON.stringify({ expiresIn: TTL, paths }) });
  if (!r.ok) return out;
  for (const d of await r.json()) if (d && d.signedURL && d.path) out[d.path] = `${SB_URL}/storage/v1${d.signedURL}`;
  return out;
}
async function signThumb(bucket: string, path: string): Promise<string> {
  const r = await fetch(`${SB_URL}/storage/v1/object/sign/${bucket}/${encodeURIComponent(path)}`, { method: "POST", headers: H, body: JSON.stringify({ expiresIn: TTL, transform: { width: 240, height: 240, resize: "cover", quality: 70 } }) });
  if (!r.ok) return "";
  const d = await r.json();
  return d && d.signedURL ? `${SB_URL}/storage/v1${d.signedURL}` : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
  const token = String(body.token || "").trim();
  const store = String(body.store || "").trim().toLowerCase();
  if (!UUID.test(token) || (store !== "spk" && store !== "nha")) return json({ ok: false, error: "bad request" }, 400);
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${store}_wash_photo_paths`, { method: "POST", headers: H, body: JSON.stringify({ p_token: token }) });
  if (!r.ok) return json({ ok: false, error: "lookup failed" }, 500);
  const rows: { bucket: string; path: string }[] = await r.json();
  const by: Record<string, string[]> = {};
  for (const x of rows || []) if (x && x.bucket && x.path) (by[x.bucket] = by[x.bucket] || []).push(x.path);
  const urls: Record<string, { thumb: string; full: string }> = {};
  for (const [bucket, paths] of Object.entries(by)) {
    const full = await signFull(bucket, paths);
    const q = paths.slice();
    const worker = async () => { while (q.length) { const p = q.shift()!; const th = await signThumb(bucket, p); const f = full[p] || th; if (f) urls[`${bucket}/${p}`] = { thumb: th || f, full: f }; } };
    await Promise.all([0, 1, 2, 3, 4, 5].map(worker));
  }
  return json({ ok: true, urls });
});
