-- This migration adds a remaining_time column to the time_logs table
-- to store the developer's remaining hours estimate at the point in time
-- when the time log entry was created.
--
-- IMPORTANT: This migration must be run in your Supabase SQL editor.
-- It cannot be applied automatically via this file.

ALTER TABLE time_logs
  ADD COLUMN IF NOT EXISTS remaining_time float8 NULL;
