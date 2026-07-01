-- Hotfix: สถิติ Flashcards + wrong_answers (ครั้งที่ตอบผิด แยกจาก level)
-- รันไฟล์นี้ใน Supabase SQL Editor

-- 1. ตารางนับครั้งที่ตอบผิดรายวัน (ไม่ใช่ level)
CREATE TABLE IF NOT EXISTS public.flashcard_daily_wrong_answers (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  wrong_answers INTEGER NOT NULL DEFAULT 0 CHECK (wrong_answers >= 0),
  PRIMARY KEY (user_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_flashcard_daily_wrong_answers_stat_date
  ON public.flashcard_daily_wrong_answers (stat_date);

COMMENT ON TABLE public.flashcard_daily_wrong_answers IS
  'Daily count of wrong flashcard answers per user (Asia/Bangkok stat_date)';

-- 2. RPC บันทึกครั้งที่ตอบผิด
CREATE OR REPLACE FUNCTION public.increment_flashcard_wrong_answer()
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

  v_stat_date := (NOW() AT TIME ZONE 'Asia/Bangkok')::DATE;

  INSERT INTO public.flashcard_daily_wrong_answers (user_id, stat_date, wrong_answers)
  VALUES (v_user_id, v_stat_date, 1)
  ON CONFLICT (user_id, stat_date)
  DO UPDATE SET
    wrong_answers = flashcard_daily_wrong_answers.wrong_answers + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_flashcard_wrong_answer() TO authenticated;

-- 3. อัปเดต get_flashcard_statistics
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

  SELECT MIN(d) INTO v_earliest
  FROM (
    SELECT MIN(stat_date) AS d FROM public.flashcard_daily_stats
    UNION ALL
    SELECT MIN(stat_date) AS d FROM public.flashcard_daily_wrong_answers
  ) dates;

  IF v_user_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'active_days', COALESCE(COUNT(DISTINCT stat_date), 0),
      'total_words', COALESCE(SUM(words_played), 0),
      'total_seconds', COALESCE(SUM(play_seconds), 0),
      'level7_words', COALESCE(SUM(words_played) FILTER (WHERE level = '7'), 0),
      'wrong_answers', COALESCE((
        SELECT SUM(w.wrong_answers)
        FROM public.flashcard_daily_wrong_answers w
        WHERE w.user_id = v_user_id
          AND w.stat_date BETWEEN p_start_date AND p_end_date
      ), 0)
    )
    INTO v_summary
    FROM public.flashcard_daily_stats
    WHERE user_id = v_user_id
      AND stat_date BETWEEN p_start_date AND p_end_date;

    IF v_summary IS NULL THEN
      SELECT jsonb_build_object(
        'active_days', 0,
        'total_words', 0,
        'total_seconds', 0,
        'level7_words', 0,
        'wrong_answers', COALESCE(SUM(w.wrong_answers), 0)
      )
      INTO v_summary
      FROM public.flashcard_daily_wrong_answers w
      WHERE w.user_id = v_user_id
        AND w.stat_date BETWEEN p_start_date AND p_end_date;
    END IF;

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
    -- ภาพรวม: รวมวันเข้าเล่นของทุกคน (เช่น A 2 วัน + B 3 วัน = 5 วัน)
    SELECT jsonb_build_object(
      'active_days', COALESCE(SUM(active_days), 0),
      'total_words', COALESCE(SUM(total_words), 0),
      'total_seconds', COALESCE(SUM(total_seconds), 0),
      'level7_words', COALESCE(SUM(level7_words), 0),
      'wrong_answers', COALESCE((
        SELECT SUM(w.wrong_answers)
        FROM public.flashcard_daily_wrong_answers w
        WHERE w.stat_date BETWEEN p_start_date AND p_end_date
      ), 0)
    )
    INTO v_summary
    FROM (
      SELECT
        COUNT(DISTINCT stat_date) AS active_days,
        SUM(words_played) AS total_words,
        SUM(play_seconds) AS total_seconds,
        SUM(words_played) FILTER (WHERE level = '7') AS level7_words
      FROM public.flashcard_daily_stats
      WHERE stat_date BETWEEN p_start_date AND p_end_date
      GROUP BY user_id
    ) per_user;

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
  ) OR EXISTS (
    SELECT 1 FROM public.flashcard_daily_wrong_answers w WHERE w.user_id = p.user_id
  );

  RETURN jsonb_build_object(
    'is_admin', v_is_admin,
    'target_user_id', v_user_id,
    'earliest_stat_date', v_earliest,
    'summary', COALESCE(v_summary, jsonb_build_object(
      'active_days', 0, 'total_words', 0, 'total_seconds', 0,
      'level7_words', 0, 'wrong_answers', 0
    )),
    'daily', COALESCE(v_daily, '[]'::jsonb),
    'leaderboard', COALESCE(v_leaderboard, '[]'::jsonb),
    'users', COALESCE(v_users, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_flashcard_statistics(DATE, DATE, UUID) TO authenticated;

-- 4. RLS (DROP ก่อน CREATE ทุกครั้ง — รันซ้ำได้)
ALTER TABLE public.flashcard_daily_wrong_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own flashcard stats" ON public.flashcard_daily_stats;
DROP POLICY IF EXISTS "Authenticated users can read all flashcard stats" ON public.flashcard_daily_stats;
CREATE POLICY "Authenticated users can read all flashcard stats"
  ON public.flashcard_daily_stats FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can read all flashcard wrong answers"
  ON public.flashcard_daily_wrong_answers;
CREATE POLICY "Authenticated users can read all flashcard wrong answers"
  ON public.flashcard_daily_wrong_answers FOR SELECT
  USING (auth.uid() IS NOT NULL);
