-- 2026-11-14 nosh「一次判断をOMNI→共有①社員＝Slack 共有②担当者＝個別URL→社員承認→全体反映＝通知」
-- 1) 承認した時刻を残す（社員の対応の早さを測る：担当が先に動ける施策の目安に使う）
alter table public.mypage_changes add column if not exists decided_at timestamptz;
create or replace function public.mypage_changes_decided_at() returns trigger language plpgsql as $$
begin
  if old.status = 'requested' and new.status <> 'requested' and new.decided_at is null then new.decided_at := now(); end if;
  return new;
end $$;
drop trigger if exists a0_mypage_changes_decided_at on public.mypage_changes;
create trigger a0_mypage_changes_decided_at before update of status on public.mypage_changes
  for each row execute function public.mypage_changes_decided_at();

-- 2) 採用率の記録：承認者は本人の名前で入る（admin_pin ではなくなる）。担当の個別URL経由だけ 'url:名前'
create or replace function public.mypage_changes_omni_track()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare s omni_suggestions; oc text; pv text;
begin
  if old.status <> 'requested' or new.status not in ('approved','proposed','rejected') then return new; end if;
  select * into s from omni_suggestions where kind = 'chg' and ref_id = new.id::text;
  if not found then return new; end if;
  pv := coalesce(new.payload->'proposal'->>'value', '');
  oc := case
    when s.verdict = 'ok'  then case when new.status = 'approved' then 'same' else 'rejected' end
    when s.verdict = 'alt' then case when new.status = 'proposed' and (s.alt is null or pv = s.alt) then 'same'
                                     when new.status = 'proposed' then 'edited' else 'rejected' end
    else 'human' end;
  insert into omni_decisions(kind, store, ref_id, reservation_id, proposal, final, outcome, conf, conf_reason, via, decided_by, proposed_at)
  values ('chg', new.store, new.id::text, new.reservation_id, s.ask, new.status || coalesce(' ' || nullif(pv, ''), ''), oc,
          case s.verdict when 'human' then 'human' else 'go' end, (select string_agg(x, ' / ') from jsonb_array_elements_text(coalesce(s.why, '[]'::jsonb)) x),
          case when coalesce(new.actor, '') like 'url:%' then 'staff' else 'admin' end, new.actor, s.created_at);
  return new;
exception when others then raise warning '[omni-track] %', sqlerrm; return new;
end $function$;
