-- ============================================================
-- official_book_spk / official_book_nha
-- HANDYMAN公式サイト(rent-handyman.com) 札幌/那覇 予約の「予約作成＋配車確保＋総額確定」RPC
-- 2026-08-26 / omni （bt_book_tkm の 札幌/那覇版・公式サイト価格で確定）
-- perDay = 基本[クラス] + 補償[basic0/cdw1100/noc1650] + 550×(child+junior)
-- total  = perDay × 日数（返却-貸出, 最小1）。金額はサーバ確定＝クライアント値を信用しない。
-- 配車: 同クラスactive車両で期間重複なしを1台確保（満車=soldOut＝ダブルブッキング防止）。
-- ============================================================

-- ===== 札幌 (reservations / fleet / vehicles・class列=vehicle・日付=lend_date/return_date text) =====
create or replace function official_book_spk(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_cls text:=upper(trim(coalesce(p->>'vehicleClass','')));
  v_lend text:=trim(coalesce(p->>'lend_date','')); v_ret text:=trim(coalesce(p->>'return_date',''));
  v_ltime text:=coalesce(p->>'lend_time',''); v_rtime text:=coalesce(p->>'return_time','');
  v_ins text:=lower(coalesce(p->>'insuranceType','basic'));
  v_child int:=greatest(0,coalesce((p->>'childSeat')::int,0));
  v_junior int:=greatest(0,coalesce((p->>'juniorSeat')::int,0));
  v_usb int:=case when coalesce(p->>'usb','')='true' or coalesce(p->>'opt_usb','')='1' then 1 else 0 end;
  v_ppl int:=least(8,greatest(1,coalesce((p->>'people')::int,1)));
  v_name text:=trim(coalesce(p->>'name','')); v_mail text:=trim(coalesce(p->>'mail','')); v_tel text:=trim(coalesce(p->>'tel',''));
  v_delp text:=coalesce(p->>'del_place',''); v_colp text:=coalesce(p->>'col_place','');
  v_note text:=left(coalesce(p->>'note',''),1000);
  v_vtype text:=coalesce(nullif(p->>'visit_type',''),'DEL'); v_rtype text:=coalesce(nullif(p->>'return_type',''),'COL');
  v_days int; v_bd int; v_id_day int; v_ins_daily int; v_ins_txt text;
  v_base_total int; v_opt_total int; v_total int; v_code text; v_id text; v_try int:=0;
  PRICE jsonb:='{"A":13000,"A2":12000,"B":11000,"B2":12000,"C":7000,"S":9000,"F":6000,"H":6000}';
begin
  if v_lend !~ '^\d{4}-\d{2}-\d{2}$' or v_ret !~ '^\d{4}-\d{2}-\d{2}$' or v_ret<v_lend then return jsonb_build_object('error','日付エラー'); end if;
  if v_name='' or v_mail='' or position('@' in v_mail)=0 or v_tel='' then return jsonb_build_object('error','予約者情報が不足しています'); end if;
  if not (PRICE ? v_cls) then return jsonb_build_object('error','このクラスは現在オンライン予約を承れません'); end if;
  v_days:=(v_ret::date - v_lend::date); if v_days<1 then v_days:=1; end if;
  v_bd:=(PRICE->>v_cls)::int;
  v_ins_daily:=case v_ins when 'cdw' then 1100 when 'noc' then 1650 else 0 end;
  v_ins_txt:=case v_ins when 'cdw' then '免責' when 'noc' then 'NOC' else 'なし' end;
  v_base_total:=v_bd*v_days;
  v_opt_total:=(v_ins_daily*v_days)+((1100*v_child+550*v_junior)*v_days);
  v_total:=v_base_total+v_opt_total;
  if v_base_total<=0 then return jsonb_build_object('error','この日程・クラスは価格未設定のためWeb予約を承れません'); end if;
  select v.code into v_code from vehicles v
   where v.active=true and upper(v.type)=v_cls
     and not exists (select 1 from fleet f join reservations r on r.id=f.reservation_id
        where f.vehicle_code=v.code and coalesce(r.status,'') not in ('cancelled','canceled','キャンセル')
          and coalesce(r.lend_date,'')<=v_ret and coalesce(r.return_date,'')>=v_lend)
   order by v.code limit 1;
  if v_code is null then return jsonb_build_object('error','ご希望の期間は満車です。日程・クラスをご変更ください。','soldOut',true); end if;
  loop
    v_id:='HDMS'||to_char(now() at time zone 'Asia/Tokyo','YYMMDD')||lpad((floor(random()*10000))::int::text,4,'0');
    exit when not exists (select 1 from reservations where id=v_id);
    v_try:=v_try+1; if v_try>20 then return jsonb_build_object('error','予約番号の採番に失敗しました'); end if;
  end loop;
  -- ★2026-08-30 reservations には memo 列が無い（那覇 nha_reservations のみ memo あり）。札幌はmemoを入れない＝札幌のみ「予約処理に失敗」の根治。
  insert into reservations (id,ota,name,lend_date,lend_time,return_date,return_time,people,vehicle,insurance,tel,mail,
     price,status,visit_type,return_type,del_place,col_place,opt_c,opt_j,opt_usb,base_price,option_price,discount,
     prefecture,mypage_token,mypage_locked,created_at,updated_at)
  values (v_id,'HANDYMAN',v_name,v_lend,v_ltime,v_ret,v_rtime,v_ppl,v_cls,v_ins_txt,v_tel,v_mail,
     v_total,'pending_payment',v_vtype,v_rtype,v_delp,v_colp,v_child,v_junior,(v_usb>0),v_base_total,v_opt_total,0,
     '北海道',gen_random_uuid(),'{}'::jsonb,now(),now());
  insert into fleet (reservation_id,vehicle_code,updated_at) values (v_id,v_code,now());
  return jsonb_build_object('reservationId',v_id,'total',v_total,'classTotal',v_base_total,'vehicle',v_code);
end;$$;
grant execute on function official_book_spk(jsonb) to service_role;

-- ===== 那覇 (nha_reservations / nha_fleet / nha_vehicles・class列=vehicle_class・日付=start_date/end_date text) =====
create or replace function official_book_nha(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_cls text:=upper(trim(coalesce(p->>'vehicleClass','')));
  v_lend text:=trim(coalesce(p->>'lend_date','')); v_ret text:=trim(coalesce(p->>'return_date',''));
  v_ltime text:=coalesce(p->>'lend_time',''); v_rtime text:=coalesce(p->>'return_time','');
  v_ins text:=lower(coalesce(p->>'insuranceType','basic'));
  v_child int:=greatest(0,coalesce((p->>'childSeat')::int,0));
  v_junior int:=greatest(0,coalesce((p->>'juniorSeat')::int,0));
  v_usb int:=case when coalesce(p->>'usb','')='true' or coalesce(p->>'opt_usb','')='1' then 1 else 0 end;
  v_ppl int:=least(8,greatest(1,coalesce((p->>'people')::int,1)));
  v_name text:=trim(coalesce(p->>'name','')); v_mail text:=trim(coalesce(p->>'mail','')); v_tel text:=trim(coalesce(p->>'tel',''));
  v_model text:=trim(coalesce(p->>'vehicleModel',''));
  v_delp text:=coalesce(p->>'del_place',''); v_colp text:=coalesce(p->>'col_place','');
  v_note text:=left(coalesce(p->>'note',''),1000);
  v_vtype text:=coalesce(nullif(p->>'visit_type',''),'DEL'); v_rtype text:=coalesce(nullif(p->>'return_type',''),'COL');
  v_days int; v_bd int; v_ins_daily int; v_ins_txt text;
  v_base_total int; v_opt_total int; v_total int; v_code text; v_plate text; v_id text; v_try int:=0;
  PRICE jsonb:='{"A":12000,"B":9000,"C":7000,"D":7000,"F":3500,"H":4500,"S":5500}';
begin
  if v_lend !~ '^\d{4}-\d{2}-\d{2}$' or v_ret !~ '^\d{4}-\d{2}-\d{2}$' or v_ret<v_lend then return jsonb_build_object('error','日付エラー'); end if;
  if v_name='' or v_mail='' or position('@' in v_mail)=0 or v_tel='' then return jsonb_build_object('error','予約者情報が不足しています'); end if;
  if not (PRICE ? v_cls) then return jsonb_build_object('error','このクラスは現在オンライン予約を承れません'); end if;
  v_days:=(v_ret::date - v_lend::date); if v_days<1 then v_days:=1; end if;
  v_bd:=(PRICE->>v_cls)::int;
  v_ins_daily:=case v_ins when 'cdw' then 1100 when 'noc' then 1650 else 0 end;
  v_ins_txt:=case v_ins when 'cdw' then '免責' when 'noc' then 'NOC' else 'なし' end;
  v_base_total:=v_bd*v_days;
  v_opt_total:=(v_ins_daily*v_days)+((1100*v_child+550*v_junior)*v_days);
  v_total:=v_base_total+v_opt_total;
  if v_base_total<=0 then return jsonb_build_object('error','この日程・クラスは価格未設定のためWeb予約を承れません'); end if;
  select v.code,v.plate_no into v_code,v_plate from nha_vehicles v
   where v.active=true and upper(v.type)=v_cls
     and not exists (select 1 from nha_fleet f join nha_reservations r on r.id=f.reservation_id
        where f.vehicle_code=v.code and coalesce(r.status,'') not in ('cancelled','canceled','キャンセル')
          and coalesce(r.start_date,'')<=v_ret and coalesce(r.end_date,'')>=v_lend)
   order by v.code limit 1;
  if v_code is null then return jsonb_build_object('error','ご希望の期間は満車です。日程・クラスをご変更ください。','soldOut',true); end if;
  loop
    v_id:='HDMN'||to_char(now() at time zone 'Asia/Tokyo','YYMMDD')||lpad((floor(random()*10000))::int::text,4,'0');
    exit when not exists (select 1 from nha_reservations where id=v_id);
    v_try:=v_try+1; if v_try>20 then return jsonb_build_object('error','予約番号の採番に失敗しました'); end if;
  end loop;
  insert into nha_reservations (id,name,start_date,end_date,start_time,end_time,people,vehicle_class,vehicle_name,plate_no,
     insurance,tel,mail,ota,source,price,final_price,base_price,option_price,discount,status,visit_type,return_type,
     assigned_vehicle,del_place,col_place,opt_c,opt_j,opt_usb,prefecture,memo,mypage_token,mypage_locked,booked_at,created_at,updated_at)
  values (v_id,v_name,v_lend,v_ret,v_ltime,v_rtime,v_ppl,v_cls,coalesce(nullif(v_model,''),v_cls||'クラス'),v_plate,
     v_ins_txt,v_tel,v_mail,'HANDYMAN','hdm_official',v_total,v_total,v_base_total,v_opt_total,0,'pending_payment',v_vtype,v_rtype,
     v_code,v_delp,v_colp,v_child,v_junior,v_usb,'沖縄県',v_note,gen_random_uuid(),'{}'::jsonb,now(),now(),now());
  insert into nha_fleet (reservation_id,vehicle_code) values (v_id,v_code);
  return jsonb_build_object('reservationId',v_id,'total',v_total,'classTotal',v_base_total,'vehicle',v_code);
end;$$;
grant execute on function official_book_nha(jsonb) to service_role;
