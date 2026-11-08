alter table public.conversation_progress add column memory jsonb not null default '{}';

create function public.answer_conversation_vocabulary(p_course uuid, p_unit integer, p_round text, p_word integer, p_choice integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare vocab jsonb; good boolean; result conversation_progress; entry jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_round not in ('start','middle','end') or p_round is null or p_unit < 0 then raise exception 'Invalid memory round'; end if;
  select content->'units'->p_unit->'vocabulary' into vocab from conversation_courses where id = p_course and status = 'ready';
  if vocab is null or p_word < 0 or p_choice < 0 or p_word >= jsonb_array_length(vocab) or p_choice >= jsonb_array_length(vocab) or p_word is null or p_choice is null then raise exception 'Invalid vocabulary'; end if;
  -- Equivalent translations are valid even if two source items share a meaning.
  good := p_word = p_choice or (vocab->p_word->>'th') = (vocab->p_choice->>'th');
  insert into conversation_progress(user_id,course_id,unit_index) values(auth.uid(),p_course,p_unit) on conflict do nothing;
  select * into result from conversation_progress where user_id=auth.uid() and course_id=p_course and unit_index=p_unit for update;
  entry := jsonb_build_object('correct',good,'choice',p_choice,'attempts',coalesce((result.memory->p_round->p_word::text->>'attempts')::integer,0)+1);
  update conversation_progress set memory = jsonb_set(memory, array[p_round],
    coalesce(memory->p_round,'{}') || jsonb_build_object(p_word::text,entry)), updated_at=now()
    where user_id=auth.uid() and course_id=p_course and unit_index=p_unit returning * into result;
  return to_jsonb(result);
end $$;
revoke all on function public.answer_conversation_vocabulary(uuid,integer,text,integer,integer) from public;
grant execute on function public.answer_conversation_vocabulary(uuid,integer,text,integer,integer) to authenticated;

create function public.conversation_completion() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare unit jsonb; r text; i integer;
begin
  select content->'units'->new.unit_index into unit from conversation_courses where id=new.course_id;
  new.completed := unit is not null and (select count(*) from jsonb_object_keys(new.answers)) = jsonb_array_length(unit->'questions');
  foreach r in array array['start','middle','end'] loop
    for i in 0..coalesce(jsonb_array_length(unit->'vocabulary'),0)-1 loop
      if coalesce((new.memory->r->i::text->>'correct')::boolean,false) = false then new.completed:=false; end if;
    end loop;
  end loop;
  return new;
end $$;
create trigger conversation_completion before insert or update on public.conversation_progress for each row execute function public.conversation_completion();
