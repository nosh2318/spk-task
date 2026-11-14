-- 2026-11-14 nosh「２重３重で対策を　OMNI止まったらスタッフは動きを把握できなくなる」
-- 見張り omni-desk {action:"watch"} が同じ知らせを2回出さないための記録
create table if not exists public.omni_watch_sent (ref text primary key, sent_at timestamptz not null default now());
alter table public.omni_watch_sent enable row level security; -- service role だけが読む・書く
-- 5分ごとに見張りを呼ぶ（Mac mini が止まっても Supabase 側で動く）。既存の cron と同じ net.http_post の形で入れる
select cron.schedule('omni_watch', '*/5 * * * *', $$
  select net.http_post(url := 'https://ckrxttbnawkclshczsia.supabase.co/functions/v1/omni-desk',
    headers := '{"Content-Type":"application/json"}'::jsonb, body := '{"action":"watch"}'::jsonb);
$$);
-- 古い記録の掃除（7日）
select cron.schedule('omni_watch_gc', '17 4 * * *', $$ delete from public.omni_watch_sent where sent_at < now() - interval '7 days' $$);
