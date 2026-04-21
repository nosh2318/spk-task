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
- **APP_VERSION**: v4.6.42
- **sw.js CACHE_NAME**: `spk-v505`
- **index.html CV**: `spk-v505`
- **SRI/CSP**: 未適用（下記インシデント参照）

## 2026-04-21 修正履歴（続き4）

### R0XHDPI1 じゃらん事前決済が自動発行されなかった問題（GAS根本修正）
- **症状**: R0XHDPI1（タカス トモコ、2026-05-04、¥12,850、メール m525tomo@gmail.com）のじゃらん予約メールから2時間経過しても Square請求書・メールが発行されなかった
- **診断**:
  - `reservations` テーブルには予約が存在（OTA=J, price=12850, 通常通り）
  - `jalan_payments` テーブルには行が存在しない → 決済処理が一切走っていない
- **根本原因**: `processMessage_`（`gas-email-import-v2.gs`）の既存予約分岐が `handleJalanPayment_` を呼んでいなかった
  - **OTA自動登録GAS（30分間隔）が先に予約作成**（price のみ、他フィールド不完全）
  - **札幌メール取込GAS（15分間隔）が後から同じメールを処理**
  - `reservationExists_()` が true → 「既存予約」分岐に入り、料金内訳や場所などをパッチして `return {type:'skip'}`
  - この分岐内では `handleJalanPayment_` が呼ばれない ← バグ
  - 新規INSERT分岐（line 280以降）でしか `handleJalanPayment_` が呼ばれないため、じゃらん決済が起票されない
- **即時復旧（R0XHDPI1）**:
  1. Square Payment Links API 直接呼び出しでリンク作成: `https://square.link/u/ZBEAoEek`
  2. `jalan_payments` に `status=link_created` で INSERT
  3. `#jalan_payment` Slack通知（slack_ts=1776755285.056639、DBに保存済み）
  4. `checkSquareLinks`（5分間隔）トリガーで自動メール送信されることを確認
- **恒久修正（`gas-email-import-v2.gs`）**:
  1. 既存予約分岐（line 278〜）に `handleJalanPayment_` 呼び出しを追加
  2. 競合分岐（line 293〜）にも同じ呼び出しを追加
  3. `handleJalanPayment_` 内部の重複チェック（`jalan_payments` 存在確認）で冪等性担保
  - **GASエディタ貼り付け必須**: ローカル `gas-email-import-v2.gs` 修正済み、GASエディタにクリップボード経由で貼付
- **教訓**:
  - OTA自動登録GASと札幌メール取込GASが競合するパターンは `price` / `base_price` / `discount` / `insurance` / 場所 に続き 4件目
  - 以降の新機能追加時は「既存予約でも走らせる必要があるか」を必ず検討する
  - じゃらん事前決済は OTA=J の全予約で必須機能

## 2026-04-21 修正履歴（続き3）

### D. 構成分析タブに年別/月別フィルタ追加（v4.6.42）
- **要望**: 「Dは　年別　月別　で確認できるように」
- **背景**: 経営管理>解析タブのD. 構成分析（OTA別売上構成比/DEL・COL場所Top20/利用者エリア/時間帯分布）が「全期間」固定で、年別・月別比較ができなかった
- **実装**:
  1. `dFilter` state 追加（`{mode:"all"|"year"|"month", year, ym}`）
  2. 解析IIFE内で `ymList` から `dYearList`（年候補）`dYmList`（年月候補）を生成
  3. `relForD`: reliable を dFilter で絞込（`rdKey`=札幌 return_date / 那覇 end_date）
  4. `tasksForD`: dbTasks を date で絞込（時間帯分布用）
  5. D セクション先頭にフィルタUI追加（全期間/年別/月別の3ボタン+年/年月セレクタ+対象件数表示）
  6. 各サブセクションの見出しに選択期間を表示（「OTA別売上構成比（2026-04）」等）
  7. D セクションヘッダーにも選択期間を表示（「D. 構成分析 (2026年)」等）
- **影響範囲**: D内の4サブセクション全て（OTA別/DEL/COL/エリア/時間帯分布）が連動
- **バージョン**: `APP_VERSION=v4.6.42` / `sw.js CACHE_NAME=spk-v505` / `index.html CV=spk-v505` 同時更新

## 2026-04-21 修正履歴（続き）

### 決済ステータスバッジ拡張（v4.6.38）
- **要望**: 「じゃらん決済機能と連動した箇所を設けて。入金済/未入金どちらかの表示をさせる。このステータスはタスクサマリーやスケジュールにも表示させる」
- **実装**:
  1. App level に `jpNewPaidSet` state 追加 — `jalan_payments.status='paid'` を Set 化、60秒間隔で自動更新
  2. `isJPaidFn(resvId)` 統一ヘルパー追加 — 新システム優先 + 旧 `jalanPay[id].payStatus==='完了'` フォールバック
  3. OPScreen / DataTable 両方にpropを流す
- **バッジ追加箇所（新規）**:
  - OP画面 DEL/COL カード（メタデータ行）
  - OP画面 スケジュールタブ（メタデータ行）
  - TOP タスクサマリー（個人別タスク行）
  - TOP 本日スケジュール（メタデータ行）
- **既存バッジ更新**: OPマスター表（列19）/ データタブ（列18）も `isJPaidFn` に統一
- **表示**: `💳決済`（緑）/ `💳未決済`（赤）
- **バージョン**: `APP_VERSION=v4.6.38` / `sw.js CACHE_NAME=spk-v501` / `index.html CV=spk-v501` 同時更新

## 未使用テーブル
- **vehicle_twins**: テーブルは存在するがデータ空。APP・GASのどちらでも未使用。配車は`fleet`テーブルで管理。手を入れる必要なし。

## 2026-04-21 修正履歴

### じゃらん決済確認（旧）: 新システム入金済み予約を自動消し込み（v4.6.34）
- **要望**: 「じゃらん入金確認時に同じ予約データがあればここのステータスも変えてほしい」「予約番号は同じなのでできると思う」
- **背景**: じゃらん決済は新旧2系統のテーブルで管理されており、GAS自動管理の新システム（`jalan_payments.status='paid'`）で入金済みになっても、手動運用の旧タブ（`jalan_payment.pay_status='完了'`）は別データとして残る
- **修正 (`index.src.html` JalanPaymentLegacy)**:
  1. `autoSyncFromNewSystem(ids)` 新規関数: `jalan_payments` から `status='paid'` を取得 → 現在表示中のじゃらん予約IDと照合 → 旧`jalanPay[rid].payStatus='完了'`に自動更新
  2. 既に`完了`の予約はスキップ（冪等性担保）
  3. 30秒ポーリング時/画面可視化時/jData更新時/「スプレッドシート取得」ボタン押下時 の4タイミングで自動実行
  4. `adjustedPrice`が空なら新システムの`amount`で補完、`category`が空なら「売上」で補完
- **バージョン**: `APP_VERSION=v4.6.34` / `sw.js CACHE_NAME=spk-v497` / `index.html CV=spk-v497` 同時更新
- **コミット**: `1f1c81a` (feat(じゃらん旧): 新システム入金済み予約を旧データに自動消し込み)

### 売上乖離再発の根本修正（v4.6.33）
- **問題**: 経営DBダッシュボードとTOPウィジェットの売上が再び乖離（96万 vs 92万）。v4.6.30の `_fromDbRes` 修正では解決しなかった
- **根本原因**: APPの `data` state に保持された `basePrice/optionPrice/discount` が古い状態になる。OTA自動登録GAS(30分)が先に予約作成（`price`のみ）→ メール取込GAS(15分)が後から `bp/op/dc` をパッチするが、Realtimeイベントを取りこぼすと stale のまま → `basePrice=0` にフォールバックして旧`price`ベースで集計される
- **具体的に検出した stale record**:
  - POPOPOPO 損保ジャパン: price=0, bp=200,000（200k乖離）
  - RC12461121645759659 ニッコウ: price=0, bp+op-dc=20,540
  - RC62461119691059583 シモムラ: discount=9,750無視（-9,750乖離）
- **修正 (`index.src.html` LeadTimeWidget)**:
  1. `dbRevRows` state 追加: 選択月の予約を `reservations` から直接fetch（`id,status,return_date,price,base_price,option_price,discount`）
  2. 60秒間隔で自動リフレッシュ（常に最新DB値を参照）
  3. `utilStats.totalRevenue`: `data` state ではなく `dbRevRows` ベースで集計
  4. クラス別売上も `dbRevMap[r.id]` を優先、フォールバックのみ旧`revOf(r)`使用
- **バージョン**: `APP_VERSION=v4.6.33` / `sw.js CACHE_NAME=spk-v496` / `index.html CV=spk-v496` 同時更新
- **コミット**: `b89c653` (fix(TOP売上): 直接DBから base_price/option_price/discount を取得)
- **教訓**: GAS auto-patch されるフィールド（bp/op/dc）は Realtime 取りこぼしリスクがあるため、厳密に正しい値を出す必要があるコンポーネントは「必要時にDB直接fetch」が確実

## 2026-04-20 修正履歴

### Slack予約登録の改善（車種名自動判定・タイポ許容・1分ポーリング）
- **問題**: `#sapporo_reservation` へ予約投稿しても Bot が反応しないケース頻発
  - 例: クラス欄に「CX5」(車種名) → パーサーが無効クラスとして弾く
  - 例: 「屋先」(典型的タイポ) → ラベル認識失敗で届先が取れない
- **原因の構造**: `parseSlackReservation_` が validClasses=[A,B,C,S,F,H] 固定判定・ラベル厳密一致
- **修正 (`gas-email-import-v2.gs`, commit `df7e211`)**:
  1. **SPK_MODEL_TO_CLASS テーブル**追加: アルファード/ヴェルファイア→A、ノア/デリカ→B、ロッキー/CX-3→C、ハリアー/CX-5→S、ルーミー/ソリオ→F、カローラ/アクセラ→H
  2. **modelToClass_()** 正規化比較 (大文字化+ハイフン/空白除去): `CX5` ≡ `CX-5`
  3. **クラス欄自動判定**: クラス欄に車種名が入力された場合、自動的にクラス変換+車種指定として扱う
  4. **getVal()** 複数ラベル受付: 「届先/屋先/配達先/お届け先/受取場所/デリバリー」全部OK
  5. **エラーメッセージ具体化**: 「クラス「CX5」は無効です」→「A/B/C/S/F/H から選ぶか、車種名（アルファード/CX-5/ノア等）を指定してください」
  6. **isModelMatch_()**: 配車時の車両名マッチもハイフン表記ゆれに寛容に
  7. **doPost + processSingleSlackMessage_** 追加: Slack Events APIからの即時処理対応（※結果的に未採用）
  8. **setupSlackImport**: 5分→**1分間隔トリガー**に変更
- **Slack Events API不採用の経緯**: GAS Web App に POST すると HTTP 302 リダイレクト → リダイレクト先が GET のみ許可で 405。Slack側で Verify 失敗の可能性あり → 「1分ポーリングで十分」と判断。Events API 用コードは残置（将来必要なら再利用可）
- **動作確認**: 2026-04-20 20:17 `#sapporo_reservation` にテスト投稿 → 1分以内にスレッド返信「✅ 予約登録 + 配車完了」確認 (`SP-20260420-0002`→ロッキー(299)配車、DB削除済)
- **診断・手動実行**:
  - `diagnoseSlackReservation()`: トークン/スコープ/チャンネル参加状態/トリガー有無を一括診断
  - `runSlackReservationsNow()`: 手動実行（トリガー待たずに即処理）
  - 失敗tsは `processed[ts]='error'` で記録 → 再処理されない。手動で ScriptProperties `spk_processed_slack_ts` をクリアする必要あり
- **コミット**: `df7e211` (feat(gas-slack): Slack予約登録の即時処理対応と車種名自動判定)

### 経営DBダッシュボード 数字乖離修正（v4.6.29→v4.6.30）
- **問題**: 経営DB ダッシュボード (売上¥92万 / 稼働85日) が TOP ウィジェット (売上¥69.7万 / 稼働113日) と乖離。件数38件だけ一致
- **原因の構造**:
  1. **売上乖離**: `_fromDbRes` が `base_price`/`option_price`/`discount` を React state にマッピングしていなかった → TOPウィジェットは `r.price` しか見えない。OTA自動登録GAS(30分)が先に予約作成 (`price`のみ) → メール取込GAS(15分)が後から `bp/op/dc` をパッチするので、`price` が古い値のまま乖離
  2. **稼働日数乖離**: 85日は「延べ泊数(Σ return-lend)」、113日は「ユニーク車両×稼働日」。**メトリクスが違う**のに同じ「総稼働」ラベルで比較されていた
- **修正 (`index.src.html`)**:
  1. `_fromDbRes` に `basePrice/optionPrice/discount` マッピング追加
  2. `utilStats.totalRevenue`: `(bp>0||op>0)?(bp+op-dc):price` 計算式に統一
  3. `dashSummary` に `utilDays/utilActiveCount/utilMaxDays/utilPct` 追加 (TOPと同一ロジック: `dbFleet/dbVehs/dbKpi` 使用)
  4. 経営DBダッシュボードカード行: 「総稼働」→「延べ泊数」にラベル変更 + 稼働率(%)カード追加
- **バージョン**: `APP_VERSION=v4.6.30` / `sw.js CACHE_NAME=spk-v493` / `index.html CV=spk-v493` 同時更新
- **コミット**: `30909ce` (fix(経営DB): 売上・稼働率をTOPウィジェットと同一ロジックに統一)

### じゃらん決済: AIスタッフ_G依存を排除（GAS）
- **問題**: R02AD7IX（ヤマモト ミヨコ、¥42,600）のSquareリンクがAIスタッフ_G未応答で作成されず、決済メールが送信されなかった（2回目の障害。前回はR0R8QVZR 4/4）
- **根本原因**: `handleJalanPayment_` がSlackに投稿 → AIスタッフ_Gがスレッド返信でSquareリンク作成 → `checkSquareLinks`がリンク検出、という間接的なフロー。AIスタッフ_Gが止まると全体が止まる
- **修正**:
  1. `createSquarePaymentLink_(itemName, amount)` 新規関数 — Square Payment Links API直接呼び出し
  2. `handleJalanPayment_` — Square API直接でリンク作成 → DB(link_created) → Slackにリンク付き投稿 → スプシ記録まで1関数で完結
  3. `checkSquareLinks` — AIスタッフ_Gポーリング廃止。status=newのリトライ + link_created→メール送信のみ
  4. Square API失敗時はstatus='new'で保存 + Slack障害通知 → checkSquareLinks(5分)でリトライ
- **新フロー**: GAS → Square API直接 → DB → Slack(リンク付き) → スプシ → [5分後] メール送信 → Slack(📧完了)
- **定数**: `SQUARE_LOCATION_ID = 'L8N7J9RKPN3WH'`
- **R02AD7IX即時復旧**: 手動でSquareリンク作成(`https://square.link/u/vB8i8hPN`) → DB更新 → トリガーでメール送信完了確認済み
- コミット: `df7e211`（gas-email-import-v2.gs、Slack予約登録改善とまとめて）

### 料金内訳パッチ条件修正（GAS・那覇障害再発防止）
- **問題**: 那覇店で `toDbRow_` に `base_price`/`option_price`/`discount` が無く全予約が内訳0でDB保存される障害が発生（2026-04-20）
- **札幌の現状**: パーサー・insertReservation_は正常だが、既存予約パッチの条件 `!existingRow.base_price` がnullと0を区別しない
- **修正**: `+(existingRow.base_price||0) === 0 && +(reservation.base_price||0) > 0` に変更（明示的に0判定）
- **HP予約DB修正**: NFJ19443(¥26,300), QAA71034(¥5,150) → `base_price = price` に更新（仕様書 2-5準拠）
- **残存**: OTA予約7件のbase_price=0は放置（今後の新規予約は修正済みコードで正しく入る）
- **仕様書**: `/private/tmp/price_breakdown_spec.md` — 全OTAの料金内訳パース仕様（7社）+ 高松店展開チェックリスト

## 2026-04-17 修正履歴

### 入金確認v3: Payment Links APIベースに全面書き直し（GAS）
- **問題**: `checkPaymentStatus` v2 が 0/8 ヒット → IEI40399（¥13,800 入金済み）を検知できなかった
- **根本原因**: Square Payment Linkで作成されたorderの `line_items[].name` は `"undefined"`（顧客名ではない）。v2の `matchSquareOrder_` は `nameMatch && amountMatch` の両方を要求 → nameMatchが絶対にtrue にならない
- **v3の方式**: 名前マッチング完全廃止。スプシURL → Payment Links API → order_id直接解決 → BatchRetrieveOrders → tenders有無で入金判定
- **新関数**: `fetchPaymentLinkMap_(token)` / `batchRetrieveOrders_(token, orderIds)` / `isOrderPaid_(order)` / `normalizeSquareUrl_(url)` / `debugPaymentV3()`
- **再発防止（自己診断4箇所）**: APIトークン未設定 / Payment Links 0件 / 全URLマッチ失敗 / Orders取得0件 → いずれも即座にSlack #jalan_payment に障害通知
- コミット: `4dfcca2`(v3本体), `70f62e3`(再発防止)

### Slack通知をBot API直接投稿に変更（GAS）
- **問題**: 札幌予約の通知が那覇チャネルに届く
- **原因**: email-to-Slackエイリアス経由のルーティングが不透明
- **修正**: `sendSlackToSpk_()` で `chat.postMessage` Bot API直接投稿（`SPK_RESV_CHANNEL = 'C08TDTPEB36'`）
- コミット: `c37d9bb`

### 車両損傷チェックAPP: loadVehiclesスコープエラー修正（v2.6.0→v2.6.1）
- **問題**: 札幌・那覇の両店舗で車両チェックAPPが「読み込みエラー」で使用不能
- **原因**: cleanup コードが `if/else` ブロック外で `const twMap` / `const vcResvMap` を参照（ブロックスコープ外 → ReferenceError）。前回セッションで追加した `b50d89d` コミットのバグ
- **修正**: cleanup処理を札幌elseブロック内に移動
- **再発防止3策**:
  1. **グローバルエラーハンドラ**: `window.onerror` でJSエラー時に赤バナー表示+再読み込みボタン（白画面防止）
  2. **try-catch隔離**: cleanup等の副次処理が失敗しても車両一覧表示を止めない
  3. **pre-pushフック**: `git push` 前に `node --check` でJS構文チェック（handyman-damage + spk-task 両リポジトリ）
- sw.js: v9→v10、バージョン: v2.6.1
- コミット: `2d06b05`(修正), `42b708b`(再発防止)

### 車両損傷チェックAPP: 返却済み車両のステータスクリア（v2.5.0→v2.6.0）
- **問題**: 返却済み車両9047がまだ「貸出中」+旧顧客名表示
- **修正**: `loadVehicles` に `effectiveStatus` ロジック追加。`vehicle_twins.status='out'` でも予約がなければ自動的に `'ready'` にリセット。DBも非同期クリーンアップ
- コミット: `b50d89d`

### 経営管理タブ: Excel 22シート完全移植 + パトロール機能（v4.6.15〜v4.6.18）

**背景**: `KPI_PL_CL_2026本番_予算CF.xlsx`（22シート）の全機能をAPPに移植し、Excelを不要にする。ただし移行期はSSを手動更新し続けてパトロールで追跡する。

**実装済み14サブタブ**:
| サブタブ | 内容 | Excelシート対応 |
|----------|------|----------------|
| 📊 経営DB | 10セクション統合ダッシュボード | ダッシュボード_那覇/札幌 |
| 📈 予実比較 | 入金予算vs実績 | 予実比較 |
| ⚙️ 設定 | チャネルマスター/入金サイクル/車両台数 | 設定 |
| 📊 ダッシュボード | 当月KPI | ダッシュボード |
| 📝 売上入力 | reservations自動表示 | 売上入力 |
| 📘 PL(月次) | チャネル別売上（計上ベース、収入のみ） | PL_那覇/PL_札幌/PL_全体 |
| 💰 CF(月次) | 入金-支出=純収支 | CF_那覇/CF_札幌/CF_全体 |
| 🧾 コスト入力 | 返済/販管費/売上原価（予算入力） | コスト内訳入力 |
| 📋 コスト一覧 | 全月コスト横串 | 月次コスト/コスト月次入力 |
| 🔵 HP-CV | オフィシャルCV件数 | オフィシャルCV件数 |
| 📊 予算CF | OTA構成比×予算売上→入金月 | 予算CF_那覇/札幌/全体 |
| 📈 投資回転率 | クラス別収益性 | 投資回転率 |
| 🔮 CFシミュ | 実績×入金サイクルシミュレーション | CF入金シュミレーター |
| 🔍 パトロール | SS↔APP自動比較（差異検出） | — |

**技術的ポイント**:
- **DB不使用**: `v_monthly_pl`, `v_monthly_cf`, `cost_entries` 等のビュー/テーブルは存在しない。全て `reservations` + `app_settings` から直接計算
- **PLピボット** (`plPivot`): `dbResvs` → チャネル×月の売上集計。収入のみ（支出なし）
- **CFピボット** (`cfPivot`): `dbResvs` + 入金サイクル(`mgSettings.channels`) → 入金月計算 + `costAllMonths` → 支出集計
- **コスト保存**: `app_settings` テーブル、key=`cost_{store}_{ym}`、value=JSON配列 `[{account_code, amount, note}]`
- **科目コード体系**: `repay_1`〜`repay_5`(返済→CFのみ)、`sga_*`(販管費14科目)、`cogs_*`(売上原価7科目)、`vehicle_purchase`(車両仕入)
- **オーナー確認済みルール**: 返済→CF only（PLに影響なし）、販管費/売上原価→CF only、PL=収入のみ

**パトロール機能**:
- **目的**: Excel→APP移行期の安全網。SSを正としてAPP計算値を追跡
- **SSソース**: Google Sheets ウェブ公開CSV
  - URL: `https://docs.google.com/spreadsheets/d/e/2PACX-1vQVK2mRkYMKG3cPtr5HSi9TWSS1JevKOvTmOusvXjoOZOEtW_KTX9oYXQld3FeK3Q/pub`
  - GID: PL_那覇=1117507661, PL_札幌=609433931, CF_那覇=1575364807, CF_札幌=1260007687, 月次コスト_那覇=1740899330, 月次コスト_札幌=658706807
- **比較対象**: PL売上(チャネル×月), CF入金(チャネル×月), CF支出(販管費/売上原価/合計), コスト(月次合計)
- **出力**: ✅完全一致 or ⚠️差異N件（セル単位でSS値/APP値/差額を表示）
- SSは当面手動更新 → パトロールで差異追跡 → 一定期間後APP単独運用に移行

**コミット履歴**:
- `4b30aba` feat(経営管理): 予実比較タブ (v4.6.16)
- `f480d80` feat(経営管理): 設定+売上入力
- `7e1521c` feat(経営管理): PL/CF/コスト入力 reservations直接計算 (v4.6.17)
- `51d1b19` feat(経営管理): 5新subtab (コスト一覧/HP-CV/予算CF/投資回転率/CFシミュ)
- `48f3f5c` feat(経営管理): コスト→CF連動、Excel準拠科目構成
- `64d3287` feat(経営管理): SS↔APPパトロール (v4.6.18)

**次のステップ**:
- Excelコストデータ → app_settingsに一括投入（バックフィル）
- パトロール実行 → 差異確認 → 修正

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
