-- AI Books: public reading, owner/admin cost visibility in the app, and generation audit rows.
create extension if not exists pgcrypto;

create or replace function public.is_ai_books_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_admin
    from public.profiles p
    where p.user_id = check_user_id
    limit 1
  ), false);
$$;

revoke all on function public.is_ai_books_admin(uuid) from public;
grant execute on function public.is_ai_books_admin(uuid) to authenticated;

create table if not exists public.ai_books (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  creator_name text not null default 'นักอ่าน Nihao',
  title_cn text,
  title_pinyin text,
  title_th text,
  summary_th text,
  category text not null,
  language_level text not null check (language_level in ('beginner', 'easy', 'intermediate', 'advanced')),
  reading_minutes integer not null check (reading_minutes in (3, 5, 8, 15)),
  tone text,
  topic text,
  text_model text not null default 'gpt-5.6-terra',
  book_format text not null default 'standalone' check (book_format in ('standalone', 'series')),
  episode_number integer check (episode_number is null or episode_number between 1 and 10),
  series_total integer,
  series_genre text,
  episode_summary_th text,
  pages jsonb not null default '[]'::jsonb,
  cover_url text,
  content_image_url text,
  content_image_page integer not null default 0,
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed', 'canceled')),
  generation_cost_usd numeric(14, 8) not null default 0,
  generation_cost_thb numeric(14, 4) not null default 0,
  exchange_rate numeric(10, 4) not null default 34,
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_book_series (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  creator_name text not null default 'นักอ่าน Nihao',
  genre text not null,
  title_cn text not null,
  title_pinyin text not null,
  title_th text not null,
  bible jsonb not null default '{}'::jsonb,
  total_episodes integer not null default 10 check (total_episodes = 10),
  last_episode_number integer not null default 1 check (last_episode_number between 1 and 10),
  text_model text not null default 'gpt-5.6-terra',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_books
  add column if not exists series_id uuid references public.ai_book_series(id) on delete set null;

create index if not exists ai_books_public_created_idx
  on public.ai_books (created_at desc)
  where status = 'ready' and visibility = 'public';
create index if not exists ai_books_creator_created_idx
  on public.ai_books (creator_id, created_at desc);
create unique index if not exists ai_books_series_episode_unique
  on public.ai_books (series_id, episode_number)
  where series_id is not null;
create index if not exists ai_books_series_idx
  on public.ai_books (series_id, episode_number);

create table if not exists public.ai_book_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.ai_books(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
create index if not exists ai_book_reads_user_completed_idx
  on public.ai_book_reads (user_id, completed_at desc);

create table if not exists public.ai_generation_runs (
  id bigint generated always as identity primary key,
  book_id uuid not null references public.ai_books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('text', 'cover_image', 'content_image')),
  model text not null,
  input_tokens bigint not null default 0,
  cached_input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  image_input_tokens bigint not null default 0,
  image_output_tokens bigint not null default 0,
  cost_usd numeric(14, 8) not null default 0,
  pricing_version text not null,
  raw_usage jsonb not null default '{}'::jsonb,
  status text not null check (status in ('success', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists ai_generation_runs_book_idx on public.ai_generation_runs (book_id);
create index if not exists ai_generation_runs_user_idx on public.ai_generation_runs (user_id, created_at desc);

alter table public.ai_books enable row level security;
alter table public.ai_book_series enable row level security;
alter table public.ai_book_reads enable row level security;
alter table public.ai_generation_runs enable row level security;

drop policy if exists "Public books and own books are readable" on public.ai_books;
create policy "Public books and own books are readable"
on public.ai_books for select to authenticated
using (
  (status = 'ready' and visibility = 'public')
  or creator_id = auth.uid()
  or public.is_ai_books_admin(auth.uid())
);

drop policy if exists "Owners can delete books" on public.ai_books;
drop policy if exists "Only admins can delete books" on public.ai_books;
create policy "Only admins can delete books"
on public.ai_books for delete to authenticated
using (public.is_ai_books_admin(auth.uid()));

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

drop policy if exists "Users manage own AI book reads" on public.ai_book_reads;
create policy "Users manage own AI book reads"
on public.ai_book_reads for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
grant select, insert, update on public.ai_book_reads to authenticated;

drop policy if exists "Owners and admins can inspect generation runs" on public.ai_generation_runs;
create policy "Owners and admins can inspect generation runs"
on public.ai_generation_runs for select to authenticated
using (user_id = auth.uid() or public.is_ai_books_admin(auth.uid()));

create or replace function public.get_ai_book_cost_summary()
returns table(total_usd numeric, total_thb numeric, book_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(b.generation_cost_usd), 0)::numeric as total_usd,
    coalesce(sum(b.generation_cost_thb), 0)::numeric as total_thb,
    count(*)::bigint as book_count
  from public.ai_books b
  where b.status = 'ready'
    and (public.is_ai_books_admin(auth.uid()) or b.creator_id = auth.uid());
$$;

revoke all on function public.get_ai_book_cost_summary() from public;
grant execute on function public.get_ai_book_cost_summary() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-images', 'book-images', true, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true;

-- Files are uploaded only by the trusted Edge Function (service role).
drop policy if exists "Book images are publicly readable" on storage.objects;
create policy "Book images are publicly readable"
on storage.objects for select to public
using (bucket_id = 'book-images');

comment on table public.ai_books is 'AI-generated Chinese books. Ready public rows are readable by every authenticated user.';
comment on table public.ai_book_series is 'Continuity data and progress for 10-episode AI youth-fiction series.';
comment on table public.ai_book_reads is 'Books each user has completed; one row per user and book.';
comment on table public.ai_generation_runs is 'Raw OpenAI usage and computed cost for each generation step.';
