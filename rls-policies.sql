-- ============================================================
-- RLS (Row Level Security) ポリシー - 札幌店 (SPK)
-- 前提: Supabase Anonymous Auth が有効化済みであること
-- GAS側は service_role キー使用（RLSバイパス）
-- ============================================================

-- 全テーブルにRLSを有効化
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE spk_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE jalan_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE spk_accounting ENABLE ROW LEVEL SECURITY;
ALTER TABLE spk_memos ENABLE ROW LEVEL SECURITY;

-- Tier 1: 業務テーブル（認証済みユーザーにフルアクセス）
-- "authenticated" = サインイン済み（Anonymous Auth含む）
CREATE POLICY "auth_all" ON reservations FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_all" ON fleet FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_all" ON tasks FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_all" ON vehicles FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_all" ON maintenance FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_all" ON places FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_all" ON jalan_payment FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_all" ON spk_memos FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Tier 2: センシティブテーブル（将来的に制限強化の対象）
CREATE POLICY "auth_all" ON staff FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_all" ON shifts FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_all" ON spk_attendance FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_all" ON spk_accounting FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Tier 3: アプリ設定
CREATE POLICY "auth_select" ON app_settings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth_insert" ON app_settings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_update" ON app_settings FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth_delete" ON app_settings FOR DELETE
  USING (auth.role() = 'authenticated');

-- パスコードをDBに格納（PAS_CODEハードコード廃止用）
INSERT INTO app_settings (key, value) VALUES ('pas_code', '2318')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
