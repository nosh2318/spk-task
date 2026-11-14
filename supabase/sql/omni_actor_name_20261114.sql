-- 送迎タスクの名前の場所もそろえる＋監査ログに押した人の名前（omni_shuttle_sync・omni_swap_assignee の置き換え）
-- 戻し：omni_shuttle_sync_20261114.sql と omni_swap_20261114.sql を流し直す

-- 2026-11-14 改訂：送迎タスクの名前の（場所）もそろえる／監査ログに押した人の名前を残す（x-hdm-actor）
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
  -- 監査ログ（_audit_actor は request.headers の x-hdm-actor を見る）に押した人の名前を残す。この処理の中だけ
  perform set_config('request.headers', (coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb || jsonb_build_object('x-hdm-actor', left(coalesce(p_actor,'omni'), 80)))::text, true);
  perform set_config('hdm.rule_bypass', 'omni_chat_shuttle:' || left(coalesce(p_actor,'?'), 40), true);
  if p_field = 'time' then update tasks set time = nv where _id = s._id;
  -- 名前「送迎: 担当 → お客様（場所）」の（場所）も同じ値に（末尾が（変更前の場所）の時だけ。違う形なら名前は触らない）
  else update tasks set place = nv,
         name = case when right(coalesce(name,''), char_length(btrim(coalesce(p_old,''))) + 2) = '（' || btrim(coalesce(p_old,'')) || '）' and btrim(coalesce(p_old,'')) <> ''
                     then left(name, char_length(name) - char_length(btrim(p_old)) - 2) || '（' || nv || '）' else name end
       where _id = s._id; end if;
  select case p_field when 'time' then time else place end into cur from tasks where _id = s._id;
  return case when btrim(coalesce(cur,'')) = btrim(nv) then 'ok' else 'blocked' end;
end $$;
revoke all on function public.omni_shuttle_sync(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.omni_shuttle_sync(text,text,text,text,text) to service_role;

-- 2026-11-14 改訂：監査ログに押した人の名前を残す（x-hdm-actor）
-- オムニの「担当替えつきの承認」：社員が承認した後に omni-desk chg_swap から呼ぶ（2026-11-14 nosh「担当者 該当者のタスクをどう見るかだ」）
-- 今の担当が案の時と同じ時だけ替える。a1_hdm_rule は理由つきの bypass（hdm_rule_log に残る）
create or replace function public.omni_swap_assignee(p_store text, p_task text, p_from text, p_to text, p_actor text)
returns text language plpgsql security definer set search_path = public as $$
declare n int; v text;
begin
  if p_task !~ '^[dc]-' or coalesce(btrim(p_to),'') = '' then return 'bad'; end if;
  -- 監査ログ（_audit_actor は request.headers の x-hdm-actor を見る）に押した人の名前を残す。この処理の中だけ
  perform set_config('request.headers', (coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb || jsonb_build_object('x-hdm-actor', left(coalesce(p_actor,'omni'), 80)))::text, true);
  perform set_config('hdm.rule_bypass', 'omni_swap:' || left(coalesce(p_actor,'?'), 40), true);
  if p_store = 'nha' then
    update nha_tasks set "担当" = p_to where _id = p_task and btrim(coalesce("担当",'')) = btrim(p_from) and deleted is not true;
  elsif p_store = 'spk' then
    update tasks set assignee = p_to where _id = p_task and btrim(coalesce(assignee,'')) = btrim(p_from) and deleted is not true;
  else return 'bad';
  end if;
  get diagnostics n = row_count;
  if n <> 1 then return 'changed'; end if;  -- 担当がもう案の時と違う（人が替えた）
  -- ほかの止め（取込の値を守る _nha_src_guard 等）で戻っていないか読み直す
  if p_store = 'nha' then select "担当" into v from nha_tasks where _id = p_task; else select assignee into v from tasks where _id = p_task; end if;
  return case when btrim(coalesce(v,'')) = btrim(p_to) then 'ok' else 'blocked' end;
end $$;
revoke all on function public.omni_swap_assignee(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.omni_swap_assignee(text,text,text,text,text) to service_role;
