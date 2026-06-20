-- =====================================================================
-- GAMES - ปรับระบบเศรษฐกิจ + แก้บั๊กเวลาด่าน
-- รันไฟล์นี้ใน Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ปลอดภัยที่จะรันซ้ำ (idempotent)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) แก้บั๊ก "ตั้งค่าด่าน เวลาพิมพ์ ไม่จดจำค่า"
--    คอลัมน์ answer_time_typing_sec หายไปใน DB จริง ทำให้การบันทึกด่าน
--    ทั้งก้อนล้มเหลว (เพราะ saveStage อัปเดต 3 ฟิลด์เวลาในคำสั่งเดียว)
--    เพิ่มคอลัมน์ที่ขาดให้ครบ (rearrange มีอยู่แล้วแต่ใส่ไว้กันพลาด)
-- ---------------------------------------------------------------------
alter table public.game_stages
  add column if not exists answer_time_rearrange_sec integer not null default 12;
alter table public.game_stages
  add column if not exists answer_time_typing_sec integer not null default 15;

-- ---------------------------------------------------------------------
-- 2) ราคาอัปเกรดแบบขั้นบันได
--    cost_step = ส่วนที่บวกเพิ่มต่อการซื้อ 1 ครั้ง (ราคา = cost + cost_step × จำนวนที่ซื้อแล้ว)
--    ค่า 0 = ราคาคงที่ (ไอเทมสิ้นเปลืองทั่วไป)
-- ---------------------------------------------------------------------
alter table public.shop_items
  add column if not exists cost_step integer not null default 0;

-- ตั้งราคาบันไดให้อัปเกรดพลัง (ใช้ EXP จากการรบ)
--   HP +1 : 40, 50, 60, ... 150  (ซื้อครบ 12 ครั้ง รวม 1,140 EXP)
update public.shop_items
  set cost = 40, cost_step = 10
  where kind = 'upgrade' and effect_type = 'add_hp';

--   ATK +1: 60, 80, 100, 120     (ซื้อครบ 4 ครั้ง รวม 360 EXP)
update public.shop_items
  set cost = 60, cost_step = 20
  where kind = 'upgrade' and effect_type = 'add_attack';

-- ---------------------------------------------------------------------
-- 3) หมายเหตุ (ไม่ต้องแก้ schema)
--    - ตาราง exp_rewards ตอนนี้ใช้เป็น "Coin ต่อการ์ด" (Flashcards ให้ Coin)
--      ค่าเดิมที่ตั้งไว้ใช้งานต่อได้เลย ปรับในหน้า Admin > COIN
--    - shop_items.currency ไม่ต้องสลับ: อัปเกรดยังใช้ 'exp' (ได้จากการรบ),
--      ไอเทมยังใช้ 'coin' (ได้จากการเล่น Flashcards)
--    - EXP จาก monster = 1, boss = 5 และเล่นซ้ำด่านที่ชนะแล้วได้ 20%
--      เป็น logic ฝั่งโค้ด (BattleGame.jsx) ไม่ต้องตั้งใน DB
-- =====================================================================
