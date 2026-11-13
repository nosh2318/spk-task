# 2026-11-13 AI回答案の直し（那覇 陳様「到着便を登録できない」に「担当より確認してご連絡」「空港に着いたら連絡を」と答えた件）
# 使い方: python3 patch_cs_rules_1113.py cs_autoreply.py   （元は cs_autoreply.py.bak_20261113_flight に残す）
# 変えるところ:
#   1) いまの記録に「受け取り方・到着便（予約の便欄）・帰りの便」と、那覇の空港お迎えの決まり（バス毎時00分）を足す
#   2) マイページの操作手順（どこを押せば何ができるか）を記録として渡す＝「できない」と言われたら手順と代わりの手を答える
#   3) 約束：お客様の書いた言語で書く／「担当より確認」「空港に着いたら連絡」「位置情報」は使わない
import sys, shutil
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
if "_MYPAGE_HOWTO" in s:
    print("already"); sys.exit(0)
assert "def booking_facts(" in s, "facts patch (11/10) が入っていない"
shutil.copy(p, p + ".bak_20261113_flight")

a = "    L = []\n    # 免許証"
assert s.count(a) == 1, "L anchor"
s = s.replace(a, r'''    L = []
    # ★2026-11-13 受け取り方・便（予約が正。マイページで入れた値もここに入る）
    vt = str(r.get("visit_type") or "").strip(); rt = str(r.get("return_type") or "").strip()
    fl = str((r.get("del_flight") if store == "nha" else r.get("flight")) or "").replace("／", "/")
    go_f = fl.split("/")[0].strip() if fl else ""; back_f = fl.split("/")[1].strip() if "/" in fl else ""
    L.append("受け取り方：%s／返し方：%s" % (_METHOD_JA.get(vt, vt or "未定"), _METHOD_JA.get(rt, rt or "未定")))
    if not vt.upper().startswith("DEL"):
        L.append("到着便：%s" % (go_f or "まだ登録されていない（マイページの「到着便」を押すと入力欄が開く。チャットで便名を送ってもらえればスタッフが登録できる）"))
    if back_f or r.get("col_flight"): L.append("帰りの便（予約）：%s" % (r.get("col_flight") or back_f))
    if store == "nha" and vt.upper() in ("PUB", "PU"):
        L.append("那覇の空港お迎え：空港のバス乗り場（11-B）から毎時00分発のバスでお店へ（定刻発、到着便に合わせて待つことはできない）。"
                 "マイページにバスの時刻表が出る。空港に着いても連絡は不要、乗り場へ行けばよい")
    # 免許証''')

b = "def resv_facts(store, r):\n    base = _resv_facts_base(store, r)"
assert s.count(b) == 1, "resv_facts anchor"
s = s.replace(b, r'''# ★2026-11-13 マイページの操作手順（お客様が「できない」と言った時に、手順と代わりの手を答えるため）
_MYPAGE_HOWTO = ("【マイページの操作（どこを押すと何ができるか）】\n"
    "・到着便：上の「必要なこと」一覧の「到着便」を押す→便名（例 JL911）を入れて「登録する」\n"
    "・帰りの便：一覧の「帰りの便」を押す→便名を入れて「登録する」\n"
    "・人数：一覧の「ご利用人数」／免許証：一覧の「運転者の免許証」から写真を送る\n"
    "・時間・場所・受け取り方の変更：下のタブ「予約・変更」から依頼を送る（スタッフが承認）\n"
    "・画面の言語は右上のボタンで切り替えられる\n"
    "・お客様が操作できないと言う時は、上の手順を案内し、あわせて『このチャットに◯◯を送っていただければ、こちらで登録します』と代わりの手を書く")

def resv_facts(store, r):
    base = _resv_facts_base(store, r) + "\n" + _MYPAGE_HOWTO''')

c = "⓪【いまの記録】に答えがある質問"
assert s.count(c) == 1, "rule anchor"
s = s.replace(c, ("⓪-1 回答案はお客様が書いた言語（中国語なら繁體中文、英語なら英語、韓国語なら韓国語）で書く。日本語のお客様だけ日本語。"
    "⓪-2『担当より確認してご連絡します』『確認いたします』で終わらせない。記録とマイページの操作で答えられる質問は、その場で答えと次にすることを書く。"
    "『空港に着いたらご連絡ください』『現在地を教えてください』は書かない（那覇の空港お迎えは時刻表どおりのバス、連絡不要）。"
    "マイページで何かが『できない』と言われたら、【マイページの操作】の手順を案内し、チャットで送ってもらえればこちらで登録すると書く。") + c, 1)
open(p, "w", encoding="utf-8").write(s)
print("ok")
