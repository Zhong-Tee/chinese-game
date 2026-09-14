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

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileError || !profile?.is_admin) return json({ error: 'เฉพาะ Admin เท่านั้นที่ลบหนังสือได้' }, 403);

  try {
    const { bookId } = await request.json();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(bookId || ''))) {
      return json({ error: 'รหัสหนังสือไม่ถูกต้อง' }, 400);
    }

    const { data: book, error: bookError } = await admin
      .from('ai_books')
      .select('id')
      .eq('id', bookId)
      .maybeSingle();
    if (bookError) throw bookError;
    if (!book) return json({ error: 'ไม่พบหนังสือเล่มนี้' }, 404);

    const { data: files, error: listError } = await admin.storage.from('book-images').list(bookId, { limit: 100 });
    if (listError) throw listError;
    if (files?.length) {
      const paths = files.map((file) => `${bookId}/${file.name}`);
      const { error: removeError } = await admin.storage.from('book-images').remove(paths);
      if (removeError) throw removeError;
    }

    const { error: deleteError } = await admin.from('ai_books').delete().eq('id', bookId);
    if (deleteError) throw deleteError;
    return json({ ok: true, bookId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('delete-book:', message);
    return json({ error: message || 'ลบหนังสือไม่สำเร็จ' }, 500);
  }
});
