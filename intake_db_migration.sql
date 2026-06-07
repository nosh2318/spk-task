-- 入庫管理システム Phase1 DB拡張（2026-06-07）
-- メインSupabase (ckrxttbnawkclshczsia) SQL Editor で1回RUN
-- maintenance テーブル＝入庫レコード（配車表ブロック連動は既存のまま）
alter table maintenance add column if not exists status text;            -- requested(依頼中)/confirmed(日程確定)/in_shop(入庫中)/done(完了)。null=旧データ(確定扱い)
alter table maintenance add column if not exists work_detail text;       -- 作業内容（協力会社との調整内容）
alter table maintenance add column if not exists repair_cause text;      -- 修理のみ: accident(事故)/breakdown(故障)/damage(傷)
alter table maintenance add column if not exists actual_out_date date;   -- 実出庫日（完了時）
alter table maintenance add column if not exists candidate_dates jsonb;  -- 日程候補（協力会社との調整用）
alter table maintenance add column if not exists created_at timestamptz default now();

-- 既存の車検/点検/修理ブロック（label IN (車検,半年点検,修理)）は status=null=「確定」扱いで互換維持
