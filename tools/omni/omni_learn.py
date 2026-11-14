#!/usr/bin/env python3
"""オムニの学習：LINE・チャットの「お客様の質問→スタッフの答え」から、種類ごとのきまり集を作る（読むだけ・DBに書かない）。
使い方: SB_URL / SB_KEY（service key）を環境変数に入れて  python3 omni_learn.py [days]
出力: ./learn/pairs.json  ./learn/rules.json  ./learn/rules.md
"""
import json, os, re, sys, subprocess, urllib.request, urllib.parse, datetime, concurrent.futures as cf

SB = os.environ.get("SB_URL", "https://ckrxttbnawkclshczsia.supabase.co").rstrip("/")
KEY = os.environ["SB_KEY"]
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 365
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "learn")
os.makedirs(OUT, exist_ok=True)
H = {"apikey": KEY, "Authorization": "Bearer " + KEY}

def get(table, q):
    rows, off = [], 0
    while True:
        u = f"{SB}/rest/v1/{table}?{q}&limit=1000&offset={off}"
        with urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=60) as r:
            b = json.loads(r.read())
        rows += b
        if len(b) < 1000: return rows
        off += 1000

since = (datetime.datetime.utcnow() - datetime.timedelta(days=DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
STORE = {"sapporo": "spk", "okinawa": "nha"}

# ---- 1. 集める：LINE（erume_chat_log）
line = get("erume_chat_log", "select=account,friend_id,sender_type,sent_at,body&account=in.(sapporo,okinawa)"
           f"&sent_at=gte.{since}&order=account.asc,friend_id.asc,sent_at.asc")
# ---- チャット（マイページ）
chat = get("cs_chat_messages", f"select=thread_id,sender,body,created_at&created_at=gte.{since}&order=thread_id.asc,created_at.asc")
ths = {t["id"]: t["store"] for t in get("cs_chat_threads", "select=id,store")}

def ts(s): return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
MASK = [(re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "〈メール〉"), (re.compile(r"0\d{1,4}-?\d{1,4}-?\d{3,4}"), "〈電話〉"),
        (re.compile(r"[A-Z]{0,3}\d{6,}"), "〈番号〉"), (re.compile(r"https?://\S+"), "〈URL〉")]
def mask(s):
    s = (s or "").strip()
    for p, r in MASK: s = p.sub(r, s)
    return s[:500]

def pairs_from(seq):
    """seq: [(key, who('c'|'s'), at, body)] 同じ key 内で、続くお客様の文をまとめ→3時間以内のスタッフの文（続くもの）をまとめる"""
    out, i = [], 0
    while i < len(seq):
        k, w, at, b = seq[i]
        if w != "c": i += 1; continue
        q, j = [b], i + 1
        while j < len(seq) and seq[j][0] == k and seq[j][1] == "c": q.append(seq[j][3]); j += 1
        if j < len(seq) and seq[j][0] == k and seq[j][1] == "s" and (seq[j][2] - seq[j - 1][2]).total_seconds() < 3 * 3600:
            a, m = [], j
            while m < len(seq) and seq[m][0] == k and seq[m][1] == "s": a.append(seq[m][3]); m += 1
            out.append({"q": mask("\n".join(q)), "a": mask("\n".join(a)), "at": seq[j][2].isoformat()[:10]})
            i = m
        else: i = j
    return out

P = []
for acc in ("sapporo", "okinawa"):
    seq = [(r["friend_id"], "c" if r["sender_type"] == "友だち" else "s", ts(r["sent_at"]), r["body"] or "")
           for r in line if r["account"] == acc and r["sender_type"] in ("友だち", "LOAアカウント")]
    for p in pairs_from(seq): p.update(store=STORE[acc], src="LINE"); P.append(p)
seqc = [(m["thread_id"], "c" if m["sender"] in ("guest", "customer", "user") else "s", ts(m["created_at"]), m["body"] or "")
        for m in chat if m["sender"] not in ("system", "auto")]
for p in pairs_from(seqc):
    p.update(store=ths.get(next((s[0] for s in seqc), None), ""), src="チャット"); P.append(p)

# 定型・空の答えは除く
P = [p for p in P if len(p["q"]) >= 4 and len(p["a"]) >= 8]

# ---- 2. 分ける
CAT = [("車種", r"車種|ハリアー|アルファード|ヴェルファイア|ノア|セレナ|ヴォクシー|デリカ|プリウス|車両.{0,6}(指定|変更)|クラス|大きい車|7人|8人"),
       ("延長", r"延長|延ば|もう1日|もう一日"),
       ("早め返却・乗り捨て", r"早め.{0,8}返|早く返|乗り捨て|置いて"),
       ("遅れ・早着", r"遅れ|遅く|早め|早く着|到着が|着きそう|渋滞|欠航|遅延"),
       ("待ち合わせ・見つからない", r"見つから|どこ|迎え|待って|乗り場|バス|送迎|着きました|到着しました"),
       ("時間・場所の変更", r"時間.{0,6}(変更|変え)|場所.{0,6}(変更|変え)|ホテル|お届け|回収"),
       ("キャンセル", r"キャンセル|取消|取り消"),
       ("免許・手続き", r"免許|国際|身分証|書類|アップロード|登録"),
       ("オプション・装備", r"チャイルド|ジュニア|シート|スタッドレス|チェーン|オプション|ETC|ナビ|USB|充電"),
       ("お金・領収書", r"領収|支払|決済|料金|クレジット|返金|請求|現金|カード"),
       ("事故・故障・傷", r"事故|傷|故障|ぶつけ|パンク|警告|ランプ|バッテリー|動かな|エンジン"),
       ("給油・返却時", r"ガソリン|給油|満タン|洗車"),
       ("忘れ物", r"忘れ物|落とし|忘れ"),
       ("お礼のみ", r"^(ありがと|承知|了解|はい|OK|ok|よろしく|わかりました)[^？?]{0,25}$")]
def cat(q):
    for n, rx in CAT:
        if re.search(rx, q): return n
    return "その他"
for p in P: p["cat"] = cat(p["q"])
json.dump(P, open(os.path.join(OUT, "pairs.json"), "w"), ensure_ascii=False)
cnt = {}
for p in P: cnt[(p["store"], p["cat"])] = cnt.get((p["store"], p["cat"]), 0) + 1
print("pairs", len(P)); [print(k, v) for k, v in sorted(cnt.items(), key=lambda x: -x[1])]

# ---- 3. きまりにする（種類ごと・新しい順に最大120組を読む）
PROMPT = """あなたはレンタカー店 HANDYMAN（{store}）のオムニです。下は、お客様の質問と、スタッフが実際に返した答えの組です（種類＝{cat}、{n}組中の新しい{k}組）。
ここから「この条件ならこう答える・こう動く」のきまりを作ってください。
- 1つのきまり＝1つの状況。条件は予約データで確かめられる形で書く（例：同じクラスに空きがある／返却の2時間前より前／担当がその時間に別の仕事あり）。
- evidence＝そのきまりに合う組の数を数える。3件以上で答えがそろう→"確定"、1〜2件→"候補"、スタッフの答えが割れている・お金や事故で毎回違う→"人に回す"。
- 組にない約束・料金・負担は書かない。お客様の名前・番号は書かない。
- answer はお客様への返事の型（時刻は「前後」「目安」）。action はスタッフ・システムがすること。
JSON の配列だけを出力： [{{"when":"…","answer":"…","action":"…","evidence":数,"status":"確定|候補|人に回す","example_q":"代表的な質問（短く）"}}]

{pairs}"""
def run(group):
    (store, c), ps = group
    ps = sorted(ps, key=lambda p: p["at"], reverse=True)[:120]
    txt = "\n".join(f"Q: {p['q']}\nA: {p['a']}\n---" for p in ps)
    pr = PROMPT.format(store="札幌" if store == "spk" else "那覇", cat=c, n=cnt[(store, c)], k=len(ps), pairs=txt)
    try:
        r = subprocess.run(["claude", "--print"], input=pr, capture_output=True, text=True, timeout=600)
        m = re.search(r"\[.*\]", r.stdout, re.S); rules = json.loads(m.group(0)) if m else []
    except Exception as e:
        rules = [{"error": str(e)}]
    for x in rules: x.update(store=store, cat=c)
    return rules
groups = {}
for p in P:
    if p["cat"] == "お礼のみ" or p["store"] not in ("spk", "nha"): continue
    groups.setdefault((p["store"], p["cat"]), []).append(p)
R = []
with cf.ThreadPoolExecutor(4) as ex:
    for rs in ex.map(run, groups.items()): R += rs
json.dump(R, open(os.path.join(OUT, "rules.json"), "w"), ensure_ascii=False, indent=1)

# ---- 4. 読める形
L = [f"# オムニのきまり集（{datetime.date.today()}・過去{DAYS}日のLINE・チャット {len(P)}組から）", ""]
for (store, c) in sorted(groups):
    rs = [x for x in R if x.get("store") == store and x.get("cat") == c and "error" not in x]
    if not rs: continue
    L.append(f"## {'札幌' if store=='spk' else '那覇'}｜{c}（{cnt[(store, c)]}組）")
    for x in sorted(rs, key=lambda x: -int(x.get("evidence") or 0)):
        L.append(f"- 【{x.get('status')}・{x.get('evidence')}件】{x.get('when')} → {x.get('answer')}" + (f"（動き：{x.get('action')}）" if x.get("action") else ""))
    L.append("")
st = {}
for x in R: st[x.get("status")] = st.get(x.get("status"), 0) + 1
L.insert(1, "合計 " + "・".join(f"{k} {v}" for k, v in st.items()))
open(os.path.join(OUT, "rules.md"), "w").write("\n".join(L))
print("rules", len(R), st)
