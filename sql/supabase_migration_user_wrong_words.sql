-- ตารางเก็บ "คำที่แปลผิด" ที่ผู้ใช้กด WRONG ในมินิเกม — แสดงรายการใน Settings (คำผิด)
-- รันใน Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.user_wrong_words (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id int4 NOT NULL,
  game_type text NOT NULL CHECK (game_type IN ('th', 'pinyin', 'vol', 'type', 'flashcard')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_user_wrong_words_user_created
  ON public.user_wrong_words (user_id, created_at DESC);

ALTER TABLE public.user_wrong_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wrong words"
  ON public.user_wrong_words FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wrong words"
  ON public.user_wrong_words FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wrong words"
  ON public.user_wrong_words FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_wrong_words IS 'เก็บคำที่ผู้ใช้กด WRONG (มินิเกม + Flashcard) — แสดงใน Settings รายการคำผิด';
