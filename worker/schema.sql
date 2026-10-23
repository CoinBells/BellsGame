-- Bells Village Rush: private D1 storage. Apply with wrangler d1 execute before deployment.
CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','finished','lost','abandoned')),
  score INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rounds_user ON rounds(user_id,status);
CREATE TABLE IF NOT EXISTS scores (
  scope TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  best_score INTEGER NOT NULL CHECK(best_score>=0),
  achieved_at INTEGER NOT NULL,
  PRIMARY KEY(scope,user_id)
);
CREATE INDEX IF NOT EXISTS idx_top_scores ON scores(scope,best_score DESC,achieved_at ASC);
