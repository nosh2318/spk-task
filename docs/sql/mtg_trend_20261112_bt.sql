/* 2026-11-12 📈着地見込みタブ「当月推移」用：返却月ごとの予約売上が、受付日(created_at JST)ごとにどう積み上がったか。
   対象＝今月の3か月前〜3か月後の返却月。売上・除外条件は bt_mtg_h2 と同じ（キャンセル/テスト除外・返却月計上）。off＝受付日−返却月の1日（日・−90で打ち切り） */
create or replace function public.bt_mtg_trend()
returns jsonb language sql stable security definer set search_path to 'public' as $function$
with t as (select (now() at time zone 'Asia/Tokyo')::date td),
mb as (select to_char(gs,'YYYY-MM') ym, gs::date ms from t, generate_series(date_trunc('month',t.td)-interval '3 month', date_trunc('month',t.td)+interval '3 month', interval '1 month') gs),
r as (
  select substr(res.end_date,1,7) ym, (res.created_at at time zone 'Asia/Tokyo')::date cd,
    case when coalesce(res.base_price,0)>0 or coalesce(res.option_price,0)>0
      then coalesce(res.base_price,0)+coalesce(res.option_price,0)-coalesce(res.discount,0)
      else coalesce(res.price,0) end rev
  from bt_reservations res
  where substr(coalesce(res.end_date,''),1,7) in (select ym from mb)
    and coalesce(res.status,'') not in ('キャンセル','cancelled','canceled')
    and res.id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)'
    and coalesce(res.name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)'
    and coalesce(res.name,'') <> ''
),
g as (select r.ym, greatest(-90, r.cd - mb.ms) off, sum(r.rev)::bigint rv, count(*) n from r join mb on mb.ym=r.ym group by 1,2)
select jsonb_build_object(
  'today', (select to_char(td,'YYYY-MM-DD') from t),
  'mon', coalesce((select jsonb_object_agg(ym, s) from (select ym, jsonb_agg(jsonb_build_array(off,rv,n) order by off) s from g group by ym) z),'{}'::jsonb)
);
$function$;
grant execute on function public.bt_mtg_trend() to anon, authenticated;
