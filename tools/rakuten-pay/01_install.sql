-- 楽天の決済方法（オンラインカード決済＝決済済／現地決済＝未決済）台帳 2026-11-07
-- 1) 台帳テーブル  2) ロボ用の書き込み口(RPC・鍵必須)  3) スタッフ個別URLの表示RPCに決済を追加
begin;

create table if not exists public.ota_pay_method(
  reservation_id text primary key,
  store   text not null default '',           -- nha / spk / tkm
  ota     text not null default 'R',
  method  text not null check (method in ('card','onsite')),  -- card=オンラインカード決済(楽天が事前に徴収) / onsite=現地決済(店で収受)
  amount  integer,
  mail_at timestamptz,                          -- 元になった楽天メールの受信時刻（新しいメールだけで上書き）
  source  text not null default 'gmail',
  updated_at timestamptz not null default now()
);
alter table public.ota_pay_method enable row level security;
drop policy if exists ota_pay_method_read on public.ota_pay_method;
create policy ota_pay_method_read on public.ota_pay_method for select to anon, authenticated using (true);
grant select on public.ota_pay_method to anon, authenticated;

create or replace function public.ota_pay_upsert(p_token text, p_items jsonb) returns int
language plpgsql security definer set search_path to 'invctl','public' as $$
declare n int := 0; it jsonb;
begin
  if not invctl.tok_ok(p_token) then raise exception 'invalid token'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    if coalesce(it->>'id','') !~ '^RC[0-9]+$' or coalesce(it->>'method','') not in ('card','onsite') then continue; end if;
    insert into public.ota_pay_method(reservation_id,store,ota,method,amount,mail_at,source,updated_at)
    values (it->>'id', coalesce(it->>'store',''), 'R', it->>'method', nullif(it->>'amount','')::int,
            nullif(it->>'mail_at','')::timestamptz, coalesce(nullif(it->>'source',''),'gmail'), now())
    on conflict (reservation_id) do update
      set store=excluded.store, method=excluded.method, amount=excluded.amount, mail_at=excluded.mail_at, source=excluded.source, updated_at=now()
      where public.ota_pay_method.mail_at is null or excluded.mail_at is null or excluded.mail_at >= public.ota_pay_method.mail_at;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.ota_pay_upsert(text,jsonb) from public;
grant execute on function public.ota_pay_upsert(text,jsonb) to anon, authenticated, service_role;

-- 戻し用に今の表示RPCを保存
create table if not exists public._fn_backup_20261107(name text primary key, def text, saved_at timestamptz default now());
insert into public._fn_backup_20261107(name,def)
  select p.proname, pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('spk_staff_view','nha_staff_view')
on conflict (name) do nothing;
revoke all on public._fn_backup_20261107 from anon, authenticated;

-- 札幌 個別URL：楽天の決済方法 rpay を追加（じゃらん jpaid は既存）
do $$
declare d text; d2 text;
begin
  select def into d from public._fn_backup_20261107 where name='spk_staff_view';
  d2 := replace(d, E'AS jpaid\n    FROM tasks t', E'AS jpaid,\n    (SELECT m.method FROM ota_pay_method m WHERE m.reservation_id=t.reservation_id) AS rpay\n    FROM tasks t');
  d2 := replace(d2, '''jpaid'',jpaid,', '''jpaid'',jpaid,''rpay'',rpay,');
  if d2 = d or position('AS rpay' in d2) = 0 or (length(d2)-length(replace(d2,'''rpay'',rpay','')))/length('''rpay'',rpay') <> 3 then
    raise exception 'spk_staff_view の書き換え位置が見つからない';
  end if;
  execute d2;
end $$;

-- 那覇 個別URL：じゃらん jpaid と 楽天 rpay を追加
do $$
declare d text; d2 text;
begin
  select def into d from public._fn_backup_20261107 where name='nha_staff_view';
  d2 := replace(d, 'r.insurance AS insurance, r.people AS people,',
    'r.insurance AS insurance, r.people AS people, EXISTS(SELECT 1 FROM nha_jalan_payments jp WHERE jp.reservation_id=t."予約番号" AND jp.status=''paid'') AS jpaid, (SELECT m.method FROM ota_pay_method m WHERE m.reservation_id=t."予約番号") AS rpay,');
  d2 := replace(d2, '''ota'',ota,''resv'',resv,', '''ota'',ota,''jpaid'',jpaid,''rpay'',rpay,''resv'',resv,');
  if d2 = d or position('AS rpay' in d2) = 0 or (length(d2)-length(replace(d2,'''rpay'',rpay','')))/length('''rpay'',rpay') <> 3 then
    raise exception 'nha_staff_view の書き換え位置が見つからない';
  end if;
  execute d2;
end $$;

commit;
