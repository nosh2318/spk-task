// mail-track : 通知メールの開封・クリックを記録する（main ckrxttbnawkclshczsia・verify_jwt=false）
// 2026-11-09 nosh「全ての通知（メール）の開封率は独自システム構築が必須」
//   GET ?o=<mid>            → 開封（メール内の1x1画像）。透明GIFを返す。
//   GET ?c=<mid>&u=<url>    → クリック。記録してから url へ転送（行き先は当社のページだけ）。
//   mid = base64url("store|kind|予約番号")  ※送る側（official-notify / hdm-tkm-send-mail / hdm-send-mail）が付ける
// 記録先: mail_track_events（service_role のみ）。予約・タスクの値には触らない。
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
const OK_HOST = /(^|\.)(nosh2318\.github\.io|buddica-touring\.github\.io|hdm-rentacar\.jp|rent-handyman\.com|rent-handyman\.jp|keydrop\.jp|lin\.ee|line\.me|square\.link|squareup\.com|checkout\.square\.site)$/i;
const FALLBACK = "https://hdm-rentacar.jp/official-mypage-find.html";

function decode(mid: string): { store: string; kind: string; resv: string } | null {
  try {
    const b = mid.replace(/-/g, "+").replace(/_/g, "/");
    const s = decodeURIComponent(escape(atob(b + "===".slice((b.length + 3) % 4))));
    const [store, kind, resv] = s.split("|");
    if (!store || !kind) return null;
    return { store: store.slice(0, 8), kind: kind.slice(0, 60), resv: String(resv || "").slice(0, 80) };
  } catch { return null; }
}
async function log(mid: string, ev: string, req: Request, url: string | null) {
  const d = decode(mid); if (!d) return;
  try {
    await fetch(`${SB_URL}/rest/v1/mail_track_events`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ mid: mid.slice(0, 200), ev, store: d.store, kind: d.kind, resv_no: d.resv, url: url ? url.slice(0, 500) : null, ua: (req.headers.get("user-agent") || "").slice(0, 300) }),
    });
  } catch (_) { /* 記録失敗でもお客様の表示・転送は止めない */ }
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const o = u.searchParams.get("o"), c = u.searchParams.get("c");
  if (o) {
    await log(o, "open", req, null);
    return new Response(GIF, { headers: { "content-type": "image/gif", "cache-control": "no-store, no-cache, must-revalidate, max-age=0", pragma: "no-cache" } });
  }
  if (c) {
    let to = FALLBACK;
    try { const t = new URL(u.searchParams.get("u") || ""); if (t.protocol === "https:" && OK_HOST.test(t.hostname)) to = t.toString(); } catch (_) { /* */ }
    await log(c, "click", req, to);
    return new Response(null, { status: 302, headers: { location: to, "cache-control": "no-store" } });
  }
  return new Response("ok");
});
