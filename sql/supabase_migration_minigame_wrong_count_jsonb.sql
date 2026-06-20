-- เปลี่ยนคอลัมน์ minigame_wrong_count จาก int4 เป็น jsonb
-- เพราะแอปส่งค่าเป็น object { th, pinyin, vol, type } — ถ้าเป็น int4 การอัปเดตจะไม่บันทึก และตัวเลข Review/Left จะไม่ลด
-- รันใน Supabase Dashboard → SQL Editor

-- แปลงค่าเดิม: ตัวเลขเก่า → object ทุก key เท่ากัน (ให้ทุกเกมยังเห็น "ต้อง Review" จนกว่าจะตอบถูก)
ALTER TABLE public.user_progress
  ALTER COLUMN minigame_wrong_count TYPE jsonb
  USING (
    CASE
      WHEN minigame_wrong_count IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object(
        'th',     COALESCE(minigame_wrong_count, 0),
        'pinyin', COALESCE(minigame_wrong_count, 0),
        'vol',    COALESCE(minigame_wrong_count, 0),
        'type',   COALESCE(minigame_wrong_count, 0)
      )
    END
  );

-- ตั้ง default ให้แถวใหม่ที่ยังไม่มีค่า
ALTER TABLE public.user_progress
  ALTER COLUMN minigame_wrong_count SET DEFAULT '{}'::jsonb;
