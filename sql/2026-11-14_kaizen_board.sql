-- 改善の箱（マイページ管理の「済み」の代わり）2026-11-14 nosh
-- 毎回その場で数え直す（日々更新）。直近 p_days 日と、その前の p_days 日を比べる。
-- 人：お知らせを見るまで・見ていない／「大丈夫ですか？」に返事なし／今日のタスク確認
-- システム：依頼の承認までの時間／チャット返事／AI案が送られていない／お知らせの既読が残らない／送れなかった通知
-- ユーザー：LINEに残る問い合わせ（話題ごと）／お客様の知らせ（着きました等）の未確認

create or replace function public.line_topic(b text) returns text
language sql immutable as $$
  select case
    when b is null or length(b) < 8 or b ~ '^【' or b ~ '(写真|スタンプ|動画|ファイル)を送信|送信が取り消され' then null
    when b ~* '^\W*(ありがと|よろしく|了解|承知|わかりました|分かりました|謝謝|感謝|收到|好的|OK|ok|thank|はい|かしこまり|こちらこそ|お世話にな)' and length(b) < 40 then null
    when b ~* '(ありがと|よろしく|了解|承知|謝謝|收到)' and length(b) < 25 then null
    when b ~* '中文|繁體|繁体|簡體|简体|chinese|english|英語|한국' and length(b) < 40 then '言葉（中国語・英語で話したい）'
    when b ~* '事故|故障|ぶつけ|擦|こす|パンク|バッテリー|警告|ランプ|変な音|異音|音がする|動かな|エンジン' then '事故・故障・車の不具合'
    when b ~* '忘れ物|忘れて|落とし' then '忘れ物'
    when b ~* '欠航|運休|フライト.*(遅|変)|便.*(遅れ|欠)' then '欠航・飛行機の遅れ'
    when b ~* 'キャンセル|取り消|取消|cancel|取消預約' then 'キャンセル'
    when b ~* '着きました|着いた|到着しました|到着致しました|到着いたしました|今着|抵達|到了|着陸|向かって|あと.{0,4}分|遅れ(ます|そう|る|て)|遅くな|おくれ|渋滞|停まって|います。?$|現在.*おります' then '着いた・遅れる・今どこ'
    when b ~* '免許|運転者|運転する人|駕駛|パスポート|国際|IDP|翻訳|身分' then '免許証・運転する人'
    when b ~* '領収|支払|決済|払い|カード|承認コード|請求|返金|付款|刷卡' then '支払い・領収書'
    when b ~* '送迎|バス|シャトル|接駁|乗り場|迎え|ピックアップ|pick ?up' then '送迎・乗り場'
    when b ~* '返却|返す|返し|ガソリン|満タン|給油|歸還|還車|加油' then '返却・ガソリン'
    when b ~* '変更|早め|早まっ|遅らせ|延長|伸び|延ば|ずらし|change|改' then '時間・場所の変更'
    when b ~* 'お届け|届け|受け渡し|引取|引き取|受け取|取車|赤嶺|ホテル|住所|場所|どこ|map|maps\.app' then '受け渡しの場所・方法'
    when b ~* 'ETC|チャイルド|ジュニア|シート|座席|汽座|スーツケース|荷物|行李|ベビーカー|推車|Bluetooth|カーナビ|ナビ|USB|充電|車種|写真.*(送|見)|photos?' then '車・装備・荷物'
    when b ~* '予約.*(でき|成功|取れ|確認|入って)|予約番号|確認(したい|させ|お願い)|登録.*(でき|され)' then '予約できているか'
    when b ~* '料金|いくら|価格|値段|空き|空いて|見積|費用|多少|價格|價錢|租車|可以租|台灣人|予約したい|検討|プラン|方案|クラス' then '予約前の相談（料金・空き・車種）'
    else 'その他'
  end
$$;

create or replace function public.kaizen_board(p_days int default 14)
returns jsonb
language sql stable security definer
set search_path to 'public'
as $$
with
 w as (select greatest(1, least(coalesce(p_days,14), 60)) d),
 t0 as (select now() - make_interval(days => (select d from w)) a, now() - make_interval(days => 2*(select d from w)) b),
 -- 人：お知らせ（スタッフ画面の通知）を見るまで
 inbox as (
   select store, staff_name nm, kind, count(*) n,
          count(*) filter (where seen_at is null and created_at < now() - interval '30 minutes') unseen,
          round((percentile_cont(0.5) within group (order by extract(epoch from seen_at - created_at)/60))::numeric) med
   from staff_inbox where created_at > (select a from t0) and staff_name is not null and staff_name <> ''
   group by 1,2,3),
 -- 人：「大丈夫ですか？」（押し忘れ・遅れの確認）への返事
 press as (
   select store, staff_name nm, count(*) n,
          count(*) filter (where ok_at is null and note_at is null and ans2_at is null and created_at < now() - interval '30 minutes') noans,
          round((percentile_cont(0.5) within group (order by extract(epoch from coalesce(ok_at, note_at, ans2_at) - coalesce(pushed_at, created_at))/60))::numeric) med
   from staff_press_check where created_at > (select a from t0) and staff_name is not null
   group by 1,2),
 -- 人：今日のタスクの確認（変わったのに確認していない）
 ack as (
   select store, staff_name nm, count(*) n,
          count(*) filter (where pend_at is not null and (acked_at is null or acked_at < pend_at) and pend_at < now() - interval '30 minutes') pend
   from staff_task_ack where work_date > current_date - (select d from w)
   group by 1,2),
 -- システム：お客様の依頼 → 承認・反映まで
 apr as (
   select c.store, c.created_at req, a.created_at dec
   from mypage_changes c
   join mypage_changes a on a.status = 'applied' and (a.payload->>'change_id') = c.id::text
   where c.source = 'customer' and c.store in ('spk','nha','tkm') and c.created_at > (select b from t0)),
 apr2 as (
   select store, (req > (select a from t0)) cur, count(*) n,
          round((percentile_cont(0.5) within group (order by extract(epoch from dec - req)/60))::numeric) med,
          count(*) filter (where dec - req > interval '30 minutes') over30,
          count(*) filter (where extract(hour from req at time zone 'Asia/Tokyo') >= 19 or extract(hour from req at time zone 'Asia/Tokyo') < 9) night,
          round(max(extract(epoch from dec - req)/60)::numeric) mx
   from apr group by 1,2),
 waitnow as (
   select store, count(*) n, round(max(extract(epoch from now() - created_at)/60)::numeric) oldest
   from mypage_changes where source = 'customer' and status = 'requested' and store in ('spk','nha','tkm') group by 1),
 -- システム：チャット（スタッフに聞く）の返事
 cm as (
   select t.store, m.thread_id, m.sender, m.body, m.created_at
   from cs_chat_messages m join cs_chat_threads t on t.id = m.thread_id
   where m.created_at > (select b from t0)),
 cq as (
   select store, created_at,
          (select min(s.created_at) from cm s where s.thread_id = cm.thread_id and s.sender = 'staff' and s.created_at > cm.created_at
             and coalesce(s.body,'') !~ 'AI・HANDYMANが対応') ans
   from cm where sender = 'customer' and coalesce(body,'') !~ '^【'),
 chat as (
   select store, (created_at > (select a from t0)) cur, count(*) q,
          count(*) filter (where ans is null and created_at < now() - interval '30 minutes') noans,
          round((percentile_cont(0.5) within group (order by extract(epoch from ans - created_at)/60))::numeric) med,
          count(*) filter (where ans - created_at > interval '60 minutes') over60
   from cq group by 1,2),
 drafts as (
   select store, count(*) filter (where status = 'pending' and created_at < now() - interval '30 minutes') pending,
          count(*) filter (where status = 'approved') sent, count(*) n
   from cs_chat_drafts where created_at > (select a from t0) group by 1),
 -- ユーザー：お客様の知らせ（着きました・遅れます・見つからない・停めました）
 nud as (
   select store, kind, count(*) n,
          count(*) filter (where acked_at is null and created_at < now() - interval '5 minutes') unacked,
          round((percentile_cont(0.5) within group (order by extract(epoch from acked_at - created_at)/60))::numeric) med
   from mypage_nudges where created_at > (select a from t0) group by 1,2),
 -- システム：送れなかった通知
 notif as (
   select store, count(*) n, count(*) filter (where not coalesce(sent,false) or error is not null) fail
   from hdm_notifications where created_at > (select a from t0) and not coalesce(is_test,false) group by 1),
 -- ユーザー：LINE に残る問い合わせ（話題ごと・人数）
 ln as (
   select account acct, friend_id, sent_at, body, line_topic(body) tp
   from erume_chat_log where sender_type = '友だち' and sent_at > (select b from t0)),
 line as (
   select acct, tp,
          count(distinct friend_id) filter (where sent_at > (select a from t0)) ppl,
          count(distinct friend_id) filter (where sent_at <= (select a from t0)) prev,
          (array_agg(left(regexp_replace(regexp_replace(body, '\s+', ' ', 'g'), '[0-9０-９A-Za-z]{4,}', '***', 'g'), 60) order by sent_at desc)
             filter (where sent_at > (select a from t0)))[1:3] ex
   from ln where tp is not null group by 1,2),
 lineall as (
   select acct, count(distinct friend_id) filter (where sent_at > (select a from t0)) ppl,
          count(distinct friend_id) filter (where sent_at <= (select a from t0)) prev,
          max(sent_at) last_at
   from ln where tp is not null group by 1)
select jsonb_build_object(
  'days', (select d from w), 'at', now(),
  'inbox', coalesce((select jsonb_agg(to_jsonb(inbox)) from inbox), '[]'),
  'press', coalesce((select jsonb_agg(to_jsonb(press)) from press), '[]'),
  'ack',   coalesce((select jsonb_agg(to_jsonb(ack)) from ack), '[]'),
  'apr',   coalesce((select jsonb_agg(to_jsonb(apr2)) from apr2), '[]'),
  'waitnow', coalesce((select jsonb_agg(to_jsonb(waitnow)) from waitnow), '[]'),
  'chat',  coalesce((select jsonb_agg(to_jsonb(chat)) from chat), '[]'),
  'drafts', coalesce((select jsonb_agg(to_jsonb(drafts)) from drafts), '[]'),
  'nudge', coalesce((select jsonb_agg(to_jsonb(nud)) from nud), '[]'),
  'notif', coalesce((select jsonb_agg(to_jsonb(notif)) from notif), '[]'),
  'line',  coalesce((select jsonb_agg(to_jsonb(line) order by acct, ppl desc) from line), '[]'),
  'lineall', coalesce((select jsonb_agg(to_jsonb(lineall)) from lineall), '[]')
) $$;

revoke all on function public.kaizen_board(int) from public;
grant execute on function public.kaizen_board(int) to anon, authenticated, service_role;
