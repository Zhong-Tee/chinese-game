-- ตารางเรียนและรูปหนังสือ (Base64 ใน schedule JSONB) แยกตามผู้ใช้
create table if not exists public.user_class_schedules (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schedule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_class_schedules enable row level security;

drop policy if exists "Users can read own class schedule" on public.user_class_schedules;
create policy "Users can read own class schedule"
  on public.user_class_schedules for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own class schedule" on public.user_class_schedules;
create policy "Users can insert own class schedule"
  on public.user_class_schedules for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own class schedule" on public.user_class_schedules;
create policy "Users can update own class schedule"
  on public.user_class_schedules for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
