# 🛠 分析・経営ツール（forecast/planner/monthly/expenditure等）

## 🔴 月次レポートPDF 機能（2026-05-19 完成）

### 概要
各店舗の経営管理タブ ダッシュボード に「📋 月次レポート（YYYY-MM）」ボタンを追加。
ダッシュボードで選択中の月のPDFレポートを生成する。

### アーキテクチャ（確定版）
```
ボタン onClick（同期・1行）
  ↓
openFullMonthlyReport_(dbStore, dashYm, ..., dashKpi, dashYearly, null)
  ↓
STEP1: window.open()  ← ユーザジェスチャー内（同期）→ popupブロック回避
STEP2: Promise.all([sb.from("nha_app_settings")...])  ← 広告費をasync取得
STEP3: adPromise.then(ad => { var cmMap=ad.cm, costMap=ad.co; ... }) ← 新鮮データで計算
STEP4: w.document.write(html)  ← 既に開いているウィンドウに書き込み
```

**重要**: `window.open()` は必ず `await` より前（同期コンテキスト内）で呼ぶこと。
async/awaitの後でwindow.openするとpopupがブロックされる。

### レポートセクション構成
| # | セクション | データソース |
|---|---|---|
| ① | TOPsummary | **`dashKpi`をそのまま使用**（再計算なし・APPと完全一致） |
| ② | クラス別売上カード | `clsMonth`（関数内計算・クラス別売上ウィジェットと同一ロジック） |
| ③ | KPI管理表（全12ヶ月） | 月別HP/OTA売上 + `getAd()`で広告費（async取得済み） |
| ④ | クラス別ランキング（粗利順） | 全期間累計（`PERIOD_START`以降） |
| ⑤ | チャンネル別売上 | `monthResv`から集計 |
| ⑥ | 年間推移 | **`dashYearly.months`をそのまま使用**（再計算なし） |

### 表示開始月フィルタ（PERIOD_START）
- NHA: `2026-04` 以前は非表示
- SPK: `2026-02` 以前は非表示
- BUDDICA: `2026-05` 以前は非表示

### 広告費の取得パス
```
nha_app_settings テーブル
  └ key="cm_nha_YYYY-MM" → value={xmop3xv4n7f6: 500000, ...}  ← NHA広告費コード
  └ key="cost_nha_YYYY-MM" → value=[{account_code:"sga_ad", amount:500000}]  ← fallback
```
- NHA広告費コード: `["xmop3xv4n7f6"]`
- SPK広告費コード: `["xmoxky29punj","xmoxky7sxos9","xmoxkyd9yojr"]`

### 関数ファイル
3店舗で **完全同一の `openFullMonthlyReport_` 関数** を使用:
- NHA: `~/Desktop/naha-project/index.html.bak` line 7003〜
- SPK: `~/spk-task/index.src.html` line 5285〜
- BUDDICA: `~/buddica-touring/app/index.html.bak` line 6850〜

### 変更時のルール
- 関数を変更したらNHAでビルド確認後、**sed で行範囲を確認してからSPK/BUDDICAに完全コピー**
- `diff` で差分ゼロを確認してからビルド・デプロイ
- `openPdfReport_`（旧来の簡易レポート）は別関数として残す

### 過去の失敗パターン（再発防止）
1. **async onClick + window.open** → popupブロック → 「ボタンが押せない」
2. **sync onClick だが cmMap 未ロード** → 広告費¥0
3. **パターンマッチング失敗で関数を部分適用** → NHA/SPKで表示形式が異なる
4. **行範囲ずれで openPdfReport_ の関数ヘッダーを削除** → SyntaxError

---

## 🔴 実入金CF コスト内訳ミラーリング（2026-05-17 確立）

### 仕組み
- **コスト内訳タブ（costmatrix.html）** → `_sg0`/`_acctM`/`_cg0`/`_rg0` を計算後に `cm_ci_totals_${store}_${year}` としてlocalStorageに保存
- **実入金CFタブ（monthly.html `_ciLoadCostAndBalance`）** → localStorageから読むだけ。計算しない

### 絶対ルール
1. **実入金CFはコスト内訳の数字をそのまま表示する。独自計算は一切しない**
2. **コスト内訳を先に開いてからCFを開く**必要がある（localStorageにデータがないと表示されない）
3. **NHAのコードは触らない**（動いているものを壊さない）
4. costmatrix.htmlはNHA/SPK両方に別ファイルが存在する → 修正時は両方に適用が必要

### 修正ファイル
| ファイル | 変更内容 |
|---|---|
| `~/spk-task/costmatrix.html` | render()内で `_rg0` を追加計算し `cm_ci_totals_spk_${year}` をlocalStorage保存 |
| `~/Desktop/naha-project/costmatrix.html` | 同上（NHA用）|
| `~/spk-task/monthly.html` の `_ciLoadCostAndBalance` | `cm_ci_totals_${s}_${y}` をlocalStorageから読んでsumに展開するだけ |

### 教訓
- 「コスト内訳にある数字を出してくれ」= 再計算するな。あるものをそのまま出せ
- 動いているNHAのコードに手を加えてはいけない
- localStorageはNHA/SPKが同一オリジンで共有する
- costmatrixがautoSaveするとlocalStorage（cm_vals_*）をクリアするが、cm_ci_totals_*は別キーなのでクリアされない

### コミット
- `1bde3fb` NHA costmatrix.html 保存コード追加
- `a69a664` SPK costmatrix.html 保存コード追加
- `727cda9` SPK monthly.html CFをlocalStorage読み取りのみに変更

---

## 🔴 OTA別入金サイクル（2026-05-17 確定）

### 仕組み
- `monthly.html` の 実入金CFタブ（💵）
- OTAごとの入金サイクルに基づいて月別予約売上を「入金月」に振り替えて表示
- コスト内訳と合わせて 残高（入金 − 総支出）を計算

### OTA別入金サイクル
| OTA | コード | 入金タイミング |
|---|---|---|
| HP/SP | HP,SP | 予約受付当月 |
| じゃらん | J | 返却月 |
| RCドットコム | RC | 返却月の翌月 |
| GoGoOut | G | 返却月の翌月 |
| エアトリ | O | 返却月の翌月 |
| スカイチケット | S | 返却月の翌月 |
| 楽天 | R | 返却月から3ヶ月後 |

### 手数料設定
- 各OTAごとに手数料%を設定（デフォルト: HP=0%, その他=15%）
- ⚙️ OTA手数料設定パネルから変更可能

### 表示行
1. OTA別 3行（売上 / 手数料 / 入金予定）× 7 OTA
2. 💵 入金合計
3. --- 区切り ---
4. 📋 販管費①（手動入力）← コスト内訳から
5. 📊 販管費②（会計実績）← コスト内訳から
6. 📦 売上原価（リース/保険/修理等）← コスト内訳から
7. 🏦 返済 ← コスト内訳から
8. 💵 入金合計（再掲）
9. 🔴 総支出合計
10. 💰 残高（入金 − 総支出）

---

## 🏆 車両ランキング機能（2026-05-14 確立・全3店舗実装完了）

### 経緯
オーナー指摘「集計のやり方を固定しないのはおかしい / 全てのKPIを固定化すべき」を受けて、KPIマスター定義書 + Python集計モジュール + APP新タブを構築。「協議しても答えがここにあるように」「点数化すればいい」「迷わない仕組み」がコンセプト。

### KPIマスター（唯一の真実）
- 定義書: `~/Desktop/HANDYMAN/kpi_master/HANDYMAN_KPI_MASTER.md`
- 集計モジュール: `~/Desktop/HANDYMAN/kpi_master/handyman_kpi.py`
- 検証コマンド:
  ```bash
  python3 handyman_kpi.py verify spk        # APP整合チェック
  python3 handyman_kpi.py ranking spk       # 車両ランキング
  python3 handyman_kpi.py class_profit spk  # クラス別1台あたり粗利
  python3 handyman_kpi.py months spk        # 月別売上4分解
  ```

### 計算式（オーナー定義 v4・2026-05-14 確定）
- **① 合計売上** = 期間内の予約price合計
- **② 月平均売上** = ① ÷ 期間月数
- **③ 平均稼働率** = 期間稼働日数 ÷ active月の暦日数 × 100%
- **④ 固定費合計** = (リース + 保険(命名annualだが月額) + 車検/24 + 点検/6) × 期間月数 ※自動車税は除外
- **⑤ 予想粗利** = ① − ④
- **月平均粗利** = ⑤ ÷ 期間月数

### 点数化（合計100点）
- ① 売上 25点 + ② 月平均 15点 + ③ 稼働率 25点 + ⑤ 粗利 35点
- 各項目 = (値 ÷ 全車両中最大値) × 配点。マイナス値は0点
- ランク: **S(80+) / A(60+) / B(40+) / C(20+) / D(<20)**

### 計算起点（店舗別 固定値）
| 店舗 | 起点 | 理由 |
|---|---|---|
| **SPK 札幌** | **2026-02** | データ完備&運用安定化 |
| **NHA 那覇** | **2026-04** | データ完備&運用安定化 |
| **BT BUDDICA高松** | **最初の予約月（動的）** | 開店月＝起点。予約0件は「予約待ち」表示 |

期間終点は常に「当月」。6月になれば自動で月数拡張（SPKなら5ヶ月、NHAなら3ヶ月...）。

### APP実装場所
- ナビ「🔧 車両」タブの直後 / TOP「設定」セクションの「車両」アイコンの隣に **🏆 車両ランキング** タブ
- リアルタイム計算（5分間隔自動更新）
- クラス別ランキング + 全車両ランキング の2セクション表示
- 識別: 車両名 + 登録ナンバー（plate_no）

### 各店の最新バージョン（2026-05-14時点）
| 店舗 | バージョン | URL |
|---|---|---|
| SPK | v4.7.146 / spk-v695 | https://nosh2318.github.io/spk-task/ |
| NHA | v3.5.32-NHA / BASE_V=3532 | https://nosh2318.github.io/naha-project/ |
| BT | v1.0.40-BT / BASE_V=1391 | buddica-touring/app リポジトリ |

### SPKランキング結果サンプル（2026-02〜2026-05・4ヶ月）
| 順 | ﾗﾝｸ | 点数 | クラス | 車両 | ⑤予想粗利 | ③稼働率 |
|---:|---|---:|---|---|---:|---:|
| 1 | A | 76.9 | F | ソリオ 8529 | +¥287,033 | 51.5% |
| 2 | A | 75.1 | A | ヴェルファイア 7673 | +¥263,083 | 41.7% |
| 3 | B | 59.3 | S | CX-5 8065 | +¥206,643 | 25.2% |
| 4 | B | 53.9 | B | ノア 5398 | +¥137,525 | 48.5% |
| 5 | B | 46.4 | B | デリカD5 6057 | +¥71,053 | 55.3% |
| ... | ... | ... | ... | ... | ... | ... |
| 9 | D | 13.1 | H | アクセラ 8403 | ▲¥100,617 | 17.5% |
| 10 | D | 12.7 | C | CX-3 4576 | ▲¥103,542 | 16.5% |

### 設計の絶対ルール（再発防止）
1. **集計のやり方を固定化**: 計算式の変更は `HANDYMAN_KPI_MASTER.md` 経由でのみ。APP直接変更禁止
2. **status正規化**: 「キャンセル」「cancel」→ cancelled、「確定」「null/空」「confirmed」→ confirmed
3. **`status=eq.confirmed` でDBフィルタしない**: 「確定」(日本語)が消える（2026-05-14ミス）
4. **複合PKテーブル**: `vehicle_monthly_kpi` は (year_month, vehicle_code) で dedup
5. **APP内 vehicles のキー名はキャメルケース**: `leaseMonthly` / `insuranceAnnual` / `carTax` / `shakenCost` / `tenkenCost` / `no`（plate_no）
6. **6月以降の自動拡張**: `new Date()` で当月を取得、期間月数は while ループで動的拡張

### 配点・ランクの変更履歴
- v1 (2026-05-14午前): 粗利60 + 稼働40 = 100（オーナー協議前の暫定）
- v2 (午後): ①20 + ②15 + ③20 + ⑤25 + ⑥20 = 100（6項目評価導入）
- v3: 起点を固定 SPK=2026-02 / NHA=2026-04 / BT=2026-05
- **v4 (現行)**: ⑥利回り削除、配点 ①25+②15+③25+⑤35=100、クラス別ランキング追加、月平均粗利列追加

### 教訓（このセッションで起きたミス）
- ❌ 毎回違うクエリで違う集計をした → 数字がブレた
- ❌ `status=eq.confirmed` で「確定」(日本語) 93件を取りこぼした
- ❌ 「粗利」の定義を勝手に変えた（変動マージン vs 営業利益）
- ❌ 期間月数を勝手に変えた（4ヶ月平均 vs 全期間グロス vs 単月）
- ✅ オーナー指示で「KPIマスター + 関数固定化」に集約 → 解決

### コードロケーション
| ファイル | 役割 |
|---|---|
| `~/Desktop/HANDYMAN/kpi_master/HANDYMAN_KPI_MASTER.md` | 定義書（仕様の正本） |
| `~/Desktop/HANDYMAN/kpi_master/handyman_kpi.py` | Python集計モジュール |
| `~/Desktop/HANDYMAN/SPK_車両ランキング_v3_2026-05-14.csv` | SPK最新集計結果 |
| `~/spk-task/index.src.html` (VehicleRankingTab) | SPK実装 |
| `~/Desktop/naha-project/index.html.bak` (VehicleRankingTab) | NHA実装 |
| `~/buddica-touring/app/index.html.bak` (VehicleRankingTab) | BT実装 |

---

## 車両管理タブ 全面刷新（2026-04-25 NHA v3.3.75 / SPK v4.7.14）

### NHA 最終バージョン
- **APP_VERSION**: v3.3.75-NHA（コミット f53fe31）
- **URL**: https://nosh2318.github.io/naha-project/ （GitHub Pages / 2026-05-03 更新）
- **旧URL**: https://handyman-fleet.vercel.app/ （Vercel自動bot防御で403 → GitHub Pagesへ移行済み）
- **sw.js**: nha-vXXX（最新は git push 済）

### SPK 最終バージョン
- **APP_VERSION**: v4.7.14（コミット d357870）
- **URL**: https://nosh2318.github.io/spk-task/ （2026-05-02 GitHub Pages 移行 / 旧 spk-task.vercel.app 廃止）
- **sw.js**: spk-v575

### 実装済み機能（両店舗）

**車両タブ 5サブタブ構成（NHA・SPK 統一）:**
| タブ | 内容 |
|-----|------|
| 運用サマリー | KPIカード(台数/稼働/貸出/待機) + 🔴車検/🟡半年点検アラートバナー + クラス別アコーディオン |
| マスター | クラス別アコーディオン + 5タブモーダル(基本/保険/ランニングコスト/メンテ/整備) |
| 車検/点検 | 3サブタブ(車両マスター/スケジュール/資金繰り) + 確定金額入力 |
| 距離管理 | 走行距離+OIL交換記録・アラート・Slackアラート |
| 整備管理 | 統合ビュー(ステータス+費用) + 小計常時表示 + 月別折りたたみ |

**経営管理 > 解析タブ:**
- E. 車両別P&L（売上−原価−支出=粗利）追加

### ランニングコスト計算式（確定）
```
月次原価 = 保険料（月額・直接入力）
         + リース代（月額・直接入力）
         + 自動車税（年額）÷ 12
         + 車検代（概算）÷ 24（2年周期）
         + 半年点検代（概算）÷ 6（年2回）
```
**注意**: 保険料はフィールド名 `insurance_annual` のままだが意味は月額に変更済み

### DB変更済み
**NHA `nha_vehicles` 追加カラム:**
`insurance_annual`(月額保険), `lease_monthly`, `car_tax`, `shaken_cost`, `tenken_cost`, `oil_interval_km`, `grade`, `color`, `memo`

**NHA `nha_maintenance` 追加カラム:**
`cost`, `actual_cost`, `workshop`, `invoice_no`, `maint_notes`

**SPK `vehicles` 追加カラム:**
`insurance_annual`(月額保険), `lease_monthly`, `car_tax`, `shaken_cost`, `tenken_cost`, `oil_interval_km`, `grade`, `color`, `memo`

**SPK `maintenance` 追加カラム:**
`cost`, `actual_cost`, `workshop`, `invoice_no`, `maint_notes`

### 車検/点検アラートロジック（運用サマリー）
- 🔴 車検: 稼働中車両で今日〜12ヶ月以内に `label=車検` のメンテブロックなし
- 🟡 半年点検: 稼働中車両で今日〜6ヶ月以内に `label=半年点検` のメンテブロックなし
- バナーに対象車両名と次回予定日（あれば）を表示

### 整備記録→車検/点検 連携
- 整備管理でlabel=「車検」「半年点検」記録 → `maintenance.actual_cost` に確定金額を自動書込
- 車検/点検タブ > 車両マスター の「確定金額」列に即時反映

### スタッフマニュアル
- `~/Desktop/naha-project/vehicle-manual.html` — ブラウザで開いてCmd+PでPDF保存

### SPK 固有事項
- 距離管理: `car_data` テーブル（type=mileage/oil_change）使用（NHAは nha_vehicle_maintenance）
- クラス順序: A/B/C/S/F/H 固定（INIT_CLASSES準拠）
- Slackアラートトークン: `window.HANDYMAN_SLACK_BOT_TOKEN` 経由（未設定のため送信不可・要設定）
- MaintForm（配車表メンテ登録）: NHA仕様に統一（車検/半年点検の詳細情報フォーム追加）

---

## 🚗 NHA / SPK 空車ウィジェット追加（2026-05-03）

### 仕様
TOPに「今日 空いている車両数（クラス別）」カード追加。
- **空車** = 配車表に稼働フラグあり かつ 今日が予約期間外 かつ 整備にかかっていない車両
- 中日（5/2 出発・5/5 返却の 5/3 など）は **稼働中扱い**（車両がお客の手元にあるため空車ではない）
- 用語：占有→稼働中 / 全→保有 / メンテ→整備
- カード表示：クラス別に「稼働中N / 整備N / 保有N」+ 大きな空車数 + シグナル色（0=赤/1=黄/2+=緑）+ホバーで車両コード一覧

### バージョン
- NHA: v3.4.45-NHA / app.js?v=3445
- SPK: v4.7.62 / spk-v619 / sw.js?v=531

### 実装位置
- NHA `index.html.bak` L10821 付近 に `VacancyWidget` コンポーネント追加
- SPK `index.src.html` L3261 付近 に同コンポーネント追加（クラス順は SPK 仕様 A/B/C/S/F/H）
- 両方とも `MemoBox` の下、`SummarySection` の上に配置

### 計算ロジック確定までの議論
- 初版：「2日連続 完全空車」（予約期間が今日 OR 明日にかぶる→占有）→ オーナー指摘「中日は車手元にないので占有でしょ」で修正
- v2：「今日のみ」「貸出/返却/メンテないこと」と中日は空車扱い → オーナー指摘「中日は物理的に塞がってるので空車ではない」で再修正
- 確定版：「今日が予約期間 [lend, return] に含まれない」かつ「整備期間に含まれない」= 空車

### Lesson
- **計算式の意図確認は、推論ではなくオーナーへの直接質問で詰める**。「占有」「空車」は業務用語によって定義が違う

---

## 🚗 NHA / SPK 空車ウィジェット 洗車タスク除外追加（2026-05-05 NHA v3.4.50 / SPK v4.7.63）

### 要望
オーナー指摘「両店 今日に洗車タスクも入ってない車両を出す仕様になってますか？ 配車表に稼働フラグあり（未稼働は含まない）＋予約入ってない＋メンテになってない＋当日に洗車タスクが入ってない」

### 修正前の判定（不足）
1. ✅ `vehicles.active=true` AND `nha_vehicle_monthly_kpi.active=true`
2. ✅ 今日が予約期間 [lendDate, returnDate] 外
3. ✅ 今日にメンテナンスがかかっていない
4. ❌ 当日洗車タスクのチェックなし → **翌日DEL予約紐付け車両が空車にカウントされる**

### 修正後（4条件揃った）
1. 同上
2. 同上
3. 同上
4. ✅ **当日洗車タスクが入っていない**:
   - DB query: `nha_tasks` (NHA) / `tasks` (SPK) で `date=today, type=洗車` の `assigned_vehicle` を取得
   - 補完: 翌日 lendDate の配車済み車両も「洗車予定」として除外（DB未materializeケース対応）
   - 両者の和集合 = 洗車対象車両セット

### UI変更
- カード末尾の表示: `稼働中N/整備N/保有N` (旧) → `稼働N/整備N (改行) 洗車N/保有N` (新)
- ヘッダーフッター: `本日 貸出X件 / 返却X件 / 整備X台` → `... / 整備X台 / 洗車X台` に拡張
- 注釈: 「整備外」→「整備外 かつ 当日洗車タスクなし（…翌日lend配車済も洗車として除外）」に更新

### 実装ファイル
- NHA: `~/Desktop/naha-project/index.html.bak` L10828〜
- SPK: `~/spk-task/index.src.html` L3271〜
- どちらも `useEffect` で `washDb` state を取得、`useMemo` 内で `washExpected` と論理和

### バージョン
- NHA: v3.4.49 → v3.4.50-NHA / app.js?v=3449→3450
- SPK: v4.7.62 → v4.7.63 / spk-v619 → spk-v620 / CV='spk-v620' / sw.js?v=531→532
- コミット: NHA `ad467cc` / SPK `b519551`

### Lesson
- **空車判定の真理値表は4軸ある**: 稼働フラグ・予約・メンテ・**洗車タスク**。最後の1つが抜けていた
- 洗車タスクの取得は **DB query + 翌日lend補完** の2系統が必要（DBに洗車タスクが未materializeの日でも漏れない）

---

## 🗓 月次収支ページ 全面刷新（2026-05-09）

### ファイル構成
- **NHA**: `~/Desktop/naha-project/monthly.html`（SPKと同一ファイルをコピー）
- **SPK**: `~/spk-task/monthly.html`
- **アクセス**: NHA ナビ「予算実績」タブ → `monthly.html?v=タイムスタンプ` にリダイレクト
- **SPK**: 経営管理 → 月次PL/CF タブ（iframe）

### 現在の構成
```
[📊 PL]  [💰 CF]  ← 大テーマ（独立ページ）
[📋 予算] [📊 実績] [📊 予実比較]  ← 小タブ
[那覇] [札幌] [合計]  ← 店舗
◀ 2026 ▶  ← 年
```

### PL ページ
- **予算**: 基本料金/付帯売上/割引/予約外売上/その他売上（手動・小項目追加可）→ PL売上合計 → 販管費/売上原価 → PL支出 → **PL営業利益**
- **実績**: 同構成、DB自動取得（reservations + costmatrix + accounting）
- **予実比較**: 月別 予算｜実績｜達成率 3列表示

### CF ページ
- **予算**: 現金入金 / 返済（▲）→ **CF残高**（= PL営業利益 + 現金入金 − 返済）
- **実績**: 同構成、DB自動取得
- **予実比較**: 月別 予算｜実績｜達成率

### 数式確定
- `PL営業利益 = PL売上合計（現金入金を含まない） - PL支出`
- `CF残高 = PL営業利益 + 現金入金 - 返済`

### 保存先
- **実績 その他売上（手動）**: `nha_app_settings.extra_manual_nha_{year}` / `extra_manual_spk_{year}`
  - 形式: `{items:[{id,name,values:{mm:amount}}]}`
- **予算データ**: `nha_app_settings.budget_nha_{year}` / `budget_spk_{year}`
  - 形式: `{base:{mm:v}, opt:{mm:v}, disc:{mm:v}, extra:{mm:v}, cashin:{mm:v}, sga:{mm:v}, cogs:{mm:v}, repay:{mm:v}, manual:{items:[...]}}`

### キャッシュ対策
- monthly.html に `<meta http-equiv="Cache-Control" content="no-cache">` 追加済み
- NHA リダイレクト: `window.location.href='monthly.html?v='+Date.now()`

### NHA ナビラベル変更
- 旧: `{id:"monthly",ico:"📅",l:"月次"}` → 新: `{id:"monthly",ico:"📊",l:"予算実績"}`

---

## 🔧 配車表 修理予算 追加（2026-05-09）

### 変更内容（NHA/SPK 両対応）
- `MaintForm` の「修理」ラベル選択時に「修理予算（円）」入力欄を追加（赤系デザイン）
- 業者名・メモも入力可能
- 予算スケジュール（車両タブ → 車検/点検 → 予算スケジュール）に「修理」を追加

### 予算スケジュール変更
- `TYPES = ["車検","半年点検","修理"]` に拡張
- `TC["修理"] = {bg:"#fef2f2",color:"#991b1b",bar:"#dc2626"}` 赤色
- `costByMonth` の予算: `maintenance.cost` を修理レコードも含めて集計
- `costByMonth` の実績: `hmLogs` の `type='repair'` を追加
- バーチャートに修理バー（赤）追加

### 修理費の会計連携
- 修理予算は `nha_maintenance.cost` / `maintenance.cost` に保存
- 実績は `nha_logs` / `hm_logs` の `type='repair'`、`actual_cost` から集計

---

## 月次収支・コスト内訳 大規模修正（2026-05-09 午後）

### monthly.html 修正内容（NHA/SPK 共通）

#### 🔴 Supabase 1000行制限バグ修正（最重要）
- **症状**: 売上が実際より大幅に少なく表示される（1314件中314件欠落）
- **原因**: Supabase は `limit=5000` 指定でも実際は max 1000行/クエリで打ち切る
- **修正**: `sbq()` 関数をページネーション対応に変更（`offset=0→1000→2000...` でループ）
- **効果**: APPの年間推移と一致した売上数値を表示

#### localStorage キャッシュ廃止
- **原因**: APPが書き込んだ古いキャッシュが実績値と乖離していた
- **修正**: `monthly_resv_nha/spk` localStorage キャッシュ読込を廃止
- 常に `nha_reservations` / `reservations` から直接取得

#### loadTotal Promise.all 順序バグ修正
- `nhLogs`（整備ログ）と `nhResvs`（予約）が入れ替わっていた → 合算タブの売上・cogs がゼロになっていた

#### 販管費②（会計実績）から整備カテゴリ除外
- `/修理|車検|点検|整備/` に該当する会計エントリを `acctActual` から除外
- costmatrix の車両費（nha_logs）との二重計上を防止
- NHA: 修理費¥1,755,582 / 車両整備費¥11,680 が販管費②から除外

#### SPK ログテーブル修正
- `hm_logs`（存在しないテーブル）→ `logs?store_id=eq.sapporo` に修正（3箇所）

#### loadTotal SGA_IDS/COGS_IDS 動的再構築
- 従来はハードコードIDのみ → カスタム追加項目（`xmop3xv4n7f6`広告費など）が合算に含まれなかった
- 各店舗の `cm_st_nha`/`cm_st_spk` ST構造から動的にIDセットを再構築
- 那覇・札幌の合算 = 個別の和 が正しく成立

#### 表示調整
- 小計行に予約外売上を含む: `base+opt-disc+extra`
- 予約外売上を小計の上に移動
- その他整備費（nha_logs type=other/oil）を売上原価に統合（別行廃止）

### costmatrix.html 修正内容（NHA/SPK 共通）

#### SPK store検出修正
- `localStorage.getItem('cm_last_store')` のみ使用 → SPK APP から `?store=spk` のiframe埋め込みで那覧データが表示される問題
- **修正**: URLパラメータ `?store=` を最優先: `new URLSearchParams(location.search).get('store')` → fallback localStorage

#### 販管費②から整備カテゴリ除外
- `ACCT_EXCLUDE = /修理|車検|点検|整備/` を全4箇所（折畳合計/カード計/現金計/総合計）と `saveAll()` に適用
- NHA: `車両整備費`（`整備`キーワード）も除外対象に追加

#### その他整備費の扱い
- `nha_logs type=other/oil` → `_maintData.other` に集計
- `cogs_other`（その他原価）に自動反映
- ST順序: `修理 → その他原価 → 賃料合計`（マイグレーション③で既存ST自動修正）
- 車両費合計ヘッダーに「その他」を追加: `車検・点検・修理・その他`

#### SPK ログテーブル修正
- `hm_logs` → `logs?store_id=eq.sapporo` でSPK整備記録を正しく取得

### 確定した数式
```
PL売上合計 = 基本料金 + 付帯売上 - 割引 + 予約外売上（accounting extra_sales）+ その他売上（手動）
PL支出    = 販管費①（costmatrix手動）+ 販管費②（accounting、整備カテゴリ除外）+ 売上原価（リース+保険+整備記録）
PL営業利益 = PL売上合計 - PL支出
```

### 注意事項
- **Supabase 1000行制限**: `sbq()` の `limit=N` は無意味。ページネーション必須
- **販管費② ≠ 全会計支出**: 修理費/車両整備費は除外（nha_logsの車両費で別途計上）
- **SPK costmatrix**: `?store=spk` URLパラメータで正しく動作。localStorage依存は廃止

---

## 勤怠管理ページ kintai.html（2026-05-11 新規実装）

### ファイル
- `~/Desktop/naha-project/kintai.html`（NHA/SPK共通）
- **URL**: `https://nosh2318.github.io/naha-project/kintai.html` / `spk-task/kintai.html`

### 仕様
- **データソース**: Supabase `nha_shifts`/`shifts` の `symbol` カラム自動集計
  - `有`=有給使用 / `公`=公休 / `希`=希望休 / `出`=出張 / `●`=出勤日
  - `nha_attendance`/`spk_attendance` の `absent=true` = 欠勤
- **スタッフ**: `nha_staff`（NHA）/ `staff`（SPK）から `type='正社員'` のみ取得
- **固定値**（有給付与数・希望休上限・公休規定）: localStorage に保存（⚙️設定ボタン）
- **表示**: スタッフ別カード形式、4月始まり年度（4〜翌3月）で12ヶ月横並び
- **違反アラート**: 有給超過（赤）/ 希望休超過（赤）/ 欠勤あり（黄）

---

## シーズナル&価格カレンダー seasonal.html（2026-05-12 新規実装）

### ファイル
- `~/Desktop/naha-project/seasonal.html`（NHA/SPK共通）
- **URL**: `https://nosh2318.github.io/naha-project/seasonal.html?area=nha` / `?area=spk`
- APPナビの **🗓️ 価格表** タブからiframeで開く（NHA v3.5.27 / SPK v4.7.129）

### 仕様
- **プロパーのみ**（ハイエンドなし）
- **エリア選択**（那覹/札幌）で自動切替。URLパラメータ `?area=nha/spk` で直接指定可
- **4要素スコアリング**: E(イベント) × T(観光流入) × R(レンタカー需要) × H(連休)
- **ティア自動判定**: 合計スコア ≥5.5→A繁忙 / ≥3.0→B通常 / それ以下→C閑散
- **日別価格**: ティア係数（A:1.50/B:1.00/C:0.75）× クラス基本料金
- **手動上書き**: 日付クリック→モーダルでティア・価格を個別変更可
- **月別価格カスタム**: 月ごとに価格マトリクスを上書き可
- **保存**: localStorage（NHA: `hdm_nha_seasonal_v2` / SPK: `hdm_spk_seasonal_v2`）
- **JSON**: エクスポート/インポート対応

### クラス定義（確定）
**那覹** A/B/C/D/S/F/H:
| コード | クラス名 | 車種例 |
|---|---|---|
| A | アルファードH | ALH |
| B | ワンボックスB | VOX/NOH/SRH系 |
| C | CSUV | ライズ/YRC |
| D | ワンボックスD | NOM/SRM |
| S | SUV | ハリアー |
| F | コンパクト | NOT VIT AQA |
| H | セダン | PUL PLA |

**札幌** A/B/C/S/F/H:
| コード | クラス名 | 車種例 |
|---|---|---|
| A | LUX高級MV | アルファード系 |
| B | MPVミニバン | ノア/セレナ系 |
| C | コンパクトSUV | ライズ/ロッキー |
| S | SUV | ハリアー/RAV4 |
| F | コンパクト | アクア/ヴィッツ |
| H | セダン | カローラ/アクセラ |

### エリア別シーズナル定義
- **那覹E**: 那覹大綱挽き(10月)/全島エイサー(8月末)/琉球海炎祭(2月末)/沖縄桜(1月末〜2月)
- **那覹T**: 年間高水準。GW/お盆/年末年始=10、夏休み=9、SW=8。梅雨は落ちにくい
- **那覹R**: 7〜8月=10、GW/年末=8、梅雨=4、台風9月=5
- **札幌E**: 雪まつり(2月上旬)=10、よさこいソーラン(6月)=8、秋まつり(9月)=5
- **札幌T**: 夏(7〜8月)=10、雪まつり=9、GW=9、紅葉(10月)=8。冬平日=2
- **札幌R**: 夏=10、GW=8。冬(12〜3月)は極端に低い=1〜2

---

## 勤怠管理システム 残業・希望休 機能追加（2026-05-14）

### 1. チームカレンダーに「🟠 残業」カテゴリ追加（3店舗）
- **対象**: NHA `index.html.bak` / SPK `index.src.html` / BUDDICA `index.html.bak`
- `CAT` 配列に `{key:'overtime',label:'残業',icon:'🟠',color:'#f97316'}` 追加
- 残業選択時は `is_all_day=false` に自動切替、デフォルト時間 18:00〜21:00
- `store_events` テーブルの `category='overtime'` として保存

### 2. 給与計算タブに「残業/時間外」サブタブ追加（3店舗）
- `AttendanceManager` の `subTab` に `"overtime"` 追加
- `store_events` から `category='overtime'` を月別取得
- スタッフ選択 → 日付・時間帯・時間数・内容一覧 + 月間合計 + 全スタッフサマリー

### 3. kintai.html（勤怠管理ページ）全面更新（3店舗）

**ファイル（各店舗固定・切替セレクターなし）:**
| 店舗 | ファイル | Supabase | テーブル |
|---|---|---|---|
| 那覹 | ~/Desktop/naha-project/kintai.html | HANDYMAN共通 | nha_staff / nha_shifts / nha_attendance |
| 札幌 | ~/spk-task/kintai.html | HANDYMAN共通 | staff / shifts / spk_attendance |
| BUDDICA | ~/buddica-touring/app/kintai.html | BUDDICA独自(ggqugvyskyiblxiycpci) | bt_staff / bt_shifts / bt_attendance |

**仕様:**
- 有給：廃止（ROWS・設定モーダルから削除）
- 希望休：年間16日制（残 = 年間上限16 - 調整枠 - シフト集計の希）
- 調整枠：localStorage設定として追加（既消化日数・シフトデータ外）
- 表示期間：4月始まり年度 → 1月〜12月（カレンダー年）
- 残業記録：store_events overtime を各スタッフカード下部に集計表示
- 出勤簿ナビ上限：今日+3ヶ月 → 2026年12月固定

**那覹スタッフ 調整枠設定値（kintai.html > 各スタッフの⚙️設定から手動入力）:**
- 齋藤：調整枠 4（シフト上希6日、残6日）
- 伊江：調整枠 8（シフト上希1日、残7日）
- 廣瀬：調整枠 11（シフト上希4日、残1日）

### 4. アプリナビゲーション「📋 勤怠管理」追加（3店舗）
- 配置：TOP画面スタッフ管理セクション（出勤簿・給与・スタッフの横）
- sections items に {id:"kintai", ico:"📋", l:"勤怠管理", external:true, url:"kintai.html"} 追加
- sections onClick を item.url 参照に修正（旧: "license.html" 固定だった）
- navItems にも同様追加（⏰給与の隣）

### localStorage キー
- NHA: hdm_kintai_nha_settings_v1
- SPK: hdm_kintai_spk_settings_v1
- BUDDICA: hdm_kintai_bt_settings_v1

### 設定スキーマ
{"kibo":16,"adjust":N,"kokyu":8}

---

## 🔮 売上予測シミュレーター forecast.html (2026-05-21 構築完了)

### URL
| 店舗 | URL |
|---|---|
| NHA | https://nosh2318.github.io/naha-project/forecast.html?store=nha |
| SPK | https://nosh2318.github.io/spk-task/forecast.html?store=spk |
| BT  | https://buddica-touring.github.io/app/forecast.html?store=bt |

各APP TOP > データ・分析 > 🔮 売上予測 から起動。

### コード・仕様書
```
~/Desktop/naha-project/forecast.html / ~/spk-task/forecast.html / ~/buddica-touring/app/forecast.html
~/Desktop/HANDYMAN/forecast_engine/
  ├─ FORECAST_HTML_DEVELOPMENT_LOG.md  ★ 開発履歴・全コンテキスト
  ├─ VARIABLES_DEFINITION.md (v1.4)     20変数定義書
  ├─ FORMULA_DEFINITION.md (v1.2)       予測式 + 3層構造
  └─ predict.py / predict_ensemble.py   CLI版
```

### 構造
**5手法アンサンブル**: M1(目標+季節+連休) / M2(既予約済み) / M3(パターン) / M4(トレンド) / M5(予約発生ペース)
**重み付け**: AA/A 遠方月 → M1=0.55 / B/C 遠方月 → M1=0.35,M5=0.35

### 月別目標 (オーナー確定 2026-05-21)
- NHA: 500/600/600/550/500/500/750/**1100**/700/700/550/500 (万円・年¥7,550万)
- SPK: 130/130/130/130/130/130/200/**200**/200/200/130/130 (万円・年¥1,840万)
- BT: 暫定値・オーナー確定待ち

### シーズナルランク (確定)
- NHA: C-B-B-B-C-C-A-**AA**-A-A-B-C
- SPK: C-B-B-B-C-C-A-**AA**-A-A-C-C
ティア係数: AA=2.0 / A=1.5 / B=1.0 / C=0.7
連休加点: 大型+0.30 / 4連休+0.10 / 3連休+0.05

### PERIOD_START
- NHA: 2026-04 (1-3月は created_at が一括取込で潰れ・82%壊れ)
- SPK: 2026-02
- BT: 2026-05

### UI (上から下)
1. 📢 スタッフサマリー (3ヶ月先・口語)
2. 🎯 命中率バー (常時表示・5KPI%)
3. ヒーローカード5枚 (目標/速報/予測/達成率/信頼度)
4. 予測の内訳 (残期間で何件×単価)
5. 🔍 KPI整合性チェック
6. 📊 全KPI 12ヶ月ビュー
7. 詳細セクション群 (折り畳み)

### タブ切替: 月次詳細 / 年間進捗

### 予測命中率（バックテスト）
過去月で予測を再実行 → 実績との誤差を測定 → 5KPI命中率算出
🟢85%以上=高精度 / 🟡70-85%=要改善 / 🔴70%未満=破綻

### オーナー設計哲学（重要）
1. **予測が全て・エビデンス強度が核心**
2. **全KPIが連動して理にかなった数字**
3. **予測 = レールから外れない正常値**
4. **3層: シーズナル=需要 / 目標=実力 / ギャップ=伸び代**
5. **全ては商品(車両)が動いた結果**
6. **予測の命中率を追わないと施策考えても意味がない**

### 修正済みバグ
- M2 線形外挿の暴走 → 既予約済み合計に変更
- PERIOD_START NHA=2026-01 → 2026-04
- スタッフサマリー vs ヒーローカード の予測ロジック乖離 → 統一
- 稼働台数バグ → 配車表と統一
- 変数名衝突 (ymKey, curCnt) → unique 化

### 既知の制限
- created_at 82% 壊れ (NHA) → リアルタイム取込分のみ信頼
- BT 目標暫定
- エビデンス強度「低」表示は5手法散らばり → 蓄積で改善

詳細は `~/Desktop/HANDYMAN/forecast_engine/FORECAST_HTML_DEVELOPMENT_LOG.md` 参照

---

## OTA別入金サイクル（2026-05-17 確定）

| OTA | コード | 入金タイミング | 基準日 |
|---|---|---|---|
| HP（自社HP） | HP/SP | **予約受付当月** | created_at |
| じゃらん | J | **返却月** | return_date |
| レンタカードットコム | RC | **返却月の翌月末** | return_date +1M |
| GoGoOut | G | **返却月の翌月末** | return_date +1M |
| エアトリ | O | **返却月の翌月末** | return_date +1M |
| スカイチケット | S | **返却月の翌月末** | return_date +1M |
| 楽天 | R | **返却月から3ヶ月後末** | return_date +3M |

対象: NHA（那覹）/ SPK（札幌）両店

### キャッシュCF実装ファイル
- `~/Desktop/naha-project/cf-cash.html`（NHA/SPK/合計 対応）

---

## 🎯 目標逆算プランナー planner.html 3店舗実装（2026-05-24 確立）

### 構成
| 店舗 | URL | コミット |
|---|---|---|
| NHA | https://nosh2318.github.io/naha-project/planner.html | `7048899` → `360867d` → `f18dc31` |
| SPK | https://nosh2318.github.io/spk-task/planner.html | `516318d` → `46a74fa` → `1b3e8a2` |
| BT  | https://buddica-touring.github.io/app/planner.html | `e2527f5` → `1883dcd` |

### 機能概要
forecast.html (売上予測シミュレーター) のヘッダー「🎯 目標逆算プランナー」リンクから遷移。
目標月+目標売上を入力 → 達成可能性%・必要追加件数・推奨アクション・シナリオ別シミュレーションを表示。

### KPIカード構成（現状サマリー・9枚）
1. **🚗 稼働台数** ← 試算の根本エビデンス（オーナー指摘で第1カード化）
2. 目標売上
3. 現在売上 (確定)
4. ギャップ
5. 必要追加件数
6. 計画可能日数
7. 必要日次売上
8. **現状 稼働率**（信号色: 70%以上=緑/40%以上=橙/未満=赤）
9. **目標達成時 想定稼働率**（100%超過は ⚠️ 物理的に困難）

### 稼働台数の算出ロジック（優先順）
1. `holdings.total`（NHA: `nha_vehicle_holdings_history`の`total`クラス）
2. `holdings` クラス別合計
3. `_vehicles.length`（車両マスター `active=true`）
**→ いずれも `vehicle_monthly_kpi.active=false` で除外された車両を引く**

### 重要バグ・修正履歴
| バグ | 真因 | 修正 |
|---|---|---|
| 「逆算実行」を押しても動かない | `totalDays` 定義より前で参照（ReferenceError） | 稼働率算定ブロックを totalDays 定義後に移動 |
| 稼働率が常に0% | `fetchAll()` が全テーブルで `.order('id')` 強制 → `nha_vehicles` (PK=code) でクエリエラー → `_vehicles=[]` | `TABLE_PK` マップ追加（テーブル別 order カラム切替）。CLAUDE.md 2026-05-08 `loadDbAll` 同型バグの再発 |
| 稼働台数がOFFラインカウント | `vehicle_monthly_kpi.active=false` を見ていなかった | `kpiInactiveCodes` Setで除外。サブに「配車表でN台除外済」表示 |

### STORE_CFG（NHA/SPK/BT 各テーブル）
```js
nha: { live: 'nha_reservations', vehicles: 'nha_vehicles', kpi: 'nha_vehicle_monthly_kpi',
       holdings: 'nha_vehicle_holdings_history', historical: 'nha_historical_reservations',
       start_col: 'start_date', end_col: 'end_date' }
spk: { live: 'reservations', vehicles: 'vehicles', kpi: 'vehicle_monthly_kpi',
       holdings: null, historical: null,
       start_col: 'lend_date', end_col: 'return_date' }
bt:  { live: 'bt_reservations', vehicles: 'bt_vehicles', kpi: 'bt_vehicle_monthly_kpi',
       holdings: null, historical: null,
       start_col: 'lend_date', end_col: 'return_date' }
```

### TABLE_PK マップ（fetchAll の order カラム切替）
```js
const TABLE_PK = {
  'nha_vehicles': 'code', 'vehicles': 'code', 'bt_vehicles': 'code',
  'nha_vehicle_holdings_history': 'id',
  'nha_vehicle_monthly_kpi': 'vehicle_code',
  'vehicle_monthly_kpi': 'vehicle_code',
  'bt_vehicle_monthly_kpi': 'vehicle_code'
};
// それ以外は 'id' デフォルト
```

### 教訓（再発防止）
1. **`.order('id')` 強制は危険**: 複合PK/非標準PKテーブルでクエリエラー → 静かに空配列が返る → 集計値ゼロベース化
2. **稼働台数を扱う新規UIは必ず `vehicle_monthly_kpi.active` を確認**: 配車表の「この月稼働させない」設定が反映されない事故
3. **React run() 関数の変数定義順序を意識**: `y/m → totalDays/monthStart → planDays/elapsed` の順
4. **ReferenceError は React 描画を完全に止める**: try-catch では救えない
5. **新規テーブルを fetch する関数を書く時はそのテーブルのPKを確認**

---

## 💰 出入金管理表 handyman_expenditure.html 大改修（2026-05-24 〜 進行中）

### 📁 ファイル
- ローカル: `~/Desktop/handyman_expenditure.html`（スタンドアロンHTML・1700行超）
- デプロイ不要（オーナーがブラウザで直接開く）
- Supabase連携: `ckrxttbnawkclshczsia`（NHA/SPK 共有DB）
- 認証: `member@g-lines.jp / 8888`（手動設定 or 自動継承）

### 🎯 主要機能（最終形）

#### タブ構成（3タブ）
| タブ | 内容 |
|---|---|
| 💰 入金 | 月セレクタの月から **3ヶ月分** 並列表示・全月編集可 |
| 💸 支出 | 月次サマリー sticky + 販管費/売上原価/返済 |
| 📊 サマリ (CF計算書) | キャッシュフロー計算書（CF）のみ |

#### 入金タブ
- **3ヶ月並列表示**（起点月+1+2、折りたたみ可）
- **OTA自動取込ロック**: HP/SP 以外（じゃらん/楽天/スカイ/エアトリ/RC/GoGoOut）は readonly（緑系背景・破線枠）
- HP/SP/手動行のみ編集可
- **🔄 OTA取込ボタン**: 各月別に `syncOTA(ym)` 実行
- 入金額計算式: `(bp>0\|\|op>0)?(bp+op-disc):price` ← monthly.html `_ciCalc` と完全一致
- 各OTA行に **forecast.html引用予測** 表示（M3パターン+M4トレンド）

#### 支出タブ
- 上段に **月次サマリー sticky 固定**（銀行残高/入金/販管費/売上原価/返済/クレジット/支出計/残高）
- **2モード切替**:
  - 📂 科目別: 販管費/売上原価/返済の3セクション
  - 🔀 固変別: 全項目を 🔵固定費 / 🟢変動費 の2大セクションに集約（各項目に [販管]/[原価]/[返済] バッジ）
- **並び順切替**: 🔵固定費から / 🟢変動費から
- **🔵/🟢 プルダウン**: 各行で固定/変動切替（即時ソートしない・「🔄並び順を更新」ボタンで反映）
- 「**ゼロ項目を末尾に**」自動ソート（那覇=0 かつ 札幌=0 の項目はグループ下部にまとめる）
- グループ/セクションヘッダーに **項目数カウント** 表示
- 💳 クレジット決済枠ボタン維持

#### サマリタブ - CF計算書（最終形）
**行構成**:
```
🏦 月初残高 (自動)            期初値 or 前月期末から繰越
⚙️ 月初調整①  [入力]         手動・タイトル編集可
⚙️ 月初調整②  [入力]         手動・タイトル編集可
⚙️ 月初調整③  [入力]         手動・タイトル編集可
▶ 実効月初 (=月初+①+②+③)
💰 入金合計 ▶ クリックで内訳
  🏝 那覇 (エリア小計)
    HP/SP/OTA8つ/手動行 (チャンネル別)
  ❄️ 札幌 (エリア小計)
    同上
▲ 支出合計 (販管費+売上原価のみ・返済除外)
🏦 返済 (CF) ▶ クリックでエリア別
  🏝 那覇 返済
  ❄️ 札幌 返済
当期増減 (=入金-支出-返済)
🏦 期末残高
```

### 💾 保存ボタン式（即時保存廃止・2026-05-24）
- 入金/支出/銀行残高 全 input 共通仕様
- 入力中: 🔴 テキスト赤+ 「💾保存」ボタン点滅
- 保存後: 🟢 テキスト緑
- 保存直後に **カスタムモーダル**「📋 繰越しますか？」3択:
  - ❌ **キャンセル** (保存取消・入力前に巻き戻し)
  - **いいえ** (この月だけ)
  - ✅ **はい** (全月コピー・入力月+1〜月セレクタ最終月まで・店舗別)

### 📋 繰越機能
- 「はい」選択時: `getRolloverTargets(fromYm)` = 翌月から月セレクタ最終月まで
- **店舗別**コピー（那覇に入力したら那覇のみ、札幌に入力したら札幌のみ）
- CF計算書も即時再描画 (`rerenderCF()` で `#cf-statement` のみ replace)

### 🔮 forecast.html 引用予測 (calcOtaForecast)
- 各OTAの過去 lookback (6) ヶ月から:
  - M3 パターン: 1年前同月 or 過去全月の中央値
  - M4 線形トレンド: 最小二乗法で次月外挿
- forecast = (M3 + M4) / 2
- 入金タブの各OTA行の合算列下に小さく「↗ 予想 ¥YYY (+X%)」表示

### 🏦 銀行残高セクション → 削除 (2026-05-24)
- 旧: サマリタブ上部に独立した銀行残高入力欄（複数行）
- 新: **削除**。CF計算書の「⚙️ 月初調整」3枠で実残高合わせ
- 月初調整: 各月で個別入力可能（実残高 − 自動計算 = 調整値）

### 🔴 致命バグ修正履歴
| バグ | 真因 | 修正 |
|---|---|---|
| 月セレクタが2026/9まで → 短い | `for(let i=-2;i<=4;i++)` で7ヶ月固定 | 動的に **今月-2 〜 2027/12** まで生成 |
| 入金額誤差 (monthly.html と乖離) | `r.price` のみ参照（bp/op/disc 無視）| 計算式を `_ciCalc` と一致化 |
| ymAdd 過去月で `y++` バグ | `while(m<1){m+=12;y++}` ← `y--` のはず | 修正 (CLAUDE.md 既存ルール) |
| 編集後に合計/差異が古いまま | onInc がヘッダーstotsだけ更新 | 合計行・差異セル・前月セルも再計算 |
| ▲500,000 が誤表記 (▼であるべき) | 差異セル未更新 | 差異セル再計算ロジック追加 |
| 数字が全て消えた | calcOtaForecast の例外 → buildInc 全体止まる | try/catch で隔離 |
| CF計算書 二重表示 | `replaceWith` の selector が `[data-tab="summary"] .sec:last-child` で誤って bank wrap を対象に | `id="cf-statement"` で確実置換 |
| 固定費/変動費 折りたたみ効かない | `id="body-ct-${type}"` (ハイフン) と `toggleSec('ct_F')` (アンダースコア) 不一致 | `collapsedKey='ct-'+type` に統一 |

### 🗄 主要 localStorage キー一覧
| 用途 | キー |
|---|---|
| 月別データ (income/rows/banks) | `hm2_exp_<store>_<ym>` |
| 月初残高調整①（互換） | `hm2_ob_ym_<ym>` |
| 月初残高調整②③ | `hm2_adj2_ym_<ym>` / `hm2_adj3_ym_<ym>` |
| 月初残高調整①②③ タイトル | `hm2_ob_label` / `hm2_adj2_label` / `hm2_adj3_label` |
| 年度期初値 (フォールバック) | `hm2_ob_<year>` |
| 固定/変動 個別上書き | `hm2_cost_type_overrides` (JSON {id:'F'\|'V'}) |
| 並び順 | `hm2_cost_sort_order` ('F-first'\|'V-first') |
| 表示モード | `hm2_exp_view_mode` ('cat'\|'cost') |
| アクティブタブ | `hm2_active_tab` ('income'\|'expense'\|'summary') |
| 入金内訳開閉 | `hm2_cf_inc_expand` ('1'\|'0') |
| 返済内訳開閉 | `hm2_cf_rep_expand` ('1'\|'0') |
| Supabase認証トークン | `hm2_auth_token` |

### 📝 削除・廃止された機能（オーナー指示）
- 集計テーブル（旧 buildTotals）← サマリタブから削除
- 銀行残高入力欄 (buildBank) ← UI削除、関数本体は残置
- 予測CF (buildForecastCF) ← 「実績と同じになっていた」で削除、関数本体は残置
- 入金内訳のエリア別行（那覇/札幌の2行並列）← 「混乱する」で削除→「エリア×全チャンネル」形式に再設計

### 🎯 オーナーの設計哲学
1. **保存は明示的に**（即時保存廃止・「💾保存」ボタン押下で初めて保存）
2. **OTA自動取込値はロック**（実数=DB値なので編集不可）
3. **手動行は編集可**（HP/SP/予約外売上/BUDDICA/AU差分/貸付）
4. **月初/期末は自動・調整は手動**（3枠の調整で実数合わせ）
5. **エリアで分離**（那覇/札幌を完全に分けて並列ではなく上下に）
6. **シンプル設計**（一般的なCFフォーマット・余計な機能は削除）

### 残課題 (オーナー思案中)
- CF月次収支 ▲100〜120万円ギャップを埋めるアクション
  - 案A: 固定費削減候補リスト
  - 案B: チャンネル別売上アップ余地分析
  - 案C: 3シナリオCFシミュレーション (現状/+売上100万/-支出100万)
  - 案D: planner.html と統合
- 実装するかオーナー判断待ち

### 関連ファイル/参照
- 関連: `monthly.html` (NHA `~/Desktop/naha-project/` / SPK `~/spk-task/`) ← 実入金CF (`_ciLoadCostAndBalance`)
- ロジック互換: `_ciCalc` ↔ `syncOTA` で OTA入金マッピング・売上計算式が同一
- ピア機能: planner.html (NHA/SPK/BT)・forecast.html (NHA/SPK/BT)

---

