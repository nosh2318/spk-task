#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
デプロイ前 レンダー・スモークテスト（白画面/実行時エラー検知）
- node --check(構文)では捕まえられない「ビルドは通るのに実行時にAppがクラッシュ→全員白画面」を機械で検知。
- 実例: 2026-08-17 invTodoTotalがinvTodoCountを宣言前参照(TDZ: Cannot access before initialization)→白画面。
判定: 実行時に致命エラー(ReferenceError/TDZ/未定義呼び出し 等)が出たら FAIL。
使い方: python3 smoke_test.py   （成功=exit 0 / 失敗=exit 1 / 環境無し=skip 0）
pre-pushフックから呼ばれ、白画面ビルドのpushを止める。
"""
import sys, os, threading, functools, http.server, socketserver

DIR = os.path.dirname(os.path.abspath(__file__))

def serve():
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIR)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)  # 0=空きポート自動
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port

# SW(自己破棄型)による再読込ループを止める初期化スクリプト
DISABLE_SW = """
try {
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register = function(){ return Promise.reject(new Error('sw disabled for smoke test')); };
  }
} catch(e) {}
"""

FATAL_KEYS = ["before initialization", "ReferenceError", "is not defined",
              "is not a function", "Cannot access", "Cannot read prop",
              "undefined is not a", "TypeError: Cannot"]

def main():
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:
        print("⚠️ playwright未導入のためスモークテストをスキップ:", e)
        return 0  # 環境に無ければブロックしない（構文チェックは別で走る）

    httpd, port = serve()
    errors = []
    root_len = -1
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=True)
            ctx = browser.new_context()
            ctx.add_init_script(DISABLE_SW)
            page = ctx.new_page()
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
            page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="load", timeout=30000)
            page.wait_for_timeout(7000)  # React/Appがマウントするのを待つ
            el = page.query_selector("#root")
            root_len = len(page.eval_on_selector("#root", "el => el.innerHTML")) if el else -1
            browser.close()
    finally:
        httpd.shutdown()

    fatal = [e for e in errors if any(k in e for k in FATAL_KEYS)]
    if fatal:
        print("❌ スモークテスト失敗: 実行時エラー(=白画面の原因)を検知")
        for e in dict.fromkeys(fatal):  # 重複除去
            print("   -", e[:220])
        return 1
    print(f"✅ スモークテストOK: 実行時エラーなし（#root {root_len}字）")
    return 0

if __name__ == "__main__":
    sys.exit(main())
