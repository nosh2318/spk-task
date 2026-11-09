-- 2026-11-09 nosh「楽天でLINEもメールもない人には、通知もその他の連絡も楽天経由で出す」
-- 楽天の予約はメール・電話がこちらに来ない。各通知の送り元が、届け先のない楽天予約の分をここに積み、
-- Mac mini の rax_line_mail.py が楽天RAX「予約者へメール送信」で送って status=sent にする。
-- 開封率タブ（mail-stats）は status=sent を「送った数」に数える。
create table if not exists public.rax_outbox (
  id bigserial primary key,
  store text not null check (store in ('spk','nha','tkm')),
  resv_no text not null,
  kind text not null,                 -- 通知の種類（mail_daybefore / arrival / reminder / rax_welcome など送り元の名前）
  subject text,
  body text not null,
  dkey text unique,                   -- 同じ通知を二度積まないための鍵（スタッフのボタン等は null＝毎回積む）
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  tries int not null default 0,
  err text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists rax_outbox_queued on public.rax_outbox (created_at) where status = 'queued';
create index if not exists rax_outbox_sent_at on public.rax_outbox (sent_at);
alter table public.rax_outbox enable row level security;
revoke all on public.rax_outbox from anon, authenticated;
