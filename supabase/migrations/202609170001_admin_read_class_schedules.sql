-- Allow administrators to view every user's class schedule.
-- Regular users continue to see only their own schedule.
drop policy if exists "Admins can read all class schedules" on public.user_class_schedules;
create policy "Admins can read all class schedules"
  on public.user_class_schedules for select
  to authenticated
  using (public.is_admin());
