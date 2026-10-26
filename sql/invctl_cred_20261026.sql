-- 月末のOTAパス更新（オーナー 2026-10-26 カード B）
-- スタッフが業務アプリで入れたパスを、ロボの Mac の公開鍵で暗号化して一時保管 → ロボの Mac が受け取って復号・キーチェーン更新 → 暗号文を消す。
-- DB にも Claude にもログにも平文は出ない。戻し方は末尾。

create table if not exists invctl.cred_pubkey (
  host text primary key,
  pem text not null,
  set_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists invctl.cred_drop (
  id bigserial primary key,
  store text not null,
  ota text not null,
  host text not null,
  cipher text,                       -- base64 RSA-OAEP(SHA-256)。受け取ったら null にする
  by_uid uuid,
  by_name text,
  created_at timestamptz not null default now(),
  taken_at timestamptz,
  result text,                        -- ok / ng / 理由
  result_at timestamptz
);
create index if not exists cred_drop_host_open on invctl.cred_drop(host) where taken_at is null;

alter table invctl.cred_pubkey enable row level security;
alter table invctl.cred_drop enable row level security;
revoke all on invctl.cred_pubkey, invctl.cred_drop from anon, authenticated, public;

-- ロボの Mac が自分の公開鍵を登録（ロボの鍵で認証）
create or replace function public.invctl_cred_set_pubkey(p_token text, p_host text, p_pem text)
returns text language plpgsql security definer set search_path to 'invctl','public' as $$
begin
  if not invctl.tok_ok(p_token) then raise exception 'invalid token'; end if;
  if p_pem !~ '^-----BEGIN PUBLIC KEY-----' or length(p_pem) > 2000 then raise exception 'bad key'; end if;
  insert into invctl.cred_pubkey(host, pem) values (left(p_host,60), p_pem)
    on conflict (host) do update set pem = excluded.pem, set_at = now(), revoked_at = null;
  return 'ok';
end $$;

-- 業務アプリ：暗号化に使う公開鍵（ログイン中の社内スタッフだけ）
create or replace function public.invctl_cred_pubkeys()
returns table(host text, pem text) language plpgsql stable security definer set search_path to 'invctl','public' as $$
begin
  if auth.uid() is null or private.kyoritsu_is_me() then raise exception 'not allowed'; end if;
  return query select k.host, k.pem from invctl.cred_pubkey k where k.revoked_at is null order by k.host;
end $$;

-- 業務アプリ：暗号文を置く（Mac ごとに1行）。p_ciphers = [{"host":..,"cipher":..}]
create or replace function public.invctl_cred_submit(p_store text, p_ota text, p_ciphers jsonb, p_name text)
returns bigint language plpgsql security definer set search_path to 'invctl','public' as $$
declare e jsonb; first_id bigint; nid bigint;
begin
  if auth.uid() is null or private.kyoritsu_is_me() then raise exception 'not allowed'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception '名前を入れてください'; end if;
  if not (p_store || '|' || p_ota = any (array['nha|RKT','nha|JLN','nha|SKT','nha|ART','nha|RDC','spk|RKT','spk|JLN','spk|SKT','spk|ART','spk|RDC','takh|RKT','takh|JLN','takb|ART','takb|TAB','takb|RDC'])) then raise exception '店とOTAが違います'; end if;
  if (select count(*) from invctl.cred_drop where by_uid = auth.uid() and created_at > now() - interval '1 hour') >= 20 then raise exception '回数が多すぎます'; end if;
  for e in select * from jsonb_array_elements(p_ciphers) loop
    if not exists (select 1 from invctl.cred_pubkey k where k.host = e->>'host' and k.revoked_at is null) then continue; end if;
    if length(e->>'cipher') > 2000 then raise exception 'bad cipher'; end if;
    -- 同じ店×OTA×Mac の未受け取りは古い方を消す
    update invctl.cred_drop set cipher = null, taken_at = now(), result = 'replaced', result_at = now()
      where store = p_store and ota = p_ota and host = e->>'host' and taken_at is null;
    insert into invctl.cred_drop(store, ota, host, cipher, by_uid, by_name)
      values (p_store, p_ota, e->>'host', e->>'cipher', auth.uid(), left(p_name,40)) returning id into nid;
    first_id := coalesce(first_id, nid);
  end loop;
  if first_id is null then raise exception 'ロボの鍵がありません'; end if;
  return first_id;
end $$;

-- 業務アプリ：結果を見る
create or replace function public.invctl_cred_status(p_store text default null)
returns table(id bigint, store text, ota text, host text, by_name text, created_at timestamptz, taken_at timestamptz, result text, result_at timestamptz)
language plpgsql stable security definer set search_path to 'invctl','public' as $$
begin
  if auth.uid() is null or private.kyoritsu_is_me() then raise exception 'not allowed'; end if;
  return query select d.id, d.store, d.ota, d.host, d.by_name, d.created_at, d.taken_at, d.result, d.result_at
    from invctl.cred_drop d where (p_store is null or d.store = p_store) and d.created_at > now() - interval '40 days'
    order by d.id desc limit 50;
end $$;

-- ロボの Mac：自分宛ての暗号文を受け取る（受け取ったら DB から消す）
create or replace function public.invctl_cred_take(p_token text, p_host text)
returns table(id bigint, store text, ota text, cipher text) language plpgsql security definer set search_path to 'invctl','public' as $$
begin
  if not invctl.tok_ok(p_token) then raise exception 'invalid token'; end if;
  return query with t as (
      select d.id, d.cipher as c from invctl.cred_drop d
       where d.host = p_host and d.taken_at is null and d.cipher is not null
         and d.created_at > now() - interval '3 days' for update),
    u as (update invctl.cred_drop d set taken_at = now(), cipher = null from t where d.id = t.id
          returning d.id, d.store, d.ota)
    select u.id, u.store, u.ota, t.c from u join t on t.id = u.id;
end $$;

-- ロボの Mac：結果を返す
create or replace function public.invctl_cred_result(p_token text, p_id bigint, p_result text)
returns text language plpgsql security definer set search_path to 'invctl','public' as $$
begin
  if not invctl.tok_ok(p_token) then raise exception 'invalid token'; end if;
  update invctl.cred_drop set result = left(p_result,200), result_at = now() where id = p_id;
  return 'ok';
end $$;

revoke all on function public.invctl_cred_set_pubkey(text,text,text), public.invctl_cred_take(text,text),
  public.invctl_cred_result(text,bigint,text) from public;
grant execute on function public.invctl_cred_set_pubkey(text,text,text), public.invctl_cred_take(text,text),
  public.invctl_cred_result(text,bigint,text) to anon, authenticated;
revoke all on function public.invctl_cred_pubkeys(), public.invctl_cred_submit(text,text,jsonb,text),
  public.invctl_cred_status(text) from public, anon;
grant execute on function public.invctl_cred_pubkeys(), public.invctl_cred_submit(text,text,jsonb,text),
  public.invctl_cred_status(text) to authenticated;

-- 戻し方：
-- drop function public.invctl_cred_set_pubkey(text,text,text), public.invctl_cred_pubkeys(),
--   public.invctl_cred_submit(text,text,jsonb,text), public.invctl_cred_status(text),
--   public.invctl_cred_take(text,text), public.invctl_cred_result(text,bigint,text);
-- drop table invctl.cred_drop, invctl.cred_pubkey;
