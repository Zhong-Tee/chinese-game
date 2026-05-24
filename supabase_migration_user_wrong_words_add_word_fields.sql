-- เพิ่มคอลัมน์ข้อมูลคำศัพท์ลงใน user_wrong_words
-- รันใน Supabase Dashboard → SQL Editor

ALTER TABLE public.user_wrong_words
  ADD COLUMN IF NOT EXISTS cn text,
  ADD COLUMN IF NOT EXISTS pinyin text,
  ADD COLUMN IF NOT EXISTS vocabulary text,
  ADD COLUMN IF NOT EXISTS pinyin_vocab text,
  ADD COLUMN IF NOT EXISTS th text,
  ADD COLUMN IF NOT EXISTS sentence_test text,
  ADD COLUMN IF NOT EXISTS translate text;

COMMENT ON COLUMN public.user_wrong_words.cn IS 'ตัวอักษรจีน';
COMMENT ON COLUMN public.user_wrong_words.pinyin IS 'พินอินของตัวอักษรจีน';
COMMENT ON COLUMN public.user_wrong_words.vocabulary IS 'คำศัพท์';
COMMENT ON COLUMN public.user_wrong_words.pinyin_vocab IS 'พินอินของคำศัพท์';
COMMENT ON COLUMN public.user_wrong_words.th IS 'คำแปลไทย';
COMMENT ON COLUMN public.user_wrong_words.sentence_test IS 'ประโยคตัวอย่าง';
COMMENT ON COLUMN public.user_wrong_words.translate IS 'คำแปลของประโยคตัวอย่าง';

-- Backfill ข้อมูลเก่าจาก flashcards โดย match ด้วย flashcard_id -> flashcards.id1
-- ปลอดภัยต่อการรันซ้ำ: อัปเดตเฉพาะคอลัมน์ที่ยังเป็น NULL
UPDATE public.user_wrong_words AS u
SET
  cn = COALESCE(u.cn, f.cn),
  pinyin = COALESCE(u.pinyin, f.pinyin),
  vocabulary = COALESCE(u.vocabulary, f.vocabulary),
  pinyin_vocab = COALESCE(u.pinyin_vocab, f.pinyin_vocab),
  th = COALESCE(u.th, f.th),
  sentence_test = COALESCE(u.sentence_test, f.sentence_test),
  translate = COALESCE(u.translate, f.translate)
FROM public.flashcards AS f
WHERE f.id1 = u.flashcard_id
  AND (
    u.cn IS NULL
    OR u.pinyin IS NULL
    OR u.vocabulary IS NULL
    OR u.pinyin_vocab IS NULL
    OR u.th IS NULL
    OR u.sentence_test IS NULL
    OR u.translate IS NULL
  );
