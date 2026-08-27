create or replace function mpadmin_pending_bt()
returns jsonb language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(row order by ord desc),'[]'::jsonb) from (
    select jsonb_build_object('bucket', case when coalesce(r.brand,'BUDDICA')='HDM' then 'hdm_tkm' else 'but_tkm' end,
      'id',c.id::text,'rid',c.reservation_id,'field',coalesce(c.change_type,c.field_name),'newv',c.new_value,'note','','status',c.status,
      'at',coalesce(nullif(c.changed_at,''),to_char(c.decided_at,'YYYY-MM-DD"T"HH24:MI:SS')),
      'name',r.name,'ota',r.ota,'sd',r.start_date,'ed',r.end_date,'cls',r.vehicle_class,'price',r.price,'mail',r.mail,'line',false,'renewal',true,'token',r.mypage_token) row, c.id ord
    from bt_reservation_changes c left join bt_reservations r on r.id=c.reservation_id
    where c.source='mypage' and (c.status='requested' or (c.status in ('approved','rejected','acknowledged') and c.decided_at>now()-interval '30 days'))
  ) t;
$$;
grant execute on function mpadmin_pending_bt() to anon, authenticated;
