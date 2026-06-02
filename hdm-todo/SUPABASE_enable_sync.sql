-- HDM ToDo 共有編集を有効化する（Supabase → SQL Editor に貼って RUN するだけ）
-- 専用テーブル1つ・他テーブルには一切影響しません。
create table if not exists public.hdm_todo (
  id          text primary key,
  data        jsonb        not null default '{}'::jsonb,
  rev         integer      not null default 0,
  updated_at  timestamptz  not null default now()
);
alter table public.hdm_todo enable row level security;
drop policy if exists hdm_todo_anon_all on public.hdm_todo;
create policy hdm_todo_anon_all on public.hdm_todo
  for all to anon using (true) with check (true);
grant select, insert, update on public.hdm_todo to anon;
insert into public.hdm_todo (id, data, rev)
  values ('main', '{}'::jsonb, 0)
  on conflict (id) do nothing;
