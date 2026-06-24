-- ============================================================
-- 【SPK 札幌】タスク重複collapse — 「同じ予約×役割は1行」をDBで強制 (2026-06-24)
-- NHA版(nha_task_dedup_guard.sql)の札幌横展開。SPKは英語列(tasks)。
-- 依存: spk_task_role() / spk_task_assignments (spk_task_assignment_guard.sql) を先にRUN済み。
-- ============================================================

create or replace function spk_tasks_collapse_dup() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text; ex tasks%rowtype;
begin
  if NEW.reservation_id is null or btrim(NEW.reservation_id) = '' then return NEW; end if;
  v_role := spk_task_role(NEW.type);
  -- collapseは中核役割のみ(DEL/COL/洗車/送迎)。その他/入庫等は畳まない(別物の可能性)
  if v_role not in ('LEND','RETURN','WASH') then return NEW; end if;
  select * into ex from tasks
   where reservation_id = NEW.reservation_id
     and spk_task_role(type) = v_role
     and _id <> NEW._id
   order by (case when btrim(coalesce(assignee,'')) <> '' then 0 else 1 end),
            updated_at desc nulls last
   limit 1;
  if not found then return NEW; end if;
  update tasks set
    date          = NEW.date,
    type          = NEW.type,
    time          = coalesce(nullif(btrim(NEW.time),''),      tasks.time),
    name          = coalesce(nullif(btrim(NEW.name),''),      tasks.name),
    assignee      = coalesce(nullif(btrim(NEW.assignee),''),  tasks.assignee),
    assignee_custom = coalesce(nullif(btrim(NEW.assignee_custom),''), tasks.assignee_custom),
    done          = NEW.done,
    memo          = coalesce(nullif(btrim(NEW.memo),''),      tasks.memo),
    place         = coalesce(nullif(btrim(NEW.place),''),     tasks.place),
    col_place     = coalesce(nullif(btrim(NEW.col_place),''), tasks.col_place),
    plate_no      = coalesce(nullif(btrim(NEW.plate_no),''),  tasks.plate_no),
    assigned_vehicle = coalesce(nullif(btrim(NEW.assigned_vehicle),''), tasks.assigned_vehicle),
    return_time   = coalesce(nullif(btrim(NEW.return_time),''), tasks.return_time),
    ota = NEW.ota, tel = NEW.tel, mail = NEW.mail, people = NEW.people,
    vehicle = NEW.vehicle, insurance = NEW.insurance, insurance_change = NEW.insurance_change,
    flight = NEW.flight, return_date = NEW.return_date,
    opt_b = NEW.opt_b, opt_c = NEW.opt_c, opt_j = NEW.opt_j, opt_usb = NEW.opt_usb,
    opt_parasol = NEW.opt_parasol, yakkan = NEW.yakkan, line = NEW.line, payment = NEW.payment,
    sort_order = NEW.sort_order, changed_json = NEW.changed_json,
    updated_at = now()
  where _id = ex._id;
  return null;
end; $$;

drop trigger if exists trg_spk_tasks_collapse_dup on tasks;
create trigger trg_spk_tasks_collapse_dup
  before insert on tasks
  for each row execute function spk_tasks_collapse_dup();

-- 既存の重複を1行へ畳む
with ranked as (
  select _id,
         row_number() over (
           partition by reservation_id, spk_task_role(type)
           order by (case when btrim(coalesce(assignee,'')) <> '' then 0 else 1 end),
                    updated_at desc nulls last
         ) as rn
  from tasks
  where reservation_id is not null and btrim(reservation_id) <> ''
    and spk_task_role(type) in ('LEND','RETURN','WASH')
)
delete from tasks t using ranked r where t._id = r._id and r.rn > 1;
