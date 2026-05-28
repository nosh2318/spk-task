# ❄️ SPK 札幌 実装詳細

## 🚗 2026-05-26 セッション: SPK大規模機能追加 (配車表・partner.html・A2/B2クラス対応)

### 完了タスク

#### 1. forecast.html 予測命中率追加 (3店: NHA/SPK/BT)
- 各月の予測カードに「📊 予測命中率 = 速報÷予測 × 100」表示
- 信号色: 🟢90%+ / 🟡70%+ / 🟠40%+ / 🔴40%-
- バージョン: NHA v3.5.61+ / SPK cf4296c / BT 5480ea4
- 過去月は速報=実績なので非表示
- 小数点バグ修正 (`¥X.452` → `¥X` ・ `Math.round` 適用)

#### 2. SPK 配車表 大規模機能追加
| バージョン | 機能 |
|---|---|
| v4.7.159 | 個別車両 折りたたみ非表示 (localStorage: spk_fleet_hidden_v) |
| v4.7.160 | クラス見出し/車両行に💰売上常時表示 (returnDate当月内集計) |
| v4.7.161 | ヘッダーに 💰売上/🚗台あたり/📊進捗 バッジ |
| v4.7.162 | 売上計算を「返却日起算」に統一 (TOPサマリーと整合) |
| v4.7.165 | 協力会社コスト ヘッダー/クラス/車両行に表示 |
| v4.7.169-170 | 新クラス追加機能 + 既存編集機能 (バリデーション緩和) |
| v4.7.171 | 協力会社コスト 固定費→変動費に変更 (予約日数ベース) |
| v4.7.172-173 | クラス順を動的化 (A2/B2 等カスタム対応) |
| v4.7.174 | INIT_CLASSES に A2/B2 追加 + 全ハードコード array 一括置換 |

#### 3. partner.html (協力会社ビュー) 機能追加 (SPK専用)
- URL: `https://nosh2318.github.io/spk-task/partner.html?owner=PARTNER_TEST`
- タブ構成: 📅 配車表 / 📋 予約データ / 💰 コスト一覧 / ⚙️ 車両情報
- v0.5.1 → v0.8.0
- 機能:
  - 配車表カレンダー (SPK配車表と同デザイン: ナンバー大/保険/稼働日数/売上)
  - 予約データタブに「泊数/日額/コスト/粗利」4列追加
  - 💰 コスト一覧タブ新規追加 (owner_company≠HANDYMAN + partner_daily_cost>0 の車両)
  - 車両情報タブに日額コスト編集UI
  - 稼働ステータス3段階: ✅稼働中 / ⏸待機中 / ❌除外

#### 4. vehicle-pl.html 新規作成 (SPK)
- URL: `https://nosh2318.github.io/spk-task/vehicle-pl.html`
- 車両×月別 売上/原価/粗利マトリクス (PERIOD_START=2026-02 起点)
- 月次原価 = リース + 保険(月額) + 車検/24 + 点検/6 (KPIマスターv4・自動車税除外)
- K表記禁止・カンマ区切りで生数字表示

#### 5. handyman-damage (傷チェックAPP) 修正
- vehicle_twins.display_label 一括修正 36件 (NHA22+SPK14)
  - 「VEL」「ヴェル5555」等の code → 「ヴェルファイア / 7673」「ヴェルファイア / 9047」
  - URLエンコード対応 (日本語コード)
- スタッフ画面ヘッダー: car name + plate_no 明示表示 ・plate_no 不正値検出

### 🔴 重要バグ復旧
- **partner.html 上書き事故**: 私が `Write` で全置換 → カレンダー機能消失 → git revert で復旧 → 日額機能を Edit で追加実装
- **教訓**: 既存ファイルは `Write` 全置換禁止 → `Edit` で部分追加のみ

### 🔴 オーナー新仕様: 協力会社コスト 変動費化
- 旧: `partner_daily_cost × 当月暦日数` (active月の暦日全部・予約なくても発生)
- 新: `partner_daily_cost × 当月返却予約の日数合計` (予約が入った日のみ計上)
- 反映先: SPK配車表 vehiclePartnerCost / partner.html renderCost / renderTimeline

### 🔴 A2/B2 クラス対応 (商品構成PDF準拠)
- A2: トヨタ アルファード/ヴェルファイア (預かり車両・OTA単独商品)
- B2: トヨタ ノア高年式 (預かり車両・OTA/HP単独商品・¥12,000固定)
- 2026/6 本番運用開始予定 (まだ予約データなし)
- **SPK のみ対応** (NHA/BT は対象外)
- 修正:
  - INIT_CLASSES に A2/B2 追加 (8クラス化)
  - ハードコード array 一括 sed 置換 (10箇所)
  - GAS parseOfficial_ MODEL_CLASS_MAP に Tier0 (B2クラス/A2クラス/ノア高年式/アルファード預かり) 追加
  - GAS extractVehicleClass_ は既対応 (`[_](B2|A2)(?:[_]|$)`)
  - GAS classMatch に A2/B2 専用ルート追加

### 🔴 DB スキーマ追加 (オーナー実行済)
```sql
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS partner_daily_cost INT DEFAULT 0;
NOTIFY pgrst, 'reload schema';
```

### partner_actions Slack通知バグ復旧
- `partner_reserved_delete` が notified_slack=true なのに実際の Slack 配信失敗していた4件
- curl で `notified_slack=false` reset → GAS 5分後再通知 → Slack着信OK
- 恒久対策候補: GAS postToSlackChannel_ の堅牢化 (要オーナー判断)

### 🔴 クラス管理機能 (SPK)
- 車両編集モーダル → 「✨ 新規追加 / ✏️ 編集 / 🗑️ 削除/初期値」3ボタン
- 保存先: localStorage (端末別)
  - `spk_custom_classes_v1`: 新規追加クラス
  - `spk_class_overrides_v1`: 初期クラスのオーバーライド (label/seats)
- バリデーション: 空文字以外何でも可 (1〜3文字制限は厳しすぎたため緩和)
- グローバル変数経由 (window.__spkAddCustomClass等) で props バケツリレー回避

### 🟡 残作業 (オーナー判断待ち)
1. GAS 本番反映 (gas-email-import-v2.gs を GAS エディタに貼付)
2. NHA/BT に同機能横展開
3. vehicle-pl.html に協力コスト統合
4. handyman_expenditure 予測機能 再実装 (前回 revert したまま)
5. SPK plate_no「未定」「確認」を正しいナンバーに更新
6. GAS postToSlackChannel_ 堅牢化 (Slack配信失敗時の retry)

### 📄 デザイン整理ドキュメント
- `~/Desktop/HANDYMAN_商品構成整理_v2.html` / `.pdf` (色付きカード+テーブル形式)
- 2026/6-10 運用版 商品構成・価格戦略マトリクス・タイムライン・TODO

### 🔴 今セッションの教訓
1. **既存HTMLファイルは Write 全置換禁止** → Edit で部分追加 (partner.html 事故)
2. **prompt UI のバリデーションは緩めに** (1〜3文字制限は厳しすぎ)
3. **type="number" + controlled component + value 0 はタイプ入力不可** → type="text" + inputMode="numeric"
4. **ハードコード array は INIT_CLASSES 連動を意識** (A2/B2 追加で10箇所 sed 必要)
5. **コスト計算: 固定費 vs 変動費の区別を明確に** (オーナー仕様確認重要)
6. **Slack 通知の DB フラグだけ信用しない** (postToSlackChannel_ の応答チェック必要)

---

