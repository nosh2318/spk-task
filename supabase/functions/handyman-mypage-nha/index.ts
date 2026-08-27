// ============================================================
// handyman-mypage-nha : HANDYMAN 統合マイページ 那覇（内部カルテ閲覧・lookup専用）
// 2026-07-08 / omni  ※札幌 handyman-mypage を複製元に、那覇の日本語列・受け渡し区分へ作り替え。
// 一旦のゴール（オーナー確定 2026-07-08）＝内部カルテ閲覧まで。顧客への開示/通知は範囲外。
// このEFは lookup / ping のみ（読み取り専用）。update/request/decide/cancel 等の書込系は今回は作らない。
// 設計思想:
//  ・token(=mypage_token) 所持＝本人。URLはスタッフが ro=1 で閲覧専用に開く前提。
//  ・場所/時間は「nha_reservations と nha_tasks の実値ある方」を採る（札幌 resolveTaskPlace/Time と同思想）。
//  ・受け渡し区分(visit_type/return_type)はそのまま返す。表示分岐(バス/個別時間)はページ側(my-nha.html)。
//  ・service_role は関数内のみ。deploy: --no-verify-jwt
// 那覇の箱:
//  nha_reservations : id,ota,name,start_date,start_time,end_date,end_time,vehicle_class,vehicle_name,
//                     insurance,people,price,status,visit_type,return_type,del_time,del_place,col_time,col_place,
//                     del_flight,opt_b,opt_c,opt_j,opt_usb,mypage_token
//  nha_tasks(日本語列): _id(d-/c-/w-),内容,時間,予約者,担当,予約番号,送迎場所(place),集客(colPlace),
//                     返却(returnTime),送迎(returnType),クラス,確定(insurance),便名,変更(timeChange),changed_json(text)
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
async function sbPost(t: string, b: unknown): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(b) }); if (!r.ok) console.error(`POST ${t}`, await r.text()); }
async function sbPatch(t: string, q: string, b: unknown): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(b) }); if (!r.ok) console.error(`PATCH ${t}`, await r.text()); }
async function sbDelete(t: string, q: string): Promise<void> { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { method: "DELETE", headers: H }); if (!r.ok) console.error(`DELETE ${t}`, await r.text()); }
// 予約完了・キャンセルは予約通知ch #okinawa_reservation_notification
async function slackResv(text: string, blocks?: unknown): Promise<boolean> {
  const token = Deno.env.get("SLACK_BOT_TOKEN"); const ch = Deno.env.get("SLACK_NHA_RESV_CHANNEL") || "C06KZ56NTDF";
  if (!token) return false;
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: ch, text, blocks }) }); const j = await r.json(); return !!j.ok; } catch { return false; }
}
// 顧客へメール通知（LINEは当面使わずメールのみ・2026-08-27 オーナー指示）
// rent-handyman.com は MAIN の Resend では送れないため BT project の notice-mail-send 経由で送る。
const BT_NOTICE_URL = "https://ggqugvyskyiblxiycpci.supabase.co/functions/v1/notice-mail-send";
const BT_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncXVndnlza3lpYmx4aXljcGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDc3NjksImV4cCI6MjA5MzY4Mzc2OX0.uNhWcBd_Dl5nzemZDQfJ8mQV6iY73MwystGGpTRPC18";
async function mailCustomer(resvNo: string, subject: string, text: string): Promise<void> {
  const secret = Deno.env.get("NOTICE_MAIL_SECRET");
  if (!secret) { console.log("[mail skip] no NOTICE_MAIL_SECRET", resvNo); return; }
  try {
    const r = await fetch(BT_NOTICE_URL, {
      method: "POST", headers: { "content-type": "application/json", apikey: BT_ANON, Authorization: `Bearer ${BT_ANON}` },
      body: JSON.stringify({ secret, store: "nha", resv_no: resvNo, subject, text, allow_cancel: true }),
    });
    const d = await r.json().catch(() => ({})); if (!(d as any).ok) console.log("[notice-mail]", JSON.stringify(d));
  } catch (e) { console.error("[notice-mail]", String(e)); }
}
// Slack通知（那覇のマイページ操作＝#okinawa_operations-team / 環境変数で上書き可）
async function slackPost(text: string, blocks?: unknown): Promise<boolean> {
  const token = Deno.env.get("SLACK_BOT_TOKEN"); const ch = Deno.env.get("SLACK_NHA_USER_CHANNEL") || "C06L91W6T08";
  if (!token || !ch) return false;
  try { const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: ch, text, blocks }) }); const j = await r.json(); return !!j.ok; } catch { return false; }
}

// 予約もと（OTA）ラベル
const OTA_JP: Record<string, string> = { J: "じゃらん", R: "楽天", S: "skyticket", O: "エアトリ", RC: "レンタカーcom", G: "GoGoOut", HP: "オフィシャル(HP)", SP: "オフィシャル(HP)", direct: "直販", KEYDROP: "KEYDROP" };
function otaJp(o?: string): string { const k = String(o || ""); return OTA_JP[k] || k || "—"; }

function nowJst(slice = false): string { const s = new Date(Date.now() + 9 * 3600 * 1000).toISOString(); return slice ? s.slice(5, 16).replace("T", " ") : s.replace("Z", "+09:00"); }

// changed_json は text型 → JSON.parse 必須。オブジェクトならそのまま。
function parseCj(t: any): any {
  let cj = t && t.changed_json;
  if (typeof cj === "string") { try { cj = JSON.parse(cj); } catch { cj = {}; } }
  return cj || {};
}
// OPシート/my-admin と同一の場所解決式（那覇：place=送迎場所）。
// _placeSource==="manual" なら手入力(place)を優先、それ以外は SSパトロール値(_ssPlace) を優先。
function resolveTaskPlace(t: any): string {
  if (!t) return "";
  const cj = parseCj(t);
  const place = String(t.place || "");
  if (cj._placeSource === "manual") return place;
  return String(cj._ssPlace || place || "");
}
function resolveTaskTime(t: any): string {
  if (!t) return "";
  const cj = parseCj(t);
  return String(t.timeChange || cj._timeChange || cj._ssTime || t.time || "");  // OPシートと同じ優先(OPの「変更」列=timeChangeを最優先)
}
function taskOptNum(t: any, key: string): number {
  if (!t) return 0;
  const cj = parseCj(t);
  return Number(cj[key]) || 0;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  let p: any; try { p = await req.json(); } catch { return json({ error: "bad json" }, 400, origin); }

  const action = String(p.action || "lookup").trim();

  // ==== keep-warm ping（DB不使用・即応答）====
  if (action === "ping") return json({ ok: true, warm: true, store: "nha" }, 200, origin);

  // ==== 承認/却下（スタッフ操作・早め回収リクエスト等）＝📲マイページ利用状況から呼ぶ ====
  if (action === "decide") {
    // 認証: (a) 共通PIN（全店ダッシュボード・目視承認）／(b) スタッフJWT。どちらか一方でOK。
    const ADMIN_PIN = Deno.env.get("ADMIN_PIN") || "";
    const adminPin = String(p.admin_pin || "");
    let actor = "";
    if (ADMIN_PIN && adminPin && adminPin === ADMIN_PIN) { actor = "staff:admin_pin"; }
    else {
      const staffToken = String(p.staff_token || "").trim();
      if (!staffToken) return json({ error: "スタッフ認証（PIN）が必要です" }, 401, origin);
      const who = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${staffToken}` } });
      if (!who.ok) return json({ error: "認証に失敗しました" }, 401, origin);
      const wj: any = await who.json().catch(() => ({}));
      actor = "staff:" + (wj?.email || wj?.id || "unknown");
    }
    const changeId = p.change_id;
    const decision = String(p.decision || "").trim();
    if (!changeId || (decision !== "approved" && decision !== "rejected")) return json({ error: "パラメータ不正" }, 400, origin);
    const cRows = await sbGet("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}&store=eq.nha&select=id,reservation_id,field,new_value,status`);
    const c = cRows[0];
    if (!c) return json({ error: "対象が見つかりません" }, 404, origin);
    if (c.status !== "requested") return json({ error: "処理済みです", status: c.status }, 409, origin);
    const resId2 = String(c.reservation_id);
    // ---- キャンセル承認/却下（HP直販・承認必須。返金は手動Square）----
    if (c.field === "cancel") {
      await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}`, { status: decision, actor });
      const cr = (await sbGet("nha_reservations", `id=eq.${encodeURIComponent(resId2)}&select=name,ota,start_date,end_date,vehicle_class,price`))[0] || {};
      if (decision === "approved") {
        await sbPatch("nha_reservations", `id=eq.${encodeURIComponent(resId2)}`, { status: "キャンセル" });
        await sbDelete("nha_fleet", `reservation_id=eq.${encodeURIComponent(resId2)}`);
        await mailCustomer(resId2, `【HANDYMAN那覇空港店】ご予約 ${resId2} キャンセル受付のご連絡`,
          `${cr.name || "お客様"} 様\n\nこの度はご連絡いただきありがとうございます。\nご予約 ${resId2}（${cr.start_date || ""}〜${cr.end_date || ""}）のキャンセルを承りました。\n\n返金がある場合は、規定に沿って別途手続きのうえご連絡いたします。\nまたのご利用を心よりお待ちしております。\n\nHANDYMAN那覇空港店\nreserve@rent-handyman.com`);
        await slackResv(`✅ キャンセル承認（確定）[那覇] ${cr.name || ""} / ${resId2}`, [
          { type: "header", text: { type: "plain_text", text: "✅ キャンセル承認（確定）", emoji: true } },
          { type: "section", fields: [
            { type: "mrkdwn", text: `*お客様:*\n${cr.name || "-"} 様` }, { type: "mrkdwn", text: `*予約番号:*\n${resId2}` },
            { type: "mrkdwn", text: `*利用期間:*\n${cr.start_date || "-"} 〜 ${cr.end_date || "-"}` }, { type: "mrkdwn", text: `*金額:*\n¥${Number(cr.price || 0).toLocaleString()}` },
          ] },
          { type: "context", elements: [ { type: "mrkdwn", text: `キャンセル確定・配車解放済み。⚠️ 返金は規定（7日前無料/6-3日20%/2日前・前日30%/当日50%）に沿って Square で手動返金してください。承認: ${actor.replace(/^staff:/, "")}` } ] },
        ]);
      } else {
        await mailCustomer(resId2, `【HANDYMAN那覇空港店】ご予約 ${resId2} キャンセルのご相談につきまして`,
          `${cr.name || "お客様"} 様\n\nお問い合わせいただいたご予約 ${resId2} のキャンセルにつきまして、恐れ入りますが今回はお受けいたしかねます。\n詳細は担当より別途ご連絡いたします。\n\nHANDYMAN那覇空港店\nreserve@rent-handyman.com`);
        await slackResv(`🚫 キャンセル却下 [那覇] ${cr.name || ""} / ${resId2} ／ ${actor.replace(/^staff:/, "")}`);
      }
      return json({ ok: true, decided: decision }, 200, origin);
    }
    let msg: string;
    if (decision === "approved") {
      msg = c.field === "ready"
        ? `【HANDYMAN 那覇】早めのご返却（回収）を承りました。\nスケジュールを調整し、回収時間が早まる場合は改めてご連絡いたします。`
        : `【HANDYMAN 那覇】ご依頼を承り、反映いたしました。マイページよりご確認ください。`;
    } else {
      msg = c.field === "ready"
        ? `【HANDYMAN 那覇】ご連絡ありがとうございます。今回は予定のお時間での回収を予定しております。何卒よろしくお願いいたします。`
        : `【HANDYMAN 那覇】ご依頼につきまして、恐れ入りますが今回はお受けいたしかねます。詳細は公式LINEにてご連絡いたします。`;
    }
    await mailCustomer(resId2, `【HANDYMAN那覇空港店】ご予約 ${resId2} ご依頼の結果`, msg.replace(/公式LINE/g, "担当") + `\n\nHANDYMAN那覇空港店\nreserve@rent-handyman.com`);  // 予約有効なうちに先に送る
    await sbPatch("mypage_changes", `id=eq.${encodeURIComponent(String(changeId))}`, { status: decision, actor });
    // ★ 早め回収(ready)を承認し、希望時間(HH:MM)がある場合は諸々の表示へ自動反映
    //   ①nha_reservations.col_time/end_time ②nha_tasks の c-<予約>「変更」(＋「時間」) ③mypage_changes field=return_time status=applied
    if (decision === "approved" && c.field === "ready") {
      const hopeR = String(c.new_value || "").match(/(\d{1,2}:\d{2})/);
      if (hopeR) {
        const hope = hopeR[1];
        // ① 予約(正本)の回収時間
        await sbPatch("nha_reservations", `id=eq.${encodeURIComponent(resId2)}`, { col_time: hope, end_time: hope });
        // ② COLタスク c-<予約> の「変更」(＋「時間」)＝希望時間 → OP表示に反映
        const cRows2 = await sbGet("nha_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId2)}&deleted=not.is.true&select=_id`);
        const cId = (cRows2 || []).map((t: any) => String(t._id || "")).find((id: string) => id.startsWith("c-"));
        if (cId) {
          const patch: Record<string, string> = {}; patch["変更"] = hope; patch["時間"] = hope;
          await sbPatch("nha_tasks", `_id=eq.${encodeURIComponent(cId)}`, patch);
        }
        // ③ 適用済み変更としてマイページ回収時間へ反映（appliedChg("return_time")が最優先で拾う）
        await sbPost("mypage_changes", { reservation_id: resId2, store: "nha", field: "return_time", old_value: "", new_value: hope, source: "staff", status: "applied", actor, note: "早め回収 承認による回収時間反映" });
      }
    }
    const dRows = await sbGet("nha_reservations", `id=eq.${encodeURIComponent(resId2)}&select=name,ota,col_time,end_time`);
    const dr = dRows[0] || {};
    const hopeM = String(c.new_value || "").match(/(\d{1,2}:\d{2})/);
    const staffName = actor.replace(/^staff:/, "").replace(/@.*$/, "");
    const ok2 = decision === "approved";
    const dBlocks = [
      { type: "header", text: { type: "plain_text", text: ok2 ? "✅ 早め回収を承認しました" : "🚫 早め回収を見送りました", emoji: true } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*👤 お客様*\n${dr.name || "-"} 様` },
        { type: "mrkdwn", text: `*🎫 予約番号*\n${resId2}` },
        { type: "mrkdwn", text: `*🏷 ご予約元*\n${otaJp(dr.ota)}` },
        { type: "mrkdwn", text: `*🕐 予定の回収*\n${dr.col_time || dr.end_time || "-"}` },
        { type: "mrkdwn", text: `*🟢 お客様の希望*\n${hopeM ? `${hopeM[1]}〜` : "指定なし"}` },
        { type: "mrkdwn", text: `*🧑‍💼 対応者*\n${staffName}` },
      ] },
      { type: "context", elements: [ { type: "mrkdwn", text: ok2 ? "📩 お客様へ「早めの回収を承りました」とLINE送信済み" : "📩 お客様へ「予定のお時間で回収します」とLINE送信済み" } ] },
    ];
    await slackPost(`${ok2 ? "✅ 承認" : "🚫 見送り"} [那覇] 早め回収 / ${resId2}`, dBlocks);
    return json({ ok: true, decided: decision }, 200, origin);
  }

  if (action !== "lookup" && action !== "license_uploaded" && action !== "ready" && action !== "cancel_request") return json({ error: "unsupported action" }, 400, origin);

  const token = String(p.token || "").trim();
  if (!token || token.length < 20) return json({ error: "アクセスキーが不正です" }, 400, origin);

  // token で予約特定（那覇 nha_reservations）
  const SEL = "id,ota,name,start_date,start_time,end_date,end_time,vehicle_class,vehicle_name,insurance,people,price,status,visit_type,return_type,del_time,del_place,col_time,col_place,del_flight,opt_b,opt_c,opt_j,opt_usb,mypage_token,kd_status,kd_track_token,del_lat,del_lng,col_lat,col_lng";
  const rows = await sbGet("nha_reservations", `mypage_token=eq.${encodeURIComponent(token)}&select=${SEL}`);
  const r = rows[0];
  if (!r) return json({ error: "予約が見つかりません" }, 404, origin);
  const resId = String(r.id);

  // ---- license_uploaded: お客様がマイページから免許証をアップした完了通知（Slack・那覇） ----
  if (action === "license_uploaded") {
    const cnt = Math.max(1, Math.min(20, parseInt(String(p.count || 1), 10) || 1));
    const drivers = Math.max(1, Math.min(10, parseInt(String(p.drivers || 1), 10) || 1));
    const blocks = [
      { type: "header", text: { type: "plain_text", text: "🪪 免許証アップロード（お客様）", emoji: true } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"}` },
        { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
        { type: "mrkdwn", text: `*ご予約元:*\n${r.ota || "-"}` },
        { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
        { type: "mrkdwn", text: `*車両クラス:*\n${r.vehicle_class || r.vehicle_name || "-"}` },
        { type: "mrkdwn", text: `*アップ枚数:*\n${cnt}枚（運転者${drivers}名）` },
      ] },
      { type: "context", elements: [ { type: "mrkdwn", text: "Googleドライブ（那覇フォルダ）に保存済み。貸渡手続きにご利用ください。" } ] },
    ];
    // OPシート「🪪免許OK」表示用にDB記録（upsert）
    try { await fetch(`${SB_URL}/rest/v1/license_uploads?on_conflict=reservation_id`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ reservation_id: resId, store: "nha", cnt, drivers, last_at: new Date().toISOString() }) }); } catch (_) { /* noop */ }
    await slackPost(`🪪 免許証アップロード完了 [那覇] ${r.name || ""} / ${resId} / ${cnt}枚`, blocks);
    return json({ ok: true }, 200, origin);
  }

  // ---- cancel_request: HP直販予約のキャンセル申請（承認必須）。OTA予約は各OTAから申請＝受け付けない ----
  if (action === "cancel_request") {
    const st0 = String(r.status || "");
    if (st0 === "キャンセル" || st0 === "cancelled" || st0 === "cancel") return json({ ok: true, alreadyCancelled: true }, 200, origin);
    const isHP = ["HANDYMAN", "KEYDROP", "HP", "SP", "direct"].includes(String(r.ota || "")) || resId.indexOf("HDMN") === 0;
    if (!isHP) return json({ error: "OTAでご予約の場合は、ご予約された各OTAサイトからキャンセルをお申し込みください。", otaOnly: true }, 400, origin);
    const reason = String(p.reason || "").trim().slice(0, 300);
    const already = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.nha&field=eq.cancel&status=eq.requested&select=id&limit=1`);
    if (already[0]) return json({ ok: true, alreadyRequested: true }, 200, origin);
    await sbPost("mypage_changes", { reservation_id: resId, store: "nha", field: "cancel", old_value: st0, new_value: "キャンセル依頼", source: "customer", status: "requested", note: reason });
    await slackResv(`🔴 キャンセル申請（承認待ち）[那覇] ${r.name || ""} / ${resId}`, [
      { type: "header", text: { type: "plain_text", text: "🔴 キャンセル申請（承認待ち）", emoji: true } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*お客様:*\n${r.name || "-"} 様` }, { type: "mrkdwn", text: `*予約番号:*\n${resId}` },
        { type: "mrkdwn", text: `*ご予約元:*\n${otaJp(r.ota)}` }, { type: "mrkdwn", text: `*利用期間:*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
        { type: "mrkdwn", text: `*車両:*\n${r.vehicle_class || r.vehicle_name || "-"}` }, { type: "mrkdwn", text: `*金額:*\n¥${Number(r.price || 0).toLocaleString()}` },
      ] },
      { type: "section", text: { type: "mrkdwn", text: `*理由:*\n${reason || "（記載なし）"}` } },
      { type: "actions", elements: [ { type: "button", text: { type: "plain_text", text: "✅ 承認画面を開く", emoji: true }, style: "primary", url: "https://nosh2318.github.io/naha-project/mypage-usage-nha.html" } ] },
      { type: "context", elements: [ { type: "mrkdwn", text: "⚠️ 承認制です。上のボタン（または「📲マイページ利用状況(那覇)」→承認待ち）で承認/却下（承認＝キャンセル確定＋配車解放。返金は規定に沿って手動Square返金）。" } ] },
    ]);
    return json({ ok: true, requested: true }, 200, origin);
  }

  // ---- ready: お客様が「返却準備完了(早め回収OK)」を申請（DEL/COL）→ 承認待ち ＋ Slack通知 ----
  if (action === "ready") {
    if (r.status === "キャンセル" || r.status === "cancelled" || r.status === "cancel") return json({ error: "キャンセル済みの予約です" }, 409, origin);
    const already = await sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.nha&field=eq.ready&status=eq.requested&select=id&limit=1`);
    if (already[0]) return json({ ok: true, alreadyRequested: true }, 200, origin);
    const rdyTime = (typeof p.time === "string" && /^\d{1,2}:\d{2}$/.test(String(p.time).trim())) ? String(p.time).trim() : "";
    const newVal = rdyTime ? `返却準備完了(早め回収OK) 希望時間 ${rdyTime}〜` : "返却準備完了(早め回収OK)";
    await sbPost("mypage_changes", { reservation_id: resId, store: "nha", field: "ready", old_value: "", new_value: newVal, source: "customer", status: "requested", note: rdyTime ? `希望回収時間の目安 ${rdyTime}〜` : "予定時間より早い回収OK" });
    const planned = r.col_time || r.end_time || "-";
    const rBlocks = [
      { type: "header", text: { type: "plain_text", text: "🟢 早め回収リクエスト（承認待ち）", emoji: true } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*👤 お客様*\n${r.name || "-"} 様` },
        { type: "mrkdwn", text: `*🎫 予約番号*\n${resId}` },
        { type: "mrkdwn", text: `*🏷 ご予約元*\n${otaJp(r.ota)}` },
        { type: "mrkdwn", text: `*📅 利用期間*\n${r.start_date || "-"} 〜 ${r.end_date || "-"}` },
        { type: "mrkdwn", text: `*🕐 予定の回収*\n${planned}` },
        { type: "mrkdwn", text: `*🟢 お客様の希望*\n${rdyTime ? `*${rdyTime}〜*` : "指定なし"}` },
      ] },
      { type: "context", elements: [ { type: "mrkdwn", text: "👉 「📲 マイページ利用状況（那覇）」の *🟢承認待ち* で ✅承認 / 🚫却下（承認でお客様へLINE自動送信）" } ] },
    ];
    await slackPost(`🟢 早め回収リクエスト（承認待ち）[那覇] ${r.name || ""} / ${resId}`, rBlocks);
    return json({ ok: true }, 200, origin);
  }

  // 開封記録（best-effort）。★スタッフ閲覧(ro=1)は「顧客の開封」に数えない＝利用状況ダッシュボードの誤カウント防止。
  if (!p.ro) sbPost("rpc/mypage_touch_view", { p_rid: resId, p_store: "nha" }).catch(() => {});

  // OPタスク（予約番号一致・墓標除外）＋直近の変更履歴を並列取得
  const opTasksP = sbGet("nha_tasks", `${encodeURIComponent("予約番号")}=eq.${encodeURIComponent(resId)}&deleted=not.is.true&select=_id,${encodeURIComponent("内容")},${encodeURIComponent("時間")},${encodeURIComponent("送迎場所")},${encodeURIComponent("集客")},${encodeURIComponent("返却")},${encodeURIComponent("送迎")},${encodeURIComponent("確定")},${encodeURIComponent("便名")},${encodeURIComponent("変更")},changed_json`);
  const chgP = sbGet("mypage_changes", `reservation_id=eq.${encodeURIComponent(resId)}&store=eq.nha&order=created_at.desc&limit=10&select=field,old_value,new_value,source,status,actor,created_at`);
  const licP = sbGet("license_uploads", `reservation_id=eq.${encodeURIComponent(resId)}&select=cnt,drivers`);
  const [opTasksRaw, chg, licRows] = await Promise.all([opTasksP, chgP, licP]);
  const licCnt = (licRows[0] && licRows[0].cnt) || 0;
  const licDrivers = (licRows[0] && licRows[0].drivers) || 0;

  // 日本語列を札幌名に正規化して resolve* を再利用
  const opTasks = (opTasksRaw || []).map((t: any) => ({
    _id: t._id,
    place: t["送迎場所"],
    time: t["時間"],
    colPlace: t["集客"],
    returnTime: t["返却"],
    timeChange: t["変更"],
    insurance: t["確定"],
    changed_json: t.changed_json,
  }));
  const dTask = opTasks.find((t: any) => String(t._id || "").startsWith("d-"));
  const cTask = opTasks.find((t: any) => String(t._id || "").startsWith("c-"));

  // 適用済み変更(applied)を最優先（マイページ変更ログの正本）
  const appliedChg = (field: string): string | null => {
    const c = chg.find((x: any) => x.field === field && x.status === "applied");
    return c && String(c.new_value || "").trim() ? String(c.new_value).trim() : null;
  };

  // お届け(d-)：送迎場所＝place / 時間＝time。回収(c-)：回収場所は集客(colPlace) or _ssPlace、時間＝返却(returnTime) or time。
  const cColResolve = (() => {
    if (!cTask) return "";
    const cj = parseCj(cTask);
    if (cj._placeSource === "manual") return String(cTask.colPlace || cTask.place || "");
    return String(cj._ssPlace || cTask.colPlace || cTask.place || "");
  })();
  const cTimeResolve = (() => {
    if (!cTask) return "";
    const cj = parseCj(cTask);
    return String(cTask.timeChange || cj._timeChange || cj._ssTime || cTask.returnTime || cTask.time || "");
  })();

  const delPlaceR = appliedChg("del_place") ?? (resolveTaskPlace(dTask) || String(r.del_place || "").trim());
  const colPlaceR = appliedChg("col_place") ?? (cColResolve || String(r.col_place || "").trim());
  const lendTimeR = appliedChg("lend_time") ?? (resolveTaskTime(dTask) || r.start_time || r.del_time || "");
  const returnTimeR = appliedChg("return_time") ?? (cTimeResolve || r.end_time || r.col_time || "");

  // オプション：reservations と tasks の大きい方
  const optBR = Math.max(Number(r.opt_b) || 0, taskOptNum(dTask, "_optB"), taskOptNum(cTask, "_optB"));
  const optCR = Math.max(Number(r.opt_c) || 0, taskOptNum(dTask, "_optC"), taskOptNum(cTask, "_optC"));
  const optJR = Math.max(Number(r.opt_j) || 0, taskOptNum(dTask, "_optJ"), taskOptNum(cTask, "_optJ"));
  const optUSBR = Math.max(Number(r.opt_usb) || 0);
  // 補償：reservations が空なら tasks.確定 にフォールバック
  const insR = String(r.insurance || "").trim() || String(dTask?.insurance || cTask?.insurance || "").trim();

  const st = String(r.status || "");
  const cancelled = st === "cancelled" || st === "キャンセル" || st === "cancel";

  // 車両状態チェック（傷）：札幌と同じく出発日 8:00 以降のみ解禁。URLは nha_fleet→nha_vehicles.plate_no→vehicle_twins.display_label(ilike)→share_token。
  const jstIso = new Date(Date.now() + 9 * 3600 * 1000).toISOString();
  const today = jstIso.slice(0, 10);
  const hh = +jstIso.slice(11, 13);
  const damageReady = !!r.start_date && (r.start_date < today || (r.start_date === today && hh >= 8));
  let damageUrl: string | null = null;
  if (damageReady) {
    try {
      const fl = await sbGet("nha_fleet", `reservation_id=eq.${encodeURIComponent(resId)}&select=vehicle_code`);
      const code = fl[0]?.vehicle_code;
      if (code) {
        const vs = await sbGet("nha_vehicles", `code=eq.${encodeURIComponent(code)}&select=plate_no`);
        const plate = vs[0]?.plate_no;
        if (plate) {
          const tw = await sbGet("vehicle_twins", `display_label=ilike.*${encodeURIComponent(plate)}*&share_enabled=eq.true&select=share_token&limit=1`);
          if (tw[0]?.share_token) damageUrl = `https://nosh2318.github.io/handyman-damage/v.html?t=${tw[0].share_token}&v=v3`;
        }
      }
    } catch (_) { /* best-effort */ }
  }

  // 履歴：mypage_changes ＋ OPタスク由来（フォーム回答/担当編集の場所・時間）を統合（札幌 pushTaskHist と同思想）
  const history: any[] = [];
  for (const c of chg) history.push({ field: c.field, value: c.new_value, old: c.old_value, at: c.created_at, source: c.source === "staff" ? "staff" : "customer_mypage", status: c.status, actor: c.actor });
  const pushTaskHist = (task: any, placeVal: string, placeField: string, timeField: string) => {
    if (!task) return;
    const cj = parseCj(task);
    const src = cj._placeSource === "manual" ? "staff" : (cj._placeSource === "customer" ? "customer_mypage" : "customer_form");
    if (src !== "customer_mypage") {
      const pv = cj._placeSource === "manual" ? (placeVal || "") : (cj._ssPlace || placeVal || "");
      const pat = cj._manualPlaceAt || cj._ssPlaceAt || "";
      if (pv && pat) history.push({ field: placeField, value: pv, at: pat, source: src, status: "applied" });
      const tv = cj._ssTime || task.time || "";
      const tat = cj._manualTimeAt || cj._ssTimeAt || "";
      if (tv && tat) history.push({ field: timeField, value: tv, at: tat, source: src, status: "applied" });
    }
  };
  pushTaskHist(dTask, dTask?.place, "del_place", "lend_time");
  pushTaskHist(cTask, (cTask?.colPlace || cTask?.place), "col_place", "return_time");
  history.sort((a: any, b: any) => String(b.at || "").localeCompare(String(a.at || "")));
  const historyTop = history.slice(0, 10);

  // 札幌 my.html と同一の応答形（flat reservation）＝同一レンダラで表示統一。
  // 受け渡し区分(visit_type/return_type)を追加返却＝ページ側で PUB/BDB→バス時刻表 の分岐に使う。
  return json({
    ok: true, store: "nha", label: "那覇",
    reservation: {
      id: r.id, vehicle: r.vehicle_class, ota: r.ota,
      lend_date: r.start_date, return_date: r.end_date, lend_time: lendTimeR, return_time: returnTimeR,
      name: r.name, people: r.people, status: r.status, insurance: insR,
      del_place: delPlaceR, col_place: colPlaceR,
      del_lat: r.del_lat ?? null, del_lng: r.del_lng ?? null, col_lat: r.col_lat ?? null, col_lng: r.col_lng ?? null,
      opt_b: optBR, opt_c: optCR, opt_j: optJR, opt_usb: optUSBR,
      del_flight: r.del_flight || "",
      visit_type: r.visit_type || "", return_type: r.return_type || "",
      kd_status: r.kd_status || null,
    },
    damage: { ready: damageReady, url: damageUrl },
    tracking: { active: r.kd_status === "delivering" || r.kd_status === "collecting", kd_status: r.kd_status || null, token: r.kd_track_token || null },
    license: { cnt: licCnt, drivers: licDrivers },
    pendingCancel: chg.some((c: any) => c.field === "cancel" && c.status === "requested"), readyPending: chg.some((c: any) => c.field === "ready" && c.status === "requested"),
    recentChanges: chg, history: historyTop,
    at: nowJst(),
  }, 200, origin);
});
