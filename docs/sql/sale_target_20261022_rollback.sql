-- 売却目安の戻し（2026-10-22）
begin;
drop table if exists public.hq_vehicle_sale_targets;
drop function if exists public.hq_is_me();
commit;
-- RPC は docs/sql/mileage_20261022_main.sql（main）／mileage_20261022_bt.sql（BT）を再実行して code なし版に戻す（任意・code 追加は後方互換）
