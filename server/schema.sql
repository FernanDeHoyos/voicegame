CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY,
  invite_code TEXT UNIQUE NOT NULL,
  player1_token_hash CHAR(64) NOT NULL,
  player2_token_hash CHAR(64),
  state JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closing')),
  player1_last_seen TIMESTAMPTZ NOT NULL,
  player2_last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  last_activity TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS player1_last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS player2_last_seen TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS rooms_expiration_idx ON rooms (expires_at);
