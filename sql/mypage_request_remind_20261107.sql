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

-- 高松（buddica-tourism ワークスペース）向け：Vault のボットトークンで pg_net 送信（本番適用済）
create or replace function public.mpremind_slack_post_buddica(p_channel text, p_text text)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare _tok text := private.slack_bot_token('slack_bot_token_buddica');
begin
  if _tok is null or p_channel is null or p_text is null then return null; end if;
  return net.http_post(url := 'https://slack.com/api/chat.postMessage',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||_tok),
    body := jsonb_build_object('channel', p_channel, 'text', p_text));
end $$;
revoke all on function public.mpremind_slack_post_buddica(text,text) from public, anon, authenticated;
grant execute on function public.mpremind_slack_post_buddica(text,text) to service_role;
