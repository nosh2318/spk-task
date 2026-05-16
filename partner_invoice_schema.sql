-- ============================================================
-- HANDYMAN 協力会社 請求書・レベニュー率 機能
-- 作成: 2026-05-16
-- 対象Supabase: ckrxttbnawkclshczsia
-- 適用方法: Supabase Dashboard > SQL Editor で全文貼付 → Run
-- ============================================================

-- ① partner_companies にデフォルト レベニュー率（協力会社の取り分%）追加
ALTER TABLE partner_companies
  ADD COLUMN IF NOT EXISTS revenue_rate NUMERIC(5,2) DEFAULT 70.00;
COMMENT ON COLUMN partner_companies.revenue_rate IS '協力会社のデフォルトレベニュー率(%) 例: 70.00 = 売上の70%が協力会社取り分';

-- ② 月別請求書テーブル
CREATE TABLE IF NOT EXISTS partner_invoices (
  id              BIGSERIAL PRIMARY KEY,
  owner_company   TEXT NOT NULL,
  year_month      TEXT NOT NULL,                    -- '2026-05' 形式
  total_revenue   NUMERIC NOT NULL DEFAULT 0,        -- 総売上 (キャンセル除外)
  revenue_rate    NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  partner_share   NUMERIC NOT NULL DEFAULT 0,        -- 協力会社取り分 = total_revenue * rate / 100
  status          TEXT NOT NULL DEFAULT 'pending',   -- pending=未請求 / sent=請求済 / paid=入金済
  reservation_count INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  memo            TEXT,
  payload         JSONB,                              -- 明細スナップショット
  UNIQUE(owner_company, year_month)
);
CREATE INDEX IF NOT EXISTS idx_partner_invoices_company_ym ON partner_invoices(owner_company, year_month DESC);
CREATE INDEX IF NOT EXISTS idx_partner_invoices_status ON partner_invoices(status);

COMMENT ON TABLE partner_invoices IS '協力会社月別請求書履歴';

-- ③ RLS
ALTER TABLE partner_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_full_access" ON partner_invoices;
CREATE POLICY "auth_full_access" ON partner_invoices
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ④ 動作確認用
-- SELECT id, label, revenue_rate FROM partner_companies;
-- SELECT * FROM partner_invoices LIMIT 5;
