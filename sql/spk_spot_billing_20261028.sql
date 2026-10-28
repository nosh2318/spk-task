-- ★2026-10-28 三國さん専用「通常／スポット」区分（オーナー指示）
--   スポット = 固定給に含まれない課金タスク（1件¥600）。2026-11-01 以降に三國さんへ振られたタスクだけが対象。
--   保存先 = tasks.changed_json._billing（"spot"=スポット／未設定・空=通常）。列追加なし（OPシートの保存経路と同じ）。
--   ① spk_staff_view: 個人URLのタスクに billing / spot_ok を追加（既存キーは不変）
--   ② spk_staff_history: 履歴に spot / spot_count / spot_ok を追加（既存キーは不変）
--   ③ spk_staff_set_billing: 個人URLから三國さん本人が自分のタスクを通常/スポットに切替
-- 戻すとき: ①② は本ファイル以前の定義を再適用、③ は DROP FUNCTION public.spk_staff_set_billing(uuid,text,boolean);

-- 三國さん判定（姓のみ・旧字/新字の揺れを吸収）
CREATE OR REPLACE FUNCTION public._spk_is_spot_staff(p_name text)
 RETURNS boolean LANGUAGE sql IMMUTABLE
AS $$ SELECT replace(replace(coalesce(p_name,''),' ',''),'三国','三國') IN ('三國玲音','三國') $$;

-- ① 個人URL（タスク一覧）
CREATE OR REPLACE FUNCTION public.spk_staff_view(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_name text; v_sur text; v_today date := (now() at time zone 'Asia/Tokyo')::date; v_res jsonb; v_req jsonb; v_skp jsonb; v_spot boolean;
BEGIN
  SELECT name INTO v_name FROM staff WHERE share_token=p_token AND coalesce(active,true)=true;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_token'); END IF;
  v_sur := split_part(v_name,' ',1);
  v_spot := _spk_is_spot_staff(v_name);
  WITH base AS (
    SELECT t._id, t.type, t.name, coalesce(nullif(v.name,''),t.assigned_vehicle) AS veh_name, v.caution_note AS caution, t.plate_no, t.done, t.ota, t.reservation_id, t.assignee, t.requested_to, t.skipped_by, r.mypage_token, coalesce(t.memo,'') AS memo,
      coalesce(r.opt_b,0) AS opt_b, coalesce(r.opt_c,0) AS opt_c, coalesce(r.opt_j,0) AS opt_j,
      coalesce(r.opt_usb,false)::int AS opt_usb, coalesce(r.opt_parasol,false)::int AS opt_parasol,
      coalesce(nullif(r.people,0),0) AS people,
      coalesce(nullif(r.flight,''),'') AS flight,
      coalesce(nullif(t.insurance,''), nullif(r.insurance,'')) AS insurance,
      nullif(substring(t.changed_json from '"_moveMeans":\s*"([^"]+)"'),'') AS move,
      nullif(substring(t.changed_json from '"_billing":\s*"([^"]+)"'),'') AS billing,
      t.date::date AS task_date,
      CASE WHEN t.type='洗車' AND t.plate_no<>'' THEN (
        SELECT max(coalesce(nullif(substring(t2.changed_json from '"_timeChange":\s*"([^"]+)"'),''),nullif(substring(t2.changed_json from '"_ssTime":\s*"([^"]+)"'),''),nullif(r2.col_time,''),nullif(r2.return_time,''),nullif(t2.time,'')))
        FROM tasks t2 LEFT JOIN reservations r2 ON r2.id=t2.reservation_id
        WHERE t2.type IN ('COL','BD','BDB','返却') AND t2.plate_no=t.plate_no AND t2.date::date=t.date::date AND coalesce(t2.deleted,false)=false
      ) ELSE NULL END AS wash_after,
      CASE WHEN t.type='洗車' AND t.changed_json IS NOT NULL AND t.changed_json ~ '"_nextDayWash":\s*true' THEN (t.date::date + 1) ELSE t.date::date END AS eff_date,
      CASE
        WHEN nullif(substring(t.changed_json from '"_timeChange":\s*"([^"]+)"'),'') IS NOT NULL THEN substring(t.changed_json from '"_timeChange":\s*"([^"]+)"')
        WHEN nullif(substring(t.changed_json from '"_ssTime":\s*"([^"]+)"'),'') IS NOT NULL THEN substring(t.changed_json from '"_ssTime":\s*"([^"]+)"')
        WHEN t.changed_json ~ '"_manualTimeAt":\s*"[^"]+"' THEN t.time
        WHEN t.type IN ('COL','BD','BDB','返却') THEN coalesce(nullif(r.col_time,''),nullif(r.return_time,''),t.time)
        WHEN t.type IN ('DEL','PU','PUB','来店','PUB来店') THEN coalesce(nullif(r.del_time,''),nullif(r.lend_time,''),t.time)
        ELSE t.time END AS eff_time,
      CASE
        WHEN t.changed_json ~ '"_placeSource":\s*"manual"' THEN t.place
        WHEN nullif(substring(t.changed_json from '"_ssPlace":\s*"([^"]+)"'),'') IS NOT NULL THEN substring(t.changed_json from '"_ssPlace":\s*"([^"]+)"')
        WHEN t.changed_json ~ '"_placeSource":\s*"customer"' THEN t.place
        WHEN t.type IN ('COL','BD','BDB','返却') THEN coalesce(nullif(r.col_place,''),t.place)
        WHEN t.type IN ('DEL','PU','PUB','来店','PUB来店') THEN coalesce(nullif(r.del_place,''),t.place)
        ELSE t.place END AS eff_place,
    (EXISTS(SELECT 1 FROM jalan_payments jp WHERE jp.reservation_id=t.reservation_id AND jp.status='paid')) AS jpaid
    FROM tasks t LEFT JOIN reservations r ON r.id=t.reservation_id LEFT JOIN vehicles v ON v.code=t.assigned_vehicle
    WHERE coalesce(t.deleted,false)=false
  ),
  mine AS (SELECT * FROM base WHERE ( replace(coalesce(assignee,''),' ','')=replace(v_name,' ','') OR replace(coalesce(assignee,''),' ','')=v_sur ) AND eff_date BETWEEN v_today AND v_today+62),
  reqd AS (SELECT * FROM base WHERE requested_to IS NOT NULL AND (requested_to ? v_name OR requested_to ? v_sur) AND coalesce(skipped_by ?| array[v_name,v_sur],false)=false AND replace(coalesce(assignee,''),' ','')<>replace(v_name,' ','') AND replace(coalesce(assignee,''),' ','')<>v_sur AND eff_date BETWEEN v_today AND v_today+62),
  skpd AS (SELECT * FROM base WHERE skipped_by IS NOT NULL AND (skipped_by ? v_name OR skipped_by ? v_sur) AND eff_date BETWEEN v_today AND v_today+62)
  SELECT
    (SELECT coalesce(jsonb_agg(jsonb_build_object('_id',_id,'type',type,'date',eff_date,'time',eff_time,'wash_after',wash_after,'customer',name,'vehicle',veh_name,'plate',plate_no,'place',eff_place,'done',done,'ota',ota,'jpaid',jpaid,'resv',reservation_id,'mypage',mypage_token,'move',move,'memo',memo,'opt_b',opt_b,'opt_c',opt_c,'opt_j',opt_j,'opt_usb',opt_usb,'opt_parasol',opt_parasol,'people',people,'flight',flight,'insurance',insurance,'caution',coalesce(caution,''),'billing',coalesce(billing,''),'spot_ok',(v_spot AND task_date>=date '2026-11-01')) ORDER BY eff_date,eff_time),'[]'::jsonb) FROM mine),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('_id',_id,'type',type,'date',eff_date,'time',eff_time,'wash_after',wash_after,'customer',name,'vehicle',veh_name,'plate',plate_no,'place',eff_place,'ota',ota,'jpaid',jpaid,'resv',reservation_id,'mypage',mypage_token,'move',move,'memo',memo,'opt_b',opt_b,'opt_c',opt_c,'opt_j',opt_j,'opt_usb',opt_usb,'opt_parasol',opt_parasol,'people',people,'flight',flight,'insurance',insurance,'caution',coalesce(caution,'')) ORDER BY eff_date,eff_time),'[]'::jsonb) FROM reqd),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('_id',_id,'type',type,'date',eff_date,'time',eff_time,'wash_after',wash_after,'customer',name,'vehicle',veh_name,'plate',plate_no,'place',eff_place,'ota',ota,'jpaid',jpaid,'resv',reservation_id,'mypage',mypage_token,'move',move,'memo',memo,'opt_b',opt_b,'opt_c',opt_c,'opt_j',opt_j,'opt_usb',opt_usb,'opt_parasol',opt_parasol,'people',people,'flight',flight,'insurance',insurance,'caution',coalesce(caution,'')) ORDER BY eff_date,eff_time),'[]'::jsonb) FROM skpd)
  INTO v_res, v_req, v_skp;
  RETURN jsonb_build_object('ok',true,'staff',v_name,'today',v_today,'tasks',v_res,'requests',v_req,'skips',v_skp);
END $function$;

-- ② 個人URL（対応履歴）
CREATE OR REPLACE FUNCTION public.spk_staff_history(p_token uuid, p_ym text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_name text; v_sur text; v_ym text; v_res jsonb; v_spot boolean;
BEGIN
  SELECT name INTO v_name FROM staff WHERE share_token=p_token AND coalesce(active,true)=true;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_token'); END IF;
  v_sur := split_part(v_name,' ',1);
  v_spot := _spk_is_spot_staff(v_name);
  v_ym := coalesce(nullif(p_ym,''), to_char((now() at time zone 'Asia/Tokyo')::date,'YYYY-MM'));
  WITH mine AS (
    SELECT t._id, t.type, t.date, t.time, t.return_time, t.name AS cust, t.assigned_vehicle, t.plate_no, t.updated_at,
      (v_spot AND t.date::date>=date '2026-11-01' AND t.changed_json ~ '"_billing":\s*"spot"') AS spot
    FROM tasks t
    WHERE coalesce(t.deleted,false)=false AND t.done=true
      AND ( replace(coalesce(t.assignee,''),' ','')=replace(v_name,' ','') OR replace(coalesce(t.assignee,''),' ','')=v_sur )
      AND to_char(t.date::date,'YYYY-MM')=v_ym
  )
  SELECT jsonb_build_object(
    'ok',true,'staff',v_name,'ym',v_ym,
    'count',(SELECT count(*) FROM mine),
    'spot_ok',(v_spot AND v_ym>='2026-11'),
    'spot_count',(SELECT count(*) FROM mine WHERE spot),
    'tasks',(SELECT coalesce(jsonb_agg(jsonb_build_object('_id',_id,'type',type,'date',date,'time',coalesce(time,return_time),'customer',cust,'vehicle',assigned_vehicle,'plate',plate_no,'done_at',updated_at,'spot',spot) ORDER BY date DESC, time DESC),'[]'::jsonb) FROM mine)
  ) INTO v_res;
  RETURN v_res;
END $function$;

-- ③ 個人URLから通常/スポット切替（三國さん本人・自分の担当・11/1以降のタスクのみ）
CREATE OR REPLACE FUNCTION public.spk_staff_set_billing(p_token uuid, p_task_id text, p_spot boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_name text; v_sur text; v_t record; v_cj jsonb;
BEGIN
  SELECT name INTO v_name FROM staff WHERE share_token=p_token AND coalesce(active,true)=true;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_token'); END IF;
  IF NOT _spk_is_spot_staff(v_name) THEN RETURN jsonb_build_object('ok',false,'error','not_allowed'); END IF;
  v_sur := split_part(v_name,' ',1);
  SELECT _id, date, assignee, changed_json INTO v_t FROM tasks WHERE _id=p_task_id AND coalesce(deleted,false)=false;
  IF v_t._id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','task_not_found'); END IF;
  IF NOT ( replace(coalesce(v_t.assignee,''),' ','')=replace(v_name,' ','') OR replace(coalesce(v_t.assignee,''),' ','')=v_sur ) THEN
    RETURN jsonb_build_object('ok',false,'error','not_assigned');
  END IF;
  IF v_t.date::date < date '2026-11-01' THEN RETURN jsonb_build_object('ok',false,'error','before_2026_11'); END IF;
  BEGIN v_cj := coalesce(nullif(v_t.changed_json,''),'{}')::jsonb; EXCEPTION WHEN others THEN v_cj := '{}'::jsonb; END;
  v_cj := jsonb_set(v_cj,'{_billing}',to_jsonb(CASE WHEN p_spot THEN 'spot' ELSE '' END),true);
  UPDATE tasks SET changed_json=v_cj::text WHERE _id=p_task_id;
  RETURN jsonb_build_object('ok',true,'billing',CASE WHEN p_spot THEN 'spot' ELSE '' END);
END $function$;
REVOKE ALL ON FUNCTION public.spk_staff_set_billing(uuid,text,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.spk_staff_set_billing(uuid,text,boolean) TO anon, authenticated;
