-- Allow every authenticated user to view everyone's daily mission progress.
-- Writes remain restricted to the row owner or an administrator.

alter table public.daily_mission_progress enable row level security;

drop policy if exists daily_mission_own on public.daily_mission_progress;
drop policy if exists daily_mission_read_all on public.daily_mission_progress;
drop policy if exists daily_mission_insert_own on public.daily_mission_progress;
drop policy if exists daily_mission_update_own on public.daily_mission_progress;

create policy daily_mission_read_all on public.daily_mission_progress
  for select to authenticated
  using (true);

create policy daily_mission_insert_own on public.daily_mission_progress
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

create policy daily_mission_update_own on public.daily_mission_progress
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

grant select, insert, update on public.daily_mission_progress to authenticated;
