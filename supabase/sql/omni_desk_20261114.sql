-- 2026-11-14 nosh「オムニを管理ツールに入れる（一歩手前まで）」段階1：チャット返事
-- ・オムニの最初の案（orig_draft）を残す：Slack で直しても「直したか」が分かるようにする（今は draft が上書きされ final_answer==draft になる）
-- ・決めた結果を omni_decisions に1行（種類ごとの「そのまま採用率」を測る）。Slack の OK でも マイページ管理 でも同じく記録（トリガー）
-- ・自動送信・自動承認はしない（nosh の言葉まで）
alter table public.cs_chat_drafts add column if not exists orig_draft text;
alter table public.cs_chat_drafts add column if not exists conf text;        -- go / look / human（任せてよい・人が見る・人に回す）
alter table public.cs_chat_drafts add column if not exists conf_reason text;
update public.cs_chat_drafts set orig_draft = draft where orig_draft is null and status = 'pending';

create table if not exists public.omni_decisions (
  id bigserial primary key,
  kind text not null,                 -- chat / chg / ext / line / staff / field / kz
  store text,
  ref_id text,                        -- cs_chat_drafts.id など
  reservation_id text,
  proposal text,                      -- オムニの最初の案
  final text,                         -- 実際に送った文（却下は null）
  outcome text not null,              -- same（そのまま）/ edited（直した）/ rejected（却下）
  conf text, conf_reason text,
  via text,                           -- admin（マイページ管理）/ slack
  decided_by text,
  proposed_at timestamptz,
  decided_at timestamptz not null default now()
);
create index if not exists omni_decisions_kind_at on public.omni_decisions(kind, decided_at desc);
alter table public.omni_decisions enable row level security;  -- 読み書きは EF（service）だけ

create or replace function public.cs_drafts_omni_track() returns trigger language plpgsql security definer set search_path = public as $$
declare nf text; oc text;
begin
  if tg_op = 'INSERT' then
    if new.orig_draft is null then new.orig_draft := new.draft; end if;
    return new;
  end if;
  if old.status = 'pending' and new.status in ('approved','rejected') then
    nf := case when new.status = 'approved' then coalesce(new.final_answer, new.draft) end;
    oc := case when new.status = 'rejected' then 'rejected'
               when btrim(coalesce(nf,'')) = btrim(coalesce(new.orig_draft, old.draft, '')) then 'same'
               else 'edited' end;
    insert into omni_decisions(kind, store, ref_id, reservation_id, proposal, final, outcome, conf, conf_reason, via, decided_by, proposed_at, decided_at)
    values ('chat', new.store, new.id::text, new.reservation_id, coalesce(new.orig_draft, old.draft), nf, oc, new.conf, new.conf_reason,
            case when coalesce(new.decided_by,'') like 'admin%' then 'admin' else 'slack' end, new.decided_by, new.created_at, coalesce(new.decided_at, now()));
  end if;
  return new;
exception when others then raise warning '[omni-track chat] %', sqlerrm; return new;  -- 記録の失敗で cs_autoreply を止めない
end $$;
drop trigger if exists cs_drafts_omni_track_i on public.cs_chat_drafts;
create trigger cs_drafts_omni_track_i before insert on public.cs_chat_drafts for each row execute function public.cs_drafts_omni_track();
drop trigger if exists cs_drafts_omni_track_u on public.cs_chat_drafts;
create trigger cs_drafts_omni_track_u after update of status on public.cs_chat_drafts for each row execute function public.cs_drafts_omni_track();

-- ② 時間・場所の変更依頼：オムニの提案（「〜で承認していいですか？」）と、人が決めた結果
create table if not exists public.omni_suggestions (
  kind text not null, ref_id text not null, store text, reservation_id text,
  verdict text,          -- ok（このまま承認でよい）/ alt（代わりの案）/ human（人が判断）
  ask text, why jsonb, alt text, reason text,
  created_at timestamptz not null default now(), updated_at timestamptz,
  primary key (kind, ref_id)
);
alter table public.omni_suggestions enable row level security;

create or replace function public.mypage_changes_omni_track() returns trigger language plpgsql security definer set search_path = public as $$
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
          case when coalesce(new.actor, '') = 'admin_pin' then 'admin' else 'staff' end, new.actor, s.created_at);
  return new;
exception when others then raise warning '[omni-track] %', sqlerrm; return new;
end $$;
drop trigger if exists mypage_changes_omni_track on public.mypage_changes;
create trigger mypage_changes_omni_track after update of status on public.mypage_changes for each row execute function public.mypage_changes_omni_track();
