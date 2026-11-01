-- ★2026-11-01 札幌 送迎に車両を追加（オーナー指示）。列追加なし。元タスク changed_json._moveVehicle（車両コード or その他）／送迎タスクは乗捨回収と同じく vehicle=クラス・assigned_vehicle・plate_no（その他は vehicle='その他' のみ）。
--   ① spk_staff_view: move_driver / move_vehicle / move_vehicle_code / move_ok / move_opts を追加（既存キーは不変）。送迎タスクの車両「その他」を vehicle に出す
--   ② spk_staff_set_move: 新設
-- 戻すとき: sql/spk_move_vehicle_20261101_rollback.sql

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

-- ② 個人URLから自分のタスクの移動手段・送迎者・車両を保存（OPシート saveMoveMeans と同じ結果）
--    認可＝spk_staff_view の tasks（本人担当・今日以降・送迎タスク以外）に入っている行だけ。書くのは元タスク1件＋送迎タスク s-<id> 1件。削除は墓標。
CREATE OR REPLACE FUNCTION public.spk_staff_set_move(p_token uuid, p_task_id text, p_means text, p_driver text, p_vehicle text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_view jsonb; v_x jsonb; v_t tasks%rowtype; v_ex tasks%rowtype; v_cj jsonb; v_ecj jsonb;
  v_means text := btrim(coalesce(p_means,''));
  v_driver text := btrim(coalesce(p_driver,''));
  v_veh text := btrim(coalesce(p_vehicle,''));
  v_cls text := ''; v_code text := ''; v_plate text := ''; v_eid text; v_pl text; v_name text; v_by text;
BEGIN
  v_view := spk_staff_view(p_token);
  IF coalesce((v_view->>'ok')::boolean,false)=false THEN RETURN jsonb_build_object('ok',false,'error',coalesce(v_view->>'error','invalid_token')); END IF;
  v_by := v_view->>'staff';
  SELECT e INTO v_x FROM jsonb_array_elements(v_view->'tasks') e WHERE e->>'_id'=p_task_id LIMIT 1;
  IF v_x IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_assigned'); END IF;
  IF coalesce((v_x->>'move_ok')::boolean,false)=false THEN RETURN jsonb_build_object('ok',false,'error','not_allowed'); END IF;
  IF v_means<>'' AND v_means<>ALL(ARRAY['送迎','徒歩','自転車','電動自転車','電動KB','地下鉄','JR','バス']) AND v_means IS DISTINCT FROM (v_x->>'move') THEN
    RETURN jsonb_build_object('ok',false,'error','bad_means'); END IF;
  IF v_means<>'送迎' THEN v_driver:=''; v_veh:=''; END IF;
  IF v_driver<>'' AND NOT EXISTS(SELECT 1 FROM staff s WHERE s.name=v_driver AND coalesce(s.active,true)=true) AND v_driver IS DISTINCT FROM (v_x->>'move_driver') THEN
    RETURN jsonb_build_object('ok',false,'error','bad_driver'); END IF;
  IF v_veh='その他' THEN v_cls:='その他';
  ELSIF v_veh<>'' THEN
    SELECT coalesce(mv.type,''),mv.code,coalesce(mv.plate_no,'') INTO v_cls,v_code,v_plate FROM vehicles mv WHERE mv.code=v_veh LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','bad_vehicle'); END IF;
  END IF;
  SELECT * INTO v_t FROM tasks WHERE _id=p_task_id AND coalesce(deleted,false)=false FOR UPDATE;
  IF v_t._id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','task_not_found'); END IF;
  BEGIN v_cj := coalesce(nullif(v_t.changed_json,''),'{}')::jsonb;
  EXCEPTION WHEN others THEN RETURN jsonb_build_object('ok',false,'error','bad_changed_json'); END;
  IF jsonb_typeof(v_cj)<>'object' THEN RETURN jsonb_build_object('ok',false,'error','bad_changed_json'); END IF;
  UPDATE tasks SET changed_json=(v_cj||jsonb_build_object('_moveMeans',v_means,'_moveDriver',v_driver,'_moveVehicle',v_veh,'_moveBy',v_by))::text WHERE _id=p_task_id;

  v_eid := 's-'||p_task_id;
  IF v_means='送迎' AND v_driver<>'' THEN
    SELECT * INTO v_ex FROM tasks WHERE _id=v_eid FOR UPDATE;
    IF v_ex._id IS NOT NULL AND coalesce(v_ex.deleted,false)=false AND v_ex.assignee=v_driver THEN
      UPDATE tasks SET vehicle=v_cls,assigned_vehicle=v_code,plate_no=v_plate WHERE _id=v_eid;   -- 同じ送迎者＝車両だけ（完了・時間は保つ）
    ELSE
      v_pl := coalesce(nullif(v_x->>'place',''),'');
      v_name := '送迎: '||coalesce(v_t.assignee,'')||' → '||coalesce(v_t.name,'')||CASE WHEN v_pl<>'' THEN '（'||v_pl||'）' ELSE '' END;
      v_ecj := jsonb_build_object('_escortOf',p_task_id,'_escortMeans','送迎','_src','human','_manual',true,'_taskDate',v_t.date,'_moveBy',v_by);
      INSERT INTO tasks(_id,date,type,time,name,assignee,done,memo,reservation_id,ota,tel,mail,assigned_vehicle,plate_no,people,place,vehicle,insurance,flight,return_date,return_time,return_type,col_place,sort_order,changed_json,deleted)
      VALUES(v_eid,v_t.date,'送迎',coalesce(v_x->>'time',''),v_name,v_driver,false,'','','','','',v_code,v_plate,0,v_pl,v_cls,'','','','','','',
             (SELECT coalesce(max(sort_order),0)+1 FROM tasks WHERE date=v_t.date),v_ecj::text,false)
      ON CONFLICT (_id) DO UPDATE SET date=excluded.date,type='送迎',time=excluded.time,name=excluded.name,assignee=excluded.assignee,done=false,place=excluded.place,vehicle=excluded.vehicle,assigned_vehicle=excluded.assigned_vehicle,plate_no=excluded.plate_no,changed_json=excluded.changed_json,deleted=false;
    END IF;
  ELSE
    UPDATE tasks SET deleted=true WHERE _id=v_eid AND coalesce(deleted,false)=false;   -- 墓標
  END IF;
  RETURN jsonb_build_object('ok',true);
END $function$;
REVOKE ALL ON FUNCTION public.spk_staff_set_move(uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spk_staff_set_move(uuid,text,text,text,text) TO anon, authenticated, service_role;
