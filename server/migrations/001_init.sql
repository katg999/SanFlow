-- SanFlow & WASHLink — initial schema (PostgreSQL 14+ with PostGIS)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Operators and service providers are organisations; users belong to at most one.
CREATE TABLE organisations (
  id            text PRIMARY KEY,
  kind          text NOT NULL CHECK (kind IN ('operator', 'provider')),
  name          text NOT NULL,
  provider_kind text CHECK (provider_kind IN ('Sewage exhauster', 'Waste collector', 'Water point repair')),
  zone          text NOT NULL DEFAULT 'Nairobi',
  licensed      boolean NOT NULL DEFAULT false,
  licence_no    text,
  rating        numeric(2,1) NOT NULL DEFAULT 0,
  phone         text,
  services      text[] NOT NULL DEFAULT '{}',
  fleet         int NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'citizen'
                CHECK (role IN ('citizen', 'operator', 'provider', 'municipality', 'admin')),
  org_id        text REFERENCES organisations(id) ON DELETE SET NULL,
  phone         text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE treatment_partners (
  id      text PRIMARY KEY,
  name    text NOT NULL,
  product text NOT NULL
);

CREATE TABLE facilities (
  id             text PRIMARY KEY,
  category       text NOT NULL CHECK (category IN ('toilet', 'water', 'waste', 'health')),
  name           text NOT NULL,
  area           text NOT NULL,
  country        text NOT NULL,
  geom           geography(Point, 4326) NOT NULL,
  image          text,
  description    text,
  hours          text,
  status         text NOT NULL DEFAULT 'unverified',
  fee            int CHECK (fee >= 0),
  amenities      text[] NOT NULL DEFAULT '{}',
  licensed       boolean,
  licence_no     text,
  discount_pct   int CHECK (discount_pct BETWEEN 0 AND 90),
  discount_label text,
  photos         text[] NOT NULL DEFAULT '{}',
  owner_org_id   text REFERENCES organisations(id) ON DELETE SET NULL,
  source         text NOT NULL DEFAULT 'curated',
  rating         numeric(3,2) NOT NULL DEFAULT 0,
  ratings_count  int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX facilities_geom_idx ON facilities USING GIST (geom);
CREATE INDEX facilities_category_idx ON facilities (category);
CREATE INDEX facilities_owner_idx ON facilities (owner_org_id);

CREATE TABLE facility_state (
  facility_id            text PRIMARY KEY REFERENCES facilities(id) ON DELETE CASCADE,
  last_cleaned_at        timestamptz,
  queue                  text CHECK (queue IN ('none', 'short', 'long')),
  water_quality          text CHECK (water_quality IN ('safe', 'treated', 'untested', 'unsafe')),
  usage_count            int NOT NULL DEFAULT 0,
  capacity               int NOT NULL DEFAULT 400,
  broken_since           timestamptz,
  last_confirmed_at      timestamptz,
  last_confirmed_working boolean
);

CREATE TABLE facility_daily (
  facility_id text NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  day         date NOT NULL,
  customers   int NOT NULL DEFAULT 0,
  PRIMARY KEY (facility_id, day)
);

CREATE TABLE ratings (
  id          bigserial PRIMARY KEY,
  facility_id text NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  user_key    text NOT NULL,           -- user uuid, or "dev:<device id>" for anonymous raters
  stars       smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (facility_id, user_key)
);

CREATE TABLE reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id   text REFERENCES facilities(id) ON DELETE SET NULL,
  type          text NOT NULL CHECK (type IN ('broken', 'full', 'dirty', 'dumping')),
  note          text NOT NULL DEFAULT '',
  photo         text,
  geom          geography(Point, 4326),
  reporter_key  text NOT NULL,
  reporter_name text NOT NULL DEFAULT 'Anonymous',
  weight        numeric(3,2) NOT NULL DEFAULT 1,
  verified      boolean NOT NULL DEFAULT false,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'resolved')),
  assigned_kind text CHECK (assigned_kind IN ('provider', 'operator')),
  assigned_id   text,
  assigned_name text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);
CREATE INDEX reports_verify_idx ON reports (facility_id, type, created_at DESC);
CREATE INDEX reports_status_idx ON reports (status);
CREATE INDEX reports_geom_idx ON reports USING GIST (geom);

CREATE SEQUENCE receipt_seq START 1001;

CREATE TABLE jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL CHECK (type IN ('pit', 'waste', 'water')),
  facility_id  text REFERENCES facilities(id) ON DELETE SET NULL,
  report_id    uuid REFERENCES reports(id) ON DELETE SET NULL,
  geom         geography(Point, 4326),
  priority     text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  zone         text NOT NULL DEFAULT 'Nairobi',
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'done')),
  provider_id  text REFERENCES organisations(id) ON DELETE SET NULL,
  volume_m3    numeric(6,1),
  amount_kes   int,
  destination  text REFERENCES treatment_partners(id),
  before_photo text,
  after_photo  text,
  receipt_no   text UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX jobs_status_zone_idx ON jobs (status, zone);
CREATE INDEX jobs_provider_idx ON jobs (provider_id);

CREATE TABLE wards (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  city       text NOT NULL,
  center     geography(Point, 4326) NOT NULL,
  radius_m   int NOT NULL,
  population int NOT NULL,
  boundary   geography(Polygon, 4326)   -- replace the centre+radius approximation with real ward polygons
);
CREATE INDEX wards_center_idx ON wards USING GIST (center);

CREATE TABLE notices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL,
  area       text NOT NULL DEFAULT 'All areas',
  channels   text NOT NULL DEFAULT 'App',
  recipients int NOT NULL DEFAULT 0,
  sent_by    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  actor_id   uuid,
  actor_name text NOT NULL,
  action     text NOT NULL,
  target     text NOT NULL DEFAULT ''
);
CREATE INDEX audit_at_idx ON audit_log (at DESC);
