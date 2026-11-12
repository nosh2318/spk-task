/* 2026-11-12 mtg_fc（mtg_fc_20261112_core.sql）の店別の部分（BT：高松）。予約と台数を共通の形にして返す（個人情報は返さない・anon からは呼べない）。
   除外条件は bt_mtg_h2 と同じ（テスト除外）。キャンセル済みは xd（キャンセル日）付きで残す。cls＝配車表 bt_fleet の車両のクラス（未配車は予約のクラス）。
   ch＝経路（公式＝HANDYMAN または source=site、OTA＝source=ota、その他）。io＝電話番号が 0 / +81 以外で始まる＝海外。 */
create or replace function public.mtg_fc_res(p_store text)
returns table(id text, sd date, ed date, cd date, xd date, cls text, ch text, io text, rev numeric)
language sql stable security definer set search_path to 'public' as $function$
select res.id, res.start_date::date, res.end_date::date, (res.created_at at time zone 'Asia/Tokyo')::date,
    (case when coalesce(res.status,'') in ('キャンセル','cancelled','canceled') then greatest((res.created_at at time zone 'Asia/Tokyo')::date,
      coalesce((select min(l.changed_at at time zone 'Asia/Tokyo')::date from reservation_cancel_ledger l where l.reservation_id=res.id and l.event='cancel'), (res.updated_at at time zone 'Asia/Tokyo')::date)) end),
    coalesce((select coalesce(nullif(vv.type,''),'未配車') from bt_fleet f join bt_vehicles vv on vv.code=f.vehicle_code where f.reservation_id=res.id limit 1), nullif(res.vehicle_class,''), '未配車'),
    (case when res.ota='HANDYMAN' or (coalesce(res.ota,'')='' and res.source='site') then '公式' when res.source='ota' then 'OTA' else 'その他' end),
    (case when coalesce(res.tel,'')<>'' and regexp_replace(res.tel,'[^0-9+]','','g') !~ '^(0|\+?81)' and regexp_replace(res.tel,'[^0-9]','','g')<>'' then '海外' else '国内' end),
    (case when coalesce(res.base_price,0)>0 or coalesce(res.option_price,0)>0 then coalesce(res.base_price,0)+coalesce(res.option_price,0)-coalesce(res.discount,0) else coalesce(res.price,0) end)::numeric
  from bt_reservations res
  where p_store='bt' and res.start_date ~ '^\d{4}-\d{2}-\d{2}' and res.end_date ~ '^\d{4}-\d{2}-\d{2}'
    and res.id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)'
    and coalesce(res.name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)' and coalesce(res.name,'') <> ''
    and res.end_date >= '2026-08-01';
$function$;
revoke all on function public.mtg_fc_res(text) from public, anon, authenticated;

create or replace function public.mtg_fc_cap(p_store text)
returns table(ym text, cls text, n int)
language sql stable security definer set search_path to 'public' as $function$
select to_char(g,'YYYY-MM'), coalesce(nullif(x.type,''),'未配車'), count(*)::int
  from generate_series(timestamp '2026-08-01', date_trunc('month',(now() at time zone 'Asia/Tokyo')), interval '1 month') g cross join bt_vehicles x
  where p_store='bt' and coalesce(x.type,'')<>'送迎' and coalesce(x.insurance_veh,false)=false
    and coalesce((select k.active from bt_vehicle_monthly_kpi k where k.vehicle_code=x.code and k.year_month=to_char(g,'YYYY-MM')), x.active) is true
  group by 1,2;
$function$;
revoke all on function public.mtg_fc_cap(text) from public, anon, authenticated;

/* 予約外売上（月別・bt_mtg_h2 の ext_r と同じ定義） */
create or replace function public.mtg_fc_ext(p_store text)
returns table(ym text, amt numeric) language sql stable security definer set search_path to 'public' as $function$
select to_char(a.date,'YYYY-MM'), sum(coalesce(a.amount,0))::numeric from bt_accounting a
  where p_store='bt' and a.type='extra_sales' and to_char(a.date,'YYYY-MM')>='2026-08' group by 1;
$function$;
revoke all on function public.mtg_fc_ext(text) from public, anon, authenticated;
