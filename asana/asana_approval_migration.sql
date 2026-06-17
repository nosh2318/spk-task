-- Asana風タスク管理：承認フラグ機能 用の列追加
-- Supabase SQL Editor（プロジェクト ckrxttbnawkclshczsia）で1回RUN。
-- approval = {required:bool, state:'pending'|'approved'|'rejected', by, at, decided_by, decided_at}
alter table public.asana_tasks add column if not exists approval jsonb default '{}'::jsonb;

-- 確認: select id,title,approval from public.asana_tasks where approval->>'required'='true';
