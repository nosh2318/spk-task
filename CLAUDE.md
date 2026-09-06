# SPK業務管理APP（札幌店）

## 🚨 2026-09-06 札幌予約取込が13h停止＝真因は「停止監視cronが未スケジュール(監視が死んでいた)」＋対応品質の是正（オーナー最重要指摘）
オーナー『札幌 予約取込が動いてない』。実データ切り分け＝**SPK reservations最新取込9/5 21:52JST→約13h沈黙・NHAは10:26JSTまで正常＝SPK GASのみ停止**（SPKは普段この時間帯も取込あり＝異常）。未取込の実メール2件(楽天RC12461289352059586榊様9/14-15 B・じゃらんR0H6JTUF植田様9/7 G)を**手動取込**(reservations+fleet挿入・榊→ノア5398/植田→デミオ6864・#sapporo_reservation C08TDTPEB36通知)。
- **🔴 真因＝停止監視 `import_stall_monitor()` 関数は在るのにcronが1つもスケジュールされていなかった＝監視が丸ごと死んでいた**（`select * from cron.job`に`import-stall-monitor`が不在）。だからオーナーが第一発見者になった。**恒久解**：①時間窓`13-22`→`7-23JST`に拡大(朝の停止も拾う)②`cron.schedule('import-stall-monitor','10 * * * *',...)`で毎時登録(jobid52)③`p_force=true`で**pg_net→Slack status_code 200×2ch(#handyman_development C07B5G3PV7C + #sapporo_reservation C08TDTPEB36)を実発火で実証**。閾値8h・SPK/NHA店別独立判定・KEYDROP除外。
- **⚠️監視の限界**：`max(created_at)`基準なので**手動取込するとcreated_atが更新され停止signalがマスクされる**（復旧後は正常に戻る＝正しい挙動だが「手動で直すと監視が"回復"と誤認」に注意）。GAS本体(Apps Script)は停止したまま＝**オーナーがトリガー/実行エラーを確認し再起動するまで新規は自動取込されない**（監視は今後の停止を検知通知する）。
- **🧭 対応品質の恒久ルール（オーナー指摘『こちらから"止まってないか"発信するのがおかしい・レベルの低いやりとりを避けたい』）**：①**「動いてない」と言われたら聞き返さず即調査・復旧に入る**（"予約ある？"等、報告済みの事実を問い返さない＝報告そのものが証拠）。②**オーナーが異常の第一発見者になっている時点で負け＝システムが先に検知・通知する仕組みを常に用意する**（監視の穴＝品質問題の本丸）。③手動取込の型＝reservations+fleet挿入(既存OTA行からスキーマ写経)→空車は同クラスactive×期間重複なし→Slack。vehicles列は`plate_no`(not `no`)・SPK visit_type=''/return_type='COL'が正常・G=デミオ優先・免責+NOC→insurance='NOC'。
- **🔍 真因の切り分け＝GAS実行数(トリガー画面)＋Cloudログ(Diag行)で確定（この日実証）**：オーナーが実行数画面+Cloudログを提示→①`processNewEmails`が30分毎・エラー率0%・毎回「完了」＝**プロセス健全・再起動不要**。②Cloudログに`Found 28 thread(s)`＝**検索はメールを発見(Spamでない)**＋`Parsed: RC…(R) class=B`/`Parsed: R0H6JTUF(J) class=G`＝**パース・ルーティングも正常**。→ 榊様/植田様の未取込は**一過性**（10:52実行で発見・パース済＝手動投入がなければその回で取込。私の手動投入がマスクし再現不可）。**教訓＝「取込が動かない」は①実行数(停止/エラー)②Cloudログの`[Diag] threads/既処理skip/非予約null/success/fail`行 で"検索が拾ってるか・パースしてるか・なぜskipか"を一目で切り分ける。推測でコアを触らない（取込コアは実証済で正常＝無変更）。Spam説は外れた＝実データで否定するまで断定しない。**
- **🩹 この日直した実在欠陥＝未配車を"取込失敗"扱いしていた（GAS貼付でデプロイ）**：`processMessage_`が「取込成功だが空車なし＝未配車」を`type:'failure'`で返し→①誤った"取込失敗"Slack通知(オオカミ少年化)②DB登録済みなのに最大4回リトライ。→ `type:'unassigned'`に分離＝seen登録(リトライしない)＋`sendSlackUnassigned_`で『⚠️取込OK・未配車(手動配車が必要)』通知。**これで`'failure'`は"本当にDB未登録"だけを意味し、seen登録/リトライの安全不変条件が厳密化**（＝"取り込まず処理済み"の芽を構造で断つ）。取込コア(検索/パース/店舗判定)は無変更（動いてるものは触らない）。

## 🏙️ 2026-09-05 company3d.html＝3Dバーチャル本社（全社の稼働をリアルタイム可視化・新規構築中）
オーナービジョン「AI×人の全領域を可視化したバーチャル本社」。**URL＝https://nosh2318.github.io/spk-task/company3d.html**（Three.js r128 単一HTML・GitHub Pages・**buildなしpush即反映**）。共有Supabaseの台帳/実データを**読むだけ**（既存APPとは別・書き込まない）。
- **構造**：`UNITS`＝マネジメントチーム(hq・9部署)＋3店(nha/spk/bt)。店は共通8部署(`ST_STORE`＝①貸渡/返却オペ②予約/配車管理③顧客対応④出入金管理⑤車両管理⑥修理⑦スタッフ管理⑧イレギュラー対応)。各部署=部屋(room)、店=土台(platform)。
- **操作（重要・オーナー確定）**：①**ナビボタン or 店の区画(部屋含む)をタップ→その店だけ表示＋ズーム**（`focusUnit`＝他店`_grp.visible=false`＋カメラ寄せ。全体表示では部屋タップも詳細でなくまず店にズーム＝pick()が`activeUnit==='all'`で分岐）②ズーム済みで部屋タップ→詳細パネル(`openP`)③スタッフ名札(🔗)タップ→個別URL(staff.html?t=token)。
- **スマホ操作**：**1本指ドラッグ=中心移動(パン)／2本指=拡大縮小(ピンチ)**（PCマウス=回転・ホイール=ズーム）。pointerType判定＋activePtr Setで分岐。
- **🔴 スマホでラベル(タスク/アラート)が崩れる根治**：HTMLオーバーレイ(project()で位置付け)は本来ズームでサイズ不変。だが**ブラウザ自体のピンチズーム(ページ拡大)でDOM全体が拡大し崩れる**→ ①viewport`user-scalable=no,maximum-scale=1` ②`canvas#c{touch-action:none}` ③touchmoveを`{passive:false}`+`e.preventDefault()`+`gesturestart/change`抑止、の3点で解決。**HTMLオーバーレイUIを持つThree.jsは必ずこの3点でページズームを殺す**（でないとモバイルで崩壊）。
- **OMNI**：各店に1体、**②予約/配車管理の部屋に固定(動かない)**＝`addStoreOmni`が`dp._pos`に配置(moversに入れない)。アイコンは**シアン発光の目＋アンテナのロボット**(`avatar('omni')`・アンテナ明滅)。ラベル「🤖 OMNI／AI受付・配車」。※一度オーブ+リングにしたが「ロボットでいい」でロボットに。
- **CLI/常駐**：hqにCLI(歩行・`cli_last_seen()`でPCオフライン検知→静止)＋常駐(大下・武山＝武山は運用部の部屋のみ)。各店OMNIとは別。
- **リアルタイム/チーム状況ボタン**（旧「本日のチーム状況」から改称）：**個別URL(staff.html)のヘッダー直下にコンテンツ内バー**（固定配置はヘッダーと重なり押せない→renderのマニュアルボタン下にh+=で挿入）＋**各店アプリTOPの「OPシートを開く」横**（`.tbBlink`点滅）→クリックでcompany3d.htmlを開く。3店。
- **RPC(SECURITY DEFINER・anon/authenticated grant)**：main=`company_roster/company_staff_tasks(nm,cnt,tok=share_token)/company_task_counts(OPサマリ集計:貸出計/返却計/洗車/その他)/company_vehicles/company_alerts(未配車/車検接近/点検接近/未入金・テスト/デモ除外`r.id !~ '^(ZZ|DEMO|KD-DEMO|TEST)'`)/cli_last_seen`。BT=`bt_company_*`(別DB)。タスク数は生DB件数でなく**各店OPシートのサマリ区分**に合わせる。
- **落とし穴**：①**GitHub Pages CDNエッジは素URL(クエリ無し)をPOP毎に最大10分キャッシュ→シークレットでも直らない(エッジ由来)／`?cb=一意値`は別Fastlyオブジェクトで即fresh／curlは別POPでfreshに見え食い違う**。反映確認はエッジTTL経過を待つか一意クエリ。②**スタッフDOM名札が3D canvasのクリックを奪う**（focusのテストは名札の無い部屋/床をタップ）。③RPC戻り値型変更はDROP FUNCTION必須・Management APIはurllib403→curl。
- 車両マスタ＝`fleet-master.html`(全店車両・ETC位置/装備/車検点検・vehicles-master.htmlは404キャッシュ回避で改名した経緯)。**`?store=nha|spk|bt`で初期店舗指定→その店の車両のみ表示**(2026-09-06追加・IIFEでcurS初期化+該当ボタンon)。**各店(nha/spk/bt)の⑤車両管理dept→`fleet-master.html?store=<key>`＝その店の車両データのみ**(オーナー指示「全店データでなく各店の車両のみに」)。`store(key,base)`が`ST_STORE`複製時に⑤車両管理itemのURLをkey別に差し替え(items配列を新規生成＝shallow cloneの共有参照を回避)。
- **レイアウト＝地理配置(北海道北/沖縄南)は「立体感が難しい」でボツ→バランス十字配置に確定**：マネジメント(奥中央 pos[0,-30])／3店(中央横一列 nha[-27,0]/spk[0,0]/bt[27,0])／CS部[-15,30]・出勤退勤管理部[15,30](手前2部屋・旧SNS部を2026-09-06に置換=SNS部廃止)。全体カメラ`focus(0,-1,112,0.58)theta=0`。※将来案「地球儀(球体)で動く」はオーナー保留アイデア。
- **CS部/SNS部＝storeでない独立ユニット**(UNITS配列に追加・build()が同じ仕組みで部屋描画・navボタン自動)：CS=①問い合わせ管理（メール）(handyman-inquiry.vercel.app)②LINE（エルメ）(step.lme.jp/basic/chat-v3?lastTimeUpdateFriend=0)③電話問い合わせ(noteのみ)④マイページ管理(rent-handyman.com/mypage-admin.html?bucket=but_tkm)〔2026-09-06 CS部を4部屋化〕。**💬 CSチャット(マイページ⇄CS部 直接対応・2026-09-06)**：DB`cs_chat_threads`/`cs_chat_messages`＋RPC`cs_chat_pending()`(main)、EF`cs-chat`(お客様=`cust_open/send/poll`＝mypage_token本人認証で予約(reservations/nha_reservations)へ自動紐付け＝誰から/どの予約か自動判明・スタッフ=`staff_list/thread/send/close`＝本体ログインJWT・新着はSlack通知(**札幌C0BER0YC6AK=#sapporo_user_action／沖縄C06L91W6T08=#okinawa_operations-team**・2026-09-06オーナー指定・両ch bot参加/配信確認済))。my.html(SPK)に**フローティング💬チャット**(お客様のみ`!RO`・既存mypageロジックに非干渉の追加のみ・apikey不要でcs-chat呼出)＋**`cs-chat-admin.html`**(CS管理・名前+番号→@{store}.hdmログイン・未対応一覧+予約詳細+返信+対応完了・8秒poll)＋company3d CS部に「💬未対応チャットN件」吹き出し(`fetchCsChat`→cs_chat_pending→cs-chat-adminへリンク)。**那覇マイページ(my-nha.html・store=nha)にも同ウィジェット展開済(2026-09-06)＝札幌/那覇 両方チャット可**。CS管理は既定で「対応中スレッド全表示(未読=赤バッジ)」(開いた瞬間に一覧から消えて見失うのを解消)。往復E2E実証済(お客様送信→Slack→CS返信→お客様マイページ💬に到達)。**残＝リニューアルHDMサイト(rent-handyman.com)チャット・BTマイページ展開・給与明細自己閲覧**。⚠️cs_chat_threadsは`store+reservation_id`ユニークで1予約1スレッド。**📷画像送信(2026-09-06)**：お客様(my.html/my-nha.html)・管理(cs-chat-admin)の両方に📎添付＝クライアントで1280pxにリサイズ(canvas/jpeg0.82)→EF cust_send/staff_sendの`image`(dataURL)→EFが`cs-chat`公開バケットへupload→`cs_chat_messages.image_url`。メッセージは画像表示(タップで拡大)。**🔴空スレッド根治(2026-09-06)**：`cust_open`(マイページを開く/バッジ確認)でスレッドを作ると、お客様が開くだけで空スレッドがCS一覧に溜まる→`getThread(…,create)`で**送信時(cust_send)のみ作成**に修正。**📢未対応アラート(cs-chat-admin)**：`cs_chat_pending`を8秒監視→未対応>0で赤バー点滅＋タイトル`🔴(N)`＋通知音(WebAudio)＋店タブ赤バッジ。**📱スマホ最適化**：スレッドを開くと全画面オーバーレイ＋「←一覧」戻る。**CS一覧の既定=対応中スレッド全表示(未読=赤バッジ)**。⚠️検証でスレッドを作ったら必ず削除(cs_chat_threads・messagesはcascade)。⚠️**予約解決(resolveResv)は`select=*`必須**＝札幌reservationsは`vehicle`列だが那覇nha_reservationsは`vehicle_class`(vehicle列なし)＝列指定selectだと那覇でエラー→解決失敗のバグ有(2026-09-06修正)。Slack車両表示は`vehicle||vehicle_class`。SNS=①Instagram(@delivery_rentalcar_handyman)②投稿管理シート(GAS連動)。部屋詳細は`dp.items:[{t,d,u}]`形式でopenPがリンクカード描画。
- **吹き出し(type:'bubble'・ラベルフィルタで全体＋その拠点表示・120秒更新・in-place更新)**：①マネジメント発「📥本日の新規予約(発生)」那覇/札幌/高松＝RPC`company_new_bookings()`(main jsonb{nha,spk})＋`bt_company_new_bookings()`(BT jsonb{bt})＝created_at JST今日・cancel/テスト除外。②CS発「📮未対応の問い合わせN件！〜店の皆さん対応してください！」赤点滅(`.inqblink`)＝RPC`company_inquiries()`(main jsonb{nha,spk,bt}・`inquiries`表 status∈new/in_progress・store=naha/sapporo/takamatsu)。0件は「対応済み」緑。
- **🔴 情報ラベルは3D浮遊やめ→画面端の固定パネルに集約(オーナー確定「主役はエリアとスタッフ・タスク/アラート/予約をエリアに重ねるな」)**：`#storehud`(左固定・各店カード=貸出/返却/洗車/他＋主要アラート(クリックで該当APP)＋本日の新規予約＋出勤N名/残)＋`#inqbanner`(上部固定・未対応問い合わせを赤点滅「〜店の皆さん対応してください！」)。3Dには店/部署/OMNI/スタッフ名札/常駐だけ残す(主役)。fetch群は`_hud{tc,al,nb}`+`_att`に貯めて`renderStoreHud()`でDOM描画(3Dラベルを作らない)。スマホは`#storehud`をbottom固定(media 760px)・隠すトグル有。**💴現金残高＝那覇/札幌は常時固定表示**(2026-09-06オーナー指示「那覇・札幌の現金残高も固定で出す」)：`fetchPettyCash`が`spk_cash_balance`/`nha_cash_balance`RPC(出納帳の現金残高=hq-accounting.htmlと同式)を取得→`renderStoreHud`で`pt.total`が数値なら常に表示。**<¥2000=赤点滅`.shpetty`+要補充／通常=静かな`.shcash`(点滅なし)**。個別小口(札幌`company_petty_cash`<¥1000)は併記。検証済:那覇¥16,639/札幌¥201(赤点滅+小口高橋-¥1,000)。
- デプロイ実測：company3d f57bfcc／SPK 695f9ac/NHA v3.5.365/BT v1.0.402。
- **🪪 スタッフ登録にID番号＋暗証番号(PIN)を追加（2026-09-06・出勤退勤管理部の土台）**：オーナー構想=SNS部廃止→出勤退勤管理部を新設し、全スタッフがID/PINで①出勤/退勤打刻(既存`spk_staff_punch`継承・給与はシフト計算のまま/打刻は記録・照合)②当日タスクURL(staff.html?t=token)受取③本人の給与明細閲覧、を一本化する。第一歩として3店のstaffマスタに`staff_code`(ID番号・既存ログイン番号0111等を流用)＋`staff_pin`(4桁暗証)列を追加(main staff/nha_staff・BT bt_staff)し、スタッフ登録フォーム(StaffManager)の雇用形態直後=アルバイト/正社員 共通位置にID/PIN入力欄を追加(fetchStaff/saveStaffのマッピングも対応)。SPK v4.7.601/NHA v3.5.366/BT v1.0.403。①SNS部→出勤退勤管理部の置換=完了(2026-09-06・旧SNS廃止)。②**ID/PIN打刻キオスク`kiosk.html`=SPK稼働(2026-09-06)**：`kiosk.html?store=spk|nha`(公開・anon・数字キーパッド)→RPC`staff_kiosk_auth(p_store,p_code,p_pin)`(SECURITY DEFINER・anon grant・staff/nha_staffのstaff_code+staff_pin照合→{ok,name,token=share_token})→`spk_staff_punch(token,'in'|'out')`で出勤/退勤打刻(既存継承・spk_attendanceに書込=給与連動)→出勤時に当日タスクURL(staff.html?t=token)を渡す。45秒無操作で自動ログアウト(共有端末)。実E2E検証済。**打刻キオスクは札幌・那覇の両店で稼働(2026-09-06統一)**：那覇に`nha_staff_punch`/`nha_staff_timecard`作成(nha_staff.share_token・nha_attendance=text日付・PK(date,staff_name)・**休憩列なし=in/outのみ**)。kiosk.htmlを店別化(`PFX`=spk/nha・`PUNCH_OK`両true・`TASK_BASE`=那覇は`naha-project/staff.html?t=`／札幌は同オリジンstaff.html)。**那覇は独自のstaff.html(naha-project・nha_staff_view・タスク閲覧専用)を持つ**のでタスク受取はそこへ誘導(spk-task/staff.htmlを店別化する必要なし)。**高松(BT)も統一(2026-09-06)＝3店完了**：BTは別DB(ggqugvyskyiblxiycpci)なので**BT DBに`bt_staff_kiosk_auth`(p_code/p_pin・p_storeなし)＋`bt_staff_punch`＋`bt_staff_timecard`を作成**(bt_staff.share_token・bt_attendance=text日付/PK(date,staff_name)/休憩なし)。kiosk.htmlは`IS_BT`で**接続先DBを切替**(`DB={url:BT_URL,anon:BT_ANON}`・BTは`bt_staff_kiosk_auth`をp_storeなしで呼ぶ)。TASK_BASE=高松は`buddica-touring.github.io/app/staff.html?t=`(BTも独自staff.html=bt_staff_view有り)。company3d出勤退勤管理部の打刻キオスク部屋から3店接続。E2E検証済(那覇/高松とも auth→出勤→timecard→退勤・後始末済)。⚠️kiosk店別化の型＝`PFX`(spk/nha/bt)でRPC名、`DB`で接続先(BTのみ別DB)、`TASK_BASE`で各店staff.html、`bt_staff_kiosk_auth`だけp_store引数なし。③給与明細の本人自己閲覧＝**オーナー指示で廃止(2026-09-06・キオスクのボタン/company3d部屋とも削除)**。④**未打刻アラート(2026-09-06)**：本日出勤予定(shifts/nha_shifts/bt_shifts の●or start_time有・off記号除外)なのに未打刻(attendance memo='打刻'無し)かつ予定開始を過ぎた人数を店舗別に集計＝RPC`company_unpunched()`{spk,nha}＋`bt_company_unpunched()`{bt}。company3d`fetchUnpunched`→**出勤退勤管理部の上に赤点滅吹き出し「⏰未打刻 N人！那覇/札幌/高松別」**(クリックで勤怠ログへ)。⑤**シフト↔打刻 差分ログ(2026-09-06・上司判定式)**＝`attendance-log.html`(上司が名前+番号ログイン・店toggle・日付)→`attendance_log(p_store,p_date)`(main spk/nha)/`bt_attendance_log(p_date)`(BT)がシフト予定と実打刻を`full join`で並べ→**横並び表＋差分チップ(遅刻/早退/残業/早出/未打刻/シフト外＝参考・自動判定しない)**、**上司が✔️確認済/⚠️要確認＋メモで判定**＝`attendance_review`表(main)＋`attendance_review_set`(JWT・auth.uid()で記録者)/`_get`。給与はシフト計算のまま(打刻は照合)。company3d差分ログ部屋から接続。E2E検証済。**残＝出勤退勤管理部の「🟢今出勤中」ライブ表示RPC**。⚠️検証時は実スタッフにstaff_code/pinを一時設定→検証後に必ずクリア＋打刻テスト行(attendance)/判定行(attendance_review)を削除(実データ汚染防止)。

## 🏢 2026-09-05 本社会計 合算ハブ hq-accounting.html 新設（札幌+那覇の出納帳+カードを月次/年次で合算・GitHub Pages・閲覧専用）
オーナー要望「各店会計タブの小口・カードを本社として合算管理・出納帳とカードを月別/年で・札幌と那覇・最終的にinvoice_manager+advanceと合体」。**URL＝https://nosh2318.github.io/spk-task/hq-accounting.html**（単一HTML・vanilla・anon・buildなし・push即反映／GH Pagesは1〜2分ビルド待ちで初回404→`?cb=`で確認）。
- **表示**＝札幌+那覇の **出納帳(現金入金=cash_in/出金=cash_out/当月収支/月初残高/現金残高)＋カード払い(card_pay総額/入金済/未)** を **店別+合算** で。📅月次(年月選択)/📆年次(12ヶ月内訳+年計)切替＋CSV。**閲覧・集計専用**(登録/修正は各店APP)。
- **計算式はアプリの会計タブと完全一致(再集計しない)**：現金残高=**月初+当月収支−回収済現金売上**(cashCollected=cash_in且つcategory='現金売上'且つpaid)。月初残高キー＝**SPK`app_settings.spk_opening_balance`(単数)／NHA`nha_app_settings.opening_balances`(複数)**＝キー名が店で違う(罠)。両方 `{YM:金額}` dict。前月現金残高→翌月月初に繰越(アプリが書込済)。
- **各店会計の共通構造(main DB `{spk_/nha_}accounting`・同スキーマ)**：type=`cash_in`(出納帳入金)/`cash_out`(出金)/`card_pay`(カード)/`extra_sales`(予約外)/`advance`(立替)/`personal_adv`(個人立替)/`cash_in`のcategory=現金売上/小口現金追加/その他入金。列=date/type/category/amount/paid/description/resv_no/staff_name/payee等。**小口現金(petty_cash)はSPKのみ(`spk_petty_cash`)＝NHA/BTは未導入(404)**。BTは別DB(ggqugvyskyiblxiycpci)・リリース前で今回は札幌+那覇のみ(構造同じで後から追加可)。
- **検証済**：那覇2026-09=月初16639/入金0/出金0/残高16639=アプリ画面(スクショ)完全一致・前月残高→翌月月初繰越も一致。
- **残(オーナー『最後に合体』)**：この本社ハブに**受領請求書(invoice_manager.html=received_invoices・既に請求書+立替iframeの本社ビュー)/立替(advance.html=advance_reimbursements)をタブ統合**すれば、請求書+立替+出納帳+カードが1画面の本社ハブになる。invoice_managerはfile://ローカル、advanceはGH Pages。

## 🪑 2026-09-04 シート表記を全画面 CS/JS/BS に統一（チャイルドシート=CS・ジュニアシート=JS・ベビーシート=BS／v4.7.599）
オーナー指示「app上の全ての表記を統一」。過去の統一は積載在庫バッジ(📦 CS/JS)だけで止まっており、OP予約バッジと駐車マップが旧表記のままだった。**シート表記の"表示"箇所は7つ・6ファイルに散在**＝①`index.src.html` OptBadges L1199-1200(OP各所の主バッジ`C(チャイルド)`→`CS`)②🪑シート在庫サマリSEATS L16999③編集フォーム3箇所(L15681/L17797/L21189-91)④`parking.html` 倉庫車リストL288(旧`CS ﾁｬｲﾙﾄﾞ×`→`CS×`)+駐車マップ枠バッジL355(旧`チャイルド×`→`CS×`)⑤`my-admin.html` L766⑥`seats.html` L137⑦`staff-manual.html` L155。**⚠️`detectSeats`(L877)等のパーサーは`チャイルドシート`/`ジュニアシート`のフルワードでOTAデータを検出する＝表示でないので絶対に変えない**（変えると取込が壊れる）。表記変更依頼が来たら「表示バッジ7箇所」を全部直す＝1箇所だけ直すと"半分だけ統一"の再発になる（`grep -rn "C(チャイルド)\|J(ジュニア)\|チャイルド×\|ジュニア×" *.html`で残存確認）。

## 🏢 2026-09-02 Global Lines 会社概要ページを rent-handyman.com/company/ に公開（静ページ・多言語）
rent-handyman.com のfooter「会社概要」を **外部 g-lines.jp → 内部 `https://rent-handyman.com/company/`** に変更し、Global Lines刷新版コーポレートページ（単一HTML・多言語 日英繁韓）を公開。**ソース正本＝`~/Desktop/AI/g-lines-new/index.html`／本番実体＝`handyman-official`リポの`company/index.html`＋`company/assets/`**（編集は g-lines-new を直し→`company/`にcp→push）。BUSINESS4カード＝那覇店/札幌店/高松店/KEY（店舗3枚のリンク＝rent-handyman.com）。多言語＝各要素`data-i18n`＋`<script>`内`I18N`辞書(55キー×4言語)＋右上`#langsw`スイッチャー(localStorage`gl_lang`記憶・ブラウザ言語で自動初期)。翻訳追加＝HTMLに`data-i18n`付与＋`I18N`に4言語追加(キー数一致必須)。検証済(200・エラー0・4言語稼働)。**詳細手順メモ＝`~/Desktop/AI/g-lines-new/デプロイメモ_2026-09-02.md`**。⚠️旧`g-lines.jp`(Xserver)は別サイト＝本体差し替えはXserver情報が要る（今回未対応）。

## 🚨 2026-09-02 じゃらん共有アカウント崩壊の3店根治＋BTブランド振り分け＋welcome60日窓撤廃＋HDMじゃらん決済フロー（このセッション・要記憶）
オーナー報告「HDMじゃらん予約R0TWIKDOが高松(BT)と那覇(NHA)の両方に取り込まれた＝崩壊する」。根本原因と恒久対策・関連仕様を一括記録。

### 崩壊の真因＝じゃらんは全店共通アカウント→各店GASが同じメールを受信→貸出営業所で振り分けるべきが穴があった
- **NHA崩壊**：`gas-email-import.gs` `isNahaReservation_` が「Dクラス→那覇確定」ルール(那覇専用クラスのつもり)＋**高松除外が無かった**。高松にもDクラス(ハリアー)ができたので、高松HDMじゃらんが那覇に誤取込。根治＝冒頭に `if (/高松|香川|TAK|BUDDICA|たびらい/i.test(store)) return false;`（貸出営業所ガード）。commit eda0e26・貼付済。
- **SPK同型の穴**：`gas-email-import-v2.gs` `isSapporoReservation_` は最後に「**F/Hクラス→札幌確定**」があり、高松HDMのF/Hじゃらんが札幌に誤取込され得た(D/A2/B2は除外済だがF/Hが抜け)。根治＝冒頭に `if (/高松|香川|BUDDICA|たびらい/.test(store + address + places) || /_TAK/i.test(rawClass)) return false;`。クリップボード渡し済(貼付はオーナー)。
- **教訓**：じゃらん等の共有OTAアカウントは、各店GASが同一メールを受信する→「自店を積極判定(クラス/地名で拾う)」だけだと他店予約を誤取込する。**必ず"他店(特に高松)を先頭で除外"するガードを入れる**（貸出営業所＝store・住所・クラス末尾_TAK/_OKA/_SPK）。新店/新クラス追加時は3店GASの店舗判定を必ず横串確認。

### BT高松のブランド振り分け＝混合配車禁止（HDM/BUDDICAは車両が物理的に別）
- 高松は同一APP・同一`bt_reservations`にHDM(rent-handyman.com・じゃらん/楽天/スカイチケット/公式)とBUDDICA(buddica-tourism.jp・自社HP/たびらい/エアトリ/RDC)が混在。**ブランドの正本＝`bt_reservations.brand`（トリガー`bt_derive_brand`／じゃらん等→HDM・他→BUDDICA）**。
- **配車ルール（オーナー確定）：予約brandと同ブランドの車両のみ配車。HDM予約→HDM車のみ／BUDDICA予約(HP直販含む)→BT車のみ。同ブランドの空き車が無ければ配車せず"未配車BOX"（HDM車に絶対落とさない）。**
- 実装：`gas_bt_reservation_import.gs`(BUDDICA予約リレー・じゃらん/エアトリ/RDC/site直販)の`autoAssignVehicle_`にブランド絞込追加（予約brandをSELECT→同ブランド車のみfilter・空なら`return ''`）。たびらい`gas_bt_tabirai_import.gs`は共有ヘルパー依存だったので**専用`assignTabiraiVehicle_`(ブランド絞込込み・自己完結)に差し替え**（共有autoAssignVehicle_を触らず他ファイル無影響）。両方クリップボード渡し済(貼付はオーナー)。
- **車両マスターに各車brand設定が必須**（未設定だとHDM予約が「同ブランド車ゼロ→未配車」）。現状HDMは**ハリアー(code=ハリア0000/plate要登録)1台のみ**、他は全てBUDDICA。フィルタは`BUDDICA予約→brand='BUDDICA'/'BT'/空 を許可`（未設定車はBUDDICA扱い）。
- 既存の誤配車(GAS修正前取込)はGAS修正では直らない→手動付替え。R0TWIKDO(HDM)をBUDDICAハリアー(1729)→HDMハリアー(0000)に付替え済。過去日の混合(返却済)は運用影響なし＝放置(台帳汚さない)。「配車表が変わらない/BT車のまま」報告は、まず`bt_reservations.brand`と`bt_fleet`の車両brandを実データ照合。

### welcome(予約完了メール=マイページ+お礼)の60日窓を撤廃＝日程無関係で送る（オーナー指示）
- `hdm-tkm-enqueue`(BT project・pg_cron 15分)がじゃらんHDM予約に各通知をenqueue→`hdm-tkm-send-mail`(MODEゲート・現`live`)が実送信。**welcomeトリガーは`()=>true`だが、クエリ窓が`start_date<=今日+60日`で先の予約(例12/27)を対象外にしていた**（オーナー未承認のハードコード値）。→ `index.ts` L77を`+60日→+730日(実質無制限)`に拡張。他トリガー(reminder/remind/damage/thanks)は各自のd2s/d2e条件でゲートされるので窓拡張の影響はwelcome(()=>true)のみ。BT project(ggqugvyskyiblxiycpci)にデプロイ済＋手動起動でR0TWIKDO(12/27)にwelcome積載確認。**welcome=「ご予約ありがとうございます｜マイページのご案内」＝マイページ+お礼が1通**（別途thanksは返却後d2e1-3の利用後お礼で別物）。
- **MODE確認法**：`hdm_tkm_notifications`のkind別sent集計＝welcome sent=true多数&実顧客メール宛→MODE=live稼働中と判定できる。テンプレは`hdm_tkm_templates`(単一ソース)。

### HDMじゃらんの決済フロー（個別Squareリンク・カード事前決済・段階催促）
- じゃらん取込時のみ`importOta_`→`sendOtaGuidePayment_`が**予約1件ごとに専用Square決済リンク(quick_pay・`square.link/u/…`)を発行**（品目に予約番号/氏名/期間/金額）＝共通リンクでなく1予約1リンク。カード事前決済。`bt_reservations.pay_url`＋`bt_jalan_payments`に記録。
- **顧客への送信**＝welcome/reminderメールに`{payblock}`(決済案内文「【事前決済のお願い】…お支払い金額…出発2日前19:00まで」)で決済リンク同梱。未払いなら4日前/2日前/前日リマインドで再催促＝**段階的に事前決済を促すフロー**。出発3日以内未払いは毎朝9時`checkBtUnpaidAlert`が🚨を#operation-高松空港店(C0BFMBLEJGZ)へ。
- **入金確認通知**＝`checkBtPayments`(10分毎)がSquare Orders APIを予約番号突合→入金検知→paid化＋「✅入金確認【じゃらん｜HANDYMAN高松空港店】」を**#operation-高松空港店(C0BFMBLEJGZ)**へ。実データで4件paid自動検知を確認＝稼働中。キャンセル時は入金済→🔴要返金確認/未入金→決済リンク停止。**決済/返金/入金通知はじゃらん(HDM)限定**（エアトリ/RDC/たびらいは決済対象外＝通知なし）。Square location=L8N7J9RKPN3WH。

## 🕒 2026-09-02 マイページ お届け(DEL)場所・時間変更に締切追加＝貸出前日19:00で受付終了(EF handyman-mypage・SPK)
オーナー(武山)要望「翌日のお届け場所・時間を前日の営業時間外以降に申請不可に（前日夜に翌営業日1発目のタスクを気軽に変更されると困る）」。**お届け(DEL=del_place/lend_time)の変更申請は貸出前日19:00で受付終了→以降は`lineOnly:true`(409)で「公式LINEにて承ります」誘導**。締切=既存`pastOptionDeadline(r.lend_date)`(貸出日0:00の5h前=前日19:00・シートオプション締切と同一ロジック)を流用。**回収(COL=col_place/return_time)は据え置き＝承認制・時間制限なし**(DELのみゲート・update handler L742)。フロント`my.html`は`lineOnly`対応済(closeSheet+toast・L1021/1146)。EF正本`~/spk-task/line_auto/handyman-mypage/index.ts`→`~/hdm-car-delivery/supabase/functions/`にcp→`functions deploy handyman-mypage --no-verify-jwt`。本番E2E検証済(貸出日=当日の予約でlend_time変更→lineOnly 409・DB書込前のreject経路)。my-admin.htmlマニュアルのUSER受付ルール表も現行仕様に更新済。⚠️Supabase PAT(`~/.config/keydrop/sb_token`)は失効する→`supabase.com/dashboard/account/tokens`でGenerate new token(GitHub 2FA=オーナーのみ)→保存で再開。**注意＝2026-08-21時点で「時間・場所変更は時間制限なく全て承認制」だったが、DELのみ2026-09-01/02に前日19:00締切を追加＝COLとDELで受付ルールが非対称**。

## 🚗 2026-08-30 公式サイト(rent-handyman.com)予約が「札幌だけ予約処理に失敗」＝RPCが存在しない`memo`列を参照（那覇/高松は成功）
BUDDICA齋藤テスト報告：公式サイト予約フローで**那覇・高松はPC/スマホとも決済・確認メール・APP遷移まで成功、札幌だけ「予約処理に失敗しました」で決済完了できず**。真因＝`official_book_spk` RPC の insert が **`reservations` に存在しない `memo` 列を参照**→`ERROR: column "memo" of relation "reservations" does not exist`。**那覇は`nha_reservations`に`memo`列があるので成功、札幌`reservations`には無いので失敗**（同型RPCでもテーブル差で片方だけ落ちる）。→ 根治：`official_book_spk`のinsertから`memo,v_note`を除去（reservationsに顧客memo列なし・del_place/col_placeで場所は保持）。RPC適用はManagement API `/database/query`(token`~/.config/keydrop/sb_token`・curl `--data-binary @file`)。**切り分けの型＝RPCを直接テスト実行(`select official_book_spk(jsonb_build_object(...))`)すれば実際のSQLエラー(列不在等)が即出る**（EF越しの「予約処理に失敗」だけ見ても分からない→RPC直叩き）。実証：修正後A×2日+NOC+child=¥31,500で採番成功→テスト予約削除。反省＝**3店同型でもテーブルのカラム差(reservations vs nha_reservations)で"片方だけ動く"→新RPC/insertは対象テーブルの実カラムを必ず確認**。残(別件・非ブロッカー)＝齋藤指摘のシート料金(チャイルド1100/ジュニア550)と現地サイト表記の差異は要すり合わせ。

## 📧 2026-08-30 予約が取り込まれない＝取込GASの「失敗でもseen登録→二度と再取込されない」穴を根治（クラス根治・全店点検の型）
オーナー報告「札幌 DY00000001108(skyticket)・高松 137068718(たびらい韓国語) が取込されてない・全店至急確認」。**真因は2系統・切り分けの型が有効**：
- **SPK skyticket DY00000001108**：SPK GASは30分毎`processNewEmails`稼働・エラー率0%＝**停止ではなく単発取りこぼし**。根本＝`gas-email-import-v2.gs`の`processNewEmails`ループが**`processMessage_`の結果が失敗/エラーでも`newProcessedIds.push(msgId)`で一律seen登録**→**取込失敗した予約は"処理済み"扱いで二度と再取込されない**（transient insert失敗/parse差で1回落ちると永久消失）。→ **根治：失敗(type=failure)/catchはseen登録せず次回再取込（`FAILED_MSG_RETRIES`で最大`MAX_IMPORT_RETRY=4`回≒2時間リトライ、上限で諦めseen＋Slack通知）。成功/キャンセル/非予約は即seen。** これでtransient失敗は自己修復。**⚠️GASはApps Script貼付＝オーナー手動デプロイで初めて本番反映**（クリップボードにコピー済で渡す運用）。
- **BT たびらい137068718(韓国語carkr@)**：ローカルパーサーは最新で正常解析(実テストでcls=C/日付/¥36300/完全性PASS)＝**コードは正しく未取込＝GAS未デプロイ**（韓国語carkr@・년월일/엔 対応版が本番未反映）。→ オーナーが`gas_bt_tabirai_import.gs`貼付＋`setupTabiraiTrigger`実行で復旧（"既存skip"で手動取込分と重複しない）。
- **全店健全性の切り分け＝各店 reservations の最新`created_at`**：NHA=最新(健全)/SPK=単発漏れ(GAS自体は稼働)/BT=未デプロイ。「取り込まれてない」報告は①該当予約が`{store}_reservations`に在るか②各店の最新created_atで"GAS停止か単発漏れか"を切り分ける（NHA/SPKは独立GAS）。
- **手動取込の型（curl・python DNS wedge時）**：`{store}_reservations`+`{store}_fleet`挿入(既存OTA行からスキーマ写経)→空車は同クラスactive×期間重複なし→Slack(SPK=#sapporo_reservation C08TDTPEB36/HANDYMAN bot、BT=#app予約取込-高松 C0BFDJ1HRC3/BUDDICA bot)。**⚠️python urllibがDNS wedge(getaddrinfo失敗)する時があり→curlは通る**。SPK reservations INSERTはログイン(authenticated)トークンで可、BTはservice_key。

## 🚗 2026-09-01 BT高松 車両ブランド(HDM/BUDDICA)分離＝別セッションの未完コードでクラッシュ→検証して根治(v1.0.378-BT)
高松はHDM(HANDYMAN高松/rent-handyman.com)とBUDDICA(buddica-tourism.jp)の2ブランドが同一APP・同一`bt_reservations`に混在＝運用車両が物理的に分かれ混合不可→車両/予約をブランドで分離。別セッションが実装したが**未完のまま引き継ぎ**、CLI(私)が仕上げ。
- **引き継ぎドキュメントの記載と実態が食い違っていた(教訓)**：①「本番デプロイ済み(BASE_V=1.0.368/commit 8a3c9f2)」→実際は**appリポに該当コミット無し・app.jsにブランドコード0・未コミットのままliveに出ていなかった**(source index.html.bakにのみ存在) ②「安全弁`_anyHdm`実装済み」→**コードに存在しなかった**(HDM予約が未配車化する穴) ③「368に上がらない=SW居座り」→**誤診**(そもそもliveにコードが無いだけ)。**並行編集(私のinbound/procurement/badge commitと衝突)でブランドapp.jsがpushされず埋没していた**。
- **仕上げ根治**：(a)未コミットのソース(全機能=ブランド分離+inbound+在庫バッジ が共存)を確認しビルド→コミット→push (b)デプロイ後**配車表がクラッシュ**(`ReferenceError: brandView is not defined`)＝FleetTimelineが`brandView`/`setBrandView`を使うのに**useState宣言が抜けていた**→宣言追加 (c)`_anyHdm`安全弁を新規実装(`vehicles.some(v=>normBrand(v.brand)==="HDM")`＝HDM運用車0台の間はbrandOk常時true=絞込OFF=副作用ゼロ) (d)**実ブラウザ(Chrome MCP)で配車表描画・全体/HDM/BTトグル動作・コンソールエラー0を検証**してから完了。v1.0.378-BT。
- **実装要素(index.html.bak)**：`resBrand(r)`4334/`normBrand`4337/`BrandBadge`(HDM=紺#1e3a8a/BT=緑#047857)4338。車両フォームL4798「所属ブランド」select(BUDDICA/HDM)。autoAssign 4291〜`brandOk`+`_anyHdm`。FleetTimeline `brandView`state+全体/HDM/BTトグル(L16587)+未配車brandView絞込。DB=`bt_vehicles.brand`(全19台BUDDICA仮)＋`bt_reservations.brand`(BUDDICA73/HDM9・トリガー`bt_derive_brand`)。
- **教訓**：①別セッションの「完了・デプロイ済み」報告は鵜呑みにせず、**appリポの実コミット・live app.jsの実内容・実ブラウザ描画で裏を取る**(handoffは3点とも誤り)。②`~/buddica-touring`(外側=GAS/EF)と`~/buddica-touring/app`(内側=GitHub Pages app・別リポ buddica-touring/app.git)は**別git**＝appの状態は必ず内側リポで見る(外側でlog見ても別物)。③React stateは`useState`宣言必須＝`brandView`のような使用のみで宣言漏れは実行時`ReferenceError`(node --check=構文はOKでも通る)→**実ブラウザ描画+console確認が最終検証**。④並行編集はcommit前に`git fetch`+状態確認(私のcommitが相手のapp.jsを上書きし埋没させた)。
- **追加修正2件(v1.0.379/380・実ブラウザ検証済)＝ブランドコードの"未完"はまだあった**：①**配車表トグル(全体/HDM/BT)が画面を変えない**＝`brandView`が未配車リスト(L16615)だけに効き、車両行を作る`groups`useMemo(L16575)に絞込が繋がっていなかった→`allItems`を`brandView==="all"||normBrand(v.brand)===brandView`で絞込＋deps追加。②**BTバッジが出ない(HDMだけ出る)**＝車両行のバッジが`normBrand(v.brand)==="HDM"&&<BrandBadge brand="HDM">`とHDM固定条件だった(L16732)→`normBrand(v.brand)&&<BrandBadge brand={v.brand}>`で両ブランド表示(HDM=紺/BT=緑)。Chrome実機でHDMトグル→HDM車1台のみ表示・全車に緑BTバッジ を確認。教訓＝別セッションの"全体/HDM上下分割・バッジ表示"等の主張は**部分的にしか実装されていない**(トグルUIは作ったが車両行に配線せず、バッジもHDM専用ハードコード)→機能ごとに実機で挙動確認が必須。
- **追加(v1.0.381)＝全体ビューの縦割り表示を実装(オーナー要望・モック提示)**：全体タブ選択時、配車表を **BUDDICA(BT・緑)を上／HDM(紺)を下** のブランド2セクションに縦割りし、境界に大ヘッダー(🟢BT／BUDDICA運用車・🔵HDM／HANDYMAN高松運用車)を表示。`groups`useMemoを`mk(brand)`でブランド別に生成→全体は`[...mk("BUDDICA"),...mk("HDM")]`／単独タブは`mk(brandView)`。BUDDICA/HDMで同一クラス(例F)が両方に出るため**`_key=brand+"|"+type`で一意化**(react key衝突・collapse state・toggleClass を全て_key基準に)。未設定brandはBUDDICA側に寄せる(消えない)。境界検知＝`gi===0||groups[gi-1]._brand!==g._brand`。Chrome実機で BUDDICA上(全クラス緑BT)→HDM下(F=ヤリスクロス3574・紺HDM) の縦割りを確認。
- **残(オーナー)**：各車両に実態の所属ブランド(HDM/BT両方)設定→分離ON／GAS3本(jalan=HDM/tabirai=BT/汎用)デプロイ／manual.html更新。

## 🚗 2026-09-01 札幌 G_SPK予約がFに誤配車（新クラス未対応＋GAS未デプロイ）＝「コード直しただけで根治と報告」の再発を実証で潰す
オーナー(武山)報告「G予約がFに振り分け・前も"誤りない"と言い切ったのになぜ今更」。**真因＝本番GAS「札幌予約メール自動配車」のクラス判定が旧版**。Gは後発の新クラス(コンパクト=デミオ/ノート・プラン`☆コンパクトカー_G_SPK☆`)で、旧パーサーは`[ABCSFH]`のみ→G_SPKが全部外れ最後のキーワード保険で"コンパクト"→Fに落ちソリオ自動配車。**コード修正は8/25 commit 8b06b82で`extractVehicleClass_`を`[ABCSFHG]`に済んでいたが、GASはApps Scriptに貼るまで本番反映されない→旧版のまま誤配車継続**＝これが「今更」の正体。
- **検証(実証・記憶や言い切りでなく)**：①`extractVehicleClass_`をnode実行→`G_SPK`→G/`☆コンパクトカー_G_SPK☆`→G/`F_SPK`はF（誤爆なし・m2 `/^([ABCSFHG])[_]/`がG_のGを先取り、`_SPK`のSに誤マッチしない）②`vehicles`全件監査→SPK実在クラス=A/A2/B/B2/C/F/G/H/S の9つ＝`[ABCSFHG]`+A2/B2でフル網羅・他に欠落クラス無し(D等は無い)③本番DBで誤配車3件(R0KNIDO2/C260900022/R0G2AJSM)がG/デミオ6864に是正済を確認。
- **恒久解＝本番GAS貼付(オーナー作業)。貼るまで次のG_SPKも誤配車**。
- **全媒体でGクラスあり（2026-09-01 オーナー確定・記憶）**：札幌のGクラス(コンパクト=デミオ6864/ノート6906)は**じゃらん・楽天・skyticket・エアトリ・HP公式・Slack手動 の全媒体**に存在する（じゃらん/エアトリ限定ではない）。全パーサーがG対応済みを検証（`extractVehicleClass_`＝`[ABCSFHG]`／楽天`/プラン[_]([ABCSFHG])/`／公式`/([ABCSFHG])クラス/`＋A2/B2／Slack`validClasses=['A','B','C','S','F','H','G']`）。Gなし旧`[ABCSFH]`の残骸ゼロ。**レンタカードットコム(RC)/GoGoOutは札幌に無い＝対象外**。KEYDROPはGAS取込でなく直販フロー(顧客がクラス選択)＝別経路。新クラス追加時は全媒体パーサー＋Slack validClassesを必ず更新。
- **教訓(最重要・再発防止)**：①**GAS系は「コード修正」≠「根治」。本番Apps Scriptに貼付され、実取込でGで入るまで完了と言わない**（動作確認してから完了報告＝鉄則の違反だった）。②新クラス/新プラン追加時はOTAメール取込パーサーの文字クラス(`[ABCSFHG]`)を必ず更新＋全クラスをvehiclesと突合して網羅確認(1クラス足すだけで満足しない)。③「誤りない」と言い切る前に、対象範囲(当時はG未登場)が今後拡張し得るかを疑う。④横展開：NHA/BTのOTA取込パーサーにも同型の"新クラス未対応"リスク→クラス追加時は3店のGASを確認。⑤本番GAS未デプロイの検知は安全網(pg_cronで『プラン名_G_SPKなのに配車F』を検知→Slack)で早期発見可(未実装・オプション)。

## 🔧 2026-08-31 BT「稼働/除外トグルを押しても未稼働にならず戻る」根治＝bt_vehicle_monthly_kpiのスキーマ違い（BTのみ）
BUDDICA(BT)配車表の車両ラベルの稼働/除外トグル(`toggleKpi` index.html.bak L16339)を押しても保存されず元に戻る。**真因＝BT projectの`bt_vehicle_monthly_kpi`だけスキーマが誤り**：正しくは`(vehicle_code,year_month,active)`(SPK/NHAと同型・PK(vehicle_code,year_month))なのに、実体は`(store_id,ym,data jsonb)`のスナップショット型だった→アプリの`upsert({vehicle_code,year_month,active},{onConflict:"vehicle_code,year_month"})`が列不在＋onConflict不一致で毎回エラー→DB未保存→再fetchで戻る。**修正＝空テーブル(0行)だったのでDROP&正しいスキーマで再作成**(PK+RLS authenticated・upsert実証)。アプリ改修不要・BTアプリ開き直しで反映。**SPK/NHAは正しいスキーマで問題なし(確認済)**。教訓＝①「トグルを押しても戻る」はまずDBに新値が書けているか(onConflict用のunique/PK制約)を疑う。②３店同機能でも各storeのテーブルスキーマ(列名/PK)が食い違うと片方だけ壊れる→onConflict指定列に一致するunique/PKが実在するか実DBで確認。③別途未対応＝BT projectに`monthly_snapshots`が無い(saveMonthlySnapshotがmonthly_snapshotsへ書く)→BTのsnapshot保存/参照は別途要作成(今回の稼働トグルとは別問題)。

## 🚗 2026-08-29 レンタ車両/進捗管理ツール（BUDDICA高松の仕入候補パイプライン・新規構築）
**用途＝高松30台入替の仕入候補（buddica.jp中古車）を複数担当がリアルタイム共有で管理**。オーナー要望を1セッションで積み上げ構築。
- **URL（独立配布・ログイン不要・複数人同時）**：`https://buddica-touring.github.io/app/procurement.html`（`~/buddica-touring/app/procurement.html`・単一HTML・vanilla・**buildなしpush即反映**・GH Pagesは`?cb=`で確認）。
- **DB＝BT project(ggqugvyskyiblxiycpci) `bt_procurement`**（1車=1行・anon full RLS・Realtime公開）。列＝no/model/vclass(クラスA〜J)/year/mileage/price/color/location/inquiry(お問合せコード)/url/status(仕入)/maint_status(整備)/pickup(現場引き取り)/insurance(保険登録)/sort_order。
- **自動取得EF `buddica-scrape`(BT・--no-verify-jwt)**：buddica.jp詳細ページから 車種(title)/年式/走行(万km)/価格(本体価格 万円)/カラー/展示場所/お問合せコード(問合せコード or zaiko末尾10桁)/**SOLD OUT判定**(本体価格欄がSOLD OUT)を抽出。CORS回避のためEF経由。ボット制限なし(UA付きcurl可)。
- **自動パトロールEF `procurement-patrol`(BT)＋pg_cron `procurement-patrol`(jobid23・6時間ごと`0 */6 * * *`)**：全URL再チェック→SOLD OUTになったら仕入ステータス自動NG＋価格更新→新規SOLD OUTは #operation-高松空港店(C0BFMBLEJGZ)へSlack通知。secrets=CRON_SECRET(hdm_tkm_cron_secret)/SLACK_BOT_TOKEN(BUDDICA・plist)/SLACK_CHANNEL。手動🚨パトロールボタンも有。dry=`?dry=1`。
- **機能**：①「＋URLで追加」に複数URL改行貼付→自動取得一括登録(重複=zaiko_codeで処理済アラート＋該当行フラッシュ) ②クラスA〜J選択で同クラス並び替え＋上部にクラス別「📌ピック/✓確定(仕入OK)」数(折りたたみ・スマホ既定クローズ) ③進捗＝仕入OK→整備→現場→保険 の順に列が出現(条件表示) ④SOLD OUT=赤バッジ+赤帯 ⑤ダッシュボード(確保OK/30・候補未決・NG除外・追加ピックアップ必要=30−OK−候補) ⑥スマホ折りたたみ(車種名+URLだけ→▼展開)＋右下フローティング🔄更新ボタン ⑦お問合せコード/URLは📋コピー ⑧CSV出力・目標台数変更。
- **🔴データ整合(不特定多数対策・LEDGER-ONE準拠)**：保存は「変更したその1項目だけ」を書く(丸ごと再保存しない)・保存中フィールドは他人のリアルタイム更新から保護(pending Set)・リアルタイムはフィールド単位マージ(全置換しない)・保存失敗は自動巻き戻し。**自動取得項目(車種/年式/走行/価格/カラー/展示場所/コード/登録済URL)は編集不可の表示専用**、編集可はクラス/各ステータス/空行URLのみ＝誤操作でデータが動かない。🔰サンプル行(model先頭🔰 or 'サンプル')は集計から除外。
- **教訓**：①buddica価格は「本体価格 172.8万円」表記/走行「6.2万km」＝ページ表記どおり抽出(内部に別価格が残るので誤取得注意) ②SOLD OUTは`本体価格[^0-9]{0,30}SOLD OUT`で判定(内部の在庫価格を拾わない) ③15列を1画面に収める=見出し短縮+table-layout:fixed+列幅圧縮+wrap幅拡張。EF操作はManagement API=curl必須(urllib 403)。

## 🚗 2026-08-28 NHA HP予約のクラス取込ミス根治＝ミニバンは"車種別"にクラスが違う（M/H一律でない・GAS総称マッチのバグ）
オーナー報告「PKE84810(小塚みゆき・10/12-14)が那覇配車におらず、8387アルファードMに自動配車＝意図しないアップグレード」。台帳(audit_log)で確定＝**手動振替でなく自動配車(fleet INSERT actor_id=null)**。真因＝NHA取込GAS `gas-email-import.gs`(3箇所:officialMap L376/officialClassMap L621/regex L1470)が**`セレナ→B`・`ノア→B`の総称マッチ**で、`セレナM(D)`/`ノアM(D)`を区別せずBに誤判定→Bとして自動配車された。
- **🔴 NHAミニバンのクラスは"車種名まるごと"で決まる（M/Hの一律ルールではない・オーナー確定）**：`アルファードH→A`／`アルファードM→B`／`セレナH→B`／`セレナM→D`／`ノアH→B`／`ノアM→D`／`エスクァイア→D`。**"M"はアルファードだけB、セレナ/ノアはD**＝一律化禁止。車両マスター実体＝B群(ALM=アルファードM/VOX/NOH=ノアH/VEL/SRH=セレナH)・D群(ESQ=エスクァイア/NOM=ノアM/SRM=セレナM)。
- **根治**：3マップに**総称より長い専用キー**`アルファードM→B`/`セレナM→D`/`ノアM→D`を追加（officialMap/officialClassMapは`Object.keys().sort(長い順)`で照合＝長いキー優先で効く。regexはif先頭に専用チェック挿入で先勝ち）。node検証済(セレナMクラス→D等 全7パターン正解)。**GASはApps Script「那覇店 予約取込」へ貼付＝オーナー手動デプロイで次回取込から有効**。該当予約はvehicle_class B→D訂正＋配車解除(未配車バナーへ・手動でセレナ割当)＋タスクの旧No(8387)クリア済。
- **教訓**：OTA/HPのプラン名→クラス変換は「セレナ」等の総称マッチだと、上位/下位グレード(M/H)を同一視して誤クラス→誤自動配車(=意図しないアップグレード/ダウングレード)になる。**車種名で区別すべき車両は専用キーを総称より優先させる**。「配車表におりません」報告は、まず予約DBの`vehicle_class`実値を確認(取込クラスが正しいか)＋fleet INSERTのactor_id(null=自動/uuid=手動)で"手動アップグレードか自動ミスか"を台帳で切り分ける。横展開＝SPK/BT GASにも総称マッチ(車種名→クラス)があれば同種の誤判定リスクを確認。

## 📧 2026-08-27 高松たびらい「また取り込めない」根治＝パーサーが括弧なし日本語形式を落としていた（GAS再デプロイ要）
オーナー「たびらい香川 佐竹創様(137068689)が取り込めない・Slackも動いてない」。**真因＝`gas_bt_tabirai_import.gs`のパーサーが「（お名前）」「車両料金）」等の"括弧付き"ラベル形式しか対応せず、佐竹メールの「お名前：」「車種：」「合計　：」等の"括弧なし日本語プレーン形式"を name/cls/金額とも拾えず→完全性ガード(name/cls/date/amt必須)でskip**（韓国語=括弧付きの137068683は取込成功＝形式差で片方だけ落ちていた＝「また」の正体・クラスバグ）。
- **根治**：全ラベルの括弧を任意化 `[（(]?ラベル[）)]?\s*[：:]`（name/kana/mail/tel/乗車人数/車種/クラス名/車両料金/オプション料金/合計/出発店舗）。佐竹メールで解析検証OK(name=佐竹創/cls=G/¥16800/完全性ガード通過)。commit（buddica-touring）。**⚠️GASはApps Scriptに貼付＝オーナー手動デプロイで初めて次回から自動化**（コード修正だけでは本番の旧パーサーが動き続ける）。
- **即対応**：佐竹様(9/26-28・G・¥16,800・事前カード決済済)を**手動でbt_reservations取込＋Gクラス空車ヤリス1018(3575)へ配車（重複チェック済）＋#app予約取込-高松空港店(C0BFDJ1HRC3)へSlack**。GAS再取込は`id=eq.`スキップで重複しない。
- **手当ての型（BTたびらい/OTA取込漏れ）**：①`bt_reservations`未取込を確認②`bt_vehicles?type=eq.<クラス>&active=eq.true`＋期間重複(`bt_fleet`×重複予約)で空車判定③service_key(`~/.config/keydrop/bt_service_key`)でbt_reservations+bt_fleet挿入(GAS importTabirai_と同一スキーマ)④BUDDICA botトークン(`com.buddica.maint-bridge.plist`のSLACK_BOT_TOKEN)でC0BFDJ1HRC3へ通知。**教訓：OTAメールは同一OTAでも言語/端末(SP/PC)でラベル形式(括弧有無・全角空白)が変わる→パーサーのラベル照合は括弧・空白を任意化して両形式を吸収する（片方だけ通ると"たまに取り込めない"が恒常再発）。**

## 🕒 2026-08-27 その他タブ生成のDEL/COL手動タスクで時間/場所が「何度設定しても--:--に戻る」根治（v4.7.586）
オーナー報告（#operation札幌）「その他より生成したCOLタスクの時間が何度設定してもリセット」。対象＝マサト コジマ（延長）COL・`_id=other_1787811282956_u0u9s7`・`manual:true`・`reservation_id空`。**DB実データ確認＝`time`が空＝設定した15:00が一度もDBに書かれていない**（2026-07-16「保存が未発火」型の切り分け＝新値がDBに無い）。
- **真因＝`_toDbTaskBare`(L395)のSTEP3 leg空化**：type∈DEL/PU/PUB/来店/COL/BD/BDB/返却 なら「時間/場所は予約から導出する」前提で、`timeChange/_ssTime/_manualTimeAt`（時間）・`_placeSource/_ssPlace`（場所）マーカーが無いとDB書込時に**time/placeを`""`に潰す**。その他タブ&マスターの手動タスク時間ピッカーは`updateOtherTask(t._id,{time:v,timeChange:""})`で保存する（timeChangeを空にする）ため**毎回leg空化に引っかかり値が捨てられる**。手動COL/DELは`reservation_id`空＝導出元の予約も無いので永久に`--:--`（場所も同じ理由で「場所未確定」化）。
- **根治**：leg空化を**「予約に紐づく本物のleg＝`t.reservationId`有り かつ `!t.manual`」だけに限定**（time/place両方に`&&t.reservationId&&!t.manual`を追加）。本物の予約legは従来どおり空化→予約導出、手動タスクは自分のtime/placeを保持。→安全（genuine legはmanual=false&reservationId有りで挙動不変・手動タスクだけ修正）。
- 該当タスクは意図値15:00をDB直接補正で即時解消。**教訓：STEP3/STEP2の「予約から導出」系のleg判定は必ず"予約に紐づくか(reservationId)"でゲートする。type名だけで判定すると、その他タブ発の手動DEL/COL（予約なし）の値を消す。「保存しても戻る」はまずDBに新値が書かれているか(空か)を実データで見る＝一発で切り分く。**
- **🔁横展開 完了（3店）**：NHA/BTも**完全同型**のleg空化を確認し同修正済。NHA=`_toDbTaskBare`(L295)＋`_toDbTask`(L494)の両方に時間/場所の空化があり（SPKはBareのみ・NHA/BTはtoDbTaskにもインライン）4箇所ずつ`&&t.reservationId&&!t.manual`ガード追加。BT=同型(L355/L501)。NHA v3.5.357／BT v1.0.365／SPK v4.7.586。教訓＝日本語列でも空化ロジックは全店同一文字列＝`grep '_toDbTaskBare'`で横串確認できる。この種の「予約から導出」系leg判定は3店必ず横展開。

## 🔁 2026-08-27 「表示が変わってない＝前に直したはずが再発」報告の切り分け型＝まず"デプロイ時刻 vs 報告時刻"＋live app.jsハッシュ照合（キャッシュ古版の誤診防止）
NHA号1受付＝タスクサマリー種別バッジが2件で「来店」誤表示・スタッフ『再発』。CLIで台帳/実データ確認した結論＝**再発でなくキャッシュ古版**だった。切り分けの型（再利用）：①**実データでDBが汚れているか確認**（`nha_reservations`の`visit_type`/`return_type`）→①R073WOOQ=DEL/BDB②JP47C2826070JC47=PUB/返却＝**汚染なし**（報告の「visit_type=来店のまま」仮説は外れ）。タスク(`nha_tasks`内容)もd-=DEL/PUB・c-=BDB/返却で正常。②**コード導出を実データで追う**＝サマリーは`t.type`を表示、`t.type`は`_fromDbTask`(L495)が予約visit_typeから導出（複製ドリフト根治v3.5.356）→①→DEL②→PUBを返す＝正常。③**デプロイ時刻 vs 報告時刻**＝根治コミット4a9cea3(v3.5.356)は**13:35**push済、報告は**13:41**＝6分後。④**本番反映の確定＝live app.jsのハッシュ照合**：`curl live app.js`と手元repoの`shasum -a256 app.js`が完全一致（BASE_V=3858一致）＝本番は根治ビルド。→ スタッフは古いキャッシュ版を見ていただけ＝**ハードリロード/開き直しで解消**。**教訓：①「再発した」報告は、まずDBが実際に汚れているか（正本の値）を実データで確認し、コードの導出も実データで追う（推測で断定しない＝FIR99934の轍を踏まない）。②DB/コード正常なら"デプロイ時刻 vs 報告時刻"＋live app.jsハッシュ照合でキャッシュ古版を切り分ける（NHAはsw.js無効・BASE_Vキャッシュバスト＝ハードリロードで最新取得）。③号機の「visit_type汚染の疑い」等の仮説は出発点であって断定でない＝必ず実データで裏を取る。** 号1スレッド(th 1787802028.523959)へ完了報告済・受付74b4f661クローズ。

## 🔢 2026-08-27 高松 在庫調整「未対応0なのにTOPバッジ3が残る」根治＝バッジ用invStatusをrealtime購読化（BT v1.0.364）
オーナー報告（2日連続）。真因＝TOPタイルの在庫調整バッジは`btInvTodoCount(data,invStatus,maintenance)`で算出するが、`invStatus`(bt_inventory_status)が**初回DBロード時に一度だけ取得(index.html.bak L21819)で購読が無く**、在庫調整タブ側は独自の`stat`をrealtime購読で常時最新化していた（別ソース）。→ タブで対応完了しても`invStatus`が朝のロード値のまま凍結し、SPAを開きっぱなしの端末ではバッジが古い件数(3等)を出し続けた（ハードリロードするまで直らない）。実データ検証＝BT DBで対象は全て解消済(intake31件全チェック/キャンセル予約は解放済or未reduced)＝真の未対応0＝タブ表示が正・バッジが嘘。
- **根治**：App先頭に`bt_inventory_status`のrealtime購読useEffect(ch=`bt_inv_status_top`)を追加し`invStatus`を常時最新化（タブL25000と同型・mkは5媒体+stock_released）。→ バッジとタブが常に一致。
- **教訓**：**同じ集計値を「一度だけロードした複製」と「realtime購読の正本」の2箇所で持つと必ずズレる**（複製ドリフト）。TOPの件数バッジ/サマリは対象テーブルをrealtime購読して導出する（初回ロードのみは凍結する）。「未対応0なのにバッジN」系はまず"バッジの状態ソースが購読されているか"を疑う。在庫調整タブはBT専用(NHA/SPKに無し)＝横展開対象なし。
- **🔴 2026-09-01 続報＝08-27の購読修正でも「未対応0なのにTOPバッジ1」再発→自己修復化で根治（BT v1.0.376）**：08-27で`invStatus`にrealtime購読(`bt_inv_status_top`)を足したが、そのuseEffectが**deps`[]`＋`if(!sb)return`**でsb遅延時に購読が張られず／**DELETEイベント未処理**で削除済み状態行がstaleに残り／realtime取りこぼしで**invStatusが古いまま凍結**し、バッジ(btInvTodoCount)がDB(=タブ)と食い違う"1"を永続表示した（購読を"足した"だけでは複製ドリフトは消えない＝2つのライブ複製がなお個別に漂流する）。**実データ検証の型（再利用）**：BT DBのbt_maintenance(入庫=車検/半年点検/修理・end>=today)＋bt_reservations(status正規化normResStatus→cancelled)＋bt_inventory_statusを取得し、バッジ関数`btInvTodoCount`と全く同じロジックをPythonで再現→真の未対応件数を算出（今回=予約todo0/入庫todo0＝全30入庫がinv行で5媒体全チェック済＝真値0＝タブが正・バッジが嘘）。**根治3点**：①購読deps`[]`→`[sb]`②realtimeハンドラでDELETE(`p.old.id`)を処理し状態を削除③**TOPを開く度に`bt_inventory_status`をDB再取得する軽量effect(`useEffect(()=>{if(tab==="top")_invReload()},[tab])`)**＝realtime取りこぼしでも"見た瞬間"に必ず現在DB(=タブ=正本)へ再同期＝永続staleを構造的に排除。**一般教訓：件数バッジは「購読を足す」だけでなく"見る画面(TOP)を開く度にDB再取得"して正本へ自己修復させる。ライブ複製を2つ持つ限りdrift余地は残るので、独立計算せざるを得ないバッジは"表示契機での再フェッチ"で正本に必ず合わせる。「一致しない/再発した」系はまずDB実データからバッジ関数を再現して真値を出し、どちらが嘘かを確定してから直す(推測で断定しない)。**

## 📅 2026-08-26 シフトカレンダーの祝日を完全恒久計算に統一（9/15誤祝日を根治・3店横展開）
オーナー報告「札幌シフトで9/15が平日なのに祝日表示（前に直した気がする）」。真因＝祝日が**固定日ハードコード**（`addH(9,15)`等）で、敬老の日/成人の日/海の日/スポーツの日は"ハッピーマンデー"＝毎年動くのに固定していた（2026年は敬老の日9/21で9/15は平日）。**BTは既に動的計算済＝"直した記憶"はBTのこと。SPK/NHAが未対応だった**。
- **恒久修正（4要素すべて動的計算・固定日ハードコード全廃）**：①ハッピーマンデー＝第N月曜（`nthMon=(m,n)=>1+((8-new Date(yr,m-1,1).getDay())%7)+(n-1)*7`）②春分/秋分＝天文近似式`Math.floor(20.8431 or 23.2488 +0.242194*(yr-1980)-Math.floor((yr-1980)/4))`（1980-2099有効）③国民の休日＝2祝日に挟まれた平日（2026年は9/22が該当）④振替休日＝祝日が日曜なら次の非祝日。`5/6`固定も撤廃（振替ロジックが自動生成）。複数年でnode検算済。
- **該当箇所（`jpHolidays` useMemo・同型コードが3店に複製）**：SPK=`index.src.html`（本体出勤簿 ShiftCalendar・L14437付近）＋`spk-task-manager.html`（📋タスク管理 L2111付近）／NHA=`~/Desktop/AI/naha-project/index.html.bak`（L16557付近）。BT=`~/buddica-touring/app/index.html.bak` L15618は既に正しい（触らない）。SPK v4.7.585／NHA v3.5.355。
- **教訓**：カレンダー系の祝日は**固定日でハードコードしない**（ハッピーマンデー・春分秋分・振替・国民の休日は毎年動く）。祝日表示バグは3店に同型複製があるので必ず横展開確認（`grep -rn "addH(9,15)"`）。「前に直した」報告は他店(BT)だけ直っていて当該店(SPK/NHA)が未対応、を疑う。

## 📎 公式サイト（rent-handyman.com）通知・LINE連携・高松2ブランド 設計メモ＝`~/Desktop/HANDYMAN/公式サイト_通知とLINE連携_設計メモ_2026-08-27.md`
公式サイトの通知/LINE連携/高松2ブランド運用の**設計・決定事項・残タスクの正本**。3店の決済/通知/ブランド判定/LINE連携方針/OTA配送/残タスクを1枚に集約。公式サイト関連の設計判断はまずこれを見る（技術詳細は下記の日付項）。

## 🚙 2026-08-27 高松OP「送迎(BD)列に選択された送迎時間を併記」＋テスト予約返金手順（BUDDICA v1.0.362）
オーナー指摘「BD送迎に"選択された送迎時間"が表示されるべき／今は"時間"の箇所が変わるだけ」。**送迎時間(dropoff_time)は予約の返却時間(end_time)と別物＝異なってOK・変更は承認制で可能**（←ここを「返却時間で固定＝変更不可」に直したのは誤りで即revert。**"変更できない"は求めていない**）。
- **真因＝OPマスター表の「送迎」列(cellR(22))は`t.returnType`(=BDの文字)だけ表示**し、お客様が選んだ送迎時間(col_time=dropoff_time)を出していなかった（返却列(21)=予約の返却時間19:00はそのまま）。お迎え(PU/貸出)行にだけ返却/送迎列が出る（`isLend`条件）。c-(BD)行の"時間"列は導出で18:50を出すが、送迎列に時刻が無かった。
- **修正(`buddica-touring/app/index.html.bak`・build要)**：送迎列を`rt==="BD"||"BDB"`のとき`srcRes.colTime||srcRes.returnTime`を併記→**「BD 18:50」**表示（`srcRes`＝同スコープの予約。col_timeはset_returnがdropoff_timeと同値で保存）。返却列(19:00)はそのまま＝返却時間と送迎時間が別で両方見える。
- **教訓**：「◯◯が表示されるべき/変わらない」系は**"表示不足"か"変更不可にしろ"かを取り違えない**。今回は"表示追加"が正で、変更機能(承認制)は温存する。値の意味(返却時刻 vs 送迎時刻)が別なら別々に表示する（片方で上書きしない）。意図が読めない時は憶測で複数回直さず1問確認（今回2回外した反省）。
- **💴 テスト予約(paid)の返金＋削除の型**：Squareトークンはローカルに無く**BT project EFシークレット`SQUARE_ACCESS_TOKEN`**内→一時EF(`bt-refund-oneoff`)をBTにdeploy→`GET /v2/orders/{square_order_id}`でtenders[].id＋amount→`POST /v2/refunds`(全額)→**使用後に必ずEF削除**。DBは`bt_fleet→bt_tasks→bt_reservations`の順で削除。location=L8N7J9RKPN3WH(北海道銀行*670)。返金status=PENDINGは正常。ガードはbody secret=`~/.config/keydrop/hdm_tkm_cron_secret`、invoke apikey=`bt_service_key`。

## 🚐 2026-08-26 高松空港店 公式サイト予約→決済(Square)→BUDDICA配車→マイページ自動送信（新規構築・稼働）
HANDYMAN公式サイト(rent-handyman.com＝`handyman-official`リポ／staging=spk-task `official-*.html`)の**高松空港店 予約フロー**を KEYDROP同型で構築。「各店→各APP直結」＝那覇→nha_reservations／札幌→reservations（MAIN・既存official-pay）／**高松→bt_reservations+bt_fleet（BT DB ggqugvyskyiblxiycpci）＝BUDDICA APPが直読み**。
- **予約RPC `bt_book_tkm(p jsonb)`**（BT project・`~/buddica-touring/sql/bt_book_tkm.sql`）＝総額サーバ確定＋空車確保（同クラスactive車両で期間重複なしを1台→bt_fleet・**満車ならsoldOut＝ダブルブッキング防止**）＋pending_payment作成。価格は**RPCにハードコード**（BT price master 2026-07が全0のため）：日額 A15000/C11000/D9000/E7500/F6500/G5500/H5500・補償 basic¥0/cdw(免責)¥1,100/noc(フル)¥1,650・シート¥550/個日・USB¥0・日数=返却−貸出(最小1)。id=`HDMT`+YYMMDD+4桁。
- **決済EF `official-pay-tkm`**（BT projectにデプロイ・`--no-verify-jwt`・`~/buddica-touring/supabase/functions/`）＝token受領→bt_book_tkm→**Square即時課金**→成功で status='確定'/paid=true/square_order_id→**確定メール(rent-handyman.com・my-tkm.htmlマイページURL封入＝②を一体化)**＋Slack→失敗でcancelPending(配車解放・status=cancelled)。
- **予約通知チャンネル（各店・オーナー確定2026-08-26）**：札幌=`#sapporo_reservation`(C08TDTPEB36)／那覇=`#okinawa_reservation_notification`(C06KZ56NTDF)／**高松=`#reservation_notification-高松空港店`(C0BFKEL4D1Q・BUDDICA WS・予約専用＝#operation-高松C0BFMBLEJGZとは別)**。official-pay-tkmの予約完了/キャンセルはC0BFKEL4D1Qへ（BT_SLACK_BOT_TOKENでBOT在籍確認済）。
- **🔴 公式サイトのカード決済はHTTPS証明書必須**：Square Web Payments SDKは`isSecureContext=true`(有効HTTPS)でないとカードiframeを描画しない＝証明書未発行だと「カードフォームが出ない」。rent-handyman.com(handyman-official)はGitHub Pagesのcert発行待ちだと決済不可（cert発行後にhttps_enforced=ON）。検証は有効HTTPSの`nosh2318.github.io/spk-task/official-flow.html`で可（コードは正常＝card iframe attached実証済）。cert状態＝`GET api.github.com/repos/nosh2318/handyman-official/pages`のhttps_certificate.state。
- **Square＝KEYDROPと完全同一口座**：location `L8N7J9RKPN3WH`＝「Rental car Shop HANDYMAN」＝**北海道銀行 普通*670**（Square API /v2/locations で確定。もう1つ L8Q5E50YG6M7K=札幌デリバリー専門店は銀行未登録）。トークンはBT projectのsecret `SQUARE_ACCESS_TOKEN`/`SQUARE_LOCATION_ID`に設定済（MAINのkeydrop-payと同一値）。
- **② マイページ**：`my-tkm.html?t=<mypage_token>`（mypage_tokenはbt_book_tkmが生成）→ EF `handyman-mypage-tkm` の **`action:"lookup"`（既定）** で予約取得（`mypage_token=eq.`のみで絞る＝source/ota無関係でhdm_tkmも表示）。⚠️`action:"page"`は unsupported。実データE2E検証済。
- **official-flow.html**：`payWithCard`で `area==='takamatsu'`→BT endpoint(`official-pay-tkm`)+BT anonへ分岐（旧：高松がnhaに誤ルート）。Square SDKのlocationは全店 L8N7J9RKPN3WH（同一口座）。
- **🔴 official-*ページのTOP戻りは必ず `index.html`**：本番(rent-handyman.com=handyman-official)のTOP＝index.html。`official-design.html`はhandyman-officialに存在せず（design→index にcopyしてデプロイ）＝リンクすると**404**。official-tkm-faq/airport/contact/flow/bus/insurance/vehicles 全て index.html に統一済。
- **デプロイ2リポ**：spk-task(staging)で編集→`official-design.html`→`handyman-official/index.html`、他official-*はそのままcp→両push。
- **残（本番ON前）＝実カードでの少額テスト1回**（成功課金→確定メール→マイページ→配車表 の実地確認）。EF疎通・RPC・満車判定・失敗時配車解放・マイページlookupは検証済（フェイクトークンで402＋自動キャンセル確認済）。
- 検証Tips：Management API/SquareはCloudflareで**urllib=1010/403→curl必須**。テスト予約は`source='hdm_tkm'`で識別→検証後に必ず削除。
- **札幌/那覇も同型で構築(2026-08-26)＝3店統一完了**：予約RPC `official_book_spk`(reservations/fleet/vehicles・class列=`vehicle`・日付lend_date/return_date・**opt_usbはboolean**→`(v_usb>0)`)／`official_book_nha`(nha_reservations/nha_fleet/nha_vehicles・class列=`vehicle_class`・start_date/end_date・opt_usbはinteger)。正本SQL=`~/spk-task/sql/official_book_spk_nha.sql`。id=`HDMS`/`HDMN`+YYMMDD+4桁。**公式サイト価格=CARタイプ表示どおり(オーナー確定)**：那覇 A12000/B9000/C7000/D7000/F3500/H4500/S5500・札幌 A13000/A2 12000/B11000/B2 12000/C7000/S9000/F6000/H6000（補償basic0/免責1100/NOC1650・シート550/個日・USB0）。insurance text=なし/免責/NOC。⚠️reservations NOT NULL=id,ota,mypage_locked(→ota='HANDYMAN'/mypage_locked='{}')。
- **決済EF `official-pay`（MAINにデプロイ・`~/hdm-car-delivery/supabase/functions/`・store=spk/nhaで分岐）**＝official_book_spk/nha→Square課金(同一L8N7J9RKPN3WH)→status='confirmed'＋keydrop_payments記録→確定メール(rent-handyman.com・**マイページURL封入**：札幌my.html/那覇my-nha.html)→各店ch Slack(札幌C08TDTPEB36/那覇C06KZ56NTDF)→失敗でcancelPending。official-flow.htmlは naha/sapporo→official-pay(MAIN)/takamatsu→official-pay-tkm(BT) に分岐済。検証：spk/nha ともフェイクトークンで予約作成→Square拒否→自動キャンセル・配車解放OK。**残＝実カード少額テスト（成功課金メール／MAIN Resendキーがrent-handyman.comを送れるか要実地確認）＋キャンセル通知**。
- **マイページ＝各店既存をそのまま利用（統一ルール=メール）**：札幌`my.html`(EF handyman-mypage)／那覇`my-nha.html`(EF handyman-mypage-nha)／高松`my-tkm.html`(EF handyman-mypage-tkm action=lookup)。予約RPCが`mypage_token`生成→確定メールにURL封入→顧客が場所/時間/免許/変更依頼を操作（既存機能）。
- **🗺 お届け先検索は「KEYDROP方式＝キー不要」に統一（2026-08-26・重要）**：`official-deliv-v2.html`(那覇/札幌のデリバリー場所ピッカー・official-flowがiframe埋込)は元々**Google Places依存**で、新ドメイン`rent-handyman.com`が**Google Maps APIキー(AIzaSyCoX…)のリファラ許可に無い**ため「検索窓に候補が出ない・ピン動かしても住所が出ない」が発生。**KEYDROP(index-classic.html)は意図的にGoogle Placesを使わず、キー不要の`Photon(photon.komoot.io)→GSI(国土地理院msearch.gsi.go.jp)→Nominatim`自動フォールバック＋地図はLeaflet(OSMタイル)**＝どのドメインでも動くから本番成功している。→ official-deliv-v2をこの方式に置換（`searchChain`/`photonS`/`gsiS`/`nomiS`＋`reverseGeo`をNominatim reverse）。**エリア判定`inCity`はcomps無し(キーレス結果)でもaddr文字列で判定OK**。実証：rent-handyman.comでホテル名(DoubleTree)・住所とも候補表示・ピン住所復活。**教訓：新ドメインでGoogle Maps/Placesが無反応(候補/geocode)＝APIキーのリファラ未登録。対処は①GCPでドメイン追加 or ②KEYDROP方式のキーレス多段(Photon/GSI/Nominatim)に寄せる（推奨・ドメイン非依存）。「本番で動いているKEYDROPを参照」が正解だった。**
- **⚠️rent-handyman.com完全稼働に必要な2つ**：①GitHub Pages HTTPS証明書（SquareカードフォームはisSecureContext必須／cert=None時は`unset(cname:null)→再setcname`で再発行トリガー）②お届け先検索＝上記キーレス化で解決済（Mapsキーのリファラ追加は不要になった）。→ **2026-08-27 両方解決**：cert=approved＋https_enforced=ON。**実カード決済E2E成功実証**(HDMT2608265505/オオシタ様¥7,500・確定・配車プリウ1016・確定メール・予約通知)。⚠️オーナー実カードテスト2件(HDMT2608262282/HDMT2608265505・各¥7,500 paid)は要Square返金＋削除。
- **🗺 お届け先エリア誤判定の罠(2026-08-27)**：Photonは英語住所を返す(赤嶺駅→"...Naha...")ため`inCity`が日本語"那覇市"と不一致で**エリア内なのに「エリア外」誤判定**。対策＝候補選択(pickItem)時に**座標からNominatim(accept-language=ja)で日本語住所を取得**して判定/表示＋inCityにローマ字別名(naha/tomigusuki/sapporo)。キーレス検索は座標→日本語reverseで正規化する。
- **🚫 高松キャンセル申請＝HP直販はマイページ申請/OTAは各OTA案内(2026-08-27・承認必須・手動返金／那覇札幌は同型で今後)**：①my-tkm.html＝`editable=false`(情報公開ﾌｪｰｽﾞ)で隠れていた→**isHP判定(ota HANDYMAN含む or id HDMT始まり)で分岐**:HP=CANCEL_POLICY表示+申請(askCancel→cancel_request)／OTA=各OTA案内(cancel_ota_notice)。②EF`handyman-mypage-tkm`に`cancel_request`(HP判定・OTA拒否・`bt_reservation_changes`change_type=cancel/status=requested記録+`slackResv`で#reservation_notification-高松空港店に承認待ちｶｰﾄﾞ)+`decide`(ｽﾀｯﾌJWT`/auth/v1/user`→承認=status'キャンセル'+`bt_fleet`削除・**返金は手動Square**／却下)+lookup`pendingCancel`。③`bt_reservation_changes`に`status/decided_by/decided_at`列追加。④承認ｺﾝｿｰﾙ=`buddica-touring/app/mypage-usage-bt.html`にキャンセル承認待ちﾊﾟﾈﾙ(authTok=本体ﾛｸﾞｲﾝ再利用でdecide)。E2E検証済(申請→承認→ｷｬﾝｾﾙ・fleet=0)。**ｷｬﾝｾﾙ正本=bt_reservation_changes(change_type=cancel)**。OTAｷｬﾝｾﾙは従来ﾒｰﾙ取込GAS→各店ch(変更なし)。
- **🚫 那覇・札幌もキャンセル申請 完成(2026-08-27・高松と同型)**：那覇=`handyman-mypage-nha`にcancel_request＋decide(cancel)＋lookup pendingCancel追加(正本テーブル=`mypage_changes` store=nha field=cancel・承認ch=`slackResv`→#okinawa_reservation_notification C06KZ56NTDF)＋`my-nha.html`にisHP分岐(editable=falseでも表示)＋承認ｺﾝｿｰﾙ=`mypage-usage-nha.html`に🔴キャンセル承認待ちﾊﾟﾈﾙ(decideReady流用)。**E2E検証済**(HDMN予約→申請→承認→status=キャンセル・nha_fleet=0)。札幌=`handyman-mypage`のcancel_request/decideは既存完動→`my.html`の`canCancel`に`"HANDYMAN"`追加(公式予約が出なかった)＋OTA案内分岐＋cancel_ota_notice i18n(承認=既存my-admin.html)。**HP直販判定=ota∈[HANDYMAN,KEYDROP,HP,SP,direct] or id HDMS/HDMN始まり**。OTA予約はcancel_ota_notice表示(マイページ直接不可)。
- **🔴 検索候補「出ない」の真因=z-index(2026-08-27・キャッシュではなかった)**：`official-deliv-v2.html`の候補ﾄﾞﾛｯﾌﾟﾀﾞｳﾝ`.sugg`(z-index:20)が**Leaflet地図(z-index200+)の背面**に描画され、候補は取得・生成されているのに地図が覆って見えなかった。→`.searchbox`/`.sugg`をz-index1000超に。実機で`elementFromPoint`が候補ｱｲﾃﾑを返す(地図でない)ことを確認。**教訓：DOM上"sugg on"＋items有りなのに見えない時はz-index(地図等の上層に隠れ)を疑う。elementFromPointで最前面要素を検証する。** ＋施設名(Photon)が英語住所/全国から拾う対策=候補選択時に座標→Nominatim日本語reverseで正規化＋エリア中心60km圏フィルタ＋iframe cache-buster。
- **🔴 札幌「ピン動かしても住所が変わらない＝北海道地方北海道石狩振興局が頭に固定」の根治(2026-09-06)**：`official-deliv-v2.html`の`reverseGeo`が**Nominatim `display_name`を丸ごとカンマ分割→逆順連結**していたため、行政区画ノイズ`region`(北海道地方)・`subprovince`(石狩振興局)が住所の先頭に常に付き「北海道地方北海道石狩振興局札幌市…」となり、どこを動かしても頭が同じで"住所が変わらない"ように見えた（実際は末尾の町名は変わっていたが埋もれていた）。→ **`addressdetails=1`で住所オブジェクトから`province(北海道/沖縄県)+city(札幌市/那覇市)+city_district|suburb(区)+neighbourhood(町名)+road+house_number`だけを組立て、`/(地方|振興局|総合振興局)$/`のノイズを除去**(`_noise()`)。結果「北海道札幌市北区北8条西4北8条通」等クリーン。**那覇もcity=那覇市で`inCity`判定OK**（両店改善）。実機で全経路(pan→moveend→reverseGeo→apply→表示)クリーン確認。修正は`~/handyman-official`(本番rent-handyman.com)＋`~/spk-task`(staging)の両official-deliv-v2.htmlに適用。**教訓：Nominatim逆ジオは`display_name`丸ごと連結でなく`addressdetails=1`の住所オブジェクトから必要フィールドだけ組む(日本は地方/振興局/郡等のノイズ階層が入る)。**
- **🔴 検索候補「出ない」第2の真因=Photonの`lat/lon`はバイアス(並べ替え)であって範囲フィルタではない(2026-08-27)**：「JAL」等の短い/ラテン語は、lat/lonバイアスを付けても**世界中の同名の町(US/インドのJal)**を返し、その後の60km圏フィルタで全滅→候補ゼロ。「JAL 札幌」とエリア名を付ければ ホテルJALシティ札幌 が出る＝Photonのファジー一致は短い語だと"町Jal"を優先する。**根治=Photonクエリに`&bbox=minLon,minLat,maxLon,maxLat`(エリア範囲box)を付与**→検索段階で地元に限定→札幌「JAL」=新千歳(JAL)/ホテルJALシティ、那覇「JAL」=JALリゾート が出る(実測)。`AREACFG`にbbox(那覇`127.08,25.61,128.28,26.81`/札幌`140.75,42.46,141.95,43.66`≈±60km)を追加し`photonS`に付与。既存60km円フィルタは精密化として残す。**教訓：Photon/Nominatimのlat/lonは"近い順に並べる"だけで絞らない→短い語で同名地を拾う。地域限定は必ず`bbox`(Photon)/`viewbox+bounded=1`(Nominatim)で範囲を渡す。**
- **💴 確認画面 料金内訳表示(2026-08-27)**：決済前確認の料金を合計のみ→**基本料金/オプション/補償/合計**の単価別に分割(official-flow renderConfirm)。i18n=cf_base/cf_optfee/cf_insfee/cf_total。シート価格=**チャイルド¥1,100/ジュニア¥550/個日**(3RPC official_book_spk/nha・bt_book_tkmもサーバ側同額)。
- **✅ オーナー実カードテスト2件 返金＋削除完了(2026-08-27)**：HDMT2608262282/HDMT2608265505(各¥7,500)をSquare `/v2/refunds`(payment_id=注文のtender.id)で全額返金(PENDING=正常)＋bt_reservations/bt_fleet削除。返金payment_idは`GET /v2/orders/{square_order_id}`→tenders[].id。
- **📧 公式サイト予約の各種メール通知を3店で"揃えた"(2026-08-27・KEYDROPと同じセット/タイミング)**：確定は即時。その後＝場所リマインド3日前10時(場所未設定のみ)/前日18時/返却前日17時/傷チェック出発当日8時/返却日9時〜/御礼返却翌日10時。
  - **🔴🔴 最重要の罠＝MAIN側Resend(`RESEND_API_KEY`)は rent-handyman.com を送れない**（keydrop.jp等 別ドメインの鍵）。**rent-handyman.comを送れるのはBTプロジェクトの`RESEND_API_KEY`だけ**（高松official-inquiry/hdm-tkmが実証・`notice-mail-send`も同理由でBTに置いた）。検証法＝`curl POST api.resend.com/emails`で`from:reserve@rent-handyman.com`が「not authorized to send from rent-handyman.com」なら不可。⚠️`~/.config/keydrop/bt_resend_key`は**buddica-tourism.jp用**(rent-handyman.com不可)＝別物。
  - **∴ 那覇/札幌の公式メールは全て"BTプロジェクト経由"で送る**：新EF **`official-notify`（BTにデプロイ・毎時cron jobid22）**＝`MAIN_SERVICE`でMAINの`reservations`/`nha_reservations`(ota=HANDYMAN)をクロスDB読取→各トリガー評価(JST時刻ゲート)→**BTの`RESEND_API_KEY`(rent-handyman.com)で送信**→`{store}_line_sends`(action=mail_*)で重複防止・記録。**確定メールも同EFの`{confirm:true,store,reservationId}`中継**で送る＝`official-pay`(MAIN)は自前Resend(不可)をやめ`OFFICIAL_NOTIFY_URL`+`OFFICIAL_NOTIFY_SECRET`(=BT hdm_tkm_cron_secret)でこの中継を呼ぶ。**実送信検証済**(御礼/確定とも sent=1/mailed)。DRYモード(`{dry:true,hh:N}`)で時刻ゲート検証可。
  - **高松**：`hdm-tkm-enqueue`の対象を`ota=じゃらん`→`in.(じゃらん,HANDYMAN)`に拡張(公式HDMTもreminder/damage/thanksが飛ぶ・**welcomeだけ`ota=HANDYMAN`はofficial-pay-tkm確定メールと重複するのでskip**)。高松はhdm-tkm自体がrent-handyman.com(BT)なので追加のブランド対応不要。
  - **⚠️DB日付はUTC/EFはJST**：`current_date`(UTC)は早朝JSTだと1日前→テスト予約の日付はJST基準で明示する。cron secret＝`~/.config/keydrop/hdm_tkm_cron_secret`(BT共通)。
- **🔴🔴 高松の2ブランド混在をbrand正本で根治(2026-08-27・「HANDYMANで予約したのにBUDDICAからメール」事故)**：高松は**同一エリア・同一APP(BUDDICA)・同一テーブル`bt_reservations`に2ブランドが混在**。①HDM(HANDYMAN高松・rent-handyman.com・マイページ)=ota HANDYMAN(HP公式)/じゃらん/楽天/スカイチケット ②BUDDICA(buddica-tourism.jp・ご利用ガイド)=BUDDICA自社HP/たびらい/エアトリ/レンタカードットコム 等。**散在するota除外フィルタは脆く事故る**(bt-mail-cronがじゃらんは除外していたがHANDYMAN公式を除外漏れ→BUDDICAメール誤送信 実発生)。→ **単一正本＝`bt_reservations.brand`列＋トリガー`trg_bt_set_brand`(`bt_derive_brand(ota,source,id)`)**を新設(`~/buddica-touring/sql/bt_brand.sql`)：source='hdm_tkm' or id LIKE 'HDMT%' or ota∈(HANDYMAN,じゃらん,楽天,スカイチケット)→'HDM'、他は'BUDDICA'(**fail-safe＝不明は自社BUDDICAに倒す・将来HDMのOTA追加時はこの関数に足す**)。**各送信EFはbrandだけで判定**：hdm-tkm-enqueue=`brand=eq.HDM`／bt-mail-cron=`.eq('brand','BUDDICA')`＋JS安全網`r.brand==='BUDDICA'`。**混在チェック実証＝BUDDICA対象にHDM混入0・逆0**。**HPは両ブランドに存在するので ota だけでは分けられない→sourceで判定(公式=hdm_tkm)**が肝。新しい通知/送信を足す時は必ずbrandで絞る。

## 🔧 2026-08-25 KEYDROP 代車（だいしゃ）サービス＋新サイト横断アクセス解析（新規構築・引き継ぎ）
リポ＝`~/hdm-car-delivery`（keydrop.jp・GitHub Pages・push即反映・GH Pagesは10分HTMLキャッシュ→確認は`?cb=時刻`）。**代車＝"予約"でなく"リクエスト→チャットで車両提案→確定"モデル**（長期が多く在庫確認が要るためメール離脱を避けチャットで詰める）。

### ① 代車サービス（request→chat→propose）
- **入口**：KEYDROP TOP（`v3/index.html`・`v3/keydrop-top.html`）の検索ボックス直下に独立バナー「🔧 代車のお届け」＋🏔札幌/🌴那覇ボタン（`dq(a)`＝`v3/keydrop-flow-daisha.html?area=&mode=daisha&method=delivery&_=Date.now()`／キャッシュ回避で毎回最新フロー）。**TOPお知らせ(NEWS)先頭にも「新サービス：代車のお届け」をリンク付き掲載**（`daisha-about.html`へ・4言語・`renderNews`が`u`フィールドでリンク描画）。メニューの代車項目は削除済（入口はTOPバナー＋お知らせ＋LP）。
- **LP**：`daisha-about.html`（実写ヒーロー=`v3/images/kv2.jpg`／実写バンド=kv3・kv4／実車ラインナップ=`images/class_*.png`）。Google広告サイトリンク先＝このURL。
- **フロー**：`v3/keydrop-flow-daisha.html`＝**本番予約フロー`keydrop-flow.html`のフォーク**（`?mode=daisha`＝`DAISHA`フラグ・`ORD=['cond','select','customer','confirm','done']`・`SCREEN`マップ・本番は一切改変せずゼロリスク）。地図/実在庫(`public_keydrop_classes_v`)/日時は本番流用。最後に`submitDaisha()`が`daisha-request`EF `create`へPOST→`daisha-chat.html?t=<uuid>`へ遷移。電話番号は取得しない（ハードル低減）。
- **チャット（顧客・ログイン不要）**：`daisha-chat.html?t=<request-uuid>`＝トークンでスレッド継続・8秒ポーリング。EF `thread`/`send`。
- **スタッフ管理**：`daisha-admin.html`（名前+番号→`@spk.hdm`/`@nha.hdm`ログイン）。`?store=`絞り・`?id=`で該当を自動オープン。承認待ち一覧・チャット返信・ステータス・**割引設定**。
- **EF `daisha-request`**（正本`~/hdm-car-delivery/supabase/functions/daisha-request/index.ts`・`--no-verify-jwt`）。actions＝`create`/`thread`/`send`/`staff_list`/`staff_thread`/`staff_send`/`staff_status`/`get_discount`/`set_discount`。`create`時にSlackカード（#sapporo_reservation C08TDTPEB36／#okinawa_reservation_notification C06KZ56NTDF）＋**ResendでチャットチャットURLを自動メール**（`row.email`宛・FROM=reserve@keydrop.jp）。
- **DB**：`daisha_requests`（id uuid PK…name/tel/email/choice1-3/status/staff_note）＋`daisha_messages`（request_id FK・sender・body）。RLS有・anon経路はEF(service_role)経由。
- **割引＝エリア別×クラス別**（2026-08-25）：`app_settings`/`nha_app_settings` key `hdm_keydrop_daisha` = `{"default":20,"byClass":{"A":25,...}}`（旧`{"discount_pct":20}`は既定として後方互換）。フロー`discOf(k)`＝`byClass[k] ?? default`で「代車価格」を算出（`daishaPrice`/`priceHtml`）。admin=店舗ボタン→モーダルで既定%＋クラス別%（空欄=既定）。クラス＝SPK:A/A2/B/B2/C/S/F/H、NHA:A/B/C/D/F/H/S。

### ② 新サイト横断アクセス解析（どこがどれだけ踏まれ・どこで離脱したか）
- **背景**：解析基盤(`kd-analytics.html`＋`public_kd_*_v`)は充実だが、計測を書いていたのは**旧TOP `index-classic.html`だけ**で新KEYDROP(v3)は未計測だった→新規に汎用計測を追加。
- **トラッカー**：`v3/kd-track.js`（`window.KDT`）。`KDT.init({page,area})`で**pv自動送信＋全クリック自動捕捉**（`a,button,[role=button],[data-kd],[onclick],summary,.cta,.card`をclosestで拾いラベル=data-kd>id>aria-label>text）＋`KDT.step(name,no)`＋**離脱(pagehide/visibilityhidden)で滞在ms記録**。内部除外＝`?internal=1`（localStorage→`selftest_`セッション→ビューが除外）。SB anon直POST・keepalive・例外安全。
- **組込済5ページ**：`v3/index.html`(page:top)／`daisha-about.html`(daisha_lp)／`v3/keydrop-flow-daisha.html`(daisha_flow・area:daisha)／`v3/keydrop-flow.html`(flow・area:spk/nha)／`daisha-chat.html`(daisha_chat)。両フローの`applyStep`冒頭に`KDT.step(step,cur+1)`を追加＝フロー段階を計測（本番フローも計測開始・追加のみで挙動不変）。
- **DB**：`kd_events`（ts/session_id/page/kind(pv|click|step|exit)/target/step_no/area/device/ref/ref_host/utm_campaign/dwell_ms/ua・anon INSERT・RLS）。集計ビュー6＝`public_kd_ev_daily_v`/`_page_v`/`_click_v`(クリック順位)/`_funnel_v`(段階別到達)/`_device_v`/`_source_v`（全て`session_id not like 'selftest%'`除外・anon SELECT）。SQL正本＝`~/hdm-car-delivery/sql/050_kd_events.sql`（適用済）。
- **ダッシュボード**：`keydrop.jp/kd-analytics.html`下部に「🆕 新サイト解析（v3）」パネル＝ページ別(閲覧/セッション/クリック/離脱/平均滞在秒)・要素クリック順位(上位30)・フロー離脱(残存率バー＋離脱%)・端末別・流入元・日別。`loadV3()`が20秒毎更新（既存`load()`とは独立＝旧ビュー未適用でも動く）。
- **検証済**：実ブラウザからpv/click/exit(滞在31-42s)/step がDB到達→パネル描画OK。既に予約フローの実訪問クリックを自動捕捉。テストデータ全削除済(selftest 0)。
- **⚠️運用**：Management API操作は**curl必須**（urllib=Cloudflare 403）＝`--data-binary @file`、token=`~/.config/keydrop/sb_token`。自分でページ検証する時は必ず`?internal=1`（統計を汚さない）。GH Pages反映は`?cb=時刻`で確認（10分キャッシュ）。全EF/フローは`node --check`＋実ブラウザ描画で確認してからOKとする。

## 📋 2026-08-24 定例MTGレポートを高松(BT)ベースで3店フォーマット統一（SPK v4.7.581／NHA v3.5.352／BT v1.0.355）
オーナー指示「フォーマットは全て統一・一旦高松をベースに札幌那覇を統一」。BTの定例MTGレポート(本体アプリ内Reactコンポーネント`mtgOpen`/`repSum`/`buildDailyText`)に合わせSPK/NHAへ横展開。
- **統一した4点**：①当月キャンセルカード＋テキスト行(`repSum`に`cxlByM/cxlByY`＝返却月/年基準・率=ｷｬﾝｾﾙ÷(返却+ｷｬﾝｾﾙ))②**CPA・売上・効果 節を新設**(件数/売上/予約単価/広告費/手数料/CPA/効果。効果=HP:売上−広告費／OTA:手取り(売上−手数料18%))③上段サマリー月別チップにグロス予約単価④テスト除外`isTestResv`。
- **店ごとの分岐(重要)**：`repSum`のフィールド名/CHof/広告費ソースが各店で違うので1:1コピー不可。**広告費**＝BT:`bt_app_settings` key`hp_adspend_bt`／SPK:`app_settings` `hp_adspend_spk`／NHA:`nha_app_settings` `hp_adspend_nha`（3店ともDBに存在確認済）。**HP/OTA分け**＝BTは`r.source==="ota"`／SPK・NHAは**`r.source`が無い**ので**OTAコード`["J","R","S","O","RC","G"]`で判定**(CHofと同一)。
- **テスト/自己テスト除外`isTestResv`(isCancel直後にモジュール関数・3店同一)**＝①ID`^ZZ|DEMO|TEST`②氏名`テスト/デモ/test`③氏名空④**オーナー名`大下/おおした/オオシタ`**。返却/売上/チャネル/CPA/キャンセル/車両ランキング(`computeVehicleRanking`へ`data.filter(!isTestResv)`)の**全集計に一貫適用**。実測BT:当月キャンセル6→3件。⚠️オーナー名(大下/オオシタ)本番客が来たら要調整。
- **未統一(店固有)**：BTの「③月間目標」はAA/その他のBT固有目標データ＝SPK/NHAは元々除外のまま残置。SPKには「🔑KEYDROP月別」節あり(SPK固有・そのまま)。
- **教訓/実装Tips**：①`revOf`はレポートコンポーネントscope(SPK 23970付近)＝CPA節のIIFEから使える②`hpAdSpend`はstate追加(extraSales stateの直後にloader)③**NHAはterserが全top-level関数名(isCancel/isTestResv/computeVehicleRanking)をmangle**＝app.jsに`isTestResv(`が0でも正常(一貫mangle)。SPKはmangleしない。④ライブ検証＝SPK/NHAとも白画面なし・JSエラー無し(SWのInvalidStateErrorは無関係)で起動確認済。

## 🔔 2026-08-23 承認待ちSlack通知に「承認管理ページを開く」ボタン追加（時間・場所変更の承認制・SPK/KEYDROP）
オーナー要望「承認が必要なSlack通知から、その場で承認できるページへ飛べるように」。対象＝**時間・場所変更の承認待ち**（結果通知＝承認済みカードには付けない）。
- **札幌HANDYMAN** `line_auto/handyman-mypage`（`mpCard`）：対応欄に「管理コンソール」を含む承認待ちカードに `actions` ボタン→`https://nosh2318.github.io/spk-task/my-admin.html`。定数`MGMT_URL`＋`/管理コンソール/`判定で自動付与（場所時間/オプション/補償/区分/キャンセルの承認待ち全部に付く）。
- **KEYDROP** `keydrop-mypage`（`notifySlackCard`）：型に`mgmtUrl?`追加し、「マイページ変更申請（承認待ち）」カードに→`https://keydrop.jp/my-admin.html?store=<spk|nha>`（両店1画面・`?store=`で直リンク・`M.store`で自動判定）。KDN-=那覇/KD-=札幌。
- 承認ページURL＝SPK:`nosh2318.github.io/spk-task/my-admin.html`(単店)／KEYDROP:`keydrop.jp/my-admin.html?store=`(hdm-car-delivery・両店対応・`?store=`/localStorage kd_admin_store)。my-admin.htmlは予約番号ディープリンク非対応(ページを開くだけ・該当予約は「🔔変更依頼」に出る)。
- Slack Block Kit `actions`+`button`(url)でクリック遷移。deno check通過・両EFデプロイ済(ckrxttbnawkclshczsia --no-verify-jwt)。次の承認待ち通知から表示。

## 🧷📦 2026-08-23 OP DEL行に「シート積載在庫」バッジ＝parking.html倉庫車をクロスDB連携（v4.7.578）
オーナー要望「parking.htmlの倉庫車で各車に記録した🚼チャイルド/🧒ジュニアの"物理積載在庫"を本体OPでも見えるように」。
- **データの正本**＝駐車場DB `rkrvjpipvpybkmqadmrb` の `parking_meta`（k=`warehouse`・v=`{carId:{child,junior,note}}`）。**carId="車名-ナンバー"**（parking.htmlの`spk_fleet_for_parking`が`name+"-"+no`で生成）→ **ナンバー(末尾split)で本体タスクの配車ナンバー(veh.no/dispVn.no/t.plateNo)と突合**。別に`seats.html`(🧷シート貸出リスト)もあるが在庫の正本はparking_meta。
- **本体側**＝既存`sbParking`(anon・L323)で`parking_meta`をクロスDB直読み（追加DB不要）。`SeatLoad`モジュール(60秒ポーリング+realtime `seatload-rt`)＋`SeatLoadBadge`(自己購読・window event `seatload-updated`で再描画)を`OptBadges`直後に定義。読取失敗は握り潰し（本体を絶対止めない）。
- **表示**＝DEL系(DEL/PU/PUB/来店)行のみ「📦積載 🚼×N 🧒×N」。4サイト＝OP DEL/COLシート(`sheetFilter==="del"/"col"`)・TOPスタッフ別サマリ・本日スケジュール・スケジュールタブ。
- **🔴混同禁止**：`OptBadges`(opt_c/opt_j＝予約側の"必要数"・実線ピンク/橙)と`SeatLoadBadge`("物理積載在庫"・**破線シアン枠＋📦積載ラベル**)は別物。色/枠/ラベルで必ず分ける。
- コミット32ea899・ライブ検証済(app.jsに📦積載=1/seatload-updated=3/parking_meta=2)。
- **🔴🔴 2026-08-23 続報＝DEL行ナンバー突合は"空振り"だった→在庫一覧表示に是正（v4.7.579・コミット3522125）**：オーナー「反映されてない」。真因＝**倉庫車(parking_meta.warehouse)は"配車されていない保管車"＝シートの物理在庫置き場**。一方 DEL行バッジは"配達に出た車のナンバー"と突合するので、**倉庫車は配達に出ていない＝どのDEL行とも一致せず0件＝バッジが1つも出ない**。実データ検証(2026-08-23)：倉庫車シート在庫=プラド🧒×3/ノア3382🚼×1/アクセラ8403🚼×1/ヴェルファイア3381🚼×3、本日DEL配車=4576/9047/2383/5512/8529→**一致0件**。倉庫車ナンバー(3382/8403/3381)は"別の日"にはDEL配車される事はある(＝設計が完全に無意味ではないが、その日の一致は稀)。**正しい表示＝「今どの車に何シートが積んであるか」の在庫一覧**（そこから配達車へ物理的に移し替える運用）。→ `SeatLoad`に`list`(carId/label/plate/child/junior/note)追加＋新コンポーネント`SeatLoadSummary`で在庫一覧を**OPシート(🪑シート在庫アラート直下)＋TOPタスクサマリー先頭**に表示。DEL行`SeatLoadBadge`は"倉庫車がたまたま配達される稀ケース"用に残置。**教訓＝「◯◯が反映されない」は、まず"突合キーが実データで一致し得るか"を実データで検証する。正本(倉庫車=非配車)と表示条件(DEL=配車)の意味論が食い違うと構造的に0件になる。この場合はバッジ突合でなく在庫一覧を出す。** ⚠️オーナーはparking.html(駐車マップ)を見ていた＝parking.htmlの📦倉庫車セクションに元から在庫表示あり。本体OP側にも同じ在庫が出るようにしたのが今回。

## 💳🔴 2026-08-19 じゃらん/Square「入金済みなのに未入金アラート」対応＝【DB是正だけでは終わりでない・スプシ更新依頼までが1セット】（オーナー確定・恒久・毎回これに従う）
オーナーに何度も同じ指摘を受けている。この対応は**DBを paid にしただけで「完了」と報告してはいけない**。アラートには**2系統**あり、駆動源が違う：
- **9:06「未入金アラート」＝`checkUnpaidAlert`＝スプシ「支払い管理」駆動**（`1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc`・ステータス列I が「入金済」でない限り毎朝9時発火）。→ **DB是正では絶対に止まらない。スプシ行を「✅ 入金済み」にするまで翌朝また鳴る。**
- **9:23「じゃらん未決済リマインダー再送」＝`resendSpkJalanUnpaidReminder`＝DB `jalan_payments.status=in.(email_sent,link_created)`駆動**。→ こちらはDBを `paid` にすれば止まる。
- **✅ 対応の1セット（この順で必ず全部やる）**：①Squareで実入金確認（決済リンク注文は**tender付与後もstate=OPENのまま残る**＝`checkPaymentStatus`のCOMPLETEDのみ検索が拾えない穴）②DB `jalan_payments` を `status=paid`＋`paid_at`是正（authトークンでPATCH可）③**スプシ「支払い管理」の該当行ステータスを「✅ 入金済み」に更新**（私はSheets書込認証が手元に無い→GAS `updatePaymentSheetStatus_(resv,'✅ 入金済み',paid_atISO)` 用のワンタイム関数 `fix<予約番号>()` を `gas-email-import-v2.gs` に用意）④**返信に必ずスプシのリンク `https://docs.google.com/spreadsheets/d/1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc/edit` を添付し「該当行を支払い済みに更新してください」と依頼するまで**。④をやらないと「DB直した＝終わり」に見えてスプシが放置され翌朝再発＝これが繰り返しの正体。
- **根本策（同型を全部潰す）**：`checkPaymentStatus`/予約番号突合の SearchOrders を `state_filter=COMPLETED` だけでなく **state不問でtender有りならpaidと判定**に直せば、OPEN残り注文も検知しスプシ・DBを自動更新する（GAS貼付が要る＝オーナー/CLI側）。
- **🧠 学習の仕組み（オーナー質問への答え）**：Slack OMNI号機は会話記憶を持ち越さない＝毎回この正本MDだけを読んで動く。だから「学習して」は**会話でなく正本MDに書いて初めて永続する**。同種の対応・訂正を確定したら、その場でこのMD（必要ならグローバル/HOW_TO_SEE_DATA.md）に1行焼いてから完了報告する。

## 🕒 2026-08-18 在庫調整/在庫管理の🏭入庫(車検/点検/修理)行が一覧最上部に固定される→「予約日時=登録日時」に（BT/SPK修正済・全店共通パターン＝他営業所も同型なら同修正を提案/適用）
**現象（BT高松→SPK札幌で同一・オーナー報告）**：在庫調整/在庫管理の一覧に出る🏭入庫（車検/点検/修理）行が、予約日時の降順ソートで**いつまでも最上部を占領**する。
- **根本原因（全店共通の構造）**：一覧`rows`は`.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""))`＝**createdAt降順**。入庫行の生成が`createdAt:m.createdAt||m.startDate||""`で、①`fetchMaintenance`がDBの`created_at`を写しておらず`m.createdAt`が常にundefined→②`m.startDate`(＝車検予定日＝**未来日**)にフォールバック→未来日は降順で全予約より上＝**永久固定**。
- **根治3点（BT `index.html.bak`／SPK `index.src.html`・`maintenance`/`bt_maintenance`は`created_at default now()`保有済）**：①`fetchMaintenance`のmapperに`createdAt:m.created_at||""`を追加（永続ソース＝登録時刻）②入庫行の生成を`createdAt:m.createdAt||today`に（未来の車検予定日にフォールバックしない）③入庫を作る登録フォーム全経路の楽観更新recに`createdAt:new Date().toISOString()`（編集時は既存createdAtを保持）。→ 登録日時順で自然に流れ、新規登録時だけ上部＝正常。
- **他営業所（NHA那覇 等）で同じ機能・同じ現象の報告が出たら、この3点をそのまま提案/適用**（NHAは`nha_maintenance`/`nha_tasks`・日本語列だが構造同型）。判定＝在庫調整/在庫管理のintake行が①未来日で最上部固定、②`fetchMaintenance`系がcreated_atを写していない、を確認。BT v1.0.334-BT / SPK v4.7.566。
- **🆕 新規開発時の設計原則（全店・この現象を最初から作り込まない）**：一覧を「登録/発生の新しい順」で見せるためのソート・表示に使う日時は、**必ず"登録日時(created_at)"**にする。**車検予定日・貸出日・返却日など"業務上の未来/過去の日付"を並び順のキーに使わない**（未来日は降順で永久に最上部を占領する）。生成行/自動起票行（intake/タスク/派生行）を一覧に混ぜる時は、①DB fetchのmapperで必ず`created_at`を写す②生成行のソート用日時は`created_at||today`（業務日付にフォールバックしない）③楽観更新のオブジェクトにも`createdAt:new Date().toISOString()`を入れる。＝「並び順の日時」と「業務上の日時（予定日/利用日）」を必ず分離する。

## 🧟 2026-08-18 「消しても復活するデモ予約(DEMOMYPAGE-SPK/KD-DEMO-KEYDROP)」＝配車表「未配車」に出る→除外で解消＋本体は削除
オーナー報告「何回消しても未配車に復活する（デモ マイページ確認用／デモ KEYDROP確認用）」。**台帳(audit_log)で確定＝これはアプリ/cron/EFのバグではなく、私(OMNI)がマイページ/KEYDROPプレビューURLを動かすために作った"確認用デモ予約"**（`.jsonl`＝過去CLIセッションにのみ登場・アプリ本体には該当IDのコード無し）。過去に「削除依頼→mgmt-apiでDELETE→別セッションでプレビュー用に再INSERT(PostgREST/staff JWT)」を繰り返した足跡が台帳に残る＝これが「消しても復活」の正体（自動再生成の仕組みは無い）。本来2030-01日付でOP隔離していたが、**配車表の「未配車」アラート(`ua`フィルタ・index.src.html L15323)がキャンセル/配車済みは除くがデモ/テストを除外していなかった**→未来日なので出続けた。
- **対策**：①`ua`フィルタに`_isTest`(id `^ZZ|DEMO|TEST`／氏名`テスト|デモ`)除外を追加(在庫管理は2026-08-17に`_isTestResv`で除外済＝**同じ除外を未配車にも横展開**)。v4.7.565。②デモ予約2件を実削除(依存tasks/fleet/mypage_changes/spk_line_links=0件・クリーン)。③**今後デモ予約を再seedしない**(プレビューが要る時はその場で作り、必ず`_isTest`で全運用リストから除外される形にする)。
- **教訓**：①「消しても復活」系はまず`audit_log`でop(INSERT/DELETE)とapp_name(mgmt-api=手動SQL/PostgREST=アプリ・JWT)を時系列で見る→再生成の主体が即分かる。②テスト/デモ予約(DEMO/TEST/ZZ・氏名テスト/デモ)は**全運用リスト(在庫管理・未配車・OP等)で必ず除外**する。除外は1画面ずつ足すと漏れる→**共通ヘルパー化**すべき(現状 `_isTestResv`はInventoryManagerローカル・未配車は別インライン＝将来モジュールレベルに集約推奨)。③自作のデモ/確認用データは「作ったら消える運用リストから最初から除外」しておかないと現場を惑わせる。

## 🅿️🧽 2026-08-18 駐車の入庫時に洗車状態を必須選択＋駐車後も各車で変更可（parking.html）
オーナー要望「駐車時に必ず洗車選択させる（内装済み/外装済み/フル/未洗車 の4択）・駐車後でも各車編集可能に」。**🔴 本体アプリTOPの「駐車場マップ」タブは iframe で `parking.html` を読む（index.src.html L23818 `parking.html?v=CV`）＝ライブの駐車画面は `parking.html`（standalone vanilla JS・別Supabase `rkrvjpipvpybkmqadmrb`・parking_spots/parking_meta）。index.src.html の `ParkingManager` コンポーネント(washMap/未洗車・内洗済・洗車済)は この駐車タブでは未使用の別物＝駐車の修正は必ず parking.html を触る**（最初 ParkingManager を直しかけて気付いた）。
- **実装＝既存の「入庫時に鍵を車内に置くか必須記録(key_inside・2026-08-16)」と全く同じパターンを踏襲**：①parking DB `parking_spots` に `wash_status text` 列を追加 ②入庫確定 `finishPark` で `askWashStatus(spotId,carId,true)`(4択・modalLockで背景タップ不可)→選択後 `askKeyInside` へチェーン(洗車→鍵の順で両方必須) ③各マスに `washBadge`(✨フル/🧹内装済み/🚿外装済み/❌未洗車=赤点滅/🫧未選択) ④`tapCar` シート(駐車後の詳細)に洗車4ボタンを追加＝**駐車後も各車で変更可**（鍵の変更ボタンと同列） ⑤`dbSetCar`/`optimistic` で入庫・出庫・移動時に `wash_status` を未選択にリセット(前の車の状態を引き継がない=key_insideと同一)。
- **教訓**：①駐車の「〜させる/記録させる」系は key_inside の型(askXxx→modalLock→setXxx→dbSetXxx＋badge＋tapCar編集)をコピーするのが最短・低リスク。②洗車状態は car でなく **spot(parking_spots)に持たせ、移動/出庫でリセット**＝doctrine「位置の正本=parking_spots・cars metadataは持たない」と整合。③parking DB(rkrvj…)の列追加も Management API(`~/.config/keydrop/sb_token`・sbp_)で通る。SPK v4.7.564/CV spk-v1097。ライブ反映確認済(askWashStatus 検出)。

## 🪪 2026-08-18 マイナ免許証で「撮影しかできず添付できない」→カメラ強制(capture)廃止（3店マイページ）
スタッフ/顧客報告「マイナ免許証に切替→撮影する物理カードが無い。マイページで免許証を添付しようとしても撮影モードにしかならず添付できない。多発」。**真因＝マイページ(`my.html`/`my-nha.html`)の免許証`<input type="file">`だけ`capture="environment"`が付いていてカメラ起動が強制**され、スマホ内の画像/スクショ/PDFを選べなかった（`license.html`とBTは元々capture無し＝ファイル選択可）。→ **`capture`削除＋`accept="image/*,application/pdf"`＋アップ時のファイル名拡張子をmime準拠(pdf/png/jpg)に**。案内文`lic_note`にマイナ免許証の一言(画像/スクショ/PDF添付可・撮影不要)を追加。SPK my.html v4.9.10 / NHA my-nha.html v9.5-nha。**BT `guide/index.html`はcaptureは無いが表裏"両方必須"でマイナ免許証(1画像)を弾いていた→裏面を任意化(表面のみでUP可)＋PDF許可＋案内文**(guide-v 2026-08-18)。GAS(`license_drive_upload.gs`)は`Utilities.newBlob(bytes,mime,fileName)`で汎用保存＝PDF/PNGもそのまま可・変更不要。**教訓：`type=file`に`capture`を付けるとカメラ強制でギャラリー/ファイル選択不可＝マイナ免許証やPDFを弾く。本人確認系のアップは`capture`を付けない＋PDF許可。免許証アップ入口は3店で「license.html/マイページ/BTガイド」と複数あり仕様がバラける→免許証UI変更は必ず全入口を横串確認**。全て standalone(build不要・push即反映)・ライブ反映確認済。

## 🕒 2026-08-17 マイページ「早め回収OK(ready)」承認してもOP時間が変わらない→根治（handyman-mypage EF）
オーナー報告「時間変更リクエストを承認したのにOPの回収時間が変わらない」。**真因＝これは通常の時間変更(return_time)ではなく`ready`(早め回収OK/返却準備完了・承認制)で、EFの`decide`承認が希望時刻をOPへ書き込むコードが`ready`フィールドに無かった**（`del_place/col_place/lend_time/return_time`だけ`applyPlaceTime`で自動反映・`ready`はLINE送信＋status承認のみ＝OP時間は据え置き）。希望時刻17:30は`mypage_changes.note/new_value`にテキスト保持されるだけだった。
- **根治**：`handyman-mypage`の`decide`に、`c.field==="ready"`かつ承認時、希望時刻(HH:MM)を`note+new_value`から正規表現抽出(`rdyHM`)→あれば`applyPlaceTime(...,returnTime=rdyHM,...)`で**COLタスク時間＋reservations.return_time/col_timeへ自動反映**（return_time承認と同じ経路＝`_timeChange`が立ちミラー/パトロールで戻らない）。承認LINE文も希望時刻ありなら「回収予定時間を HH:MM に調整いたしました」に。正本＝`~/spk-task/line_auto/handyman-mypage/index.ts`→`~/hdm-car-delivery/supabase/functions/`にcp→`functions deploy handyman-mypage --no-verify-jwt`。deno check通過・E2E検証済(ダミー予約でready承認→task/resv とも16:00反映・テストデータ削除済)。
- **教訓**：①「時間変更を承認したのにOPが変わらない」は、まず`mypage_changes.field`を見る＝`ready`(早め回収・承認制)と`return_time`(直接の時間変更・即時/24h承認)は別物。`ready`は"合図"設計で従来OP時間を書かなかった。②承認で希望時刻をOPへ反映するのが正(オーナー確定)。③即時の1件対応＝COLタスクを`_timeChange`付きで手動修正すれば戻らない(time単独保存は再生成/ミラーで戻る)。④`decide`承認は`staff_token`(本体ログインJWT)必須＝`/auth/v1/token`でoshita@g-lines.jpログイン→取得。⑤**NHA(handyman-mypage-nha)は既にready承認→希望時刻自動反映を完備済**(L125-140＝①nha_reservations.col_time/end_time ②nha_tasks c-の「変更」＋「時間」列 ③mypage_changes return_time=applied。NHAの時間変更の正本は「変更」列＝2026-07-09の知見と一致)＝SPKが後追いした形。2026-08-17に那覇もライブE2E検証済(ready承認→時間15:30反映確認・テストデータ削除済)・再デプロイ済。

## ⬜🩹 2026-08-17 OPシート「担当が消えて復活/ずっと動く」→ 白画面(総障害) → 根治＋再発防止の仕組み(v4.7.560〜562)
オーナー報告「担当を入れても消えて復活を繰り返す・画面がずっと動く」→ 調査中に**全端末白画面(総障害)**。台帳(audit_log)基軸で2つの独立バグを切り分け・根治し、**再発防止をコード検査で機械化**した。

### ① 白画面の真因＝TDZ(宣言前参照)。`node --check`は通るのに実行時にApp全体がクラッシュ
- **原因**：`const invTodoTotal=React.useMemo(()=>..invTodoCount.., [invTodoCount,...])` が **`invTodoCount`(=後の行でconst宣言)を宣言前に参照** → App描画時に `ReferenceError: Cannot access 'te'(=invTodoCount) before initialization` → #root空＝白画面。v4.7.558「車検/点検/修理を在庫管理に表示」で在庫件数バッジ追加時に**宣言順を誤って**混入。
- **なぜ"いきなり"**：皆その日まで**古いキャッシュ版**を使用→**ハード再読込で初めて壊れた版を読み**白画面に。SW(自己破棄型)がキャッシュを消して最新を読ませた瞬間に露呈。
- **修正(v4.7.561)**：`invTodoTotal` を `invTodoCount` の**直後**へ移動（宣言順を正す）。
- **切り分け手順(再利用)**：白画面はまず**ブラウザのコンソール(Chrome MCP read_console_messages)で実エラーを取る**→`Cannot access X before initialization at App`＝TDZ。app.jsのエラー位置(char offset)を `node -e 's.slice(p-400,p+200)'` で切り出し→minified変数(`te`)の周辺から `useMemo(...,[te,...])` を特定→ソースの日本語文字列(`["車検","半年点検","修理"]`)でgrepして該当useMemoを見つける。
- **🔴🔴 再発防止＝`check_tdz.js`(静的検査)を`pre-push`に組込済**：`const X=useMemo/useCallback(...,[deps])` の依存に「**自分より後で束縛される変数**」があればFAILしpushを止める。束縛は const/let/var・分割代入・関数名・**関数引数(prop)**まで収集して誤検知ゼロ(VehicleManagerの`vehicleClasses`はprop=前方束縛で誤検知しない を確認)。正常版PASS・バグ順序でFAIL を実証済。**今後 useMemo/useCallback を足す時は、依存に使う変数の宣言より必ず後ろに置く**。`node --check`(構文)はTDZを検出しない＝この検査が必須。

### ② 担当が消えて復活/ずっと動く＝v4.7.557「デフォルト時間ソート」が全行書込の綱引きを表面化
- **台帳の決定的証拠**：`d-R0QSZXZG` の1書込diff＝`assignee:武山瞳→大下, sort_order:10→13`。10分で**sort_order 64回・assignee 8回**書換(actor=`oshita@nha.hdm`単一)。担当変更 L17356 `_save→updateTask→_toDbTask`＝**全行書込(assignee+sort_order)**。複数タブ/端末が並び順を奪い合い、担当まで巻き添え。
- **引き金**：`v4.7.557`(8/16) が `useState(null)`→`useState("time")`＝**デフォルト時間ソート**に。保存のたび表示が時間順に並び替わり、裏で前からあった綱引き(8/14時点で既にsort_order 252/日)が「ずっと動く/担当が消えて復活」として**表面化**。
- **修正(v4.7.562)**：**ソートを「表示専用」に**＝`handleSort`はDBに`sort_order`を書かない(`sortedTasks`/`filteredTasks`のuseMemoがsortKeyで並べる)。**デフォルトを固定順(`useState(null)`)に戻す**。永続並び替えは`moveRow`(sortKey=null時)のみ。**鉄則：ソートはビュー＝DBに書かない。並びの正本はsort_order、書換はmoveRow(手動)だけ**。※担当巻き戻りの深層(loadTasksの`upsertTasks(gen2,protect)`全行再保存)は残るが、表示安定＋1端末運用で実用回復。真の根治はNHA同様「純ミラー化」(2026-07-16)。

### ③ デプロイ規律(このインシデントの教訓)
- **白画面になったら即revert**(CLAUDE.md鉄則)。ただし今回はrevert先(v4.7.559)自体がTDZ持ち＝revertでは直らず→**コンソールで実エラーを取り根本(TDZ)を直す**のが正解だった。
- **本番一斉配信の前にブラウザ(Chrome MCP)で実描画を確認**：v4.7.562はデプロイ後に実機でTOP+OPシート描画・エラーゼロを確認してからOKとした。`curl`のHTTP200/app.jsサイズだけでは実行時クラッシュは分からない。
- **SW自己破棄型は「古いキャッシュ版で延命していた潜在バグ」を再読込の瞬間に一斉露呈させる**＝デプロイの度に上記検査(check_tdz＋ブラウザ描画)を通す。

## 🔔 2026-08-14 TOP「お知らせ」カード(AutoNoticeBox)＝GASパトロールをアプリ側でDB計算(通信ゼロ)＋消し込み共有・要対応をワンボタン(v4.7.548〜556)
GASのSlackパトロール(urlfetch枯渇要因)をアプリ側に移設。`index.src.html` `AutoNoticeBox({today})`(L12806〜・Handover領域`<AutoNoticeBox/>`で描画)が予約/tasks/spk_accountingをDBから直読みして要対応を表示。**消し込みは`spk_notice_ack`(k text PK・RLS全許可)で全端末共有**。未入金はSlackのまま(長いので)。
- **UI確定形**：①**項目ごとにアコーディオン**(カテゴリ枠・件数バッジ・既定閉) ②**日程が近い順ソート**(`date`昇順) ③予約日を赤バッジで大きく＋氏名＋OTA、予約IDは小 ④**連絡手段バッジ**(📱LINE連携/LINE未連携・✉️メール有・📞番号＝`_lineLinkMap`＋reservations.mail/tel) ⑤**ワンボタン依頼**(場所未設定のみ)：📱LINEで依頼/✉️メールで依頼/📄マイページ→**押すとプレビューモーダル→「はい、送信する」で送信**。電話ボタンは削除(番号バッジのみ)。
- **メール自動送信**＝新EF `notice-mail-send`(**BTプロジェクト`ggqugvyskyiblxiycpci`**・reserve@rent-handyman.comの鍵がそこに在るため)。札幌スタッフJWTをmain `/auth/v1/user`で検証→予約`mail`をサーバ側で引いて宛先固定(任意送信不可)→Resend送信。詳細は`~/Desktop/HANDYMAN/rent-handyman.com_メール送信_メモ.md`(2026-08-14項)。LINEは既存`line-send`(action=place_request・未連携は安全skip)。
- **🔴 最重要教訓＝「OP表示は予約から導出(2026-07-15 STEP2)」なので、タスクの旧列を予約と比べる"パトロール的チェック"は誤検知になる**：
  - **オプションのズレ通知＝廃止**。OPのオプションバッジ(`OptBadges` L1196)は`t.opts`＝`_fromDbTask`が`DB._resIdx`(予約)から導出。タスクの`opt_b/c/j`列は表示に使われない残骸。予約↔旧列を比べると「ズレ」と出るが**OPには正しく表示されている**＝誤検知。
  - **場所未設定の誤検知も根治**：`COLタスクの回収場所は t.place に入る`(t.col_placeでなく)。旧チェックはCOLで`t.col_place`(常に空)を読み全COLを誤検知＋予約の`del_place/col_place`(正本)を見ていなかった。**正しい定義＝「場所がタスクplace・_ssPlace(フォーム回答)・予約del/col_placeの"どこにも"無い時だけ未設定」**(OP `_fromDbTask` place導出と一致)。実データで64件表示(大半誤検知)→本当に空の43件のみに。残43件はOTA予約でお客様フォーム未入力＝実際に要フォロー。
  - **一般化**：TOP等で「予約とタスクの不一致」をパトロールする時は、まず**OPが実際に何を表示しているか(`_fromDbTask`の導出)を確認**する。導出後の値で比較しないと、使われない旧列との差分を誤検知する。判定前に必ず実データで裏取り(owner指摘で連続誤検知を是正した)。

## 📱 2026-08-13 バイトURL(staff.html)から駐車場が「真っ白」＝端末側babel変換がスマホで重すぎ→事前コンパイルで根治(parking-staff v3.20)
症状＝札幌バイトURLの🅿️駐車場(parking-staff.html)がスマホで真っ白。**切り分けの型が有効だった**：①staff.htmlの遷移(location.href=parking-staff.html?t=)・トークン検証RPC(spk_staff_view=ok:true)・駐車DB(parking_spots 20枠)を全て実データ確認→happy path正常 ②desktop Chrome(playwright)では完全描画→**端末固有**と確定 ③**画面に原因を出す診断を仕込む**(素JSのwindow.onerror＋4.5秒後フォールバックで React/ReactDOM/Babel/supabaseのCDN読込可否・optional chaining対応・JSエラー・UAを赤枠表示)→スタッフが撮影→**実機診断が決定打**：iPhone iOS18.7・全CDN OK・JSエラー無し・でも描画されず＝構文でもCDN欠落でもない。
- **真因＝`<script type="text/babel">`の端末側babel-standalone変換**。parking-staff.htmlはReact+babel-standalone(2.8MB)で**73KBのJSXをブラウザ内で毎回変換**→スマホCPUでは重く時間内に描画が終わらない(desktopは速いので出る)。**staff.html(タスク側)は素JS＝babel不要で一瞬＝この非対称が「タスクは見えるが駐車場だけ真っ白」の正体**。※先に疑った optional chaining `?.`(v3.18で除去)はiOS18では対応なので無関係だった＝**憶測で直さず実機診断を取るのが正解**。
- **根治＝JSXを"コミット時に"事前コンパイルして端末側babelを廃止**：`node`+babel-standalone(vm)でreact presetにより`<script type="text/babel">`ブロックを素JS(React.createElement)に変換→インライン`<script>`に置換、babel-standalone CDN行を削除。→端末は変換ゼロでstaff.html同様に即描画(モバイルUAで1.40s描画・警告0・エラー0を実測)。
- **教訓**：①React+babel-standaloneのstandalone HTMLは、JSXが大きいと**スマホで描画停止/白画面**になる(desktopでは再現しない)。大きいものは**事前コンパイルして素JS配信**(staff.htmlのように)。②「白画面/描画されない」で端末が見えない時は、**素JSの診断フォールバック(onerror＋タイムアウトで原因＋UAを画面表示)を仕込んでスタッフに撮ってもらう**のが最速の切り分け。③デプロイ反映確認は`grep -o 'v3.20'`で版数＋`grep -c babel-standalone`が0を確認。cache対策でstaff.htmlの遷移に`&_=Date.now()`付与(v3.24)。※事前コンパイル方式は他のbabel使用standalone(license.html等が素JSなら該当なし・React系のみ)へ横展開可。
- **⚠️追記(v3.21)＝babel廃止後も同端末で白のまま再発**。実機診断でReact/ReactDOM/supabase全OK・JSエラー無し・でも未描画＝**トークン検証fetch(spk_staff_view)が端末/回線で完了せずApp が st=loading のまま**(loading描画が全画面spinnerでpk-bar無し→白＋監視の誤発火)。サーバRPCは0.87s健全・Chromium/**WebKit(実Safariエンジン=playwright webkit)**両方1〜2sで描画＝**コードは正常＝その端末/回線の環境要因**(staff.htmlは15s+リトライで耐えるがparkingは無耐性だった)。**重要な検証教訓＝iPhoneはWebKitなのでChromiumだけで「再現しない」と判断しない→`playwright install webkit`で実Safariエンジン検証する**。対策(v3.21)＝検証fetchにAbortController(12s)+自動リトライ3回、**st=loading時もpk-barヘッダーを描画(白くしない・監視の誤発火防止)**、最終失敗は通信エラー+再読込、診断watchdogは14sに緩和+`window.__PKMOUNTED`でReact起動可否表示。WebKit実測で通常0.44s/RPC6s遅延でも1sでヘッダー・誤診断なし・8sで満載描画。→ **顧客向けの非同期fetchで初期表示を作る画面は必ず「タイムアウト+リトライ+読込中も枠(ヘッダー)を出す」**＝遅い/瞬断でも白画面にしない(staff.htmlの15s+リトライと同型)。

## 🚫 2026-08-13 配車表ダブルブッキング可能を根治＝全配車経路の集約点にハードガード(v4.7.530)
症状＝配車表タイムラインで予約帯を既存予約に重ねられ、ダブルブッキング（例：VEL(7673)にフクイ8/17-20＋肥田8/18-20が同時割当）が作れてしまう。**真因＝重複判定`checkVehicleConflict`はあるが、ドラッグ(handleDrop)・編集モーダルのUI側でしか事前チェックしておらず、他の配車経路が素通り**：①配車リストの車両変更`<select>`プルダウン(onReassignVehicle直呼び・無チェック)②OPシート車両割当`assignVehicle`(fleetを直接書く・無チェック)。＝UI一つずつにチェックを足す設計は必ず漏れる(instance修正)。
- **根治(ONE)＝全配車経路の集約点に最終防衛ガード**：①`reassignVehicle`(App L22658・ドラッグ/プルダウン/モーダルが全てここに集約)冒頭で`checkVehicleConflict(newVc,resId,data,fleetRefApp.current)`→重複なら`alert`して`return`(配車しない)②`assignVehicle`(OPシート L16327)冒頭にも同ガード(`checkVehicleConflict(vehicleCode,_tk0.reservationId,reservations,fleetRef.current)`)。→**どのUIが事前チェックを忘れても、書込の直前で必ず弾く**＝ダブルブッキングが構造的に不可能。自動配車(autoAssign)は元から取込後に重複検出→2台目を自動解除する機構あり(別経路・維持)。
- **教訓**：`checkVehicleConflict`の重複条件は`r.lendDate<=rd && r.returnDate>=ld`(同日返却=貸出も重複扱い)。「重ねられる/ダブルブッキングできる」系は、判定関数の有無でなく**全書込経路がその判定を通っているか**を疑う→UIごとでなく集約点(fleetを書く関数)に1つ置くのが根治。今回フクイ+肥田のVEL重複は私のSQL手動insert(JS経由せず)が作った=手動DB操作はこのガードを通らないので、DB移送/手動配車時も重複を自分で確認する。

## 🚧 2026-09-01 配車表 二重予定ガードを reservation×maintenance に拡張（3店横展開・SPK v4.7.594/NHA v3.5.361/BT v1.0.382）
オーナー報告「同一車両×同一期間にメンテ入庫ブロック(車検/点検/修理)とユーザー予約が二重に入る（例CX-3 4576に9/4半年点検(仮)があるのに予約も乗る）」。2026-08-13 v4.7.530でreservation×reservationのダブルブッキングを「全配車経路の集約点(reassignVehicle/assignVehicle)にcheckVehicleConflictハードガード」で根治済→今回 reservation×maintenance を双方向で拡張。
- **双方向ガード**：①**予約→メンテ済み車両に配車拒否**＝reassignVehicle/assignVehicle(配車集約点)に`checkMaintConflictForRes`(SPK)／`checkVehicleConflict`のメンテ判定(NHA/BT=元々maintenance引数対応済・`_isMaint`)を追加。②**メンテ→予約済み車両に登録拒否**＝`addMaint`(FleetTimeline・報告のドラッグ登録経路)＋`addMaintTop`(SPK TOPカレンダー)に`checkResConflictForMaint`を追加。**仮(pending/入庫仮)ブロックも予約を弾く**（オーナー要望どおり）。
- **partner_reserved(協力会社の予約枠)は除外**＝これは"メンテ入庫"でなく協力会社の在庫枠なので、A2/B2預かり車の正当な顧客予約を誤ブロックしないため。blockType/block_type==='partner_reserved'をスキップ。
- **店差**：SPKは`checkVehicleConflict`が予約のみ→`checkMaintConflictForRes`を別途新設。NHA/BTは`checkVehicleConflict`が既にmaintenance引数・`_isMaint`返却対応済（UI側dropdown/drag/tooltipは元から渡していたが、**集約点reassignVehicle(NHA/BTはDB側nha_fleet/bt_fleet突合で予約のみ)/assignVehicle(ガード皆無)にはメンテ判定が無かった**→今回集約点に追加）。OPScreenは3店ともmaintenance/reservations/fleetをprop保有（SPKのみOPScreen/InspectionTopCalendarにprop追加が必要だった）。reassignVehicleのuseCallback depsに`maintenance`追加（stale防止）。
- **未カバー(低リスク・意図的にスコープ外)**：SpkIntakeAddForm(車両→整備タブの入庫フォーム)・IntakeBoard(TOP非表示で温存)・NHA/BT InspectionMasterView等のメンテ編集経路はreservations/fleetが深いネストで未スレッド。報告の主経路(配車表ドラッグ)＋両集約点はカバー済。将来これらも塞ぐなら reservations+fleet をprop注入。
- **教訓/横展開**：配車の"二重予定"防止は①UI側事前チェックだけだと素通り経路が残る→必ず**配車集約点(reservation側=reassignVehicle/assignVehicle・maintenance側=addMaint)**にハードガードを置く②予約×予約と予約×メンテは別関数だが同じ集約点に並べる③「二重にできない」系は3店同型→必ず横展開(checkVehicleConflict/reassignVehicle/assignVehicle/addMaintはgrepで全店確認)。

## 🚧 2026-09-01(続) 二重予定ガードに maintenance×maintenance を追加（3店横展開・SPK v4.7.595/NHA v3.5.362/BT v1.0.383）
オーナー確認「メンテ×メンテ(入庫ブロック同士＝車検/半年点検/整備/修理が同一車両・同一期間で重複)も二重予定NG。CX-3 4576 9/4-6のメンテ×半年点検が手動で重ねられた事例がまさにこれ」。上記 reservation×maintenance に続き、maintenance×maintenance の重複を全メンテ登録経路でガード。
- **新設関数 `checkMaintConflictForMaint(targetVc,vname,start,end,maints,excludeMaintId)`**（3店とも`checkResConflictForMaint`直後に定義）：同一車両(code or name一致)×期間重複する既存入庫ブロックを返す。**partner_reserved(協力会社在庫枠)除外・編集中の自身(excludeMaintId)除外**。判定は`norm(startDate)<=me && norm(endDate||startDate)>=ms`。
- **ガードを入れた登録経路**：SPK=`addMaint`(FleetTimeline)＋`addMaintTop`(TOPカレンダー)＋`SpkIntakeAddForm.save`(車両→整備タブ入庫フォーム・edit対応)＋FleetTimeline `editMaint`保存(📝編集で期間変更時)。NHA=`addMaint`(MaintForm・create/edit共用・editId除外)＝単一経路(InspectionTopCalendarは表示専用)。BT=`addMaint`(MaintForm)＋`IntakeAddForm.save`(整備タブ・edit対応)。
- **店差**：SPK addMaint/addMaintTopはeditId無し(create専用)＝除外不要。NHA/BT addMaintはeditId(編集はaddMaint再利用)＝`excludeMaintId=editId`で自己衝突を防ぐ。SpkIntakeAddForm/IntakeAddFormは`maintenance`propが在るのでmaint×maintガードのみ追加(reservations/fleetは深ネストで未スレッド＝res×maintは従来どおりスコープ外)。SPKのみFleetTimeline `editMaint`が独立save(addMaint再利用しない)なので個別にガード追加。
- **横展開の型**：maint×maintは`maintenance`配列さえ在ればガード可(fleet/reservations不要)＝res×maintより広くカバーできた。「二重にできない」系の追加要望は必ず①関数を`checkResConflictForMaint`の隣に置く②全登録/編集経路をgrep(`saveMaintenance(\[`/`onAdd={addMaint}`/`IntakeAddForm`)で洗い出す③編集経路は必ずexcludeMaintIdで自己衝突を防ぐ。ライブ検証＝curlでapp.js(版数+"入庫予定が重複するため")＋loader(CV/BASE_V)を確認。

## 🏬 2026-08-13 HP直販予約の店舗誤取込（札幌の客が那覇に入る）根治＝素の住所に札幌地名を追加
症状＝肥田様(OPC87428・HP直販・S・8/18-20・北海道の客)が**那覇(nha_reservations)に誤取込**→札幌Appに出ず、8/20札幌Sクラスが肥田+イノウエ+渡辺=3件2台でオーバーブック。「またやった」。**真因＝HP直販メール(noreply@rent-handyman.jp)は店舗フィールドが無く(フッターに那覇店・札幌店の両方が載る店舗中立)、唯一の店舗手がかりは"お届け住所"だが「中央区大通西15-2-2」＝都道府県/市名(北海道/札幌市)を含まない素の住所**。両GASの店舗判定`isNahaReservation_`/`isSapporoReservation_`は`/北海道|札幌市/`でしか札幌判定せず→判定不能→**那覇GASのdefault(判定不能→那覇取込)に落ちた**(札幌GASも判定不能→skipなので那覇が拾う)。
- **根治(両GAS)**：住所判定に**札幌特有の素の地番**追加＝`/大通(西|東)|[南北]?\d+条(西|東)|すすきの|札幌駅|新千歳|円山|白石区|手稲|厚別|清田区|豊平区/`→那覇GAS=false(弾く)/札幌GAS=true(拾う)＋沖縄側`/牧志|おもろまち|久茂地|国際通り|安里|松山|小禄|首里|泊|旭橋|美栄橋/`。両店に同地名＝両店で漏れない。ファイル=`~/spk-task/gas-email-import-v2.gs`(札幌)・`~/Desktop/AI/naha-project/gas-email-import.gs`(那覇)。構文OK。オーナーがGASエディタに両方貼付・再デプロイで再発防止。
- **⚠️移送の教訓**：DB間移送は「挿入成功を確認してから削除」。今回 insert が **SPK reservations.opt_usb/opt_parasol=boolean(那覇はint)** で失敗した後に delete が走り一瞬データ消失→即再挿入で復旧。insert→成功確認→delete の順序厳守 or 1トランザクション。
- **教訓**：HP直販(OP接頭辞)は店舗中立メール＝**住所で店舗を決める**（OTAは貸出営業所あり）。素の住所は都道府県/市名の正規表現を擦り抜ける→札幌/那覇の"素の地名"を両GASに必ず入れる。判定不能→那覇default は札幌の素住所を那覇に流す穴だった。

## 🚨🛡 2026-08-12 那覇 予約取込が5日間サイレント停止＝GAS全置換で41行に切詰め→取込停止監視を全店導入(再発防止)
**事故**：8/8に那覇GAS「那覇店 予約取込」へ高松(BUDDICA/香川)除外の編集を**Write全置換**で行い、Code.gsが41行に切り詰められ**予約取込が全停止**（8/8〜8/12の5日間、UYT74340/BAB19352等が未取込）。誰も気づかず放置＝**サイレント障害**。→ グローバルCLAUDE.mdの鉄則「既存ファイルはWrite全置換禁止→Editで部分追加」の違反が原因。
- **復旧**：6549行のバックアップ(`~/Documents/Codex/2026-05-04/.../fixed_gas/NHA_Code.gs`)を土台に`/tmp/NHA_Code_restore.gs`を作成（newer_than:2→14で遡り取込＋**anonキー→service_roleキー**＝anonはnha_reservations INSERT 401でRLS拒否＝これが無いと再取込失敗＋isNahaReservation_の「営業所＞お届け場所＞顧客住所」順序修正）。オーナーがGAS貼付→`processNewEmails`実行で**39件取込成功**。
- **🛡 再発防止＝取込停止監視(PC非依存・pg_cron・全3店)**：
  - main DB(ckrxttbnawkclshczsia) `import_stall_monitor()`＝cron`import-stall-monitor`毎時。**13-22時JSTで最終取込(非KEYDROP)が8時間超**なら🚨をpg_net→Slack #handyman_development(C07B5G3PV7C)＋#sapporo_reservation(C08TDTPEB36)へ。NHA=nha_reservations/SPK=reservations両方監視。
  - BT DB(ggqugvyskyiblxiycpci) `bt_import_stall_monitor()`＝cron`bt-import-stall-monitor`毎時。**13-22時JSTで12時間超**で🚨→#operation-高松空港店(C0BFMBLEJGZ・BUDDICA別WSトークンは`~/Library/LaunchAgents/com.buddica.*-bridge.plist`から取得)。
  - **実証済**：`p_force=true`で強制発火→`net._http_response` status 200/slack_ok=true＝**cron本番経路(pg_net→Slack)が実際に届くことを検証**（curl到達確認だけでなくpg_net経路を必ず実証すること）。両cronは`p_force`既定false＝実障害時のみ発火（誤発火なし）。夜間の通常無取込で誤報しないよう窓を13-22時に限定。
- **教訓**：①GAS編集は必ず差分(Edit)。全置換は切詰め事故を起こす。②取込は**「止まっても誰も気づかない」**のが最大リスク→**"最終書込からの経過時間"を監視する仕組み**が唯一の確実な防御（原因がGAS切詰め/トリガー削除/クォータ/RLS/認証のどれでも一律に検知）。③DB→Slack通知は必ず**pg_net経路を実発火で実証**（curlは別経路）。④anonはRLSでnha_reservations INSERT不可＝GASはservice_role必須。

## 🗂 2026-08-11 立替(advance.html)の月合計 領収書ZIP DLが多件数で固まる＝順次fetch＋全メモリ保持
症状＝advance.htmlで8月(3件)の領収書DLは動くが7月(99件)の月合計DLが「反応せず落ちない」。実測＝7月99件・全件Supabase Storage・平均~1.4MB＝**合計約140MB**。**真因＝`advDL`が全件を1件ずつ`await fetch`→arrayBufferで全部メモリに載せ→JSZip.generateAsyncで一括ZIP**。件数が多い月は①順次fetchで2〜3分無反応(進捗表示なし＝固まって見える)②~140MBをメモリ保持でZIP化＝低メモリ端末で失敗。修正＝共通`_advZip(view,filename)`に統一し**8並列fetch＋下部に進捗トースト(_advProg)＋無圧縮`compression:'STORE'`(画像/PDFは圧縮効かずCPU無駄)＋失敗の明示alert**。`advDL`(月/人別)と`advDownloadReceipts`(全体)両方が使用。advance.htmlはstandalone(build不要・push即反映)。**教訓＝ブラウザ内一括ZIP DLは「順次fetch＋無進捗」だと大量件数で固まって見える。並列取得＋進捗表示＋STOREを標準に。極端な件数はメモリ限界があるので提出者別など分割DL導線を残す**。

## 💴 2026-08-11 小口現金 残高が個別ページと一覧で合わない＝カード払いの除外ルール不統一（複製集計ドリフト）
症状＝バイトURL個別(staff.html)は高橋 使用¥5,270/残高¥4,730なのに、staff-admin.htmlの「💴小口現金 残高」一覧は 使用¥11,547/残高¥-1,547（マイナス化）。**真因＝小口現金の集計が2箇所にあり、カード払い(`spk_petty_cash.kind='card'`)の扱いが不一致**。カード払いは会計「カード」タブ(spk_accounting card_pay)へ回り**小口現金からは引かない**設計(staff-v3.20)。個別ページは`kind!=='card'`で使用から除外していたが、一覧(staff-admin.html L183)は`if kind==='topup'→支給/else→使用`で**カードも使用に加算**→小口から二重に引き残高がマイナスに化けていた。修正＝一覧も`else if(kind!=='card')`でカード除外（個別と統一）。staff-admin.htmlはstandalone(build不要・push即反映)。**教訓＝同じ値(使用/残高)を複数画面で別々に集計するとズレる。除外ルール(カード除外)は全集計箇所で必ず揃える。小口現金の正は「現金のtopup − 現金のout」＝カードは常に対象外**。


## 🅿️🧱 2026-08-13 駐車場「何度直してもシャッフル/消え」を1から作り直し=spotsをDBのみ管理に完全分離(v4.7.522)
オーナー「何度リクエストしても直らない・1から作り直せ・機能はそのまま・人が触らなくても動く仕様に」。何ヶ月も再発した真因＝**位置(spots)が"parking_spots(1枠1行)が正本"と言いながら、実際は旧機構(localStorage初期化・whole-doc自動保存・3wayマージ)に絡んだ二重管理のまま**だった。v4.7.507〜516の対処は経路を1本ずつ塞いだだけで、幽霊(LS seed)と自動保存の巻き戻し経路が残存＝instance修正の典型。→ **spotsを旧機構から"完全に"切り離す5点根治(index.src.html ParkingManager)**：①`useState([])`＝LSから初期化しない(幽霊復元の根絶・旧`init.spots`廃止) ②マウント時fetchSpotsのみが唯一の読み込み・空(初回)なら既定を1枠ずつ投入・取得失敗(null)は現状維持 ③parkSig(whole-doc署名)からspots除外 ④自動保存doc`d`からspots除外(LS/mergeSaveに位置を一切書かない) ⑤自動保存の依存配列からspots除外(位置変更でwhole-doc保存機構を起動しない)。→ **位置の永続化経路は`parking_spots`への1枠直書き(setSpotCar/setSpotMemo/addSpotRow/delSpotRow)だけ**に。読み書きとも旧機構を通らない＝**シャッフル・消え・巻き戻しが構造的に不可能**。cars/washMap等のroster/metadataは従来通りparking_state+merge(位置と無関係=シャッフル源でない)。DB鉄壁(unique car_id/audit/block_bulkトリガー・2026-08-08)は継続。**教訓：「正本を1本化した」と言っても、旧経路(LS初期化/自動保存/署名/依存配列)を"全て"外さないと二重管理が残り再発する。1つでも残れば幽霊が復活する。** 全端末が旧版を読む間は旧経路が生きるので根治後は必ずハード再読込。次段=人が触らない自動化(配達で自動出庫/返却で入庫提示/洗車タスク連動)は別途。

## 🅿️🚨 2026-08-08 駐車場「登録が無断で巻き戻る/シャッフル」を根治=spotsをparking_spots唯一の正本化(v4.7.507)
オーナー激怒「昨夜20時の登録が無断変更・またシャッフル・我慢の限界」。台帳(履歴)基軸で犯人=コードと断定→復元→構造変更。
- **犯人=正本の二重化(クラス①複製ドリフト)**。08-05にspots(枠×車)を`parking_spots`(1枠1行)へ移行したが、**旧`parking_state`(jsonb全ドキュメント)へのspots読み書きが残存**。①定期ポーリング(15秒)が`parking_state.spots`を読んで`setSpots`で表示を上書き ②自動保存の`merge3`がspots込み全docを`parking_state`に書き戻し→古い端末の配置が復活。**8/7 18:33の配置が朝(07:55)の配置に巻き戻った**のが実害。人ではなくwhole-docの巻き戻し。
- **犯人特定の手順(再利用)**：駐車DB=**別Supabase `rkrvjpipvpybkmqadmrb`**(3テーブル: parking_state=旧jsonb1行/parking_spots=新1枠1行/parking_integrity_log)。`parking_spots.updated_at/updated_by`で最終更新、`parking_state.data->'history'`(248件・time+msgのみ日付なし)を**全リプレイ**して正しい最終占有を算出。history時刻の単調増加/リセットで日境界を判定→昨夕18:33が最後=夜20時の正。**parking_spotsが昼で凍結(afternoon moveがhistoryにあるのにspots行に無い)=per-row書込が一部端末で起きていなかった証拠**。
- **復元**：リプレイ結果でparking_spots＋parking_state.spotsを両方 昨夕18:33へ是正(221→CX-5-8065/234→CX-3-4576/200→アルファード-3411/トラスト→ロッキー-299)。
- **構造変更(引き算=複製を消して統一)**：spotsを`parking_state`の**読み書き経路から全排除**し`parking_spots`を唯一の正本に。読=LS復元/useRemote/定期ポーリングの`setSpots(remote.spots)`を全撤去→位置は必ず`DB.parking.fetchSpots()`。書=`merge3`からspots除去＋`DB.parking.save()`で`const{spots,...rest}=stateData`で必ずstrip＋手動復元/全リセットは`saveAllSpots()`でparking_spotsへ直upsert。→spotsはwhole-docに存在しなくなり巻き戻し不能。入出庫(parkCar/releaseCar/swapCar/memo/add/remove)は元から`setSpotCar`等でper-row書込=正本1本に統一。
- **🔴教訓**：①「勝手に変わる/戻る/シャッフル」は**正本が2箇所ある(whole-doc複製が残存)**を最優先で疑う。移行時は旧whole-docの読み書きを"全経路"消さないと定期ポーリング/merge/リアルタイムのどれかが複製を復活させる。②**全端末が新版(v4.7.507)を読むまで旧端末の巻き戻し経路は生きる**→根治後は必ず全デバイスをハード再読込。③駐車DBはmain/BTと別=`rkrvjpipvpybkmqadmrb`・audit_logは無くhistory配列とupdated_atで追う。

### 🛡🅿️ 2026-08-08(続) 駐車場に台帳＋DB鉄壁ルール=システムの改ざん/シャッフルを物理的に不能化(v4.7.508)
オーナー「一本化は以前(08-05)もやったが再発した・意味あるのか・台帳を有効活用しろ」への根本回答。**コード修正だけでは経路の消し忘れで再発する**(08-05は名ばかり一本化=旧whole-doc経路が残存＝証明済)。→ **駐車DB(別Supabase rkrvjpipvpybkmqadmrb・従来audit_logが無かった=再発を検知できなかった主因)にDBレベルの防御を敷き、全クライアント/旧版に関係なく効かせる**：
1. **`parking_spots_car_uniq`**(部分ユニーク `unique(car_id) where car_id is not null`)＝1台は1枠だけ→同じ車が複数枠=二重駐車/シャッフルを**物理拒否**。
2. **`parking_audit`＋`trg_parking_audit`**(全INSERT/UPDATE/DELETEをop/spot/旧→新/updated_by/app_nameで記録・例外安全=本処理を止めない)＝改ざん不能の台帳。**今後「変わった」報告は`select * from parking_audit where spot_id=X order by id desc`で誰/いつ/旧→新を即照会=履歴リプレイ不要**。
3. **`trg_parking_block_bulk`**(文レベルAFTER UPDATE・transition table)＝**1回のUPDATEで複数枠(car_id)を変更するのを禁止**=システムの一括シャッフル/巻き戻しを物理拒否。人の1枠ずつの入庫/出庫/入替(setSpotCar=各1行)のみ通過。
- **実証済**：テストA(2枠同時に車変更)→P0001で拒否・データ無傷／テストB(同じ車を2枠)→23505ユニーク拒否／テストC(1枠メモ更新)→通過＋台帳記録。
- アプリ側`saveAllSpots`(復元/初期化)は**1枠ずつ順次upsert**に変更(鉄壁トリガーを通しつつ一括書換不能を維持)。入出庫は元から1行=そのまま通る。
- **教訓**：「勝手に変わる」を"絶対"止めるにはアプリのコード修正では不十分(経路を消し忘れる)。**正本側(DB)のドメイン制約＋台帳＋一括変更禁止トリガーで物理的に不能化**する(ドクトリン「正本側で防ぐ・台帳基軸」の実装)。別Supabaseのテーブルにも台帳(audit)を必ず載せる=載っていないと検知も追跡もできず再発が見えない。

### 🔎🅿️ 2026-08-08(続2) 全経路 再監査で「未保存=次の同期で巻き戻る」経路を3件発見・根治(v4.7.509)
オーナー「改めて見直して再発しないかチェック」で全setSpots/全DB書込を洗い出し、**画面(ローカルstate)だけ変えてDB(parking_spots=正本)へ保存しない経路**を3件発見（=同期で巻き戻る再発源。08-05の移行が拾えていなかった典型）：①**車両移動モーダルの「移動」ボタン**(setSpotCar未呼び=移動が未保存)②**removeCar(車両削除)**(枠の車をローカルで外すだけ)③**importData(JSON貼付)**(spotsをローカルに入れるだけ)。→全てDB.parking.setSpotCar/saveAllSpotsを追加。**教訓：`setSpots`する箇所は必ず対応するper-row DB書込(setSpotCar/setSpotMemo/addSpotRow/delSpotRow)を伴う。片方だけ=未保存=巻き戻り**。再監査の指針＝「全`setSpots(`をgrepし、各々がparking_spotsへ1件保存しているか照合」。
- 併せてspotsをparking_stateから外した副作用の回帰も予防：定期ポーリング/初期ロードの早期return判定を`remote.spots`依存→`remote`/`remote.cars`依存に(spotsキーが消えてもcars/洗車/履歴の更新を止めない・誤"データ消失"復元を防止)。resetData(全リセット)は枠レイアウト(オーナー登録の20枠)を保持し入庫中の車だけ1枠ずつ出庫(孤立car_id/一括変更なし)。
- 最終確認：占有=正しい配置維持/重複車0/鉄壁トリガー(audit+block_bulk)+ユニーク索引 稼働/台帳記録中。

## 🧽 2026-08-08(続) staff.html＝OPシートの鏡：洗車の時間は「返却後洗車の返却時刻以降」＋種別絞り込み(staff-v3.22)
オーナー指摘「このURLはOPシートの鏡＝OPと同じ値を個別に切り分けて出すだけ」。**洗車の"割り当てられた時間"の正体＝OPの「🔗返却後洗車 🕐◯◯以降」**（同日・同ナンバーの返却(COL/BD/BDB/返却)タスクの返却時刻＝`_retByPlate`/`_linkedPlates`）。例：デリカ6057=当日19:00返却→洗車は19:00以降。**出発時刻(DEL 09:00等)を洗車時間に出すのは誤り**（オーナー「違う」）。
- **RPC `spk_staff_view`**：`wash_after`を追加＝洗車タスクのplate_noと同日返却タスクをJOINし返却時刻(`timeChange>_ssTime>col_time>return_time>time`のmax)を返す。※前ステップで一時入れた「洗車/引取に出発時刻を出す」eff_time分岐は撤去。洗車の`time`は手動設定値(timeChange)のみ＝OPと一致。**同日返却が無い車の洗車は時間なし(OP同様"-")＝全洗車に必ず時間が出るわけではない**（返却後洗車のみ）。
- **staff.html taskCard**：洗車で`time`空かつ`wash_after`ありなら時間バッジに「🕐◯◯ 以降」を表示（`tmIsAfter`）。
- **種別絞り込みタブ**：本日タスクを`_tcat`で **DEL(DEL/PU/PUB/来店)／COL(COL/BD/BDB/返却)／洗車／その他** に分類し、`.tfilt`のタブ(すべて/DEL/COL/洗車/その他・件数付)で`TFILT`絞り込み(`setTFilt`→`setContent(tasksContent)`で#contentのみ再描画)。
- **教訓**：staff.htmlはOPシートの個別ミラー→**OPが表示する値をそのまま出すのが正**（勝手に別の時刻＝出発/memo由来を出さない）。洗車時間の正本ロジック＝返却後洗車(同日同ナンバーの返却時刻以降)。

## 🕒 2026-08-08 バイトURL(staff.html)に「洗車/引取」の時間が出ない→根治(staff-v3.21)
症状＝札幌バイトURL(staff.html)でOPシートに入ってる時間が表示されない。**真因＝洗車/引取(翌日出発)タスクは時刻フィールド`time`が空で、目安時刻は`memo`に入る**（例`8/9(日) DEL 13:00 ホンマ ケイタ`）。OPシートはmemoを表示するが、staff.htmlは**memoを一切描画せず**、RPC`spk_staff_view`も**memoを返していなかった**→バイトに時間が出ない。DEL/COL/送迎/その他など`time`を持つタスクは元々正常（RPCの`eff_time`が`timeChange>_ssTime>手動>予約(del/col_time)>time`で解決＝legタスクはRPC空ゼロを実データ検証済）。
- **修正**：①RPC`spk_staff_view`の各`jsonb_build_object`に`'memo',coalesce(t.memo,'')`追加（baseに`t.memo`）②staff.html taskCardに`memoLine`（memoの`\n##BCJ:`以降=オプションマーカーを除去して表示・**非legタスク=洗車/引取/送迎/その他のみ**表示`.tmemo`）。
- **教訓**：staff.htmlはOPシートの個別ミラー。**洗車/引取(翌日出発)の時刻は`time`でなく`memo`に入る**（`w-`/`p-`+予約ID・generateTasksが`memo:「M/D DEL HH:MM 氏名」`で生成・`time:""`）。バイト向けに時刻文脈を出す時はmemo必須。RPCが返すフィールドを増やす時はstaff.html側の描画も対で直す（片方だけは無意味）。

## 🗑 2026-08-08 引取(p-)の恒久削除＝サーバ側トリガーで正本抑制(spk_no_pickup・v4.7.514・最終形)
オーナー「引取3件削除」。引取(p-)はA2/B2預かり車の翌日出発で自動生成(generateTasks)＋自動復活(_pickRevive 2026-07-28)され、単純削除では消えない。格闘の教訓(重要)：
- 段1 deleted=trueだけ→別セッションのloadTasks(revive)が数十秒で復活(deleted=false)。
- 段2 タスクのchanged_jsonに`_pickDeleted`フラグ→再生成(newTasks)がフラグごと新changed_jsonで上書きして消える(flag=false)。タスク自身に付けた印は再生成で必ず消える＝正本にできない。
- 段3(最終) 正本を外部の永続テーブル`spk_no_pickup(reservation_id)`にし、サーバ側BEFOREトリガー`trg_spk_block_pickup`で「_idが`p-<抑制予約>`なら書込時に必ずNEW.deleted:=true」＝どのアプリ版/セッションが再生成/復活を書いても、DBが受けた瞬間に削除扱いに矯正。→旧版タブが開きっぱなしでもリロード不要で恒久的に消える(visible=0を140s監視で実証)。KEYDROP来店(2026-07-15)と同じ「正本側ドメイン制約トリガーで防ぐ」パターン。
- アプリ側(v4.7.514)：loadTasksは`spk_no_pickup`を読み`p-<rid>`を`_pickPermaDel`へ→復活ガード/新規・初回生成除外/復活・再生成の再削除の全経路で使用。OPマスター⋯メニューに「🗑この引取を削除(復活しない)」＝押すと`spk_no_pickup`にupsert＋deleted=true。今後オーナーが自分で恒久削除可。
- 鉄則：自動生成/自動復活されるレコードを"消したまま"にするには、レコード自身のフラグでは不可(再生成で消える)。外部の永続キー表＋サーバ側トリガーで正本側から抑制する。クライアント側ガードだけだと旧版セッションに負ける(切り分け＝SQLでdeleted=true直後にvisibleが戻る＝別セッションの書込が犯人)。
- 該当3件＝FLZ66727(西﨑弘司)・R01SOXRL(トヨタマユミ)・RC12461254718835875(フクイトモキ)。正本＝`spk_no_pickup`表。復活させたい時はこの表から予約IDを削除。

## 🩹 2026-08-10 駐車場PCだけまた違う＝本体アプリに幽霊復元が残存しspots除去後にクラッシュ(v4.7.516)
昨日スマホ用(parking-staff v3.17)をparking_spots統一したが、翌日「PCだけ全く違う/スマホ正常」再発。真因＝**本体アプリ(index.src.html)のparking load に幽霊復元(LS restore)ロジックが残っていた**。しかもparking_stateからspotsを除去した(v3.17)後は、その中の`remote.spots.filter(...)`が**undefined例外→loadが途中で死にfetchSpots(parking_spots)に到達できず位置が全く読めない**＝PCだけ壊れる。**教訓：あるテーブル/キー(parking_state.spots)を廃止する時は、そのキーを読む全クライアント/全箇所を洗い出して撤去する。片方(スマホ)だけ直して本体を残すと、除去したデータを読む側が例外で死ぬ。** 根治①本体v4.7.516でload幽霊復元を完全撤去=位置はfetchSpots(parking_spots)のみ。②橋渡し=`parking_spots→parking_state.spots`ミラー(AFTERトリガー`trg_mirror_spots`＋毎分cron`parking-spots-mirror`)で、旧キャッシュ版PC(parking_state.spotsを読む)も正しい表示に。※クライアントのsave()はparking_stateを丸ごと書き換えspotsキーを消すので、ミラーは毎分cronで再充填が必須(トリガーだけだとspot無変更時に消えたまま)。恒久的にはsave()をmerge(data||maps)化してspots/carsキーを消さないのが理想(未実施・cronで代替)。**駐車の「PC/スマホ違う」系は、両クライアントが本当にparking_spotsだけを読んでいるか(旧テーブル/LS復元の残骸が無いか)をgrepで確認するのが確実。**

## ✅ 2026-08-09(完) 駐車場をPC/スマホ完全1本化＝位置parking_spots統一＋roster配車表軸(サーバ動的)
オーナー確定「配車表を軸に常に反映(増減)」「位置のparking_spots一本化は大前提」。2本立てで根治：
- **位置(spots)統一**：スマホ用`parking-staff.html`をv3.17で本体アプリと同じ`parking_spots`(1枠1行=台帳正本)に統一。旧`parking_state.spots`＋**幽霊復元(localStorage restore)を廃止**(=remote空時にLSの古い駐車を復元し嘘の駐車台数を出すバグ源)。DB層にfetchSpots/setSpotCar/setSpotMemo/addSpotRow/delSpotRow追加、load/poll/realtimeをfetchSpots化、入出庫/移動/枠増減は1枠ずつparking_spotsへ、save()とmerge3からspots/cars除外、spots専用realtimeチャンネル追加。→PC/スマホが同一正本=食い違い構造的に消滅。
- **roster(車両リスト)を配車表軸で動的**：静的スナップショットは増減に追従せず不可。**本体DB(pg_net+pg_cron)→駐車DBのクロスDB同期**：本体cron`push-fleet-to-parking`(5分毎)が配車表active→`net.http_post`で駐車DB RPC`sync_parking_fleet(jsonb)`(SECURITY DEFINER/anon)→`parking_fleet`表を配車表と一致(増減・スタッフ保持)。駐車DB cron`parking-roster-guard`(毎分)が`parking_state.cars=parking_fleet+入庫中`にid集合差分時のみ更新(realtime storm防止)。→配車表の増減が数分で駐車場に自動反映・旧セッション上書きもサーバが是正。
- **教訓**：①「A軸に常に反映」は手修正や静的snapshotでなく、A(配車表)から動的導出(サーバcron or クライアントRPC)にする。②別DB(駐車rkrvj…)への動的同期は、本体DBのpg_net→相手DBのSECURITY DEFINER RPCで実現(相手DBにpg_net無くてもpush型でOK)。③whole-doc(parking_state)に位置と車両を混ぜたのが全ての元凶＝位置は1枠1行(parking_spots)、車両はサーバ維持、で分離。④「幽霊復元(LS restoreでデータ消失を補う)」は別テーブル/旧版と併存すると嘘データを蘇らせる＝正本1本化したら廃止する。cron確認=main:`push-fleet-to-parking`/parking:`parking-roster-guard`。

## 🔒 2026-08-09(続々) 駐車場rosterから車両が「また消える」＝旧セッション上書き→サーバ側cronで固定
1111(デミオ)をroster正本に足しても数分でまた消える。原因＝**動作中の古いクライアントセッション（配車表stateが古い本体アプリ等）が、1111無しの旧roster(21台)を保存し続ける**。クライアント側修正(v3.16)は"新規セッション"にしか効かず、既に開いている旧セッションは止められない（＝引取のrevive競合と同型：走っている旧版が正本を上書き）。**サーバ側で固定**：駐車DB(rkrvjpipvpybkmqadmrb)に`parking_fleet`表(配車表19＋スタッフ3＝正しいroster)＋関数`parking_roster_guard()`＋**pg_cron `parking-roster-guard`(毎分)**。cronは`parking_state.data.cars`に`parking_fleet`の欠落分を毎分追記＝旧セッションが消しても60秒以内に自動復帰。cronはcars(roster)だけ触りspots(位置)は不触＝位置ズレは起こさない。**教訓：走っている旧版セッションによる正本上書きは、クライアント修正では止まらない→サーバ側の維持cron/トリガーで固定する(引取のspk_no_pickupトリガーと同じ発想)。** 注意：`parking_fleet`は配車表のスナップショット＝配車表に車を足したら`parking_fleet`も更新要(駐車DBにpg_net無くcross-DB自動同期不可・当面seed/手動。新規セッションはRPC spk_fleet_for_parkingで動的反映されるので表示は出る)。cron確認＝`select * from cron.job where jobname='parking-roster-guard'`(駐車DB)。

## 🚗 2026-08-09(続) 駐車場の車両リストを配車表(vehicles)と恒久連動＝入庫中以外は全部出す
オーナー「配車表の車両が全部出ない(デミオ/ノート1111が無い)・入庫中以外は全部出るべき」。原因3つ：①スマホ用`parking-staff.html`が`masterVehicles={[]}`空固定で配車表同期がスキップ→ハードコードroster ②同期が"追加のみ"で、旧版クライアントの保存がrosterを上書きし1111を消す(私がSQLで足しても別クライアント保存で消えた) ③配車表の1111の`name`に**先頭スペース**があり`name+"-"+plate`のid生成がズレていた。根治：①`spk_fleet_for_parking()`(SECURITY DEFINER・anon)で配車表(active)を取得しmasterVehiclesに渡す(anon直readはRLSで0件) ②同期を**追加のみ→配車表で全置換**(masterList＝配車表, keepExtraで入庫中/スタッフ/メンテ/倉庫の車だけ保持)＝配車表に無い車は消え/ある車は必ず出る・旧保存でも次回loadで是正 ③`update vehicles set name=trim(name)`で表記是正。roster正本(parking_state.data.cars)を配車表19＋スタッフ3=22で再構築。本体アプリ(index.src.html)は元から`masterVehicles={vehicles}`で全置換連動済(active19=props.vehicles一致)。**教訓：「配車表と合わせて」は手でデータ修正でなく配車表から動的に全置換導出(active絞り)＝でないと再ドリフト。車両id=name+plateなので配車表nameのスペース等の表記ゆれがズレ元→trimで正規化。ドロップダウンは入庫中(parking_spots.car_id)を除外＝出ないのは正常。** parking-staff v3.16。

## 🅿️ 2026-08-09 駐車場PC/スマホのズレ＝別テーブル＋スマホの配車表未連動（台帳基軸で確定）
オーナー「PCとスマホで駐車状況が違う／車両リストが配車表と合ってない」。台帳(parking_audit)を基軸に確定した2件。
- **①駐車状態のズレ**：本体アプリ(PC)＝`parking_spots`(1枠1行・唯一の正本・監査トリガー付)／スマホ用`parking-staff.html`＝旧`parking_state`(whole-doc)を読む＝別テーブルで不同期。真の状態は`parking_audit`をリプレイ(各spot_idの最新new_car)＝4台(260:アルファード7927/172:ノア3382/トラストパーク:ノア2383/ソリオ6260※監査前seed)で`parking_spots`と一致。PCの「9台」は古いキャッシュ版が空のparking_stateを読み→localStorageの幽霊9台を『データ消失復元』で表示していた偽物。教訓：駐車のズレ調査は必ず`parking_audit`をリプレイして正本を確定(画面/localStorage/whole-docは信用しない)。大失敗の教訓：スクショの見た目でPC/スマホどちらが正か推測して正本(parking_spots)を上書きするな→オーナーに現物一致を確認し台帳で裏取りしてから触る(今回スクショ9台を正と誤認し正しい4台を一時破壊→即復元)。parking_spotsは`parking_block_bulk_car`トリガーで1文の複数枠変更が禁止＝修正は1枠ずつUPDATE。
- **②車両リストが配車表と未連動**：`parking-staff.html`が`<ParkingManager masterVehicles={[]}/>`＝空配列固定で配車表同期(`if(masterVehicles.length===0)return`)が毎回スキップ→ハードコードのまま(配車表のデミオ/ノート1111が欠落)。本体アプリは`masterVehicles={vehicles}`で連動済だった。根治(v3.15)：スマホ用が本体DBから配車表をSECURITY DEFINER RPC `spk_fleet_for_parking()`(anon grant・active車両のname/no/type)で取得→masterVehiclesに渡す(anon直読みはRLSで0件なのでRPC必須)。同期は追加のみ(スタッフ車両等は保持)。教訓：別DB(駐車rkrvjpipvpybkmqadmrb)のスタンドアロンから本体DB(ckrxttbnawkclshczsia)のvehiclesを読むにはSECURITY DEFINER RPC＋anon grant。「配車表と合わせて」は手修正でなく配車表から動的導出にしないと必ず再ドリフトする。

## 🩹 2026-08-07 傷チェック送信リスト「自動予定と出るのに二度と送信されない」根治（v4.7.506 + damage-check-cron）
症状＝当日DEL(例 ヤマモトDY00000000985/近藤XSU99176)がLINE連携済なのに傷チェック未送信のまま「⏳自動予定」表示＝嘘の自動予定。**実データ切り分け（台帳/DB）で真因は連携タイミングでなく別要因**：①XSU＝車両`アルフ7927`の`vehicle_twins.share_enabled=false`→傷トークン無し→cronは`no_dmg_token`でスキップ（送信行すら残らない）②DY＝DEL担当`無人`→cronの`UNATTENDED_RE`で意図的除外③両者`done=true`(出発済)→cron`done=eq.false`で除外。cronは`*/5`で終日稼働済（連携後の拾いは元々OK）。
- **②表示修正(index.src.html DamageSendList SPK)**＝`autoSendable = 連携済 && 傷トークン有効 && 非無人/乗捨 && 未出発(done=false)`を計算。真ならだけ「⏳自動予定」、偽なら**赤「未送信・<理由:未連携/傷未発行/無人/出発済>」＋(トークン有れば)📋コピー＋✅対応**を表示。手動未対応バッジも`!autoSendable`基準に。→ 送信されない状況を「自動予定」と偽らずスタッフが手動対応できる。queryに`done`追加。
- **①cron改善(damage-check-cron)**＝`done=eq.false`のSQL除外を撤廃し、予約の出発時刻(タスク時刻→`reservations.lend_time`補完)でゲート。`done=true`は「出発時刻が判明かつ未出発の時だけ救済送信」、それ以外の出発済みは送らない(傷チェックは出発前案内)。→ 早めにdone化された未出発便の取りこぼしを解消・出発後の無駄送信は防止。deno check通過・デプロイ済・実起動`candidates:0`(誤送信なし)確認。
- **教訓**：「自動予定」等の"予定"表示は、実際に自動処理が起きる全条件(連携+共有発行+担当種別+未出発)を満たす時だけ出す。連携有無だけで判定すると"送られない自動予定"を生む。傷チェックは車両の`vehicle_twins.share_enabled`が要る＝共有未発行の車両は自動送信不可（リストで「傷未発行」と明示）。

## ⏰🕒 2026-08-06 OP時刻が予約とズレる根本＝"正本が複数"／正＝最後にお客様が入れた時刻（台帳基軸・オーナー確定・次回根治TODO）
オーナー確定の顧客タイムライン＝**① 予約(OTA booking：lend/return_time) → ② 受付フォーム入力(`_ssTime`＝お届け/回収希望) → ③ LINE連携 → ④ マイページで変更可 → ⑤ スタッフがOPシートで直接編集**。**時系列で"後"が正＝①＜②＜④。そして⑤スタッフのOP直接編集＝最優先の正（現場が一番分かる・顧客値や自動整合で絶対に上書きしない＝`_manualTimeAt`/`_timeChange`で保護）**。一番最後の正当な書込が正本＝**台帳(audit_log)のタイムスタンプ＋actor(staff/customer)で確定できる**。優先順位＝**⑤スタッフ手動 ＞ ④マイページ ＞ ②フォーム ＞ ①予約**。
- **通常はOP＝②フォーム(`_ssTime`)＝正**（予約booking時刻は名目）。→ 「OP表示≠予約(return/col_time)」は大半が正常（フォームが後で正）。**予約と単純比較するアラートは誤検知**（2026-08-06に作った`spk_task_time_check`/cron`spk-time-check-am/pm`は参照先が逆＝誤検知のため**即unschedule停止済**）。
- **真のエラー＝④マイページで後から時刻変更したのに、タスクの`_ssTime`(②)が古いまま**＝OPだけ取り残される（例：イワタ様 DY00000001066＝マイページ14:30・OPの_ssTime14:00。手動でtask時間/_ssTime/_timeChange=14:30に是正済）。原因＝**マイページの時刻変更が予約(return/col_time)は更新するがタスクの`_ssTime`へ伝播していない**。
- **次回根治(クォータ回復後・台帳検証必須のcritical箇所)**：①**判定**＝台帳で「予約側の時刻変更(=マイページ④)が タスク`_ssTimeAt`(②)より後か」→後なら**OPを最新(マイページ値)へ自動整合**②**元断ち**＝マイページ時刻変更時にタスク`_ssTime`(＋`_timeChange`)へ即伝播（handyman-mypage EF patchTasksSpk）。→ 「④が必ずOPに反映＝再発ゼロ・台帳基軸で自動判定/修正」。**教訓：判断できない時は台帳を見る＝軸。正本を1つ(=最後の顧客入力)に決めれば自動化できる**。

## ⏰ 2026-08-05 タイムカード打刻不能＝計画行を"実打刻"と誤判定（書込RPCだけ直すと"直らない"）
staff.html?t=token「⏰打刻」の出勤ボタンが押せない。真因＝**出勤簿で管理者が入れたシフト＝spk_attendanceの"計画行"(memo=''・start/end埋め)を打刻ロジックが"既に出勤済み"と誤判定**（計画と実績が同一1行を共有・クラス④派生）。**打刻は2RPCで動く**：①書込`spk_staff_punch`②表示`spk_staff_timecard`(staff.htmlの`renderPunch`が状態を組む＝ボタン出し分け)。**①だけ直すと"直ってない"**＝保存は通るが②が計画行のstart_time(09:00)を「出勤済み」で返し`hasIn=!!d.start`→st="working"→**出勤ボタンをdisabled**。根治＝**両RPCに`v_real`判定**(`memo IN('打刻','打刻中','仮申請') OR memo LIKE '協議中%'`＝実打刻のみ。計画行memo=''は未打刻)：①ブロックせず打刻で上書き＋end_timeクリア ②start/end/breaksを空で返す→出勤ボタン有効化。**両方サーバ側RPC＝アプリ/build不要・DB即反映**。**教訓：打刻など"書込＋表示"がペアのRPCは必ず両方直す。片方だけは"保存はできるがUIが古い状態で操作不能"＝"直ってない"報告になる。** 正本＝`~/spk-task/spk_timecard.sql`。

## 🕒 2026-08-04(続) 洗車/引取 時刻ピッカーの保存をDEL/COLと統一＝timeChange付与（v4.7.500）
v4.7.499(overlay根治)の追い込み。洗車(w-)/引取(p-)の時刻ピッカー2箇所（洗車専用セクション`renderWashRow` L16589・マスター表 L16987）が`_save(t._id,{...t,time:v})`＝**time単独保存**で、①`_mergeUserInput`(L427 `prev._timeChanged||prev.timeChange`時だけtime維持)に拾われず**mirror/SSパトロールで生成値に戻される** ②schedule等の表示resolver`timeChange||_ssTime||time`にも反映されない、余地があった。→両ピッカーを**`_save(t._id,mark({...t,time:v,timeChange:v},"timeChange"))`** に統一（DEL/COL L17157と同型）。**教訓：時刻を手動編集して保存する箇所は必ず`timeChange`(＋mark)を立てる＝time単独保存は再生成/ミラーで戻る**。洗車/引取はleg外→`_toDbTaskBare`のtime空化・STEP2/3導出の対象外で副作用なし（`←orig`変化バッジも time=timeChange=vで非表示）。

## 🧽 2026-08-04 OPシート洗車/引取タスクの時間変更が反映されない+予約破壊+JSエラー を根治（v4.7.499）
症状＝マスター表で洗車(w-)/引取(p-)の時間プルダウンを選んでも時刻列に反映されない＋[JS Error] Script error(Line:0 Col:0)。**3つの独立バグを同時に根治**。
- **①反映されない主因＝翌日対応洗車オーバーレイ(`_nextDayWashShown`)は`tasks` stateに存在しない**（実体は前日=`_srcDate`の行で、表示だけ当日に持ってくる=`loadNextDayWashOverlay`／`nextDayWashOverlay` state）。`_save`が`setTasks(ts=>ts.map(x=>x._id===id?t:x))`で探すが**tasksに無い→state変わらず画面に反映されない**。かつ`DB.updateTask(t,selDate)`で**別日(当日)にw-行を重複作成**していた。→根治＝`_save`を**オーバーレイ対応**に（`t._nextDayWashShown`なら`setNextDayWashOverlay(ov=>ov.map(...))`で即時反映＋DBは実日付`_srcDate`へ書く）。**教訓：`_save`/`updateOtherTask`等の`setTasks(map)`保存は、tasksに無い派生表示行(overlay)には効かない。overlay由来の行を編集する箇所は必ずoverlay stateを更新し実日付へ書く**（`toggleNextDayWash`が既に`realDate`/`setNextDayWashOverlay`でこれをやっていた=手本）。
- **②予約破壊＝洗車/引取/その他/送迎タスク保存時に`_syncReservation`が予約(reservations)を上書きしていた**。これらは`insurance:""`/`opts:0`を持つため、`_save`→`_syncReservation`が**予約のinsuranceを空で潰し、optsを再書込**（＝人間編集の上書き=BUG_FIX_LEDGERクラス④）。→根治＝`_syncReservation`冒頭に**legガード**（`["DEL","PU","PUB","来店","PUB来店","COL","BD","BDB","返却"]`以外はreturn＝洗車/引取/その他/送迎は予約へ書き戻さない）。予約に紐づく属性(opts/insurance/vehicle/type)を持つのはDEL/COL等のlegタスクのみ。
- **③JSエラーの可視化＝OPシートにErrorBoundary(`OPErrorBoundary`)追加**。**「Script error / Source:unknown / Line:0 Col:0」はReact本体がcross-origin(cdnjs, crossorigin属性なし)で読み込まれているため、React reconciler内のrender例外を`window.onerror`がサニタイズして潰す**のが正体（アプリ自作コードのeval例外なら本当のmessageが出る）。→ErrorBoundaryで`componentDidCatch`が**真のerror.message+componentStackをconsole+showErrに出す**＋白画面化を防ぎ「🔄再表示」ボタンを出す。**教訓：原因不明の「Script error Line:0」が出たら、まず該当画面をErrorBoundaryで包んで真のstackを採取する**（CDN Reactのcross-originマスクを剥がす）。

## 🗺 2026-08-04 keydrop.jp追跡ページの目的地ピン誤爆＝del_placeテキストをジオコーディング（便名ノイズで誤爆）
症状＝ドライバー追跡ページ(keydrop.jp)で「札幌駅北口」なのにピンがビール博物館/大通付近＝誤配達の危険（モリ ハルト RC12461247584694533・楽天・8/4 DEL・del_place=`札幌駅北口。JAL505便`）。**真因＝`handyman-track/handyman-driver/track.html`が正しい保存座標`del_lat/del_lng`(43.06955,141.35075＝札幌駅北口ど真ん中)を使わず、`del_place`テキストをGoogleジオコーディング→末尾の便名『。JAL505便』に引っ張られて誤爆**。データは正しく表示ロジックが原因。**修正＝住所クリーニング`cleanMeetAddr`(カッコ書き/『。』以降/便名を除去)＋駅名・空港のランドマーク座標補正`MEET_LANDMARKS`(札幌駅→北口固定・新千歳/すすきの/大通も・番地入り住所`hasBanchi`は補正せず通常ジオコーディング)**。commit 24e2a16(hdm-car-delivery・追跡3ページ・push即反映)。**教訓＝地図ピンをテキストからジオコーディングする箇所は、①便名/メモ混入テキストで誤爆する②正本は`del_lat/del_lng`(顧客が地図でピン留めした座標)＝座標があれば最優先で使う。駅名は北口/南口でピンがぶれるのでランドマーク固定が安全**。keydrop.jp追跡はota問わず(楽天予約でもkeydrop.jpの追跡ページを使う)。
- **🔴 2026-08-26 続報＝ランドマーク`/札幌駅/`の"部分一致"が「新札幌駅」を約10km離れた札幌駅北口へ誤置換（3度目の再発・かなり危険）**：スタッフ報告「新札幌駅なのに札幌駅北口案内」。真因＝`MEET_LANDMARKS`の`{re:/札幌駅/}`が**新札幌駅(厚別区)にも部分一致**→ピンを座標固定で強制的に札幌駅北口(43.06955,141.35075)へ。顧客が座標ピン未設定(del_lat/lng空)だとランドマーク補正が発火して誤爆。修正＝新千歳空港の直後・札幌駅ルールの前に`{re:/新さっぽろ|新札幌/,lat:43.03918,lng:141.46747,name:'新さっぽろ駅（新札幌）'}`を追加（`matchLandmark`は先頭一致を返す＝札幌駅ルールに落ちる前に捕捉）。3ページ(track/handyman-driver/handyman-track)横展開。commit a463333。**教訓＝ランドマーク座標固定は"部分一致"が上位語/近似名を巻き込む(新札幌/西札幌/白石駅等)。地名の部分一致マッチは、より具体的な地名(新◯◯)を必ず配列の先頭に置いて先取りさせる。「◯◯駅」の緩い部分一致は近隣の別駅を誤爆する危険がある**。
- **🔴 2026-08-27 続報＝ホテル名(正式名)がピンに拾えず大通に誤爆＝①keydrop-driverの横展開漏れ ②ジオコーダはPOI(施設名)を解決できない（commit 23139df・4追跡ページ横展開）**：オーナー報告「グランドメルキュール札幌大通公園（アオノ ミツオ様）」なのにピンが大通中心に誤爆・「Googleマップではヒットするのに拾えない意味不明」。真因2つ＝**①`keydrop-driver.html`だけ2026-08-04の修正が漏れており、顧客ピン留め座標(`del_lat/del_lng`)を使わずテキストをジオコードしていた**（RPC`keydrop_track_get_staff`は037で座標を返しているのに`geocodeMeet(goalAddr())`が座標を渡していなかった＝典型的横展開漏れ）。**②`google.maps.Geocoder`(ジオコーディングAPI)は"住所"専用でホテル名等のPOIを解決できない**→「グランドメルキュール札幌大通公園」は該当なしで大通丁目centroidにフォールバック。GoogleマップアプリはPlaces(POI検索)で別エンジンだからヒットする＝「マップでヒット」≠「ジオコーディングで解決」。**さらに`hasNamedPlace`にメルキュール/グランド等が無いと`matchLandmark`が"大通公園"に部分一致して大通座標へ固定してしまう**（POIを施設名と判定させる語彙が命）。**修正＝(a)keydrop-driverも`goalCoords()`(del/col_lat/lng)を最優先(handyman-driverと統一) (b)施設名は`placesFind`(PlacesService.findPlaceFromQuery)でGoogleマップ同等に解決→全滅時のみジオコーダ`geocodeFallback` (c)`libraries=places`を script src に追加・Places無効時は安全フォールバック (d)`hasNamedPlace`にメルキュール/グランド/プレミア/mercure追加**。4追跡ページ(keydrop-driver/handyman-driver/track/handyman-track)を統一。**教訓＝①「Googleマップでヒットするのに拾えない」＝ジオコーディングAPI(住所専用)を使っておりPlaces(POI)を使っていないサイン→施設名はPlaces findPlaceFromQueryで解決する。②同じ機能が複数ページにある時は必ず全ページ横展開(keydrop-driverが1本だけ座標未使用で残っていた)。③施設名(ホテル/旅館/固有名)を地名ランドマークの部分一致より優先させるには`hasNamedPlace`の語彙にブランド名を足す＝でないと"大通公園"等に誤マッチして座標固定される。** ⚠️Places APIがGCP側で無効だと`findPlaceFromQuery`がREQUEST_DENIED→ジオコーダに自動フォールバック(無回帰)＝有効化されていれば施設名解決が効く。この件は顧客がピン留めしていれば(a)で即正確、していなくても(b)で施設名解決。
- **🔴 2026-08-27 続報2＝残っていた2つの「別地点に誤ピン」危険を根治（commit 1b41658・handyman-driver.html）**：武山さん「対症の繰り返しでなく恒久を」を受け、追跡ページの"テキスト→座標推定は必ず誤爆し得る"という根本に対処。①**回収(COL)のクロスレグ座標バグ**：`goalCoords()`が回収中に`col_lat/col_lng`欠損時（=COL座標はほぼ全件欠損）**無条件で反対レグの`del_lat/del_lng`(お届け座標)を流用**していた→お届け先≠回収先だと**回収住所ラベルなのにお届け地点にピンが立つ＝別地点誤ナビ**。修正＝反対レグ座標の流用は`del_place===col_place`(同じ場所)の時だけに限定、違えば座標なし＝住所解決に委ねる。②**推定ピンを確定と区別**：`placeMeet(loc,label,precise)`に`precise`追加。顧客ピン留め座標=確定🎯(紫)、住所テキストからの推定(ランドマーク/Places/ジオコーダ)=📍おおよそ(橙)＋「※住所から推定。お客様の現在地を優先」注記→**誤爆した推定位置を正確な目的地と誤信させない**。**教訓＝(1)DEL/COLで座標が別々の予約は、片方の座標欠損時に反対レグの座標を"無条件流用"してはいけない（住所が違えば別地点）。流用は住所一致時のみ。(2)テキストからのジオコード/ランドマーク/Places推定ピンは"確定"と見た目で区別し「現在地優先」と明示する＝推定は誤爆前提で扱う。** 恒久の本丸＝上流(マイページ/フォーム)でCOL座標を必ず持たせる（実測DEL座標欠損0/COL座標欠損ほぼ全件＝構造的穴）＋col_place=del_placeなら座標継承のbackfill＋座標取得不能時のスタッフ通知（この続報2は追跡ページ側の即効的危険除去で、上流の座標確保は別ステップ）。track/handyman-track(顧客閲覧・meet_lat単一フィールドでクロスレグ無し)は今回未改修（ドライバー=ナビ主体を優先）。

## 🚲 2026-08-04 staff.html 移動手段バナーのアイコン不一致（自転車が🚗）＝MV_INFOがOP本体と乖離
症状＝スタッフページ(staff.html)の移動手段バナーで「自転車」なのに🚗表示。**真因＝staff.htmlの`MV_INFO`が旧値(ミニ自転車/キックボード/ループ/送り)のままで、現行の選択肢`自転車/電動KB/バス/送迎`が未登録→`{ic:"🚗"}`フォールバックに落ちていた**。正本＝OP本体`index.src.html`の`MOVE_MEANS`(送迎/徒歩/自転車/電動自転車/電動KB/地下鉄/JR/バス)＋`MOVE_MEANS_ICON`(🚗/🏃/🚲/⚡/🛴/🚇/🚃/🚌)。修正＝MV_INFOをMOVE_MEANS_ICON/STYLEと完全一致に更新(旧値も後方互換で残す)。DEL/COL/引取/入庫は`moveBanner`が`x.move`で共通処理＝1マップ修正で全種別に効く。**staff.htmlはstandalone(buildなし・push即反映)・版数`VER`をbump**。**教訓＝staff.htmlはOPシートの個別ミラー→OP本体で移動手段の選択肢を変えたら必ずstaff.htmlのMV_INFOも同期する**(2箇所複製)。staff-v3.13/コミットa1b8d2e。3店中札幌のみ(NHA/BTのstaff.htmlは移動手段機能なし)。

## 🪪 2026-08-04 license.html直提出で免許証バッジが「未提出」のまま＝license_uploadsのRLS欠落
症状＝TOP免許証タブ/タスク🪪ボタン(license.html)から提出しても、OPタスクの`LicenseBadge`が「🪪免許なし(未提出)」のまま。マイページ(my.html)経由だけ反映されていた。**真因＝`license_uploads`(main DB・PK=reservation_id)のRLSがSELECTのみ(anon/authenticated)で、INSERT/UPDATEポリシーが無かった**。license.htmlは**anonキーで直upsert**→**HTTP401でサイレント拒否**(try/catchが飲み込み)。my.htmlはEF`handyman-mypage`(service_role)経由で書くため成功=**経路差**。57 spk行/100 nha行が存在=EF経由分だけ書けていた。**「my.html(mypage)は反映されるがlicense.html直だと反映されない」はこのRLS欠落のサイン**。修正＝license_uploadsにanon/authenticatedの`INSERT WITH CHECK(true)`＋`UPDATE USING/WITH CHECK(true)`を追加(spk_line_links/advance_reimbursements等の既存anon書込パターンに準拠・本表は状態フラグのみでPII無し)＋license.htmlに`resp.ok`検査(サイレント失敗の可視化)。バッジ判定`LicenseBadge`は`window._licenseMap`(license_uploads cnt>0・3分poll)＝コード正常・変更不要。**紐づけキー=reservation_idのみ。NHA license.html(nha)も同一表・同一anon直upsert→今回のtable RLS修正で自動的に治る。BTは別DB=別途要確認**。コミットa872db3。

## 🌐 2026-08-03 my.html「予約が見つかりません」根治＝EF CORSの固定origin (v4.9.7)
症状＝EFをanon直叩き(curl)はok:trueなのに、ライブmy.html(iPhone・**メモ/アプリ内WebViewから起動**)だと「予約が見つかりません」。**真因＝handyman-mypage EFの`cors()`が非allowlist originに固定で`https://nosh2318.github.io`を返していた**（`allow = o && ALLOWED.includes(o) ? o : ALLOWED[0]`）。Apple Notesのアプリ内WebViewは`Origin: null`を送る→ACAO(`https://nosh2318.github.io`)と不一致→ブラウザがlookupをブロック→json空→`!json.ok`で not_found。**curlはCORS無なので通る＝「直叩きOK/ブラウザNG」は典型的CORSミスマッチのサイン**。
- **修正**＝`allow = o || "*"`（origin全許可・エコー）。認証はbody内`mypage_token`(推測不能UUID)のみ・**Cookie/資格情報を一切使わない**ので全origin許可で安全（curlで既に取得可＝追加露出なし）。EF正本`~/spk-task/line_auto/handyman-mypage/`→`~/hdm-car-delivery/supabase/functions/`にcp→`functions deploy handyman-mypage --no-verify-jwt`。**keydrop-mypage/handyman-mypage-nha等 他マイページEFも同じ固定originパターンなら同症状**（Origin:null系で壊れる）→報告が出たら同修正。
- 併せて my.html `load()`に**15sタイムアウト+3回リトライ+🔄再読込ボタン**（`lookupOnce`・永久スピナー対策）。my.htmlはstandalone(buildなし)。
- **教訓＝「EF直叩きは成功するのにブラウザだけ失敗」はまずCORS(ACAO)を疑う**。`curl -i -X OPTIONS -H "Origin: null"`と`-H "Origin: https://example.com"`でACAOがエコーされるか確認（固定値が返れば当該origin以外は全部ブロックされている）。

## 🔑 2026-08-02 KEYDROPマイページ 新カルテ化(kd2.0)＋📊通知管理ダッシュボードを各店TOPに（本番稼働）
### KEYDROPマイページ = 那覇/札幌カルテ仕様に統一（`~/hdm-car-delivery/mypage.html` kd2.0・keydrop.jp）
- **1ファイルで札幌/那覇 店舗切替**＝`DATA.store`(spk/nha・EF応答`json.store`)→`STORE_CFG`で KV(hero-sapporo-kv.jpg/hero-okinawa-kv.jpg)・都市名・天気座標・**地図中心**を出し分け(`storeCfg().center`)。EF=`keydrop-mypage`(FN)・ログイン(KDN-/KD-)・カタログ・約款・免許証(GAS)・変更/キャンセル/早く返すは既存保持。
- **KEYDROP=配達/回収(DEL/COL)専門**＝送迎バス/PUB/BDB分岐を排除・見出し「お届け・回収」。**メール運用**(LINE表記全廃・4言語)。**白KEYDROPロゴ**(`keydrop-logo-white.png`)＝提供PNGから「KEYDROP」ワードマークだけ切出し→背景透過→黒字を白字化(金アクセント/ピン維持・PIL処理)。
- **受け取りボタン**＝`receive_done`をkeydrop-mypage EFに移植(SPK handyman-mypage参照・`keydrop_mypage_changes` field=received applied＋lookup応答に`received`＋札幌のみd-タスク済化＋notifySlackCard)。
- **🔴 店舗固有の誤作動に注意**：札幌用検証(地図中心SPK_CENTER/「※札幌市内のみ」注記/新千歳ブロック)は那覇で誤発火し得る→`storeCfg().center`・`(DATA.store!=="nha")`ゲートで店舗別化。**1ファイル多店舗ページは、店舗固有ロジックを必ず store で条件分岐**。

### 🧪 ライブEF駆動ページの「デプロイ前」render検証（ブラウザ不要・超有用・再利用）
CORSでfile://からEFを叩けない／Chrome拡張未接続でも、**Node+`vm`でDOMをスタブしrender()を実データで実行→例外捕捉**できる：
1. 実EF応答を`curl`で取得→JSON保存(`kdresp_spk.json`等)。2. HTMLから`<script>`抽出→末尾の`load();`除去→`DATA=__RESP__;CATALOG={};render()`をVM内で実行。3. `document`は**寛容なProxy**(getで何でもelProxy返す/setで_v保持)、`$("#app")`はquerySelectorキーで`_v`回収→生成HTMLをgrep検証。**`let DATA`はVM外から差せない→VM内で代入する形にする**。→ render例外・店舗切替・受領カード表示(キャンセル予約は非表示が正)を全部事前確認できた。

### 📊 通知トリガー一覧ダッシュボード（`dashboard.html`＋各店TOPアイコン）
- **dashboard.html を `?scope=nha|spk|bt` 対応**：那覇=HDM那覇+KEYDROP／札幌=HDM札幌+KEYDROP／高松=BUDDICA。`SCOPE_STORES`で表示タブを絞り、店舗タブ1つで〔分析(セクション別滞在)＋お客様URL＋通知一覧〕が一括切替。カルテ(スタッフ ro=1)は分析・URLから除外(ユーザー動向用)。「全体」タブ廃止。
- **各店APP TOP「データ・分析」に📊マイページ解析/通知管理**：SPK=`dashboard.html?scope=spk`(同リポ相対)／**NHA/BTは別リポ＝絶対URL**`https://nosh2318.github.io/spk-task/dashboard.html?scope=nha|bt`。SPK v4.7.491/NHA v3.5.333/BT v1.0.219。
- **全通知トリガーの洗い出し方**＝cron(`select jobname,schedule from cron.job`・UTC→JST+9)＋EF送信タイプ(`line-push`のaction／`keydrop-send-mail`の`case "xxx"`/build関数)。HDM=LINE(mypage_initial/damage_check/license/thanks/returnday＋OP都度:depart/collect/track/time_adjust/advance_park/col_delay/dropoff/mypage_decision)／KEYDROP=メール18種(confirm/reminder_place/reminder/damage_check/license_reminder/reminder_return/returnday/thanks＋都度)／BUDDICA=bt-notifications.html(既存・全7)。

### 🔑 恒久Tips（再確認）
- **GitHub Pages＝HTMLだけpushでは参照画像が404**。新規アセット(ロゴ/KV)は必ず`git add`して別途push→ライブで`curl -o /dev/null -w %{http_code}`で200確認(初回は反映1〜2分)。
- **並行編集**：別agentが自分の作業ファイルを先にコミットする事がある(`git diff HEAD`が空＝working==HEAD＝コミット済／`origin/main...HEAD`=0 0＝push済)。push前に必ず`git fetch`＋差分確認、**自分のファイルだけ`git add`**(他agentの未コミットEF等を巻き込まない)。
- **Supabase PAT(`~/.config/keydrop/sb_token`)失効**→`https://supabase.com/dashboard/account/tokens`で再発行(GitHub 2FA必須化はSMS設定で通過可・パスワード不要)。deno無し環境は`curl -fsSL https://deno.land/install.sh|sh`→`~/.deno/bin/deno check`でEF構文検証。

## 🟢 2026-08-01 那覇カルテ「早く返す(早め回収)」＝申請→承認→LINE自動送信（本番稼働・my-nha v9.0）
札幌my.htmlの早め返却機能を**那覇カルテ(my-nha.html)のCOL(回収)ユーザー**に実装。承認制も同一。**EF正本=`~/spk-task/line_auto/handyman-mypage-nha/index.ts`**（deploy=`~/spk-task/supabase/functions/`にcp→`functions deploy handyman-mypage-nha --project-ref ckrxttbnawkclshczsia --no-verify-jwt`）。
- **フロー**：お客様がカルテで「🟢早く返す」(希望回収時間プルダウン)→ EF `ready`が`mypage_changes`(field=ready,store=nha,status=requested)記録＋**Slackカード通知**(#okinawa_operations-team C06L91W6T08) → スタッフが**📲マイページ利用状況(mypage-usage-nha.html)上部の🟢承認待ち**で✅承認/🚫却下（EF `decide`・スタッフJWT認証）→ **お客様へLINE自動送信**（承認「承りました」/却下「予定のお時間で回収」）＋結果Slackカード。
- **カルテ表示ゲート**＝`!RO && !cancelled && r.return_type==="COL"`（editable=false固定でも出る）。呼出は既存`call("ready",{time})`。
- **承認UI**＝`decideReady(id,decision)`が`FN`(handyman-mypage-nha)へ`{action:"decide",staff_token:authTok(),change_id,decision}`。未ログイン(authTok=ANON)はalert中断。BUSYで二重防止。
- **通知＝Block Kitカード型**（「タスク完了」通知と同型）：header＋fields(お客様/予約番号/ご予約元/利用期間/予定回収/お客様の希望)＋context。申請/承認/却下の3種。
- **line-push経由の実送信条件**：action=`mypage_decision`は`noticeAct`(mypage_始まり)で**日付ガード回避**・`enabled`既定true・**test_mode=false**で実顧客へ（nha_line_config確認済）。未連携は`no_userid`で安全スキップ。LINEPUSH_SECRET(project共通)はEFにsecret設定済。
- **検証済(2026-08-01)**：EF deploy＋ping OK、COL予約85件(全URL発行)・うちLINE連携48件、実ready発火→Slackカード投稿確認、test_mode=false。テスト行は全削除済(承認待ち0)。
- **⚠️トークン運用**：Supabase PAT(`~/.config/keydrop/sb_token`)は失効する→`https://supabase.com/dashboard/account/tokens`で再発行。2026-08-01に`handyman3`(〜8/31)へ更新。GitHubは2FA(SMS)設定済。deno無しは`curl -fsSL https://deno.land/install.sh|sh`→`~/.deno/bin/deno check`でEF構文検証。

## 📲 2026-07-30 札幌スタッフ タスク担当付け外し→本人LINE通知（本実装・稼働）
アルバイトにタスク担当を付けた/外した時に公式LINEで本人へ通知。オーナー承認済み・SPKのみ。
- **紐付け**：`spk_staff_line_links`(staff_id/staff_name/line_user_id/**notify_type**(instant|hourly)/release_notify)。エルメ受付フォーム回答CSVを取込(顧客と同方式・userIDはエルメCSVのみ)。5名紐付済(三國/武山瞳/三木/高橋/長谷川)・加藤/えりちゃん/小林は未回答・小林notify_type未設定。**紐付けキー=staff_name(さん付き正規化`regexp_replace(name,'さん$','')`で照合)**。
- **検知**＝トリガー`trg_spk_staff_notify`(tasks・**AFTER INSERT/UPDATE・enqueueのみ・例外安全＝tasks書込を絶対止めない**)。`tasks.assignee`変更(付/外・墓標deleted=trueも外扱い)を対象スタッフだけ`spk_staff_task_notify`(キュー)へ記録。非対象(正社員=大下等)は拾わない。※audit_logはassignee差分を記録しない(2026-07-09)ので検知はトリガー必須。
- **送信EF**＝`staff-task-notify`(正本`~/spk-task/line_auto/staff-task-notify/`→deploy実体`~/hdm-car-delivery/supabase/functions/`・`--no-verify-jwt`・secrets=LINE_CHANNEL_TOKEN/FUNC_SECRET再利用)。body`{secret,mode:'instant'|'hourly'|'test',staff?[]}`。
  - **instant**(三國/高橋/長谷川)＝即時。付『M/D タスク依頼がありました🔗』／外『M/D タスク調整がありました』
  - **hourly**(武山瞳/三木/加藤/えりちゃん)＝1h毎まとめ・最新状態のみ。付『M/D 出勤依頼 スタッフリンク確認ください🔗』／外『M/D 出勤不要になりました』／付↔外両方『M/D タスク調整がありました🔗』／同1h内で付→外(純ゼロ)は相殺で送らない
- **cron**＝`spk-staff-notify-instant`(*/2)・`spk-staff-notify-hourly`(0 * * * *)・net.http_postでEF起動。
- **検証済(2026-07-30)**：三國/武山瞳/三木へmode=testで送信ok:true(LINE着信)。トリガー照合SELECTで対象解決/さん正規化/非対象除外を確認。完了報告は元スレッド(CH=C0B66BVCSPM/TH=1785390573.007159)へCLIからdrop→号1が同一スレッドへ投稿(会話分断せず)。
- 残：加藤/えりちゃん/小林のCSV追加取込／小林notify_type設定／🔗はSPK app TOP URL(専用スタッフページは将来)。

## 📋 2026-07-28 札幌 月次レポート機能 追加（report.html・PDF出力可）
TOP「データ・分析」→**📋月次レポート**＝`report.html`（独立HTML・vanilla・印刷最適化）。対象月選択→**合計売上/件数(予約)/客単価/平均泊数/稼働率グロス/チャンネル別構成率/クラス別売上構成比・稼働率**を表示、**📄PDF出力(window.print・@media print A4)**。
- **正本箱`monthly_snapshots`(store=spk)の1行から全項目を読む＝再集計なし**(ドクトリン順守)。客単価=total_revenue÷total_returns／平均泊数=total_rental_days÷total_returns／稼働率=utilization_pct／チャンネル=ota_detail(ota/pct/count/revenue)／クラス=class_detail(type/revenue/util_pct/adr/count)。snapshot全フィールド＝active_vehicles/total_rental_days/total_available_days/utilization_pct/total_revenue/revpacd/avg_daily_rate/total_returns/same_month_bookings/booking_rate_pct/cancel_count/total_bookings/cancel_rate_pct/class_detail/ota_detail。
- 認証＝本体アプリのログイントークン再利用(`_sbToken()`＝localStorage sb-*-auth-token・sim.html/gatekeeper.htmlと同方式)＋anon。未ログインは案内表示。当月/未来月は「途中値」注記。
- v4.7.480 / spk-v1019 / SW_V=912。build.jsで index.src.html→app.js。**教訓：build.jsは`node build.js`単体で実行し出力(✅Build complete)を必ず確認**（tail -5でパイプすると出力が出ず未ビルドに気づけない・今回1回空振りした）。将来NHA/BTへ横展開する時は store値(nha/spk・BTはtkm)とクラス色/OTA名マップを合わせるだけ。

## 🆘 2026-07-27 オフラインOPエクスポート（障害時バックアップ・GAS→Googleスプレッドシート）
Supabase障害(API層ハング)でアプリが開けない時に、**当日OP＋スタッフ別タスクをGoogleスプレッドで読める**避難所。正本＝`~/Desktop/HANDYMAN/offline_export/gas_offline_op_export.gs`＋`README_setup.md`。
- **仕組み**：GAS(Google基盤)が**15分毎(setupTrigger)にManagement API(SQL `/database/query`)経由**で3店のタスクを取得→各店スプレッドに `当日OP`／`翌日OP`／`👤担当名`(個別URL相当) タブを上書き。**REST障害中もSQLは生きているので更新継続**・完全障害でも最後の書出しが残る＝当日OPは必ず読める。閲覧専用(DBには戻さない)。
- **なぜSQL経由**：過去の障害は全て**REST(API層)ハング＝SQL(mgmt-api)は201で生存**。だから避難所はSQL経由が正。RESTポーリングだと障害中に一緒に死ぬ。
- **スキーマ差(重要)**：SPK`tasks`=英語列(type/time/name/assignee/vehicle/plate_no/place/insurance/ota/done)。NHA`nha_tasks`/BT`bt_tasks`=**日本語列**(内容/時間/予約者/担当/車種/No/送迎場所/OTA)＋`reservation_id`無し(`予約番号`)＋**done boolなし**(確定列は補償値"NOC"が入る罠→doneは空にする)。→ 予約/車両JOINせず**タスク行の非正規化列を直接**書き出す(エラー源除去・OP表示と同じ)。
- **設定**：`SB_PAT`(=`~/.config/keydrop/sb_token`のsbp_・3プロジェクト全部で201確認済)をスクリプトプロパティに。スプレッドID3つ(SPK=1xKx…/NHA=16Vq…/BT=1iFx…)はGAS埋込済。**GASデプロイはオーナー作業**(script.google.comで貼付→runExportAll手動実行で権限承認→setupTrigger)。PAT失効(〜30日)で更新停止(シートは最後の内容残る)。
- **社内共有メモ**：平常時はアプリ使用(裏で自動更新・見なくてOK)／障害時はスプレッドURL(固定)を開く／SSは見るだけ・復旧後にスプレで対応した分をアプリ再入力しない(二重登録防止)。
- 本命は単一クラウド依存の解消(PITR ON/東京レプリカ)。これは即効の避難所。

## 📧 2026-07-25 KEYDROP通知の全経路を整理＋当日オペ全ボタンをメール化＋2バグ修正（SPK v4.7.449）
KEYDROP傷チェックのメール未達疑いから、KEYDROPの自動通知経路を全て確認し、穴を3つ塞いだ。**KEYDROP客はLINE未連携が多く、通知は「メール（Resend）」が正**。台帳(keydrop_notifications)＋cron実行履歴(cron.job_run_details)で稼働を検証するのが確実。

### 🧭 KEYDROP通知の全体像（覚える）
- **配送エンジン**＝`keydrop-send-mail`（pg_cron jobid6・毎分）。`keydrop_notifications(sent=false)`を回収→Resend(`reserve@keydrop.jp`)で送信→sent=true。全通知はこのキュー経由。テンプレは同EFの`build*`関数。
- **時刻トリガー(cron)**：`keydrop-damage-check`(jobid32・08:00JST・傷チェック)／`keydrop-returnday`(jobid36・30分毎=**チェック頻度**、1予約1回・dedup・9時ゲート)／`keydrop-thanks`(御礼)／`keydrop-reminder`(前日)／`keydrop-place-reminder`(場所3日前)／`keydrop-return-reminder`(返却前日)／`keydrop-expire-pending`(未決済60分失効)／`keydrop-budget-watch`／`keydrop-rate-purge`。
- **イベント駆動(cron外)**：決済→confirm／マイページ変更承認→change_done等／配達・回収開始(driverページ)→track_delivering/track_collecting／到着→arrival／免許→license_reminder。
- **当日オペボタン（OPシート）の正体**＝RPC `keydrop_enqueue_button(p_resv,p_kind,p_track_url,p_plate,p_time)`。`ota==="KEYDROP"`分岐でメール／LINE連携客はLINE(line-send)／非KEYDROP未連携はコピー、の3分岐。p_kind→type：depart→track_delivering／collect→track_collecting／arrive_del・arrive_col→arrival／**delay_del・delay_col→delay(p_time=到着予定)／dropoff→dropoff**。

### ① 遅延・乗捨ボタンをKEYDROPメール化（このセッションの本題）
出発/到着/回収は既にKEYDROPメール対応済だったが、**遅延(ColDelayModal)・乗捨(dropoff)だけLINE専用**で未連携KEYDROP客はコピー止まりだった→出発/到着と同じRPC経路に。3層：①RPC拡張(delay_del/delay_col/dropoff+p_time引数・DROP+CREATE+GRANT service_role/authenticated/postgres)②`keydrop-send-mail`に`buildDelay`/`buildDropoff`追加(deploy済)③アプリ`index.src.html`のColDelayModal.send・dropoffボタンに`if(kd){sb.rpc("keydrop_enqueue_button",...)}`分岐追加。LINE/コピー経路は無変更＝additive。**NHA(KDN-)はRPC側は対応済・NHAアプリ本体の遅延/乗捨ボタン分岐は未実施（残）**。

### ② リマインド3cronが全期間failed=1通も未送信だった（DB修正済）
`keydrop_enqueue_reminders`/`_place_reminders`/`_return_reminders`が、`reservations.lend_date`/`return_date`（**text型**）をdate比較して`operator does not exist: text = date`で**成功0回・失敗18〜44回＝一度も送られていない**。→比較を`col ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`(書式ガード)＋`col::date`に修正。**さらに二重バグ発見＝nha側ins2が存在しない列`user_name`参照→`name`に修正**（nha_reservationsの正しい氏名列=`name`・クラス=`vehicle_class`）。3関数実行して型エラー解消・今日対象0で誤送信なしを確認。今後cronで自動送信。

### ③ 傷チェック未対応アラートの誤検知（EF修正・deploy済）
`damage-overdue-alert`がLINE経路(spk/nha_line_sends action=damage_check)だけ見て「送ったか」を判定→**KEYDROP客はメール経路(keydrop_notifications)で送られるので、メール送信済みでも「未対応」と誤警告**していた（今朝の柳澤様KD-2607-0005-WWAアラートの正体）。→doneSetに`keydrop_notifications type=damage_check sent=true`(reservation_id突合)を加えて除外。SPK/NHA両対応。

### 🔑 教訓
- **KEYDROPの「送ったか」はspk_line_sendsでなく`keydrop_notifications`(sent=true)で見る**。line_sendsのno_useridだけで「未送信」と判断してはいけない（メールに落ちている）。
- **cron稼働確認＝`cron.job_run_details`のstatus**（active=trueでも中身の関数が常時エラーで実質死んでいることがある。今回3cronが該当）。送信実績は`keydrop_notifications`をtype別に`sent/failed/pending`集計。
- **text型の日付列をdate比較する時は必ず書式ガード＋::d/date キャスト**（KEYDROPのlend_date/return_date/start_date/end_dも全部text）。

## 🧾 2026-07-21 立替金（業務委託事業）ツール＝立替専用ページ advance.html を新設（別URL・匿名アクセス）
業務委託事業の立替を3人で登録・精算する軽量ツール。**invoice_managerの機密（請求書/受領請求書）を見せずに立替だけ切り離すため、立替専用の独立HTMLを別URLで配信**。
- **公開URL（2名の業務委託先はこれだけ渡す）**：`https://nosh2318.github.io/spk-task/advance.html`（spk-taskリポ配下・単一HTML・vanilla・buildなし）。ログイン不要＝**anonキーで読み書き**（`advance_reimbursements`はanon full RLS・received-invoicesバケットにanon POST可）。⚠️URLを知れば誰でもアクセス可(anon)＝URLは限定共有。
- **DB `advance_reimbursements`**（main ckrxttbnawkclshczsia）：submitter(提出者)/occur_date(発生日)/pay_date(支払日)/payee(支払先)/category(科目)/amount/**status(unpaid=未精算|billed=請求済み|paid=精算済・3値)**/paid_date/**pay_method(現金|カード)**/**entry_type(biz=業務委託立替|personal=個人立替・既定biz)**/detail/memo/file_url,file_name,file_type。領収書はStorage `received-invoices/advance/`。
- **機能**：登録/編集/削除・**状態3値サイクルボタン(未精算→請求済み→精算済 `cycleAdvStatus`)**・領収書(画像/PDF)添付・**月を大枠に折りたたみ表示(details.advmon)＋セレクタ`adv-subgroup`で月内を提出者別に細分(details.advsub)**・提出者/状態絞込・**CSV出力**・**領収書一括ZIP DL(全体＋月ごと＋人別 `advDL(mk,pk)`)**・**支払方法を現金/カードで分割集計**(上部💵現金/💳カード＋表に方法列)・**上部トグル`setAdvType`で「🏢業務委託立替」と「👤個人立替」を別枠独立**(_advType・`_advFiltered`が entry_type で絞る＝集計/DL/CSV全連動)。提出者名はlocalStorageに記憶(datalist)。未精算合計は status!=='paid'(請求済みも未回収に含む)。
- **🔁 invoice_manager.html の立替タブは `advance.html` を iframe 表示**（2026-07-23に複製→iframe統一・単一ソース化）。同じ`advance_reimbursements`共有。**仕様変更は advance.html だけ直せば両方に反映**（旧: 2箇所複製は解消）。ナビ「🧾 立替（業務委託）」→`showView('advance')`。
- **教訓**：機密混在ツールから一部機能だけ外部共有する時は、client側でタブ隠しでなく**機能だけの独立HTMLを別URL配信**が安全（他機能のコードが物理的に無い）。anonツールのStorage POSTは`Authorization: Bearer <anon>`必須。



## 🪪 2026-07-21 高松(BT)に免許証システム展開＋全店 未提出アラート（このセッション）
- **BTご利用ガイド(`buddica-touring/app/guide/index.html`)に免許証アップUI追加**：撮影/選択→GAS(store=bt)→Googleドライブ保存＋`license_uploads`(BT DB・on_conflict=reservation_id)記録。`renderLicCard`/`licUpload`（vanilla）。boot()で既存アップ有無を確認して描画。RO/DEMOは閲覧のみ。GAS定数＝license.htmlと同じ`/exec`＋SECRET`hdm-lic-7c3f9a21`。
- **GAS `~/Desktop/HANDYMAN/license_drive_upload.gs`にBT専用フォルダ保存**：`STORE_FOLDER_ID={bt:'1rc7jZ2KoLV8oSoCxnI3It4UvQoVDxFFZ'}`（指定IDのフォルダ直下に`<予約 氏名>`）。**格納先は後で変更可＝このIDを差替えるだけ**。**2026-07-22 オーナーがGAS再デプロイ完了→新/exec URL `https://script.google.com/macros/s/AKfycbycpzE1RIu2LbIlYVeRYcXxfIgfDhY5y1Vtdh1Rj69S9uZEnmqFMDBHqq3y6pHS70_t7A/exec`（GET=JSONで公開確認済）。全アプリの`GAS_LICENSE_URL`を新URLに更新済**（spk/nha license.html・my.html・my-nha.html・BT guide/index.html の5ファイル・旧`AKfycbyR29DN…`から差替え）。⚠️**GAS URLはスクショOCRで転記ミスしやすい(`Lbll`↔`LbIl`＝l/I)＝必ずコピーボタンの値で。curl検証はGETのみ有効(POSTは302で本文落ち＝失敗ではない)**。⚠️残確認＝BUDDICAフォルダ`1rc7jZ`がGAS実行アカウント(noritaka.oshita@gmail.com)からアクセス可か（不可ならbtアップがok:false）＝実アップ1件で要確認。
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

## 📋 2026-08-24 3店 日報 自動投稿（Edge Function daily-report＋pg_cron・毎朝9:00 JST）
オーナー要望「那覇・札幌・高松の日報を毎朝9:00に前日フル(0:00〜23:59)で #日報_handyman に各店別投稿」。APPの「日報→テキストコピー(buildDailyText)」6セクションをEdge Functionに移植し値を完全一致で自動化。
- **EF `daily-report`**（正本`~/spk-task/line_auto/daily-report/index.ts`→deploy実体`~/hdm-car-delivery/supabase/functions/`・main project ckrxttbnawkclshczsia・`--no-verify-jwt`）。3店ループ：NHA/SPK=main、**BT=別DB(BT_URL/BT_SERVICE_KEY secretsでクロスDB read)**。出力は**3セクション固定**（①件数・売上累計 ②本日の流通 ③KEYDROP月別）＝オーナー指定で簡潔化(2026-08-24)。チャネル別×2/リードタイム/月別推移/CV構成比/車両ランキングは除外。**高松はKEYDROPデータなし→③自動非表示**。ヘッダーは店舗絵文字＋太字(🌺那覇店/❄️札幌店/🍜高松店・Slack mrkdwn `*bold*`)。①内に**「📊売上見通し（返却月）」**を当月累計直下に追加＝Slack引用バー(`> `)＋絵文字＋金額太字で強調：当月=売上のみ／翌月・翌々月=予約数+売上(進捗)。各月に**稼働率**を付与＝**配車表(FleetTimeline)上段の値と同一のライブ計算**（`computeUtil`＝Σ配車日数÷(稼働台数×月日数)・active車のみ・月次KPI(vehicle_monthly_kpi)のactive上書き反映・メンテ減算なし＝配車表totalUtilと同式）。3店とも当月+翌月+翌々月をライブ算出（BTもbt_fleet/bt_vehicles/bt_vehicle_monthly_kpiで可）。**⚠️monthly_snapshots.utilization_pctは使わない**＝未来月がAPP起動時しか更新されず古く「配車表と違う」誤値になる（2026-08-24オーナー指摘で是正）。**検証済(2026-08-24 ブラウザで配車表を実確認)：SPK 8月58%(308/527)・9月21%(116/540)・10月8%(47/558)＝EF出力と完全一致**。オーナー指示＝「ルール(再計算)でなく配車表に既にある値を使え」。
- **マッピング差**：SPK=`ota A→O`・`lend_date/return_date`／NHA・BT=`start_date/end_date`。extra_sales＝各店`{spk_/nha_/bt_}accounting type=extra_sales`。fleet=reservation_id→vehicle_code、返却月集計はvehicles.codeに在る車両のみ（配車済）。reservationsはRange paginationで全件（NHA2000超対策）。
- **前日フル＝スナップショット**：reportDate=昨日JST、cutoff=昨日23:59:59 JST(=14:59:59 UTC)。createdAtがcutoff超の取込は除外（当日朝の取込を混ぜない）。`?dry=1&store=nha&date=YYYY-MM-DD`で検証可（投稿せずテキスト返す・cron secret不要）。
- **cron**：pg_cron `daily-report-9am-jst`(jobid51・`0 0 * * *`UTC=9:00JST・active)→net.http_postでEF起動(x-cron-secret=CRON_SECRET)。
- **投稿先**：#日報_handyman(**C0BSXE4TKLG**・HANDYMAN GLワークスペース)＝3店とも同chなのでbotトークン共通(SLACK_BOT_TOKEN)。bot(sns_auto)は在籍済。header="HANDYMAN{那覇/札幌/高松} 日報"。
- **検証済(2026-08-23分)**：dry出力がAPP例と完全一致（那覇 当月246件/¥8,627,842・予約外¥162,602・計上返却月チャネル別・KEYDROP12本/¥127,495・リードタイム全一致／本日の流通は前日フルで+7→+8＝18時スクショ後の取込増で正常）。実投稿3店ok:true。
- **教訓**：APPのReact計算(buildDailyText)をDeno EFに"そのまま移植"すれば「再集計するな＝値をブレさせない」を守れる。店舗差(列名/ota変換/別DB)はstore configで吸収。Management APIのcron登録はurllib=403(Cloudflare)→**curl --data-binary必須**。

## 🌙 2026-08-27 マイページLINEリマインドが深夜0:00に届く根治＋場所未設定の誤爆是正（mypage-notify EF・SPK/NHA共通）
オーナー報告（LINE橋爪様スクショ）「場所リマインドが0:00送信＝非常識・他ユーザーにも送ってる？」。実データ確認＝直近7日で**前日リマインド(mypage_daybefore)23件が全部JST 0時**・場所未設定(mypage_place)2件も0時に送信。
- **①深夜送信の真因**：cron`mypage-notify-spk/nha`は`*/15`で24h回る。`mypage_place`(貸出3日前)・`mypage_daybefore`(前日)・`mypage_initial`(初動)は**時刻ゲートが無く**、日付が該当日に変わった直後の0:00〜0:15サイクルで発火していた（returnday=9時ゲート/return3h=時刻計算 は正常）。→ `jstHour>=9 && <21`の`daytime`ゲートを①②③に追加。
- **②場所未設定の誤爆**：橋爪様(MDL03820・HP直販)は予約`del_place/col_place=丘珠空港`が入っているのに「未設定」リマインドが飛んだ。未設定判定が**OPタスク解決値(placeByRes)しか見ておらず予約側del/col_placeを見ていなかった**（HP直販は場所が予約側にのみ入りOPタスクplace列は空＝2026-07-16の「表示は予約から導出」と同型の穴）。→ selectに`col_place`追加＋`hasPlace=placeByRes||del_place||col_place`に是正（CLI側で先行修正済・横展開合流）。
- **教訓**：①定時cron発火の通知は必ず「JST時刻ゲート」を付ける（日付トリガーは日跨ぎ直後=深夜に発火する）。②「未設定/未回答」系の判定は、OPタスクだけでなく**予約(reservations)の該当列も必ず見る**（HP直販は予約側にしか値が無い）。mypage-notifyは単一EFがstore paramでSPK/NHA両対応＝1デプロイで横展開。

## ⚠️ 2026-09-01 GクラスがFに誤配車 再発＝「コード修正済み＝直った」の誤報（本番GAS未反映・自戒）
オーナー「前回GがFに割れた時に確認して"誤りない"と言ったのに再発。Gが無かったは嘘だ」＝**正しい指摘**。事実＝**Gクラスは前から存在**（KEYDROPでclass_G.png/デミオ・ノート運用中）。**前回のG→F誤配車で原因(取込GASのクラス判定がA/B/C/S/F/Hのみ・Gが無い→"G_SPK"がletter判定を全外し→キーワード保険"コンパクト"→F)を特定し、コードを8/25に修正(commit 8b06b82「G枠誤取込(F化)根治」)して「根治」と報告した。だがGASはApps Script貼付まで本番反映されないのに貼っていなかった＝実際は直っていなかった**。証拠＝8/25コード修正済みなのに8/26以降のG予約(R0KNIDO2/C260900022/R0G2AJSM・じゃらん/エアトリ「☆コンパクトカー_G_SPK☆」)が全部Fで取込＝本番GASは今も旧版。誤配車3件はDB手修正済(G/ノート6906)。
- **根本の失敗＝コード(リポジトリ)を直して「直った」と断言し、動いている本番GASで実際に取り込んで裏を取らなかった**。CLAUDE.md鉄則「実データで裏を取ってから言う/実際に実行して確認してから言う」を自分で破った。**恒久ルール：GAS修正は「コードを直した」で完了報告しない。①オーナーがApps Scriptに貼付→②次の実予約が正しく取り込まれるのを本番DBで確認、まで見て初めて『直った』と言う。** 「根治」の語をコード段階で使わない（貼付まで再発し続ける）。
- 未反映のまま残っているGAS修正＝`gas-email-import-v2.gs`(commit 8b06b82・Gクラス追加)。オーナー貼付待ち。貼るまでG予約(じゃらん/エアトリ _G_SPK)は毎回F誤配車。
- **⚠️ Gクラスは「全媒体」にあり（2026-09-01 オーナー確定・じゃらん/エアトリ限定ではない）**：じゃらん/楽天/skyticket/エアトリのOTAメールは`extractVehicleClass_`(G∈`[ABCSFHG]`)でG対応済。だが**HP直販(parseOfficial_のMODEL_CLASS_MAP)とSlack手動予約(validClasses)とSPK_MODEL_TO_CLASSはGが漏れていた**→デミオ/ノート→G を3箇所に追加(commit・全媒体G対応)。**新クラス追加時は「文字クラス`[ABCSFHG]`」だけでなく、①車種名→クラスの全マップ(SPK_MODEL_TO_CLASS/HP MODEL_CLASS_MAP)②Slack手動のvalidClasses③各OTAパーサー、を全部横串で更新する**（1媒体だけ直すと"半分だけ直した"再発になる）。G車両＝ノート0000(plate6906)/デミオ6666(plate6864)。配車はデミオ優先(オーナー指示)。
