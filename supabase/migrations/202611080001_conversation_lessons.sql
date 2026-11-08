-- Shared immutable courses; learning records belong to individual authenticated users.
create table public.conversation_courses (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (char_length(topic) between 2 and 200),
  topic_key text not null,
  level text not null check (level in ('beginner','basic','intermediate')),
  goal text not null default '',
  status text not null default 'generating' check (status in ('generating','ready','failed')),
  content jsonb,
  error_message text,
  creator_id uuid references auth.users(id) on delete set null,
  generation_token uuid not null default gen_random_uuid(),
  model text,
  usage jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_key, level)
);
create table public.conversation_topic_aliases (
  topic_key text not null,
  level text not null,
  course_id uuid not null references public.conversation_courses(id) on delete cascade,
  primary key (topic_key, level)
);
create table public.conversation_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.conversation_courses(id) on delete cascade,
  unit_index integer not null check (unit_index between 0 and 3),
  answers jsonb not null default '{}',
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, unit_index)
);
alter table public.conversation_courses enable row level security;
alter table public.conversation_topic_aliases enable row level security;
alter table public.conversation_progress enable row level security;
create policy "Authenticated course library" on public.conversation_courses for select to authenticated using (true);
create policy "Read own conversation progress" on public.conversation_progress for select to authenticated using (auth.uid() = user_id);
grant select on public.conversation_courses, public.conversation_progress to authenticated;
grant all on public.conversation_courses, public.conversation_topic_aliases, public.conversation_progress to service_role;
revoke all on public.conversation_topic_aliases from anon, authenticated;
revoke insert, update, delete on public.conversation_courses, public.conversation_progress from anon, authenticated;

-- Serialize claims and require the semantic lookup to include every catalog entry.
-- If a concurrent request added a course, callers must refresh and compare again.
create function public.claim_conversation_course(p_key text, p_topic text, p_level text,
  p_goal text, p_user uuid, p_catalog_count integer, p_existing uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c conversation_courses; n integer; canonical text;
begin
  perform pg_advisory_xact_lock(81472061);
  canonical := regexp_replace(lower(normalize(p_topic, NFKC)), '[[:space:][:punct:]]', '', 'g');
  select cc.* into c from conversation_topic_aliases a join conversation_courses cc on cc.id = a.course_id
    where a.topic_key = p_key and a.level = p_level;
  if c.id is null then
    select * into c from conversation_courses where topic_key = canonical and level = p_level;
  end if;
  if c.id is null and p_existing is not null then
    select * into c from conversation_courses where id = p_existing and level = p_level;
    if c.id is null then raise exception 'Invalid matching course'; end if;
  end if;
  if c.id is null then
    select count(*) into n from conversation_courses;
    if n <> p_catalog_count then return jsonb_build_object('refresh', true); end if;
    insert into conversation_courses(topic, topic_key, level, goal, creator_id)
      values(p_topic, canonical, p_level, p_goal, p_user) returning * into c;
    insert into conversation_topic_aliases values(p_key, p_level, c.id);
    return jsonb_build_object('course', to_jsonb(c), 'claimed', true);
  end if;
  insert into conversation_topic_aliases values(p_key, p_level, c.id) on conflict do nothing;
  if c.status = 'failed' then
    update conversation_courses set status = 'generating', error_message = null,
      generation_token = gen_random_uuid(), updated_at = now() where id = c.id returning * into c;
    return jsonb_build_object('course', to_jsonb(c), 'claimed', true);
  end if;
  return jsonb_build_object('course', to_jsonb(c), 'claimed', false);
end $$;
revoke all on function public.claim_conversation_course(text,text,text,text,uuid,integer,uuid) from public;
grant execute on function public.claim_conversation_course(text,text,text,text,uuid,integer,uuid) to service_role;

-- Merge one answer atomically, so separate tabs cannot overwrite other questions.
create function public.answer_conversation_question(p_course uuid, p_unit integer, p_question integer, p_answer jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare q jsonb; u jsonb; good boolean; result conversation_progress; total integer; token_count integer;
  submitted text; expected text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select content->'units'->p_unit into u from conversation_courses where id = p_course and status = 'ready';
  q := u->'questions'->p_question;
  if p_unit < 0 or p_question < 0 or q is null then raise exception 'Invalid question'; end if;
  if q->>'kind' = 'order' then
    good := false;
    token_count := jsonb_array_length(q->'tokens');
    if jsonb_typeof(p_answer) = 'array' then
      if jsonb_array_length(p_answer) = token_count and
        (select count(distinct v) = token_count and bool_and(case when v ~ '^[0-9]$' then v::integer < token_count else false end)
          from jsonb_array_elements_text(p_answer) a(v)) then
        select string_agg(q->'tokens'->>(v::integer), '' order by ord) into submitted
          from jsonb_array_elements_text(p_answer) with ordinality a(v, ord);
        select string_agg(q->'tokens'->>(v::integer), '' order by ord) into expected
          from jsonb_array_elements_text(q->'answer_order') with ordinality a(v, ord);
        good := submitted = expected;
      end if;
    end if;
  else good := p_answer = q->'correct_index'; end if;
  total := jsonb_array_length(u->'questions');
  insert into conversation_progress(user_id, course_id, unit_index, answers)
    values(auth.uid(), p_course, p_unit, jsonb_build_object(p_question::text,
      jsonb_build_object('answer', p_answer, 'correct', coalesce(good,false), 'attempts', 1)))
    on conflict(user_id, course_id, unit_index) do update set
      answers = conversation_progress.answers || jsonb_build_object(p_question::text,
        jsonb_build_object('answer', p_answer, 'correct', coalesce(good,false), 'attempts',
          coalesce((conversation_progress.answers->p_question::text->>'attempts')::integer,0)+1)),
      updated_at = now()
    returning * into result;
  update conversation_progress set completed = (select count(*) from jsonb_object_keys(result.answers)) = total
    where user_id = auth.uid() and course_id = p_course and unit_index = p_unit returning * into result;
  return to_jsonb(result);
end $$;
revoke all on function public.answer_conversation_question(uuid,integer,integer,jsonb) from public;
grant execute on function public.answer_conversation_question(uuid,integer,integer,jsonb) to authenticated;
