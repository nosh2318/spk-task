-- 戻し 段階1（無害化）：関数・ポリシー・トリガーを外す。表と写真は残す（人の入力＝消さない）。staff.html・APP の該当コミットも同時に revert
begin;
drop function if exists public.spk_wash_photo_paths(uuid);
drop function if exists public.spk_tire_photo_del(uuid,text,uuid);
drop function if exists public.spk_tire_photo_add(uuid,text,text);
drop function if exists public.spk_tire_set(uuid,text,text,text);
drop function if exists public.spk_insp_photo_del(uuid,uuid);
drop function if exists public.spk_insp_photo_add(uuid,text,text,text);
drop function if exists public.spk_insp_set(uuid,text,text,text,boolean,text);
drop function if exists public.spk_wash_checks(uuid);
drop function if exists private.spk_wash_task(uuid,text);
drop function if exists private.spk_fy();
drop policy if exists spk_wash_obj_anon_ins on storage.objects;
drop policy if exists spk_wash_obj_auth_sel on storage.objects;
drop trigger if exists trg_audit_all on public.spk_tire_status;
alter table public.spk_tire_status drop column if exists id;
-- 足した列（check_status/plan_date/dest/check_by/check_at）は人の入力が入り得るので残す（段階2で退避後に drop）
commit;
-- 段階2（オーナー指示がある時だけ）：4表を CSV 退避 → drop table public.spk_inspection_checks, public.spk_inspection_photos, public.spk_tire_photos;
-- bucket spk-inspections / spk-tires は空の時だけ削除
