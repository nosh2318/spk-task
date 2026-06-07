-- 協力会社 請求書格納（2026-06-07）メインDB SQL Editor で1回RUN
-- ① ファイルメタ情報テーブル
create table if not exists partner_invoice_files (
  id uuid primary key default gen_random_uuid(),
  owner_company text not null,
  year_month text not null,          -- 対象月 "2026-06"
  vehicle_code text default '',      -- 車両（空=共通/全体請求）
  file_path text not null,           -- storage上のパス
  file_name text not null,
  mime text default '',
  size_bytes bigint default 0,
  note text default '',
  uploaded_by text default '',
  confirmed_at timestamptz,          -- 弊社(HANDYMAN)が閲覧確認した日時
  confirmed_by text default '',      -- 確認者
  created_at timestamptz default now()
);
alter table partner_invoice_files enable row level security;
create policy "auth_all_pif" on partner_invoice_files for all to authenticated using (true) with check (true);
grant select, insert, update, delete on partner_invoice_files to authenticated;

-- ② Storageバケット（非公開）
insert into storage.buckets (id, name, public) values ('partner-invoices','partner-invoices', false)
on conflict (id) do nothing;

-- ③ Storageポリシー（authenticatedのみ読み書き）
create policy "auth_read_partner_invoices" on storage.objects for select to authenticated
  using (bucket_id = 'partner-invoices');
create policy "auth_insert_partner_invoices" on storage.objects for insert to authenticated
  with check (bucket_id = 'partner-invoices');
create policy "auth_delete_partner_invoices" on storage.objects for delete to authenticated
  using (bucket_id = 'partner-invoices');
