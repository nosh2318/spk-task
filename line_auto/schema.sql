-- ============================================================
-- HANDYMAN 札幌店 LINE自動送信システム DBスキーマ
-- 対象Supabase: ckrxttbnawkclshczsia (NHA/SPK共有)  ※札幌のみ利用
-- 作成: 2026-07-02
-- 実行: Supabase SQL Editor でRUN（RLS非対象なのでDDL/初期INSERT可）
-- ============================================================

-- 1) userId ↔ 予約番号 マッピング（エルメ フォーム回答が正本ソース）
create table if not exists spk_line_links (
  resv_no       text primary key,          -- 予約番号（reservations.id と完全一致で突合）
  line_user_id  text not null,             -- LINE userId (U + 32hex)
  line_name     text,                      -- LINE名
  cust_name     text,                      -- 予約者名
  media         text,                      -- 予約媒体
  del_date      text,                      -- お届け希望日
  del_time      text,                      -- お届け希望時刻
  del_place     text,                      -- お届け希望場所
  col_date      text,                      -- 返却希望日
  col_time      text,                      -- 返却希望時刻
  col_place     text,                      -- 返却希望場所
  answer_id     bigint,                    -- エルメ回答ID（最新判定用）
  answered_at   timestamptz,               -- 回答日時
  source        text default 'erume_csv',  -- 取込元
  updated_at    timestamptz default now()
);
create index if not exists idx_spk_line_links_uid on spk_line_links(line_user_id);

-- 2) 送信ログ（実績フラグ＝「送れたか」の正本・監査）
create table if not exists spk_line_sends (
  id           bigserial primary key,
  resv_no      text not null,
  action       text not null,             -- 'damage_check' | 'track_del' | 'track_col'
  line_user_id text,
  status       text not null,             -- 'sent' | 'no_userid' | 'failed' | 'skipped'
  message      text,                      -- 送信本文（監査用）
  error        text,
  sent_at      timestamptz default now()
);
create index if not exists idx_spk_line_sends_resv on spk_line_sends(resv_no, action);
create index if not exists idx_spk_line_sends_at on spk_line_sends(sent_at desc);

-- 3) RLS: 読み取りはauthenticated（APPバッジ/手動リスト用）、書き込みはservice_roleのみ（Edge Function）
alter table spk_line_links enable row level security;
alter table spk_line_sends enable row level security;

drop policy if exists p_links_read on spk_line_links;
create policy p_links_read on spk_line_links for select to authenticated using (true);

drop policy if exists p_sends_read on spk_line_sends;
create policy p_sends_read on spk_line_sends for select to authenticated using (true);
-- INSERT/UPDATE は service_role（RLSバイパス）で行う＝ポリシー不要
