-- 2026-10-12 Slackボットトークン直書きの関数を Vault 参照へ（オーナー指示）。main・BT 共通の手順（値はファイルに書かない）。
-- ① 非公開スキーマ private に、Vault からボットトークンを返す関数を置く（API＝PostgREST/GraphQL は public だけ公開＝外から呼べない）。
--    読めるのは名前が slack_bot_token で始まる secret だけ。既存の関数（anon/authenticated/cron から呼ばれる）から呼べるよう実行権を付ける。
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
create or replace function private.slack_bot_token(p_name text default 'slack_bot_token')
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name and p_name like 'slack\_bot\_token%' limit 1
$$;
revoke all on function private.slack_bot_token(text) from public;
grant execute on function private.slack_bot_token(text) to anon, authenticated, service_role;
-- ② 各関数の本文の 'Bearer xoxb-…' / 'xoxb-…' を private.slack_bot_token('<名前>') に置き換えて再定義（処理・権限・cron は変えない）。
--    名前：main＝sns_auto→slack_bot_token／buddica_omni_bot→slack_bot_token_buddica、BT＝buddica_omni_bot→slack_bot_token／sns_auto→slack_bot_token_gl
--    置換後に xoxb- が1つでも残れば中止。
do $$
declare r record; d text; nm text; tok text;
begin
  for r in select p.oid, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and pg_get_functiondef(p.oid) like '%xoxb-%' loop
    d := pg_get_functiondef(r.oid);
    for tok in select distinct (regexp_matches(d, 'xoxb-[0-9A-Za-z-]+', 'g'))[1] loop
      select s.name into nm from vault.decrypted_secrets s where s.decrypted_secret = tok and s.name like 'slack\_bot\_token%' limit 1;
      if nm is null then raise exception 'abort: % のトークンが Vault に無い', r.proname; end if;
      d := replace(d, '''Bearer ' || tok || '''', '''Bearer '' || private.slack_bot_token(''' || nm || ''')');
      d := replace(d, '''' || tok || '''', 'private.slack_bot_token(''' || nm || ''')');
    end loop;
    if d like '%xoxb-%' then raise exception 'abort: % に直書きが残る', r.proname; end if;
    execute d;
  end loop;
end $$;
