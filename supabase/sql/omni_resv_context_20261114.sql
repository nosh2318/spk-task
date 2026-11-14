-- 2026-11-14 nosh「まずデータを見る。データを見れば90%はAIで答えられる」
-- オムニ（cs_autoreply.py）が返事を書く前に必ず読む「予約の事実」。読むだけ（書かない）。
-- 予約・そのクラスの車と空き（同じ期間の配車）・この予約の車・お届け/回収タスク（担当・時間・場所）・担当のその日の他の仕事・変更依頼の状態
create or replace function public.omni_resv_context(p_store text, p_rid text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record; out jsonb := '{}'::jsonb;
begin
  if p_store = 'spk' then
    select id, name, ota, vehicle as cls, nullif(lend_date,'')::date as sd, lend_time as st, nullif(return_date,'')::date as ed, return_time as et,
           del_place, col_place, visit_type, return_type, status, people into r from reservations where id = p_rid;
    if not found then return null; end if;
    out := jsonb_build_object('store','札幌','class',r.cls,'ota',r.ota,'start',r.sd||' '||coalesce(r.st,''),'end',r.ed||' '||coalesce(r.et,''),
      'deliver_to',r.del_place,'collect_at',r.col_place,'go',r.visit_type,'back',r.return_type,'status',r.status,'people',r.people);
    out := out || jsonb_build_object('my_car',(select jsonb_build_object('code',v.code,'name',v.name) from fleet f join vehicles v on v.code=f.vehicle_code where f.reservation_id=p_rid limit 1));
    out := out || jsonb_build_object('class_cars',(select coalesce(jsonb_agg(jsonb_build_object('code',v.code,'name',v.name,
        'free', not exists (select 1 from fleet f join reservations x on x.id=f.reservation_id where f.vehicle_code=v.code and x.id<>p_rid
                             and nullif(x.lend_date,'')::date<=r.ed and nullif(x.return_date,'')::date>=r.sd and coalesce(x.status,'') !~* 'cancel|キャンセル'),
        'this', exists (select 1 from fleet f where f.vehicle_code=v.code and f.reservation_id=p_rid)) order by v.code),'[]'::jsonb)
      from vehicles v where v.active is not false and v.type in (r.cls, left(r.cls,1))));
    out := out || jsonb_build_object('tasks',(select coalesce(jsonb_agg(jsonb_build_object('kind',t.type,'date',t.date,'time',t.time,'staff',t.assignee,'place',t.place,'done',t.done,
        'staff_other_jobs_that_day',(select coalesce(jsonb_agg(o.time||' '||o.type order by o.time),'[]'::jsonb) from tasks o where o.date=t.date and o.assignee=t.assignee and coalesce(t.assignee,'')<>'' and o.reservation_id<>p_rid and o._id ~ '^[dc]-' and o.deleted is not true))),'[]'::jsonb)
      from tasks t where t.reservation_id=p_rid and t._id ~ '^[dc]-' and t.deleted is not true));
  elsif p_store = 'nha' then
    select id, name, ota, vehicle_class as cls, nullif(start_date,'')::date as sd, start_time as st, nullif(end_date,'')::date as ed, end_time as et,
           del_place, col_place, visit_type, return_type, status, people into r from nha_reservations where id = p_rid;
    if not found then return null; end if;
    out := jsonb_build_object('store','那覇','class',r.cls,'ota',r.ota,'start',r.sd||' '||coalesce(r.st,''),'end',r.ed||' '||coalesce(r.et,''),
      'deliver_to',r.del_place,'collect_at',r.col_place,'go',r.visit_type,'back',r.return_type,'status',r.status,'people',r.people);
    out := out || jsonb_build_object('my_car',(select jsonb_build_object('code',v.code,'name',v.name) from nha_fleet f join nha_vehicles v on v.code=f.vehicle_code where f.reservation_id=p_rid limit 1));
    out := out || jsonb_build_object('class_cars',(select coalesce(jsonb_agg(jsonb_build_object('code',v.code,'name',v.name,
        'free', not exists (select 1 from nha_fleet f join nha_reservations x on x.id=f.reservation_id where f.vehicle_code=v.code and x.id<>p_rid
                             and nullif(x.start_date,'')::date<=r.ed and nullif(x.end_date,'')::date>=r.sd and coalesce(x.status,'') !~* 'cancel|キャンセル'),
        'this', exists (select 1 from nha_fleet f where f.vehicle_code=v.code and f.reservation_id=p_rid)) order by v.code),'[]'::jsonb)
      from nha_vehicles v where v.active is not false and v.type in (r.cls, left(r.cls,1))));
    out := out || jsonb_build_object('tasks',(select coalesce(jsonb_agg(jsonb_build_object('kind',t."内容",'date',t.date,'time',t."時間",'staff',t."担当",'place',t."送迎場所",
        'staff_other_jobs_that_day',(select coalesce(jsonb_agg(o."時間"||' '||o."内容" order by o."時間"),'[]'::jsonb) from nha_tasks o where o.date=t.date and o."担当"=t."担当" and coalesce(t."担当",'')<>'' and o."予約番号"<>p_rid and o._id ~ '^[dc]-' and o.deleted is not true))),'[]'::jsonb)
      from nha_tasks t where t."予約番号"=p_rid and t._id ~ '^[dc]-' and t.deleted is not true));
  else
    return null;
  end if;
  out := out || jsonb_build_object('change_requests',(select coalesce(jsonb_agg(jsonb_build_object('what',c.field,'from',c.old_value,'to',c.new_value,'status',c.status,'at',c.created_at) order by c.id desc),'[]'::jsonb)
      from (select * from mypage_changes c where c.reservation_id=p_rid and c.store=p_store and c.status in ('requested','approved','proposed','rejected','declined_by_guest') order by id desc limit 8) c));
  return out;
end $$;
revoke all on function public.omni_resv_context(text,text) from public, anon, authenticated;
