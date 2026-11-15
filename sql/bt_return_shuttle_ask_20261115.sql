-- 高松HDM：お客様の答えが「未確定」の予約 → 管理ページ「はい、マイページで聞く」→ お客様が答えるとその場で予約・タスクへ（那覇 11/15 と同じ形）
-- 種類 return_shuttle：返し方が空（c-タスク「返却待」）＝返却後に高松空港まで送迎（BD）か、返却だけ（返却）かが決まっていない
--   答え：bd（空港まで送ってほしい・無料）／store（返却だけ）／other（自由に書く→チャットへ。オムニが案）
--   返却の時間は今のまま（高松は便の時刻表なし）
-- 書き込みは既存の bt_apply_mypage_change（承認と同じ道：予約＋c-タスク＋_mpLock＋読み直し・不一致は全部取り消し）をそのまま使う。
-- 記録は bt_reservation_changes（mp_dropoff / mp_store_return と同じ形・status approved）
-- BT DB（ggqugvyskyiblxiycpci）2026-11-15 nosh「マイページで聞く 入れて必要」「やって」
begin;

create table if not exists public.mp_questions (
  id bigserial primary key,
  store text not null,
  reservation_id text not null,
  kind text not null,                       -- return_shuttle
  status text not null default 'asked',     -- asked（質問中）／answered（自動で反映済み）／other（その他の答え→チャット）／closed（不要になった）
  asked_by text, asked_at timestamptz not null default now(),
  answer jsonb, answered_at timestamptz
);
create unique index if not exists mp_questions_open_uq on public.mp_questions(store, reservation_id, kind) where status = 'asked';
alter table public.mp_questions enable row level security;  -- 読み書きは下の関数（service role）だけ

create or replace function public._bt_rt_undecided(r public.bt_reservations)
returns boolean language sql stable as $$
  select coalesce(r.brand,'') = 'HDM'
     and coalesce(r.status,'') !~* 'cancel|キャンセル'
     and coalesce(r.end_date,'') >= to_char(now() at time zone 'Asia/Tokyo','YYYY-MM-DD')
     and btrim(coalesce(r.return_type,'')) = '' $$;

-- 送迎の受付時間（bt_apply_mypage_change と同じ：9:00〜18:45 の15分刻み・18:50）に返却の時間が入っているか
create or replace function public._bt_rt_bd_ok(p_time text)
returns boolean language sql immutable as $$
  select coalesce(p_time,'') ~ '^\d{1,2}:\d{2}$'
     and ((split_part(p_time,':',1)::int*60 + split_part(p_time,':',2)::int between 540 and 1125
           and (split_part(p_time,':',1)::int*60 + split_part(p_time,':',2)::int) % 15 = 0)
          or split_part(p_time,':',1)::int*60 + split_part(p_time,':',2)::int = 1130) $$;

-- 未確定の一覧（管理ページ「やること」の上・omni-desk undecided が main の hdm_undecided と合わせて返す）
create or replace function public.bt_undecided()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(x order by x->>'date', x->>'time'), '[]'::jsonb) from (
    select jsonb_build_object(
      'store', 'tkm', 'rid', r.id, 'kind', 'return_shuttle', 'name', r.name, 'ota', r.ota,
      'date', r.end_date, 'time', coalesce(nullif(r.col_time,''), r.end_time),
      'title', '返却後の送迎が未確定（店→高松空港）',
      'why', jsonb_build_array('返し方がまだ決まっていない（タスクは「返却待」）',
                               '返却後に高松空港まで送るか、返却だけかが分からない（送迎の担当・車が決まらない）'),
      'ask', coalesce(r.name,'') || '様のマイページに「返却後、空港まで送迎しますか？」を出していいですか？',
      'choices', '空港まで送ってほしい（無料）／返却だけ／ほかの希望を書く',
      'bd_ok', public._bt_rt_bd_ok(btrim(coalesce(nullif(r.col_time,''), r.end_time, ''))),
      'pending', exists(select 1 from public.bt_reservation_changes c where c.reservation_id = r.id and c.status = 'requested'
                          and c.change_type in ('mp_dropoff','mp_store_return')),
      'q', (select jsonb_build_object('id', q.id, 'status', q.status, 'asked_at', q.asked_at, 'asked_by', q.asked_by, 'answer', q.answer, 'answered_at', q.answered_at)
              from public.mp_questions q where q.store='tkm' and q.reservation_id=r.id and q.kind='return_shuttle' order by q.id desc limit 1)) x
    from public.bt_reservations r
    where public._bt_rt_undecided(r)
  ) s $$;

-- 管理ページのボタン：お客様のマイページに質問を出す（同じ質問が出ていれば何もしない）
create or replace function public.bt_mp_ask(p_store text, p_rid text, p_kind text, p_actor text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r public.bt_reservations; q public.mp_questions;
begin
  if p_store <> 'tkm' or p_kind <> 'return_shuttle' then return jsonb_build_object('ok', false, 'error', 'この種類はまだ聞けません'); end if;
  select * into r from public.bt_reservations where id = p_rid;
  if not found then return jsonb_build_object('ok', false, 'error', '予約が見つかりません'); end if;
  if not public._bt_rt_undecided(r) then
    return jsonb_build_object('ok', false, 'error', 'もう決まっています（返し方：' || coalesce(nullif(r.return_type,''),'-') || '）'); end if;
  select * into q from public.mp_questions where store = p_store and reservation_id = p_rid and kind = p_kind and status = 'asked';
  if found then return jsonb_build_object('ok', true, 'already', true, 'id', q.id); end if;
  -- 返却の時間が送迎の受付時間外なら「空港まで」を選べない質問になるので出さない（レビュー 11/15）
  if not public._bt_rt_bd_ok(btrim(coalesce(nullif(r.col_time,''), r.end_time, ''))) then
    return jsonb_build_object('ok', false, 'error', '返却の時間（' || coalesce(nullif(r.col_time,''), r.end_time, '-') || '）が送迎の受付時間外（9:00〜18:50）です。お客様に直接確認してください'); end if;
  -- お客様の変更依頼が承認待ちなら、先にその依頼に返事する（答えの自動反映と二重にしない）
  if exists(select 1 from public.bt_reservation_changes c where c.reservation_id = r.id and c.status = 'requested' and c.change_type in ('mp_dropoff','mp_store_return')) then
    return jsonb_build_object('ok', false, 'error', 'お客様の帰りの依頼が承認待ちです。先にその依頼に返事してください'); end if;
  begin
    insert into public.mp_questions(store, reservation_id, kind, asked_by) values (p_store, p_rid, p_kind, left(coalesce(p_actor,''),60)) returning * into q;
  exception when unique_violation then return jsonb_build_object('ok', true, 'already', true); end;
  return jsonb_build_object('ok', true, 'id', q.id);
end $$;

-- マイページ：出ている質問（お客様の鍵で本人確認）
create or replace function public.bt_mp_questions(p_token text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare r public.bt_reservations;
begin
  if coalesce(p_token,'') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return '[]'::jsonb; end if;
  select * into r from public.bt_reservations where mypage_token = p_token::uuid limit 1;
  if not found then return '[]'::jsonb; end if;
  if not public._bt_rt_undecided(r) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'kind', q.kind, 'date', r.end_date,
            'time', coalesce(nullif(r.col_time,''), r.end_time)) order by q.id)
     from public.mp_questions q where q.store = 'tkm' and q.reservation_id = r.id and q.status = 'asked' and q.kind = 'return_shuttle'), '[]'::jsonb);
end $$;

-- マイページ：答える。bd・store はその場で反映（承認なし＝答えが希望の確定）。other は記録して画面がチャットへ送る
create or replace function public.bt_mp_return_shuttle(p_token text, p_choice text, p_text text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r public.bt_reservations; today text; tm text; field text; word text; cid bigint; res jsonb; n int;
begin
  if coalesce(p_token,'') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'bad token'; end if;
  select * into r from public.bt_reservations where mypage_token = p_token::uuid limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', '予約が見つかりません'); end if;
  if coalesce(r.brand,'') <> 'HDM' then return jsonb_build_object('ok', false, 'error', 'このご予約は対象外です'); end if;
  if coalesce(r.status,'') ~* 'cancel|キャンセル' then return jsonb_build_object('ok', false, 'error', 'キャンセル済みのご予約です'); end if;
  today := to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM-DD');
  if coalesce(r.end_date,'') < today then return jsonb_build_object('ok', false, 'error', 'ご返却日を過ぎています'); end if;
  if not public._bt_rt_undecided(r) then
    update public.mp_questions set status = 'closed', answered_at = now() where store='tkm' and reservation_id=r.id and kind='return_shuttle' and status='asked';
    return jsonb_build_object('ok', true, 'already', true, 'return_type', r.return_type);
  end if;

  if p_choice = 'other' then
    if nullif(btrim(coalesce(p_text,'')),'') is null then return jsonb_build_object('ok', false, 'error', 'ご希望を書いてください'); end if;
    update public.mp_questions set status = 'other', answer = jsonb_build_object('choice','other','text', left(btrim(p_text),500)), answered_at = now()
      where store='tkm' and reservation_id=r.id and kind='return_shuttle' and status='asked';
    if not found then insert into public.mp_questions(store, reservation_id, kind, status, asked_by, answer, answered_at)
      values ('tkm', r.id, 'return_shuttle', 'other', 'customer', jsonb_build_object('choice','other','text', left(btrim(p_text),500)), now()); end if;
    return jsonb_build_object('ok', true, 'other', true);
  end if;

  tm := btrim(coalesce(nullif(r.col_time,''), r.end_time, ''));
  if p_choice = 'bd' and r.end_date = today and tm ~ '^\d{1,2}:\d{2}$' and lpad(tm,5,'0') <= to_char(now() at time zone 'Asia/Tokyo', 'HH24:MI') then
    return jsonb_build_object('ok', false, 'error', 'ご返却の時間を過ぎています。「ほかの希望」に書いてください'); end if;
  if p_choice = 'bd' then
    if tm !~ '^\d{1,2}:\d{2}$' then return jsonb_build_object('ok', false, 'error', 'ご返却の時間が決まっていないため選べません。「ほかの希望」に書いてください'); end if;
    field := 'dropoff'; word := '空港まで送迎 ' || tm || '〜';
  elsif p_choice = 'store' then
    field := 'store_return'; word := '返却だけ（送迎なし）';
  else
    return jsonb_build_object('ok', false, 'error', '選んでください');
  end if;

  -- 記録（承認の道と同じ形）→ bt_apply_mypage_change が予約・c-タスク・_mpLock を同じ値にし、読み直して違えば例外（＝この関数ごと全部取り消し）
  insert into public.bt_reservation_changes(reservation_id, change_type, field_name, old_value, new_value, changed_by, changed_at, source, status, payload)
  values (r.id, case when field = 'dropoff' then 'mp_dropoff' else 'mp_store_return' end, 'return_type', '未確定', word, 'customer',
    to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'mypage', 'requested',
    jsonb_build_object('note', 'マイページの質問に回答（自動反映）', 'want', field = 'dropoff', 'time', case when field = 'dropoff' then tm end, 'question', true))
  returning id into cid;
  begin
    res := public.bt_apply_mypage_change(r.id, field, case when field = 'dropoff' then tm else null end, 'customer:mypage-return-shuttle', cid, null);
  exception when others then
    if field = 'dropoff' and sqlerrm like '%受付時間外%' then
      raise exception 'TIME_OUT:%', tm;
    end if;
    raise;
  end;

  -- 念のためもう一度：予約と c-タスクが同じ値か（違えば全部取り消し）
  select * into r from public.bt_reservations where id = r.id;
  if r.return_type is distinct from (case when field = 'dropoff' then 'BD' else '返却' end) then
    raise exception '反映の確認で不一致（予約）：何も変更していません'; end if;
  select count(*) into n from public.bt_tasks t where t."予約番号" = r.id and coalesce(t.deleted,false) = false and t._id like 'c-%'
    and public.bt_task_eff_type(t, r) is distinct from r.return_type;
  if n > 0 then raise exception '反映の確認で不一致（タスク）：何も変更していません'; end if;

  update public.mp_questions set status = 'answered', answered_at = now(),
      answer = jsonb_build_object('choice', p_choice, 'time', case when field = 'dropoff' then tm end, 'word', word)
    where store='tkm' and reservation_id=r.id and kind='return_shuttle' and status='asked';
  return jsonb_build_object('ok', true, 'word', word, 'return_type', r.return_type, 'return_time', tm, 'tasks', res->'tasks');
exception when others then
  if sqlerrm like 'TIME_OUT:%' then
    return jsonb_build_object('ok', false, 'error', 'ご返却の時間（' || substr(sqlerrm, 10) || '）は送迎の受付時間外です（9:00〜18:50）。「ほかの希望」に書いてください');
  end if;
  raise;
end $$;

revoke all on function public._bt_rt_undecided(public.bt_reservations) from public, anon, authenticated;
revoke all on function public._bt_rt_bd_ok(text) from public, anon, authenticated;
revoke all on function public.bt_undecided() from public, anon, authenticated;
revoke all on function public.bt_mp_ask(text, text, text, text) from public, anon, authenticated;
revoke all on function public.bt_mp_questions(text) from public, anon, authenticated;
revoke all on function public.bt_mp_return_shuttle(text, text, text) from public, anon, authenticated;
grant execute on function public.bt_undecided(), public.bt_mp_ask(text, text, text, text),
  public.bt_mp_questions(text), public.bt_mp_return_shuttle(text, text, text) to service_role;

commit;
