-- 2026-10-11 価格コンソール：店の切替に対応。キャンペーンを店ごとに分ける（店列が無く、全店で同じ一覧が出ていた）。
-- 適用時点で pc_campaign は0行＝既存データへの影響なし。null許容（旧行があっても壊さない）。
ALTER TABLE pc_campaign ADD COLUMN IF NOT EXISTS store text REFERENCES pc_store(id);
CREATE INDEX IF NOT EXISTS idx_pc_campaign_store ON pc_campaign (store, created_at DESC);
-- 戻し: DROP INDEX IF EXISTS idx_pc_campaign_store; ALTER TABLE pc_campaign DROP COLUMN IF EXISTS store;
