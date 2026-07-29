-- ================================================================
-- ฟีเจอร์ใหม่: เกมจับคู่คำศัพท์ (Word Match)
-- ตาราง character_words = คำศัพท์ 6 คำต่อ 1 ตัวอักษร (flashcards.id1)
--   - sort_order 1 = คำ vocabulary เดิมจาก flashcards (backfill อัตโนมัติ)
--   - sort_order 2-6 = คำที่ AI สร้างเพิ่ม (มาจากไฟล์ seed character_words_XXXX.sql)
-- ตรวจทานก่อน แล้วรันใน Supabase SQL Editor ตามลำดับ:
--   1) character_words.sql (ไฟล์นี้ = สร้างตาราง + backfill คำที่ 1)
--   2) character_words_0001-0030.sql (คำที่ 2-6 ชุด pilot)
-- ================================================================

-- 1) สร้างตาราง ------------------------------------------------------
create table if not exists public.character_words (
  id           bigint generated always as identity primary key,
  flashcard_id integer  not null references public.flashcards(id1) on delete cascade,
  vocabulary   text     not null,   -- คำศัพท์จีน เช่น 一个 / 一辆
  pinyin_vocab text     not null,   -- พินอิน เช่น yī gè
  th           text     not null,   -- คำแปลไทย
  sort_order   smallint not null default 1,  -- 1-6 ลำดับในชุด
  unique (flashcard_id, sort_order)
);

create index if not exists idx_character_words_fk
  on public.character_words (flashcard_id);

-- 1.1) ปิด RLS + ให้สิทธิ์อ่าน (ให้เหมือนตาราง flashcards) --------
--      สำคัญ: ถ้าไม่ปิด RLS แอปจะอ่านได้ 0 แถว (200 แต่ว่างเปล่า)
alter table public.character_words disable row level security;
grant select on public.character_words to anon, authenticated;

-- 2) Backfill คำที่ 1 จาก flashcards เดิม ---------------------------
--    เก็บ vocabulary เดิมไว้เป็น 1 ใน 6 (sort_order = 1)
--    ปลอดภัยต่อการรันซ้ำ (on conflict do nothing)
insert into public.character_words (flashcard_id, vocabulary, pinyin_vocab, th, sort_order)
select f.id1, f.vocabulary, f.pinyin_vocab, f.th, 1
from public.flashcards f
where f.vocabulary is not null and f.vocabulary <> ''
on conflict (flashcard_id, sort_order) do nothing;

-- ตรวจผล:
-- select flashcard_id, count(*) from public.character_words group by 1 order by 1;
