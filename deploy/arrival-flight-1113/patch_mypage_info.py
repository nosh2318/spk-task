# 2026-11-13 mypage-info：set に flight_in（到着便）を足す。本番の最新 index.ts に当てる（python3 patch_mypage_info.py index.ts）
# お客様が入れた値が正：予約の便欄（那覇 nha_reservations.del_flight・札幌 reservations.flight）の「行き」を置き換え、
# 「行き / 帰り」の帰りは残す。受け取りタスク d- の便名（那覇 便名・札幌 flight）も同じ値に。高松は handyman-mypage-tkm で入る（ここでは受けない）
import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
a = '  if (!lines.length) return json({ ok: false, error: "入力してください" }, 200, origin);'
assert s.count(a) == 1
add = '''  // ★2026-11-13 到着便（陳様 HDMN2611128641「到着便を登録できない」）：画面に入力欄が無くチャットに飛んでいた→ここで受ける
  let resvFlight: string | null = null;
  if (p.flight_in != null && p.flight_in !== "") {
    if (store === "tkm") return json({ ok: false, error: "bad request" }, 400, origin);
    const f = normFlight(S(p.flight_in, 20));
    if (!f) return json({ ok: false, error: "便名は JL911 のように入れてください" }, 200, origin);
    const col = store === "nha" ? "del_flight" : "flight";
    const parts = S(r[col], 200).replace(/／/g, "/").split("/").map((x) => x.trim());
    const nv = parts.length > 1 && parts[1] ? `${f} / ${parts[1]}` : f;
    const x = await fetch(`${SB_URL}/rest/v1/${RESV[store]}?id=eq.${enc(rid)}`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify({ [col]: nv }) });
    const xd = x.ok ? await x.json().catch(() => []) : [];
    if (!x.ok || !Array.isArray(xd) || !xd.length) { console.error("flight_in", x.status, x.ok ? "" : await x.text()); return json({ ok: false, error: "保存できませんでした。もう一度お試しください" }, 200, origin); }
    resvFlight = String(xd[0][col] ?? nv);
    if (store === "nha") await sbPatch("nha_tasks", `_id=eq.${enc("d-" + rid)}&deleted=not.is.true`, { "便名": resvFlight });
    else await sbPatch("tasks", `_id=eq.${enc("d-" + rid)}&deleted=not.is.true`, { flight: resvFlight });
    lines.push(`到着便 ${f}`);
  }
'''
s = s.replace(a, add + a)
b = '  return json({ ok: true, info: { ...saved, ...(await extra()) } }, 200, origin);\n});'
assert s.count(b) == 1
s = s.replace(b, '  return json({ ok: true, info: { ...saved, ...(await extra()) }, ...(resvFlight != null ? { resv_flight: resvFlight } : {}) }, 200, origin);\n});')
c = '//   ・action: get / set {people?, flight_out?} / confirm'
if c in s: s = s.replace(c, '//   ・action: get / set {people?, flight_out?, flight_in?} / confirm')
open(p, "w", encoding="utf-8").write(s); print("ok")
