-- 走行距離リスト（読取専用・anon実行可）BT: bt_vehicles.current_mileage（返却時に APP が書く値）＋その変更日時(audit_log)
--   と bt_vehicle_maintenance「走行距離」の手入力のうち、日付が一番新しいもの。
--   ※bt_reservations の start/end_odo は配車の付け替えで別の車に紐づくことがあるため使わない。
create or replace function public.bt_company_mileage()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare res jsonb;
begin
  with r as (
    select vehicle_code code, odometer_km::bigint km, coalesce(completed_date,(created_at at time zone 'Asia/Tokyo')::date) d, created_at c
      from bt_vehicle_maintenance where type='走行距離'
    union all
    select a.row_id, (a.diff->'current_mileage'->>'new')::bigint, (a.changed_at at time zone 'Asia/Tokyo')::date, a.changed_at
      from audit_log a where a.tbl='bt_vehicles' and a.diff ? 'current_mileage' and (a.diff->'current_mileage'->>'new') ~ '^[0-9]+$'
  ), l as (select distinct on (code) code,km,d from r where km>0 order by code,d desc,c desc)
  select jsonb_agg(jsonb_build_object('brand',v.brand,'cls',v.type,'name',v.name,'plate',v.plate_no,
           'km',coalesce(l.km,nullif(v.current_mileage,0)),'date',l.d) order by v.brand,v.type,v.name,v.plate_no)
    into res from bt_vehicles v left join l on l.code=v.code where v.active=true;
  return coalesce(res,'[]'::jsonb);
end $$;
revoke all on function public.bt_company_mileage() from public;
grant execute on function public.bt_company_mileage() to anon, authenticated, service_role;
-- 戻し方: drop function public.bt_company_mileage();
