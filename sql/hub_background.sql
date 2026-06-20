-- =====================================================================
-- Hub Background — รูปปกพื้นหลังหน้า Home (Dashboard)
-- รันใน Supabase SQL Editor (รันซ้ำได้)
-- Admin ตั้งค่าได้ที่ Admin Panel > ตัวละคร > รูปปกพื้นหลัง
-- =====================================================================

-- สร้าง game_settings ถ้ายังไม่มี (กรณียังไม่เคยรัน migration อื่น)
create table if not exists public.game_settings (
  id integer primary key default 1,
  player_max_hp integer not null default 15,
  player_max_attack integer not null default 5,
  updated_at timestamptz not null default now(),
  constraint game_settings_singleton check (id = 1)
);

insert into public.game_settings (id, player_max_hp, player_max_attack)
values (1, 15, 5)
on conflict (id) do nothing;

alter table public.game_settings
  add column if not exists hub_background_url text;

alter table public.game_settings enable row level security;

drop policy if exists game_settings_read on public.game_settings;
create policy game_settings_read on public.game_settings
  for select to authenticated using (true);

drop policy if exists game_settings_admin_write on public.game_settings;
create policy game_settings_admin_write on public.game_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
