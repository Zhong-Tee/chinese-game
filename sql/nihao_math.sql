-- =====================================================================
-- Nihao Math — progress, mastery และประวัติการฝึกต่อผู้เล่น
-- รันซ้ำได้ และใช้ auth.users / ระบบ EXP เดิมของเกม
-- =====================================================================

create table if not exists public.user_math_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  curriculum_version integer not null default 2,
  current_stage integer not null default 1 check (current_stage between 1 and 6),
  current_level integer not null default 1 check (current_level between 1 and 4),
  total_questions integer not null default 0,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  total_response_ms bigint not null default 0,
  daily_streak integer not null default 0,
  last_played_date date,
  mastery jsonb not null default '{}'::jsonb,
  badges text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

create table if not exists public.math_training_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('stage', 'daily')),
  stage integer check (stage between 1 and 6),
  level integer check (level between 1 and 4),
  total_questions integer not null default 0,
  correct_answers integer not null default 0,
  average_response_ms integer not null default 0,
  played_at timestamptz not null default now()
);

create index if not exists math_training_sessions_user_played_idx
  on public.math_training_sessions (user_id, played_at desc);

-- อัปเกรดฐานข้อมูลเดิม: แทรกด่านการยืมก่อนการคูณและการหารเพียงครั้งเดียว
alter table public.user_math_progress
  add column if not exists curriculum_version integer not null default 1;

alter table public.user_math_progress
  drop constraint if exists user_math_progress_current_stage_check;
alter table public.user_math_progress
  add constraint user_math_progress_current_stage_check check (current_stage between 1 and 6);

alter table public.math_training_sessions
  drop constraint if exists math_training_sessions_stage_check;
alter table public.math_training_sessions
  add constraint math_training_sessions_stage_check check (stage between 1 and 6);

update public.math_training_sessions as sessions
set stage = least(6, sessions.stage + 1)
where sessions.stage >= 4
  and exists (
    select 1
    from public.user_math_progress as progress
    where progress.user_id = sessions.user_id
      and progress.curriculum_version < 2
  );

update public.user_math_progress
set current_stage = least(6, current_stage + 1), curriculum_version = 2
where curriculum_version < 2 and current_stage >= 4;

update public.user_math_progress
set curriculum_version = 2
where curriculum_version < 2;

alter table public.user_math_progress
  alter column curriculum_version set default 2;

alter table public.user_math_progress enable row level security;
alter table public.math_training_sessions enable row level security;

drop policy if exists user_math_progress_own on public.user_math_progress;
create policy user_math_progress_own on public.user_math_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists math_training_sessions_select_own on public.math_training_sessions;
create policy math_training_sessions_select_own on public.math_training_sessions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists math_training_sessions_insert_own on public.math_training_sessions;
create policy math_training_sessions_insert_own on public.math_training_sessions
  for insert to authenticated with check (user_id = auth.uid());

grant select, insert, update on public.user_math_progress to authenticated;
grant select, insert on public.math_training_sessions to authenticated;
grant usage, select on sequence public.math_training_sessions_id_seq to authenticated;
