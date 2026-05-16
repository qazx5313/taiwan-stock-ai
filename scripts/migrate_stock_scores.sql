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

-- ============================================================
-- 機器人相關資料表（新增）
-- ============================================================

-- 機器人狀態表（每個機器人一筆）
CREATE TABLE IF NOT EXISTS robot_states (
  robot_id      TEXT PRIMARY KEY,
  capital       NUMERIC(14,2) DEFAULT 1000000,
  holdings_json TEXT DEFAULT '[]',
  total_pnl     NUMERIC(14,2) DEFAULT 0,
  total_trades  INTEGER DEFAULT 0,
  wins          INTEGER DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 機器人交易紀錄
CREATE TABLE IF NOT EXISTS robot_trades (
  id          BIGSERIAL PRIMARY KEY,
  robot_id    TEXT NOT NULL,
  symbol      TEXT,
  name        TEXT,
  action      TEXT,   -- 買進/賣出
  price       NUMERIC(10,2),
  buy_price   NUMERIC(10,2),
  shares      INTEGER DEFAULT 1,
  pnl         NUMERIC(14,2),
  pnl_pct     NUMERIC(8,2),
  reason      TEXT,
  hold_days   INTEGER,
  result      TEXT,   -- 獲利/虧損/持有中
  trade_date  DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE robot_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon all robot_states" ON robot_states;
CREATE POLICY "anon all robot_states" ON robot_states FOR ALL USING (true);

ALTER TABLE robot_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon all robot_trades" ON robot_trades;
CREATE POLICY "anon all robot_trades" ON robot_trades FOR ALL USING (true);

-- 索引
CREATE INDEX IF NOT EXISTS idx_robot_trades_robot_id ON robot_trades(robot_id);
CREATE INDEX IF NOT EXISTS idx_robot_trades_date ON robot_trades(trade_date DESC);
