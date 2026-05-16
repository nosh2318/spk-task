-- ============================================================
-- HANDYMAN 協力会社車両運用 DB拡張
-- 作成: 2026-05-16
-- 対象Supabase: ckrxttbnawkclshczsia (SPK + NHA 共通DB)
-- 適用方法: Supabase Dashboard > SQL Editor で全文貼付 → Run
-- ============================================================

-- ────────────────────────────────────────────────
-- ① vehicles に所有者カラム追加
-- ────────────────────────────────────────────────
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS owner_company TEXT NOT NULL DEFAULT 'HANDYMAN';
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS owner_label TEXT;
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_company);

-- 既存全車両を 'HANDYMAN' に統一（念のため）
UPDATE vehicles SET owner_company = 'HANDYMAN' WHERE owner_company IS NULL OR owner_company = '';

COMMENT ON COLUMN vehicles.owner_company IS '所有者識別子。HANDYMAN=自社、PARTNER_XXX=協力会社';
COMMENT ON COLUMN vehicles.owner_label   IS '表示用ラベル名（例: 〇〇モータース）';

-- ────────────────────────────────────────────────
-- ② maintenance にブロック種別カラム追加
-- ────────────────────────────────────────────────
ALTER TABLE maintenance
  ADD COLUMN IF NOT EXISTS block_type TEXT NOT NULL DEFAULT 'maintenance';
ALTER TABLE maintenance
  ADD COLUMN IF NOT EXISTS owner_company TEXT;
CREATE INDEX IF NOT EXISTS idx_maintenance_block_type ON maintenance(block_type);

COMMENT ON COLUMN maintenance.block_type    IS 'ブロック種別。maintenance=整備、partner_reserved=協力会社の自社予約';
COMMENT ON COLUMN maintenance.owner_company IS '登録者の所属会社（HANDYMAN or PARTNER_XXX）';

-- ────────────────────────────────────────────────
-- ③ partner_actions テーブル新設（Slack通知用キュー）
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_actions (
  id              BIGSERIAL PRIMARY KEY,
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_company   TEXT NOT NULL,
  user_email      TEXT,
  action_type     TEXT NOT NULL,
    -- 'maintenance_add' | 'maintenance_delete'
    -- 'partner_reserved_add' | 'partner_reserved_delete'
  vehicle_code     TEXT NOT NULL,
  target_date_from DATE,
  target_date_to   DATE,
  payload          JSONB,
  notified_slack   BOOLEAN NOT NULL DEFAULT FALSE,
  notified_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_partner_actions_unnotified
  ON partner_actions(notified_slack) WHERE notified_slack = false;
CREATE INDEX IF NOT EXISTS idx_partner_actions_owner_ts
  ON partner_actions(owner_company, ts DESC);

-- ────────────────────────────────────────────────
-- ④ RLS（partner_actions のみ・暫定）
-- 既存 vehicles / maintenance には authenticated 全許可ポリシーが
-- セキュリティ強化（2026-05-13）で設定済み。
-- 協力会社用の owner_company ベースRLSは Phase 3（Supabase Auth 連携時）に追加。
-- ────────────────────────────────────────────────
ALTER TABLE partner_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_full_access" ON partner_actions;
CREATE POLICY "auth_full_access" ON partner_actions
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────
-- 動作確認用 SELECT（実行後に手動確認）
-- ────────────────────────────────────────────────
-- 1. vehicles のowner_company が全件 'HANDYMAN' になっているか
-- SELECT owner_company, COUNT(*) FROM vehicles GROUP BY owner_company;
--
-- 2. maintenance に block_type カラムが追加されたか
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name='maintenance' AND column_name IN ('block_type', 'owner_company');
--
-- 3. partner_actions テーブルが作成されたか
-- SELECT table_name FROM information_schema.tables WHERE table_name='partner_actions';

-- ============================================================
-- ロールバックSQL（必要時のみ使用・通常は不要）
-- ============================================================
-- DROP TABLE IF EXISTS partner_actions CASCADE;
-- ALTER TABLE maintenance DROP COLUMN IF EXISTS block_type;
-- ALTER TABLE maintenance DROP COLUMN IF EXISTS owner_company;
-- ALTER TABLE vehicles DROP COLUMN IF EXISTS owner_label;
-- ALTER TABLE vehicles DROP COLUMN IF EXISTS owner_company;
