-- 札幌(spk) 洗車タスクの点検・タイヤチェック（オーナー指示 2026-10-16・BT procurement の点検/タイヤを横展開）
-- 書くのは staff.html（個別URL）から RPC だけ（share_token で本人特定→本人担当の洗車タスクに限る）。APP は見るだけ（authenticated select）
-- 設計メモ spk-task/docs/設計_点検タイヤ_札幌那覇横展開_2026-10-16.md ／ omni-review 条件付き（条件1〜5を反映）
begin;

create table if not exists public.spk_inspection_checks (
  task_id text not null, kind text not null check (kind in ('pre','post')),
  item_key text not null check (item_key ~ '^[_a-z0-9]{1,40}$'),
  checked boolean not null default false, note text check (note is null or length(note) <= 2000),
  vehicle_code text, task_date text, checked_by text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  id text generated always as (task_id || '|' || kind || '|' || item_key) stored,
  primary key (task_id, kind, item_key));
create table if not exists public.spk_inspection_photos (
  id uuid primary key default gen_random_uuid(), task_id text not null, kind text not null check (kind in ('pre','post')),
  vehicle_code text, task_date text, path text not null unique, uploaded_by text,
  deleted boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.spk_tire_photos (
  id uuid primary key default gen_random_uuid(), vehicle_code text not null, year integer not null, task_id text,
  path text not null unique, uploaded_by text, deleted boolean not null default false, created_at timestamptz not null default now());
create index if not exists spk_insp_photos_task on public.spk_inspection_photos(task_id);
create index if not exists spk_insp_checks_veh on public.spk_inspection_checks(vehicle_code, task_date);
create index if not exists spk_tire_photos_veh on public.spk_tire_photos(vehicle_code, year);

-- タイヤ：SPK は既存の年度別表 spk_tire_status に列を足して1つにまとめる（オーナー確定 10/16）。既存の列・行は変えない
alter table public.spk_tire_status
  add column if not exists check_status text check (check_status in ('未確認','確認済','交換','相談')),
  add column if not exists plan_date text,
  add column if not exists dest text,
  add column if not exists check_by text,
  add column if not exists check_at timestamptz,
  add column if not exists id text generated always as (vehicle_code || '|' || year::text) stored;

alter table public.spk_inspection_checks enable row level security;
alter table public.spk_inspection_photos enable row level security;
alter table public.spk_tire_photos enable row level security;
create policy kyoritsu_deny on public.spk_inspection_checks as restrictive for all to authenticated using (not (select private.kyoritsu_is_me())) with check (not (select private.kyoritsu_is_me()));
create policy kyoritsu_deny on public.spk_inspection_photos as restrictive for all to authenticated using (not (select private.kyoritsu_is_me())) with check (not (select private.kyoritsu_is_me()));
create policy kyoritsu_deny on public.spk_tire_photos as restrictive for all to authenticated using (not (select private.kyoritsu_is_me())) with check (not (select private.kyoritsu_is_me()));
create policy insp_auth_sel on public.spk_inspection_checks for select to authenticated using (true);
create policy insp_auth_sel on public.spk_inspection_photos for select to authenticated using (true);
create policy tire_ph_auth_sel on public.spk_tire_photos for select to authenticated using (true);

create trigger trg_audit_all after insert or update or delete on public.spk_inspection_checks for each row execute function public._audit_row();
create trigger trg_audit_all after insert or update or delete on public.spk_inspection_photos for each row execute function public._audit_row();
create trigger trg_audit_all after insert or update or delete on public.spk_tire_photos for each row execute function public._audit_row();
create trigger trg_audit_all after insert or update or delete on public.spk_tire_status for each row execute function public._audit_row();

-- 写真置き場（非公開・5MB・画像のみ）。anon は「uuid.拡張子」の新規アップロードだけ（読む・一覧・上書き・削除は不可）。表示は EF staff-photo が署名URLを出す
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spk-inspections','spk-inspections',false,5242880,array['image/jpeg','image/png','image/webp']),
       ('spk-tires','spk-tires',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy spk_wash_obj_anon_ins on storage.objects for insert to anon
  with check (bucket_id in ('spk-inspections','spk-tires') and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$');
create policy spk_wash_obj_auth_sel on storage.objects for select to authenticated using (bucket_id in ('spk-inspections','spk-tires'));

-- ※書込RPCの search_path は public, pg_temp（既存の監査トリガー _audit_row が audit_log / _audit_actor を接頭辞なしで呼ぶため。'' だと監査が黙って落ちる＝試行で確認）
-- 本人担当の洗車タスク（今日-2〜+7日・未削除・車両あり）だけを返す。車両は assigned_vehicle（=車両コード）を正、ナンバー一致を予備に
create or replace function private.spk_wash_task(p_token uuid, p_task text)
returns table(staff_name text, task_id text, vehicle_code text, task_date text)
language sql stable security definer set search_path = ''
as $$
  with s as (select st.name from public.staff st where st.share_token = p_token and coalesce(st.active,true) = true limit 1),
  w as (select (now() at time zone 'Asia/Tokyo')::date as today)
  select s.name, t._id, coalesce(v1.code, v2.code), t.date
  from s, w, public.tasks t
  left join public.vehicles v1 on v1.code = nullif(t.assigned_vehicle,'')
  left join lateral (select v.code from public.vehicles v where nullif(t.plate_no,'') is not null and v.plate_no = t.plate_no order by v.active desc nulls last limit 1) v2 on true
  where t._id = p_task and t.type = '洗車' and coalesce(t.deleted,false) = false
    and (replace(coalesce(t.assignee,''),' ','') = replace(s.name,' ','') or replace(coalesce(t.assignee,''),' ','') = split_part(s.name,' ',1))
    and t.date ~ '^\d{4}-\d{2}-\d{2}$' and t.date::date between w.today - 2 and w.today + 7
    and coalesce(v1.code, v2.code) is not null
$$;
revoke all on function private.spk_wash_task(uuid,text) from public, anon, authenticated;

create or replace function private.spk_fy() returns integer language sql stable set search_path = ''
as $$ select case when extract(month from (now() at time zone 'Asia/Tokyo'))::int >= 4 then extract(year from (now() at time zone 'Asia/Tokyo'))::int else extract(year from (now() at time zone 'Asia/Tokyo'))::int - 1 end $$;
revoke all on function private.spk_fy() from public, anon, authenticated;

-- ① 一覧：本人担当の洗車タスク（今日-2〜+7日）ごとのチェック・写真・その車両の今年度タイヤ
create or replace function public.spk_wash_checks(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_name text; v_fy int := private.spk_fy(); v_out jsonb;
begin
  select st.name into v_name from public.staff st where st.share_token = p_token and coalesce(st.active,true) = true limit 1;
  if v_name is null then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  with w as (select (now() at time zone 'Asia/Tokyo')::date as today),
  mine as (
    select t._id, t.date from public.tasks t, w
    where t.type = '洗車' and coalesce(t.deleted,false) = false
      and (replace(coalesce(t.assignee,''),' ','') = replace(v_name,' ','') or replace(coalesce(t.assignee,''),' ','') = split_part(v_name,' ',1))
      and t.date ~ '^\d{4}-\d{2}-\d{2}$' and t.date::date between w.today - 2 and w.today + 7),
  x as (select m._id, wt.vehicle_code, wt.task_date from mine m cross join lateral private.spk_wash_task(p_token, m._id) wt)
  select coalesce(jsonb_agg(jsonb_build_object(
      'task_id', x._id, 'task_date', x.task_date, 'vehicle_code', x.vehicle_code,
      'vehicle_name', v.name, 'plate_no', v.plate_no,
      'checks', coalesce((select jsonb_object_agg(c.kind || ':' || c.item_key, jsonb_build_object('checked',c.checked,'note',c.note,'by',c.checked_by,'at',c.updated_at))
                          from public.spk_inspection_checks c where c.task_id = x._id), '{}'::jsonb),
      'photos', coalesce((select jsonb_agg(jsonb_build_object('id',ph.id,'kind',ph.kind,'path',ph.path,'at',ph.created_at) order by ph.created_at)
                          from public.spk_inspection_photos ph where ph.task_id = x._id and not ph.deleted), '[]'::jsonb),
      'tire', (select jsonb_build_object('check_status',ts.check_status,'plan_date',ts.plan_date,'dest',ts.dest,'memo',ts.memo,'by',ts.check_by,'at',ts.check_at)
               from public.spk_tire_status ts where ts.vehicle_code = x.vehicle_code and ts.year = v_fy),
      'tire_photos', coalesce((select jsonb_agg(jsonb_build_object('id',tp.id,'path',tp.path,'at',tp.created_at) order by tp.created_at)
                          from public.spk_tire_photos tp where tp.vehicle_code = x.vehicle_code and tp.year = v_fy and not tp.deleted), '[]'::jsonb)
    ) order by x.task_date, x._id), '[]'::jsonb) into v_out
  from x left join public.vehicles v on v.code = x.vehicle_code;
  return jsonb_build_object('ok',true,'name',v_name,'year',v_fy,'tasks',v_out);
end $$;

-- ② チェック／メモを1項目だけ保存（1チェック＝1行）
create or replace function public.spk_insp_set(p_token uuid, p_task text, p_kind text, p_item text, p_checked boolean, p_note text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare r record; v_row public.spk_inspection_checks;
begin
  if p_kind not in ('pre','post') or not ((p_kind = 'pre' and p_item = any(array['_memo','exterior','interior','fuel','washer','oil','coolant','tire_air','lights','warning','aircon','docs'])) or (p_kind = 'post' and p_item = any(array['_memo','damage','tire_tread','tire_damage','lost','dirt','fuel','washer','warning','etc_card','key','mileage']))) then raise exception 'bad request'; end if;
  select * into r from private.spk_wash_task(p_token, p_task);
  if r.task_id is null then raise exception 'not allowed'; end if;
  perform set_config('request.headers', jsonb_build_object('x-hdm-actor','staff:' || r.staff_name)::text, true);
  insert into public.spk_inspection_checks (task_id, kind, item_key, checked, note, vehicle_code, task_date, checked_by, updated_at)
  values (r.task_id, p_kind, p_item, coalesce(p_checked,false), left(p_note,2000), r.vehicle_code, r.task_date, r.staff_name, now())
  on conflict (task_id, kind, item_key) do update
    set checked = case when p_checked is null then public.spk_inspection_checks.checked else excluded.checked end,
        note    = case when p_note    is null then public.spk_inspection_checks.note    else excluded.note    end,
        vehicle_code = excluded.vehicle_code, task_date = excluded.task_date, checked_by = excluded.checked_by, updated_at = now()
  returning * into v_row;
  return jsonb_build_object('key', v_row.kind || ':' || v_row.item_key, 'checked', v_row.checked, 'note', v_row.note, 'by', v_row.checked_by, 'at', v_row.updated_at);
end $$;

-- ③ 点検写真を記録（ファイルは先に spk-inspections へ uuid.拡張子 で置く。置いたファイルが実在すること）
create or replace function public.spk_insp_photo_add(p_token uuid, p_task text, p_kind text, p_path text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare r record; v_id uuid;
begin
  if p_kind not in ('pre','post') or p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' then raise exception 'bad request'; end if;
  select * into r from private.spk_wash_task(p_token, p_task);
  if r.task_id is null then raise exception 'not allowed'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'spk-inspections' and o.name = p_path) then raise exception 'file not found'; end if;
  perform set_config('request.headers', jsonb_build_object('x-hdm-actor','staff:' || r.staff_name)::text, true);
  insert into public.spk_inspection_photos (task_id, kind, vehicle_code, task_date, path, uploaded_by)
  values (r.task_id, p_kind, r.vehicle_code, r.task_date, p_path, r.staff_name) returning id into v_id;
  return jsonb_build_object('id', v_id, 'kind', p_kind, 'path', p_path, 'at', now());
end $$;

-- ④ 点検写真を外す（墓標）
create or replace function public.spk_insp_photo_del(p_token uuid, p_photo uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare r record; v_task text;
begin
  select ph.task_id into v_task from public.spk_inspection_photos ph where ph.id = p_photo and not ph.deleted;
  if v_task is null then return false; end if;
  select * into r from private.spk_wash_task(p_token, v_task);
  if r.task_id is null then raise exception 'not allowed'; end if;
  perform set_config('request.headers', jsonb_build_object('x-hdm-actor','staff:' || r.staff_name)::text, true);
  update public.spk_inspection_photos set deleted = true where id = p_photo;
  return true;
end $$;

-- ⑤ タイヤ：今年度の行の1項目だけ保存（check_status / plan_date / dest / memo）。他の列（状況・対応日・購入必要・見積もり）は触らない
create or replace function public.spk_tire_set(p_token uuid, p_task text, p_field text, p_value text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare r record; v_fy int := private.spk_fy(); v_val text := nullif(btrim(coalesce(p_value,'')),''); t public.spk_tire_status;
begin
  if p_field not in ('check_status','plan_date','dest','memo') then raise exception 'bad request'; end if;
  if p_field = 'plan_date' and v_val is not null and v_val !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'bad date'; end if;
  if (p_field = 'dest' and length(v_val) > 200) or (p_field = 'memo' and length(v_val) > 500) then raise exception 'too long'; end if;
  select * into r from private.spk_wash_task(p_token, p_task);
  if r.task_id is null then raise exception 'not allowed'; end if;
  perform set_config('request.headers', jsonb_build_object('x-hdm-actor','staff:' || r.staff_name)::text, true);
  insert into public.spk_tire_status (vehicle_code, year, updated_at) values (r.vehicle_code, v_fy, now()) on conflict (vehicle_code, year) do nothing;
  update public.spk_tire_status set
    check_status = case when p_field = 'check_status' then coalesce(v_val,'未確認') else check_status end,
    plan_date    = case when p_field = 'plan_date' then v_val else plan_date end,
    dest         = case when p_field = 'dest' then v_val else dest end,
    memo         = case when p_field = 'memo' then v_val else memo end,
    check_by = r.staff_name, check_at = now(), updated_at = now()
  where vehicle_code = r.vehicle_code and year = v_fy returning * into t;
  return jsonb_build_object('check_status',t.check_status,'plan_date',t.plan_date,'dest',t.dest,'memo',t.memo,'by',t.check_by,'at',t.check_at);
end $$;

-- ⑥ タイヤ写真を記録 ／ ⑦ 外す（墓標）
create or replace function public.spk_tire_photo_add(p_token uuid, p_task text, p_path text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare r record; v_id uuid; v_fy int := private.spk_fy();
begin
  if p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' then raise exception 'bad request'; end if;
  select * into r from private.spk_wash_task(p_token, p_task);
  if r.task_id is null then raise exception 'not allowed'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'spk-tires' and o.name = p_path) then raise exception 'file not found'; end if;
  perform set_config('request.headers', jsonb_build_object('x-hdm-actor','staff:' || r.staff_name)::text, true);
  insert into public.spk_tire_photos (vehicle_code, year, task_id, path, uploaded_by)
  values (r.vehicle_code, v_fy, r.task_id, p_path, r.staff_name) returning id into v_id;
  return jsonb_build_object('id', v_id, 'path', p_path, 'at', now());
end $$;
create or replace function public.spk_tire_photo_del(p_token uuid, p_task text, p_photo uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare r record;
begin
  select * into r from private.spk_wash_task(p_token, p_task);
  if r.task_id is null then raise exception 'not allowed'; end if;
  perform set_config('request.headers', jsonb_build_object('x-hdm-actor','staff:' || r.staff_name)::text, true);
  update public.spk_tire_photos set deleted = true where id = p_photo and vehicle_code = r.vehicle_code and not deleted;
  return found;
end $$;

-- ⑧ EF staff-photo 用：本人の洗車タスクに出ている写真パスだけ（service_role だけが呼べる）
create or replace function public.spk_wash_photo_paths(p_token uuid)
returns table(bucket text, path text) language sql stable security definer set search_path = ''
as $$
  with d as (select public.spk_wash_checks(p_token) j), t as (select jsonb_array_elements(coalesce(d.j->'tasks','[]'::jsonb)) e from d)
  select 'spk-inspections', p->>'path' from t, jsonb_array_elements(t.e->'photos') p
  union select 'spk-tires', p->>'path' from t, jsonb_array_elements(t.e->'tire_photos') p
$$;

revoke all on function public.spk_wash_checks(uuid) from public;
revoke all on function public.spk_insp_set(uuid,text,text,text,boolean,text) from public;
revoke all on function public.spk_insp_photo_add(uuid,text,text,text) from public;
revoke all on function public.spk_insp_photo_del(uuid,uuid) from public;
revoke all on function public.spk_tire_set(uuid,text,text,text) from public;
revoke all on function public.spk_tire_photo_add(uuid,text,text) from public;
revoke all on function public.spk_tire_photo_del(uuid,text,uuid) from public;
revoke all on function public.spk_wash_photo_paths(uuid) from public, anon, authenticated;
grant execute on function public.spk_wash_checks(uuid) to anon, authenticated;
grant execute on function public.spk_insp_set(uuid,text,text,text,boolean,text) to anon, authenticated;
grant execute on function public.spk_insp_photo_add(uuid,text,text,text) to anon, authenticated;
grant execute on function public.spk_insp_photo_del(uuid,uuid) to anon, authenticated;
grant execute on function public.spk_tire_set(uuid,text,text,text) to anon, authenticated;
grant execute on function public.spk_tire_photo_add(uuid,text,text) to anon, authenticated;
grant execute on function public.spk_tire_photo_del(uuid,text,uuid) to anon, authenticated;
grant execute on function public.spk_wash_photo_paths(uuid) to service_role;
commit;
-- 戻し＝spk_wash_inspection_20261016_rollback.sql
