-- 2026-11-09 「スタッフに聞く」：スタッフの返信をお客様に知らせる（3店）
-- ① 高松の予約内容をスレッドに写す欄（Slack #omni のAI回答案に使う）
alter table public.cs_chat_threads add column if not exists resv_snapshot jsonb;

-- ② 返信が入ったら cs-chat の notify_reply を呼ぶ（pg_net・非同期なので返信の保存は止めない）
create or replace function public.cs_chat_notify_reply() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.sender = 'staff' and coalesce(new.body,'') <> 'ご連絡ありがとうございます！AI・HANDYMANが対応させていただきますので暫しお待ちください！' then
    perform net.http_post(
      url := 'https://ckrxttbnawkclshczsia.supabase.co/functions/v1/cs-chat',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
                   (select substring(command from 'x-cron-secret'',''([0-9a-f]+)''') from cron.job where jobname='hdm-send-mail' limit 1)),
      body := jsonb_build_object('action','notify_reply','message_id',new.id));
  end if;
  return new;
exception when others then
  return new; -- 知らせに失敗しても返信そのものは必ず保存する
end $$;
drop trigger if exists cs_chat_notify_reply on public.cs_chat_messages;
create trigger cs_chat_notify_reply after insert on public.cs_chat_messages
  for each row execute function public.cs_chat_notify_reply();

-- ③ メールの件名を足す（本番の定義 2026-11-09 06:10 に読み直したものに1行＋URLの重複よけだけ足した）
CREATE OR REPLACE FUNCTION public.hdm_enqueue_guest_mail(p_store text, p_resv text, p_action text, p_body text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_ota text; em text; tok text; enabled boolean; test_to text; subj text; url text; shop text; body text; pb text;
begin
  if p_store = 'spk' then
    select mail, mypage_token::text, ota into em, tok, v_ota from reservations where id = p_resv;
    select mail_fallback_enabled, mail_test_to into enabled, test_to from spk_line_config limit 1;
    url := case when tok is null then '' else 'https://nosh2318.github.io/spk-task/my.html?t=' || tok || '&via=mail' end;
    shop := 'HANDYMAN RENTCAR 札幌';
  elsif p_store = 'nha' then
    select mail, mypage_token::text, ota into em, tok, v_ota from nha_reservations where id = p_resv;
    select mail_fallback_enabled, mail_test_to into enabled, test_to from nha_line_config limit 1;
    url := case when tok is null then '' else 'https://nosh2318.github.io/naha-project/my-nha.html?t=' || tok || '&via=mail' end;
    shop := 'HANDYMAN RENTCAR 那覇空港店';
  else
    return 'bad_store';
  end if;
  if coalesce(trim(p_body), '') = '' then return 'empty'; end if;
  subj := case p_action
    when 'depart_mypage' then 'お届けに出発しました'
    when 'mypage_depart' then 'お届けに出発しました'
    when 'arrival' then 'スタッフが到着しました'
    when 'del_delay' then 'お届けが遅れています'
    when 'advance_park' then 'お車の場所と鍵のご案内'
    when 'advance_park_place' then 'お車の場所と鍵のご案内'
    when 'collect_mypage' then '回収に向かっています'
    when 'mypage_collect' then '回収に向かっています'
    when 'col_delay' then '回収が遅れています'
    when 'col_arrival' then '回収スタッフが到着しました'
    when 'pu_at_stop' then '送迎スタッフが乗り場に到着しました'
    when 'pu_depart' then '送迎車が乗り場へ出発しました'
    when 'pu_jam' then '送迎車が遅れています'
    when 'bd_at_airport' then 'ご利用ありがとうございました'
    when 'dropoff' then '乗り捨てのお願い'
    when 'time_adjust' then 'お届け時間のご相談'
    -- 2026-11-08 LINEがない人にも届ける（全店点検⑦）
    when 'license_auto_d1' then '運転免許証のご登録のお願い'
    when 'license_auto_d2' then '運転免許証のご登録のお願い'
    when 'license_auto_d3' then '運転免許証のご登録のお願い'
    when 'mypage_decision' then 'ご依頼の結果のお知らせ'
    when 'mypage_reconcile' then 'ご予約内容を更新しました'
    -- 2026-11-09 「スタッフに聞く」の返信のお知らせ
    when 'mypage_chat_reply' then 'スタッフからお返事が届きました'
    else null end;
  if subj is null then return 'bad_action'; end if;
  subj := '【HANDYMAN】' || subj;
  -- 2026-11-09 本文にマイページのURLが入っているとき（返信のお知らせ）は下にもう一度付けない
  pb := replace(p_body, '&via=line', '&via=mail');
  -- 2026-11-08 電話番号は載せない（お客様に電話を求めない方針）
  body := pb || E'\n\n――――――――\n' ||
          case when url <> '' and position('github.io' in pb) = 0 then E'最新の状況はマイページでご確認いただけます。\n' || url || E'\n\n' else '' end ||
          shop || E'\n※このメールは送信専用です。ご質問はマイページの「聞く」からどうぞ。';
  if coalesce(enabled, false) then
    if em is null or em not like '%@%' then
      -- 2026-11-09 楽天はメールがこちらに来ない → 楽天の画面から送る（Mac mini が rax_outbox を送る）
      if coalesce(v_ota, '') = 'R' then
        insert into rax_outbox(store, resv_no, kind, subject, body) values (p_store, p_resv, p_action, subj, body);
        return 'rakuten';
      end if;
      return 'no_email';
    end if;
    insert into hdm_notifications(store, resv_no, action, to_email, subject, body, is_test)
      values (p_store, p_resv, p_action, em, subj, body, false);
    return 'ok';
  end if;
  if coalesce(test_to, '') like '%@%' then
    insert into hdm_notifications(store, resv_no, action, to_email, subject, body, is_test)
      values (p_store, p_resv, p_action, test_to, '[TEST] ' || subj, body, true);
    return 'test';
  end if;
  return 'off';
end $function$;

-- ④ 2026-11-09 管理画面：赤い「未対応」は返事待ち（未対応）だけを数える。高松も数える。
--   （返信すると cs-chat が「対応中」にする。お客様が送ると「未対応」に戻る）
CREATE OR REPLACE FUNCTION public.cs_chat_pending() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$ select jsonb_build_object(
  'spk',(select count(*) from cs_chat_threads where store='spk' and status='open' and work_status='未対応'),
  'nha',(select count(*) from cs_chat_threads where store='nha' and status='open' and work_status='未対応'),
  'tkm',(select count(*) from cs_chat_threads where store='tkm' and status='open' and work_status='未対応')) $function$;
