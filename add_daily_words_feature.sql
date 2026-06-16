-- Migration: Add daily words tracking column to user_settings
-- Run this in your Supabase SQL Editor before deploying the daily words feature.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS last_daily_words_date date;
