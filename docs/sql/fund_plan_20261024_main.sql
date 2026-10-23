-- 資金計画（hq 車両 > 資金計画）：整備ごとの「カードで払う日」（手入力）だけを持つ表。main。
-- 整備の日程・金額の正本は配車表（maintenance / nha_maintenance / bt_maintenance）。ここに書き写さない。
-- 1整備＝1行（key='<store>:<maint_id>'）。消す時は pay_date を null に（物理削除しない・DELETE 権限なし）。
begin;
create table public.hq_maint_pay(
  key text primary key,
  store text not null check (store in ('nha','spk','bt')),
  maint_id text not null,
  pay_date date,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  check (key = store||':'||maint_id)
);
alter table public.hq_maint_pay enable row level security;
revoke all on public.hq_maint_pay from anon, authenticated;
grant select, insert, update on public.hq_maint_pay to authenticated;
create policy hq_sel on public.hq_maint_pay for select to authenticated using ((select private.hq_is_me()));
create policy hq_ins on public.hq_maint_pay for insert to authenticated with check ((select private.hq_is_me()));
create policy hq_upd on public.hq_maint_pay for update to authenticated using ((select private.hq_is_me())) with check ((select private.hq_is_me()));
create policy kyoritsu_deny on public.hq_maint_pay as restrictive for all to authenticated using (not (select private.kyoritsu_is_me())) with check (not (select private.kyoritsu_is_me()));
create trigger trg_hq_touch before insert or update on public.hq_maint_pay for each row execute function public.hq_touch();
create trigger trg_audit_all after insert or update or delete on public.hq_maint_pay for each row execute function public._audit_row();
commit;
