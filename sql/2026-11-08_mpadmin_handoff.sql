-- 2026-11-08 マイページ管理（mypage-active.html）に「今日の受け渡しの進み具合」を出す（札幌・那覇）
-- 正本はスタッフが押した記録そのもの（OP・タスクサマリー・バイトURL・マイページと同じ）：
--   お届け/回収 = spk_line_sends / nha_line_sends（staff-action が1行残す）
--   送迎(PUB/BDB) = nha_tasks.sa_log
-- 返すのは マイページの鍵(mypage_token) ごとの「何を何時に押したか」だけ（宛先・文面・スタッフ名・位置は返さない）。
-- 高松は別DB：mpadmin_handoff_bt（buddica-touring/app の 2026-11-08_bt_shuttle_buttons.sql）。
-- 戻し：REVOKE EXECUTE ON FUNCTION public.mpadmin_handoff(text[]) FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.mpadmin_handoff(p_tokens text[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
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
    SELECT rs.token, s.action, s.sent_at AS at FROM rs JOIN spk_line_sends s ON rs.st='spk' AND s.resv_no = rs.id, d
     WHERE s.sent_at >= d.from_ts AND s.status IN ('sent','manual_done','done','no_userid')
    UNION ALL
    SELECT rs.token, s.action, s.sent_at FROM rs JOIN nha_line_sends s ON rs.st='nha' AND s.resv_no = rs.id, d
     WHERE s.sent_at >= d.from_ts AND s.status IN ('sent','manual_done','done','no_userid')
  ),
  ev AS (
    SELECT token,
           CASE action WHEN 'depart_mypage' THEN 'depart' WHEN 'mypage_depart' THEN 'depart'
                       WHEN 'collect_mypage' THEN 'collect' WHEN 'mypage_collect' THEN 'collect' ELSE action END AS k, at
      FROM ls WHERE action IN ('depart_mypage','mypage_depart','collect_mypage','mypage_collect','arrival','col_arrival','dropoff')
    UNION ALL
    SELECT rs.token, e->>'a', (e->>'at')::timestamptz
      FROM rs JOIN nha_tasks t ON rs.st='nha' AND t."予約番号" = rs.id, d,
           jsonb_array_elements(coalesce(t.sa_log,'[]'::jsonb)) e
     WHERE coalesce(t.deleted,false) = false AND t."内容" IN ('PUB','BDB','PU','BD')
       AND (e->>'at') IS NOT NULL AND (e->>'at')::timestamptz >= d.from_ts
  ),
  m AS (SELECT token, k, max(at) AS at FROM ev GROUP BY 1,2)
  SELECT coalesce(jsonb_object_agg(token, acts), '{}'::jsonb)
    FROM (SELECT token, jsonb_object_agg(k, to_char(at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')) AS acts FROM m GROUP BY token) x;
$function$;
REVOKE ALL ON FUNCTION public.mpadmin_handoff(text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.mpadmin_handoff(text[]) TO anon, authenticated;
