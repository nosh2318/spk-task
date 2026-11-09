-- 2026-11-09 nosh「楽天でLINEもメールもない人には、通知もその他の連絡も楽天経由で出す」
-- 札幌・那覇のスタッフのボタン（出発・到着・遅れ・回収・場所と鍵 など）と依頼の結果は、LINEがない人には
-- hdm_enqueue_guest_mail でメールになる。楽天はメールがないので、その時は rax_outbox（楽天の画面から送る）に積む。
-- ★関数を丸ごと書き換えない：本番の「今の定義」を読んで、楽天の分だけ差し込む（新マイページ側の「乗り場着」追加など、
--   別の変更が先に入っていても消さない。すでに入っていれば何もしない）。差し込み先が見つからなければ止まる（何も変えない）。
do $do$
declare d text; d0 text;
begin
  d := pg_get_functiondef('public.hdm_enqueue_guest_mail'::regproc);
  if position('rax_outbox' in d) > 0 then raise notice 'rax: already applied'; return; end if;
  d0 := d;
  d := replace(d, 'declare em text;', 'declare v_ota text; em text;');
  d := replace(d, 'select mail, mypage_token::text into em, tok from reservations where id = p_resv;',
                  'select mail, mypage_token::text, ota into em, tok, v_ota from reservations where id = p_resv;');
  d := replace(d, 'select mail, mypage_token::text into em, tok from nha_reservations where id = p_resv;',
                  'select mail, mypage_token::text, ota into em, tok, v_ota from nha_reservations where id = p_resv;');
  d := replace(d, $q$if em is null or em not like '%@%' then return 'no_email'; end if;$q$,
$q$if em is null or em not like '%@%' then
      -- 2026-11-09 楽天はメールがこちらに来ない → 楽天の画面から送る（Mac mini が rax_outbox を送る）
      if coalesce(v_ota, '') = 'R' then
        insert into rax_outbox(store, resv_no, kind, subject, body) values (p_store, p_resv, p_action, subj, body);
        return 'rakuten';
      end if;
      return 'no_email';
    end if;$q$);
  if position('v_ota text' in d) = 0 or position('ota into em, tok, v_ota from reservations' in d) = 0
     or position('ota into em, tok, v_ota from nha_reservations' in d) = 0 or position('rax_outbox' in d) = 0 then
    raise exception 'rax: 差し込み先が見つからない（本番の定義が想定と違う）。何も変えていません';
  end if;
  execute d;
end $do$;
