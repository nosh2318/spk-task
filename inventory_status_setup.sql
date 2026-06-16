-- 在庫管理 対応状況テーブル（札幌SPK）2026-06-16
-- 予約ごとに「在庫調整 / APP取込 / メール送信」の完了状態を全端末で共有する
create table if not exists public.spk_inventory_status (
  id            text primary key,          -- 予約番号（reservations.id）
  stock_adjusted boolean not null default false,  -- a. 在庫調整（手動）
  app_imported  boolean not null default true,    -- b. APP取込（自動=DBに入っている）
  mail_sent     boolean not null default true,    -- c. メール送信（楽天のみ手動→false起点）
  updated_by    text,
  updated_at    timestamptz not null default now()
);

-- 更新時刻 自動更新
create or replace function public.spk_inv_touch() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_spk_inv_touch on public.spk_inventory_status;
create trigger trg_spk_inv_touch before update on public.spk_inventory_status
  for each row execute function public.spk_inv_touch();

-- RLS（ログイン済みユーザーのみ全操作可）
alter table public.spk_inventory_status enable row level security;
drop policy if exists spk_inv_all on public.spk_inventory_status;
create policy spk_inv_all on public.spk_inventory_status for all to authenticated using (true) with check (true);

-- リアルタイム配信
alter publication supabase_realtime add table public.spk_inventory_status;
