-- 高松HANDYMAN 在庫集計RPC（BT project ggqugvyskyiblxiycpci）本番pg_get_functiondefの写し（2026-10-08取得）。
-- 要件3点を満たすことを確認済み：
--   ①日付は日付で比較：start_date/end_date を ::date にキャストして g.dt と比較（文字列比較しない）。
--   ②状態が空欄の予約を落とさない：coalesce(status,'') で空/NULLは NOT ILIKE '%ancel%' が真＝残す（キャンセルのみ除外）。
--   ③整備中を除く：maint列に整備台数を別集計（active − maint − booked が空車）。キャンセル整備は除外。
-- brand='HDM' 固定＝HANDYMAN高松のみ（BUDDICA TOURISM は含まない）。
CREATE OR REPLACE FUNCTION public.bt_hdm_availability(d1 date, d2 date)
 RETURNS TABLE(cls text, dt date, active integer, maint integer, booked integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH act AS (
    SELECT upper(v.type) cls, count(*) n
    FROM bt_vehicles v WHERE v.active AND v.brand='HDM' GROUP BY upper(v.type)
  ),
  days AS (SELECT generate_series(d1,d2,'1 day')::date AS dt),
  mt AS (
    SELECT upper(v.type) cls, g.dt, count(DISTINCT v.code) n
    FROM bt_maintenance m
    JOIN bt_vehicles v ON v.code=m.vehicle_code AND v.brand='HDM' AND v.active
    JOIN days g ON nullif(m.start_date,'')::date <= g.dt
              AND coalesce(nullif(m.end_date,'')::date, nullif(m.start_date,'')::date) >= g.dt
    WHERE coalesce(m.status,'') NOT ILIKE '%ancel%' AND coalesce(m.status,'') NOT LIKE '%キャンセル%'
    GROUP BY upper(v.type), g.dt
  ),
  bk AS (
    SELECT upper(r.vehicle_class) cls, g.dt, count(*) n
    FROM bt_reservations r
    JOIN days g ON nullif(r.start_date,'')::date <= g.dt AND nullif(r.end_date,'')::date >= g.dt
    WHERE r.brand='HDM'
      AND coalesce(r.status,'') NOT ILIKE '%ancel%' AND coalesce(r.status,'') NOT LIKE '%キャンセル%'
    GROUP BY upper(r.vehicle_class), g.dt
  )
  SELECT a.cls, g.dt, a.n::int, coalesce(mt.n,0)::int, coalesce(bk.n,0)::int
  FROM act a CROSS JOIN days g
  LEFT JOIN mt ON mt.cls=a.cls AND mt.dt=g.dt
  LEFT JOIN bk ON bk.cls=a.cls AND bk.dt=g.dt
  ORDER BY a.cls, g.dt;
$function$
