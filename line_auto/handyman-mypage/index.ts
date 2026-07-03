// ============================================================
// handyman-mypage : HANDYMAN 統合マイページ（全予約ユニークURL・token認証）
// 2026-07-03 / omni  ※札幌(spk)先行。那覇(nha)は後追いで STORES に追加。
// 設計思想:
//  ・token(=mypage_token) 所持＝本人（URLはLINE個別送信のみ・非公開）。KEYDROP追跡URLと同じ信頼モデル。
//  ・変更は必ず mypage_changes に追記（上書き・消失しても検出&復元できる保険）。
//  ・確定項目は reservations.mypage_locked に印を付ける → GAS再取込/タスク自動生成は上書きしない(protect相乗り)。
//  ・危険な変更(出発24h以内/キャンセル)は自動確定せず「申請→スタッフ承認」or「公式LINE」にフォールバック。
//  ・service_role は関数内のみ。deploy: --no-verify-jwt
// ============================================================

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" };

const ALLOWED = ["https://nosh2318.github.io", "https://keydrop.jp"];
function cors(o: string | null) {
  const allow = o && ALLOWED.includes(o) ? o : ALLOWED[0];
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Vary": "Origin" };
}
function json(b: unknown, s: number, o: string | null) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors(o), "content-type": "application/json" } }); }

async function sbGet(t: string, q: string): Promise<any[]> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { headers: H }); if (!r.ok) { console.error(`GET ${t}`, await r.text()); return []; } return await r.json(); }
async function sbPatch(t: string, q: string, b: unknown): Promise<boolean> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(b) }); if (!r.ok) { console.error(`PATCH ${t}`, await r.text()); return false; } const d = await r.json(); return Array.isArray(d) && d.length > 0; }
async function sbPost(t: string, b: unknown): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(b) }); if (!r.ok) console.error(`POST ${t}`, await r.text()); }

async function notifySlack(text: string): Promise<void> {
  // 一時ミュート（MYPAGE_SILENT=1 の間はSlack通知を出さない＝開発/テスト中の混乱防止）
  if (Deno.env.get("MYPAGE_SILENT") === "1") { console.log("[slack muted]", text); return; }
  const token = Deno.env.get("SLACK_BOT_TOKEN"); const ch = Deno.env.get("SLACK_KEYDROP_CHANNEL") || "C08TDTPEB36";
  if (!token) { console.log("[slack skip]", text); return; }
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel: ch, text }) }); const d = await r.json().catch(() => ({})); if (!d.ok) console.error("[slack]", JSON.stringify(d)); } catch (e) { console.error("[slack]", String(e)); }
}

// 店舗マップ（P1=spk）。那覇は resv:nha_reservations, 列エイリアスで札幌名に揃える。
const STORES: Record<string, any> = {
  spk: {
    resv: "reservations", fleet: "fleet", tasks: "tasks", label: "札幌",
    sel: "id,ota,vehicle,lend_date,return_date,lend_time,return_time,del_time,col_time,name,mail,people,price,status,insurance,opt_b,opt_c,opt_j,opt_usb,del_place,col_place,del_lat,del_lng,col_lat,col_lng,kd_status,kd_track_token,mypage_locked",
    lendTimeCol: "lend_time", returnTimeCol: "return_time",
  },
};

// 営業時間内・30分刻み（9:00〜19:00）
function validTime(t: string): boolean { const m = /^(\d{1,2}):(\d{2})$/.exec(t); if (!m) return false; const h = +m[1], mi = +m[2]; if (mi % 30 !== 0) return false; const v = h * 60 + mi; return v >= 540 && v <= 1140; }
// 出発24時間以内か（JST基準・雑に安全側）
function within24h(lendDate: string, lendTime: string): boolean {
  if (!lendDate) return false;
  const t = (lendTime && /^\d{1,2}:\d{2}$/.test(lendTime)) ? lendTime : "09:00";
  const dep = new Date(`${lendDate}T${t}:00+09:00`).getTime();
  return (dep - Date.now()) < 24 * 3600 * 1000;
}
function nowJst(slice = false): string { const s = new Date(Date.now() + 9 * 3600 * 1000).toISOString(); return slice ? s.slice(5, 16).replace("T", " ") : s.replace("Z", "+09:00"); }

// tasks を protect merge で同期（顧客入力を優先・memoに✅変更済マーカー）
// 札幌tasks: PK=_id（d-/c-/w-接頭辞で種別）・reservation_id列で予約紐付け。
async function patchTasksSpk(store: any, resId: string, delPlace: string | null, colPlace: string | null, lendTime: string | null, returnTime: string | null, labels: string[]): Promise<void> {
  const tasks = await sbGet(store.tasks, `reservation_id=eq.${encodeURIComponent(resId)}&select=_id,place,col_place,time,memo,changed_json`);
  const stamp = nowJst(true);
  const marker = `✅変更済(${stamp}):${labels.join("・")}`;
  for (const t of tasks) {
    const tp = String(t._id || "");
    const patch: Record<string, unknown> = {};
    const cj = (t.changed_json && typeof t.changed_json === "object") ? { ...t.changed_json } : {};
    const isDel = tp.startsWith("d-");
    const isCol = tp.startsWith("c-");
    if (delPlace !== null && isDel) { patch.place = delPlace; cj._ssPlace = delPlace; cj._placeSource = "customer"; }
    if (colPlace !== null && isCol) { patch.place = colPlace; cj._ssPlace = colPlace; cj._placeSource = "customer"; }
    if (colPlace !== null && isDel) { patch.col_place = colPlace; }
    if (lendTime !== null && isDel) { patch.time = lendTime; cj._ssTime = lendTime; }
    if (returnTime !== null && isCol) { patch.time = returnTime; cj._ssTime = returnTime; }
    let m = String(t.memo || ""); if (!m.includes(marker)) m = m ? `${m} ${marker}` : marker; patch.memo = m; patch.changed_json = cj;
    if (Object.keys(patch).length) await sbPatch(store.tasks, `_id=eq.${encodeURIComponent(String(t._id))}`, patch);
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  let p: any; try { p = await req.json(); } catch { return json({ error: "bad json" }, 400, origin); }

  const action = String(p.action || "lookup").trim();
  const token = String(p.token || "").trim();
  if (!token || token.length < 20) return json({ error: "アクセスキーが不正です" }, 400, origin);

  // token で予約特定（P1=spk）。将来 nha も同 token 空間で探索。
  const store = STORES.spk;
  const rows = await sbGet(store.resv, `mypage_token=eq.${encodeURIComponent(token)}&select=${store.sel}`);
  const r = rows[0];
  if (!r) return json({ error: "予約が見つかりません" }, 404, origin);
  const resId = String(r.id);

  // ---- lookup: マイページ表示（正本を1画面に集約）----
  if (action === "lookup") {
    // 傷チェック解禁: 出発日の8:00以降のみ（それ以前は準備中でぼかす）
    const today = nowJst().slice(0, 10);
    const hh = +nowJst().slice(11, 13);
    const damageReady = (!!r.lend_date && (r.lend_date < today || (r.lend_date === today && hh >= 8)));
    let damageUrl: string | null = null;
    if (damageReady) {
      // fleet→vehicle_code→vehicles.plate→vehicle_twins.share_token（best-effort）
      try {
        const fl = await sbGet(store.fleet, `reservation_id=eq.${encodeURIComponent(resId)}&select=vehicle_code`);
        const code = fl[0]?.vehicle_code;
        if (code) {
          const vs = await sbGet("vehicles", `code=eq.${encodeURIComponent(code)}&select=plate_no`);
          const plate = vs[0]?.plate_no;
          if (plate) {
            const tw = await sbGet("vehicle_twins", `display_label=ilike.*${encodeURIComponent(plate)}*&share_enabled=eq.true&select=share_token&limit=1`);
            if (tw[0]?.share_token) damageUrl = `https://nosh2318.github.io/handyman-damage/v.html?t=${tw[0].share_token}&v=v3`;
          }
        }
      } catch (_) { /* 取れなければ準備中扱い */ }
    }
    const chg = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&order=created_at.desc&limit=5&select=field,new_value,status,created_at`);
    const pendingCancel = chg.some((c: any) => c.field === "cancel" && c.status === "requested");
    return json({
      ok: true, store: "spk", label: store.label,
      reservation: {
        id: r.id, vehicle: r.vehicle, lend_date: r.lend_date, return_date: r.return_date,
        lend_time: r.lend_time || r.del_time || "", return_time: r.return_time || r.col_time || "",
        name: r.name, people: r.people, status: r.status, insurance: r.insurance,
        del_place: r.del_place || "", col_place: r.col_place || "",
        del_lat: r.del_lat ?? null, del_lng: r.del_lng ?? null, col_lat: r.col_lat ?? null, col_lng: r.col_lng ?? null,
        opt_b: r.opt_b || 0, opt_c: r.opt_c || 0, opt_j: r.opt_j || 0, opt_usb: r.opt_usb || 0,
        kd_status: r.kd_status || null,
      },
      damage: { ready: damageReady, url: damageUrl },
      tracking: { active: r.kd_status === "delivering" || r.kd_status === "collecting", kd_status: r.kd_status || null, token: r.kd_track_token || null },
      pendingCancel, recentChanges: chg,
    }, 200, origin);
  }

  const st = String(r.status || "");
  const cancelled = st === "cancelled" || st === "キャンセル" || st === "cancel";

  // ---- update: 場所/時間のみ 即時反映（顧客が自分で確定できる低制約項目）----
  if (action === "update") {
    if (cancelled) return json({ error: "キャンセル済みの予約は変更できません" }, 409, origin);
    const has = (k: string) => Object.prototype.hasOwnProperty.call(p, k);
    const delPlace = has("del_place") ? String(p.del_place || "").trim() : null;
    const colPlace = has("col_place") ? String(p.col_place || "").trim() : null;
    const lendTime = has("lend_time") ? String(p.lend_time || "").trim() : null;
    const returnTime = has("return_time") ? String(p.return_time || "").trim() : null;
    // 24h判定は「お届け系＝お届け日時基準」「回収系＝回収日時基準」で別々に。
    // （本日お届けでも回収が数日後なら回収の変更は可能）
    const touchesDel = delPlace !== null || lendTime !== null;
    const touchesCol = colPlace !== null || returnTime !== null;
    if (touchesDel && within24h(r.lend_date, r.lend_time || r.del_time || "")) return json({ error: "お届けの24時間前を過ぎているため、お届けの変更は公式LINEにて承ります", lineOnly: true }, 409, origin);
    if (touchesCol && within24h(r.return_date, r.return_time || r.col_time || "")) return json({ error: "回収の24時間前を過ぎているため、回収の変更は公式LINEにて承ります", lineOnly: true }, 409, origin);
    if (delPlace !== null && delPlace.length < 2) return json({ error: "お届け場所が不正です" }, 400, origin);
    if (colPlace !== null && colPlace.length < 2) return json({ error: "回収場所が不正です" }, 400, origin);
    if (lendTime !== null && !validTime(lendTime)) return json({ error: "お届け時間は9:00〜19:00（30分刻み）で指定してください" }, 400, origin);
    if (returnTime !== null && !validTime(returnTime)) return json({ error: "回収時間は9:00〜19:00（30分刻み）で指定してください" }, 400, origin);
    if (delPlace === null && colPlace === null && lendTime === null && returnTime === null) return json({ error: "変更内容がありません" }, 400, origin);

    const rPatch: Record<string, unknown> = {};
    const locked = (r.mypage_locked && typeof r.mypage_locked === "object") ? { ...r.mypage_locked } : {};
    const changes: any[] = []; const labels: string[] = [];
    const mark = (f: string, oldV: any, newV: any) => { locked[f] = { at: nowJst(), by: "customer" }; changes.push({ reservation_id: resId, store: "spk", field: f, old_value: String(oldV ?? ""), new_value: String(newV ?? ""), source: "customer", status: "applied" }); };
    // 緯度経度（地図ピンで確定した座標・任意）
    const num = (k: string) => (has(k) && p[k] != null && p[k] !== "") ? Number(p[k]) : null;
    const dLat = num("del_lat"), dLng = num("del_lng"), cLat = num("col_lat"), cLng = num("col_lng");
    if (delPlace !== null) { rPatch.del_place = delPlace; if (dLat != null && dLng != null) { rPatch.del_lat = dLat; rPatch.del_lng = dLng; } mark("del_place", r.del_place, delPlace); labels.push("お届け場所"); }
    if (colPlace !== null) { rPatch.col_place = colPlace; if (cLat != null && cLng != null) { rPatch.col_lat = cLat; rPatch.col_lng = cLng; } mark("col_place", r.col_place, colPlace); labels.push("回収場所"); }
    if (lendTime !== null) { rPatch[store.lendTimeCol] = lendTime; rPatch.del_time = lendTime; mark("lend_time", r.lend_time, lendTime); labels.push("お届け時間"); }
    if (returnTime !== null) { rPatch[store.returnTimeCol] = returnTime; rPatch.col_time = returnTime; mark("return_time", r.return_time, returnTime); labels.push("回収時間"); }
    rPatch.mypage_locked = locked;

    const ok = await sbPatch(store.resv, `id=eq.${encodeURIComponent(resId)}`, rPatch);
    if (!ok) return json({ error: "変更の保存に失敗しました" }, 500, origin);
    // 監査ログ（追記）＋ tasks 同期（protect）
    for (const c of changes) await sbPost("mypage_changes", c);
    await patchTasksSpk(store, resId, delPlace, colPlace, lendTime, returnTime, labels);
    await notifySlack(`📝 *マイページ変更(即反映)* [札幌] ${r.name}様 ${resId}\n変更: ${labels.join("・")}\n→ お届け先:${(rPatch.del_place ?? r.del_place) || "-"} / 回収先:${(rPatch.col_place ?? r.col_place) || "-"} / 出発:${(rPatch.del_time ?? r.lend_time) || "-"} / 返却:${(rPatch.col_time ?? r.return_time) || "-"}\n※OPシートに✅変更済マーカー反映済`);
    return json({ ok: true, updated: labels }, 200, origin);
  }

  // ---- request: 承認制の依頼（有料オプション/シート類・貸出返却方法(区分)変更）。即反映しない ----
  if (action === "request") {
    if (cancelled) return json({ error: "キャンセル済みの予約は変更できません" }, 409, origin);
    const reqType = String(p.req_type || "").trim(); // "option" | "method" | "insurance"
    const detail = String(p.detail || "").trim().slice(0, 300);
    const map: Record<string, string> = { option: "有料オプション(シート類)変更", method: "貸出/返却方法(区分)変更", insurance: "補償(免責)変更" };
    if (!map[reqType]) return json({ error: "リクエスト種別が不正です" }, 400, origin);
    if (detail.length < 1) return json({ error: "変更内容を入力してください" }, 400, origin);
    const already = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&field=eq.${reqType}&status=eq.requested&select=id&limit=1`);
    if (already[0]) return json({ ok: true, alreadyRequested: true, message: "同じ内容の依頼を受付済みです" }, 200, origin);
    await sbPost("mypage_changes", { reservation_id: resId, store: "spk", field: reqType, old_value: "", new_value: detail, source: "customer", status: "requested", note: map[reqType] });
    await notifySlack(`🟡 *${map[reqType]}の依頼* [札幌] ${r.name}様 ${resId}\n利用:${r.lend_date}〜${r.return_date} / ${r.vehicle}\n依頼内容: ${detail}\n→ 管理コンソールで対応/反映してください（即時反映されていません）`);
    return json({ ok: true, requested: true, kind: map[reqType] }, 200, origin);
  }

  // ---- cancel_request: キャンセル依頼（即削除しない＝OTA予約の安全側。スタッフ承認制）----
  if (action === "cancel_request") {
    if (cancelled) return json({ ok: true, alreadyCancelled: true }, 200, origin);
    const reason = String(p.reason || "").trim().slice(0, 200);
    const already = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&field=eq.cancel&status=eq.requested&select=id&limit=1`);
    if (already[0]) return json({ ok: true, alreadyRequested: true }, 200, origin);
    await sbPost("mypage_changes", { reservation_id: resId, store: "spk", field: "cancel", old_value: st, new_value: "キャンセル依頼", source: "customer", status: "requested", note: reason });
    await notifySlack(`🔴 *キャンセル依頼* [札幌] ${r.name}様 ${resId}\n利用:${r.lend_date}〜${r.return_date} / ${r.vehicle}\n理由:${reason || "(なし)"}\n→ 管理コンソールで承認/却下してください`);
    return json({ ok: true, requested: true }, 200, origin);
  }

  return json({ error: "unknown action" }, 400, origin);
});
