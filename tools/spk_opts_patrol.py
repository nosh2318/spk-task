#!/usr/bin/env python3
"""
札幌店 全予約 オプション(opt_b/opt_c/opt_j) 整合性パトロール

Pattern A: reservations.opt_c と tasks.opt_c / changed_json._optC のズレ
           → tasks同期漏れ → 自動修正可能
Pattern B: option_price > 0 なのに opt_b=opt_c=opt_j=0 (+ insurance="なし")
           → パース失敗の疑い → 要目視確認
Pattern C: opt_b/opt_c/opt_j > 8 or option_price > 50000 などの異常値
           → リスト化
"""
import json
import urllib.request
import urllib.parse
import sys

SUPA_URL = "https://ckrxttbnawkclshczsia.supabase.co"
SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcnh0dGJuYXdrY2xzaGN6c2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Nzg1NTAsImV4cCI6MjA4NzQ1NDU1MH0.kDC_UDVWvcrS97wzqQ3NXP79ewjgYwF4vSFdV7y06S8"

def sb_get(path):
    req = urllib.request.Request(
        f"{SUPA_URL}/rest/v1/{path}",
        headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def sb_patch(path, body):
    req = urllib.request.Request(
        f"{SUPA_URL}/rest/v1/{path}",
        method="PATCH",
        headers={
            "apikey": SUPA_KEY,
            "Authorization": f"Bearer {SUPA_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        data=json.dumps(body).encode()
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def fetch_all(table, select, extra="", id_col="id"):
    """1000件超対応 ページネーション (Range header方式)"""
    rows = []
    offset = 0
    chunk = 1000
    while True:
        path = f"{table}?select={select}&order={id_col}.asc"
        if extra:
            path += "&" + extra
        req = urllib.request.Request(
            f"{SUPA_URL}/rest/v1/{path}",
            headers={
                "apikey": SUPA_KEY,
                "Authorization": f"Bearer {SUPA_KEY}",
                "Range-Unit": "items",
                "Range": f"{offset}-{offset+chunk-1}",
            }
        )
        try:
            with urllib.request.urlopen(req) as r:
                batch = json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (416, 200):  # Range Not Satisfiable = 終端
                break
            raise
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < chunk:
            break
        offset += chunk
    return rows

print("[1/3] reservations 取得中...")
resvs = fetch_all(
    "reservations",
    "id,name,ota,vehicle,lend_date,return_date,opt_b,opt_c,opt_j,option_price,base_price,discount,price,insurance,status",
    extra="status=neq.cancelled"
)
print(f"    {len(resvs)} 件取得")

print("[2/3] tasks 取得中...")
tasks_all = fetch_all(
    "tasks",
    "_id,reservation_id,type,opt_b,opt_c,opt_j,changed_json",
    id_col="_id"
)
print(f"    {len(tasks_all)} 件取得")

# tasks をreservation_idでグループ化
from collections import defaultdict
tasks_by_resv = defaultdict(list)
for t in tasks_all:
    tasks_by_resv[t.get("reservation_id")].append(t)

# パターン分類
pattern_a = []  # tasks同期漏れ (自動修正可能)
pattern_b = []  # option_price>0 でも opt 全0 (要目視)
pattern_c = []  # 異常値

for r in resvs:
    rid = r["id"]
    rb = int(r.get("opt_b") or 0)
    rc = int(r.get("opt_c") or 0)
    rj = int(r.get("opt_j") or 0)
    opt_price = float(r.get("option_price") or 0)
    insurance = (r.get("insurance") or "").strip()

    # Pattern C: 異常値
    if rb > 8 or rc > 8 or rj > 8:
        pattern_c.append({
            "id": rid, "name": r["name"], "ota": r["ota"],
            "lend": r["lend_date"], "opts": f"B={rb}/C={rc}/J={rj}",
            "reason": "シート数 > 8"
        })

    # Pattern A: tasks同期チェック
    ts = tasks_by_resv.get(rid, [])
    sync_issues = []
    for t in ts:
        tid = t["_id"]
        tb = bool(t.get("opt_b"))
        tc = bool(t.get("opt_c"))
        tj = bool(t.get("opt_j"))
        cj_str = t.get("changed_json") or ""
        try:
            cj = json.loads(cj_str) if cj_str else {}
        except Exception:
            cj = {}
        cjB = int(cj.get("_optB") or 0)
        cjC = int(cj.get("_optC") or 0)
        cjJ = int(cj.get("_optJ") or 0)

        # reservations の値と比較
        # tasks.opt_X (boolean) は count > 0 と一致すべき
        # changed_json._optX (int) は count と一致すべき
        if (tb != (rb > 0)) or (tc != (rc > 0)) or (tj != (rj > 0)):
            sync_issues.append({
                "task_id": tid,
                "want": {"opt_b": rb > 0, "opt_c": rc > 0, "opt_j": rj > 0},
                "got": {"opt_b": tb, "opt_c": tc, "opt_j": tj},
                "field": "boolean",
            })
        if cjB != rb or cjC != rc or cjJ != rj:
            sync_issues.append({
                "task_id": tid,
                "want": {"_optB": rb, "_optC": rc, "_optJ": rj},
                "got": {"_optB": cjB, "_optC": cjC, "_optJ": cjJ},
                "field": "changed_json",
                "cj_full": cj,
            })

    if sync_issues:
        pattern_a.append({
            "id": rid, "name": r["name"], "ota": r["ota"],
            "lend": r["lend_date"],
            "resv_opts": f"B={rb}/C={rc}/J={rj}",
            "task_count": len(ts),
            "issues": sync_issues,
        })

    # Pattern B: option_price>0 / opt全0 / 補償あり以外
    # 補償ありの場合 option_price=補償料金で説明できる → 除外
    # 補償なし or 免責 で option_price>0 / opt全0 → シート類が漏れている疑い
    if opt_price > 0 and rb == 0 and rc == 0 and rj == 0:
        # 補償料金が低めだとオプション料金 = 補償料金で説明できる場合あり
        # 楽天/じゃらん/skyticket: NOC約¥1,100/日, フル¥3,300/日, 免責¥1,100/日
        # opt_price > 800 程度なら他オプション（シート類）の可能性
        try:
            ld = r["lend_date"]
            rd = r["return_date"]
            from datetime import date
            d1 = date.fromisoformat(ld)
            d2 = date.fromisoformat(rd)
            days = max(1, (d2 - d1).days)
        except Exception:
            days = 1
        # 1日あたりオプション料金
        per_day = opt_price / days
        # NOC料金で説明できる目安: per_day <= 1200
        # それ以外は怪しい
        if per_day > 1200 or insurance in ("", "なし"):
            pattern_b.append({
                "id": rid, "name": r["name"], "ota": r["ota"],
                "lend": ld, "return": rd, "days": days,
                "opt_price": opt_price, "per_day": round(per_day),
                "insurance": insurance,
                "reason": "補償なしでも option_price > 0 / シート類抜けの疑い" if insurance in ("", "なし") else f"日割¥{round(per_day)} > ¥1,200 / シート類抜けの疑い",
            })

# 出力
print()
print("=" * 80)
print(f"📊 パトロール結果（札幌店 全予約 {len(resvs)} 件）")
print("=" * 80)
print()

print(f"🔴 Pattern A: tasks 同期漏れ（自動修正可能） — {len(pattern_a)} 件")
print("   reservations の opts が tasks に同期されていない")
for x in pattern_a[:50]:
    issues_summary = []
    for i in x["issues"]:
        if i["field"] == "boolean":
            issues_summary.append(f"{i['task_id']} bool: {i['got']}→{i['want']}")
        else:
            issues_summary.append(f"{i['task_id']} cj: {i['got']}→{i['want']}")
    print(f"   - {x['id']} {x['name']:14s} {x['ota']} {x['lend']} resv:{x['resv_opts']}")
    for s in issues_summary[:3]:
        print(f"       └ {s}")
if len(pattern_a) > 50:
    print(f"   ... 他 {len(pattern_a)-50} 件")
print()

print(f"🟡 Pattern B: option_price > 0 / opt全0 / シート類欠落の疑い — {len(pattern_b)} 件")
for x in pattern_b[:50]:
    print(f"   - {x['id']} {x['name']:14s} {x['ota']} {x['lend']} {x['days']}日 opt¥{int(x['opt_price'])}=¥{x['per_day']}/日 ins='{x['insurance']}' ({x['reason']})")
if len(pattern_b) > 50:
    print(f"   ... 他 {len(pattern_b)-50} 件")
print()

print(f"⚠️  Pattern C: シート数異常値 — {len(pattern_c)} 件")
for x in pattern_c:
    print(f"   - {x['id']} {x['name']:14s} {x['ota']} {x['lend']} {x['opts']} ({x['reason']})")
print()

# 結果をファイル保存
out = {
    "summary": {
        "total_reservations": len(resvs),
        "pattern_a_count": len(pattern_a),
        "pattern_b_count": len(pattern_b),
        "pattern_c_count": len(pattern_c),
    },
    "pattern_a": pattern_a,
    "pattern_b": pattern_b,
    "pattern_c": pattern_c,
}
with open("/tmp/spk_opts_patrol_result.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f"💾 詳細: /tmp/spk_opts_patrol_result.json に保存")

# Pattern A の自動修正
if pattern_a and "--fix" in sys.argv:
    print()
    print("=" * 80)
    print("🔧 Pattern A 自動修正開始")
    print("=" * 80)
    fixed = 0
    failed = 0
    for x in pattern_a:
        rid = x["id"]
        # reservations の正値
        rb = int([r for r in resvs if r["id"] == rid][0].get("opt_b") or 0)
        rc = int([r for r in resvs if r["id"] == rid][0].get("opt_c") or 0)
        rj = int([r for r in resvs if r["id"] == rid][0].get("opt_j") or 0)
        # 各 task を更新
        for t in tasks_by_resv.get(rid, []):
            tid = t["_id"]
            cj_str = t.get("changed_json") or ""
            try:
                cj = json.loads(cj_str) if cj_str else {}
            except Exception:
                cj = {}
            cj["_optB"] = rb
            cj["_optC"] = rc
            cj["_optJ"] = rj
            body = {
                "opt_b": rb > 0,
                "opt_c": rc > 0,
                "opt_j": rj > 0,
                "changed_json": json.dumps(cj, ensure_ascii=False),
            }
            try:
                sb_patch(f"tasks?_id=eq.{urllib.parse.quote(tid)}", body)
                fixed += 1
            except Exception as e:
                print(f"   ❌ {tid}: {e}")
                failed += 1
        # メモも整合性を取る
    print(f"✅ 修正完了: {fixed} tasks 更新 / 失敗: {failed}")
else:
    print()
    print(f"💡 自動修正するには: python3 {sys.argv[0]} --fix")
