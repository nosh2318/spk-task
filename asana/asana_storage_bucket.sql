-- asana タスク管理：説明・コメントの画像添付用 Storageバケット
-- ✅ 2026-06-17 に Management API 経由で本番(ckrxttbnawkclshczsia)へ適用済み
--    （バケット作成＋下記ポリシー＋認証/anonアップロード＋公開読取を検証済）。
--    このファイルは再現・別環境用の保存。再RUNは冪等で安全。
-- 社内専用ツールのため anon+authenticated 双方に許可（asana_tasks の RLS と同方針）

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('asana-attachments','asana-attachments', true, 10485760,
        array['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/heic'])
on conflict (id) do update
  set public=excluded.public,
      file_size_limit=excluded.file_size_limit,
      allowed_mime_types=excluded.allowed_mime_types;

-- 読み取り（公開）
drop policy if exists "asana_att_read" on storage.objects;
create policy "asana_att_read" on storage.objects
  for select using (bucket_id='asana-attachments');

-- アップロード
drop policy if exists "asana_att_insert" on storage.objects;
create policy "asana_att_insert" on storage.objects
  for insert with check (bucket_id='asana-attachments');

-- 更新（x-upsert対応）
drop policy if exists "asana_att_update" on storage.objects;
create policy "asana_att_update" on storage.objects
  for update using (bucket_id='asana-attachments');

-- 削除
drop policy if exists "asana_att_delete" on storage.objects;
create policy "asana_att_delete" on storage.objects
  for delete using (bucket_id='asana-attachments');
