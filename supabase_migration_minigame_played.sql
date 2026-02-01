-- ตารางเก็บ "คำที่เล่นไปแล้วในเซสชัน" ต่อเกม/โหมด เพื่อให้จำนวน Review และ Normal ตรงกันทุกเครื่อง (sync ตาม user)
-- แทนการเก็บใน localStorage ที่เป็นคนละเครื่อง

CREATE TABLE IF NOT EXISTS public.user_minigame_played (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type text NOT NULL CHECK (game_type IN ('th', 'pinyin', 'vol', 'type')),
  mode text NOT NULL CHECK (mode IN ('normal', 'review')),
  played_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_type, mode)
);

-- RLS: ให้ user อ่าน/เขียนเฉพาะแถวของตัวเอง
ALTER TABLE public.user_minigame_played ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own minigame played"
  ON public.user_minigame_played FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own minigame played"
  ON public.user_minigame_played FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own minigame played"
  ON public.user_minigame_played FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own minigame played"
  ON public.user_minigame_played FOR DELETE
  USING (auth.uid() = user_id);

-- index สำหรับ select ตาม user_id + game_type + mode (มีอยู่แล้วจาก PK)
COMMENT ON TABLE public.user_minigame_played IS 'เก็บ flashcard_id ที่เล่นไปแล้วในเซสชัน (normal/review) ต่อเกม เพื่อ sync จำนวนที่แสดงทุกเครื่อง';
