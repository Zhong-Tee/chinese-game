-- =====================================================================
-- GAMES Battle Mode - จำนวนโจทย์แต่ละประเภทต่อด่าน
-- รันไฟล์นี้ใน Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ปลอดภัยที่จะรันซ้ำ (idempotent)
--   admin กำหนดได้ว่าแต่ละด่านมีโจทย์แต่ละประเภทกี่คำ
--     q_choice_count    = โจทย์แบบเลือกตอบ (pinyin/แปลไทย)
--     q_typing_count    = โจทย์ฝึกพิมพ์
--     q_rearrange_count = โจทย์เรียงประโยค
--   ค่าเหล่านี้กำหนด "สัดส่วน/จำนวนต่อรอบ" ของชนิดโจทย์ที่จะสุ่มออกมา
-- =====================================================================

alter table public.game_stages add column if not exists q_choice_count integer not null default 20;
alter table public.game_stages add column if not exists q_typing_count integer not null default 5;
alter table public.game_stages add column if not exists q_rearrange_count integer not null default 5;
