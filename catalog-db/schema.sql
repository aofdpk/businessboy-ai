BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS gen3_catalog_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('staged', 'active', 'retired', 'failed')),
  schema_version INTEGER NOT NULL DEFAULT 3,
  generated_at TIMESTAMPTZ NOT NULL,
  source_checked_at TIMESTAMPTZ,
  total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS gen3_catalog_one_active_run
  ON gen3_catalog_runs ((status)) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS gen3_catalog_products (
  run_id TEXT NOT NULL REFERENCES gen3_catalog_runs(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  public_id TEXT NOT NULL,
  rank INTEGER,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  category_group_key TEXT NOT NULL,
  category_group TEXT NOT NULL,
  category_key TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory_key TEXT,
  subcategory TEXT,
  image_url TEXT NOT NULL,
  clean_name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  price_min NUMERIC(14,2),
  price_max NUMERIC(14,2),
  price_type TEXT NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'range')),
  checked_at TIMESTAMPTZ NOT NULL,
  product_url TEXT NOT NULL,
  shop_name TEXT,
  item_sold BIGINT,
  rating NUMERIC(3,2),
  likes BIGINT,
  shop_rating NUMERIC(3,2),
  shop_type TEXT NOT NULL DEFAULT 'general' CHECK (shop_type IN ('official', 'preferred', 'general')),
  stock_status TEXT NOT NULL DEFAULT 'unknown' CHECK (stock_status IN ('in-stock', 'unknown')),
  stock_level TEXT CHECK (stock_level IN ('low', 'available', 'high')),
  recommendation_score NUMERIC(12,4) NOT NULL DEFAULT 0,
  reason_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  season_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  month_tags SMALLINT[] NOT NULL DEFAULT ARRAY[]::SMALLINT[],
  seasonal_score SMALLINT NOT NULL DEFAULT 0 CHECK (seasonal_score BETWEEN 0 AND 100),
  season_reason TEXT NOT NULL DEFAULT '',
  metadata_version TEXT NOT NULL DEFAULT 'seasonal-legacy',
  evergreen BOOLEAN NOT NULL DEFAULT FALSE,
  season_scores JSONB NOT NULL DEFAULT '{}'::JSONB,
  season_reasons JSONB NOT NULL DEFAULT '{}'::JSONB,
  month_scores JSONB NOT NULL DEFAULT '{}'::JSONB,
  month_reasons JSONB NOT NULL DEFAULT '{}'::JSONB,
  campaign_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  risk_tier TEXT NOT NULL CHECK (risk_tier IN ('green', 'amber')),
  review_status TEXT NOT NULL CHECK (review_status IN ('approved', 'conditional', 'blocked', 'pending')),
  review_method TEXT,
  reviewed_at TIMESTAMPTZ,
  normalized_search_text TEXT NOT NULL,
  source_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, id),
  CHECK (price_min IS NULL OR price_min >= 0),
  CHECK (price_max IS NULL OR price_max >= 0),
  CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  CHECK (shop_rating IS NULL OR shop_rating BETWEEN 0 AND 5),
  CHECK (jsonb_typeof(season_scores) = 'object'),
  CHECK (jsonb_typeof(season_reasons) = 'object'),
  CHECK (jsonb_typeof(month_scores) = 'object'),
  CHECK (jsonb_typeof(month_reasons) = 'object')
);

ALTER TABLE gen3_catalog_products ADD COLUMN IF NOT EXISTS metadata_version TEXT NOT NULL DEFAULT 'seasonal-legacy';
ALTER TABLE gen3_catalog_products ADD COLUMN IF NOT EXISTS evergreen BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE gen3_catalog_products ADD COLUMN IF NOT EXISTS season_scores JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE gen3_catalog_products ADD COLUMN IF NOT EXISTS season_reasons JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE gen3_catalog_products ADD COLUMN IF NOT EXISTS month_scores JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE gen3_catalog_products ADD COLUMN IF NOT EXISTS month_reasons JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE gen3_catalog_products ADD COLUMN IF NOT EXISTS campaign_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS gen3_catalog_recommended_idx
  ON gen3_catalog_products (run_id, featured, review_status, recommendation_score DESC, rank, public_id);
CREATE UNIQUE INDEX IF NOT EXISTS gen3_catalog_public_id_idx
  ON gen3_catalog_products (run_id, public_id);
CREATE INDEX IF NOT EXISTS gen3_catalog_category_idx
  ON gen3_catalog_products (run_id, category_group_key, category_key, subcategory_key, recommendation_score DESC, public_id);
CREATE INDEX IF NOT EXISTS gen3_catalog_sold_idx
  ON gen3_catalog_products (run_id, item_sold DESC, recommendation_score DESC, public_id);
CREATE INDEX IF NOT EXISTS gen3_catalog_rating_idx
  ON gen3_catalog_products (run_id, rating DESC, item_sold DESC, public_id);
CREATE INDEX IF NOT EXISTS gen3_catalog_price_min_idx
  ON gen3_catalog_products (run_id, price_min, public_id);
CREATE INDEX IF NOT EXISTS gen3_catalog_price_max_idx
  ON gen3_catalog_products (run_id, price_max DESC, public_id);
CREATE INDEX IF NOT EXISTS gen3_catalog_checked_idx
  ON gen3_catalog_products (run_id, checked_at DESC, public_id);
CREATE INDEX IF NOT EXISTS gen3_catalog_shop_stock_idx
  ON gen3_catalog_products (run_id, shop_type, stock_status, recommendation_score DESC, public_id);
CREATE INDEX IF NOT EXISTS gen3_catalog_seasons_gin
  ON gen3_catalog_products USING GIN (season_tags);
CREATE INDEX IF NOT EXISTS gen3_catalog_months_gin
  ON gen3_catalog_products USING GIN (month_tags);
CREATE INDEX IF NOT EXISTS gen3_catalog_evergreen_idx
  ON gen3_catalog_products (run_id, evergreen, recommendation_score DESC, public_id);
CREATE INDEX IF NOT EXISTS gen3_catalog_search_trgm
  ON gen3_catalog_products USING GIN (normalized_search_text gin_trgm_ops);

CREATE OR REPLACE FUNCTION gen3_activate_catalog_run(p_run_id TEXT, p_expected_ranked INTEGER, p_allow_retired BOOLEAN DEFAULT FALSE)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  current_status TEXT;
  stored_expected INTEGER;
  actual_total INTEGER;
  actual_ranked INTEGER;
  actual_featured INTEGER;
BEGIN
  IF p_expected_ranked IS NULL OR p_expected_ranked < 1 THEN
    RAISE EXCEPTION 'Expected ranked count must be positive';
  END IF;

  SELECT status, total_count INTO current_status, stored_expected
  FROM gen3_catalog_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown catalog run: %', p_run_id; END IF;
  IF p_allow_retired AND current_status <> 'retired' THEN
    RAISE EXCEPTION 'Rollback target must be retired; current status is %', current_status;
  ELSIF NOT p_allow_retired AND current_status <> 'staged' THEN
    RAISE EXCEPTION 'Activation target must be staged; current status is %', current_status;
  END IF;
  IF stored_expected <> p_expected_ranked THEN
    RAISE EXCEPTION 'Stored expected count % does not match requested %', stored_expected, p_expected_ranked;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE featured = FALSE AND review_status = 'approved')::INTEGER,
    COUNT(*) FILTER (WHERE featured = TRUE AND review_status = 'approved')::INTEGER
  INTO actual_total, actual_ranked, actual_featured
  FROM gen3_catalog_products WHERE run_id = p_run_id;

  IF actual_total <> p_expected_ranked + 1 OR actual_ranked <> p_expected_ranked OR actual_featured <> 1 THEN
    RAISE EXCEPTION 'Catalog run failed activation counts: total %, approved ranked %, approved featured %', actual_total, actual_ranked, actual_featured;
  END IF;

  UPDATE gen3_catalog_runs SET status = 'retired' WHERE status = 'active';
  UPDATE gen3_catalog_runs SET status = 'active', activated_at = NOW() WHERE id = p_run_id;
END;
$$;

COMMIT;
