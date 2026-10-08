-- 2026-10-08 価格コンソール C-10/C-11 修正：入力リスト(pc_input_queue)でCP行と通常行を区別する。
-- 目的：通常の価格変更とキャンペーン(CP)が互いの入力待ちを「上書き取消」しないようにする。
--   通常保存 → kind='manual' の入力待ちだけ上書き取消（CP行には触れない）。
--   CP反映  → kind='cp' かつ同一 campaign_id の入力待ちだけ上書き取消（通常行には触れない）。
-- 追加列はnull許容・デフォルト'manual'＝既存行は壊さない。適用後に price-console.html の push を同時に行うこと（列が無いと新コードが失敗するため）。

ALTER TABLE pc_input_queue ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'manual'; -- manual / cp
ALTER TABLE pc_input_queue ADD COLUMN IF NOT EXISTS campaign_id bigint;                  -- kind='cp' のとき pc_campaign.id

-- 既存の入力待ち行を種別で埋め戻し（nights_note が 'CP%' の行は過去のCP反映）
UPDATE pc_input_queue SET kind='cp'     WHERE kind='manual' AND coalesce(nights_note,'') ILIKE 'CP%';
UPDATE pc_input_queue SET kind='manual' WHERE kind IS NULL;

CREATE INDEX IF NOT EXISTS idx_pc_input_queue_kind ON pc_input_queue (store, ota, class, tier, status, kind);
