-- お客様のアクション → 運営のリアクション（確認しました＋時刻）。DROP なし・足すだけ
alter table public.mypage_nudges add column if not exists acked_at timestamptz;
alter table public.cs_chat_threads add column if not exists staff_seen_at timestamptz;
-- スタッフ画面のバッジをワンタップ＝確認（予約番号も照合）
create or replace function public.mypage_nudge_ack(p_id bigint, p_resv text) returns timestamptz language sql security definer set search_path=public as $$
  update public.mypage_nudges set acked_at=coalesce(acked_at,now()) where id=p_id and reservation_id=p_resv and created_at>now()-interval '12 hours' returning acked_at; $$;
revoke all on function public.mypage_nudge_ack(bigint, text) from public;
grant execute on function public.mypage_nudge_ack(bigint, text) to anon, authenticated;
-- 一覧（id と acked_at つき）。従来の mypage_nudges_recent は残す
create or replace function public.mypage_nudges_recent2(p_store text, p_ids text[]) returns table(id bigint, reservation_id text, kind text, leg text, created_at timestamptz, acked_at timestamptz) language sql stable security definer set search_path=public as $$
  select distinct on (n.reservation_id) n.id,n.reservation_id,n.kind,n.leg,n.created_at,n.acked_at from public.mypage_nudges n
  where n.store=p_store and n.reservation_id=any(p_ids) and n.created_at>now()-interval '12 hours' order by n.reservation_id,n.created_at desc; $$;
grant execute on function public.mypage_nudges_recent2(text,text[]) to anon, authenticated;
