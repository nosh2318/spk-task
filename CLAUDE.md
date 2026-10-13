# SPK業務管理APP（札幌店）— 入口
- ルール＝`~/.claude/CLAUDE.md`（核・自動読込）。札幌の運用手順＝スキル `handyman-spk-ops`。ビルド/デプロイ＝`handyman-app-deploy`。取込 GAS＝`handyman-gas-import`。じゃらん決済＝`handyman-jalan-payment`。
- 着手前に `grep -rn "キーワード" docs/claude-log/ CLAUDE_ARCHIVE_2026H1.md`（見出し一覧 `docs/claude-log/INDEX.md`）。学び・対応記録は `docs/claude-log/YYYY-MM.md` 末尾へ。CLAUDE.md には書かない。
- 本番 https://nosh2318.github.io/spk-task/（パスコード 2318）／リポ nosh2318/spk-task／構成 Single HTML React＋Supabase＋GitHub Pages＋GAS＋PWA(sw.js)。
- ソース `index.src.html` → `node build.js` → `index.html`／`index2.html`／`app.js`（生成物は直接編集しない）。バージョン＝`APP_VERSION`。
- Supabase main `ckrxttbnawkclshczsia`。主要テーブル：`reservations` `fleet` `vehicles` `tasks` `staff` `shifts` `attendance` `maintenance` `places` `vehicle_monthly_kpi` `jalan_payments` `audit_log` `reservation_cancel_ledger`。詳細 `SYSTEM_SPEC.md`（実構造は `select * limit 1` で確認してから修正）。
- 車両クラス（札幌）：A アルファード/ヴェルファイア・B ノア/デリカD5・C ロッキー/CX-3・S ハリアー/CX-5・F ルーミー/ソリオ・H カローラ/アクセラ・G デミオ/ノート。
- 関連：傷チェック APP `~/handyman-damage`（`vehicle_twins`/`check_events`・車両解決は `vehicle_code`＝`vehicle_twins.id` 完全一致）。
