-- ============================================================
-- HANDYMAN 協力会社マスター テーブル
-- 作成: 2026-05-16
-- 対象Supabase: ckrxttbnawkclshczsia (SPK + NHA 共通DB)
-- 適用方法: Supabase Dashboard > SQL Editor で全文貼付 → Run
-- ============================================================

-- 協力会社マスター
CREATE TABLE IF NOT EXISTS partner_companies (
  id              TEXT PRIMARY KEY,                -- 'PARTNER_001' 形式の識別子
  label           TEXT NOT NULL,                    -- 表示用ラベル '○○モータース'
  contact_email   TEXT,                             -- 担当者メール
  contact_name    TEXT,                             -- 担当者名
  contact_tel     TEXT,                             -- 担当者電話
  memo            TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_companies_active ON partner_companies(active);

COMMENT ON TABLE  partner_companies IS '協力会社マスター（vehicles.owner_company で参照）';
COMMENT ON COLUMN partner_companies.id IS '識別子。vehicles.owner_company と一致させる';

-- RLS
ALTER TABLE partner_companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_full_access" ON partner_companies;
CREATE POLICY "auth_full_access" ON partner_companies
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 初期データ（必要ならコメント外して登録）
-- INSERT INTO partner_companies (id, label, contact_email, contact_name) VALUES
--   ('PARTNER_001', '〇〇モータース', 'yamada@partner.co.jp', '山田太郎')
-- ON CONFLICT (id) DO NOTHING;

-- 動作確認
-- SELECT * FROM partner_companies;
