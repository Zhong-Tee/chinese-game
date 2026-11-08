alter table public.conversation_courses
  add column generation_cost_usd numeric,
  add column generation_cost_thb numeric,
  add column lookup_cost_thb numeric,
  add column content_cost_thb numeric,
  add column cost_record_count integer not null default 0;

create table public.conversation_generation_runs (
  id uuid primary key,
  course_id uuid references public.conversation_courses(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  operation text not null check (operation in ('lookup', 'content')),
  model text not null,
  usage jsonb,
  cost_usd numeric check (cost_usd >= 0),
  cost_thb numeric check (cost_thb >= 0),
  exchange_rate numeric check (exchange_rate > 0),
  pricing_version text not null,
  rates jsonb,
  created_at timestamptz not null default now()
);
create index conversation_generation_runs_course_idx on public.conversation_generation_runs(course_id);
alter table public.conversation_generation_runs enable row level security;
revoke all on public.conversation_generation_runs from anon, authenticated;
grant all on public.conversation_generation_runs to service_role;

create function public.update_conversation_cost_totals() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.course_id is null then return new; end if;
  -- Lock before aggregating to prevent concurrent lookup/generation logs losing totals.
  perform 1 from conversation_courses where id = new.course_id for update;
  update conversation_courses set
    generation_cost_usd = s.usd, generation_cost_thb = s.thb,
    lookup_cost_thb = s.lookup_thb, content_cost_thb = s.content_thb,
    cost_record_count = s.n
  from (
    select count(*)::integer n,
      case when bool_and(cost_usd is not null) then sum(cost_usd) end usd,
      case when bool_and(cost_thb is not null) then sum(cost_thb) end thb,
      case when bool_and(cost_thb is not null) filter(where operation = 'lookup')
        then sum(cost_thb) filter(where operation = 'lookup') end lookup_thb,
      case when bool_and(cost_thb is not null) filter(where operation = 'content')
        then sum(cost_thb) filter(where operation = 'content') end content_thb
    from conversation_generation_runs where course_id = new.course_id
  ) s where id = new.course_id;
  return new;
end $$;
revoke all on function public.update_conversation_cost_totals() from public;
create trigger conversation_cost_totals after insert or update of course_id on public.conversation_generation_runs
  for each row execute function public.update_conversation_cost_totals();
