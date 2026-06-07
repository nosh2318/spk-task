-- 入庫の時刻対応（2026-06-07）メインDB SQL Editor で1回RUN
alter table maintenance add column if not exists start_time text; -- 入庫時刻 "10:00"（任意）
alter table maintenance add column if not exists end_time text;   -- 出庫時刻（任意）
