-- Asana風タスク管理ツール 専用テーブル（ログイン不要＝anon read/write）
-- 既存の *_todo_tasks（認証必須）とは分離。アプリ内タスクと混ざらない。
-- Supabase SQL Editor（プロジェクト ckrxttbnawkclshczsia）で1回RUN。

create table if not exists public.asana_tasks (
  id text primary key,
  store text default 'spk',
  area text, title text, requester text, assignee text, parent_id text,
  priority text default '中', status text default 'consult', progress integer default 0,
  start_date text, due_date text, description text default '',
  logs jsonb default '[]'::jsonb, attachments jsonb default '[]'::jsonb,
  admin_confirmed boolean default false, completed_at text, created_at text,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.asana_tasks enable row level security;
drop policy if exists asana_tasks_anon on public.asana_tasks;
create policy asana_tasks_anon on public.asana_tasks
  for all to anon, authenticated using(true) with check(true);

grant select, insert, update on public.asana_tasks to anon, authenticated;

-- リアルタイム配信（任意・自動更新用）
alter publication supabase_realtime add table public.asana_tasks;

-- 確認: select count(*) from public.asana_tasks;
