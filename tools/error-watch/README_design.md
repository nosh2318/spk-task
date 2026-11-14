# エラーを拾う見張り（3店・main/BT）設計メモ（2026-11-14 20:50・案）

nosh 20:42「しつこいけど エラーを拾ってくれ」「全部」。
決まり：拾ったら自動で1〜2回やり直す（送り済みは log_key で飛ばす）→それでもだめな時だけ、システムの部屋に Slack を1件出す。
Slack には必ず次の3つを書く：①原因 ②システムが自動でやったこととその結果 ③人がやること（無ければ「対応不要」）。

※ CLAUDE.md §3.6（パトロール・自動修復・同期 cron を新設しない）とぶつかる。今回はオーナー本人の明示の依頼なので作る。ただし、データを書き直す修復はしない。やるのは「同じ呼び出しをもう一度する」だけ（送り済みはそれぞれの仕組みが飛ばす）。

## 今夜の事故で分かったこと（証拠）
- 高松 BUDDICA の前日メール：bt-mail-remind（18:00）は 0件、bt-mail-dayof（20:00）は 5件中1件しか送れていなかった（bt_mail_log）。
- cron の net.http_post は timeout 5秒（既定）。net._http_response（直近6時間）を見ると、BT は 760件中 254件が timeout（DNS が原因 68件・EF が5秒を超えた 186件）、main は 2923件中 25件。
- EF が5秒を超えると呼び出し元が切れ、EF の処理も途中で止まる（dayof は1件目を送った後に止まった）。cron.job_run_details は「成功」のまま＝今の仕組みでは誰も気づけない。

## 失敗する所の一覧（どこで・何が・どう拾う・どうやり直す）
| 段 | どこ | 何が失敗する | どう拾う | どうやり直す |
|---|---|---|---|---|
| 1 | cron→EF（main 31本・BT 15本） | 5秒で切れる・DNS・5xx・EF の ok でない返事 | cron を「呼び出し口」関数経由にして request_id を記録→ net._http_response と照らす（5分ごと） | 一日一回の送信系（bt-mail-*・license-reminder・thanks 等）は3分後・10分後に同じ呼び出し。毎分・数分ごとのものはやり直さず、続けて3回失敗したら知らせる |
| 1 | cron の SQL（DB 関数） | 関数のエラー | cron.job_run_details の status=failed | やり直さない（同じ関数は同じ理由で落ちる）→すぐ知らせる |
| 2 | メール送信（Resend：bt-mail-send・hdm-send-mail・keydrop-send-mail・hdm-tkm-send-mail） | Resend が ok でない | 各ログ表（bt_mail_log status=failed・hdm_*_notifications error） | 送信の待ち行列はもともと次の回で再送する。3回失敗したら知らせる |
| 2 | Slack 通知そのもの | chat.postMessage が ok:false・pg_net の失敗 | Slack を送る共通の口（EF の slack()・DB の net.http_post）の失敗を1つの表に記録 | 1回やり直し→だめならもう一方のワークスペースのシステム部屋へ知らせる |
| 2 | LINE 送信・楽天のメール | 送れない | 送信記録（bt_line_sends 等）の error | 次の回で再送・3回で知らせる |
| 3 | 取込 GAS（札幌・那覇・高松）・エルメ取込 | 止まる・Gmail 上限・トリガー消え | 既存の心拍（heartbeat）が予定時刻を過ぎても無い | やり直しは GAS 側のトリガー。止まりを知らせる（偽陽性に注意：早期 return でも心拍を書く決まり） |
| 3 | Mac mini 常駐（com.handyman.* 46本・オムニ cs_autoreply/omni-desk/omni_learn） | 止まる・終了コード≠0 | launchctl の終了コード＋各ログの最終更新時刻→ main の cli_heartbeat に5分ごと書く | launchd の再起動に任せる。2回続けて失敗したら知らせる |
| 3 | DB トリガー・関数 | 例外で書込が止まる | 例外を握りつぶしている箇所を洗い出し、失敗を記録表へ | やり直さない→知らせる |
| 4 | 画面のボタン（保存・EF の返事） | 保存失敗・EF のエラー | 画面の dbLog（既存の赤バッジ）を EF 経由で記録表へ | 画面ではやり直しボタンを出す。同じ人が3回失敗したら知らせる |

## 第1段の中身（今夜作る・本番はオーナーの言葉の後）
- 表 private.cron_calls（main・BT）：job・request_id・attempt・at・結果（ok/timeout/http/body）・知らせた時刻。
- 表 private.cron_jobs：job・元の呼び出し文（秘密を含むので private・service_role も読めない）・やり直してよいか（retry_ok）・やり直しの間隔。
- 関数 private.cron_call(job, attempt default 1)：元の呼び出し文に timeout 60秒を足して実行し、request_id を記録。
- cron.job の command を `select private.cron_call('<job>')` に差し替え（元の文は cron_jobs に移すだけ・中身は変えない）。
- 見張り cron（5分ごと）private.cron_watch()：
  - cron_calls と net._http_response を照らす。timeout・5xx・本文に ok:false/error → 失敗。
  - retry_ok の仕事は 3分後・10分後にやり直す（送り済みは各 EF が log_key で飛ばす：bt-mail-cron は確認済み）。
  - やり直しても失敗、または retry_ok でない仕事が3回続けて失敗 → システムの部屋（main＝HANDYMAN システム C07B5G3PV7C／BT＝C0BFD7U097V）に1件。同じ仕事は1時間に1回まで。
  - cron.job_run_details の failed も同じ見張りで拾う。
- 文の型（例）：
  【高松｜システム／自動送信】前日メールの送信が失敗しました
  ①原因：呼び出しが60秒で切れた（DNS）
  ②自動でやったこと：20:03・20:10 に送り直し → 2回とも失敗
  ③人がやること：BUDDICA 管理画面で明日出発のお客様に案内を送ってください（対象3件）
- 傷チェックの不備通知（bt_damage_defect_watch・main 側も同じ）も、この3つの形に書き直す（原因＝どの案内が無いか、自動＝送り直しの結果、人＝何をするか）。

## 影響元
- 書込：cron.job の command（46本）・新しい表2つ・見張り cron 1本（main・BT）。EF・画面・GAS は第1段では触らない。
- 読込：net._http_response（6時間で消える）・cron.job_run_details。
- 増えるもの：やり直しの呼び出し（失敗した時だけ）。Slack は「やり直してもだめ」な時だけ。

## 戻し方
- cron.job の command を private.cron_jobs の元の文へ戻す（1文）。
- 見張り cron を unschedule。表・関数は drop（記録だけで業務データなし）。

## レビュー（21:20・条件付き）と対応
- ①同じ仕事の重複通知 → distinct on (job)・1時間に1回。済
- ②日次の仕事が3日気づけない → 分の欄が * / */n / 並び の仕事だけ「続けて3回」、それ以外は（やり直し後の）1回目で知らせる。済
- ③Slack の口：本番の前に、同じトークンで main=C07B5G3PV7C・BT=C0BFD7U097V に1件ずつ試しに出し、ok:true を確かめてから見張りを入れる（本番手順）
- ④job_run_details の failed は「始められなかった（startup timeout・connection failed）」と「DB の処理エラー」で文を分け、retry_ok の仕事はやり直す。済
- ⑤見張り自身が落ちたら素の1行を出す。済。本文判定は先頭の階層の ok/error だけ。済
- ⑥傷チェック不備の文は第1段の後に入れる。文は「呼び出しが途中で切れた時は」に直した。済
- 本番の前に cron.job の文を ~/.config/keydrop/cron_commands_<db>_20261114.json（600）にも控える
- 第2段で拾うもの：bt-mail-cron は Resend の失敗を skipped に数えるので返事からは拾えない → bt_mail_log の failed を見る

## 本番の順（オーナーの言葉の後）
1. 控え：cron.job を JSON に（600）
2. Slack 試し出し（③）
3. main・BT に error_watch_stage1.sql（__CH__/__SYS__ 差し替え）
4. 5分後に cron_calls に行が入り result=ok が付くか確認
5. BT に bt_damage_defect_watch_v2.sql
戻し：error_watch_stage1_rollback.sql（main・BT）／backup_bt_damage_defect_watch.sql

## 第2段（11/15 6:40・案）：送信の失敗
- 第1段の後「高松の残り1割」は、差し替え直前（6:00:00〜05）に出た旧い呼び出し8件だけだった。6:05以降、見張りの外の失敗は0件。
- A：DB の中から直接出る呼び出し（トリガー・関数の Slack・メール）は、送り元が分からないので失敗を10分ごとに数え、3件以上で知らせる（やり直さない）。
- B：Slack が ok:false を返した時は、理由（not_in_channel・invalid_auth 等）ごとに知らせる。
- C：メールの失敗。BUDDICA（bt_mail_log failed）は、その種類の送信を1時間おきに2回までやり直す（送り済みは飛ばす）。だめなら知らせる。HANDYMAN・KEYDROP・高松 HANDYMAN の送信待ちは毎分の送信がやり直すので、30分たっても送れない時だけ知らせる。
- D：LINE の failed/error（skipped・no_userid は正常の見送り）。
- 同じ種類は1時間に1回。見張りが落ちたら素の1行。
## 第3段（11/15 7:20・用意済み・本番は nosh の言葉の後）
調べて分かった今あるもの（増やさず使う）：
- 取込 GAS：那覇・札幌（高松 HANDYMAN 含む）は GAS が心拍を書き、import_stall_monitor（毎時）が7〜23時に3時間止まりで本部へ出している（旧い文の型）。GAS の FATAL（Gmail 上限など）は GAS 自身が3時間に1回 Slack へ出す。高松 BUDDICA リレーは 11/13 nosh「不用」で記録だけ → 変えない。
- Mac：オムニの常駐8本は omni_selfheal（2分ごと）が心拍10分止まりで立ち上げ直し、直らない時だけ #omni-agent へ。今、失敗で終わっている常駐は0本。
- 画面：3店とも保存の失敗は dbLog が赤い印を出すだけで、本部には届いていない。
第3段で足すもの：
- F 取込 GAS（main）：那覇・札幌・問い合わせの心拍が7〜23時に3時間止まったら①②③で1件（1日1回）。旧 import_stall_monitor は記録だけにする（二重に出さない）。②＝GAS は15分ごとのトリガーで自動で動き直す。
- G Mac（main）：cli 心拍が10分止まったら「Mac mini が止まっています」（Mac が止まると誰も知らせられないので DB 側で見る・夜も）。新しい常駐 com.handyman.ops-beat（5分ごと）が、自動処理が2回続けて失敗で終わった時・オムニの常駐のログに例外が30分で3回出た時に ops_watch_events に1行書き、DB が①②③で出す。立ち上げ直しは launchd と omni_selfheal に任せる（送信系を二重に動かさない）。見張り自身が20分止まったらそれも出す。
- E 画面（main・BT）：3店の画面の通信（書込・RPC・EF の呼び出し）を見るだけの包みを足し、失敗（400以上・通信の失敗）を report_client_error で1件ずつ記録。送るのは表/EF の名前・状態番号・エラー番号だけ（括弧の中・メール・長い数字は落とす）。DB/EF のエラーは同じ表/EF で15分に3件、通信の失敗は10分に3台以上で知らせる。画面の保存はやり直さない（二重に書かないため）。
- 出口は第2段と同じ watch_say（1時間に1回・同じ事故は1回）。cron ops-watch（4-59/5）。
戻し：error_watch_stage3_rollback.sql（main・BT）＋ ops-beat を bootout。画面は前の版へ戻す（記録を送るだけなので、DB を戻しても画面の動きは変わらない）。
## 第4段（残り）
- EF の中の Slack 送信関数の失敗（第2段 B は DB から出た分だけ）・エルメ取込・GAS の他のプロジェクト（決済・SNS など、心拍が止まったままのもの）は、心拍が今も生きているかを先に確かめてから。
