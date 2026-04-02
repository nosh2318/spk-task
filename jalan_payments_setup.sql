-- じゃらん事前決済 自動管理テーブル
-- 実行場所: Supabase Dashboard > SQL Editor
-- 既存の jalan_payment テーブルは旧データ用にそのまま残す

CREATE TABLE IF NOT EXISTS jalan_payments (
  id serial PRIMARY KEY,
  reservation_id text UNIQUE NOT NULL,
  customer_name text,
  customer_email text,
  amount integer DEFAULT 0,
  status text DEFAULT 'new' CHECK (status IN ('new','link_created','email_sent','paid','cancelled','refund','refunded')),
  square_payment_url text,
  slack_ts text,
  slack_thread_ts text,
  email_sent_at timestamptz,
  link_created_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  lend_date text,
  return_date text,
  vehicle_class text,
  memo text,
  created_at timestamptz DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_jalan_payments_status ON jalan_payments(status);
CREATE INDEX IF NOT EXISTS idx_jalan_payments_reservation_id ON jalan_payments(reservation_id);

-- RLS（anon読み書き許可 — 内部管理用）
ALTER TABLE jalan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jalan_payments_anon_all" ON jalan_payments FOR ALL TO anon USING (true) WITH CHECK (true);

-- 確認
SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'jalan_payments' ORDER BY ordinal_position;
