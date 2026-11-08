-- 2026-11-08 札幌 洗車の出発前点検に「ワイパー動作（ゴムの状態）」(item_key='wiper') を追加
-- 変更点：spk_insp_app_set / spk_insp_set の pre 許可キー配列に 'wiper' を足すだけ（他の行は live 定義と同一）
-- 表 spk_inspection_checks は item_key ~ '^[_a-z0-9]{1,40}$' のみ＝制約変更不要。
-- 戻し：同じ2関数を、配列から 'wiper' を除いた定義で CREATE OR REPLACE（= 本ファイルから 'wiper', を消して実行）

CREATE OR REPLACE FUNCTION public.spk_insp_app_set(p_task text, p_kind text, p_item text, p_checked boolean, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_login text; v_vc text; v_date text; v_type text; v_today date := (now() at time zone 'Asia/Tokyo')::date; v_row public.spk_inspection_checks;
begin
  if auth.uid() is null or coalesce(auth.role(),'') <> 'authenticated' then raise exception 'not allowed'; end if;
  if private.kyoritsu_is_me() then raise exception 'not allowed'; end if;
  if p_kind not in ('pre','post') or p_item is null or not ((p_kind = 'pre' and p_item = any(array['_memo','exterior','interior','fuel','washer','wiper','oil','coolant','tire_air','lights','warning','aircon','docs'])) or (p_kind = 'post' and p_item = any(array['_memo','damage','tire_tread','tire_damage','lost','dirt','fuel','warning','etc_card','key']))) then raise exception 'bad request'; end if;
  select coalesce(v1.code, v2.code), t.date, t.type into v_vc, v_date, v_type
  from public.tasks t
  left join public.vehicles v1 on v1.code = nullif(t.assigned_vehicle,'')
  left join lateral (select v.code from public.vehicles v where nullif(t.plate_no,'') is not null and v.plate_no = t.plate_no order by v.active desc nulls last limit 1) v2 on true
  where t._id = p_task and coalesce(t.deleted,false) = false
    and ((p_kind = 'pre' and t.type = '洗車') or (p_kind = 'post' and t.type in ('COL','乗捨回収','BD','BDB','返却')))
    and not (t.type = 'COL' and replace(coalesce(t.assignee,''),' ','') = '乗り捨て')   -- 乗り捨ては実際の回収＝乗捨回収タスク側で点検（二重防止）
    and t.date ~ '^\d{4}-\d{2}-\d{2}$' and t.date::date between v_today - 2 and v_today + 7;
  if v_vc is null then raise exception 'not allowed'; end if;
  v_login := 'APP:' || coalesce(nullif(split_part(coalesce(auth.jwt()->>'email',''),'@',1),''),'?');
  perform set_config('request.headers', jsonb_build_object('x-hdm-actor','staff:' || v_login)::text, true);
  insert into public.spk_inspection_checks (task_id, kind, item_key, checked, note, vehicle_code, task_date, checked_by, updated_at)
  values (p_task, p_kind, p_item, coalesce(p_checked,false), left(p_note,2000), v_vc, v_date, v_login, now())
  on conflict (task_id, kind, item_key) do update
    set checked = case when p_checked is null then public.spk_inspection_checks.checked else excluded.checked end,
        note    = case when p_note    is null then public.spk_inspection_checks.note    else excluded.note    end,
        vehicle_code = excluded.vehicle_code, task_date = excluded.task_date, checked_by = excluded.checked_by, updated_at = now()
  returning * into v_row;
  return jsonb_build_object('key', v_row.kind || ':' || v_row.item_key, 'checked', v_row.checked, 'note', v_row.note, 'by', v_row.checked_by, 'at', v_row.updated_at);
end $function$;

CREATE OR REPLACE FUNCTION public.spk_insp_set(p_token uuid, p_task text, p_kind text, p_item text, p_checked boolean, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r record; v_row public.spk_inspection_checks;
begin
  if p_kind not in ('pre','post') or not ((p_kind = 'pre' and p_item = any(array['_memo','exterior','interior','fuel','washer','wiper','oil','coolant','tire_air','lights','warning','aircon','docs'])) or (p_kind = 'post' and p_item = any(array['_memo','damage','tire_tread','tire_damage','lost','dirt','fuel','warning','etc_card','key']))) then raise exception 'bad request'; end if;
  select * into r from private.spk_insp_task(p_token, p_task);
  if r.task_id is null or r.kind <> p_kind then raise exception 'not allowed'; end if;
  perform set_config('request.headers', jsonb_build_object('x-hdm-actor','staff:' || r.staff_name)::text, true);
  insert into public.spk_inspection_checks (task_id, kind, item_key, checked, note, vehicle_code, task_date, checked_by, updated_at)
  values (r.task_id, p_kind, p_item, coalesce(p_checked,false), left(p_note,2000), r.vehicle_code, r.task_date, r.staff_name, now())
  on conflict (task_id, kind, item_key) do update
    set checked = case when p_checked is null then public.spk_inspection_checks.checked else excluded.checked end,
        note    = case when p_note    is null then public.spk_inspection_checks.note    else excluded.note    end,
        vehicle_code = excluded.vehicle_code, task_date = excluded.task_date, checked_by = excluded.checked_by, updated_at = now()
  returning * into v_row;
  return jsonb_build_object('key', v_row.kind || ':' || v_row.item_key, 'checked', v_row.checked, 'note', v_row.note, 'by', v_row.checked_by, 'at', v_row.updated_at);
end $function$;
