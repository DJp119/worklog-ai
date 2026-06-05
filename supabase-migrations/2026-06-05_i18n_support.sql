-- ============================================================================
-- i18n support: translation cache + per-user language preference
-- ============================================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS translation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL,
  namespace TEXT NOT NULL DEFAULT 'all',
  translations JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(language_code, namespace, version)
);

CREATE INDEX IF NOT EXISTS idx_translation_cache_lookup
  ON translation_cache(language_code, namespace, version);

ALTER TABLE translation_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read translations" ON translation_cache;
CREATE POLICY "Anyone can read translations"
  ON translation_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role writes translations" ON translation_cache;
CREATE POLICY "Service role writes translations"
  ON translation_cache FOR ALL USING (auth.role() = 'service_role');

COMMENT ON COLUMN user_profiles.preferred_language IS
  'BCP-47 language code (e.g. ja, hi, ar). NULL = browser auto-detect.';
COMMENT ON TABLE translation_cache IS
  'Server-side cache of base English strings translated per language. Shared across all users.';
