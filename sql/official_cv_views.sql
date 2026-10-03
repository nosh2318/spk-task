-- ============================================================
-- 公式サイト(rent-handyman.com)の「決済完了＝真のCV」集計ビュー
-- 2026-10-03 / handyman-analytics.html のCVを #ctaBtnクリック→決済完了のみ に是正するため新設。
-- CV定義：Square課金成功で確定し、かつキャンセルされていない公式サイト予約
--         （札幌HDMS / 那覇HDMN / 高松HDMT）。
--   - 札幌/那覇(main DB)：keydrop_payments.status='paid'（official-pay EFが課金成功時に記録）
--                         × 予約が status<>'cancelled'（後からのキャンセルは除外）
--   - 高松(BT DB)      ：bt_reservations.paid=true × status not in ('cancelled','キャンセル')
-- 公開するのは area/day/件数の集計のみ。金額・氏名・生データは露出しない。
-- 補足：#ctaBtn は予約フロー5段共通の「次へ」ボタンなのでクリック＝CVではない（旧集計の誤り）。
-- ============================================================

-- ▼ main プロジェクト(ckrxttbnawkclshczsia／札幌・那覇) で実行 ------------------
create or replace view public.public_hdm_cv_v as
select area, (paid_at at time zone 'Asia/Tokyo')::date as day, count(*)::int as cv
from (
  select kp.reservation_id, kp.paid_at, 'sapporo'::text as area
    from public.keydrop_payments kp
    join public.reservations r on r.id = kp.reservation_id
   where kp.status = 'paid'
     and kp.reservation_id like 'HDMS%'
     and coalesce(r.status,'') <> 'cancelled'
  union all
  select kp.reservation_id, kp.paid_at, 'naha'::text as area
    from public.keydrop_payments kp
    join public.nha_reservations r on r.id = kp.reservation_id
   where kp.status = 'paid'
     and kp.reservation_id like 'HDMN%'
     and coalesce(r.status,'') <> 'cancelled'
) t
group by area, 2;

grant select on public.public_hdm_cv_v to anon, authenticated;


-- ▼ BT プロジェクト(ggqugvyskyiblxiycpci／高松) で実行 ------------------------
create or replace view public.public_bt_cv_v as
select
  'takamatsu'::text as area,
  (created_at at time zone 'Asia/Tokyo')::date as day,
  count(*)::int as cv
from public.bt_reservations
where paid = true
  and id like 'HDMT%'
  and coalesce(status,'') not in ('cancelled','キャンセル')
group by 1, 2;

grant select on public.public_bt_cv_v to anon, authenticated;
