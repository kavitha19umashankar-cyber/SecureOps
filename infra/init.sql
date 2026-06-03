-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for full-text search on names

-- These tables are created by Drizzle migrations.
-- This script only sets up extensions and initial super admin seeding.
