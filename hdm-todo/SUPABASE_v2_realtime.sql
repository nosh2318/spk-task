-- ============================================================
-- タスク管理タブ（本体APP統合版）: 店舗別テーブル + per-entity + Realtime
--   方針: NHA本体/SPK本体/BT本体に各1タブとしてネイティブ実装
--   ・1行=1タスク（別タスクの同時編集は衝突しない）/ goals・staffは小ドキュメント行
--   ・anon開放は廃止 → authenticated（本体APPログイン）のみ読み書き可
--   ・Realtime で即時反映
--
--   ★RUNは2回（プロジェクトが別）★
--    【A】NHA+SPK = ckrxttbnawkclshczsia の SQL Editor で「PART A」を実行
--    【B】BT      = ggqugvyskyiblxiycpci の SQL Editor で「PART B」を実行
-- ============================================================

-- 共通テンプレ（参考）: 各店 *_todo_tasks / *_todo_meta を作る
--   tasks 列: id,area,title,assignee,parent_id,priority,status,progress,
--             start_date,due_date,description,logs,attachments,
--             admin_confirmed,completed_at,created_at,deleted,updated_at

-- ============================================================
-- PART A —— ckrxttbnawkclshczsia（NHA+SPK 共有DB）で実行
-- ============================================================
create table if not exists public.nha_todo_tasks (
  id text primary key, area text, title text, assignee text, parent_id text,
  priority text default '中', status text default '未着手', progress integer default 0,
  start_date text, due_date text, description text default '',
  logs jsonb default '[]'::jsonb, attachments jsonb default '[]'::jsonb,
  admin_confirmed boolean default false, completed_at text, created_at text,
  deleted boolean not null default false, updated_at timestamptz not null default now());
create table if not exists public.nha_todo_meta (
  id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
create table if not exists public.spk_todo_tasks (
  id text primary key, area text, title text, assignee text, parent_id text,
  priority text default '中', status text default '未着手', progress integer default 0,
  start_date text, due_date text, description text default '',
  logs jsonb default '[]'::jsonb, attachments jsonb default '[]'::jsonb,
  admin_confirmed boolean default false, completed_at text, created_at text,
  deleted boolean not null default false, updated_at timestamptz not null default now());
create table if not exists public.spk_todo_meta (
  id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());

alter table public.nha_todo_tasks enable row level security;
alter table public.nha_todo_meta  enable row level security;
alter table public.spk_todo_tasks enable row level security;
alter table public.spk_todo_meta  enable row level security;
drop policy if exists nha_todo_tasks_auth on public.nha_todo_tasks;
create policy nha_todo_tasks_auth on public.nha_todo_tasks for all to authenticated using(true) with check(true);
drop policy if exists nha_todo_meta_auth on public.nha_todo_meta;
create policy nha_todo_meta_auth on public.nha_todo_meta for all to authenticated using(true) with check(true);
drop policy if exists spk_todo_tasks_auth on public.spk_todo_tasks;
create policy spk_todo_tasks_auth on public.spk_todo_tasks for all to authenticated using(true) with check(true);
drop policy if exists spk_todo_meta_auth on public.spk_todo_meta;
create policy spk_todo_meta_auth on public.spk_todo_meta for all to authenticated using(true) with check(true);
grant select, insert, update on public.nha_todo_tasks, public.nha_todo_meta to authenticated;
grant select, insert, update on public.spk_todo_tasks, public.spk_todo_meta to authenticated;
alter publication supabase_realtime add table public.nha_todo_tasks;
alter publication supabase_realtime add table public.nha_todo_meta;
alter publication supabase_realtime add table public.spk_todo_tasks;
alter publication supabase_realtime add table public.spk_todo_meta;

-- ============================================================
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
