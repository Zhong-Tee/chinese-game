-- Nihao AI Books: standalone 8-chapter youth novels with one illustration per chapter.
alter table public.ai_books
  add column if not exists target_age text,
  add column if not exists primary_genre text,
  add column if not exists secondary_genre text,
  add column if not exists secondary_tone text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists protagonist_prompt text,
  add column if not exists companion_prompt text,
  add column if not exists setting_prompt text,
  add column if not exists exclusions_prompt text,
  add column if not exists use_reader_profile boolean not null default true,
  add column if not exists story_bible jsonb not null default '{}'::jsonb,
  add column if not exists editorial_scores jsonb not null default '[]'::jsonb,
  add column if not exists generation_progress jsonb not null default '{}'::jsonb;

alter table public.ai_books drop constraint if exists ai_books_book_format_check;
alter table public.ai_books
  add constraint ai_books_book_format_check
  check (book_format in ('standalone', 'series', 'youth_novel'));

alter table public.ai_books drop constraint if exists ai_books_status_check;
alter table public.ai_books
  add constraint ai_books_status_check
  check (status in ('generating', 'partial', 'ready', 'failed', 'canceled'));

create index if not exists ai_books_generation_status_idx
  on public.ai_books (status, updated_at desc)
  where status in ('generating', 'partial');

comment on column public.ai_books.generation_progress is
  'Background youth-novel pipeline stage and completed chapter count.';
comment on column public.ai_books.editorial_scores is
  'Per-chapter editorial and critic scores for youth novels.';

alter table public.ai_generation_runs drop constraint if exists ai_generation_runs_operation_check;
alter table public.ai_generation_runs
  add constraint ai_generation_runs_operation_check
  check (length(trim(operation)) > 0);

create table if not exists public.ai_book_reader_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.ai_books(id) on delete cascade,
  event_type text not null check (event_type in ('start', 'chapter_open', 'complete', 'reread')),
  chapter_number integer,
  created_at timestamptz not null default now()
);
create index if not exists ai_book_reader_events_user_book_idx on public.ai_book_reader_events (user_id, book_id, created_at desc);
alter table public.ai_book_reader_events enable row level security;
drop policy if exists "Users record own AI book reading events" on public.ai_book_reader_events;
create policy "Users record own AI book reading events" on public.ai_book_reader_events for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert on public.ai_book_reader_events to authenticated;

create table if not exists public.ai_book_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.ai_books(id) on delete cascade,
  enjoyment text not null check (enjoyment in ('love', 'like', 'neutral', 'dislike')),
  favorite_aspect text not null check (favorite_aspect in ('character', 'adventure', 'comedy', 'mystery', 'images', 'story')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
alter table public.ai_book_reviews enable row level security;
drop policy if exists "Users manage own AI book reviews" on public.ai_book_reviews;
create policy "Users manage own AI book reviews" on public.ai_book_reviews for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.ai_book_reviews to authenticated;
