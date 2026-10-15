-- 協力会社 清算（請求書）2026-10-15（オーナー指定で改訂：partner.html コスト一覧で車両を選んで請求書を作る）
-- 請求者＝協力会社（共立：マツダオートザム札幌インター（株式会社共立自動車））、宛先＝株式会社Global Lines。
-- 作成＝partner.html（協力会社アカウント＝自社分のみ）または HANDYMAN スタッフ。受領確認＝スタッフのみ。
-- 既存の予約・配車・車両・会計は書き換えない。取消は墓標（deleted=true）。金額はサーバー側で計算（画面の値を信用しない）。

create table if not exists public.partner_settlements (
  id            bigint generated always as identity primary key,
  doc_no        text not null unique,                 -- INV-YYYYMM-NNN
  doc_type      text not null default '請求書',
  owner_company text not null,
  issuer_name   text not null,                        -- 請求者（例：マツダオートザム札幌インター（株式会社共立自動車））
  addressee     text not null default '株式会社Global Lines',
  issue_date    date not null default (now() at time zone 'Asia/Tokyo')::date,
  total_in      integer not null,                     -- 税込（Σ 日額×日数）
  subtotal_ex   integer not null,                     -- 税抜 = floor(total_in*10/11)
  tax           integer not null,                     -- total_in - subtotal_ex
  item_count    integer not null,
  memo          text,
  created_by    text,
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz,
  confirmed_by  text,
  deleted       boolean not null default false,
  deleted_at    timestamptz,
  deleted_by    text
);

create table if not exists public.partner_settlement_items (
  id             bigint generated always as identity primary key,
  settlement_id  bigint not null references public.partner_settlements(id),
  reservation_id text not null,
  vehicle_code   text not null,
  plate_no       text,
  vehicle_name   text,
  lend_date      text,
  return_date    text,
  days           integer not null,
  daily_cost     integer not null,                    -- 税込（vehicles.partner_daily_cost の作成時点の値）
  amount_in      integer not null,                    -- daily_cost*days
  deleted        boolean not null default false
);
-- 二重清算を DB で止める：有効な明細で同じ予約は1回だけ
create unique index if not exists partner_settlement_items_resv_uq
  on public.partner_settlement_items(reservation_id) where deleted = false;
create index if not exists partner_settlement_items_sid on public.partner_settlement_items(settlement_id);

alter table public.partner_settlements enable row level security;
alter table public.partner_settlement_items enable row level security;
revoke all on public.partner_settlements, public.partner_settlement_items from anon;
revoke insert, update, delete, truncate on public.partner_settlements, public.partner_settlement_items from authenticated;
grant select on public.partner_settlements, public.partner_settlement_items to authenticated;

-- 自社の分だけ読める。判定（omni-review 条件1：フェイルクローズ）：
--   共立 UUID → 'PARTNER_TEST'／app_metadata.owner_company あり → その値（本人は書き換え不可）
--   スタッフのドメイン（g-lines.jp・spk.hdm・nha.hdm）→ null＝スタッフ／それ以外（自己登録など）→ '__none__'＝どの会社にも一致しない
--   user_metadata は本人が書き換えられるので見ない。
create or replace function private.partner_settle_owner() returns text
language sql stable security definer set search_path to '' as $$
  select case
    when (select private.kyoritsu_is_me()) then 'PARTNER_TEST'
    when coalesce((select auth.jwt()) -> 'app_metadata' ->> 'owner_company','') <> '' then (select auth.jwt()) -> 'app_metadata' ->> 'owner_company'
    when lower(split_part(coalesce((select auth.jwt()) ->> 'email',''),'@',2)) in ('g-lines.jp','spk.hdm','nha.hdm') then null
    else '__none__'
  end
$$;
drop policy if exists ps_sel on public.partner_settlements;
create policy ps_sel on public.partner_settlements for select to authenticated
  using ((select private.partner_settle_owner()) is null or owner_company = (select private.partner_settle_owner()));
drop policy if exists psi_sel on public.partner_settlement_items;
create policy psi_sel on public.partner_settlement_items for select to authenticated
  using ((select private.partner_settle_owner()) is null
         or settlement_id in (select s.id from public.partner_settlements s where s.owner_company = (select private.partner_settle_owner())));

-- 作成（協力会社＝自社分のみ／スタッフ）：対象＝その協力会社の車両に配車・返却日が今日より前・キャンセル以外・未請求
create or replace function public.partner_settlement_create(p_owner text, p_ids text[], p_issuer text, p_memo text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_today text := to_char(now() at time zone 'Asia/Tokyo','YYYY-MM-DD');
  v_ym text := to_char(now() at time zone 'Asia/Tokyo','YYYYMM');
  v_me text := (select private.partner_settle_owner());
  v_n int; v_total int; v_id bigint; v_no text; v_seq int; v_by text;
begin
  if (select auth.uid()) is null then raise exception 'login required' using errcode='42501'; end if;
  if v_me is not null and v_me <> p_owner then raise exception 'own company only' using errcode='42501'; end if;
  if p_owner is null or p_ids is null or array_length(p_ids,1) is null then raise exception 'owner and ids required' using errcode='22023'; end if;
  if coalesce(trim(p_issuer),'') = '' then raise exception 'issuer required' using errcode='22023'; end if;
  v_by := coalesce((select auth.jwt()) ->> 'email','');
  -- 同時作成でも2人目が「対象外」で止まるよう、対象の確定より前に排他（omni-review 推奨）
  perform pg_advisory_xact_lock(hashtext('partner_settlement_no'));
  drop table if exists _t;
  create temp table _t on commit drop as
  select r.id rid, f.vehicle_code vc, v.plate_no, v.name vname,
         substr(r.lend_date,1,10) ld, substr(r.return_date,1,10) rd,
         greatest(1, (substr(r.return_date,1,10)::date - substr(r.lend_date,1,10)::date) + 1) d,
         coalesce(v.partner_daily_cost,0)::int dc
  from public.reservations r
  join public.fleet f on f.reservation_id = r.id
  join public.vehicles v on v.code = f.vehicle_code
  where r.id = any(p_ids)
    and v.owner_company = p_owner
    and coalesce(r.status,'') not in ('cancelled','キャンセル','canceled')
    and substr(r.return_date,1,10) < v_today
    and coalesce(v.partner_daily_cost,0) > 0
    and not exists (select 1 from public.partner_settlement_items i where i.reservation_id = r.id and i.deleted = false);

  select count(*), coalesce(sum(d*dc),0) into v_n, v_total from _t;
  if v_n <> array_length(p_ids,1) then
    raise exception '対象外の予約が含まれています（%件中%件が対象）', array_length(p_ids,1), v_n using errcode='22023';
  end if;

  select coalesce(max(substr(doc_no,12)::int),0)+1 into v_seq from public.partner_settlements where doc_no like 'INV-'||v_ym||'-%';
  v_no := 'INV-'||v_ym||'-'||lpad(v_seq::text,3,'0');

  insert into public.partner_settlements(doc_no, owner_company, issuer_name, total_in, subtotal_ex, tax, item_count, memo, created_by)
  values (v_no, p_owner, left(trim(p_issuer),120), v_total, (v_total*10)/11, v_total - (v_total*10)/11, v_n, p_memo, v_by)
  returning id into v_id;
  insert into public.partner_settlement_items(settlement_id, reservation_id, vehicle_code, plate_no, vehicle_name, lend_date, return_date, days, daily_cost, amount_in)
  select v_id, rid, vc, plate_no, vname, ld, rd, d, dc, d*dc from _t;

  return jsonb_build_object('id', v_id, 'doc_no', v_no, 'total_in', v_total, 'items', v_n);
end $$;

-- HANDYMAN の受領確認（スタッフのみ・1回だけ）
create or replace function public.partner_settlement_confirm(p_id bigint)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if (select auth.uid()) is null then raise exception 'login required' using errcode='42501'; end if;
  if (select private.partner_settle_owner()) is not null then raise exception 'staff only' using errcode='42501'; end if;
  update public.partner_settlements
     set confirmed_at = now(), confirmed_by = coalesce((select auth.jwt()) ->> 'email','')
   where id = p_id and deleted = false and confirmed_at is null;
end $$;

-- 取消（作った協力会社＝自社分／スタッフ。HANDYMAN が受領確認する前だけ・墓標）
create or replace function public.partner_settlement_void(p_id bigint)
returns void language plpgsql security definer set search_path to '' as $$
declare v_me text := (select private.partner_settle_owner());
begin
  if (select auth.uid()) is null then raise exception 'login required' using errcode='42501'; end if;
  update public.partner_settlements set deleted = true, deleted_at = now(), deleted_by = coalesce((select auth.jwt()) ->> 'email','')
   where id = p_id and deleted = false and confirmed_at is null
     and (v_me is null or owner_company = v_me);
  if found then update public.partner_settlement_items set deleted = true where settlement_id = p_id; end if;
end $$;

revoke all on function public.partner_settlement_create(text,text[],text,text), public.partner_settlement_confirm(bigint), public.partner_settlement_void(bigint) from public, anon;
grant execute on function public.partner_settlement_create(text,text[],text,text), public.partner_settlement_confirm(bigint), public.partner_settlement_void(bigint) to authenticated;
-- 変更履歴（audit_log）に残す（既存表と同じ汎用トリガー）
drop trigger if exists trg_audit_all on public.partner_settlements;
create trigger trg_audit_all after insert or update or delete on public.partner_settlements for each row execute function public._audit_row();
drop trigger if exists trg_audit_all on public.partner_settlement_items;
create trigger trg_audit_all after insert or update or delete on public.partner_settlement_items for each row execute function public._audit_row();

revoke all on function private.partner_settle_owner() from public, anon;
grant execute on function private.partner_settle_owner() to authenticated;
