-- ============================================================================
-- Security Migration: Support token hashing (BUG-8)
-- Run this script in the Supabase SQL Editor of your database (both Dev and Production).
-- ============================================================================

-- 1. Enable pgcrypto (used for hashing plaintext tokens using sha256)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Migrate refresh_tokens table
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS session_ttl_days INT NOT NULL DEFAULT 30;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'refresh_tokens' AND column_name = 'token') THEN
        -- Add token_hash column
        ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;

        -- Convert existing plaintext tokens to SHA-256 hashes
        UPDATE refresh_tokens 
        SET token_hash = encode(digest(token, 'sha256'), 'hex') 
        WHERE token_hash IS NULL AND token IS NOT NULL;

        -- Set token_hash NOT NULL and add UNIQUE constraint
        ALTER TABLE refresh_tokens ALTER COLUMN token_hash SET NOT NULL;
        ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_token_key;
        ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);

        -- Drop the old plaintext token column and its index
        DROP INDEX IF EXISTS idx_refresh_tokens_token;
        ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS token;

        -- Create index on token_hash
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
    END IF;
END $$;


-- 3. Migrate email_verifications table
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'email_verifications' AND column_name = 'token') THEN
        -- Add token_hash column
        ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS token_hash TEXT;

        -- Convert existing plaintext tokens to SHA-256 hashes
        UPDATE email_verifications 
        SET token_hash = encode(digest(token, 'sha256'), 'hex') 
        WHERE token_hash IS NULL AND token IS NOT NULL;

        -- Set token_hash NOT NULL
        ALTER TABLE email_verifications ALTER COLUMN token_hash SET NOT NULL;

        -- Handle constraints & indices
        ALTER TABLE email_verifications DROP CONSTRAINT IF EXISTS email_verifications_token_key;
        ALTER TABLE email_verifications DROP CONSTRAINT IF EXISTS email_verifications_user_id_token_key;
        
        -- Add unique constraint (depends on database version structure)
        BEGIN
            ALTER TABLE email_verifications ADD CONSTRAINT email_verifications_token_hash_key UNIQUE (token_hash);
        EXCEPTION WHEN OTHERS THEN
            -- In some schema versions, UNIQUE constraint is on user_id, token_hash
            ALTER TABLE email_verifications ADD CONSTRAINT email_verifications_user_id_token_hash_key UNIQUE (user_id, token_hash);
        END;

        DROP INDEX IF EXISTS idx_email_verifications_token;
        ALTER TABLE email_verifications DROP COLUMN IF EXISTS token;

        CREATE INDEX IF NOT EXISTS idx_email_verifications_token_hash ON email_verifications(token_hash);
    END IF;
END $$;


-- 4. Migrate password_reset_tokens table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'password_reset_tokens') AND 
       EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'password_reset_tokens' AND column_name = 'token') THEN
        -- Add token_hash column
        ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;

        -- Convert existing plaintext tokens to SHA-256 hashes
        UPDATE password_reset_tokens 
        SET token_hash = encode(digest(token, 'sha256'), 'hex') 
        WHERE token_hash IS NULL AND token IS NOT NULL;

        -- Set token_hash NOT NULL
        ALTER TABLE password_reset_tokens ALTER COLUMN token_hash SET NOT NULL;

        -- Handle constraints & indices
        ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS password_reset_tokens_token_key;
        ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS password_reset_tokens_user_id_token_key;
        
        BEGIN
            ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);
        EXCEPTION WHEN OTHERS THEN
            ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_token_hash_key UNIQUE (user_id, token_hash);
        END;

        DROP INDEX IF EXISTS idx_password_reset_tokens_token;
        ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS token;

        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
    END IF;
END $$;


-- 5. Migrate password_resets table (if it exists in custom auth environments)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'password_resets') AND 
       EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'password_resets' AND column_name = 'token') THEN
        -- Add token_hash column
        ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS token_hash TEXT;

        -- Convert existing plaintext tokens to SHA-256 hashes
        UPDATE password_resets 
        SET token_hash = encode(digest(token, 'sha256'), 'hex') 
        WHERE token_hash IS NULL AND token IS NOT NULL;

        -- Set token_hash NOT NULL
        ALTER TABLE password_resets ALTER COLUMN token_hash SET NOT NULL;

        -- Handle constraints & indices
        ALTER TABLE password_resets DROP CONSTRAINT IF EXISTS password_resets_token_key;
        ALTER TABLE password_resets ADD CONSTRAINT password_resets_token_hash_key UNIQUE (token_hash);

        DROP INDEX IF EXISTS idx_password_resets_token;
        ALTER TABLE password_resets DROP COLUMN IF EXISTS token;

        CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
    END IF;
END $$;


-- 6. Reload PostgREST schema cache to ensure the API recognizes the schema changes immediately
NOTIFY pgrst, 'reload schema';
