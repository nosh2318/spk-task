-- 乗り捨て回収専用メモ（札幌）。DEL・COL引継（spk_handover_notes＝予約番号単位）とは別表・別キー。
-- キー＝乗捨回収タスクの tasks._id（例 dr-c-XXXX）。1タスク＝1メモ。削除＝墓標(deleted=true)。
begin;
create table public.spk_dropoff_notes (
  _id        text primary key,               -- 乗捨回収タスクの tasks._id
  note       text not null default '',
  staff      text,
  deleted    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()      -- 誰が書いたかは audit_log の actor/actor_id で追う
);
alter table public.spk_dropoff_notes enable row level security;
create policy auth_full_access on public.spk_dropoff_notes for all to authenticated using (true) with check (true);
create policy kyoritsu_deny on public.spk_dropoff_notes as restrictive for all to authenticated
  using (not (select private.kyoritsu_is_me())) with check (not (select private.kyoritsu_is_me()));
revoke all on public.spk_dropoff_notes from anon;
grant select, insert, update on public.spk_dropoff_notes to authenticated;
revoke delete, truncate on public.spk_dropoff_notes from authenticated;
create trigger trg_audit_all after insert or delete or update on public.spk_dropoff_notes
  for each row execute function public._audit_row();
commit;

-- 戻し方（ロールバック）：
-- drop table public.spk_dropoff_notes;   -- 新表のみ・他の表/関数は無変更
