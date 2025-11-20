-- Migration: remove client_id column from activity_records
-- Run this against your PostgreSQL database (psql or a DB GUI).
-- It will remove the `client_id` column from the `activity_records` table if it exists.

ALTER TABLE activity_records DROP COLUMN IF EXISTS client_id;

-- If you use Alembic or another migration tool, integrate this SQL there instead of running directly.
