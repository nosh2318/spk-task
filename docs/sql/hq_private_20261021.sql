-- 統合ダッシュボード：請求書・カード支出の置き場所（main・新規のみ）。設計メモ §10・omni-review 条件 §10-3
begin;
-- 本社メンバー（閲覧・編集できる人＝uid 明示）
create table if not exists private.hq_members(uid uuid primary key, note text, created_at timestamptz default now());
revoke all on private.hq_members from public, anon, authenticated;
insert into private.hq_members(uid,note) values ('65cf2d5f-85eb-4cfe-9131-a4f7633f0681','オーナー（osh…@g-lines.jp）') on conflict do nothing;
create or replace function private.hq_is_me() returns boolean language sql stable security definer set search_path to '' as $$
  select exists(select 1 from private.hq_members m where m.uid = (select auth.uid()))
$$;
revoke all on function private.hq_is_me() from public, anon;
grant execute on function private.hq_is_me() to authenticated;
grant usage on schema private to authenticated;

-- 発行請求書（1請求書＝1行・id＝請求番号）
create sequence if not exists public.hq_issued_invoices_id_seq;
create table public.hq_issued_invoices(
  id int primary key default nextval('public.hq_issued_invoices_id_seq'),
  issue_date date, due_date date, recipient_name text, total bigint default 0,
  status text not null default 'unpaid', paid_date date,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid());
alter sequence public.hq_issued_invoices_id_seq owned by public.hq_issued_invoices.id;

-- カード明細の集計（追記のみ・画面は最新を読む）
create table public.hq_card_snapshots(
  id bigserial primary key, period_from text, period_to text, data jsonb not null,
  created_at timestamptz not null default now(), created_by uuid default auth.uid());

-- 加盟店ごとの科目振り分け（1加盟店＝1行）
create table public.hq_card_overrides(
  key text primary key, cat text, sub text,
  updated_at timestamptz not null default now(), updated_by uuid default auth.uid());

-- 更新者・更新時刻（UPDATE 時）
create or replace function public.hq_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end $$;
revoke all on function public.hq_touch() from public, anon, authenticated;
create trigger trg_hq_touch before update on public.hq_issued_invoices for each row execute function public.hq_touch();
create trigger trg_hq_touch before update on public.hq_card_overrides for each row execute function public.hq_touch();

-- 監査（既存と同じ）
create trigger trg_audit_all after insert or delete or update on public.hq_issued_invoices for each row execute function public._audit_row();
create trigger trg_audit_all after insert or delete or update on public.hq_card_snapshots for each row execute function public._audit_row();
create trigger trg_audit_all after insert or delete or update on public.hq_card_overrides for each row execute function public._audit_row();

-- 権限（既定 ACL を外し、ログイン者に SELECT/INSERT/UPDATE のみ。DELETE は付けない＝墓標）
revoke all on public.hq_issued_invoices, public.hq_card_snapshots, public.hq_card_overrides from public, anon, authenticated;
grant select, insert, update on public.hq_issued_invoices, public.hq_card_overrides to authenticated;
grant select, insert on public.hq_card_snapshots to authenticated;
revoke all on sequence public.hq_issued_invoices_id_seq, public.hq_card_snapshots_id_seq from public, anon, authenticated;
grant usage, select on sequence public.hq_issued_invoices_id_seq, public.hq_card_snapshots_id_seq to authenticated;

alter table public.hq_issued_invoices enable row level security;
alter table public.hq_card_snapshots enable row level security;
alter table public.hq_card_overrides enable row level security;
create policy hq_sel on public.hq_issued_invoices for select to authenticated using ((select private.hq_is_me()));
create policy hq_ins on public.hq_issued_invoices for insert to authenticated with check ((select private.hq_is_me()));
create policy hq_upd on public.hq_issued_invoices for update to authenticated using ((select private.hq_is_me())) with check ((select private.hq_is_me()));
create policy hq_sel on public.hq_card_snapshots for select to authenticated using ((select private.hq_is_me()));
create policy hq_ins on public.hq_card_snapshots for insert to authenticated with check ((select private.hq_is_me()));
create policy hq_sel on public.hq_card_overrides for select to authenticated using ((select private.hq_is_me()));
create policy hq_ins on public.hq_card_overrides for insert to authenticated with check ((select private.hq_is_me()));
create policy hq_upd on public.hq_card_overrides for update to authenticated using ((select private.hq_is_me())) with check ((select private.hq_is_me()));
-- 協力会社アカウントは常に拒否（既存と同型の RESTRICTIVE）
create policy kyoritsu_deny on public.hq_issued_invoices as restrictive for all to authenticated using (not (select private.kyoritsu_is_me())) with check (not (select private.kyoritsu_is_me()));
create policy kyoritsu_deny on public.hq_card_snapshots as restrictive for all to authenticated using (not (select private.kyoritsu_is_me())) with check (not (select private.kyoritsu_is_me()));
create policy kyoritsu_deny on public.hq_card_overrides as restrictive for all to authenticated using (not (select private.kyoritsu_is_me())) with check (not (select private.kyoritsu_is_me()));

-- 社印・会社情報（発行者・振込先）＝公開サイトに置かないため表に置く（本社メンバーだけ読み書き）
create table public.hq_settings(key text primary key, value text,
  updated_at timestamptz not null default now(), updated_by uuid default auth.uid());
create trigger trg_hq_touch before update on public.hq_settings for each row execute function public.hq_touch();
create trigger trg_audit_all after insert or delete or update on public.hq_settings for each row execute function public._audit_row();
revoke all on public.hq_settings from public, anon, authenticated;
grant select, insert, update on public.hq_settings to authenticated;
alter table public.hq_settings enable row level security;
create policy hq_sel on public.hq_settings for select to authenticated using ((select private.hq_is_me()));
create policy hq_ins on public.hq_settings for insert to authenticated with check ((select private.hq_is_me()));
create policy hq_upd on public.hq_settings for update to authenticated using ((select private.hq_is_me())) with check ((select private.hq_is_me()));
create policy kyoritsu_deny on public.hq_settings as restrictive for all to authenticated using (not (select private.kyoritsu_is_me())) with check (not (select private.kyoritsu_is_me()));
commit;
