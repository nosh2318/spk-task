-- ★2026-11-15 nosh「スレッドにスタッフが返信し完結できる手段がほしい」
--   店の部屋のオムニのカード（【店｜依頼に返事…】）に社員がスレッドで返信 → omni-desk（action=thread）が1分ごとに読み、承認・お断り・別の案まで決める。
--   決められるのは omni_slack_staff の社員だけ。誰が何を返したかは omni_slack_replies に残す。

-- 決めてよい人（Slack の人 → 名前）。ws＝H（HANDYMAN の Slack：札幌・那覇）／B（BUDDICA の Slack：高松）
create table if not exists public.omni_slack_staff (
  ws text not null check (ws in ('H','B')),
  slack_user text not null,
  name text not null,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  primary key (ws, slack_user)
);
alter table public.omni_slack_staff enable row level security;  -- サービスキーだけ

-- HANDYMAN の Slack の正社員（staff / nha_staff の type=正社員 と、店の部屋のメンバーの名前で突き合わせ 11/15）
insert into public.omni_slack_staff (ws, slack_user, name, note) values
  ('H','U06KG1P75FC','大下','oshita'),
  ('H','U06KYV2PE5P','齋藤','saito'),
  ('H','U06KFUHM20K','武山','takeyama'),
  ('H','U078CJSUX5L','伊江','伊江 芙美子'),
  ('H','U08SL1ZKB8U','廣瀬','Hirose')
on conflict (ws, slack_user) do nothing;
-- 高松（BUDDICA の Slack）は nosh に確かめてから入れる：
-- insert into public.omni_slack_staff (ws, slack_user, name) values ('B','U0BF…','名前');

-- オムニのカード1枚＝1行（読んだところ・聞き返し中の案）
create table if not exists public.omni_slack_threads (
  channel text not null,
  ts text not null,
  store text not null,
  reservation_id text not null,
  seen_reply text,            -- ここまで読んだ返信の ts
  pending jsonb,              -- 聞き返し中の案（「はい」で実行）
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel, ts)
);
alter table public.omni_slack_threads enable row level security;

-- 返信1件＝1行（同じ返信を二度処理しない・誰が返したかの記録）
create table if not exists public.omni_slack_replies (
  channel text not null,
  reply_key text not null,    -- 返信の ts（リアクションは「カードts:r:人」）
  thread_ts text not null,
  store text not null,
  reservation_id text,
  slack_user text,
  name text,
  is_staff boolean not null default false,
  text text,
  action text,                -- yes / no / free / react / not_staff / …
  result text,
  created_at timestamptz not null default now(),
  primary key (channel, reply_key)
);
alter table public.omni_slack_replies enable row level security;
create index if not exists omni_slack_replies_thread on public.omni_slack_replies (channel, thread_ts);

-- 1分ごと（Supabase の cron から。Mac mini が止まっても動く）
insert into private.cron_jobs (job, orig_command) values ('omni_thread', $c$
  select net.http_post(url := 'https://ckrxttbnawkclshczsia.supabase.co/functions/v1/omni-desk',
    headers := '{"Content-Type":"application/json"}'::jsonb, body := '{"action":"thread"}'::jsonb);
$c$) on conflict (job) do update set orig_command = excluded.orig_command;
select cron.schedule('omni_thread', '* * * * *', $$select private.cron_call('omni_thread')$$);
