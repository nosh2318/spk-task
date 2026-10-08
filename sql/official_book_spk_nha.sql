-- 正本(DB適用済の実定義をpg_get_functiondefで書き戻し)。2026-09-25更新: insurance_veh除外+_dry soldOut+FOR UPDATE SKIP LOCKED+kpi月優先。
-- ⚠️再RUN前に必ずDBの最新pg_get_functiondefと照合すること。
CREATE OR REPLACE FUNCTION public.official_book_spk(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_days int; v_ins_daily int; v_ins_txt text;
  v_base_total int; v_opt_total int; v_total int; v_code text; v_id text; v_try int:=0;
  -- ★マスター（app_settings.hdm_official_price の spk）
  v_m jsonb; v_pcls jsonb; v_high jsonb; v_a int; v_b int; v_dd date;
  v_cdw int; v_noc int; v_cfee int; v_jfee int; v_months jsonb; v_low jsonb; v_base int; v_mc jsonb;
  FALLBACK jsonb:='{"A":13000,"A2":12000,"B":11000,"B2":12000,"C":7000,"S":9000,"F":6000,"H":6000}';
begin
  if v_lend !~ '^\d{4}-\d{2}-\d{2}$' or v_ret !~ '^\d{4}-\d{2}-\d{2}$' or v_ret<v_lend then return jsonb_build_object('error','日付エラー'); end if;
  if v_name='' or v_mail='' or position('@' in v_mail)=0 or v_tel='' then return jsonb_build_object('error','予約者情報が不足しています'); end if;
  select value::jsonb->'spk' into v_m from app_settings where key='hdm_official_price';
  v_pcls:=v_m->'price'->v_cls;
  v_a:=(v_pcls->>'a')::int; v_b:=(v_pcls->>'b')::int; v_base:=(v_pcls->>'base')::int; v_low:=coalesce(v_m->'low_dates','[]'::jsonb);
  -- FALLBACKはマスター全体欠損(v_m is null=DB未seed/到達不可)時のみ救済=サイトを止めない。マスターがあってクラス未設定(base/a/b全空)なら売り止め=空欄保存で0円請求を出さない(2026-09-23)
  if v_m is null then v_base:=coalesce(v_base,(FALLBACK->>v_cls)::int); end if;
  v_base:=coalesce(v_base,v_a,v_b); v_a:=coalesce(v_a,v_base); v_b:=coalesce(v_b,v_a);
  if v_base is null then return jsonb_build_object('error','このクラスは現在オンライン予約を承れません'); end if;
  v_high:=coalesce(v_m->'high_dates','[]'::jsonb); -- 月別料金 {"YYYY-MM":{クラス:{a:通常,b:高}}}(未設定はデフォルトv_a)
  v_cdw:=coalesce((v_m->'insurance'->>'cdw')::int,1100);
  v_noc:=coalesce((v_m->'insurance'->>'noc')::int,1650);
  v_cfee:=coalesce((v_m->'seat'->>'child')::int,1100);
  v_jfee:=coalesce((v_m->'seat'->>'junior')::int,550);
  v_days:=(v_ret::date - v_lend::date)+1; if v_days<1 then v_days:=1; end if; -- ★暦日カウント(+1・返却日も1日)＝official-flow daysCount/KEYDROPと統一(過少請求根治 2026-09-15)
  -- 日別 A(通常)/B(高) 合算：貸出日〜返却日の各暦日
  v_base_total:=0;
  for v_dd in select generate_series(v_lend::date, v_ret::date, interval '1 day')::date loop -- その月・クラスの{a:通常,b:高}(未設定はデフォルトv_a)
    if v_high ? to_char(v_dd,'YYYY-MM-DD') then -- カレンダーで「高い」に区切った日
      v_base_total:=v_base_total + coalesce((v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'b')::int,(v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'a')::int,v_b);
    elsif v_low ? to_char(v_dd,'YYYY-MM-DD') then v_base_total:=v_base_total + coalesce((v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'a')::int,v_a); else v_base_total:=v_base_total + coalesce((v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'base')::int,v_base); end if;
  end loop;
  if v_base_total=0 then -- 同日(v_ret=v_lend)は貸出日で判定
    if v_high ? to_char(v_lend::date,'YYYY-MM-DD') then
      v_base_total:=coalesce((v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'b')::int,(v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'a')::int,v_b);
    elsif v_low ? to_char(v_lend::date,'YYYY-MM-DD') then v_base_total:=coalesce((v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'a')::int,v_a); else v_base_total:=coalesce((v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'base')::int,v_base); end if;
  end if;
  v_ins_daily:=case v_ins when 'cdw' then v_cdw when 'noc' then v_noc else 0 end;
  v_ins_txt:=case v_ins when 'cdw' then '免責' when 'noc' then 'NOC' else 'なし' end;
  v_opt_total:=(v_ins_daily*v_days)+((v_cfee*v_child+v_jfee*v_junior)*v_days);
  v_total:=v_base_total+v_opt_total;
  if v_base_total<=0 then return jsonb_build_object('error','この日程・クラスは価格未設定のためWeb予約を承れません'); end if;
  select v.code into v_code from vehicles v
   where coalesce((select k.active from vehicle_monthly_kpi k where k.vehicle_code=v.code and k.year_month=substr(v_lend,1,7)),v.active)=true and upper(v.type)=v_cls and coalesce(v.insurance_veh,false)=false
     and not exists (select 1 from fleet f join reservations r on r.id=f.reservation_id
        where f.vehicle_code=v.code and coalesce(r.status,'') not in ('cancelled','canceled','キャンセル')
          and coalesce(r.lend_date,'')<=v_ret and coalesce(r.return_date,'')>=v_lend)
     and not exists (select 1 from maintenance m
        where m.vehicle_code=v.code and coalesce(m.block_type,'')<>'partner_reserved'
          and coalesce(m.status,'') not in ('cancelled','canceled','キャンセル')
          and coalesce(m.start_date::text,'')<=v_ret and coalesce(nullif(m.end_date::text,''),m.start_date::text)>=v_lend)
   order by v.code limit 1 for update of v skip locked;
  if coalesce(p->>'_dry','')='1' then return jsonb_build_object('classTotal',v_base_total,'soldOut',(v_code is null)); end if;
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
end;$function$
;

CREATE OR REPLACE FUNCTION public.official_book_nha(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_days int; v_ins_daily int; v_ins_txt text;
  v_base_total int; v_opt_total int; v_total int; v_code text; v_plate text; v_id text; v_try int:=0;
  v_m jsonb; v_pcls jsonb; v_high jsonb; v_a int; v_b int; v_dd date;
  v_cdw int; v_noc int; v_cfee int; v_jfee int; v_months jsonb; v_low jsonb; v_base int; v_mc jsonb;
  FALLBACK jsonb:='{"A":12000,"B":9000,"C":7000,"D":7000,"F":3500,"H":4500,"S":5500}';
begin
  if v_lend !~ '^\d{4}-\d{2}-\d{2}$' or v_ret !~ '^\d{4}-\d{2}-\d{2}$' or v_ret<v_lend then return jsonb_build_object('error','日付エラー'); end if;
  if v_name='' or v_mail='' or position('@' in v_mail)=0 or v_tel='' then return jsonb_build_object('error','予約者情報が不足しています'); end if;
  select value::jsonb->'nha' into v_m from nha_app_settings where key='hdm_official_price';
  if v_m is null then select value::jsonb->'nha' into v_m from app_settings where key='hdm_official_price'; end if;
  v_pcls:=v_m->'price'->v_cls;
  v_a:=(v_pcls->>'a')::int; v_b:=(v_pcls->>'b')::int; v_base:=(v_pcls->>'base')::int; v_low:=coalesce(v_m->'low_dates','[]'::jsonb);
  -- FALLBACKはマスター全体欠損(v_m is null=DB未seed/到達不可)時のみ救済=サイトを止めない。マスターがあってクラス未設定(base/a/b全空)なら売り止め=空欄保存で0円請求を出さない(2026-09-23)
  if v_m is null then v_base:=coalesce(v_base,(FALLBACK->>v_cls)::int); end if;
  v_base:=coalesce(v_base,v_a,v_b); v_a:=coalesce(v_a,v_base); v_b:=coalesce(v_b,v_a);
  if v_base is null then return jsonb_build_object('error','このクラスは現在オンライン予約を承れません'); end if;
  v_high:=coalesce(v_m->'high_dates','[]'::jsonb); -- 月別料金 {"YYYY-MM":{クラス:{a:通常,b:高}}}(未設定はデフォルトv_a)
  v_cdw:=coalesce((v_m->'insurance'->>'cdw')::int,1100);
  v_noc:=coalesce((v_m->'insurance'->>'noc')::int,1650);
  v_cfee:=coalesce((v_m->'seat'->>'child')::int,1100);
  v_jfee:=coalesce((v_m->'seat'->>'junior')::int,550);
  v_days:=(v_ret::date - v_lend::date)+1; if v_days<1 then v_days:=1; end if; -- ★暦日カウント(+1・返却日も1日)
  v_base_total:=0;
  for v_dd in select generate_series(v_lend::date, v_ret::date, interval '1 day')::date loop -- その月・クラスの{a:通常,b:高}(未設定はデフォルトv_a)
    if v_high ? to_char(v_dd,'YYYY-MM-DD') then -- カレンダーで「高い」に区切った日
      v_base_total:=v_base_total + coalesce((v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'b')::int,(v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'a')::int,v_b);
    elsif v_low ? to_char(v_dd,'YYYY-MM-DD') then v_base_total:=v_base_total + coalesce((v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'a')::int,v_a); else v_base_total:=v_base_total + coalesce((v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'base')::int,v_base); end if;
  end loop;
  if v_base_total=0 then -- 同日(v_ret=v_lend)は貸出日で判定
    if v_high ? to_char(v_lend::date,'YYYY-MM-DD') then
      v_base_total:=coalesce((v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'b')::int,(v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'a')::int,v_b);
    elsif v_low ? to_char(v_lend::date,'YYYY-MM-DD') then v_base_total:=coalesce((v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'a')::int,v_a); else v_base_total:=coalesce((v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'base')::int,v_base); end if;
  end if;
  v_ins_daily:=case v_ins when 'cdw' then v_cdw when 'noc' then v_noc else 0 end;
  v_ins_txt:=case v_ins when 'cdw' then '免責' when 'noc' then 'NOC' else 'なし' end;
  v_opt_total:=(v_ins_daily*v_days)+((v_cfee*v_child+v_jfee*v_junior)*v_days);
  v_total:=v_base_total+v_opt_total;
  if v_base_total<=0 then return jsonb_build_object('error','この日程・クラスは価格未設定のためWeb予約を承れません'); end if;
  select v.code,v.plate_no into v_code,v_plate from nha_vehicles v
   where coalesce((select k.active from nha_vehicle_monthly_kpi k where k.vehicle_code=v.code and k.year_month=substr(v_lend,1,7)),v.active)=true and upper(v.type)=v_cls and coalesce(v.insurance_veh,false)=false
     and not exists (select 1 from nha_fleet f join nha_reservations r on r.id=f.reservation_id
        where f.vehicle_code=v.code and coalesce(r.status,'') not in ('cancelled','canceled','キャンセル')
          and coalesce(r.start_date,'')<=v_ret and coalesce(r.end_date,'')>=v_lend)
     and not exists (select 1 from nha_maintenance m
        where m.vehicle_code=v.code
          and coalesce(m.status,'') not in ('cancelled','canceled','キャンセル')
          and coalesce(m.start_date::text,'')<=v_ret and coalesce(nullif(m.end_date::text,''),m.start_date::text)>=v_lend)
   order by v.code limit 1 for update of v skip locked;
  if coalesce(p->>'_dry','')='1' then return jsonb_build_object('classTotal',v_base_total,'soldOut',(v_code is null)); end if;
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
end;$function$
;
