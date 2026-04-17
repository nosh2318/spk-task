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
- **APP_VERSION**: v4.6.14
- **sw.js CACHE_NAME**: `spk-v477`
- **index.html CV**: `spk-v477`
- **SRI/CSP**: 未適用（下記インシデント参照）

## 未使用テーブル
- **vehicle_twins**: テーブルは存在するがデータ空。APP・GASのどちらでも未使用。配車は`fleet`テーブルで管理。手を入れる必要なし。

## 2026-04-17 修正履歴

### Dashboard 稼働率に「配車表の除外フラグ」を反映（v4.6.14）
- **問題**: 配車表（FleetTimeline）で `vehicle_monthly_kpi.active=false` にした車両が、Dashboard の稼働率計算では依然「稼働台数」にカウントされ、稼働に戻ってしまっていた
- **原因**: Dashboard の `curUtil` / `prevUtil` / `annualData` が `vehicles.length` を直接「稼働台数」にしており、`vehicle_monthly_kpi` の除外フラグを見ていなかった（LeadTimeWidget だけが kpi を参照していた）
- **オーナー原則**: 「4月以降は APPのデータが正義」→ APP 内でも kpi フラグが全画面に一貫して効いている状態でなければならない
- **修正内容（`index.src.html`）**:
  1. Dashboard で `vehicle_monthly_kpi` 全件を初回にロード → `dashKpiAll = {ym: {code: active}}` にキャッシュ
  2. `isKpiActiveYM(code, ym)` ヘルパーを追加（kpi にその月の行があればそれを採用、なければ `vehicles.active !== false` で判定 — APP 既存ロジックと完全一致）
  3. `curUtil` / `prevUtil` / `annualData` を以下に修正:
     - 稼働台数 = `vehicles.filter(v => isKpiActiveYM(v.code, ym)).length`
     - 最大稼働日数 = 稼働台数 × 月日数
     - 予約ループで `!activeCodesYM.has(vc)` の予約はスキップ（除外車両の予約は計算から外す）
     - メンテナンスループも同様に除外車両をスキップ
     - キャンセル予約は `r.status==="cancelled"` もスキップ（元々スキップされていたが明示化）
  4. 年間ビュー月別行の `totalP` 表示も `m.totalPossible||(m.activeCount||vehicles.length)*m.dim` に差替え
- **バージョン**: `APP_VERSION=v4.6.14` / `sw.js CACHE_NAME=spk-v477` / `index.html CV=spk-v477` 同時更新
- **検証**: `node build.js` 成功、`node --check app.js` OK、本番 https://spk-task.vercel.app に反映済
- **コミット**: `36bfb6f` (fix(dashboard): 稼働率に配車表の除外フラグ(vehicle_monthly_kpi)を適用)

### PDF (HANDYMAN_MTG統合) を Supabase 再集計に変更
- **問題**: 2026-04以降の稼働率が Excel由来 と APP表示値で乖離（Excel行158 は 4月以降も Excel基準）
- **原則**: 4月以降は APP のデータ資産が正 → Excel ではなく Supabase (= APP が書き込む DB) を参照して再集計
- **実装**:
  - 新規 `~/Desktop/HANDYMAN/analytics/supabase_util_2026_04.py` — APP と完全一致する稼働率算定ロジック
    - 稼働台数 = `vehicles.filter(isKpiActive)` （`vehicle_monthly_kpi` 優先、なければ vehicles.active）
    - 稼働日数 = 予約×fleet で車両別稼働日 Set（重複カウント防止）
    - 稼働率(%) = round(Σ稼働日数 / (稼働台数 × 月日数) × 100)
    - SPK: `reservations`/`fleet`/`vehicles`/`vehicle_monthly_kpi` + `lend_date`/`return_date`
    - NHA: `nha_reservations`/`nha_fleet`/`nha_vehicles`/`nha_vehicle_monthly_kpi` + `start_date`/`end_date`
  - `structure_metrics_portrait.py` に APP_OVERRIDES を追加 — 2026-04以降は Supabase 再集計値を採用
    - NHA 2026-04: 50台 / 906日 / 60%
    - SPK 2026-04: 10台 / 96日 / 32%
  - PDF 脚注修正: 「2025〜2026-03 稼働率: 事業解析Excel 行158 | ★2026-04 以降 稼働率・台数: Supabase (= APP データ資産) 再集計」
- **出力**: `~/Desktop/HANDYMAN/analytics/charts/HANDYMAN_MTG統合_20260417.pdf` 更新済

### Slack通知を Bot API 直接投稿に変更（札幌GAS）
- **問題**: 札幌店の予約（QAA71034 太田美佐子、HP札幌、Cクラス、4/25、クインテッサホテル札幌）が正しく札幌DBに登録されたが、Slack通知だけ那覇チャネルに届く事象が再発
- **原因**: email-to-Slack エイリアス（`x-aaaatppttzyrldnhjt5el4jj3i@gl-oke5175.slack.com`）経由だとルーティングが不透明で、宛先が那覇側に向くケースがあった
- **修正（`gas-email-import-v2.gs`）**:
  1. 定数追加: `var SPK_RESV_CHANNEL = 'C08TDTPEB36';`（#sapporo_reservation）
  2. ヘルパー新設: `sendSlackToSpk_(subject, body)` — `postToSlackChannel_` (`chat.postMessage`) で Bot API 直接投稿、失敗時のみ `MailApp.sendEmail` フォールバック
  3. 3関数を差替え: `sendSlackSuccess_` / `sendSlackFailure_` / `sendSlackCancel_`
- **認証**: `SLACK_BOT_TOKEN` スクリプトプロパティ設定済み（既存じゃらん決済`JALAN_PAY_CHANNEL`流用）
- **動作確認**: `testSlackSpk()` 手動実行で #sapporo_reservation に投稿成功
- コミット: `c37d9bb`
- **注意**: Bot が対象チャネルに参加している必要あり。`not_in_channel` エラー時は Slack で `/invite @<Bot名>` を実行

### BQG34364 那覇予約の札幌誤取込 対応（復習）
- **問題**: HP那覇予約（棚澤光洋、Aクラス、8/15-18）が札幌店GASに取り込まれた
- **修正（`gas-email-import-v2.gs`）**:
  1. `isSapporoReservation_` step 6: 全A/B/C/S許可 → **F/H のみ許可**（A/B/C/Sは両店舗に存在）
  2. `parseOfficial_` に HP本文からの店舗抽出追加（【店舗】/「那覇店」「札幌店」キーワード/住所フォールバック）
- DB手動削除: `reservations` + `fleet` から削除済み

## 2026-04-15 修正履歴

### GAS場所抽出の根本修正（全OTAパーサー）
- **問題**: KUI82098（原田奈津子、エアトリ、5/3-5/5）のDEL場所が「ジャスマックプラザホテル札幌」（誤）→正しくは「ベッセルイン札幌中島公園」、COL場所が空→正しくは「札幌駅」
- **根本原因（3層）**:
  1. **GASパーサー**: `parseAirtrip_`含む全4 OTAパーサー（J/R/S/O）が `del_place:'', col_place:''` をハードコード。HP以外で場所を一切抽出していなかった
  2. **重複パッチ**: OTA自動登録GAS(30分)が先に予約作成→メール取込GASの重複パッチに `del_place`/`col_place`/`visit_type`/`return_type` が含まれていない→補完されない
  3. **CSV手入力**: 場所が空のまま→スプシで手入力→別予約のホテル名を誤入力→APP場所CSV取込で上書き
- **修正内容（gas-email-import-v2.gs）**:
  1. `extractDeliveryPlace_(body)` / `extractCollectionPlace_(body)` 共通関数追加（HP形式【お届け場所名】等 + OTA共通パターン）
  2. 全4 OTAパーサー（J/R/S/O）に場所抽出を追加（HP形式フォールバック + OTA営業所名）
  3. 重複パッチに `del_place`/`col_place`/`visit_type`/`return_type` を追加
  4. `patchTaskPlaces_(reservationId, delPlace, colPlace)` 関数追加（場所パッチ時にtasks+placesテーブルも自動同期）
  5. `reservationExists_` のselect句に場所関連フィールドを追加
  - **GASエディタにも貼り付け済み**
- **DB手動修正**: KUI82098の3テーブル（reservations/places/tasks）を正しい値に修正済み
  - reservations: del_place=ベッセルイン札幌中島公園, col_place=札幌駅, visit_type=DEL, return_type=COL
  - places: 同上
  - tasks(DEL): place=ベッセルイン札幌中島公園, col_place=札幌駅
  - tasks(COL): place=札幌駅
- **教訓**: 
  - 全OTAパーサーで場所抽出を実装すること（HP形式フォールバックで取れるケースがある）
  - 重複パッチは全フィールド網羅すること（新フィールド追加時はパッチ対象にも追加）
  - CSV手入力は元メールと照合してから入力すること

## 2026-04-14 修正履歴

### 補償種類（insurance）検出の根本修正（札幌・那覇両方）
- **問題**: エアトリ予約 C260300013 の補償が「免責」なのに「NOC」と誤登録されていた
- **根本原因**:
  1. 全OTAパーサーが免責/なしの2値しか検出せず、フル・NOCを正しく判定できなかった
  2. OTA自動登録GAS(30分)が先に予約作成(insurance空)→メール取込GAS(15分)が重複パッチする際にinsuranceフィールドが含まれていなかった
- **修正内容（札幌 gas-email-import-v2.gs）**:
  1. `detectInsurance_(text)` 統一関数を追加（優先順: フル > NOC > 免責 > なし、否定パターン除外付き）
  2. 全5パーサー（じゃらん/楽天/skyticket/エアトリ/HP）を `detectInsurance_()` に統一
  3. 重複予約パッチに insurance フィールドを追加（既存値が空or'なし'の場合のみ上書き）
  - コミット: `e9bec1f`, `07fa7fe`
  - **GASエディタにも貼り付け済み**
- **修正内容（那覇 gas/Code.gs）**:
  1. 同じ `detectInsurance_()` 関数を追加
  2. 全7パーサー（じゃらん/楽天/skyticket/エアトリ/HP/GoGoOut/レンタカードットコム）を統一
  - **GASエディタにも貼り付け済み**
- **DB修正**: 誤った補償値の予約4件を修正済み
  - C260300013: NOC→免責（tasks.insuranceも修正）
  - DY00000000924: NOC→免責
  - RC42461096461430490: NOC→免責
  - DY00000000928: NOC→免責
- **教訓**: 新OTA追加時は `detectInsurance_()` を必ず使用すること

### 車両損傷チェックAPP: 本日のみ予約表示修正
- **問題**: 貸出チェック画面に未来の予約（5/17, 9/17等）が表示されていた
- **修正**: `loadVehicles` クエリを `lte('lend_date',today).gte('return_date',today)` に変更（本日貸出中の車両のみ表示）
- **追加**: 「🚗 本日貸出」「📹 本日返却」ラベルをカードに表示
- **sw.js**: v6→v7（キャッシュクリア）
- コミット: `3f96a34`, `e1cdd2d`, `8aa1dfb`

## 2026-04-12 修正履歴

### 場所CSV再取込時のタスク同期バグ修正
- **問題**: スプレッドシートで場所を変更→場所CSV再取込しても、OPシートのタスクに反映されない
- **原因**: `updatePlaces`がplacesテーブルのみ更新し、tasksテーブルのplaceは「既に値があればスキップ」していた
- **修正**: 場所CSV取込時にtasksテーブルのDEL/COLのplaceも自動上書きするよう修正
- **DB手動修正**: 8件の不一致タスクをスプレッドシートの値に修正済み（C260300013, R0C04G1Z, R0YNZ8NG, RC42461096461430490, R04OWZ6U, RC52461055442120662, R02XF89Q）
- **場所データの3テーブル構成**:
  - `reservations`: del_place/col_place（GAS取込時に書き込み）
  - `places`: del_place/col_place（APP場所CSV取込用）
  - `tasks`: place（OPシート表示用、タスク生成時にコピー）
- **教訓**: placesテーブル更新時はtasksテーブルも必ず同期すること

## 2026-04-09 修正履歴

### アルバイト月給対応（v4.6.10）
- StaffManagerに月給モード追加（時給/日給/月給の3択）
- `wageMode` 独立state管理（derived stateバグ修正済み）
- 給与計算: アルバイト＋月給設定時は `monthlySalary` を使用

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

## 関連プロジェクト

### 車両損傷チェックAPP
- **URL**: https://nosh2318.github.io/handyman-damage/
- **リポジトリ**: `~/handyman-damage/` (nosh2318/handyman-damage)
- **デプロイ**: GitHub Pages（mainプッシュ）
- **DB**: 同一Supabase — `vehicle_twins` + `check_events` テーブル
- **車両データ**: 札幌=`vehicles`テーブル（本APPと共有）→ `vehicle_twins`とJOINしてダメージ状態を統合
- **バージョン**: v2.5.0
- **構成**: Single HTML（3573行）+ sw.js + manifest.json + schema.sql

## 絶対ルール（CLAUDE.mdより）
- **PU = 空港出発（緑）/ BD = ヤード出発（赤）** — 逆にしない
- メンテナンス・別予約があるラインに配車しない
- OTA A/A2 → HANDYMAN H（アルファード）に変換
- 変数削除・リネーム前にGrep全体検索
- 推測修正は最大1回、直らなければ実環境確認
- 予約処理は古い順から1件ずつ（並列禁止）
