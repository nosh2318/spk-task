/* 2026-11-12 mtg_fc（mtg_fc_20261112_core.sql）の店別の部分（main：札幌・那覇）。予約と台数を共通の形にして返す（個人情報は返さない・anon からは呼べない）。
   除外条件は *_mtg_h2 と同じ（テスト除外）。キャンセル済みは xd（キャンセル日）付きで残す。cls＝配車表の車両のクラス（未配車は予約のクラス）。
   ch＝経路（公式＝HP/HANDYMAN、OTA＝J/R/S/O/A/RC/G、その他）。io＝電話番号が 0 / +81 以外で始まる＝海外。 */
create or replace function public.mtg_fc_res(p_store text)
returns table(id text, sd date, ed date, cd date, xd date, cls text, ch text, io text, rev numeric)
language sql stable security definer set search_path to 'public' as $function$
select res.id, res.lend_date::date, res.return_date::date, (res.created_at at time zone 'Asia/Tokyo')::date,
    (case when coalesce(res.status,'') in ('キャンセル','cancelled','canceled') then greatest((res.created_at at time zone 'Asia/Tokyo')::date,
      coalesce((select min(l.changed_at at time zone 'Asia/Tokyo')::date from reservation_cancel_ledger l where l.reservation_id=res.id and l.event='cancel'), (res.updated_at at time zone 'Asia/Tokyo')::date)) end),
    coalesce((select coalesce(nullif(vv.type,''),'未配車') from fleet f join vehicles vv on vv.code=f.vehicle_code where f.reservation_id=res.id limit 1), nullif(res.vehicle,''), '未配車'),
    (case when res.ota in ('HP','HANDYMAN') then '公式' when res.ota in ('J','R','S','O','A','RC','G') then 'OTA' else 'その他' end),
    (case when coalesce(res.tel,'')<>'' and regexp_replace(res.tel,'[^0-9+]','','g') !~ '^(0|\+?81)' and regexp_replace(res.tel,'[^0-9]','','g')<>'' then '海外' else '国内' end),
    (case when coalesce(res.base_price,0)>0 or coalesce(res.option_price,0)>0 then coalesce(res.base_price,0)+coalesce(res.option_price,0)-coalesce(res.discount,0) else coalesce(res.price,0) end)::numeric
  from reservations res
  where p_store='spk' and res.lend_date ~ '^\d{4}-\d{2}-\d{2}' and res.return_date ~ '^\d{4}-\d{2}-\d{2}'
    and res.id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)'
    and coalesce(res.name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)' and coalesce(res.name,'') <> ''
    and res.return_date >= '2026-04-01'
union all
select res.id, res.start_date::date, res.end_date::date, (res.created_at at time zone 'Asia/Tokyo')::date,
    (case when coalesce(res.status,'') in ('キャンセル','cancelled','canceled') then greatest((res.created_at at time zone 'Asia/Tokyo')::date,
      coalesce((select min(l.changed_at at time zone 'Asia/Tokyo')::date from reservation_cancel_ledger l where l.reservation_id=res.id and l.event='cancel'), (res.updated_at at time zone 'Asia/Tokyo')::date)) end),
    coalesce((select coalesce(nullif(vv.type,''),'未配車') from nha_fleet f join nha_vehicles vv on vv.code=f.vehicle_code where f.reservation_id=res.id limit 1), nullif(res.vehicle_class,''), '未配車'),
    (case when res.ota in ('HP','HANDYMAN') then '公式' when res.ota in ('J','R','S','O','A','RC','G') then 'OTA' else 'その他' end),
    (case when coalesce(res.tel,'')<>'' and regexp_replace(res.tel,'[^0-9+]','','g') !~ '^(0|\+?81)' and regexp_replace(res.tel,'[^0-9]','','g')<>'' then '海外' else '国内' end),
    (case when coalesce(res.base_price,0)>0 or coalesce(res.option_price,0)>0 then coalesce(res.base_price,0)+coalesce(res.option_price,0)-coalesce(res.discount,0) else coalesce(res.price,0) end)::numeric
  from nha_reservations res
  where p_store='nha' and res.start_date ~ '^\d{4}-\d{2}-\d{2}' and res.end_date ~ '^\d{4}-\d{2}-\d{2}'
    and res.id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)'
    and coalesce(res.name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)' and coalesce(res.name,'') <> ''
    and res.end_date >= '2026-04-01';
$function$;
revoke all on function public.mtg_fc_res(text) from public, anon, authenticated;

/* 月ごと・クラス別の稼働台数（月次フラグ vehicle_monthly_kpi.active、無ければ車両の active） */
create or replace function public.mtg_fc_cap(p_store text)
returns table(ym text, cls text, n int)
language sql stable security definer set search_path to 'public' as $function$
select to_char(g,'YYYY-MM'), coalesce(nullif(x.type,''),'未配車'), count(*)::int
  from generate_series(timestamp '2026-04-01', date_trunc('month',(now() at time zone 'Asia/Tokyo')), interval '1 month') g cross join vehicles x
  where p_store='spk' and coalesce(x.type,'')<>'送迎' and coalesce(x.insurance_veh,false)=false
    and coalesce((select k.active from vehicle_monthly_kpi k where k.vehicle_code=x.code and k.year_month=to_char(g,'YYYY-MM')), x.active) is true
  group by 1,2
union all
select to_char(g,'YYYY-MM'), coalesce(nullif(x.type,''),'未配車'), count(*)::int
  from generate_series(timestamp '2026-04-01', date_trunc('month',(now() at time zone 'Asia/Tokyo')), interval '1 month') g cross join nha_vehicles x
  where p_store='nha' and coalesce(x.type,'')<>'送迎' and coalesce(x.insurance_veh,false)=false
    and coalesce((select k.active from nha_vehicle_monthly_kpi k where k.vehicle_code=x.code and k.year_month=to_char(g,'YYYY-MM')), x.active) is true
  group by 1,2;
$function$;
revoke all on function public.mtg_fc_cap(text) from public, anon, authenticated;
