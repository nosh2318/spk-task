-- 2026-11-09 楽天の画面（RAX「予約者へメール送信」）から送ったメールの記録。開封率タブの「送った数」に入れるため。
-- 書くのは Mac mini の rax_line_mail.py（service role）だけ。お客様の画面からは読まない。
create table if not exists public.rax_mail_log (
  id bigserial primary key,
  store text not null check (store in ('spk','nha','tkm')),
  resv_no text not null,
  kind text not null,            -- rax_welcome / rax_prep_d3 / rax_prep_d2 / rax_daybefore
  sent_at timestamptz not null default now(),
  unique (store, resv_no, kind)
);
create index if not exists rax_mail_log_sent_at on public.rax_mail_log (sent_at);
alter table public.rax_mail_log enable row level security;
revoke all on public.rax_mail_log from anon, authenticated;
