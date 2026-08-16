-- Store matching words passed from every game mode without affecting mission-star progress.
alter table public.daily_mission_progress
  add column if not exists matching_passed_ids bigint[] not null default '{}';

grant select, insert, update on public.daily_mission_progress to authenticated;
