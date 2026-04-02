# SPK業務管理APP（札幌店）

## プロジェクト概要
レンタカーショップ HANDYMAN 札幌デリバリー専門店の業務管理アプリ。
予約・配車・タスク・シフト・給与・車両・駐車場・会計・売上を一元管理。

- **本番URL**: https://spk-task.vercel.app
- **パスコード**: 2318
- **リポジトリ**: nosh2318/spk-task
- **デプロイ**: mainブランチpushでVercel自動デプロイ

## 技術スタック
- **フロントエンド**: Single HTML React（React 18.2.0 + Babel 7.23.9 + Tailwind CSS 2.2.19）
- **DB**: Supabase（PostgreSQL + Realtime）— 札幌・那覇共通
- **ホスティング**: Vercel
- **メール自動処理**: GAS（reserve@rent-handyman.jp）
- **PWA**: Service Worker対応

## ファイル構成
| ファイル | 用途 |
|---|---|
| `index.html` | メインアプリ（全機能を含む単一HTML、ビルド後） |
| `index2.html` | index.htmlのコピー（キャッシュバスター用） |
| `build.js` | Babelトランスパイル+Terser圧縮ビルドスクリプト |
| `app.js` | ソースコード（開発時はこちらを編集） |
| `license.html` | 免許証アップロードページ（独立HTML） |
| `sw.js` | Service Worker |
| `gas-email-import-v2.gs` | GASメール取込スクリプト（現行） |
| `SYSTEM_SPEC.md` | 詳細システム仕様書（DBスキーマ等） |

## 開発ルール
- **編集対象**: `app.js` を編集 → `node build.js` でindex.htmlを生成
- **index.htmlを直接編集しない**（ビルド生成物）
- **index2.html**: index.htmlと同一内容を維持（キャッシュ対策）
- デプロイ前にブラウザコンソールでエラー確認必須
- 白画面になったら即revert

## DB（Supabase）
- **メインURL**: https://ckrxttbnawkclshczsia.supabase.co
- **駐車場用（別PJ）**: https://rkrvjpipvpybkmqadmrb.supabase.co
- 詳細スキーマは `SYSTEM_SPEC.md` を参照
- DB問題は `sb.from("table").select("*").limit(1)` で実構造を確認してから修正

## 主要テーブル
- `reservations` — 予約データ（マスター）
- `fleet` — 配車（予約↔車両紐づけ）
- `vehicles` — 車両マスタ
- `tasks` — 日次オペレーションタスク（DEL/COL/洗車等）
- `staff` — スタッフマスタ
- `shifts` — シフト
- `attendance` — 勤怠
- `maintenance` — 整備・メンテナンス
- `places` — デリバリー/コレクション場所
- `parking_state` — 駐車場状態（別Supabase）

## 車両クラス
| クラス | 車種例 | カラー |
|---|---|---|
| A | アルファード/ヴェルファイア | 紫 `#7c3aed` |
| B | ノア/デリカD5 | 青 `#0284c7` |
| C | ロッキー/CX-3 | 緑 `#059669` |
| S | ハリアー/CX-5 | オレンジ `#d97706` |
| F | ルーミー/ソリオ | ピンク `#db2777` |
| H | カローラ/アクセラ | グレー `#64748b` |

## タブ構成
TOP / CSV取込 / スタッフ / 出勤簿 / 給与 / 配車 / 決済 / 車両 / 駐車場 / 会計 / 顧客 / 売上 / データ / 過去 / 免許証

## 現在のバージョン
- **APP_VERSION**: v466
- **sw.js CACHE_NAME**: `spk-v466`
- **index.html CV**: `spk-v466`
- **SRI/CSP**: 未適用（下記インシデント参照）

## インシデント履歴

### 2026-04-02: 本番白画面障害（SRI+SW干渉）
- **原因**: セキュリティ修正(e8fdd59)でSRI integrity属性+CSPヘッダーを追加したが、SWのCDNキャッシュと干渉しReactが読み込み不能に
- **エラー**: `ReferenceError: Can't find variable: React`（app.js:1:69）
- **修正**: SRI/CSP削除、SWバージョンをv466に統一(906230e)
- **教訓**:
  - SRI属性はSWのCDNキャッシュ(`spk-cdn-v1`)と共存不可
  - sw.js本体のCACHE_NAME更新を忘れると古いキャッシュが残る
  - **セキュリティ再導入時の手順**:
    1. SWのCDNキャッシュ戦略を先に見直す（SRI対応 or CDNキャッシュ廃止）
    2. SRI追加とSWバージョン更新を必ず同時に行う
    3. CSPは`Content-Security-Policy-Report-Only`で先にテスト
  - **index.html / sw.js / app.js のバージョンは3箇所すべて同時更新すること**

## じゃらん事前決済 自動化プロジェクト（2026-04-02開始）

### 概要
じゃらん予約のメール取込→Slack投稿→Squareリンク作成→メール送信→入金確認→キャンセル処理を自動化。
既存じゃらんタブはリリース日に新規停止、過去データ消し込み専用に移行。

### 現在の状態
- **GAS側**: コード完成済。全処理を `false` で無効化中（リリースまで動かさない）
- **DB**: `jalan_payments` テーブル作成済（jalan_payments_setup.sql）
- **Slack**: `#jalan_payment`（C0AQL6HGG3E）チャンネル作成済、SNS Autoボット参加済
- **AIスタッフ_G**: #jalan_payment でSquareリンク自動作成する設定済

### 店舗制限（絶対ルール）
- **札幌店のみ対象。那覇店には絶対に送らない**
- GAS自体が札幌専用（行4: Target: 札幌 store only）
- 3段階フィルターで沖縄予約を除外（行285-306）
- handleJalanPayment_ に那覇ガード追加（_storeに那覇/沖縄/OKA/naha含む場合BLOCK）
- sendJalanPaymentEmail_ にデータ不備ガード追加

### GAS無効化箇所（リリース時に外す `false`）
1. `processMessage_` 内: `if (false && reservation.ota === 'J' ...)` — 新規予約時のレコード作成+Slack投稿
2. `handleCancellation_` 内: `if (false) handleJalanPaymentCancel_(...)` — キャンセル連動
3. `checkSquareLinks` 内: `if (false && pay.status === 'link_created' ...)` — メール送信

### GASトリガー（リリース時に作成。現在は削除しておく）
- `checkSquareLinks` — 5分間隔（Squareリンク検出）
- `checkPaymentStatus` — 15分間隔（入金確認）
- `checkUnpaidAlert` — 毎朝9時（未入金アラート）
- `updateSheetOtaColumn` — 毎朝9:30（スプシOTA列自動記入）

### リリースまでのタスク
| # | 内容 | 状態 |
|---|------|------|
| ① | GASコード貼り直し（3箇所false無効化） | ⬅️ オーナー対応待ち |
| ② | GASトリガー4つ削除 | 待ち |
| ③ | APP: じゃらん決済タブ再構築（既存タブ→過去データ専用 + 新タブ） | 未着手 |
| ④ | APP: TOPウィジェット（決済状況サマリー） | 未着手 |
| ⑤ | APP: 配車表・データタブにステータス表示 | 未着手 |
| ⑥ | テスト（E2Eフロー確認） | 未着手 |
| ⑦ | リリース（GAS false外す + トリガー再作成 + デプロイ 全同時） | 未着手 |

### リリース手順（⑦の詳細）
1. APP: 新じゃらん決済タブ・ウィジェットをデプロイ
2. GAS: 3箇所の `false` を外してコード貼り直し
3. GAS: `setupJalanPaymentTriggers` を実行（トリガー4つ作成）
4. 既存じゃらんタブ → 新規入力停止（過去データ消し込み専用）

## GASプロジェクト一覧
| プロジェクト名 | 用途 | 最終更新 |
|---|---|---|
| 札幌予約メール自動配車 | reserve@のメール取込・自動配車・じゃらん決済（gas-email-import-v2.gs） | 2026/04/02 |
| HANDYMAN OTA自動登録 | 5OTA予約自動登録（30分間隔） | 2026/03/19 |
| Instagram自動投稿 v5 | SNS自動投稿パイプライン | 2026/04/02 |
| 那覇店 予約取込 | 那覇店のメール取込・自動配車 | 2026/04/02 |
| HANDYMAN 領収書Bot | Slack連携・領収書発行 | 2026/03/29 |
| HANDYMAN Payment | 決済関連 | 2026/03/29 |
| HANDYMAN朝サマリー | 朝のサマリー通知 | 2026/03/26 |
| HANDYMAN交通情報 | 交通情報通知 | 2026/03/25 |
| HANDYMAN自動返信メール | 自動返信（スプシ連携） | 2026/03/24 |

## 絶対ルール（CLAUDE.mdより）
- **PU = 空港出発（緑）/ BD = ヤード出発（赤）** — 逆にしない
- メンテナンス・別予約があるラインに配車しない
- OTA A/A2 → HANDYMAN H（アルファード）に変換
- 変数削除・リネーム前にGrep全体検索
- 推測修正は最大1回、直らなければ実環境確認
- 予約処理は古い順から1件ずつ（並列禁止）
