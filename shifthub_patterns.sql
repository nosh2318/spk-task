-- shift-hub パターン保存（チーム共有・固定スナップショット）
-- projA: ckrxttbnawkclshczsia（NHA/SPK/BT のシフトを1パターンにまとめて保存）
create table if not exists shifthub_patterns (
  id          bigint generated always as identity primary key,
  name        text not null,            -- 例: パターン1
  data        jsonb not null,           -- その時点の全店 staff/shifts/simCfg を丸ごと
  note        text,                     -- 任意メモ
  created_by  text,                     -- 保存者名
  created_at  timestamptz default now()
);
alter table shifthub_patterns enable row level security;
drop policy if exists shifthub_patterns_all on shifthub_patterns;
create policy shifthub_patterns_all on shifthub_patterns
  for all to anon, authenticated using (true) with check (true);
grant all on shifthub_patterns to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
