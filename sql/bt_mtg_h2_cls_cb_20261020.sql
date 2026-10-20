-- 2026-10-20 オーナー指示「サマリ HDM BT ブランド別にし最後グロス」：bt_mtg_h2 に cls_cb（車両ブランド|クラス → {c,r}・cls と同じ定義）を追加。既存キーは不変。戻し＝sql/bt_mtg_h2_backup_20261020.sql
CREATE OR REPLACE FUNCTION public.bt_mtg_h2()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with bounds as (select '2026-08' as start_ym, greatest('2026-12', (select coalesce(max(substr(coalesce(nullif(end_date,''),start_date),1,7)),'2026-12') from bt_reservations where coalesce(status,'') not in ('キャンセル','cancelled','canceled') and coalesce(nullif(end_date,''),start_date) >= '2026-08-01' and id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)' and coalesce(name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)')) as end_ym),
mons as (select to_char(gs,'YYYY-MM') ym from bounds, generate_series((start_ym||'-01')::date,(end_ym||'-01')::date,interval '1 month') gs),
mb as (select ym, (ym||'-01')::date ms, ((ym||'-01')::date + interval '1 month' - interval '1 day')::date me,
        extract(day from ((ym||'-01')::date + interval '1 month' - interval '1 day'))::int dim from mons),
r as (
  select res.id, res.assigned_vehicle,
    case when coalesce(res.base_price,0)>0 or coalesce(res.option_price,0)>0
      then coalesce(res.base_price,0)+coalesce(res.option_price,0)-coalesce(res.discount,0)
      else coalesce(res.price,0) end as rev,
    substr(coalesce(res.end_date,''),1,7) as ym,
    res.start_date, res.end_date,
    coalesce(nullif(v.type,''),'未配車') as cls,
    case when v.code is null then '未配車' when coalesce(v.brand,'BUDDICA')='HDM' then 'HDM' else 'BT' end as vbr,
    coalesce(nullif(res.brand,''),'BUDDICA') as br,
    case
      when nullif(res.ota,'') is not null then (case res.ota when 'J' then 'じゃらん' when 'R' then '楽天' when 'S' then 'skyticket' else res.ota end)
      when coalesce(res.source,'') in ('site','') then '自社HP'
      when res.source in ('slack','SP') then 'SP(スタッフ)'
      when res.source='phone' then '電話/直予約'
      else res.source end as chan
  from bt_reservations res
  left join bt_vehicles v on v.code=res.assigned_vehicle
  where substr(coalesce(res.end_date,''),1,7) between '2026-08' and (select end_ym from bounds)
    and coalesce(res.status,'') not in ('キャンセル','cancelled','canceled')
    and res.id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)'
    and coalesce(res.name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)'
    and coalesce(res.name,'') <> ''
),
ex as (
  select to_char(a.date,'YYYY-MM') ym, sum(coalesce(a.amount,0))::bigint amt
  from bt_accounting a
  where a.type='extra_sales' and to_char(a.date,'YYYY-MM') between '2026-08' and (select end_ym from bounds)
  group by 1
),
f as (
  select res.id,
    case when coalesce(res.base_price,0)>0 or coalesce(res.option_price,0)>0
      then coalesce(res.base_price,0)+coalesce(res.option_price,0)-coalesce(res.discount,0)
      else coalesce(res.price,0) end as rev,
    to_char((res.created_at at time zone 'Asia/Tokyo'),'YYYY-MM') as fym,
    coalesce(nullif(res.brand,''),'BUDDICA') as br,
    case
      when nullif(res.ota,'') is not null then (case res.ota when 'J' then 'じゃらん' when 'R' then '楽天' when 'S' then 'skyticket' else res.ota end)
      when coalesce(res.source,'') in ('site','') then '自社HP'
      when res.source in ('slack','SP') then 'SP(スタッフ)'
      when res.source='phone' then '電話/直予約'
      else res.source end as chan
  from bt_reservations res
  where to_char((res.created_at at time zone 'Asia/Tokyo'),'YYYY-MM') between '2026-08' and (select end_ym from bounds)
    and coalesce(res.status,'') not in ('キャンセル','cancelled','canceled')
    and res.id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)'
    and coalesce(res.name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)'
    and coalesce(res.name,'') <> ''
),
act as (
  select m.ym,
    count(*) filter (where vv.actv) as nveh,
    count(*) filter (where vv.actv and vv.br in ('BUDDICA','BT','')) as nbt,
    count(*) filter (where vv.actv and vv.br='HDM') as nhd
  from mons m
  cross join lateral (
    select coalesce(v.brand,'BUDDICA') br,
      coalesce((select k.active from bt_vehicle_monthly_kpi k where k.vehicle_code=v.code and k.year_month=m.ym), v.active) as actv
    from bt_vehicles v where coalesce(v.type,'') <> '送迎'
  ) vv
  group by m.ym
),
avc as (
  select mb.ym, coalesce(nullif(v.type,''),'未配車') cls, count(*) n
  from mb cross join bt_vehicles v
  where coalesce(v.type,'') <> '送迎'
    and coalesce((select k.active from bt_vehicle_monthly_kpi k where k.vehicle_code=v.code and k.year_month=mb.ym), v.active) is true
  group by mb.ym, coalesce(nullif(v.type,''),'未配車')
),
mday as (
  select mb.ym, coalesce(nullif(v.type,''),'未配車') cls,
    sum(greatest(0, (least(nullif(mt.end_date,'')::date, mb.me) - greatest(mt.start_date::date, mb.ms) + 1))) days
  from mb
  join bt_maintenance mt on mt.start_date ~ '^\d{4}-\d{2}-\d{2}'
  join bt_vehicles v on v.code=mt.vehicle_code
  where coalesce(v.type,'') <> '送迎'
    and coalesce((select k.active from bt_vehicle_monthly_kpi k where k.vehicle_code=v.code and k.year_month=mb.ym), v.active) is true
    and mt.start_date::date <= mb.me and coalesce(nullif(mt.end_date,'')::date, mt.start_date::date) >= mb.ms
  group by mb.ym, coalesce(nullif(v.type,''),'未配車')
),
rday2 as (
  select mb.ym, r.cls,
    sum(greatest(0, (least(r.end_date::date, mb.me) - greatest(r.start_date::date, mb.ms) + 1))) days
  from mb join r on r.start_date ~ '^\d{4}-\d{2}-\d{2}' and r.end_date ~ '^\d{4}-\d{2}-\d{2}'
       and r.start_date::date <= mb.me and r.end_date::date >= mb.ms
  group by mb.ym, r.cls
),
util as (
  select mb.ym, avc.cls,
    coalesce(rday2.days,0) rd,
    greatest(0, avc.n*mb.dim - coalesce(mday.days,0)) ad,
    avc.n nn
  from mb join avc on avc.ym=mb.ym
  left join mday on mday.ym=mb.ym and mday.cls=avc.cls
  left join rday2 on rday2.ym=mb.ym and rday2.cls=avc.cls
),
vbrand as (
  select mb.ym, mb.dim, v.code,
    case when coalesce(v.brand,'BUDDICA')='HDM' then 'HDM' else 'BT' end br
  from mb cross join bt_vehicles v
  where coalesce(v.type,'') <> '送迎'
    and coalesce((select k.active from bt_vehicle_monthly_kpi k where k.vehicle_code=v.code and k.year_month=mb.ym), v.active) is true
),
vmaint as (
  select mb.ym, mt.vehicle_code,
    sum(greatest(0, (least(nullif(mt.end_date,'')::date, mb.me) - greatest(mt.start_date::date, mb.ms) + 1))) days
  from mb join bt_maintenance mt on mt.start_date ~ '^\d{4}-\d{2}-\d{2}'
       and mt.start_date::date <= mb.me and coalesce(nullif(mt.end_date,'')::date, mt.start_date::date) >= mb.ms
  group by mb.ym, mt.vehicle_code
),
adbrand as (
  select vb.ym, vb.br, sum(greatest(0, vb.dim - coalesce(vm.days,0))) ad
  from vbrand vb left join vmaint vm on vm.ym=vb.ym and vm.vehicle_code=vb.code
  group by vb.ym, vb.br
),
rdbrand as (
  select mb.ym, case when coalesce(v.brand,'BUDDICA')='HDM' then 'HDM' else 'BT' end br,
    sum(greatest(0, (least(r.end_date::date, mb.me) - greatest(r.start_date::date, mb.ms) + 1))) days
  from mb join r on r.start_date ~ '^\d{4}-\d{2}-\d{2}' and r.end_date ~ '^\d{4}-\d{2}-\d{2}'
       and r.start_date::date <= mb.me and r.end_date::date >= mb.ms
  join bt_vehicles v on v.code=r.assigned_vehicle
  where coalesce(v.type,'') <> '送迎'
  group by mb.ym, case when coalesce(v.brand,'BUDDICA')='HDM' then 'HDM' else 'BT' end
),
utilbrand as (
  select mb.ym, b.br, coalesce(rdb.days,0) rd, coalesce(adb.ad,0) ad
  from mb cross join (values ('BT'),('HDM')) b(br)
  left join adbrand adb on adb.ym=mb.ym and adb.br=b.br
  left join rdbrand rdb on rdb.ym=mb.ym and rdb.br=b.br
),
vcb as (
  select mb.ym, coalesce(nullif(v.type,''),'未配車') cls,
    case when coalesce(v.brand,'BUDDICA')='HDM' then 'HDM' else 'BT' end br, v.code, mb.dim
  from mb cross join bt_vehicles v
  where coalesce(v.type,'') <> '送迎'
    and coalesce((select k.active from bt_vehicle_monthly_kpi k where k.vehicle_code=v.code and k.year_month=mb.ym), v.active) is true
),
adcb as (
  select vcb.ym, vcb.cls, vcb.br, sum(greatest(0, vcb.dim - coalesce(vm.days,0))) ad, count(*) n
  from vcb left join vmaint vm on vm.ym=vcb.ym and vm.vehicle_code=vcb.code
  group by vcb.ym, vcb.cls, vcb.br
),
rdcb as (
  select mb.ym, coalesce(nullif(v.type,''),'未配車') cls,
    case when coalesce(v.brand,'BUDDICA')='HDM' then 'HDM' else 'BT' end br,
    sum(greatest(0, (least(r.end_date::date, mb.me) - greatest(r.start_date::date, mb.ms) + 1))) rd
  from mb join r on r.start_date ~ '^\d{4}-\d{2}-\d{2}' and r.end_date ~ '^\d{4}-\d{2}-\d{2}'
       and r.start_date::date <= mb.me and r.end_date::date >= mb.ms
  join bt_vehicles v on v.code=r.assigned_vehicle
  where coalesce(v.type,'') <> '送迎'
  group by mb.ym, coalesce(nullif(v.type,''),'未配車'), case when coalesce(v.brand,'BUDDICA')='HDM' then 'HDM' else 'BT' end
),
util_cb as (
  select adcb.ym, adcb.cls, adcb.br, coalesce(rdcb.rd,0) rd, adcb.ad, adcb.n
  from adcb left join rdcb on rdcb.ym=adcb.ym and rdcb.cls=adcb.cls and rdcb.br=adcb.br
)
select jsonb_build_object(
  'generated', to_char(now() at time zone 'Asia/Tokyo','YYYY-MM-DD HH24:MI'),
  'months', (select to_jsonb(array_agg(ym order by ym)) from mons),
  'clsnames', coalesce((select jsonb_object_agg(type, names) from (select type, string_agg(distinct name,'/') as names from bt_vehicles where type is not null and type<>'送迎' and name is not null and name<>'' group by type) z),'{}'::jsonb),
  'data', (select jsonb_object_agg(m.ym, jsonb_build_object(
      'cls', coalesce((select jsonb_object_agg(cls, jsonb_build_object('c',c,'r',rr)) from (select cls,count(*) c,sum(rev) rr from r where r.ym=m.ym group by cls) a),'{}'::jsonb),
      'cls_cb', coalesce((select jsonb_object_agg(vbr||'|'||cls, jsonb_build_object('c',c,'r',rr)) from (select vbr,cls,count(*) c,sum(rev) rr from r where r.ym=m.ym group by vbr,cls) acb),'{}'::jsonb),
      'chan', coalesce((select jsonb_object_agg(br||'|'||chan, jsonb_build_object('c',c,'r',rr)) from (select br,chan,count(*) c,sum(rev) rr from r where r.ym=m.ym group by br,chan) b),'{}'::jsonb),
      'tot_c', (select count(*) from r where r.ym=m.ym),
      'resv_r', (select coalesce(sum(rev),0) from r where r.ym=m.ym),
      'ext_r', coalesce((select amt from ex where ex.ym=m.ym),0),
      'tot_r', (select coalesce(sum(rev),0) from r where r.ym=m.ym) + coalesce((select amt from ex where ex.ym=m.ym),0),
      'flow_c', (select count(*) from f where f.fym=m.ym),
      'flow_r', (select coalesce(sum(rev),0) from f where f.fym=m.ym),
      'flow_brand', coalesce((select jsonb_object_agg(br, jsonb_build_object('c',c,'r',rr)) from (select br,count(*) c,sum(rev) rr from f where f.fym=m.ym group by br) fb),'{}'::jsonb),
      'flow_chan', coalesce((select jsonb_object_agg(br||'|'||chan, jsonb_build_object('c',c,'r',rr)) from (select br,chan,count(*) c,sum(rev) rr from f where f.fym=m.ym group by br,chan) fc),'{}'::jsonb),
      'nveh', coalesce((select nveh from act where act.ym=m.ym),0),
      'nbt', coalesce((select nbt from act where act.ym=m.ym),0),
      'nhd', coalesce((select nhd from act where act.ym=m.ym),0),
      'util', coalesce((select jsonb_object_agg(cls, jsonb_build_object('rd',rd,'ad',ad,'n',nn)) from util where util.ym=m.ym),'{}'::jsonb),
      'util_brand', coalesce((select jsonb_object_agg(br, jsonb_build_object('rd',rd,'ad',ad)) from utilbrand where utilbrand.ym=m.ym),'{}'::jsonb),
      'util_cb', coalesce((select jsonb_object_agg(br||'|'||cls, jsonb_build_object('rd',rd,'ad',ad,'n',n)) from util_cb where util_cb.ym=m.ym),'{}'::jsonb)
    )) from mons m)
);
$function$
;
