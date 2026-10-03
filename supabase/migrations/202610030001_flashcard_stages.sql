-- Global Flash Card stage switches. Existing game_settings RLS allows only admins to write.
alter table public.game_settings
  add column if not exists flashcard_stages jsonb not null
  default '{"typing": true, "rearrange": true}'::jsonb;

-- Also supports databases that already ran the previous stage 2/3 version.
alter table public.game_settings alter column flashcard_stages
  set default '{"typing": true, "rearrange": true}'::jsonb;
update public.game_settings
set flashcard_stages = (flashcard_stages - 'meaning') ||
  jsonb_build_object('rearrange', coalesce(flashcard_stages->'rearrange', 'true'::jsonb));

insert into public.game_settings (id) values (1) on conflict (id) do nothing;

comment on column public.game_settings.flashcard_stages is
  'Flash Card optional stages: typing (stage 3), rearrange (stage 4). Missing keys default to enabled.';
