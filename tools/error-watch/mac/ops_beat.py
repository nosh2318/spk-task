#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# エラー見張り 第3段（Mac 側）2026-11-15 nosh「エラーを拾ってくれ」「全部」
# launchd（com.handyman.ops-beat）が5分ごとに起動する。やること：
#   1) Mac の自動処理（com.handyman.* / jp.rent-handyman.* / com.buddica.*）が「続けて2回」失敗で終わったら、main の ops_watch_events に1行書く
#      やり直しは launchd が次の予定の時刻にする（ここで立ち上げ直さない：送信系を二重に動かさないため）
#   2) オムニの常駐（omni-bridge 等）のエラーログに例外（Traceback）が30分で3回以上出たら、同じく1行書く
#      常駐が止まった時の立ち上げ直しは mini の自己回復（omni_selfheal）の仕事。ここは触らない
#   3) 自分の心拍を cli_heartbeat の ops_beat に書く（見張りが止まったことを DB 側で拾うため）
#   直ったら行を消す。Slack に出すのは DB の ops_watch（①原因②自動でやったこと③人がやること・1時間に1回）だけ
#   --dry：判定を表示するだけ（何も書かない）。鍵の値は表示しない
import json, os, re, subprocess, sys, time, urllib.request

D = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(D, ".ops_beat_state.json")
LOG = os.path.join(D, "ops_beat.log")
URL = "https://ckrxttbnawkclshczsia.supabase.co/rest/v1"
LABEL_RE = re.compile(r"^(com\.handyman|jp\.rent-handyman|com\.buddica)\.")
SELF = "com.handyman.ops-beat"
OMNI = {   # オムニの常駐（launchd の名前 → 画面に出す名前）
    "com.handyman.omni-bridge": "オムニ本体",
    "com.handyman.operation-bridge": "オペレーション",
    "com.handyman.mikuni-bridge": "ミクニ",
    "com.handyman.cs-autoreply": "お客様の自動返信",
    "com.handyman.cli-responder": "CLI 応答",
    "com.handyman.reconcile-staff-bot": "照合ボット",
    "com.handyman.invctl-slack-relay": "在庫ロボの Slack 中継",
    "com.buddica.maint-bridge": "高松 保守",
    "com.buddica.newdev-bridge": "高松 新規開発",
}
TB_N, TB_WIN = 3, 30 * 60


def log(msg):
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(time.strftime("%m/%d %H:%M:%S ") + msg + "\n")
    except Exception:
        pass


def key():
    for n in ("main_service_key", "sb_service_role"):
        try:
            k = open(os.path.expanduser("~/.config/keydrop/" + n)).read().strip()
            if k:
                return k
        except Exception:
            pass
    return None


def rest(method, path, body=None, prefer=None):
    k = key()
    if not k:
        raise RuntimeError("no key")
    h = {"apikey": k, "Authorization": "Bearer " + k, "Content-Type": "application/json"}
    if prefer:
        h["Prefer"] = prefer
    req = urllib.request.Request(URL + path, method=method, headers=h,
                                 data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status


def lc_print(label):
    try:
        return subprocess.run(["launchctl", "print", "gui/%d/%s" % (os.getuid(), label)],
                              capture_output=True, text=True, timeout=10).stdout
    except Exception:
        return ""


def field(txt, name):
    m = re.search(r"^\s*" + re.escape(name) + r" = (.+)$", txt, re.M)
    return m.group(1).strip() if m else None


def labels():
    out = subprocess.run(["launchctl", "list"], capture_output=True, text=True, timeout=10).stdout
    return sorted({l.split("\t")[-1] for l in out.splitlines()[1:] if LABEL_RE.match(l.split("\t")[-1])})


def short(label):
    return label.split(".", 2)[-1]


def check_jobs(st, events, now):
    # 2回続けて失敗＝1回目の後に launchd が次の時刻に動かし直して、それも失敗
    for lb in labels():
        if lb == SELF:
            continue
        t = lc_print(lb)
        runs, code = field(t, "runs"), field(t, "last exit code")
        if not runs or not runs.isdigit() or code is None or not re.fullmatch(r"-?\d+", code):
            continue   # まだ終わったことがない（常駐）・読めない
        runs, code = int(runs), int(code)
        s = st.setdefault("job|" + lb, {"runs": runs, "fails": 0, "since": None})
        if runs != s["runs"]:   # 前回から動いた（読み込み直しで数が戻った時も「動いた」に数える）
            if code != 0:
                s["fails"] += 1
                s["since"] = s["since"] or now
            else:
                s["fails"], s["since"] = 0, None
            s["runs"] = runs
        if s["fails"] >= 2:
            events["mac:" + lb] = {
                "title": "Mac の自動処理が続けて失敗しています：%s（%d回）" % (short(lb), s["fails"]),
                "why": "終了コード %d で終わった（ログは Mac の %s の記録）" % (code, short(lb)),
                "auto": "launchd が次の予定の時刻に自動でもう一度動かした → また失敗",
                "todo": "本部（オムニ）がログを見て直します。現場の対応は不要です",
                "mark": str(int(s["since"])),
            }


def check_omni(st, events, now):
    for lb, name in OMNI.items():
        path = field(lc_print(lb), "stderr path")
        if not path or not os.path.exists(path):
            continue
        s = st.setdefault("tb|" + lb, {"off": None, "ts": []})
        size = os.path.getsize(path)
        if s["off"] is None or size < s["off"]:   # 初回・ログが切り替わった：今の末尾から数える
            s["off"] = size
        n = 0
        if size > s["off"]:
            with open(path, "rb") as f:
                f.seek(s["off"])
                n = f.read(size - s["off"]).count(b"Traceback (most recent call last)")
            s["off"] = size
        s["ts"] = [x for x in s["ts"] if now - x < TB_WIN] + [now] * n
        if len(s["ts"]) >= TB_N:
            events["omni:" + lb] = {
                "title": "オムニ（%s）でエラーが続いています（30分で%d回）" % (name, len(s["ts"])),
                "why": "処理の途中で例外が出た（ログは Mac の %s）" % os.path.basename(path),
                "auto": "常駐は動き続けています（止まった時は mini の自己回復が立ち上げ直します）",
                "todo": "本部（オムニ）がログを見て直します。返事が来ない依頼は、もう一度送ってください",
                "mark": time.strftime("%m%d%H", time.localtime(s["ts"][0])),
            }


def beat(note):
    # 心拍は当番かどうかに関係なく毎回書く（DB が「休止中」と「Mac が止まった」を見分けるため）。events が書けなくても心拍は別に書く
    try:
        rest("POST", "/cli_heartbeat?on_conflict=id", {"id": "ops_beat", "beat_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
             "host": os.uname().nodename, "note": note}, "resolution=merge-duplicates,return=minimal")
    except Exception as e:
        log("beat err %s %s" % (type(e).__name__, str(e)[:80]))


def main(dry):
    try:
        sys.path.insert(0, os.path.expanduser("~/omni_bot"))
        import host_gate
        if not host_gate.is_my_turn():
            log("not on duty")
            if not dry:
                beat("当番外")
            return
    except Exception as e:
        log("gate err %s" % type(e).__name__)
    try:
        st = json.load(open(STATE))
    except Exception:
        st = {}
    now, events = time.time(), {}
    check_jobs(st, events, now)
    check_omni(st, events, now)
    if dry:
        for k, v in events.items():
            print(k, "→", v["title"])
        print("問題 %d 件（書き込みなし）" % len(events))
        return
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    still = set(st.get("open", []))   # 書いた・消せていない行（失敗した分は次の回にもう一度）
    for k, v in events.items():
        try:
            rest("POST", "/ops_watch_events?on_conflict=key", dict(v, key=k, seen_at=stamp), "resolution=merge-duplicates,return=minimal")
            still.add(k)
        except Exception as e:
            log("event err %s %s" % (k, type(e).__name__))
    for k in sorted(still - set(events)):   # 直った → 消す
        try:
            rest("DELETE", "/ops_watch_events?key=eq." + urllib.request.quote(k, safe=""), prefer="return=minimal")
            still.discard(k)
        except Exception as e:
            log("delete err %s %s" % (k, type(e).__name__))
    st["open"] = sorted(still)
    beat("%d件" % len(events))
    if events:
        log("open " + ",".join(sorted(events)))
    try:
        json.dump(st, open(STATE, "w"))
    except Exception:
        pass


if __name__ == "__main__":
    main("--dry" in sys.argv)
