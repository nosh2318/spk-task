-- 通知メールの開封・クリックの記録（main ckrxttbnawkclshczsia）2026-11-09
-- 追加だけ。既存の表・予約・タスクには触らない。
create table if not exists public.mail_track_events (
  id bigserial primary key,
  mid text not null,
  ev text not null check (ev in ('open','click')),
  store text, kind text, resv_no text,
  url text, ua text,
  created_at timestamptz not null default now()
);
create index if not exists mail_track_events_store_kind on public.mail_track_events (store, kind, created_at);
create index if not exists mail_track_events_resv on public.mail_track_events (resv_no);
alter table public.mail_track_events enable row level security;  -- ポリシーなし＝service_role だけ読み書き
revoke all on public.mail_track_events from anon, authenticated;
