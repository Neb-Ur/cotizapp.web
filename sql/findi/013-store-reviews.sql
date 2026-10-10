BEGIN;
CREATE TABLE IF NOT EXISTS findi.store_reviews (
  id text PRIMARY KEY,
  store_id text NOT NULL REFERENCES findi.stores(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES findi.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(comment) BETWEEN 5 AND 1500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  api_payload jsonb NOT NULL,
  UNIQUE (store_id, user_id)
);
CREATE INDEX IF NOT EXISTS store_reviews_store_date_idx ON findi.store_reviews (store_id, updated_at DESC, id);
ALTER TABLE findi.store_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY trusted_backend ON findi.store_reviews TO findi_backend USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON findi.store_reviews TO findi_backend;
COMMIT;
