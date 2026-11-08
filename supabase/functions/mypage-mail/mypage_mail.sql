-- 2026-11-08 楽天客の通知用メール登録（main・BT の両方に同じものを入れる）
create table if not exists public.mypage_mail_log(
  id bigserial primary key,
  store text not null,
  reservation_id text not null,
  mail text not null,
  prev_mail text,
  created_at timestamptz not null default now()
);
create index if not exists mypage_mail_log_res on public.mypage_mail_log(store, reservation_id, created_at desc);
alter table public.mypage_mail_log enable row level security;  -- 画面からは読めない（EF だけが書く・読む）

-- 予約の取込・古い画面の保存でメールが空に戻らないようにする（空で上書きされたら元のアドレスを残す）
create or replace function public._keep_mail()
returns trigger language plpgsql as $$
begin
  if btrim(coalesce(new.mail,'')) = '' and btrim(coalesce(old.mail,'')) <> '' then
    new.mail := old.mail;
  end if;
  return new;
end $$;
-- main: 
--   drop trigger if exists a2_keep_mail on public.nha_reservations;  ← 使わない（DROP は確認が出るので create のみ）
-- 下の3行のうち、そのプロジェクトにあるテーブルの分だけ実行
-- create trigger a2_keep_mail before update of mail on public.nha_reservations for each row execute function public._keep_mail();
-- create trigger a2_keep_mail before update of mail on public.reservations     for each row execute function public._keep_mail();
-- create trigger a2_keep_mail before update of mail on public.bt_reservations  for each row execute function public._keep_mail();
