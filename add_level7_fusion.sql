-- ============================================
-- เพิ่ม Fusion "Level 7 Card" สำหรับ Sticker System
-- ============================================

-- 1. สร้างตาราง user_level7_history เพื่อเก็บประวัติคำศัพท์ที่ผ่าน Level 7
--    (ป้องกันคำศัพท์ถูกย้ายแล้วตัวเลขไม่จำ)
CREATE TABLE IF NOT EXISTS user_level7_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id INTEGER NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, flashcard_id)
);

-- สร้าง index เพื่อเพิ่มประสิทธิภาพ
CREATE INDEX IF NOT EXISTS idx_user_level7_history_user_id ON user_level7_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_level7_history_flashcard_id ON user_level7_history(flashcard_id);

-- 2. เพิ่ม condition_type 'level7_words' ใน function check_sticker_condition
CREATE OR REPLACE FUNCTION check_sticker_condition(
  p_user_id UUID,
  p_condition_type TEXT,
  p_condition_value INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  current_value INTEGER;
BEGIN
  CASE p_condition_type
    WHEN 'login_days' THEN
      -- นับจำนวนวันที่ login ที่แตกต่างกัน
      SELECT COUNT(DISTINCT DATE(login_at)) INTO current_value
      FROM user_logins
      WHERE user_id = p_user_id;
      
    WHEN 'level3_words' THEN
      -- นับจากประวัติ (ไม่หาย แม้ level ลดลง)
      SELECT COUNT(*) INTO current_value
      FROM user_level3_history
      WHERE user_id = p_user_id;
      
    WHEN 'level7_words' THEN
      -- นับจากประวัติ Level 7 (ไม่หาย แม้ level ลดลง)
      SELECT COUNT(*) INTO current_value
      FROM user_level7_history
      WHERE user_id = p_user_id;
      
    WHEN 'total_score' THEN
      -- ตรวจสอบคะแนนรวม
      SELECT COALESCE(SUM(total_score), 0) INTO current_value
      FROM user_scores
      WHERE user_id = p_user_id;
      
    ELSE
      RETURN FALSE;
  END CASE;
  
  RETURN current_value >= p_condition_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. สร้าง Trigger Function เพื่อบันทึกประวัติ Level 7
CREATE OR REPLACE FUNCTION record_level7_history()
RETURNS TRIGGER AS $$
BEGIN
  -- เมื่อ level เปลี่ยนเป็น 7 ให้บันทึกในประวัติ
  IF NEW.level = 7 AND (OLD.level IS NULL OR OLD.level < 7) THEN
    INSERT INTO user_level7_history (user_id, flashcard_id, achieved_at)
    VALUES (NEW.user_id, NEW.flashcard_id, NOW())
    ON CONFLICT (user_id, flashcard_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง Trigger (ถ้ายังไม่มี)
DROP TRIGGER IF EXISTS trigger_record_level7_history ON user_progress;
CREATE TRIGGER trigger_record_level7_history
  AFTER INSERT OR UPDATE OF level ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION record_level7_history();

-- 4. เพิ่ม Sticker Book "Level 7 Card" (ถ้ายังไม่มี)
--    ตรวจสอบก่อนว่ามีอยู่แล้วหรือยัง
DO $$
DECLARE
  book_exists BOOLEAN;
  level7_book_id INTEGER;
BEGIN
  -- ตรวจสอบว่ามี Level 7 Card book อยู่แล้วหรือยัง
  SELECT EXISTS(SELECT 1 FROM sticker_books WHERE name = 'Level 7 Card') INTO book_exists;
  
  IF NOT book_exists THEN
    -- เพิ่ม Level 7 Card book
    INSERT INTO sticker_books (name, description, icon_url)
    VALUES (
      'Level 7 Card',
      'รวบรวมสติกเกอร์จากการผ่านคำศัพท์ Level 7',
      NULL
    )
    RETURNING id INTO level7_book_id;
    
    RAISE NOTICE 'Created Level 7 Card book with id: %', level7_book_id;
  ELSE
    SELECT id INTO level7_book_id FROM sticker_books WHERE name = 'Level 7 Card';
    RAISE NOTICE 'Level 7 Card book already exists with id: %', level7_book_id;
  END IF;
END $$;

-- 5. เพิ่มสติกเกอร์ตัวอย่างสำหรับ Level 7 Card
--    (ปรับ condition_value และ image_url ตามต้องการ)
INSERT INTO stickers (
  book_id,
  name,
  image_url,
  condition_type,
  condition_value,
  order_index
)
SELECT 
  sb.id,
  'Level 7 - 1 Word',
  'https://koagashnqnjbpetddbor.supabase.co/storage/v1/object/public/sticker/level7_1.png',
  'level7_words',
  1,
  1
FROM sticker_books sb
WHERE sb.name = 'Level 7 Card'
  AND NOT EXISTS (
    SELECT 1 FROM stickers 
    WHERE book_id = sb.id 
    AND condition_type = 'level7_words' 
    AND condition_value = 1
  )

UNION ALL

SELECT 
  sb.id,
  'Level 7 - 5 Words',
  'https://koagashnqnjbpetddbor.supabase.co/storage/v1/object/public/sticker/level7_5.png',
  'level7_words',
  5,
  2
FROM sticker_books sb
WHERE sb.name = 'Level 7 Card'
  AND NOT EXISTS (
    SELECT 1 FROM stickers 
    WHERE book_id = sb.id 
    AND condition_type = 'level7_words' 
    AND condition_value = 5
  )

UNION ALL

SELECT 
  sb.id,
  'Level 7 - 10 Words',
  'https://koagashnqnjbpetddbor.supabase.co/storage/v1/object/public/sticker/level7_10.png',
  'level7_words',
  10,
  3
FROM sticker_books sb
WHERE sb.name = 'Level 7 Card'
  AND NOT EXISTS (
    SELECT 1 FROM stickers 
    WHERE book_id = sb.id 
    AND condition_type = 'level7_words' 
    AND condition_value = 10
  )

UNION ALL

SELECT 
  sb.id,
  'Level 7 - 25 Words',
  'https://koagashnqnjbpetddbor.supabase.co/storage/v1/object/public/sticker/level7_25.png',
  'level7_words',
  25,
  4
FROM sticker_books sb
WHERE sb.name = 'Level 7 Card'
  AND NOT EXISTS (
    SELECT 1 FROM stickers 
    WHERE book_id = sb.id 
    AND condition_type = 'level7_words' 
    AND condition_value = 25
  )

UNION ALL

SELECT 
  sb.id,
  'Level 7 - 50 Words',
  'https://koagashnqnjbpetddbor.supabase.co/storage/v1/object/public/sticker/level7_50.png',
  'level7_words',
  50,
  5
FROM sticker_books sb
WHERE sb.name = 'Level 7 Card'
  AND NOT EXISTS (
    SELECT 1 FROM stickers 
    WHERE book_id = sb.id 
    AND condition_type = 'level7_words' 
    AND condition_value = 50
  );

-- 6. อัปเดตข้อมูลประวัติ Level 7 สำหรับผู้ใช้ที่มีอยู่แล้ว
--    (ย้ายข้อมูลจาก user_progress ที่ level = 7 ไปยัง user_level7_history)
INSERT INTO user_level7_history (user_id, flashcard_id, achieved_at)
SELECT DISTINCT user_id, flashcard_id, NOW()
FROM user_progress
WHERE level = 7
  AND NOT EXISTS (
    SELECT 1 FROM user_level7_history u7h
    WHERE u7h.user_id = user_progress.user_id
      AND u7h.flashcard_id = user_progress.flashcard_id
  );

-- 7. ตรวจสอบผลลัพธ์
SELECT 
  'Level 7 Card Book' as item,
  COUNT(*) as count
FROM sticker_books
WHERE name = 'Level 7 Card'

UNION ALL

SELECT 
  'Level 7 Stickers' as item,
  COUNT(*) as count
FROM stickers s
JOIN sticker_books sb ON s.book_id = sb.id
WHERE sb.name = 'Level 7 Card'

UNION ALL

SELECT 
  'Level 7 History Records' as item,
  COUNT(*) as count
FROM user_level7_history;

-- ============================================
-- สรุป: 
-- 1. ✅ สร้างตาราง user_level7_history
-- 2. ✅ เพิ่ม condition_type 'level7_words' ใน function
-- 3. ✅ สร้าง trigger เพื่อบันทึก Level 7 อัตโนมัติ
-- 4. ✅ เพิ่ม Sticker Book "Level 7 Card"
-- 5. ✅ เพิ่มสติกเกอร์ตัวอย่าง (1, 5, 10, 25, 50 words)
-- 6. ✅ อัปเดตประวัติสำหรับผู้ใช้ที่มีอยู่แล้ว
-- ============================================

-- หมายเหตุ:
-- - Function check_and_unlock_stickers จะเรียกใช้ check_sticker_condition 
--   อัตโนมัติเมื่อมีการเรียกใช้ (เช่น เมื่อผู้ใช้เปิด Rewards menu)
-- - Trigger จะบันทึกประวัติ Level 7 อัตโนมัติเมื่อ user_progress.level = 7
-- - ประวัติจะไม่หายแม้คำศัพท์จะถูกย้าย level ลง เพราะเก็บใน user_level7_history
-- - สามารถปรับ condition_value และ image_url ของสติกเกอร์ได้ตามต้องการ
-- ============================================

