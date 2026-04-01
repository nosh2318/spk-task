# 札幌店APP (spk-task)

## デプロイ
- 本番: https://spk-task.vercel.app/
- バージョン: v4.6.3
- Vercel自動デプロイ（mainプッシュ）

## 構成
- Single HTML React + Supabase
- メインファイル: index.html
- index2.html: 開発中の次バージョン（未コミット変更あり）
- punch.html: 勤怠打刻
- license.html: 免許証関連
- clear.html: クリア用

## 主な機能
- 配車管理（予約の車両割り当て・タイムライン）
- 駐車場管理（入出庫・洗車・メンテ）
- OPシート（オプション管理）
- Square請求書ウィジェット（TOP画面）
- じゃらん決済確認
- CSV取込（OTA予約インポート）
- 会計（現金出納帳・予約外売上・立替金）
- 給与計算（日給/時給/休憩/固定曜日対応）
- タスク同期（Supabase Realtime + ポーリング）

## じゃらん自動返信システム（2026-04-01 実装）
- じゃらん新規予約メール → Square請求書自動作成 → テンプレメール自動返信 → スプレッドシート記録
- GAS: gas-email-import-v2.gs に handleJalanAutoReply_() を追加
- Square API直接呼出し（スクリプトプロパティ: SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID）
- スプレッドシート記録（スクリプトプロパティ: JALAN_SHEET_ID）
- APP: JalanPayment コンポーネント再構築（フィルタ: 未送信/送信済み未入金/入金済み）
- 請求金額 = メール内「利用者への請求額」（billingAmount）

## 注意事項
- 那覇店APP（handyman-fleet.vercel.app）とは別リポジトリ（~/Downloads/naha-project/）
- GAS自動配車: 15分間隔
