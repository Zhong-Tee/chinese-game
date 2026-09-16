alter table public.ai_books
  add column if not exists continuity_state jsonb not null default '{}'::jsonb;

alter table public.ai_book_series
  add column if not exists generation_status text not null default 'ready',
  add column if not exists generation_progress jsonb not null default '{}'::jsonb,
  add column if not exists continuity_state jsonb not null default '{}'::jsonb,
  add column if not exists error_message text;

alter table public.ai_book_series
  drop constraint if exists ai_book_series_generation_status_check;

alter table public.ai_book_series
  add constraint ai_book_series_generation_status_check
  check (generation_status in ('generating', 'ready', 'failed', 'canceled'));

create table if not exists public.ai_series_generation_jobs (
  id bigint generated always as identity primary key,
  series_id uuid not null references public.ai_book_series(id) on delete cascade,
  episode_number integer not null check (episode_number between 1 and 5),
  status text not null default 'waiting'
    check (status in ('waiting', 'queued', 'processing', 'completed', 'failed', 'canceled')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (series_id, episode_number)
);

create index if not exists ai_series_generation_jobs_queue_idx
  on public.ai_series_generation_jobs (status, updated_at, id)
  where status in ('queued', 'processing');

alter table public.ai_series_generation_jobs enable row level security;

comment on table public.ai_series_generation_jobs is
  'Server-only sequential queue for automatically generating series episodes 2 through 5.';

comment on column public.ai_books.continuity_state is
  'Actual end-of-episode state passed to the next episode writer.';
