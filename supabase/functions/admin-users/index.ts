import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function removeBookImages(admin: ReturnType<typeof createClient>, bookIds: string[]) {
  const warnings: string[] = [];
  for (const bookId of bookIds) {
    const { data: files, error: listError } = await admin.storage.from('book-images').list(bookId, { limit: 100 });
    if (listError) {
      warnings.push(`list:${bookId}`);
      continue;
    }
    if (!files?.length) continue;
    const { error: removeError } = await admin.storage.from('book-images').remove(files.map((file) => `${bookId}/${file.name}`));
    if (removeError) warnings.push(`remove:${bookId}`);
  }
  return warnings;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Server secrets are not configured' }, 500);

  const authorization = request.headers.get('Authorization') || '';
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: 'กรุณาเข้าสู่ระบบ' }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: callerProfile, error: callerError } = await admin.from('profiles').select('is_admin').eq('user_id', user.id).maybeSingle();
  if (callerError || !callerProfile?.is_admin) return json({ error: 'เฉพาะ Admin เท่านั้นที่จัดการผู้ใช้ได้' }, 403);

  try {
    const body = await request.json();
    const action = String(body.action || 'list');
    if (action === 'list') {
      const [{ data: authData, error: usersError }, { data: profiles, error: profilesError }] = await Promise.all([
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        admin.from('profiles').select('user_id, username, display_name, email, is_admin'),
      ]);
      if (usersError) throw usersError;
      if (profilesError) throw profilesError;
      const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
      const users = (authData?.users || []).map((authUser) => {
        const profile = profileMap.get(authUser.id);
        const email = profile?.email || authUser.email || '';
        return {
          user_id: authUser.id,
          email,
          username: profile?.username || '',
          display_name: profile?.username || profile?.display_name || email.split('@')[0] || 'ผู้ใช้',
          is_admin: Boolean(profile?.is_admin),
          created_at: authUser.created_at,
        };
      }).sort((a, b) => a.display_name.localeCompare(b.display_name, 'th'));
      return json({ users });
    }

    if (action !== 'delete') return json({ error: 'คำสั่งไม่ถูกต้อง' }, 400);
    const targetUserId = String(body.userId || '');
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(targetUserId)) return json({ error: 'รหัสผู้ใช้ไม่ถูกต้อง' }, 400);
    if (targetUserId === user.id) return json({ error: 'ไม่สามารถลบบัญชี Admin ที่กำลังใช้งานอยู่ได้' }, 400);

    const { data: targetProfile, error: targetProfileError } = await admin.from('profiles').select('is_admin, username, display_name, email').eq('user_id', targetUserId).maybeSingle();
    if (targetProfileError) throw targetProfileError;
    if (targetProfile?.is_admin) return json({ error: 'ไม่อนุญาตให้ลบบัญชี Admin ผ่านหน้านี้' }, 403);
    const { data: targetAuth, error: targetAuthError } = await admin.auth.admin.getUserById(targetUserId);
    if (targetAuthError || !targetAuth?.user) return json({ error: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ Authentication' }, 404);

    const [{ data: ownedBooks, error: booksError }, { data: ownedSeries, error: seriesError }] = await Promise.all([
      admin.from('ai_books').select('id').eq('creator_id', targetUserId),
      admin.from('ai_book_series').select('id').eq('creator_id', targetUserId),
    ]);
    if (booksError) throw booksError;
    if (seriesError) throw seriesError;
    const seriesIds = (ownedSeries || []).map((series) => series.id);
    let seriesBooks: Array<{ id: string }> = [];
    if (seriesIds.length) {
      const { data, error } = await admin.from('ai_books').select('id').in('series_id', seriesIds);
      if (error) throw error;
      seriesBooks = data || [];
    }
    const bookIds = [...new Set([...(ownedBooks || []).map((book) => book.id), ...seriesBooks.map((book) => book.id)])];

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(targetUserId);
    if (deleteUserError) throw deleteUserError;
    const cleanupWarnings: string[] = [];
    if (bookIds.length) {
      const { error: remainingBooksError } = await admin.from('ai_books').delete().in('id', bookIds);
      if (remainingBooksError) cleanupWarnings.push('database:series-books');
    }
    cleanupWarnings.push(...await removeBookImages(admin, bookIds));
    return json({ ok: true, userId: targetUserId, deletedBooks: bookIds.length, deletedSeries: seriesIds.length, cleanupWarnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('admin-users:', message);
    return json({ error: message || 'จัดการผู้ใช้ไม่สำเร็จ' }, 500);
  }
});
