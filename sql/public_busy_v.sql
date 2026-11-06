create or replace view public.public_busy_v as
 SELECT f.vehicle_code,
    r.lend_date,
    r.return_date
   FROM fleet f
     JOIN reservations r ON r.id = f.reservation_id
  WHERE (COALESCE(r.status, ''::text) <> ALL (ARRAY['cancelled'::text, 'キャンセル'::text, 'cancel'::text])) AND r.return_date >= to_char(CURRENT_DATE::timestamp with time zone, 'YYYY-MM-DD'::text)
UNION ALL
 SELECT m.vehicle_code,
    m.start_date AS lend_date,
    COALESCE(NULLIF(m.end_date, ''::text), m.start_date) AS return_date
   FROM maintenance m
  WHERE (COALESCE(m.status, ''::text) <> ALL (ARRAY['cancelled'::text, 'キャンセル'::text, 'canceled'::text])) AND m.vehicle_code IS NOT NULL AND m.vehicle_code <> ''::text AND COALESCE(NULLIF(m.end_date, ''::text), m.start_date) >= to_char(CURRENT_DATE::timestamp with time zone, 'YYYY-MM-DD'::text);
