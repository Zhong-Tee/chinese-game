-- Daily missions: clear frequent mistakes + read one AI book.
-- Also stores per-user completed-book markers for the Books shelf.

alter table public.daily_mission_progress
  add column if not exists mistakes_required boolean not null default false,
  add column if not exists mistakes_remaining integer not null default 0,
  add column if not exists mistakes_completed boolean not null default false,
  add column if not exists books_read_ids uuid[] not null default '{}';

create table if not exists public.ai_book_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.ai_books(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create index if not exists ai_book_reads_user_completed_idx
  on public.ai_book_reads (user_id, completed_at desc);

alter table public.ai_book_reads enable row level security;
drop policy if exists "Users manage own AI book reads" on public.ai_book_reads;
create policy "Users manage own AI book reads"
on public.ai_book_reads for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update on public.ai_book_reads to authenticated;

comment on table public.ai_book_reads is
  'Books each user has completed; one row per user and book.';
