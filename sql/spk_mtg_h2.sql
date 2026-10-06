CREATE OR REPLACE FUNCTION public.spk_mtg_h2()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with bounds as (select '2026-02' as start_ym, greatest('2026-12', (select coalesce(max(substr(coalesce(nullif(return_date,''),lend_date),1,7)),'2026-12') from reservations where coalesce(status,'') not in ('キャンセル','cancelled','canceled') and coalesce(nullif(return_date,''),lend_date) >= '2026-02-01' and id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)' and coalesce(name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)')) as end_ym),
mons as (select to_char(gs,'YYYY-MM') ym from bounds, generate_series((start_ym||'-01')::date,(end_ym||'-01')::date,interval '1 month') gs),
mb as (select ym, (ym||'-01')::date ms, ((ym||'-01')::date + interval '1 month' - interval '1 day')::date me,
        extract(day from ((ym||'-01')::date + interval '1 month' - interval '1 day'))::int dim from mons),
r as (
  select res.id, res.vehicle as assigned_vehicle,
    case when coalesce(res.base_price,0)>0 or coalesce(res.option_price,0)>0
      then coalesce(res.base_price,0)+coalesce(res.option_price,0)-coalesce(res.discount,0)
      else coalesce(res.price,0) end as rev,
    substr(coalesce(res.return_date,''),1,7) as ym,
    res.lend_date as start_date, res.return_date as end_date,
    coalesce(nullif(v.type,''),'未配車') as cls,
    case upper(coalesce(res.ota,''))
      when 'J' then 'じゃらん' when 'R' then '楽天' when 'S' then 'skyticket'
      when 'HP' then '自社HP' when '' then '自社HP'
      when 'DIRECT' then '直予約' when 'SP' then 'SP(スタッフ)'
      when 'KEYDROP' then 'KEYDROP'
      else res.ota end as chan
  from reservations res
  left join vehicles v on v.code=res.vehicle
  where substr(coalesce(res.return_date,''),1,7) between '2026-02' and (select end_ym from bounds)
    and coalesce(res.status,'') not in ('キャンセル','cancelled','canceled')
    and res.id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)'
    and coalesce(res.name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)'
    and coalesce(res.name,'') <> ''
),
f as (
  select res.id,
    case when coalesce(res.base_price,0)>0 or coalesce(res.option_price,0)>0
      then coalesce(res.base_price,0)+coalesce(res.option_price,0)-coalesce(res.discount,0)
      else coalesce(res.price,0) end as rev,
    to_char((res.created_at at time zone 'Asia/Tokyo'),'YYYY-MM') as fym,
    case upper(coalesce(res.ota,''))
      when 'J' then 'じゃらん' when 'R' then '楽天' when 'S' then 'skyticket'
      when 'HP' then '自社HP' when '' then '自社HP'
      when 'DIRECT' then '直予約' when 'SP' then 'SP(スタッフ)'
      when 'KEYDROP' then 'KEYDROP'
      else res.ota end as chan
  from reservations res
  where to_char((res.created_at at time zone 'Asia/Tokyo'),'YYYY-MM') between '2026-02' and (select end_ym from bounds)
    and coalesce(res.status,'') not in ('キャンセル','cancelled','canceled')
    and res.id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)'
    and coalesce(res.name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)'
    and coalesce(res.name,'') <> ''
),
act as (
  select m.ym, count(*) filter (where vv.actv) as nveh
  from mons m
  cross join lateral (
    select coalesce((select k.active from vehicle_monthly_kpi k where k.vehicle_code=v.code and k.year_month=m.ym), v.active) as actv
    from vehicles v where coalesce(v.type,'') <> '送迎' and coalesce(v.insurance_veh,false)=false
  ) vv
  group by m.ym
),
avc as (
  select mb.ym, coalesce(nullif(v.type,''),'未配車') cls, count(*) n
  from mb cross join vehicles v
  where coalesce(v.type,'') <> '送迎' and coalesce(v.insurance_veh,false)=false
    and coalesce((select k.active from vehicle_monthly_kpi k where k.vehicle_code=v.code and k.year_month=mb.ym), v.active) is true
  group by mb.ym, coalesce(nullif(v.type,''),'未配車')
),
mday as (
  select mb.ym, coalesce(nullif(v.type,''),'未配車') cls,
    sum(greatest(0, (least(nullif(mt.end_date,'')::date, mb.me) - greatest(mt.start_date::date, mb.ms) + 1))) days
  from mb
  join maintenance mt on mt.start_date ~ '^\d{4}-\d{2}-\d{2}'
  join vehicles v on v.code=mt.vehicle_code
  where coalesce(v.type,'') <> '送迎' and coalesce(v.insurance_veh,false)=false
    and coalesce((select k.active from vehicle_monthly_kpi k where k.vehicle_code=v.code and k.year_month=mb.ym), v.active) is true
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
)
select jsonb_build_object(
  'generated', to_char(now() at time zone 'Asia/Tokyo','YYYY-MM-DD HH24:MI'),
  'months', (select to_jsonb(array_agg(ym order by ym)) from mons),
  'clsnames', coalesce((select jsonb_object_agg(type, names) from (select type, string_agg(distinct name,'/') as names from vehicles where type is not null and type<>'送迎' and name is not null and name<>'' group by type) z),'{}'::jsonb),
  'data', (select jsonb_object_agg(m.ym, jsonb_build_object(
      'cls', coalesce((select jsonb_object_agg(cls, jsonb_build_object('c',c,'r',rr)) from (select cls,count(*) c,sum(rev) rr from r where r.ym=m.ym group by cls) a),'{}'::jsonb),
      'chan', coalesce((select jsonb_object_agg(chan, jsonb_build_object('c',c,'r',rr)) from (select chan,count(*) c,sum(rev) rr from r where r.ym=m.ym group by chan) b),'{}'::jsonb),
      'tot_c', (select count(*) from r where r.ym=m.ym),
      'resv_r', (select coalesce(sum(rev),0) from r where r.ym=m.ym),
      'ext_r', 0,
      'tot_r', (select coalesce(sum(rev),0) from r where r.ym=m.ym),
      'flow_c', (select count(*) from f where f.fym=m.ym),
      'flow_r', (select coalesce(sum(rev),0) from f where f.fym=m.ym),
      'flow_chan', coalesce((select jsonb_object_agg(chan, jsonb_build_object('c',c,'r',rr)) from (select chan,count(*) c,sum(rev) rr from f where f.fym=m.ym group by chan) fc),'{}'::jsonb),
      'nveh', coalesce((select nveh from act where act.ym=m.ym),0),
      'util', coalesce((select jsonb_object_agg(cls, jsonb_build_object('rd',rd,'ad',ad,'n',nn)) from util where util.ym=m.ym),'{}'::jsonb)
    )) from mons m)
);
$function$
