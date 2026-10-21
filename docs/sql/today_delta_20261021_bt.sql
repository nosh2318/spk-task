-- 本部ダッシュボード「本日の新規予約」の増減金額（BT＝高松）。新規関数のみ・既存は変更しない。条件・式は main 版と同じ。
create or replace function public.bt_company_new_bookings_amt()
returns jsonb language sql stable security definer set search_path to 'public' as $$
with d as (select (now() at time zone 'Asia/Tokyo')::date dd),
ok as (
  select r.id, r.status, r.created_at,
    case when coalesce(r.base_price,0)>0 or coalesce(r.option_price,0)>0 then coalesce(r.base_price,0)+coalesce(r.option_price,0)-coalesce(r.discount,0) else coalesce(r.price,0) end rev
  from bt_reservations r
  where coalesce(r.id,'') !~ '^(ZZ|DEMO|KD-DEMO|TEST)' and coalesce(r.name,'') !~ 'テスト|デモ|test'),
nw as (select count(*) n, coalesce(sum(rev),0) amt from ok, d where (created_at at time zone 'Asia/Tokyo')::date=d.dd and coalesce(status,'') !~* 'cancel|キャンセル'),
cx as (select count(distinct ok.id) n, coalesce(sum(ok.rev),0) amt from ok, d
       where (ok.created_at at time zone 'Asia/Tokyo')::date<>d.dd and coalesce(ok.status,'') ~* 'cancel|キャンセル'
         and exists (select 1 from audit_log a where a.tbl='bt_reservations' and a.row_id=ok.id and a.op='UPDATE'
                     and (a.diff->'status'->>'new') ~* 'cancel|キャンセル' and (a.changed_at at time zone 'Asia/Tokyo')::date=d.dd))
select jsonb_build_object('bt', jsonb_build_object('n',(select n from nw),'amt',(select amt from nw),'cn',(select n from cx),'camt',(select amt from cx)));
$$;
revoke all on function public.bt_company_new_bookings_amt() from public;
grant execute on function public.bt_company_new_bookings_amt() to anon, authenticated;
