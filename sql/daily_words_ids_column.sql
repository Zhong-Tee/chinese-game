-- Migration: เก็บ ID คำใหม่ที่แจกไปแล้วของวันนั้น คู่กับ last_daily_words_date
-- จำเป็นสำหรับการซ่อมภารกิจ "คำใหม่ถึง LV3" ให้ใช้ ID ที่แจกจริง
-- แทนการเดาจาก Level ของคำเก่า (ซึ่งทำให้ได้ดาวฟรีโดยไม่ได้เล่น)
-- รันไฟล์นี้ใน Supabase SQL Editor ก่อน deploy เวอร์ชันใหม่

alter table public.user_settings
  add column if not exists last_daily_word_ids bigint[] not null default '{}';
