# HANDYMAN エージェントチーム

## 🔴 KPI問い合わせ時のデータソース ルール（2026-05-14 確立）

### 🎯 オーナーの哲学（2026-05-14 明示）
> **「理解すべきなのは『どのデータをどこからとるのか』ということ。
> データはすでにある。そのために様々なタブを増やしたり階層を作ってる」**
> **「那覇・札幌・BUDDICA 全て同じ仕様にしてるのはそのためである。
> 環境が違っても数字が必ずどこかに入ってる」**
> **「なのでどの箱になんの数字が入ってるのかを理解しなければ意味がない」**

→ タブと階層は **意図して設計されている**。私の仕事は「どこに何があるか」を覚えて使うこと。
→ 同じKPIを別経路で再集計するのは設計を理解していない証拠。
→ **3店舗（NHA/SPK/BT）の構造は完全統一**。だからマップは1つで全店舗に通用する。
→ 店舗別に違うKPIマップを作る必要はない（個別 .claude/CLAUDE.md には書かない）。
→ **「箱マップ」を覚えることが私の基礎的な仕事**。それなしには何もできない。

### 🗃 箱マップの階層構造（覚えるべき）

```
1. URL / APP
   ├── https://nosh2318.github.io/naha-project/  ← NHA
   ├── https://nosh2318.github.io/spk-task/      ← SPK
   └── buddica-touring/app                       ← BT
       │
2. メインタブ（共通）
   ├── 🏠 TOP
   ├── 📁 CSV
   ├── 📊 予算実績 (monthly.html iframe)
   ├── 🗓 価格表 (seasonal.html iframe)
   ├── 👥 スタッフ
   ├── 📅 出勤簿
   ├── ⏰ 給与
   ├── 📋 勤怠管理 (kintai.html)
   ├── 🚗 配車 (FleetTimeline)
   ├── 💳 決済 (じゃらん事前決済)
   ├── 🔧 車両 (VehicleTab)
   ├── 🏆 車両ランキング ← 2026-05-14 新規
   ├── 🅿️ 駐車場
   ├── 💰 会計
   ├── 👑 顧客
   ├── 📋 データ
   ├── 📜 過去
   └── 🪪 免許証 (license.html)
       │
3. 経営管理タブ → サブタブ
   ├── 📊 ダッシュボード
   │    ├── 売上4分解カード（基本/付帯/予約外/割引/合計）
   │    ├── KPIカード（売上/支出/純収支）
   │    ├── 3項目サブサマリー（現金入金/出金/残高/立替）
   │    ├── 📈 年間推移テーブル（12ヶ月×指標）
   │    └── チャネル別構成（月/年トグル）
   ├── 📈 予実比較
   ├── 🔍 解析タブ
   │    ├── A. 稼働率（全体/車両別）
   │    ├── B. 予約・売上 → 💰 売上4分解（月/年）+ 月別テーブル
   │    ├── C. リードタイム → 直前予約・予約パターン
   │    ├── D. 構成分析 → OTA別/DEL・COL場所Top20/エリア/時間帯/デリバリ利用率
   │    └── E. 車両別P&L → 売上−原価−支出=粗利
   ├── 💰 売上入力
   ├── 📘 PL（月次）
   ├── 💰 CF（月次）
   ├── 🧾 コスト入力
   ├── 📋 コスト一覧
   ├── 🔵 HP-CV
   ├── 📊 予算CF
   ├── 📈 投資回転率
   ├── 🔮 CFシミュ
   └── 🔍 パトロール（SS↔APP）
       │
4. 車両ランキング → 内部セクション
   ├── 📊 クラス別ランキング（クラス内集計）
   └── 🚗 全車両ランキング（点数化・S/A/B/C/D）
        ├── ①合計売上
        ├── ②月平均売上
        ├── ③平均稼働率
        ├── ④固定費合計（リース+保険+車検/24+点検/6）
        ├── ⑤予想粗利（①−④）
        └── 月平均粗利
```

### 🗄 DBテーブル ↔ APP表示 対応マップ

| DBテーブル | カラム | APPでの表示場所 |
|---|---|---|
| `nha_reservations` / `reservations` | `base_price` | 経営管理→ダッシュボード/解析タブB「基本料金」 |
| 同 | `option_price` | 同上「付帯売上」 |
| 同 | `discount` | 同上「割引」 |
| 同 | `price` | データタブ・OPシート・配車表 |
| 同 | `start_date` (NHA) / `lend_date` (SPK) | 配車表・OPシート |
| 同 | `return_date` / `end_date` | 同上 |
| 同 | `status` | データタブ |
| 同 | `ota` | データタブ・解析タブD「OTA別構成比」 |
| 同 | `vehicle_class` / `vehicle` | データタブ・配車表 |
| `nha_accounting` / `spk_accounting` | `type='extra_sales'` | 経営管理→ダッシュボード「予約外」 |
| 同 | `type='advance'` | 会計タブ「立替金」 |
| 同 | `type='income'/'expense'` | 会計タブ「収支」 |
| `nha_fleet` / `fleet` | `reservation_id`, `vehicle_code` | 配車表・車両ランキング |
| `nha_vehicles` / `vehicles` | `lease_monthly` | 車両タブ・車両ランキング「④固定費合計」 |
| 同 | `insurance_annual` (実は月額) | 同上 |
| 同 | `car_tax`, `shaken_cost`, `tenken_cost` | 同上 |
| `nha_vehicle_monthly_kpi` | `active` | 車両タブ・解析タブA・車両ランキング |
| `nha_tasks` / `tasks` | 全カラム | OPシート・配車表 |
| `nha_shifts` / `shifts` | 全カラム | 出勤簿・勤怠管理 |
| `nha_attendance` / `attendance` | 全カラム | 給与タブ |
| `nha_jalan_payments` | `status`/`amount` | 決済タブ・TOP決済セクション |
| `app_settings` | `key='budget_*'` | 予算実績タブ |
| 同 | `key='cost_*'` | コスト入力タブ |
| 同 | `key='opening_balances'` | 会計タブ月初残高 |

### 🚫 私が起こしてはいけない過ち
1. APPに表示されているKPIをDBから再集計する
2. 「箱」が見つからない時に勝手にDBクエリを書く（まずオーナーに聞く）
3. 仮説や業界平均で代用する（実績データから取る）
4. 店舗別に違うマップを作る（3店舗統一）

### 🔀 私の本業: 複数カテゴリの組み合わせ分析（2026-05-14 オーナー明示）
> **「様々なカテゴリの数字を組み合わせなければならない」**

→ **単一KPI問い合わせは「箱マップで案内」**
→ **複数KPI問い合わせは「組み合わせて分析・試算」← これが私の本業**

### 組み合わせ例（実績データのみで構成）

| 経営判断 | 組み合わせるべき箱 |
|---|---|
| Aクラス1台増車 ROI | 車両ランキング（既存A粗利）× 解析A（稼働率）× 車両タブ（追加固定費）× 予算CF（投資回収月） |
| 梅雨期間の戦略 | 解析B（過去梅雨売上）× 価格表（シーズナル係数）× 解析D（OTA構成比） |
| OTA撤退判断 | 解析D（OTA構成比）× ダッシュボード（チャネル別売上）× コスト内訳（手数料） |
| 人件費率分析 | 給与タブ × 出勤簿（シフト時間）× 売上4分解（合計売上）× 解析A（稼働率） |
| CFシミュレーション | 会計（立替未回収）× 予約外売上 × 入金サイクル設定 × 月別予約 |
| 値上げ判断 | 過去値上げ実績 × OTA別単価 × 解析C（リードタイム影響）× 競合価格 |
| 車種別ROI | 車両ランキング × 解析E（車両別P&L）× 過去整備実績（logs） |
| デリバリ利用率改善 | 解析D（デリバリ%）× 場所Top20 × 売上構成 |
| スタッフ採用判断 | シフト不足時間 × 過去稼働率 × 売上機会損失（取りこぼし日） |
| 季節別収益最大化 | シーズナル価格 × 過去同月実績 × OTA別予約パターン |

### 私の思考フロー（クロスカテゴリ分析）
```
1. 経営判断テーマを受ける（例: Aクラス増車したら？）
2. テーマに必要な変数を分解
   - 「現状の収益性」「追加投資」「リスク」「タイミング」など
3. 各変数が「どの箱」にあるかを箱マップから引く
4. 必要な箱を全部APPで開いて実績数字を引用
5. 数字を組み合わせて試算（仮説は使わない）
6. 結論を「実績ベースで」レポート
```

### 原則: **「APPに既にある数字を使え。再集計するな」**

オーナーから付帯売上・稼働率・売上比率等のKPI問い合わせがあった場合、
**まずAPPの経営管理タブを開く**。Supabaseから全件取得して再集計するのは禁止。

### 📍 KPI → APPの表示場所マップ

| 問い合わせ内容 | データソース（APP） | 場所 |
|---|---|---|
| 売上4分解（基本/付帯/予約外/割引/合計） | NHA/SPK | 経営管理 → ダッシュボード「💰売上4分解」/ 解析タブ B |
| 付帯売上の％ | 同上 | 上記の構成比表示 |
| 稼働率（クラス全体・車両別） | NHA/SPK | 経営管理 → 解析タブ A |
| 車両別売上・粗利・点数 | NHA/SPK/BT | **🏆 車両ランキング**（車両タブ隣） |
| クラス別の合計売上・粗利 | NHA/SPK/BT | 車両ランキング → クラス別ランキング |
| OTA別売上構成比 | NHA/SPK | 経営管理 → 解析タブ D「構成分析」 |
| DEL/COL場所Top20 | NHA/SPK | 経営管理 → 解析タブ D |
| 利用者エリア / 時間帯分布 | NHA/SPK | 経営管理 → 解析タブ D |
| 車両別P&L（粗利・原価） | NHA/SPK | 経営管理 → 解析タブ E |
| 月別売上推移 | NHA/SPK | 経営管理 → ダッシュボード → 年間推移 |
| チャネル別構成（月/年） | NHA/SPK | 経営管理 → ダッシュボード |
| デリバリ利用率 | NHA | 経営管理 → 解析タブ D / TOP LeadTimeWidget |
| リードタイム・直前予約 | NHA/SPK | 経営管理 → 解析タブ C・D |
| 当月予約率・稼働率（TOP） | NHA/SPK | TOP LeadTimeWidget（4月ベース） |
| 車検/点検 アラート | NHA/SPK | 車両タブ → 運用サマリー |
| じゃらん事前決済状況 | NHA/SPK | TOP決済セクション / 決済タブ |
| Square未決済 Handover | NHA/SPK | TOP MemoBox |
| 立替金 未回収アラート | NHA/SPK | TOP MemoBox / 会計タブ |
| PL（売上−支出=営業利益） | NHA/SPK | 予算実績タブ（monthly.html） |
| CF（入金−支出） | NHA/SPK | 予算実績タブ |
| コスト内訳 | NHA/SPK | costmatrix.html（経営管理経由） |
| シーズナル価格 | NHA/SPK | 価格表タブ（seasonal.html） |
| 勤怠（有給・希望休等） | NHA/SPK | 勤怠管理タブ（kintai.html） |
| 給与計算 | NHA/SPK | 給与タブ |
| バス時刻表（顧客向け） | NHA | https://...naha-project/bus.html |
| 問い合わせ管理 | 共通 | https://handyman-inquiry.vercel.app/ |
| 車両損傷チェック | NHA/SPK | https://nosh2318.github.io/handyman-damage/ |

### 🚦 私が取るべきフロー

```
1. 問い合わせを受ける
2. 上記マップから「どのタブで見られるか」を確認
3. APPで表示できる → 「●●タブで表示されています」と案内
4. APPに無い  → 「●●タブに追加すべきか？」をオーナーに確認
5. それでも私がDBから取る場合 → APPの計算式に厳密一致させる
```

### 🎯 私の役割（オーナー定義 2026-05-14）
> **「計算する必要はないはず。データを組み合わせてシミュレーションをすればいい」**
> **「仮説ではなく実績から試算する」**

→ **再集計をしない。実績ベースのシミュレーションをする。**

| やること | やらないこと |
|---|---|
| ✅ APPから既存実績数字を引用 | ❌ APPと同じ集計をDBから再実行 |
| ✅ 「もし●●したらどうなる？」を実績から試算 | ❌ 既に表示されている数字の再計算 |
| ✅ 既存KPI実績を組み合わせて将来予測 | ❌ 別経路で同じ答えを出す |
| ✅ 過去実績 × 増車・撤退等の仮シナリオ = 試算 | ❌ 仮説や推測値を勝手に作り込む |
| ✅ APPに無い新ビューを作る前の検証 | ❌ APPで見られる値を再現する作業 |
| ✅ 経験則・業界平均ではなく自社実績を優先 | ❌ 「価格弾力性は一般的に○○%」などの一般論 |

### 実績ベース・シミュレーションの例
- **「Aクラス増車したら？」**:
  - APP車両ランキングのVEL粗利（実績）× 同等車両の累積実績パターン
  - 仮想の単価ではなく「VELの過去実績」をベースに2台目を試算
- **「料金値上げしたら？」**:
  - 過去に料金変更した時のシーズナルカレンダー実績比較
  - 仮定の価格弾力性ではなく「過去の値上げ実績による予約数変化」を使う
- **「特定車両を売却したら？」**:
  - 車両ランキングの該当車両 粗利実績 = 売却で失う金額
  - 売却額は実勢相場（中古市場実績）
- **「梅雨期間の需要対策は？」**:
  - シーズナルカレンダーの過去梅雨実績（売上・稼働率） vs 通常期実績
- **「人員1名削減したら？」**:
  - 給与タブの該当スタッフ実給与 = 削減コスト
  - シフトタブの該当時間帯の予約処理量 = 業務影響

### 仮説と実績の違い（重要）
| 仮説（NG） | 実績（OK） |
|---|---|
| 「価格弾力性 -0.5 と仮定すると...」 | 「2026-03に値上げした際、予約数は●%変動」 |
| 「業界平均稼働率は40%」 | 「VELの過去実績稼働率は43%」 |
| 「未経験スタッフは生産性70%」 | 「●●さんの試用期間中の処理件数は通常時の××%」 |
| 「梅雨は売上-20%程度」 | 「2026-06の実績は5月比で-XX%」 |

### 🚫 私が再計算してはいけないケース
- 「○○の付帯売上は？」「○○の稼働率は？」のような単純問い合わせ
- 既にAPPで表示されている値の問い合わせ
- → **回答: 「経営管理タブ → ●●で表示されています」と案内**

### 私が再計算してよいケース
1. APPに無いビューを作る前の検証
2. 過去データの不整合調査
3. 専用UIを実装する前のデータ仕様確認
4. オーナーが「APPの値が変なので確認して」と明示指示した時

### 2026-05-14 反省（KPI問い合わせの2連続ミス）
1. SPK車両ランキング作成時に同じ数字を3回違う方法で集計 → ブレた
2. NHA付帯売上問い合わせに、Supabaseから1846件全件取得→ローカル集計（数秒）
   - オーナー指摘「なんでそんなに計算遅いのか？どこから取るべき情報は？」「経営タブにあるのでは？」
3. 正解: 既存APPの「経営管理タブ → 解析タブ B」に既に表示されている
4. 教訓: **タブと階層は意図して設計されている。設計に従って取る**

### KPIマスター（handyman_kpi.py）の使い分け
- APPの値が出ない or 検証必要なとき → handyman_kpi.py
- APPに表示済みのKPI → APPを案内
- 仕様の正本 → ~/Desktop/HANDYMAN/kpi_master/HANDYMAN_KPI_MASTER.md

### APPに既にあるKPI（NHA/SPK共通）

#### NHA APP（https://nosh2318.github.io/naha-project/）
- **経営管理タブ → ダッシュボード**:
  - 💰 売上4分解（基本料金 / 付帯売上 / 予約外 / 割引 / 合計売上）
  - 月選択トグル（月/年）
  - チャネル別構成（月/年トグル）
  - 📈 年間推移テーブル（売上計上/予約外/合計/件数/客単価/平均泊数/泊単価/稼働率）
- **経営管理タブ → 解析タブ → B. 予約・売上**:
  - 💰 売上4分解（月別/年別）
  - OTA別売上構成比
  - 月別予約・売上テーブル
- **経営管理タブ → 解析タブ → A. 稼働率**
- **経営管理タブ → 解析タブ → D. 構成分析** (OTA別/場所/エリア/時間帯)
- **経営管理タブ → 解析タブ → E. 車両別P&L**
- **🏆 車両ランキング** (車両タブ隣・固定計算式)

#### SPK APP（https://nosh2318.github.io/spk-task/）
- 同じ構造（NHAをコピーした実装）
- v4.7.x 系で随時更新

### 私が再計算してよいケース
1. APPに無いビューを作る前の検証
2. 過去データの不整合調査
3. 専用UIを実装する前のデータ仕様確認
4. オーナーが「APPの値が変なので確認して」と明示指示した時

### 私が再計算してはいけないケース
- 「○○の付帯売上は？」「○○の稼働率は？」のような単純問い合わせ
- 既にAPPで表示されている値の問い合わせ
- → **回答: 「経営管理タブ → ●●で表示されています」と案内**

### 2026-05-14 反省
- 「NHA付帯売上の平均％」問い合わせに、Supabaseから1846件全件取得→ローカル集計（数秒）
- → オーナー指摘「なんでそんなに計算遅いのか？どこから取るべき情報は？」「経営タブにあるのでは？」
- 正解: NHA APP → 経営管理タブ → 解析タブ B「💰 売上4分解」を見ればその場で出る
- 教訓: **APPの計算式に揃えた数字がAPPに表示されているのに、別経路で再集計するのは無意味で遅い**

### KPIマスター（handyman_kpi.py）の使い分け
- APPの値が出ない or 検証必要なとき → handyman_kpi.py
- APPに表示済みのKPI → APPを案内
- 仕様の正本 → ~/Desktop/HANDYMAN/kpi_master/HANDYMAN_KPI_MASTER.md

---

## 🔴 修正対象ルール（絶対厳守・2026-05-17 確立）

**「動いているものを修正するな」**

1. 問題が報告された箇所**だけ**を修正する
2. 動いている箇所には**一切手を入れない**
3. 「NHAは動いている → NHAは触らない」は最低限のルール。それ以上に、**動いている機能・コードはすべて同様**
4. 修正前に「この箇所は今壊れているか？」を必ず確認する
5. 壊れていないなら → **触らない**

違反した場合：
- 動いていたものが壊れる
- 余計な作業が発生する
- オーナーの時間を無駄にする

---

## 🔴 完了報告ルール（絶対厳守）
- **「動作確認してから完了報告」** — コードを書いただけでは完了ではない
- 全経路トレース必須: 入力 → 保存 → 読込 → 表示 の全フローを追って矛盾がないことを確認
- 「コードは正しいはず」「ロジック上は動く」は報告にならない
- DBクエリ・コード静的解析・実データ確認のいずれかで裏付けを取ること
- 完了報告前に自分でバグを発見する努力をすること

---

## 🔴 コード提示ルール（絶対厳守）
- コードを渡すときは**チャットに貼り付け禁止**
- 必ず `pbcopy` でクリップボードに送るか、ファイルに書き出してパスを伝える
- 「この部分を書き換えて」「差分だけ」も禁止。常にファイル全体を渡す
- GAS・HTML・JSすべて同様

---

## 事業概要
レンタカーショップ HANDYMAN（株式会社Global Lines）
- 那覇空港店: 運用中
- 札幌店: 運用中
- 高松店: 立ち上げ中（HDM未掲載、市場調査のみ）

オーナー: 大下 典隆（Noritaka Oshita）
Google: noritaka.oshita@gmail.com（全プロジェクト共通）

## エージェント起動方法
```bash
claude --agent <エージェント名>
```

### エンジニアチーム
| エージェント | 用途 |
|-------------|------|
| tech-lead | 設計判断・タスク分解 |
| frontend-dev | UI実装（Single HTML React） |
| backend-dev | Supabase/GAS/API |
| app-maintainer | バグ修正・メンテ |
| new-dev | 新機能開発 |
| qa-tester | テスト |
| code-reviewer | レビュー |
| deployer | デプロイ |

### ビジネスチーム
| エージェント | 用途 |
|-------------|------|
| orchestrator | 全事業統括・振り分け |
| store-manager | 店舗実績・KPI |
| store-launcher | 新店舗立ち上げ |
| price-strategist | OTA価格調査・変更 |
| **pricing-system** | **BUDDICA TOURISMプライシングシステム 開発・検証・業務** |
| business-ops | 売上・損益・レポート |
| biz-creator | 新規事業 |

### サポートチーム
| エージェント | 用途 |
|-------------|------|
| admin-office | 領収書・請求書・事務 |
| content-writer | 文章作成・コピー |
| researcher | 調査・リサーチ |
| data-ops | データ集計・加工 |
| task-executor | 定型業務・自動化 |

---

## 技術スタック
- APP: Single HTML React + Supabase + Vercel
- GAS自動配車: 15分間隔（reserve@rent-handyman.jp）
- LINE自動送信: 3時間間隔（沖縄のみ）
- OTA価格調査: Chrome MCP + handyman-price スキル
- SNS自動投稿: GAS + Instagram Graph API + Slack連携

## リポジトリ
| プロジェクト | パス |
|-------------|------|
| 札幌店APP | ~/spk-task/ |
| 那覇店APP | ~/Downloads/naha-project/ |
| 車両損傷チェックAPP | ~/handyman-damage/ |
| LINE自動送信GAS | ~/handyman-line-auto/ |
| OTA GAS | ~/outputs/handyman-ota-gas/ |
| SNS自動投稿 | ~/Desktop/SNS/instagram_auto/ |

---

## 稼働中システム

### 1. OTA自動登録GAS（24/365）
- GAS URL: https://script.google.com/u/1/home/projects/1qz36XX367kzqL4orWMdQ5zl3KsTpQ73onN82k3HzYb7AtfoZsEuDtt6d/edit
- トリガー: `main` 30分ごと（稼働開始: 2026-03-17）
- 対象OTA: じゃらん/楽天/スカイチケット/エアトリ/レンタカードットコム
- Cloudflare Worker: `https://handyman-proxy.noritaka-oshita.workers.dev/api`（HANDYMAN API直接だと413）
- Gmail ラベル管理: OTA_登録済 / OTA_キャンセル済
- **GAS上のコードが正本**（ローカルは古い可能性あり）

### 2. SNS自動投稿（2026/4/1〜本番稼働）
- Instagram: @delivery_rentalcar_handyman
- Slack: #sns_google_運用全般 (C07SPEGQFL4)
- トリガー5つ: パトロール(30分)→画像割当(毎朝9時)→プレビュー(9:30)→投稿(15分)→通知
- 月16投稿（沖縄5+札幌5 vehicle、沖縄3+札幌3 サービス訴求）
- スプレッドシートID: 1Ta8wgYEAtk1Z8oTHpYwzDphJ6BkSuUzqjD-xRJKeYWE
- DriveフォルダID: 1dniao9qEd5J_1GVMkQkcIYFBYeOHhjoV

### 3. SPK業務管理APP（札幌店）
- Single HTML React（約4500行）
- 機能: CSV取込→自動配車→OPシート→配車タイムライン→車両管理→シフト→給与→駐車場→ダッシュボード
- Supabase: https://ckrxttbnawkclshczsia.supabase.co（札幌・那覇共通DB）
- パスコード: 2318
- 現在バージョン: v4.6.33 / sw.js: spk-v496
- 経営管理タブ: Excel 22シート完全移植 + SS↔APPパトロール機能
- パトロールSS: https://docs.google.com/spreadsheets/d/e/2PACX-1vQVK2mRkYMKG3cPtr5HSi9TWSS1JevKOvTmOusvXjoOZOEtW_KTX9oYXQld3FeK3Q/pub

### 4. 札幌GASメール取込（2026-04-06 修正済み）
- `-label:` フィルタ除去 → メッセージID管理（ScriptProperties）に移行
- INSERT失敗時のスキップ処理追加（OTA自動登録との競合対策）
- じゃらん入金確認: Slack文言依存 → Square Orders API直接確認に変更
- スプレッドシート自動連動: Squareリンク取得時/入金時/キャンセル時に支払い管理シートを自動更新
- SQUARE_API_TOKEN: GASスクリプトプロパティに登録済み
- subject判定: 全角/半角スペース正規化+スペース除去二重チェック（2026-04-06追加）
- **SUPABASE_KEY修正**: プレースホルダーのまま → 正しいservice_roleキーに更新（2026-04-06。これがDB登録失敗の根本原因だった）
- **setupProperties()のコード内キーも正しい値に書き換えること**（誤実行でプレースホルダー上書き防止）
- **Slack予約登録機能（2026-04-20追加）**: `#sapporo_reservation` (C08TDTPEB36) にフォーマット投稿→予約登録+自動配車+スレッド返信。5分間隔トリガー。`processSlackReservations`。クラスバリデーション: A/B/C/S/F/H
- **入金通知チャンネル分離（2026-04-20追加）**: `checkPaymentStatus`の通知先をスプシC列（利用店舗）で振り分け。那覇/沖縄→`#payment_naha` (C0AP2S5B147)、それ以外→`#payment_sapporo` (既存JALAN_PAY_CHANNEL)。**那覇の入金通知が札幌に飛ぶのは絶対禁止**

### 5. OTA自動登録GAS（2026-04-06 修正済み）
- skyticket送信元: `rentacar@skyticket.com` 追加（旧`skyticket-rentalcar@adventure-inc.co.jp`も併存）
- `-label:` フィルタ除去 → `newer_than:2d` + メッセージID管理に変更
- subject検索: `新規予約` 追加（skyticket対応）
- 全メッセージループ処理（スレッド先頭のみ→全メッセージ）

### 6. HANDYMAN Payment GAS（2026-04-08 v2.6 修正済み）
- **役割**: Slack→Squareリンク発行・スプシ記録・Supabase会計起票
- **分離アーキ**: Square入金Webhook は **札幌予約メール自動配車GAS** がポーリングで受けてスプシを更新する（HANDYMAN Paymentのdoit Webhookは**来ない**）。そのため HANDYMAN Payment 側では `syncPaidToAccounting` を5分毎トリガーで動かし、スプシの ✅入金済み 行 → Supabase paid=true を同期する
- **SPREADSHEET_ID**: `1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc`（HANDYMAN 支払い管理）
- **シート列構造**: `#/発行日/利用店舗/予約番号/宛名/品目/金額/URL/ステータス/入金日/OrderID/Slack TS/Channel/媒体`（区分列なし・媒体列あり）
- **ステータス文字列**: `⏳ 未払い` / `✅ 入金済み`（絵文字付き）。コード側で `indexOf('済') === -1` 等の絵文字非依存判定をすること
- **主要関数**:
  - `createTestPaymentLink()`: ¥100テストリンク発行（手動実行）
  - `syncPaidToAccounting()`: 5分毎トリガー、直近2h以内の入金日の行を処理、**未→済遷移時にSlack通知**
  - `notifyPaidToSlack_(row)`: Slack TS/Channel有効ならスレッド返信、無効なら#paymentに新規投稿
  - `markAccountingPaid_(orderId, resvNo, storeName)`: OrderID→resv_no二段フォールバック、行数ベース成功判定
  - `sbPatch_`: `Prefer: return=representation` でレスポンス配列長を返す（HTTP200だけで成功と誤判定しない）
  - `forceSyncAllPaidRecords()`: 過去分一括同期（Slack通知省略）
  - `testSlackNotification()`: 最新済行で通知単体テスト
  - `debugWebhookPath()`, `diagnoseResvLookup()`: 診断
- **旧バグ履歴**:
  - v2.1以前: `sbPatch_` が HTTP200 = 成功と誤判定 → paid更新されないのにSlackには成功通知
  - v2.1以前: 支払い管理シートに区分列があると誤認 → 列番号ズレで全件スキップ
  - v1時代: Square Webhookが来る想定だったが実際は別GASが処理 → Supabase未連動が長期放置
- **恒久ルール**: 
  - **スプシ列構造変更禁止**（コード側の `COL` 定数と連動している）
  - **Supabase側で `paid=true` 済の行は `paid=eq.false` フィルタで自動スキップされる** → markAccountingPaid_の冪等性は担保済
  - **旧データの memo空行は resv_no フォールバックで救済される** → 手動登録との共存OK
- **未解決の軽微な残件**: GAD40403 / PEB11304 / R0R8QVZR は Supabase会計に行が存在しない（過去の起票失敗残骸）。APP上で「済」表示になっているなら業務影響なし

### 8. 問い合わせ管理APP & GAS（2026-04-09〜）
- **APP URL**: https://handyman-inquiry.vercel.app/
- **APP ソース**: `~/Desktop/HANDYMAN/inquiry_system/inquiry_manager.html`
- **デプロイ**: `~/Desktop/HANDYMAN/inquiry_deploy/index.html` → Vercel自動デプロイ
- **GAS名**: HANDYMAN 問い合わせ管理
- **GAS ID**: `1gN5l9RFo_bObZbN45e_XwdOp80wF0agKzORYsbrvsn2uCBr_dv_82ohx`
- **GAS URL**: https://script.google.com/home/projects/1gN5l9RFo_bObZbN45e_XwdOp80wF0agKzORYsbrvsn2uCBr_dv_82ohx/edit
- **GASローカル**: `~/Desktop/HANDYMAN/inquiry_system/gas_inquiry_manager.gs`
- **DB**: Supabase `inquiries` テーブル（札幌・那覇と同じSupabaseプロジェクト）
- **トリガー**: `runImport` 15分おき / `checkUnrepliedAlert` 30分おき
- **Gmail対象**: `reserve@rent-handyman.jp` 宛メール（`newer_than:2d`）
- **処理済み管理**: メッセージID方式（`INQUIRY_LIVE_MSG_IDS` ScriptProperties、3000件上限）
- **機能**:
  - メール自動取込（お客様からの問い合わせのみ）
  - Web App経由で返信送信（`reserve@` から送信、Gmail API使用）
  - 未対応2時間超アラート → Slack `#okinawa_operations-team`
  - ブロック済みドメイン管理（`blocked_senders` テーブル）
- **EXCLUDE_SENDERS**: OTA送信元のみ除外。**🔴 `noreply@rent-handyman.jp` は絶対に入れない**（HPお問い合わせフォームの送信元。2026-04-21障害で判明）
- **EXCLUDE_SUBJECTS**: システム自動通知のみ除外（`入金確認`/`支払い`/`自動返信`等）
  - ★ `キャンセル`/`予約変更`等のお客様が使う語句は除外しない（2026-04-13修正）
  - ★ OTA通知は`EXCLUDE_SENDERS`で除外済みなので`EXCLUDE_SUBJECTS`には入れない
- **デバッグ**: `debugImport` を手動実行 → 全メールのスキップ理由がログに出る
- **主要関数**: `runImport`(定期取込) / `debugImport`(デバッグ) / `setupTriggers`(トリガー設定) / `clearProcessedIds`(ID初期化) / `checkProperties`(設定確認)
- **障害履歴**:
  - 2026-04-13: `EXCLUDE_SENDERS`の`'noreply'`が広すぎて全noreplyアドレス除外 → `'noreply@rent-handyman.jp'`に具体化。`EXCLUDE_SUBJECTS`の`'キャンセル'`がお客様問い合わせを除外 → 削除

### 7. 立替金3日未回収アラート GAS（2026-04-08 新規）
- **実装箇所**: 那覇店 予約取込 GAS（Code.gs末尾）
- **関数**: `checkUnpaidAdvances()`
- **トリガー**: 日次（毎朝9〜10時）
- **動作**: `nha_accounting` から `type='advance' & paid=false` を取得し、`date` が3日以上前のものを `SLACK_EMAIL_OPS` (`#okinawa_operations-team`) にメール送信
- **通知文**: 「🚨 立替金未回収 N件 ... 回収せよ」形式、件数・合計金額・行ごとに日数経過・担当・予約番号・発行URL
- **Slack宛先メールアドレス定数**:
  - `SLACK_EMAIL_RESV = 'rent_car_notifaction-aaaamey56wdscatbyavjfrhyw4@gl-oke5175.slack.com'` (#okinawa_reservation_notification)
  - `SLACK_EMAIL_OPS  = 'okinawa_operations-te-aaaamflljqqgaubhqstvolxnii@gl-oke5175.slack.com'` (#okinawa_operations-team)
- コミット: `8067401` (feat: 立替金 未回収アラート)

### 10. 領収書Bot（2026-04-23 修復）
- **Slack チャンネル**: `#領収書` (`C0ANTF5EE73`)
- **実体GAS**: **HANDYMAN Payment Bot v1**（Script ID: `1bZcVSWRvxC1U4MDkIztcsFV8CWv9paFYoxU0oRStgAmZ57Y87lKC6sCU`）
  - ⚠️ 「HANDYMAN 領収書Bot」という別GASプロジェクトがあるが、Slack Event Subscriptions に登録されているURLは Payment Bot v1 のもの
  - 「領収書Bot」GASのURLをSlackに登録しようとすると「Valid URLs only」で弾かれる（別プロジェクトのため）
- **デプロイ**: `AKfycbwTzr2Z...`（v5）← このURLがSlack Event Subscriptions に登録済み。変更禁止
- **テンプレートスプレッドシート**: `1BsG1ylCcXLtKHbv1GFleoUGJrIACfxhCBlz52mCJyuM`（HANDYMAN 領収書）
  - シート名: `template`（領収書テンプレート）/ `counter`（領収書番号採番）
- **処理フロー**: `領収書` キーワード → `handleReceiptMessage_` → `generateReceiptPDF_` → Slack アップロード
- **Slack メッセージ形式**:
  ```
  領収書
  宛名：〇〇株式会社
  予約番号：XXXXX（任意）
  金額：25250
  利用日：4月9日-4月13日
  ```
- **障害履歴（2026-04-23）**:
  - 根本原因①: Payment Bot v1 に領収書処理コードが存在しなかった → 関数群を追加
  - 根本原因②: Drive スコープが manifest 未宣言 → `oauthScopes` に `https://www.googleapis.com/auth/drive` 追加
  - 修正後に GAS エディタから `checkConfig` を実行して Drive 権限を再認可して復旧

### 9. 車両損傷チェックAPP（2026-04〜）
- **APP URL**: https://nosh2318.github.io/handyman-damage/
- **ソース**: `~/handyman-damage/index.html`（Single HTML, 約3,573行）
- **リポジトリ**: `nosh2318/handyman-damage` → GitHub Pages 自動デプロイ
- **ローカルパス**: `~/handyman-damage/`
- **DB**: Supabase（札幌・那覇と同一プロジェクト）— `vehicle_twins` + `check_events` テーブル
- **構成**: index.html + manifest.json + sw.js + schema.sql + setup.sql（PWA対応）
- **機能**: 車両損傷チェック / 初期登録 / 貸出チェック / 返却チェック / チェーン履歴 / 修理管理 / 店舗切替（札幌・那覇）/ スタッフログイン / Realtime同期
- **車両クラス（札幌）**: LUX（高級ミニバン）, MPV（ミニバン）, SUV, CSUV（コンパクトSUV）, SDN（セダン）, CPT（コンパクト）
- **車両データ**: 札幌=`vehicles`テーブル（SPK管理APPと共有）、那覇=`nha_cars`テーブル → `vehicle_twins`とJOINしてダメージ状態を統合
- **バージョン**: v2.6.1
- **デプロイ**: `git push origin main` → GitHub Pages 自動反映
- **pre-pushフック**: JS構文チェック（node --check）をプッシュ前に自動実行
- **グローバルエラーハンドラ**: window.onerror で赤バナー表示+再読み込みボタン（白画面防止）
- **現状**: 札幌14台中12台が初期登録待ち

### 入金確認システム v4（2026-04-21 書き直し）
- **v3の致命バグ**: URL照合が唯一の手段、不一致時サイレントスキップ（Slack通知なし）→ R0IPN7SD/IEI40399の入金見逃し
- **v4の5つの修正**:
  1. `createSquarePaymentLink_` → `{url, orderId}`を返す（order_idを保存）
  2. `appendToPaymentSheet_` → Col KにOrderID保存
  3. `checkPaymentStatus` v4: 5フェーズ（Direct order_id → URL照合 → batch retrieve → 入金判定 → URL不一致アラート）
  4. `normalizeSquareUrl_`: ゼロ幅文字・NBSP・クエリパラメータ除去追加
  5. `backfillOrderIds()`: 既存未払い行のOrderID一括補完
- **関数**: `fetchPaymentLinkMap_` / `batchRetrieveOrders_` / `isOrderPaid_` / `debugPaymentV4` / `backfillOrderIds`
- **GASコード**: `gas-email-import-v3-full.gs`（2207行、GASエディタに貼り付け済み）

### APP UI重複解消（2026-04-21）
- **問題**: Square請求書ウィジェット（spk_accounting）とじゃらん事前決済（jalan_payments）に同じ予約が表示されていた
- **修正**: Squareウィジェットでjalan_paymentsの予約番号を取得→spk_accountingの結果から除外
- **タイトル変更**: 「Square請求書（札幌店）」→「Square請求書（立替・予約外売上）」
- **3店舗同時適用**: SPK v4.6.33 / NHA v3.2.46-NHA / TKM v1.0.1-TKM

---

## 絶対ルール（過去のインシデントから）

### 🔴 最重大: ユーザー入力データは絶対保全（2026-05-11 確立）
**「データ削除/上書きする処理は、ユーザー入力データの保全を最優先する」**

#### 背景・経緯
- 2026-05-11 NHA担当消失バグ: `cleanupDuplicateTasksNha` (GAS日次2時) の重複削除ソートが「優先度→sort_order大」だけで判定 → スタッフが入力した「担当」フィールドが消失（5/11-13で多数）
- 2026-05-10 SP-20260507-0004/0005 誤キャンセル: APP CXLボタンが `window.confirm` 1段階のみ → スマホ誤タップで予約キャンセル
- 過去の DB UNIQUE INDEX 撤去 (v3.5.13): 担当振り分けINSERT失敗で消える事象も同根

#### 絶対ルール
1. **削除・上書き処理（クリーンアップ/パトロール/バックフィル/再パース系）を実装する時は、必ず次を確認**:
   - ユーザーが手動入力したフィールド（担当・visit_type/return_type の PU/BD/来店/返却・del_place/col_place・base_price/option_price・customer_email 等）が削除/上書き対象に含まれるか
   - **含まれるなら「ユーザー入力あり優先」のソート or 保護条件を必ず追加**
2. **ソートロジックの優先順位は2軸ある**:
   - **データ保全優先度**（=絶対先頭）: ユーザー入力データを持つ行を最優先で残す
   - **表示優先度**（=その下）: 業務的な表示順（PUB>DEL>PU>来店 等）
   - この順序を逆にすると災害（今回の担当消失）
3. **重要操作（cancel/delete/物理削除）には2段階確認必須**:
   - `window.confirm`（要約表示）→ `window.prompt`（予約番号等の文字列入力で完全一致確認）
   - 物理削除と論理削除（cancel）で確認段階を非対称にしない
4. **クリーンアップ/パトロール/バックフィル系を新規実装する時、必ずDryRunを先に実装し、影響件数とサンプルをログに出す**:
   - DryRunで「ユーザー入力データ◯件が削除対象」と検出されたら設計をやり直す
5. **両店（NHA/SPK）の独自実装が積み重なるとバグの温床。新機能は両店共通仕様で実装、独自仕様は明示的に分離する**

#### 違反した時の代表的バグ
- 担当消失 (cleanupDuplicateTasksNha) / 場所消失 (backfillVisitReturnType) / 価格消失 (saveSalesEdit base_priceのみ更新) / 誤キャンセル (CXL 1段階確認)

---

### 🔴 「自動修復系GAS」は対症療法。原則として作らない（2026-05-11 確立）
**「データ不整合の自動修復」関数は本質的に対症療法であり、運用するほど真因を見失う**

#### 経緯
- `nightlyOptsPatrolNha` (毎晩2:30) を「再発防止」として2026-04-30 に追加
- 実態: **エラー率83%で機能していない**（GAS 6分タイムアウトでN+1クエリが死ぬ）
- 動いていても価値が出ていない（Slack通知が来てもスタッフ対応なし）
- 2026-05-11 オーナー判断で **トリガー削除**（関数自体は残し、必要時のみ手動実行）

#### 絶対ルール
1. **「データ不整合の自動修復」関数を新規実装しない**。代わりに：
   - **書き込み側のロジックを正す**（APP保存処理・GAS取込パーサー側）
   - 「整合性が壊れないアーキテクチャ」を作る
2. **既存の自動修復系GASは原則停止対象**。手動実行に切り替え
3. **再発防止策として「対症療法 + 監視」を提案するときは、必ず「根本対策」も並列で提示する**
4. **エラー率10%超のGAS関数は機能していないと判断、即停止する**（虚偽の安心を生む）

#### 違反したらやめる
- 担当消失バグの対症療法として cleanupDuplicateTasksNha を作った（v3.5.24 で改善したが、根本は APP DB.upsertTasks の `_id` ベース UPSERT問題）
- 本来は APP の upsert ロジックを `(date, 予約番号, カテゴリ)` UNIQUE で UPSERT すべき

---

### 🔴 最重大: 本番を壊すデプロイ禁止
- 変数削除・リネーム前に必ずGrep全体検索
- デプロイ前にブラウザコンソールでエラー確認
- **SRI/CSPはSWのCDNキャッシュと干渉する（2026-04-02障害）。再導入時はSW改修が先**
- **index.html / sw.js / app.js のバージョン番号は3箇所同時更新必須**
- 白画面になったら即revert

### 🔴 HDM「掲載なし」誤報告の禁止
- 全ページ確認してから判定。部分データでレポート作成禁止
- 判定ロジック厳守（上記HANDYMAN判定ロジック参照）

### 🔴 推測で何度も修正しない
- DB問題は`sb.from("table").select("*").limit(1)`で実構造を確認してから修正
- 推測修正は最大1回。直らなければ実環境を確認

### 🔴 予約処理順序
- 古い順から1件ずつ。同時処理・並列処理禁止
- キャンセル→再予約の順序を守る（順序崩れるとデータ不整合）

### 🔴 GAS Heartbeat 早期return アンチパターン禁止（2026-05-02 確立）
- **症状**: monitor 画面で「⚠️ 要対応 — システム停止」赤バナーが偽陽性で出る（実際はGASが正常稼働中）
- **真因**: GAS関数が「対象0件」「設定未取得」「APIエラー」等で**早期 return → heartbeat 未更新**
- **絶対ルール**:
  1. **新規GAS関数で `updateHeartbeat_()` または `hbWrite_()` を使う場合、必ず関数の冒頭または各早期return直前に更新を入れる**
  2. **try-finally でラップするのが最も堅牢**（`processNewEmails` で採用）
  3. **関数末尾にしかheartbeat更新が無い実装は全部バグ**。コードレビューで必ず弾く
- **既知の正しい実装パターン**:
  ```js
  // パターン1: try-finally（推奨）
  function processX_() {
    var stats = {success:0, failure:0};
    try { /* 本体 */ } catch(e) { /* error */ } finally {
      updateHeartbeat_('xxx', stats);
    }
  }
  // パターン2: 各早期return前
  if (!rows || rows.length === 0) { updateHeartbeat_('xxx', {success:0, processed:0}); return; }
  ```
- **修正実績（2026-05-02）**: 5関数 / 14箇所
  - `gas-email-import-v2.gs`: processNewEmails / checkSquareLinks / checkPaymentStatus / processSlackReservations
  - `gas-square-terminal-spk.gs`: importSquareTerminalPaymentsSpk
  - `instagram_auto_post_v5.gs`: patrolSlackImages
- **重要**: heartbeat の偽陽性は「monitor が嘘をつく」状態。**虚偽の停止アラートを発するシステムは虚偽の正常アラートも発する**。同じくらい厳格に扱う

### 🔴 GitHub Pages サブパス対応 sw.js ルール（2026-05-02 確立）
- **本番URL構造**: NHA / SPK 両方とも `https://nosh2318.github.io/{repo}/` のサブパス配下
- **絶対ルール**:
  1. **sw.js の `URLS` は必ず相対パス（`./` プレフィックス）**: `['./', './index.html', './index2.html', './app.js']`
     - 絶対パス `/index.html` は GH Pages サブパスで 404
  2. **fetch handler の同一オリジン判定は `pathname.endsWith('...')` で書く**
     - `pathname === '/'` や `pathname === '/app.js'` はサブパスで合致しない
  3. **SW 登録は `'./sw.js?v=NNN'`**（相対）。scope は自動で SW 所在ディレクトリになる
  4. **HTML 内の他ファイルリンクも相対パス**（`license.html` / `cancellation-manual.html` 等）。`/license.html` のような絶対パスは使わない
- **検証方法**: `curl -sI https://nosh2318.github.io/{repo}/sw.js` → HTTP 200 確認 + 中身が新CACHE_NAME になっているか
- **横展開**: NHA も同方式で稼働中。新店舗（高松等）も同パターンで構築すること

### 🔴 GAS Gmail検索でラベル除外フィルタ禁止
- **`-label:xxx` をGmail検索クエリに入れてはいけない**（2026-04-04障害）
- GmailAppはスレッド単位検索のため、ラベル済みスレッドの後続メール（キャンセル等）が永久に見えなくなる
- 処理済み管理は**メッセージID単位**（PropertiesService）で行う
- ラベルはGmail上の視覚目印としてのみ使用
- GASコード変更時はローカル(`gas/Code.gs`)とGASエディタを**必ず両方同時更新**

### 🔴 HP（オフィシャル）予約は車種指定
- **HP予約は「クラス指定」ではなく「車種指定」**（2026-04-04障害で判明）
- クラス判定は2段階: **Tier1（車種名）を先にチェック** → Tier2（クラス名）はTier1不一致時のみ
- 車種マッチは `isModelMatch_()` で厳密判定（「プリウス」が「プリウスα」にマッチしない）
- `extractModelName_()` でメールからクラス名を除去し車種名を抽出

### 🔴 PU/BD方向
- **PU = 空港出発（空港→ヤード）= 緑色**
- **BD = ヤード出発（ヤード→空港）= 赤色**
- 絶対に逆にしない

### 🔴 配車ルール
- メンテナンス（青帯）・別予約（赤帯）があるラインに絶対配車しない
- 空車なし → アラート「配車できる空車がありません」
- OTA A/A2 → HANDYMAN H（アルファード）に変換

### 🔴 クロスデバイス同期
- 同期データは実DBカラムに保存（changed_jsonに頼らない）
- PC/スマホ連動テスト必須

### 🔴 OTA予約 people 最大8人 絶対ルール（2026-04-29 確立）
- レンタカーの乗車人数は **最大8人**。9人以上は CSV/メールパース不正としてクランプ
- **全層で防御**:
  1. **APP CSVパーサー**: `clampPeople(raw, ota, id)` ヘルパーで全OTA共通処理 → 8超は console.warn + window._peopleClampLog 記録
  2. **GAS メールパーサー**: 各 parser_ 関数の people 計算後に `if (people > 8) people = 8;`
  3. **DB CHECK制約**: `ALTER TABLE nha_reservations ADD CONSTRAINT chk_people_max CHECK (people IS NULL OR people BETWEEN 0 AND 8);`（推奨・要適用）
- **絶対やってはいけない**: `people: +(g("乗車人数")||0)` のような上限なしパース
- **障害履歴**: 楽天 R0J7YIGY (人数20) / R0EQJU0V (人数14) → 客側CSVの異常値 or 列ズレで侵入。修正用SQL: `UPDATE nha_reservations SET people=8 WHERE people>8;`
- **新規パーサー追加時**: people 計算したら必ず最大8でクランプ。コードレビューで `Math.min(8` または `clampPeople` 必須

### 🔴 OTAパーサーのオプション検出
- **全OTAパーサーでチャイルドシート/ベビーシート/ジュニアシートを必ずパースすること**
- 新OTA追加時・パーサー修正時にopt_b/opt_c/opt_jの返却を確認
- じゃらん: `オプション：`行から `チャイルドシートx数` を検出（2026-04-04修正: 以前は完全欠落）
- 楽天: `・オプション/車両の特徴`行から検出
- スカイチケット/エアトリ: body全体から検出

### 🔴 じゃらん決済とスプレッドシート連動
- Square請求書ウィジェットはGoogleスプレッドシート（支払い管理シート）をCSV取得して表示
- `checkSquareLinks()` でリンク取得時に `appendToPaymentSheet_()` で自動書き込み
- AIスタッフ_G障害で手動Square作成した場合はスプレッドシートに手動追加が必要

### 🔴 HANDYMAN Payment と 札幌予約メール自動配車 は役割分離（2026-04-08 確定）
- **Square入金Webhookは HANDYMAN Payment には届かない**。実際に Square Orders API をポーリングしてスプシ `HANDYMAN 支払い管理` を更新しているのは **札幌予約メール自動配車GAS**
- HANDYMAN Payment 側は `syncPaidToAccounting` 5分毎トリガーで **スプシ→Supabase会計** を非同期反映する
- **調査のときは真っ先に GAS の「実行数」画面を見ること**。doPostが走ってなければ Webhook自体が来てないと30秒で分かる。デプロイ変更やコード修正を先に走らせてはいけない
- **スプシ列構造変更は禁止**。v2.5の `COL` 定数が参照している（`NO=1, DATE=2, STORE=3, RESV=4, NAME=5, ITEM=6, AMOUNT=7, URL=8, STATUS=9, PAID_DATE=10, ORDER_ID=11, SLACK_TS=12, CHANNEL=13, MEDIA=14`）
- **新機能追加と同時にトリガー設定まで1セットで完了させる**。関数だけ追加してトリガー忘れは「動かない機能」を作ったのと同義
- **GAS Web App のデプロイとコード保存は別物**。Cmd+S はエディタに保存するだけで、Webhookが叩くのは「最後にデプロイされたバージョン」。トリガー実行・手動実行ボタンは最新コードが動くので、挙動差で混乱する
- **PostgREST PATCHは `Prefer: return=representation` を付けてレスポンス配列長で成功判定**（HTTP200だけで成功と判定すると0件更新を見逃す）

### 🔴 予約登録フォーム固定値
| フィールド | 値 |
|---|---|
| 都道府県 | 常に北海道 |
| 生年月日 | 1990/01/01 |
| Email | ota@rent-handyman.jp（GASはota-reserve@rent-handyman.jp） |
| 電話番号 | 00000000000 |
| オプション/デリバリー/送迎/料金 | 全て触らない |

---

## アカウント・API情報

### Supabase
- URL: https://ckrxttbnawkclshczsia.supabase.co
- 札幌・那覇共通DB

### Slack
- Bot Token: <REDACTED_FOR_PUBLIC_REPO__see_~/.claude/CLAUDE.md_on_owner_PC>
- #sns_google_運用全般: C07SPEGQFL4
- #okinawa_operations-team: C06L91W6T08
- #okinawa_reservation_notification: C06KZ56NTDF（那覇Slack予約登録チャンネル）
- #sapporo_reservation: C08TDTPEB36（札幌Slack予約登録チャンネル）
- #payment_naha: C0AP2S5B147（那覇入金通知）
- #payment_sapporo: 既存JALAN_PAY_CHANNEL

### Google Cloud
- Maps API Key: <REDACTED_FOR_PUBLIC_REPO>（プロジェクト: handyman-491221）

### Instagram (Meta Graph API)
- アカウント: @delivery_rentalcar_handyman
- IG_USER_ID: 17841475734163026
- GRAPH_API_VERSION: v25.0

### X (Twitter) — 現在401エラー中（Pay-Per-Use Standalone Appバグ、X側対応待ち）
- @HANDYMAN1298882
- OAuth 1.0a API Key: <REDACTED_FOR_PUBLIC_REPO>

### GASプロジェクト一覧（全10個）
| プロジェクト名 | 用途 |
|---------------|------|
| 札幌予約メール自動配車 | reserve@のメール取込・自動配車・じゃらん決済 |
| HANDYMAN OTA自動登録 | 5OTA予約自動登録（30分間隔） |
| Instagram自動投稿 v5 | SNS自動投稿パイプライン |
| 那覇店 予約取込 | 那覇店のメール取込 GoGoOut対応済（GAS ID: 1Z1Vb6BzZAdzB_ZEvcR66K0h1W8zG-hirGJPLOj7RvubblYyYLPjxuLsX） |
| HANDYMAN 領収書Bot | **実体は Payment Bot v1**（Script ID: 1bZcVSWRvxC1U4MDkIztcsFV8CWv9paFYoxU0oRStgAmZ57Y87lKC6sCU）に領収書関数を追加済み。Slack登録URL: AKfycbwTzr2Z... |
| HANDYMAN Payment | 決済関連（AIスタッフ_G?） |
| HANDYMAN朝サマリー | 朝のサマリー通知 |
| HANDYMAN交通情報 | 交通情報通知 |
| HANDYMAN自動返信メール | 自動返信 |
| HANDYMAN 問い合わせ管理 | 問い合わせメール取込・返信・未対応アラート（GAS ID: 1gN5l9RFo_bObZbN45e_XwdOp80wF0agKzORYsbrvsn2uCBr_dv_82ohx） |
| 無題のプロジェクト | 不明 |

### ルール
- 新規GASはすべて noritaka.oshita@gmail.com で作成
- APIキーはGASスクリプトプロパティで管理（ハードコード禁止）

---

## 🔗 APP URL一覧（2026-05-02 確定版）

**Vercel は全廃止。全サービスを GitHub Pages に移行済み。**

| サービス | URL | リポジトリ |
|---------|-----|----------|
| 那覇店 管理APP | https://nosh2318.github.io/naha-project/ | nosh2318/naha-project |
| 札幌店 管理APP | https://nosh2318.github.io/spk-task/ | nosh2318/spk-task |
| 傷チェックAPP | https://nosh2318.github.io/handyman-damage/ | nosh2318/handyman-damage |
| Car Delivery UI | https://nosh2318.github.io/hdm-car-delivery/ | nosh2318/hdm-car-delivery |
| 問い合わせAPP | https://handyman-inquiry.vercel.app/ | （Vercel継続） |
| 高松APP | https://tkm-task.vercel.app/ | （Vercel継続） |
| 監視ダッシュボード | https://nosh2318.github.io/naha-project/monitor | 同上 |
| コスト計算 | https://nosh2318.github.io/naha-project/costmatrix.html | 同上 |
| バス時刻表 | https://nosh2318.github.io/naha-project/bus.html | 同上 |

### 廃止済み旧URL（使用禁止）
- ~~https://handyman-fleet.vercel.app/~~ → nosh2318.github.io/naha-project/
- ~~https://spk-task.vercel.app/~~ → nosh2318.github.io/spk-task/
- ~~https://hdm-car-delivery.vercel.app/~~ → nosh2318.github.io/hdm-car-delivery/

### GAS heartbeat バグ修正（2026-05-02）
- **原因**: `processNewEmails` でメール0件時に早期return → heartbeat未更新 → 監視画面で「停止」誤検知
- **修正**: NHA Code.gs / SPK gas-email-import-v2.gs / SNS instagram_auto_post_v5.gs を try-finally 構造に変更
- **確認方法**: https://nosh2318.github.io/naha-project/monitor で全グリーンを確認

---

## 作業後の更新ルール
**毎回の作業終了時に、この CLAUDE.md を最新状態に更新すること。**
再起動時にこのファイルだけで全コンテキストを復元できる状態を維持する。

---

## 作業後の更新ルール
**毎回の作業終了時に、この CLAUDE.md を最新状態に更新すること。**
再起動時にこのファイルだけで全コンテキストを復元できる状態を維持する。

---



## 📚 詳細ナレッジ（必要時に専門エージェントが参照）

- 🚨 HANDYMAN 障害履歴・再発防止の正本 → `~/.claude/knowledge/incidents.md`
- 🏝 NHA 那覇 実装詳細 → `~/.claude/knowledge/nha.md`
- ❄️ SPK 札幌 実装詳細 → `~/.claude/knowledge/spk.md`
- 🚐 BUDDICA TOURING 高松 実装詳細 → `~/.claude/knowledge/bt.md`
- 💰 価格戦略・OTA調査・プライシングルール → `~/.claude/knowledge/pricing.md`
- 🤖 GAS / Supabase 運用詳細 → `~/.claude/knowledge/gas.md`
- 🛠 分析・経営ツール（forecast/planner/monthly/expenditure等） → `~/.claude/knowledge/tools.md`
- 📣 HANDYMAN SNSマシン → `~/.claude/knowledge/sns.md`
- 🌍 OMNI Bot 構築記録（メタ） → `~/.claude/knowledge/omni_build.md`
