#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
エルメCSV 自動取込（SPK/NHA・新規/現地受付フォーム 自動判別）→ {store}_line_links へ upsert。
使い方: python3 import_erume_auto.py <csv1> [csv2 ...] [--dry]
- ヘッダ列名で SPK/NHA を自動判別（NHA=「無料送迎/営業所」を含む）
- 予約番号ごとに最新回答を採用・空欄は既存を保持（人間入力の唯一ルール順守）
- 複数CSV(新規＋現地受付)をまとめて渡せる（回収のみフォームは col_* を補完）
"""
import sys, csv, io, json, subprocess

TOKEN_PATH = "/Users/noritakaoshita/.config/keydrop/sb_token"
PROJ = "ckrxttbnawkclshczsia"

def q(sql):
    tok = open(TOKEN_PATH).read().strip()
    body = json.dumps({"query": sql})
    r = subprocess.run(["curl", "-s",
        "https://api.supabase.com/v1/projects/%s/database/query" % PROJ,
        "-H", "Authorization: Bearer " + tok,
        "-H", "Content-Type: application/json",
        "--data-binary", body], capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"raw": r.stdout}

def rd(f):
    raw = open(f, "rb").read()
    for enc in ("utf-8-sig", "cp932", "shift_jis"):
        try:
            return list(csv.reader(io.StringIO(raw.decode(enc))))
        except Exception:
            continue
    return []

def find(hdr, *keys):
    """全keyを含む最初の列index"""
    for i, c in enumerate(hdr):
        if all(k in c for k in keys):
            return i
    return None

def col_map(hdr):
    m = {
        "uid": find(hdr, "ユーザーID"),
        "aid": find(hdr, "回答ID"),
        "aat": find(hdr, "回答日時"),
        "lname": find(hdr, "LINE名"),
        "name": find(hdr, "予約者名"),
        "resv": find(hdr, "予約番号"),
        "media": find(hdr, "予約媒体"),
        "del_place": find(hdr, "お届け", "場所"),
        "del_time": find(hdr, "お届け", "希望時刻") or find(hdr, "お届け", "時刻"),
        # ★ SPK/NHAエルメフォームの回収場所ヘッダは「"返却"希望場所」。旧コードは「回収」で探し
        #    実データ(返却)を取りこぼしていた(col_place空でマイページ未設定になる根本原因)。返却優先＋回収フォールバック。
        "col_place": find(hdr, "返却", "場所") or find(hdr, "回収", "場所"),
        "col_time": find(hdr, "返却", "希望時刻") or find(hdr, "返却", "時刻") or find(hdr, "回収", "希望時刻") or find(hdr, "回収", "時刻"),
        "del_date": find(hdr, "お届け", "希望日") or find(hdr, "貸出開始日"),
        "col_date": find(hdr, "返却", "希望日") or find(hdr, "返却日"),
    }
    return m

def store_of(hdr):
    j = "".join(hdr)
    return "nha" if ("無料送迎" in j or "営業所" in j) else "spk"

def g(r, i):
    if i is None:
        return ""
    try:
        return (r[i] or "").strip()
    except Exception:
        return ""

def esc(s):
    return (s or "").replace("'", "''")

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    if not args:
        print("usage: import_erume_auto.py <csv...> [--dry]"); return
    rec = {}  # (store,resv) -> dict
    store_seen = set()
    for f in args:
        rows = rd(f)
        if len(rows) < 2:
            print("skip(空):", f); continue
        hdr = rows[0]; cm = col_map(hdr); store = store_of(hdr)
        store_seen.add(store)
        form = "新規" if cm["del_place"] is not None else "現地受付(返却)"
        cnt = 0
        for r in rows[1:]:
            resv = g(r, cm["resv"]); uid = g(r, cm["uid"])
            if not resv or not uid or "テスト" in resv or "test" in resv.lower():
                continue
            try:
                aid = int(g(r, cm["aid"]) or 0)
            except Exception:
                aid = 0
            d = {"uid": uid, "name": g(r, cm["name"]), "lname": g(r, cm["lname"]),
                 "media": g(r, cm["media"]), "del_date": g(r, cm["del_date"]),
                 "del_time": g(r, cm["del_time"]), "del_place": g(r, cm["del_place"]),
                 "col_date": g(r, cm["col_date"]), "col_time": g(r, cm["col_time"]),
                 "col_place": g(r, cm["col_place"]), "aat": g(r, cm["aat"])}
            key = (store, resv)
            if key not in rec or aid > rec[key]["_aid"]:
                base = rec.get(key, {})
                base.update({k: v for k, v in d.items() if v})
                base["_aid"] = aid; base["resv"] = resv; base["store"] = store
                rec[key] = base
            else:
                for k, v in d.items():
                    if v and not rec[key].get(k):
                        rec[key][k] = v
            cnt += 1
        print("読込: %s → %s / %s (%d行)" % (f.split("/")[-1], store.upper(), form, cnt))
    # store別にupsert
    total = 0
    for store in store_seen:
        tbl = store + "_line_links"
        vals = []
        for (st, resv), d in rec.items():
            if st != store:
                continue
            aat = d.get("aat", "") or None
            aat_sql = "'%s'" % esc(aat) if aat else "null"
            dd = "'%s'" % esc(d.get("del_date", "")) if d.get("del_date") else "null"
            cd = "'%s'" % esc(d.get("col_date", "")) if d.get("col_date") else "null"
            vals.append("('%s','%s','%s','%s','%s',%s,'%s','%s',%s,'%s','%s',%d,%s,'erume_auto',now())" % (
                esc(resv), esc(d.get("uid", "")), esc(d.get("lname", "")), esc(d.get("name", "")),
                esc(d.get("media", "")), dd, esc(d.get("del_time", "")), esc(d.get("del_place", "")),
                cd, esc(d.get("col_time", "")), esc(d.get("col_place", "")), d.get("_aid", 0), aat_sql))
        if not vals:
            continue
        sql = ("insert into %s(resv_no,line_user_id,line_name,cust_name,media,del_date,del_time,del_place,"
               "col_date,col_time,col_place,answer_id,answered_at,source,updated_at) values\n" % tbl
               + ",\n".join(vals) +
               "\non conflict(resv_no) do update set line_user_id=excluded.line_user_id,"
               "line_name=excluded.line_name,cust_name=excluded.cust_name,"
               "media=coalesce(nullif(excluded.media,''),%s.media),"
               "del_date=coalesce(excluded.del_date,%s.del_date),"
               "del_time=coalesce(nullif(excluded.del_time,''),%s.del_time),"
               "del_place=coalesce(nullif(excluded.del_place,''),%s.del_place),"
               "col_date=coalesce(excluded.col_date,%s.col_date),"
               "col_time=coalesce(nullif(excluded.col_time,''),%s.col_time),"
               "col_place=coalesce(nullif(excluded.col_place,''),%s.col_place),"
               "answer_id=excluded.answer_id,answered_at=excluded.answered_at,updated_at=now();"
               % (tbl, tbl, tbl, tbl, tbl, tbl, tbl))
        n = len([1 for k in rec if k[0] == store])
        total += n
        if dry:
            print("[DRY] %s へ %d件 upsert予定" % (tbl, n)); continue
        before = q("select count(*) c from %s;" % tbl)
        res = q(sql)
        after = q("select count(*) c from %s;" % tbl)
        bc = before[0]["c"] if isinstance(before, list) else "?"
        ac = after[0]["c"] if isinstance(after, list) else "?"
        err = res.get("message") if isinstance(res, dict) else None
        if err:
            print("❌ %s 取込失敗: %s" % (tbl, err[:200]))
        else:
            print("✅ %s 取込完了: %d件処理 / 総数 %s→%s" % (tbl, n, bc, ac))
    if dry:
        print("DRYRUN 合計 %d件" % total)

if __name__ == "__main__":
    main()
