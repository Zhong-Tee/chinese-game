-- ล้างดาว "คำใหม่ถึง LV3" ที่ถูกแจกผิดโดยโค้ดซ่อมภารกิจรุ่นเก่า
-- (รุ่นเก่าหยิบคำเก่าที่อยู่ LV3+ มาใส่เป็นคำใหม่ของวันนั้น พร้อมติ๊กว่าผ่านทันที)
--
-- ลำดับการรัน:
--   1) sql/daily_words_ids_column.sql
--   2) ขั้นที่ 0 ในไฟล์นี้ (ตรวจสอบ)
--   3) ขั้นที่ 1 หรือ 2 (เลือกอย่างใดอย่างหนึ่ง)

-- ============================================================
-- ขั้นที่ 0 — ตรวจสอบก่อน: ภารกิจวันนี้ของแต่ละคนอ้างถึงคำอะไร อยู่ Level ไหน
-- ถ้าคำใน new_word_ids อยู่ LV3+ ทั้งหมดตั้งแต่ยังไม่ได้เล่น = โดนแจกดาวผิด
-- ============================================================
select m.user_id,
       m.new_word_ids,
       m.new_words_completed_ids,
       array_agg(up.flashcard_id || ':LV' || up.level order by up.flashcard_id) as levels_actual
from public.daily_mission_progress m
left join public.user_progress up
  on up.user_id = m.user_id and up.flashcard_id = any(m.new_word_ids)
where m.mission_date = current_date
group by m.user_id, m.new_word_ids, m.new_words_completed_ids
order by m.user_id;

-- ตรวจว่าตาราง user_progress มีคอลัมน์ created_at หรือไม่ (ใช้เลือกวิธีซ่อมด้านล่าง)
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'user_progress'
order by ordinal_position;

-- ============================================================
-- ขั้นที่ 1 (แนะนำ — ใช้ได้เมื่อ user_progress มีคอลัมน์ created_at)
-- ซ่อมให้ถูกต้อง: คำใหม่ของวันนี้ = คำที่ถูกเพิ่มเข้าคลังผู้ใช้วันนี้จริง
-- และติ๊กผ่านเฉพาะคำที่ขึ้นถึง LV3 แล้วจริงเท่านั้น
-- ============================================================
-- with today_words as (
--   select user_id,
--          array_agg(flashcard_id order by flashcard_id) as ids,
--          array_remove(array_agg(case when level >= 3 then flashcard_id end), null) as done_ids
--   from public.user_progress
--   where created_at >= date_trunc('day', now() at time zone 'Asia/Bangkok')
--   group by user_id
-- )
-- update public.daily_mission_progress m
-- set new_word_ids = t.ids,
--     new_words_completed_ids = coalesce(t.done_ids, '{}'),
--     updated_at = now()
-- from today_words t
-- where m.user_id = t.user_id and m.mission_date = current_date;
--
-- -- backfill ให้ระบบซ่อมอัตโนมัติของแอปใช้งานต่อได้ในวันนี้
-- with today_words as (
--   select user_id, array_agg(flashcard_id order by flashcard_id) as ids
--   from public.user_progress
--   where created_at >= date_trunc('day', now() at time zone 'Asia/Bangkok')
--   group by user_id
-- )
-- update public.user_settings s
-- set last_daily_word_ids = t.ids
-- from today_words t
-- where s.user_id = t.user_id and s.last_daily_words_date = current_date;

-- ============================================================
-- ขั้นที่ 2 (ทางเลือก — ใช้เมื่อไม่มี created_at ให้แยกคำใหม่ของวันนี้)
-- ล้างภารกิจคำใหม่ของวันนี้ทิ้ง: ดาวปลอมหายไป แถวภารกิจนี้จะไม่แสดงวันนี้
-- แล้วเริ่มนับใหม่อย่างถูกต้องในวันถัดไป (ส่วนดาวอื่นไม่ถูกแตะ)
-- ============================================================
-- update public.daily_mission_progress
-- set new_word_ids = '{}',
--     new_words_completed_ids = '{}',
--     updated_at = now()
-- where mission_date = current_date;
