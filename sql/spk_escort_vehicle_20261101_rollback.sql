-- 2026-11-01 送迎タスクの車両 戻し（本番の適用前定義）
DROP FUNCTION IF EXISTS public.spk_staff_set_escort_vehicle(uuid,text,text);

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
    SELECT t._id, t.type, t.name, coalesce(nullif(v.name,''),CASE WHEN t.type='送迎' AND t.vehicle='その他' THEN 'その他' END,t.assigned_vehicle) AS veh_name, v.caution_note AS caution, t.plate_no, t.done, t.ota, t.reservation_id, t.assignee, t.requested_to, t.skipped_by, r.mypage_token, coalesce(t.memo,'') AS memo,
      coalesce(r.opt_b,0) AS opt_b, coalesce(r.opt_c,0) AS opt_c, coalesce(r.opt_j,0) AS opt_j,
      coalesce(r.opt_usb,false)::int AS opt_usb, coalesce(r.opt_parasol,false)::int AS opt_parasol,
      coalesce(nullif(r.people,0),0) AS people,
      coalesce(nullif(r.flight,''),'') AS flight,
      coalesce(nullif(t.insurance,''), nullif(r.insurance,'')) AS insurance,
      nullif(substring(t.changed_json from '"_moveMeans":\s*"([^"]+)"'),'') AS move,
      nullif(substring(t.changed_json from '"_moveDriver":\s*"([^"]+)"'),'') AS move_driver,
      nullif(substring(t.changed_json from '"_moveVehicle":\s*"([^"]+)"'),'') AS move_vehicle,
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
    (SELECT coalesce(jsonb_agg(jsonb_build_object('_id',_id,'type',type,'date',eff_date,'time',eff_time,'wash_after',wash_after,'customer',name,'vehicle',veh_name,'plate',plate_no,'place',eff_place,'done',done,'ota',ota,'jpaid',jpaid,'resv',reservation_id,'mypage',mypage_token,'move',move,'move_ok',(type IS DISTINCT FROM '送迎'),'move_driver',coalesce(move_driver,''),'move_vehicle_code',coalesce(move_vehicle,''),'move_vehicle',coalesce((SELECT btrim(coalesce(mv.name,'')||' '||coalesce(mv.plate_no,'')) FROM vehicles mv WHERE mv.code=move_vehicle LIMIT 1),move_vehicle,''),'memo',memo,'opt_b',opt_b,'opt_c',opt_c,'opt_j',opt_j,'opt_usb',opt_usb,'opt_parasol',opt_parasol,'people',people,'flight',flight,'insurance',insurance,'caution',coalesce(caution,''),'billing',coalesce(billing,''),'spot_ok',(v_spot AND task_date>=date '2026-11-01')) ORDER BY eff_date,eff_time),'[]'::jsonb) FROM mine),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('_id',_id,'type',type,'date',eff_date,'time',eff_time,'wash_after',wash_after,'customer',name,'vehicle',veh_name,'plate',plate_no,'place',eff_place,'ota',ota,'jpaid',jpaid,'resv',reservation_id,'mypage',mypage_token,'move',move,'move_driver',coalesce(move_driver,''),'move_vehicle_code',coalesce(move_vehicle,''),'move_vehicle',coalesce((SELECT btrim(coalesce(mv.name,'')||' '||coalesce(mv.plate_no,'')) FROM vehicles mv WHERE mv.code=move_vehicle LIMIT 1),move_vehicle,''),'memo',memo,'opt_b',opt_b,'opt_c',opt_c,'opt_j',opt_j,'opt_usb',opt_usb,'opt_parasol',opt_parasol,'people',people,'flight',flight,'insurance',insurance,'caution',coalesce(caution,'')) ORDER BY eff_date,eff_time),'[]'::jsonb) FROM reqd),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('_id',_id,'type',type,'date',eff_date,'time',eff_time,'wash_after',wash_after,'customer',name,'vehicle',veh_name,'plate',plate_no,'place',eff_place,'ota',ota,'jpaid',jpaid,'resv',reservation_id,'mypage',mypage_token,'move',move,'move_driver',coalesce(move_driver,''),'move_vehicle_code',coalesce(move_vehicle,''),'move_vehicle',coalesce((SELECT btrim(coalesce(mv.name,'')||' '||coalesce(mv.plate_no,'')) FROM vehicles mv WHERE mv.code=move_vehicle LIMIT 1),move_vehicle,''),'memo',memo,'opt_b',opt_b,'opt_c',opt_c,'opt_j',opt_j,'opt_usb',opt_usb,'opt_parasol',opt_parasol,'people',people,'flight',flight,'insurance',insurance,'caution',coalesce(caution,'')) ORDER BY eff_date,eff_time),'[]'::jsonb) FROM skpd)
  INTO v_res, v_req, v_skp;
  RETURN jsonb_build_object('ok',true,'staff',v_name,'today',v_today,'tasks',v_res,'requests',v_req,'skips',v_skp,
    'move_opts',jsonb_build_object(
      'staff',(SELECT coalesce(jsonb_agg(s.name ORDER BY s.name),'[]'::jsonb) FROM staff s WHERE coalesce(s.active,true)=true),
      'vehicles',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',mv.code,'label',btrim(coalesce(mv.name,'')||' '||coalesce(mv.plate_no,''))) ORDER BY mv.type,mv.name,mv.plate_no),'[]'::jsonb) FROM vehicles mv WHERE coalesce(mv.active,true)=true)));
END $function$;
