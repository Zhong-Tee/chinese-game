-- =====================================================================
-- GAMES Battle Mode - ไอเทมใช้แล้วทิ้งแบบใหม่
-- รันไฟล์นี้ใน Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ปลอดภัยที่จะรันซ้ำ (idempotent)
--   เพิ่ม effect_type ใหม่ 2 แบบ:
--     add_time = เพิ่มเวลาตอบของข้อปัจจุบัน (วินาที = effect_value)
--     bomb     = สร้างความเสียหายให้ศัตรูทันที (= effect_value) โดยไม่ต้องตอบ
-- =====================================================================

-- 1) ขยาย constraint ของ effect_type ให้รองรับค่าใหม่
alter table public.shop_items drop constraint if exists shop_items_effect_type_check;
alter table public.shop_items add constraint shop_items_effect_type_check
  check (effect_type in ('add_hp', 'add_attack', 'heal', 'shield', 'add_time', 'bomb'));

-- 2) เพิ่มไอเทมตั้งต้น (admin แก้/ลบ/อัปโหลดไอคอนเองได้ภายหลัง)
insert into public.shop_items (name, description, kind, currency, cost, effect_type, effect_value, sort_order) values
  ('นาฬิกาทราย', 'เพิ่มเวลาตอบของข้อปัจจุบัน +10 วินาที', 'item', 'coin', 15, 'add_time', 10, 5),
  ('ระเบิดพลัง', 'สร้างความเสียหายให้ศัตรูทันที 5 หน่วย', 'item', 'coin', 40, 'bomb', 5, 6)
on conflict do nothing;
