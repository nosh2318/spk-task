-- 2026-11-09 LINEのない人にメールで送った知らせ（status='mailed'）もマイページが読む。02 との違いは status に 'mailed' を足しただけ。
-- 2026-11-09 nosh「既存の遅延ボタンが生きてれば」：札幌のマイページがスタッフの遅延ボタン（del_delay/col_delay）を読めるようにする。
-- 返す値に del_delay / col_delay（押した時刻）と del_delay_to / col_delay_to（スタッフが選んだ到着予定「HH:MM」）を足すだけ。ほかは同じ。
CREATE OR REPLACE FUNCTION public.mpadmin_handoff(p_tokens text[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH tk AS (
    SELECT DISTINCT x AS token FROM unnest(coalesce(p_tokens,'{}'::text[])) x
     WHERE length(coalesce(x,'')) >= 20 LIMIT 500
  ),
  d AS (SELECT (((now() at time zone 'Asia/Tokyo')::date)::timestamp at time zone 'Asia/Tokyo') AS from_ts,
               (now() at time zone 'Asia/Tokyo')::date AS today),
  rs AS (
    SELECT 'spk'::text AS st, r.id, r.mypage_token::text AS token FROM reservations r JOIN tk ON tk.token = r.mypage_token::text
    UNION ALL
    SELECT 'nha', r.id, r.mypage_token::text FROM nha_reservations r JOIN tk ON tk.token = r.mypage_token::text
  ),
  ls AS (
    SELECT rs.token, s.action, s.sent_at AS at, s.message FROM rs JOIN spk_line_sends s ON rs.st='spk' AND s.resv_no = rs.id, d
     WHERE s.sent_at >= d.from_ts AND s.status IN ('sent','manual_done','done','no_userid','mailed')
    UNION ALL
    SELECT rs.token, s.action, s.sent_at, s.message FROM rs JOIN nha_line_sends s ON rs.st='nha' AND s.resv_no = rs.id, d
     WHERE s.sent_at >= d.from_ts AND s.status IN ('sent','manual_done','done','no_userid','mailed')
  ),
  ev AS (
    SELECT token,
           CASE action WHEN 'depart_mypage' THEN 'depart' WHEN 'mypage_depart' THEN 'depart'
                       WHEN 'collect_mypage' THEN 'collect' WHEN 'mypage_collect' THEN 'collect' ELSE action END AS k, at
      FROM ls WHERE action IN ('depart_mypage','mypage_depart','collect_mypage','mypage_collect','arrival','col_arrival','dropoff','del_delay','col_delay')
    UNION ALL
    SELECT rs.token, e->>'a', (e->>'at')::timestamptz
      FROM rs JOIN nha_tasks t ON rs.st='nha' AND t."予約番号" = rs.id, d,
           jsonb_array_elements(coalesce(t.sa_log,'[]'::jsonb)) e
     WHERE coalesce(t.deleted,false) = false AND t."内容" IN ('PUB','BDB','PU','BD')
       AND (e->>'at') IS NOT NULL AND (e->>'at')::timestamptz >= d.from_ts
  ),
  m AS (SELECT token, k, to_char(max(at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS v FROM ev GROUP BY 1,2),
  dl AS (  -- 遅延：いちばん新しい1件の「HH:MM」
    SELECT DISTINCT ON (token, action) token, action || '_to' AS k,
           substring(message from '「\s*([0-9]{1,2}:[0-9]{2})\s*」') AS v
      FROM ls WHERE action IN ('del_delay','col_delay')
     ORDER BY token, action, at DESC
  ),
  allv AS (SELECT token,k,v FROM m UNION ALL SELECT token,k,v FROM dl WHERE v IS NOT NULL)
  SELECT coalesce(jsonb_object_agg(token, acts), '{}'::jsonb)
    FROM (SELECT token, jsonb_object_agg(k, v) AS acts FROM allv GROUP BY token) x;
$function$;
