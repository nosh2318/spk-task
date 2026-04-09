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

### オフィシャル（HP）クラスマッピング
札幌は6クラス（A2/B2/Dなし＝那覇専用）
メール本文: `ご予約車両クラス\n  Xクラス` → 1文字抽出

| メールの記載例 | → クラス | 配車対象車両 |
|---|:---:|---|
| アルファード / ヴェルファイア（Aクラス） | A | ヴェルファイア（7673） |
| ノア / デリカD5（Bクラス） | B | ノア（5398）/ デリカD5（6057） |
| ロッキー / CX-3（Cクラス） | C | ロッキー（299）/ CX-3（4576） |
| ハリアー / CX-5（Sクラス） | S | ハリアー（5512）/ CX-5（8065） |
| ルーミー / ソリオ（Fクラス） | F | ソリオ（8529） |
| カローラFD / アクセラ（Hクラス） | H | DB登録車両による |

## タブ構成
TOP / CSV取込 / スタッフ / 出勤簿 / 給与 / 配車 / 決済 / 車両 / 駐車場 / 会計 / 顧客 / 売上 / データ / 過去 / 免許証

## 現在のバージョン
- **APP_VERSION**: v4.6.9
- **sw.js CACHE_NAME**: `spk-v472`
- **index.html CV**: `spk-v472`
- **SRI/CSP**: 未適用（下記インシデント参照）

## 2026-04-09 修正履歴

### Square未決済Handoverアラート（v4.6.9）
- **要望**: 発行済みSquare決済リンクが出発4日前でも未決済の場合、TOP Handoverに自動表示
- **実装**: `MemoBox` に Square請求書CSV（支払い管理シート）から未払い行を取得する useEffect を追加
- **フィルタ**: 店舗=札幌 & ステータス=⏳未払い & `reservations.lend_date` 優先（品目M/Dフォールバック）& daysLeft ≤ 4（当日・超過含む）
- **表示位置**: 「本日のHandover」赤ブロックの直前に「💳 Square未決済 Handover（出発4日前アラート）」専用ブロック
- **優先度色分け**: ≤1日=🚨赤 / それ以外=⏳オレンジ。各行にSquare支払いリンクボタン付き
- **自動更新**: 2分間隔
- **検証**: R0C04G1Z（シマダトシユキ、lend_date 2026-04-12、daysLeft=3）で対象化を確認
- ビルド: `node build.js` → index.html / index2.html 再生成

## 2026-04-06 修正履歴

### GAS SUPABASE_KEY 修正（根本原因）
- **問題**: GASからのDB登録が全て失敗（DY00000000927, DY00000000928）
- **原因**: GASスクリプトプロパティの`SUPABASE_KEY`がプレースホルダー文字列のまま（`<SERVICE_ROLE_KEYをSupabase Dashboardから取得して入力>`）
- **修正**: Supabase Dashboard → Settings → API → service_roleキーをGASスクリプトプロパティに設定
- **教訓**: `setupProperties()`のコード内プレースホルダーも正しいキーに書き換えておくこと（誤実行でキー上書き防止）

### DY00000000927 手動登録・配車
- skyticket予約（カメダ マリコ、Aクラス、2026-08-01 10:00-17:00、¥19,100）
- GAS自動取込が動かなかったため手動登録 → ヴェルファイア(VEL/7673)に配車済み

### DY00000000928 手動登録・配車
- skyticket予約（タカマツ ココネ、Sクラス、2026-04-18 11:00〜04-19 19:00、¥13,200、WEB事前決済・入金済み）
- GAS SUPABASE_KEY不正により自動取込失敗 → 手動登録 → CX-5(CX5/8065)に配車済み

### skyticket予約取込失敗の根本修正（GAS 2件）
- **問題**: DY00000000927がOTA自動登録GAS・札幌メール取込GASの両方で取り込まれなかった
- **原因1（OTA自動登録GAS）**: skyticket送信元が旧アドレス(`skyticket-rentalcar@adventure-inc.co.jp`)のまま。現行は`rentacar@skyticket.com`
- **原因2（OTA自動登録GAS）**: subject検索に「新規予約」が含まれていない（skyticket件名=「【skyticket】 新規予約」）
- **原因3（OTA自動登録GAS）**: `-label:`フィルタ使用（絶対ルール違反）
- **原因4（札幌メール取込GAS）**: subject完全一致チェックがスペース揺れに弱い
- **修正（OTA自動登録GAS `main.gs`）**:
  1. skyticket送信元: `rentacar@skyticket.com` 追加（旧アドレスも`skyticket2`として併存）
  2. `-label:`フィルタ除去 → `newer_than:2d` + メッセージID管理(`getProcessedMsgIds_`/`saveProcessedMsgIds_`)
  3. subject検索: `新規予約` 追加
  4. スレッド先頭のみ処理 → 全メッセージループ処理
  5. `detectOta()`: `skyticket2` → `skyticket` にマッピング
- **修正（札幌メール取込GAS `gas-email-import-v2.gs`）**:
  1. subject判定を全角/半角スペース正規化 + スペース完全除去での二重チェックに変更
- **GASエディタ**: 2026-04-06 両方貼り付け済み

## 2026-04-05 修正履歴

### 月初残高クロスデバイス同期（v4.6.6）
- **問題**: 会計タブの月初残高を入力したスタッフ以外の端末に反映されない
- **原因**: `localStorage` に保存していた（端末固有）
- **修正**: `app_settings` テーブル（Supabase DB）に保存→全端末で同期
- 初回起動時、localStorageにデータがあればDBに自動移行
- DBエラー時はlocalStorageフォールバック

### 洗車タスク時間指定
- **要望**: 翌日出発車両の洗車タスクにも時間を設定したい（アルバイトスケジュール管理目的）
- **修正**:
  - マスター表: 洗車行の時間列にドロップダウン（6:00〜22:00、5分刻み）を追加
  - 洗車タブ: 各洗車タスクにも時間ドロップダウンを追加
  - 選択→確認→DB保存（tasksテーブルのtimeカラム）
- **自動反映**: スケジュールタブ（時系列ソート）、タイムライン（TT行）、TOPスケジュール

### GAS: メール取込「DB登録失敗」誤通知の修正
- **問題**: 全て配車済みの予約に対して「❌ DB登録失敗」通知が出る
- **原因**: `-label:processed` をGmail検索から除外した際、メッセージID管理がなく全メール再処理→既存予約のINSERT失敗
- **修正**:
  1. メッセージID管理追加（`PROCESSED_MSG_IDS` in ScriptProperties、最大500件保持）
  2. INSERT失敗時にDB再確認→存在すればスキップ扱い（failure→skipに変更）
  3. `-label:` フィルタ完全除去（ラベルは視覚目印のみ）

### GAS: じゃらん入金確認をSquare API直接確認に変更
- **問題**: R0R8QVZR入金済みだが自動消し込みが動かない
- **原因**: `checkPaymentStatus()` がSlackスレッドの文言依存（AIスタッフ_G経由）→AIスタッフ_G不安定で検知不能
- **修正**: Square Orders Search APIで顧客名+金額照合→tenders有無で入金判定
- `checkSquarePayment_(token, paymentUrl, customerName, amount)` 新規関数
- `getSquareToken_()` + SQUARE_API_TOKEN追加（setupProperties実行済み）
- R0R8QVZR: DB手動で`paid`に更新済み（入金日: 2026-04-04T11:23:48Z、Mastercard末尾8920）

### GAS: スプレッドシート自動連動
- **問題**: Square請求書ウィジェットにR0R8QVZRが表示されない
- **原因**: ウィジェットはGoogleスプレッドシート（支払い管理シート）をCSV取得して表示するが、GASがスプレッドシートに書き込んでいなかった
- **修正**:
  - `appendToPaymentSheet_(pay, payUrl)` — Squareリンク取得時にスプレッドシートへ自動追加
  - `updatePaymentSheetStatus_(reservationId, newStatus, paidDate)` — 入金/キャンセル時にステータス自動更新
  - `checkSquareLinks()` / `checkPaymentStatus()` / `handleJalanPaymentCancel_()` にそれぞれ連動追加
- **スプレッドシート**: ID=`1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc` シート名=`支払い管理`

## 2026-04-04 修正履歴

### オフライン誤検知修正（v4.6.4）
- navigator.onLineだけでなくSupabase実接続確認を追加
- offlineイベント時にHEADリクエストで実接続チェック→OKならバナー非表示

### チャイルドシート未反映の根本修正
- **原因1**: OTA自動登録GAS(30分)が先に予約作成(opt_c=0)→メール取込GAS(15分)が「登録済み」スキップ→永遠に反映されない
- **原因2**: `parseJalan_()` にチャイルドシート検出が完全に欠落していた（楽天/スカイチケット/エアトリは実装済みだったがじゃらんだけ未実装）
- **修正4層**:
  1. GAS: 重複時にスキップせず欠落フィールド(opt_b/c/j,tel,mail,flight,people,price)を自動パッチ
  2. GAS: スカイチケット・エアトリパーサーにシート検出追加
  3. GAS: **`parseJalan_()` にチャイルドシート/ベビーシート/ジュニアシート検出を追加**（`オプション：`行からパース）
  4. APP: TOPタスク表示時にreservationsからopts値をフォールバック補完
- **GAS本体**: 2026-04-04反映済み
- **R0R8QVZR**: DB直接更新で opt_c=3 に修正済み

### OPシート「その他」タブ追加（v4.6.5）
- 新タスク種類: 車検🔍 / 整備🔧 / 送迎🚐 / 小タスク📝 / その他📌
- その他タブから追加・インライン編集・削除・完了チェック
- スケジュール/マスター/TOP担当者別セクションに自動表示

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
- **GAS側**: リリース済・稼働中（false解除済み）
- **DB**: `jalan_payments` テーブル稼働中
- **Slack**: `#jalan_payment`（C0AQL6HGG3E）チャンネル稼働中
- **AIスタッフ_G**: 不安定（2026-04-04にリンク作成未応答のインシデント発生。下記参照）

### 店舗制限（絶対ルール）
- **札幌店のみ対象。那覇店には絶対に送らない**
- GAS自体が札幌専用（行4: Target: 札幌 store only）
- 3段階フィルターで沖縄予約を除外（行285-306）
- handleJalanPayment_ に那覇ガード追加（_storeに那覇/沖縄/OKA/naha含む場合BLOCK）
- sendJalanPaymentEmail_ にデータ不備ガード追加

### 金額ルール（絶対）
- **じゃらん請求額 = 「利用者への請求額」（クーポン・ポイント差引後の税込額）**
- 「合計金額」ではない（クーポン・ポイント適用前の金額）
- GAS parseJalan_: 行401で `利用者への請求額` を優先取得、なければ `合計金額` にフォールバック
- Square請求書もSlack投稿もメール送信も、すべてこの金額を使用

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
| ① | GASコード（false解除+金額修正+件名修正+那覇ガード+送信元修正） | ✅ 2026-04-03 |
| ② | GASトリガー4つ作成 | ✅ 2026-04-03 |
| ③ | APP: じゃらん決済タブ再構築（新旧分離） | ✅ 2026-04-03 |
| ④ | APP: TOPウィジェット（決済状況サマリー） | ✅ 2026-04-03 |
| ⑤ | APP: OPマスター表に決済列 | ✅ 2026-04-03 |
| ⑥ | テスト（R0JQ20US実送信確認） | ✅ 2026-04-03 |
| ⑦ | リリース | ✅ 2026-04-03 |

### 既知の問題
- AIスタッフ_Gが同一予約番号の重複投稿を無視する（2回目のSlack投稿にはリンクを作らない）
- メール送信元: `from: 'reserve@rent-handyman.jp'` をGASに設定済み（Gmailエイリアス登録済み）

### 2026-04-05: 入金確認をSquare API直接確認に変更
- **旧**: Slackスレッドの「入金確認」「入金済み」文言を検知（AIスタッフ_G依存→不安定）
- **新**: Square Orders Search APIで顧客名+金額照合→tenders有無で入金判定
- `checkSquarePayment_(token, paymentUrl, customerName, amount)` 新規関数
- `getSquareToken_()` + `setupProperties`にSQUARE_API_TOKEN追加（実行済み）
- R0R8QVZR: DB手動で`paid`に更新済み（入金日: 2026-04-04T11:23:48Z、Mastercard末尾8920）

### 2026-04-04: AIスタッフ_G未応答 → Square手動作成で対応（R0R8QVZR）
- **症状**: GASがSlack投稿→AIスタッフ_Gがスレッド返信せず→Squareリンク未作成→メール未送信
- **原因**: AIスタッフ_Gの停止（原因不明）
- **対応**: Square APIを直接呼び出してリンク作成→DB更新→GASトリガーでメール自動送信
- **手動Squareリンク作成手順**（AIスタッフ_G障害時のフォールバック）:
  ```bash
  curl -X POST "https://connect.squareup.com/v2/online-checkout/payment-links" \
    -H "Authorization: Bearer <SQUARE_API_TOKEN>" \
    -H "Content-Type: application/json" \
    -H "Square-Version: 2024-01-18" \
    -d '{"idempotency_key":"<UUID>","quick_pay":{"name":"<品目（名前様）>","price_money":{"amount":<金額>,"currency":"JPY"},"location_id":"L8N7J9RKPN3WH"}}'
  ```
- **Square API情報**:
  - Token: `~/outputs/handyman-receipt-bot/Code.gs` のsetupProperties_参照
  - Location ID: `L8N7J9RKPN3WH`
  - レスポンスの `payment_link.url` がSquareリンク
- **DB更新後**: status=`link_created` にすれば次のcheckSquareLinks(5分)でメール自動送信される

### 2026-04-04: Square請求書ウィジェットにデータが出ない問題
- **症状**: じゃらん決済のSquareリンクが作成・メール送信されたが、APPのSquare請求書ウィジェットに表示されない
- **原因**: ウィジェットはGoogleスプレッドシート（支払い管理シート）からCSV取得して表示するが、GASがスプレッドシートに行を書き込んでいなかった
- **修正**:
  1. `appendToPaymentSheet_(pay, payUrl)` — Squareリンク取得時にスプレッドシートへ自動追加（重複チェック付き）
  2. `updatePaymentSheetStatus_(reservationId, newStatus, paidDate)` — 入金確認/キャンセル時にスプレッドシートのステータスも自動更新
  3. `checkSquareLinks()` にスプレッドシート書き込み呼び出しを追加
  4. `checkPaymentStatus()` に入金時のステータス更新を追加
  5. `handleJalanPaymentCancel_()` にキャンセル時のステータス更新を追加
- **スプレッドシート**: ID=`1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc` シート名=`支払い管理`
- **注意**: AIスタッフ_G障害で手動Square作成した場合は`checkSquareLinks()`を経由しないため、スプレッドシートには手動追加が必要（`addR0R8QVZRtoSheet`のような一時関数を作って実行）

## GASプロジェクト一覧
| プロジェクト名 | 用途 | 最終更新 |
|---|---|---|
| 札幌予約メール自動配車 | reserve@のメール取込・自動配車・じゃらん決済（gas-email-import-v2.gs） | 2026/04/04 |
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
