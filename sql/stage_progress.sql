-- =====================================================================
-- GAMES Battle Mode - Stage Progress (ปลดล็อกด่าน + เหรียญรางวัล)
-- รันไฟล์นี้ใน Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ปลอดภัยที่จะรันซ้ำ (idempotent)
--   - เริ่มต้นปลดล็อกเฉพาะด่าน 1 ; เล่นชนะด่านใดจะปลดล็อกด่านถัดไป
--   - เก็บคะแนน (จำนวนคำที่ตอบถูก) และเหรียญที่ดีที่สุดของแต่ละด่าน
--     เหรียญ: bronze / silver / gold ตามความแม่นยำในการตอบ
-- =====================================================================

create table if not exists public.user_stage_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  stage_no integer not null,
  best_correct integer not null default 0,   -- จำนวนคำที่ตอบถูก (ดีที่สุด)
  best_total integer not null default 0,      -- จำนวนคำที่ตอบทั้งหมดในรอบที่ดีที่สุด
  medal text check (medal in ('bronze', 'silver', 'gold')),
  updated_at timestamptz not null default now(),
  primary key (user_id, stage_no)
);

-- =====================================================================
-- RLS: อ่าน/เขียนเฉพาะเจ้าของ
-- =====================================================================
alter table public.user_stage_progress enable row level security;

drop policy if exists user_stage_progress_own on public.user_stage_progress;
create policy user_stage_progress_own on public.user_stage_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
