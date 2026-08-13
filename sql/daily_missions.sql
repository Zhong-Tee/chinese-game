-- Daily missions (run once in Supabase SQL Editor)
alter table public.game_settings add column if not exists daily_mission_config jsonb not null default
  '{"enabled":true,"new_words_target":5,"review_enabled":true,"match_words_target":10}'::jsonb;

create table if not exists public.daily_mission_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_date date not null default current_date,
  config_snapshot jsonb not null default '{}'::jsonb,
  new_word_ids bigint[] not null default '{}',
  new_words_completed_ids bigint[] not null default '{}',
  review_level integer check (review_level between 3 and 6),
  review_word_ids bigint[] not null default '{}',
  review_completed_ids bigint[] not null default '{}',
  matching_card_ids bigint[] not null default '{}',
  matching_completed_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mission_date)
);

alter table public.daily_mission_progress enable row level security;
drop policy if exists daily_mission_own on public.daily_mission_progress;
create policy daily_mission_own on public.daily_mission_progress for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
grant select, insert, update on public.daily_mission_progress to authenticated;
