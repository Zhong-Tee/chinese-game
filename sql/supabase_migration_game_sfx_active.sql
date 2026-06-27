-- เปิด/ปิดใช้งานเสียง SFX แต่ละรายการจากหน้า Admin
ALTER TABLE public.game_sfx
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.game_sfx.active IS 'true = เล่นเสียงได้, false = ปิดใช้งาน';
