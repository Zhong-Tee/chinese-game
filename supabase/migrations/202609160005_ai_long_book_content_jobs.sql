create table if not exists public.ai_long_book_content_jobs (
  book_id uuid primary key references public.ai_books(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'canceled')),
  phase text not null default 'planning' check (phase in ('planning', 'writing', 'finalizing', 'completed')),
  next_page integer not null default 1 check (next_page between 1 and 25),
  attempts integer not null default 0 check (attempts between 0 and 3),
  plan jsonb,
  options jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_long_book_content_jobs_queue_idx
  on public.ai_long_book_content_jobs (status, updated_at)
  where status in ('queued', 'processing');

alter table public.ai_long_book_content_jobs enable row level security;

comment on table public.ai_long_book_content_jobs is
  'Server-only resumable content queue for complete long stories and youth novels.';
