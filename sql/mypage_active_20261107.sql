-- マイページアクティブ管理（main: ckrxttbnawkclshczsia）
-- トークン単位で閲覧・確定操作を集計する。全店共通（高松の閲覧も main の mypage_events に入るのでトークンで突合）。
-- 呼べるのは service_role のみ（EF mypage-active から）。
create or replace function public.mpactive_event_agg(p_tokens text[])
returns table(token text, opens int, open_days int, first_at timestamptz, last_at timestamptz,
  standalone bool, vias text[], time_confirmed bool, opt_confirmed bool, place_confirmed bool)
language sql stable security definer set search_path = public as $$
  select e.token,
    count(*) filter (where e.action='page' and e.event='page_view')::int,
    count(distinct (e.created_at at time zone 'Asia/Tokyo')::date) filter (where e.action='page' and e.event='page_view')::int,
    min(e.created_at) filter (where e.action='page' and e.event='page_view'),
    max(e.created_at) filter (where e.action='page' and e.event='page_view'),
    coalesce(bool_or(coalesce(e.meta->>'standalone','')='true') filter (where e.action='page' and e.event='page_view'), false),
    array_remove(array_agg(distinct e.meta->>'via') filter (where e.action='page' and e.event='page_view'), null),
    coalesce(bool_or(e.action in ('call_update','call_set_pickup','call_set_return','btn_savePickup','btn_saveField','call_confirm_time')), false),
    coalesce(bool_or(e.action in ('btn_sendOption','call_confirm_option')), false),
    coalesce(bool_or(e.action in ('call_set_pickup','btn_savePickup','call_confirm_place') or e.action like 'mapPicker_%'), false)
  from mypage_events e
  where e.token = any(p_tokens) and coalesce(e.page,'mypage')='mypage'
  group by e.token
$$;
revoke all on function public.mpactive_event_agg(text[]) from public, anon, authenticated;
grant execute on function public.mpactive_event_agg(text[]) to service_role;
-- rollback: drop function public.mpactive_event_agg(text[]);
