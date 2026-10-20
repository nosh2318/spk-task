-- 2026-10-20 SPK MTG 設計比較タブ「ネクストアクション」用：予約ペース（取込カーブ）と直近の単価・ペース。読み取り専用。
-- 定義は spk_mtg_h2 と同じ（キャンセル/テスト除外・rev式・貸出日〜返却日を両端含む日数・クラス＝vehicle）。
--  hist : 3〜9月の貸出日について「貸出日−受付日(JST)」の日数(0〜180に丸め)ごとの貸出日数 {cls:{lead:n}}
--  fut  : 今日以降の貸出日ごとの予約済み貸出日数 {cls:{date:n}}
--  recent: 今日以降に貸出がある予約の、受付が直近14日(w2)／その前42日(w6)の 貸出日数・売上 {cls:{w2:[days,rev],w6:[days,rev]}}
-- rollback: drop function public.spk_mtg_pace();
create or replace function public.spk_mtg_pace()
returns jsonb language sql stable security definer set search_path to 'public' as $$
with t as (select (now() at time zone 'Asia/Tokyo')::date td),
r as (
  select coalesce(nullif(res.vehicle,''),'未配車') cls, res.lend_date::date sd, res.return_date::date ed,
    (res.created_at at time zone 'Asia/Tokyo')::date cd,
    case when coalesce(res.base_price,0)>0 or coalesce(res.option_price,0)>0
      then coalesce(res.base_price,0)+coalesce(res.option_price,0)-coalesce(res.discount,0)
      else coalesce(res.price,0) end rev
  from reservations res
  where res.lend_date ~ '^\d{4}-\d{2}-\d{2}' and res.return_date ~ '^\d{4}-\d{2}-\d{2}'
    and res.return_date::date >= '2026-03-01'
    and coalesce(res.status,'') not in ('キャンセル','cancelled','canceled')
    and res.id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)'
    and coalesce(res.name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)'
    and coalesce(res.name,'') <> ''
),
d as (select r.cls, g::date dt, r.cd, r.rev::numeric/greatest(1,(r.ed-r.sd+1)) dp from r cross join generate_series(r.sd, r.ed, interval '1 day') g)
select jsonb_build_object(
  'today', (select to_char(td,'YYYY-MM-DD') from t),
  'hist', coalesce((select jsonb_object_agg(cls, h) from (select cls, jsonb_object_agg(lead, n) h from (
      select cls, least(greatest(dt-cd,0),180) lead, count(*) n from d where dt between '2026-03-01' and '2026-09-30' group by 1,2) a group by cls) b),'{}'::jsonb),
  'fut', coalesce((select jsonb_object_agg(cls, h) from (select cls, jsonb_object_agg(to_char(dt,'YYYY-MM-DD'), n) h from (
      select cls, dt, count(*) n from d, t where dt >= t.td group by 1,2) a group by cls) b),'{}'::jsonb),
  'recent', coalesce((select jsonb_object_agg(cls, jsonb_build_object('w2', jsonb_build_array(d2, r2), 'w6', jsonb_build_array(d6, r6))) from (
      select cls,
        count(*) filter (where cd > t.td-14) d2, coalesce(round(sum(dp) filter (where cd > t.td-14)),0) r2,
        count(*) filter (where cd <= t.td-14 and cd > t.td-56) d6, coalesce(round(sum(dp) filter (where cd <= t.td-14 and cd > t.td-56)),0) r6
      from d, t where dt >= t.td group by cls) a),'{}'::jsonb)
);
$$;
grant execute on function public.spk_mtg_pace() to anon, authenticated;
