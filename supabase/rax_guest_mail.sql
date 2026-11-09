-- 2026-11-09 nosh「楽天でLINEもメールもない人には、通知もその他の連絡も楽天経由で出す」
-- 札幌・那覇のスタッフのボタン（出発・到着・遅れ・回収・場所と鍵 など）と依頼の結果は、LINEがない人には
-- hdm_enqueue_guest_mail でメールになる。楽天はメールがないので、ここで rax_outbox（楽天の画面から送る）に積む。
-- 変えたのは「メールがない」ときの1か所だけ（ota='R' なら rax_outbox、ほかは今までどおり 'no_email'）。
CREATE OR REPLACE FUNCTION public.hdm_enqueue_guest_mail(p_store text, p_resv text, p_action text, p_body text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare em text; tok text; enabled boolean; test_to text; subj text; url text; shop text; body text; v_ota text;
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
    when 'dropoff' then '乗り捨てのお願い'
    when 'time_adjust' then 'お届け時間のご相談'
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
    if em is null or em not like '%@%' then
      -- 2026-11-09 楽天はメールがこちらに来ない → 楽天の画面から送る（Mac mini rax_line_mail.py が rax_outbox を送る）
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
