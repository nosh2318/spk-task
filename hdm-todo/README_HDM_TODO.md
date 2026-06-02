# HDM ToDo — 那覇店・札幌店 業務管理アプリ（開発記録）

最終更新: 2026-06-02 / 現行バージョン **v1.8.0**

## 0. 概要
HANDYMAN の店舗業務（タスク・目標・スタッフ・評価）を管理する単一HTML Reactアプリ。
ASANA調・スマホファースト・スケジュール起点。2店舗（那覇店/札幌店）を1アプリで独立管理。

- **公開URL（スタッフ共有）**: https://nosh2318.github.io/spk-task/hdm-todo/
- **ソース（正本）**: `~/hdm-todo/index.html`（単一HTML・React18 UMD + Babel standalone・依存ゼロ）
- **デプロイ先**: `nosh2318/spk-task` リポジトリの `hdm-todo/` サブフォルダ（GitHub Pages）
- **共有同期**: Supabase `ckrxttbnawkclshczsia`・専用テーブル `hdm_todo`（anon read/write）

## 1. 起動フロー
1. アプリを開く → **TOP（店舗選択ランディング）**: 🏖那覇店 / ❄️札幌店 をカード選択（各店のタスク/完了/超過件数を表示）
2. 選択 → その店舗の **担当領域（areas）画面** に入店
3. 入店後は店舗切替ピルは出さない。**「← 店舗選択に戻る」**（サイドバー）/**「← 店舗選択」**（トップバー）でTOPへ戻り再選択

## 2. タブ構成（入店後）
`タスク一覧`(初期/ボード既定) / `担当領域` / `タイムライン` / `ダッシュボード` / `AI管理` / `成果ログ` / `スタッフ` / `目標設定`
- 下部ナビ(モバイル): 一覧・担当領域・予定(タイムライン)・ダッシュ・メニュー(⋯)

## 3. データモデル（クラウド1ドキュメント）
```
doc = {
  store: "naha" | "sapporo",         // 選択中の店舗
  migrations: { sapporoReset_v1:true },
  stores: {
    naha:    { me, staff[], goals, tasks[] },
    sapporo: { me, staff[], goals, tasks[] },   // 各店独立・同一仕様
  }
}
task = { id, parentId, title, area, assignee, start, due, priority, status,
         progress, completedAt, description, logs[], attachments[], adminConfirmed, createdAt }
goals = { annual, month, months:{ "YYYY-MM":{target,note} } }
staff = { name, role:"管理者"|"現場", color, admin }
```
- **階層**: 担当領域(AREA) → 親タスク(parentId=null) → 子タスク(parentId) … 深さ無制限。親の進捗は子から自動ロールアップ(`effProgress`)。
- **担当領域(AREAS・5種)**: 📞カスタマー対応 / 🚗車両整備・管理 / 🌿環境整備・管理 / 💾情報管理 / 🚀事業推進
- **担当者(既定3名)**: 齊藤(管理者)・伊江さん・廣瀬さん（スタッフタブで追加/編集/削除可。リネーム→タスク担当も付替、削除→「全員」に付替）

## 4. 主な機能
- **タスク一覧**: 既定=ボード。検索・領域/担当/ステータス絞り込み。リスト⇄ボード切替。
  - **ボードDnD**: カードを別列にドラッグ＝ステータス変更。「完了」列で進捗100%+完了日記録、完了以外へ戻すと完了日クリア。タップで詳細。
- **担当領域(ツリー)**: 領域→親→子の折りたたみ。「＋」子タスク追加・各領域「＋親タスク追加」。
- **タイムライン**: スケジュール起点（担当行をドラッグ/タップで期間タスク作成）。**1人複数タスクをレーン分割で全件可視化**（重なりゼロ・「N件·M段」表示）。色=領域。末端タスクのみ表示。
- **ダッシュボード**: 今月目標バー / KPI4枚(タスク総数・完了・5日以内・超過) / **🎯目標達成評価**(対象月の達成率+月別目標と達成のバー一覧) / 🗂領域別進捗 / ステータス内訳ドーナツ / **🏆チーム評価** / **👤個人評価** / 今週の山。
- **個人評価**: 末端タスク基準。総合スコア=達成率×0.40+納期確約率×0.30+平均進捗×0.20+ログ活動度×0.10−(期限超過1件×8)。グレードS≥85/A≥70/B≥50/C≥30/D。完了0件は納期中立値70%。件数(担当/完了/進行中/超過)+スコア内訳を明示。
- **チーム評価**: メンバー総合スコアの平均=チームスコア+グレード。集計指標(全件合算)+メンバー別ランキング。
- **AI管理**: 期限/未更新/相談を検知、齊藤向け報告文を自動生成(コピー可)。
- **目標設定**: 年間目標+**月別目標(全12ヶ月を一覧可視化)**。年切替◀▶、対象月選択、各月にその月のタスク数/完了数表示。
- **成果ログ**: 全タスクの作業ログを時系列集約。

## 5. 共有同期（Supabase）
- `DB`(localStorage即時) + `REMOTE`(Supabase). 変更を900msデバウンスで送信、12秒ポーリングで他端末の更新取得(編集モーダル中は上書きしない)。**全店まとめて1ドキュメント(id='main')**でLWW。
- ステータス表示: ☁全員と同期 / 📱この端末のみ / ⏳接続中。
- **有効化SQL**: `hdm-todo/SUPABASE_enable_sync.sql`（Supabase SQL Editorで1回RUN・実行済み 2026-06-02、テーブル稼働中=GET 200確認）。
  - `hdm_todo(id text pk, data jsonb, rev int, updated_at timestamptz)` + anon read/write policy。他テーブルに影響なし。

## 6. ビルド/デプロイ手順
```bash
# 1) ~/hdm-todo/index.html を編集（APP_VERSION も更新）
# 2) Babel構文検証
cd ~/hdm-todo && node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const m=h.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);require("/tmp/babel.min.js").transform(m[1],{presets:["react"]});console.log("OK")'
# 3) デプロイ（spk-taskのhdm-todo/だけをコミット。他のM変更は触らない）
cp ~/hdm-todo/index.html ~/spk-task/hdm-todo/index.html
cd ~/spk-task && git add hdm-todo/index.html && git commit -m "..." -- hdm-todo/ && git push origin main
# 4) 反映確認: curl -s https://nosh2318.github.io/spk-task/hdm-todo/ | grep APP_VERSION
```
- 検証用スクショ: `/tmp/babel.min.js` で事前トランスパイル→ローカルReact(`~/hdm-todo/mtg/vendor/`)で headless Chrome 描画。
- MTG資料生成: `node ~/hdm-todo/build_mtg.js` → `~/hdm-todo/mtg/pdf/`（各画面PDF＋結合版）。※領域/評価の最新化は要再生成。

## 7. バージョン履歴
| Ver | 内容 |
|---|---|
| v1.0.0 | 初版（ASANA調・スマホファースト・スケジュール起点・7タブ・localStorage） |
| v1.1.x | ダッシュに個人評価追加（達成率/納期確約率/グレード）+完了日記録 |
| v1.1.0 | 担当領域(4)+親子タスク階層+領域ツリータブ |
| v1.1.1 | 評価にタスク件数+総合スコア算出式を明確化 |
| v1.1.2 | タイムラインをレーン分割（1人複数タスク全可視化） |
| v1.2.0 | Supabase共有同期(クラウド保存・全端末同期) |
| v1.2.1 | マイタスク担当者プルダウン + スタッフ追加/管理タブ |
| v1.3.0 | マイタスクタブ削除(一覧に統合) + チーム評価追加 |
| v1.4.0 | 目標設定を月別化・全12ヶ月一覧可視化 |
| v1.5.0 | 那覇/札幌2店舗切替 + ダッシュに目標達成評価 |
| v1.6.0 | 店舗選択TOPページ→担当領域へ遷移 |
| v1.7.0 | 札幌店をデフォルトにリセット + 一覧既定ボード + ボードDnDでステータス変更 |
| **v1.8.0** | 入店後は店舗ピル非表示+「店舗選択に戻る」ボタン + 担当領域に🚀事業推進追加 |

## 8. 設計メモ / 注意
- **PEOPLE** はモジュール変数で、App が毎レンダー `doc.stores[store].staff` から同期 → 全コンポーネントが現在店舗の担当者を参照。
- **AREAS / EVAL / STORES** は各1箇所の定数で集約。領域追加・評価重み変更・店舗追加はここを直すだけで全画面反映。
- 札幌リセットは `migrations.sapporoReset_v1` で一度きり（以降の編集は保持）。
- DnD(ドラッグ)はPC=マウスで動作。モバイルのタッチはブラウザ仕様上ドラッグが効きにくい→タップ詳細でステータス変更が確実。
- 既存データ互換: 旧単一店舗ドキュメント→`normalizeState`で自動的に `stores.naha` へ移行。
