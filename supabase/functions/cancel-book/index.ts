import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Server secrets are not configured' }, 500);

  const authorization = request.headers.get('Authorization') || '';
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: 'กรุณาเข้าสู่ระบบ' }, 401);

  try {
    const { bookId } = await request.json();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(bookId || ''))) {
      return json({ error: 'รหัสหนังสือไม่ถูกต้อง' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const [{ data: book, error: bookError }, { data: profile }] = await Promise.all([
      admin.from('ai_books').select('id, creator_id, status').eq('id', bookId).maybeSingle(),
      admin.from('profiles').select('is_admin').eq('user_id', user.id).maybeSingle(),
    ]);
    if (bookError) throw bookError;
    if (!book) return json({ error: 'ไม่พบหนังสือเล่มนี้' }, 404);
    if (book.creator_id !== user.id && !profile?.is_admin) return json({ error: 'คุณไม่มีสิทธิ์ยกเลิกรายการนี้' }, 403);
    if (book.status === 'ready') return json({ error: 'หนังสือสร้างเสร็จแล้ว หากต้องการนำออกให้ Admin ลบหนังสือ' }, 409);
    if (book.status === 'canceled') return json({ ok: true, bookId, quotaRestored: true, alreadyCanceled: true });

    const { data: canceledBook, error: cancelError } = await admin
      .from('ai_books')
      .update({ status: 'canceled', error_message: 'ยกเลิกโดยผู้ใช้', updated_at: new Date().toISOString() })
      .eq('id', bookId)
      .in('status', ['generating', 'partial', 'failed'])
      .select('id')
      .maybeSingle();
    if (cancelError) throw cancelError;
    if (!canceledBook) return json({ error: 'สถานะหนังสือเปลี่ยนไปแล้ว กรุณารีเฟรชและลองใหม่' }, 409);

    const { data: files } = await admin.storage.from('book-images').list(bookId, { limit: 100 });
    if (files?.length) await admin.storage.from('book-images').remove(files.map((file) => `${bookId}/${file.name}`));

    return json({ ok: true, bookId, quotaRestored: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('cancel-book:', message);
    return json({ error: message || 'ยกเลิกการสร้างหนังสือไม่สำเร็จ' }, 500);
  }
});
