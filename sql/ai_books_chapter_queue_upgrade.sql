-- Durable chapter-by-chapter generation queue for Nihao youth novels.
create table if not exists public.ai_book_generation_jobs (
  id bigint generated always as identity primary key,
  book_id uuid not null references public.ai_books(id) on delete cascade,
  chapter_number integer not null check (chapter_number between 2 and 8),
  status text not null default 'waiting' check (status in ('waiting', 'queued', 'processing', 'completed', 'failed', 'canceled')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (book_id, chapter_number)
);

create index if not exists ai_book_generation_jobs_queue_idx
  on public.ai_book_generation_jobs (status, updated_at, id)
  where status in ('queued', 'processing');

alter table public.ai_book_generation_jobs enable row level security;

-- No client policies or grants: only trusted Edge Functions using the service role
-- may claim or mutate generation jobs.
comment on table public.ai_book_generation_jobs is
  'Server-only sequential queue for youth-novel chapters 2 through 8.';
