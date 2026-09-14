-- Allow owners/admins to cancel stuck or failed AI book generation.
-- Canceled rows remain for audit, but are excluded from the 24-hour quota.
alter table public.ai_books drop constraint if exists ai_books_status_check;
alter table public.ai_books
  add constraint ai_books_status_check
  check (status in ('generating', 'ready', 'failed', 'canceled'));

comment on column public.ai_books.status is
  'generating, ready, failed, or canceled. Canceled rows do not consume creation quota.';
