-- 2026-11-08 札幌(spk) マイページ承認の反映を「1回の処理・読み直し確認・戻し防止」にする（那覇 nha_mypage_apply_lock.sql と同じ設計）
-- ★未適用の下書き。適用前に本番の関数定義・トリガー一覧を再確認すること（handyman-db-change）。
--
-- 1) spk_cj                       : changed_json(text) を安全に jsonb 化
-- 2) spk_task_eff_place / _time   : OPシートの読み方（index.src.html 595 _fromDbTask ＋ 1689 taskPlaceResolved / 17745 等の表示式）と同じ
-- 3) spk_task_mplock / spk_res_mplock : 承認で書いた値を、取込(system)・SSパトロール(updateTaskCJ)・場所取得ボタン・古い画面の丸ごと保存で戻させない
-- 4) spk_apply_mypage_change      : 予約・タスク・記録(mypage_changes)を1トランザクションで反映し、読み直して一致しなければ全部取り消す
-- 5) spk_res_effective / spk_mp_sync_check : 実効値の取得と、ロック中なのに承認値と違う行の検出（0件が正常）
-- 6) spk_staff_view               : 時間・場所を 2) の関数に置き換え（現行の正規表現版と結果は同じ＝2026-11-08 乾式比較で差0件）
--
-- ロックの形： changed_json._mpLock = {"キー":{"v":承認値,"p":承認前の値,"at":ISO(UTC)}}
--   tasks のキー        : place（OPで見える場所）/ time（OPで見える時間）/ col_place（d-タスクの返却場所ミラー列）
--   reservations のキー : del_place / col_place / del_time / lend_time / col_time / return_time（列そのもの）
--   セッション変数 spk.mp_apply='1' のときだけロックを素通り（反映処理そのもの）
--
-- 既存トリガーとの順序（BEFORE UPDATE は名前順に実行。pg_trigger 2026-11-08 確認）
--   tasks        : trg_spk_block_pickup → trg_spk_src_guard → ★trg_spk_task_mplock → trg_spk_tasks_fill → trg_tasks_updated
--   reservations : trg_block_cancel_revival → trg_rakuten_coupon → trg_reservations_updated → trg_spk_res_detect → ★trg_spk_res_mplock
--   ・_spk_src_guard は _src='system' の時だけ「列(place/time/col_place/memo…)」を旧値に戻すが changed_json のキー
--     (_placeSource/_ssPlace/_timeChange) は守らない。ロックはその後に走り、列とキーの両方を「OPでの見え方」で判定する。
--   ・反映処理はタスクに _src='mypage' を付ける＝_spk_src_guard は素通り（旧EFは前回の _src='system' を引き継いで戻されていた）。
--   ・反映処理は予約に _src='customer' を付ける＝_spk_res_detect が _own に del_place 等を記録し、以後の取込(system)も止める。
--     旧EFは changed_json を触らず、前回の _src='system' のまま → _own 済みの列は _spk_res_detect に旧値へ戻されていた。
--   ・_spk_res_detect / OP の updateResField は changed_json を作り直す（{_src:'human'} 等）。ロックは OLD から読み直して書き戻すので消えない。
--   ・OP の protect 保存（_mergeUserInput）は prev._changed を引き継がず _mpLock を落とすが、同じく OLD から書き戻す。
--   ・UPSERT(ON CONFLICT DO UPDATE) も更新側で BEFORE UPDATE が走るのでロック対象。

-- ========== 1) changed_json の安全な jsonb 化 ==========
create or replace function public.spk_cj(p text) returns jsonb
language plpgsql immutable as $$
begin
  if p is null or btrim(p) = '' then return '{}'::jsonb; end if;
  return case when jsonb_typeof(p::jsonb) = 'object' then p::jsonb else '{}'::jsonb end;
exception when others then return '{}'::jsonb;
end $$;

-- ========== 2) OPシートと同じ読み方 ==========
-- 場所：index.src.html:595 _fromDbTask の place（★2026-07-15 STEP2横展開）＋ :1689 taskPlaceResolved の
--       (t._placeSource==="manual"?t.place:(t._ssPlace||t.place)) を合成したもの。
--   manual → place ／ _ssPlace あり → _ssPlace ／ customer → place ／ 予約なし・DEL/COL系以外 → place ／
--   それ以外 → 予約の col_place(COL系)・del_place(DEL系)（空白のみなら place）
--   ※cleanPlace（:1682 プレースホルダ文言を空にする表示フィルタ）は掛けない＝spk_staff_view と同じ生値。
create or replace function public.spk_task_eff_place(t public.tasks, r public.reservations) returns text
language plpgsql stable as $$
declare cj jsonb := public.spk_cj(t.changed_json); ps text; ssp text; is_col boolean; is_del boolean; fb text;
begin
  ps  := coalesce(cj->>'_placeSource','');
  ssp := coalesce(cj->>'_ssPlace','');
  if ps = 'manual' then return coalesce(t.place,''); end if;
  if ssp <> '' then return ssp; end if;
  if ps = 'customer' then return coalesce(t.place,''); end if;
  is_col := t.type in ('COL','BD','BDB','返却');
  is_del := t.type in ('DEL','PU','PUB','来店','PUB来店');
  if r.id is null or not (is_col or is_del) then return coalesce(t.place,''); end if;
  fb := case when is_col then r.col_place else r.del_place end;
  if btrim(coalesce(fb,'')) <> '' then return fb; end if;
  return coalesce(t.place,'');
end $$;

-- 時間：index.src.html:595 _fromDbTask の time ＋ 表示式 t.timeChange||t._ssTime||t.time（:17745 / :18069 / :24718 ほか）
--   _timeChange → _ssTime → (_manualTimeAt あり→time) → 予約なし・DEL/COL系以外 → time →
--   COL系: (col_time||return_time)、DEL系: (del_time||lend_time)（JSの || と同じく空文字だけ次へ。空白のみなら time）
create or replace function public.spk_task_eff_time(t public.tasks, r public.reservations) returns text
language plpgsql stable as $$
declare cj jsonb := public.spk_cj(t.changed_json); tc text; sst text; is_col boolean; is_del boolean; rt text;
begin
  tc  := coalesce(cj->>'_timeChange','');
  sst := coalesce(cj->>'_ssTime','');
  if tc <> '' then return tc; end if;
  if sst <> '' then return sst; end if;
  if btrim(coalesce(cj->>'_manualTimeAt','')) <> '' then return coalesce(t.time,''); end if;
  is_col := t.type in ('COL','BD','BDB','返却');
  is_del := t.type in ('DEL','PU','PUB','来店','PUB来店');
  if r.id is null or not (is_col or is_del) then return coalesce(t.time,''); end if;
  if is_col then rt := case when coalesce(r.col_time,'') <> '' then r.col_time else r.return_time end;
  else           rt := case when coalesce(r.del_time,'') <> '' then r.del_time else r.lend_time end; end if;
  if btrim(coalesce(rt,'')) <> '' then return rt; end if;
  return coalesce(t.time,'');
end $$;

-- ========== 3a) タスク側のロック ==========
-- ロック中のキーは次の場合だけ変えられる（＝ロックを外す）:
--   (a) 承認の反映処理そのもの（spk.mp_apply）
--   (b) OPシートの手入力: 場所=_manualPlaceAt / 時間=_manualTimeAt が承認時刻(at)より新しく、結果が空でない
--   (c) d-タスクの col_place は、同じ予約の c-タスクの実効場所と同じ値なら可
-- それ以外（取込 system・SSパトロール/場所取得/時間取得の updateTaskCJ(v4.7.704〜は差分キーだけ・_src='ss')・古い画面の updateTask・空欄化）は
-- 承認値に戻して spk_guard_log に残す。
create or replace function public.spk_task_mplock() returns trigger
language plpgsql as $$
declare lk jsonb; k text; e jsonb; v text; at text; cur text; ok boolean; ncj jsonb; r public.reservations; cplace text;
begin
  if current_setting('spk.mp_apply', true) = '1' then return new; end if;
  lk := public.spk_cj(old.changed_json)->'_mpLock';
  if lk is null or jsonb_typeof(lk) <> 'object' or lk = '{}'::jsonb then return new; end if;
  ncj := public.spk_cj(new.changed_json);
  if coalesce(new.reservation_id,'') <> '' then select * into r from public.reservations where id = new.reservation_id; end if;

  for k, e in select * from jsonb_each(lk) loop
    v := e->>'v'; at := coalesce(e->>'at','');
    new.changed_json := ncj::text;   -- 判定は「この保存後にOPでどう見えるか」
    cur := case k when 'place' then public.spk_task_eff_place(new, r)
                  when 'time'  then public.spk_task_eff_time(new, r)
                  else to_jsonb(new)->>k end;
    if cur is not distinct from v then
      -- 値は承認値のまま。SSパトロールが「SS由来」とみなして次に上書きしないよう出所フラグだけ整える（見え方は変わらない）
      if k = 'place' and coalesce(ncj->>'_placeSource','') not in ('manual','customer') then
        new.place := v; ncj := ncj || jsonb_build_object('_placeSource','customer','_ssPlace', v);
      elsif k = 'time' and coalesce(ncj->>'_timeChange','') = '' then
        ncj := ncj || jsonb_build_object('_timeChange', v);
      end if;
      continue;
    end if;
    ok := false;
    if btrim(coalesce(cur,'')) <> '' then
      if k = 'place' then ok := coalesce(ncj->>'_manualPlaceAt','') > at;
      elsif k = 'time' then ok := coalesce(ncj->>'_manualTimeAt','') > at;
      elsif k = 'col_place' then
        ok := coalesce(ncj->>'_manualPlaceAt','') > at;
        if not ok then
          select public.spk_task_eff_place(c, r) into cplace from public.tasks c
           where c.reservation_id = new.reservation_id and c._id like 'c-%' and coalesce(c.deleted,false) = false limit 1;
          ok := (cur = coalesce(cplace,''));
        end if;
      end if;
    end if;
    if ok then
      lk := lk - k;   -- スタッフが意図して変えた＝以後はその値が正
    else
      insert into public.spk_guard_log(row_id, field, blocked_new, kept_old) values (new._id, k || '(承認ロック)', cur, v);
      if k = 'place' then
        new.place := v; ncj := ncj || jsonb_build_object('_placeSource','customer','_ssPlace', v);
      elsif k = 'time' then
        new.time := v; ncj := ncj || jsonb_build_object('_timeChange', v, '_ssTime', v);
      elsif k = 'col_place' then
        new.col_place := v;
      end if;
    end if;
  end loop;
  if lk = '{}'::jsonb then ncj := ncj - '_mpLock'; else ncj := ncj || jsonb_build_object('_mpLock', lk); end if;
  new.changed_json := ncj::text;
  return new;
end $$;

drop trigger if exists trg_spk_task_mplock on public.tasks;
create trigger trg_spk_task_mplock before update on public.tasks for each row execute function public.spk_task_mplock();

-- ========== 3b) 予約側のロック ==========
-- ロック中の列は次の場合だけ変えられる:
--   (a) 承認の反映処理そのもの
--   (c) タスクの値に裏付けがある（del_place←d-の場所、col_place←c-の場所、del_time/lend_time←d-の時間、col_time/return_time←c-の時間）
--       ※タスク値は予約に依存しない読み方（r=null）で取る。予約の新値で自己正当化しないため。
--   (d) OPの予約編集（updateResField が新しく {"_src":"human"} を付けた保存）で、承認前の値(p)でも空欄でもない値
-- 取込(system)・その他はすべて承認値に戻す。reservations.mypage_locked は互換のため反映処理が書き続けるが、判定は _mpLock で行う。
create or replace function public.spk_res_mplock() returns trigger
language plpgsql as $$
declare lk jsonb; k text; e jsonb; nv text; ncj jsonb; ok boolean; fresh_src text; tv text;
begin
  if current_setting('spk.mp_apply', true) = '1' then return new; end if;
  lk := public.spk_cj(old.changed_json)->'_mpLock';
  if lk is null or jsonb_typeof(lk) <> 'object' or lk = '{}'::jsonb then return new; end if;
  ncj := public.spk_cj(new.changed_json);
  fresh_src := case when new.changed_json is distinct from old.changed_json then (ncj->>'_src') end;
  for k, e in select * from jsonb_each(lk) loop
    nv := to_jsonb(new)->>k;
    if nv is not distinct from (e->>'v') then continue; end if;
    ok := false;
    if coalesce(btrim(nv),'') <> '' then
      select case when k in ('del_place','col_place') then public.spk_task_eff_place(t, null::public.reservations)
                  else public.spk_task_eff_time(t, null::public.reservations) end into tv
        from public.tasks t
       where t.reservation_id = new.id and coalesce(t.deleted,false) = false
         and t._id like (case when k in ('del_place','del_time','lend_time') then 'd-%' else 'c-%' end)
       limit 1;
      ok := (nv = coalesce(tv,''));
      if not ok and fresh_src = 'human' and nv is distinct from (e->>'p') then ok := true; end if;
    end if;
    if ok then
      lk := lk - k;
    else
      insert into public.spk_res_guard_log(row_id, field, would_block_new, kept_old, note) values (new.id, k, nv, e->>'v', 'mplock');
      new := jsonb_populate_record(new, jsonb_build_object(k, e->>'v'));
    end if;
  end loop;
  if lk = '{}'::jsonb then ncj := ncj - '_mpLock'; else ncj := ncj || jsonb_build_object('_mpLock', lk); end if;
  new.changed_json := ncj::text;
  return new;
end $$;

drop trigger if exists trg_spk_res_mplock on public.reservations;
create trigger trg_spk_res_mplock before update on public.reservations for each row execute function public.spk_res_mplock();

-- ========== 4) 承認の反映（1トランザクション・読み直し確認・不一致なら raise で全部取り消し） ==========
-- p_field: del_place | col_place | lend_time | return_time（早め回収 ready の承認は return_time で呼ぶ）
-- p_change_id: 承認する依頼(mypage_changes.id)。渡すと requested→approved もこの中で行う（二重承認は例外）
-- p_lat/p_lng: 場所の座標（任意。del_lat/del_lng か col_lat/col_lng に入れる）
create or replace function public.spk_apply_mypage_change(p_res text, p_field text, p_val text, p_actor text,
                                                         p_change_id bigint default null,
                                                         p_lat double precision default null, p_lng double precision default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v text := btrim(coalesce(p_val,'')); r public.reservations; t public.tasks; at text; old_v text; rlk jsonb; cj jsonb;
        n int := 0; bad text := ''; ep text; et text; mp jsonb; mk text; m text; d_task public.tasks; c_task public.tasks; chg record;
begin
  if v = '' then raise exception '反映する値が空です'; end if;
  if p_field not in ('del_place','col_place','lend_time','return_time') then raise exception '反映できない項目です: %', p_field; end if;
  if p_field in ('lend_time','return_time') then
    if v !~ '^\d{1,2}:\d{2}$' then raise exception '時間の形式が不正です: %', v; end if;
    v := lpad(split_part(v,':',1), 2, '0') || ':' || split_part(v,':',2);   -- 9:00 → 09:00（OPの表記に合わせる）
  end if;
  perform set_config('spk.mp_apply', '1', true);
  at := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');   -- JS toISOString と同じ形＝_manualPlaceAt と文字列比較できる
  mk := '✅変更済(' || to_char(now() at time zone 'Asia/Tokyo', 'MM-DD HH24:MI') || '):' ||
        case p_field when 'del_place' then 'お届け場所' when 'col_place' then '回収場所' when 'lend_time' then 'お届け時間' else '回収時間' end;

  if p_change_id is not null then
    select * into chg from public.mypage_changes where id = p_change_id for update;
    if not found then raise exception '依頼が見つかりません: %', p_change_id; end if;
    if chg.reservation_id is distinct from p_res then raise exception '依頼と予約が一致しません'; end if;
    if chg.status not in ('requested') then raise exception 'この依頼は既に処理済みです(%)', chg.status; end if;
  end if;

  select * into r from public.reservations where id = p_res for update;
  if not found then raise exception '予約が見つかりません'; end if;

  -- 承認前の値＝OPで見えていた値（旧EF applyPlaceTime と同じ考え方）
  select * into d_task from public.tasks where reservation_id = p_res and _id like 'd-%' and coalesce(deleted,false)=false limit 1;
  select * into c_task from public.tasks where reservation_id = p_res and _id like 'c-%' and coalesce(deleted,false)=false limit 1;
  old_v := case p_field
    when 'del_place'   then case when d_task._id is not null then public.spk_task_eff_place(d_task, r) else coalesce(r.del_place,'') end
    when 'col_place'   then case when c_task._id is not null then public.spk_task_eff_place(c_task, r) else coalesce(r.col_place,'') end
    when 'lend_time'   then case when d_task._id is not null then public.spk_task_eff_time(d_task, r)  else coalesce(nullif(r.del_time,''), r.lend_time, '') end
    else                    case when c_task._id is not null then public.spk_task_eff_time(c_task, r)  else coalesce(nullif(r.col_time,''), r.return_time, '') end end;

  -- 予約（正本）
  rlk := coalesce(public.spk_cj(r.changed_json)->'_mpLock', '{}'::jsonb);
  mp  := case when jsonb_typeof(r.mypage_locked) = 'object' then r.mypage_locked else '{}'::jsonb end
         || jsonb_build_object(p_field, jsonb_build_object('at', at, 'by', 'customer', 'actor', p_actor));
  if p_field = 'del_place' then
    rlk := rlk || jsonb_build_object('del_place', jsonb_build_object('v', v, 'p', coalesce(r.del_place,''), 'at', at));
    update public.reservations set del_place = v,
      del_lat = case when p_lat is not null and p_lng is not null then p_lat else del_lat end, del_lng = case when p_lat is not null and p_lng is not null then p_lng else del_lng end,
      mypage_locked = mp, changed_json = (public.spk_cj(changed_json) || jsonb_build_object('_src','customer','_mpLock', rlk))::text where id = p_res;
  elsif p_field = 'col_place' then
    rlk := rlk || jsonb_build_object('col_place', jsonb_build_object('v', v, 'p', coalesce(r.col_place,''), 'at', at));
    update public.reservations set col_place = v,
      col_lat = case when p_lat is not null and p_lng is not null then p_lat else col_lat end, col_lng = case when p_lat is not null and p_lng is not null then p_lng else col_lng end,
      mypage_locked = mp, changed_json = (public.spk_cj(changed_json) || jsonb_build_object('_src','customer','_mpLock', rlk))::text where id = p_res;
  elsif p_field = 'lend_time' then
    rlk := rlk || jsonb_build_object('del_time',  jsonb_build_object('v', v, 'p', coalesce(r.del_time,''),  'at', at),
                                     'lend_time', jsonb_build_object('v', v, 'p', coalesce(r.lend_time,''), 'at', at));
    update public.reservations set del_time = v, lend_time = v, mypage_locked = mp,
      changed_json = (public.spk_cj(changed_json) || jsonb_build_object('_src','customer','_mpLock', rlk))::text where id = p_res;
  else
    rlk := rlk || jsonb_build_object('col_time',    jsonb_build_object('v', v, 'p', coalesce(r.col_time,''),    'at', at),
                                     'return_time', jsonb_build_object('v', v, 'p', coalesce(r.return_time,''), 'at', at));
    update public.reservations set col_time = v, return_time = v, mypage_locked = mp,
      changed_json = (public.spk_cj(changed_json) || jsonb_build_object('_src','customer','_mpLock', rlk))::text where id = p_res;
  end if;

  -- タスク（d-=お届け、c-=回収。削除済みは除く）。旧EF patchTasksSpk と同じ書き方＋ _src='mypage'・_mpLock
  for t in select * from public.tasks where reservation_id = p_res and coalesce(deleted,false) = false and (_id like 'd-%' or _id like 'c-%') for update loop
    cj := public.spk_cj(t.changed_json);
    -- 変更済マーカーは BCJ タグ(\n##BCJ:)の前に入れる（旧EFは後ろに足して _decodeMemo の数量を壊していた）
    m := coalesce(t.memo,'');
    if position(mk in m) = 0 then
      if position(E'\n##BCJ:' in m) > 0 then
        m := btrim(split_part(m, E'\n##BCJ:', 1) || ' ' || mk) || E'\n##BCJ:' || substring(m from position(E'\n##BCJ:' in m) + 7);
      else m := btrim(m || ' ' || mk); end if;
    end if;
    if p_field = 'del_place' and t._id like 'd-%' then
      cj := cj || jsonb_build_object('_src','mypage','_placeSource','customer','_ssPlace', v, '_mpLock',
              coalesce(cj->'_mpLock','{}'::jsonb) || jsonb_build_object('place', jsonb_build_object('v', v, 'p', public.spk_task_eff_place(t, r), 'at', at)));
      update public.tasks set place = v, memo = m, changed_json = cj::text where _id = t._id; n := n + 1;
    elsif p_field = 'col_place' and t._id like 'c-%' then
      cj := cj || jsonb_build_object('_src','mypage','_placeSource','customer','_ssPlace', v, '_mpLock',
              coalesce(cj->'_mpLock','{}'::jsonb) || jsonb_build_object('place', jsonb_build_object('v', v, 'p', public.spk_task_eff_place(t, r), 'at', at)));
      update public.tasks set place = v, memo = m, changed_json = cj::text where _id = t._id; n := n + 1;
    elsif p_field = 'col_place' and t._id like 'd-%' then
      cj := cj || jsonb_build_object('_src','mypage','_mpLock',
              coalesce(cj->'_mpLock','{}'::jsonb) || jsonb_build_object('col_place', jsonb_build_object('v', v, 'p', coalesce(t.col_place,''), 'at', at)));
      update public.tasks set col_place = v, memo = m, changed_json = cj::text where _id = t._id; n := n + 1;
    elsif p_field = 'lend_time' and t._id like 'd-%' then
      cj := cj || jsonb_build_object('_src','mypage','_ssTime', v, '_timeChange', v, '_mpLock',
              coalesce(cj->'_mpLock','{}'::jsonb) || jsonb_build_object('time', jsonb_build_object('v', v, 'p', public.spk_task_eff_time(t, r), 'at', at)));
      update public.tasks set time = v, memo = m, changed_json = cj::text where _id = t._id; n := n + 1;
    elsif p_field = 'return_time' and t._id like 'c-%' then
      cj := cj || jsonb_build_object('_src','mypage','_ssTime', v, '_timeChange', v, '_mpLock',
              coalesce(cj->'_mpLock','{}'::jsonb) || jsonb_build_object('time', jsonb_build_object('v', v, 'p', public.spk_task_eff_time(t, r), 'at', at)));
      update public.tasks set time = v, memo = m, changed_json = cj::text where _id = t._id; n := n + 1;
    end if;
  end loop;

  -- 読み直し確認：予約の列、OPシート/個別URL（同じ読み方）で承認値になっているか
  select * into r from public.reservations where id = p_res;
  if (p_field = 'del_place' and r.del_place is distinct from v) or (p_field = 'col_place' and r.col_place is distinct from v)
     or (p_field = 'lend_time' and (r.del_time is distinct from v or r.lend_time is distinct from v))
     or (p_field = 'return_time' and (r.col_time is distinct from v or r.return_time is distinct from v)) then
    bad := bad || ' 予約';
  end if;
  for t in select * from public.tasks where reservation_id = p_res and coalesce(deleted,false) = false and (_id like 'd-%' or _id like 'c-%') loop
    ep := public.spk_task_eff_place(t, r); et := public.spk_task_eff_time(t, r);
    if p_field = 'del_place'   and t._id like 'd-%' and ep is distinct from v then bad := bad || ' ' || t._id || '(場所)'; end if;
    if p_field = 'col_place'   and t._id like 'c-%' and ep is distinct from v then bad := bad || ' ' || t._id || '(場所)'; end if;
    if p_field = 'col_place'   and t._id like 'd-%' and t.col_place is distinct from v then bad := bad || ' ' || t._id || '(回収場所)'; end if;
    if p_field = 'lend_time'   and t._id like 'd-%' and et is distinct from v then bad := bad || ' ' || t._id || '(時間)'; end if;
    if p_field = 'return_time' and t._id like 'c-%' and et is distinct from v then bad := bad || ' ' || t._id || '(時間)'; end if;
  end loop;
  if bad <> '' then raise exception '反映の確認で不一致:%（何も変更していません）', bad; end if;

  -- 記録（旧EFと同じ形の applied 行）＋依頼を approved に
  insert into public.mypage_changes(reservation_id, store, field, old_value, new_value, source, status, actor, note, payload)
  -- p_change_id=null はスタッフの整合統一（EF resolve）＝旧EFと同じ source='staff'・note で残す
  values (p_res, 'spk', p_field, coalesce(old_v,''), v, case when p_change_id is null then 'staff' else 'customer' end, 'applied', p_actor,
          case when p_change_id is null then '整合統一（予約とOPを同じ値に）' else 'マイページ依頼の承認による反映' end,
          jsonb_build_object('change_id', p_change_id, 'tasks', n, 'at', at));
  if p_change_id is not null then
    update public.mypage_changes set status = 'approved', actor = p_actor where id = p_change_id;
  end if;
  return jsonb_build_object('ok', true, 'tasks', n, 'old', coalesce(old_v,''), 'new', v, 'at', at);
end $$;

-- ========== 5a) 予約の実効値（OPシート/個別URLと同じ読み方。マイページ表示・EFの「変更前」に使う） ==========
create or replace function public.spk_res_effective(p_res text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'del_place',   case when d._id is not null then public.spk_task_eff_place(d, r) else coalesce(r.del_place,'') end,
    'col_place',   case when c._id is not null then public.spk_task_eff_place(c, r) else coalesce(r.col_place,'') end,
    'lend_time',   case when d._id is not null then public.spk_task_eff_time(d, r)  else coalesce(nullif(r.del_time,''), r.lend_time, '') end,
    'return_time', case when c._id is not null then public.spk_task_eff_time(c, r)  else coalesce(nullif(r.col_time,''), r.return_time, '') end,
    'has_d', d._id is not null, 'has_c', c._id is not null,
    'locked', coalesce(public.spk_cj(r.changed_json)->'_mpLock', '{}'::jsonb))
  from public.reservations r
  left join lateral (select * from public.tasks t where t.reservation_id = r.id and t._id like 'd-%' and coalesce(t.deleted,false)=false limit 1) d on true
  left join lateral (select * from public.tasks t where t.reservation_id = r.id and t._id like 'c-%' and coalesce(t.deleted,false)=false limit 1) c on true
  where r.id = p_res
$$;

-- ========== 5b) ずれ検出（承認ロック中なのに承認値と違う予約・タスク。0件が正常） ==========
create or replace function public.spk_mp_sync_check() returns jsonb
language sql stable security definer set search_path = public as $$
  with r as (
    select r.*, public.spk_cj(r.changed_json)->'_mpLock' lk from public.reservations r
     where public.spk_cj(r.changed_json) ? '_mpLock'
       and replace(coalesce(r.return_date,''),'/','-') >= to_char((now() at time zone 'Asia/Tokyo')::date - 1, 'YYYY-MM-DD')
  ), bad as (
    select r.id, k as field, to_jsonb(r)->>k as now_v, r.lk->k->>'v' as want from r, jsonb_object_keys(r.lk) k
     where (to_jsonb(r)->>k) is distinct from (r.lk->k->>'v')
    union all
    select t._id, k,
           case k when 'place' then public.spk_task_eff_place(t, rr) when 'time' then public.spk_task_eff_time(t, rr) else to_jsonb(t)->>k end,
           public.spk_cj(t.changed_json)->'_mpLock'->k->>'v'
      from public.tasks t left join public.reservations rr on rr.id = t.reservation_id,
           jsonb_object_keys(public.spk_cj(t.changed_json)->'_mpLock') k
     where coalesce(t.deleted,false) = false and t.date >= to_char((now() at time zone 'Asia/Tokyo')::date - 1, 'YYYY-MM-DD')
       and public.spk_cj(t.changed_json) ? '_mpLock'
       and (case k when 'place' then public.spk_task_eff_place(t, rr) when 'time' then public.spk_task_eff_time(t, rr) else to_jsonb(t)->>k end)
           is distinct from (public.spk_cj(t.changed_json)->'_mpLock'->k->>'v')
  )
  select jsonb_build_object('ok', count(*) = 0, 'mismatch', coalesce(jsonb_agg(to_jsonb(bad)), '[]'::jsonb)) from bad
$$;

-- ========== 6) 個別URL(spk_staff_view)の時間・場所を 2) に統一 ==========
--   変更点は eff_time / eff_place の2式だけ（旧：changed_json を正規表現で読む CASE。_ssPlace に " を含む値・入れ子キー・空白値で OP とずれ得た）。
--   2026-11-08 乾式比較（今日〜30日の非削除218件・実RPC出力70件）で旧式との差は 0 件。wash_after は現状維持。
CREATE OR REPLACE FUNCTION public.spk_staff_view(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_name text; v_sur text; v_today date := (now() at time zone 'Asia/Tokyo')::date; v_res jsonb; v_req jsonb; v_skp jsonb; v_spot boolean;
BEGIN
  SELECT name INTO v_name FROM staff WHERE share_token=p_token AND coalesce(active,true)=true;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_token'); END IF;
  v_sur := split_part(v_name,' ',1);
  v_spot := _spk_is_spot_staff(v_name);
  WITH base AS (
    SELECT t._id, t.type, t.name, coalesce(nullif(v.name,''),CASE WHEN t.type='送迎' AND t.vehicle='その他' THEN 'その他' END,t.assigned_vehicle) AS veh_name, v.caution_note AS caution, t.plate_no, t.done, t.ota, t.reservation_id, t.assignee, t.requested_to, t.skipped_by, r.mypage_token, coalesce(t.memo,'') AS memo,
      coalesce(r.opt_b,0) AS opt_b, coalesce(r.opt_c,0) AS opt_c, coalesce(r.opt_j,0) AS opt_j,
      coalesce(r.opt_usb,false)::int AS opt_usb, coalesce(r.opt_parasol,false)::int AS opt_parasol,
      coalesce(nullif(r.people,0),0) AS people,
      coalesce(nullif(r.flight,''),'') AS flight,
      coalesce(nullif(t.insurance,''), nullif(r.insurance,'')) AS insurance,
      nullif(substring(t.changed_json from '"_moveMeans":\s*"([^"]+)"'),'') AS move,
      CASE WHEN t.type='送迎' THEN coalesce(nullif(t.assigned_vehicle,''),CASE WHEN t.vehicle='その他' THEN 'その他' END,'') END AS escort_vehicle_code,
      nullif(substring(t.changed_json from '"_moveDriver":\s*"([^"]+)"'),'') AS move_driver,
      nullif(substring(t.changed_json from '"_moveVehicle":\s*"([^"]+)"'),'') AS move_vehicle,
      nullif(substring(t.changed_json from '"_billing":\s*"([^"]+)"'),'') AS billing,
      t.date::date AS task_date,
      CASE WHEN t.type='洗車' AND t.plate_no<>'' THEN (
        SELECT max(coalesce(nullif(substring(t2.changed_json from '"_timeChange":\s*"([^"]+)"'),''),nullif(substring(t2.changed_json from '"_ssTime":\s*"([^"]+)"'),''),nullif(r2.col_time,''),nullif(r2.return_time,''),nullif(t2.time,'')))
        FROM tasks t2 LEFT JOIN reservations r2 ON r2.id=t2.reservation_id
        WHERE t2.type IN ('COL','BD','BDB','返却') AND t2.plate_no=t.plate_no AND t2.date::date=t.date::date AND coalesce(t2.deleted,false)=false
      ) ELSE NULL END AS wash_after,
      CASE WHEN t.type='洗車' AND t.changed_json IS NOT NULL AND t.changed_json ~ '"_nextDayWash":\s*true' THEN (t.date::date + 1) ELSE t.date::date END AS eff_date,
      public.spk_task_eff_time(t, r) AS eff_time,
      public.spk_task_eff_place(t, r) AS eff_place,
    (EXISTS(SELECT 1 FROM jalan_payments jp WHERE jp.reservation_id=t.reservation_id AND jp.status='paid')) AS jpaid,
    (SELECT m.method FROM ota_pay_method m WHERE m.reservation_id=t.reservation_id) AS rpay
    FROM tasks t LEFT JOIN reservations r ON r.id=t.reservation_id LEFT JOIN vehicles v ON v.code=t.assigned_vehicle
    WHERE coalesce(t.deleted,false)=false
  ),
  mine AS (SELECT * FROM base WHERE ( replace(coalesce(assignee,''),' ','')=replace(v_name,' ','') OR replace(coalesce(assignee,''),' ','')=v_sur ) AND eff_date BETWEEN v_today AND v_today+62),
  reqd AS (SELECT * FROM base WHERE requested_to IS NOT NULL AND (requested_to ? v_name OR requested_to ? v_sur) AND coalesce(skipped_by ?| array[v_name,v_sur],false)=false AND replace(coalesce(assignee,''),' ','')<>replace(v_name,' ','') AND replace(coalesce(assignee,''),' ','')<>v_sur AND eff_date BETWEEN v_today AND v_today+62),
  skpd AS (SELECT * FROM base WHERE skipped_by IS NOT NULL AND (skipped_by ? v_name OR skipped_by ? v_sur) AND eff_date BETWEEN v_today AND v_today+62)
  SELECT
    (SELECT coalesce(jsonb_agg(jsonb_build_object('_id',_id,'type',type,'date',eff_date,'time',eff_time,'wash_after',wash_after,'customer',name,'vehicle',veh_name,'plate',plate_no,'place',eff_place,'done',done,'ota',ota,'jpaid',jpaid,'rpay',rpay,'resv',reservation_id,'mypage',mypage_token,'move',move,'move_ok',(type IS DISTINCT FROM '送迎'),'escort_ok',(type IS NOT DISTINCT FROM '送迎'),'escort_vehicle_code',coalesce(escort_vehicle_code,''),'move_driver',coalesce(move_driver,''),'move_vehicle_code',coalesce(move_vehicle,''),'move_vehicle',coalesce((SELECT btrim(coalesce(mv.name,'')||' '||coalesce(mv.plate_no,'')) FROM vehicles mv WHERE mv.code=move_vehicle LIMIT 1),move_vehicle,''),'memo',memo,'opt_b',opt_b,'opt_c',opt_c,'opt_j',opt_j,'opt_usb',opt_usb,'opt_parasol',opt_parasol,'people',people,'flight',flight,'insurance',insurance,'caution',coalesce(caution,''),'billing',coalesce(billing,''),'spot_ok',(v_spot AND task_date>=date '2026-11-01')) ORDER BY eff_date,eff_time),'[]'::jsonb) FROM mine),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('_id',_id,'type',type,'date',eff_date,'time',eff_time,'wash_after',wash_after,'customer',name,'vehicle',veh_name,'plate',plate_no,'place',eff_place,'ota',ota,'jpaid',jpaid,'rpay',rpay,'resv',reservation_id,'mypage',mypage_token,'move',move,'move_driver',coalesce(move_driver,''),'move_vehicle_code',coalesce(move_vehicle,''),'move_vehicle',coalesce((SELECT btrim(coalesce(mv.name,'')||' '||coalesce(mv.plate_no,'')) FROM vehicles mv WHERE mv.code=move_vehicle LIMIT 1),move_vehicle,''),'memo',memo,'opt_b',opt_b,'opt_c',opt_c,'opt_j',opt_j,'opt_usb',opt_usb,'opt_parasol',opt_parasol,'people',people,'flight',flight,'insurance',insurance,'caution',coalesce(caution,'')) ORDER BY eff_date,eff_time),'[]'::jsonb) FROM reqd),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('_id',_id,'type',type,'date',eff_date,'time',eff_time,'wash_after',wash_after,'customer',name,'vehicle',veh_name,'plate',plate_no,'place',eff_place,'ota',ota,'jpaid',jpaid,'rpay',rpay,'resv',reservation_id,'mypage',mypage_token,'move',move,'move_driver',coalesce(move_driver,''),'move_vehicle_code',coalesce(move_vehicle,''),'move_vehicle',coalesce((SELECT btrim(coalesce(mv.name,'')||' '||coalesce(mv.plate_no,'')) FROM vehicles mv WHERE mv.code=move_vehicle LIMIT 1),move_vehicle,''),'memo',memo,'opt_b',opt_b,'opt_c',opt_c,'opt_j',opt_j,'opt_usb',opt_usb,'opt_parasol',opt_parasol,'people',people,'flight',flight,'insurance',insurance,'caution',coalesce(caution,'')) ORDER BY eff_date,eff_time),'[]'::jsonb) FROM skpd)
  INTO v_res, v_req, v_skp;
  RETURN jsonb_build_object('ok',true,'staff',v_name,'today',v_today,'tasks',v_res,'requests',v_req,'skips',v_skp,
    'move_opts',jsonb_build_object(
      'staff',(SELECT coalesce(jsonb_agg(s.name ORDER BY s.name),'[]'::jsonb) FROM staff s WHERE coalesce(s.active,true)=true),
      'vehicles',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',mv.code,'label',btrim(coalesce(mv.name,'')||' '||coalesce(mv.plate_no,''))) ORDER BY mv.type,mv.name,mv.plate_no),'[]'::jsonb) FROM vehicles mv WHERE coalesce(mv.active,true)=true)));
END $function$;

-- ========== 権限 ==========
-- 反映・実効値・検出は service_role のみ（EF から呼ぶ）。
-- ⚠ spk_cj / spk_task_eff_place / spk_task_eff_time は revoke しない：ロックのトリガーは書いた人の権限(authenticated=OP)で動くため、
--   ここを絞ると OP の保存が失敗する。行を引数に取るだけで表を読まないので公開しても情報は出ない。
--   トリガー内の spk_guard_log / spk_res_guard_log への insert は既存ポリシー trigger_insert_only(authenticated) で通る（_spk_src_guard と同じ）。
revoke all on function public.spk_apply_mypage_change(text,text,text,text,bigint,double precision,double precision) from public, anon, authenticated;
grant execute on function public.spk_apply_mypage_change(text,text,text,text,bigint,double precision,double precision) to service_role;
revoke all on function public.spk_res_effective(text) from public, anon, authenticated;
grant execute on function public.spk_res_effective(text) to service_role;
revoke all on function public.spk_mp_sync_check() from public, anon, authenticated;
grant execute on function public.spk_mp_sync_check() to service_role;
-- spk_staff_view の既存 grant は CREATE OR REPLACE で維持される（変更なし）

-- ========== 適用後の確認（読み取りのみ） ==========
-- select public.spk_mp_sync_check();                         -- {"ok":true,"mismatch":[]}
-- select tgname from pg_trigger where tgrelid='public.tasks'::regclass and not tgisinternal order by 1;   -- trg_spk_task_mplock が src_guard の後
-- 戻し: drop trigger trg_spk_task_mplock on public.tasks; drop trigger trg_spk_res_mplock on public.reservations;
--       spk_staff_view は 2026-11-08 時点の定義（正規表現版）を pg_get_functiondef で控えてから適用すること。
