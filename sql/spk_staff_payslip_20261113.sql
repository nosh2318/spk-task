-- 札幌：スタッフ個人ページ（staff.html）の「給与明細」用 RPC（2026-11-13）
-- 目的：本人の給与明細（月別）を本人だけが見られるようにする。管理APP「給与」→「給与明細」と同じ材料を返す。
-- 安全：share_token（本人の個人URLの鍵）で staff を1行だけ特定し、その人の行だけを返す。他人の名前・金額は返さない。
--       読むだけ（書込なし）。anon は spk_attendance / staff / store_events / tasks を直接読めない（RLS で authenticated のみ）。
-- 戻し方：DROP FUNCTION public.spk_staff_payslip(uuid, text);

CREATE OR REPLACE FUNCTION public.spk_staff_payslip(p_token uuid, p_ym text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s staff%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
  v_ym text; v_from date; v_to date;
  v_spot boolean; v_monthly int; v_hourly int; v_daily int; v_fixed text;
  v_att jsonb; v_ev jsonb; v_sp jsonb := '[]'::jsonb;
BEGIN
  IF p_token IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_token'); END IF;
  SELECT * INTO s FROM staff WHERE share_token=p_token AND coalesce(active,true)=true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_token'); END IF;

  v_ym := CASE WHEN p_ym ~ '^\d{4}-(0[1-9]|1[0-2])$' THEN p_ym ELSE to_char(v_today,'YYYY-MM') END;
  v_from := (v_ym||'-01')::date;
  v_to := (v_from + interval '1 month' - interval '1 day')::date;

  -- 管理APP _payStaff と同じ：三國さんは 2026-11 以降 固定給 150,000（時給・日給・固定曜日なし）
  v_spot := _spk_is_spot_staff(s.name);
  v_monthly := coalesce(s.monthly_salary,0); v_hourly := coalesce(s.hourly_wage,0);
  v_daily := coalesce(s.daily_wage,0); v_fixed := coalesce(s.fixed_days,'');
  IF v_spot AND v_ym >= '2026-11' THEN v_monthly:=150000; v_hourly:=0; v_daily:=0; v_fixed:=''; END IF;

  -- 本人の勤怠（この月だけ）
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'date',to_char(a.date,'YYYY-MM-DD'),'start',coalesce(a.start_time,''),'end',coalesce(a.end_time,''),
      'approved',coalesce(a.approved,false),'absent',coalesce(a.absent,false),'memo',coalesce(a.memo,''),
      'breaks',CASE WHEN jsonb_typeof(a.breaks)='array' THEN a.breaks ELSE '[]'::jsonb END) ORDER BY a.date),'[]'::jsonb)
    INTO v_att FROM spk_attendance a
   WHERE a.staff_name=s.name AND a.date BETWEEN v_from AND v_to;

  -- 本人が担当の 残業/休日出勤 ログ（他の担当者名は返さない）
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'category',e.category,'event_date',to_char(e.event_date,'YYYY-MM-DD'),
      'start_time',coalesce(to_char(e.start_time,'HH24:MI'),''),'end_time',coalesce(to_char(e.end_time,'HH24:MI'),''),
      'reason',coalesce(nullif(e.description,''),nullif(e.title,''),'')) ORDER BY e.event_date, e.start_time),'[]'::jsonb)
    INTO v_ev FROM store_events e
   WHERE e.category IN ('overtime','holiday_work') AND e.event_date BETWEEN v_from AND v_to
     AND s.name = ANY(e.assignees);

  -- 三國さんのみ：特別対応（スポット）タスク（管理APP spotTasks と同じ条件・2026-11-01 以降）
  IF v_spot AND v_to >= DATE '2026-11-01' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('date',t.date,'type',t.type,'time',coalesce(nullif(t.time,''),t.return_time,''),
        'name',coalesce(t.name,''),'done',coalesce(t.done,false)) ORDER BY t.date, t.time),'[]'::jsonb)
      INTO v_sp FROM tasks t
     WHERE t.assignee IN ('三國 玲音','三國','三国 玲音','三国')
       AND t.date >= greatest(v_from, DATE '2026-11-01')::text AND t.date <= v_to::text
       AND coalesce(t.deleted,false)=false
       AND coalesce(t.changed_json,'') ~ '"_billing"\s*:\s*"spot"';  -- 壊れたJSONでも落ちないよう文字列一致
  END IF;

  RETURN jsonb_build_object('ok',true,'ym',v_ym,'today',v_today,
    'staff',jsonb_build_object('name',s.name,'type',coalesce(s.type,''),
      'monthly_salary',v_monthly,'hourly_wage',v_hourly,'daily_wage',v_daily,'fixed_days',v_fixed,
      'break_minutes',coalesce(s.break_minutes,0),'transport_cost',coalesce(s.transport_cost,0),
      'spot',v_spot,'fixed_only',(v_spot AND v_ym >= '2026-11')),
    'attendance',v_att,'events',v_ev,'spot_tasks',v_sp);
END $function$;

REVOKE ALL ON FUNCTION public.spk_staff_payslip(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spk_staff_payslip(uuid, text) TO anon, authenticated;
