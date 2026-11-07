-- 2026-11-07 別の案・お断り理由（アクションタブ）
-- 1) 依頼一覧 RPC に新しい状態（proposed / declined_by_guest / expired）と payload を足す
-- 2) 返事期限を過ぎた別の案を expired にする（5分ごと）
create or replace function public.mpadmin_pending()
 returns jsonb language sql security definer set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(row order by at desc),'[]'::jsonb) from (
    select jsonb_build_object('bucket','hdm_spk','id',c.id::text,'rid',c.reservation_id,'field',c.field,'newv',c.new_value,'note',c.note,'status',c.status,'at',c.created_at,'name',r.name,'ota',r.ota,'sd',r.lend_date,'ed',r.return_date,'cls',r.vehicle,'price',r.price,'mail',r.mail,
      'line',exists(select 1 from spk_line_links l where l.resv_no=c.reservation_id and coalesce(l.line_user_id,'')<>''),'renewal',(coalesce(r.ota,'')='HANDYMAN' or c.reservation_id like 'HDM%'),'token',r.mypage_token,
      'proposal',c.payload->'proposal','reject',c.payload->'reject') row, c.created_at at
    from mypage_changes c left join reservations r on r.id=c.reservation_id
    where c.store='spk' and (c.status in ('requested','proposed') or (c.status in ('approved','rejected','acknowledged','declined_by_guest','expired') and c.created_at>now()-interval '30 days'))
    union all
    select jsonb_build_object('bucket','hdm_nha','id',c.id::text,'rid',c.reservation_id,'field',c.field,'newv',c.new_value,'note',c.note,'status',c.status,'at',c.created_at,'name',r.name,'ota',r.ota,'sd',r.start_date,'ed',r.end_date,'cls',r.vehicle_class,'price',r.price,'mail',r.mail,
      'line',exists(select 1 from nha_line_links l where l.resv_no=c.reservation_id and coalesce(l.line_user_id,'')<>''),'renewal',(coalesce(r.ota,'')='HANDYMAN' or c.reservation_id like 'HDM%'),'token',r.mypage_token,
      'proposal',c.payload->'proposal','reject',c.payload->'reject'), c.created_at
    from mypage_changes c left join nha_reservations r on r.id=c.reservation_id
    where c.store='nha' and (c.status in ('requested','proposed') or (c.status in ('approved','rejected','acknowledged','declined_by_guest','expired') and c.created_at>now()-interval '30 days'))
    union all
    select jsonb_build_object('bucket','key_spk','id',c.id::text,'rid',c.reservation_id,'field',c.field,'newv',c.new_value,'note',c.note,'status',c.status,'at',c.created_at,'name',r.name,'ota',r.ota,'sd',r.lend_date,'ed',r.return_date,'cls',r.vehicle,'price',r.price,'mail',r.mail,
      'line',exists(select 1 from spk_line_links l where l.resv_no=c.reservation_id and coalesce(l.line_user_id,'')<>''),'renewal',true,'token',r.mypage_token,
      'proposal',c.payload->'proposal','reject',c.payload->'reject'), c.created_at
    from keydrop_mypage_changes c left join reservations r on r.id=c.reservation_id
    where c.store='spk' and (c.status in ('requested','proposed') or (c.status in ('approved','rejected','acknowledged','declined_by_guest','expired') and c.created_at>now()-interval '30 days'))
    union all
    select jsonb_build_object('bucket','key_nha','id',c.id::text,'rid',c.reservation_id,'field',c.field,'newv',c.new_value,'note',c.note,'status',c.status,'at',c.created_at,'name',r.name,'ota',r.ota,'sd',r.start_date,'ed',r.end_date,'cls',r.vehicle_class,'price',r.price,'mail',r.mail,
      'line',exists(select 1 from nha_line_links l where l.resv_no=c.reservation_id and coalesce(l.line_user_id,'')<>''),'renewal',true,'token',r.mypage_token,
      'proposal',c.payload->'proposal','reject',c.payload->'reject'), c.created_at
    from keydrop_mypage_changes c left join nha_reservations r on r.id=c.reservation_id
    where c.store='nha' and (c.status in ('requested','proposed') or (c.status in ('approved','rejected','acknowledged','declined_by_guest','expired') and c.created_at>now()-interval '30 days'))
  ) t;
$function$;

create or replace function public.mypage_expire_proposals() returns int language plpgsql security definer set search_path = public as $$
declare n1 int; n2 int;
begin
  update mypage_changes set status='expired', payload = jsonb_set(payload, '{proposal,answer}', '"expired"')
   where status='proposed' and (payload->'proposal'->>'expires_at')::timestamptz < now();
  get diagnostics n1 = row_count;
  update keydrop_mypage_changes set status='expired', payload = jsonb_set(payload, '{proposal,answer}', '"expired"')
   where status='proposed' and (payload->'proposal'->>'expires_at')::timestamptz < now();
  get diagnostics n2 = row_count;
  return n1 + n2;
end $$;
revoke all on function public.mypage_expire_proposals() from public, anon, authenticated;

select cron.schedule('mypage-expire-proposals', '*/5 * * * *', 'select public.mypage_expire_proposals()');
