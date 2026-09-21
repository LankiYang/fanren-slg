CREATE TABLE IF NOT EXISTS fanren_schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fanren_world_state (
  id TEXT PRIMARY KEY,
  revision BIGINT NOT NULL DEFAULT 0,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO fanren_schema_migrations (version)
VALUES (1)
ON CONFLICT (version) DO NOTHING;
