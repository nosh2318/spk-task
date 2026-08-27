create or replace function mpadmin_pending()
returns jsonb language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(row order by at desc),'[]'::jsonb) from (
    select jsonb_build_object('bucket','hdm_spk','id',c.id::text,'rid',c.reservation_id,'field',c.field,'newv',c.new_value,'note',c.note,'status',c.status,'at',c.created_at,'name',r.name,'ota',r.ota,'sd',r.lend_date,'ed',r.return_date,'cls',r.vehicle,'price',r.price,'mail',r.mail,
      'line',exists(select 1 from spk_line_links l where l.resv_no=c.reservation_id),'renewal',(coalesce(r.ota,'')='HANDYMAN' or c.reservation_id like 'HDM%'),'token',r.mypage_token) row, c.created_at at
    from mypage_changes c left join reservations r on r.id=c.reservation_id
    where c.store='spk' and (c.status='requested' or (c.status in ('approved','rejected','acknowledged') and c.created_at>now()-interval '30 days'))
    union all
    select jsonb_build_object('bucket','hdm_nha','id',c.id::text,'rid',c.reservation_id,'field',c.field,'newv',c.new_value,'note',c.note,'status',c.status,'at',c.created_at,'name',r.name,'ota',r.ota,'sd',r.start_date,'ed',r.end_date,'cls',r.vehicle_class,'price',r.price,'mail',r.mail,
      'line',exists(select 1 from nha_line_links l where l.resv_no=c.reservation_id),'renewal',(coalesce(r.ota,'')='HANDYMAN' or c.reservation_id like 'HDM%'),'token',r.mypage_token), c.created_at
    from mypage_changes c left join nha_reservations r on r.id=c.reservation_id
    where c.store='nha' and (c.status='requested' or (c.status in ('approved','rejected','acknowledged') and c.created_at>now()-interval '30 days'))
    union all
    select jsonb_build_object('bucket','key_spk','id',c.id::text,'rid',c.reservation_id,'field',c.field,'newv',c.new_value,'note',c.note,'status',c.status,'at',c.created_at,'name',r.name,'ota',r.ota,'sd',r.lend_date,'ed',r.return_date,'cls',r.vehicle,'price',r.price,'mail',r.mail,
      'line',exists(select 1 from spk_line_links l where l.resv_no=c.reservation_id),'renewal',true,'token',r.mypage_token), c.created_at
    from keydrop_mypage_changes c left join reservations r on r.id=c.reservation_id
    where c.store='spk' and (c.status='requested' or (c.status in ('approved','rejected','acknowledged') and c.created_at>now()-interval '30 days'))
    union all
    select jsonb_build_object('bucket','key_nha','id',c.id::text,'rid',c.reservation_id,'field',c.field,'newv',c.new_value,'note',c.note,'status',c.status,'at',c.created_at,'name',r.name,'ota',r.ota,'sd',r.start_date,'ed',r.end_date,'cls',r.vehicle_class,'price',r.price,'mail',r.mail,
      'line',exists(select 1 from nha_line_links l where l.resv_no=c.reservation_id),'renewal',true,'token',r.mypage_token), c.created_at
    from keydrop_mypage_changes c left join nha_reservations r on r.id=c.reservation_id
    where c.store='nha' and (c.status='requested' or (c.status in ('approved','rejected','acknowledged') and c.created_at>now()-interval '30 days'))
  ) t;
$$;
grant execute on function mpadmin_pending() to anon, authenticated;
