-- Remove ambiguous duplicate choices inside the same matching-word set.
-- A full backup is created before any deletion.

begin;

create table if not exists public.character_words_backup_before_dedup
as table public.character_words with data;

-- Keep the earliest row when the Chinese vocabulary is duplicated in one set.
with ranked as (
  select id,
    row_number() over (
      partition by flashcard_id, lower(btrim(vocabulary))
      order by sort_order, id
    ) as duplicate_number
  from public.character_words
)
delete from public.character_words target
using ranked
where target.id = ranked.id
  and ranked.duplicate_number > 1;

-- Keep the earliest row when the displayed Thai answer is duplicated in one set.
with ranked as (
  select id,
    row_number() over (
      partition by flashcard_id, lower(btrim(th))
      order by sort_order, id
    ) as duplicate_number
  from public.character_words
)
delete from public.character_words target
using ranked
where target.id = ranked.id
  and ranked.duplicate_number > 1;

-- Restore contiguous ordering after rows were removed.
with reordered as (
  select id,
    row_number() over (partition by flashcard_id order by sort_order, id) as next_order
  from public.character_words
)
update public.character_words target
set sort_order = -reordered.next_order
from reordered
where target.id = reordered.id;

update public.character_words
set sort_order = -sort_order
where sort_order < 0;

commit;

-- Verification: both queries should return zero rows.
select flashcard_id, lower(btrim(vocabulary)) as duplicate_value, count(*)
from public.character_words
group by flashcard_id, lower(btrim(vocabulary))
having count(*) > 1;

select flashcard_id, lower(btrim(th)) as duplicate_value, count(*)
from public.character_words
group by flashcard_id, lower(btrim(th))
having count(*) > 1;
