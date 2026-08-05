-- =====================================================================
-- 札幌SPK タイムカード機能 SQL（2026-07-30）
-- =====================================================================
-- 【RUN手順（オーナー手作業）】
--   Supabase ダッシュボード → プロジェクト ckrxttbnawkclshczsia
--   → 左メニュー「SQL Editor」→ 新規クエリ → このファイルを全文貼付 → RUN
--   ※ 冪等（IF NOT EXISTS / CREATE OR REPLACE）なので複数回RUNしても安全。
--   ※ 既存の spk_attendance データ・shifts・staff は一切変更しません（列追加のみ）。
--
-- 何をするか:
--   1) spk_attendance に breaks(jsonb) を追加（複数回休憩の記録）
--   2) spk_timecard_requests テーブルを新規作成（打刻の時刻修正申請）＋RLS
--   3) 個人リンク(staff.html・anon)から安全に打刻/状態取得/修正申請できる
--      SECURITY DEFINER RPC を作成（既存 spk_staff_wish と同方式。
--      token→staff.name を解決し、その日の1行の該当列だけを更新）
-- =====================================================================

-- --------------------------------------------------------------------
-- 1) spk_attendance に休憩配列カラムを追加（既存行に影響なし）
--    形式: [{"start":"12:05","end":"12:48"}, {"start":"15:10","end":""}]
--    end が空 = 休憩中。実績休憩(分) = Σ(end-start)。
-- --------------------------------------------------------------------
ALTER TABLE spk_attendance ADD COLUMN IF NOT EXISTS breaks jsonb DEFAULT '[]'::jsonb;

-- --------------------------------------------------------------------
-- 2) 打刻の時刻修正申請テーブル
--    （打刻漏れ／押し間違いの「時刻」だけを本人が直して申請 → 店舗が承認）
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spk_timecard_requests (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date         date NOT NULL,                 -- 対象勤務日
  staff_name   text NOT NULL,                 -- 申請者
  field        text NOT NULL,                 -- 'start' | 'end' | 'break'
  break_index  int,                           -- field='break' の時、breaks配列の何番目か
  sub          text,                          -- 'break_start' | 'break_end'（休憩の場合どちら）
  old_value    text DEFAULT '',               -- 修正前の時刻（打刻漏れなら空）
  new_value    text DEFAULT '',               -- 申請する正しい時刻 HH:MM
  reason       text DEFAULT '',               -- 理由（押し忘れ 等）
  status       text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  decided_by   text,
  decided_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spk_tcreq_status ON spk_timecard_requests(status);
CREATE INDEX IF NOT EXISTS idx_spk_tcreq_date   ON spk_timecard_requests(date);
CREATE INDEX IF NOT EXISTS idx_spk_tcreq_staff  ON spk_timecard_requests(staff_name);

-- RLS: authenticated（社内・給与ページ）は全操作可。
--   anon は直接テーブルには触らせない（申請の追加は下記 RPC 経由＝SECURITY DEFINER）。
ALTER TABLE spk_timecard_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='spk_timecard_requests' AND policyname='tcreq_auth_all') THEN
    CREATE POLICY tcreq_auth_all ON spk_timecard_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- --------------------------------------------------------------------
-- 3-1) 打刻 RPC（出勤/退勤/休憩開始/休憩終了）
--   p_action: 'in' | 'out' | 'break_start' | 'break_end'
--   p_time  : "HH:MM"（省略時はサーバJST現在時刻）
--   打刻を正とする＝approved=true・memo='打刻' で spk_attendance の当日行に反映。
--   休憩は breaks 配列の末尾に1件appendまたは末尾のendを埋める（丸ごと再保存しない）。
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spk_staff_punch(p_token text, p_action text, p_time text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_now  text := to_char((now() at time zone 'Asia/Tokyo'), 'HH24:MI');
  v_time text;
  v_row  spk_attendance%ROWTYPE;
  v_br   jsonb;
  v_len  int;
  v_last jsonb;
  v_real boolean;
BEGIN
  SELECT name INTO v_name FROM staff WHERE share_token::text=p_token AND coalesce(active,true)=true;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_token'); END IF;

  v_time := coalesce(nullif(p_time,''), v_now);
  IF v_time !~ '^\d{2}:\d{2}$' THEN RETURN jsonb_build_object('ok',false,'error','bad_time'); END IF;

  SELECT * INTO v_row FROM spk_attendance WHERE date=v_today AND staff_name=v_name;

  -- ★ 実打刻(または協議中)の行かどうか。出勤簿の計画行(memo='')は「実打刻」ではない＝打刻をブロックしない。
  --   これが無いと、管理者が出勤簿で入れた計画行(start/end埋め)が start_time を持つため
  --   「既に出勤/退勤済み」と誤判定され、その日にシフトが入っている全スタッフが打刻できなくなる。
  v_real := (coalesce(v_row.memo,'') IN ('打刻','打刻中','仮申請') OR coalesce(v_row.memo,'') LIKE '協議中%');

  IF p_action='in' THEN
    -- 実打刻済みのときだけブロック（計画行の start_time は無視して打刻を通す）
    IF v_row.staff_name IS NOT NULL AND coalesce(v_row.start_time,'')<>'' AND v_real THEN
      RETURN jsonb_build_object('ok',false,'error','already_in','msg','既に出勤打刻済みです'); END IF;
    -- 出勤打刻＝実績で上書き。計画の end_time はクリアして退勤打刻を可能にする
    INSERT INTO spk_attendance(date,staff_name,start_time,end_time,approved,memo,absent,breaks)
      VALUES(v_today,v_name,v_time,'',true,'打刻',false,'[]'::jsonb)
      ON CONFLICT (date,staff_name) DO UPDATE SET start_time=v_time, end_time='', approved=true, memo='打刻', absent=false;
    RETURN jsonb_build_object('ok',true,'action','in','time',v_time);

  ELSIF p_action='out' THEN
    -- 実打刻の出勤が無ければ退勤不可（計画行だけでは退勤させない＝先に出勤打刻を促す）
    IF v_row.staff_name IS NULL OR coalesce(v_row.start_time,'')='' OR NOT v_real THEN
      RETURN jsonb_build_object('ok',false,'error','no_in','msg','先に出勤打刻をしてください'); END IF;
    IF coalesce(v_row.end_time,'')<>'' THEN
      RETURN jsonb_build_object('ok',false,'error','already_out','msg','既に退勤打刻済みです'); END IF;
    -- 休憩中(end空)なら退勤不可
    v_br := coalesce(v_row.breaks,'[]'::jsonb);
    v_len := jsonb_array_length(v_br);
    IF v_len>0 THEN
      v_last := v_br->(v_len-1);
      IF coalesce(v_last->>'end','')='' THEN
        RETURN jsonb_build_object('ok',false,'error','break_open','msg','休憩中です。先に休憩終了を押してください'); END IF;
    END IF;
    UPDATE spk_attendance SET end_time=v_time WHERE date=v_today AND staff_name=v_name;
    RETURN jsonb_build_object('ok',true,'action','out','time',v_time);

  ELSIF p_action='break_start' THEN
    IF v_row.staff_name IS NULL OR coalesce(v_row.start_time,'')='' OR NOT v_real THEN
      RETURN jsonb_build_object('ok',false,'error','no_in','msg','先に出勤打刻をしてください'); END IF;
    IF coalesce(v_row.end_time,'')<>'' THEN
      RETURN jsonb_build_object('ok',false,'error','already_out','msg','退勤済みのため休憩できません'); END IF;
    v_br := coalesce(v_row.breaks,'[]'::jsonb);
    v_len := jsonb_array_length(v_br);
    IF v_len>0 THEN
      v_last := v_br->(v_len-1);
      IF coalesce(v_last->>'end','')='' THEN
        RETURN jsonb_build_object('ok',false,'error','break_open','msg','既に休憩中です'); END IF;
    END IF;
    -- 既存 breaks を保持したまま1件だけ append（丸ごと再保存しない）
    UPDATE spk_attendance
      SET breaks = coalesce(breaks,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('start',v_time,'end',''))
      WHERE date=v_today AND staff_name=v_name;
    RETURN jsonb_build_object('ok',true,'action','break_start','time',v_time);

  ELSIF p_action='break_end' THEN
    IF v_row.staff_name IS NULL OR NOT v_real THEN
      RETURN jsonb_build_object('ok',false,'error','no_in','msg','出勤打刻がありません'); END IF;
    v_br := coalesce(v_row.breaks,'[]'::jsonb);
    v_len := jsonb_array_length(v_br);
    IF v_len=0 THEN RETURN jsonb_build_object('ok',false,'error','no_break','msg','休憩開始がありません'); END IF;
    v_last := v_br->(v_len-1);
    IF coalesce(v_last->>'end','')<>'' THEN
      RETURN jsonb_build_object('ok',false,'error','no_break','msg','休憩を開始していません'); END IF;
    -- 末尾要素の end だけを埋める（他要素は保持）
    UPDATE spk_attendance
      SET breaks = jsonb_set(v_br, ARRAY[(v_len-1)::text,'end'], to_jsonb(v_time), false)
      WHERE date=v_today AND staff_name=v_name;
    RETURN jsonb_build_object('ok',true,'action','break_end','time',v_time);
  END IF;

  RETURN jsonb_build_object('ok',false,'error','bad_action');
END; $function$;

-- --------------------------------------------------------------------
-- 3-2) 打刻状態を返す RPC（打刻画面の状態表示用）
--   p_date 省略 or NULL = 当日（従来互換）。
--   p_date="YYYY-MM-DD" を渡すと過去日の記録を返す（過去日の修正申請用）。
--   recent_dates = 直近30日で「打刻がある日 or シフトがある日」（対象日プルダウン用）。
-- --------------------------------------------------------------------
-- 旧1引数版を削除（新2引数版とのオーバーロード衝突＝呼び出し曖昧を防ぐ）
DROP FUNCTION IF EXISTS public.spk_staff_timecard(text);
CREATE OR REPLACE FUNCTION public.spk_staff_timecard(p_token text, p_date text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_date date;
  v_row spk_attendance%ROWTYPE;
  v_reqs jsonb;
  v_recent jsonb;
BEGIN
  SELECT name INTO v_name FROM staff WHERE share_token::text=p_token AND coalesce(active,true)=true;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_token'); END IF;
  -- 対象日（当日既定・不正な入力は当日にフォールバック）
  IF p_date IS NOT NULL AND p_date ~ '^\d{4}-\d{2}-\d{2}$' THEN v_date := p_date::date; ELSE v_date := v_today; END IF;
  SELECT * INTO v_row FROM spk_attendance WHERE date=v_date AND staff_name=v_name;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'field',field,'sub',sub,'break_index',break_index,'old_value',old_value,'new_value',new_value,'reason',reason,'status',status) ORDER BY created_at DESC),'[]'::jsonb)
    INTO v_reqs FROM spk_timecard_requests WHERE staff_name=v_name AND date=v_date;
  -- 直近30日で「打刻あり or シフトあり」の日付一覧（新しい順・重複排除）
  -- ※ date列がtext型でも安全に比較できるよう書式ガード＋::date キャスト
  SELECT coalesce(jsonb_agg(dd ORDER BY dd DESC),'[]'::jsonb) INTO v_recent FROM (
    SELECT DISTINCT date::date AS dd FROM spk_attendance
      WHERE staff_name=v_name AND date::text ~ '^\d{4}-\d{2}-\d{2}$'
        AND date::date BETWEEN (v_today - 30) AND v_today
    UNION
    SELECT DISTINCT date::date AS dd FROM shifts
      WHERE staff_name=v_name AND date::text ~ '^\d{4}-\d{2}-\d{2}$'
        AND date::date BETWEEN (v_today - 30) AND v_today
        AND (coalesce(symbol,'')='●' OR (coalesce(symbol,'')='' AND coalesce(start_time,'')<>''))
  ) u;
  RETURN jsonb_build_object(
    'ok',true,
    'staff',v_name,
    'date',v_date,
    'today',v_today,
    'start',coalesce(v_row.start_time,''),
    'end',coalesce(v_row.end_time,''),
    'breaks',coalesce(v_row.breaks,'[]'::jsonb),
    'requests',v_reqs,
    'recent_dates',v_recent
  );
END; $function$;

-- --------------------------------------------------------------------
-- 3-3) 時刻修正申請 RPC（本人が個人リンクから申請 → pending で追加）
--   p_field: 'start' | 'end' | 'break'
--   p_sub  : 'break_start' | 'break_end'（break のとき）
--   p_break_index: breaks配列の何番目か（break のとき）
--   p_new_value: 正しい時刻 HH:MM
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spk_staff_timecard_request(
  p_token text, p_date text, p_field text, p_new_value text,
  p_reason text DEFAULT '', p_sub text DEFAULT NULL, p_break_index int DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_row  spk_attendance%ROWTYPE;
  v_old  text := '';
  v_br   jsonb;
BEGIN
  SELECT name INTO v_name FROM staff WHERE share_token::text=p_token AND coalesce(active,true)=true;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_token'); END IF;
  IF p_date !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN jsonb_build_object('ok',false,'error','bad_date'); END IF;
  IF p_new_value !~ '^\d{2}:\d{2}$' THEN RETURN jsonb_build_object('ok',false,'error','bad_time','msg','時刻はHH:MM形式で入力してください'); END IF;
  IF p_field NOT IN ('start','end','break') THEN RETURN jsonb_build_object('ok',false,'error','bad_field'); END IF;

  -- 修正前の値を拾う（打刻漏れなら空のまま）
  SELECT * INTO v_row FROM spk_attendance WHERE date=p_date::date AND staff_name=v_name;
  IF p_field='start' THEN v_old := coalesce(v_row.start_time,'');
  ELSIF p_field='end' THEN v_old := coalesce(v_row.end_time,'');
  ELSIF p_field='break' THEN
    v_br := coalesce(v_row.breaks,'[]'::jsonb);
    IF p_break_index IS NOT NULL AND p_break_index >= 0 AND p_break_index < jsonb_array_length(v_br) THEN
      IF p_sub='break_end' THEN v_old := coalesce((v_br->p_break_index)->>'end','');
      ELSE v_old := coalesce((v_br->p_break_index)->>'start',''); END IF;
    END IF;
  END IF;

  INSERT INTO spk_timecard_requests(date,staff_name,field,break_index,sub,old_value,new_value,reason,status)
    VALUES(p_date::date, v_name, p_field, p_break_index, p_sub, v_old, p_new_value, coalesce(p_reason,''), 'pending');

  RETURN jsonb_build_object('ok',true,'old',v_old,'new',p_new_value);
END; $function$;

-- --------------------------------------------------------------------
-- RPC 実行権限（anon/authenticated から呼べるように）
-- --------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.spk_staff_punch(text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spk_staff_timecard(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spk_staff_timecard_request(text,text,text,text,text,text,int) TO anon, authenticated;

-- 完了。アプリをリロードすると打刻・給与ページに反映されます。
