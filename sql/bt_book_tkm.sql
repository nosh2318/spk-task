-- 高松HANDYMAN 公式予約RPC（BT project ggqugvyskyiblxiycpci）正本の写し。
-- 2026-10-08 本番pg_get_functiondefを取得し、C-3（高い日/安い日の空欄は基本料金で売る＝months.aが高い日に漏れない）を適用。
-- ⚠再RUN前に必ず本番の最新pg_get_functiondefと照合すること。SPK/NHA(official_book_spk_nha.sql)と同一ロジック。
CREATE OR REPLACE FUNCTION public.bt_book_tkm(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cls   text := upper(trim(coalesce(p->>'vehicleClass','')));
  v_lend  text := trim(coalesce(p->>'lend_date',''));
  v_ret   text := trim(coalesce(p->>'return_date',''));
  v_ltime text := coalesce(p->>'lend_time','');
  v_rtime text := coalesce(p->>'return_time','');
  v_ins   text := lower(coalesce(p->>'insuranceType','basic'));
  v_child int  := greatest(0, coalesce((p->>'childSeat')::int, 0));
  v_junior int := greatest(0, coalesce((p->>'juniorSeat')::int, 0));
  v_usb   int  := case when coalesce(p->>'usb','')='true' or coalesce(p->>'opt_usb','')='1' then 1 else 0 end;
  v_ppl   int  := least(8, greatest(1, coalesce((p->>'people')::int, 1)));
  v_name  text := trim(coalesce(p->>'name',''));
  v_mail  text := trim(coalesce(p->>'mail',''));
  v_tel   text := trim(coalesce(p->>'tel',''));
  v_model text := trim(coalesce(p->>'vehicleModel',''));
  v_delp  text := coalesce(p->>'del_place','');
  v_colp  text := coalesce(p->>'col_place','');
  v_note  text := left(coalesce(p->>'note',''),1000);
  v_vtype text := coalesce(nullif(p->>'visit_type',''),'送迎');
  v_rtype text := coalesce(nullif(p->>'return_type',''),'送迎');
  v_days  int; v_ins_daily int; v_ins_txt text;
  v_base_total int; v_opt_total int; v_total int;
  v_code  text; v_plate text; v_id text; v_try int := 0;
  v_m jsonb; v_pcls jsonb; v_high jsonb; v_a int; v_b int; v_dd date;
  v_cdw int; v_noc int; v_cfee int; v_jfee int; v_months jsonb; v_low jsonb; v_base int; v_mc jsonb; v_guard int;
  FALLBACK jsonb := '{"A":15000,"C":11000,"D":9000,"E":7500,"F":6500,"G":5500,"H":5500}';
begin
  if v_lend !~ '^\d{4}-\d{2}-\d{2}$' or v_ret !~ '^\d{4}-\d{2}-\d{2}$' or v_ret < v_lend then
    return jsonb_build_object('error','日付エラー');
  end if;
  if v_name='' or v_mail='' or position('@' in v_mail)=0 or v_tel='' then
    return jsonb_build_object('error','予約者情報が不足しています');
  end if;
  select value::jsonb->'tkm' into v_m from bt_app_settings where key='hdm_official_price';
  v_pcls := v_m->'price'->v_cls;
  v_a:=(v_pcls->>'a')::int; v_b:=(v_pcls->>'b')::int; v_base:=(v_pcls->>'base')::int; v_low:=coalesce(v_m->'low_dates','[]'::jsonb);
  -- FALLBACKはマスター全体欠損(v_m is null=DB未seed/到達不可)時のみ救済=サイトを止めない。マスターがあってクラス未設定(base/a/b全空)なら売り止め=空欄保存で0円請求を出さない(2026-09-23)
  if v_m is null then v_base:=coalesce(v_base,(FALLBACK->>v_cls)::int); end if;
  -- ★2026-10-08 C-3: v_a/v_b/v_base は生値のまま保持（互いに畳まない）。空欄は基本料金で売る＝months.aが高い日に漏れない。
  v_guard:=coalesce(v_base,v_a,v_b); -- 0/null請求を出さない保証値（基本→安→高の順で必ず非null）
  if v_guard is null then return jsonb_build_object('error','このクラスは現在オンライン予約を承れません'); end if;
  v_high := coalesce(v_m->'high_dates','[]'::jsonb); -- 月別料金 {"YYYY-MM":{クラス:{a:安い日,b:高い日,base:基本}}}
  v_cdw := coalesce((v_m->'insurance'->>'cdw')::int, 1100);
  v_noc := coalesce((v_m->'insurance'->>'noc')::int, 1650);
  v_cfee := coalesce((v_m->'seat'->>'child')::int, 1100);
  v_jfee := coalesce((v_m->'seat'->>'junior')::int, 550);

  v_days := (v_ret::date - v_lend::date) + 1;  -- ★暦日カウント(+1・返却日も1日)＝official-flow/KEYDROPと統一(過少請求根治 2026-09-15)
  if v_days < 1 then v_days := 1; end if;
  -- 日別 A(通常)/B(高) 合算（貸出日〜返却日の各暦日）
  v_base_total := 0;
  for v_dd in select generate_series(v_lend::date, v_ret::date, interval '1 day')::date loop -- その月・クラスの{a:通常,b:高}(未設定はデフォルトv_a)
    if v_high ? to_char(v_dd,'YYYY-MM-DD') then -- 高い日: months.b→price.b→months.base→price.base（months.aは見ない）
      v_base_total := v_base_total + coalesce((v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'b')::int,v_b,(v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'base')::int,v_base,v_guard);
    elsif v_low ? to_char(v_dd,'YYYY-MM-DD') then v_base_total := v_base_total + coalesce((v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'a')::int,v_a,(v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'base')::int,v_base,v_guard); else v_base_total := v_base_total + coalesce((v_m->'months'->to_char(v_dd,'YYYY-MM')->v_cls->>'base')::int,v_base,v_guard); end if;
  end loop;
  if v_base_total = 0 then
    if v_high ? to_char(v_lend::date,'YYYY-MM-DD') then
      v_base_total := coalesce((v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'b')::int,v_b,(v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'base')::int,v_base,v_guard);
    elsif v_low ? to_char(v_lend::date,'YYYY-MM-DD') then v_base_total := coalesce((v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'a')::int,v_a,(v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'base')::int,v_base,v_guard); else v_base_total := coalesce((v_m->'months'->to_char(v_lend::date,'YYYY-MM')->v_cls->>'base')::int,v_base,v_guard); end if;
  end if;
  v_ins_daily := case v_ins when 'cdw' then v_cdw when 'noc' then v_noc else 0 end;
  v_ins_txt   := case v_ins when 'cdw' then '免責' when 'noc' then 'フル' else 'なし' end;
  v_opt_total := (v_ins_daily * v_days) + ((v_cfee * v_child + v_jfee * v_junior) * v_days);
  v_total     := v_base_total + v_opt_total;
  if v_base_total <= 0 then
    return jsonb_build_object('error','この日程・クラスは価格未設定のためWeb予約を承れません');
  end if;

  -- 空車確保（同クラスactive・HDMブランド・期間重複なし）
  select v.code, v.plate_no into v_code, v_plate
  from bt_vehicles v
  where coalesce((select k.active from bt_vehicle_monthly_kpi k where k.vehicle_code=v.code and k.year_month=substr(v_lend,1,7)),v.active)=true and upper(v.type) = v_cls and coalesce(v.brand,'') = 'HDM' and coalesce(v.insurance_veh,false)=false
    and not exists (
      select 1 from bt_fleet f
      join bt_reservations r on r.id = f.reservation_id
      where f.vehicle_code = v.code
        and coalesce(r.status,'') not in ('cancelled','canceled','キャンセル')
        and coalesce(r.start_date,'') <= v_ret
        and coalesce(r.end_date,'')   >= v_lend
    )
    and not exists (
      select 1 from bt_maintenance m
      where m.vehicle_code = v.code
        and coalesce(m.status,'') not in ('cancelled','canceled','キャンセル')
        and coalesce(m.start_date::text,'') <= v_ret
        and coalesce(nullif(m.end_date::text,''), m.start_date::text) >= v_lend
    )
  order by v.code limit 1 for update of v skip locked;

  if coalesce(p->>'_dry','')='1' then return jsonb_build_object('classTotal',v_base_total,'soldOut',(v_code is null)); end if;
  if v_code is null then
    return jsonb_build_object('error','ご希望の期間は満車です。日程・クラスをご変更ください。','soldOut',true);
  end if;

  loop
    v_id := 'HDMT' || to_char(now() at time zone 'Asia/Tokyo','YYMMDD') || lpad((floor(random()*10000))::int::text,4,'0');
    exit when not exists (select 1 from bt_reservations where id = v_id);
    v_try := v_try + 1;
    if v_try > 20 then return jsonb_build_object('error','予約番号の採番に失敗しました'); end if;
  end loop;

  insert into bt_reservations
    (id, name, start_date, end_date, start_time, end_time, vehicle_class, vehicle_name, plate_no,
     source, status, tel, mail, ota, people, insurance, del_place, col_place,
     opt_c, opt_j, opt_usb, base_price, option_price, price, final_price, discount,
     visit_type, return_type, assigned_vehicle, prefecture, memo, mypage_token,
     booked_at, created_at, updated_at)
  values
    (v_id, v_name, v_lend, v_ret, v_ltime, v_rtime, v_cls, coalesce(nullif(v_model,''),v_cls||'クラス'), v_plate,
     'hdm_tkm', 'pending_payment', v_tel, v_mail, 'HANDYMAN', v_ppl, v_ins_txt, v_delp, v_colp,
     v_child, v_junior, v_usb, v_base_total, v_opt_total, v_total, v_total, 0,
     v_vtype, v_rtype, v_code, '香川県', v_note, gen_random_uuid(),
     now(), now(), now());

  insert into bt_fleet (reservation_id, vehicle_code, created_at)
  values (v_id, v_code, now());

  return jsonb_build_object('reservationId', v_id, 'total', v_total, 'classTotal', v_base_total, 'vehicle', v_code);
end;
$function$
