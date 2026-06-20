-- ถ้ารัน user_minigame_played / user_wrong_words ไปแล้ว ให้รันไฟล์นี้เพื่อเพิ่ม game_type 'flashcard'
-- รันใน Supabase Dashboard → SQL Editor

ALTER TABLE public.user_wrong_words
  DROP CONSTRAINT IF EXISTS user_wrong_words_game_type_check;

ALTER TABLE public.user_wrong_words
  ADD CONSTRAINT user_wrong_words_game_type_check
  CHECK (game_type IN ('th', 'pinyin', 'vol', 'type', 'flashcard'));
