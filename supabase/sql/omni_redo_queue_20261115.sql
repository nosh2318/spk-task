-- ★2026-11-15 nosh「承認され依頼を承認したんだったら全部承認してあげてよ」：エラーで止まった承認を、承認した人の名前で通す待ち行列。
--   サービスロールだけが入れられる（RLS・ポリシーなし）。omni-desk の毎分の thread で処理し、done_at・result を書く。
create table if not exists public.omni_redo_queue (
  id bigserial primary key,
  store text not null check (store in ('spk','nha')),
  change_id bigint not null,
  actor_name text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.omni_redo_queue enable row level security;
-- 11/15 8:52〜 札幌で日本語の承認者名のヘッダーで止まった4件（三國さん）
insert into public.omni_redo_queue (store, change_id, actor_name)
select 'spk', x, '三國' from unnest(array[1732,1733,1734,1735]) x
where exists (select 1 from public.mypage_changes c where c.id = x and c.status = 'requested')
  and not exists (select 1 from public.omni_redo_queue q where q.change_id = x);
