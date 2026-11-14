-- 2026-11-14 オムニの「準備が足りない」お願い（社員が本部で「はい」→ omni-desk prep_decide → line-push action=mypage_prep）
-- LINE をつないでいないお客様にメールで届くよう、メールの件名の一覧に mypage_prep を足す（本文に URL があるので下に重ねて付けない）。
-- 戻し方：同じ2か所から mypage_prep を消して作り直す（ほかの動きは変わらない）。
do $$
declare d text := pg_get_functiondef('public.hdm_enqueue_guest_mail'::regproc);
begin
  if position('mypage_prep' in d) = 0 then
    d := replace(d, $q$    when 'mypage_place_urgent' then '本日の場所が未登録です'$q$,
      $q$    when 'mypage_place_urgent' then '本日の場所が未登録です'
    -- 2026-11-14 オムニの「準備が足りない」お願い（社員が承認して送る）
    when 'mypage_prep' then 'ご出発前のご準備のお願い'$q$);
    d := replace(d, $q$('mypage_chat_reply', 'mypage_place_urgent')$q$, $q$('mypage_chat_reply', 'mypage_place_urgent', 'mypage_prep')$q$);
    if position('mypage_prep' in d) = 0 then raise exception 'hdm_enqueue_guest_mail の形が想定と違う'; end if;
    execute d;
  end if;
end $$;
