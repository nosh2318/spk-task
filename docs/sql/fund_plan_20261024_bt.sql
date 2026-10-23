-- 資金計画：高松の整備ブロック（配車表 bt_maintenance）を読むだけの関数。BT。書込なし・個人情報なし（メモ・作業内容欄は返さない＝高松APPは両列に同じ入力を書くため）。
-- 既存 bt_company_vehicles と同じく anon 実行可（hq は main ログインのため BT の認証を持たない）。
create or replace function public.bt_company_maint_plan()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'code',m.vehicle_code,'name',v.name,'plate',v.plate_no,
    'start',m.start_date,'end',m.end_date,'label',m.label,
    'cost',m.cost,'actual',m.actual_cost,'workshop',m.workshop,'status',m.status
  ) order by m.start_date),'[]'::jsonb)
  from bt_maintenance m left join bt_vehicles v on v.code=m.vehicle_code
  where m.start_date >= to_char(current_date - 400,'YYYY-MM-DD')
$$;
revoke all on function public.bt_company_maint_plan() from public;
grant execute on function public.bt_company_maint_plan() to anon, authenticated;
