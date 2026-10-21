-- 本部ダッシュボード「本日の新規予約」の増減金額（main＝札幌・那覇）。新規関数のみ・既存は変更しない。
-- 増＝今日(JST)作成の予約（件数は company_new_bookings と同じ条件）／減＝今日キャンセルになった予約（audit_log の status 変更・今日作成分は除く）
-- 金額＝店舗KPI(*_mtg_h2)と同じ式：base+option−discount（無ければ price）
create or replace function public.company_new_bookings_amt()
returns jsonb language sql stable security definer set search_path to 'public' as $$
with d as (select (now() at time zone 'Asia/Tokyo')::date dd),
rs as (
  select 'spk' s, r.id, r.status, r.name, r.created_at,
    case when coalesce(r.base_price,0)>0 or coalesce(r.option_price,0)>0 then coalesce(r.base_price,0)+coalesce(r.option_price,0)-coalesce(r.discount,0) else coalesce(r.price,0) end rev
  from reservations r
  union all
  select 'nha', r.id, r.status, r.name, r.created_at,
    case when coalesce(r.base_price,0)>0 or coalesce(r.option_price,0)>0 then coalesce(r.base_price,0)+coalesce(r.option_price,0)-coalesce(r.discount,0) else coalesce(r.price,0) end
  from nha_reservations r
),
ok as (select * from rs where coalesce(id,'') !~ '^(ZZ|DEMO|KD-DEMO|TEST)' and coalesce(name,'') !~ 'テスト|デモ|test'),
nw as (select s, count(*) n, coalesce(sum(rev),0) amt from ok, d
       where (created_at at time zone 'Asia/Tokyo')::date=d.dd and coalesce(status,'') !~* 'cancel|キャンセル' group by s),
cx as (select ok.s, count(distinct ok.id) n, coalesce(sum(ok.rev),0) amt from ok, d
       where (ok.created_at at time zone 'Asia/Tokyo')::date<>d.dd and coalesce(ok.status,'') ~* 'cancel|キャンセル'
         and exists (select 1 from audit_log a where a.tbl=case ok.s when 'spk' then 'reservations' else 'nha_reservations' end
                     and a.row_id=ok.id and a.op='UPDATE' and (a.diff->'status'->>'new') ~* 'cancel|キャンセル'
                     and (a.changed_at at time zone 'Asia/Tokyo')::date=d.dd)
       group by ok.s)
select jsonb_build_object(
  'spk', jsonb_build_object('n',coalesce((select n from nw where s='spk'),0),'amt',coalesce((select amt from nw where s='spk'),0),'cn',coalesce((select n from cx where s='spk'),0),'camt',coalesce((select amt from cx where s='spk'),0)),
  'nha', jsonb_build_object('n',coalesce((select n from nw where s='nha'),0),'amt',coalesce((select amt from nw where s='nha'),0),'cn',coalesce((select n from cx where s='nha'),0),'camt',coalesce((select amt from cx where s='nha'),0)));
$$;
-- 既存の company_new_bookings と同じく、本部ダッシュボード（ログイン無しでも開くサマリ）から読む
revoke all on function public.company_new_bookings_amt() from public;
grant execute on function public.company_new_bookings_amt() to anon, authenticated;
