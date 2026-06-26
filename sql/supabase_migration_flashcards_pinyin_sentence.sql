-- เพิ่มคอลัมน์ pinyin_sentence ในตาราง flashcards (พินอินของประโยคตัวอย่าง)
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS pinyin_sentence text;

COMMENT ON COLUMN public.flashcards.pinyin_sentence IS 'พินอินของประโยคตัวอย่าง (sentence_test)';
