-- 2026-10-12 spk_hp_cancel_notify のボットトークン直書き → Vault（slack_bot_token）参照へ（オーナー指示）。値はファイルに書かない。
-- 関数本文のうち 'Bearer xoxb-…' の1か所だけを置き換えて再定義する（1か所でなければ中止）。
do $$
declare d text; n int;
begin
  d := pg_get_functiondef('public.spk_hp_cancel_notify'::regproc);
  select count(*) into n from regexp_matches(d, '''Bearer xoxb-[0-9A-Za-z-]+''', 'g');
  if n <> 1 then raise exception 'abort: token literal count=%', n; end if;
  d := regexp_replace(d, '''Bearer xoxb-[0-9A-Za-z-]+''',
        '''Bearer '' || (select decrypted_secret from vault.decrypted_secrets where name = ''slack_bot_token'' limit 1)');
  execute d;
end $$;
