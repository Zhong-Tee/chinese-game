-- ลดซีรีส์ใหม่และซีรีส์เดิมที่ยังมีไม่เกิน 5 ตอน ให้จบที่ 5 ตอน
-- ซีรีส์เก่าที่สร้างเกินตอน 5 แล้วจะคงข้อมูลและเพดานเดิมไว้เพื่อไม่ลบผลงานผู้ใช้

alter table public.ai_book_series
  drop constraint if exists ai_book_series_total_episodes_check;

alter table public.ai_book_series
  alter column total_episodes set default 5;

update public.ai_book_series
set total_episodes = 5,
    updated_at = now()
where last_episode_number <= 5;

update public.ai_books as book
set series_total = series.total_episodes,
    updated_at = now()
from public.ai_book_series as series
where book.series_id = series.id
  and book.series_total is distinct from series.total_episodes;

alter table public.ai_book_series
  add constraint ai_book_series_total_episodes_check
  check (total_episodes between 5 and 10);

comment on column public.ai_book_series.total_episodes is
  'Series created from September 2026 use 5 episodes. Legacy series already beyond episode 5 retain their existing limit.';
