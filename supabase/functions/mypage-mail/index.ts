// mypage-mail — 新マイページ「通知を受け取るメールアドレス」の登録（3店共通）
//   2026-11-08 nosh「楽天ユーザーのみアドレスがとれない。取得登録の仕掛けが必要」
//   ・楽天の予約後メール（楽天の管理画面から送信）でマイページへ案内 → ここで登録 → 以後の通知はメールで届く
//   ・同じコードを2つのプロジェクトに入れる：main（nha=nha_reservations / spk=reservations）、BT（tkm=bt_reservations）
//   ・予約のメールが空のとき、または前にマイページで登録したアドレスのときだけ書き換える（予約サイトのアドレスは上書きしない）
//   ・action: get → {has_mail, mail(伏せ字)} / set {mail}
// deploy: --no-verify-jwt   secrets: SLACK_BOT_TOKEN（任意）
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json", "x-hdm-actor": "customer:mypage-mail" };
const IS_BT = SB_URL.includes("ggqugvyskyiblxiycpci");
const RESV: Record<string, string> = IS_BT ? { tkm: "bt_reservations" } : { spk: "reservations", nha: "nha_reservations" };
const CH: Record<string, string> = { nha: Deno.env.get("NUDGE_CH_NHA") || Deno.env.get("STAFF_DONE_CHANNEL_NHA") || "C06L91W6T08", spk: Deno.env.get("NUDGE_CH_SPK") || "C0B66BVCSPM", tkm: Deno.env.get("NUDGE_CH_TKM") || "C0B66BVCSPM" };
const LABEL: Record<string, string> = { nha: "那覇", spk: "札幌", tkm: "高松" };
const ALLOWED = ["https://nosh2318.github.io", "https://rent-handyman.com", "https://keydrop.jp", "https://hdm-rentacar.jp"];
function cors(o: string | null) { const a = o && ALLOWED.includes(o) ? o : ALLOWED[0]; return { "Access-Control-Allow-Origin": a, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Vary": "Origin" }; }
function json(b: unknown, s: number, o: string | null) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors(o), "content-type": "application/json" } }); }
const enc = encodeURIComponent;
const S = (v: unknown, n = 300) => String(v ?? "").trim().slice(0, n);
async function sbGet(path: string): Promise<any[]> { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json().catch(() => []) : []; }
async function sbPatch(t: string, q: string, b: unknown): Promise<number> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(b) }); if (!r.ok) { console.error("patch", t, await r.text()); return -1; } const d = await r.json().catch(() => []); return Array.isArray(d) ? d.length : 0; }
async function sbInsert(t: string, b: unknown) { const r = await fetch(`${SB_URL}/rest/v1/${t}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(b) }); if (!r.ok) console.error("insert", t, await r.text()); return r.ok; }
async function slack(ch: string, text: string) { const tk = Deno.env.get("SLACK_BOT_TOKEN"); if (!tk) return; try { await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel: ch, text }) }); } catch (_) { /* noop */ } }
// 全角→半角、前後の空白・「mailto:」を除く
function normMail(v: string): string { return v.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\s+/g, "").replace(/^mailto:/i, "").toLowerCase(); }
const MAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
// 楽天などの中継アドレス（お客様に届かない）は「登録なし」とみなす
const RELAY_RE = /@(.*\.)?(rakuten\.co\.jp|rakuten\.com)$/i;
const usable = (m: string) => !!m && MAIL_RE.test(m) && !RELAY_RE.test(m);
function mask(m: string): string { const [u, d] = m.split("@"); return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "*".repeat(Math.min(6, u.length - 2))) + "@" + d; }

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  let p: any = {}; try { p = await req.json(); } catch { return json({ error: "invalid json" }, 400, origin); }
  const store = RESV[p.store] ? p.store : "";
  const token = S(p.token, 200), action = S(p.action, 20) || "get";
  if (!store || token.length < 16 || !["get", "set"].includes(action)) return json({ ok: false, error: "bad request" }, 400, origin);
  const T = RESV[store];
  const r = (await sbGet(`${T}?mypage_token=eq.${enc(token)}&select=id,name,mail,ota&limit=1`))[0] || null;
  if (!r) return json({ ok: false, error: "予約が見つかりません" }, 200, origin);
  const rid = String(r.id), curMail = normMail(S(r.mail, 200));

  if (action === "get") return json({ ok: true, has_mail: usable(curMail), mail: usable(curMail) ? mask(curMail) : "" }, 200, origin);

  const m = normMail(S(p.mail, 200));
  if (!MAIL_RE.test(m) || m.length > 120) return json({ ok: false, error: "メールアドレスをご確認ください" }, 200, origin);
  if (RELAY_RE.test(m)) return json({ ok: false, error: "楽天のアドレスには届きません。ふだんお使いのアドレスを入れてください" }, 200, origin);
  // 書き換えてよいのは「空」か「前にマイページで登録したアドレス」のときだけ
  const last = (await sbGet(`mypage_mail_log?store=eq.${store}&reservation_id=eq.${enc(rid)}&select=mail&order=created_at.desc&limit=1`))[0];
  const mine = !!last && normMail(S(last.mail)) === curMail;
  if (usable(curMail) && !mine) {
    if (curMail === m) return json({ ok: true, has_mail: true, mail: mask(m) }, 200, origin);
    return json({ ok: false, error: "このご予約にはメールアドレスが登録済みです。変えたいときは「聞く」からお知らせください" }, 200, origin);
  }
  const prev = S(r.mail, 200);
  const q = `id=eq.${enc(rid)}&` + (prev ? `mail=eq.${enc(prev)}` : `or=(mail.is.null,mail.eq.)`);
  const n = await sbPatch(T, q, { mail: m });
  if (n !== 1) return json({ ok: false, error: "保存できませんでした。もう一度お試しください" }, 200, origin);
  await sbInsert("mypage_mail_log", { store, reservation_id: rid, mail: m, prev_mail: prev || null });
  await slack(CH[store], `📧 お客様がマイページで通知用メールを登録 [${LABEL[store]}] 予約 ${rid}${r.ota ? "（" + r.ota + "）" : ""}`);
  return json({ ok: true, has_mail: true, mail: mask(m) }, 200, origin);
});
