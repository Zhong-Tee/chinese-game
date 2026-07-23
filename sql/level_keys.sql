-- Migration: ระบบ "ลูกกุญแจ" ปลดล็อก Level 3-6
-- รันไฟล์นี้ใน Supabase SQL Editor ก่อน deploy ฟีเจอร์ลูกกุญแจ (ปลอดภัยที่จะรันซ้ำ)
--
-- แนวคิด: เก็บสถานะกุญแจของแต่ละ level ไว้ใน jsonb คอลัมน์เดียว
--   {
--     "lv3": { "has": true,  "grantDate": "2026-07-23" },
--     "lv4": { "has": false, "grantDate": "2026-07-20" },
--     "lv5": { "has": false, "grantDate": null },
--     "lv6": { "has": false, "grantDate": null },
--     "playDate": "2026-07-22"   -- วันที่ล่าสุดที่ "ใช้กุญแจเล่น" (จำกัดวันละ 1 level)
--   }
--   - has        = ถือกุญแจอยู่หรือไม่ (สูงสุด 1 ดอกต่อ level)
--   - grantDate  = วันเปิดล่าสุดที่ประมวลผลการมอบกุญแจแล้ว (กันมอบซ้ำในวันเดียว)
--   - playDate   = กันเล่นปลดล็อกเกินวันละ 1 level

alter table public.user_settings
  add column if not exists level_keys jsonb not null default '{}'::jsonb;
