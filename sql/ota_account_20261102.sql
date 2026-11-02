-- OTA設定：ID・パスを暗号化して保存し、暗証確認後に画面へ返す
-- 暗号鍵と暗証ハッシュは vault に置く（このファイルに値を書かない）
create table if not exists private.ota_account (
  id bigint generated always as identity primary key,
  grp text not null, label text not null, url text not null default '',
  login_id_enc bytea, password_enc bytea,
  sort int not null default 0, deleted boolean not null default false,
  updated_at timestamptz, updated_by text
);
create table if not exists private.ota_pin_state (
  uid uuid primary key, fails int not null default 0, locked_until timestamptz
);
create table if not exists private.ota_access_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(), uid uuid, action text not null, account_id bigint
);
alter table private.ota_account enable row level security;
alter table private.ota_pin_state enable row level security;
alter table private.ota_access_log enable row level security;
revoke all on private.ota_account, private.ota_pin_state, private.ota_access_log from public, anon, authenticated;

-- 暗証確認。失敗回数を残すため例外は投げず文字列を返す
create or replace function private.ota_pin_check(p_pin text) returns text
language plpgsql security definer set search_path to '' as $$
declare u uuid := auth.uid(); h text; st private.ota_pin_state;
begin
  if u is null or private.kyoritsu_is_me() then return 'not_allowed'; end if;
  insert into private.ota_pin_state(uid) values (u) on conflict (uid) do nothing;
  select * into st from private.ota_pin_state where uid = u for update;
  if st.locked_until is not null and st.locked_until > now() then
    insert into private.ota_access_log(uid, action) values (u, 'locked');
    return 'locked';
  end if;
  select decrypted_secret into h from vault.decrypted_secrets where name = 'ota_pin_hash';
  if h is null then return 'not_ready'; end if;
  if extensions.crypt(coalesce(p_pin,''), h) = h then
    update private.ota_pin_state set fails = 0, locked_until = null where uid = u;
    return 'ok';
  end if;
  update private.ota_pin_state
     set fails = case when fails + 1 >= 5 then 0 else fails + 1 end,
         locked_until = case when fails + 1 >= 5 then now() + interval '15 minutes' else null end
   where uid = u;
  insert into private.ota_access_log(uid, action) values (u, 'bad_pin');
  return 'bad_pin';
end $$;

create or replace function public.ota_cfg_list(p_pin text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c text := private.ota_pin_check(p_pin); k text; r jsonb;
begin
  if c <> 'ok' then return jsonb_build_object('ok', false, 'error', c); end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'ota_account_key';
  if k is null then return jsonb_build_object('ok', false, 'error', 'not_ready'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'grp', a.grp, 'label', a.label, 'url', a.url,
      'login_id', case when a.login_id_enc is null then '' else extensions.pgp_sym_decrypt(a.login_id_enc, k) end,
      'password', case when a.password_enc is null then '' else extensions.pgp_sym_decrypt(a.password_enc, k) end,
      'updated_at', a.updated_at, 'updated_by', a.updated_by) order by a.sort, a.id), '[]'::jsonb)
    into r from private.ota_account a where not a.deleted;
  insert into private.ota_access_log(uid, action) values (auth.uid(), 'view');
  return jsonb_build_object('ok', true, 'rows', r);
end $$;

-- 1回の保存で1行だけ書く。p_id が null なら行を追加
create or replace function public.ota_cfg_save(p_pin text, p_id bigint, p_grp text, p_label text, p_url text,
  p_login_id text, p_password text, p_name text, p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c text := private.ota_pin_check(p_pin); k text; nid bigint; ts timestamptz := now();
begin
  if c <> 'ok' then return jsonb_build_object('ok', false, 'error', c); end if;
  if coalesce(trim(p_name),'') = '' then return jsonb_build_object('ok', false, 'error', 'no_name'); end if;
  if coalesce(trim(p_label),'') = '' or length(p_label) > 80 or length(coalesce(p_url,'')) > 300
     or length(coalesce(p_login_id,'')) > 200 or length(coalesce(p_password,'')) > 200
     or coalesce(p_url,'') !~ '^(https://.*)?$' then
    return jsonb_build_object('ok', false, 'error', 'bad_value');
  end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'ota_account_key';
  if k is null then return jsonb_build_object('ok', false, 'error', 'not_ready'); end if;
  if p_id is null then
    insert into private.ota_account(grp, label, url, login_id_enc, password_enc, sort, updated_at, updated_by)
    values (coalesce(nullif(trim(p_grp),''),'HANDYMAN'), trim(p_label), coalesce(p_url,''),
      extensions.pgp_sym_encrypt(coalesce(p_login_id,''), k), extensions.pgp_sym_encrypt(coalesce(p_password,''), k),
      1000, ts, trim(p_name)) returning id into nid;
  else
    update private.ota_account set label = trim(p_label), url = coalesce(p_url,''),
      login_id_enc = extensions.pgp_sym_encrypt(coalesce(p_login_id,''), k),
      password_enc = extensions.pgp_sym_encrypt(coalesce(p_password,''), k),
      updated_at = ts, updated_by = trim(p_name)
    where id = p_id and not deleted and updated_at is not distinct from p_expected returning id into nid;
    if nid is null then return jsonb_build_object('ok', false, 'error', 'stale'); end if;
  end if;
  insert into private.ota_access_log(uid, action, account_id) values (auth.uid(), 'save', nid);
  return jsonb_build_object('ok', true, 'id', nid, 'updated_at', ts);
end $$;

revoke all on function private.ota_pin_check(text) from public, anon, authenticated;
revoke all on function public.ota_cfg_list(text) from public, anon;
revoke all on function public.ota_cfg_save(text,bigint,text,text,text,text,text,text,timestamptz) from public, anon;
grant execute on function public.ota_cfg_list(text) to authenticated;
grant execute on function public.ota_cfg_save(text,bigint,text,text,text,text,text,text,timestamptz) to authenticated;
