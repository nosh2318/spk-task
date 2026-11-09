-- 2026-11-09 nosh「LINEのない人にメールで送って」
-- LINEのないお客様へのメール送信（mail_fallback_enabled）は那覇・札幌ともONだが、
-- 送迎の「乗り場に着きました」（pu_at_stop）が送る対象に入っておらず、メールが出ていなかった。対象に1行足すだけ。ほかは同じ。
CREATE OR REPLACE FUNCTION public.hdm_enqueue_guest_mail(p_store text, p_resv text, p_action text, p_body text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare em text; tok text; enabled boolean; test_to text; subj text; url text; shop text; body text;
begin
  if p_store = 'spk' then
    select mail, mypage_token::text into em, tok from reservations where id = p_resv;
    select mail_fallback_enabled, mail_test_to into enabled, test_to from spk_line_config limit 1;
    url := case when tok is null then '' else 'https://nosh2318.github.io/spk-task/my.html?t=' || tok || '&via=mail' end;
    shop := 'HANDYMAN RENTCAR 札幌';
  elsif p_store = 'nha' then
    select mail, mypage_token::text into em, tok from nha_reservations where id = p_resv;
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
    when 'dropoff' then '乗り捨てのお願い'
    when 'time_adjust' then 'お届け時間のご相談'
    -- 2026-11-09 送迎の「乗り場に着きました」もLINEがない人に届ける
    when 'pu_at_stop' then '送迎スタッフが乗り場に到着しました'
    -- 2026-11-08 LINEがない人にも届ける（全店点検⑦）
    when 'license_auto_d1' then '運転免許証のご登録のお願い'
    when 'license_auto_d2' then '運転免許証のご登録のお願い'
    when 'license_auto_d3' then '運転免許証のご登録のお願い'
    when 'mypage_decision' then 'ご依頼の結果のお知らせ'
    when 'mypage_reconcile' then 'ご予約内容を更新しました'
    else null end;
  if subj is null then return 'bad_action'; end if;
  subj := '【HANDYMAN】' || subj;
  -- 2026-11-08 電話番号は載せない（お客様に電話を求めない方針）
  body := p_body || E'\n\n――――――――\n' ||
          case when url <> '' then E'最新の状況はマイページでご確認いただけます。\n' || url || E'\n\n' else '' end ||
          shop || E'\n※このメールは送信専用です。ご質問はマイページの「聞く」からどうぞ。';
  if coalesce(enabled, false) then
    if em is null or em not like '%@%' then return 'no_email'; end if;
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
