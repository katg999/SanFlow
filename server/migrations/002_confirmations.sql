-- "Is this water point working today? Yes/No" answers. A single "Yes" must not be able to
-- flip a broken facility back to operational, so we keep each answer and require 2 distinct people.
CREATE TABLE confirmations (
  id           bigserial PRIMARY KEY,
  facility_id  text NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  reporter_key text NOT NULL,
  working      boolean NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX confirmations_idx ON confirmations (facility_id, created_at DESC);
