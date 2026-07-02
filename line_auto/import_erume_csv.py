#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
エルメ フォーム回答CSV → spk_line_links 取込（userId↔予約番号）
使い方:
  export SB_SERVICE_ROLE="<service_role JWT>"   # 書き込みに必須
  python3 import_erume_csv.py /path/to/erume.csv [--dry]
仕様:
  - Shift-JIS/UTF-8 自動判定
  - 予約番号 空 / 'テスト'/'test' は除外
  - 同一予約番号は 最新回答（answer_id最大）を採用
  - upsert（resv_no PK, on_conflict=resv_no）
"""
import sys, csv, os, json, urllib.request, io

SB_URL = "https://ckrxttbnawkclshczsia.supabase.co"
KEY = os.environ.get("SB_SERVICE_ROLE", "")
TABLE = os.environ.get("SB_TABLE", "spk_line_links")  # 那覇は nha_line_links

def read_rows(path):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "cp932", "shift_jis"):
        try:
            txt = raw.decode(enc); break
        except UnicodeDecodeError:
            continue
    return list(csv.reader(io.StringIO(txt)))

def colidx(header, key):
    for i, c in enumerate(header):
        if key in c:
            return i
    return None

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    path = args[0] if args else "/tmp/erume.csv"
    rows = read_rows(path)
    h, data = rows[0], rows[1:]
    C = {k: colidx(h, k) for k in
         ["ユーザーID","予約番号","予約者名","LINE名","予約媒体","回答ID","回答日時",
          '"お届け"希望日','"お届け"希望時刻','"お届け"希望場所',
          '"返却"希望日','"返却"希望時刻','"返却"希望場所']}
    # フォールバック（引用符ゆれ対策）
    def gi(name, alt): return C.get(name) if C.get(name) is not None else colidx(h, alt)
    iU=C["ユーザーID"]; iR=C["予約番号"]; iN=C["予約者名"]; iL=C["LINE名"]; iM=C["予約媒体"]
    iAid=C["回答ID"]; iAt=C["回答日時"]
    iDd=gi('"お届け"希望日','お届け'); iDt=colidx(h,'"お届け"希望時刻'); iDp=colidx(h,'"お届け"希望場所')
    iCd=colidx(h,'"返却"希望日'); iCt=colidx(h,'"返却"希望時刻'); iCp=colidx(h,'"返却"希望場所')

    best = {}  # resv_no -> row dict (latest)
    skipped = 0
    for r in data:
        rn = (r[iR] or "").strip() if iR is not None else ""
        uid = (r[iU] or "").strip() if iU is not None else ""
        if not rn or not uid or "テスト" in rn or "test" in rn.lower():
            skipped += 1; continue
        try: aid = int((r[iAid] or "0").strip())
        except: aid = 0
        rec = {
            "resv_no": rn, "line_user_id": uid,
            "line_name": r[iL].strip() if iL is not None else None,
            "cust_name": r[iN].strip() if iN is not None else None,
            "media": r[iM].strip() if iM is not None else None,
            "del_date": r[iDd].strip() if iDd is not None else None,
            "del_time": r[iDt].strip() if iDt is not None else None,
            "del_place": r[iDp].strip() if iDp is not None else None,
            "col_date": r[iCd].strip() if iCd is not None else None,
            "col_time": r[iCt].strip() if iCt is not None else None,
            "col_place": r[iCp].strip() if iCp is not None else None,
            "answer_id": aid,
            "answered_at": (r[iAt].strip() if iAt is not None else None) or None,
            "source": "erume_csv",
        }
        if rn not in best or aid >= best[rn]["answer_id"]:
            best[rn] = rec
    recs = list(best.values())
    print(f"取込対象: {len(recs)}件 / 除外(空・テスト): {skipped}件")
    print("サンプル:", json.dumps(recs[:2], ensure_ascii=False)[:400])
    if dry:
        print("--dry: 書き込みなし"); return
    if not KEY:
        print("ERROR: 環境変数 SB_SERVICE_ROLE が未設定。書き込み不可。"); sys.exit(1)
    # answered_at は "YYYY/MM/DD HH:MM:SS" → ISOに寄せる（失敗時はnull）
    for rec in recs:
        a = rec.get("answered_at")
        if a:
            rec["answered_at"] = a.replace("/", "-").replace(" ", "T")
    body = json.dumps(recs, ensure_ascii=False).encode()
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{TABLE}?on_conflict=resv_no",
        data=body, method="POST",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}",
                 "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"})
    try:
        urllib.request.urlopen(req)
        print(f"✅ upsert完了: {len(recs)}件")
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:500])

if __name__ == "__main__":
    main()
