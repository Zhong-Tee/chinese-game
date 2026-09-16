-- Run this once in Supabase SQL Editor if migrations are not deployed through the CLI.
create table if not exists public.ai_book_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.ai_books(id) on delete cascade,
  page_index integer not null default 0 check (page_index >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create index if not exists ai_book_progress_user_updated_idx
  on public.ai_book_progress (user_id, updated_at desc);

alter table public.ai_book_progress enable row level security;
drop policy if exists "Users manage own AI book progress" on public.ai_book_progress;
create policy "Users manage own AI book progress"
on public.ai_book_progress for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
grant select, insert, update, delete on public.ai_book_progress to authenticated;
