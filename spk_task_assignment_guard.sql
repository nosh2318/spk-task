-- ============================================================
-- 【SPK 札幌】担当(タスク割当) 恒久保護 — DBレベルの確固たる構造 (2026-06-24)
-- NHA版(nha_task_assignment_guard.sql)の札幌横展開。SPKは英語列。
--   担当=assignee / 予約=reservation_id / 種別=type / 表=tasks
-- 仕組み: 担当を (reservation_id × 役割) に紐づけ別表へ永続化。
--   - タスクが担当空で書かれたら保存済みを自動で埋め戻す(BEFORE)
--   - タスクに担当が入ったら保存表へ自動記録(AFTER)
--   アプリ/GAS/CSV/手動 どの経路で書いても DB が担当を守る(書き手非依存)。
-- ※ NHAと同一Supabaseプロジェクト(ckrxttbnawkclshczsia)。NHA版と同じSQL Editorで続けてRUN可。
-- ============================================================

create table if not exists spk_task_assignments (
  reservation_id text not null,
  role           text not null,   -- 'LEND'|'RETURN'|'WASH' もしくは種別そのもの
  assignee       text not null,
  updated_at     timestamptz not null default now(),
  primary key (reservation_id, role)
);
alter table spk_task_assignments enable row level security;

-- 役割判定: 主要種別はLEND/RETURN/WASHへ束ね、それ以外は種別をそのまま役割キーにする
-- (DEL/COL/洗車が担当の中心。送迎/その他/入庫等も予約紐づけがあれば保護される)
create or replace function spk_task_role(t text) returns text
language sql immutable as $$
  select case
    when t in ('DEL','送迎')            then 'LEND'
    when t in ('COL','乗捨回収','乗り捨て') then 'RETURN'
    when t like '%洗車%'                then 'WASH'
    else t end;
$$;

create or replace function spk_tasks_fill_assignee() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text; v_assignee text;
begin
  if NEW.reservation_id is null or btrim(NEW.reservation_id) = '' then return NEW; end if;
  v_role := spk_task_role(NEW.type);
  if v_role is null then return NEW; end if;
  if NEW.assignee is null or btrim(NEW.assignee) = '' then
    select assignee into v_assignee
      from spk_task_assignments
     where reservation_id = NEW.reservation_id and role = v_role;
    if v_assignee is not null then NEW.assignee := v_assignee; end if;
  end if;
  return NEW;
end; $$;

create or replace function spk_tasks_save_assignee() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if NEW.reservation_id is null or btrim(NEW.reservation_id) = '' then return NEW; end if;
  v_role := spk_task_role(NEW.type);
  if v_role is null then return NEW; end if;
  if NEW.assignee is not null and btrim(NEW.assignee) <> '' then
    insert into spk_task_assignments(reservation_id, role, assignee, updated_at)
    values (NEW.reservation_id, v_role, NEW.assignee, now())
    on conflict (reservation_id, role)
      do update set assignee = excluded.assignee, updated_at = now();
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_spk_tasks_fill on tasks;
create trigger trg_spk_tasks_fill
  before insert or update on tasks
  for each row execute function spk_tasks_fill_assignee();

drop trigger if exists trg_spk_tasks_save on tasks;
create trigger trg_spk_tasks_save
  after insert or update on tasks
  for each row execute function spk_tasks_save_assignee();

-- 既存担当をシード(役割ごと最新)
insert into spk_task_assignments(reservation_id, role, assignee, updated_at)
select distinct on (t.reservation_id, spk_task_role(t.type))
       t.reservation_id, spk_task_role(t.type), t.assignee, now()
from tasks t
where t.reservation_id is not null and btrim(t.reservation_id) <> ''
  and t.assignee       is not null and btrim(t.assignee)       <> ''
  and spk_task_role(t.type) is not null
order by t.reservation_id, spk_task_role(t.type), t.updated_at desc nulls last
on conflict (reservation_id, role) do nothing;

-- 確認: select count(*) from spk_task_assignments;
