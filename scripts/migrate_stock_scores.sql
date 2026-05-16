-- ============================================================
-- 補充 stock_scores 缺少的欄位
-- 在 Supabase Dashboard > SQL Editor 執行此檔案
-- ============================================================

ALTER TABLE stock_scores
  ADD COLUMN IF NOT EXISTS sector       TEXT,
  ADD COLUMN IF NOT EXISTS signal_type  TEXT,
  ADD COLUMN IF NOT EXISTS vol_score    INTEGER,
  ADD COLUMN IF NOT EXISTS chip_score   INTEGER,
  ADD COLUMN IF NOT EXISTS tech_score   INTEGER,
  ADD COLUMN IF NOT EXISTS risk_score   INTEGER,
  ADD COLUMN IF NOT EXISTS tech_detail  JSONB,
  ADD COLUMN IF NOT EXISTS chip_detail  JSONB,
  ADD COLUMN IF NOT EXISTS reason       TEXT,
  ADD COLUMN IF NOT EXISTS boom_prob    INTEGER,
  ADD COLUMN IF NOT EXISTS volume_b     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS chg_pct      NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS target2      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS name         TEXT;

-- 確認結果
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'stock_scores'
ORDER BY ordinal_position;
