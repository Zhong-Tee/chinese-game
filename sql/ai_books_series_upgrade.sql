-- Upgrade AI Books: advanced level, 15-minute books, selectable text models,
-- and public 5-episode youth-fiction series.
create extension if not exists pgcrypto;

alter table public.ai_books drop constraint if exists ai_books_language_level_check;
alter table public.ai_books
  add constraint ai_books_language_level_check
  check (language_level in ('beginner', 'easy', 'intermediate', 'advanced'));

alter table public.ai_books drop constraint if exists ai_books_reading_minutes_check;
alter table public.ai_books
  add constraint ai_books_reading_minutes_check
  check (reading_minutes in (3, 5, 8, 15));

create table if not exists public.ai_book_series (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  creator_name text not null default 'นักอ่าน Nihao',
  genre text not null,
  title_cn text not null,
  title_pinyin text not null,
  title_th text not null,
  bible jsonb not null default '{}'::jsonb,
  total_episodes integer not null default 5 check (total_episodes = 5),
  last_episode_number integer not null default 1 check (last_episode_number between 1 and 10),
  text_model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_books
  add column if not exists text_model text,
  add column if not exists book_format text not null default 'standalone',
  add column if not exists series_id uuid references public.ai_book_series(id) on delete set null,
  add column if not exists episode_number integer,
  add column if not exists series_total integer,
  add column if not exists series_genre text,
  add column if not exists episode_summary_th text;

update public.ai_books
set text_model = coalesce(text_model, 'gpt-5.6-terra')
where text_model is null;

alter table public.ai_books alter column text_model set default 'gpt-5.6-terra';
alter table public.ai_books alter column text_model set not null;

alter table public.ai_books drop constraint if exists ai_books_book_format_check;
alter table public.ai_books
  add constraint ai_books_book_format_check
  check (book_format in ('standalone', 'series'));

alter table public.ai_books drop constraint if exists ai_books_episode_number_check;
alter table public.ai_books
  add constraint ai_books_episode_number_check
  check (episode_number is null or episode_number between 1 and 10);

create unique index if not exists ai_books_series_episode_unique
  on public.ai_books (series_id, episode_number)
  where series_id is not null;
create index if not exists ai_books_series_idx
  on public.ai_books (series_id, episode_number);

alter table public.ai_book_series enable row level security;

drop policy if exists "Readable AI book series" on public.ai_book_series;
create policy "Readable AI book series"
on public.ai_book_series for select to authenticated
using (
  creator_id = auth.uid()
  or public.is_ai_books_admin(auth.uid())
  or exists (
    select 1 from public.ai_books b
    where b.series_id = ai_book_series.id
      and b.status = 'ready'
      and b.visibility = 'public'
  )
);

grant select on public.ai_book_series to authenticated;

comment on table public.ai_book_series is 'Continuity data and progress for 5-episode AI youth-fiction series.';
