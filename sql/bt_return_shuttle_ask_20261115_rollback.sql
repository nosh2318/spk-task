-- 戻し（BT）：質問の関数と表を外す。答えで変わった予約・タスクは通常の変更として残る（bt_reservation_changes に記録あり）
drop function if exists public.bt_mp_return_shuttle(text, text, text);
drop function if exists public.bt_mp_questions(text);
drop function if exists public.bt_mp_ask(text, text, text, text);
drop function if exists public.bt_undecided();
drop function if exists public._bt_rt_undecided(public.bt_reservations);
drop function if exists public._bt_rt_bd_ok(text);
-- mp_questions は記録なので残す（消す時だけ）：drop table if exists public.mp_questions;
