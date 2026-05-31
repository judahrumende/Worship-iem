-- WorshipIEM schema
CREATE TABLE IF NOT EXISTS accounts (
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,        -- bcrypt hash
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id            SERIAL PRIMARY KEY,
  code          CHAR(6) UNIQUE NOT NULL,
  owner_id      INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setlists (
  id          SERIAL PRIMARY KEY,
  room_id     INTEGER UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  items       JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rooms_code_idx ON rooms(code);
CREATE INDEX IF NOT EXISTS setlists_room_idx ON setlists(room_id);
