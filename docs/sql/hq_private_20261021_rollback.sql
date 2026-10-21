-- 戻し（新規物のみ削除。audit_log の行は消さない＝ハッシュ連鎖）
begin;
drop table if exists public.hq_issued_invoices, public.hq_card_snapshots, public.hq_card_overrides, public.hq_settings;
drop function if exists public.hq_touch();
drop function if exists private.hq_is_me();
drop table if exists private.hq_members;
commit;
