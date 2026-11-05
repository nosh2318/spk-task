// Supabase Edge Function: erume-sheet-sync
// エルメ（Lメッセージ）フォーム回答のスプレッドシート連携 → {store}_line_links 自動取込。
// 呼び出し元: 各回答シートの Apps Script（erume-sheet-sync.gs）が新しい行だけを送る。
// 認証: ヘッダ x-sync-secret = EF シークレット ERUME_SYNC_SECRET（一致しなければ 401）。
// 列の読み方・同一予約番号のまとめ方は import_erume_auto.py（OMNI の手動CSV取込）と同じ。
// deploy: npx supabase@2.120.0 functions deploy erume-sheet-sync --use-api --no-verify-jwt
function __newKey(env: string, name: string): string { try { return (JSON.parse(Deno.env.get(env) || "{}") as Record<string, string>)[name] || ""; } catch { return ""; } }
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = (__newKey("SUPABASE_SECRET_KEYS", "edge") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const SECRET = Deno.env.get("ERUME_SYNC_SECRET") || "";

function j(o: unknown, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } }); }

// 全 key を含む列（全部）。シート連携ではタブごとに同じ質問の見出しが少し違う（例 *お届け*希望日／”お届け”希望日）ため、
// 候補の列を順に見て、その行で最初に値が入っている列を使う。
type Cols = number[];
function find(h: string[], ...keys: string[]): Cols {
  const out: number[] = [];
  for (let i = 0; i < h.length; i++) if (keys.every((k) => (h[i] || "").includes(k))) out.push(i);
  return out;
}
const or = (...xs: Cols[]): Cols => xs.flat();
function colMap(h: string[]) {
  return {
    uid: find(h, "ユーザーID"), aid: find(h, "回答ID"), aat: find(h, "回答日時"),
    lname: find(h, "LINE名"), name: find(h, "予約者名"), resv: find(h, "予約番号"), media: find(h, "予約媒体"),
    del_place: find(h, "お届け", "場所"),
    del_time: or(find(h, "お届け", "希望時刻"), find(h, "お届け", "時刻"), find(h, "お届け", "時間")),
    col_place: or(find(h, "返却", "場所"), find(h, "回収", "場所")),
    col_time: or(find(h, "返却", "希望時刻"), find(h, "返却", "時刻"), find(h, "回収", "希望時刻"), find(h, "回収", "時刻"), find(h, "返却", "時間"), find(h, "回収", "時間")),
    del_date: or(find(h, "お届け", "希望日"), find(h, "お届け日"), find(h, "貸出開始日")),
    col_date: or(find(h, "返却", "希望日"), find(h, "返却日")),
  };
}
function storeOf(h: string[]) { const s = h.join(""); return (s.includes("無料送迎") || s.includes("営業所")) ? "nha" : "spk"; }
function g(r: unknown[], cols: Cols): string {
  for (const i of cols) { const v = r[i] == null ? "" : String(r[i]).trim(); if (v) return v; }
  return "";
}

// "2026/11/05 12:34:56" → "2026-11-05T12:34:56+09:00"（タイムゾーンが無ければ日本時間とみなす）
function toTs(s: string): string | null {
  if (!s) return null;
  let t = s.replace(/\//g, "-").replace(" ", "T");
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(t)) t += "+09:00";
  return isNaN(Date.parse(t)) ? null : t;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return j({ error: "POST only" }, 405);
  if (!SECRET || req.headers.get("x-sync-secret") !== SECRET) return j({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => null);
  const header: string[] = Array.isArray(body?.header) ? body.header.map((x: unknown) => String(x ?? "")) : [];
  const rows: unknown[][] = Array.isArray(body?.rows) ? body.rows : [];
  if (!header.length) return j({ error: "header がありません" }, 400);
  const cm = colMap(header);
  if (!cm.uid.length || !cm.resv.length) return j({ error: "ユーザーID/予約番号 列が見つかりません", header }, 400);
  const store = (body?.store === "nha" || body?.store === "spk") ? body.store : storeOf(header);

  // 予約番号ごとに最新回答を採用し、空欄は古い回答の値で埋める（import_erume_auto.py と同じ）
  const rec = new Map<string, Record<string, any>>();
  let skipped = 0;
  for (const r of rows) {
    if (!Array.isArray(r)) { skipped++; continue; }
    const resv = g(r, cm.resv), uid = g(r, cm.uid);
    if (!resv || !uid || resv.includes("テスト") || /test/i.test(resv)) { skipped++; continue; }
    const aid = parseInt(g(r, cm.aid) || "0") || 0;
    const d: Record<string, string> = {
      line_user_id: uid, cust_name: g(r, cm.name), line_name: g(r, cm.lname), media: g(r, cm.media),
      del_date: g(r, cm.del_date), del_time: g(r, cm.del_time), del_place: g(r, cm.del_place),
      col_date: g(r, cm.col_date), col_time: g(r, cm.col_time), col_place: g(r, cm.col_place), aat: g(r, cm.aat),
    };
    const prev = rec.get(resv);
    if (!prev || aid > prev.answer_id) {
      const base: Record<string, any> = { ...(prev || {}) };
      for (const [k, v] of Object.entries(d)) if (v) base[k] = v;
      base.answer_id = aid; base.resv_no = resv;
      rec.set(resv, base);
    } else {
      for (const [k, v] of Object.entries(d)) if (v && !prev[k]) prev[k] = v;
    }
  }
  const out = [...rec.values()].map((d) => ({
    resv_no: d.resv_no, line_user_id: d.line_user_id, line_name: d.line_name || "", cust_name: d.cust_name || "",
    media: d.media || "", del_date: d.del_date || "", del_time: d.del_time || "", del_place: d.del_place || "",
    col_date: d.col_date || "", col_time: d.col_time || "", col_place: d.col_place || "",
    answer_id: d.answer_id || null, answered_at: toTs(d.aat || ""),
  }));
  if (body?.dry) return j({ ok: true, dry: true, store, count: out.length, skipped, sample: out.slice(0, 3) });
  if (!out.length) return j({ ok: true, store, count: 0, skipped });

  const resp = await fetch(`${SB_URL}/rest/v1/rpc/erume_links_upsert`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_store: store, p_rows: out }),
  });
  if (!resp.ok) return j({ error: (await resp.text()).slice(0, 300) }, 500);
  const n = await resp.json();
  return j({ ok: true, store, received: out.length, written: n, skipped });
});
