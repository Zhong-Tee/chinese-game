-- Apply this after ai_books.sql when upgrading an existing project.
-- Book deletion is reserved for admins; the delete-book Edge Function checks this again server-side.
drop policy if exists "Owners can delete books" on public.ai_books;
drop policy if exists "Only admins can delete books" on public.ai_books;

create policy "Only admins can delete books"
on public.ai_books for delete to authenticated
using (public.is_ai_books_admin(auth.uid()));
