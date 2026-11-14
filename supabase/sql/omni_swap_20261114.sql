-- オムニの「担当替えつきの承認」：社員が承認した後に omni-desk chg_swap から呼ぶ（2026-11-14 nosh「担当者 該当者のタスクをどう見るかだ」）
-- 今の担当が案の時と同じ時だけ替える。a1_hdm_rule は理由つきの bypass（hdm_rule_log に残る）
create or replace function public.omni_swap_assignee(p_store text, p_task text, p_from text, p_to text, p_actor text)
returns text language plpgsql security definer set search_path = public as $$
declare n int; v text;
begin
  if p_task !~ '^[dc]-' or coalesce(btrim(p_to),'') = '' then return 'bad'; end if;
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
