/* 2026-11-12 📈着地見込みタブ「空きの実数と、平均泊数で取れるか」用（読み取り専用）。
   今日〜月末の各日・クラス別に：台数（月次フラグで稼働）、整備中の台数、貸出中の予約台数（配車表 bt_fleet の車両のクラス・未配車は予約のクラス）。r28＝直近28日に受付した予約（返却が今日以降）の［件数, 貸出日数, うち明日〜月末に入る日数］。
   past＝過去3か月の同じ日付時点の、残り期間の貸出日数［後から入った日数, 受付済み日数, 後から入った件数, 後から入った分の売上, 受付済み分の売上］（売上＝予約売上を日割り）。tr＝受付件数［直近28日, その前の28日］。
   平均泊数＝直近3か月（前々月1日〜今日）に返却の予約の（返却日−貸出日+1）の平均（クラス＝配車された車両のクラス）。除外条件は bt_mtg_h2 と同じ */
create or replace function public.bt_mtg_free()
returns jsonb language sql stable security definer set search_path to 'public' as $function$
with t as (select (now() at time zone 'Asia/Tokyo')::date td),
d as (select g::date dt from t, generate_series(t.td, (date_trunc('month',t.td)+interval '1 month'-interval '1 day')::date, interval '1 day') g),
v as (select code, coalesce(nullif(type,''),'未配車') cls from bt_vehicles x, t
  where coalesce(x.type,'')<>'送迎' and coalesce(x.insurance_veh,false)=false
    and coalesce((select k.active from bt_vehicle_monthly_kpi k where k.vehicle_code=x.code and k.year_month=to_char(t.td,'YYYY-MM')), x.active) is true),
mt as (select distinct v.code, d.dt from v join bt_maintenance m on m.vehicle_code=v.code and m.start_date ~ '^\d{4}-\d{2}-\d{2}'
  join d on d.dt between m.start_date::date and coalesce(nullif(m.end_date,'')::date, m.start_date::date)),
r as (select res.id, res.start_date::date sd, res.end_date::date ed, coalesce(vv.cls, nullif(res.vehicle_class,''), '未配車') cls, (res.created_at at time zone 'Asia/Tokyo')::date cd,
    (case when coalesce(res.base_price,0)>0 or coalesce(res.option_price,0)>0 then coalesce(res.base_price,0)+coalesce(res.option_price,0)-coalesce(res.discount,0) else coalesce(res.price,0) end)::numeric rev
  from bt_reservations res left join bt_fleet f on f.reservation_id=res.id left join (select code, coalesce(nullif(type,''),'未配車') cls from bt_vehicles) vv on vv.code=f.vehicle_code
  where res.start_date ~ '^\d{4}-\d{2}-\d{2}' and res.end_date ~ '^\d{4}-\d{2}-\d{2}'
    and coalesce(res.status,'') not in ('キャンセル','cancelled','canceled')
    and res.id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)'
    and coalesce(res.name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)'
    and coalesce(res.name,'') <> ''
    and res.end_date::date >= (select (date_trunc('month',td)-interval '3 month')::date from t)),
/* 過去3か月の同じ日付（dm）時点：残り期間（dm+1〜月末）の貸出日数を、dm までに受付済み(bk)／dm より後に受付(pu＝当月内に後から入った分)に分ける */
pm as (select to_char(g,'YYYY-MM') ym, (g+interval '1 month'-interval '1 day')::date me,
    least((g+interval '1 month'-interval '1 day')::date, g::date + (extract(day from t.td)::int-1)) dm
  from t, generate_series(date_trunc('month',t.td)-interval '3 month', date_trunc('month',t.td)-interval '1 month', interval '1 month') g),
pp as (select pm.ym, r.cls,
    coalesce(sum(least(r.ed,pm.me)-greatest(r.sd,pm.dm+1)+1) filter (where r.cd > pm.dm),0) pu,
    coalesce(sum(least(r.ed,pm.me)-greatest(r.sd,pm.dm+1)+1) filter (where r.cd <= pm.dm),0) bk,
    count(*) filter (where r.cd > pm.dm) pc,
    coalesce(round(sum(r.rev/(r.ed-r.sd+1)*(least(r.ed,pm.me)-greatest(r.sd,pm.dm+1)+1)) filter (where r.cd > pm.dm)),0) pr,
    coalesce(round(sum(r.rev/(r.ed-r.sd+1)*(least(r.ed,pm.me)-greatest(r.sd,pm.dm+1)+1)) filter (where r.cd <= pm.dm)),0) br
  from pm join r on r.sd <= pm.me and r.ed > pm.dm group by 1,2),
cap as (select d.dt, v.cls, count(*) n, count(mt.code) m from d cross join v left join mt on mt.code=v.code and mt.dt=d.dt group by 1,2),
occ as (select d.dt, r.cls, count(*) b from d join r on d.dt between r.sd and r.ed group by 1,2),
cl as (select cls from cap union select cls from occ)
select jsonb_build_object(
  'today', (select to_char(td,'YYYY-MM-DD') from t),
  'cls', coalesce((select jsonb_object_agg(cl.cls, jsonb_build_object(
      'n', (select coalesce(jsonb_agg(coalesce(c.n,0) order by d.dt),'[]') from d left join cap c on c.dt=d.dt and c.cls=cl.cls),
      'm', (select coalesce(jsonb_agg(coalesce(c.m,0) order by d.dt),'[]') from d left join cap c on c.dt=d.dt and c.cls=cl.cls),
      'b', (select coalesce(jsonb_agg(coalesce(o.b,0) order by d.dt),'[]') from d left join occ o on o.dt=d.dt and o.cls=cl.cls))) from cl),'{}'::jsonb),
  'r28', coalesce((select jsonb_object_agg(cls, jsonb_build_array(c, dd, dw)) from (select cls, count(*) c, sum(ed-sd+1) dd,
      sum(greatest(0, least(ed, (date_trunc('month',t.td)+interval '1 month'-interval '1 day')::date) - greatest(sd, t.td+1) + 1)) dw
      from r, t where r.cd > t.td-28 and r.ed >= t.td group by cls) z),'{}'::jsonb),
  'past', coalesce((select jsonb_object_agg(pm.ym, jsonb_build_object('rest', pm.me-pm.dm, 'cls', coalesce((select jsonb_object_agg(pp.cls, jsonb_build_array(pp.pu, pp.bk, pp.pc, pp.pr, pp.br)) from pp where pp.ym=pm.ym),'{}'::jsonb))) from pm),'{}'::jsonb),
  'tr', coalesce((select jsonb_object_agg(cls, jsonb_build_array(a, b)) from (select cls, count(*) filter (where r.cd > t.td-28) a, count(*) filter (where r.cd <= t.td-28 and r.cd > t.td-56) b from r, t group by cls) z),'{}'::jsonb),
  'avg', coalesce((select jsonb_object_agg(cls, a) from (select cls, jsonb_build_array(round(avg(ed-sd+1),2), count(*)) a from r, t where r.ed <= t.td group by cls) z),'{}'::jsonb)
);
$function$;
grant execute on function public.bt_mtg_free() to anon, authenticated;
