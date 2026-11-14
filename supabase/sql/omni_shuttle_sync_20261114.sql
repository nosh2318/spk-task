-- 札幌：チャットの返事どおり予約を変えた時（omni-desk chat_apply）、送迎タスク（s-d-／s-c-）も同じ時間・場所にそろえる
-- （2026-11-14 nosh「情報乖離の防止は必須」）。送迎タスクは予約番号を持たず、元のお届け・回収タスクの値の写しなので、
-- 承認の反映（spk_apply_mypage_change）では変わらず、古い時間・場所のまま残っていた。
-- 変えるのは「送迎タスクの値が変更前の値と同じ」時だけ（人がわざと別の値にしていたら触らず 'custom' を返す＝人が確認）。
-- 変えた後に読み直し、元のタスクの実際の値（spk_task_eff_*）と同じかを確かめる。a1_hdm_rule は理由つきの bypass（hdm_rule_log に残る）。
create or replace function public.omni_shuttle_sync(p_rid text, p_kind text, p_field text, p_old text, p_actor text)
returns text language plpgsql security definer set search_path = public as $$
declare s tasks; p tasks; r reservations; nv text; cur text;
begin
  if p_kind not in ('d','c') or p_field not in ('time','place') or coalesce(p_rid,'') = '' then return 'bad'; end if;
  select * into s from tasks where _id = 's-' || p_kind || '-' || p_rid and deleted is not true;
  if not found then return 'none'; end if;
  select * into p from tasks where _id = p_kind || '-' || p_rid and deleted is not true;
  select * into r from reservations where id = p_rid;
  if p._id is null or r.id is null then return 'bad'; end if;
  nv := case p_field when 'time' then spk_task_eff_time(p, r) else spk_task_eff_place(p, r) end;
  cur := case p_field when 'time' then s.time else s.place end;
  if coalesce(nv,'') = '' then return 'bad'; end if;
  if btrim(coalesce(cur,'')) = btrim(nv) then return 'ok'; end if;
  if btrim(coalesce(cur,'')) <> btrim(coalesce(p_old,'')) then return 'custom'; end if;
  perform set_config('hdm.rule_bypass', 'omni_chat_shuttle:' || left(coalesce(p_actor,'?'), 40), true);
  if p_field = 'time' then update tasks set time = nv where _id = s._id;
  else update tasks set place = nv where _id = s._id; end if;
  select case p_field when 'time' then time else place end into cur from tasks where _id = s._id;
  return case when btrim(coalesce(cur,'')) = btrim(nv) then 'ok' else 'blocked' end;
end $$;
revoke all on function public.omni_shuttle_sync(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.omni_shuttle_sync(text,text,text,text,text) to service_role;
-- 戻し：drop function public.omni_shuttle_sync(text,text,text,text,text);
