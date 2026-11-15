-- 2026-11-15 札幌：傷の確認・承認（マイページ）が済んだかをスタッフ画面（OP・スタッフページ・タスクサマリー）に出す
--   正本＝handover_signatures（store='spk', sign_type='damage_approve'・mypage-info の damage_ok が書く）。表は RLS で policy 無し＝スタッフは直接読めない。
--   読むだけの関数を足す（書込なし）。呼べるのは ①ログイン中のスタッフ（APP・協力会社アカウントは除く）②スタッフ個別URLの鍵（staff.share_token・有効なスタッフ）だけ。
--   返すのは 予約番号・貸出日・承認時刻 だけ（お名前・署名は返さない）。既存 op_mp_flags は触らない（返り値を変えると他の呼び元に響くため）。
--   対象＝貸出日が 31日前〜明日（かつ 2026-11-10 以降）の、キャンセルでない予約。approved_at が null＝未承認。
--   公開時刻（出発日 8:00 JST）の判定は画面側でする（マイページ・mypage-info と同じ規則）。
create or replace function public.op_damage_status(p_store text, p_token uuid default null)
returns table(reservation_id text, lend_date text, approved_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.lend_date,
         (select max(s.signed_at) from handover_signatures s
           where s.store = 'spk' and s.sign_type = 'damage_approve' and s.reservation_id = r.id)
    from reservations r
   where p_store = 'spk'
     and ( ((select auth.role()) = 'authenticated' and not coalesce((select private.kyoritsu_is_me()), false))
        or (p_token is not null and exists (select 1 from staff st where st.share_token = p_token and coalesce(st.active, true))) )
     and r.lend_date >= '2026-11-10'  -- マイページの承認は 11/09 開始（初回 11/10）。それより前の出発は承認の手段が無かった＝未承認に数えない
     and r.lend_date >= to_char((now() at time zone 'Asia/Tokyo')::date - 31, 'YYYY-MM-DD')
     and r.lend_date <= to_char((now() at time zone 'Asia/Tokyo')::date + 1, 'YYYY-MM-DD')
     and coalesce(r.status, '') not in ('キャンセル', 'cancelled', 'cancel');
$function$;

revoke all on function public.op_damage_status(text, uuid) from public;
grant execute on function public.op_damage_status(text, uuid) to anon, authenticated;

-- 戻し方:
-- drop function if exists public.op_damage_status(text, uuid);
