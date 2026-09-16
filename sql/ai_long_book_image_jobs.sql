-- Run this once in Supabase SQL Editor if migrations are not deployed through the CLI.
create table if not exists public.ai_long_book_image_jobs (
  id bigint generated always as identity primary key,
  book_id uuid not null references public.ai_books(id) on delete cascade,
  image_index integer not null check (image_index between 0 and 10),
  kind text not null check (kind in ('cover', 'content')),
  page_number integer not null default 0 check (page_number >= 0),
  prompt text not null,
  image_size text not null check (image_size in ('1024x1536', '1536x1024')),
  status text not null default 'waiting' check (status in ('waiting', 'queued', 'processing', 'completed', 'failed', 'canceled')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (book_id, image_index)
);
create index if not exists ai_long_book_image_jobs_queue_idx
  on public.ai_long_book_image_jobs (status, updated_at, id)
  where status in ('queued', 'processing');
alter table public.ai_long_book_image_jobs enable row level security;
