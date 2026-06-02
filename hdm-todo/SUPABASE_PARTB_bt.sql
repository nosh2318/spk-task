-- BUDDICA(高松) bt_todo_* 作成 — ggqugvyskyiblxiycpci の SQL Editor で実行
-- PART B —— ggqugvyskyiblxiycpci（BUDDICA 高松・独立DB）で実行
-- ============================================================
create table if not exists public.bt_todo_tasks (
  id text primary key, area text, title text, assignee text, parent_id text,
  priority text default '中', status text default '未着手', progress integer default 0,
  start_date text, due_date text, description text default '',
  logs jsonb default '[]'::jsonb, attachments jsonb default '[]'::jsonb,
  admin_confirmed boolean default false, completed_at text, created_at text,
  deleted boolean not null default false, updated_at timestamptz not null default now());
create table if not exists public.bt_todo_meta (
  id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
alter table public.bt_todo_tasks enable row level security;
alter table public.bt_todo_meta  enable row level security;
drop policy if exists bt_todo_tasks_auth on public.bt_todo_tasks;
create policy bt_todo_tasks_auth on public.bt_todo_tasks for all to authenticated using(true) with check(true);
drop policy if exists bt_todo_meta_auth on public.bt_todo_meta;
create policy bt_todo_meta_auth on public.bt_todo_meta for all to authenticated using(true) with check(true);
grant select, insert, update on public.bt_todo_tasks, public.bt_todo_meta to authenticated;
alter publication supabase_realtime add table public.bt_todo_tasks;
alter publication supabase_realtime add table public.bt_todo_meta;
