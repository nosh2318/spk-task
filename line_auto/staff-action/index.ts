// staff-action — バイト個人ページ(staff.html)用のアクションEF
// body: { token(staff share_token), resv_no, action }
//   action: depart | collect | arrival | col_arrival | dropoff
// 認証: staff.share_token（ログイン不要）→ 内部でline-push(FUNC_SECRET)を呼びLINE自動送信
// deploy: functions deploy staff-action --no-verify-jwt
//   secrets: FUNC_SECRET（line-pushと共有）
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNC_SECRET = Deno.env.get("FUNC_SECRET")!;

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST,OPTIONS" } });
}
async function sbGet(path: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  return r.ok ? await r.json() : [];
}
async function sbPatch(path: string, body: unknown) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method: "PATCH", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body) });
  return r.ok;
}
function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "-" + Math.random())).replace(/-/g, ""); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
  const token = String(body.token || "").trim();
  const resv_no = String(body.resv_no || "").trim();
  const action = String(body.action || "").trim();
  if (!token || !action) return json({ ok: false, error: "missing params" }, 400);
  if (action !== "done" && action !== "approve" && action !== "skip" && !resv_no) return json({ ok: false, error: "missing resv_no" }, 400);

  // 1) staff token 検証
  const staff = await sbGet(`staff?share_token=eq.${encodeURIComponent(token)}&select=name,active&limit=1`);
  if (!staff[0] || staff[0].active === false) return json({ ok: false, error: "invalid_token" }, 401);
  const staffName = staff[0].name;

  // === 承認(approve): 依頼タスクを引き受け → assignee=自分 + requested_to クリア + Slack ===
  if (action === "approve") {
    const task_id = String(body.task_id || "").trim();
    if (!task_id) return json({ ok: false, error: "missing task_id" }, 400);
    const tk = await sbGet(`tasks?_id=eq.${encodeURIComponent(task_id)}&select=_id,type,name,assigned_vehicle,plate_no,time,return_time,date,requested_to,assignee&limit=1`);
    if (!tk[0]) return json({ ok: false, error: "task_not_found" }, 404);
    const T = tk[0];
    const reqTo: string[] = Array.isArray(T.requested_to) ? T.requested_to : [];
    const sur = staffName.split(" ")[0];
    const offered = reqTo.some((n: string) => n === staffName || n.replace(/\s/g, "") === staffName.replace(/\s/g, "") || n === sur);
    if (!offered) return json({ ok: false, error: "not_offered" }, 403);
    // 既に他の人が引き受けていないか（先着）
    if (T.assignee && T.assignee.trim() && T.assignee.replace(/\s/g, "") !== staffName.replace(/\s/g, "") && T.assignee !== sur) {
      return json({ ok: false, error: "already_taken", taken_by: T.assignee });
    }
    await sbPatch(`tasks?_id=eq.${encodeURIComponent(task_id)}`, { assignee: staffName, requested_to: null, approved_at: new Date().toISOString(), approved_by: staffName });
    // Slack通知
    const TYPE: Record<string, string> = { DEL: "🚚お届け", COL: "🧭回収", "洗車": "🧽洗車", PU: "🚐送迎お迎え", PUB: "🚌バスお迎え", BD: "🚐お見送り", BDB: "🚌バスお見送り", "返却": "🔑返却", "来店": "🏠来店" };
    const tlabel = TYPE[T.type] || T.type;
    const cust = T.name ? `${T.name}様` : "";
    const veh = T.assigned_vehicle ? `${T.assigned_vehicle}${T.plate_no ? " (" + T.plate_no + ")" : ""}` : "";
    const tmv = T.time || T.return_time || "";
    const md = (T.date || "").split("-"); const mdstr = md.length === 3 ? `${+md[1]}/${+md[2]}` : (T.date || "");
    const SLACK = Deno.env.get("SLACK_BOT_TOKEN") || "", CH = Deno.env.get("STAFF_DONE_CHANNEL") || "";
    let posted = false;
    if (SLACK && CH) {
      const blocks = [
        { type: "header", text: { type: "plain_text", text: "🙋 タスク承認（引き受け）", emoji: true } },
        { type: "section", fields: [
          { type: "mrkdwn", text: `*👤 引き受け*\n${staffName}` },
          { type: "mrkdwn", text: `*🗓 日時*\n${mdstr}${tmv ? " " + tmv : ""}` },
          { type: "mrkdwn", text: `*📋 内容*\n${tlabel}　${cust}` },
          { type: "mrkdwn", text: `*🚗 車両*\n${veh || "—"}` },
        ] },
      ];
      try { const sr = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${SLACK}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: CH, text: `🙋 ${staffName} が ${tlabel} ${cust} を引き受けました`, blocks }) }); const sj = await sr.json(); posted = !!sj.ok; } catch { /* noop */ }
    }
    return json({ ok: true, approved: true, posted, staff: staffName });
  }

  // === スキップ(skip): 依頼を辞退 → skipped_byに記録 + requested_toから自分を除外 + 残り0ならOP担当ブランク + Slack ===
  if (action === "skip") {
    const task_id = String(body.task_id || "").trim();
    if (!task_id) return json({ ok: false, error: "missing task_id" }, 400);
    const tk = await sbGet(`tasks?_id=eq.${encodeURIComponent(task_id)}&select=_id,type,name,assigned_vehicle,plate_no,time,return_time,date,requested_to,assignee,skipped_by&limit=1`);
    if (!tk[0]) return json({ ok: false, error: "task_not_found" }, 404);
    const T = tk[0];
    const sur = staffName.split(" ")[0];
    const reqTo: string[] = Array.isArray(T.requested_to) ? T.requested_to : [];
    const remain = reqTo.filter((n: string) => !(n === staffName || n.replace(/\s/g, "") === staffName.replace(/\s/g, "") || n === sur));
    const skp: string[] = Array.isArray(T.skipped_by) ? T.skipped_by.slice() : [];
    if (!skp.some((n: string) => n === staffName || n === sur)) skp.push(staffName);
    const patch: Record<string, unknown> = { skipped_by: skp };
    let blanked = false;
    if (remain.length > 0) {
      patch.requested_to = remain;
    } else {
      patch.requested_to = null;
      patch.assignee = "";
      patch.approved_at = null; patch.approved_by = null;
      blanked = true;
    }
    await sbPatch(`tasks?_id=eq.${encodeURIComponent(task_id)}`, patch);
    const TYPE: Record<string, string> = { DEL: "🚚お届け", COL: "🧭回収", "洗車": "🧽洗車", PU: "🚐送迎お迎え", PUB: "🚌バスお迎え", BD: "🚐お見送り", BDB: "🚌バスお見送り", "返却": "🔑返却", "来店": "🏠来店" };
    const tlabel = TYPE[T.type] || T.type;
    const cust = T.name ? `${T.name}様` : "";
    const veh = T.assigned_vehicle ? `${T.assigned_vehicle}${T.plate_no ? " (" + T.plate_no + ")" : ""}` : "";
    const tmv = T.time || T.return_time || "";
    const md = (T.date || "").split("-"); const mdstr = md.length === 3 ? `${+md[1]}/${+md[2]}` : (T.date || "");
    const SLACK = Deno.env.get("SLACK_BOT_TOKEN") || "", CH = Deno.env.get("STAFF_DONE_CHANNEL") || "";
    let posted = false;
    if (SLACK && CH) {
      const blocks = [
        { type: "header", text: { type: "plain_text", text: "⏭ タスクをスキップ", emoji: true } },
        { type: "section", fields: [
          { type: "mrkdwn", text: `*🙅 辞退*\n${staffName}` },
          { type: "mrkdwn", text: `*🗓 日時*\n${mdstr}${tmv ? " " + tmv : ""}` },
          { type: "mrkdwn", text: `*📋 内容*\n${tlabel}　${cust}` },
          { type: "mrkdwn", text: `*🚗 車両*\n${veh || "—"}` },
        ] },
        { type: "context", elements: [ { type: "mrkdwn", text: blanked ? "⚠️ 他に候補がいないため *OPシートの担当はブランク* に戻りました（要・再割当）" : `↩︎ 残りの候補（${remain.join("・")}）に依頼継続中` } ] },
      ];
      try { const sr = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${SLACK}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: CH, text: `⏭ ${staffName} が ${tlabel} ${cust} をスキップしました${blanked ? "（OP担当ブランク）" : ""}`, blocks }) }); const sj = await sr.json(); posted = !!sj.ok; } catch { /* noop */ }
    }
    return json({ ok: true, skipped: true, blanked, posted, staff: staffName });
  }

  // === 完了(done): タスクをdone化 + Slack通知 ===
  if (action === "done") {
    const task_id = String(body.task_id || "").trim();
    if (!task_id) return json({ ok: false, error: "missing task_id" }, 400);
    const tk = await sbGet(`tasks?_id=eq.${encodeURIComponent(task_id)}&select=_id,type,name,assigned_vehicle,plate_no,time,return_time,assignee,date,reservation_id&limit=1`);
    if (!tk[0]) return json({ ok: false, error: "task_not_found" }, 404);
    const T = tk[0];
    await sbPatch(`tasks?_id=eq.${encodeURIComponent(task_id)}`, { done: true });
    // Slack通知（#sapporo_operation）
    const TYPE: Record<string, string> = { DEL: "🚚お届け", COL: "🧭回収", "洗車": "🧽洗車", PU: "🚐送迎お迎え", PUB: "🚌バスお迎え", BD: "🚐お見送り", BDB: "🚌バスお見送り", "返却": "🔑返却", "来店": "🏠来店" };
    const tlabel = TYPE[T.type] || T.type;
    const cust = T.name ? `${T.name}様` : "";
    const veh = T.assigned_vehicle ? `${T.assigned_vehicle}${T.plate_no ? " (" + T.plate_no + ")" : ""}` : "未配車";
    const tmv = T.time || T.return_time || "";
    const nowJ = new Date(Date.now() + 9 * 3600 * 1000);
    const hhmm = `${String(nowJ.getUTCHours()).padStart(2, "0")}:${String(nowJ.getUTCMinutes()).padStart(2, "0")}`;
    const md = (T.date || "").split("-"); const mdstr = md.length === 3 ? `${+md[1]}/${+md[2]}` : (T.date || "");
    const SLACK = Deno.env.get("SLACK_BOT_TOKEN") || "";
    const CH = Deno.env.get("STAFF_DONE_CHANNEL") || "";
    let posted = false;
    if (SLACK && CH) {
      const blocks = [
        { type: "header", text: { type: "plain_text", text: "✅ タスク完了", emoji: true } },
        { type: "section", fields: [
          { type: "mrkdwn", text: `*👤 担当*\n${staffName}` },
          { type: "mrkdwn", text: `*🕐 完了時刻*\n${mdstr} ${hhmm}` },
          { type: "mrkdwn", text: `*📋 内容*\n${tlabel}　${cust}` },
          { type: "mrkdwn", text: `*🚗 車両*\n${veh}${tmv ? "　" + tmv : ""}` },
        ] },
      ];
      try {
        const sr = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST", headers: { Authorization: `Bearer ${SLACK}`, "Content-Type": "application/json" },
          body: JSON.stringify({ channel: CH, text: `✅ タスク完了：${staffName} / ${tlabel} ${cust}`, blocks }),
        });
        const sj = await sr.json(); posted = !!sj.ok;
      } catch { /* noop */ }
    }
    return json({ ok: true, done: true, posted, staff: staffName });
  }

  // 2) 予約取得
  const resv = await sbGet(`reservations?id=eq.${encodeURIComponent(resv_no)}&select=id,name,ota,status,mypage_token`);
  if (!resv[0]) return json({ ok: false, error: "reservation_not_found" }, 404);
  const r = resv[0];
  const st = String(r.status || "").toLowerCase();
  if (st.includes("cancel") || st.includes("キャンセル")) return json({ ok: false, error: "cancelled" });
  const cn = (r.name || "") + "様";
  const myUrl = r.mypage_token ? `https://nosh2318.github.io/spk-task/my.html?t=${r.mypage_token}` : "";

  // プレート（到着メッセージ用）
  let plate = "";
  try {
    const pref = action === "arrival" ? "d-" : "c-";
    const tk = await sbGet(`tasks?_id=eq.${encodeURIComponent(pref + resv_no)}&select=plate_no,assigned_vehicle&limit=1`);
    plate = (tk[0] && (tk[0].plate_no || "")) || "";
  } catch { /* noop */ }

  // 3) アクション別: メッセージ + line-push action + 予約更新
  let msg = "", pushAction = "", driverUrl = "";
  if (action === "depart" || action === "collect") {
    const tkTrack = uuid(), tkDrv = uuid();
    await sbPatch(`reservations?id=eq.${encodeURIComponent(resv_no)}`, {
      kd_status: action === "depart" ? "delivering" : "collecting",
      kd_status_at: new Date().toISOString(),
      kd_track_token: tkTrack, kd_driver_token: tkDrv,
    });
    driverUrl = `https://keydrop.jp/handyman-driver.html?r=${encodeURIComponent(resv_no)}&d=${tkDrv}`;
    if (action === "depart") {
      pushAction = "depart_mypage";
      msg = `【HANDYMAN カーデリバリー】\n${cn}\nお届けに出発しました🚚\nお客様専用マイページから、スタッフの現在地・受け取り場所・車両情報をご確認いただけます（アプリ不要）。\n${myUrl}`;
    } else {
      pushAction = "collect_mypage";
      msg = `【HANDYMAN カーデリバリー】\n${cn}\nお車の回収に向かっています🧭\nお客様専用マイページから、スタッフの現在地・待ち合わせ場所をご確認いただけます（アプリ不要）。\n${myUrl}`;
    }
  } else if (action === "arrival") {
    pushAction = "arrival";
    msg = `【車両到着のお知らせ】\n${cn}\n\nお待たせいたしました。只今スタッフが到着いたしました。\nご準備整い次第、受け取り対応をお願いいたします。 引き続きどうぞ宜しくお願い申し上げます。` + (plate ? `\n\n対象車両のナンバーは ${plate} でございます。` : "");
  } else if (action === "col_arrival") {
    pushAction = "col_arrival";
    msg = `【ご返却場所到着のお知らせ】\n${cn}\n\n回収スタッフがご返却場所に到着致しました。\nご準備できましたら対応のほどお願い申しあげます。\n何卒よろしくお願いいたします。`;
  } else if (action === "delay_del" || action === "delay_col") {
    const t = String(body.time || "").trim() || "（　）";
    const isCol = action === "delay_col";
    pushAction = isCol ? "col_delay" : "del_delay";
    const midMsg = isCol ? "お車の回収に向かうスタッフの到着が予定より遅れております" : "お車のお届けに向かうスタッフの到着が予定より遅れております";
    const head = isCol ? "【回収時間について】" : "【お届け時間について】";
    msg = `${head}\n${cn}\n\nこの度はHANDYMANをご利用いただき、誠にありがとうございます。\nただいま道路状況・混雑状況により、${midMsg}。\nご迷惑をおかけし誠に申し訳ございません。\n到着予定は「${t}」頃を見込んでおります。\nお手数をおかけいたしますが、もう暫しお待ちくださいませ。`;
  } else if (action === "dropoff") {
    pushAction = "dropoff";
    msg = `【乗り捨て対応のお願い】\n${cn}\n\nご返却時刻の混雑により、大変お手数ではございますが返却予定場所近隣駐車場に乗り捨て駐車いただきたく、ご連絡させていただきました。\nお待たせする時間回避の目的のためご協力の程何卒よろしくお願いいたします。\n\n✅駐車完了しましたら"鍵と駐車券"をダッシュボード内に格納し、鍵を開けた状態でそのままお降りくださいませ。\n✅燃料の給油とお忘れ物（ETCカード等）のないようご注意ください。\n✅駐車場所が確定しましたら詳細場所をご連絡いただけますと幸いです。\n例：駐車場看板写真/GoogleマップURL/住所/駐車場名/●階等\n\n駐車後の車両トラブルに関しては一切の責任は問いませんのでご安心くださいませ。\n万一の盗難等の際にも弊社セキュリティにて追跡可能となっております。`;
  } else {
    return json({ ok: false, error: "unknown_action" }, 400);
  }

  // 4) line-push で自動送信（秘密はサーバ側）
  let sent = false, reason = "";
  try {
    const pr = await fetch(`${SB_URL}/functions/v1/line-push`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify({ secret: FUNC_SECRET, store: "spk", resv_no, action: pushAction, message: msg }),
    });
    const pj = await pr.json().catch(() => ({}));
    sent = !!pj.ok; reason = pj.reason || "";
  } catch (e) { reason = "send_error"; }

  return json({ ok: true, sent, reason, message: msg, driver_url: driverUrl, staff: staffName });
});
