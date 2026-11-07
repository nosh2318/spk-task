-- 依頼が未処理のまま 30分・90分経過で Slack 再通知（EF mypage-request-remind）
create table if not exists public.mypage_request_reminders(
  bucket text not null,
  change_id text not null,
  stage int not null default 1,
  reminded_at timestamptz not null default now(),
  primary key(bucket, change_id, stage)
);
alter table public.mypage_request_reminders enable row level security;
-- 5分ごとに起動（他の cron と同じ x-cron-secret 方式。値は既存ジョブと同じものを入れる）
-- select cron.schedule('mypage-request-remind','*/5 * * * *',
--   $$select net.http_post(url:='https://ckrxttbnawkclshczsia.supabase.co/functions/v1/mypage-request-remind',
--     headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'), body:='{}'::jsonb)$$);
