-- ซ่อม RLS ของ daily_mission_progress สำหรับฐานข้อมูลที่ติดตั้ง schema รุ่นเก่า
-- รันไฟล์นี้ใน Supabase SQL Editor ได้ซ้ำโดยไม่ทำให้ข้อมูลเดิมหาย

alter table public.daily_mission_progress enable row level security;

drop policy if exists daily_mission_own on public.daily_mission_progress;
drop policy if exists daily_mission_read_all on public.daily_mission_progress;
drop policy if exists daily_mission_insert_own on public.daily_mission_progress;
drop policy if exists daily_mission_update_own on public.daily_mission_progress;
drop policy if exists daily_mission_insert_admin on public.daily_mission_progress;
drop policy if exists daily_mission_update_admin on public.daily_mission_progress;

create policy daily_mission_read_all on public.daily_mission_progress
  for select to authenticated
  using (true);

create policy daily_mission_insert_own on public.daily_mission_progress
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy daily_mission_update_own on public.daily_mission_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Policy แบบ permissive หลายรายการจะ OR กัน: เจ้าของเขียนแถวตัวเองได้เสมอ
-- และแอดมินเขียนแถวของผู้อื่นได้เมื่อ games_schema.sql ติดตั้ง is_admin แล้ว
do $$
begin
  if to_regprocedure('public.is_admin()') is not null then
    execute 'create policy daily_mission_insert_admin on public.daily_mission_progress for insert to authenticated with check (public.is_admin())';
    execute 'create policy daily_mission_update_admin on public.daily_mission_progress for update to authenticated using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;

grant select, insert, update on public.daily_mission_progress to authenticated;
