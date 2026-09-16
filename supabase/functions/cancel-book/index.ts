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
      admin.from('ai_books').select('id, creator_id, status, series_id').eq('id', bookId).maybeSingle(),
      admin.from('profiles').select('is_admin').eq('user_id', user.id).maybeSingle(),
    ]);
    if (bookError) throw bookError;
    if (!book) return json({ error: 'ไม่พบหนังสือเล่มนี้' }, 404);
    if (book.creator_id !== user.id && !profile?.is_admin) return json({ error: 'คุณไม่มีสิทธิ์ยกเลิกรายการนี้' }, 403);
    let series: Record<string, any> | null = null;
    if (book.series_id) {
      const { data } = await admin.from('ai_book_series').select('id, generation_status').eq('id', book.series_id).maybeSingle();
      series = data;
    }
    const activeSeries = series?.generation_status === 'generating' || series?.generation_status === 'failed';
    if (book.status === 'ready' && !activeSeries) return json({ error: 'หนังสือสร้างเสร็จแล้ว หากต้องการนำออกให้ Admin ลบหนังสือ' }, 409);
    if (book.status === 'canceled') return json({ ok: true, bookId, quotaRestored: true, alreadyCanceled: true });

    if (activeSeries) {
      await admin.from('ai_book_series').update({ generation_status: 'canceled', error_message: 'ยกเลิกโดยผู้ใช้', generation_progress: { stage: 'canceled', message_th: 'ยกเลิกการสร้างซีรีส์แล้ว' }, updated_at: new Date().toISOString() }).eq('id', book.series_id);
      await admin.from('ai_series_generation_jobs').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('series_id', book.series_id).in('status', ['waiting', 'queued', 'processing', 'failed']);
      const { data: seriesBooks, error: seriesBooksError } = await admin.from('ai_books').select('id').eq('series_id', book.series_id);
      if (seriesBooksError) throw seriesBooksError;
      const { error: cancelSeriesBooksError } = await admin.from('ai_books').update({ status: 'canceled', error_message: 'ยกเลิกโดยผู้ใช้', updated_at: new Date().toISOString() }).eq('series_id', book.series_id).in('status', ['generating', 'partial', 'failed', 'ready']);
      if (cancelSeriesBooksError) throw cancelSeriesBooksError;
      for (const seriesBook of seriesBooks || []) {
        const { data: files } = await admin.storage.from('book-images').list(seriesBook.id, { limit: 100 });
        if (files?.length) await admin.storage.from('book-images').remove(files.map((file) => `${seriesBook.id}/${file.name}`));
      }
    }
    const { data: canceledBook, error: cancelError } = activeSeries
      ? { data: { id: bookId }, error: null }
      : await admin.from('ai_books').update({ status: 'canceled', error_message: 'ยกเลิกโดยผู้ใช้', updated_at: new Date().toISOString() }).eq('id', bookId).in('status', ['generating', 'partial', 'failed']).select('id').maybeSingle();
    if (cancelError) throw cancelError;
    if (!canceledBook) return json({ error: 'สถานะหนังสือเปลี่ยนไปแล้ว กรุณารีเฟรชและลองใหม่' }, 409);

    // Stop queued chapter workers. A worker already inside an OpenAI request will
    // discard its result after it observes the canceled book status.
    await admin.from('ai_book_generation_jobs')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('book_id', bookId)
      .in('status', ['waiting', 'queued', 'processing', 'failed']);

    // Stop queued image workers for complete long stories and youth novels.
    await admin.from('ai_long_book_image_jobs')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('book_id', bookId)
      .in('status', ['waiting', 'queued', 'processing', 'failed']);

    await admin.from('ai_long_book_content_jobs')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('book_id', bookId)
      .in('status', ['queued', 'processing', 'failed']);

    if (!activeSeries) {
      const { data: files } = await admin.storage.from('book-images').list(bookId, { limit: 100 });
      if (files?.length) await admin.storage.from('book-images').remove(files.map((file) => `${bookId}/${file.name}`));
    }

    return json({ ok: true, bookId, quotaRestored: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('cancel-book:', message);
    return json({ error: message || 'ยกเลิกการสร้างหนังสือไม่สำเร็จ' }, 500);
  }
});
