-- Admin: เลือกผู้ใช้และมอบกุญแจ LV3-6 จำนวน 1 ดอก
-- รันไฟล์นี้ใน Supabase SQL Editor ก่อนใช้งานหน้า Settings เวอร์ชันนี้

create or replace function public.list_key_grant_users()
returns table (user_id uuid, display_name text)
language sql
security definer
set search_path = public
as $$
  select p.user_id,
    coalesce(nullif(trim(p.username), ''), nullif(trim(p.display_name), ''),
      nullif(split_part(p.email, '@', 1), ''), p.user_id::text) as display_name
  from public.profiles p
  where public.is_admin()
  order by display_name;
$$;

create or replace function public.admin_grant_level_key(target_user_id uuid, target_level integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  level_path text[];
begin
  if not public.is_admin() then
    raise exception 'Admin permission required';
  end if;
  if target_level not between 3 and 6 then
    raise exception 'Level must be between 3 and 6';
  end if;
  if not exists (select 1 from public.profiles where user_id = target_user_id) then
    raise exception 'User not found';
  end if;

  insert into public.user_settings (user_id) values (target_user_id)
  on conflict (user_id) do nothing;

  level_path := array['lv' || target_level::text];
  update public.user_settings
  set level_keys = jsonb_set(
    coalesce(level_keys, '{}'::jsonb),
    level_path,
    jsonb_build_object('has', true, 'grantDate', to_char(current_date, 'YYYY-MM-DD')),
    true
  )
  where user_id = target_user_id;
end;
$$;

revoke all on function public.list_key_grant_users() from public;
revoke all on function public.admin_grant_level_key(uuid, integer) from public;
grant execute on function public.list_key_grant_users() to authenticated;
grant execute on function public.admin_grant_level_key(uuid, integer) to authenticated;
