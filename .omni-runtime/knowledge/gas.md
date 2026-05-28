# 🤖 GAS / Supabase 運用詳細

## 🔴 visit_type / return_type 値体系 確定（2026-04-30）
- **オーナー確定の値体系**:
  | 値 | 意味 | セット経路 |
  |---|---|---|
  | `PUB` / `BDB` | 空港バス送迎（基本運用） | GAS自動 + 手動 |
  | `DEL` / `COL` | デリバリーオプション | GAS自動 + 手動 |
  | `PU` / `BD` | ハイエース送迎（バス満員時の例外） | **APP手動入力のみ** |
  | `来店` / `返却` | 送迎を希望しない自力来店顧客 | **HPフォーム + OTA「便名なし＋デリバリーなし」で GAS自動許可**（5/2 再再確定）+ 手動 |
  | 空（''） | 推論不能 → スタッフ手動判断待ち | - |
- **絶対ルール（GAS）**:
  - `derivePlaceType_` は **PUB/BDB/DEL/COL/'' のみ返す**。PU/BD は絶対に出さない
  - `inferVisitReturnType_` は **空フィールドのみ推論で埋める**。既存値（来店/返却/PU/BD/DEL/COL/PUB/BDB）は触らない
  - `isAutoVisitReturnValue_` で **来店/返却/PU/BD は保護対象**（バックフィルで上書きしない）
  - 旧表記 `PU(バス)` / `BD(バス)` は自動系として扱い、`PUB`/`BDB` に移行する
- **推論ロジック（derivePlaceType_）**:
  ```
  来店/店舗/店頭/ヤード/営業所/HANDYMAN を含む → 空
  送迎バス/14番のりば/11番/レンタカー送迎バス/那覇空港/空港 を含む → PUB/BDB
  ★OTAデリバリー希望 で始まる → DEL/COL
  それ以外 = ホテル/住所/施設名 → DEL/COL
  ```
- **「那覇空港店」の扱い**: 「空港」キーワードでマッチして PUB/BDB 推論される（B案確定）。HANDYMAN店舗名でもバス送迎前提として扱う
- **バス定員**: コースター 20名/便（CLAUDE.md naha-project ローカル参照）。1予約最大8名 < 20名なので単独溢れなし。同時刻帯複数予約合計超過時のみAPP表示で PU/BD降格（リアルタイム計算）
- **2026-04-30 障害**: 5/1 OPシートで「BDBなのにCOL」「PUBなのにDEL」誤データ4件発見 (RC32461109390823176/ZVB17865/KZR36991/XHG62819)
  - 真因: parseOfficial_ で `visit_type: ''` ハードコード、全パーサーで `return_type` キー不在、toDbRow_ も `return_type` 書き込まずだった
  - 修正: `derivePlaceType_` / `inferVisitReturnType_` / `isAutoVisitReturnValue_` 追加、toDbRow_ に return_type 追加、`backfillVisitReturnType` でバックフィル
  - 結果: 5/1以降300件中42件補正（手動値133+67=200件保護）、新規取込は GAS 自動推論で永続化
- **スタッフ向けマニュアル**: `~/Desktop/naha-project/docs/visit-return-type-rules.md` / PDF: `~/Desktop/送迎タイプ_返却タイプ_入力ルール_那覇空港店.pdf`
- **GAS手動実行関数**:
  - `testDerivePlaceType()`: 20テスト全パス確認（ロジック健全性）
  - `backfillVisitReturnTypeDryRun()`: 補正プレビュー（書込なし）
  - `backfillVisitReturnType()`: 5/1以降の予約を補正（既定）
  - `backfillVisitReturnTypeAll()`: 全期間バックフィル
- **教訓**: GASパーサー設計時は **どの値がGAS自動 vs 手動 vs APP動的計算 か** を初期に明確化する。後付け補正は事故になる

---

## 🔌 全OTAパーサー USB 数抽出 仕様統一（2026-05-08 NHA gas/Code.gs）

### 背景
RC予約 2605000594（オオツジン様）でメール本文に「USB充電器 x 2」と記載があるが、`opt_usb=0` でDB登録されていた。
parseRentacarDC_ をはじめ、全OTAパーサーで USB 抽出ロジックが欠落していた。

### 各OTAメールの USB 表記パターン
| OTA | 表記例 |
|---|---|
| HP（オフィシャル） | `USBポート: 0 個`（明示的に0もある） |
| RC（レンタカードットコム） | `USB充電器 x 2` |
| 楽天 | オプション欄に「USB充電」等 |
| じゃらん | オプション欄「USB充電器x1」等 |
| skyticket | 「USB-Cポート×1」等 |
| エアトリ | 「USBポート x 1」等 |

### 実装内容
1. **共通ヘルパー `detectUsbCount_(text)` 追加**（gas/Code.gs L803付近）
   - 5パターンの正規表現でフォールバック
   - 「USBポート: 0 個」 → 0（明示0扱い）
   - 「USB充電器 x 2」 → 2
   - 「USB」のみ（数字なし） → 1
2. **全7パーサーで USB 抽出 + return.opt_usb に追加**:
   - parseJalan_ / parseRakuten_ / parseSkyticket_ / parseAirtrip_ / parseOfficial_ / parseGogoout_ / parseRentacarDC_
3. **parseRentacarDC_ のオプション抽出を複数行版に修正**:
   - 旧: `extractField_(body, 'オプション')`（1行のみ取得）
   - 新: `extractFieldMultiline_(body, 'オプション')` フォールバックあり

### バグ事例
- 2605000594（オオツジン様 / RC / 6/20-6/21 / プリウス系H）
  - メール「オプション： USB充電器 x 2」
  - 旧: opt_usb=0 → オーナー手動修正で opt_usb=2 に
  - 新: 次回取込から自動で opt_usb=2 が入る

### Lesson
- **OTAメールの「オプション」欄は OTA ごとに書式が違う**。1つのパーサーで取れていても他で取れていないケース多数
- USB のような「数字付きアイテム」は **5パターン以上の正規表現で多様な表記揺れに対応** する必要がある
- 「USBポート: 0 個」のような **明示的に0** を表す記載と、「記載なし=0」を区別する設計が望ましい

---

## 🔇 「未入金エスカレーション（那覇）」アラート削除（2026-05-05 NHA gas/Code.gs）

### 背景
オーナー指示「このアラートは不要 削除」（毎日17時のSlack通知）

### 削除内容
`nhaReconcilePaymentSheet`（1時間間隔・DB↔スプシ突合パトロール）の
**「メール送信後24時間以上未入金」エスカレーション通知部分のみ削除**:
- `escalations` 集計コード削除
- `#okinawa_operations-team` への通知削除
- 「⚠️ 未入金エスカレーション（那覇）N件」Slack文言削除

### 残した機能
- **DB↔シート不整合の自動修正**（fixes）= 残す
- **日次9時の `nhaCheckJalanUnpaidAlert`** = 残す（出発3日前以内のみ通知する設計）

### 設計方針
- 24時間経過の単純な時間ベース通知は **未入金が常態化している場合に大量に出る → アラート疲労**
- → 「**出発が近い未入金**」のみ通知する設計に集約（日次9時の方）
- DB↔シート不整合は別軸で監視（こちらは無音化せず継続）

### Lesson
- **アラートは「アクション可能性」と「希少性」がある時だけ発火させる**。「24時間経過」のような単純時間ベースは件数が膨らみがちで通知疲労を生む
- 既に同種アラート（出発間際の未入金）が別関数にある場合、二重通知を避けるため一方を削除する判断が正しい

---

