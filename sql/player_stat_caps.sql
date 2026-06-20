-- =====================================================================
-- GAMES Battle Mode - จำกัดค่าพลังสูงสุดของผู้เล่น (Player Stat Caps)
-- รันไฟล์นี้ใน Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ปลอดภัยที่จะรันซ้ำ (idempotent)
--   ตารางตั้งค่ารวมของเกม (แถวเดียว id = 1)
--     player_max_hp      = เพดาน HP สูงสุดของผู้เล่น (รวมอัปเกรดแล้ว)
--     player_max_attack  = เพดานพลังโจมตีสูงสุดของผู้เล่น (รวมอัปเกรดแล้ว)
--   admin แก้ค่าได้ในหน้า Admin > ตัวละคร
-- =====================================================================

create table if not exists public.game_settings (
  id integer primary key default 1,
  player_max_hp integer not null default 15,
  player_max_attack integer not null default 5,
  updated_at timestamptz not null default now(),
  constraint game_settings_singleton check (id = 1)
);

-- ค่าเริ่มต้น (เพดาน HP 15 / ATK 5)
insert into public.game_settings (id, player_max_hp, player_max_attack)
values (1, 15, 5)
on conflict (id) do nothing;

-- =====================================================================
-- RLS: อ่านได้ทุกคนที่ login, เขียนได้เฉพาะ admin
-- =====================================================================
alter table public.game_settings enable row level security;

drop policy if exists game_settings_read on public.game_settings;
create policy game_settings_read on public.game_settings
  for select to authenticated using (true);

drop policy if exists game_settings_admin_write on public.game_settings;
create policy game_settings_admin_write on public.game_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
