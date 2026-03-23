# 札幌店タスク管理システム - システム仕様書

## 1. システム概要

- **アプリ名**: 札幌店 タスク管理（SPK タスク管理）
- **用途**: レンタカーショップ HANDYMAN 札幌デリバリー専門店の予約・配車・タスク管理
- **技術スタック**:
  - フロントエンド: Single HTML file React アプリ（React 18.2.0 + Babel 7.23.9 + Tailwind CSS 2.2.19）
  - バックエンド/DB: Supabase（PostgreSQL + Realtime + Storage）
  - ホスティング: Vercel（自動デプロイ）
  - メール自動処理: Google Apps Script（GAS）
  - 車両位置追跡: CARMON（Alpine 社）
  - 地図表示: Leaflet（オンデマンド読込）
  - PWA 対応: Service Worker によるキャッシュ、standalone モード

---

## 2. インフラ構成

### GitHub

- リポジトリ: `nosh2318/spk-task`

### Vercel

- URL: `https://spk-task.vercel.app`
- デプロイ: `main` ブランチへの push で自動デプロイ

### Supabase（メイン）

- プロジェクト名: `handyman-deve`
- プロジェクト ID: `ckrxttbnawkclshczsia`
- URL: `https://ckrxttbnawkclshczsia.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcnh0dGJuYXdrY2xzaGN6c2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Nzg1NTAsImV4cCI6MjA4NzQ1NDU1MH0.kDC_UDVWvcrS97wzqQ3NXP79ewjgYwF4vSFdV7y06S8`

### Supabase（駐車場用・別プロジェクト）

- URL: `https://rkrvjpipvpybkmqadmrb.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcnZqcGlwdnB5YmttcWFkbXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjI4MjQsImV4cCI6MjA4ODM5ODgyNH0.Jq_yIfAp1gsXdOtigwEwMb43iPD188PRKKdwc0D4tU4`
- テーブル: `parking_state`（id=1 の単一行で状態管理）

### GAS（Google Apps Script）

- プロジェクト名: 札幌予約メール自動配車
- Gmail アカウント: `reserve@rent-handyman.jp`
- Slack 通知先: `x-aaaatppttzyrldnhjt5el4jj3i@gl-oke5175.slack.com`（メール経由で Slack チャンネル `#claude_タスク実行通知` に投稿）

---

## 3. ファイル構成

| ファイル | 用途 |
|---|---|
| `index.html` | メインアプリ（React SPA、全機能を含む約631KB の単一HTML） |
| `index2.html` | `index.html` のコピー（キャッシュバスター用） |
| `license.html` | 免許証アップロードページ（独立HTML、Supabase Storage 連携） |
| `sw.js` | Service Worker（HTML ファイルのキャッシュ制御） |
| `gas-email-import.gs` | GAS メール取込スクリプト（旧バージョン） |
| `gas-email-import-v2.gs` | GAS メール取込スクリプト（現行バージョン v2） |
| `spk-task-manager.html` | 旧バージョンのアプリ（アーカイブ） |
| `README.md` | リポジトリ README |

---

## 4. データベーススキーマ

### 4.1 reservations（予約）

メインの予約データテーブル。全機能のマスターデータ。

| カラム | 型 | 説明 |
|---|---|---|
| `id` | TEXT (PK) | 予約番号（OTA発行のID） |
| `ota` | TEXT | OTA識別子（R/J/S/O/HP） |
| `name` | TEXT | 予約者名 |
| `lend_date` | TEXT | 貸出日（YYYY-MM-DD） |
| `lend_time` | TEXT | 貸出時間（HH:MM） |
| `return_date` | TEXT | 返却日（YYYY-MM-DD） |
| `return_time` | TEXT | 返却時間（HH:MM） |
| `people` | INTEGER | 乗車人数 |
| `vehicle` | TEXT | 車両クラス（A/B/C/S/F/H） |
| `insurance` | TEXT | 保険区分 |
| `tel` | TEXT | 電話番号 |
| `mail` | TEXT | メールアドレス |
| `price` | NUMERIC | 料金 |
| `status` | TEXT | ステータス（確定/キャンセル等） |
| `visit_type` | TEXT | 来店方法（DEL=デリバリー/来店） |
| `return_type` | TEXT | 返却方法（COL=コレクション/来店） |
| `del_time` | TEXT | デリバリー時間 |
| `del_place` | TEXT | デリバリー場所 |
| `col_time` | TEXT | コレクション時間 |
| `col_place` | TEXT | コレクション場所 |
| `flight` | TEXT | フライト便名 |
| `opt_b` | INTEGER | ベビーシート数量 |
| `opt_c` | INTEGER | チャイルドシート数量 |
| `opt_j` | INTEGER | ジュニアシート数量 |
| `opt_usb` | BOOLEAN | USBケーブルオプション |
| `opt_parasol` | BOOLEAN | 日傘オプション |
| `prefecture` | TEXT | 免許証住所の都道府県 |
| `created_at` | TIMESTAMPTZ | 作成日時 |
| `updated_at` | TIMESTAMPTZ | 更新日時 |

### 4.2 fleet（配車）

予約と車両の紐づけテーブル。

| カラム | 型 | 説明 |
|---|---|---|
| `reservation_id` | TEXT (PK) | 予約ID（reservations.id への参照） |
| `vehicle_code` | TEXT | 車両コード（vehicles.code への参照） |
| `updated_at` | TIMESTAMPTZ | 更新日時 |

### 4.3 vehicles（車両マスタ）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | SERIAL (PK) | 自動採番ID |
| `code` | TEXT (UNIQUE) | 車両コード（例: VEL, NRH） |
| `name` | TEXT | 車両名（例: ヴェルファイア） |
| `plate_no` | TEXT | ナンバープレート |
| `type` | TEXT | 車両クラス（A/B/C/S/F/H） |
| `seats` | INTEGER | 定員 |
| `insurance_veh` | BOOLEAN | 保険車両フラグ（true=保険代車） |
| `year` | TEXT | 年式 |
| `equip` | TEXT | 装備 |
| `ins_price` | TEXT | 保険価格 |

### 4.4 tasks（タスク）

日次のオペレーションタスク（DEL/COL/洗車等）。

| カラム | 型 | 説明 |
|---|---|---|
| `_id` | TEXT (PK) | タスクID（UUID的な一意キー） |
| `date` | TEXT | 日付（YYYY-MM-DD） |
| `type` | TEXT | タスク種別（DEL/COL/洗車/その他等） |
| `time` | TEXT | 時間（HH:MM） |
| `name` | TEXT | 予約者名 |
| `assignee` | TEXT | 担当者 |
| `done` | BOOLEAN | 完了フラグ |
| `memo` | TEXT | メモ（B/C/Jオプション数量を `##BCJ:` タグで埋込） |
| `reservation_id` | TEXT | 予約ID |
| `ota` | TEXT | OTA識別子 |
| `tel` | TEXT | 電話番号 |
| `mail` | TEXT | メールアドレス |
| `assigned_vehicle` | TEXT | 配車車両コード |
| `plate_no` | TEXT | ナンバープレート |
| `people` | INTEGER | 乗車人数 |
| `place` | TEXT | 場所 |
| `vehicle` | TEXT | 車両クラス |
| `insurance` | TEXT | 保険区分 |
| `insurance_change` | TEXT | 保険変更情報 |
| `flight` | TEXT | フライト便名 |
| `return_date` | TEXT | 返却日 |
| `return_time` | TEXT | 返却時間 |
| `return_type` | TEXT | 返却方法 |
| `col_place` | TEXT | コレクション場所 |
| `sort_order` | INTEGER | 表示順 |
| `changed_json` | TEXT | 変更差分のJSON（オプション数量含む） |
| `assignee_custom` | BOOLEAN | 担当者手動設定フラグ |
| `time_changed` | BOOLEAN | 時間手動変更フラグ |
| `opt_b` | INTEGER | ベビーシート（レガシー） |
| `opt_c` | INTEGER | チャイルドシート（レガシー） |
| `opt_j` | INTEGER | ジュニアシート（レガシー） |
| `opt_usb` | BOOLEAN | USBケーブル |
| `opt_parasol` | BOOLEAN | 日傘 |
| `yakkan` | TEXT | 約款 |
| `line` | TEXT | LINE |
| `payment` | TEXT | 支払い |

### 4.5 maintenance（整備・メンテナンス）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | TEXT (PK) | メンテナンスID |
| `vehicle_code` | TEXT | 車両コード |
| `start_date` | TEXT | 開始日 |
| `end_date` | TEXT | 終了日 |
| `label` | TEXT | ラベル（車検、点検等） |

### 4.6 staff（スタッフ）

| カラム | 型 | 説明 |
|---|---|---|
| `name` | TEXT (PK) | スタッフ名 |
| `type` | TEXT | 雇用形態 |
| `memo` | TEXT | メモ |
| `sort_order` | INTEGER | 表示順 |
| `hourly_wage` | INTEGER | 時給 |
| `transport_cost` | INTEGER | 交通費 |
| `monthly_salary` | INTEGER | 月給 |

### 4.7 shifts（シフト）

| カラム | 型 | 説明 |
|---|---|---|
| `date` | TEXT | 日付 |
| `staff_name` | TEXT | スタッフ名 |
| `symbol` | TEXT | シフト記号 |
| `start_time` | TEXT | 開始時間 |
| `end_time` | TEXT | 終了時間 |
| `memo` | TEXT | メモ |
| *(複合PK)* | | `date, staff_name` |

### 4.8 attendance（勤怠）

| カラム | 型 | 説明 |
|---|---|---|
| `date` | TEXT | 日付 |
| `staff_name` | TEXT | スタッフ名 |
| `start_time` | TEXT | 出勤時間 |
| `end_time` | TEXT | 退勤時間 |
| `approved` | BOOLEAN | 承認フラグ |
| `memo` | TEXT | メモ |
| `absent` | BOOLEAN | 欠勤フラグ |
| *(複合PK)* | | `date, staff_name` |

### 4.9 places（場所）

| カラム | 型 | 説明 |
|---|---|---|
| `reservation_id` | TEXT (PK) | 予約ID |
| `del_place` | TEXT | デリバリー場所 |
| `col_place` | TEXT | コレクション場所 |

### 4.10 app_settings（アプリ設定）

| カラム | 型 | 説明 |
|---|---|---|
| `key` | TEXT (PK) | 設定キー |
| `value` | TEXT | 設定値 |

- `team_password`: チームパスワード（ログイン認証用）

### 4.11 parking_state（駐車場状態）※別Supabaseプロジェクト

| カラム | 型 | 説明 |
|---|---|---|
| `id` | INTEGER (PK) | 常に1（単一行） |
| `data` | JSONB | 駐車場の入出庫状態データ |

### 4.12 Storage バケット

- **バケット名**: `licenses`
- **アクセス**: Private
- **RLS ポリシー**: `INSERT` + `SELECT` for `anon` ロール
- **構造**: `{予約番号}/person{N}_{front|back}_{timestamp}.jpg`
- **付属ファイル**: `{予約番号}/info_{氏名}.txt`（予約者識別用テキスト）

---

## 5. 車両クラス構成

| クラス | 車種例 | 定員 | カラーコード |
|---|---|---|---|
| A | トヨタ アルファード / ヴェルファイア | 8名 | `#7c3aed`（紫） |
| B | トヨタ ノア / 三菱 デリカD5 | 8名 | `#0284c7`（青） |
| C | ダイハツ ロッキー / マツダ CX-3 | 5名 | `#059669`（緑） |
| S | トヨタ ハリアー / マツダ CX-5 | 5名 | `#d97706`（オレンジ） |
| F | トヨタ ルーミー / スズキ ソリオ | 5名 | `#db2777`（ピンク） |
| H | トヨタ カローラ フィールダー / マツダ アクセラ | 5名 | `#64748b`（グレー） |

### 初期車両データ（INIT_VEHICLES）

| コード | 車名 | ナンバー | クラス |
|---|---|---|---|
| VEL | ヴェルファイア | 7673 | A |
| NRH | ノア | 5398 | B |
| DLC | デリカD5 | 6057 | B |
| RKY | ロッキー | 299 | C |
| CX3 | CX-3 | 4576 | C |
| HRI | ハリアー | 5512 | S |

※ 実際の車両データは Supabase `vehicles` テーブルで管理。上記は DB 未接続時のフォールバック。

---

## 6. 主要機能一覧

### ナビゲーションタブ

| タブID | アイコン | ラベル | 説明 |
|---|---|---|---|
| `top` | 🏠 | TOP | メインダッシュボード |
| `import` | 📁 | CSV | CSV予約データ取込 |
| `staff` | 👥 | スタッフ | スタッフマスタ管理（PASGuard保護） |
| `shift` | 📅 | 出勤簿 | シフト管理 |
| `attendance` | ⏰ | 給与 | 勤怠・給与計算（PASGuard保護） |
| `fleet` | 🚗 | 配車 | 配車表タイムライン |
| `jalanpay` | 💳 | 決済 | じゃらん決済ステータス管理 |
| `vehicle` | 🔧 | 車両 | 車両マスタ・整備管理 |
| `parking` | 🅿️ | 駐車場 | 入出庫管理 |
| `accounting` | 💰 | 会計 | 現金出納帳（PASGuard保護） |
| `customer` | 👑 | 顧客 | リピーター分析 |
| `dashboard` | 📊 | 売上 | 売上ダッシュボード |
| `data` | 📋 | データ | 予約データ一覧・検索 |
| `history` | 📜 | 過去 | 過去タスク参照 |
| `license` | 🪪 | 免許証 | 免許証アップロード（外部ページ） |

### 6.1 TOP（メインダッシュボード）

- タスクサマリー表示（当日・翌日のDEL/COL/洗車タスク）
- ステータス切替（完了/未完了トグル）
- **LINE テンプレート**: 予約者への LINE メッセージ定型文生成
- **CARMON 連携**: 車両位置確認サービスへのリンク、ID/PASS のコピー機能
- **免許証リンク**: license.html への遷移
- 設定セクション（キャッシュクリア、DB接続状態表示）

### 6.2 OPシート（オペレーションシート）

- フルスクリーンモーダルで表示
- サブタブ切替: サマリー / DEL / COL / 洗車 / その他 / マスター（車両管理）
- タスク行の編集（時間、担当者、車両割当、完了チェック）
- ドラッグ&ドロップによる並び替え
- 予約ごとのタスク自動生成
- 車両一括変更（クラス内車両変更時にタスクも連動更新）

### 6.3 配車表（Fleet Timeline）

- **表示モード**: 月表示 / 週表示 / 日表示
- 横軸: 日付、縦軸: クラス別車両
- 予約バーをタイムライン上に表示（クリックで詳細編集）
- **手動配車**: 予約をドラッグして車両に割当
- **自動配車**: 同クラス空車を自動検索して割当
- **未配車アラート**: 配車未完了の予約を警告表示
- **保険車両フラグ**: `insurance_veh` が true の車両を視覚的に区別（自動配車から除外）
- メンテナンス期間の表示
- クラスごとの折りたたみ表示
- レスポンシブ対応（モバイル/デスクトップ）

### 6.4 CSV取込（Import）

- OTA 予約 CSV ファイルのインポート
- エンコーディング自動判定（encoding-japanese ライブラリ使用）
- OTA 別の変更通知（増減サマリー）
- インポート後のデータ差分表示

### 6.5 データタブ

- 予約一覧表示
- 日付フィルタ
- 全項目の直接編集
- OPシート・配車表との完全連動（reservations テーブルがマスター）

### 6.6 車両管理（Vehicle）

- 車両 CRUD（追加/編集/削除）
- 保険車両フラグ（`insurance_veh`）
- 年式・装備・保険価格の管理
- クラスごとのグループ表示
- 整備管理（Fleet Manager）サブタブ

### 6.7 免許証アップロード（license.html）

- 予約番号・氏名入力
- 都道府県選択（47都道府県 + 海外）
- 最大8名分の運転者対応
- 表面（必須）・裏面（任意）の画像アップロード
- 画像圧縮: 最大1200px、JPEG 70% 品質
- Supabase Storage `licenses` バケットへアップロード
- URL クエリパラメータで予約番号・氏名の自動入力（`?id=xxx&name=xxx`）
- 都道府県を reservations テーブルの `prefecture` カラムに自動保存
- info テキストファイルの自動生成（予約者識別用）

### 6.8 解析

- エリア分析（都道府県別の予約分布）
- 場所分布（DEL/COL の場所別集計）
- 時間帯分析

### 6.9 売上ダッシュボード

- クラス別稼働率（月次）
- 月次売上推移
- クラス別売上・台当たり売上
- 稼働率の色分け表示（70%以上=緑、40%以上=オレンジ、40%未満=赤）

### 6.10 じゃらん決済

- じゃらん OTA の決済ステータス管理

### 6.11 駐車場

- 入出庫管理
- 別 Supabase プロジェクトで状態管理（`parking_state` テーブル）
- Realtime で状態変更を即時反映

### 6.12 出勤簿 / 給与 / スタッフ

- スタッフマスタ管理（PASGuard でパスコード保護）
- シフト管理（日別・月別）
- 勤怠記録（出退勤時間、承認、欠勤）
- 給与計算（時給・交通費・月給）

### 6.13 会計

- 現金出納帳（PASGuard でパスコード保護）

### 6.14 顧客

- リピーター分析（同一名・電話番号での予約履歴）

### 6.15 認証

- **チームパスワード**: `app_settings` テーブルの `team_password` で認証
- **PASGuard**: スタッフ/給与/会計タブに4桁数字パスコードによるアクセス制限

---

## 7. GAS 自動配車仕様

### 基本設定

- **Gmail**: `reserve@rent-handyman.jp`
- **実行間隔**: 15分ごと（TimeBased トリガー）
- **対象メール**: 過去2日以内、`processed` ラベルなし

### 対応 OTA

| OTAコード | OTA名 | 送信元アドレス | 予約件名パターン |
|---|---|---|---|
| J | じゃらん | `info@jalan-rentacar.jalan.net` | `じゃらんnetレンタカー 予約通知` |
| R | 楽天 | `travel@mail.travel.rakuten.co.jp` | `【楽天トラベル】予約受付のお知らせ` |
| S | skyticket | `rentacar@skyticket.com` | `【skyticket】 新規予約` |
| O | エアトリ | `info@rentacar-mail.airtrip.jp` | `【予約確定】エアトリレンタカー` |
| HP | オフィシャル | `noreply@rent-handyman.jp` | `ご予約完了のお知らせ` |

### 札幌フィルター（3段階判定）

`isSapporoReservation_()` 関数で以下の順に判定:

1. **住所判定**: `沖縄県` `那覇市` → 除外、`北海道` `札幌市` → 対象
2. **営業所判定**: `那覇` → 除外、`札幌` → 対象
3. **クラス判定**: `_OKA` `_OKI` → 除外、`_SPK` → 対象、A/B/C/S/F/H クラス → 対象

### 自動配車ルール

`autoAssignVehicle_()` 関数:

1. 同一クラスの車両を `vehicles` テーブルから取得
2. **保険車両除外**: `insurance_veh=false` の車両のみ対象
3. **重複チェック**: 貸出期間が重なる既存配車（fleet）を取得 → 使用中車両を除外
4. **メンテナンス除外**: 期間が重なるメンテナンス中車両を除外
5. 最初に見つかった空車を配車（fleet テーブルに INSERT）
6. 空車なし → 未配車状態のまま保存

### キャンセル処理

キャンセルメール件名に `予約キャンセル受付` または `キャンセル` を含む場合:

1. DB に該当予約が存在するか確認（沖縄予約は DB にないのでスキップ）
2. `fleet` テーブルから該当予約の配車レコードを削除
3. `tasks` テーブルから該当予約のタスクレコードを削除
4. `reservations` テーブルのステータスを `キャンセル` に更新（**レコードは削除しない**）

### Slack 通知

メール経由で Slack に通知（`MailApp.sendEmail` → Slack メール連携）:

| 種類 | 件名プレフィックス |
|---|---|
| 成功 | `✅ 札幌店新規予約取込完了通知` |
| 失敗 | `❌ 札幌店新規予約取込失敗通知` |
| キャンセル | `🔄 札幌店予約キャンセル処理通知` |

### メールラベル

- `processed`: 処理済みメールに付与（再処理防止）

---

## 8. 絶対ルール

1. **配車表 / OPシート / データタブ = 常に同一情報**
   - `reservations` テーブルが唯一のマスターデータ
   - いずれかのタブで変更した内容は他のタブにも即時反映される
   - Supabase Realtime による同期

2. **車両マスターは全領域に紐づく**
   - `vehicles` テーブルの変更は配車表、OPシート、タスク、売上ダッシュボード等すべてに影響

---

## 9. localStorage 使用一覧

| キー | 用途 |
|---|---|
| `spk_auth` | ログイン認証状態（"1" = 認証済み） |
| `spk_sb_url` | Supabase URL（カスタム設定用） |
| `spk_sb_key` | Supabase Key（カスタム設定用） |
| `spk_fleet` | 配車データのローカルバックアップ |
| `spk_tasks_{YYYY-MM-DD}` | 日別タスクデータのローカルバックアップ |
| `spk_staff_backup` | スタッフデータのローカルバックアップ |
| `spk_reservations_backup` | 予約データのローカルバックアップ |
| `spk_sheet_places` | OPシートの場所データ |
| `spk_res_opts` | 予約オプションデータ |
| `spk_carmon_id` | CARMON ログインID |
| `spk_carmon_pas` | CARMON ログインパスワード |
| `spk_app_version` | アプリバージョン（バージョン変更検知用） |

---

## 10. Realtime 同期

### メインチャンネル: `spk-realtime`

以下のテーブルの `postgres_changes` イベントを監視:

| テーブル | イベント | 動作 |
|---|---|---|
| `reservations` | `*`（全イベント） | 予約データを即時反映 |
| `fleet` | `*` | 配車データを即時反映 |
| `tasks` | `*` | タスクデータを即時反映 |
| `shifts` | `INSERT/UPDATE/DELETE` | シフトデータを即時反映 |
| `staff` | `*` | スタッフデータを再フェッチ |
| `vehicles` | `*` | 車両データを再フェッチ |
| `attendance` | `*` | 勤怠データを再フェッチ |

### タスク専用チャンネル: `tasks-{date}`

- OPシート表示中の日付に対して個別チャンネルを購読
- 他端末でのタスク変更を即時反映

### 駐車場チャンネル: `parking-rt`（別Supabaseプロジェクト）

- `parking_state` テーブルの UPDATE イベントを監視（filter: `id=eq.1`）

### RT イベント抑制

- `markLocalChange(cat)`: ローカル変更時にタイムスタンプを記録
- `markDbSync(cat)`: DB 同期完了時にタイムスタンプを記録
- **ローカル変更後2秒以内の RT イベントは無視**（自分の変更によるエコーを防止）
  - `vehicles` テーブルで明示的に実装: `if(ss&&ss.localTime&&Date.now()-ss.localTime<2000){markDbSync("vehicles");return;}`

---

## 11. 既知の注意点

### 全角コロン「：」除去フィルタ

- 起動時および同期時に、ID や名前に全角コロン（`：`）を含むデータを除外
- 条件: `r.id.includes('：')` または `r.name.startsWith('：')`
- 理由: GAS からのデータ取込時に OTA メールの形式により不正データが混入することがある

### 時間フィールドの正規化

- 入力値の全角コロン（`：`）を半角コロン（`:`）に自動変換
- 1桁の時間に先頭ゼロを付加（例: `9:00` → `09:00`）

### キャッシュクリアボタン

- TOP の設定セクションに配置
- Service Worker のキャッシュと localStorage をクリア

### Service Worker（sw.js）

- キャッシュ名: `spk-v4256`（バージョン管理）
- キャッシュ対象: `/`, `/index.html`, `/index2.html`
- 戦略: **Cache First, Update in Background**（キャッシュ優先、バックグラウンドで更新）
- 同一オリジンの HTML ファイルのみキャッシュ（CDN リソースはキャッシュしない）
- `install` 時: `skipWaiting()` で即座にアクティベート
- `activate` 時: 旧キャッシュを削除、`clients.claim()` で制御を取得

### index2.html

- `index.html` の完全コピー
- キャッシュバスター用: Service Worker がキャッシュした index.html が古い場合に `/index2.html` にアクセスすることで最新版を取得可能

### 保険車両の二重管理

- `vehicles` テーブルの `insurance_veh` カラム（DB）
- localStorage でもバックアップ管理
- GAS 自動配車時は DB の `insurance_veh=false` でフィルタ

### バージョン管理

- `APP_VERSION` 定数（現在: `v4.2.59`）
- 画面右下にバージョン番号を常時表示
- `spk_app_version` localStorage でバージョン変更を検知 → 自動リロード

### タスクの BCJ オプション保存

- タスクの `memo` フィールドに `\n##BCJ:{b},{c},{j}` 形式で埋め込み
- `changed_json` カラムにも `_optB`, `_optC`, `_optJ` として保存
- フォールバック: `opt_b`, `opt_c`, `opt_j` カラム（レガシー）
- 3段階の復元優先度: `changed_json` > `memo` 内 BCJ タグ > `opt_*` カラム

### DB 保存のフォールバック

- `_upsertWithFallback()`: `changed_json` 含むフル保存を試行 → 失敗時は `changed_json` を除外した bare 保存にフォールバック

---

## 12. デプロイ手順

```bash
# 1. index.html を編集
vim index.html

# 2. index2.html にコピー（キャッシュバスター用）
cp index.html index2.html

# 3. Git にコミット & プッシュ
git add index.html index2.html
git commit -m "更新内容の説明"
git push origin main

# 4. Vercel が自動デプロイ（main ブランチ連動）
# → https://spk-task.vercel.app に反映
```

**注意事項**:
- `index2.html` は必ず `index.html` と同一内容にすること
- sw.js のキャッシュバージョン（`CACHE_NAME`）を更新する場合は sw.js も編集・コミットすること
- GAS スクリプトは別途 Google Apps Script エディタから編集・デプロイ

---

## 13. 那覇店移設ガイド

別店舗（例: 那覇店）に同システムを展開する場合の手順。

### 13.1 変更が必要な設定値

#### index.html 内

```javascript
// Supabase 設定（新プロジェクトの値に変更）
const SUPABASE_URL = "https://xxxxx.supabase.co";
const SUPABASE_KEY = "新しいAnon Key";

// 駐車場用 Supabase（必要に応じて）
const PARKING_SB_URL = "https://xxxxx.supabase.co";
const PARKING_SB_KEY = "新しいAnon Key";
```

#### 車両クラス構成

`INIT_CLASSES` と `INIT_VEHICLES` を那覇店の車両構成に変更:

```javascript
const INIT_CLASSES = [
  // 那覇店の車両クラスに合わせて定義
  {type:"クラスID", label:"車種名", seats:定員},
  ...
];
```

#### GAS スクリプト

```javascript
var SUPABASE_URL = '新しいURL';
var SUPABASE_KEY = '新しいKey';
var SLACK_EMAIL = '新しいSlackメールアドレス';
```

- `isSapporoReservation_()` を `isNahaReservation_()` に変更
- 札幌フィルターのロジックを那覇用に反転

#### その他

- `<title>` タグを「那覇店 タスク管理」に変更
- PWA マニフェストの `name` / `short_name` を変更
- スプラッシュ画面の「S」を「N」等に変更

### 13.2 必要な Supabase 準備

#### 新規プロジェクト作成

1. Supabase で新プロジェクトを作成
2. プロジェクト URL と Anon Key を取得

#### テーブル作成

以下のテーブルを作成（スキーマはセクション4参照）:

- `reservations`
- `fleet`
- `vehicles`
- `tasks`
- `maintenance`
- `staff`
- `shifts`
- `attendance`
- `places`
- `app_settings`

#### Storage 設定

1. `licenses` バケットを作成（Private）
2. RLS ポリシー設定:
   - `INSERT`: anon ロールに許可
   - `SELECT`: anon ロールに許可

#### RLS（Row Level Security）設定

- 各テーブルに適切な RLS ポリシーを設定
- anon ロールに対して `SELECT`, `INSERT`, `UPDATE`, `DELETE` を許可

#### Realtime 有効化

以下のテーブルで Realtime を有効化:
- `reservations`
- `fleet`
- `tasks`
- `shifts`
- `staff`
- `vehicles`
- `attendance`

#### 初期データ

- `app_settings` に `team_password` を設定
- `vehicles` に那覇店の車両データを登録

### 13.3 GAS セットアップ

1. Google Apps Script で新プロジェクトを作成
2. `gas-email-import-v2.gs` の内容をコピー
3. 設定値を那覇店用に変更
4. `setup()` 関数を実行してトリガーとラベルを作成
5. Gmail API の権限を承認

---

*最終更新: 2026-03-24*
*アプリバージョン: v4.2.59*
