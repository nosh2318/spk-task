-- 2026-11-05 札幌：出発前点検「やり方」に写真・動画（追加のみ・既存の表/関数/バケットは触らない）
-- 影響元：新表 public.spk_insp_howto_media と新バケット spk-howto-media だけ。書くのは札幌 APP（insp-howto-media.js）だけ。
-- 読むのも同ファイルだけ。既存の spk_inspection_checks / insp-howto.js / staff.html / GAS / cron / EF には触れない。

begin;

create table public.spk_insp_howto_media(
  id uuid primary key default gen_random_uuid(),
  item_key text not null check (item_key in ('exterior','interior','fuel','washer','oil','coolant','tire_air','lights','warning','aircon','docs')),
  media_type text not null check (media_type in ('image','video')),
  path text not null unique,
  mime text,
  caption text check (caption is null or char_length(caption) <= 200),
  created_by uuid not null default auth.uid(),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  deleted_at timestamptz
);
create index spk_insp_howto_media_item on public.spk_insp_howto_media(item_key, created_at) where not deleted;

-- 登録者・時刻はサーバーで決める（なりすまし防止）。更新で変えてよいのは caption と deleted だけ（列 GRANT でも制限）。
create or replace function public._spk_insp_howto_media_guard() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_by_name := nullif(split_part(coalesce(auth.jwt()->>'email',''),'@',1),'');
    new.created_at := now(); new.updated_at := now();
    new.deleted := false; new.deleted_at := null;
    if new.created_by is null or new.path not like new.created_by::text || '/' || new.item_key || '/%' then
      raise exception 'not allowed';
    end if;
  else
    new.id := old.id; new.item_key := old.item_key; new.media_type := old.media_type; new.path := old.path; new.mime := old.mime;
    new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at;
    new.updated_at := now();
    if old.deleted then raise exception 'deleted'; end if;        -- 墓標は戻さない
    new.deleted_at := case when new.deleted then now() else null end;
  end if;
  return new;
end $$;
create trigger trg_spk_insp_howto_media_guard before insert or update on public.spk_insp_howto_media
  for each row execute function public._spk_insp_howto_media_guard();
create trigger trg_audit_all after insert or update or delete on public.spk_insp_howto_media
  for each row execute function public._audit_row();

alter table public.spk_insp_howto_media enable row level security;
revoke all on public.spk_insp_howto_media from anon, authenticated;
grant select, insert on public.spk_insp_howto_media to authenticated;
grant update (caption, deleted) on public.spk_insp_howto_media to authenticated;

create policy ihm_sel on public.spk_insp_howto_media for select to authenticated using (true);
create policy ihm_ins on public.spk_insp_howto_media for insert to authenticated with check (created_by = auth.uid());
create policy ihm_upd on public.spk_insp_howto_media for update to authenticated
  using (created_by = auth.uid() and not deleted) with check (created_by = auth.uid());
-- delete のポリシーは作らない（物理削除しない・墓標のみ）
create policy kyoritsu_deny on public.spk_insp_howto_media as restrictive for all to authenticated
  using (not (select private.kyoritsu_is_me())) with check (not (select private.kyoritsu_is_me()));

-- 非公開バケット（50MB・写真と動画だけ）
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('spk-howto-media','spk-howto-media', false, 52428800,
        array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']);

create policy spk_howto_media_sel on storage.objects for select to authenticated
  using (bucket_id = 'spk-howto-media' and not (select private.kyoritsu_is_me()));
create policy spk_howto_media_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'spk-howto-media' and (storage.foldername(name))[1] = auth.uid()::text and not (select private.kyoritsu_is_me()));
-- update / delete のポリシーは作らない（上書き・物理削除させない）

commit;

-- 戻し方（未使用なら）：
-- begin;
-- drop policy spk_howto_media_sel on storage.objects; drop policy spk_howto_media_ins on storage.objects;
-- drop table public.spk_insp_howto_media; drop function public._spk_insp_howto_media_guard();
-- （バケットは中身があれば残す。空なら delete from storage.buckets where id='spk-howto-media';）
-- commit;
-- 画面側だけ止める場合：index.src.html の insp-howto-media.js の1行を外して再ビルド（DB は残っても害なし）。
