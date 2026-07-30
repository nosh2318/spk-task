# 札幌SPK タイムカード機能 実装仕様書（CLI omni 向け・漏れなく実装すること）

作成: 2026-07-30 / 依頼元: オーナー（相談フェーズ確定・GO済み）
対象: 札幌SPK のみ（`~/spk-task`・NHA/BTは今回対象外）
参考UI: バクラク勤怠のスマホ打刻（大ボタン 出勤/退勤/休憩開始/休憩終了＋今日の状態表示）

---

## 0. ゴール（オーナー確定・これを外さない）
1. 各アルバイトが「自分の個人リンク内」で **出勤 / 退勤 / 休憩開始 / 休憩終了** を自分で打刻する。休憩は **複数回** 取れる。
2. **打刻を正とする**。シフト（計画）に入っていなくても、打刻されれば実績になる。＝ 欠勤・遅刻・シフト外出勤も「打刻された事実」がそのまま実績。
3. 修正申請は **「出退勤・休憩の打刻漏れ／押し間違い」だけ**（＝時刻の修正のみ）。本人が時刻を直して理由付きで店舗へ申請 → 店舗が承認して確定。欠勤・遅刻・シフト外の申請機能は作らない（打刻が正なので不要）。
4. 店舗側「給与」ページで **計画（シフト）× 実績（打刻）× 修正申請中** を横並びで表示し、**休憩も「計画◯分 / 実績◯分」で取れているか照合**できる。行ごとに承認・修正でき、**承認済みが給与計算に直結**する。給与計算が楽になること。

## 0.5 絶対ルール（データ保全・違反禁止）
- 1アクション＝1件だけ書く。既存行を丸ごと再保存しない。
- 人間が入力した値（打刻時刻・承認・メモ・シフト）を、別処理で上書きしない。競合したら人間入力が勝つ。
- 削除は物理削除でなく墓標（deleted=true）または status で無効化。
- 既存ファイルは Write 全置換禁止 → Edit で部分追加。
- 完了報告前に、入力→保存→読込→表示の全経路を実データで動作確認する。

---

## 1. 既存の土台（これを最大活用する・二重に作らない）

### 1-1. 勤怠テーブル `spk_attendance`（既存・実績の入れ物）
現状カラム: `date, staff_name, start_time, end_time, approved, memo, absent`
- onConflict = `date, staff_name`（1日1スタッフ1行）
- start_time / end_time = "HH:MM"（例 09:04）
- approved = 承認済みフラグ（false=未承認/仮申請、true=承認済み）
- memo = "打刻" / "仮申請" 等
- **休憩の列が無い** → ここに複数回休憩を持たせる（下記 2-1）。

### 1-2. 既存の打刻ロジック（`index.src.html` DBオブジェクト内）
- `DB.punchIn(staffName, timeStr, isProvisional)` … 出勤打刻。`spk_attendance` に start_time を upsert。既に出勤済みなら例外。isProvisional=true なら approved=false + memo="仮申請"。
- `DB.punchOut(staffName, timeStr, isProvisional)` … 退勤打刻。end_time を upsert。
- `DB.sendPunchSlack(storeName, staffName, type, reqTime, nowTime)` … `DB.SLACK_PUNCH_WEBHOOK` へ「打刻仮申請あり」を通知。
- **休憩打刻の関数は無い** → `DB.breakStart(staffName)` / `DB.breakEnd(staffName)` を新設（下記 2-2）。

### 1-3. 個人リンク（打刻画面を載せる場所）
- 既存の個人リンク／`staff.html`（token / pin 認証あり）に **打刻画面を組み込む**（新規HTMLページは作らない＝オーナー指定「既存のものに作成」）。
- staff.html は現状「出勤」だけがある想定 → 退勤・休憩開始・休憩終了・今日の状態表示・修正申請 を追加する。
- 認証方式（token/pin）は既存のものを踏襲。どのスタッフのリンクかは既存の認証で確定している staff_name を使う。

### 1-4. 給与ページ（承認・照合の場所）
- 給与タブに既に **計画（シフト）/ 実績（勤怠）** のトグル表示がある（`StaffManager`／月別カレンダー・スタッフ別）。
- 既存の承認フロー（approved フラグ）を活かし、ここに「計画×実績×申請」の横並び比較と休憩照合、承認/修正 UI を足す。

### 1-5. シフト（計画）の所在
- 計画＝ `shifts` テーブル（storeで絞らず全員・staff_name が正本キー・氏名の表記ゆれ＝空白有無/名字のみに注意）。
- symbol（●出勤/公/希/有/出）、start_time / end_time を持つ。
- 休憩の「計画」を shifts が持っているか要確認 → 持っていなければ「計画休憩」はスタッフ設定（給与の月給/時給設定にある休憩分＝既存の休憩控除設定）か、シフトに休憩予定列を足すか、CLIが実データを見て最小変更で決める。**計画休憩の出所は実データで確認してから決めること（推測でハードコードしない）。**

---

## 2. 新規で作るもの（3点だけ）

### 2-1. DB: 休憩の複数回記録（`spk_attendance` 拡張）
- `spk_attendance` に `breaks jsonb DEFAULT '[]'` を追加。
- 形式: `[{"start":"12:05","end":"12:48"}, {"start":"15:10","end":"15:20"}]`（複数回）。
- 実績休憩合計(分) = Σ(end-start)。end が空 = 休憩中。
- 既存行に影響を与えないよう `ADD COLUMN IF NOT EXISTS`。

### 2-2. DB関数（打刻の書き込み・index.src.html）
- `DB.breakStart(staffName, timeStr)` … その日の行の breaks 配列末尾に `{start, end:""}` を1件 append（既存 breaks を保持したまま1件だけ足す＝丸ごと再保存しない）。既に end 未設定の休憩がある（＝休憩中）なら例外「休憩中です」。
- `DB.breakEnd(staffName, timeStr)` … breaks 配列の末尾（end 空）の end を埋める。開始が無ければ例外。
- 出勤前の休憩打刻はガード（出勤打刻が無い日は休憩不可）。
- 全て `spk_attendance` の当日行に対して **breaks 列だけ** を更新（他列は触らない）。

### 2-3. DB: 修正申請テーブル `spk_timecard_requests`（新規）
カラム案:
```
id            uuid default gen_random_uuid() primary key
date          date        -- 対象勤務日
staff_name    text        -- 申請者
field         text        -- 'start' | 'end' | 'break'  (どの打刻の修正か)
break_index   int         -- field='break' の時、breaks配列の何番目か（開始/終了）
sub           text        -- 'break_start' | 'break_end'（休憩の場合どちら）
old_value     text        -- 修正前の時刻（打刻漏れなら空）
new_value     text        -- 申請する正しい時刻 HH:MM
reason        text        -- 理由（押し忘れ 等）
status        text default 'pending'   -- pending | approved | rejected
decided_by    text
decided_at    timestamptz
created_at    timestamptz default now()
```
- RLS: authenticated は全操作可（社内）。打刻画面が anon/token 経由なら anon insert を許可（申請の追加のみ）。既存の line_links 等の anon 方針に合わせる。CLIが既存RLS方針を確認して安全側で設定。

### 2-4. 打刻画面 UI（バクラク風・スマホ最適化・個人リンク内）
- 上部: 日付＋現在時刻（リアルタイム）、スタッフ名。
- 中央: **大ボタン4つ**（縦2×2 or 大きめ）
  - 🟩 出勤 / 🟥 退勤 / 🟦 休憩開始 / ⬜ 休憩終了
  - 状態で活性/非活性を制御（未出勤=出勤のみ活性、出勤中=退勤・休憩開始活性、休憩中=休憩終了のみ活性、退勤済=全非活性＋「本日は退勤済み」）。
- 下部: **今日の状態表示**（出勤 09:04 / 休憩1 12:05-12:48 / 休憩2 15:10-… / 退勤 —）。
- **修正申請ボタン**: 「打刻を間違えた／押し忘れた」→ 対象（出勤/退勤/休憩○）と正しい時刻・理由を入力 → `spk_timecard_requests` に pending で追加 → Slack通知（`SLACK_PUNCH_WEBHOOK`）。
- 打刻押下時に確認（誤タップ防止・1回）。打刻は即 `spk_attendance` に反映（打刻が正）。
- スマホ: max-width、入力 font-size 16px（iOSズーム防止）、大きいタップ領域、safe-area 対応。

### 2-5. 給与ページ 比較・承認ビュー
- スタッフ×月で、各勤務日を **計画 / 実績 / 判定** の横並び:
```
        計画(シフト)      実績(打刻)         判定
出勤     09:00           09:04            OK
休憩1    12:00-13:00     12:05-12:48       -12分
休憩2    —               15:10-15:20       +10分
退勤     18:00           18:02            OK
実働     8:00            7:58
```
- 休憩は計画◯分 / 実績◯分 で差分表示（取れているか一目で分かる）。
- 修正申請中の行は黄色で表示し **[承認] [却下] [修正]** を出す。
  - 承認 → `spk_timecard_requests.status=approved` にし、`spk_attendance` の該当時刻/breaks を new_value で更新（1件だけ・人間入力尊重）＋ approved=true。
  - 却下 → status=rejected（実績は変えない）。
  - 修正 → 店舗が直接 spk_attendance の時刻を編集（既存の勤怠編集UIを流用）。
- **承認済み（approved=true）の実働時間・休憩控除後の労働時間が、既存の給与計算にそのまま乗る**こと。実働 = (退勤-出勤) - Σ休憩。既存の休憩控除ロジック（月給/時給複合の calcHours）と整合させる（実績休憩を優先）。
- シフト未登録でも打刻があれば必ず実績行として出す（打刻が正）。

---

## 3. 実装手順（この順で・各段で動作確認）
1. SQL 作成: `spk_timecard.sql`（`spk_attendance` に breaks 追加 ＋ `spk_timecard_requests` 作成 ＋ RLS）。※SQL Editor で RUN が必要なので手順を README で明記。
2. `index.src.html`: `DB.breakStart/breakEnd`、修正申請の insert/承認、給与ビューの比較・承認 UI を Edit で追加。
3. 個人リンク/`staff.html`: 打刻4ボタン＋今日の状態＋修正申請 UI を追加。
4. `node build.js` でビルド。バージョン3箇所更新（APP_VERSION / CV / sw.js CACHE_NAME・sw.js?v）。
5. テスト（実データ）: 出勤→休憩開始→休憩終了→休憩2回目→退勤 を打刻し spk_attendance に正しく入るか / 修正申請→給与で承認→実績反映→給与計算に乗るか / シフト未登録日でも実績が出るか。
6. `git add`（自分の変更ファイルのみ明示add）→ commit → push。
7. manual.html（運用マニュアル）にタイムカードの使い方セクションを追加＋更新履歴1行（成長型マニュアルルール）。

## 4. 完了時に戻すもの
- 変更ファイル一覧・新バージョン番号・本番URL反映確認。
- **SQL RUN 手順**（`spk_timecard.sql` を Supabase SQL Editor で RUN が必要＝オーナー手作業として明記）。
- 打刻画面URL（各アルバイトへの配布方法）とスタッフ向けの使い方2〜3行。

## 5. やらないこと（スコープ外）
- NHA/BT への展開（今回は札幌のみ）。
- 欠勤・遅刻・シフト外の「申請」機能（打刻が正なので不要）。
- 位置情報・GPS打刻・不正防止の高度な仕組み（今回は入れない）。
