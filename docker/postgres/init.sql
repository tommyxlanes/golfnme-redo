-- docker/postgres/init.sql
-- Runs once on first container start.
-- Prisma handles table creation via `prisma migrate deploy`,
-- so this file only covers DB-level setup that Prisma doesn't manage.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram indexes for fast ILIKE search
CREATE EXTENSION IF NOT EXISTS citext;    -- case-insensitive text (optional)

-- Prisma will create all tables. After migrations run, these partial/expression
-- indexes give an extra boost beyond what Prisma's @@index generates:

-- Fast case-insensitive username/email lookup
-- (run after first `prisma migrate deploy`)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_username_lower ON "User" (lower(username));
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email_lower    ON "User" (lower(email));

-- Full-text search on course name + city
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_course_search
--   ON "Course" USING gin (to_tsvector('english', name || ' ' || coalesce(city, '')));
