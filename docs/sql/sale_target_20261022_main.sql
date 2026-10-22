-- 走行距離リストに「売却目安」（手入力・自由記入）を追加。main のみ（3店分をここに保存。key=店:車両コード）
begin;
-- 1) 保存先（本部メンバーのみ読み書き・削除なし＝空欄で上書き）
create table if not exists public.hq_vehicle_sale_targets(
  key text primary key,
  store text not null check (store in ('nha','spk','bt')),
  vehicle_code text not null,
  target text not null default '' check (length(target)<=200),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  check (key = store||':'||vehicle_code)
);
alter table public.hq_vehicle_sale_targets enable row level security;
revoke all on public.hq_vehicle_sale_targets from public, anon, authenticated;
grant select, insert, update on public.hq_vehicle_sale_targets to authenticated;
create policy hq_sel on public.hq_vehicle_sale_targets for select to authenticated using ((select private.hq_is_me()));
create policy hq_ins on public.hq_vehicle_sale_targets for insert to authenticated with check ((select private.hq_is_me()));
create policy hq_upd on public.hq_vehicle_sale_targets for update to authenticated using ((select private.hq_is_me())) with check ((select private.hq_is_me()));
create policy kyoritsu_deny on public.hq_vehicle_sale_targets as restrictive for all to authenticated using ((not (select private.kyoritsu_is_me()))) with check ((not (select private.kyoritsu_is_me())));
create trigger trg_hq_touch before update on public.hq_vehicle_sale_targets for each row execute function hq_touch();
create trigger trg_audit_all after insert or delete or update on public.hq_vehicle_sale_targets for each row execute function _audit_row();
-- 1b) 画面で「本部メンバーか」を判定するための公開版（中身は private.hq_is_me() を返すだけ）
create or replace function public.hq_is_me() returns boolean language sql stable security definer set search_path to '' as $$ select private.hq_is_me() $$;
revoke all on function public.hq_is_me() from public, anon;
grant execute on function public.hq_is_me() to authenticated, service_role;
-- 2) company_mileage に車両コード(code)を足す（他は同じ）
create or replace function public.company_mileage(p_store text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare res jsonb;
begin
  if p_store='spk' then
    with r as (
      select car_id code, trunc(value)::bigint km, date d, created_at c
      from car_data where store_id='sapporo' and type in ('mileage','oil_change') and value>0
    ), l as (select distinct on (code) code,km,d from r where km>0 order by code,d desc,c desc)
    select jsonb_agg(jsonb_build_object('code',v.code,'cls',v.type,'name',v.name,'plate',v.plate_no,'km',l.km,'date',l.d) order by v.type,v.name,v.plate_no)
      into res from vehicles v left join l on l.code=v.code where v.active=true;
  elsif p_store='nha' then
    with r as (
      select vehicle_code code, odometer_km::bigint km, coalesce(completed_date,(created_at at time zone 'Asia/Tokyo')::date) d, created_at c
      from nha_vehicle_maintenance where type in ('走行距離','オイル交換')
    ), l as (select distinct on (code) code,km,d from r where km>0 order by code,d desc,c desc)
    select jsonb_agg(jsonb_build_object('code',v.code,'cls',v.type,'name',v.name,'plate',v.plate_no,'km',l.km,'date',l.d) order by v.type,v.name,v.plate_no)
      into res from nha_vehicles v left join l on l.code=v.code where v.active=true;
  end if;
  return coalesce(res,'[]'::jsonb);
end $$;
commit;
-- 戻し方: docs/sql/sale_target_20261022_rollback.sql（drop table public.hq_vehicle_sale_targets; ＋ company_mileage を docs/sql/mileage_20261022_main.sql で再作成
