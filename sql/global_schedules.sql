-- Migration: ย้ายตารางเปิด Level (schedules) เป็นค่ากลางของทั้งระบบ
-- admin ตั้งครั้งเดียว → มีผลกับนักเรียนทุกคน
-- รันไฟล์นี้ใน Supabase SQL Editor (ปลอดภัยที่จะรันซ้ำ)
--
-- แนวคิด:
--   - game_settings เป็นตาราง singleton (id = 1) อยู่แล้ว: ทุกคนอ่านได้ / เฉพาะ admin เขียนได้
--   - เก็บ schedules ไว้ที่นี่แทน user_settings.schedules (ซึ่งเป็นรายคน)
--   - รูปแบบ jsonb เดิม: { "lv3": ["จันทร์"], "lv4": [...], "lv5": [1,26], "lv6": [15] }
--   - user_settings.level_keys (กุญแจ) ยังเก็บรายคนตามเดิม

-- ให้แน่ใจว่ามีตาราง game_settings + แถว id = 1 (เผื่อยังไม่ได้รัน lucky_draw.sql)
create table if not exists public.game_settings (
  id integer primary key default 1,
  updated_at timestamptz not null default now(),
  constraint game_settings_singleton check (id = 1)
);

alter table public.game_settings
  add column if not exists schedules jsonb not null default '{"lv3":[],"lv4":[],"lv5":[],"lv6":[]}'::jsonb;

insert into public.game_settings (id) values (1)
on conflict (id) do nothing;

-- ย้ายค่าเดิมจากบัญชี admin คนแรก (ถ้ามี) ขึ้นมาเป็นค่ากลาง — ทำครั้งเดียวตอนตารางกลางยังว่าง
do $$
declare
  v_admin_schedules jsonb;
begin
  if (select schedules from public.game_settings where id = 1)
       = '{"lv3":[],"lv4":[],"lv5":[],"lv6":[]}'::jsonb then
    select us.schedules into v_admin_schedules
    from public.user_settings us
    join public.profiles p on p.user_id = us.user_id
    where p.is_admin = true
      and us.schedules is not null
      and us.schedules <> '{"lv3":[],"lv4":[],"lv5":[],"lv6":[]}'::jsonb
    limit 1;

    if v_admin_schedules is not null then
      update public.game_settings set schedules = v_admin_schedules, updated_at = now() where id = 1;
    end if;
  end if;
end $$;
