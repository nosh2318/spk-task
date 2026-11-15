#!/usr/bin/env python3
"""mypage-info（main）に高松の「マイページの質問」（返却後の送迎）を足す。使い方: python3 patch_mypage_info_tkm.py <今の index.ts> <書き出し先>
  get の info.questions に高松（BT bt_mp_questions）を足す／action return_shuttle {choice, text?} を足す（BT bt_mp_return_shuttle）"""
import sys
src = open(sys.argv[1], encoding="utf-8").read()
def rep(old, new):
    global src
    assert src.count(old) == 1, "anchor not unique/missing: " + old[:60]
    src = src.replace(old, new)

rep('["get", "set", "confirm", "damage_ok", "terms_ok", "office_shuttle"].includes(action)',
    '["get", "set", "confirm", "damage_ok", "terms_ok", "office_shuttle", "return_shuttle"].includes(action)')

rep('''  const questions = async () => { if (store !== "nha") return []; const x = await rpc("nha_mp_questions", { p_token: token }); return x.ok && Array.isArray(x.j) ? x.j : []; };''',
    '''  // ★2026-11-15 高松も同じ形（BUDDICA DB の mp_questions・返却後に高松空港まで送るか）。高松の DB は service key で呼ぶ（関数側でマイページの鍵を確かめる）
  const rpcBt = async (fn: string, b: unknown) => { const k = Deno.env.get("BT_SERVICE_KEY") || ""; const x = await fetch(`${BT_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: k, Authorization: `Bearer ${k}`, "content-type": "application/json", "x-hdm-actor": "customer:mypage-info" }, body: JSON.stringify(b) }); const t = await x.text(); let j: any = null; try { j = JSON.parse(t); } catch { j = null; } return { ok: x.ok, j, t }; };
  const questions = async () => { if (store !== "nha" && store !== "tkm") return []; const x = store === "tkm" ? await rpcBt("bt_mp_questions", { p_token: token }) : await rpc("nha_mp_questions", { p_token: token }); return x.ok && Array.isArray(x.j) ? x.j : []; };''')

rep('''  if (action === "get") return json({ ok: true, info: cur ? { ...cur, ...(await extra()) } : (store === "tkm" ? cur : await extra()) }, 200, origin);''',
    '''  if (action === "get") return json({ ok: true, info: cur ? { ...cur, ...(await extra()) } : (store === "tkm" ? { questions: await questions() } : await extra()) }, 200, origin);

  // 高松：返却後の送迎の答え。bd（空港まで送迎）・store（返却だけ）はその場で予約・タスクへ。other は記録だけ（画面がチャットへ送る→オムニが案）
  if (action === "return_shuttle") {
    if (store !== "tkm") return json({ ok: false, error: "bad request" }, 400, origin);
    const choice = S(p.choice, 20);
    if (!["bd", "store", "other"].includes(choice)) return json({ ok: false, error: "選んでください" }, 200, origin);
    const x = await rpcBt("bt_mp_return_shuttle", { p_token: token, p_choice: choice, p_text: S(p.text, 500) || null });
    if (!x.ok || !x.j) { console.error("return_shuttle", x.t); await failNotify(store, r.ota, rid, "返却後の送迎の答え", choice); return json({ ok: false, error: "保存できませんでした。もう一度お試しください" }, 200, origin); }
    return json({ ...x.j, info: cur ? { ...cur, ...(await extra()) } : { questions: await questions() } }, 200, origin);
  }''')
open(sys.argv[2], "w", encoding="utf-8").write(src)
print("ok")
