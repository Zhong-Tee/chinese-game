-- ============================================
-- Flashcard Statistics: daily stats, admin flag, RPCs, RLS
-- ============================================

-- 1. Admin flag on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Daily aggregate table
CREATE TABLE IF NOT EXISTS public.flashcard_daily_stats (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('1', '2', '3', '4', '5', '6', '7', 'mistakes')),
  words_played INTEGER NOT NULL DEFAULT 0 CHECK (words_played >= 0),
  play_seconds INTEGER NOT NULL DEFAULT 0 CHECK (play_seconds >= 0),
  PRIMARY KEY (user_id, stat_date, level)
);

CREATE INDEX IF NOT EXISTS idx_flashcard_daily_stats_stat_date
  ON public.flashcard_daily_stats (stat_date);

CREATE INDEX IF NOT EXISTS idx_flashcard_daily_stats_user_date
  ON public.flashcard_daily_stats (user_id, stat_date);

COMMENT ON TABLE public.flashcard_daily_stats IS
  'Daily flashcard play aggregates per user and level (Asia/Bangkok stat_date)';

-- 3. Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE user_id = auth.uid()),
    false
  );
$$;

-- 4. Upsert stat from client (authenticated user only)
CREATE OR REPLACE FUNCTION public.upsert_flashcard_daily_stat(
  p_level TEXT,
  p_words_delta INTEGER DEFAULT 0,
  p_seconds_delta INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_stat_date DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_level NOT IN ('1', '2', '3', '4', '5', '6', '7', 'mistakes') THEN
    RAISE EXCEPTION 'Invalid level: %', p_level;
  END IF;

  IF COALESCE(p_words_delta, 0) < 0 OR COALESCE(p_seconds_delta, 0) < 0 THEN
    RAISE EXCEPTION 'Deltas must be non-negative';
  END IF;

  v_stat_date := (NOW() AT TIME ZONE 'Asia/Bangkok')::DATE;

  INSERT INTO public.flashcard_daily_stats (user_id, stat_date, level, words_played, play_seconds)
  VALUES (
    v_user_id,
    v_stat_date,
    p_level,
    COALESCE(p_words_delta, 0),
    COALESCE(p_seconds_delta, 0)
  )
  ON CONFLICT (user_id, stat_date, level)
  DO UPDATE SET
    words_played = flashcard_daily_stats.words_played + EXCLUDED.words_played,
    play_seconds = flashcard_daily_stats.play_seconds + EXCLUDED.play_seconds;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_flashcard_daily_stat(TEXT, INTEGER, INTEGER) TO authenticated;

-- 5. Resolve display name from profiles
CREATE OR REPLACE FUNCTION public.resolve_profile_display_name(
  p_username TEXT,
  p_display_name TEXT,
  p_email TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(TRIM(p_username), ''),
    CASE
      WHEN p_display_name IS NOT NULL AND p_display_name NOT LIKE '%@%'
      THEN NULLIF(TRIM(p_display_name), '')
      ELSE NULL
    END,
    CASE
      WHEN p_email IS NOT NULL AND p_email LIKE '%@%'
      THEN split_part(p_email, '@', 1)
      ELSE NULL
    END,
    'User'
  );
$$;

-- 6. Query statistics (personal or admin)
CREATE OR REPLACE FUNCTION public.get_flashcard_statistics(
  p_start_date DATE,
  p_end_date DATE,
  p_target_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_is_admin BOOLEAN;
  v_user_id UUID;
  v_summary JSONB;
  v_daily JSONB;
  v_leaderboard JSONB;
  v_users JSONB;
  v_earliest DATE;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_is_admin := public.is_current_user_admin();

  -- ทุก user เห็นข้อมูลทุกคน: NULL = ภาพรวมทุกคน, ระบุ UUID = ดูราย user นั้น
  IF p_target_user_id IS NOT NULL THEN
    v_user_id := p_target_user_id;
  ELSE
    v_user_id := NULL;
  END IF;

  SELECT MIN(stat_date) INTO v_earliest FROM public.flashcard_daily_stats;

  IF v_user_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'active_days', COALESCE(COUNT(DISTINCT stat_date), 0),
      'total_words', COALESCE(SUM(words_played), 0),
      'total_seconds', COALESCE(SUM(play_seconds), 0)
    )
    INTO v_summary
    FROM public.flashcard_daily_stats
    WHERE user_id = v_user_id
      AND stat_date BETWEEN p_start_date AND p_end_date;

    SELECT COALESCE(jsonb_agg(sub.row ORDER BY sub.stat_date DESC), '[]'::jsonb)
    INTO v_daily
    FROM (
      SELECT
        stat_date,
        jsonb_build_object(
          'stat_date', stat_date,
          'total_words', SUM(words_played),
          'total_seconds', SUM(play_seconds),
          'by_level', jsonb_object_agg(level, words_played)
        ) AS row
      FROM public.flashcard_daily_stats
      WHERE user_id = v_user_id
        AND stat_date BETWEEN p_start_date AND p_end_date
      GROUP BY stat_date
    ) sub;

    v_leaderboard := '[]'::jsonb;
  ELSE
    SELECT jsonb_build_object(
      'active_days', COALESCE(COUNT(DISTINCT stat_date), 0),
      'total_words', COALESCE(SUM(words_played), 0),
      'total_seconds', COALESCE(SUM(play_seconds), 0)
    )
    INTO v_summary
    FROM public.flashcard_daily_stats
    WHERE stat_date BETWEEN p_start_date AND p_end_date;

    v_daily := '[]'::jsonb;

    SELECT COALESCE(jsonb_agg(r.row ORDER BY r.total_words DESC, r.active_days DESC), '[]'::jsonb)
    INTO v_leaderboard
    FROM (
      SELECT
        jsonb_build_object(
          'user_id', s.user_id,
          'display_name', public.resolve_profile_display_name(p.username, p.display_name, p.email),
          'active_days', COUNT(DISTINCT s.stat_date),
          'total_words', SUM(s.words_played),
          'total_seconds', SUM(s.play_seconds)
        ) AS row,
        SUM(s.words_played) AS total_words,
        COUNT(DISTINCT s.stat_date) AS active_days
      FROM public.flashcard_daily_stats s
      LEFT JOIN public.profiles p ON p.user_id = s.user_id
      WHERE s.stat_date BETWEEN p_start_date AND p_end_date
      GROUP BY s.user_id, p.username, p.display_name, p.email
    ) r;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', p.user_id,
    'display_name', public.resolve_profile_display_name(p.username, p.display_name, p.email)
  ) ORDER BY public.resolve_profile_display_name(p.username, p.display_name, p.email)), '[]'::jsonb)
  INTO v_users
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.flashcard_daily_stats s WHERE s.user_id = p.user_id
  );

  RETURN jsonb_build_object(
    'is_admin', v_is_admin,
    'target_user_id', v_user_id,
    'earliest_stat_date', v_earliest,
    'summary', COALESCE(v_summary, jsonb_build_object('active_days', 0, 'total_words', 0, 'total_seconds', 0)),
    'daily', COALESCE(v_daily, '[]'::jsonb),
    'leaderboard', COALESCE(v_leaderboard, '[]'::jsonb),
    'users', COALESCE(v_users, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_flashcard_statistics(DATE, DATE, UUID) TO authenticated;

-- 7. RLS
ALTER TABLE public.flashcard_daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own flashcard stats" ON public.flashcard_daily_stats;
CREATE POLICY "Authenticated users can read all flashcard stats"
  ON public.flashcard_daily_stats FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Writes only via SECURITY DEFINER RPC (no direct insert/update policies for authenticated)

-- 8. Admin setup (run manually after migration)
-- Step 1: Run this entire file in Supabase SQL Editor
-- Step 2: Set admin account(s):
--   UPDATE public.profiles SET is_admin = true WHERE username = 'your_admin_username';
-- Step 3: Verify RLS — regular users should only see own rows in flashcard_daily_stats
-- Step 4: Play one flashcard session, then open Statistics menu to confirm data appears
