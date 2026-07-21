# SPK業務管理APP（札幌店）

## 🪪 2026-07-21 高松(BT)に免許証システム展開＋全店 未提出アラート（このセッション）
- **BTご利用ガイド(`buddica-touring/app/guide/index.html`)に免許証アップUI追加**：撮影/選択→GAS(store=bt)→Googleドライブ保存＋`license_uploads`(BT DB・on_conflict=reservation_id)記録。`renderLicCard`/`licUpload`（vanilla）。boot()で既存アップ有無を確認して描画。RO/DEMOは閲覧のみ。GAS定数＝license.htmlと同じ`/exec`＋SECRET`hdm-lic-7c3f9a21`。
- **GAS `~/Desktop/HANDYMAN/license_drive_upload.gs`にBT専用フォルダ保存**：`STORE_FOLDER_ID={bt:'1rc7jZ2KoLV8oSoCxnI3It4UvQoVDxFFZ'}`（指定IDのフォルダ直下に`<予約 氏名>`）。**格納先は後で変更可＝このIDを差替えるだけ**。⚠️**オーナー作業＝GAS再デプロイ（新バージョン）**。未デプロイでもBTアップは動くが保存先が旧`HANDYMAN_免許証/高松/`→再デプロイでBUDDICAフォルダに切替。
- **BT免許証チェックリスト(`LicenseSendListBT`)を新仕様に統一**：予約全体ベース(`bt_reservations` start_date)・未提出のみ・種類区別撤去。BTはLINE無し＝`📋コピー`(ガイドURL `guide/?t=mypage_token`)＋`✅対応済`(消し込み)。消し込み保存＝新設`bt_line_sends`(license_ack・authenticated INSERT status=manual_done/DELETE action=license_ack)。BT v1.0.155-BT。
- **🔑 紐づけキー＝予約番号(reservation_id)だけ**（オーナー確認）：どの導線(顧客マイページ/ガイド、スタッフOPシート/タスクサマリ🪪→license.html)でも `license_uploads` に予約番号で記録→全チェックリストが`提出済`で自動連携。手動アップ＝**提出済**(対応済より上位・リストから消える)。license_uploadsが唯一の正本。
- **🚨 全店 免許証未提出アラート `license-overdue-alert` EF新設（毎日11:00JST・pg_cron jobid40）**：当日〜2日先出発で「未提出(license_uploads cnt=0)&未対応(license_ack無し)」を**SPK/NHA(main)＋BT(別DB ggqugvyskyiblxiycpci・service_role)を予約番号キーで横断照合**→通知先を分離：**札幌・那覇→#handyman_development(C07B5G3PV7C・HANDYMAN GL)／高松→#operation-高松空港店(C0BFMBLEJGZ・BUDDICA別ワークスペース・別botトークン `xoxb-11166564403237-…`=buddica_omni_bot)**。未提出0なら静か。secrets＝CRON_SECRET/SLACK_BOT_TOKEN(既存)＋BT_URL/BT_SERVICE_KEY/BT_SLACK_TOKEN(新設)。初回実測＝札幌2/那覇22/高松0。**BUDDICA botトークンは`~/Library/LaunchAgents/com.buddica.*-bridge.plist`から取得（別Slackへ投稿する時はそのワークスペースのbotトークンが必要）。****クロスDBはmain-project EFにBTのservice_roleを埋めてBT RESTを叩く型**（api-keys?reveal=trueで取得・`~/.config/keydrop/bt_service_key`）。

## 🪪 2026-07-21 免許証リマインド（札幌 license-reminder-cron）のURLをマイページ経由に修正＋テスト送信の型
- **状態(最終)**：2026-07-21 **3系統すべてON・統一稼働**（オーナー「那覇・札幌・KEYDROP 全て統一」指示）。`spk_line_config`/`nha_line_config` とも `license_auto_enabled=true`、pg_cron `license-reminder-spk`/`license-reminder-nha`(各 0 1 * * *=10:00JST・active)。**KEYDROP予約(ota=KEYDROP)は各店ループ内でメール**(keydrop_notifications→worker `keydrop-send-mail`毎分・`buildLicenseReminder`)、非KEYDROPはLINE(line-push)。URLは全系統マイページ経由(SPK my.html / NHA my-nha.html?t=mypage_token・那覇token 492/492保有・免許証カードは`!RO`条件で顧客にアップUI表示＝editable=falseと独立)。免許証完了=license_uploads(store一致 cnt>0)で除外。⚠️途中経緯：一時オーナー未承認のまま那覇がONだったのでCLI omniが一旦OFF是正→その後オーナーが「那覇もON/全統一」と決定し再ON。
- **免許証チェックリストを"予約全体ベース"に作り替え＝全店同一運用に統一(SPK v4.7.448 / NHA v3.5.313・オーナー指摘「店舗が変わってもやることは同じ・免許証だけのカテゴリで区別する理由がない」)**：旧版は傷チェック(DamageSendList)流用で**タスク基準＋受け渡し種類で絞っていた**(SPK=DEL / NHA=PUB/DEL/来店)＝店舗で見た目が違う原因。**免許証は運転者全員が必要＝受け渡し方法と無関係**なので、`{store}_reservations`(SPK=reservations lend_date/lend_time / NHA=nha_reservations start_date/start_time)を`in(dateCol,当日〜3日先)`で引く**予約全体ベース**に変更→種類の区別と担当バッジを撤去→**SPK/NHAが自然に同一**。**未提出(licM cnt=0)のみ表示**・提出済はヘッダーのカウントのみ。アクションを平易化：連携済=`🤖自動でLINE連絡`(放置OK・cron任せ・手動ボタン無し)／未連携=`📋コピー`／対応が済んだら`✅対応済`(=消し込み license_ack)。上部に説明1行。要対応0で「✅全員対応済」。**教訓：他機能のリストを流用する時は"そのカテゴリに固有の絞り込み条件"を引き継がない**(傷=受け渡し種類で送信タイミングが変わる／免許=全員必要で種類無関係)。
- **(統合前)消し込み(対応済チェック)追加(SPK v4.7.447 / NHA v3.5.312)**：オーナー要望「免許証が取得できてるか・未提出ユーザーの対応/状況把握・漏れなく」。①ヘッダーに`未提出 N` + `要対応 K`(=未提出かつ未消し込み・0で緑`✅消し込み完了`) ②各未提出行に`☑消し込み`ボタン(連携済⏳自動予定/未連携📋コピー どちらも)→押すと`✅確認済（消し込み）`で薄く沈み要対応から外れる・`取消`可 ③記録＝`{store}_line_sends action=license_ack status=manual_done`(送信ログと別・可逆)。ack判定=license_ack or 既存manual_done。要対応K=0で「全員フォロー済＝漏れなし」。範囲は当日〜3日先(タスク基準)。**🔑RLS**：line_sends INSERTは`with_check(status='manual_done')`許可→license_ackも通る。**DELETE(取消)はポリシー不在だったので`action='license_ack'限定のDELETEポリシー`を2表に追加**(送信ログ本体は消せない)。
- **手動チェックリスト(LicenseSendList・TOPタイル)を傷チェック(DamageSendList)と同一仕様に統一(SPK v4.7.446 / NHA v3.5.310)**：オーナー指摘「傷チェックリストと同じ仕様にすべき」。傷チェックは**LINE連携済＝完全自動(⏳自動予定・手動ボタン無し)／未連携のみ手動コピー+対応**。免許証も同型に＝連携済は`📤リマインド送信`ボタン撤去し**⏳自動予定**表示(毎朝10時cron任せ)、未連携は`📋コピー+✅対応`(コピーボタンも傷チェックと同じ青#2563eb)、`再送`撤去。自動送信済は`🤖自動送信済`表示。**BTは対象外**(LINE非対応・cronはspk/nhaのみ・別DB＝元からコピーのみで傷チェックと整合)。NHAは元版だったのでmypageURL+dedup+⏳自動予定を一括移植。
- **(旧記録)手動リストのURL/自動dedup統一(v4.7.445)**：①案内URLを`license.html`直リンク→**マイページ`my.html?t=mypage_token`経由**に統一(buildMsgでtokMap・token無しのみ従来fallback) ②`spk_line_sends`のクエリに自動送信action(`license_auto_d1/d2/d3`)を追加し、自動送信済は**「🤖自動送信済」表示＋青ボタン非表示**で二重送信防止。自動cron側も既送信除外に`license_reminder`(手動 sent/manual_done)を追加＝**手動対応済なら自動が送らない**（双方向dedup）。cron正本は多店舗版(SPK/NHA＋KEYDROPはメール keydrop_notifications)にSlack omniが拡張済＝私のdedupも取込済でHEAD一致。
- **⚠️並行編集の注意(この日の実例)**：`license-reminder-cron/index.ts`をSlack omniとCLI omniが同時編集。CLIが単店版をdeploy→直後にSlack omniが多店舗版に置換。**deploy前後で`git status`＋正本を確認し、supersetを最終deployして揃えた**。コミットは自分のファイルだけ明示add(gas/damage-overdue/handyman-mypage-nha等の他エージェント未コミット分を巻き込まない)。
- **修正**：`license-reminder-cron`(EF・毎朝10時・3日前/2日前/前日・未提出&LINE連携済・重複なし・`license_auto_enabled`で制御)の案内URLを **`license.html?id=<予約ID>`直リンク → `my.html?t=<mypage_token>`（マイページ経由）** に変更・デプロイ済。生の予約ID露出を廃し、他通知(お迎え/御礼)とURL統一。正本＝`~/spk-task/line_auto/license-reminder-cron/index.ts`→`~/hdm-car-delivery/supabase/functions/`にコピーして`functions deploy --no-verify-jwt`。reservations selectに`mypage_token`追加・token無しのみ従来直リンクにフォールバック。
- **🔑 my.htmlの免許証カード表示条件(L625-635)**：`!RO&&!cancelled`→**アップロードUI(licBody)表示**（お客様）／`RO(&ro=1)&&登録済(cnt>0)`→「✅登録済み」だけ／**`RO&&未登録`→免許証カード非表示(空)**。→ **スタッフ確認で`&ro=1`を付けて未登録予約を開くと「アップ欄が無い」ように見えるが正常**。お客様(ro無し)には必ずアップ欄が出る。免許証完了判定＝`license_uploads.reservation_id`のcnt>0。
- **🧪 オーナーだけにLINEテスト送信する型(再利用)**：line-push EFは`action="owner_test"`(or `"test"`)で誤送信ガード(予約実在/日付/status)を飛ばすが、宛先は`spk_line_links`の`resv_no→line_user_id`で解決する。→ **一時リンク行を作る**：`insert into spk_line_links(resv_no,line_user_id) values('ZZLICTEST…','<owner userID>')`→ line-push `{secret(=~/.config/keydrop/linepush_func_secret),store:"spk",resv_no,action:"owner_test",message}`をcurl→ **送信後リンク行と`spk_line_sends`(action=owner_test)を削除**。SPKオーナーuserID=`spk_line_config.test_user_id`(=Ua1f5217…)。Management APIはurllib=403(Cloudflare)→**curl必須**。EFはanon不要(secret認証)。

## 🗄 2026-07-21 CLAUDE.md 容量整理（上限超過対応）
このSPK CLAUDE.mdが**251k字＝上限150k字の1.7倍**でcontext圧迫警告が出た → **2026-04〜05月の詳細インシデント/修正履歴を `~/spk-task/CLAUDE_ARCHIVE_2026H1.md` に退避**（削除でなく分離・**123k字**に縮小）。過去バグ調査は同アーカイブを `grep`。恒久ルールは本体06〜07月項＋グローバルCLAUDE.mdに反映済みで生存。バックアップ＝`CLAUDE.md.bak_before_trim_20260721`。**同時にグローバル `~/.claude/CLAUDE.md` も完全重複2箇所を除去**（KPI再計算ケース/作業後更新ルール・65k→64.6k字・ドクトリンは無削除・bak有り）。**教訓：CLAUDE.mdが肥大したら「古い日付ログはアーカイブ分離／生ルールは残す」。文字数はJP1字≒1.75byte（438kbyte≒251k字）で判断。**

## 📨 2026-07-20 OPシート「顧客への依頼テンプレ」ボタン群＋送信済み表示＋🔖マーク（v4.7.428〜432）
OPシート マスター表☑️列と個人別サマリに、LINE連携客へ定型連絡を送るボタンを追加（⏰と同UI＝時間/文面ポップ→コピー/LINE自動送信）。**再利用パターンとして重要**：
- **ボタン3種**：⏰時間調整依頼（DEL・到着希望時間を8:30等へ変更依頼）／🅿️事前駐車(無人貸出)依頼（DEL・①挨拶文＝マイページURL自動挿入＋②停車場所フレーム手動入力の2テンプレ切替）／⏳回収遅延案内（COL・到着予定時間＋道路/混雑で遅延→もう暫しお待ちを、サマリ＋OPシート両方）。共通コンポーネント`ColDelayModal`（OP/サマリ共用・store内で完結）。
- **送信手段**：既存 `line-send`→`line-push`（`{store:"spk",resv_no,action,message}`＋ログイン`access_token`）。LINE連携=`window._lineLinkMap[rid]`。未連携は自動でクリップボードにコピー。
- **🔴 COLは返却日基準**：`line-push`の日付ガードは`returnAct`に入るaction以外は貸出日(delCol)基準→複数日レンタルで`past_or_no_date`で弾かれる。新action`col_delay`を`returnAct`に追加しEdge Function再デプロイ（正本`~/spk-task/line_auto/line-push`＋実体`~/hdm-car-delivery/supabase/functions/line-push`両方編集→`functions deploy line-push --no-verify-jwt`）。DEL系(time_adjust/advance_park)は貸出日基準でOK＝変更不要。
- **送信済み表示**：`line-push`は送信時に必ず`spk_line_sends`へ`status="sent"`記録。ローダー(App L20768 `ACTS`)に新action(time_adjust/advance_park/advance_park_place/col_delay)を追加→本日分を`window._actionDoneMap`に取込。送信成功時は`markLineSent(rid,action)`(新helper・DB二重insertせず即マップ反映＋`actionDoneUpdate`発火)。ボタンに`actionDoneOf(rid,action)`で緑✓＋時刻を表示。`actionDoneUpdate`はApp `actDoneVer`で再描画→子のOPScreenも追従。
- **🔖マーク（完了とは別の"印だけ"）**：☑️列に🔖トグル。保存＝`t._changed._mark`（`_addPay`と同じ実績パターン＝changed_jsonに往復・`_mergeUserInput`/mirror/SSパトロールで保持・1件だけ書込）。ON=アンバー枠+行薄黄／OFF=白地点線枠（opacity薄消しは見えないのでチップ化）。`_save`は単一タスク書込＝データ保全ルール順守。

## 🚨 2026-07-20 Supabase API層ハング【5回目】（07-04/09/16に続く）＝再起動で復旧・約1時間
主系(NHA/SPK共有 ckrxttbnawkclshczsia)でOPシートのタスク/ボタンが出ない。**切り分け＝REST実経路(anon)`/rest/v1/reservations`がHTTP000/503/521・DB本体はmgmt-api SQL応答(健全)・BT(別DB)正常・本日タスク/予約はDBに全存在＝API層のみハング(アプリのバグでもデータ消失でもない)**。対応＝`POST /v1/projects/<ref>/restart`(HTTP200)→フラッピング→**REST5連続200で復旧確定**(11:37頃〜12:41)。教訓再確認：①手動再起動前に`~/Desktop/HANDYMAN/omni_bot/.sb_guardian_state.json`の`last_restart`を見て二重再起動回避(15分クールダウン。今回は前回4日前=OK)②anon鍵はlive app.jsから`grep -oE 'eyJhbGciOi...'`③通知はbot`sns_auto`で#omni-operation_3号機(C0B8747PR0R)＋#handyman_development(C07B5G3PV7C)にchat.postMessage。恒久策=PITR ON/東京レプリカ+フェイルオーバー(単一クラウド依存が根本)。

## 🅿️ 2026-07-20 駐車場スポットNo枠のはみ出し修正（v4.7.433）
スタッフが`sp.no`に長い駐車場名(「トラストパーク北6西6」「タイムズ北13西16」等)を入れると、SPOT枠が固定`width:48/height:44`+fontSize16で溢れ隣の行と重なる。修正＝枠を可変(`minWidth:48/maxWidth:100/minHeight:44`+padding+`overflow:hidden`)＋文字長でフォント自動縮小(`_noFs`=len≤3:16/≤6:12/≤10:9/else:8)＋`wordBreak:"break-all"`(index.src.html L18478/18482)。**教訓＝固定サイズのバッジ/チップにユーザー自由入力(名称)が入る箇所は、文字長でフォント縮小＋wrap＋overflow:hidden＋可変幅を必ず入れる**。

## 🕒 2026-07-16 その他タスクの時間等編集が保存されず戻るバグ根治（v4.7.425・台帳で確定）
札幌OP「その他」タスクの時間を13:00→14:00に変えても、何度やってもマスター表示が起票時の時間に戻る。**台帳が決定打**：該当その他タスク(面接:柳沢・_id=other_...)は`updated_at`は更新されるのに**audit_logに14:00の書込が1件も無い**（元値13:00→13:00の無差分書込のみ）＝**新しい時間が一度もDBに書かれていない**。
- **根本原因**：`updateOtherTask(id,updates)`（L15885）が `let upd=null;setTasks(ts=>{...upd=next.find(...);...});Promise.resolve(upd?DB.updateTask(upd):null)` ＝**setTasksの副作用で保存対象`upd`を捕捉し、その後に非同期保存**していた。Reactが更新関数を同期実行しないタイミングだと**`upd=null`のまま→保存が発火せず**、画面(ローカルstate)だけ14:00に変わりDBは13:00のまま→定常ミラー(ポーリング)がDBの13:00で表示を戻す。「何度入力しても戻る」の正体。
- **修正**：保存を**更新関数の中で確定値`u`（＝updatesが確実に乗った値）で発火**。`setTasks(ts=>{const next=...;const u=next.find(...);if(u){pendingSaves++;DB.updateTask(u,selDate)...}return next;})`。その他タスクの全編集(時間/担当/場所/車両/名前/メモ)が確実に保存される。同型アンチパターンは`updateOtherTask`1箇所のみ（DEL/COL等は明示オブジェクトで保存＝影響なし）。
- **教訓**：**`let X=null;setTasks(ts=>{...X=...});非同期処理(X)` は禁止パターン**（更新関数が同期実行される保証はない＝Xがnullで副作用が飛ぶ）。保存/副作用は更新関数の中で確定値から発火するか、明示オブジェクトを渡す。**「保存したのに戻る」系はまず audit_log で"新値がDBに書かれているか"を見る**（書かれていない＝クライアントの保存未発火／書かれてすぐ戻る＝別の上書き、で切り分けが一発）。
- **切り分けの重要記録**：この件は当初「本日のSTEP2/STEP3(表示導出/複製stripのデプロイ)が原因では」と疑われたが**無関係**。その他タスクはtype='その他'でDEL/COL(leg)判定の外＝STEP2/3の条件が必ずfalseで**変更前と1文字も挙動が変わらない(短絡)**／collapse_dupトリガーもreservation_id空で対象外。＝**デプロイ直後の不具合報告でも、台帳とコードの短絡条件で"無関係"を客観的に確定できる**。

## 🚨 2026-07-16 Supabase API層ハング 3度目（07-04/07-09に続く）＝ガーディアン自動復旧を確認＋通知2ch化
両店(NHA/SPK)のOPシートが同時に「消えた」。切り分け＝REST(anon経路)**HTTP 000/525/521・8sタイムアウト**／Management API(mgmt-api SQL)は即応＝**API層ハング・DB健全・データ全無事**(本日タスクNHA25/SPK5・予約NHA2576/SPK518をmgmt-apiで確認)。**両店同時ダウン＝共有プロジェクト(ckrxttbnawkclshczsia)のAPI層＝アプリのバグでもデータ消失でもない**。対応＝プロジェクト再起動(`POST /v1/projects/<ref>/restart`・HTTP200)→**フラッピング(525→521→000→200→503→200)約9分**→REST 6回連続200で復旧確定。
- **🔴 教訓1＝手動再起動の前にガーディアンstateを見る**：`supabase-guardian`(launchd・120s)が**12:00:39に自動検知・再起動済**だった（オーナー報告12:06の6分前）。私の手動再起動(12:07)は**二重再起動**（今回無害だが再起動は15分クールダウンがある＝重ねると固まるリスク）。次回はまず`~/Desktop/HANDYMAN/omni_bot/.sb_guardian_state.json`の`last_restart`を見て、既に再起動済ならフラッピング復帰(〜9分)を待つ。
- **🔴 教訓2＝通知は現場が見る場所へ**：ガーディアンは#handyman_development(C07B5G3PV7C)のみ通知＝オーナーは運用ch(#omni-operation_3号機 C0B8747PR0R)で報告＝**システムが知らせる前に人が気づくギャップ**。→ `supabase_guardian.py`の`SLACK_CH`を**2ch配列化**(dev＋omni-operation)＋`slack()`をループ化。次回から検知/再起動/復旧を両chへ自動投稿。botは両ch在籍確認済。
- **復旧判定＝アプリ実経路`/rest/v1/<table>`が5-6回連続200**（mgmt-apiは別経路で先に復活する＝誤判定源）。anonの`content-range:*/0`はRLSで0件に見えるだけ＝正常（アプリはログイントークンで読む）。恒久策候補＝PITR ON／東京レプリカ＋フェイルオーバー(単一クラウド依存が根)。

## 🧟 2026-07-16 クラス③「削除タスクの復活(ゾンビ)」を3店ONE根治＝墓標ガードをNHA/BTへ移植
SPKが07-13に入れた墓標ガード(`_tomb`)がNHA/BTに無く、**削除(deleted=true)したDEL/COL/洗車タスクをloadTasksの生成補完が毎回`fixed`に復活させ画面再表示**していた（upsertは`deleted`列を書かずDB墓標は残る＝データ被害なし・ゾンビ表示＝現場の「削除しても復活」の正体）。ドクトリン「クラスを全店検証」で発見。
- **根治**：全店loadTasksの**2生成経路**(①不足補完 gen.forEach→fixed.push ②DBタスク0件時の全生成)＋**wash補完**＋**最終upsert前のbeltフィルタ**に、該当dateの`deleted=true` `_id`集合(`_tomb`= `sb.from(tasks).select(_id).eq(date).eq(deleted,true)`)を作り`!_tomb.has(g._id)`で除外。取得失敗時は空Set=現状維持(fail-safe)・有効タスクは一切触らない。**SPK(4箇所)/NHA v3.5.302/BT v1.0.129**。
- **鉄則**：generateTasks系の"不足補完"は必ず墓標(deleted=true)を除外してから。**新タスク種別/生成経路を足す時は必ず`_tomb`ガードを経由**（fetchTasksが`deleted`除外する以上、「存在しない=補完」ロジックは墓標を無視して復活させる）。台帳＝`~/Desktop/HANDYMAN/BUG_FIX_LEDGER.md`クラス③（✅3店根治）。

## 🧭 2026-07-16 根源解消STEP2＝OP表示を「予約(正本)から導出」に3店統一（クラス①の表示側を根治）
複製ドリフト（タスクにbooking事実をコピー→表示が複製を読む→ズレる/消える/戻る）の**表示側**を3店そろえて根治。`_fromDbTask`でoptions/place/timeを**予約(DB._resIdx)から導出**（override）。**NHA v3.5.298／SPK v4.7.422／BT v1.0.127**。
- **override規則**：人間編集マーカー（場所=`_placeSource`manual/customer or `_ssPlace`／時間=`変更`/`_timeChange` or `_ssTime` or `_manualTimeAt`）がある時だけタスク値＝**編集は常に尊重**。無ければ予約から導出。予約が空ならタスク値にフォールバック（**空欄化させない**）。
- **legガード（重要）**：`内容`が **DEL系(DEL/PU/PUB/来店)またはCOL系(COL/BD/BDB/返却)のタスクのみ**予約から導出。**洗車/その他はタスク値**（洗車時間＝スタッフ設定で予約由来でない→予約の配達時刻で上書き表示する潜在退行を防止）。
- **実測（デプロイ前に台帳で影響確認）**：NHA9件/SPK4件が「顧客がフォーム/マイページで住所を入れたのにタスクが古くて"場所未確定"/空表示」→予約の実住所を表示するよう是正。**空欄化0＝無害改善**。書込は一切不変（表示のみ・低リスク）。
- **_resIdx構築**：各店`fetchReservations`成功時に`DB._resIdx={};mapped.forEach(r=>{if(r&&r.id)DB._resIdx[r.id]=r;})`。キャッシュ経路では未構築→override自動フォールバック（タスク値・安全）。
- **教訓/次段**：表示導出は複製ドリフトを"表示側で全消し"（ズレても正しい値が出る＝同期/パトロール不要）。残＝STEP3（`_toDbTask`がbooking列を**書くのを止める**＝複製を作らない）→STEP4（生成廃止・予約から導出view）。**write/generate変更は配達閑散帯に1本ずつ**（日中に生成経路を触ると洗車/その他の即時表示にギャップ＝現場を壊す）。正本＝`~/Desktop/HANDYMAN/ROOT_FIX_RUNBOOK.md`／`BUG_FIX_LEDGER.md`クラス①。

## 🚚 2026-07-15(続) KEYDROP来店「何度直しても数分で戻る」根治＝正本で防ぐ(ドメイン制約トリガー)
江副様(KDN-2607-0003-WXW・本日配達)が、DELに直しても数分で来店に戻り「お届けに向かう」ボタンが出ない。**台帳が決定打**：人(actor_idあり)がDEL→数分後に**actor_id=null(サービス)がvisit_type/return_typeを来店に戻す**、を7回。指紋採取(その瞬間±3秒の全書込)＝**予約→d-タスク→c-タスクを順に来店/返却へ**書く1プロセス(江副のみ)。
- **出所2つは特定＝正本側で防いだ**：`create-booking`(朝)＋`keydrop-pay`(L136)が payloadの`visit_type=来店`をそのまま正本に書いていた→**両方"DEL"/"COL"固定でdeploy**。`keydrop_book_nha` RPCの呼び手はこの2つだけ・RPCは通過のみ(来店ハードコード無)。
- **第3の出所は特定不能**(コード検索で一致無し・null-actorのstale端末再保存等が濃厚)。→ **絶対的事実「KEYDROP=配達専門」を正本に固定**：`nha_reservations` `_kd_force_delivery`(BEFORE・ota=KEYDROP or id LIKE KDN%→visit_type=DEL/return_type=COL強制)＋`nha_tasks` `_kd_task_force_delivery`(予約番号KDN%のd-→内容DEL・c-→COL強制)。**出所を問わず来店を書けない**。検証済(来店を書く→自動DEL/COL)。
- **これはパトロールでなく原則3「悪い書込を正本側で止める」**。検知/同期/バッチではない同期BEFOREのドメイン制約。足跡は台帳に残る。**教訓：出所コードが複数/特定不能で、かつフィールドに絶対のドメイン規則がある時は、正本側のBEFOREトリガーで矯正するのが最速最堅の根治。** SPK(reservations)側のKEYDROPにも同型あり得る→報告が出たら同じ形。**台帳の使い方＝①ピンポン(人↔null-actor)で"戻す犯人はシステム"と断定②同一瞬間の全書込で1プロセスの範囲を指紋採取。**

## 🚚 2026-07-15 KEYDROP来店/返却の根治＝取込(create-booking)で正本にDEL/COL固定
KEYDROP那覇予約が稀に visit_type=来店 で入り、タスクが来店化（KDN-2607-0003-WXW）。**台帳で確定：visit_typeは作成時から来店のまま＝取込時に書かれた"悪い書込"（表示の非でなく正本の非）。3号機はタスクだけ直し正本(予約)を放置→generateTasksが予約から再生成で来店に戻っていた**（＝タスクだけ直す典型的失敗）。根治＝**正本側で防ぐ**：`~/hdm-car-delivery/supabase/functions/create-booking/index.ts` L265を`p.visit_type?..:"DEL"`→**"DEL"/"COL"固定**（KEYDROP＝配達専門）。deploy済。既存の非1件は予約＋タスクをDEL/COLに是正。パトロール等は足さない。**教訓：visit_type/内容の正本は予約。タスクだけ直すと再生成で戻る＝必ず正本(予約)を直す。KEYDROPは配達専門でDEL/COLが正。**

## ✅ 2026-07-15 那覇 booking事実 全"正"を台帳照合で確認＝クリーンな基準点（ここが出発点・オーナー確定）
**この日、那覇の予約(正本)とタスク(表示)を台帳基軸で全照合し、booking事実が全て"正"であることを確認した＝初めて"きれいな基準点"を持った。** これまでは基準が無く暗闇で対症してきたが、以後は**この正の基準からのズレ(非)だけを台帳で検知→根本を断つ**。
- **照合結果(NHA有効・未来予約 vs タスク)**：オプション=導出で正／場所=空は正本補完で正／**時間 0差／人数 0差／便名(leg別 DEL↔del_flight・COL↔col_flight) 0差**／visit_type=取込防止(create-booking DEL/COL固定)＋既存非1件是正で正／クラス差20=**配車車両クラス(正本はfleet)＝非でない**。
- **照合の型(再利用)**：`nha_tasks t join nha_reservations r on r.id=t."予約番号"`（有効・end_date>=today）で、各booking列を `t.列 is distinct from r.対応列` で数える。**0=正**。便名/場所/時間はleg(DEL系↔del_/COL系↔col_)で比較。クラス=fleet由来なので予約と比べない。Management API `/database/query`(curl・token `~/.config/keydrop/sb_token`)。
- **意味＝ここからが本番**：基準が"正"で確定した今、今後は「新しい非が出た→台帳で誰がいつ書いたか→原因(悪い書込 or 悪い表示)を断つ→足さない」を回すだけ。パトロール/バッチ/チェックを増やさない。成長＝複製を減らし正本1本に寄せ続けること。

## 🛤 2026-07-15 那覇データフローの"法"（レール・全項目これに従う／オーナー確定）
**台帳(audit_log)＝基礎。予約(nha_reservations)＝booking事実の正本（オプション/場所/時間/日付/visit_type/人数/便名/補償）。タスク(nha_tasks)＝実行だけの正本（担当/済/メモ/識別）。表示は`_fromDbTask`の1点で正本を導出（予約→`DB._resIdx`）。編集(マイページ/フォーム/スタッフ)は必ず正本(予約)に着地し台帳に記録。複製・同期・パトロール・バッチを"足さない"。逆流(予約事実をタスク列にコピーして表示がコピーを読む)は消す。**
- 判断は毎回この1形：不具合→正本を1つに決める→表示は正本を導出→複製と同期を消す。項目ごとに違う潰し方(パトロール/バッチ/個別同期)をしたら"統一されてない"＝レール違反。
- 正方向で"残す"もの：通知cron(傷/御礼/マイページURL/place-reminder＝正本への編集を促す)＋門番omni_gatekeeper(台帳の番人)。これらは余計でなくレールの一部。
- 敷設済プランク：オプション=正本導出(v3.5.292)／場所=空を正本補完・編集は不可侵(v3.5.293)／時間=ズレ0で無追加／逆流sync`nha_opt_sync`削除。残プランク：visit_type/内容(KEYDROP来店↔DEL再発源)・書込側(タスクに予約事実をコピーしない)。
- ⚠️ 大改修は禁物(稼働中の日次アプリを一度に書き換えると壊れる＝再発の元)。プランク1本ずつ、台帳で照合しながら敷く。

## 🧭 2026-07-14 基礎の実装＝複製をやめ「表示は正本を読むだけ」（NHAオプション v3.5.292）
オーナー指摘の核心：不具合が繰り返すのは**統一されていない＝正本が複数（フィールドを予約とタスクに複製し、表示は複製側を読む）**から。潰し方は毎回同じ形であるべき：**1フィールド=1オーナー／表示は正本を導出するだけ／複製と同期(パトロール)を消す（足さない）**。
- **実装（NHAオプション非表示の根治）**：オプションの正本＝`nha_reservations.opt_b/c/j`。従来は`nha_tasks`のB/C/J複製列を表示→ズレると非表示。**`DB._fromDbTask`の1点**で予約(`DB._resIdx`＝fetchReservationsが構築するid索引)からoptsを導出。全表示(OP/タスクサマリー/スケジュール/DEL・COLカード)は`fetchTasks→_fromDbTask`を通るので**1点で全画面が正本を読む**。予約なし(手動/未ロード)のみ従来列にフォールバック。→ **ズレても非表示にならない・同期不要**。
- **引き算**：不要になった同期パトロール**cron `nha_opt_sync`(jobid37)をunschedule削除**。＝「消して統一」。
- **教訓（全項目に効く型）**：場所・時間・visit_type・オプション…**予約が持つ属性はタスクにコピーせず、表示は予約を導出**（KEYDROP来店/返却は予約visit_typeを直すのが根治＝タスクだけ直すと再生成で戻る、も同じ病気）。パトロール/バッチ/cronを"足す"のは方針違反。正本を1つにして読むだけにする。

## 🧟 2026-07-13 「削除した引取(p-)/洗車タスクが復活」根治＝墓標ガード（v4.7.417・台帳起点）
**症状**：札幌OPで削除した「翌日出発…共立自動車から引取」(引取/p-)タスクが復活する。**台帳(audit_log)で確定：deleted=true→false の復活遷移は0件**＝墓標を戻したのではなく**generateTasksが再生成**していた。
- **真因**：`p-`(引取)＝A2/B2(共立自動車の預かり車)の翌日出発予約にgenerateTasksが自動生成する正規タスク(2026-07-10追加)。loadTasks L15122の補完フィルタ `gen.filter(g=>...|(g.type==="引取"&&!existingTaskIds.has(g._id)))` が**引取だけ「無ければ補完」**するが、`existingTaskIds`は`fetchTasks`(=`.neq("deleted",true)`で墓標除外)由来→**削除済み引取は"無い"と誤判定→再生成＝復活**。フォールバックpath L15140 `setTasks(gen)`も墓標無視。
- **修正**：loadTasksで該当dateの`deleted=true`の`_id`を取得(`_tomb`)→ newTasks/フォールバックgenから`!_tomb.has(g._id)`で除外。**削除がDBに効いてる限り再生成しない**。
- **教訓（鉄則の再確認）**：**generateTasks系の"不足補完"は必ず墓標(deleted=true)を除外してから**。fetchTasksがdeletedを除外する以上、「存在しない=補完」ロジックは墓標を無視して復活させる。新タスク種別(引取等)を足す時は必ず墓標ガードを通す。**消失/復活調査は audit_log の deleted遷移＋op(INSERT/DELETE)を先に見る**（今回は復活遷移0＝再生成と即断定できた）。NHA/BTに同型の"引取/特殊タスク補完"があれば要横展開（現状 引取はSPK専用A2/B2）。

## 🩹 2026-07-13 BT(高松/BUDDICA) 傷チェック 新規稼働（handyman-damage v2.8.0）
**背景**：BT傷チェックは未運用だった（BT DBのvehicle_twins＝旧スキーマ0行・アプリに高松店の入口なし・個別URL0件）。全16台に傷チェック＋個別共有URLを稼働させた。
- **BT DB(独立 ggqugvyskyiblxiycpci)を土台構築**：`vehicle_twins`を**main(ckrxttbnawkclshczsia)と同一スキーマに刷新**（旧 store_id/vehicle_data/damage_state を drop→id(text=code)/store/status/current_damages/share_token/share_enabled/display_label…）＋`check_events`新設＋RLS（authenticated ALL・anon SELECT(share_enabled=true)）。**bt_vehicles(active=true)16台からtwin一括生成＋share_token自動＋share_enabled=true**（＝全車両に個別URL即発行）。**BT本体APP(buddica-touring)は元からvehicle_twinsをmainスキーマ・`store="takamatsu"`で参照していた**＝スキーマ統一でBT本体の走行km/傷参照も同時に復旧。
- **傷チェックアプリ handyman-damage 改修**：①`sb`を**mutableなアクティブクライアント**化（`let sb=sbMain`／`sbBT`＝別storageKey）。selectStoreで`sb=store==='takamatsu'?sbBT:sbMain`に切替＝**全25箇所のsb.操作が店舗で自動ルーティング**（低リスク・naha/sapporoは無改変）。②BT認証`ensureBTAuth`(oshita.touring@buddica.co.jp/0003)。③店舗選択に🌉高松店・staffに戸島・loadVehicles高松ブランチ(bt_vehicles/bt_fleet/bt_reservations・start_date/end_date系)。④**renderVehicleListが未知クラスを落とすバグ**（classOrder固定リスト＝BTのA/AA/D/E/G等が非表示）→`Object.keys(groups)`で末尾追加。⑤**store書込値を`currentStore`に統一**（旧`currentStore==='naha'?'naha':'sapporo'`＝takamatsuがsapporoで保存され読めなくなる不具合を修正・3463/3900/storeName）。
- **v.html(顧客共有ビュー)**：main→無ければBT の**両DB照合**に対応（sbBT追加）。store='takamatsu'→高松店ラベル。
- **検証済**：顧客anon読取(share_enabled twins可視)・BTスタッフ認証・認証書込(RLS)すべてOK。ライブ v2.8.0 反映確認。
- **鍵/接続**：BT anon/login＝`~/Desktop/HANDYMAN/kpi_master/handyman_kpi.py`(BT_ANON_KEY/login_bt)。BT本体APP URL＝buddica-touring.github.io/app/。**BTはmainと別Supabase＝別anonキー・別auth**（多DB混在時は client毎にstorageKey分離が必須）。
- **🔴 傷チェックアプリは2つある（重要）**：①**BTスタッフ用＝`buddica-touring/damage/`**（別repo `github.com/buddica-touring/damage`・BT DB直結・元々BT専用のhandyman-damageフォーク・**これが現場が使う正**）。②`nosh2318/handyman-damage/`（NHA/SPK・今回BT対応も追加したが冗長）。**BT顧客URLは必ずBUDDICAドメイン**＝`https://buddica-touring.github.io/damage/v.html?t=<share_token>`（**HANDYMAN文字列・handymanドメインは顧客に出すの禁止**＝オーナー指示2026-07-13。BUDDICAは別ブランド）。
- **2026-07-13(続) buddica-touring/damage v2.7.0**：①各車両カードに「🔗お客様URL＋コピー」を車種別表示（`copyShareUrl`/`SHARE_BASE=buddica-touring.github.io/damage/v.html?t=`）②twin取得に`share_token/share_enabled/display_label`追加 ③**BUDDICA顧客ビュー`buddica-touring/damage/v.html`新設**（BT独立DBにanon接続・share_enabledのみ公開・HANDYMAN文字列を完全排除しBUDDICA TOURINGブランド）。⚠️このアプリのbt_reservations selectは`lend_date`等(存在しない列)で予約連動が黙って壊れてる(vehiclesは出る)＝別途要修正。
- **残（任意）**：①BT本体APP(buddica-touring/app)のOP/タスクに📤共有ボタン未追加 ②repair_records等BT未整備テーブルは該当機能のみ後日 ③初期登録(チェーン起点)は各車スタッフが実施（twin/URLは発行済で顧客表示は即可）。

## 🩹 2026-07-12 マイページ「場所変更→時間変更で場所が消える」根治（handyman-mypage EF・SPK）
**症状**：顧客がマイページで回収場所を変更(札幌駅→手稲)後、同じくマイページで返却時間を変更したら、OPシート/サマリの場所が旧値(札幌駅)に戻る。マイページ自体は正しく手稲表示。
- **真因（台帳で確定）**：`handyman-mypage/index.ts` `patchTasksSpk` L186 `const cj = (t.changed_json && typeof t.changed_json==="object") ? {...} : {}`。**tasks.changed_json は text型**なので `typeof==="object"` が常にfalse→毎回 `cj={}` の空から作り直し→**その変更の項目だけ書いて他キーを全消し**。①場所変更で `_placeSource=customer/_ssPlace=手稲` 保存→②時間変更が changed_json を `{_ssTime,_timeChange}` だけに上書きし場所保護を消滅→③SSパトロール(index.src.html L15469)が「顧客保護なし(_placeSource≠customer)」と判断しエルメ旧値(札幌駅)を復元。resolver=`_placeSource==="manual"?place:(_ssPlace||place)` が旧_ssPlace採用で全画面札幌駅。
- **修正**：L186 を **JSON.parse(text)** に（既存キーを保持してマージ）。deploy＝`~/hdm-car-delivery/supabase/functions/handyman-mypage/`にコピー→`functions deploy handyman-mypage --no-verify-jwt`。同型は keydrop-mypage(L402)/handyman-mypage-nha(L41)は元からparse済＝安全。
- **教訓**：**マイページEFで changed_json を触る箇所は必ず text→JSON.parse してマージ**（object前提の分岐は死ぬ）。複数項目を続けて変更すると後勝ちで前の項目が消える＝「1回変えると1つ壊れる」の正体。切り分けは audit_log の diff old/new を時系列で追うと一発（新cjが2キーだけ＝丸ごと上書きの証拠）。被害照合は「reservations.場所 vs タスク解決place」だが全角/半角ハイフン・"自宅:"接頭辞の表記差が誤検出源→内容一致は同一扱い。



## 🔕 2026-07-11 omni_gatekeeper 通知スパム対策＝時間復元のみは無音に
`omni_gatekeeper_nha_restore`(pg_cron jobid24・*/15)が「（那覇 正常化）復活0/担当復元0/時間復元1件」を15分毎にSlack投稿してうるさい件。**復元処理と台帳ログ(omni_gatekeeper_log)は継続**しつつ、**Slack投稿は `nres>0(タスク復活) OR ntan>0(担当復元)` の深刻時のみ**に変更（時間復元njikのみの軽微は無音）。DB関数をCREATE OR REPLACEで差し替え（mgmt-api）。時間の綱引き(OPが空化→復元)はミラー化v3.5.286でOP側が空化しなくなれば2h以内に自然消滅。**教訓：門番の自動修復通知は"人の入力が失われた深刻時"だけSlackし、可逆で軽微な復元は台帳に残すだけ＝壊れゼロなら静か を徹底**。

## 🪞 2026-07-11 NHA OP「動いて戻る/行が増えて戻る」根治＝定常時をミラーに統一（v3.5.286）
**症状**：那覇OPマスターを開いて放置しているだけで、行の並びが変わって戻る・行が増えて戻るを反復。**台帳(audit_log)ではnha_tasksのDB書込は30分で2件のみ＝DB churnではなくクライアント描画の揺れ**。
- **真因＝2経路が別配列を交互にsetTaskしていた**：①**30秒ポーリング/画面復帰**＝`loadTasks(selDate)`＝DB取得後に generateTasks不足追加・PU→PUB自動昇格・バス定員溢れ降格・翌日洗車再追加・dedup・fleet同期で**並びと行数を毎回再導出**した"augmented"配列を setTasks。②**Realtime**＝`setTasks(fresh)`＝**純粋DBミラー**（DB sort_order順）。開いて放置中もこの2つが交互に走り、rows が動く/増える→DB順に戻る。DB書込が出ないのは行数/順が一致してるからだが、それでも毎回別配列で再描画するので視覚的に揺れる。
- **根治(オーナー指示「意思を持たすな＝ミラーだけ」)**：定常時(ポーリング/Realtime/画面復帰)を新設`mirrorTasks(date)`＝**DBをそのまま映すだけ**（孤立/キャンセルの表示除外のみ・**行追加/並べ替え/自動昇降格/洗車再生成をしない**・手動変更(_changed/place)保護・manual LS復元・DB空/取得エラー時は現状維持で行を消さない）に統一。生成が本当に要る**新規予約(reservations.length変化)・日付変更(selDate変化)だけ**は従来通り`loadTasks`が担当（洗車/不足追加は新規予約到着時に走る＝機能欠落なし）。
- **教訓**：「定常ポーリングで毎回 生成/整形して setTask」する設計は、別経路(Realtime)の純ミラーと不一致になり"揺れ"を生む。**定常リフレッシュは必ず"DBミラー"に一本化し、生成は真に必要なトリガー(新規/日付変更)に限定する**。①=sort_order再index停止(v3.5.285)＋②=ポーリング/Realtimeのミラー統一(v3.5.286)で完結。SPKも同型ポーリングがあれば要確認（SPKは1件ずつ書込で比較的安全だが定常再生成の有無は未点検）。

## 📌 2026-07-10 このセッション作業メモ（CLI omni / UI・インフラ）

### 🛡 Supabase自動復旧ガーディアン 新設（launchd常駐・重要）
- **`com.handyman.supabase-guardian`**（`~/Desktop/HANDYMAN/omni_bot/supabase_guardian.py`・120秒毎）＝API層ハング障害を**自動検知→DB健全確認→自動再起動→Slack通知**。手動対応(7/09)を自動化。
- ロジック：`/rest/v1/nha_tasks・reservations`(anon)をプローブ→000/timeout/5xxが**3回連続(≈6分)**で「API層ハング」判定→**mgmt-api SQLでDB健全な時だけ**`POST /projects/<ref>/restart`（DBも死んでたら再起動せずSlack警告＝固まるリスク回避）→**クールダウン15分**で二重再起動防止。検知/再起動/復旧を#handyman_development(C07B5G3PV7C)へ自動投稿。state=`.sb_guardian_state.json`。anonキーはlive app.jsから動的取得。**OMNI全サービス一覧に追加（「全再稼働」時はこれも対象）**。

### 📱 「更新が反映されない」根治＝SPK sw.jsを自己破棄型に（重要・全店に効く手法）
- 症状：SPKだけ何度更新しても古い画面。原因＝**過去のキャッシュ型SWが端末に居座り古いapp.jsを配信**（sw.js 0バイト=空では古いキャッシュを消せない）。
- 修正：`~/spk-task/sw.js`を**自己破棄型**に（install=skipWaiting／activate=全caches削除＋`registration.unregister()`＋開いてる全clientを`navigate`で再読込）。sw.js?vを上げて配信→端末のSW更新チェックで置換→キャッシュ全削除→以降常に最新。**教訓：0バイトの空sw.jsをregisterするのは無意味＝居座りSWを消せない。自己破棄型が正解**（NHA/BTも必要なら同様に）。

### 🎨 タスクサマリ スマホ最適化＝「1タスク1カード・種別大・ナンバー大・薄枠」3店統一
- 各タスクを**薄い枠(border+角丸+余白+薄影)+左に種別色ライン**のカードに（切れ目を明確化）。**行1=大きい種別色バッジ＋時刻大＋🚗車両ナンバー緑大バッジ**（未配車=赤）／行2=予約者+人数+LINE／行3=場所+便名／行4=担当+決済。操作ボタンは保持。
- **⚠️描画サイトが多数**（1画面≠1箇所）：NHA=OPサマリー(opView=summary 18715)＋TOP個人別`NhaPersonalTasks`/`NhaPersonalTasks2`(22654/22787・rTは2つ同一→replace_all可)。SPK=個人別allSchedule(15864)＋本日スケジュール(21687)＋**スタッフ別サマリー(21622・出発ボタン付き＝オーナーが見ていた画面)**。BT=OPサマリー(17286)。「変わってない」時は別の描画サイトを見ている＝全サイト洗い出す。版：SPK v4.7.402/NHA v3.5.280/BT v1.0.117。
- **マスター表は全行フラット統一**（洗車=黄/手動=緑/担当=黄 の色分けを全廃・縞のみ／種別は種別列の色で識別）。SPK/NHA/BT。

### 🧽 当日洗車の可視化＝薄い緑ハイライトのみ(枠削除)・両店統一（オーナー確定）
- マスター表の「返却→洗車リンク(同日・同ナンバーで返却がある洗車)」の**枠(アウトライン#0d9488)を削除**し、**薄い緑背景(#ecfdf5)のみ**に統一。SPK=枠除去(緑背景は既存)/NHA=枠除去+緑背景追加(`let rowBg`にして`if(_isLinked)rowBg="#ecfdf5"`)。🔗返却後洗車/🕐返却時刻以降のバッジは残置。SPK v4.7.403/NHA v3.5.281。

### 🎣 フィッシング詐欺メール注意（スタッフ共有推奨）
- 「【重要】メールボックス期限切れ・再有効化が必要」等でreserve@rent-handyman.jp宛に来る**フィッシング**。**リンク先が本物ドメインでない**(例`lamsharedonlywinsdom.sbs`＝`.sbs`はフィッシング常用)＝詐欺確定。**クリック・パスワード入力禁止→削除＋フィッシング報告**。正規のメール事業者が外部リンクでパスワード再認証を求めることはない。

## 🗂 2026-07-10 エルメ取込・KEYDROP端末計測・ファネルリベース・札幌スルー/未連携方針（CLI omni）
- **エルメCSV取込（LINE userID紐付け・毎日必要）**：札幌`spk_line_links`402件／那覇`nha_line_links`1618件(2ファイル)取込。手順＝`SB_TABLE=nha_line_links SB_SERVICE_ROLE=<service_role> python3 ~/spk-task/line_auto/import_erume_csv.py <csv> [--dry]`（那覇はSB_TABLE指定・札幌は既定）。service_roleは Management API `/api-keys?reveal=true`(token`~/.config/keydrop/sb_token`)で取得。取込で場所空欄補完も走る。userIDはエルメCSVにしか無い→両店毎日取込。
- **KEYDROP 端末(PC/スマホ)計測 実装**：`kd_funnel_log`に`device`/`ua`列追加＋`index.html`のファネル書込(rest/v1/kd_funnel_log POST)に`navigator.userAgent`判定(pc/mobile/tablet)を付与＝全アクセスに端末記録。集計ビュー`public_kd_device_v`＋`kd-analytics.html`に「📱端末別内訳」カード(構成比/決済到達/完了CVR)。keydrop.jp反映済。
- **KEYDROPファネル リベースライン（重要）**：2026-07-10のUIフロー変更で step番号割当が変わった（新: step_vehicle=1日付車両/confirm=2/options=3/**top=4＝お届け回収のマップ**/form=5情報/terms=6/payment=7/complete=8）。旧フローは別割当(top=1等)。混在集計で「step5>step4」逆転(あり得ない)。→ `public_kd_funnel_v`を **`created_at>='2026-07-10 07:27:41+00'(新フロー開始=step_vehicle=1初出)以降**に絞ってリベース→単調減少に正常化。⚠️Slack側がmigrationで同ビュー再適用するとカットオフが戻る→恒久化は該当migrationにも同条件を。**教訓：フロー(step番号)を変えたら過去データと混ざる→集計は必ずフロー変更日以降に絞る**。
- **旧マップTOP vs 新スタイルの判断材料**：旧マップTOP＝入口90%離脱・CVR0.1%（施策ログの「97%離脱の本丸」）。新(日付・車両先出し)＝入口43%離脱（早期・母数7で未確定）。方向は**非マップ(現スタイル)寄りが妥当**。確定は数百セッション後、理想はA/B。
- **札幌 スルー/未連携 対応方針**：①スルー(未開封)＝**前日/返却3hリマインドで自動再ナッジ済**(mypage_daybefore稼働)→緊急対応不要(利用日が近づけば再送される)。②未連携メール訴求＝**`sendFormReminderEmails`**(gas-email-import-v2.gs・毎朝10:30・**出発9/6/3日前・場所未設定&フォーム未回答・最大3回・KEYDROP除外**・LINE誘導メール＋my.htmlマイページURL)。dashboardの「メール訴求31」と乖離するのは正常＝リマインドは「9日前以内かつ場所未設定」の直前JITのみ(実測:訴求対象32/9日以内4/うち場所未設定=実対象1/28は窓外)。要`setupFormReminderTrigger`起動(GAS・owner作業)。窓拡大は`FORM_REMINDER_START_DAYS`(9→14等)。
- **R0SH5VYY(照会)**：札幌じゃらん・ミズグチ タクヤ・7/10利用・¥6500・**未入金**(DB jalan_payments=email_sent/paid_at空＋Square注文=DRAFT/tenders無で二重確認)。リンク https://square.link/u/l6lBAhkT 。Squareトークン=`~/outputs/handyman-receipt-bot/Code.gs`のSQUARE_API_TOKEN(EAAAl0tQ…)、SearchOrders(location L8N7J9RKPN3WH・品目に予約番号)で実入金照合。
- **KEYDROPクーポン利用(照会)**：`keydrop_coupon_redemptions`5件(実顧客2＝rikachan0509@i.softbank/kinsuke22、残3はowner test)。CV有効＝rikachan0509(paid・那覇)、kinsuke22はpaid→refunded。端末(PC/スマホ)は当時未記録→今回のdevice計測で今後は判別可。


## 🚨 2026-07-09 Supabase障害（API層ハング）再発→再起動で復旧＋恒久手順（両店・重要）
**症状**：那覇・札幌の両アプリで「開けるが予約が読み込めない」。一瞬戻る→また詰まる(フラッピング)。2026-07-04と同型の再発。
**確定診断（実測）**：**PostgREST(API層)のハング、Postgres(DB本体)は健全＝データ無事**。
- アプリ経路 `/rest/v1/<table>`＝**HTTP 000で8秒タイムアウト**（NHA `nha_reservations`・SPK `reservations` とも3回連続無応答）。
- 管理API `/database/query`(`select 1`)＝**HTTP 201・3.3秒で成功**＝DB健全。プロジェクト状態は`ACTIVE_HEALTHY`表示(あてにならない)。
- 両店は同一プロジェクト`ckrxttbnawkclshczsia`→同時に落ちる。**アプリのバグではない**。
**復旧手当（今回実施・成功）**：Management APIで**プロジェクト再起動**＝`curl -s -X POST "https://api.supabase.com/v1/projects/ckrxttbnawkclshczsia/restart" -H "Authorization: Bearer $(cat ~/.config/keydrop/sb_token)"`→**HTTP 200**。数分フラッピング後に安定。復旧確認＝`/rest`実クエリ連続プローブで**NHA 6/6・SPK 6/6 HTTP 200**。データ損失なし。

### 🔁 今後この障害が来た時の解消手順（正本）
1. **切り分け**：`/rest/v1/<table>`(anonキー)が000/タイムアウト かつ `/database/query`(mgmt-api)のSQLが成功→**API層ハング＝DBは健全＝データ無事**。慌てない。
2. **禁止**：アプリコードをrevertしない（アプリのバグではない・7/04はこれで誤対応した）。スタッフに連打リロード・再入力をさせない（復旧後の二重化防止）。
3. **つなぎ**：各アプリのオフライン読取キャッシュで、一度開いた端末はOP/タスク/スケジュール/配車表を閲覧継続可（書込は復旧後）。
4. **復旧**：ダッシュボード or 上記Management APIで**プロジェクト再起動**（API層バウンス）。※"状態変更失敗"系だと再起動で固まるリスクもある→戻らなければサポート連絡が最短。
5. **復旧判定**：`/rest`実クエリを連続プローブし**5〜6回連続HTTP 200**で確定→1回クリーンにリロード。
- anonキーはliveの`app.js`から`grep -oE 'eyJ[...]'`で取得可。復旧報告は#handyman_development(C07B5G3PV7C)へ。恒久策候補＝PITR ON／GAS版バックアップ(Google基盤24h)。

## 🧷 2026-07-09 OPシート「担当を未割当(空)にすると旧担当に復活」根治＝DBトリガーの過剰防御（重要）
**症状**：札幌OPシートで担当を**未割当(空)にすると必ず元の担当(例:大下)に戻る**。人→人の変更は正常保存。何度やっても未割当にできない。
- **真因＝アプリでもchurnでもなく DBトリガー**：`tasks`に担当を記憶する `spk_task_assignments(reservation_id,role,assignee)` ＋トリガー2つ（`spk_tasks_fill_assignee` BEFORE INSERT/UPDATE＝空担当を記憶から埋め戻す／`spk_tasks_save_assignee` AFTER＝非空担当を記憶に保存）。**別セッションの「担当保護(再生成でassignee消失を防ぐ)」機能が過剰防御**で、人が明示的に空にしても記憶した旧担当で埋め戻していた。
- **切り分けの罠(教訓・重要)**：
  1. **audit_log は assignee 列を diff に記録しない**（大下→__TEST__に変えても old/new とも null）。→「担当変更0件」を「書けていない」と誤読。**担当系調査は audit を信用せず tasks 直読み/updated_atで見る**。
  2. **アプリの書込は upsert(`INSERT ... ON CONFLICT DO UPDATE`)**。既存タスク更新でも**BEFORE INSERTトリガーが先に発火**する。純PATCH(UPDATEのみ)は通るのにアプリupsertは埋め戻す→修正はUPDATE側だけでは不足、**INSERT側にも「既存_id行があれば補填しない」**が必要。
  3. 人→人は通り人→空だけ戻る＝**「空を旧値で上書きする`||`(coalesce)型ロジック」を疑う**（DBトリガー or アプリ`_mergeUserInput`行410も同型で`prev.assignee`非空を維持）。
- **修正(適用済・Management API)**：`spk_tasks_fill_assignee` を書換。**`TG_OP='UPDATE' または 同_id行が既存(=upsertの更新/クリア)なら補填せず空を尊重＋記憶(spk_task_assignments)も削除**。**本当に新規生成されるINSERT行のみ記憶から補填**。アプリと同じupsert(POST `on_conflict=_id`, `resolution=merge-duplicates`)で空担当が通ることを検証済。**DB側修正＝全端末に即反映・アプリのリロード不要・スタッフ操作不要**。※`resolution=merge-duplicates`のPOSTは**指定列のみ更新(他列は保持)**でdamageなしを確認。
- **併せて直した二次バグ(アプリ側 v4.7.393/394)**：SS自動取得パトロールが場所不変でも毎回`_ssPlaceAt=now`で全タスク再保存(2hで384回churn)＝負荷＆上書き圧。①場所が実際に変わった時だけ再保存 ②パトロールの再保存を全列upsert→`updateTaskCJ`(changed_jsonのみ部分更新)に＝担当/済/時間/場所の人間入力列を触らない。**実在バグだが「未割当が戻る」主犯ではなかった**（主犯はDBトリガー）。
- **残**：那覇/高松に同型トリガー(`nha_tasks_fill_assignee`等)があれば同症状→要確認・同修正。`spk_task_role(type)`でDEL/COL/洗車ロール判定。

## 📌 2026-07-09 このセッション 追加作業メモ（CLI omni）
- **① 受領請求書 スマホ表 潰れ修正（SPK/NHA）**：一覧テーブルが`overflowX:auto`なのに`table width:100%`で、スマホ幅に9列押し込み→内容列が**1文字ずつ縦折れ**。table`min-width:860`＋受領日/支払先`nowrap`＋内容列`min-width:200`で横スクロール可読化。SPK v4.7.389 / NHA v3.5.270。
- **② 配車表クラス境界の視認改善（全店）**：クラス見出し行に太い上ボーダー(3px #475569)＋濃い背景帯(#dbe3ec)。SPK v4.7.387/NHA v3.5.263/BT v1.0.116（見た目のみ）。
- **③ イレギュラー車両変更でDEL/COLタスクの車両が未同期（R0SH5VYY ミズグチ タクヤ）**：配車(fleet)をRKY(ロッキー/C)に変えたが、**タスクの`vehicle`/`assigned_vehicle`/`plate_no`が d-/c- は更新されず(F/空)、w-(洗車)だけ更新**されていた→タスクサマリーで「未配車」表示。DBで d-/c- を C/RKY/299 に手動同期して解消。**タスクサマリーの表示自体は配車(fleet[reservationId])とフォーム場所(_ssPlace)からフォールバックする作りで正しい**が、タスク内部値のズレが残ると不整合。**恒久策候補＝車両変更時に3タスク(d-/c-/w-)すべて同期**（未実装）。
- **④ OP→マイページ時間連動 検証OK**：NHA FUZ47993(吉柴 明日香・OP変更09:00)で `handyman-mypage-nha` lookup→`lend_time=09:00` を確認＝2026-07-09の全系統修正が実働。KDN/テスト予約(KD-TEST-0710-KDX・KDN-TEST-0710-NHA)は削除済(KEYDROPテストフローで再生成され得る)。
- **⑤ 協力会社 新規予約→自動メール**：`sendPartnerResvEmail_`実装済だが**contact_email未登録＋GAS未貼付で未稼働**（残作業）。

## 🕒 2026-07-09 OPシートの時間変更がマイページに反映されないバグ 全系統修正（HANDYMAN/KEYDROP × 那覇/札幌）
- **症状**：那覇の予約でスタッフがOPシートで配達時間を変更(例17:30→17:00)しても、お客様マイページ(カルテ)は旧時間のまま。SMW34582(伊藤 紗采・7/12 DEL)で発覚。
- **原因（那覇固有のスキーマ差）**：**那覇OP(nha_tasks)は時間変更を専用の日本語列「変更」(timeChange)に保存**し、OP表示は`変更||時間`。一方 **札幌(tasks)は`changed_json._timeChange`に保存**。マイページEFの`resolveTaskTime`は`changed_json._timeChange||_ssTime||time`しか読まず、**那覇の「変更」列を見ていなかった**→那覇だけ反映されず（札幌は元々OK）。
- **さらにKEYDROP那覇の重大な穴**：`keydrop-mypage`のlookupが`nha_tasks`を**札幌用の列名(`reservation_id,place,time`)で読んでいて必ず失敗**→catchで空→予約本体`del_time/col_time`にフォールバック＝**OPタスクを一切見ていなかった**（時間も場所も）。nha_tasksは`予約番号`紐付け・日本語列(送迎場所/集客/返却/時間/変更)。
- **修正（全4系統・デプロイ済 2026-07-09）**：`handyman-mypage-nha`＝mapに`timeChange:t["変更"]`追加＋resolveを`変更`最優先／`keydrop-mypage`＝opTasks読取をstore別分岐(那覇=nha_tasksを予約番号+日本語列で読み`変更`をtimeChangeにmap、c-は集客/返却採用)＋`resolveTaskTime`に`t.timeChange`最優先。札幌経路(handyman-mypage/keydrop札幌)は元から`cj._timeChange`で正常＝変更不要。
- **デプロイ**：`SUPABASE_ACCESS_TOKEN=$(cat ~/.config/keydrop/sb_token) ~/.local/share/supabase/supabase functions deploy <fn> --project-ref ckrxttbnawkclshczsia --no-verify-jwt`。正本＝handyman-mypage-nhaは`~/spk-task/line_auto/`→`~/spk-task/supabase/functions/`にコピー、keydrop-mypageは`~/hdm-car-delivery/supabase/functions/`。
- **検証**：那覇PYQ80311(OP 10:00→09:30)でEF lookup→`lend_time=09:30`確認。未反映5件(NHA)はデータ無改変で自動修正。SMW34582は即時性のためdel_time/start_time/タスク時間を17:00にデータ修正済。
- **教訓**：**那覇の時間変更の正本は nha_tasks「変更」列**（changed_jsonでなくDB列）。今後 那覇タスクを読むコードは必ず`変更(timeChange)`を`時間`より優先。KEYDROP EFで`M.tasks`をSPK列名で読む箇所は那覇で壊れる→store別マッピング必須。

## 🪪🚀 2026-07-08 那覇マイページ 本番リリース＋傷チェック8時統一＋利用状況/メール可視化（CLI omni）
**那覇マイページを①情報公開フェーズで本番リリース完了。** 正本コード＝`~/spk-task/line_auto/`（handyman-mypage-nha / mypage-notify-nha / damage-check-cron）、ページ＝naha-project（my-nha.html / mypage-usage-nha.html / bus.html）。

### 那覇カルテ（EF handyman-mypage-nha・my-nha.html）
- **EF lookup+ping・閲覧専用**：token→nha_reservations＋nha_tasks。**応答は札幌my.htmlと同じflat形**(reservation.vehicle/del_place/col_place/lend_time…＋visit_type/return_type＋damage/tracking/history)＝**同一レンダラで表示統一**。場所/時間＝`_placeSource==="manual"?place:(_ssPlace||place)`/`_timeChange||_ssTime||時間`(日本語列)。**ro=1(スタッフ閲覧)はmypage_touch_viewしない**(利用状況の開封誤カウント防止)。傷URL=nha_fleet→nha_vehicles.plate_no→vehicle_twins.display_label(ilike)→share_token。deploy=`supabase functions deploy … --no-verify-jwt`(token`~/.config/keydrop/sb_token`)。
- **my-nha.html(VER v7.2-nha)＝札幌my.htmlの"丸写し"＋最小差分**：①FN→-nha ②`RO=?ro=1`＋`editable=false`(①=変更UIなし) ③IMG_BASE→spk-task/images(クラス画像_nhaはB/C/F/H/Sのみ→A/A2/B2/Dは無画像) ④受け渡し=**DEL/COL:場所+時間／PU・PUB:空港お迎え(PUB=🚌バス時刻表)／BD・BDB:空港お見送り(BDB=バス)／来店・返却:店頭(時間のみ)** ⑤クラスラベルINIT_CLASSES準拠 ⑥`nh_*`多言語キー(日英繁韓) ⑦**lookupにタイムアウト15s+自動リトライ2回+🔄再読込ボタン**(詰まる端末の永久スピナー対策)。バスは同一タブ＋bus.htmlに「←戻る」。
- **導線**：NHA本体 v3.5.269-NHA。`window._mypageTokenMap`生成＋**OPシート本体マスター表(名前セル)＋タスクサマリ/スケジュール**に🪪カルテ(ro=1)。

### ボタン整理（NHA本体）
DEL出発→`mypage_depart`／COL回収→`mypage_collect`でLINE連携済にマイページURL自動送信(line-send store=nha)・未連携はコピー。**到着にconfirm追加／📍追跡削除／出発msgから傷URL除去／全ボタンconfirm**。📱OK/📱手動をPU/BD/BDBにも表示。

### 初回送付＋リリース（mypage-notify-nha）
- LINE連携済・end_date>=today・KEYDROP除外・未送信 に初回URL送付。**🔴sbGetAll(Rangeページネーション)必須**(那覇2500超→limitだけだと22件しか拾えず。実証・修正)。本番cap=40/回。gate=`nha_line_config.mypage_notify_enabled`(列新規追加)。cron`mypage-notify-nha`(jobid34・*/15・x-cron-secret=e564…)。
- **リリース**：test_mode=false＋mypage_notify_enabled=true＋cron作成 → **208名へ初回送付**(初回30・残178はcron・約1.5〜2h)。**全2517トークンユニーク=各自固有カルテ**実証。
- **🔴テスト送信の後始末必須**：test_mode中でもsendログ(sent)が残る→本番前に`delete from nha_line_sends where action like 'mypage_%'`しないと実顧客がdedupでスキップ。mypage_viewsのスタッフ閲覧分もクリア。

### 傷チェック8時統一（damage-check-cron・那覇札幌両方）
旧=出発lead分前(SPK30/NHA60)→**新=出発日8:00**(`nowMin>=480`かつ出発>=8:00)。両店同EF(store分岐)。

### 利用状況ダッシュボード＋メール可視化
- **mypage-usage-nha.html**(TOP📲マイページ状況タイル)＝札幌my-admin openUsageの那覇版。ファネル(アクティブ/送信済/スルー/未送信/LINE未連携)。認証=本体ログインtoken再利用＋NHA anon(iat 1771878550)。
- **未連携者のメアド常時表示＋「📧メール訴求対象」(未連携×有効メール)件数/絞り込み**を那覇・**札幌my-admin両方**に追加(`realMail`/`validMail`=ota@…/noreply/空除外)。

### 未連携→登録誘導メール（札幌のみ・那覇保留）
札幌`sendFormReminderEmails`(gas-email-import-v2.gs L1844)=**毎朝10:30・出発9/6/3日前・場所未設定&フォーム未回答・KEYDROP除外・最大3回**、LINEフォーム(liff.line.me/2008205584-oWrKy5r3)へ誘導。目的=フォーム未回答客をLINE受付フォーム登録へ(②編集不要)。**那覇版は那覇のLIFFフォーム本体URL待ち**(lin.ee/jMU6xdJは友だち追加リンクで別物)。②(顧客のマイページ編集)は那覇未実装(①閲覧のみ)。
- 停止=`update nha_line_config set mypage_notify_enabled=false`＋cron unschedule。サーバ稼働(pg_cron+EF)＝PC非依存。

### 📊 リリース当日実績＆追記（2026-07-08夜〜07-09）
- **初回送付 完了：208名 全員送信済**（cronが数時間で完走）。**開封 約100名＝開封率48%**（100÷208・送信当日でこれは高い。未開封は時間で開封へ移動して伸びる）。
- **ファネルの見方（混同注意）**：`🔵送信済(未開封)`は"未開封の残り"で送信総数ではない。**送達(reach)≒100%(208/208)** ／ **開封率=48%(100/208)** の2軸。リストはアクティブ上位ソートで上部が緑一色に見えるだけ。
- **御礼(thanks) 那覇ON**：`nha_line_config.thanks_enabled=true`。cron`line-thanks-nha`(毎日10:05JST)で返却翌日の連携客へ御礼LINE。テンプレ=`line_auto/thanks-cron/index.ts`(純お礼文・口コミ無・store=nhaで「那覇店」)。→ 那覇の自動通知が 初回/お届け回収/傷8時/御礼 まで札幌と揃った。
- **時間解決の精緻化(EF)**：resolveTaskTime/回収時間を **OP「変更」列(timeChange)最優先** に(`t.timeChange||cj._timeChange||cj._ssTime||time`)＝OP表示と一致。
- **次の伸びしろ(未着手)**：①⚫LINE未連携229名のうち📧メール訴求対象を那覇リマインドメールで拾う=**那覇のLIFF受付フォーム本体URL待ち**。②未開封のまま利用日接近の連携客へ「未開封リマインド(LINE再送)」。

## 📌 2026-07-08 このセッション（CLI omni）作業メモ
- **① 協力会社への新規予約 自動メール通知（SPK・実装済/GAS貼付待ち）**：`gas-email-import-v2.gs` の `watchPartnerCustomerReservations`（15分毎・稼働中）に **`sendPartnerResvEmail_`** を追加。協力会社車両(owner_company≠HANDYMAN)に新規予約が入ると `partner_companies.contact_email` へ自動メール（件名「【HANDYMAN】貴社車両に新規予約：…」）。冪等・既存Slack通知は維持・**メール未登録なら安全スキップ**。**残：①各社 contact_email 登録（現在全社 空）②GASエディタへ貼付**（トリガー型で再デプロイ不要）。当初「グループLINE」希望だったが、招待/groupID取得が要るためメールに決定。※検知自体は元から動作（配車確定→次の15分サイクルで通知。YYO15628 は配車直後で未検知＝時間差であり不具合ではない）。
- **② 配車表クラス境界の視認性改善（全店デプロイ済）**：FleetTimelineのクラス見出し行に**太い上ボーダー(3px #475569)＋濃い背景帯(#dbe3ec)**を追加＝クラス間の区切りが一目で分かる。SPK v4.7.387 / NHA v3.5.263-NHA / BT v1.0.116-BT（push済・見た目のみ・ロジック不変）。
- **③ 全店 台帳チェック結果（直近24h）**：main(NHA/SPK)＝**クリーン**（NHA削除はnha_fleet1件=配車変更／SPK削除はテスト予約掃除＋カワソエ=キャンセル済み正常＋fleet1／墓標0・日付移動0）。**BT(別DB ggqugvyskyiblxiycpci)＝7/07 12:20に全256行(bt_tasks153/fleet51/予約52)を `app_name=mgmt-api` で一括削除→現在0件**＝アプリ不具合でなく**管理SQLによる意図的なテストデータ全消し**(BTリリース前)。→ 意図的削除ならOK・違えばaudit_revert/hdm_snapshotで復元可。
- **④ 台帳読みの知見**：`audit_log` の **`app_name`で出所を識別**＝`mgmt-api`(管理API/SQL＝人/エージェントの手動)・`postgrest`+`actor=staff`(アプリ操作)・`system`。DELETEの旧値は `diff` トップレベル（UPDATEは `diff->'old'/'new'`）。「消えた」調査は必ず DELETE と `deleted=true`(墓標) の両方を見る（時間の値→空 検索だけでは物理削除を見逃す）。
- **⑤ KEYDROPテスト予約 KD-TEST-0710-KDX**：mgmt-apiで7/07作成→アプリ(KEYDROPテストフロー)で再生成を繰り返す個体。削除実施（reservations/tasks d-/c-/w-）だが**元(KEYDROPテスト投入)を止めないと復活**。
- **⑥ ビュート村田様 COSTAクルーズ照会**：便名4フィールド(到着/出発便名・時刻)に「COSTA」を含むオフィシャル予約＝**JAS72180 秋庭 園子(8/4)の1件のみ**（「コスタ千春」は人名で対象外）。

## 🚨 2026-07-08 傷チェック手動送信「未対応アラート」EF新設（SPK/NHA・#handyman_development通知）
傷チェック送信リスト(DamageSendList)で、出発時刻を過ぎても手動対応(manual_done)が付いていない「📱手動(LINE未連携)」タスクをcronで検知→Slack #handyman_development(C07B5G3PV7C)にBlock Kitアラート。
- **EF**：`damage-overdue-alert`（正本`~/spk-task/line_auto/damage-overdue-alert/index.ts`→deploy実体`~/hdm-car-delivery/supabase/functions/`）。既存 damage-check-cron は不変（追加のみ）。
- **cron**：`damage-overdue-alert-spk`(jobid30・`{}`) / `damage-overdue-alert-nha`(jobid31・`{"store":"nha"}`) 各 */15。x-cron-secret=CRON_SECRET(e564…)踏襲。
- **判定定義（DamageSendListと完全一致・SQLで再現検証済）**：本日の傷チェック対象タスク(SPK=tasks type=DEL / NHA=nha_tasks 内容∈PUB,DEL,来店・予約番号あり・SPKはdone=false)のうち ①出発時刻(HH:MM)≤現在時刻JST(grace=0＝出発時刻ちょうど) ②`{store}_line_links`にresv_no無し(=📱手動・LINE未連携) ③`{store}_line_sends`のaction=damage_checkでstatus∈(sent,manual_done)が無い(=未対応) ④キャンセル予約でない、を抽出。
- **dedup**：`{store}_line_sends`にaction='overdue_alert'を積む→同一予約は1回だけ通知（line_sendsにCHECK制約なし＝自由文字列OK）。Slack投稿成功時のみ記録。
- **0件なら静か**（投稿しない）。ヘッダーに店舗名明記。`test:true`でDB非書込のSlack疎通テスト経路あり(監視ロジック不変)。
- **検証(2026-07-08)**：SPK/NHA両方 overdue:0（正=NHA本日4件は10:47に全件manual_done対応済み＝EFが対応済みを正しく除外。SPK本日DEL2件はlinked=true=📱OK自動対象で手動対象外）。スクショの那覇「未対応4」は対応前の状態でEF定義と一致。Slack疎通テスト(test:true)でposted:true＝bot`sns_auto`は#handyman_developmentに招待済み・Block Kit投稿OK。
- **オーナー手作業＝なし**（bot招待済・cron登録済・secret既存で全自動）。

## 🧽 2026-07-05 NHA OPシート「時間が消える」根治＝翌日出発洗車タスクの非決定ID複製（このセッション）
オーナー報告「那覇OPシートでまた時間が消える・台帳で予約IDが複製されてる」。**台帳(audit_log)で発生源を完全特定→固定IDで根治。**
- **要因**：`generateTasks`のDEL/COLは固定ID(`d-`/`c-`+予約ID)だが、**「翌日出発の洗車タスク」だけが非決定ID `uid()`(=`t35`,`t91`…)で生成**されていた（`~/Desktop/AI/naha-project/index.html.bak` L4364＝generateTasks・L17808＝loadTasks不足追加 の2箇所）。→ 画面を開くたびに同じ車の洗車を別IDで**新規INSERT複製**（uid()はupsertでなく毎回別行）。同一予約に洗車が複数行＝**台帳で見えた「予約IDの複製」**（同じ予約IDが複数の洗車行に付く）。
- **時間消失の実体**：複製を消す掃除（GAS日次 cleanupDailyNha の**物理DELETE**）が、担当・時間が入った洗車行を消す。台帳の物理削除実例＝`t35`(洗車・担当赤嶺/時間13:00)、`t90`(担当赤嶺/18:00)を07/05 03:11:38に物理DELETE。※両方とも同一内容の生き残り(t89/t36)が残存し実損失は無かったが、機構として危険。
- **修正(v3.5.256-NHA・push済 5208c74)**：洗車IDを`uid()`→**固定ID `w-`+予約ID**（未配車は`w-v-`+車両コード）に。同一予約の洗車は常に同じ`_id`＝再生成でも1行に上書き＝**不要な複製行を作らない**（＝オーナー指示「不要なものを作るな」）。既存重複1件(RC32461200023392699の`t37`)は墓標化、稼働中の重複洗車0件。
- **台帳の全確認結果(直近7日)**：システム起因の削除＝**上記洗車2件のみ**／タスクの別日移動＝**0件**(`_taskDate`固定が有効)／時間・担当・内容の「値→空」書換＝**0件**／予約の日付変更＝**0件**。他に勝手に消えた/動いた箇所なし。
- **🔴教訓（消失調査の鉄則）**：台帳で「時間:値→空」を検索して0件でも**消えている**＝上書きでなく **op=DELETE（重複行の物理削除）**で担当/時間ごと消えるケースがある。消失調査は必ず `audit_log` の **op='DELETE' と deleted=true（墓標）も見る**。DELETEのdiffは`diff->>'時間'`等トップレベル、UPDATEは`diff->'old'/'new'`。
- **残**：既存の legacy `t###` 洗車行は当面残置（新コードのガード washByVehicle で新規複製は防止済）。気になれば legacy洗車→`w-`統一のワンタイム掃除を追加可。

## 🔴🔴 2026-07-04 「勝手に動く」根絶＝唯一のルール＋改ざん検知台帳（全店共通・最重要）
オーナー数十回の指摘＝人が入力/編集したデータが「消える・別日に動く・重複・消したのに復活・元に戻される」。**本質＝ルールが雑**（各コードが上書き/保護/再生成バラバラ＝統一ルール無し）。**2大タイトル＝①タスク変更 ②予約変更**（予約が勝手に変わる＝派生タスクも全部ずれる＝最も異常）。

### 🔴 唯一のルール（これが全て・オーナー最終確定）
> **既存データは、変更した本人（人間／外部の手動編集）以外が書き換えない。システムは表示するだけ。書くのは1アクション＝1件。丸ごと再保存・再取込で他人の入力を上書きしない。競合したら人間が勝つ（人間入力＝正本）。**
バラバラのパッチをやめ、この1ルールを全経路に効かせDBレベルで強制＋台帳で証明。

### 改ざん検知台帳（Audit Ledger＝誰が・いつ・何を の追記レシート＝根絶の証拠・2026-07-04設置）
「動いた結果を戻す(対症)」→「原因の書込を特定して消す(根治)」への転換器。全て AFTER UPDATE・例外安全(`EXCEPTION WHEN OTHERS THEN NULL`＝書込を絶対止めない)・`current_setting('application_name',true)`で出所記録。
- **task_audit**（tasks/nha_tasks=main ckrxttbnawkclshczsia・bt_tasks=BT ggqugvyskyiblxiycpci）trg_audit_tasks_spk/nha/bt：タスクの date/assignee(担当)/done。
- **reservation_audit**（reservations/nha_reservations=main・bt_reservations=BT）trg_audit_res_spk/nha/bt：予約の 日付(lend/return/start/end/del/col)/status/vehicle。
- 設置時刻から前方記録。次のドリフトで「出所+時刻+from→to」のレシート→経路特定→塞ぐ＝根絶。出所粒度(正直)＝種別まで(アプリ/GAS/mgmt-api)＋時刻＋from→to（端末/個人は未記録・要れば利用者ID刻む＝次段）。中身確認＝Management API `/database/query`(token `~/.config/keydrop/sb_token`)で `SELECT * FROM task_audit/reservation_audit ORDER BY id DESC`。

### 予約変更(②)の穴＝CSV取込が既存予約を丸ごと上書き（発見・未修正）
NHA `imp`(index.html.bak L23578〜)：`imported.forEach(r=>map.set(r.id,r))`(L23596)＝**既存予約をCSV値で丸ごと置換**(priceだけ弱保護)。→ **スタッフが直した予約でも古いCSV取込で元に戻る**＝オーナー懸念の実体。タスクで潰した「丸ごと再保存」病が予約取込側に残存(タスクは`_mergeUserInput`保護済／予約取込は無保護＝穴)。証拠＝NHA churn 直近1h 46件更新(全部既存再書込・新規0)・19:40=33/19:50=25/20:55=21件の塊。今は同値でno-op(台帳空)だがstale掴めば実害。SPKは1件ずつ＝安全。**直す方向＝予約に手動編集マーカー(タスクの`_placeSource:"manual"`思想)＋CSV取込をマージ化(手動編集項目はCSVで上書きせず保持)。基幹＝実機検証込みで慎重に(盲目編集で壊した前例あり)。**

### 🤖 2026-07-05 OMNI3号「台帳見張り」＝旧番人(audit-guardian)を廃止し状態照合型に置換
- **旧 audit-guardian(pg_cron jobid17 */15) は unschedule済（ノイズ源）**。理由＝"変化の瞬間(差分)"を叩き、NHAタスク再生成の途中経過(一瞬消えて即戻る)を全部「R2物理削除/担当消えた」と誤報＝誰も動かないゴミ。実証：物理削除された予約は全部status=cancelled(正当削除)、時間消失/担当消失も直後に再生成で復旧済＝**今も壊れたまま放置されている実害は0件**。
- **正しい判定＝"変化の瞬間"でなく"今も壊れたまま放置されているか(事後状態照合)"**。旧番人が16件叫ぶところを状態照合で0に正しく収束。
- **実体＝`~/Desktop/HANDYMAN/audit_watch/audit_watch.py`＋launchd `com.handyman.audit-omni`(1時間毎・RunAtLoad)**。処理＝audit_logで怪しい変化を拾う→今のDB状態を照合(再生成で戻った分は握る)→本物だけ→**SPK(=_id予約固定・クリーン)のタスク手入力消失/生存予約の削除は自動revert(mgmt-api)**／NHA(=t連番スロット再利用で誤検知源)・予約日変更・予約物理削除は**報告のみ**→#omni-operation_3号機(C0B8747PR0R)にSlack、壊れゼロなら静か。
- **誤検知除外(重要)**：①app_name=mgmt-api(自分の操作) ②予約idにTEST/ZZMYPAGE ③NHAは`予約番号`がdiffで変われば別予約への置換=スロット再利用=握る ④changed_json差分がタイムスタンプキー(_ssPlaceAt等)だけ=no-op ⑤空→値(補完)。
- **運転モード**：現在 `--slack`(報告のみ)。自動修復(`--apply`)はSPKタスクのLOSE_FIELD/LOSE_PLACE/DEL_TASKのみ対象だが**未検証**→初回の本物発火時に修復内容を1回確認してから解禁(＝既知悪経路=検証済みだけ自動revert)。launchd操作＝`launchctl bootout/bootstrap gui/$UID`、手動＝`python3 audit_watch.py --days 7`(dry) / `--days 2 --slack`(本番同等)。

### 番人(Guardian・pg_cron */15・動いたら戻す対症)
task_integrity_guardian(main・`task_integrity_scan(p_fix)`＝SPK自動修正ON/NHA検知のみ・`task_integrity_log`)＋parking-integrity-guardian(rkrvjpipvpybkmqadmrb・同一carId2枠検知・`parking_integrity_log`)。番人=現場を止めない／台帳=原因を消す の両輪。

### 根本4砦(全店デプロイ済)＋現状認識
固定ID(`d-/c-/w-`+予約ID＝重複根絶)／固定日付(`_taskDate`＝移動根絶)／単独書込+読むだけ(消失根絶)／墓標(deleted=true＝復活根絶)。版 SPK v4.7.368/NHA v3.5.251/BT v1.0.108。**正直：修正はデプロイ済だが"効いた"は未証明。デプロイ後もドリフト検知＝欠陥はまだ生きてる(古いキャッシュ端末 or 修正の穴＝台帳が次に判定)。**次段＝保護フィールド(日付/担当/done/予約日/status)は人以外の書込を拒否(tamper-evidence→resistance)。
### 教訓(この日)：Supabase全停止はAPI層hang(Postgres健全)＝アプリバグでない→**プロジェクト再起動で復旧**(誤診してrevートした)。python heredocはBashで無言失敗→Write→`python3 /tmp/x.py`。curl+SQLは`--data-binary @-`かjson.dumps。並行エージェント注意＝commit前に`git fetch`+`git log`。

## 🚨 2026-07-04 Supabase広域障害 → 事業継続(オフライン)＋独立バックアップ体制を構築（このセッション最重要）
**障害の実態と、二度と"営業が止まる/データ不明"にしないための仕組み。次に障害が来たらまずここを見る。**

### 起きたこと（切り分けの記録）
- 症状：両店アプリが開けない／「タスク・OPシートが消えた」。原因＝**Supabase基盤の広域障害**（公式 "Partially Degraded Service"＋インシデント "Project status change failures in multiple regions" 6/30〜）。
- **データは1件も消えていない**（障害中に管理API経由で照合：SPK tasks 1199／NHA nha_tasks 879／削除0）。"読めない"だけ＝可用性障害でありデータ消失ではない。
- **切り分けの罠**：プロジェクト状態は `ACTIVE_HEALTHY`・`/auth/v1/health`は即応(401)だが、**実クエリ(/rest/v1・Management API /database/query)がHTTP 000/503/521でタイムアウト**＝接続プール/コンピュート側が詰まる。**フラッピング(一瞬復旧→また落ちる)**。
- ⚠️**復旧判定は"アプリの実経路 /rest/v1"で見る**。Management API(/database/query)は別経路で先に復活する→これで「復旧」と誤判定した（反省）。復旧＝`/rest/v1`が5回連続で521/000以外。
- ⚠️ Management APIを**urllibで叩くとCloudflare bot判定で403**。必ず**curl**(`--data @file`)。監視の叩きすぎでもレート制限403→間隔を空ける。
- 障害中の対応＝**触らない・再入力させない**（復旧時に二重化/破損）。#handyman_development(C07B5G3PV7C)に周知投稿済。**自前Restart非推奨**（インシデントが"状態変更失敗"系＝固まるリスク）→サポート連絡が最短。

### 作った仕組み（3層）
1. **事業継続＝本体アプリのオフライン読取キャッシュ（本命・v4.7.370）**：`DB.fetchReservations`/`fetchVehicles` に localStorageキャッシュ＋障害時フォールバック追加（**fleet=`_fleetLs*`・tasks=`_lsKey`は既に実装済み**の同パターン踏襲）。キー＝`spk_reservations_cache`/`spk_vehicles_cache`。→ **Supabaseが落ちてもOPシート/タスクサマリ/スケジュール/データタブ/配車表の5画面が"手元コピー"で読める＝営業継続**（読取専用・既存「⚠️オフライン」バナー）。**書込処理は一切不変(低リスク)**。使い方＝普段通り使うだけ(開くたび自動保存→障害時に自動で手元コピー表示)。**今日の障害はネット正常・Supabaseのみダウン→アプリ自体はGitHub Pagesから開けた→SW不要、データキャッシュだけで足りた**。
2. **独立バックアップ＋復元（保険）**：`~/Desktop/HANDYMAN/backups/` に3ファイル。
   - `hdm_snapshot.py`：主要20テーブル(SPK/NHA)を1時間ごとJSON保存(Supabaseと別系統)。**launchd `com.handyman.snapshot`(毎時:05・3日保持)登録済**。≈7.5MB/回。**curl必須**(urllib=403)・テーブル間3s間隔。
   - `hdm_restore.py`：任意スナップから**選択復元**(`--table tasks --where "date='...'" --dry/--apply`・`--missing-only`=消えた行だけ復活)。`json_populate_recordset(null::table,$hdm$json$hdm$) on conflict`でJSON→型自動upsert。PKマップ内蔵。
   - `hdm_console.py`：**可視化＝復元コンソール**(`python3 hdm_console.py`→localhost:8899)。スナップ一覧→その時点⇄今のDB差分(🔴消えた/🟡変化/⚪一致)→ボタンで復元。**PATはサーバ側のみ・ブラウザに出さない**。
3. **Supabase自動バックアップ(既存)**：日次7日分(walg有効・**PITR OFF**)。→ **PITR ONにすれば"障害N時間前の任意秒"にDB全体復元可**(有料・ダッシュボード)。今は日次単位=最大〜24hズレ。
- 補足：opsheet-offline.html(当日配車の単独PWA)も作ったが**本命は①**(5画面を作り直さず既存画面がそのまま生きる)。
- **区別**：①=障害中も"止めない"(読取継続)／②③=壊れた後に"復旧"。**復元はDBが生きている前提＝障害の最中は使えない**。今日困ったのは①。
- **✅ 3店とも展開完了（2026-07-04）**：SPK v4.7.370 / NHA v3.5.253-NHA(~/Desktop/AI/naha-project・55ae18f) / BT v1.0.111-BT(~/buddica-touring/app・1a28e21)。全店 `{store}_reservations_cache`/`{store}_vehicles_cache` 追加（fleet=`_fleetLsKey`・tasks=`_lsKey`は元から実装済＝5画面フル対応）。NHA/BTは`fetchReservations`が`fetchAllRows`(ページネーション)なのでtry/catch＋DB空時もキャッシュfallback。fetchVehiclesは成功時`_vm`変数化して`_vehLsSave`。**書込は一切不変(低リスク)**。ビルド＝NHA/BTは`node build.js`後にBASE_V(index.html)も+1。SPKはCV＋APP_VERSION＋sw.js?v。
- **残（オーナー判断/将来）**：Mac起動中のみ稼働の穴→GAS版バックアップ(Google基盤24h)／Supabase PITR ON(有料・任意秒復元)／opsheet-offline.htmlは本命①の補助。

## 🃏 2026-07-04 my-admin.html（マイページ管理コンソール）ステータス定義とデータ照合の確定メモ
**オーナー確認済みの定義。my-adminのボード/フィルタを触る時はこれを基準にする。**

### ステータス定義（確定）
- **本日のみ＝本日出発（lend_date===today）の予約リスト**（旧「出発or返却が本日」から修正・v dde14e2）。`stToday(r)=r.lend_date===today()`。
- **位置情報更新あり（迷子）**＝OPタスクに`_ssAlert`が立っている予約（フォームで場所を再更新した＝要人間確認）。旧表記「迷子(再回答)」は混乱を招くので「位置情報更新あり（迷子）」に統一（v 94a5c7e）。**迷子でも場所は必ず入っている（更新後の値）＝空ではない**。
- **場所情報なし**＝OPタスクの場所が真に空（`_ssPlace`空・`_placeSource≠manual`・reservations列も空）。visit_type∈(来店/PUB/PUB来店)はDEL不要、return_type=返却はCOL不要で除外。**迷子と場所なしは別軸**（迷子=更新あり/場所なし=未入力）。
- **「この場所で反映」ボタンは削除**（v dfdea6c）。OPはSSパトロールで常に自動最新化されるので、人が手動反映する場所ではない＝確認済みボタンのみ残す。オーナー方針「この管理画面は"見るだけ・ログ"＝操作を持たせない（操作させると自動化の意味がない）」。

### 表示＝OPシートと完全一致（実照合済 2026-07-04）
- my-adminの場所表示は**OPタスクと同一の解決式** `_placeSource==="manual" ? place : (_ssPlace || place)` を使う（`opPlaceOf`/`PLACE_MAP`）。迷子7件で更新値＝OP表示が全一致を実証。my-adminは`reservations.del_place`を直接見ない（常に空だから・OPタスク経由が正）。

### 「場所情報なし＝LINE IDなし」は約8割正しいが厳密には非1:1（実照合済 2026-07-04）
- 場所なし63件の内訳：**LINE IDなし50件**（フォーム完全未回答＝友だち追加もまだ＝LINE到達不可）＋**LINE IDあり・場所なし13件**（LINE登録済だが場所未入力・全て8〜10月の先の予約＝LINEで場所入力を催促可能）。
- 正しい定義＝**場所なし＝「フォームで場所をまだ入力していない」**（広い集合）。LINE IDなしはその中の"友だち追加もまだ"のサブセット。
- OTA予約（楽天/じゃらん/skyticket/エアトリ）は**OTAで場所入力できない→フォーム回答するまで場所は必ず空**＝場所なしの主因。

### DB照合の罠（次回の教訓）
- **`del_place`の空文字判定**：SPK reservationsの`del_place`は空でもnullでなく`""`（空文字）のことがある。SQLで`coalesce(x, del_place) is null`だと`""`が残って**空を空と数えられずundercount**。必ず`nullif(trim(...),'')`で空文字もnull化してから数える（JS側は`!p.del`で空文字も落ちるのでズレる）。今回これで15件と誤カウント→正しくは63件だった。
- Management API（`/database/query`）はcurl+PAT(`~/.config/keydrop/sb_token`)で照合。tasksのPKは`_id`（d-/c-/w-接頭辞）、場所は`changed_json::jsonb->>'_ssPlace'`。

## 🛡🛡 2026-07-03〜04 手入力データ破壊バグ 根治＝恒久ルール「1アクション＝1件だけ記憶」（3店統一・最重要）
**オーナー確定の絶対原則。今後タスク/予約系の保存を書くときは必ずこれに従う。** 症状＝人間が入力/編集したデータ（その他タスク・担当・場所・時間）が「消える／別の日・場所へ移動する／消したのに復活する」。**トリガーは常に"既存データがある状態で編集 or 新規登録した時"**（予約自動取込では起きない）。何ヶ月も何十回も再発した。

### 根本原因（1つ）
アプリが「自分=システムだけが作者」という前提で、開くたび・15秒毎に *その日を再生成して全タスクをまとめて保存し直す* 設計だった。→ 新規1件足す/1件編集するだけで **その1件でなくタスク全体をupsert** → 他の既存行を今の状態で上書き・再配置・空で潰す。同時アクセス(複数端末)ほど悪化。過去の修正が「再生成の中で人間入力を検知して守る」マージ方式で、経路が増える度に穴が増える＝モグラ叩きだった。

### 恒久ルール（芯・違反禁止）
> **既にDBにある行は二度と再計算・再保存しない。アプリは表示するだけ。書くのは人間が明示操作した時だけ。単一対象の操作は、その1件(=updateTask)だけ書く。全体upsert(upsertTasks(配列))を人間アクションで使わない。記録は自分の錨(入力日=_taskDate)を持つ。削除は墓標(deleted=true)で残す。**
- **なぜ同時アクセスに強いか**：AがX行の担当、BがY行の場所を同時編集→別行なので衝突しない。同一行の別項目でも両立。競合するのは「全く同じ行の同じ項目を同時」だけ＝後勝ちで十分。全体upsertはこれの真逆で同時アクセスに最悪だった。→ マイページ(不特定多数の顧客書込)を安心して出す前提がこれ。

### 実装（DB土台）
- **`tasks`/`nha_tasks`/`bt_tasks` に `deleted boolean DEFAULT false` 列＋部分index追加済**（Management API `/database/query`・PAT=`~/.config/keydrop/sb_token`(sbp_)。tasks/nha_tasks=projA `ckrxttbnawkclshczsia`、bt_tasks=projB `ggqugvyskyiblxiycpci`）。SQL正本＝`~/spk-task/tombstone_migration.sql`。
- **墓標方式**：`deleteTask`は物理削除→`update({deleted:true})`。`fetchTasks`/`fetchTasksRange`は`.neq("deleted",true)`で除外。**`_toDbTask`はdeleted列を書かない**＝upsertしても`deleted`は保持（ON CONFLICTは payload に無い列を触らない）＝再生成/マージ/他端末が復活させられない。
- **単独書き込み化**：`addOtherTask`/`addWashTask`/`add`(NHA/BT)/配車変更/氏名変更/キャンセル・復元 を `upsertTasks([...tasks,new])`→ `updateTask(new)` / 対象予約の行だけ `updateTask` に変更。編集(`upd`)は元から単一行(updateTaskFields/updateTask)。
- **入力日固定**：手入力タスクに`_taskDate`(入力日)。`_toDbTask`は`t.manual&&t._taskDate`ならその日付で書く＝どの自動処理も別日へ移動不能（SPK実装。NHA/BTは他日漏れ構造が無いため未実装＝不要）。
- **開くだけでDBを書かない**：loadTasksの読み込み時の破壊的DB書込（孤立/cleanStale/washClean/dedupのDB削除、ゴースト場所のDB上書き）を**表示除外のみ**に変更（掃除は日次GASに委ねる）。CSV途中の一時消失で人間入力を誤削除する事故を防ぐ。

### デプロイ済みバージョン
| 内容 | SPK | NHA | BT |
|---|---|---|---|
| 過去日車番を現在配車で上書きしない | — | v3.5.247 | — |
| その他タスク入力日固定(_taskDate) | v4.7.364 | (不要) | (不要) |
| 削除=墓標(soft delete) | v4.7.365 | v3.5.248 | v1.0.106 |
| 単一対象=1件だけ書く | v4.7.366 | v3.5.249 | v1.0.106 |
| 開くだけでDB書かない(読込時破壊書込停止) | v4.7.367 | v3.5.250 | v1.0.107 |

### 🎯 タスク移動(予約連動)の根治＝全タスクを`_taskDate`で固定（2026-07-04・最重要追記）
現場報告「**7/4に7/5のタスク(DEL)が出る**」「**本日分が消えて明日に入る**」「**日付移動して戻ると担当が消える**」の真因と根治。
- **切り分け(実データ)**：R0FDP2O9(カク・日帰り7/5・じゃらん)のDEL/COLがDBで**date=7/4**。`created_at`で確定＝**7/5で正しく生成→後に前日(7/4=洗車日)へMOVE**（born-wrongでなくmove）。R0HTEG3B(ヤマダ・日帰り7/19)も同型(7/18へ)。**共通特性＝日帰り(lend==return)予約**。予約番号の日付は不変(じゃらんメール確認)＝**ズレるのは常にタスク側**。
- **なぜ移動するか**：`saveNameEdit`(氏名変更)等が `予約の全タスク.forEach(updateTask(x, selDate))`＝**"今開いているタブの日付(selDate)"で予約の全タスクを書く**。日帰り予約の洗車(前日)タブでその予約を触るとDEL/COLが前日へ落ちる。個別経路が複数(氏名/全体保存/状態リーク)＝モグラ叩き。
- **根治＝書込の1関所で全タスクを"自分の日付"に固定**（手入力の`_taskDate`を**予約連動(DEL/COL/PU/BD/洗車)にも拡張**）：
  - `generateTasks`：生成タスク全部に`_taskDate:norm(date)`（そのcallのdate＝正しい日）。
  - `_toDbTask`：`_d=(t._taskDate)?t._taskDate:date`＝**全タスクで`_taskDate`優先**、changed_jsonに永続化。
  - `_fromDbTask`：`_taskDate:(cj._taskDate||d.date)`＝既存分は現DB日付で固定(現DBズレ0なので正)。
  - → どの経路が別日で保存しようとしても**本来の日付以外へ物理的に書けない＝移動が構造的に不能**。⚠️副作用：OTA予約日変更(reschedule)時タスク非追従→将来必要なら予約日変更時に`_taskDate`再刻印を追加。
  - 版：**SPK v4.7.368 / NHA v3.5.251 / BT v1.0.108**。既知2件はDB手修正済。
- **監視**：`/tmp/task_move_monitor.py`(1分毎snapshot→変化記録)。45分変化0。今後も全照合(予約日vsタスク日)を定期再走で新規-1ズレ0を確認。
- **📚サンプル＝OMNIのSlackログ**：staff報告は #omni-development_1号機(C0B66BVCSPM)等の履歴にある(bot .out.logは運用ログのみ本文なし)。`conversations.history`(bot token)で「移動/消え/前日/本日分/日付」検索＝過去報告(2026-05〜07多数)を復元。**"動いた個体"の共通特性を掴むのが最短**(今回＝日帰り予約)。

### 残タスク（安全な順に3店そろえて仕上げる）
1. **バルク操作の単独/変更行のみ書込化**（NHA/BT: 時間一括18148・場所一括18201・並び替え18320・行移動18404・SS自動同期17679 等が今も whole-array upsert）。SPKは主要add/cancel済。氏名変更はSPK該当無し/NHA済/BT要確認。
2. **編集中は自動更新(15秒)で上書きしない**を構造保証（現状 pendingSaves/selfUpdate の時間窓頼み）。
3. **開くだけの再生成を完全に"表示だけ"に**（generateTasksは0件新規予約への追加のみ＝ほぼ達成、要総点検）。
4. **自動回帰テスト**（「開いてもDBは1件も変わらない／手入力は残る／消したものは復活しない」を機械検証）＝再発を構造的に不可能に。
5. 残: 集計/TOP/レポートの読取一部が`deleted`未除外（削除がカウントだけ残る＝表示ズレのみ・害小）。フィルタ追加で閉じる。
- dev共有済(#handyman_development C07B5G3PV7C, ts=1783079700 / 1783114916)。**「もう起きない」は言葉でなく現場で再発しないことで示す**。



## 🚀 2026-07-05 マイページ リリース仕様（確定・オーナー承認）
**「マイページ管理(my-admin)＋ユーザーマイページ(my.html)」を本日テスト後リリース。** フォーム(SS)側の変更は不要。管理画面＝ボード型。OPシートにユーザー別マイページURL実装済。運用は**LINEより管理画面中心（情報整理と確認）＝マイページ利用率に連動**。
- **管理6カテゴリ（=ボード列）**：①情報相違(SS≠OP・mismatch＝主にスタッフ手動入力の不一致) ②異常値・要確認(resvabn＝フォーム未なのに場所あり/出所不明・システムエラー) ③変更リクエスト(req＝マイページのオプション/補償依頼→承認/却下) ④位置情報更新あり(reanswer＝フォームで場所更新/迷子) ⑤情報変更(userchg＝マイページで場所/時間変更・DEL24h/COL2h) ⑥場所情報なし(miss＝フォーム未回答)。**LINE ID有りは場所催促を📣通知②で自動化可**。
- **⑦想定エラー**：マイページ開けない(デバイス/通信)・リクエスト無反応・時間/場所変更が反映されない・LINE使わない → 多くは公式LINEで解消。
- **初動通知＝ONにした瞬間の初回cronで「LINE ID有り×返却が今日以降×未送信」に一斉送信**（現在70件・貸出14日以内22件）。ロールアウト方式(全員/直近のみ/新規のみ)＋スロットルは要判断。
- **リリース前チェックリスト**：(1)🔴@SNS Autoを#sapporo_user_actionに招待(未招待だと通知飛ばない) (2)test_mode=ON＋自分のuserIDで通知検証→本番ON (3)mypage_notify_enabled既定OFF＝ONまで送信されない。
- 検証済(E2E)：リクエスト到達／承認→マイページ連動／場所時間→reservations＋OPタスク反映／audit_log記録。多言語(日英繁韓)・OPシートURL・返却済非表示・確認ダイアログ 実装済。

## 🗺 2026-07-05 「場所登録済みなのに場所情報なしBOX」＝エルメ受付フォーム(spk_line_links)未統合の修正
- **症状**：ワカツキ様(RC32461200845228864・A2楽天9/20)がmy-admin「場所情報なし」に入るがフォームで場所回答済み。スクショの変更履歴は**ブラウザキャッシュ(古い表示)**でライブlookupは`del_place=""`/`history=[]`だった。
- **真因**：顧客のフォーム回答(6/9)は`spk_line_links`(エルメ受付CSV・del_place/col_place・answered_at)に残っていたが、reservations/OPタスク/places/mypage_changes は全て空（未来予約でOPタスク未生成＋line_links→reservations同期が走っていない）。my-adminのSS判定(`fetchSS`＝Googleシート別ソース)と`stMissing`(OP側しか見ない)がline_linksを見ておらず「フォーム未回答」と誤判定。該当**60件**(直近7/5含む)。
- **修正(表示のみ・DB書込なし)**：`spk_line_links`＝SSと同一ソースとして統合。my-admin＝`LINK_MAP`ロード→`mergeLinkIntoSS()`でSS_MAPに補完(ライブSS優先/無ければlink)＋`stMissing`が`op.del||ss.del`で判定→フォーム回答済みは⑥から外れ「フォーム済(正常)」に。EF lookup＝`del/col_place`と時刻の最終フォールバックに`spk_line_links`(**予約番号完全一致**)を追加→顧客マイページに回答済み場所を表示。検証：ワカツキ様lookupで「ホテルtheb札幌/ニューオータニイン札幌」表示OK。ADMIN_VER v2.3。
- **教訓**：フォーム回答の正本は`spk_line_links`(resv_no=予約id完全一致)。「場所情報なし=フォーム未回答」判定は必ずline_linksも見る。`placeConflict`は空欄側を相違に含めない設計なので、空OP+SS場所ありをmismatchでは拾えない→stMissing側で吸収。
- **backfill実施済み(2026-07-05・進めて指示)**：`spk_line_links`場所→`reservations.del_place/col_place`へ書込(未来・未キャンセル・空欄のみ・完全一致 60件del+60件col)。**既存OPタスクに実値がある予約はOPが正としてreservationsをタスク値に整合**(del5/col6)→**予約≠OP相違ノイズ0**を実証。両方空の既存タスクは`_ssPlace`が既に埋まっており(place列空でもOP表示OK)ガードで保護、真に空の2タスクのみフォーム値を`_ssPlace`へ補完。結果：未来予約はタスク生成時にreservations.del_placeを継承・マイページ/my-admin/OP整合。**注意**：`_ssPlace`にはplace列が空でも値が入る＝「place列空」を「OP空」と誤判定しない(OP表示=`_ssPlace||place`)。書込は全て空欄埋め・単一項目・顧客自身の回答(完全一致)＝唯一ルール順守。

## 🔴 2026-07-06(続) マイページ 変更反映バグ根治＋運営お知らせ＋現場マニュアル（このセッション）
版：**my.html VER v6.2 / my-admin ADMIN_VER v4.2 / EF handyman-mypage デプロイ済**。
- **🔴🔴 最重要バグ根治：顧客のマイページ場所/時間変更が「本人ページにもOPシートにも反映されない」**（変更前に戻る＝スタッフも誤時間で動く重大バグ）。真因＝**SSパトロール(index.src.html L14975〜)が tasks._ssTime/_ssPlace をフォーム(エルメ)値へ戻す**。パトロールの保護は**場所=`_placeSource==="customer"`のみ、時間は`!t.timeChange`のときだけ**。マイページ時間変更は`_ssTime`だけ書いて`_timeChange`未設定→毎回パトロールに戻されていた。
  - **修正2段**：①EF `applyPlaceTime`(patchTasksSpk)で時間変更時に **`cj._timeChange`を立てる**（OPシート表示`timeChange||_ssTime||time`で最優先＋パトロールが`!t.timeChange`でスキップ＝もう戻らない）。②EF lookup `resolveTaskTime`も`_timeChange||_ssTime||time`に。③さらにlookupは**適用済みmypage_changes(applied)を最優先**(`appliedChg`)＝表示は常に確定変更が勝つ。既存2件(R0FLNYBK/R0YLA9ZC)は`_timeChange`をSQLバックフィル済(jsonb `||`で注入)。
  - **設計方針(オーナー確定)＝一度マイページで編集したらマイページ優先**（フォーム再取込で戻さない）。場所=`_placeSource=customer`／時間=`_timeChange`で担保。
- **📣 運営からのお知らせ**（my.html TOP・ヒーロー直下常時表示・多言語）：「マイページにアクセス後はフォームからの時間/場所変更はお受けできません。変更はマイページから」。TR=notice_title/notice_body。
- **顧客ページに『🔄変更前 〇〇』バッジ**：お届け/回収の場所・時間の行に、適用済みmypage_changesのold_valueを表示（例 10:00の隣に🔄変更前10:30）。`origOf(field)`/`chgBadge(field)`。履歴(v5.8 histLine)にも「10:30→10:00にしました」。
- **🔒 スタッフは顧客マイページを閲覧専用で開く**(my-admin v3.8)：openMy→`&ro=1`。my.htmlは`RO=`検出で`editable=false`＋`call()`が書込ブロック＋🔒バナー。「🔗顧客へ送るURL」は編集可URL(ro無し・顧客に送る用)。スタッフが本人成りすまし編集する事故を防止。
- **ボード改善(my-admin)**：①日付フィルタ「すべて/本日/明日」3択(`DAYF`・`onDay`=lend or return がその日／旧:本日のみ)。②**情報相違(mismatch)を排他にせず併存表示**(v4.0・`resColumns`)＝相違があっても情報変更/変更リクエストが隠れない(R0FLNYBK=時間変更が相違に吸われていた)。③ヘッダー「変更依頼」バッジ＝**承認待ち(stReq)のみ**に(v4.1・情報変更を合算しない)。④利用状況に**🔵送信済(未開封)を独立ステータス化**(v3.7・スルー=送信後2日以上未開封のみ・`daysSince>=2`)。⑤**本日の新規送信(初回URL)件数**(v4.2)。⑥**マイページ発行カバレッジ**(全予約にtoken 100%・`issueTokens`)。
- **エルメCSV取込**：`line_auto/import_erume_csv.py`(SB_SERVICE_ROLE要・service_roleキーはManagement API`/api-keys?reveal=true`で取得可)。`python3 import_erume_csv.py <csv> [--dry]`。除外＝予約番号 空/テスト/test(実顧客でない)。取込でLINE連携67→78・CSV鮮度更新→未送信者に自動送信。**毎日TOP「📱LINE紐付け更新」で取り込む**(userIDはエルメCSVのみ・4日放置でLINE未連携が水増し)。**LINE未連携数≠場所なし数**の理由＝HP予約(場所は予約時・LINE不要)が未連携に含まれる。
- **現場かんたんマニュアル**：`~/spk-task/field-manual.html`（https://nosh2318.github.io/spk-task/field-manual.html ・⌘P→PDF）。マイページ→洗車→検査→傷→出発→到着→回収→返却→御礼を**人間🧑/AI🤖**で分離。オーナーが洗車/検査ステップを追記。
- **⚠️並行編集の教訓（再）**：Slack omniと同じmy.html/my-adminを同時編集→私のVER変更が飲まれGH Pages旧デプロイ配信で「お知らせ出ない」に見えた。**コミット前に`git fetch`＋`git status`＋VERを明確に上げて再push**、`curl ライブ?cb=時刻`でVER＋文言の両方を確認。GH Pagesは反映に1〜2分ラグ。
- 現在の自動送信：mypage_notify_enabled=ON(本番)/damage_enabled=ON(傷30分前)/track_enabled=OFF/thanks_enabled=OFF。止める＝`UPDATE spk_line_config SET mypage_notify_enabled=false`。

## 🚀🚀 2026-07-06 マイページ 札幌 本番リリース完了＋通知刷新・可視化強化（このセッション・最重要）
**リリース実行済み**：`spk_line_config.mypage_notify_enabled=true`（サーバSQLでON・UIトグルはログイン必須で効かず→Management APIで確実にON）。`test_mode=false`。初回マイページURLを**LINE連携済み67名全員に送信完了**（EF手動キック2回で残0）。現在の版：**my.html VER v5.8 / my-admin ADMIN_VER v3.7 / EF handyman-mypage デプロイ済**。全て札幌専用。
- **🔑 初回送信の仕組み**：cron `mypage-notify-spk`(jobid15・15分毎)→EF `mypage-notify`(`x-cron-secret`=e564ecc8dc6590e3c2b2a1003d2cff6750f5bc1c)。**1回あたり約30件ずつ**送る(Edge Function実行時間内の分)＝残りは次巡回で自動送信＝取りこぼし無し。誤送信ガード(キャンセル/過去日/番号不一致/no_userid)有効。手動実行＝`curl EF -H x-cron-secret --data '{}'`。**EFのtoday=JST(dstr=jstNow)**。
- **⚠️ 数字ズレ=タイムゾーン**：Management APIのSQL`current_date`は**UTC**、my-admin/EFは**JST**。UTC基準だと日跨ぎで数件多く出る→**JST基準(my-admin表示)が正**。件数照合はJST日付をリテラルで渡す。
- **📲 利用状況リスト刷新(openUsage)**：ファネル5段＝🟢アクティブ(開封済)/🔵送信済(未開封=送った直後・新設)/🟡スルー(送信後**2日以上**未開封のみ)/⚪未送信/⚫LINE未連携。`daysSince(sent.at)>=2`でスルー判定。**送った直後をスルー扱いしない**(オーナー指摘)。開封検知=`mypage_views`(EF lookup冒頭で`rpc/mypage_touch_view`fire・前方記録)。**🪪マイページ発行カバレッジ**表示(全予約にmypage_token付与=481/481=100%・DB既定gen_random_uuid・未発行は`issueTokens()`で手動発行)。各行にOTA/🪪発行/LINE/送信/開封/操作バッジ。SENDS=spk_line_sends(action=mypage_initial)・VIEWS=mypage_views をloadAllで読込。
- **🔔 Slack通知をBlock Kitカードに刷新**(mpCard)：見出し＋基本情報(お客様/予約番号/**予約もと(OTA)**/利用期間/車両)＋内容＋対応の要否。**即時変更は変更した項目のみ before→after**表示(4項目まとめのノイズ排除)。全種類(即時変更/24h承認待ち/オプション・補償・受渡依頼/キャンセル/早め回収/承認・却下)を統一。`notify_preview`アクション(認証必須・DB/LINE副作用なし)で全11パターンをサンプル送信→リリース前確認。宛先#sapporo_user_action(C0BER0YC6AK)・`slackPost(text,blocks?)`。
- **予約もと(OTA)を3面に表示**：Slackカード(予約もとフィールド)／利用状況リスト(OTAバッジ)／顧客my.html(「ご予約元」行＋予約番号)。lookup応答に`ota`追加・`OTANAME`多言語マップ。
- **ボード：1予約が複数対応を持つ時は各列に表示**(`resColumns`が配列)：変更リクエスト(承認待ち)と情報変更(即時変更)は独立→両列に出す。各カードに📌「この列は◯◯」バッジ＋(複数の対応あり)＋**列別アクティビティ行**(`activityFor`)で識別。mismatch/ack/miss/resvabnは単独。`resColumn=resColumns[0]`。
- **早め返却=希望回収時間の指定**：my.html時間プルダウン付きシート→EF `ready`が`p.time`をmypage_changes/Slackに反映。管理3面(状況ボード/変更依頼カード/履歴)に希望時間表示。承認後文言は「確定」廃止→「承りました」(オーナー指示)。
- **顧客履歴の before→after**：my.htmlの最近の履歴で場所/時間変更を「◯◯→△△」「10:00→11:00」表示(lookup historyに`old_value`追加・histLineでdel/col_place・lend/return_timeの旧→新・多言語)。
- **二重送信ガード**：my.html `call()`に`SENDING`フラグ＝lookup以外は多重実行を弾く({dropped:true})。全送信系に`if(json.dropped)return`。スマホのゴーストクリックで2件insert/Slack2通の再発防止。
- **札幌駅=北口推奨**：地図ピッカーで「札幌駅/Sapporo Station/札幌車站/삿포로역」検出時、赤ボックス「⚠️南口は停車不可→北口推奨」(mpStNote・入力/候補選択/逆ジオコード/起動時)。
- **ボード列を色分け**(v3.3)：各列をカテゴリ色で背景/枠/見出し着色＋間隔・影で仕切り明確化。
- **スマホ最適化 最終確認済**：my.html=max-width520・入力16px・ボトムシート・safe-area／my-admin=メディアクエリ(900/640)・カルテ全画面オーバーレイ・モーダルは`width:100%`で溢れなし。オプションselectを16px化(iOSズーム防止)。
- **場所編集の本体は地図ピッカー`mapPicker`**(editFieldのtext版はplacesで未使用のレガシー)。del/col_place変更はmapPicker→mpSave→`call("update")`。
- **止め方**：`UPDATE spk_line_config SET mypage_notify_enabled=false`。**残(将来)**：送信スコープ絞り(全員/直近/新規)は未実装＝ONで全員。NHA展開。

## 🟢 2026-07-05(夜) マイページ 早め返却=時間指定／利用状況リスト／二重送信ガード／札幌駅注意（このセッション）
現在の版：**my.html VER v5.5 / my-admin ADMIN_VER v3.2**。EF handyman-mypage デプロイ済。全て札幌専用（NHA/BT未展開）。
- **早め返却(返却準備完了)に希望回収時間の指定を追加**：my.htmlのボタン→**時間プルダウン付きシート**(openReady/confirmReady・TIMES=9:00〜19:00/30分・初期=予定回収時間)→`call("ready",{time})`。EF `ready`が`p.time`(HH:MM検証)を`mypage_changes.new_value`=「返却準備完了(早め回収OK) 希望時間 HH:MM〜」＋note＋Slackに反映。**管理画面の出先3つ**＝①状況ボード「🟢 返却準備完了・早め回収OK（希望 HH:MM〜）」②🔔変更依頼カード(new_value)③🕘履歴。readyTime()=new_value末尾のHH:MM抽出。
- **「確定しました」文言を廃止**（オーナー指示）：ready_approved「✅早めの回収が確定しました」→**「✅早めの回収を承りました」**。EFの承認LINE文は元から「承りました」。他の`確定`(予約確定/オプション・補償・キャンセルの"担当が確定します")は別文脈で残置。
- **📲 マイページ利用状況リスト（アクティブ/スルー可視化）**：my-adminヘッダー「📲利用状況」モーダル(openUsage)。**送信→開封→操作のファネル**：🟢アクティブ(開封済)/🟡スルー(送信済・未開封)/⚪未送信(LINE連携済)/⚫LINE未連携。LINE連携率・開封率・フィルタチップ・行タップでカルテ。
  - **開封検知＝新テーブル`mypage_views`**(reservation_id PK/first_at/last_at/view_count・authenticated select)＋RPC`mypage_touch_view(p_rid,p_store)`(security definer・ON CONFLICT加算)。EF `lookup`冒頭で`sbPost("rpc/mypage_touch_view",...)`をfire(応答ブロックせず)。**前方記録のみ**(デプロイ時点から)。
  - my-admin loadAllに`spk_line_sends?action=eq.mypage_initial`(=SENDS)と`mypage_views`(=VIEWS)を追加読込。判定：VIEWS有→active/SENDS(sent)有→through/LINE_SET有→unsent/他→noline。
- **🛡 二重送信ガード（1タップで2回叩かれる＝ゴーストクリック対策）**：my.htmlの`call()`に`SENDING`フラグ。**lookup以外(mutating)は前送信完了まで2回目を弾く**({dropped:true}返す)。全送信系(update×2/request×3/ready/cancel)に`if(json.dropped)return;`。JS単一スレッドで、call()冒頭同期でSENDING=trueにするので連続onclickの2発目は必ず弾かれる。原因＝スマホのtouchend+click二重発火で`ready`が2件insert・Slack2通。
- **札幌駅=北口推奨の注意表示**：地図ピッカー(mapPicker)で場所が「札幌駅/Sapporo Station/札幌車站/삿포로역」を含む時、赤ボックスで**「⚠️札幌駅南口は停車不可のため北口を推奨」**(多言語)。`mpStNote()`を入力(mpSearchInput)/候補選択(mpPick)/逆ジオコード(mpReverse)/ピッカー起動時に呼ぶ。t()はHTML非エスケープなので`<b>`可。
- 📍 場所編集の本体は**地図ピッカー`mapPicker`**（editFieldのtext版は places では未使用のレガシー）。del_place/col_placeの変更はmapPicker→mpSave→`call("update")`。

## 🟢 2026-07-05 マイページ 返却準備完了ボタン＋アクセス速度チューニング（このセッション）
- **返却準備完了ボタン（早め回収OK）**：顧客がmy.htmlで押す→EF`ready`アクション→`mypage_changes`(field=ready,status=requested,source=customer)＋Slack🟢通知→顧客側は「🕓承りました。確認中」に切替。承認/却下はmy-adminの変更依頼カード(decide)＝approve時LINE「早めのご返却を承りました」/reject「予定のお時間で回収」。重複申請ブロック。my-admin活動ライン「🟢 返却準備完了・早め回収OK」。多言語(ja/en/zh/ko)。my.html VER v4.2 / my-admin ADMIN_VER v2.2。
- **速度実測＝本体は既に軽量**：my.html=71KB・**vanilla JS/CDN依存ゼロ**(React/Tailwind/Babel不使用)・即スピナー表示(白画面なし)・Google Mapsは場所編集時のみ動的ロード(初期ブロックしない)。GitHub Pages応答 0.09〜0.36s＝問題なし。
- **ボトルネックはEdge Function lookup**：旧=5クエリ**直列**(token→fleet→vehicles→vehicle_twins→tasks→mypage_changes)。**独立3系統(傷チェックURL解決チェーン／OPタスク／変更履歴)をPromise.allで並列化**→warm **5ホップ→0.44s**。傷チェックのfleet→vehicles→twinsは依存直列なのでIIFEで内部直列のまま束ねる。
- **コールドスタート対策**：`action:"ping"`(DB不使用即応答)追加＋**pg_cron`mypage-keepwarm`(jobid16・*/4分)**でisolate常時ウォーム→初回訪問者の~1.4s待ちを回避。cronは`net.http_post`でEFに`{"action":"ping"}`。
- 教訓：顧客向けページは①本体は同期CDN排除＋即ローディングUI②データ取得EFは独立クエリを必ずPromise.all③コールドスタートはping+keep-warm cronで潰す。

## 🪪 2026-07-03 HANDYMAN 統合マイページ（全予約ユニークURL・札幌先行・構築中）★このセッション
**全予約(OTA/HP不問)に token を発行し、顧客が自分の予約を1画面で閲覧/変更。LINEは「マイページに更新があります＋URL」の通知ハブに徹し、情報の正本は常にマイページ1枚。KEYDROPの変更フローを踏襲（場所/時間=即反映・24h前まで／オプション/補償/キャンセル=依頼）。**

### 構成物
- **顧客ページ `~/spk-task/my.html`**（standalone・buildなし・push即反映）。URL＝`https://nosh2318.github.io/spk-task/my.html?t=<mypage_token>`（**公開しない・LINE個別送信のみ**）。フッターに版数(VER)表示＝キャッシュ判別用。GitHub Pages/LINE内蔵ブラウザは最大10分キャッシュ→確認は`&v=N`を変えると即最新。
- **Edge Function `handyman-mypage`**（正本`~/spk-task/line_auto/handyman-mypage/index.ts`→deployは`~/hdm-car-delivery/supabase/functions/`にコピーして`--no-verify-jwt`）。KEYDROP `keydrop-mypage`を複製元に札幌用に簡約。token認証(mypage_token所持=本人)。
- **管理コンソール `my-admin.html`（未実装・次タスク）**：変更/依頼一覧・承認/却下・場所食い違い警告・⚙️トリガー設定(spk_line_config)。認証＝本体ログイントークン再利用(sim.html方式 `_sbToken()`＝localStorage `sb-*-auth-token`)。

### DB（SQL: `~/hdm-car-delivery/sql/040_handyman_mypage.sql` 適用済）
- `reservations.mypage_token uuid unique default gen_random_uuid()`（全466予約に発行済）
- `reservations.mypage_locked jsonb`（顧客が確定した項目の印 `{del_place:{at,by:"customer"}}`）
- `reservations.del_lat/del_lng/col_lat/col_lng double precision`（地図ピンの座標＝ドライバー正確ナビ用）
- **`mypage_changes`**（追記専用の監査ログ＝上書き/消失しても検出&復元できる保険）：reservation_id/store/field/old_value/new_value/source(customer|staff)/status(applied|requested|approved|rejected)/note/created_at。RLS: authenticated読取可。**承認用にauthenticated UPDATEポリシー追加が必要（未実施）**。

### 🔴 場所/時間/オプション/補償は「reservationsとtasksの実値ある方」を採用（2026-07-04 バグ修正）
lookupは当初これらを `reservations` 直読みしていたが、**SPKでは reservations 側が空でOPタスク(d-/c-)側に実値、というズレがsystemicに存在**（未来141件中：場所57件・オプション13件・補償4件がズレ）。→ マイページだけ「未設定/なし」と誤表示。原因は「予約系の値は tasks(changed_json) 経由で最新化される」設計（場所=2026-06-07完全一致ルール、opt=2026-04-23同期、insurance=tasks.insurance）。**修正（lookupで両ソースの実値を統合）**：
- 場所/時間＝OPシート同一式 `_placeSource==="manual"?place:(_ssPlace||place)` / `_ssTime||time` でタスク優先、無ければreservations（`resolveTaskPlace`/`resolveTaskTime`）。
- オプション＝`Math.max(reservations.opt_*, tasks._optB/_optC/_optJ)`（どちらかにしか無いケースを両取り）。
- 補償＝`reservations.insurance` が空なら `tasks.insurance` にフォールバック。
- ⚠️ tasks.changed_json は**text型**なのでJSON.parse必須。今後マイページ表示は必ずタスクも見て「実値のある方」を採る（reservations単独直読み禁止）。

### 🩹 補償ラベルの表示マッピング（2026-07-04・「全部NOCになってる?」の回答）
my.html `insCur()` は insurance生値を3プランに寄せる：**`フル|NOC|安心→NOC(=基本＋免責＋NOC補償/安心ワイドパック)`・`免責|CDW→免責補償`・`なし/空→基本プラン`**。マイページ補償プランは3段階(基本/免責/安心ワイドパック)しかないため、`フル`(GAS detectInsurance_ L613=フルカバー/フル補償/安心フル＝最上位)と`安心パック`は**安心ワイドパックに寄せる**（カバー範囲は同等＝妥当・実害なし）。**全予約がNOC表示ではない**（未来141件の実測分布：安心ワイドパック84=NOC56+フル28／免責40／基本17）。insurance生値の分布(全体)＝NOC160/免責145/なし61/フル50/空41/安心パック8/CDW2。→ 楽天(R)予約はフル/NOC加入が多く安心ワイドパック表示が6割で「全部これ」に見えるが正常。フルを別ラベルで区別したい場合のみ my.html INS_PLANS に4段目を追加（オーナー判断・現状は寄せる方針）。

### 🟢 承認フロー完成（2026-07-04）＝依頼→Slack→管理画面で承認/却下→顧客LINE通知＋マイページstatus反映
オーナー指定フロー実装済み。**オプション/補償/キャンセルの依頼**は即反映せず承認制：
1. 顧客がマイページで依頼→`mypage_changes`(status=requested)＋Slack通知。**構造化target**を`payload`(jsonb・新設列)に保存（補償=`{insurance:"NOC"}`、オプション=`{opt_c,opt_j,opt_b}`）。
2. スタッフが`my-admin.html`「🔔変更依頼」で[承認]/[却下]→ handyman-mypage の**`decide`アクション**（本体ログインJWTを`/auth/v1/user`で検証・change_id+decision）。
3. 承認時に**実反映**：補償→reservations.insurance＋tasks.insurance／オプション→reservations.opt_*＋tasks.changed_json._optB/C/J／キャンセル→reservations.status=cancelled＋fleet削除＋tasks墓標(deleted=true)。method(自由記述)は自動反映せず手動。
4. **顧客へLINE通知**（line-push新アクション`mypage_decision`＝日付ガード回避・not-cancelled/userid/test_modeは維持・未連携は`no_userid`で安全スキップ）。反映前(有効なうち)に先に送る。
5. **マイページ反映**：my.htmlに「📨ご依頼の状況」カード（requested→確認中/approved→承認・反映済/rejected→見送り）。
- 認証：不正JWT=401・処理済み再承認=409。`mypage_changes`は authenticated に SELECT/INSERT/UPDATE 付与済（旧「未実施」解消）。秘密＝handyman-mypageに`LINEPUSH_SECRET`をsecrets登録→内部でline-push呼出（クライアントに出さない）。E2E検証済(DY00000000907・LINE未連携で安全)。

### 📖 マイページ仕様＝マニュアル（my-admin.html 内・2026-07-05）
マイページの仕様書は **my-admin.html ヘッダー「📖 マニュアル」→モーダル**（`openManual`/`renderManual`）に常設。**👤お客様側**（閲覧範囲・変更受付ルール表・依頼後の流れ）と**🧑‍🔧スタッフ側**（🛠対応センター・ボードの見方・🔔承認/却下=実反映+LINE・ステータス・カルテ・トリガー・注意）に分離。**🔴 都度更新ルール（2026-07-05 オーナー指示・絶対）＝マイページ関連の修正/対応をするたびに、同じコミットで renderManual(USER/STAFF文言)も必ず更新する**（画面の使い方が変わらない内部バグ修正は除外可）。Definition of Done。

### 🕘 履歴＋🔍 整合パトロール（2026-07-05）
- **最新の履歴**（ユーザー側my.html・管理側my-admin）：誰が・何を・いつ（日単位）。lookupが`history[]`を返す＝`mypage_changes`＋**OPタスクchanged_json由来**（`_ssPlaceAt`=お客様フォーム/`_manualPlaceAt`=担当編集/`_placeSource=customer`=マイページ）を統合。**mypage_changesが0でも既存活動で埋まる**（「履歴が出ない」の解決）。my-admin「🕘履歴」はPLACE_MAP(確定時刻が正確な場所)＋CHG統合。文言はsource別（お客様がフォームで/お客様が/担当が）。
- **整合パトロール**＝「予約情報(reservations)＝マイページ＝OPシート が常に同じか」を保証する仕組み。3画面は同じ元データ（reservations＋tasks）から解決するので、**食い違いの根＝reservationsとtasksの値が両方あり競合している予約**を全件検出。`patrol`アクション（staff_token or cron `x-cron-secret`=CRON_SECRET）。my-admin「🔍整合」ボタンでオンデマンド（✅全一致/⚠️相違N件・タップで該当予約へ）。**cron `mypage-consistency-patrol` 毎朝6:00JST→相違ありでSlack強制発報**（監視アラートは`slackPost`でMYPAGE_SILENTミュート対象外）。実測138件→一致109/相違29（時刻/場所の予約vsOPズレ）。空欄側は自動フォールバックで一致扱い＝相違に含めない。
- ⚠️ patrolは検知のみ（自動修正しない）。相違はmy-adminで人が確認・修正。将来audit_log/revert基盤と連携可。

### 🔗 マイページ書込は「唯一ルール」順守（2026-07-05・監査基盤連携）
マイページの全書込は「既存を丸ごと再保存しない／人間入力を上書きしない／顧客は許可項目のみ・センシティブは承認制」に従う：**update＝顧客が変えた特定フィールドのみsbPatch＋patchTasksSpkはchanged_jsonを`{...cj}`マージ（他キー保持）**／request＝行追加のみ（reservation不変）／decide＝特定フィールドのみ・actor記録。**顧客はDB資格情報を持たずEdge Function(token)経由のみ＝関所はEdge Function**（許可項目以外は物理的に書けない）。source識別＝`mypage_changes.source`(customer/staff)・tasks`_placeSource`・`actor`。全書込はaudit_log(DBトリガ)に記録・ハッシュ連鎖で改ざん不能。

### 📣 マイページ通知の宛先＝#sapporo_user_action（2026-07-05）
マイページ関連の**全Slack通知（変更即時/依頼/キャンセル/承認却下/整合アラート）は `#sapporo_user_action`（C0BER0YC6AK）**へ。handyman-mypageの`slackPost`が`SLACK_MYPAGE_CHANNEL`(=C0BER0YC6AK)を使用（keydrop系のSLACK_KEYDROP_CHANNELとは分離）。**ボット＝`sns_auto`(U0AP367KETH)。このチャンネルへ手動`/invite @SNS Auto`が必要**（未招待だとnot_in_channelで飛ばない）。⚠️変更/依頼/キャンセル/承認の通知は`notifySlack`経由＝**MYPAGE_SILENT=1の間はミュート**（開発中）。本番で飛ばすにはMYPAGE_SILENTを解除。整合アラート(patrol)は`slackPost`直＝ミュート対象外で常時発報。

### 🎯 my-admin カテゴリ定義 確定（2026-07-05 オーナー確定・これが正）
分類が曖昧で churn したため確定。**大原則＝顧客がフォーム/マイページで情報を入れたら正常（場所差・時間差は顧客/スタッフの調整＝正常）。時間差は常に正常＝異常判定に一切使わない。**
- **⚠️ 異常値・要確認＝次の3条件のみ**（`stAbnormalConf`）：①**非HPでフォーム未回答なのに場所がある**（出所不明。ただしOP場所が`_ssPlace`＝フォーム由来なら回答済み扱いで除外）②**HPなのに場所がない**（HPは予約時に場所が入る）③**場所があるのにOPシートタスクが空**（フォーム/予約に場所ありなのに生成済みd-/c-タスクの場所が空＝同期漏れ）。**値の食い違い(予約≠OP)や時間差は異常値に含めない**。
- **⑥ 場所情報なし**（`stMissing`）＝フォーム未回答 かつ **予約情報/フォーム(SS+エルメ)/OP のどこにも場所が無い**（真に未確定）。「場所があるのに場所情報なしに落ちる」は禁止（あれば②か①へ）。
- **① 情報相違(SS≠OP)**＝フォーム回答の場所とOP場所が明確に別物（`placeConflict`）。
- **フォーム回答済み判定`stInfoProvided`**＝SS_MAP(ライブGoogleシート＋`spk_line_links`)に回答あり OR 顧客mypage変更 OR **OPタスク場所が`_ssPlace`(フォーム由来)**。←最後の条件が重要（これが無いと「実はフォーム済」を出所不明と誤検知）。
- 各カテゴリ定義はmy-adminのボード見出し**ⓘタップでポップ表示**(`defPop`)。ADMIN_VER v2.5。実データ検証：異常値は31→13→3に収束（誤検知の時間差・値相違・フォーム済を除外）。

### 🧪 マイページ ダミーテスト予約（2026-07-05・オーナー自己テスト用）
- `reservations` id=**ZZMYPAGETEST0705**（テスト マイページ・B・楽天・2026-07-10〜12）＋`spk_line_links`でLINE宛=**オーナーtest_user_id(Ua1f5217…)**に固定＝本物の顧客に飛ばない。mypage URL＝`https://nosh2318.github.io/spk-task/my.html?t=1bc38c91-9cfc-4404-9909-3ad88e9eb4f6`。初動LINE送信済(line-push mypage_initial)。**テスト後の掃除**＝`delete from reservations where id='ZZMYPAGETEST0705'`＋`delete from spk_line_links where resv_no='ZZMYPAGETEST0705'`＋`delete from mypage_changes where reservation_id='ZZMYPAGETEST0705'`＋生成されたtasks/fleet。

### 🛠 対応センター（my-admin「🛠 対応」タブ・2026-07-05・本セクションのメインTODO）
オーナー要望「Slackのテキストだけでは何をすべきか分からない→アラート→確認→対応→正常化 までを1画面で導く」。my-adminヘッダー「🛠 対応」で対応センターを開くと、要対応の事象を各**【事象／簡易説明／対応(ボタン)／結果】**で表示：
- **整合の相違**（patrol由来・予約情報≠マイページ/OP）→ ワンボタン「マイページ・OPの値で統一（推奨）」or「予約情報の値で統一」→ Edge Function **`resolve`**（staff認証・reservation_id/field/value/target=resv|op）で書込→即一致＝正常化。「結果」に✅表示。
- **お客様の依頼**（mypage_changes requested）→「承認して反映＋LINE」「却下＋LINE」（decide連携）。
- Slackアラート文に対応タブURLの導線を追加。**MYPAGE_SILENT=0に解除済＝変更/依頼/キャンセル/承認の通知も本番化**（#sapporo_user_action・要ボット招待）。

### Edge Function アクション
- **resolve**（staff_token・reservation_id・field・value・target=resv/op）：整合相違を指定値で統一（対応センター用）。
- **patrol**（staff_token or x-cron-secret）：reservations↔tasks整合を全予約突合→相違レポート＋Slackアラート（監視・上記）。
- **decide**（staff_token＝本体JWT・change_id・decision）：承認/却下→実反映＋顧客LINE＋Slack（管理者用・上記）。
- **lookup**（token）：予約表示＋傷チェックgate＋追跡状態＋直近変更。**場所/時間はOPタスク(d-/c-)から解決（上記）**。傷チェックは**出発日8:00解禁**（`lend_date<today || (==today && hh>=8)`）、fleet→vehicles.plate_no→vehicle_twins.display_label(ilike)→share_token でURL解決(best-effort)。追跡は kd_status(delivering/collecting)＋kd_track_token返却。
- **🕒 update 受付ルール（2026-07-04 オーナー確定・変更）**：**DEL(お届け)＝24h前まで即時／24h以内は承認制**（即反映せず mypage_changes に field=del_place/lend_time・status=requested・payloadで記録→Slack→管理画面で承認→`applyPlaceTime`で反映＋顧客LINE）。**COL(回収)＝2h前まで即時／2h以内は受付終了(`lineOnly`)**。DEL承認・COL即時の混在時はDELのみ依頼化・COL即時。判定はDEL=lend/COL=return日時で別(`withinHours`)。応答：即時=`{ok,updated}`／DEL承認待ち=`{ok,pendingApproval,requested}`／COL2h内=`{lineOnly}`。即時反映は`applyPlaceTime`(reservations＋mypage_locked＋監査ログapplied＋`patchTasksSpk`)。decideは del_place/col_place/lend_time/return_time の承認適用に対応。旧「両方24h一律lineOnly」は廃止。
- **request**（req_type=option|method|insurance・即反映しない依頼）：mypage_changes(status=requested)＋Slack。同内容の重複依頼はブロック。
- **cancel_request**（即削除しない＝OTA安全側・スタッフ承認制）：mypage_changes(field=cancel,status=requested)＋Slack。再申請防止。

### tasks同期＝OPシート反映（`patchTasksSpk`）
札幌tasks: **PK=`_id`（d-/c-/w-接頭辞で種別）・reservation_id列で紐付け・changed_jsonはtext型**。d-=お届け/c-=回収。変更を `place`/`time` と **`changed_json._ssPlace`/`_ssTime`/`_placeSource="customer"`** に書き、memoに「✅変更済(MM-DD HH:MM):項目」マーカー。OPシートは `(_placeSource==="manual"?place:(_ssPlace||place))` を表示＝**mypage変更が正しく出る**。

### 🛡 保存の永続性（上書きされないか）＝検証済✅（オーナー最大の懸念）
- **実データE2Eテスト（RC12461205360393577で実施→原状復帰済）**：mypage update→reservations(del_place/del_time/lend_time/lat/lng/locked)＋tasks d-(place/time/memo✅/`_ssPlace`/`_ssTime`/`_placeSource=customer`)＋mypage_changes 2件、すべて反映確認。
- **アプリのタスク再生成protect(`_mergeUserInput` index.src.html L407-408) が `_ssPlace`/`_ssTime` を必ず焼き戻す**＝mypageはこのスロットに書くので**再生成でも保護される**。reservations.del_placeは非空になるのでGASも上書きしない(空欄のみ補完＋2026-06-07「予約番号完全一致以外は場所書かない」)。
- **mypage変更はEdge FunctionがDBに確定書込してからアプリが読む**＝「当日洗車が消える」等の*ローカル未保存編集×15秒自動リロード*競合(2026-07-03 SPK v4.7.359で修正)の**外側**にいる＝より安全。
- 3重の砦：①上書きしない(_ssPlace保護)②消えても復元(mypage_changes)③消えたら気づく(管理コンソールの食い違い警告＝未実装)。

### 表示・変更UI（my.html・全て札幌確定値）
- ヘッダー「**<予約者名> 様 専用ページ**」（r.nameで特定・タブtitleも）。heroに**車両クラス画像**（`images/class_A〜H.png`＝spk-task同梱・https同一オリジン。**keydrop.jpは301→httpでmixed-content不可なので同梱必須**）。
- **場所変更＝KEYDROP方式の地図ピッカー**（Google Places Autocomplete候補＋ドラッグ/タップピン＋逆ジオコード・GMAPS_KEY=`AIzaSyCoX1EyEx-N5A0r4vRzC1KmVp3T29HILbI`・見つからねば自由入力送信可）。座標も保存。
- **時間変更＝項目ごと個別**（お届け時間/回収時間をプルダウン・**日付は固定**）。お届け/回収は**日付+時間(曜日付)**表示。24h注記はアクセント色バナーで強調。
- **オプション変更依頼**＝現在→変更後プルダウン（初期値保持・右に差額概算）。**札幌＝チャイルドシート¥1,000/ジュニアシート¥500の2種のみ・実写真(`images/opt_child.png`/`opt_junior.png`)**。USBは札幌削除。
- **補償変更依頼**＝プルダウン＋プラン説明カード（正式・税込/24h）：**基本プラン(保険付き)¥0／基本+免責補償¥1,100／基本+免責+NOC補償(安心ワイド)¥1,650**。
- **キャンセル申請**＝規定表提示→同意チェック→申請→「🕓キャンセル申請済み」＋Slack。**正式規定：7日前まで無料／6-3日前20%／2日前・前日30%／当日以降50%／台風等不可抗力(北海道着 航空便欠航証明)は無料**。※札幌は受渡方法変更なし(お届け固定)。
- **傷チェック**＝出発日8:00解禁(それまで🔒準備中でぼかし)。**追跡＝このページ内にiframe埋込表示**（別URLに飛ばさない=完結。開始前は本番配色(ネイビー#0F1F45×ゴールド#FABE00×緑#0e9f50)の見本プレビュー・🚚アニメ・「あと約8分」・「今いる場所を共有」）。`trackUrl()`＝`https://keydrop.jp/handyman-{delivery|collection}-guide.html?r=&t=&embed=1`。

### 想定フロー（オーナー合意）
予約→LINE登録→**最初のエルメフォーム入力でuserId取得**（既存`{store}_line_links`）→**mypage URL(my.html?t=token)を`line-push`で自動送信**→顧客がmypageで閲覧/変更→OPシート反映・保存（上記の砦で保護）。LINEは以降も「マイページに更新があります＋URL」の通知ハブ。

### 残タスク（次セッション）
1. **管理コンソール my-admin.html**（変更/依頼一覧・承認/却下・場所食い違い赤警告・⚙️トリガー設定＝spk_line_config: damage/track/thanks_enabled・test_mode・test_user_id・lead_min）。mypage_changesにauthenticated UPDATEポリシー追加。
2. **mypage URL の LINE自動送信**（userId取得時/予約確定時トリガー）。
3. **NHA展開**（nha_reservations/nha_tasks・日本語列・区分PUB/DEL/来店・BD/BDB/COL/返却で表示変更・**BUS運行時刻表(bus.html)も設置**・クラス画像は`_nha`）。
4. cancel_request承認＝reservations status=キャンセル＋fleet/tasks除去の実処理（KEYDROP cancelを参照）。

## 📱 2026-07-03 LINE自動送信システム（傷チェック/位置追跡）札幌＋那覇 本番稼働（このセッション）
**お客様への各種URLをLINE公式アカウントから自動送信する仕組み。エルメ手動コピペを自動化。札幌(@730kyhwl)・那覇(@466dbckq)＝別LINEアカウント・別Supabaseテーブルで並走。**

### 全体構成（Edge Function＝ckrxttbnawkclshczsia／全て `--no-verify-jwt`・store対応 spk|nha）
- **`line-push`**：予約番号→userId解決→LINE push→ログ。挨拶文付与／設定ON-OFF／テストモード（宛先=test_user_id・未設定なら送らない）／**誤送信ガード**（予約不在・キャンセル・過去日・番号不一致は送らずログ）。body`{secret,store,resv_no,action,message}`。token=`LINE_CHANNEL_TOKEN`(spk)/`NHA_LINE_CHANNEL_TOKEN`(nha)。**KEYDROP予約も送信対象**（linksにuserIDあれば送る・無ければno_userid＝安全）。
- **`damage-check-cron`**：pg_cron `line-damage-check`(spk `{}`)/`line-damage-check-nha`(`{"store":"nha"}`) 各5分。**札幌=DEL/30分前**、**那覇=PUB・DEL・来店/60分前**。出発時刻(時間欄)の lead分前になったら傷チェックURL(vehicle_twins.share_token)をline-push経由送信。既送信(sent)は除外。x-cron-secret=`CRON_SECRET`。
- **`line-track`**：driverページ「📡位置送信を開始」から`{r,d}`。**予約IDがreservations→札幌/nha_reservations→那覇で店舗自動判定**（driverページ`handyman-driver.html`は共有）。kd_status delivering→track_del(delivery-guide)/collecting→track_col(collection-guide)。line-push経由。
- **`line-links-import`**：CSVアップローダーから`{store,rows}`。ログイン済みスタッフJWTを`/auth/v1/user`検証→`{store}_line_links`へupsert（"test"含む/空は除外）。

### DBテーブル（spk_*/nha_* 同構造）
- **`{store}_line_links`**：`resv_no`(PK・reservations.idと完全一致で突合)/`line_user_id`(U+32hex・**チャネル毎に別物**)/cust_name/media/answer_id…。エルメ受付フォーム回答CSV由来（札幌367・那覇1443件）。**送信可否の照合キー＝予約番号**（userIdは宛先であって照合キーではない）。
- **`{store}_line_sends`**：送信ログ。status=`sent`(自動)/`no_userid`/`skipped`(cancelled/past/disabled等)/`failed`/**`manual_done`**(スタッフ手動対応)。authenticatedはmanual_doneのみinsert可(policy)。
- **`{store}_line_config`**（id=1）：`damage_enabled`/`track_enabled`/`test_mode`/`test_user_id`/`lead_min`(spk30/nha60)。**現在：両店とも damage=ON,track=ON,test=OFF（フル本番）**。

### アプリUI（SPK index.src.html / NHA index.html.bak・両build.js）
- **📱OK/手動バッジ**(`LineStatusBadge`・`window._lineLinkMap`=`{store}_line_links`のresv_no有無から導出)：TOP個人別サマリー・OPマスター・OPスケジュール(サブタブ)。緑OK=自動送信可/赤手動=未登録or番号不一致。
- **🩹傷チェック送信リスト**(`DamageSendList`)：TOP「日常業務」アイコン→専用タブ。本日時系列(札幌DEL/那覇PUB・DEL・来店)、担当名・📱OK/手動、自動=✅送信済(ログ連動)、手動=[📋コピー]→[✅対応](manual_done記録・全端末共有)。
- **出発/回収ボタン**：📱OK客=「位置送信開始で自動送信・貼付不要」/📱手動客=「コピーして貼付」に条件分岐（二重送信対策）。
- **📱LINE紐付け更新**(アップローダー`line-csv.html`・各store originに配置)：TOP設定。エルメCSVをアップ→`{store}_line_links`更新。**毎日CSV更新が必要な理由＝userIDはエルメのCSVエクスポートにしか無い**（自動連携シートは回答者ID(内部番号)のみでLINE送信不可・Webhook/API無し）。

### 位置追跡ページ（hdm-car-delivery＝keydrop.jp・静的）
- driver=`handyman-driver.html`(赤)/`keydrop-driver.html`＝スタッフ位置送信・「📡位置送信を開始」に`line-track`フック(`__trackLineSent`・共有＝両店効く)。顧客追跡=`handyman-delivery-guide/collection-guide/track/handyman-track.html`(橙)。**全ページに「画面を開いたままに（閉じると位置共有が止まる）」注釈バナー`<!--KEEPOPEN-->`**。

### 運用・鍵の在り処
- Supabaseデプロイ：PAT=`~/.config/keydrop/sb_token`(sbp_・30日失効・失効時は https://supabase.com/dashboard/account/tokens で再発行)。`SUPABASE_ACCESS_TOKEN=$(cat) ~/.local/share/supabase/supabase functions deploy <fn> --project-ref ckrxttbnawkclshczsia --no-verify-jwt`。SQL/APIキー取得はManagement API `/database/query`・`/api-keys`(curl)。
- secret値保管：`~/.config/keydrop/{linepush_func_secret,linepush_cron_secret,line_token(spk),nha_line_token}`。LINEトークンは`/v2/bot/info`で正当性確認可(spk=@730kyhwl/nha=@466dbckq)。
- **LINE userIDはチャネル毎に固有**（札幌のuserIDは那覇で使えない）。オーナー那覇テスト宛先=`U2a777a5fc6310a32e4f93582515a490d`(nha_line_config.test_user_id)。
- テスト送信は必ずオーナーのそのチャネルのuserID宛のみ（勝手に顧客へ送らない・強く指導された）。実DELでのテストは一時的にmapping/kd_*を差し替え→即復元。
- **残**：BUDDICA(高松)展開はBTのLINE公式/エルメ＋別Supabase(ggqugvyskyiblxiycpci)対応が必要で保留。

### コード正本
- Edge Function正本：`~/spk-task/line_auto/{line-push,damage-check-cron,line-track,line-links-import}/index.ts`＋`schema.sql`＋`import_erume_csv.py`（デプロイ実体は`~/hdm-car-delivery/supabase/functions/`にコピーして deploy）。

## 📊 2026-07-02 稼働率の計算を「新統一式（実稼働ベース）」に全店全タブ統一（オーナー確定）
- **新定義（全店全タブ・恒久）**：`稼働率 = 予約(配車)日数 ÷（その月の日数 − メンテ/車検/点検/その他のブロック日）`＝**実稼働ベース**。分子=配車で埋まった日数(cancel除外)、分母=稼働フラグON車両の稼働可能日(月日数−メンテ日)。**メンテ等は稼働日にも稼働可能日にも数えない**（丸ごとメンテの車は分母から除外＝availV<=0でskip）。**車両別→クラス別→グロスは積み上げで完全一致**（クラス=車両合計・全体=クラス合計）。
- **旧式は廃止**：旧「分母＝稼働台数×月日数(メンテ込み)」は使わない。差は分母のメンテ除外のみ＝分子(予約日数)は旧snapshotと1日も違わない。
- **統一した箇所（式が7箇所に散っていた＝値ブレの元）**：①saveMonthlySnapshot ②解析タブA(dbMetrics) ③ダッシュボード(dashSummary) ④年間推移(dashYearly) ⑤TOP稼働率(LeadTimeWidget utilStats) ⑥車両ランキング(utilByM→ClsRevCard/ClsUtilCard/VehicleProfitTable)。年モードdashKpiは④を合算＝自動整合。ts-report(openFullMonthlyReport_)はdashKpi(新式)を使うので整合(fallbackのactiveVehs.length*dimはdashKpi無し時のみ＝実運用は通らない)。
- **snapshot経由で価格タブ(price-optimizer)・収支シミュ(sim)・売上予測(forecast)・ClsUtilCardも自動統一**（monthly_snapshotsを読むだけ）。反映は各店「📸 全月を再記録」を1回押す。
- **maintデータの取り込み場所と型に注意**：ManagementTab(dbMetrics等)は`loadDbAll("maintenance"/"nha_maintenance"/"bt_maintenance")`＝**snake_case**(`start_date`/`block_type`)。LeadTimeWidgetはappの`maintenance`state＝**camelCase**(`startDate`/`blockType`/`vehicleCode`)。snapshotは`sb.from(maintTbl)`直fetch＝snake。`block_type='maintenance'`のみ分母除外(partner_reservedは残す)。nha_maintenance/bt_maintenanceはblock_type列無し＝全て除外対象。
- **検証（curl+Python `/tmp/canon_util*.py`・両店実データ）**：札幌グロス 2026 3月33/4月44/5月35/6月37% ／ 那覇 3月61/4月62/5月50/6月50%(6月=当月途中)。⚠️NHAは予約2000超→PostgREST 1000行上限でページネーション必須(でないと過少)。
- バージョン：**SPK v4.7.339 / NHA v3.5.229-NHA(~/Desktop/AI/naha-project) / BT v1.0.101-BT**。BTはbt_maintenance・別Supabase・リリース前(データ蓄積後に有効)。
- 実装Tips：解析A/ダッシュボード/ランキングは`dbMaint` stateを追加しPromise.allにmaintenance fetch追加＋useMemo depsに`dbMaint`追加。utilByMは`sub==="analytics"`のIIFE内(useMemoでない)＝dep不要。NHA utilByM/ClsRevCardは`inactiveCodes`版(SPKと微差)。

## 🅿️ 2026-07-01 駐車場 車両位置シャッフル/重複 根本修正（v4.7.336）＝再発を実データで特定
- **症状**：退社前に整えた駐車位置が翌朝ごちゃごちゃ（過去に戻る/シャッフル）。洗車済/未洗車も混ざる。以前v4.6.55で対処も再発。
- **実データで確定**：parking_state(別Supabase rkrvjpipvpybkmqadmrb・id=1)を直読み→**同一車「ノア5398」がNo.260とトラストパークに"二重駐車"**（物理的にありえない）。No.260への入庫ログ無し＝ユーザー操作でなく**マージが古い配置を復活**。history時刻も19時台と08-09時台が混在＝別セッション/古い端末の状態が混ざっている。**DB保存自体は動作（保存失敗ではない）**。
- **根本原因**：`merge3/mergeSpots`（3wayマージ）が**spot単位で独立に local/remote を解決**し、「1台=1枠」の大域制約を守らない。古い端末(stale lastSyncedRef)の配置が復活し、同一carIdが複数枠に重複→シャッフル。
- **修正(v4.7.336)**：`merge3`に **`dedupeSpots`（1台=1枠 強制）** を追加。マージ後に同一carIdが複数枠に出たら、操作中端末(local)の配置を最優先で1つ残し、他はcarId=nullで除去。現DBの重複(ノア5398)もREST PATCHで解消済（No.260解除・トラストパーク残す）。
- **教訓**：**whole-doc＋spot単位マージは「1台=1枠」等の大域不変条件を壊す**。エンティティ独立マージには必ず**不変条件の後処理(dedupe)**を噛ませる。理想はper-row化だが今回はdedupeで実害除去。
- **未対応(要監視)**：洗車(washMap)は per-key merge(mergeMaps)で位置ほど壊れないが、同時編集での revert 余地あり。washTime は "M/D HH:MM"(年無し/非ゼロ埋め)で時刻比較が不安定→タイムスタンプ解決は書式修正が前提。再発するなら着手。**運用回避：駐車操作は極力1端末で**（複数端末同時編集がマージ脆弱性の根）。


## 🪪 2026-06-22 免許証アップロードの保存先＝Googleドライブ(GAS経由)に統一（那覇/札幌 店舗別フォルダ）
- **背景**：免許証/パスポートは**貸渡終了から2年間の保存義務（国交省通達）**。無料Supabase Storage(1GB)では那覇の量(2年で約1〜2GB)が入らず、かつ法令で消せない→**自動削除案は不可**。オーナー「有料化しない」「那覇も札幌も同じドライブにファイルを分けて保存」。
- **構成**：1つのGAS「**HANDYMAN 免許証保存**」(Webアプリ・実行=自分/アクセス=全員) を那覇/札幌 **両方の license.html が共用**。`doPost`で `store`(nha/spk)→ Drive `HANDYMAN_免許証/那覇 or 札幌/<予約番号 氏名>/<label>_<ts>.jpg` に保存。本体GASコード＝`~/Desktop/HANDYMAN/license_drive_upload.gs`。
- **/exec URL**（本番デプロイ済・GET疎通&POST書込テスト合格）：`https://script.google.com/macros/s/AKfycbyR29DN3sCW2addxE8_Elg2tvCPaopPJPNLlc4JNbQTXemwwVQkbaDER-blieKdMy0P/exec`。SECRET=`hdm-lic-7c3f9a21`（license.html `GAS_LICENSE_SECRET` と一致必須）。
- **license.html 改修（NHA/SPK 両方・standalone＝buildなし/push即反映）**：旧Supabase Storage(`licenses`/`licenses_nha`バケット)POST → `fetch(GAS_LICENSE_URL,{body:JSON.stringify({secret,store,resId,custName,label,fileName,mime,b64})})`。**Content-Type未指定=text/plainでCORSプリフライト回避**（GASは`e.postData.contents`をJSON.parse）。`GAS_LICENSE_URL`空なら保存せず「URL未設定」案内（誤って空でデプロイしてもエラーで止まるだけ＝安全）。
- **🔑 Drive保存=容量問題ゼロ**：DriveはGoogleアカウント容量(大)。2年保存でも実質心配なし。Supabase Storageは「500枚≒1GB÷2MB」感覚ですぐ満杯＝免許証には不適。**今後の画像系で2年級の長期保存が要るものはSupabaseでなくDrive(GAS)へ**。
- **GASデプロイは私(CLI/Slack)単独不可**＝オーナーがGASエディタでWebアプリ デプロイ→/exec URLを受領して license.html に設定する運用（service_roleキーは手元に無い／バケット作成も同様にSQL Editor or service_role必要）。
- **②機能(アイコンUP/プリフィル/裏面任意/インバウンド)＝NHA/SPK両対応済(2026-06-22)**：NHAはSlack omni v3.5.188で実装。SPKは元々 個人別タスクサマリーのDEL/COL行に🪪免許証ボタン(license.html?id&name プリフィル)＋裏面任意(表面1枚でOK)があり、**インバウンド(パスポート/免許証)切替を license.html に追加(SPK 0f52161)**＝那覇と仕様統一。リリース案内を #handyman_development(C07B5G3PV7C) に投稿済(ts=1782103425.331669)。
- **残**：①SPK旧Supabase `licenses`バケットの過去分はDriveへ未移行（残置・今後ぶんはDrive）。②Drive `那覇/札幌 の TESTDEL 接続テスト/test.jpg` は疎通テストのゴミ＝オーナー削除可。

## 🧾 2026-06-22 受領請求書 ①本社hqの全店漏れを完全エリア分離 ②invoice_managerに会計/車両連携追加
- **背景（オーナー指摘・スクショ invoice_manager）**：①本社で登録した請求書が全店に出る ②invoice_manager(本社マスターツール)に「会計へ/車両へ」連携が無い。
- **① 完全エリア分離**：各店APP内タブ `ReceivedInvoicesTab.reload` の読込を `.in("store",[store,"hq"])`→`.eq("store",store)` に変更（SPK index.src.html / NHA index.html.bak 両方・同構造）。**本社hq請求書は本社/invoice_managerでのみ表示・各店には出さない**。旧仕様の「自店＋hq双方向同期」はオーナー判断で廃止。本社が特定店の請求書を登録したい時は invoice_manager の登録フォームでエリアを nha/spk にして登録する運用。SPK v4.7.306 / NHA v3.5.187-NHA。
- **② invoice_manager 連携追加**（`~/Desktop/HANDYMAN/invoices/invoice_manager.html`・file://・git管理外＝保存だけで反映）：各行に💳会計へ/🚗車両へ＋連携済みバッジ＋解除。**連携時に店舗(nha/spk)を毎回選択**（hqには会計テーブルが無いため）。会計＝`{store}_accounting` に id=`acct_inv_{id}` でupsert（in-appと同一カラム）。車両＝`logs`(sapporo)/`nha_logs`(naha) に id=`_loginvId`。
- **🔑 anon書込のRLS非対称（検証済）**：invoice_managerはanonキー。`spk_accounting`/`nha_accounting`はanonでSELECT/INSERT/UPDATE/DELETE可＝**会計連携は完全動作**。一方 `logs`/`nha_logs`/`nha_cars`/`vehicles`は**anon書込401・SELECTも空(RLS)**＝**車両連携はauthトークンがある時のみ有効**（file://は基本anon＝🔒無効表示＋「各店APPタブから連携を」と案内）。車両連携をinvoice_managerでも使うには logs/nha_logs のanonポリシー緩和 or ログイン済オリジン配置が必要（オーナー判断・未実施）。
- **🔁 鉄則**：受領請求書の `ReceivedInvoicesTab` はSPK/NHA同構造（NHAは tables=nha_accounting/nha_logs/nha_cars・store_id=naha、SPKは spk_accounting/logs/cars・store_id=sapporo）。表示/連携の修正は必ず両店横展開。

## 🛡 2026-06-21 タスク消失（読込失敗時の自動再生成）恒久対策＝3店横展開完了
- **真因**：通信瞬断/RLS/DB認証エラーで `fetchTasks` が一時的に空を返すと、`OPScreen.loadTasks` の「DBにタスクなし→自動生成」分岐が `generateTasks→upsertTasks` で既存タスクを**予約初期値で丸ごと上書き**し、スタッフ入力（担当assignee・手入力place/colPlace・time/returnTime・done・memo）を白紙化していた。「ずっと正常だったのに時間が経って突然リセット」の正体（CSV操作は無関係）。
- **3層防御**（SPK v4.7.305=3183c96 が先行確定 → NHA v3.5.186 / BT v1.0.100 へ横展開済 2026-06-21）：
  - 層1/2：`fetchTasks` がエラー由来の空に `_fetchError=true` を付与。`loadTasks` は `_fetchError` 時は**再生成・upsertせずLS表示維持のみ**（上書き根本回避）。
  - 層3：`upsertTasks(tasks,date,{protect:true})` 追加。再生成保存時にDB既存行を読み `_mergeUserInput`（+`_mergeMemo`）で担当/場所/時間/済/メモ/SS痕跡(_ssPlace/_ssTime)/_placeSource/_changed を**焼き戻してから保存**。
- **🔁 鉄則**：`fetchTasks`/`upsertTasks`/`loadTasks` は**3店(SPK=tasks・NHA=nha_tasks・BT=bt_tasks)同構造**。タスク消失系の修正は必ず3店横展開。NHA/BT は `_fromDbTask` が日本語カラム、NHA upsertTasksは件数/日付GUARDあり、BTは無し。
- **検出の限界（オーナーへの回答）**：同じ経路で**他日も気付かず白紙化された可能性はある**が、上書きは痕跡を残さず**過去分は自動検出不可**（タスク履歴を持たない）。今後は protect 焼き戻しで実質ゼロ。担当だけは履歴が無く自動復元不可＝直近日の担当は目視確認推奨。

## 🗓 2026-06-19 シフト一元管理ハブ shift-hub.html 新設（NHA/SPK/BT・7〜10月）＋ asanaタスク強化＋BTシフト試算→出勤簿
このセッションの成果物まとめ（次回はまずここを見る）。

### ① shift-hub.html（3店舗シフト一元管理ハブ）★新規
- URL: **https://nosh2318.github.io/spk-task/shift-hub.html**（spk-taskリポ・単一HTML・vanilla JS・buildなし）
- 目的: 那覇/札幌/高松の**シフトを1画面**で閲覧＋シミュ（7〜10月限定）。**各店APPが正本＝マスター。ハブは読み取り＋試算のみ（マスターに書き戻さない）**。
- **別Supabase2系統対応**: NHA/SPK=projA(ckrxttbnawkclshczsia)・BT=projB(ggqugvyskyiblxiycpci)。anonキーは両方コード内。
  - 認証: A=同オリジン(nosh2318)の既存ログイントークン再利用／B=ツール内ログイン(buddica)→`shifthub_tokB`保存。**BTトークンは自動更新されず1hr失効→`ensureFreshB()`でrefresh_token自動延長＋`_notExpired()`失効判定**（「接続済なのに空」事故の対策）。
- データ源（各店APPと同じ表）: staff= nha_staff / staff / bt_staff、shift= nha_shifts / shifts / bt_shifts（store列は無視・全件）。
- 2タブ: **マスター(実態・編集不可ミラー)** / **編集(シミュ)**。編集はセルタップで 空→●→公→希→有→出。
- **人件費試算＝アルバイトのみ**（正社員は時給/時間欄を出さない・集計除外。type==='アルバイト'判定。BT正社員はhourly_wage=1100が入るので type で厳格化）。人ごと**時給×勤務時間**を `simCfg`(localStorage)で編集可・初期=実シフトから推定。
- **各日付の下にタスク数**＝🧽洗車/📋OPタスク。**未来月はtasksテーブルが未生成（NHAは直前生成で7月31件のみ）→確定予約から算出**: OP=DEL(貸出日)+COL(返却日)/洗車=返却台数。resTbl/sdCol/edCol（nha:start_date,spk:lend_date,bt:start_date）+OR filter。cancel除外。**両タブ常に実数・シフト編集で不変**。
- 各店/各人**🙈非表示**（人件費からも除外・localStorage `shifthub_hidden`）。ボタン: ↻最新に更新(マスター再読込・シミュ保持)/🔄全同期/👔正社員のみ同期(バイトのシミュ残し正社員だけ追従)/↩デフォルトに戻す(シフト+時給時間破棄)/💾保存。
- 注意: マスターは**自動リアルタイムではない**→本番変更は「↻最新に更新」で反映。ページは公開URLだがデータはログイン必須。

### ② asana/index.html（タスク管理ツール・vanilla・asana_tasksテーブル）強化
公開: https://nosh2318.github.io/spk-task/asana/ 。要SQL `asana/asana_approval_migration.sql`（approval jsonb列・RUN済）。
- **🔖承認フロー**: タスクに承認フラグ。**「承認待ち」ステータス=承認タブに集約**（status='approval'駆動）。左サイドに🔖承認の別枠（件数バッジ）。決済者がコメントバック＋[✅承認(→進行OK)][⛔却下(→保留)]。approval.stateに判定記録。
- **管理者でステータス(列)を全て追加/名前変更/並び替え/削除**（_statusesでSupabase共有・最低1列）。コメント削除・コメント投稿者欄は撤去(ログイン名自動)。
- タスク**📋複製**（子孫ごと→別プロジェクトへ移動）・**🔗関連URL**（attachments・複数）・**担当者で色分け**（personColor・アバター/担当名）・優先度でボード左ボーダー色。

### ③ BT shift-sim.html（高松シフト試算）→出勤簿反映
- 「📥出勤簿に反映」=表示中月のシフトを bt_shifts へupsert（●出勤＋開始〜終了時刻・staff各人に開始時刻欄追加）。「🧹反映を削除」=memo='試算反映'分だけ削除。名前一致した人だけ出勤簿に出る。**試算＝計画/出勤簿＝正本・連携はボタンのみ・自動同期なし**（画面明記）。v1.0.88-BT。

### ④ NHA/SPK 出勤簿 過去月が見れないバグ修正
- ShiftCalendar `canPrev=viewYM>todayYM`（逆）→`minYM`下限まで遡れるよう修正（NHA v3.5.160 / SPK v4.7.283）。両店同型。
- ⚠️ 並行注意: このセッション中 Slack omni がNHA/SPKを高速コミット中で NHA作業dirが `~/Desktop/AI/naha-project` に移動。コミット前に git fetch+log+status 必須。

## 🧾 2026-06-19 invoice_manager.html（受領請求書 一元管理ツール・file://）画像登録不能バグ修正
- **場所**：`~/Desktop/HANDYMAN/invoices/invoice_manager.html`（**ローカルfile://・git管理外＝保存だけで反映**・anon直叩き）。DB＝`received_invoices`（Supabase ckrxttbnawkclshczsia・public bucket `received-invoices`）。
- **症状**：6/18まで画像付きで登録できていたが6/19に「請求書が登録されない／画像が入らない」。6/19分はDBに1件も無し＝保存全体が失敗。
- **真因（確定・3つ）**：
  1. 🔴 **Storageアップロードは `Authorization` ヘッダー必須**。エラー実文 `headers must have required property 'authorization'`(HTTP400)。旧コードは「ユーザートークンがある時だけ Authorization を付与」→ file://でセッション無し＝未付与→400で画像が入らない（6/18までは別セッションのトークンが付いていて通っていた）。**修正：anonキーを必ず `Authorization: Bearer <token||_SB_ANON>` に付与**。※PostgREST(REST)はapikey単体でOKだがStorageはAuth必須、という非対称が罠。
  2. **新規登録モードで「📥登録する」ボタンが`display:none`**（`showReceivedForm`のelse分岐）＝**ファイルをアップロードした時(loadRvFile=1452)だけ表示**。ファイルなし手入力だと登録ボタンが出ず「何も動かない」。**修正：新規でも最初から登録ボタン表示**。
  3. **`_getSbToken`が期限切れトークンを無検査で送る**→操作中に失効すると401。**修正：expires_atチェックで期限切れはnull＝anonフォールバック**＋`_sbReq`を401/403でanon(apikeyのみ)再試行。
- **切り分け手法（有効だった）**：①anon直で `received_invoices` にPOST→201、Storageに `received-invoices` へPOST→200（**バックエンド正常を先に確定**）②`received_invoices`をcreated_at降順で見て「6/19分が無い＝client失敗」を確認③`file_url`列で「アップロード失敗 vs 表示だけ」を切り分け④保存関数を try/catch で全体包囲＋**失敗理由を画面alert表示**（F12不可環境向け）→ ユーザーがHTTP400文言を撮影できて一発確定。
- **教訓**：Supabase Storage は `Authorization` 必須（apikey単体不可）。anonツールでも `Authorization: Bearer <anonキー>` を必ず付ける（asana uploadImgは`authH()=Bearer token||SK`で元から正しい＝今回の良い手本）。「動かない」報告は alertで原因を画面に出させるのが最短（コンソール非対応端末多い）。


## 🗂 2026-06-17〜18 asana タスク管理アプリ（BUDDICA向け）大規模改修 — 承認ワークフロー / ステータスログ / 多人数同時 / モバイル

### 基本情報（覚える）
- **URL**: https://nosh2318.github.io/spk-task/asana/ （リポ内 `~/spk-task/asana/index.html`・**単一HTML・vanilla JS・build不要**。push＝即本番、GitHub Pages反映に数分）
- **DB**: Supabase `ckrxttbnawkclshczsia` の **`asana_tasks`** テーブル。1タスク=1行（per-row）。論理削除（`deleted=true`）。
  - 設定系は特殊行：`_members`/`_projects`/`_statuses`（`attachments`列に配列を格納）。
  - `logs`(jsonb)＝イベント配列（コメント＝typeなし / `type:'req'`作成 / `type:'status'` / `type:'assign'`）。`approval`(jsonb)＝承認状態。`attachments`(jsonb)＝関連URL＋画像（`{type:'img',url}`）。
  - RLS：anon でも read/write 可（社内ツール）。**ログイン不要**だが、期限切れトークンが localStorage に残ると401→空になる罠あり（下記）。
- **画像Storage**: バケット **`asana-attachments`**（public・2026-06-17作成済＋RLSポリシー適用済＝要対応ゼロ）。アップロードは `uploadImg`/`uploadImgs`、コメント/説明とも複数枚対応（`imgs[]`配列・旧`img`互換）。
- **構文チェック**: `python3`で`<script>`抽出→`node --check`（minifyではない素のJS）。

### 決済者ワークフロー（中核・このセッションで構築）
- ステータス流れ：**依頼/相談(consult) → 承認待ち(approval) → 対応中(doing) → チェック(check) → 完了(done)**。`doing/check`は`ensureStatus`でload時に常設化。
- **対応中＝承認とセット＝決済者のタスク**（進行中(go)とは別物）。
- 承認タブ＝**決済者タブ**。承認(openApproveModal→applyApprove)で**担当者割当モーダル→確認→承認＝担当アサイン**、status→**doing(対応中)**。
- **差し戻し(sendBack)**：承認待ち/チェックから依頼者へ戻す（status→consult・assignee→requester・コメント記録）。
- **対応完了(confirmComplete 'doing')**：確認＋コメント未入力なら追加確認→ status done だが setField がインターセプトして **doing→check（依頼者チェック・assignee→requester）** に回す。**最終完了(confirmComplete 'check')**で done。
- 承認タブ表示：**🗂ステージ列**（承認待ち｜対応中｜チェックの縦3カンバン・担当はカード表示・既定）/ **📋リスト**。担当者フィルタ(APPRASG)あり。
- **ボード/リストでは doing/check を単独列にしない**（`boardStatuses()`で除外）が、**「承認・確認」列に内包表示**（statusCol/listHtmlでapproval列が doing/check も含む）＝対応中タスクがボードから消えない。カードに🔧対応中/🔍チェックのステージチップ。詳細のstatpillsからもdoing/check除外（現状態のみ表示維持）。
- 承認カードに**カテゴリチップ・担当者プルダウン(点滅パルス・confirmAssignで「いいですか？」確認)・関連URL/画像のクリック表示**。

### アクティビティ＝ステータスログ化＋「朝の新着」
- `setField`が status/assign 変更を**監査ログに自動記録**（誰が/いつ/何→何）。`logEvent`は最新logs取得→追記で同時上書き防止。
- アクティビティ：種別フィルタ(🆕新着/👤自分/🔄状態/👤担当/💬コメント/✅承認)・各行に**現在の状態＋担当**・詳細パネルにタスク別タイムライン。
- **新着**：`ACT_SEEN`(localStorage)以降をNEW表示・「✓ここまで確認(既読)」ボタン・🔔活動にバッジ。朝に何が変わったか一発。
- **💬カウントは`!l.type`（実コメントのみ）**＝status/assignログを数えない（修正済）。

### データ安全・多人数同時（重要・このセッションの恒久対策）
- **取得失敗(null)時は画面を空にしない**（既存表示維持）。**書込3〜4回リトライ(sbPatch/sbPost)・新規はupsert(merge-duplicates)で二重作成防止**。
- **ポーリング10秒だが `load(true)`：変化なし(dataSig)or入力中(isEditing)は再描画しない＋スクロール位置保持(renderKeepScroll)**＝スマホで見ている場所が飛ぶ/コメント入力が消える問題を解消。タブ復帰・オンライン復帰で即同期。
- コメント/承認は`appendLog`/最新logs取得→追記で同時コメントの上書き防止。

### モバイル「タスクが出ない」真因（重要）
- 症状：PCは出るがスマホはタスク0。**原因＝localStorageの期限切れトークンで`authH()`が401→空**。
- 対策：`getTok`に**有効期限チェック**（`_exTok`）＋`sbGet`に**anon再試行フォールバック**。anon read/writeは可（検証済）。
- ほか：`.app`をflex縦＋`min-height:0`、ボード/ガント`min-height`フォールバック、**タッチ長押しドラッグ**(setupDnD・350ms・通常スワイプはスクロール)、no-cacheメタ。

### 🔑 デプロイ（push）の注意（2026-06-18）
- **これまでの push用トークン `pricing-agent-push-2`(classic) が2026-06-17に期限切れ**→ osxkeychain経由のpushが「could not read Username / Device not configured」で失敗。
- オーナーが**新classicトークン `spk push`(repoスコープ・No expiration) を発行**。当面 push は `git push "https://nosh2318:<token>@github.com/nosh2318/spk-task.git" main` の埋め込みURLで実行（**トークン値はCLAUDE.mdに書かない**。GitHub Settings→Developer settings→Tokens(classic)に保存済）。`handyman-omni-bot`トークン(repo,workflow・〜2026-08)も有効。
- IME変換確定Enterの誤送信は全入力に`!event.isComposing&&keyCode!==229`ガード済。

## 🧾 2026-06-08 受領請求書 一元管理システム（DB作成→TOP導線→複数内容→告知→マニュアル）

このセッションでの一連の作業まとめ（NHA/SPK 両店＋ローカルツール）。

### ① received_invoices テーブル＆Storage作成（PGRST205修正）
- 症状: 受領請求書登録で `PGRST205 Could not find table 'public.received_invoices'`＝**テーブル未作成**（受領請求書タブ v4.7.235 追加済だがSQL未実行）。
- 対応: `~/Desktop/HANDYMAN/invoices/received_invoices_setup.sql` を作成→**Supabase `ckrxttbnawkclshczsia` SQL EditorでRUN済**。テーブル＋index＋updated_atトリガー＋RLS(anon/authenticated両許可)＋Storageバケット `received-invoices`(public)＋objectポリシー。
- スキーマは2系統の和集合: ①APP内タブ(authenticated・`issue_date`使用) ②invoice_manager.html(ローカルfile://・anon・`tax_amount`使用)。列: id/store(nha,spk,hq)/received_date/issue_date/due_date/payee/description/amount/tax_rate/tax_amount/status/memo/file_url/file_name/file_type/created_at/updated_at。
- ⚠️ invoice_manager.html はfile://でanon使用→RLSはanonにも全操作許可（社内専用と割り切り）。

### ② TOP「会計」欄に📥受領請求書アイコン追加（NHA/SPK）
- SPK index.src.html / NHA index.html.bak の TOP会計セクション items に `{id:"recv_invoice",ico:"📥",l:"受領請求書"}` を追加（タブは既存・ショートカット導線を新設）。
- SPK v4.7.240 / NHA v3.5.131-NHA。

### ③ 受領請求書「内容」を複数行対応（＋内容を追加）
- 3つの入口すべてに実装: invoice_manager.html / SPKアプリ内タブ / NHAアプリ内タブ。
- 仕様: 「＋内容を追加」で行追加・「−」で削除・保存時は改行区切りでdescriptionに結合（空行除外）・編集時は改行で分割展開・一覧は `white-space:pre-line` で改行表示。
- ⚠️ スクショの登録フォームに＋が無い→**APP内タブ(ReceivedInvoicesTab・発行日フィールドが目印)とinvoice_manager.htmlは別物**。両方直す必要がある。
- SPK v4.7.242 / NHA v3.5.132-NHA / invoice_manager.html(ローカル・git管理外＝保存のみで反映)。

### ④ 一元管理の構造（覚える）
- データ共有: 全入口が同一Supabase `received_invoices`＋Storage `received-invoices` を共有。store列(nha/spk/hq)で分離。
- ビュー: **invoice_manager.html＝store横断の一元管理ビュー**（社長/会計事務所用）。各店アプリ内タブ＝その店のみ。
- 運用ルール（#handyman_development(C07B5G3PV7C)に告知済 2026-06-08）: 「請求書が届いたら→まず登録→マスターへ自動提出(統合)」。紙のまま放置禁止。

### ⑤ マニュアル
- NHA/SPK manual.html の「決済・会計」章に「📥受領請求書管理」の使い方セクションを追加（登録→提出フロー・複数内容・場所）。

## 🔧 2026-06-08 整備管理 クラス別内訳を車両マスター基準に統一（A2/B2欠落の修正）v4.7.241
- 症状: 車両→整備管理タブのクラス別内訳が A/B/C/S/F/H のみで **A2/B2(預かり/協力会社)が欠落**（距離管理は全8クラス出るのに不一致）。
- 真因: 整備管理(FleetManager統合ビュー)は**整備専用テーブル `cars`(DB.hm・9台)**で分類。`cars`はメイン`vehicles`(17台)と別管理で、PARTNER_TEST所有のA2/B2等が`cars`未登録＝表示されない。距離管理は`vehicles`直参照なので全クラス出ていた。
- 修正(index.src.html FleetManager): grpMap2を**マスター`vehicles`基準**に変更。各車をtypeで分類し、整備`cars`をplate(`v.no`=plate_no)で突合→突合した車はコスト/詳細編集可、未突合の車は「＋整備登録」の黄色行(タップで`DB.hm.saveCar`登録→詳細へ)。マスターに無い孤立`cars`も該当クラスに保持(既存データ消失なし)。管理車両数=表示総数(totalShown2)。
- ⚠️ in-app vehiclesは `.no`=plate_no・`.type`=クラス（DB raw列は plate_no、`no`列はNULL）。

## 💳 2026-06-08 じゃらん「支払い済みなのに未決済催促」恒久対策（gas-email-import-v2.gs・checkPaymentStatus）

### 症状
札幌じゃらん予約で、入金済みの顧客が未決済扱いのまま残り、催促が再送される（R02ZLN4R ヤマダ様¥30,300=6/5 Tap-to-Pay入金 / R0Q7UEF3 クロキ様¥16,300=5/27 card入金）。

### 真因（コードで確定）
- 顧客への催促メールは `checkSquareLinks`（`status in (new, link_created)` のみ）→ 一度 email_sent になれば顧客へ再送しない。**再送が起きる=リンクが再発行されて status が link_created に戻った**ケース。
- 入金自動検知 `checkPaymentStatus` は**スプシURL→決済リンクの「単一 order_id」だけ**を見る（`fetchPaymentLinkMap_`→`batchRetrieveOrders_`→`isOrderPaid_`）。同一予約番号で**リンク再発行や手動Tap-to-Payで別注文IDに入金**されると、その注文に tender が付かず**永久に email_sent のまま**残る。
- ※「GAS構築前の手動リンク」は jalan_payments に行が無く、顧客催促メール（jalan_payments駆動）の対象外＝**無害**（omni分析どおり）。ただし内部9時アラート `checkUnpaidAlert` はスプシ駆動なので、スプシに手動行があれば別途鳴り得る（今回の症状とは別経路）。

### 恒久対策（実装済・コミット b18107e）
`checkPaymentStatus` に**予約番号フォールバック**を追加（既存の単一order_id監視はPASS1として維持）:
- 新ヘルパー `searchPaidOrdersByResvNo_(token, resvNos, sinceIso)`：Square **SearchOrders API**でCOMPLETED注文をページ取得（最大8ページ・直近180日）。各注文の `line_items[].name`／`reference_id`／`note` に予約番号（決済リンク品目名「`札幌店 ◯◯様（予約番号） じゃらん事前決済 …`」に必ず埋まる）が含まれ、かつ `isOrderPaid_` が入金済を返す注文を `resvNo→{paid_at,order_id}` で返す（DESCで最新入金優先・予約番号は5文字以上で誤マッチ防止）。
- PASS1で未確認の予約番号だけを集めて突合 → ヒットしたら既存の副作用（スプシ列9=✅入金済/列10=入金日/列11=order_id・`jalan_payments.status=paid`・`spk/nha_accounting.paid=true`・店舗別Slack通知）を**そのまま発火**。Slack通知に「検知方法：予約番号突合」を付記。
- これで**リンク再発行・手動課金でも検知漏れゼロ**＋スプシも自動で入金記録（タケヤマ氏の「Slack通知後に記入」フローを壊さない＝GASがスプシ✅を書く既存挙動）。

### デプロイ（オーナー作業・トリガー型なので再デプロイ不要）
1. GASエディタ「札幌予約メール自動配車」→ `gas-email-import-v2.gs` を Cmd+A→Cmd+V→Cmd+S（クリップボードにコピー済）。
2. 次の15分トリガーで `checkPaymentStatus` が走り、R02ZLN4R/R0Q7UEF3 を含む email_sent 全件を全Square注文と再突合→隠れた入金も自動で✅化・スプシ更新・Slack通知。**スプシ手動更新は不要**。
- 貼付前でもDBは omni が paid 化済（id=63/60）。貼付後はスプシも自動同期されるため明朝の未入金アラートも止まる。

### Lesson
- 入金監視は「記録した単一 order_id」に依存してはいけない。**予約番号など業務キーで全注文を突合**するのが堅牢（リンク再発行・端末手動課金は order が分岐する）。
- 「催促が来る」報告は、顧客メール(jalan_payments駆動)・内部9時アラート(スプシ駆動)・入金自動検知(スプシ駆動)の**3経路を切り分ける**。

## 📍 2026-06-07 場所(DEL/COL)・時間 反映ルール確定：予約番号「完全一致」以外は空白で統一（オーナー指示）

### 決定
エルメ(LINE)受付フォーム → APP の場所・時間反映で、**予約番号が完全一致しない限り場所・時間を書かない＝空白にする**。曖昧一致(O↔0 補正・部分一致等)で別予約の場所/時間を当てに行かない。
- ⚠️ **場所(del_place/col_place)だけでなく時間(del_time/col_time・タスクの time)も同様に汚染表示に注意**。過去の場所CSV/フォーム取込で別件の時間が残ると、誤マッチで無関係な時間が表示される。場所と同じく「完全一致以外は空白／古い誤データは残さず空白に倒す」。
- 理由：どこまでを「一致扱い」にするかの判断が難しく、誤マッチで無関係な場所が入る方が危険（テキトーな場所より空白が安全）。
- フロー：**空白で表示 → スタッフがエルメ確認 →** ①回答あり＆予約番号ミス＝APPに手動反映／②回答なし＝ユーザーへ回答依頼を手動送信。
- 「場所未確定＝空白」の既存ルール（cleanPlace・場所CSV取込の空欄統一）と同方針。誤マッチ・古いゴミ場所は残さず空白に倒す。

### 実例（この決定の発端）
- R02ZLN4R ヤマダ シュンイチ（じゃらん・6/11 DEL / 6/12 COL・A/ヴェルファイア）。フォーム回答は DEL/COL とも「ソラリア西鉄ホテル札幌」だが、フォームの予約番号が **RO2ZLN4R（オー）** で実在 **R02ZLN4R（ゼロ）** と不一致。
- APP表示の誤場所（DEL=ホテルマイステイズプレミア札幌パーク / COL=札幌市西区西野7条9丁目4-13）の出所は **places テーブル（2026-03-07 作成・過去の場所CSV取込分の別件汚染）**。reservations 側は del_place/col_place="" の正常状態だった。番号不一致でフォーム値が当たらず、古いゴミ場所がそのまま表示されていた。
- 修正：reservations / places / tasks(d-/c-) の3テーブルを「ソラリア西鉄ホテル札幌」に手動訂正済（2026-06-07）。

### 今後（再発防止・実装は未着手）
- 場所反映系（フォーム/CSV/GAS）で予約番号が完全一致しなければ場所を書かない＝既存の誤場所も空白で上書きしない（残さない）。番号正規化(O→0)での自動マッチは**やらない**（オーナー判断＝手動運用に倒す）。

## 🛡 2026-06-07 オフィシャル予約 補償(免責)誤判定バグ修正（GAS 札幌+那覇 両店）

### 症状
札幌HP(オフィシャル)予約 LXT04768（太田勇様・Aクラス・6/7）が、メール本文は `免責補償制度(CDW): なし`（＝免責**未加入**＝基本補償）なのに、タスク/OPシートに「免責」バッジが表示された。

### 真因（`detectInsurance_` フォールバック判定の誤爆）
- `gas-email-import-v2.gs`（SPK L629）/ 那覇 `gas/Code.gs`（L609）の **同一バグ**。3店GASの `detectInsurance_` は同一ロジック。
- 該当行：`if (/免責/.test(text) && !/免責[：:\s]*(なし|未加入|無し|加入しない|0円)/i.test(text)) return '免責';`
- 除外ガードが `免責` の**直後**に「なし」が来る場合しか除外しない。HP形式は `免責`**補償制度(CDW)**`: なし` と**ラベルと値の間に文字が挟まる**ため除外できず、「文中に"免責"がある」だけで誤って `免責` を返していた。
- ※あり判定（`免責補償制度(CDW): あり`）は手前のL626/627で先にreturnされるので無影響。

### 修正（SPK/NHA 両方に同一の除外行を追加）
フォールバック行の手前に1行追加：
```js
// ★ HP形式「免責補償制度(CDW): なし」を明示的に除外（基本補償＝免責未加入）
if (/免責[^：:\n]*[：:\s]*(なし|未加入|無し|加入しない|0円)/i.test(text)) return 'なし';
```
`[^：:\n]*` でラベル(補償制度(CDW))を吸収し、コロン直後の「なし」を拾う。`：:` は跨がないので「免責補償: あり…安心パック: なし」のような別オプションのなしには誤反応しない。

### DB訂正（実施済）
- `reservations.insurance` LXT04768 を `免責→なし`、DEL/COLタスク（`tasks.insurance`、PK列は `_id`）も `免責→なし` に修正。
- 横展開チェック：**今日以降(active)のHP×免責は SPK=LXT04768のみ(修正済) / NHA=0件**。運用への実害は那覇は無し。

### デプロイ（オーナー作業・トリガー型なので再デプロイ不要）
1. 札幌：`~/spk-task/gas-email-import-v2.gs` を「札幌予約メール自動配車」に Cmd+A→Cmd+V→Cmd+S。
2. 那覇：`~/Desktop/naha-project/gas/Code.gs` を「那覇店 予約取込」に同様に貼付。両方 `node --check` 構文OK済。

### Lesson
- **3店GASの `detectInsurance_` は同一ロジック → 片方直したら必ず横展開**（SPK/NHA/将来BT）。今回もSPKで発覚→NHAにも同バグ確認→同時修正。
- ラベルと値の間に文字が挟まる `ラベル○○: 値` 形式は、`ラベル[直後]値` 前提の正規表現を擦り抜ける。除外ガードは `[^：:\n]*` でラベル部を吸収する設計にする。

## 📈 2026-06-06 運用戦略ハブ統合 + action-fill NHA新仕様移植（v4.7.213 / spk-v758）

### strategy.html（運用戦略ハブ）新設＝入口1つに統一
- TOPタイル「OTA運用戦略」「運用戦略(旧HP・in-APP)」「売上予測」3個 → **「📈 運用戦略」1個**（url:strategy.html）に集約。旧in-APP HP運用戦略（attribution仕様）はタイル撤去＝入口から廃止（コンポーネントは残置・未使用）。
- 内部タブ×iframe: 🔮売上予測(forecast.html?store=spk) / 💴予算シナリオ(action-fill.html) / 📣OTA運用戦略(marketing-ota.html)。lazy生成→保持・最終タブ記憶(`spk_strategy_tab`)。直URL全部生存。

### action-fill.html＝NHA新仕様を完全移植（total-response・本軸）
- 本軸: T月予算 → 獲得（÷月別CPA仮説）→ 流通=入金（×ROAS）→ @予約単価 → FEED分散で月別売上計上＋充足率。📡オンタイム検証（8タイル・乖離3軸=CPA/売上/単価＝実測−仮説中央）。
- **SPK固有データ**:
  - FEED実測＝2026-04〜06発生（**当月着地53%＝直前型**。NHA6月12%と真逆）。**3月発生はCSV一括取込で汚染＝除外**。未観測月（7月〜）はクリーン146本のラグ分布 `DEF_LAG={0:54,1:16,2:8,3:12,4:5,5:4,6:1}` から合成（実測が貯まったらFEEDに追記）。
  - GCPA＝**¥15,930の1点のみ**（2026-05: ¥175,235÷HP11本・ROAS 1.93x）。月別形状なし→全月フラット。広告費はorganic.html AD_BASEと同値＝**月次レポート到着時にaction-fillのAD2026にも追記**。
  - 信頼点しきい値＝**8本**（新店基準。NHAは20本）。
  - **reservationsにbooked_at列なし**＝created_atが発生日（GAS即時取込なので近似OK）。一括取込除外フィルタなし。
  - ACT25(前年稼働率)なし＝新店表示。目標稼働率TGTUは暫定フラット50%。
- forecast.html に `spk_fcst` localStorage書き出しを追加（renderForecastChartSection内・挙動無変更）。**年間進捗を1回開くと速報連携**。

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
- **📈 OTA構成比%（2026-06-06）**：OTA手数料はグロス売上全体でなく**OTA経由分にのみ**かかる（HP集客の費用は広告費で別計上）→ `g_otashare` 新設。**OTA手数料＝売上×OTA構成比%×手数料率**。初期値は実績（snapshot ota_detail直近3ヶ月売上比・OTA=HP/SP/direct以外）：**SPK 94% / NHA 65% / BT 90%(仮)**。変動費グループに自動計算欄`g_otafeetot`表示。リバランスのcontribにも反映。
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

## 🔧 2026-06-07 入庫スケジュール（確定版v2・v4.7.216）— 仮予定→承認→FIXループ

- **確定フロー（オーナー仕様）**: 本体配車表→空セル→メンテナンス登録→label=車検/半年点検/修理で「🏭入庫(仮予定)として協力会社カレンダーに公開」チェック(既定ON)＋**入庫先select(partner_companiesマスター連動)** → maintenance.status='pending'＋owner_company=入庫先ID → 配車表バー橙縞〔仮〕 → **協力会社ビュー「🔧入庫スケジュール」タブ(カレンダー形式・自社宛のみ表示)** に🟡表示 → 共立がタップ→✅承認 → status='approved' → 配車表バー緑縞〔FIX〕。
- **入庫先マスター＝partner_companies**（既存「🏢協力会社マスター」UI=車両タブ→車検/点検(簡易版)→partnersサブタブで登録）。owner_companyは入庫ブロックでは「入庫先」の意味（partner_reservedの「所有者」と文脈別・block_typeで区別）。
- partner.html: 旧「車両管理」タブ→「入庫スケジュール」に改名・中身をカレンダー全面置換（月送り・🟡仮/🟢FIX・タップ→詳細→承認・partner_actionsに intake_approved 監査ログ）。
- **要SQL**: `intake_db_migration.sql`（status等6列）をSQL EditorでRUN。
- 旧IntakeBoard(v4.7.213)はTOP非表示で温存（コード残置）。
- **追補（同日完成・v4.7.223）**:
  - **日程変更リクエスト**: 協力会社が希望日+コメント送信→status='reschedule'+candidate_dates→配車表赤縞〔変更依頼〕＋整備カレンダー上部にパネル→[✅提案日で確定FIX][↩︎差戻し]。
  - **TOP整備カレンダーからも入庫登録**（＋入庫登録ボタン・車両選択式MaintForm defaultLabel=車検）。TOPカレンダーは未来の全メンテブロック表示に修正（旧:車両ごと最早1件で新規が隠れるバグ）＋修理表示＋仮橙/FIX緑/変更依頼赤チップ。
  - **全アクションSlack通知**（#partner_在庫調整・notifyPartnerActions経由5分）: intake_created/approved/reschedule/resch_accepted/resch_rejected/cancelled(配車表削除)/edited(予約)。本体側は`logIntakeAction()`ヘルパー、partner側はintakeLog(notified_slack=false)。GAS反映済み。
  - **協力会社ビュー入庫スケジュール**: 月/週切替・スマホ/PC最適化(中央1340px・セル/チップ拡大)・要対応Handoverパネル(承認待ち/変更依頼中のテキスト一覧・タップ→詳細)・注記はヘッダー直下1行に。
  - 配車表ヘッダーに凡例チップ（入庫仮橙縞/FIX緑縞/変更依頼赤縞/メンテ青縞）。
  - 整備カレンダー改名は**全店適用済み**（NHA v3.5.115/BT v1.0.71・機能はSPK先行）。
- **追補2（同日リリース・〜v4.7.231）**:
  - **時刻対応**: maintenance.start_time/end_time追加(SQL実行済)。登録/編集/変更リクエスト/Slack通知すべて時刻対応。🕐時間変更専用ボタン（仮/FIX両方・日付据え置き）。
  - **FIX後のリクエスト**: 📅変更・🚫キャンセル（理由付き・status=cancel_request紫）。差戻しはprev_statusでFIX復帰。取下げボタン（元日程で承認）。
  - **配車表ポップアップで完結**: ステータス表示＋承諾/差戻し/拒否＋📝編集（日付時刻見積工場作業内容メモ・公開中は警告＋intake_edited通知）＋🗑キャンセル。
  - **色最終**: 仮=橙縞/FIX=緑縞/**変更依頼=マゼンタ縞#db2777**(予約赤と区別)/取消依頼=紫縞/メンテ=青縞。凡例チップ付き。
  - **全種別対応**: メンテナンス/清掃/その他も入庫公開可（ラベル不問・status基準）。
  - **協力会社ビュー**: 入庫スケジュール(月/週・スマホ週デフォルト・チップ可読化・PC1340px)・📜入庫リストタブ(時系列月グループ)・要対応Handover・**車両情報タブ刷新**(次回車検日/車検残/日額/傷チェックURL=vehicle_twins.share_token/走行距離+更新日=odometer)。
  - **通知全種**: created/approved/reschedule/resch_accepted/rejected/withdrawn/cancel_request/cancel_accepted/cancel_rejected/edited/cancelled。
  - **マニュアル**: intake-manual-staff.html / intake-manual-partner.html（GitHub Pages・PDF化済）。リリース告知を#sapporo_reservation/#handyman_developmentに投稿済（那覇はこれから開発と明記）。
  - ⚠️Slack Bot(SNS Auto)はfiles:write無し=PDF添付不可・channels:read無し=チャンネル一覧不可。投稿はchat.postMessageのみ可。
- **残**: 入庫中→完了(実費・期限自動更新)の運用接続（旧IntakeBoardのロジック温存済）、傷チェック→修理入庫ワンタップ連携、LINEグループ通知、NHA/BTへの入庫システム移植（DB層分岐ありフル移植は別作業）。

- **設計**: 起点=配車表のメンテブロック(label=車検/半年点検/修理)＝**年間仮埋め(予算大枠)**。入庫3ヶ月前になるとTOP「🔧入庫管理」ボードに「📨調整中」として自動表示→車両別に日程/内容/費用を調整（オーナー運用と一致）。
- **ステータス**: maintenance.status null/requested=調整中→confirmed=日程確定→in_shop=入庫中→done=完了。完了時に実費/請求書No/実出庫日を記録し**車検→満了+24ヶ月＆点検期限=出庫+6ヶ月／点検→+6ヶ月を車両マスター自動更新**。
- **機能**: ⚠️期限接近ボード(60日以内・予定なし→ワンタップ依頼作成)／🚨突発修理クイック登録(即in_shop・配車表ブロック)／詳細モーダル(工場・見積・作業内容・原因・メモ)／削除は2段階確認。
- **DB**: `intake_db_migration.sql`（status/work_detail/repair_cause/actual_out_date/candidate_dates/created_at 追加）**→オーナーがSQL EditorでRUN必須（RUNまでstatus保存が失敗）**。DB層は新フィールドを「プロパティ存在時のみ書く」方式で旧呼び出し元の上書き事故防止。
- **今後**: Phase2=partner.html🔧入庫タブ（共立自動車が日程回答/内容/見積入力＝自社maintenanceの公開スライス・正本1箇所）＋GAS通知(#車両管理チャンネル・ID待ち)。Phase3=傷チェック(handyman-damage)連携＋NHA/BT展開。

## 🧾 2026-06-07 協力会社 請求書格納タブ（partner.html）

- **構成**: Supabase Storage非公開バケット`partner-invoices`＋メタテーブル`partner_invoice_files`（SQL: partner_invoice_files.sql・RUN済）。
- **機能**: 先方がPDF/画像をアップ（対象月×車両=配車表全車両から選択 or 共通・複数可・備考）→ 月別/車両別/年別ソート切替＋グループ折りたたみ（先頭のみ展開・未確認バッジ）→ 👁プレビュー/⬇️DL（createSignedUrl 1h）→ 🗑削除。
- **確認チェック**: HANDYMANアカウント(@g-lines.jp/@mileshare.jp)のみ「☐確認する」→✅確認済+日付+担当が先方にも表示（既読の証）。confirmed_at/confirmed_by列。
- **Slack通知**: アップ成功時 partner_actions `invoice_uploaded`(notified_slack=false)→notifyPartnerActionsが🧾通知（対象月/車両/件数/備考）。
- **⚠️ Storageキーは日本語不可**（Invalid key）→ パスはASCIIのみに変換、表示名はfile_name列で日本語維持。
- 関連: 車両情報タブ刷新（次回車検日/車検残/日額/傷チェックURL=vehicle_twins/走行距離・colgroup固定幅で全クラス整列）。

## 🤝 2026-06-07 協力会社: キャンセル履歴一覧＋予約増減Slack通知（partner.html / gas-email-import-v2.gs）

- **背景**: 協力会社車両(B2ノア)の予約 RC42461194472711541 が楽天キャンセル→fleet解除で協力会社ビューから消え「消えた？」と混乱。キャンセルは配車解除されるため partner.html から見えなくなる構造だった。
- **① partner.html 予約データタブに「❌キャンセル履歴」**: データソース＝`partner_actions`(action_type=customer_resv_cancelled・owner_company絞り・ts desc 30件)。payload に resv_no/name/ota/期間/price/vehicle_name。renderCxl()。
- **② GAS `watchPartnerCustomerReservations()`（15分・要 `setupPartnerWatchTrigger()` 1回実行）**: vehicles(owner_company≠HANDYMAN)→fleet の配車状態を ScriptProperty `PARTNER_RESV_STATE` と差分比較。新規配車=🆕通知＋customer_resv_add記録／state在&fleet消&status=cancelled=❌通知＋customer_resv_cancelled記録。**初回実行はseedのみ（既存予約の通知スパム防止）**。配車変更（他車両へ移動）は通知しない。通知先=`PARTNER_NOTIFY_CHANNEL`(C0B451BSK1B=#partner_在庫調整)。`notified_slack:true`で旧notifyPartnerActionsの二重通知防止。
- 昨日のキャンセル(ヒダカ サトシ様・B2・¥45,450)は手動で partner_actions に登録済（履歴に表示される）。
- **デプロイ**: GASエディタ「札幌予約メール自動配車」に gas-email-import-v2.gs 全文貼付→`setupPartnerWatchTrigger`を1回▶️実行。

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

## 📦 過去ログはアーカイブへ退避（2026-07-21・容量対策）
**2026-04〜05月の詳細インシデント/修正履歴は `~/spk-task/CLAUDE_ARCHIVE_2026H1.md` に退避した（削除ではない・必要時にRead）。** 本体はアクティブなドクトリン＋直近06〜07月の知見＋核心リファレンス（下記「プロジェクト概要」以降）＋絶対ルールのみ残す。
- アーカイブ収録（2026-05）：配車表A2/B2重複・オフライン誤検知固着・傷チェック共有URL・入金同期漏れ3層防御・予約後メール3OTA拡張・協力会社車両運用Phase1〜9・入金通知店舗判定fail-safe・ログイン画面二重overlay/予算実績Auth・重複予約物理削除・じゃらんpeopleパース・自動返金Bot廃止 等。
- アーカイブ収録（2026-04）：場所カラム公式ルール・extractField_1行バグ全パーサー修正・A2/B2誤配車・skyticket取込失敗・じゃらん過大請求(B群)・GAS SUPABASE_KEY・会計/集計NHA統一・駐車場シャッフル(v4.6.55)・じゃらん事前決済PJ(04-02)・SRI白画面インシデント 等。
- **再発時はまずアーカイブをgrep**（例：`grep -n "キーワード" ~/spk-task/CLAUDE_ARCHIVE_2026H1.md`）。恒久ルールで生きているものは本体06〜07月項＋グローバルCLAUDE.mdに反映済み。

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

## 📦 2026-04月ログ・じゃらん事前決済PJ・旧インシデント履歴 → アーカイブ
上記の通り `~/spk-task/CLAUDE_ARCHIVE_2026H1.md` に退避済み。じゃらん決済の恒久ルール（請求額＝「利用者への請求額」／那覇ガード／checkPaymentStatus予約番号突合）は 2026-06-08 項＋グローバルCLAUDE.mdに反映済みで本体に生存。

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
