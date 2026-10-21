-- 集客データの置き場所（main・新規のみ・既存表/関数は変更しない）
-- 設計メモ docs/設計_統合ダッシュボード_集客データ移行_2026-10-21.md §4・omni-review 条件 A〜C・G
-- 起源台帳 ORG-20261021-121749-257 ／ 戻し＝mkt_docs_20261022_rollback.sql
begin;

-- 1. 表：1ドキュメント＝1行（id = collection || '/' || doc_id ＝ audit_log.row_id）
create table public.mkt_docs(
  id text primary key,
  collection text not null,
  doc_id text not null,
  store text,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  deleted boolean not null default false,          -- 墓標（物理削除しない）
  human_keys text[] not null default '{}',        -- 人が一度でも書いたキー＝システムは以後上書き・削除しない
  updated_by text,                                 -- 'staff:<uid>' / 'system:weekly' / 'system:migration'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mkt_docs_id_chk check (id = collection || '/' || doc_id),
  constraint mkt_docs_col_chk check (collection in
    ('runs','groups','keywords','seeds','actions','pdca','goals','log','summaries','ads','adsdaily','asks'))
);
create index mkt_docs_collection_idx on public.mkt_docs(collection) where not deleted;
create trigger trg_audit_all after insert or delete or update on public.mkt_docs
  for each row execute function public._audit_row();

-- 直接は誰も触れない（RLS 有効・ポリシー無し）。読み書きは下の関数だけ
revoke all on public.mkt_docs from public, anon, authenticated;
alter table public.mkt_docs enable row level security;

-- 2. 読む：ログインしたスタッフ（協力会社アカウントは不可）
create or replace function public.mkt_read(p_collections text[] default null)
returns table(collection text, doc_id text, store text, data jsonb, version int, updated_at timestamptz)
language plpgsql stable security definer set search_path to '' as $$
begin
  if auth.role() <> 'service_role' then
    if auth.uid() is null or (select private.kyoritsu_is_me()) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;
  return query
    select d.collection, d.doc_id, d.store, d.data, d.version, d.updated_at
    from public.mkt_docs d
    where not d.deleted and (p_collections is null or d.collection = any(p_collections))
    order by d.collection, d.doc_id;
end $$;
revoke all on function public.mkt_read(text[]) from public, anon;
grant execute on function public.mkt_read(text[]) to authenticated, service_role;

-- 3. スタッフの判断を書く：コレクションごとの判断キーだけ・1件ずつ・版が違えば書かない
--    *_at / *_by は関数が付ける（画面からは受け付けない）
create or replace function public.mkt_staff_update(
  p_collection text, p_doc_id text, p_patch jsonb, p_if_version int)
returns int
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_allowed text[];
  v_row public.mkt_docs%rowtype;
  v_key text;
  v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_add jsonb := '{}'::jsonb;
begin
  if v_uid is null or (select private.kyoritsu_is_me()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'empty_patch' using errcode = '22023';
  end if;
  v_allowed := case p_collection
    when 'keywords' then array['decision']
    when 'groups'   then array['status','reason']
    when 'actions'  then array['status']
    when 'seeds'    then array['active','proposed']
    when 'goals'    then array['target','deadline','tentative']
    when 'pdca'     then array['approved','stage','verdict','wait_done']
    when 'asks'     then array['status']
    else null end;
  if v_allowed is null then
    raise exception 'collection_not_editable: %', p_collection using errcode = '42501';
  end if;
  if p_collection = 'pdca' and p_patch ? 'stage' and coalesce(p_patch->>'verdict', '') <> 'skip' then
    raise exception 'key_not_allowed: pdca.stage（見送りの時だけ）' using errcode = '42501';
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key = any(v_allowed)) then
      raise exception 'key_not_allowed: %.%', p_collection, v_key using errcode = '42501';
    end if;
  end loop;

  select * into v_row from public.mkt_docs
   where id = p_collection || '/' || p_doc_id and not deleted for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v_row.version <> p_if_version then
    raise exception 'version_conflict: %', v_row.version using errcode = 'P0001';
  end if;

  -- 足跡（画面がこれまで書いていた *_at / *_by と同じ名前）
  v_add := case p_collection
    when 'keywords' then jsonb_build_object('decided_at', v_now, 'decided_by', v_uid::text)
    when 'groups'   then jsonb_build_object('decided_at', v_now, 'decided_by', v_uid::text)
    when 'actions'  then jsonb_build_object(coalesce(p_patch->>'status','status') || '_at', v_now, 'decided_by', v_uid::text)
    when 'goals'    then jsonb_build_object('updated_at', v_now, 'updated_by', v_uid::text)
    when 'asks'     then jsonb_build_object('done_at', v_now, 'done_by', v_uid::text)
    when 'pdca' then
      case when p_patch ? 'approved' then jsonb_build_object('approved_at', v_now, 'approved_by', v_uid::text)
           when p_patch->>'verdict' = 'skip' then jsonb_build_object('skipped_by', v_uid::text,
                'a', jsonb_build_object('next', '見送り（' || to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM-DD') || '）'))
           when p_patch ? 'wait_done' then jsonb_build_object('wait_done_at', v_now, 'done_by', v_uid::text)
           else '{}'::jsonb end
    else '{}'::jsonb end;

  update public.mkt_docs set
    data = data || p_patch || v_add,
    human_keys = (select array(select distinct k from unnest(human_keys || array(select jsonb_object_keys(p_patch)) || array(select jsonb_object_keys(v_add))) k)),
    version = version + 1,
    updated_by = 'staff:' || v_uid::text,
    updated_at = now()
  where id = v_row.id;
  return v_row.version + 1;
end $$;
revoke all on function public.mkt_staff_update(text, text, jsonb, int) from public, anon;
grant execute on function public.mkt_staff_update(text, text, jsonb, int) to authenticated;

-- 4. スタッフが起点ワードを1件足す（seeds の新規だけ）
create or replace function public.mkt_staff_add_seed(p_store text, p_word text, p_chan text default 'search', p_role text default null)
returns text
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_word text := btrim(regexp_replace(coalesce(p_word, ''), '\s+', ' ', 'g'));
  v_doc text;
  v_data jsonb;
begin
  if v_uid is null or (select private.kyoritsu_is_me()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_store not in ('naha', 'sapporo', 'takamatsu') or v_word = '' or length(v_word) > 100 then
    raise exception 'bad_input' using errcode = '22023';
  end if;
  if exists (select 1 from public.mkt_docs d where d.collection = 'seeds' and not d.deleted
             and d.store = p_store and d.data->>'word' = v_word
             and coalesce(d.data->>'chan', 'search') = coalesce(p_chan, 'search')
             and coalesce(d.data->>'role', '') = coalesce(p_role, '')) then
    raise exception 'already_exists' using errcode = '23505';
  end if;
  v_doc := 's_' || replace(gen_random_uuid()::text, '-', '');
  v_data := jsonb_build_object('store', p_store, 'word', v_word, 'active', true, 'chan', coalesce(p_chan, 'search'),
            'added_by', v_uid::text, 'added_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  if p_role is not null then
    v_data := v_data || jsonb_build_object('role', p_role, 'label', regexp_replace(v_word, '^\S+\s', ''));
  end if;
  insert into public.mkt_docs(id, collection, doc_id, store, data, human_keys, updated_by)
  values ('seeds/' || v_doc, 'seeds', v_doc, p_store, v_data, array['active', 'word'], 'staff:' || v_uid::text);
  return v_doc;
end $$;
revoke all on function public.mkt_staff_add_seed(text, text, text, text) from public, anon;
grant execute on function public.mkt_staff_add_seed(text, text, text, text) to authenticated;

-- 5. システム（週1の集計）が書く：service_role のみ。人の書いたキーは上書きも削除もしない
--    auth.role() が NULL（SQL Editor・pg_cron）でも通る＝初回取込を SQL Editor から行える（意図した仕様）
--    p_rows = [{collection, doc_id, store?, data:{...}, remove_keys?:[...], deleted?:true}]  1行ずつマージ
create or replace function public.mkt_system_upsert(p_rows jsonb, p_actor text default 'system:weekly')
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  r jsonb;
  v_id text;
  v_row public.mkt_docs%rowtype;
  v_data jsonb;
  v_rm text;
  n_ins int := 0; n_upd int := 0; n_skip_keys int := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows_must_be_array' using errcode = '22023'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_id := (r->>'collection') || '/' || (r->>'doc_id');
    v_data := coalesce(r->'data', '{}'::jsonb);
    if jsonb_typeof(v_data) <> 'object' then raise exception 'data_must_be_object: %', v_id using errcode = '22023'; end if;
    select * into v_row from public.mkt_docs where id = v_id for update;
    if not found then
      insert into public.mkt_docs(id, collection, doc_id, store, data, updated_by)
      values (v_id, r->>'collection', r->>'doc_id', r->>'store', v_data, p_actor);
      n_ins := n_ins + 1;
    else
      -- 人の書いたキーは捨てる
      n_skip_keys := n_skip_keys + (select count(*) from jsonb_object_keys(v_data) k where k = any(v_row.human_keys));
      v_data := v_data - v_row.human_keys;
      v_row.data := v_row.data || v_data;
      for v_rm in select jsonb_array_elements_text(coalesce(r->'remove_keys', '[]'::jsonb)) loop
        if not (v_rm = any(v_row.human_keys)) then v_row.data := v_row.data - v_rm; end if;
      end loop;
      update public.mkt_docs set data = v_row.data, store = coalesce(r->>'store', store),
        deleted = coalesce((r->>'deleted')::boolean, v_row.deleted),   -- 墓標は deleted:true／復活は deleted:false を明示した時だけ
        version = version + 1, updated_by = p_actor, updated_at = now()
      where id = v_id;
      n_upd := n_upd + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', n_ins, 'updated', n_upd, 'skipped_human_keys', n_skip_keys);
end $$;
revoke all on function public.mkt_system_upsert(jsonb, text) from public, anon, authenticated;
grant execute on function public.mkt_system_upsert(jsonb, text) to service_role;

commit;
