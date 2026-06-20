-- Hotfix: ให้ทุก User เห็นสถิติของทุกคน + แก้ jsonb_agg ORDER BY
-- รันไฟล์นี้ใน Supabase SQL Editor

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

DROP POLICY IF EXISTS "Users read own flashcard stats" ON public.flashcard_daily_stats;
DROP POLICY IF EXISTS "Authenticated users can read all flashcard stats" ON public.flashcard_daily_stats;
CREATE POLICY "Authenticated users can read all flashcard stats"
  ON public.flashcard_daily_stats FOR SELECT
  USING (auth.uid() IS NOT NULL);
