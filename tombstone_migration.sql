-- ============================================================
-- 恒久ルール実装: 手入力データの「消したのに復活」根絶（墓標=soft delete）
-- 2026-07-03 オーナー指示「入力したものはそのまま保存・移動しない・消さない・消したら復活しない」
-- 対象: 札幌 tasks / 那覇 nha_tasks
-- 物理削除(.delete)をやめ、deleted=true の墓標で残す。
--   → 再生成/マージ/他端末が同じ _id を二度と復活させられない（行が墓標として存在し続けるため）。
--   → loadTasks は deleted IS NOT TRUE のみ表示。
-- 冪等（IF NOT EXISTS）。1回RUNでOK。既存行は deleted=false 相当。
-- ============================================================

ALTER TABLE tasks     ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false;
ALTER TABLE nha_tasks ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false;

-- 表示クエリ（date 絞り込み）を速く保つための部分インデックス
CREATE INDEX IF NOT EXISTS idx_tasks_active     ON tasks(date)     WHERE deleted IS NOT TRUE;
CREATE INDEX IF NOT EXISTS idx_nha_tasks_active ON nha_tasks(date) WHERE deleted IS NOT TRUE;
