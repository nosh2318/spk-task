-- 走行距離リスト（読取専用・anon実行可）main: 札幌=car_data / 那覇=nha_vehicle_maintenance
-- 1台1行：クラス・車両名・ナンバー・最新の走行距離・その日付（記録の中で日付が一番新しいもの）
create or replace function public.company_mileage(p_store text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare res jsonb;
begin
  if p_store='spk' then
    with r as (
      select car_id code, trunc(value)::bigint km, date d, created_at c
      from car_data where store_id='sapporo' and type in ('mileage','oil_change') and value>0
    ), l as (select distinct on (code) code,km,d from r where km>0 order by code,d desc,c desc)
    select jsonb_agg(jsonb_build_object('cls',v.type,'name',v.name,'plate',v.plate_no,'km',l.km,'date',l.d) order by v.type,v.name,v.plate_no)
      into res from vehicles v left join l on l.code=v.code where v.active=true;
  elsif p_store='nha' then
    with r as (
      select vehicle_code code, odometer_km::bigint km, coalesce(completed_date,(created_at at time zone 'Asia/Tokyo')::date) d, created_at c
      from nha_vehicle_maintenance where type in ('走行距離','オイル交換')
    ), l as (select distinct on (code) code,km,d from r where km>0 order by code,d desc,c desc)
    select jsonb_agg(jsonb_build_object('cls',v.type,'name',v.name,'plate',v.plate_no,'km',l.km,'date',l.d) order by v.type,v.name,v.plate_no)
      into res from nha_vehicles v left join l on l.code=v.code where v.active=true;
  end if;
  return coalesce(res,'[]'::jsonb);
end $$;
revoke all on function public.company_mileage(text) from public;
grant execute on function public.company_mileage(text) to anon, authenticated, service_role;
-- 戻し方: drop function public.company_mileage(text);
