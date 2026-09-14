-- Admin setting: show or hide the Word Fighter logo on the Home screen.
alter table public.game_settings
  add column if not exists word_fighter_logo_enabled boolean not null default true;

update public.game_settings
set word_fighter_logo_enabled = true
where id = 1 and word_fighter_logo_enabled is null;

comment on column public.game_settings.word_fighter_logo_enabled is
  'true shows the Word Fighter logo on Home; false hides it for every user.';
