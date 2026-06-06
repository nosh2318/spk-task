# SPK業務管理APP（札幌店）

## 💹 2026-06-06 札幌 収支シミュレータ（sim.html）＋ 事業計画・支出データの正本

### 収支シミュレータ `~/spk-task/sim.html`（GitHub Pages: https://nosh2318.github.io/spk-task/sim.html）
台数・稼働率・原価・持ち方を動かすと月次/年間P&Lが即計算。**単一ファイル・vanilla JS**。オーナーが数字を実態に合わせて触る前提。
- **クラス別設定**：列＝クラス(プルダウン・選ぶとADR/平均泊が実績自動セット) / 台数 / 持ち方(買取・リース・預かり) / 稼働% ／【売上・青】予約/月・台売上・総売上 ／【コスト・赤】リース(入力)・車検・点検・保険・車両原価/台 ／【貢献・緑】貢献/台 ／ ADR・平均泊(右端dim・実績)。
- **共通(単価・計算はここ・科目グループ化)**：🚗車両単価(車検単価÷12=月・点検単価÷12=月・保険/月台) ／ 🅿️駐車場(単価×台数=合計) ／ 💼共通固定費(人件費・賃料・広告) ／ 📈変動費(OTA%・清掃/予約・洗車単価→洗車合計) ／ 🎯設定(目標・返済)。
- **計算式**：台売上=ADR×稼働率×30 ／ 予約=稼働日数÷平均泊 ／ 車両原価/台=リース+車検+点検+保険(預かりは¥0) ／ 貢献/台=台売上−車両原価−変動費(OTA手数料+(清掃+洗車)×予約) ／ 共通固定費=人件費+賃料+駐車場合計+広告 ／ 純利益=グロス−支出計。
- **🎯目標到達リバランス**：貢献/台の高いクラスから上限台数まで埋めて目標純利益に届く構成を自動算出→台数欄に反映。
- **預かり取分%（販売手数料率・既定70%）**：預かり車は売上×取分%を協力会社へ支払う。支出計に「🤝販売手数料(預かり)」行、**貢献/台・実績貢献・リバランスのcontribすべてから控除**（控除しないと固定費¥0の預かりが過大評価されリバランスが誤る）。保存キー `g_partnershare`。
- **クラス表に「手数料」列（コスト赤・保険と車両原価/台の間）**：預かり行＝台売上×取分%、買取/リース＝¥0。合計行 `ft_pfee`。貢献/台＝台売上−車両原価/台−手数料。列追加時はヘッダーth/rowHTMLtd/tfoot tdの**3箇所同時**＋シミュ群colspan更新（現在24列・シミュ13/実績7）。
- **ADR/平均泊はシミュ群(青・入力)に移動、実績群(紫)に実績ADR/実績平均泊を表示**（旧「参考」群は廃止）。入力セルの物理位置を動かしてもinput順序(c[0..5])は不変＝calc/saveState/clsChange無改修。
- **🟢 実績ライブ自動取得（2026-06-06・3店共通）**：開くたびに実績(稼働/ADR/台売上/平均泊)を自動更新。①正本箱`monthly_snapshots.class_detail`の**直近3確定月**(year_month<今月)をクラス別合算→稼働%=Σrental/Σavail・ADR=Σrev/Σrental・台売上/月=Σrev/Σavail×30 ②平均泊のみ予約テーブル(直近92日返却・cancel除外)から ③認証=**同オリジンの本体APPログイントークン(localStorage sb-*-auth-token)を再利用**・未ログイン時は埋込スナップショットにフォールバック(noteに状態表示`#live_status`) ④店舗差分はLIVECFG(SPK:reservations/vehicle/lend_date/return_date、NHA:nha_reservations/vehicle_class/start_date/end_date、BT:bt_+独立SB。**BTはsnapshot未整備→リリース後に自動稼働**)。検算済:ライブ集計が埋込稼働率と全クラス一致。3店とも全店統一・push済。
- **⚠️ localStorage保存キーは店舗別**（`sim_state_v1`=SPK/`sim_state_nha_v1`/`sim_state_bt_v1`）。NHA/SPKは同一オリジン(nosh2318.github.io)なので共有キーだと上書き事故。
- **🏆 達成見込み列（シミュ群・稼働%の隣）**：達成見込み＝実績稼働÷シミュ稼働設定×100。**A≥100% / B≥80% / C<80%**（例「B 86%」緑/橙/赤）。オーナー思想＝「**稼働率がトリガー**で売上/件数が連動→稼働率を設定した瞬間に"その設定は実績から見て現実的か"をA〜Cで先に提示」。変遷：成績◎○△×(実績貢献ベース)→達成率(実績側)→**達成見込み(シミュ側)が最終形**。実績はライブ取得なので予約増→実績稼働上昇→見込み評価も自動改善。セレクタ`.outlook`（旧`.grade`は廃止）。
- **📸 snapshot月次更新も自動化（2026-06-06・3店）**：本体APPの「前月自動記録」useEffectを**force=true＋1日1回ガード(localStorage `snap_auto_force_{ym}`)**に変更→APPを開くだけで前月snapshotが毎日最新値に上書き（「全月を再記録」ボタンの月次手動運用が不要に）。SPK v4.7.212 / NHA v3.5.113 / BT v1.0.70。BTはsaveMonthlySnapshotにforce引数も追加（未対応だった）＋**store値は"tkm"**（sim LIVECFGも tkm に修正済）。
- **⚠️ BT残作業（オーナーRUN）**：BT Supabase に monthly_snapshots テーブルが無い → `~/buddica-touring/app/bt_monthly_snapshots.sql` を BT SQL Editor で1回RUN（RUNするまでBTのsnapshot保存は失敗＝simはフォールバック表示）。
- **⚠️ NHA/BT の sw.js は0バイト（SW無効・BASE_V方式）**。バージョン更新は APP_VERSION(index.html.bak)＋BASE_V(index.html) の2箇所。
- **現在の列構成（24列・3店共通）**：基本3（クラス/台数/持ち方）｜🔵シミュ14（稼働%・**達成見込み**・ADR・平均泊・予約/月・台/売上・台/リース・台/車検・台/点検・台/保険・台/手数料・台/車両原価・台/貢献・総売上）｜🟣実績6（実績稼働・実績ADR・実績平均泊・実績予約/月・実績台売上・実績貢献）｜削除1。sim.htmlはこの構成で**完成系**（オーナー確認 2026-06-06）。
- 注意：車検=**1年(÷12)**、点検=年(÷12)。クラスselect化に伴い `querySelectorAll('input')` でなく `'input,select'` で台数indexを取る（リセット行のバグ源）。

### 🔴 支出データの正本＝予算実績タブ→コスト内訳（costmatrix.html）※生キー直読み禁止
- **コスト内訳が表示する値を使う**（生キー `cost_spk_{ym}` 直読みは不可）。理由：タブはリース/車検/整備を**車両マスターから再計算**し、表示行に無い保存値（孤立データ）は出さない。
- 実績キー＝`cost_spk_{ym}` / 予算キー＝`cm_budget_spk_{ym}`（app_settings・key/valueのみ・updated_at列なし）。account_code: `sga_*`(販管) `cogs_*`(原価) `repay_*`(返済)。
- ⚠️ **`sga_repair ¥550,000`(車両修理)は孤立データで5月の実コストではない＝計上しない**（オーナー確認・2026-06-06）。これを混ぜて営業コストを¥219万と誤算→正は¥164万。
- ⚠️ SPK実績モードは cogs_inspection(車検)/cogs_maintenance(整備) を車両マスターから自動計算表示。
- **コスト内訳のリースを「車両マスター自動(🔗マスタ)→手動入力可」に変更済**（costmatrix.html・初期値マスタ・上書きで手動保存。`_getV`手動優先・`_leaseSubs`の`_auto`除去）。

### SPK 実P&L（5月・修理¥550k除外後）と¥100万モデル
- 売上¥105万 − 営業コスト¥164万(給与49.2+リース45+賃料28.8+保険10+車検9.75+整備修理5.5+広告その他25.5万) = **営業利益 約−¥59万/月**（新店ゆえ赤字）。別途返済¥37.7万/月(CF)。
- **純利益¥100万には自社売上 約¥370万/月が必要**（固定費≈¥164万・損益分岐 売上≈¥220万）。23台/稼働51%でほぼ損益分岐。¥100万は F増車(~32台級) or 価格最適化 or 固定費圧縮の合わせ技。
- 事業計画書：`~/Desktop/HANDYMAN/札幌_事業計画_純利益100万モデル_2026-06.md`。
- 柔らかい打ち手（容量以外）：預かり大量(固定費¥0)・付帯売上・直販で手数料削減・固定費変動化・ダイナミック価格。

### Lesson
1. **支出は生キーでなくコスト内訳タブの表示値**。タブは再計算するので生`cost_*`と一致しない。孤立保存値(修理¥550k)を混ぜない。
2. **事業計画の数字は決め打ちせずシミュレータ化**。オーナーが実額を入れて動かす方が信頼される（「あてにならない」回避）。

## 📧 2026-06-05 エアトリプラス(DP)予約 取込漏れ 修正＋再発防止（gas-email-import-v2.gs）

### 症状
札幌のエアトリ予約 C260600231（ワタナベ シゲヨシ・コンパクトSUVプラン_C・6/27-30）がメール自動取込されず。本文は「エアトリプラス（DP）予約システム」＝標準エアトリと別フォーマット。

### 真因（送信元が別会社ドメイン＝Skygate）
実ログで判明：**送信元 `info@skygate.co.jp`／件名 `【予約確定】エアトリプラス（DP）でレンタカー予約を受け付けました。`**。
- 🔑 **エアトリプラス（DP）は Skygate社運営で、airtrip.jpドメインですら無い**（`info@skygate.co.jp`）。
- `processMessage_` の2ゲートで弾かれていた：
  1. **送信元ゲート**：`OTA_SENDERS.airtrip='info@rentacar-mail.airtrip.jp'` 完全一致 → skygate.co.jp は不一致 → ota=null → silent skip（"skipped by router"）。
  2. **件名ゲート**：`'【予約確定】エアトリレンタカー'` 不含 → 「非予約」skip（DPは件名違い）。
- ※`parseAirtrip_`は**DP本文を完璧に読める**（予約番号/予約者名/貸出/プラン名_C/基本料金/補償オプション/到着便 全ラベル一致）。問題はゲートだけ。

### 修正（4段の詰まりを全部つぶす・「常に」取りこぼさない設計）
DP予約は**4箇所**で連続して詰まっていた（1つ直すと次が露呈）：
1. **送信元を配列化＋skygate追加**：`airtrip:['rentacar-mail.airtrip.jp','skygate.co.jp']`。新ヘルパー `otaSenderList_()` で平坦化し、Gmail検索 `from:` 句（2箇所）と送信元判定の両方で共用。送信元判定は `Array.isArray` 対応に。→ これで `info@skygate.co.jp` をエアトリ(O)と認識。
2. **本文フォールバック判定 `isReservationEmail_(ota,subject,body)` 新設**（CANCEL_KEYWORDS直後）：件名一致 **OR** 本文に「予約番号＋貸出＋料金」3点が揃えば受理。**全OTA共通**。`[ReserveFallback]`ログで新件名を学習。3点必須でmarketing/決済通知は誤受理しない。キャンセルは前段で処理済み。件名ゲートを `if(!isReservationEmail_(...)) skip` に差し替え。
3. **クラス抽出 `extractVehicleClass_` を `_C☆` 形式＋プラン名キーワード対応**：プラン名「コンパクトSUVプラン_C☆」の `_C` の後が `☆`（`_`でも末尾でもない）で既存パターンに当たらず空→未配車だった。`/[_]([ABCSFH])(?![A-Za-z0-9])/i` 追加＋キーワード（コンパクトSUV→C 等）フォールバック。
4. **日付パース `parseDateTime_` をスラッシュ＋曜日対応**：DP日付「2026/06/27 (土) 15:40」を解釈できず lend_date/return_date が空→配車表に出ず「登録されてない」ように見えた（実はDBには入っていた）。2つ目のパターンの区切りを `-`→`[-\/]` に拡張（`.*?`で`(土)`を飛ばす）。これが「予約登録すらできてない」の正体。

### 復旧手順（実施済・2026-06-05）
1. 壊れた残骸（日付空でinsert済みの行）を Supabase REST(curl) で DELETE（fleet/tasks は無し＝クリーンだった。`reservations?id=eq.C260600231`）。**curlでの直DB確認・削除手順**：`/auth/v1/token?grant_type=password`(oshita@g-lines.jp/nosh2318)でtoken取得→`/rest/v1/...`をapikey+Bearerで叩く。⚠️SPK reservationsの予約番号カラムは`id`、氏名は`name`（`resv_no`/`user_name`は存在しない）。
2. `backfillSpecificReservations()` TARGET_IDS=['C260600231'] で再取込（予約番号Gmail全文検索→processMessage_直通＝処理済み記録を無視）。→ `class=C / 2026-06-27~30 / Assigned RKY(ロッキー299)` で success。

### Lesson（再発防止）追加
4. **「予約登録できない」の切り分けは"DBを直接見る"**。今回 reservations には入っていた（id=C260600231/name有）が lend_date/return_date/vehicle が空＝**配車表に出ないだけ**だった。APP画面だけ見て「未登録」と判断しない。curlで `id=eq.XXX&select=*` を見れば一発。
5. **OTA派生商品(DP)はパーサーの全段（送信元・件名・クラス・日付）が別仕様になりうる**。1段直すと次段が露呈する。日付/クラスの抽出は「区切り文字・曜日・装飾(☆★)」に強い正規表現にしておく。

### デプロイ（オーナー作業）
1. GASエディタ「札幌予約メール自動配車」→`gas-email-import-v2.gs`をCmd+A→Cmd+V→Cmd+S（トリガー型・Web App再デプロイ不要）。
2. `processNewEmails`手動実行→C260600231ネイティブ取込（旧フィルタで未取得＝PROCESSED未登録→新規取込）。出なければresv_noで再処理。**Slack二重登録は避ける**。

### Lesson（再発防止）
1. **OTA取込は「送信元＝ドメイン一致」「件名一致 OR 本文判定」の二段構えにする**。特定アドレス・件名への完全一致依存は、OTAが派生商品(DP等)/送信元/件名を変えた瞬間にsilent skip（skyticket送信元変更2026-04-06と同型）。
2. **silent skip（ota=null/非予約skip）は気づけない＝取りこぼしの温床**。本文フォールバックで「拾って警告ログ」に倒す。
3. パーサーは本文ラベル依存＝同フォーマットなら別商品でも読める。**ゲートを緩める方向が安全**（パーサーは厳格でよい）。

## 💰 2026-06-01 アルバイト給与「月給/時給 複合」対応（index.src.html / v4.7.185→v4.7.186）

### 要望（オーナー）
月給アルバイトがヘルプで固定曜日外に出勤した分の給与を月給に上乗せしたい。
- 固定分（例: 木金土）＝月給（固定給）に内包
- 変動分（固定曜日外＝ヘルプ出勤。例: 5/26火 1.5h）＝出勤時間×時給 を上乗せ
- 交通費＝出勤日数×単価（従来通り）

### 修正内容（給与タブ StaffManager / 給与計算 allStaffData）
- 給与形態: 旧「月給」「日給/時給複合」→ **月給モードでも時給+固定曜日を併用可能に**（＝月給/時給複合）
- 計算（L11210付近 allStaffData）:
  - `isMonthlyBase = アルバイト && monthlySalary>0`
  - `monthlyHasHourly = isMonthlyBase && hourlyWage>0 && fixedDays` ← 複合判定
  - `useFixedDow = hasDailyWage || monthlyHasHourly` で `d.fixed`（固定曜日）判定を月給複合にも拡張
  - `wage = monthlySalary + (monthlyHasHourly ? hourlyWage × 変動曜日時間 : 0)`（budget/actual両方）
  - **時給0 or 固定曜日空 → 従来の純粋月給（後方互換）**。正社員・日給複合は無影響
- result の `isMonthlyPart` を `isMonthlyBase` 値に変更（＋`monthlyHasHourly`追加）→ 表示分岐 `!d.isMonthlyPart` は「月給ベースでない」を意味
- UI（月給フォーム L3807）に「時給-ヘルプ変動日」「固定曜日（月給に含む）」欄追加。月給切替時は dailyWage のみ0リセット（hourlyWage/fixedDays保持）
- 一覧カード（L3747）/ 給与明細（L11543月給ブロック）/ 日別勤怠内訳テーブル（L11583賃金列・固定曜日¥0・変動曜日のみ時給）に複合表示
- 編集時モード判定（L3718）: `monthlySalary>0 && !dailyWage → monthly`
- **DB変更なし**（fixed_days/hourly_wage/monthly_salary は既存カラム）

### 追加対応（同日 v4.7.187 / v4.7.188）
- **v4.7.187**: 「時給を入れたのに反映されない」報告 → 原因は **固定曜日(fixed_days)が空**。複合判定 `monthlyHasHourly` は `月給>0 && 時給>0 && fixedDays必須`。固定曜日が空だと純粋月給扱いになる。再発防止に**月給モードで時給>0かつ固定曜日が空のとき、固定曜日欄を赤枠+警告表示**を追加（L3825付近）。→ オーナーが固定曜日「木金土」入力で解決。
- **v4.7.188（A方針確定）**: 月給/時給複合の**変動分（固定曜日外＝ヘルプ出勤）は休憩控除を適用しない**。`actualVarHours`/`budgetVarHours` を `monthlyHasHourly` のとき `calcHours(start,end,0)`（休憩0）で集計（L11250/L11275付近）。理由：三國さんは休憩180分設定で、5/26(火)1.5hのヘルプ出勤が `calcHours` のマイナスクランプで0hになり時給が付かなかったため。**固定曜日（通常勤務）・日給複合・正社員は従来通り休憩控除を維持**。

### バージョン
| APP_VERSION | CV/CACHE_NAME | sw.js?v= | コミット |
|---|---|---|---|
| v4.7.186 | spk-v731 | 618 | `beff2db`（複合本体） |
| v4.7.187 | spk-v732 | 619 | `2b8a538`（固定曜日空のUI警告） |
| v4.7.188 | spk-v733 | 620 | `8527cfe`（変動分の休憩控除なし=A方針） |

### 運用（オーナー作業）
スタッフ→三國玲音さん編集→月給モードで「時給（変動日単価）」「固定曜日（木金土）」を入力して保存（完了済）。
→ 5/26(火)1.5h等の固定曜日外出勤が時給×時間（休憩控除なし）で月給に上乗せ表示される。

### 計算例（三國さん：月給90,000 / 時給1,200 / 固定木金土 / 5月）
- 固定曜日(木金土)12日 → 月給内包・賃金¥0
- 変動: 3日(日)11h + 26日(火)1.5h = 12.5h（休憩控除なし）→ 1,200×12.5 = ¥15,000
- 基本給合計 ¥105,000 + 交通費 680×14 = ¥9,520 → 支給額 ¥114,520

### ⚠️ 運用上の重要注意（固定曜日の指定範囲）
- **固定曜日(fixedDays)に含めない曜日は「全て」変動扱い**＝時給×時間が月給に上乗せされる。
- 例：固定「木金土」の場合、**日曜の通常出勤(11h)も変動扱いで ¥13,200 加算**される。
- 「平日のヘルプ短時間だけ上乗せしたい／日曜は月給内包」なら、固定曜日を「日木金土」のように**月給対象曜日を全て列挙**する必要がある。
- つまり fixedDays＝「月給に内包する全曜日」。ヘルプ加算したい曜日だけを除外する設計。

### Lesson
- `fixedDays` は元々「日給複合」専用だったが、月給複合にも流用（判定フラグ `useFixedDow` で統合）。**fixedDays が空だと複合計算が一切効かない**（必須）。UIで警告を出さないと気づけない。
- 表示分岐キー `isMonthlyPart` を「純粋月給」→「月給ベース全般」に意味変更したので、複合も月給ブロック側に表示が寄る。
- `calcHours` はマイナスを0クランプ → 短時間出勤に固定休憩を引くと0hになる罠。ヘルプ変動分は休憩控除しない設計が実態に合う。

## 🔧 2026-05-30 配車表 A2/B2クラス重複表記バグ 修正（index.src.html / v4.7.183→v4.7.184）

### 症状
札幌店の配車表（FleetTimeline）で **A2クラス・B2クラスが2重に表示**される（同じ車両を持つクラスグループが2つ並ぶ）。

### 真因（vehicleClasses の merge が type 重複を排除していなかった）
- 2026-05-26 に A2/B2（預かり車両クラス）が `INIT_CLASSES`（L945-953）に**正式追加**された。
  - A2 = アルファード/ヴェルファイア（預かり車両）、B2 = ノア高年式（預かり車両）
- それ以前は A2/B2 を**カスタムクラス**として登録運用していた端末があり、localStorage `spk_custom_classes_v1` に A2/B2 が残存していた。
- `vehicleClasses` useMemo（L17607付近）が `[...INIT_CLASSES(+overrides), ...customClasses]` で**単純結合**しており、type の重複を排除していなかった。
- 配車表 `groups`（L12688）は `vehicleClasses.map(...)` をそのまま描画するため、INIT由来 A2/B2 ＋ localStorage残存 A2/B2 が**それぞれ同じ車両(`vehicles.filter(v=>v.type===vc.type)`)を2回描画** → 重複表記。
- `addCustomClass` には `INIT_CLASSES.find(...)` の重複ガードがあるが、**新規追加時のみ**有効で、既に localStorage に入っていた旧データには効かなかった。

### 修正（INIT_CLASSES 優先で type 重複排除）
`vehicleClasses` useMemo（L17608付近）:
```js
const merged=INIT_CLASSES.map(c=>({...c,...(classOverrides[c.type]||{})}));
const seen=new Set(merged.map(c=>c.type));
const dedupCustom=customClasses.filter(c=>!seen.has(c.type));
return [...merged,...dedupCustom];
```
- INIT_CLASSES（＋overrides）を優先し、同 type の customClass を捨てる。
- **各端末で localStorage クリア不要**（描画時に dedup されるため自然解消）。
- 配車表だけでなく vehicleClasses を使う全画面（車両マスター・予約フォーム・編集モーダル等）で重複解消。
- 動いている処理には未介入（merge の1行を置換しただけ）。

### バージョン
| APP_VERSION | CV | CACHE_NAME | sw.js?v= | コミット |
|---|---|---|---|---|
| v4.7.184 | spk-v729 | spk-v729 | 616 | `9f60262` |

### Lesson（再発防止）
1. **マスター配列に新 type を「正式追加」する時は、旧運用（localStorage/DB のカスタム登録）に同 type が残っていないか必ず確認する**。INIT 側に取り込んだら、結合時に重複排除を入れること。
2. **「結合（spread merge）」は重複を生む**。`[...A, ...B]` で A と B に同一キーが入りうるなら、必ず `Set` で dedup する。
3. **追加時ガード（addCustomClass の重複チェック）は既存データには遡及しない**。表示側（useMemo）で dedup する方が堅牢（端末クリア不要）。

---

## 🔴 2026-05-30 オフライン誤検知バナー固着バグ 根本修正（index.src.html / v4.7.182→v4.7.183）

### 症状
札幌店APPで「⚠️ オフライン — 変更は復帰後に自動保存されます」赤バナーが**実際は通信できているのに消えない（固着）**。
予約298件・カレンダー・空車数が正常表示されている＝データ読み込みは成功しているのにバナーだけ残る。

### 真因（接続チェックの 401 誤判定）
ネットワーク検知 `actualCheck()`（`index.src.html` L17475付近）が **`HEAD https://ckrxttbnawkclshczsia.supabase.co/rest/v1/`（RESTルート）＋apikeyのみ** を叩き、`r.ok`（200番台か）で接続判定していた。

| プローブ | 結果 |
|---|---|
| `HEAD /rest/v1/`（ルート）＋apikeyのみ | **401** ❌ |
| `HEAD /rest/v1/vehicles?select=id&limit=1`＋apikey | **200** ✅ |

→ **2026-05-13 anonポリシー強化以降、RESTルート `/rest/v1/` はapikeyのみだと401を返す**ようになっていた。
→ `actualCheck()` は常に `r.ok=false` を返す。データ読み込みは別経路（テーブル指定＋apikey）なので成功する一方、接続チェックだけが永久に失敗。
→ 構造上の固着: `isOnline` は一度 `false` になると **`online`イベント発火（=`on()`）まで戻らない**。`off()` の「実接続OKなら無視」も、初回の `navigator.onLine=false` 上書きも、全部この401で機能していなかった。

### 修正（2段階）
1. **v4.7.182**: `isOnline=false` の間だけ15秒ごとに再チェックして自動復帰するループを追加（`useEffect [isOnline]`、L17493付近）。→ ただしプローブ自体が壊れていたため**これだけでは効かなかった**。
2. **v4.7.183（真因修正）**: 接続チェック2箇所（`actualCheck` と `recheck`）を以下に変更:
   - プローブ先を **実テーブル `/rest/v1/vehicles?select=id&limit=1`** に変更
   - 判定基準を **「fetchが解決すれば（401含む）= サーバー到達 = オンライン」** に変更。`throw`（タイムアウト/通信断）のときだけオフライン。
   ```js
   try{await fetch(".../rest/v1/vehicles?select=id&limit=1",{method:"HEAD",headers:{"apikey":SUPABASE_KEY},signal:AbortSignal.timeout(5000)});return true;}catch(e){return false;}
   ```

### バージョン
| 版 | APP_VERSION | CV / CACHE_NAME | sw.js?v= | コミット |
|---|---|---|---|---|
| 自動復帰追加 | v4.7.182 | spk-v727 | 614 | `d8fb2f0` |
| 真因修正 | v4.7.183 | spk-v728 | 615 | `fe05c56` |

### Lesson（再発防止ルール）
1. **接続生存確認(ヘルスチェック)は「HTTPが返ったか」で判定する。`r.ok`(2xx)で判定しない** — 認証エラー(401/403)でも「サーバーに到達できている=オンライン」。2xx必須にすると、認可仕様が変わった瞬間に全端末が誤オフライン化する。
2. **anon/RLS 強化時は副作用を横断確認** — 2026-05-13 の anon ポリシー変更で `/rest/v1/` ルートが401化し、半月後にこの固着として顕在化した。ポリシー変更時は「ヘルスチェック・GAS・iframe系」など apikey 直叩き箇所を全部洗う。
3. **ヘルスチェックのプローブ先は「アプリが実際に使うのと同じ条件で200が返るエンドポイント」にする** — ルート(`/rest/v1/`)は本番データ取得では使わないので、そこだけ認可挙動が違っても気づけない。
4. **状態フラグは「片方向イベント依存」を避ける** — `isOnline=false`→復帰が`online`イベント単独依存だと、イベントが来ないと永久固着。必ず能動ポーリングの自動復帰を併設する。
5. **「データは表示されているのにバナーだけ出る」= 判定経路と実データ経路の乖離**。次回同種症状は真っ先に「判定に使っているfetchの実ステータス」をcurlで確認する。

---

## 📤 2026-05-26 お客様向け 傷チェック共有URL機能 実装（handyman-damage + SPK/NHA管理APP）

### 全体構成
お客様にダメージ状態を共有するための公開URLを発行し、SPK/NHA管理APPの主要画面から1タップでLINE案内文付きコピーできる仕組みを構築。

### 主要URL
- **お客様向け公開ビュー**: `https://nosh2318.github.io/handyman-damage/v.html?t=<UUID>&v=v3`
- **車両ごとに UUID トークン**（vehicle_twins.share_token）が発行され、推測困難
- 共有停止すると即座にアクセス不可

### DB変更
```sql
ALTER TABLE vehicle_twins ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE DEFAULT gen_random_uuid();
ALTER TABLE vehicle_twins ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN DEFAULT false;
ALTER TABLE vehicle_twins ADD COLUMN IF NOT EXISTS share_enabled_at TIMESTAMPTZ;
ALTER TABLE vehicle_twins ADD COLUMN IF NOT EXISTS display_label TEXT;
-- anon 用 RLS（share_enabled=true の車両のみ閲覧可）
CREATE POLICY "public_share_read_vehicle_twins" ON vehicle_twins FOR SELECT TO anon USING (share_enabled = true);
```

### v.html（お客様向け公開ビュー）
- 単独HTML / `~/handyman-damage/v.html`（約 510行）
- anon キー + RLS で `vehicle_twins.share_token` ベース検索
- 顧客名・予約番号・担当者名・利用期間 **すべてマスキング**
- 表示内容: 「車種 / ナンバー」（display_label）+ 本日日付 + 車両図SVG + ダメージマーカー
- マーカータップで写真ライトボックス展開
- `no-cache` meta タグ + URLバージョンクエリ `&v=v3` でブラウザキャッシュ対策

### handyman-damage 側の共有ボタン（index.html）
- 車両詳細画面下部に「📤 お客様共有リンクを発行」セクション
- 発行時: `share_enabled=true` + `display_label`生成 + URL自動コピー
- display_label形式: `車種 / ナンバー`（例: `ノア / 5398`）
- 停止/再発行ボタンも同セクション

### SPK/NHA管理APP の共有アイコン
- 既存コードに **完全独立** な `DmgShareIcon` コンポーネントを追加
- グローバル `window._dmgShareMap` 経由で配信（5分polling）
- 3画面に配置:
  | 画面 | SPK | NHA |
  |---|---|---|
  | OPシートマスター | ✅ | ✅ |
  | TOPタスクサマリ（個人別） | ✅ | ✅ |
  | TOPスケジュール（本日） | ✅ | ✅ |
- **発行済(青📤)** タップ → ポップアップメニュー:
  1. 📝 **LINE案内文 + URL をコピー**（テンプレ全文+URLを一括コピー・最上段強調）
  2. 🌐 開く（新タブ）
  3. 📋 URLのみコピー
  4. 🔒 共有停止
- **未発行(グレー📤)** → トースト「📤 共有未発行です」

### LINE案内文テンプレ（固定）
```
HANDYMANのご利用誠にありがとうございます。
本日ご利用なられる車両データをお送りさせていただきます。
下記URLより車両状態（傷・ヘコミ）の画像確認が可能でございますのでご確認後、気になる箇所がございましたら、画像送信またはご連絡をお願いいたします。 ※ご出発後の申告につきましては対応いたしかねる場合がございます。

【車両傷チェック】
🔗 こちらよりご確認ください
<URL>

よろしくお願いいたします。
```

### バージョン
| プロジェクト | バージョン | コミット |
|---|---|---|
| `handyman-damage` | 共有URL機能シリーズ | `0c69c42` → `4ed6d98` → `5adbd15` → `d5fa3c8` |
| `spk-task` | v4.7.164（3画面実装）→ v4.7.165（案内文テンプレ） | `a760b7c` → `7412621` |
| `naha-project` | v3.5.74-NHA → v3.5.75-NHA | `faa0703` → `efd9ff0` |

### BUDDICA 高松（実装スキップ）
- `bt_vehicle_twins` テーブルが**存在しない**
- `vehicle_twins`（BT Supabase）も**0件**（damage機能未運用）
- 共有URLの元データがないため実装対象外。将来 BT で damage アプリ運用開始時に対応

### display_label 形式の歴史（v.html 後方互換対応）
- v1: `"プレート|車種 ／ ID"`（パイプ区切り）
- v2: `"プレート / 車種 / 年式"`（スラッシュ区切り）
- **v3 確定**: `"車種 / プレート"`（最終形）
- v.html は全形式を自動判別して v3 形式で表示

### Lesson / 教訓
1. **schema.sql が古い場合がある**: `vehicle_twins.plate`/`model`/`year`/`color` は存在せず、本番DBは別テーブルJOIN構造 → 必ず curl で実カラム確認
2. **PostgREST は select 句に存在しないカラムを含めると 全体 HTTP 400** → 0件と誤判定される
3. **anon ロールから vehicles テーブルは見えない**（2026-05-13 セキュリティ強化済）→ vehicle_twins に display_label を冗長コピーするのが最も安全
4. **GitHub Pages の cache-control: max-age=600** → ブラウザキャッシュ強い。`no-cache` meta + URL version-query 両方が安全
5. **既存コードを触らない実装**: グローバル `window._dmgShareMap` 経由でデータ配信 → 独立コンポーネント `DmgShareIcon` だけで完結

---

## 🔴 2026-05-25 入金同期漏れ 修正 + 再発防止 3層防御確立（gas-email-import-v2.gs）

### 症状
- TOP「予約外売上 未回収」「Square請求書」に **実は入金済みのレコードが残る**
- 入金確認 Slack 通知（`✅入金確認完了`）は届いている / スプシも「✅入金済」更新済 / でも APP は未収表示
- 実害: 同日 3件取りこぼし発覚
  | 予約番号 | 宛名 | 金額 | type | 復旧時刻 |
  |---|---|---|:-:|---|
  | C260400997 | イシカワ ハルキ | ¥50,000 | extra_sales | 14:17 |
  | DY00000000966 | ワダ タイキ | ¥7,100 | extra_sales | 14:17 |
  | DY00000000966 | ワダ タイキ | ¥1,833 | **advance** (ガソリン代立替) | 後刻 |

### 真因（構造的バグ）
**`checkPaymentStatus` v3 と `syncPaidToAccounting` の責務分業の片方が静かに止まっていた**

| 経路 | 担当 | 動作 |
|---|---|:-:|
| スプシ I列「✅入金済」更新 | `checkPaymentStatus` (gas-email-import-v2.gs) | ✅ |
| `jalan_payments.status='paid'` 更新 (じゃらん) | 同上 | ✅ |
| **`spk_accounting.paid=true` 更新** | **HANDYMAN Payment Bot v1 の `syncPaidToAccounting`** (別GAS) | ❌ **停止 or 失敗** |
| Slack `#payment_sapporo` 通知 | `checkPaymentStatus` | ✅ |

→ 入金されてもスプシ・Slack は更新されるが DB の `spk_accounting.paid` は `false` のまま残る → APP TOP は永久に「未回収」表示

### `spk_accounting` スキーマ注意（2026-05-25 障害で判明）
- **`paid_at` カラムは存在しない** （初回実装時に `{paid:true, paid_at:...}` で更新したら `column does not exist` で GET も失敗）
- UPDATE は **`{ paid: true }` のみ** にする
- `nha_accounting` も同様（推測・要確認）
- select句に `paid_at` を含めると **GET 全体が失敗** → 「DB行なし」と誤判定される

### 修正: 再発防止 3層防御

#### 層1 リアルタイム同期統合（`checkPaymentStatus` v3 / L2106付近）
入金検知時に `spk_accounting` / `nha_accounting.paid=true` も同時更新するロジックを統合。
- `resolvePaymentStore_` の `channels` から対象テーブル決定
  - 札幌のみ → `spk_accounting`
  - 那覇のみ → `nha_accounting`
  - 両店該当 / 判定不明 → 両方トライ（冪等：`paid=eq.false` 条件で多重更新なし）
- `type` 指定なし → `extra_sales` / `advance` 両方対応
- 既存 `jalan_payments` 更新と Slack 通知ロジックには **一切手を加えていない**

```js
// L2106付近に追加
try {
  var acctTables = [];
  if (resolved.source === 'ambiguous' || resolved.source === 'fallback') {
    acctTables = ['nha_accounting', 'spk_accounting'];
  } else if (resolved.channels.indexOf('C0AP2S5B147') >= 0) {
    acctTables = ['nha_accounting'];
  } else {
    acctTables = ['spk_accounting'];
  }
  acctTables.forEach(function(tbl) {
    try {
      var okAcc = supabaseUpdate_(tbl,
        'resv_no=eq.' + encodeURIComponent(pay.reservationId) + '&paid=eq.false',
        { paid: true });
    } catch(eAcc) { Logger.log('[PaymentStatus] ' + tbl + ' update error: ' + eAcc.message); }
  });
} catch(eAcct) { Logger.log('[PaymentStatus] accounting update error: ' + eAcct.message); }
```

#### 層2 手動診断（`diagnoseExtraSalesUnpaid` / L4945付近）
`spk_accounting.type IN ('extra_sales','advance') AND paid=false` × スプシ「✅入金済」を突合し差分を Slack に出力。
- 任意のタイミングで手動実行
- 検出のみ・更新はしない

#### 層3 日次自動パトロール（`nightlyAccountingPatrol` / L5037付近）
毎朝 9:15 に層2と同等の差分検出を自動実行。
- 0件 → 通知なし（情報過多防止）
- 1件以上 → Slack `#payment_sapporo` に「⚠️ 入金同期漏れ検出 N件」+ `markExtraSalesPaidManual` の **コピペ用 TARGETS スニペット** を通知
- 自動修正はしない（CLAUDE.md 2026-05-11 ルール「自動修復系GASは原則作らない」遵守）
- トリガー設定: `setupAccountingPatrolTrigger()` を1回手動実行

#### 即時復旧用ヘルパー（`markExtraSalesPaidManual` / L4845付近）
取りこぼし発生時の手動修正関数。
- TARGETS: `[{resvNo, name, amount, type}]` の配列
- `type` 省略時 `'extra_sales'`（互換）、`'advance'` 指定で立替金対応
- 同予約番号に複数未払い行ある場合は `amount` 一致で1行絞り込み
- **id-base 更新**（`id=eq.{行ID}` で1件ずつ）→ 巻き込み事故防止

### 関連関数 行番号一覧
| 関数 | 行 | 役割 |
|---|:-:|---|
| `checkPaymentStatus` v3 | L2090付近 | 既存・15分トリガー |
| 統合コード追加部分 | **L2106付近** | 「2026-05-25: spk_accounting / nha_accounting の paid 更新を統合」 |
| `markExtraSalesPaidManual` | L4845付近 | 即時復旧用 |
| `diagnoseExtraSalesUnpaid` | L4945付近 | 手動診断 |
| `nightlyAccountingPatrol` | **L5037付近** | 日次自動パトロール |
| `setupAccountingPatrolTrigger` | L5091付近 | トリガー設定（1回手動実行） |

### 検証コマンド（GASに反映されているか確認）
GASエディタの `gas-email-import-v2.gs` で `Cmd+F` 検索:
```
2026-05-25: spk_accounting / nha_accounting の paid 更新を統合
```
ヒットすれば層1反映済み。

### Lesson
1. **「2つのGASが分業する箇所」は片方が止まると静かに壊れる** → 責務統合が安全
2. **スプシ・Slack・DB の3面同期は1関数内で完結させる**（分散させると同期漏れに気づきにくい）
3. **テーブルスキーマは触る前に確認** — `paid_at` のような汎用カラム名は無いケースあり。select 句に存在しないカラムを含めると **GET 全体が失敗** する PostgREST の挙動も罠
4. **「自動修復」は対症療法**（CLAUDE.md 2026-05-11 確立）。検出+通知+手動修正 が安全な落としどころ
5. **再発防止は多層構造で組む**: 層1 (書き込み側修正) + 層2 (手動診断) + 層3 (日次自動検知) → 1層壊れても他層で気づける

### 残課題（任意）
- `HANDYMAN Payment Bot v1` の `syncPaidToAccounting` トリガー稼働状況確認
  - 層1 統合により責務重複だが、二重更新は冪等（`paid=eq.false` フィルタ）なので実害なし
  - クォータ節約したい場合は停止検討

---

## 📧 2026-05-25 予約後メール自動送信 を 3 OTA に拡張（gas-email-import-v2.gs）

### 概要
従来「じゃらん のみ」だった予約後メール自動送信を **じゃらん・skyticket・エアトリ** の3社に拡張。
skyticket / airtrip は決済リンクなしの「LINE誘導案内メール」を送信。じゃらん は既存通り決済リンク付きメール。

### 対象OTA マトリクス
| OTA | コード | メール種別 | 関数 |
|---|:-:|---|---|
| じゃらん | J | 決済リンク付きメール（既存・変更なし） | `sendJalanPaymentEmail_` |
| **skyticket** | **S** | LINE誘導案内メール（新規） | `sendReservationWelcomeEmail_` |
| **エアトリ** | **O** | LINE誘導案内メール（新規） | `sendReservationWelcomeEmail_` |
| 楽天 | R | 送信なし | — |
| RC / GoGoOut / HP | RC/G/SP | 送信なし | — |

### 新規関数 `sendReservationWelcomeEmail_(reservation)` (L1638)
- **対象OTA**: `['S','O']` のみ。それ以外は即 return false
- **メールアドレス検証**: 空 / `@` なし → スキップ + ログ
- **冪等性**: ScriptProperty `spk_welcome_sent_ids` で送信済予約IDを管理（最大500件保持）
- **送信元**: `reserve@rent-handyman.jp` (既存Gmailエイリアス) / 名義 `HANDYMAN 札幌デリバリー専門店`
- **Slack通知**: `#payment_sapporo` (`JALAN_PAY_CHANNEL`) に「📧 *予約案内メール送信完了*」投稿（失敗は無視）

### 呼び出し箇所（`processMessage_` 内 3点に統合）
| 行 | コンテキスト | 既存じゃらん処理との関係 |
|:-:|---|---|
| L425 | 既存予約パッチ後（OTA自動登録GASが先に登録） | `handleJalanPayment_` の直後 |
| L441 | race condition 時（INSERT 失敗だが他経路で存在） | 同上 |
| L460 | 新規 INSERT 成功後（メイン経路） | 同上 |

→ 冪等性は関数内で担保されるため、3経路すべてで呼んでも重複送信しない。

### メール本文テンプレート（決定版）
```
[予約者名] 様
予約番号： [予約ID]

レンタカーショップHANDYMANカスタマーサポートです。
ご予約ありがとうございます。

札幌店は便利なデリバリー専門店となっております。
スムーズにお貸し出しできますよう事前のお手続きをお願いしております。

━━━━━━━━━━━━━━━━━━━━
\ LINE公式の友達登録 /
ご登録後流れに沿ってデリバリーに必要な情報を入力ください。
当日の時間・場所の詳細連絡にもLINEを利用いたします。

LINE ID：@730kyhwl
https://lin.ee/g6iDNYz
━━━━━━━━━━━━━━━━━━━━

お忙しいところ恐れ入りますが、お貸し出し3日前19:00までにご対応お願いいたします。

【注意点】
・無店舗型のデリバリー専門になります
・予約状況により内容のご調整をいただくことがございます。
・貸出日 3日前19:00時点で情報が不明確な場合はご希望に添えないことがございます。
・貸出時間からご連絡のないまま30分経過しますと貸出不可となることがございます。

【お問合せ】
お問い合わせは公式LINEお願いいたします。
HANDYMANカスタマーサポート
LINE公式：https://lin.ee/g6iDNYz
LINE ID：@730kyhwl
緊急連絡先： 050-1724-6197
営業時間： 9:00〜19:00
```

### テスト関数（GASエディタ手動実行）
| 関数 | 行 | 用途 |
|---|:-:|---|
| `testWelcomeMailDryRun` | L1727 | 4ケース（S空メール/O不正/J除外/R除外）の判定ロジック確認・送信なし |
| `testSendWelcomeMail` | L1749 | 実メール送信。デフォルト宛先 `oshita@mileshare.jp` / `TEST_OTA = 'S'` |
| `testSendWelcomeMailByResvNo` | L1821 | DB実予約データで送信。`TARGET_RESV_NO` を書き換え |

### 動作確認済（2026-05-25 14:01）
- `testSendWelcomeMail` 実行 → `oshita@mileshare.jp` に到着 → 内容確認OK
- 送信元・送信者名・件名・本文・LINE URL・絵文字・改行すべて期待通り
- 本番運用開始

### 緊急停止方法
3箇所の呼び出し（L425/L441/L460）のいずれかの `if (reservation.ota === 'S' || reservation.ota === 'O')` を `if (false &&` に変更すれば該当経路のみ停止。
全停止したい場合は `sendReservationWelcomeEmail_` 関数冒頭に `return false;` を1行追加。

### 関連定数 / ScriptProperty
| 名前 | 用途 |
|---|---|
| `JALAN_PAY_CHANNEL` (`C0AQL6HGG3E`) | 送信完了通知の投稿先（#payment_sapporo） |
| ScriptProperty `spk_welcome_sent_ids` | カンマ区切り送信済予約ID一覧（最大500件・FIFO） |

### Lesson
1. **テンプレート OTA別 共通化**: skyticket / airtrip で本文は完全同一（OTAラベルはログ・Slack通知のみで区別）→ 将来 OTA 追加時は `TARGET_OTAS` 配列に追加するだけ
2. **冪等性は ScriptProperty で十分**: DB カラム追加よりシンプル＋低リスク。500件 FIFO で十分な保持期間
3. **既存じゃらん処理を一切触らない**: `handleJalanPayment_` の隣に並行 `if` ブロックを追加するだけで実装。CLAUDE.md「動いているものを修正しない」遵守
4. **3経路すべてで呼ぶ**: 新規 INSERT / 既存パッチ / race condition のいずれの経路でも一度は呼ばれる設計。冪等性が担保されているので重複なし

---

## 🎉 2026-05-16 協力会社車両運用機能 全Phase完了 + 動作確認済

### 最終ステータス
| Phase | 内容 | 状態 |
|---|---|---|
| 1 | DB変更 (vehicles/maintenance/partner_actions/partner_companies) | ✅ |
| 1.5 | 本体APP車両マスター + 配車表サイドバー🏢 | ✅ |
| 2 | partner.html 新規作成 | ✅ |
| 3 | 自社予約 紫色表示 | ✅ |
| 4 | Slack通知GAS (5分polling) | ✅ |
| 5 | スマホ最適化 + 既存APP風UI | ✅ |
| 6 | 協力会社マスター編集UI | ✅ |
| 7 | 請求書機能 + レベニュー率 | ✅ |
| 8 | プロテクト実装 (5層) | ✅ |
| **動作確認** | **partner.html → Slack 通知** | **✅完了** |

### 確定設定
| 項目 | 値 |
|---|---|
| URL | https://nosh2318.github.io/spk-task/partner.html?owner=&lt;ID&gt; |
| Slack通知先 | `#partner予約管理` (`C0B451BSK1B`) |
| 通知間隔 | 5分polling (notifyPartnerActions GAS) |
| 通知対象アクション | `partner_reserved_add` / `partner_reserved_delete` / `maintenance_delete` のみ |
| 通知メッセージ | 車種 + 日程 + 協力会社名（シンプル化） |
| デフォルトレベニュー率 | 70% |
| 締めスキーム | 返却月締め・翌月支払い |

### Slack Bot 招待状況
- ✅ `#partner予約管理` に `@SNS Auto` 参加済み（2026-05-16）

### クォータ試算
| 項目 | 値 |
|---|---|
| 既存GAS fetch合計 | ~1,600回/日 |
| notifyPartnerActions 追加 | +288回/日（平常時1 fetch/実行） |
| 新合計 | ~1,888回/日 |
| GAS上限20,000に対する使用率 | 9.4%（安全圏） |

### 残作業（本番運用時）
1. 協力会社マスターに正式情報を登録（車両マスター→🏢協力会社マスタータブ）
2. Supabase Auth で協力会社用ログインアカウント発行
3. 協力会社にURL共有

---

## 2026-05-16 続編: Phase 9 通知絞り込み + 動作確認 (v0.4.1〜)

### 通知設定の絞り込み（オーナー指示 2026-05-16）
**通知対象を厳選**:
- ✅ `partner_reserved_add` (自社予約 作成)
- ✅ `partner_reserved_delete` (自社予約 削除)
- ✅ `maintenance_delete` (メンテ削除)
- ❌ `maintenance_add` (メンテ登録は通知しない)
- ❌ `invoice_issued` / `invoice_paid` (請求書系は通知しない)
- ❌ `security_violation` / `save_failed` / `delete_failed` (失敗系は通知しない、ログのみ)

**通知メッセージのシンプル化**: 車種 + 日程 + 協力会社名 のみ（ユーザーメール・メモ・タイムスタンプ削除）

### サマリーカード削減（v0.4.1）
オーナー指示「稼働日 稼働率 削除」
- 4カード（所有車両/今月予約/稼働日/稼働率）→ 2カード（所有車両/今月予約）に簡素化
- updateSummary 関数の calcUtilByVehicle 等のロジックも削除して軽量化

### バグ修正記録
| バージョン | バグ | 修正 |
|---|---|---|
| v0.3.0→v0.3.1 | `maintenance` テーブルに `memo` カラム無く保存エラー | `memo` → `maint_notes` に変更 (`4104e3c`) |
| v0.3.1→v0.3.2 | `maintenance.id` TEXT型 NOT NULL でid生成漏れ | `id='pm'+Date.now()+random` で本体APP互換生成 (`e45012d`) |
| v0.3.2→v0.3.3 | 1月分が画面を占有 | 1行サマリー方式に再設計 (`3c72f3d`) |
| v0.4.0→v0.4.1 | 稼働日/稼働率カード不要 | 2カードに簡素化 (`28814e1`) |

### 動作確認結果（2026-05-16 19:37 JST）
- ✅ partner.html で自社予約 1件 作成 → 削除 を実施
- ✅ GAS testNotifyPartnerActions で 1 new actions 検出
- ✅ `#partner予約管理` に通知投稿成功
- ✅ Bot招待確認: `@SNS Auto さんはすでにこのチャンネルに参加しています。`

### コミット履歴（2026-05-16 セッション）
- `6ecd10f` Phase 1.5 本体APP車両マスター
- `fa17c87` Phase 2 partner.html 新規作成
- `6cc028c` Phase 3+4 紫表示 + Slack通知GAS
- `d6cb037` partner.html v0.2.0 スマホ最適化
- `c0c8e66` Phase 5 協力会社マスター管理UI v4.7.153
- `5b19574` Phase 6 車両編集モーダルから協力会社名直接編集 v4.7.155
- `3c72f3d` Phase 7 予約データタブ コンパクト1行表示 v0.3.3
- `28814e1` Phase 9 サマリーカード簡素化 v0.4.1
- `5fd8a3d` Phase 9 通知絞り込み + #partner予約管理 設定
- `4104e3c` バグ修正 maintenance.memo → maint_notes
- `e45012d` バグ修正 maintenance.id 手動生成
- `6a9a1bc` Phase 8 5層プロテクト実装 v0.4.0

---

## 🆕 2026-05-16 協力会社車両運用機能（Phase 1〜4 実装完了 / Phase 5 受入テスト未）

### 背景・要件（オーナー確定）
協力会社の車両を弊社配車システムに登録し、協力会社側からは自社所有車両のみの配車表+在庫調整ができる仕組みを構築。

**確定仕様**:
1. 車両マスターに「所有者」情報を登録（自社=HANDYMAN / 協力会社=PARTNER_XXX）
2. 既存配車表をベースに運用（FleetTimeline + データタブ）
3. 協力会社が自社所有車両の在庫調整（自社予約・メンテ登録）可能
4. 専用画面 `partner.html` で「自社所有車両のみ」を表示
5. 同一 `maintenance` テーブルなので弊社マスター配車表に自動連動
6. 協力会社の操作は Slack 通知（GAS 5分polling）
7. **マスター予約タイムラインはそのまま見せてOK**（顧客名・売上金額もマスク無し）
8. 認証: 1社1共有アカウント方式（Supabase Auth）
9. 弊社配車表で自社予約は **🟣紫色** で表示（メンテは🔵青のまま）

**URL**: https://nosh2318.github.io/spk-task/partner.html

### DB変更（適用済 2026-05-16）

| テーブル | 変更内容 |
|---|---|
| `vehicles` | `owner_company TEXT DEFAULT 'HANDYMAN'` + `owner_label TEXT` 追加 |
| `maintenance` | `block_type TEXT DEFAULT 'maintenance'` + `owner_company TEXT` 追加 |
| `partner_actions` | 新規テーブル（操作ログ・Slack通知キュー） |
| `partner_companies` | 新規テーブル（協力会社マスター） |

SQLファイル:
- `~/spk-task/partner_db_migration.sql`（vehicles / maintenance / partner_actions）
- `~/spk-task/partner_companies_table.sql`（partner_companies）

### Phase別実装内容

| Phase | 内容 | バージョン | コミット |
|---|---|---|---|
| 1 | DB変更（DDL実行） | — | — |
| 1残 | partner_companies テーブル | — | — |
| **1.5** | 本体APP車両マスター + 配車表サイドバー🏢 | v4.7.151 / spk-v700 | `6ecd10f` |
| **2** | partner.html 新規作成 | v0.1.0 | `fa17c87` |
| **3** | 本体APP配車表で `partner_reserved` を紫表示 | v4.7.152 / spk-v701 | `6cc028c` |
| **4** | partner.html スマホ最適化 + 既存APP風UI | v0.2.0 | `d6cb037` |
| 4-GAS | Slack通知GAS (`notifyPartnerActions`) | — | `6cc028c` |

### 本体APP (`index.src.html`) の主要変更点

| 場所 | 変更 |
|---|---|
| L485 / L488 | `DB.fetchVehicles` / `saveVehicles` に `ownerCompany`/`ownerLabel` マッピング追加 |
| L490 | `DB.fetchPartnerCompanies` ヘルパー新規 |
| L538 | `DB.fetchMaintenance` / `saveMaintenance` に `blockType`/`ownerCompany` 追加 |
| L1322 | EMPTY に `ownerCompany:'HANDYMAN'` / `ownerLabel:''` |
| L1331 | `partnerCompanies` state + `DB.fetchPartnerCompanies()` 自動取得 |
| L1355 | `openEdit` に owner 引き継ぎ |
| L1500-1525 | 車両編集モーダル「基本情報」タブ末尾に🏢所有者情報セクション追加 |
| L11734 | 配車表サイドバーに🏢協力会社ラベル表示（自社車両は何も表示せず） |
| L11738 | FleetTimeline バー描画で `block_type='partner_reserved'` を 🟣紫斜線 表示 |

### partner.html 構成（v0.2.0）

- **シングルファイル** （659行・素のJS+DOM・React不使用）
- **2タブ**: 📅 配車表 / 📋 予約データ
- **既存APP風UI**: クラスグループヘッダ + 車両セル + タイムライン
- **スマホ最適化**: viewport-fit=cover, input fontsize 16px, タップ領域44px, モーダル下部スライドイン
- **OTA別カラー**: じゃらん赤 / 楽天赤 / スカイ紫 / エアトリ水色 / HP青 / RC緑 / G黄
- **在庫調整モーダル**: 空セルクリック → 自社予約/メンテ選択 → DB登録 + partner_actions ログ
- **既存ブロック編集**: 自社が登録したブロックのみ編集可（他社管理データは編集不可ガード）

### Slack通知GAS (`gas-email-import-v2.gs` L4417-)

```js
var PARTNER_NOTIFY_CHANNEL = JALAN_PAY_CHANNEL; // 暫定: #payment_sapporo
function notifyPartnerActions() { ... }  // 5分polling
function setupPartnerNotifyTrigger() { ... }  // トリガー設定（1回手動実行）
function testNotifyPartnerActions() { ... }  // 動作確認用
```

通知例:
```
🟣 協力会社 操作通知 - 自社予約 登録
🏢 〇〇モータース
👤 partner001@g-lines.jp
🚗 A ヴェルファイア (7673)
📅 2026-05-20 〜 2026-05-22
💬 メモ: 整備のため貸出不可
⏰ 2026/5/16 17:45:00
```

### 残作業（次回セッション）

1. **partner.html 受入テスト**:
   - テスト車両を PARTNER_TEST 所有に変更（推奨: 既存予約多数の 7673 ヴェルファイア や 8529 ソリオ）
   - https://nosh2318.github.io/spk-task/partner.html?owner=PARTNER_TEST
   - スマホ + PC で表示確認
   - 自社予約モーダルで在庫ブロック → 弊社配車表で紫色表示確認

2. **Slack通知GAS有効化**:
   - GASエディタ「札幌予約メール自動配車」に `gas-email-import-v2.gs` 貼付け（4505行）
   - `setupPartnerNotifyTrigger` を1回 ▶️実行（5分トリガー設定）
   - `testNotifyPartnerActions` で動作確認

3. **協力会社マスター編集UI追加**（本体APP）:
   - 現状: SQL でしか追加・編集できない
   - 改善: 設定タブから協力会社追加・編集可能に

4. **Supabase Auth Custom Claims 設定**:
   - 暫定: URLパラメータ `?owner=PARTNER_TEST` で動作
   - 本番: user_metadata or app_metadata に `owner_company` 埋め込み

5. **専用Slackチャンネル作成**（任意）:
   - 現状: `#payment_sapporo` に通知（暫定）
   - 改善: `#partner_handyman` 新規作成 → `PARTNER_NOTIFY_CHANNEL` 変更

### 動作テスト手順（記録用）

```
1. テスト用協力会社登録（完了 2026-05-16）:
   INSERT INTO partner_companies (id, label) VALUES ('PARTNER_TEST', 'テスト協力会社');

2. テスト車両を協力会社所有に変更:
   本体APP > 車両マスター > 7673 ヴェルファイア 編集
   > 基本情報タブ末尾「🏢所有者情報」
   > 所有者種別: 協力会社 / 協力会社: テスト協力会社 / 保存

3. partner.html を別ブラウザ or スマホで開く:
   https://nosh2318.github.io/spk-task/partner.html?owner=PARTNER_TEST
   > ログイン: oshita@g-lines.jp / nosh2318
   > 配車表に車両のタイムラインが表示される

4. 在庫調整テスト:
   > 空セルをタップ → 「🟣自社予約」を選択 → 期間指定 → 登録
   > 本体APP配車表で同じ車両に紫色ブロックが表示される

5. Slack通知確認（GAS設定後）:
   > 5分後 #payment_sapporo に通知投稿される

6. テスト後の戻し方:
   本体APP > 車両マスター > 該当車両 > 所有者種別「自社」に戻す
```

### 教訓 / 設計判断記録

1. **「マスター予約はそのまま見せてOK」というオーナー判断**で大幅にシンプル化（顧客名マスク・売上隠匿等の複雑なRLS不要）
2. **「在庫調整=同一maintenanceテーブル」設計**で弊社マスター連動が自動成立（自動配車GASも既にメンテ車両を除外しているため改修不要）
3. **partner.html は React 不使用・素のJS**で実装（既存APPのReact + Tailwind と異なる設計）。理由: 単一目的・軽量・スマホ表示優先・本体APPからの独立性
4. **URLパラメータ `?owner=PARTNER_TEST`** によるテスト方式が便利（Custom Claims設定なしで即テスト可能）
5. **partner_actions テーブル**で操作ログを残すことで Slack通知 + 監査ログを兼ねる設計
6. **🟣紫色 / 🔵青色** のバー色分けで弊社配車表に協力会社操作が一目で見える

---

## 🆕 2026-05-16 続編: 協力会社運用 Phase 5-7 拡張

### Phase 5: 協力会社マスター管理UI（本体APP v4.7.153）
- 車両マスタータブに「🏢 協力会社マスター」サブタブ新規追加 (`PartnerCompanyMgr` コンポーネント)
- 一覧 / 新規追加 / 編集 / 論理削除（active=false）
- ID は半角英数+アンダースコア自動正規化（partner.html のURLパラメータと連動するため変更不可）
- DB.savePartnerCompany / DB.deletePartnerCompany 追加
- コミット: `c0c8e66`

### Phase 6: 車両マスターから協力会社情報を直接編集（v4.7.155）
- 車両編集モーダル「🏢 所有者情報」セクション拡張
- 協力会社名・担当者名・連絡先・メールを車両編集モーダルで直接編集可
- ドロップダウンに「＋ 新規追加」項目（その場で新規協力会社 ID 自動採番）
- 車両保存時に `partner_companies` に自動 UPSERT + 紐づく全車両の `owner_label` も同期
- コミット: `5b19574`

### Phase 7: 請求書機能 + レベニュー率（v0.3.3）
**DB追加** (`partner_invoice_schema.sql`):
- `partner_companies.revenue_rate NUMERIC(5,2) DEFAULT 70.00` — 協力会社のデフォルト取り分%
- `partner_invoices` 新規テーブル: id / owner_company / year_month / total_revenue / revenue_rate / partner_share / status (pending|sent|paid) / sent_at / paid_at / memo / payload

**partner.html 改修** (予約データタブ全面リライト):
- 返却月締め × 車両別 グループ化（`r.return_date.substring(0,7)` でグルーピング）
- 翌月支払い 自動算出表示
- 1行サマリー方式（クリックで展開 → 車両別明細）
- レベニュー率インライン編集（500ms debounce で自動 DB 保存）
- 御社売上 = 売上 × レート / 100 即時計算
- CSV ダウンロード（BOM付き Excel 互換）
- 請求書発行ボタン（status pending → sent）
- 入金確認ボタン（status sent → paid）
- コミット: `3c72f3d`

### バグ修正履歴
| バージョン | バグ | 修正 |
|---|---|---|
| v0.3.0 → v0.3.1 | `maintenance` テーブルに `memo` カラム無く保存エラー | `memo` → `maint_notes` に変更 (`4104e3c`) |
| v0.3.1 → v0.3.2 | `maintenance.id` TEXT型 NOT NULL でid生成漏れ | `id='pm'+Date.now()+random` で本体APP互換生成 (`e45012d`) |
| v0.3.2 → v0.3.3 | 1月分が画面を占有・複数月見えない | 1行サマリー方式 + クリック展開に再設計 (`3c72f3d`) |

### 認証外し検討中（未決）
オーナーから「ログイン外せますか」要望。3案検討:

| 案 | 内容 | リスク |
|---|---|---|
| 1 | anon ポリシー全許可 | ❌弊社全データ漏れ |
| 2 | 協力会社のみ anon SELECT | △URLパラメータで他社も見える |
| 3 | Supabase Edge Function 経由 | ◎安全（要実装・半日工数）|

→ 採用方法は **未決**。決定後に SQL/実装着手。
※ 現状は **認証維持** で運用継続（複数協力会社運用に向けてプロテクト実装済）

### Phase 8: 複数協力会社運用 プロテクト実装（v0.4.0 / 2026-05-16）
オーナー要望「複数使うことになります。最低限のセキュリティやバグ・データ保持・消えないデータ プロテクト実装」を受けて5層プロテクト追加。

**5層プロテクト**:
| # | 層 | 実装内容 |
|---|---|---|
| 1 | データ整合性検証 | `loadData()` で `owner_company !== OWNER_COMPANY` の車両を強制除外（DB+クライアント二重） |
| 2 | 削除保護 | `confirm`（詳細表示）→ `prompt('削除')`（文字列入力）の二段階 + 削除前スナップショット保存 |
| 3 | 入力検証 | 期間最大90日 / メモ最大500字 / 過去日警告 / 必須項目 |
| 4 | 所有者検証 | 編集・削除時に他社データへのアクセスを物理拒否 + security_violation ログ |
| 5 | 監査ログ | 全操作で `partner_actions.payload` に before/after/error 記録（事後復元可能） |

**請求書系プロテクト**:
- 発行時: 件数・総売上・レート・御社売上を明示確認
- 再発行: status=sent/paid からの戻しに追加確認
- 入金確認: 御社売上金額を明示・確定後は変更不可警告
- 失敗もログ記録（事後対応用）

**ログ用 partner_actions.action_type 追加**:
- `security_violation` - 他社データへの不正アクセス試行
- `save_failed` / `delete_failed` - 保存・削除失敗（事後対応用）

コミット: `6a9a1bc`

### 関連ファイル一覧
- `~/spk-task/partner.html` (v0.3.3 / 845行)
- `~/spk-task/partner_db_migration.sql` (vehicles + maintenance + partner_actions)
- `~/spk-task/partner_companies_table.sql` (partner_companies)
- `~/spk-task/partner_invoice_schema.sql` (revenue_rate + partner_invoices)
- `~/spk-task/index.src.html` L483-491 (DB CRUD関数群)
- `~/spk-task/index.src.html` L1322-1332 (state)
- `~/spk-task/index.src.html` L1359-1410 (saveVehicle で partner_companies 自動UPSERT)
- `~/spk-task/index.src.html` L1502-1540 (車両編集モーダル 🏢所有者情報セクション)
- `~/spk-task/index.src.html` L11734 (配車表サイドバー 🏢ラベル)
- `~/spk-task/index.src.html` L11738 (FleetTimeline 紫バー描画)
- `~/spk-task/index.src.html` L2487-2613 (PartnerCompanyMgr 協力会社管理UI)
- `~/spk-task/gas-email-import-v2.gs` L4417- (notifyPartnerActions GAS)

### 確定済み運用ルール
- 返却月締め・翌月支払い (例: 5月返却分 → 6月支払い請求書発行)
- レベニュー率デフォルト 70%（partner_companies.revenue_rate）
- 月単位で個別レート設定可能（partner_invoices.revenue_rate）
- 車両編集モーダルから新規協力会社作成可能（ID自動採番: `PARTNER_<timestamp下6桁>`）
- maintenance.id プレフィックス: `m`=本体APP / `pm`=partner.html（識別可能）

### 次回再開時の TODO（未着手）

1. **認証外し方針決定** → 採用案で実装
2. **partner.html 受入テスト**（テスト車両 → 動作確認）
3. **Slack通知GAS 有効化**（GASエディタで `setupPartnerNotifyTrigger` 実行）
4. **Supabase Auth Custom Claims**（本番運用前に user_metadata 設定）
5. **専用Slackチャンネル作成**（任意）

---

## 🔴 2026-05-14 入金通知の店舗判定 fail-safe化（那覇通知が札幌に漏れる障害対策）

### 症状
`#payment_sapporo` に那覇予約 SP-20260507-0001/0002/0003（株式会社谷川電気工事 各¥7,650・予約外売上）の
「✅ 入金確認完了」通知が3件流れた。通知文の「店舗：」が**空欄**になっていた。

### 真因
SPK GAS `gas-email-import-v2.gs` L1752 (旧) の店舗判定:
```js
var notifyChannel = (pay.store.indexOf('那覇') >= 0 || pay.store.indexOf('沖縄') >= 0)
  ? NAHA_PAY_CHANNEL : JALAN_PAY_CHANNEL;
```
- 店舗判定は**スプシC列「利用店舗」の文字列に「那覇」or「沖縄」が含まれるか**だけ
- C列が空欄 → `indexOf('那覇')===-1` → **デフォルトで札幌(JALAN_PAY_CHANNEL)に流れる**設計
- CLAUDE.md グローバルルール「**那覇の入金通知が札幌に飛ぶのは絶対禁止**」違反

`checkUnpaidAlert` (L1862) にも同型バグあり。C列空欄なら札幌の `reservations` を見に行く。

### 修正（3段階 fail-safe ヘルパー）
新規 `resolvePaymentStore_(resvNo, sheetStore)` を gas-email-import-v2.gs に追加（入金確認 v3 の手前）:

| Step | 条件 | 振り分け先 | source |
|------|------|----------|--------|
| 1 | C列に「那覇/沖縄」明記 | NAHA のみ | `sheet` |
| 1 | C列に「札幌」明記 | SPK のみ | `sheet` |
| 2 | C列空欄 + nha_accounting にヒット | NAHA のみ + 警告（スプシ要補修） | `db` |
| 2 | C列空欄 + spk_accounting にヒット | SPK のみ + 警告 | `db` |
| 2 | C列空欄 + 両テーブルにヒット | **両店通知** + 警告（整合性要確認） | `ambiguous` |
| 3 | C列空欄 + DB照合失敗 | **両店通知** + 警告（手動確認＋スプシ補修） | `fallback` |

**ポイント**: 判定不能時は札幌に勝手に流さず、両店通知で「警告マーク + 判定根拠」を明示する設計。
通知文には `判定根拠: sheet|db|ambiguous|fallback` を必ず付与。

### 適用箇所
1. `checkPaymentStatus` L1752付近のチャンネル振り分けロジック差し替え
2. `checkUnpaidAlert` L1884付近のチャンネル振り分けロジック差し替え（同型バグ修正）
3. 新規 `testResolvePaymentStore` — 動作確認用（GASエディタ▶️実行）
4. 新規 `backfillPaymentSheetStore(dryRun)` — スプシC列空欄行をDB照合で補修
   - `backfillPaymentSheetStoreDryRun()`: ログのみ（推奨：先にこれで件数確認）
   - `backfillPaymentSheetStoreApply()`: スプシ更新実行

### 適用手順
1. GASエディタ「札幌予約メール自動配車」プロジェクトを開く
2. `gas-email-import-v2.gs` を Cmd+A → Cmd+V → Cmd+S（クリップボードに pbcopy 済）
3. （任意）`testResolvePaymentStore` を実行 → スクショ3件が source=db / channels=NAHA と判定されるか確認
4. `backfillPaymentSheetStoreDryRun` を実行 → ログで補修対象を確認
5. 問題なければ `backfillPaymentSheetStoreApply` を実行 → スプシC列を埋める
6. **トリガー再デプロイ不要**（コード保存だけで次回トリガー時に新コード実行）

### Lesson（再発防止ルール）
1. **「単一データソースのデフォルト振り分け」は危険**: スプシC列のような単一フィールドに依存した条件分岐で「該当しなければ別店舗」のフォールバックは、データ欠損で誤通知を生む
2. **店舗判定は必ず複数経路で検証**: スプシ／DB／予約番号プレフィックスのいずれか2つ以上で一致させる
3. **判定不能時は「両店通知 + 警告」がデフォルト挙動**: 「とりあえず札幌に流す」のような選択は店舗分離原則を破壊する
4. **通知文に判定根拠を必ず明示**: 通知を受けたスタッフが「これは確定情報か推定情報か」を即座に判断できる
5. **既存の checkPaymentStatus / checkUnpaidAlert の同型バグを横展開チェック**: 「店舗振り分け」をする関数を新規追加時は、必ず resolvePaymentStore_ を経由する

### 実施結果（2026-05-14 13:38〜13:44 JST 完了）

#### Step 1: 動作確認 `testResolvePaymentStore` (13:38)
全6パターン期待通り判定:
| ケース | 期待 | 実結果 |
|---|---|---|
| SP-20260507-0001/0002/0003 (C列空) | NHA (db判定) | ✅ source=db channels=NAHA |
| 予約番号空 + C列空 | fallback | ✅ source=fallback channels=NAHA,SPK |
| C列=札幌店 | SPK (sheet) | ✅ source=sheet channels=SPK |
| C列=那覇空港店 | NHA (sheet) | ✅ source=sheet channels=NAHA |

#### Step 2: DryRun `backfillPaymentSheetStoreDryRun` (13:43)
スプシ走査結果: **fixed=11 ambiguous=0 unknown=0** （クリーンな結果）

#### Step 3: Apply `backfillPaymentSheetStoreApply` (13:44)
11件全部「那覇空港店」で補修成功:
| Row | 予約番号 | 補修後 |
|---:|---|---|
| 68 | `*RC72461092715277535*` | 那覇空港店 |
| 74 | TIS74969 | 那覇空港店 |
| 80-82 | SP-20260507-0001/0002/0003 | 那覇空港店（スクショの当該3件） |
| 84-85 | SP-20260507-0004/0005 | 那覇空港店（5/11 重複障害本体） |
| **86-87** | **SP-20260507-0004/0005**（重複） | 那覇空港店 |
| 89 | 2604001235 | 那覇空港店 |
| 98 | SP-20260511-0002 | 那覇空港店 |

### 残課題（緊急度低）

| # | 内容 | 緊急度 |
|---|---|---|
| 1 | Row 86/87 重複行 (SP-20260507-0004/0005 が Row 84/85 と完全重複) → CLAUDE.md (NHA) 「2026-05-11 重複障害」の残骸がスプシ側に残存 | 中（集計に影響の可能性） |
| 2 | Row 68 予約番号にアスタリスク `*RC72461092715277535*` → Slack 太字装飾 `*xxx*` が予約番号として入った可能性。どこかのパース処理にバグ | 中 |
| 3 | Layer 2 真因（C列が空欄になった経路の特定）→ HANDYMAN Payment Bot `recordToSheet_` の `parsed.store` 取得失敗 or 那覇GAS `appendToPaymentSheet_` の店舗書き込み漏れ | 低（fail-safe で再発影響なし） |

### コミット予定
- `gas-email-import-v2.gs` 修正済（4401行）→ GASエディタへ貼付＋保存済（2026-05-14 13:38）
- スプシ補修済（11件 Apply 完了 2026-05-14 13:44）
- CLAUDE.md（SPK）に本記録追加

### 関連ファイル
- SPK GAS: `~/spk-task/gas-email-import-v2.gs` L1701-1764（`resolvePaymentStore_` ヘルパー + `testResolvePaymentStore`）
- SPK GAS: L1808付近（`checkPaymentStatus` ロジック差し替え）
- SPK GAS: L1922付近（`checkUnpaidAlert` ロジック差し替え）
- SPK GAS: L4156-4221（`backfillPaymentSheetStore` + DryRun/Apply ラッパー）
- 支払い管理スプシ: `1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc` シート「支払い管理」C列

---

## 🔴 2026-05-13 修正履歴 — ログイン画面の致命バグ + 予算実績タブ Auth対応

### バージョン推移
- v4.7.131 → v4.7.137 まで6連続デプロイ（同日中の連続修正）
- 最終: v4.7.137 / spk-v686

### 🚨 ensureAuthenticated() 二重起動バグ（最重要）
- **症状**: 札幌店スマホ（iOS Safari）でログイン画面のログインボタンを押しても完全に無反応。タップ検知バナーも診断情報も出ない
- **真因**: `ensureAuthenticated()` が **2箇所から呼ばれて overlay が DOM に2個生成** されていた
  - L280: モジュール起動時 → 1つ目の overlay
  - L17498: React Root useEffect → 2つ目の overlay（上に重なる）
- **発生メカニズム**:
  1. body 直下に同じ ID の overlay が2個積まれる
  2. `document.getElementById('spk-auth-tap')` は ID衝突時 **最初の要素（=1つ目の overlay）** を返す（DOM仕様）
  3. ユーザーがタップするのは **2つ目（上）の overlay のボタン**
  4. JS が更新するのは **1つ目（下に隠れた）の overlay の要素**
  5. → ユーザーの目には何も変わらない
- **修正 (v4.7.137)**: `_spkAuthPromise` でシングルトン化
  ```js
  let _spkAuthPromise = null;
  async function ensureAuthenticated() {
    if (_spkAuthPromise) return _spkAuthPromise;  // 2回目以降は同じPromise
    _spkAuthPromise = (async () => {
      await sbAuthPromise;
      if (sbCurrentUser) return true;
      if (document.getElementById('spk-auth-overlay')) return new Promise(()=>{}); // フェールセーフ
      return new Promise((resolve) => { /* overlay 生成は1回だけ */ });
    })();
    return _spkAuthPromise;
  }
  ```

### 🔴 Lesson: 「ID 衝突 + DOM appendChild」の罠
- `getElementById` は ID 重複時に常に最初の要素を返す → ユーザーが見ている上層 DOM とは別の DOM が更新される
- React の useEffect で非同期処理を呼ぶ箇所は **必ずシングルトン化** する
- overlay 系・modal 系は「既存 DOM チェック → 再利用 or 中止」のガードを必ず入れる
- これを設計時に意識していないと、本症状（押しても無反応・診断情報空白）が再発する

### 予算実績タブ Auth Token 対応 (v4.7.134)
- **症状**: 「予算実績タブの数字が全て消えた」「コスト内訳も消えた」
- **真因**: `monthly.html` / `costmatrix.html` が `Bearer + SK`（anon キー）固定で fetch していた。2026-05-13 朝の anon ポリシー削除で全テーブル `[]` 返却
- **修正**:
  - `authHeader()` ヘルパー追加: localStorage の Supabase auth-token を取得して `Bearer <auth_token>`
  - `_extractAccessToken()` で **Supabase JS V2 の5形式に対応**（`{access_token:""}` / `{currentSession:{...}}` / `{session:{...}}` / `[token,refresh]` / 文字列）
  - 取れない時は `sb-*-auth-token` 全キーを fallback 走査
- **PIN 1215 追加 (monthly.html のみ)**: 予算実績タブ専用ロック（毎回要求）

### スマホ向けログインボタン強化 (v4.7.134-136)
- input フォントを **16px** に拡大 → iOS の自動ズームを防ぐ
- input に `autocapitalize=off` `autocorrect=off` `inputmode=email`
- button を **inline onclick** に変更（addEventListener 不安定対策）
  - `<button onclick="window._spkLoginTap()">` で確実発火
  - `window._spkLoginTap` / `window._spkFullReset` をグローバル登録
- **タップ検知バナー**追加: 押下瞬間に「🎯 ボタン検知 HH:MM:SS」表示 → 押せているかを目視確認可能
- **キャッシュクリアボタン**追加: SW unregister + caches.delete + localStorage(sb-/spk-/nha-) 削除 → reload
- **診断情報**追加: 画面下に UA / SB-JS / sb / SW / LS / auth 状態を常時表示
- 12秒タイムアウト保護で hang 回避

### 2026-05-13 オペレーションメモ
- iOS Safari は SW キャッシュが頑固に居座る → **重要修正後は「設定→Safari→履歴とWebサイトデータを消去」をスタッフ全員に周知必須**
- ホーム画面アイコン化された PWA は SW 更新がさらに遅れる → 「アイコン削除 → URLから再追加」が確実
- セキュリティ強化後にデータ取得失敗が起きたら、まず anon キー直叩きで `[]` 返るか curl 検証する

---

## 2026-05-10 修正履歴 — 大規模追記

### 🚨 緊急: SPK reservations から重複5件物理削除
- **症状**: 札幌APP配車表に那覇予約 RC12461128273853518 ヤマダ テッペイ様（5/13 Aクラス）が表示される
- **真因**: 楽天メール取込GAS の `isSapporoReservation_` 判定が誤動作 → SPK と NHA 両方に同一予約番号で登録 → 那覇所属判明後 SPK は cancelled にしただけで物理削除しなかった
- **削除実施**:
  | 予約番号 | 名前 | 状態 |
  |---|---|---|
  | RC12461128273853518 | ヤマダ テッペイ | 楽天 / Aクラス / 5/13-15 |
  | AEU53482 | 小村 拓翔 | HP / Fクラス / 5/16 |
  | R0LE1AKA | キム ヒョンミ | じゃらん / D_OKI / 2026-02 |
  | SP-20260420-0001 | テスト太郎 / 塗田さちえ | SP-ID 衝突 |
  | ZMG04202 | 細谷 直子 | HP / 赤嶺駅 |
- **削除対象**: SPK の reservations / fleet / tasks 物理削除（NHA は正所属のため残す）
- **検証**: ページネーション全件で SPK=247 / NHA=1877 / 重複=0件 確認

### 🔄 checkUnpaidAlert 店舗振分け修正 (gas-email-import-v2.gs)
- **症状**: 札幌 #payment_sapporo の未入金アラートに 那覇予約 R0J20ZUY コボリ セイヤ様 ¥4,000（5/13） が混入
- **真因**: `checkUnpaidAlert` がスプシ「支払い管理」全件をチェック → 全て JALAN_PAY_CHANNEL（札幌）に通知（店舗振分けなし）
  - `checkPaymentStatus` は 2026-04-20 に店舗振分け対応済みだったが `checkUnpaidAlert` だけ未対応で残っていた
- **修正**:
  - スプシC列「店舗」を読取
  - 「那覇」or「沖縄」 → `nha_reservations` から start_date 取得 → `#payment_naha (C0AP2S5B147)`
  - それ以外 → `reservations` から lend_date 取得 → `#payment_sapporo (JALAN_PAY_CHANNEL)`
  - チャンネル別 alerts を集計してそれぞれに通知

### 🛑 自動返金 Bot 完全廃止 (payment_bot_unified_v1.gs)
- **発端**: R0UIIOPU ミズシマ タカミ様（札幌じゃらん）に Slack「キャンセル / 料率0%」投稿 → Bot が以下の致命的誤動作:
  1. **金額誤り**: 返金額 ¥9,150（実際の決済額は ¥6,750）
  2. **Square Refund API 完全スキップ**（Bot ログ「Square返金スキップ（事前決済なし）」）
  3. **DB だけ `status='refunded'` に書換** → 「返金済み」虚偽記録
  4. お客様カードへの実返金は未実行（Square取引履歴 5/10 0件で確証）
- **真因**:
  - `lookupReservationForCancel_` の `isJalanPaid` 判定が `jp.status === 'paid'` のみ
  - メール受信時の `handleJalanPaymentCancel_` で先に `'paid' → 'refund'` に書換済 → Bot 実行時には `paid !== 'refund'` で `isJalanPaid=false`
  - → fallback で `r.price=¥9,150` 採用（実際は jp.amount=¥6,750）
  - → Square Refund もスキップ
- **対応決定（オーナー指示）**: 「この機能動かないと危ないのでやめます。自動返金機能 バラしてください。アラートだけ残して」
- **修正内容**:
  - `handleSlackMessage_` の「キャンセル」キーワード分岐を `handleCancellationMessage_` 呼出 → **廃止メッセージ Slack返信のみ** に変更
  - `handleCancellationMessage_` / `lookupReservationForCancel_` / `squareRefund_` は将来再有効化のため残置
  - 廃止メッセージで手動返金手順案内: ① Square Dashboard 払い戻し ② APP データタブ status=cancelled ③ APP 会計タブ起票
- **影響**: SPK / NHA 共に Slack「キャンセル」投稿は廃止メッセージのみ返却。BUDDICA は元々 Bot 未実装

### 💸 自動返金廃止 → Handover 案内文を3店舗 一括変更
- SPK v4.7.125 / spk-v677 / NHA v3.5.18-NHA / BUDDICA v1.0.21-BT
- 旧: 「💡 自動返金: #payment_sapporo に「キャンセル / 予約番号:XXXXX / キャンセル料率:N」を投稿」
- 新: 「⚠️ 自動返金は廃止（2026-05-10）。手動で対応してください: ① Square Dashboard で「払い戻し」 ② APP 会計タブで起票 ③ APP データタブで status=cancelled」
- BUDDICA: terser 不在で unminified、Babelが日本語を `自動返金` 形式に Unicode エスケープ出力するため grep では hit しないが、ブラウザ実行時には正常デコード表示

### R0UIIOPU 残留問題（要オーナー手動対応）
- お客様への実返金: Square Dashboard で **¥6,750（レシートZ02j / 3/19 / AmEx末尾5964）** を手動返金
- DB訂正:
  - `jalan_payments.memo`: 「返金¥9,150」→「Square手動返金¥6,750」
  - `spk_accounting` 起票額の差¥2,400 補正
  - `refunded_at` を実返金時刻に更新

---

### 🔁 自動返金 Bot を NHA に拡張（payment_bot_unified_v1.gs）— 上記廃止により無効化済
- **背景**: 「返金待ち Handover を3店舗（SPK/NHA/BUDDICA）に実装」と並行して、自動返金Bot（`payment_bot_unified_v1.gs`）も NHA 対応が必要だった
  - 旧: `lookupReservationForCancel_` の那覇分岐は `isJalanPaid: false` 固定 = 自動返金されず会計起票（unpaid）のみ
  - 新: 那覇も `nha_jalan_payments` 参照 → paid なら Square Refund API 実行 → status='refunded'
- **修正内容（`payment_bot_unified_v1.gs`）**:
  1. **`lookupReservationForCancel_` L1280-1300**: 那覇分岐に `nha_jalan_payments` 参照追加
     - `isJalanPaid` を実態判定
     - 戻り値に `jalanTable: 'nha_jalan_payments'` 追加
  2. **`handleCancellationMessage_` L1162-1185 (旧)**: 'jalan_payments' 固定リテラル → `lookup.jalanTable || 'jalan_payments'` 動的切替
  3. **refunded_at フォールバック**: NHA テーブルに refunded_at カラムが無い場合の二段階リトライ実装
- **動作**: スタッフが `#payment_naha` (C0AP2S5B147) に投稿:
  ```
  キャンセル
  予約番号：R0XXXXXX
  キャンセル料率：N (0/30/50/100)
  ```
  → Bot が `nha_jalan_payments` で paid 確認 → Square Refund API → DB更新 → Slack完了報告
- **店舗別対応マトリクス**:
  | 店舗 | チャンネル | 返金待ちアラート | Slack自動返金Bot |
  |---|---|:---:|:---:|
  | SPK | #payment_sapporo | ✅ v4.7.119 | ✅ 既存 |
  | NHA | #payment_naha | ✅ v3.5.17-NHA | ✅ **本修正で対応** |
  | BUDDICA | （未開設） | ✅ v1.0.20-BT | — チャンネル無し |
- **BUDDICA 対応保留**: オーナー判断「BUDDICAはまだチャンネルないのでいいです」→ Handover表示のみ実装済
- **🔮 BUDDICA 将来対応 TODO（2026-05-10時点・要設定後着手）**:
  1. Slack チャンネル `#payment_buddica`（仮）作成 → channel ID取得
  2. BUDDICA独立 Square アカウント作成 → API トークン発行
  3. `payment_bot_unified_v1.gs` 改修:
     - 新定数 `CH_BUDDICA = 'CXXXXXXXXXX'`
     - 新ScriptProperty `SQUARE_TOKEN_BUDDICA`
     - `lookupReservationForCancel_` に BUDDICA 分岐追加（btr_reservations + bt_jalan_payments）
     - `handleCancellationMessage_` の channel ルーティングに BUDDICA 追加
     - `squareRefund_` で cfg.squareToken をチャンネル別切替（SPK/NHA は HANDYMAN本体, BUDDICA は独立トークン）
  4. `getOrderIdFromSheet_` の支払い管理スプシで「BUDDICA店」行も検索対象に

### 💸 返金待ち Handover を TOP に追加 (v4.7.119 / spk-v674)
- **背景**: R0R8QVZR モギ ユウヘイ様 ¥40,950（5/17-19キャンセル）が「⚠️ 返金対応必要」とSlack通知されたが、`handleJalanPaymentCancel_` 内で `status='refund'` 書込が失敗していて DB上は status='paid' のまま放置。じゃらん決済タブの「返金待ち」フィルタにも入らず、TOPでもアラートが出ず、見逃される構造
- **オーナー要望**: 「返金待ちに案件がある場合はTOPにアラート出す」「Handoverに出す」
- **実装内容**:
  1. **R0R8QVZR DB訂正**: `jalan_payments.status paid → refund` PATCH
  2. **MemoBox に「💸 返金待ち Handover」セクション追加** (`index.src.html` L9663付近)
     - state: `refundPending`
     - DB条件: `paid_at IS NOT NULL AND cancelled_at IS NOT NULL AND refunded_at IS NULL AND status != 'refunded'`
     - 60秒間隔ポーリング更新
     - 表示位置: 既存「💳 Square未決済 Handover」の直下、「🔴 本日のHandover」の直前
     - 紫系デザイン（背景 #faf5ff / 枠 #d8b4fe / アクセント #7c3aed）
     - 件数バッジ + 各件: 名前/予約番号/金額/利用予定日/キャンセル経過日数
     - Squareリンク直接遷移ボタン
     - フッターに自動返金手順: `#payment_sapporo` に「キャンセル / 予約番号:XXXXX / キャンセル料率:N」を投稿でBot自動返金
- **同型バグ調査**: 入金済み + キャンセル済み + 未返金 = 2件
  - R0UIIOPU ミズシマ タカミ ¥6,750 (5/8キャンセル)
  - R0R8QVZR モギ ユウヘイ ¥40,950 (5/9キャンセル) ← 今回修正
- **既存「返金待ち」分類との関係**: APP のじゃらん決済タブ (`index.src.html` L3045) は既に `status='refund'` ラベル定義済み。R0R8QVZR を refund に直したことで自動的にタブにも表示されるようになった
- **🔴 教訓**:
  - **`handleJalanPaymentCancel_` の `status='refund'` 書込が失敗するバグ**が潜在している可能性。今回 R0R8QVZR は cancelled_at だけ書かれて status は paid のままだった。原因不明だが、`'refund'` enum値がjalan_payments.status の許容値に入っていない or PostgREST の部分成功などが疑われる。次回同症状が出たら詳細ログを見る
  - **「DBに無い状態を Slack 通知だけで案内する」は見逃しの温床**: 今回も4日間気づかれなかった。**TOPに常時表示するアラート Handover**が最も確実な見逃し防止
- **コミット予定**: `index.src.html` / `index.html` / `index2.html` / `sw.js` / `CLAUDE.md`
- **バージョン**: APP_VERSION v4.7.118 → **v4.7.119** / sw.js spk-v673 → **spk-v674** / index.html CV=spk-v674 / sw.js?v=578 → **579**

---

## 2026-05-09 修正履歴

### 🐛 じゃらん people パース致命バグ — 「子供（12歳未満）」の `12` を子供数と誤認
- **発覚契機**: 5/8 取込の R0MWIFG8（冨名腰 槙吾様 / 6/23-25 / Aクラス）が **大人5+子供3=8人** なのに DB `people=0` 登録。オーナー指摘「人数の情報が取れてない」
- **真因**: `parseJalan_` L619 の正規表現 `/子供.*?(\d+)/` が `子供（12歳未満）3人` の **(12)** を子供数として誤マッチ
  - 計算経路: 大人5 + 子供12（誤）= **17** → L621 `if (people > 10) people = 0` で **0クランプ → 記録ロスト**
- **同型バグ被害**: じゃらん予約で `people=0 & status≠cancelled` が **13件**検出
  - 例: ヤマモト ミヨコ / ダイ チヨコ / マスナガ ジュンイチ / ベンバチャ エミナ / 他9件
- **修正内容（`gas-email-import-v2.gs` 3パーサー）**:
  - **`parseJalan_` L619**: 「`（12歳未満）`」等の括弧書きを除去してからパース
    ```
    var cleanStr = (peopleStr || '').replace(/[（(][^）)]*[）)]/g, '');
    var pM = cleanStr.match(/大人\s*(\d+)/);
    var cM = cleanStr.match(/子供\s*(\d+)/);
    ```
  - **`parseSkyticket_`**: 同型対策で括弧除去を予防的に追加
  - **`parseOfficial_`**: クランプロジック統一
  - **クランプ厳密化**: 旧 `>10 → 0`（記録ロスト） → 新 `>8 → 8`（CLAUDE.md グローバル「OTA予約 people 最大8人ルール」準拠）
- **被害復旧**:
  - R0MWIFG8: DB people=8 に PATCH 完了
  - 残12件: 新規関数 `backfillJalanPeople()` で Gmail から再パース → DB更新（要GAS手動実行）
- **🔴 教訓**:
  - **`.*?` 最短マッチは括弧内の数字を拾う**: 「子供（12歳未満）」のような括弧書きが含まれるフィールドは、**括弧除去前処理が必須**
  - **`>10 → 0` クランプは記録ロスト**: 「異常値は0にする」より「8でキャップする」方が実害最小（CLAUDE.md グローバルルール準拠）
  - **乗車人数バグは1件で気付きにくい**: 13件溜まってからオーナーが気づいた = 集計画面（解析タブ等）で「人数0件」が常時表示されていた可能性。people=0 を検知するアラートを将来的に追加検討
- **コミット予定**: `gas-email-import-v2.gs` 3パーサー修正 + `backfillJalanPeople` 関数追加

---

## 2026-05-08 修正履歴

### 🔴 入金確認 取りこぼしバグ — `'済'` 部分一致を `'入金済'` に厳密化 (4箇所)
- **症状**: R0SFCDMG ヤナギダ ナオヤ様 (¥41,750 / 5/8-5/10) が **2026-05-04 16:07 JST に Square で入金済み**だったにもかかわらず、`jalan_payments.status='email_sent'` のまま 4日間放置。スプシ「支払い管理」のステータス列も「メール送信済」のまま、Slack入金通知も出ず、APP側は未払い表示のまま
- **発覚経路**: オーナーがスプシで R0SFCDMG 行を見て「ステータスが変わってない」と指摘 → Square Orders API で tenders 確認 → Mastercard末尾7530 で ¥41,750 入金確認
- **🔴 根本原因**: `checkPaymentStatus` (15分間隔トリガー) のフィルタ条件:
  ```js
  if (status.indexOf('済') === -1 && status.indexOf('キャンセル') === -1 && url) {
    unpaidRows.push(...);  // 未払い行扱い
  }
  ```
  - スプシ I列に **「メール送信済」**と書かれた行 → `indexOf('済')` で **+1 (false)** 返却 → **未払い行から除外** → checkPaymentStatus が走らない → 入金検知漏れ
  - 「⏳ 未払い」が正規ステータスのはずだが、過去のどこかでスタッフが手動で「メール送信済」に書き換えた、または旧仕様で書き込まれた行が混在していた
  - 同じバグが **4関数** にあった: `checkPaymentStatus` / `checkUnpaidAlert` / `diagnoseRecoveredPayments` / `debugPaymentV3`
- **同型バグ被害者調査**: DB `status='email_sent'` の14件全件を Square Orders API で照合 → R0SFCDMG 1件のみ実際は入金済み、残り13件は本当に未入金
- **修正内容（`gas-email-import-v2.gs` 4箇所）**:
  - 旧: `status.indexOf('済') === -1`（部分一致 → 「メール送信済」も誤マッチ）
  - 新: `status.indexOf('入金済') === -1` ＋ 「発行取消」も除外条件に追加
  - 安全側設計: スタッフが自由文を書いても「入金済」「キャンセル」「発行取消」のいずれかが明示されていない限り未払い行扱い
- **R0SFCDMG 復旧対応**:
  - DB: `jalan_payments.status email_sent → paid` / `paid_at = 2026-05-04T07:07:29Z` PATCH 済
  - スプシ: 新規関数 `recoverR0SFCDMGPayment()` 実装（GASで手動実行 → I/J/K列自動更新 + Slack通知）
- **🔴 教訓**:
  - **`indexOf` の部分一致は危険**: 短い文字列(`'済'`)で `indexOf` するとスーパーセット文字列(`'メール送信済'`)も誤マッチする
  - **判定キーワードは具体的にする**: `'済'` ではなく `'入金済'` のように、「意図する状態」を明示する
  - **ステータス値を厳密管理する**: スプシのステータス列に書ける値は「⏳ 未払い」「✅ 入金済み」「❌ キャンセル」「⚠️ 発行取消」「⚠️ 要返金」の5種類のみ。スタッフ向けマニュアルで自由文記入を禁止
  - **GASフィルタは複数関数に同居している**: 4関数同じバグだったので、1箇所修正したらgrepで横展開を確認するルール
- **コミット予定**: `gas-email-import-v2.gs` 4箇所修正 + `recoverR0SFCDMGPayment` 関数追加

---

### 🔧 楽天 price 計上ロジックを NHA と同期 — 過去18件一括補正
- **症状**: SPK `parseRakuten_` の price 計算式が NHA と不一致。SPK は `price = 合計金額(totalR)` をそのまま採用しており、事業者クーポン(弊社負担)を売上から差引いていなかった
- **発端**: 楽天予約 RC52461167634443526（中崎 律様 / 2026-08-27〜30 / Bクラス）取込時、オーナー指摘「料金計上が間違っている / 那覇店と同じ仕様に修正」
  - 合計 ¥53,800 / 事業者クーポン ¥10,000 / 楽天ポイント ¥8,800 → 正しい計上 ¥43,800
  - DB登録は ¥53,800 で誤り（事業者クーポン分が引かれていない）
- **NHA 仕様（正解・L1112-1114 コメント）**:
  > 計上売上 = 合計 − 事業者クーポン（弊社負担分のみ差引）  
  > 楽天クーポン・楽天ポイントは楽天が後精算するため売上に含める
- **修正内容（`gas-email-import-v2.gs` `parseRakuten_`）**:
  - 旧: `var price = totalR > 0 ? totalR : billingR;`
  - 新: `var price = totalR > 0 ? (totalR - couponR) : billingR;`
  - NHA L1125 と完全一致させた
- **過去レコード一括補正（DB直接 PATCH / Gmail不使用＝クォータ消費ゼロ）**:
  - SPK 楽天予約で `discount > 0 & status≠cancelled` を全件抽出 → 29件
  - 監査: `price ≠ base + option - discount` で **18件** 検出
  - 全18件を `price = base + option - discount` で訂正
  - 過大計上12件（売上水増し）/ 過小計上6件（売上過小）混在
  - 純差額 +¥38,937 → 経営DB売上の補正幅
- **🔴 教訓 / 横展開ルール**:
  - **GAS は両店パーサーを必ず同期する**: NHA / SPK で同じパース処理を持つ場合、片方だけ修正して片方を放置すると数値が乖離する。修正時は両店並行レビュー必須
  - **楽天事業者クーポン vs 楽天クーポン/ポイントの会計区別**: 弊社負担(=売上控除) vs 楽天負担(=後精算で弊社収入) は経営判断に直結するため、コメントで明示しておく
  - **Gmail 不要のバックフィル**: `price = base + option - discount` の論理式があれば、過去レコードはメール再パースなしで一括補正できる。Gmailクォータを温存できる
  - **被害規模**: 楽天は事前カード決済済みのため Square過大発行等の金銭被害なし。リスクは経営DB売上計上額のズレのみ
- **コミット予定**: `gas-email-import-v2.gs` の `parseRakuten_` 1箇所修正
- **Slack報告**: `#payment_sapporo` ts=1778191173.256109

---

## 2026-05-06 修正履歴

### 🚨 R0EQE3JK 田草川様 じゃらんポイント全額充当 過大請求障害 — 全層修正
- **症状**: じゃらん予約 R0EQE3JK（田草川 豊様 / 5/25 / Cクラス）が **利用者請求額 ¥0（合計¥7,000 - ポイント¥7,000充当）** にもかかわらず、Square決済リンク ¥7,000 が発行され、お客様にメール送信(5/6 17:31)された
- **根本原因（3層）**:
  1. **`parseJalan_` L635-636**: `var price = billingPrice > 0 ? billingPrice : ...` で 0円の `billingPrice` を「未取得」と誤判定し、合計金額(クーポン前)¥7,000 にフォールバック
  2. **`jalanOverbillFix` L364-369（2026-04-23 修正）**: 発火条件に `+(reservation.price||0) > 0` を含んでおり、parser が price=0 を返すケースを取りこぼしていた → existing.price=¥7,000 がそのまま残存
  3. **`handleJalanPayment_` L1396**: 親側の `if (reservation.price > 0)` ガードに頼っていたが、price=¥7,000（誤った値）が渡るため発火 → Square発行→メール送信
- **緊急対応（オーナー直作業時系列）**:
  | # | 内容 | 結果 |
  |---|---|---|
  | 1 | Square Payment Link DELETE (id: `6PJY4WZG3DCUCKX6`) | ✅ `cancelled_order_id` 返却 |
  | 2 | reservations.price 7000 → 0 (Supabase直接 PATCH) | ✅ |
  | 3 | jalan_payments.status email_sent → cancelled / amount → 0 | ✅ |
  | 4 | Slack `#payment_sapporo` インシデント報告 (ts=1778058157.166719) | ✅ |
  | 5 | 支払い管理スプシ 行削除 | ✅ オーナー対応 |
  | 6 | GAS恒久修正コード貼付 + 保存 | ✅ |
  | 7 | `auditAllJalanZeroBilling()` 実行 → suspects=0（同型被害ゼロ） | ✅ |
  | 8 | `sendApologyToTakusagawa()` で chagie.1218@gmail.com にお詫びメール送信 | ✅ 2026-05-06 11:39:19Z (JST 20:39) |
- **GAS恒久修正4箇所 (`gas-email-import-v2.gs`)**:
  - **L635-637 `parseJalan_`**: `extractField_(body, '利用者への請求額')` の戻り値が空文字 or 値あり で判定 → "0円" を正しく0として採用
  - **L364-372 `jalanOverbillFix`**: 条件緩和 → `+(reservation.price||0) === 0 || +(existingRow.price||0) > +(reservation.price||0)` で 0円ケースも発火
  - **L1399-1404 `handleJalanPayment_`**: 冒頭に `if (+(reservation.price||0) <= 0) { return; }` 早期return ガード追加（二重防御）
  - **新規 `auditAllJalanZeroBilling()`**: jalan_payments.amount>0 かつ resv.discount≥base_price のレコードを抽出 → Slack報告（過去の同型バグ被害者検知）
- **新規 `sendApologyToTakusagawa()`**: ScriptProperty `apology_R0EQE3JK_sent` で二重送信防止する1回きりのメール送信関数。実行後 Slack #payment_sapporo に 📧 完了通知
- **🔴 教訓（再発防止ルール）**:
  - **「フィールド値 > 0」と「フィールドが存在する」を区別する**: parsePrice_ は未取得・"0"・""すべて 0 を返す。`price === 0` を `price 未取得` と誤判定する条件分岐は要警戒
  - **OTA過大請求対策の発火条件は両端を考慮**: 前回 4/21 の B群5名対応では `> 0` で十分だったが、ポイント全額充当（=0円）ケースは想定外だった
  - **多層防御**: parseJalan_ ＋ jalanOverbillFix ＋ handleJalanPayment_ ガード の3箇所で 0円ケースを止める設計に変更
  - **`extractField_` の戻り値判定**: 空文字 vs "0" を区別したい場合は `result !== ''` で判定する。`> 0` だと "0" を見逃す
- **被害確認**: `auditAllJalanZeroBilling` 結果 = suspects 0件 → R0EQE3JK が唯一の被害者
- **コミット予定**: `gas-email-import-v2.gs`（3箇所修正＋2新規関数）GASエディタ側は保存済み

---

## 2026-05-02 修正履歴

### 🌐 GitHub Pages 移行 最終仕上げ (v4.7.59 / spk-v616)
- **背景**: NHA で確立した Vercel→GitHub Pages 移行手順を SPK にも適用する3段構え。前セッションで `ba9ca3e` (sw.js register 相対化 + .nojekyll 追加) → `51029af` (monitor URL更新 + GAS heartbeat 一部修正) と進んでいた最終ピース
- **本番URL変更**: `https://spk-task.vercel.app` （廃止） → **`https://nosh2318.github.io/spk-task/`**
- **修正 (`sw.js`)**:
  - **URLS 相対化**: `['/', '/index.html', '/index2.html', '/app.js']` → `['./', './index.html', './index2.html', './app.js']`
    - GH Pages サブパス `/spk-task/` 配下では絶対パス `/index.html` は404になる。SW scope (= sw.js所在ディレクトリ) 基準で resolve させる
  - **fetch handler の pathname 判定変更**: `pathname === '/' || pathname === '/app.js'` → `pathname.endsWith('/') || pathname.endsWith('.html') || pathname.endsWith('/app.js')`
    - これでルート (`/`) でもサブパス (`/spk-task/`) でも動作
  - CACHE_NAME `spk-v615` → `spk-v616`
- **バージョン3点同時バンプ** (`index.src.html`):
  - `CV='spk-v615'` → `'spk-v616'`
  - `register('./sw.js?v=527')` → `?v=528`
  - `APP_VERSION="v4.7.58"` → `"v4.7.59"`
- **vercel.json 削除**: GH Pages 完全移行のためリポジトリから除去（`.vercel/` は既に .gitignore 管理）
- **CLAUDE.md / SYSTEM_SPEC.md** 本番URL表記更新
- **コミット**: `9b33fab` fix(GH Pages): sw.js URLS 相対化 + Vercel削除 (v4.7.59)
- **本番反映確認**: ✅ https://nosh2318.github.io/spk-task/ で APP_VERSION v4.7.59 / spk-v616 / sw.js?v=528 を curl 確認済
- **残タスク（ユーザー作業）**:
  - Vercel ダッシュボードで `spk-task` プロジェクトを Delete（リポジトリ連携停止）
  - 連携を切らないと main push 毎に Vercel 側でも 404 デプロイが走り続ける
- **🔴 教訓 / 横展開ルール**:
  - **sw.js の URLS は必ず相対パス（`./` プレフィックス）**。GH Pages サブパス配下で動かすならこれが必須
  - **fetch handler の同一オリジン判定は `pathname.endsWith('...')` で書く**。`pathname === '/...'` はサブパスで合致しない
  - **NHAは既に同方式で稼働中**（monitorUrl も `https://nosh2318.github.io/naha-project/monitor`）。今回の SPK 修正で構造完全統一

### 🤖 GAS Heartbeat 早期return アンチパターン 全関数修正
- **症状**: monitor 画面 (https://nosh2318.github.io/naha-project/monitor) で「⚠️ 要対応」赤バナー → 「予約取込・自動配車（札幌）」「SNS 投稿パトロール（共通）」が停止表示
- **真因**: 全 GAS の `update関数` / `patrol関数` が **「対象0件で早期return → heartbeat 未更新」** という構造的バグ
  - 平日昼にメールが少ない時間帯が60分続くだけで「停止」誤判定される
  - 特に SNS パトロールは「Slack新規メッセージなし」でreturn → 数時間 heartbeat 未更新が日常
- **修正対象（5関数 / 14箇所）**:
  | GAS | 関数 | 早期return箇所数 |
  |---|---|---|
  | `gas-email-import-v2.gs` | `processNewEmails` | try-finally で全ラップ |
  | `gas-email-import-v2.gs` | `checkSquareLinks` | 1箇所 |
  | `gas-email-import-v2.gs` | `checkPaymentStatus` | 5箇所 |
  | `gas-email-import-v2.gs` | `processSlackReservations` | 2箇所 |
  | `gas-square-terminal-spk.gs` | `importSquareTerminalPaymentsSpk` | 2箇所 |
  | `instagram_auto_post_v5.gs` (別repo) | `patrolSlackImages` | 4箇所 |
- **修正パターン1: try-finally**（最も堅牢、`processNewEmails` のみ採用）:
  ```js
  function processNewEmails() {
    var successes=[], failures=[], cancellations=[], skipped=[];
    try {
      // ... 元の本体処理 ...
    } catch (e) {
      Logger.log('[FATAL] '+e.message);
      failures.push({reason:'fatal: '+e.message});
    } finally {
      updateHeartbeat_('spk_gas_email', {success:successes.length, failure:failures.length, cancel:cancellations.length, skip:skipped.length});
    }
  }
  ```
- **修正パターン2: 早期return直前に更新追加**（その他全関数で採用）:
  ```js
  if (!rows || rows.length === 0) {
    updateHeartbeat_('spk_jalan_links', {success:0, processed:0});
    return;
  }
  ```
- **コミット履歴**:
  - `51029af` (前セッション): processNewEmails の try-finally
  - `9b33fab` (本セッション): gas-square-terminal-spk.gs の早期return修正（その他は既に51029afに統合済）
- **🔴 今後の鉄則（再発防止ルール）**:
  - **新規GAS関数追加時は必ず関数の冒頭または早期return直前に heartbeat 更新を入れる**
  - 早期returnを書く前に「ここで heartbeat 更新済か？」を必ずチェック
  - **コードレビュー観点**: 関数末尾にだけ heartbeat 更新がある場合は早期return パターンを疑う
  - heartbeat 書き込み忘れは「monitor が嘘をつく」状態。**虚偽の停止アラートを発するシステムは虚偽の正常アラートも発するリスクあり**
- **未適用（オーナー作業）**:
  - `gas-square-terminal-spk.gs` を GAS エディタ「札幌予約メール自動配車」プロジェクトに貼付
  - `instagram_auto_post_v5.gs` を GAS エディタ「Instagram自動投稿 v5」プロジェクトに貼付
  - 即時復旧したい場合は GAS エディタで `processNewEmails` / `patrolSlackImages` を ▶️ 手動実行（heartbeat 即時書込で停止解消）

## 2026-04-30 修正履歴

### 🔐 会計タブ専用パスコード分離 (v4.7.51 / spk-v608)
- **要望**: 経理担当 三國様に出納帳作業を委託するため、会計タブの権限だけ三國様に付与し、給与・スタッフ・経営管理は閲覧不可にしたい
- **方針**: 二重ロック方式。共通起動パスコード `2318` は据え置き、`PASGuard` を通すタブごとに独立パスコードを設定
- **実装** (`index.src.html`):
  - `PASGuard({children,label})` → `PASGuard({children,label,code:codeProp})` に拡張。`const code = codeProp || "1823"` でデフォルトは従来通り
  - 会計タブ呼び出しのみ `<PASGuard label="会計管理" code="1121">` に変更
  - スタッフ / 給与（attendance）/ 経営管理（biz）は引き続き **`1823`**（変更なし）
- **三國様への伝達情報**:
  | 項目 | 値 |
  |---|---|
  | 起動パスコード | `2318` |
  | 会計タブ パスコード | `1121` |
- **解錠スコープ**: ブラウザ画面リロードまで（コンポーネント state、`unlocked=true`）。共用端末は作業終了時にタブを閉じる運用
- **コミット**: `23c642c`
- **バージョン**: APP_VERSION v4.7.50 → **v4.7.51** / sw.js spk-v607 → **spk-v608** / index.html CV spk-v605 → **spk-v608** / sw.js?v=525 → **526**
- **将来パスコード変更時の手順**:
  1. `index.src.html` line 2713 付近の `code=codeProp||"1823"` または line 15818 付近 `code="1121"` を書き換え
  2. APP_VERSION バンプ + sw.js CACHE_NAME バンプ + index.html CV / sw.js?v= 同期
  3. `node build.js` で再生成 → commit & push

### 🔴 opts (B/C/J) 同期漏れ パトロール体制確立
- **発端**: カンノショウキ様 (RC52461132684014347, 楽天5/2) のチャイルドシート1個が APP に表示されなかった
- **真因**: 過去（GASパーサー修正前）に取り込まれた予約で、reservations.opt_c は手動修正されていたが tasks.opt_c (boolean) と changed_json._optC が未同期。Pattern A 13予約 / 36 tasks で同種ズレ確認
- **即時対応**:
  1. カンノ様 reservations.opt_c=1 + tasks 3件を直接DB修正
  2. `~/spk-task/tools/spk_opts_patrol.py --fix` で全件パトロール → Pattern A 13予約 / 36 tasks 自動修正
- **再発防止 4層**:
  1. **APP側**: `updateReservation` で opt_b/c/j 編集時に tasks も同期（既実装、index.src.html L15330）
  2. **GAS側**: `processMessage_` 既存予約パッチ時に `patchTaskOpts_` 自動呼び出し（既実装、L302-306）
  3. **GAS側 NEW**: `nightlyOptsPatrol()` 毎晩2:00自動パトロール — Pattern A検出+修正+Slack通知 + Pattern B検出
  4. **GAS側 NEW**: `bulkReprocessByResvNos(resvNos)` / `bulkReprocessPatternB()` — Pattern B (option_price>0/opt全0) を Gmail から再パース
- **Pattern定義**:
  - **Pattern A**: reservations.opt_x と tasks.opt_x (boolean) または changed_json._optX のズレ → 自動修正可能
  - **Pattern B**: option_price>0 だが opt_b=opt_c=opt_j=0 / 補償なし or 日割¥1200超 → メール再パース必要
  - **Pattern C**: シート数 > 8 の異常値
- **トリガー設定手順** (1回のみ手動):
  1. GASエディタで `setupNightlyOptsPatrolTrigger()` を実行 → 毎晩2:00自動実行
  2. 必要に応じて `bulkReprocessPatternB()` を手動実行（Pattern B 未来日を一括再パース）
- **手動パトロール**: `python3 ~/spk-task/tools/spk_opts_patrol.py [--fix]` （ローカルからSupabase直接照会）
- **新OTAパーサー追加時の鉄則**:
  - reservations のオプション系カラム (opt_b/c/j/usb/parasol/insurance) を更新する処理は、必ず `patchTaskOpts_` または同等の tasks 同期を呼ぶこと
  - `extractField_` で取得した文字列を検出系関数に渡してはいけない（1行のみ返却仕様）。必ず body 全体検索のフォールバックを実装

## プロジェクト概要
レンタカーショップ HANDYMAN 札幌デリバリー専門店の業務管理アプリ。
予約・配車・タスク・シフト・給与・車両・駐車場・会計・売上を一元管理。

- **本番URL**: https://nosh2318.github.io/spk-task/ （旧 https://spk-task.vercel.app は廃止）
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
- **APP_VERSION**: v4.7.23
- **sw.js CACHE_NAME**: `spk-v581`
- **index.html CV**: `spk-v584`
- **sw.js?v=**: 503
- **SRI/CSP**: 未適用（下記インシデント参照）

## 2026-04-28 修正履歴

### 🆕 じゃらん予約キャンセル処理 自動化機能（payment_bot_unified_v1.gs に追加）
- **要望**: 「すでに支払い済みのじゃらんユーザーがキャンセルし払い戻した場合、会計としてAPP側で行うステップは？」「返金率と予約詳細をスラックに投げると会計やその他全てのデータに反映される、Squareからも自動返金」がベスト
- **実装場所**: `~/Desktop/HANDYMAN/payment_bot_unified_v1.gs`（HANDYMAN Payment Bot v1）に追加（+約470行、合計1,450行）
- **doPost ルーティング**: 既存 `handleSlackMessage_` 冒頭に「キャンセル」キーワード分岐を追加 → `handleCancellationMessage_` を呼ぶ
- **Slack投稿フォーマット**:
  ```
  キャンセル
  予約番号：R0XXXXXX
  キャンセル料率：50
  理由：（任意）
  ```
- **対象チャンネル**:
  - 札幌: `#payment_sapporo` (C0AQL6HGG3E)
  - 那覇: `#payment_naha` (C0AP2S5B147)
  - **`#jalan_payment` は実在しない（旧名・統合済）**。CLAUDE.md グローバル側にも `#jalan_payment` 表記が残るが次回掃除予定
- **処理マトリクス**:
  | 予約タイプ | Square返金 | 売上計上 | 支出計上 | reservations | jalan_payments | スプシ |
  |---|---|---|---|---|---|---|
  | 札幌じゃらん paid + 1〜99% | ✅自動 | ✅(paid) | ✅ | cancelled | refunded | 🚫(返金済) |
  | 札幌じゃらん paid + 0% | ✅全額 | — | ✅(全額) | cancelled | refunded | 🚫(返金済) |
  | 札幌じゃらん paid + 100% | — | ✅(paid) | — | cancelled | refunded | 🚫(料100%) |
  | 札幌その他 + 1〜100% | — | ✅(unpaid) | — | cancelled | — | 🚫 |
  | 那覇 + 1〜100% | — | ✅(unpaid) | — | cancelled | — | — |
- **新規関数**:
  - `parseCancellation_(text)` — メッセージパース（resvNo / rate / reason）
  - `handleCancellationMessage_(ev, channel)` — メイン処理（11ステップ）
  - `lookupReservationForCancel_(cfg, resvNo)` — SPK→NHAの順で予約検索＋jalan_payments状態取得
  - `squareRefund_(cfg, resvNo, refundAmt, reason)` — Square Refund API直接実行（order_id→tenders[0].payment_id→/v2/refunds）
  - `getOrderIdFromSheet_(resvNo)` — 支払い管理スプシから order_id 逆引き
  - `updateCancellationSheet_(resvNo, isJalanPaid, rate)` — スプシステータス更新
  - `sbInsertAccounting_(cfg, table, body)` — 会計テーブル INSERT ヘルパー
  - 定数: `CANCEL_REFUND_CATEGORY = 'じゃらん返金'` / `CANCEL_FEE_CATEGORY = 'キャンセル料'`
- **テスト関数**:
  - `testParseCancellation()` — 6パターン（正常4 / 異常2）パース確認 ✅ 動作確認済
  - `testLookupReservation()` — R0DCXBRD で札幌じゃらん lookup 確認 ✅ 動作確認済
- **エラーハンドリング**: Square Refund 失敗時は以降のDB更新を中断（部分書き込み防止）→ Slack に明示通知 → 手動対応へエスカレーション
- **冪等性**: jalan_payments.status='refunded' なら 2回目投稿は ⚠️ 警告で停止
- **マニュアル**: `~/spk-task/cancellation-manual.html`（A4・全8章・スタッフ配布用）→ ブラウザでCmd+P→PDF保存
- **適用手順**:
  1. GASエディタ「HANDYMAN Payment Bot v1」(Script ID: `1bZcVSWRvxC1U4MDkIztcsFV8CWv9paFYoxU0oRStgAmZ57Y87lKC6sCU`) に貼付（**完了**）
  2. **デプロイの管理 → 新バージョン再デプロイ（必須・Cmd+Sだけでは Webhook に反映されない）**
  3. checkConfig で SLACK_BOT_TOKEN / SQUARE_API_TOKEN / SUPABASE_KEY 確認 ✅ 完了
  4. testParseCancellation / testLookupReservation 実行 ✅ 完了
  5. 新規キャンセル発生時にスタッフが #payment_sapporo / #payment_naha に投稿
- **残課題（R0DCXBRD整合性）**: エノモト ハヤト様 (¥6,650・じゃらん事前決済) 「手動対応済み」と申告されたが DB状態は:
  - reservations.status: cancelled ✅
  - jalan_payments.status: **paid のまま** ❌
  - jalan_payments.refunded_at: **null** ❌
  - spk_accounting: **行なし**（売上・支出ともに未起票）❌
  - Square Dashboard: 確認待ち
  → 会計上の整合性が崩れている。次回オーナー判断（A: DB直接修正 / B: 本機能で処理 / C: 放置）で対処
- **Square Refund API 権限要件**: `PAYMENTS_WRITE` スコープが必要。既存 `SQUARE_API_TOKEN` で動かなければトークン再発行
- **重要**: `getOrderIdFromSheet_` は支払い管理スプシ COL.ORDER_ID (列11) に order_id がある前提。古い行で空欄なら Square返金は失敗する → スプシ手動補完が必要

### Slackチャンネル名 整理（2026-04-28 確認）
| 用途 | チャンネル名 | チャンネルID |
|------|-------------|-------------|
| 札幌決済（領収書/Squareリンク発行/入金通知/キャンセル処理） | `#payment_sapporo` | C0AQL6HGG3E |
| 那覇決済（同上） | `#payment_naha` | C0AP2S5B147 |
| 札幌Slack予約登録 | `#sapporo_reservation` | C08TDTPEB36 |
| 領収書 | `#領収書` | C0ANTF5EE73 |
- **`#jalan_payment` は実在しない**（旧名・C0AQL6HGG3E にリネーム統合済）
- payment_bot_unified_v1.gs のヘッダコメント `// #payment_sapporo = #jalan_payment と同一チャンネル` も誤解を招くので次回編集時に削除
- グローバル `~/.claude/CLAUDE.md` の `JALAN_PAY_CHANNEL` `#jalan_payment` 表記も次回掃除予定

---

## 🔴 場所カラムの公式ルール (2026-04-26 確定)

| 状態 | DB値 | 表示 |
|------|------|------|
| 実際の住所/ホテル名 | "ベッセルイン札幌中島公園" 等 | そのまま表示 |
| **場所未確定/未入力** | **空欄 (`""`)** | **ブランク** |
| OTA店舗紹介文 (汚染) | "札幌デリバリー専門店…" 等 | UIで空欄化 (`cleanPlace`) |
| 古いプレースホルダー | "★OTAデリバリー希望（場所未確定）" | UIで空欄化 (`cleanPlace`) |

- **場所未確定は空欄に統一**。プレースホルダー文字列は新規作成しない
- DB に既に汚染プレースホルダーが入っていても、`cleanPlace()` で表示時にフィルタ
- GAS の `OTA_DELIVERY_PLACEHOLDER = '★OTAデリバリー希望（場所未確定）'` は廃止予定 (将来的にGAS側でも空欄に統一する)
- NHA のデリバリ判定は `visit_type/return_type='DEL'/'COL'` を優先し、`del_place/col_place` 依存を減らす方針

## 2026-04-26 修正履歴

### 🔴 extractField_ 1行限定バグ - 全パーサー横断調査・統一修正 (GAS gas-email-import-v2.gs)
- **背景**: RC22461157100261654 (ミヤケ マコト、楽天) の `opt_c=2` 修正で**チャイルドシートだけ直して `insurance="なし"` を見落とした** → ユーザー指摘 (補償なしになってる/なんで1つやると1つダメになるのか)
- **真因 (横断問題)**: `extractField_(body, label)` が `(.+)` で **現在行の続き1行のみ**しか返さない仕様。OTAメールの「オプション」「補償」欄は複数行に渡るため、`optionsStr` を引数にする検出系関数 (B/C/J/insurance) **すべてが**取りこぼしを起こす
- **被害例 (RC22461157100261654 / 楽天メール本文)**:
  ```
  ・オプション/車両の特徴　：カーナビ ※一部ミラーリングモニター   ← extractField_ で取れる1行目
  　　　　　　　　　　　　　ETC車載器 1                              ← 2行目以降は取れない
  　　　　　　　　　　　　　チャイルドシート 2                       ← 取れない
  　　　　　　　　　　　　　免責補償別 1                             ← 取れない
  　　　　　　　　　　　　　NOC補償 1                                ← 取れない
  ```
  → opt_c=0 / insurance=なし で登録された (正は opt_c=2 / insurance=NOC)
- **根本修正 (今回)**:
  - `parseRakuten_` の B/C/J 検出に body 全体fallback追加 (前回修正)
  - `parseRakuten_` の insurance を `optionsStr` → **`body`** に変更 (今回追加)
  - `parseJalan_` の insurance を `insuranceStr || body` に変更 (今回追加)
  - `parseAirtrip_` の insurance を `body` 優先 + `insuranceStr` フォールバックに変更 (今回追加)
- **DB修正 (今回)**: RC22461157100261654 の `reservations.insurance` を「なし」→「NOC」、tasks.insurance も同期更新
- **🔴 今後の鉄則 (再発防止ルール)**:
  - `extractField_` で取得した文字列を**検出系関数 (detectInsurance_, detectOtaDelivery_, シート検出 etc.) に渡してはいけない**
  - 必ず **body全体** か、`extractField_` 結果 → fallback で **body全体** を検出する
  - パーサー新規追加時は CLAUDE.md のこのルール記載を確認してから実装
  - 1OTAパーサーで「optionsStrを使う検出箇所」を見つけたら、**横断的に他OTAパーサーも同じ問題がないか必ず確認** (今回はチャイルドシート修正時に insurance を見落とした)
- **横断完了確認**:
  - parseJalan_ : insurance修正 ✅、B/C/J は元から body全体fallback有り ✅
  - parseRakuten_ : insurance修正 ✅、B/C/J修正 ✅
  - parseSkyticket_ : 元から body 直接検出 ✅
  - parseAirtrip_ : insurance修正 ✅、B/C/J は元から body 直接検出 ✅
  - parseOfficial_ : 全部 body 直接検出 ✅
- **コミット**: 本コミット

### 🔴 自動配車が「除外フラグ」を見ていなかった致命バグ修正 (GAS gas-email-import-v2.gs)
- **症状**: RC22461157100261654 (ミヤケ マコト、楽天Bクラス、5/26-5/27) が **配車表で除外フラグ立った車両「デリカ」(プレート未定、ID=27、H24年式)** に自動配車された
- **影響**: 「絶対してはいけないミス」(オーナー指摘)。除外フラグ車両は事故・故障・廃車予定など何らかの理由で配車不可なのに、過去の予約が混入していた可能性
- **真因**: `autoAssignVehicle_` (gas-email-import-v2.gs L1014) の vehicles 取得クエリ:
  - **`active=eq.true` フィルタが無い** (vehicles.active=false 永続除外も候補に入っていた)
  - **`vehicle_monthly_kpi.active=false` の月別除外チェックが無い** (配車表の除外フラグを完全無視)
- **DB状態**:
  - vehicles: `code=デリカ`, `active=true` (永続除外ではない)
  - vehicle_monthly_kpi: `code=デリカ`, **2026-02〜10 全月で `active=false`** ← 配車表で除外設定されている
  - 一方 `code=DLC` (デリカD5、6057) と `code=NRH` (ノア、5398) は記録なし → 稼働可能
- **緊急DB修正 (実施済)**:
  - `fleet.vehicle_code`: `デリカ` → `DLC` (プレート 6057)
  - `tasks` (d-RC22461157100261654): assigned_vehicle/plate_no/opt_c/memo/changed_json を一括更新
  - `reservations.opt_c`: 0 → 2 (チャイルドシート2、楽天メール本文との一致)
- **GAS恒久修正 (実施済・要GASエディタ貼付)**:
  - `autoAssignVehicle_`:
    - vehicles 取得に `active=eq.true` フィルタ追加
    - `vehicle_monthly_kpi.year_month=eq.YYYY-MM&active=eq.false` で除外コードを取得し、候補から除去
    - 除外時は「未配車」扱い (誤配車より安全側)
  - `listYearMonths_(lendDate, returnDate)` 新規ヘルパー: レンタル期間の年月リストを返す（月跨ぎ予約対応、最大24ヶ月安全装置付き）
- **テーブル構造メモ**: vehicle_monthly_kpi のカラムは **`vehicle_code` / `year_month` / `active`** (CLAUDE.md記載の `code` / `ym` は誤り、修正済)
- **再発防止**: 今後 OTA予約が来た時に `[KPI除外]` ログで除外候補数を確認可能
- **適用手順**:
  1. GASエディタで「札幌予約メール自動配車」プロジェクトを開く
  2. `gas-email-import-v2.gs` を Cmd+A → Cmd+V → Cmd+S
  3. ※トリガー管理型のためWeb Appデプロイ不要

### 🔴 楽天パーサーのチャイルドシート検出が1行目のみだったバグ修正 (GAS gas-email-import-v2.gs)
- **症状**: RC22461157100261654 (上記同予約) で楽天メール本文に「チャイルドシート 2」と書かれていたのに DB は `opt_c=0`
- **真因**: `parseRakuten_` (L607-613) が `optionsStr.match(...)` で検出していたが、`optionsStr` は `extractField_(body, '・オプション/車両の特徴')` が返す**1行目のみ** (`(.+)` は改行非マッチ)。楽天メールのオプション欄は複数行構造:
  ```
  ・オプション/車両の特徴　　　：カーナビ ※一部ミラーリングモニター   ← 1行目 (取得される)
  　　　　　　　　　　　　　　　ETC車載器 1                              ← 2行目
  　　　　　　　　　　　　　　　チャイルドシート 2                       ← 3行目 (取得されない！)
  　　　　　　　　　　　　　　　免責補償別 1
  ```
- **同型バグ**: NHA で 2026-04-23 に同じ問題を `detectOtaDelivery_` で修正済 (CLAUDE.md記載)。じゃらん/skyticket パーサーは既にbody全体検索のフォールバック実装済。**楽天だけ取り残されていた**
- **修正**: `parseRakuten_` の B/C/J 検出にbody全体検索のフォールバック追加 (じゃらんパーサーと同形):
  ```js
  var bAll = body.match(/ベビーシート[^\d\n]*(\d+)/g);
  var cAll = body.match(/チャイルドシート[^\d\n]*(\d+)/g);
  var jAll = body.match(/ジュニアシート[^\d\n]*(\d+)/g);
  if (cAll) { for (...) { optC=Math.max(optC, parseInt(...)); } }
  ```
- **教訓**: 新OTAパーサー追加時・既存修正時は必ず body全体検索のフォールバックを実装する。`extractField_` の1行のみ返却仕様を踏まえる

### 場所カラム ルール統一: 未確定は空欄 (v4.7.23 / spk-v581)
- **背景**: v4.7.22 で18件の reservations + 25件の tasks を `★OTAデリバリー希望（場所未確定）` に置換したが、他のレコードは「空欄」だったため**ルールがあやふや**になった
- **方針確定**: 場所未確定は **常に空欄 (`""`)** に統一
- **ロールバック**: `★OTAデリバリー希望（場所未確定）` を入れた reservations 18件 + tasks 25件をすべて空欄に戻し
- **`cleanPlace()` 拡張**: `★OTAデリバリー` パターンも除外対象に追加 (古いプレースホルダーが他経路で残存していた場合の保険)
- **コミット**: 本コミット

### 場所カラム OTA 店舗紹介文を非表示化 (v4.7.22 / spk-v580)
- **症状**: OPシート/データタブ/TOP に「札幌デリバリー専門店　★ホテルや自宅・駅へお届け！LINE完結の手続きで即出発★」が場所として表示されていた。これは OTA メール本文に含まれる HANDYMAN 自社の店舗紹介文で「実際の場所」ではない
- **真因**: 2026-04-21 (commit `3e777a2`) の `sanitizeOtaStoreName_` 追加以前に取込まれた予約 18件 で `del_place`/`col_place` がこの紹介文のまま残存していた。GAS は修正済みなので新規予約は再発しない
- **対応 A: DB クリーンアップ (本コミット前に実施)**:
  - `reservations` 18件: `del_place`/`col_place` を `★OTAデリバリー希望（場所未確定）` に置換 (GAS既存プレースホルダーと統一)
  - `tasks` 25件 (DEL/COL): `place`/`col_place` を同様に置換
  - `places` テーブルは汚染なし
  - 対象: C260400997, DY00000000934-942(9件), R02AD7IX, R05I6TMD, R0C0PPHO, R0IPN7SD, R0MQCKQD, R0SDV841, RC22461150540961762, RC52461146677338304
- **対応 B: APP UIフィルタ (保険)**:
  - `cleanPlace(p)` ユーティリティ追加 (`index.src.html` L752付近、`sD` の直後)
  - 正規表現: `/(札幌デリバリー専門店|デリバリー専門店|★ホテルや自宅|LINE完結|即出発)/`
  - `★OTAデリバリー希望（場所未確定）` はマッチしないので残る (=場所未確定として表示される)
  - 適用箇所:
    1. データタブ場所列 (L13707)
    2. OPシート スケジュールタブ (L10380 rP)
    3. OPシート その他タブ (L10570 t.place)
    4. OPシート マスター表 (L10668 resolvedP関数)
    5. OPシート 編集タブ (L10723 resolvedP関数)
    6. OPシート 編集モード (L10613 resolvedP)
    7. TOP本日スケジュール (L15223 rP / L15255 resolvedP / L15219 表示条件)
- **対応 C: GAS確認**: 修正済み (`sanitizeOtaStoreName_` 既存)。OTA自動登録GAS は HANDYMAN API 経由で `del_place` 直接書き込みはしない構造のため追加修正不要
- **コミット**: `56e20b5`

### 日付タブのタスク件数を NHA と同じロジックに統一 (v4.7.21 / spk-v579)
- **症状**: OPシート上部の日付タブのバッジ件数(N件) が「サブタブ合計(=スケジュール/DEL/COL/洗車合計)」と一致しなかった。例: 5/2 はサブタブ DEL 4 + COL 0 + 洗車 3 = 7件だが、日付タブは 9件 (キャンセル予約2件分の誤計上)
- **旧ロジック (`index.src.html` L10167)**:
  - reservations 全件対象 (キャンセル含む)
  - `tc=lendDate==d || returnDate==d` (同日DEL+COLが1件にしかカウントされない)
  - 洗車も配車済み車両でユニーク化していない
- **新ロジック (NHA `index.html.bak` L13356 と同型)**:
  - `active=reservations.filter(r=>r.status!=="cancelled")` でキャンセル除外
  - `tc=lendList.length+retList.length` (同日DEL+COLは2件扱い、generateTasksと一致)
  - 洗車は `fleet[r.id]` で車両コード単位ユニーク化、未配車のみ予約ID単位
  - 依存配列に `fleet` を追加
- **コミット**: `2c0c5f8`

## 2026-04-25 修正履歴

### 到着スクリプトコピー時の「場所」欄バグ修正（SPK v4.7.14 / spk-v575）
- **症状**: TOP/翌日スケジュールの「📱到着」「📱位置」ボタンでコピーすると、コピーされたメッセージの「場所:」欄が空欄になる、または「札幌デリバリー専門店」など誤った値で出る
- **再現**: DY00000000946（オオイシ テイジ・skyticket・2026-04-26 DEL）の📱到着ボタン → 場所欄空欄
- **真因**: コピー側ロジックが `t.place||""` のみ参照、表示側（`_ssPlace` 優先）とロジックがズレ
  - DB状態:
    - `tasks.place` = `""`（空）
    - `tasks.col_place` = `"スマイルホテルプレミアム札幌すすきの"`
    - `tasks.changed_json._ssPlace` = `"NH1279　スマイルホテルプレミアム札幌すすきの"` ← 実データ
  - 表示側 (line 14800): `(t._placeSource==="manual"?t.place:(t._ssPlace||t.place))` で正しく出る
  - コピー側 (line 14804/14805): `t.place||""` で空欄
- **修正** (`index.src.html` line 14804/14805):
  ```js
  const realP=(t._placeSource==="manual"?t.place:(t._ssPlace||t.place))||"";
  const cleanP=/(札幌デリバリー専門店|デリバリー専門店|★OTAデリバリー|空港受け渡し|HANDYMAN)/.test(realP)?"":realP;
  // 場所: ${cleanP}
  ```
- **副次**: dummy パターン除外も追加。「札幌デリバリー専門店」「★OTAデリバリー希望」等の OTA メール本文由来のプレースホルダーは空欄表示
- **対象ボタン**: DEL の「📱到着」「📱位置」のみ。COL ボタンは「場所:」を含まないため対象外
- **modal側 (line 10599)**: 呼び出し元が見つからない（dead code 疑い）ため未修正
- **コミット**: `f43540d`

### 解析D 直前予約 — 負のリードタイム除外で過去取込ノイズ排除（SPK v4.7.12 / NHA v3.3.50-NHA）
- **症状**: 「那覇店は本当にこの数字？」（オーナー指摘）。NHA 1月出発180件全部≤3日 / SPK 1月13件全部≤3日 など異常値
- **真因 (DB調査で判明)**: APP導入時の過去予約一括取込で `created_at > lend_date` のレコード多数。例: SPK 1月出発予約13件全部 created_at=2026-03（3月にまとめて取込された1月予約）
  - 旧コード: `lt = Math.max(0, Math.round((lend_date - created_at) / 86400000))` で**負のLT が「LT=0」(当日予約) と誤判定** → 過去月の直前予約が異常膨張
- **修正**: `Math.max(0, ...)` を排除し、`if (ltRaw < 0) return;` で過去取込疑いのレコードを除外
- **データソース問題（同時判明）**:
  - SPK `reservations` テーブルに **`booked_at` カラムが存在しない** → 完全に `created_at` ベース
  - NHA `nha_reservations` には `booked_at` カラムあり（1184件中281件=24%のみ埋まっている）
  - APP code: `r.booked_at || r.created_at` でフォールバック
- **正しい数字 (修正後)**:
  | 月 | NHA | (≤3/4-5/6-7/8-10) | SPK | (≤3/4-5/6-7/8-10) |
  |---|---|---|---|---|
  | 2026-02 | 2 | (0/0/2/0) | 0 | - |
  | 2026-03 | 43 | (25/5/3/10) | 21 | (9/3/6/3) |
  | 2026-04 | 70 | (21/25/9/15) | 26 | (7/8/3/8) |
- **コミット**: SPK `1b385e1` / NHA `89d9fcb`

### 解析D 直前予約セクション 完成形（4領域分割→件数のみ最小表示）
- **段階的進化（多回イテレーション）**:
  1. 初版: ≤3日定義で1セクション (v4.7.9 / v3.3.31-NHA)
  2. 4領域分割: ≤3/4-5/6-7/8-10 (v4.7.10 / v3.3.30-NHA)
  3. 各領域から「率」「売上」削除、件数のみ (v4.7.11)
  4. KPI/月別表/詳細リスト全削除、件数のみ最小表示 + direct除外 (v4.7.11 / v3.3.32-NHA)
  5. 負のLT除外で過去取込ノイズ排除 (v4.7.12 / v3.3.50-NHA)
- **最終仕様**:
  - 配置: 解析タブ D 構成分析の先頭（両店共通）
  - 集計: リードタイム（出発日 - 予約日）が 0〜10日の予約数
  - 4領域 + 合計の5カード横並び（件数のみ）
    - 🔴 ≤3日 (超直前)
    - 🟠 4-5日
    - 🟡 6-7日
    - 🟢 8-10日
    - ⬛ 合計 ≤10日
  - 期間: 解析タブ上部の月別/年別フィルタ連動
  - **両店共通除外ルール**:
    1. `ota='direct'` 除外（手動登録・法人直契約は対象外）
    2. **負のリードタイム除外**（過去取込ノイズ）
    3. lend_date月でグループ化（出発月基準）
- **データソース備考**:
  - SPK: `created_at` ベース（booked_at列なし、即時取込なので近似OK）
  - NHA: `booked_at || created_at`（24%のみ booked_at あり）

### DY00000000946 GAS取りこぼし対応 + Watchdog実装
- **症状**: skyticket予約 DY00000000946（オオイシ テイジ・2026-04-26）がGASで自動取込されず
- **OAUTH手動登録**: reservations / fleet（アクセラ8403/H・保険車両外） / places / tasks（洗車4/25・DEL4/26・COL4/29）すべてDB直INSERT
- **GAS Recovery 関数追加** (`gas-email-import-v2.gs` 末尾):
  1. `forceReprocessByResvNo()`: ScriptProperty `FORCE_REPROCESS_RESV` に予約番号を設定→過去7日のメールから検索→再処理（PROCESSED_MSG_IDS bypass）
  2. `watchdogMissedReservations()`: 過去2日のOTAメール vs Supabase reservations 差分を毎時チェック→自動復旧→Slack通知
  3. `setupWatchdogMissedTrigger()`: 上記を毎時トリガー化（手動1回実行で設定）
- **教訓**: 「本番影響なし」と最初に判断したのが間違い。**取りこぼし＝予約が配車に入らない＝当日オペ停止** の致命的事故。再発防止のwatchdogまでセットで対応
- **コミット**: `5b7ca85` (gas-email-import-v2.gs)

### 毎朝9時の Slack アラート2通を停止（オーナー指示）
- **要望**: スクショ2枚（09:26「🚨 回収漏れアラート（札幌）」/ 09:32「🚨 未払いアラート 17件 合計¥511,950（札幌店）」）のアラート不要 → 削除
- **調査**: 2通はそれぞれ別GASプロジェクトから発射されていた
  | アラート | GASプロジェクト | ローカルファイル | 関数 |
  |---|---|---|---|
  | 🚨 回収漏れアラート（札幌） | **HANDYMAN 領収書Bot**（別プロジェクト） | `~/outputs/handyman-receipt-bot/Code.gs` | `checkOverduePayments()` |
  | 🚨 未払いアラート N件 | **HANDYMAN Payment Bot v1** (Script ID: `1bZcVSWRvxC1U4MDkIztcsFV8CWv9paFYoxU0oRStgAmZ57Y87lKC6sCU`) | `~/Desktop/HANDYMAN/payment_bot_unified_v1.gs` | `checkOverdue()` |
- **注意**: GASエディタ上では「HANDYMAN Payment」と「HANDYMAN Payment Bot v1」の2プロジェクトが並んでおり紛らわしい。正解は **v1サフィックス付きの方**。判別方法:
  - プロジェクト設定の Script ID が `1bZcVSWRvxC1U4MDkIztcsFV8CWv9paFYoxU0oRStgAmZ57Y87lKC6sCU` で始まる
  - `function checkOverdue()` / `function syncPayments()` / `function handleJalanPaymentLink_` がある
- **修正方針**: 関数冒頭に `return;` + `Logger.log('[xxx] 停止中（オーナー指示）');` を追加。**関数本体は残したまま**（復活させる時は `return;` 行をコメントアウトするだけ）
- **修正箇所**:
  - `~/outputs/handyman-receipt-bot/Code.gs` L354 `checkOverduePayments()`
  - `~/Desktop/HANDYMAN/payment_bot_unified_v1.gs` L733 `checkOverdue()` (今日既にローカル編集済)
- **デプロイ**: 両ファイルとも `pbcopy` → GASエディタに `Cmd+A → Cmd+V → Cmd+S`。**Web App再デプロイ不要**（時間ベーストリガーなのでコード保存だけで次回実行時に反映される）
- **Slack への影響なし（継続稼働）**:
  - 領収書発行（「領収書」投稿→PDF）
  - Square支払いリンク発行（「品目：」投稿→URL）
  - 入金確認ポーリング（`syncPayments` 5分 / `checkSquareLinks` 5分）
  - じゃらん支払い期限アラート（`checkUnpaidAlert`、`gas-email-import-v2.gs` L1598、**別GAS**なので影響なし）
- **再発防止ルール（運用）**:
  - GAS関数を停止する際は **関数先頭に `return;`** + **日付付きコメント** が原則。トリガーだけ削除するとコードが古くなって後で混乱する
  - 複数プロジェクトで同じような名前の関数があるケースでは、まず grep で該当関数の所在を特定してから触る（今回は `grep -rn "回収漏れ\|未払いアラート"` で2つのファイルを特定）
- **教訓（コード提示ルール違反）**: このセッションの途中で1度 Edit の old_string/new_string をチャットに出してしまい、ユーザーから「またですね」と指摘された。CLAUDE.md 冒頭の絶対ルール「コードを渡すときはチャットに貼り付け禁止。必ず `pbcopy` でクリップボードに送るか、ファイルに書き出してパスを伝える」を徹底する

---

## 2026-04-24 修正履歴

### 直近予約変動 CXL検出漏れ修正 + クリハラケイシOTA誤表示修正 (v4.6.83)
- **症状①**: `直近予約変動` の CXL が常に 0件（実際にはキャンセルがある）
- **症状②**: クリハラ ケイシ（DY00000000945）が `HP` バッジで表示されるが、スカイチケット予約
- **根本原因①**: CXLクエリが `created_at >= cutoff` で検索 → 以前から登録されていた予約を後からキャンセルした場合を取りこぼし（created_at は登録時刻のため）
- **根本原因②**: OTA自動登録GASが DY00000000945 を `ota="HP"` と誤登録（DYプレフィックス = スカイチケット = `ota="S"` が正しい）
- **修正①（APP）**: `TopRecentWidget` のCXLクエリを `gte("created_at",cutoff)` → `gte("updated_at",cutoff)` に変更。select句に `updated_at` 追加。ソートも `updated_at` 優先に
- **修正②（DB）**: Supabase REST API で `DY00000000945` の `ota` を `HP` → `S` に直接PATCH
- **バージョン**: v4.6.83 / spk-v544（その後他修正でv4.6.87 / spk-v548に到達）
- **教訓**: CXLクエリは必ず `updated_at` ベース。`created_at` ベースでは後日キャンセルが拾えない

### TOP LeadTimeWidget 売上表示を最適化 (v4.6.79 / NHA v3.3.1-NHA 同時適用)
- **要望**: 「売上を正確にg表示させて。 基本料金＋付帯＝合計＋予約外 あと情報量が多いので既存のデザイン（アイコンスタイル）に合わせて修正 最適化してください 那覇も一緒に」（スクショ: `~/Desktop/スクリーンショット 2026-04-24 8.37.42.png`）
- **Before**: TOP黄色カードに「予約売上¥XX.X万 ＋ 予約外¥X.X万 ＝ 合計¥XX.X万」が大きな文字で横並び。基本料金/付帯の内訳が見えず、また3段構成で情報密度が高く視認性が低かった
- **After**: 既存アイコンスタイル（`予約率 60%` `稼働率 44%` `RevPACD ¥3,239`）と同じ「ラベル＋大きな数値＋小さな補足」パターンに統一
  - 行1（新規見出し）: `💰 売上 ¥XX.X万` （大きな緑、合計＋予約外の grand total）
  - 行1（小さなグレー補足）: `基本¥XX.X万＋付帯¥X.X万＝合計¥XX.X万 ＋予約外¥X.X万`
  - 全部1行に収まる（flex wrap 時は自動で折り返し）
- **数式定義**（方程式が厳密に閉じる）:
  - `基本料金 = Σ((bp>0||op>0) ? base_price : price) − Σ discount`
    - 旧レコードで bp/op 両方0なら `price` を基本料金扱い（フォールバック）
    - discount は基本料金側から控除（付帯には影響させない）
  - `付帯 = Σ option_price`
  - `合計 = 基本料金 + 付帯 = 既存の totalRevenue`（一致）
  - `総計 = 合計 + 予約外`
- **修正ファイル (SPK)**:
  - `index.src.html` line 6135 付近 `utilStats` useMemo に `totalBase/totalOption/totalDiscount` 算出を追加
  - line 6168 付近 return オブジェクトに `totalBase, totalOption` を追加
  - line 6239-6250 旧 revenue 表示ブロックをアイコンスタイルに書換
- **修正ファイル (NHA)**:
  - `index.html.bak` line 2300 付近 `totalRevenue` 再計算 forEach ループ内で `totalBase/totalOption/totalDiscount` を同時集計
  - line 2312 付近 utilStats return に追加
  - line 2382-2393 表示ブロックを書換
- **バージョン**:
  - SPK: v4.6.78 → v4.6.79 / sw.js `spk-v539` → `spk-v540` / index.html CV=`spk-v532` → `spk-v540` / sw.js?v=460 → 461
  - NHA: v3.3.0-NHA → v3.3.1-NHA / sw.js `nha-v101` → `nha-v102` / sw.js?v=80 → 81 / app.js?v=3300 → 3301
- **ビルド**: `cd ~/spk-task && node build.js` ✅ / `cd ~/Desktop/naha-project && node build.js` ✅
- **syntax check**: `node --check app.js` 両方OK

## 2026-04-23 修正履歴（続き4）

### 🔴 DY00000000944 skyticket予約がSクラス誤配車 → OTA自動登録GAS `extractVehicleClass` バグ修正
- **症状**: skyticket予約 DY00000000944（タカハシ ハルカ、2026-04-26、¥6,100）が Sクラス（CX-5 / 8065）に配車された。本来は **Cクラス（ロッキー 299 or CX-3 4576）**
- **メール内容**:
  - `プラン名：コンパクトSUVプラン_C_SPK`
  - `車両タイプ / クラス：SUV  C_SPK`
  - 正解クラス: **C**
- **根本原因**: OTA自動登録GAS（`~/outputs/handyman-ota-gas/main.gs` line 329-364 旧版）の `extractVehicleClass()` に含まれていた正規表現 **`/クラス\s*[:：]\s*([A-Z]\d?)/`** が "車両タイプ / **クラス：SUV** C_SPK" にマッチし、先頭の "S"（SUV の S）をクラス文字として返してしまう
- **誤判定ロジック**:
  1. 旧コード: 4つのパターンを順に試行。パターン3 `/クラス\s*[:：]\s*([A-Z]\d?)/` が最初にヒット
  2. "車両タイプ / クラス：SUV  C_SPK" → "クラス：S" マッチ → "S" を返却
  3. 本来ヒットすべき `プラン_C_` (パターン4) は試行されない
- **修正内容（`main.gs` `extractVehicleClass()` 全面書き直し）**:
  ```javascript
  // Pattern 1 (最優先): _X_OKA / _X_OKI / _X_SPK / _X_CTS — OTAプランコード末尾
  /[_＿]([A-Z]\d?)[_＿](OKA|OKI|SPK|CTS|NHA|TKA)/
  // Pattern 2: プラン_X★ or プラン_X_
  /[プpﾌﾟ]ラン[_＿]([A-Z]\d?)[_＿★☆\s]/
  // Pattern 3: Aクラス / B2クラス / Dクラス
  /([A-Z]\d?)クラス/
  // Pattern 4: 車両クラス：X_OKA（「車両クラス」限定、汎用「クラス:」廃止）
  /車両クラス[\s：:]+([A-Z][A-Z0-9]*)/
  // Pattern 5: 詳細車両クラス：コンパクトカー_F_OKA
  /詳細車両クラス[：:].*[_＿]([A-Z]\d?)[_＿]/
  // Pattern 6: 末尾 _A★ 等
  /[_＿]([A-Z]\d?)[★☆\s]*$/m
  // フォールバック: 車種名マップ
  ```
- **検証（`/tmp/test_fix.js`）**: 7/8 テストパス（SUV車種名フォールバック1件のみ旧挙動との差異、重要度低）
  - `コンパクトSUVプラン_C_SPK` + `クラス：SUV  C_SPK` → **"C"** ✅
  - `_F_OKA` → "F" ✅ / `_A_OKI★` → "A" ✅ / `B2クラス_B2_SPK` → "B2" ✅
- **即時対応（DY00000000944 DB修正）**:
  - `reservations.vehicle`: S → **C** ✅
  - `fleet.vehicle_code`: CX5 → **CX3** ✅（2026-04-26 CX-3 空きを確認）
  - `tasks` (DEL/COL/洗車 3行): vehicle=CX-3 / assigned_vehicle=CX3 / plate_no=4576 ✅
- **GAS適用手順**:
  1. `~/outputs/handyman-ota-gas/main.gs` は修正済み（line 329-382）
  2. `pbcopy` で全文クリップボードにコピー済み
  3. **GASエディタで「HANDYMAN OTA自動登録」プロジェクト → `main.gs` を開いて Cmd+A → Cmd+V → Cmd+S**
  4. トリガー管理型（30分毎）なのでWeb Appデプロイ不要
- **要注意リスト（今後目視確認推奨）**: 同じ誤判定で現在Sクラスに誤配車されている可能性のある skyticket(ota=S) / airtrip(ota=O) 予約:
  | ID | OTA | Lend | 名前 |
  |---|---|---|---|
  | DY00000000939 | S | 2026-04-22 | オオハシ チエ |
  | DY00000000942 | S | 2026-04-23 | コバヤシ モトユキ |
  | DY00000000938 | S | 2026-04-24 | ワダ タイキ |
  | KUI82098 | O | 2026-05-03 | 原田 奈津子 |
  | DY00000000930 | S | 2026-07-29 | ヤシロ ユウイチ |
  ※ 実際にSクラス予約の可能性もあるので、元メール本文で `プラン名` / `車両タイプ / クラス` を確認のこと
- **教訓**:
  - 汎用 `/クラス[:：]\w+/` パターンは OTAメール本文の構造上危険（「車両タイプ / クラス：SUV」のような複合ラベルに引っかかる）
  - OTA拠点コード `_X_OKA/_X_SPK` 等は予約のクラスを一意に識別する最も信頼できるマーカー → 最優先でマッチさせる
  - 関連コード（`gas-email-import-v2.gs` の `extractVehicleClass_`）は本件の影響を受けない（既に `_X_SPK` パターン優先の設計）。**問題は OTA自動登録GAS のみ**
  - OTA自動登録GAS(30min) が先に予約作成 → メール取込GAS(15min) は既存予約として扱うため `vehicle` を上書きしない → OTA自動登録GASの誤判定がそのまま残る
  - **将来的に**: OTA自動登録GASの `extractVehicleClass` と メール取込GASの `extractVehicleClass_` を同一ロジックに統一するべき

## 2026-04-23 修正履歴（続き3）

### 会計/集計 年次モード時に年間推移を常時表示 (v4.6.71)
- **要望**: 「年次ページには年間の推移を出してほしい」
- **背景**: v4.6.70 で NHA 仕様に統一した際、月別推移は折り畳みセクション（既定=閉）に格納されていた。年次ページを開いても年間の推移が一目で見えず、毎回クリックして開く必要があった
- **修正 (`index.src.html` line 11577)**:
  1. 年次モード時 (`viewPeriod==="yearly"`) に限定して、集計タブ先頭に**📈 年間推移セクション**を常時表示
  2. ビジュアル棒グラフ: 月別 売上(緑グラデ) vs 支出(赤グラデ) を横並び棒で視覚化。各月上部に純収支(千円単位)を色分け表示
  3. 凡例: 売上/支出/数字=純収支(千円) を明示
  4. 月別詳細テーブルに「純収支」列を追加 (月/現金入金/現金出金/現金残高/売上/支出合計/純収支/立替未回収 の 8列)
  5. 下段合計行で年間総合の売上/支出/純収支を表示
  6. 既存の折り畳み「📅 月別推移」セクションは削除（重複のため）
- **月次モード時**: 変更なし（年間推移は非表示）
- **NHA v3.2.83-NHA と完全同一仕様**
- **バージョン**: `APP_VERSION=v4.6.71` / `sw.js CACHE_NAME=spk-v532` / `index.html CV=spk-v532` 同時更新

## 2026-04-23 修正履歴（続き2）

### 会計/集計タブ NHA仕様に完全統一 (v4.6.70)
- **要望**: 「すいませんが 会計/集計タブ は 那覇店と全て同じ仕様に変更してください」
- **背景**: v4.6.69 で SPK 独自のグラデーション・カード式リスト設計を導入していたが、NHA（那覇店）の v3.2.82-NHA 設計（表形式・折り畳み）に完全統一するよう指示
- **Before (SPK v4.6.69 独自設計)**:
  - 3大KPIカード（グラデーション背景・大型）
  - 💸 支出項目別合計（カード形式リスト＋横棒バー＋構成比バー）
  - 💰 収入項目別合計（緑系カード形式）
  - 📊 月別推移（年次のみ、常時表示）
  - ⚠️ 立替金未回収（常時表示）
- **After (NHA v3.2.82-NHA と 1対1 統一)**:
  1. 最上段 3KPIカード: 白背景・シンプル（売上/支出/純収支）
  2. 4項目サブサマリ: 現金入金 / 現金出金 / 現金残高 / 立替(未回収)
  3. 💸 支出項目別 合計表 ← メインセクション（常時表示・テーブル形式）
     - 科目 / 現金 / カード / 立替 / 合計 / 件数 / 構成比
     - Top3 ランクバッジ（🥇🥈🥉）＋黄色帯（`#fffbeb`）
     - 構成比プログレスバー、最終行に総合計（濃紺 `#1e293b` 反転）
     - 上部に支払方法別チップ（現金出金/カード支払い/個人立替）
  4. 折り畳み格納（既定: 閉）:
     - 📈 月別推移（年次のみ）
     - 💰 収入 科目別 合計
     - ⏰ 未回収・未精算（立替金未回収 + 予約外売上未入金）
- **state 追加**: `sumOpen={monthly,expense,income,unpaid,extra}` + `toggleSum` ヘルパー（NHA と同一）
- **場所**: `AccountingPanel` (`index.src.html` line 11038 / line 11368 / line 11537)
- **バージョン**: `APP_VERSION=v4.6.70` / `sw.js CACHE_NAME=spk-v531` / `index.html CV=spk-v531` 同時更新
- **効果**: SPK・NHA 両店舗の会計集計 UI が完全一致。店舗間異動時の学習コストゼロ。今後の仕様変更は NHA 側を正本として両店舗に同時適用可能

## 2026-04-23 修正履歴（続き）

### 会計/集計タブ 全面再構築 (v4.6.69)
- **要望**: 「会計/集計 画面が 非常に使いづらくみづらいです。 情報過多なのかもしれませんが 整理整頓しシンプルにみやすい仕様に変更して」→ 続いて「ここには各支出項目の合計が整理され表示されるのを希望」
- **Before (情報過多)**:
  - 上部 2行×4カード = 8カード (現金入金/出金/現金残高/売上合計 + 当月支出/カード/個人立替/立替未回収)
  - 年次集計テーブル (7列)
  - 💸 支出内容の総括 (4カード + 7列×多行テーブル、構成比%付き)
  - 💰 収入 科目別集計 (3列テーブル)
  - 予約外売上 詳細 (7列テーブル)
  - 立替金 未回収一覧 (6列テーブル)
  - **合計**: 8カード + 4テーブル + サブカード4つ = 非常に冗長
- **After (情報整理)**:
  1. **最上段 3KPIカード**: 収入合計 / 支出合計 / 差引（現金残高）
     - 各カードにグラデーション背景 + サブ情報（内訳）
  2. **💸 支出項目別合計 ← メインセクション**:
     - 科目別に金額降順で整理（カード形式）
     - 各行: 科目名 / 大きな金額 / 構成比% / 横棒バー / 内訳タグ（現金/カード/個人立替）
     - 最下段に合計バー（黒背景）
  3. **💰 収入項目別合計**:
     - 同形式（緑系）で収入科目を整理
  4. **📊 月別推移**: 年次表示時のみ（5列に簡素化: 月/収入/支出/差引/立替未回収）
  5. **⚠️ 立替金未回収**: 期間連動（従来は年次固定）
- **削除**: 冗長な3テーブル（支出内容の総括テーブル、予約外売上詳細、独立した収入科目別集計）
- **設計原則**:
  - 「支出項目の合計」を最も目立つ位置に配置
  - バー表示で視覚的に比較可能
  - 構成比%で全体に対する割合が即座にわかる
  - 期間フィルタ（月次/年次）に全セクション連動
- **バージョン**: `APP_VERSION=v4.6.69` / `sw.js CACHE_NAME=spk-v530` / `index.html CV=spk-v530` 同時更新
- **コミット**: `6dd3814` feat(会計/集計): 支出項目別合計を整理し視認性向上

## 2026-04-23 修正履歴

### 🧾 じゃらん支払い期限アラート仕様（確認メモ・変更なし）
- **質問**: 「じゃらんの支払い期限ですが3日前になったらアラートでる仕様になってますか」
- **答え**: ✅ 出ます。仕様は3層。
- **第1層: Slack通知（毎朝9時 / `checkUnpaidAlert()`）**
  - ファイル: `gas-email-import-v2.gs` line 1598
  - トリガー: `setupJalanPaymentTriggers()` で毎朝9時セット（`ScriptApp.newTrigger('checkUnpaidAlert').timeBased().atHour(9).nearMinute(0).everyDays(1).create()`）
  - 通知先: `JALAN_PAY_CHANNEL`（#jalan_payment）
  - 対象: `支払い管理` スプシ全行のうち、ステータス≠済/キャンセル & 予約番号+URLあり
  - 日数計算: `reservations.lend_date`（なければ品目M/Dフォールバック）から `diffDays = Math.floor((new Date(lendDate+'T00:00:00+09:00') - now) / 86400000)`
  - 通知条件: **`diffDays <= 3`**（出発まで3日以内）
  - 緊急度: `daysLeft<=0` 🔴期限超過 / `<=1` 🟠明日出発 / `<=3` 🟡N日後
  - 限界: 毎朝9時1回のみ。9時以降に3日前に差し掛かった予約は翌朝まで通知されない
- **第2層: APP TOP Handover アラート（常時2分間隔更新・`MemoBox` 内）**
  - 条件: `daysLeft <= 4`（Slackより1日早い予防線）
  - 表示: 「💳 Square未決済 Handover（出発4日前アラート）」専用ブロック
  - 色分け: ≤1日=🚨赤 / それ以外=⏳オレンジ
  - 各行にSquare支払いリンク付き
- **第3層: 常時バッジ表示**
  - TOPウィジェット「じゃらん事前」アイコンに未決済件数・金額バッジ
  - OPマスター表列19 / データタブ列18 / OP画面DEL-COL-スケジュール / TOP本日スケジュール に `💳決済/未決済` バッジ
- **調整候補（未実装・ユーザー要望次第）**:
  - Slack通知の頻度アップ（現在1日1回 → 1日2回とか）
  - じゃらん専用別チャンネル分離
  - 3日→5日前に前倒し

### 経営管理 解析タブ A/B/C/D セクションを初期折り畳みに変更（v4.6.68）
- **要望**: 「解析ページは 折り畳まれた状態をデフォルトに」（スクショ `スクリーンショット 2026-04-23 16.01.04.png`）
- **背景**: 解析タブの4大セクション（A.稼働率 / B.予約・売上 / C.リードタイム / D.構成分析）が常にデフォルトで全展開されており、ページを開くたびに縦スクロールが長大化していた
- **修正 (`index.src.html` line 2915)**:
  - `useState({A:true,B:true,C:true,D:true})` → `useState({A:false,B:false,C:false,D:false})`
  - 各セクションヘッダーは従来通り表示され、タップで個別展開（`toggleSec`）
- **バージョン**: `APP_VERSION=v4.6.68` / `sw.js CACHE_NAME=spk-v529` / `index.html CV=spk-v529` 同時更新

### TOP決済3アイコン「押しても遅い」問題をダブルfetch排除で根本修正（v4.6.67）
- **症状**: TOP画面の「Square失敗 / 予約外未収 / Square請求」3アイコンをタップしても反応がかなり遅い（スクショ `スクリーンショット 2026-04-23 15.36.30.png`）
- **根本原因**: **ダブルfetch構造**
  1. 親 `SpkPaymentSection` が件数計算用に DB fetch（amount/resv_no など軽量カラムのみ）
  2. タップ時に子ウィジェットが遅延マウント → **同じテーブルを再度フルカラムで fetch**
  3. `SpkExtraUnpaidWidget` は `items.length===0` の間 `return null` → **データ到着まで画面に何も表示されない**（=反応が遅く見える最大要因）
  4. `SquareInvoiceWidget` は `loading===true` の間 `return null`、`SqFailedModal` は「読み込み中...」表示
- **修正 (`index.src.html`)**:
  1. 親 `SpkPaymentSection.load()` の select 句を**子ウィジェットが必要とする全カラムに拡張**:
     - `sq_terminal_failed`: `amount,note,item_name,reason,raw_data` → `*` + `order(payment_at)`
     - `spk_accounting` (extra_sales): `amount,resv_no` → `*` + `order(date)`
     - `spk_accounting` (url): `amount,resv_no,paid` → `id,date,type,category,resv_no,user_name,amount,paid,url,created_at` + `order(date).limit(200)`
  2. 親で **`fullData` state** に filtered 済み配列をキャッシュ（ext/sqi/sqf）
  3. 3子コンポーネント（`SpkExtraUnpaidWidget` / `SquareInvoiceWidget` / `SqFailedModal`）に **`preloadedItems` / `preloadedInvoices`** prop を追加:
     - 初期 state に prop 値を採用 → **マウント直後に表示完了**
     - useEffect で `preloaded` があれば初回fetchをスキップ
     - preloaded が後から更新されても追従するよう watcher を追加
     - 既存の Realtime subscribe / 120s polling は維持（継続更新担保）
  4. App 側に `sqfPreload` state を追加 → `SpkPaymentSection` の `onSqfPreload` コールバック経由で `SqFailedModal` に渡す
- **効果**:
  - タップ→表示のラウンドトリップが **1回 → 0回**（親が既に fetch 済みデータを即座に表示）
  - 60秒ポーリングは維持（データ鮮度担保）
  - 展開時の体感は「タップ = 即時描画」に改善
- **バージョン**: `APP_VERSION=v4.6.67` / `sw.js CACHE_NAME=spk-v528` / `index.html CV=spk-v528` 同時更新

### 🛡️ AIスタッフ_G（HANDYMAN Payment GAS）二重登録 根本修正
- **対象ファイル**: `/Users/noritakaoshita/Desktop/HANDYMAN/payment_bot_unified_v1.gs`
- **背景**: v4.6.66 のUIフィルタは対症療法。根本原因は AIスタッフ_G が `jalan_payment` タイプのSquareリンク発行時も `postToSupabase_` を無条件で呼んでいたこと
- **バグ箇所**: `handleSlackMessage_` line 138（修正前）
  ```javascript
  // Supabase 起票
  const sbOk = postToSupabase_(cfg, parsed, linkData, channel);
  ```
  - `parseRequest_` で `type='jalan_payment'` と判定されても `postToSupabase_` が呼ばれ、`spk_accounting` に `type='extra_sales'` 相当として登録される（※実際には parsed.type がそのまま渡されるが、TOP UIでは `extra_sales AND paid=false` を「予約外未収」として拾うため見かけは extra_sales と同じ）
- **修正内容**:
  ```javascript
  // ★ じゃらん事前決済は jalan_payments テーブル側で管理する（spk_accounting への二重登録を防止）
  const sbOk = (parsed.type === 'jalan_payment')
    ? true  // jalan_payments 側で管理済み、会計テーブルへの登録はスキップ
    : postToSupabase_(cfg, parsed, linkData, channel);
  ```
  - Slack返信の「会計起票」行も `➖ スキップ（jalan_payments 側で管理）` に差し替え
- **ルーティングの整理（確認事項）**:
  - じゃらん事前決済: `jalan_payments` テーブルで一元管理（入金状態は `gas-email-import-v2.gs` の `checkPaymentStatus` v4 が Square Orders API 直叩きで反映）
  - 立替金 / 予約外売上: `spk_accounting` / `nha_accounting` / `tka_accounting` に `postToSupabase_` で起票（従来通り）
- **適用手順**:
  1. GASエディタで「HANDYMAN Payment」プロジェクトを開く
  2. Cmd+A → Cmd+V でクリップボードから上書き貼付
  3. Cmd+S で保存
  4. 「デプロイの管理」→ 既存Web Appデプロイを編集 → 「新バージョン」で再デプロイ（**Cmd+S だけでは Webhook に反映されない**）
- **効果**: 今後のじゃらん予約について `spk_accounting` への二重登録が完全に止まる。v4.6.66 のUIフィルタは保険として残す（過去データ対策・他経路からの誤登録対策）

### 🛡️ じゃらん過大請求 根本修正（gas-email-import-v2.gs line 259）
- **対象ファイル**: `/Users/noritakaoshita/spk-task/gas-email-import-v2.gs`
- **背景**: 2026-04-21 のじゃらん過大請求障害（B群5名 計¥14,600過大請求）の根本原因が未修正だった
- **バグの構造**:
  1. OTA自動登録GAS(30分間隔) が先にメール取込 → `price=合計金額(クーポン前)` のみ登録（`base_price/option_price/discount=0`）
  2. 札幌メール取込GAS(15分間隔) が後追いで `parseJalan_` 実行 → 正しい `price=利用者への請求額, discount=クーポン額` を算出
  3. 旧コード line 259: `if (!existingRow.price && ...)` → `existingRow.price=¥19,300` は truthy なので **price は上書きされない**
  4. 旧コード line 263: `existingRow.discount===0` なので **discount だけ上書きされる**
  5. 結果: DB が `price=¥19,300(クーポン前) + discount=¥3,000` の矛盾状態に → Square で過大請求発行
- **修正内容（line 259-282付近）**:
  ```javascript
  var jalanOverbillFix = (reservation.ota === 'J')
    && +(reservation.discount||0) > 0         // パーサーが割引検出
    && +(existingRow.discount||0) === 0       // DB の discount は未設定
    && +(existingRow.price||0) > 0
    && +(reservation.price||0) > 0
    && +(existingRow.price||0) > +(reservation.price||0);  // 既存 price > パーサー price = クーポン前の証拠

  if (jalanOverbillFix) {
    patch.price = reservation.price;
    if (+(reservation.base_price||0) > 0) patch.base_price = reservation.base_price;
    if (+(reservation.option_price||0) > 0) patch.option_price = reservation.option_price;
    patch.discount = reservation.discount;
    Logger.log('[JalanOverbillFix] ' + reservation.id + ' price ' + existingRow.price + '→' + reservation.price);
  } else {
    // 従来の欠落補完ロジック（冪等）
    if (!existingRow.price && +(reservation.price||0) > 0) patch.price = reservation.price;
    if (+(existingRow.base_price||0) === 0 && +(reservation.base_price||0) > 0) patch.base_price = reservation.base_price;
    if (+(existingRow.option_price||0) === 0 && +(reservation.option_price||0) > 0) patch.option_price = reservation.option_price;
    if (+(existingRow.discount||0) === 0 && +(reservation.discount||0) > 0) patch.discount = reservation.discount;
  }
  ```
- **4条件目（`existingRow.price > reservation.price`）の意図**:
  - 「既存priceがクーポン前の高い金額」を厳密に判定することで誤爆を防止
  - パーサーが正しく price=合計額を返しているケース（discountなし）では絶対に発火しない
  - 既に正しい price が入っているケース（再処理時）では発火しない → 冪等性担保
- **適用手順**:
  1. GASエディタで「札幌予約メール自動配車」プロジェクトを開く
  2. `gas-email-import-v2.gs` を Cmd+A → Cmd+V でクリップボードから上書き貼付
  3. Cmd+S で保存（※トリガー管理型なのでWeb Appデプロイ不要、次回トリガー時に新コード実行）
- **実行ログでの追跡**: GAS実行ログに `[JalanOverbillFix]` が出現すれば発火した証拠

### Priority 4 / 5 ユーザー実行タスク（コード実装済み・手動実行待ち）
- **`auditAllJalanOverbilling()`** (gas-email-import-v2.gs line 2928): 全じゃらん予約をスキャンして `price ≠ base+opt-disc` の不整合レコードを抽出、jalan_payments と照合して「実害あり（発行額誤り）」と「DB不整合のみ」に分類して Slack `#jalan_payment` に報告。**GASエディタで手動実行するだけ**
- **`setupWatchdogTrigger()`** (gas-email-import-v2.gs line 1815): `watchdogJalanPayment` を毎時トリガーで設定（じゃらん予約で jalan_payments 行が無いものを自動復旧）。**GASエディタで1回手動実行するだけでトリガー設定完了**

### じゃらん事前決済の二重登録を修正 + UIフィルタ追加（v4.6.66）
- **症状**: 予約外未収に R0 プレフィックスのじゃらん予約（6件 ¥202,200）が表示される。ユーザー指摘「ここの予約外は じゃらんに入るのでは？」
- **調査結果**: 全6件が `reservations.ota='J'` かつ `jalan_payments` にも存在する**二重登録**状態
  | resv_no | 名前 | jalan_payments status | spk_accounting |
  |---|---|---|---|
  | R05I6TMD | タカタ シュンスケ | email_sent | extra_sales/paid=false |
  | R0MQCKQD | シミズ ヨシヒロ | cancelled | extra_sales/paid=false |
  | R0C0PPHO | イズミサワ ショウタ | **paid** | extra_sales/paid=false ← 入金済みなのに未収表示 |
  | R0OB6RQD | 北上 将大 | email_sent | extra_sales/paid=false |
  | R0GKNRZZ | ダイ チヨコ | email_sent | extra_sales/paid=false |
  | R0SFCDMG | ヤナギダ ナオヤ | email_sent | extra_sales/paid=false |
- **原因**: **AIスタッフ_G**（Slackボット）がじゃらん決済のSquareリンクを `spk_accounting` に `type='extra_sales'` として誤登録。`description` は実際に `じゃらん事前決済(XX/XX-XX/XX)` となっていた。`memo='square_order=XXXXX'` もjalan_paymentsのorder_idと一致
- **影響**:
  1. 予約外未収に表示されて UI ノイズ
  2. 売上分析で二重計上（reservations.price + spk_accounting.extra_sales の両方に計上される）
  3. 入金済みレコードも `spk_accounting` 側は `paid=false` のまま残り、未収と誤認される
- **修正 (`index.src.html`)**:
  1. `SpkPaymentSection`: 予約外未収カウントから `jalan_payments.reservation_id` に存在する予約を除外（Square請求と同じ扱い）
  2. `SpkExtraUnpaidWidget`: 同じフィルタを適用。`jalan_payments` の `reservation_id` セットを並列フェッチして表示リストから除外
  3. select句に `resv_no` を追加（フィルタ用）
- **DB クリーンアップ**: AIスタッフ_G が誤登録した **9件** を `spk_accounting` から削除
  - 未収6件（¥202,200）: R05I6TMD / R0MQCKQD / R0C0PPHO / R0OB6RQD / R0GKNRZZ / R0SFCDMG
  - 入金済3件（¥50,250）: R0IPN7SD / R0YNZ8NG / R06CBHRK ← 過去に二重計上されていた
- **未解決の根本原因**: AIスタッフ_G の spk_accounting 誤登録挙動。おそらく Square Webhook 受信時の処理で、じゃらん事前決済のSquareリンクも拾って「予約外売上」として起票している。AIスタッフ_G 側で `jalan_payments` への存在チェックが必要
- **バージョン**: `APP_VERSION=v4.6.66` / `sw.js CACHE_NAME=spk-v527` / `index.html CV=spk-v527` 同時更新

### SquareInvoiceWidget と SpkExtraUnpaidWidget を那覇店と完全定義統一（v4.6.65）
- **症状**: v4.6.64 以降も「Square請求 が押しても動かない / 反応がかなり遅い / 那覇と定義が違う気がする」
- **差異の特定（SPK vs NHA）**:
  1. SPK `SquareInvoiceWidget` には `defaultOpen` prop 付き → NHAは無し
  2. SPK は `limit(300)` → NHAは `limit(200)`
  3. SPK は未払い行ごとに `reservations.lend_date` をN+1クエリで取得（最大300件の `IN` クエリ）→ NHAは無し（遅さの根本原因）
  4. SPK のステータス列に `daysLeft` 計算ロジックあり（カテゴリから日付抽出+年跨ぎ考慮）→ NHAは単純な「未払い/入金済み」バッジのみ
  5. SPK `SpkExtraUnpaidWidget` も `defaultOpen` prop 付き + 「予約外未収はありません」の案内表示あり → NHAは `defaultOpen` 無し、空時は `return null`
- **修正 (`index.src.html`)**:
  1. `SquareInvoiceWidget` を NHA と**1対1で完全統一**: `defaultOpen` prop 削除、`useState(false)` 固定、`limit(200)`、N+1クエリ削除、ステータス列もNHAと同じシンプルな三項演算子バッジ、フッター「札幌店のみ」のみ変更
  2. `SpkExtraUnpaidWidget` を NHA `ExtraUnpaidWidget` と完全統一: `defaultOpen` prop 削除、`useState(false)` 固定、`!items.length` 時は `return null`、行レイアウトも NHA の `flex:1` 均等割り付けに揃える
  3. `SpkPaymentSection` の呼び出しから `defaultOpen={true}` を削除（NHAと同じ呼び方）
- **バージョン**: `APP_VERSION=v4.6.65` / `sw.js CACHE_NAME=spk-v526` / `index.html CV=spk-v526` 同時更新
- **UX統一結果**: NHA店員とSPK店員で操作体験が完全に同じ（タップ→ヘッダーバー表示→再タップで展開、の2タップ）。N+1クエリ削除により初期表示の遅延も解消

### TOP決済セクションのアイコンタップを那覇店と同仕様に統一（v4.6.64）
- **症状**: 「札幌はこれらを押しても出てこない / 全て同じ仕様に / 特にsquare請求は動かない」
  - 予約外未収アイコンをタップしても、ただの「会計タブで確認してください」テキストのみ表示（詳細リストなし）
  - Square請求アイコンをタップすると `SquareInvoiceWidget` のヘッダーバーだけ表示され、中身が開かない（2回タップ必要）
  - Square請求アイコンに件数バッジが無い（NHAには有り）
- **修正 (`index.src.html`)**:
  1. `SpkExtraUnpaidWidget` 新規: NHA `ExtraUnpaidWidget` を `spk_accounting` 版に移植。日付/カテゴリ/予約番号/宛名/金額/URL の詳細リスト表示。Realtime購読で自動更新
  2. `SquareInvoiceWidget` に `defaultOpen` prop 追加: `useState(!!defaultOpen)` で初期状態を制御
  3. `SpkPaymentSection` 更新:
     - Square請求のバッジ・金額を `spk_accounting` の `url IS NOT NULL AND paid=false` から計算（jalan_payments の予約番号は除外、NHA と同ロジック）
     - 予約外未収タップ → `<SpkExtraUnpaidWidget defaultOpen={true}/>` を展開
     - Square請求タップ → `<SquareInvoiceWidget defaultOpen={true}/>` を展開（1タップで中身が見える）
- **バージョン**: `APP_VERSION=v4.6.64` / `sw.js CACHE_NAME=spk-v525` / `index.html CV=spk-v525` 同時更新

### DY00000000938 入金ステータス更新漏れ対応
- **症状**: Slack通知「✅入金確認完了 DY00000000938 ワダタイキ ¥8,100 予約外売上 札幌店」が届いたが、APP上で `paid=false` のまま残っていた
- **即時対応**: DB直接UPDATEで `paid=true` に修正（id=9a60be43-9cf7-4b94-b3dc-3b2af81a2de0）
- **残課題**: `syncPaidToAccounting` GASトリガー（HANDYMAN Payment）がこのレコードを更新しなかった原因調査。Slack通知は飛んでいるので検知はしているが、DB更新失敗（列名ズレ等）の可能性あり
- **2026-04-23 追記**: ローカルの `payment_bot_unified_v1.gs` には `syncPaidToAccounting` 関数が存在しない → 別GASプロジェクト or 旧バージョンに格納されている可能性。次回インシデント発生時に GAS実行ログを目視し、必要なら `forceSyncAllPaidRecords()` を手動実行（過去分一括同期）

### Square失敗モーダルを那覇店と同機能に統一（v4.6.63）
- **要望**: 「スクショの機能がSPKに無いので新しく実装してください。まずは配置・デザインを統一してから」（画像: `スクリーンショット 2026-04-23 14.35.51.png` — 那覇店のSqFailedModalで「+ 手動入力」ボタンと行別「除外」ボタンが存在）
- **SPK側に欠けていた機能**:
  1. 「+ 手動入力」ヘッダーボタン（sq_terminal_failedを介さず、Square端末決済の取りこぼしを直接会計起票）
  2. 各行の「除外」ボタン（テスト決済 / じゃらん現地決済 / 重複決済 等を会計起票せずに sq_terminal_failed から外す）
  3. 3モードstate machine（list / edit / manual）
- **実装 (`index.src.html`)**:
  1. `_guessStore(it)` ヘルパー追加（note/item_name/reason/raw_data を見て SPK/NHA/UNKNOWN を判定）
  2. `SqFailedModal` 全面書き換え: NHA版をSPK向けに移植
     - `mode` state追加、`startManual()` / `exclude()` / `submitManual()` 関数を実装
     - ヘッダーに「+ 手動入力」ボタン（list mode時のみ）
     - 行末に「起票へ」「除外」の2ボタン
     - 詳細フォーム下部に「🚫 除外」ボタン追加
     - 店舗入力は "SPK（札幌店）" に固定（那覇店は NHA APP で起票）
     - フィルタ: `_guessStore(it)!=="NHA"` で札幌 + 不明のみ表示（那覇レコード完全除外）
  3. `SqFailedWidget` / `SpkPaymentSection` の件数・合計も同フィルタに統一（TOP表示と詳細モーダルのズレ防止）
  4. 除外レコードは `resolved_store:"EXCLUDED"` で sq_terminal_failed から外す（監査ログ保持）
- **バージョン**: `APP_VERSION=v4.6.63` / `sw.js CACHE_NAME=spk-v524` / `index.html CV=spk-v524` 同時更新
- **店舗分離ルール**: sq_terminal_failed は NHA/SPK 共有テーブルだが、NHA APP と SPK APP でフィルタを反転（NHA APP は `!=="SPK"` / SPK APP は `!=="NHA"`）。UNKNOWN は両方に表示される

### TOP画面を那覇店と同一仕様に統一（v4.6.62）
- **要望**: 「TOPの配列を全て 那覇店 と同じ仕様にしてください」
- **実装 (`index.src.html`)**:
  1. 新規共通部品を追加: `TopSectionTitle` / `TopIcon`（那覇店と完全一致の見た目・パラメータ）
  2. `SpkPaymentSection` 新規: 4アイコン（Square失敗 / 予約外未収 / Square請求 / じゃらん事前）。タップで対応ウィジェットを展開
  3. `SpkBusinessSection` 新規: 4アイコン（配車待ち / 直近24h / 問い合わせ / 車両チェック）
  4. TOP配列を那覇店準拠に再編:
     - 協議中 → MemoBox → LeadTimeWidget → 💳決済(4アイコン) → 📊業務/関連APP(4アイコン) → タスクサマリー / 本日スケジュール(2列ヘッダ) → 個人別タスクサマリー → 本日スケジュール → セクション別4列アイコングリッド → 同期ステータス
  5. `sections` を那覇店準拠に再編（「会計」を独立セクションに昇格、免許証を「データ・分析」配下に）
  6. 旧コンポーネント（SqFailedWidget単独表示 / TopRecentWidget単独 / SquareInvoiceWidget単独 / JalanPaymentWidget単独 / 問い合わせ&車両チェック横並び）は削除（決済/業務セクション配下に統合）
- **バージョン**: `APP_VERSION=v4.6.62` / `sw.js CACHE_NAME=spk-v523` / `index.html CV=spk-v523` 同時更新

### 🛡️ tasks opts (B/C/J) 同期の根本修正（GAS gas-email-import-v2.gs）
- **背景**: マキノリナ(R04OWZ6U)でじゃらん予約のチャイルドシート数量が OP画面/TOP で「×1」表示されるが実際は2個。DB確認すると `reservations.opt_c=1` / `tasks.opt_c=false`(boolean) / `tasks.changed_json._optC=1` / `tasks.memo` 末尾 `##BCJ:0,1,0` で全て 1 が保存されていた
- **根本原因（構造上の欠陥）**:
  1. OTA自動登録GAS(30分)が先に `reservations` を作成（opt_c=0）→ APP側で `tasks` 生成（opt_c=false, memo ##BCJ:0,0,0）
  2. 札幌メール取込GAS(15分)が後追いで `parseJalan_` 実行 → `reservations.opt_c` パッチ
  3. **tasks 側は一切同期されず取り残される** ← 構造欠陥
  4. APP `_fromDbTask` の読み取り優先順位が `changed_json._optC > memo ##BCJ: > opt_c(bool)` なので、tasks 側の古い値が UI に表示される
- **修正内容（`gas-email-import-v2.gs`）**:
  1. `patchTaskOpts_(reservationId, optB, optC, optJ)` 関数新規追加（`patchTaskPlaces_` と同型）
     - 3タスク（d-/c-/w-）全部に対して `memo ##BCJ:` マーカー書き換え + `changed_json._optB/_optC/_optJ` マージ + `opt_c` boolean 更新を実行
     - `memo` 本文と `changed_json` の既存フィールド(_ssTime/_ssPlace等)を保持したまま opts だけ差し替え
  2. 既存予約パッチパス（line 269-287付近）に `patch.opt_b/opt_c/opt_j` のいずれかが含まれる場合 `patchTaskOpts_` を呼び出すロジックを追加
  3. 診断・遡及関数追加:
     - `testPatchTaskOpts()` — R04OWZ6U で単体テスト（GASエディタ手動実行）
     - `resyncAllTaskOpts()` — 今日以降の予約で tasks.opts ≠ reservations.opts のものを全件再同期（遡及バッチ）
- **即時修正**: R04OWZ6U の 3タスク（w-/c-/d-）を DB 直接更新で `##BCJ:0,2,0` / `opt_c=true` / `_optC:2` に修正済
- **再発防止レベル**: じゃらん/楽天/skyticket/エアトリ 全OTAで有効（`processMessage_` の共通パッチパスに入れたため）
- **運用手順**:
  1. GAS エディタに `gas-email-import-v2.gs` を貼付（既に pbcopy 済み）
  2. GAS エディタで `resyncAllTaskOpts` を1回手動実行 → 過去に取り残された予約も一括で同期
  3. 以降の新規予約は `processMessage_` が自動で tasks 側も同期するので手動作業不要
- **教訓**:
  - 「reservations はパッチされるが tasks は取り残される」パターンは del_place/col_place で既に修正済み（patchTaskPlaces_）だったが opts/insurance は未対応だった
  - **次に同パターンの取りこぼしを起こさないためのルール**: `reservations` の新しいカラムが tasks の表示に影響する場合、必ず `patchTask*_` 型のヘルパーを同時に実装すること

## 2026-04-22 修正履歴

### TOP じゃらん事前決済ウィジェットに金額合計を表示 (v4.6.56)
- **要望**: 「じゃらん 未決済分 の合計を TOP の枠に表示」
- **実装 (`index.src.html` JalanPaymentWidget)**:
  - `unpaidAmount`: `status in [new/link_created/email_sent]` の amount 合計
  - `paidAmount`: `status=paid` の amount 合計
  - 2つのバッジを追加: 「未決済合計 ¥X,XXX」（赤）「入金済合計 ¥Y,YYY」（緑）
- **バージョン**: `APP_VERSION=v4.6.56` / `sw.js CACHE_NAME=spk-v517` / `index.html CV=spk-v517` 同時更新
- **コミット**: `d16ef96`

### 🚨 駐車場の車両シャッフル問題を根本修正（v4.6.55、最優先対応）
- **症状**: 札幌店 駐車場タブで車両が勝手にシャッフルされ、どこが空いていてどこに車両があるのか分からなくなる。ユーザーが車両を移動しても、数秒後に前の状態に戻ってしまう
- **ユーザー評価**: 「最悪の出来事」
- **根本原因（4つのバグの合わせ技）**:
  - **Bug A (直接原因)**: `isRemoteUpdate` フラグの猶予が **100ms** しかないが、`DB.parking.save` の debounce は **500ms**
    - T=0: ユーザー車両移動 → `setSpots` → auto-save 予約 (T=500)
    - T=200: Realtime エコーや polling 到着 → `isRemoteUpdate=true` → `setSpots(古い値)` → UI が前の状態に戻る (シャッフル)
    - T=300: フラグ解除
    - T=500: auto-save fire → 古い値で DB 上書き → 変更が消失
  - **Bug B**: `masterSyncedRef` が定義されているのに**一度も使われていない**。`masterVehicles` の変更毎に useEffect 発火。初期 fetch 完了前に走ると LS データ + 新規車両で auto-save → DB 上書き
  - **Bug C**: 初期 fetch で `isRemoteUpdate=true` を立てていない → 起動直後に `setSpots/setCars` が auto-save を誘発 → LS 由来の古い data を DB に書き戻す
  - **Bug D**: Polling/Realtime がローカル dirty 状態を無視 → debounce 中 (500ms) のローカル変更が古い DB 値で上書きされる
- **修正内容 (`index.src.html`)**:
  1. `REMOTE_ECHO_MS = 3000` (100ms → 3秒、SYSTEM_SPEC 準拠)
  2. `LOCAL_DIRTY_MS = 5000`: 直近 5 秒にローカル変更があれば Realtime/Polling の上書きを拒否
  3. `lastLocalChangeAt` ref: auto-save useEffect で `!isRemoteUpdate` のときだけ時刻記録（ローカル起因の証拠）
  4. `initialLoaded` state: 初期 fetch 完了を state で伝搬
  5. `masterSyncedRef`: 初期ロード後 & 初回のみ実行するように guard（`if(masterSyncedRef.current)return; masterSyncedRef.current=true;`）
  6. 初期 fetch 中は `isRemoteUpdate=true` を維持 → 完了後 3 秒でリセット
  7. Polling の async fetch 完了後に再チェック（fetch 中に起きたローカル変更を見逃さない）
- **バージョン**: `APP_VERSION=v4.6.55` / `sw.js CACHE_NAME=spk-v516` / `index.html CV=spk-v516` 同時更新
- **コミット**: `a44e25c` (fix(駐車場): 車両シャッフル問題を根本修正)
- **教訓**:
  - Realtime エコーウィンドウは 3秒以上必要（SYSTEM_SPEC のルールを駐車場モジュールでは 100ms に縮めていた）
  - Debounce save と Realtime/Polling のタイミング差は最大ウィンドウ（debounce + echo）を重ねてカバーする
  - `useRef` で定義したフラグを `useEffect` で確認し忘れていないか必ずレビュー



### オプション（チャイルド/ベビー/ジュニア/USB/日傘）表記を洗車・DEL・COLに拡張 + 数量常時表示（v4.6.54）
- **要望**: 「洗車タスクにはオプションの種類だけ表記されているが、貸出(DEL)・返却(COL)にも表記してほしい。また数量も明示してほしい。マキノリナ様の予約はチャイルドシート2つなので、このままだと積み込みミスが起きる」
- **発覚**: マキノリナ様(R04OWZ6U、じゃらん、4/23 DEL)で `opt_c=1` が DB に入っていたが、実態は2個だった。UI側は count=1 の時は `×` を出さない仕様だったため、数量不明のまま「C(チャイルド)」とだけ表示されていた
- **修正内容 (`index.src.html`)**:
  1. `OptBadges` ヘルパー: `count>1?"×"+count:""` → **常に `×N` 表示**（B/C/J は数量明示、USB/日傘は boolean なので数なし）。枠線・フォント強調追加
  2. OP画面スケジュールタブ (line 8284): `type==="洗車"` 条件を **洗車/DEL/COL** に拡張
  3. OP画面 DEL/COL カードタブ (line 8054): 既存の手書き `B:2 C:1 J:0` バッジを **`OptBadges` に統一**（USB/日傘も対応）
  4. TOP 本日スケジュール (line 12836): `OptBadges` を洗車/DEL/COL で表示
  5. TOP 時間未定洗車 (line 12861): `OptBadges` 追加
- **DB直接修正**: R04OWZ6U の `opt_c` を 1→2 に UPDATE
- **バージョン**: `APP_VERSION=v4.6.54` / `sw.js CACHE_NAME=spk-v515` / `index.html CV=spk-v515` 同時更新
- **コミット**: `505b871`（コミットメッセージは別件の "fix(ClsRevCard): 売上表示を百万→万に統一" だが、差分には本修正も含まれている）
- **残タスク**: じゃらんメール原文で「チャイルドシート×2」と書かれているなら `parseJalan_` の正規表現バグ → パーサー修正必要。元メールで「×1」しか書かれていないなら顧客追加連絡でDB修正のみ完結

## 2026-04-21 修正履歴（続き5）

### じゃらん那覇テンプレ誤送信 + 過大請求 対応（11名クローズ）
- **背景**: `sendJalanPaymentEmail_` が那覇テンプレで札幌顧客に送信され、かつ一部で過大請求されていた障害
- **対象者分類（計11名）**:
  - **A群 6名（店舗名誤りのみ）**: 前セッションで謝罪メール送信完了
  - **B群 5名（店舗名誤り＋価格誤り）**: 本セッションで対応完了
    | 予約番号 | 旧金額 | 新金額 | 差額 | 宛先 |
    |---|---:|---:|---:|---|
    | R0Q7UEF3 | ¥19,300 | ¥16,300 | -¥3,000 | smhi4381@docomo.ne.jp |
    | R0742RTL | ¥55,950 | ¥52,050 | -¥3,900 | itarian_barbar@yahoo.co.jp |
    | R02XF89Q | ¥30,000 | ¥27,000 | -¥3,000 | zamasu44@icloud.com |
    | R0CYV6NR | ¥21,300 | ¥17,000 | -¥4,300 | ryota.223@icloud.com |
    | R0GRD083 | ¥78,600 | ¥78,200 | -¥400  | t.y.network29@docomo.ne.jp |
- **B群 対応ステップ（gas-email-import-v2.gs に追加した関数）**:
  1. `diagnoseFiveAmountDiscrepancies()` — Gmail元メール＋DB状態＋parseJalan_再実行で正しい請求額を特定
  2. `reissueFivePaymentLinks()` — 旧Squareリンク DELETE → 新リンク CREATE → DB更新（amount/square_payment_url/status='link_created'/email_sent_at=null）→ 支払い管理シート更新。`checkSquareLinks` トリガーを自動停止（再送完了までメール誤送信防止）
  3. `resendApologyToFiveCustomers()` — 件名「【お詫び・再送】...予約番号: <id>」で謝罪＋金額訂正理由＋旧リンク無効化通知＋新リンクを送信。送信後 DB を `status='email_sent', email_sent_at=now` に更新
  4. `verifyFiveApologySent()` — 事後検証（DB状態 + Gmail送信済みトレイ両面チェック）
- **18:43 送信完了**: 5通全送信成功、Gmail 送信済みトレイで実データ確認済
- **トリガー再設定**: 18:44 に `setupJalanPaymentTriggers` 実行で `checkSquareLinks`(5分) / `checkPaymentStatus`(15分) / `checkUnpaidAlert`(毎朝9:00) / `updateSheetOtaColumn`(毎朝9:30) 再開
- **那覇/札幌範囲**: じゃらん事前決済機能は **札幌店のみ**。那覇店は機能自体が無いため同型障害は起こりえない（3段階の那覇ガード: `isSapporoReservation_` / `handleJalanPayment_`冒頭BLOCK / `watchdogJalanPayment` 札幌絞込）

### 根本原因判明（未修正・保留中）
- **症状**: 5名全員 `reservations.discount=¥0` で登録されていた → Square請求書は `price`（合計金額＝クーポン・ポイント前）で発行される一方、APP画面は `base+option-discount` で表示されるため値が一致しない不整合
- **原因**: `gas-email-import-v2.gs` 既存予約パッチロジック **line 259**
  ```javascript
  if (!existingRow.price && +(reservation.price||0) > 0) patch.price = reservation.price;
  ```
  - `existingRow.price` が 0 の時しか上書きしない
  - OTA自動登録GAS（30分）が先に `price=合計金額(¥19,300)` で予約作成
  - 札幌メール取込GAS（15分）が後追いで `parseJalan_` 正しく `price=利用者への請求額(¥16,300)` + `discount=¥3,000` を算出するが、`existingRow.price=¥19,300` は truthy → price 上書きされない
  - line 263 で discount だけは上書きされる → 結果 DB は `price=¥19,300, discount=¥3,000` の矛盾状態
  - `handleJalanPayment_(reservation)` はパーサー出力の `reservation` 直接を使うので… と思いきや Square発行額には price=¥19,300 が使われる経路がある（5名全員がこのパターンで発行された実績）
- **保留中の修正案**:
  ```javascript
  var parserHasDiscount = +(reservation.discount||0) > 0;
  var existingHasDiscount = +(existingRow.discount||0) > 0;
  if (reservation.ota === 'J' && parserHasDiscount && !existingHasDiscount) {
    // discount を新規検出 = existingRow.price は 合計金額（クーポン前）の可能性高
    if (+(reservation.price||0) > 0) patch.price = reservation.price;
    if (+(reservation.base_price||0) > 0) patch.base_price = reservation.base_price;
    if (+(reservation.option_price||0) > 0) patch.option_price = reservation.option_price;
    patch.discount = reservation.discount;
  } else {
    // 既存の欠落補完ロジック
  }
  ```

### 未実行タスク（次セッションで判断）
1. 上記 line 259 根本原因修正の適用
2. `auditAllJalanOverbilling()` 全件監査実行（他のじゃらん過去予約に同バグ被害者がいないか確認。本セッションで関数は追加済）
3. `watchdogJalanPayment` トリガー再開（現在停止中）

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

### 🛡️ じゃらん決済起票漏れ監視 Watchdog（再発防止・第2層 2026-04-21追加）
- **追加関数** (`gas-email-import-v2.gs`):
  - `watchdogJalanPayment()` — 監視本体
  - `setupWatchdogTrigger()` — トリガー設定（1回だけ手動実行）
- **目的**: コード修正（第1層）が将来再度外れても、1時間以内に自動検知＋Slack通知＋自動リトライする
- **動作**:
  1. `reservations.ota='J' & price>0 & lend_date≥今日 & status≠cancelled` を取得
  2. `isSapporoReservation_` で札幌予約に絞込（那覇は対象外）
  3. `jalan_payments` に対応行がない予約を検出
  4. `handleJalanPayment_(r)` を呼んで自動復旧を試みる（内部の冪等チェックで重複起票なし）
  5. 結果をSlack `#jalan_payment` に投稿（✅復旧成功 / ❌復旧失敗 を区別）
- **トリガー**: 毎時実行。GASエディタで `setupWatchdogTrigger` を1回手動実行すれば設定完了
- **新機能追加時のチェックリスト（第3層・運用ルール）**:
  1. 新規予約パス（INSERT分岐）✅
  2. 既存予約パス（`type:'skip'` 分岐）✅ ← R0XHDPI1で漏れた箇所
  3. 競合パス（race分岐）✅ ← 同じく漏れた箇所
  4. キャンセルパス ✅

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

---

## ✅ 2026-06-02 タスク管理タブ を NHA/SPK/BT 3本体APPにネイティブ統合（hdm-todo→各本体タブ）

### 背景・方針転換
当初 単独アプリ `nosh2318.github.io/spk-task/hdm-todo/`（omniが当日 v1.0→v1.8まで自律開発）として公開したが、オーナー判断で**「店舗ごとに仕様が異なる→各本体APPに1タブとしてネイティブ実装」**へ転換。さらに不特定多数の同時利用に耐えるためデータ構造を作り直し。

### 旧アプリの致命的欠陥（監査で判明）→ A案で解消
- 旧: 全状態を `hdm_todo(main)` の**1行JSONBに丸ごと保存・無条件upsert(LWW)**。12秒ポーリング。
  - **同時編集でデータ消失**（HIGH-1: 別ユーザーの全体ドキュメント上書き）、編集モーダル中保存で全員の変更巻き戻し（HIGH-2）、anon開放で誰でも全消し可能（MED-5）、同期断で自動復旧なし(MED-3)、オフライン編集破棄(MED-4)。
- A案（採用）: **1行=1タスク（per-entity）＋ Supabase Realtime ＋ authenticated RLS**。
  - 別タスクの同時編集は衝突しない。anon廃止＝本体ログイン(authenticated)必須。即時反映。

### データ構造（SQL: `hdm-todo/SUPABASE_v2_realtime.sql`）
| DB | テーブル |
|---|---|
| ckrxttbnawkclshczsia | `nha_todo_tasks`/`nha_todo_meta` ・ `spk_todo_tasks`/`spk_todo_meta`（PART A）|
| ggqugvyskyiblxiycpci（BT独立）| `bt_todo_tasks`/`bt_todo_meta`（PART B・**別プロジェクトで別途RUN必須**）|
- tasks列: id,area,title,assignee,parent_id,priority,status,progress,start_date,due_date,description,logs(jsonb),attachments(jsonb),admin_confirmed,completed_at,created_at,**deleted**(論理削除),updated_at
- meta: id（`{store}:goals` / `{store}:staff`）, data(jsonb)
- RLS: `for all to authenticated using(true)`。grant select/insert/update（物理delete無し＝deleted=true運用）。`alter publication supabase_realtime add table ...` でRealtime配信。

### 実装方式：共通バンドル `hdm-todo/todo-tab.gen.js`（生成器 `build_todotab.py`）
- hdm-todo/index.html の**検証済み17コンポーネントをverbatim抽出**＋CSSを**全セレクタ `.hdmtodo` 配下にスコープ**（ホストTailwind/既存CSSと衝突回避。`.card .btn .bar .chip` 等の汎用名が本体と被るため必須）。
- **IIFEで全内部名を隔離し `window.TodoTab` だけ公開**（`Donut/Timeline/Dashboard/parse/today/uid` 等が本体18000行と「Identifier already declared」衝突するのを防止）。
- 永続化ルート `TodoTab({store,sb,label})` を新規：ホストの**認証済み `sb`** で per-entity CRUD（`{store}_todo_tasks` upsert / deleted=true / meta upsert）＋ `postgres_changes` Realtime購読。`me`(入力中の担当)は端末ローカル(localStorage)。
- ページchrome（rail/landing/topbar/bnav）は除去し**タブ内パネル**として描画（横タブバー＋body＋編集モーダル）。
- 再生成: `cd hdm-todo && python3 build_todotab.py`（omniがhdm-todoを更新したら再生成→各本体へ再注入）。

### 各本体への注入（共通手順）
1. `python3` で `todo-tab.gen.js` を **ReactDOM.render の直前**に注入（text/babelブロック内）。
2. navItems に `{id:"todo",ico:"✅",l:"タスク管理"}` を顧客の隣に追加。
3. 描画スイッチに `{tab==="todo"&&window.TodoTab&&React.createElement(window.TodoTab,{store:"<spk|nha|bt>",sb:sb,label:"..."})}`。
4. バージョン更新→build→commit→push。

| 店 | repo / source | store | バージョン | コミット |
|---|---|---|---|---|
| SPK | spk-task / index.src.html（build.js）| spk | v4.7.192 / spk-v737 / sw?v=624 | (push済) |
| NHA | naha-project / index.html.bak（build.js）| nha | v3.5.91-NHA / BASE_V=3591 | (push済) |
| BT | buddica-touring/app / index.html.bak（build.js）| bt | v1.0.58-BT / BASE_V=1427 | (push済) |

### 移行・検証
- **NHA既存14タスク移行**: `hdm-todo/MIGRATE_nha.sql`（旧hdm_todo(main).naha を json_to_recordset で nha_todo_* へ。SQL EditorはRLS非対象なのでINSERT可）。PART A実行後に1回RUN。
- **同時編集テスト（2026-06-02 合格）**: authenticatedログイン→spk_todo_tasks に別タスクA/Bを並行 insert+update→両方独立保存(A=50%,B=80%)確認。旧LWWで起きた消失が解消されたことをデータ層で実証。

### 残（オーナーRUN）
1. **PART B** を `ggqugvyskyiblxiycpci`(BT) SQL Editor でRUN（未実行＝bt_todo_* 404）→ BTタブ稼働。
2. **MIGRATE_nha.sql** を `ckrxttbnawkclshczsia` でRUN → NHAタブに14タスク表示。
3. SPKは PART A済で即稼働（空スタート）。各本体リロードで反映。
- 旧単独 `hdm-todo/` は当面残置（移行確認後に案内停止）。

### Lesson
1. **他HTMLアプリを本体に取り込む時は「CSSスコープ＋IIFE隔離（window公開）」が必須**。汎用クラス名・関数名は巨大ホストと必ず衝突する。
2. **多人数同時編集は per-entity 行 + Realtime が基本**。1ドキュメントLWWは少人数でしか持たない。
3. **DDL/移行INSERTはSQL Editorで（RLS非対象）**。CLIのanon/authenticatedからDDL不可。

### 追補 2026-06-02: タスク管理「評価期間」機能 + 生成器の堅牢化
- Dashboard の個人・チーム評価に **全期間／月別／年間(合算)** トグルを追加（due日基準でフィルタ→evalPerson再計算）。年間時は「月別内訳(チーム合算)」も表示。canonical `hdm-todo/index.html` を改修し再生成→3アプリ再注入。
- バージョン: SPK v4.7.193/spk-v738 / NHA v3.5.93-NHA(BASE_V=3593) / BT v1.0.59-BT(BASE_V=1428)。全て本番200・機能反映確認済。
- **生成器 build_todotab.py を「行番号→マーカー抽出」に変更**（hdm-todo改修で行ズレ→旧ハードコード範囲がコンポーネントを切断し構文エラーになった教訓）。再注入は各ホストの `/* ===== HDM ToDo タスク管理タブ` 〜 `ReactDOM.render` 間を置換するスクリプトで実施。
- **検証の罠**: minified版(SPK/NHA)は識別子(evalP)がmangleされgrep不可。文字列リテラル(「全期間」)で確認する。BabelはJSX内日本語を\uエスケープする場合あり(BT)。
- **並行作業の注意**: 本セッション中、Slack omni が NHA/BT を並行編集（経営KPIスナップショット展開・index.htmlタイトル変更等）。コミット前に必ず `git fetch`+`git log`+`git status` で omni の変更を確認し、その上に積む（clobber防止）。omniの未コミット .claude/CLAUDE.md は触らない。

### 🔴🔴 2026-06-02 重大インシデント: NHA本番 白画面（バージョン更新スクリプトのファイル空化バグ）
- **症状**: 那覇店APP `nosh2318.github.io/naha-project/` がアクセスすると真っ白（index.html が 0バイトで配信）。
- **真因（自分のミス）**: バージョン更新で次の**危険なPythonワンライナー**を使った:
  `io.open(f,"w").write(io.open(f).read().replace(...))`
  → Pythonは `io.open(f,"w")`（=ファイルを即truncate＝空に）を**先に評価**し、その後で引数の `io.open(f).read()` が**空になったファイル**を読む。結果**空文字を書き込み**、index.html / index.html.bak / sw.js が **0バイト化**してcommit&pushされた。
- **被害**: NHA index.html(本番ローダ)＝白画面 / NHA index.html.bak(ソース)＝ビルド不能(text/babel消失) / SPK sw.js＝空(無害だが破損)。app.jsは無事（`wc -l`が0行表示だったのはminified1行ファイルの誤読、`wc -c`で確認すべき）。
- **復旧**: `git show <good_commit>:file > file` で直前正常コミット(NHA=8e8587d / SPK sw.js=22b5115)から復元 → 安全な手順で再ビルド → push。NHA v3.5.95 / SPK sw spk-v739 で復旧確認(本番200・11852bytes)。
- **絶対ルール（再発防止）**:
  1. **`open(f,"w").write(open(f).read()...)` を絶対に書かない**。必ず「先に読んでから書く」: `t=open(f).read(); t=t.replace(...); open(f,"w").write(t)`。
  2. ファイル破損チェックは **`wc -c`（バイト）** で。`wc -l` はminified1行ファイルで0と出て誤判定する。
  3. **push前に成果物の非空＆主要マーカーを検証**（index.htmlが5KB未満なら異常）。本番デプロイ系は特に。
  4. バージョン更新は Edit ツール（厳密置換）を優先。スクリプト一括置換するなら read→replace→write の3段で。

### 追補 2026-06-02: タスク管理「スタッフをシフト登録から自動表示＋出勤日表示」+スマホ最適化
- **メンバー自動表示**: TodoTab に `hostStaff`(本体 staff テーブル) / `hostShifts`(本体 shifts {date:[{name,symbol,start,end}]}) を渡し、担当者リストを**本体のスタッフ/シフト名簿から自動導出**（+タスク割当済の名前も補完）。タスク用の手動スタッフ登録は実質不要に。
- **出勤日表示**:
  - タイムライン: 各メンバー行で**出勤日セルを青く色付け**（`isWorkDay`／休系記号 休/有/公/欠/×等は除外）。
  - スタッフ欄: 各メンバーに**「今月出勤N日」＋出勤日チップ**、月セレクタ付き。
  - ヘルパー `REST_SYMBOLS`/`isWorkShift`/`workDaysOf`/`isWorkDay` を hdm-todo に追加。
- **スマホ最適化**: タブバー横スクロール、kgrid 2列、eval/board/goal 1列、タイムライン min-width縮小、シート94vh 等を `.hdmtodo` スコープCSSに追加。
- 各本体の render に `hostStaff:staff, hostShifts:shifts` を追加（NHA/BT/SPK とも `staff`/`shifts` state が App スコープに在席を確認済）。
- バージョン: SPK v4.7.195/spk-v740 / NHA v3.5.98-NHA(BASE_V 3599) / BT v1.0.61-BT(BASE_V 1430)。全本番200。
- **生成器運用**: hdm-todo/index.html（コンポーネント）+ build_todotab.py（TodoTabルート/CSS）を直し `python3 build_todotab.py`→3ホストへ「マーカー間置換」で再注入→各build→push。re-injectは `/* ===== HDM ToDo タスク管理タブ` 〜 `ReactDOM.render` を置換。

### 🔴 2026-06-02 インシデント: 出勤日ヘルパーが生成器の抽出範囲外でバンドル未収録→白画面
- **症状**: SPK/NHA/BT のタスク管理「タイムライン」「スタッフ」タブ押下で `Uncaught ReferenceError: isWorkDay is not defined` → 白画面。
- **真因**: hdm-todo/index.html に追加した `REST_SYMBOLS`/`isWorkShift`/`workDaysOf`/`isWorkDay` を、生成器 build_todotab.py の抽出マーカー **「/* ===== small components」より前**に置いた。生成器の `components = between("/* ===== small components","function Landing(")` 範囲外＝バンドル未収録。シード末尾(multi-store)とsmall componentsの間は「どの抽出範囲にも入らない死角」。
- **修正**: ヘルパーをマーカー**直後**へ移動。再生成後 `grep "function isWorkDay" todo-tab.gen.js` で**バンドル収録を必ず検証**してからデプロイ。
- **再発防止ルール**:
  1. **hdm-todo に関数/定数を足すときは、必ず抽出される3範囲のどれかに入れる**（constants:「/* ===== constants」〜「/* ===== persistence」 / seed:「/* ===== seed」〜「/* ===== multi-store」 / components:「/* ===== small components」〜「function Landing(」）。範囲の「隙間」に置かない。
  2. **再生成後、新規シンボルが todo-tab.gen.js に含まれるか grep で検証**してから再注入・デプロイ。Babel構文OKだけでは「未定義参照」は検出できない（実行時エラー）。
  3. minified版(SPK/NHA)は識別子がmangleされるので、検証は**文字列リテラル**（例:REST_SYMBOLSの「代休」）で行う。
- 修正版: SPK v4.7.196/spk-v741 / NHA v3.5.100 / BT v1.0.62。全本番200・helper反映確認。

### 追補 2026-06-02: タスク管理 評価を「進捗トラッキング＋メンバー比較（点数化なし）」に確定
- **方針**: 個人を点数化/グレード(S/A/B/D)しない（オーナー判断：時代的に順位/評点はモチベを下げる）。代わりに**大テーマの数字＋"やった分=ログ"**で見える化し、人が判断する。
- **担当名 正規化**: タスクの担当名を本体スタッフ名簿表記へ統一（`さん`除去＋異体字エイリアス 齊→齋 等）→「伊江/伊江さん」等の重複解消。空の名簿メンバーは隠さない（オーナー指定）。root に `resolveName`/`viewTasks` 実装。
- **進捗トラッキング設計（Dashboard）**:
  - 📊チーム進捗: 完了率%・平均進捗・ステータス内訳バー（完了/進行中/相談/未着手）・期限超過。
  - **メンバー比較テーブル**（大テーマ一覧・点数なし）: 担当/完了/進行中/未着手/平均進捗/完了率/**📝ログ数**/🚩超過。期間トグル(全期間/月別/年間)連動。
  - 👤個人進捗カード: **タップでその人の全タスク詳細モーダル**（タイトル/領域/状態/期限/進捗/説明/最新ログ）。
  - 📈月別進捗トレンド（年間モード時）: 月別の平均進捗・完了率。
  - 旧評価(達成率×0.4+納期×0.3+進捗×0.2+ログ×0.1−減点 / S-Dグレード)は撤去（完了0だと全員Dで機能しなかったため）。
- **"やった分"の思想**: 完了率だけだと長期タスクをコツコツやる人が0%扱いで不公平 → **作業ログ(やった記録)**を評価材料の軸に。ログ列＋個人詳細の最新ログで可視化。
- バージョン: SPK v4.7.201 / NHA v3.5.104 / BT v1.0.66。全本番200。

### 追補 2026-06-02(続): タスク管理 進捗UI 追加実装＋ステータス4種化
- **個人進捗カード タップ→全タスク詳細モーダル**: その担当者の全タスクを「未着手→進行中→取り止め→完了」順・期限順で表示（タイトル/領域/状態/期限/進捗バー/説明/最新ログ）。Dashboard に `openP` state + scrim/sheet モーダル。
- **メンバー比較テーブル（点数化なし・期間連動）**: チーム進捗内に `cmp-tbl`。列＝メンバー/担当/完了/進行中/未着手/平均進捗/完了率/**📝ログ数**/🚩超過。期間トグル(全期間/月別/年間)で集計切替。「📝ログ＝やった分の記録」を評価軸に（完了0でも取り組みが見える）。横スクロール対応。
- **ステータス4種に変更**: `未着手/進行中/取り止め/完了`（旧「相談必要」→「取り止め」に改称）。STATUS配列に `ic`(○/▶/✕/✓)追加。chip.st-talk/seg.st.on.st-talk を赤系に（warnのamber=`--s-talk`は維持）。
  - 影響箇所を全リネーム: evalPerson talk / チーム内訳seg / 個人stat / 詳細モーダルsort / AIManager(相談待ち→取り止め)。STATUS.map参照(編集seg/ボード/フィルタ/ドーナツ)は自動追従。
  - 旧データ救済: root `viewTasks` で `status==="相談必要"→"取り止め"` に表示移行。
- **タイムライン帯のステータス表現（色は領域=エリアのまま維持）**: 帯背景は `areaColor` のまま、ステータスは**アイコン＋装飾**で表現（先頭に○/▶/✕/✓、取り止め=取消線+opacity.5、完了=opacity.82）。→ 色=領域・アイコン=ステータスの2軸表示。
- バージョン: SPK v4.7.202 / NHA v3.5.105 / BT v1.0.67。全本番200。
