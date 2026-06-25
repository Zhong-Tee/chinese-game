-- =====================================================================
-- GAMES Battle Mode - Stage Progress: เพิ่มระดับความยาก (ง่าย/กลาง/ยาก)
-- รันไฟล์นี้ใน Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ปลอดภัยที่จะรันซ้ำ (idempotent)
--   - ข้อมูลเดิมทั้งหมดถือเป็นระดับ 'easy'
--   - เก็บเหรียญ/คะแนนแยกต่อ (user, stage, difficulty)
-- =====================================================================

-- เพิ่มคอลัมน์ difficulty (ถ้ายังไม่มี)
alter table public.user_stage_progress
  add column if not exists difficulty text not null default 'easy';

-- อัปเดตข้อมูลเดิมให้เป็น easy (กรณีมี null)
update public.user_stage_progress
  set difficulty = 'easy'
  where difficulty is null or difficulty = '';

-- เพิ่ม constraint ความยาก (drop ก่อนถ้ามีแล้วสร้างใหม่)
alter table public.user_stage_progress
  drop constraint if exists user_stage_progress_difficulty_check;

alter table public.user_stage_progress
  add constraint user_stage_progress_difficulty_check
  check (difficulty in ('easy', 'medium', 'hard'));

-- เปลี่ยน primary key จาก (user_id, stage_no) เป็น (user_id, stage_no, difficulty)
alter table public.user_stage_progress
  drop constraint if exists user_stage_progress_pkey;

alter table public.user_stage_progress
  add primary key (user_id, stage_no, difficulty);
