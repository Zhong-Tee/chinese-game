-- Allow the background worker to create episode 1 as well as episodes 2–5.
alter table public.ai_series_generation_jobs
  drop constraint if exists ai_series_generation_jobs_episode_number_check;

alter table public.ai_series_generation_jobs
  add constraint ai_series_generation_jobs_episode_number_check
  check (episode_number between 1 and 5);
