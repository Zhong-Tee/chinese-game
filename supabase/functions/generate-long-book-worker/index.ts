import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const IMAGE_MODEL = Deno.env.get('OPENAI_IMAGE_MODEL') || 'gpt-image-2.5-flare';
const PRICING_VERSION = Deno.env.get('OPENAI_PRICING_VERSION') || '2026-09-16';

type JsonObject = Record<string, any>;
type AdminClient = ReturnType<typeof createClient>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function imageCost(usage: JsonObject = {}) {
  const textInput = Number(usage.input_tokens_details?.text_tokens || usage.input_tokens || 0);
  const imageInput = Number(usage.input_tokens_details?.image_tokens || 0);
  const imageOutput = Number(usage.output_tokens || usage.output_tokens_details?.image_tokens || 0);
  return ((textInput * Number(Deno.env.get('OPENAI_IMAGE_TEXT_INPUT_USD_PER_M') || 5))
    + (imageInput * Number(Deno.env.get('OPENAI_IMAGE_INPUT_USD_PER_M') || 8))
    + (imageOutput * Number(Deno.env.get('OPENAI_IMAGE_OUTPUT_USD_PER_M') || 30))) / 1_000_000;
}

async function callImage(apiKey: string, job: JsonObject) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt: job.prompt, size: job.image_size, quality: 'medium', output_format: 'png' }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `OpenAI images/generations failed (${response.status})`);
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function logRun(admin: AdminClient, book: JsonObject, job: JsonObject, response: JsonObject, costUsd: number) {
  await admin.from('ai_generation_runs').insert({
    book_id: book.id,
    user_id: book.creator_id,
    operation: `long_book_${job.kind}_image_${job.image_index}`,
    model: IMAGE_MODEL,
    input_tokens: response?.usage?.input_tokens || 0,
    cached_input_tokens: response?.usage?.input_tokens_details?.cached_tokens || 0,
    output_tokens: response?.usage?.output_tokens || 0,
    image_input_tokens: response?.usage?.input_tokens_details?.image_tokens || 0,
    image_output_tokens: response?.usage?.output_tokens_details?.image_tokens || response?.usage?.output_tokens || 0,
    cost_usd: costUsd,
    pricing_version: PRICING_VERSION,
    raw_usage: response?.usage || {},
    status: 'success',
  });
}

async function uploadImage(admin: AdminClient, bookId: string, job: JsonObject, base64: string) {
  if (!base64) throw new Error('OpenAI did not return image data');
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const path = `${bookId}/${job.kind}-${job.image_index}-${crypto.randomUUID()}.png`;
  const { error } = await admin.storage.from('book-images').upload(path, bytes, { contentType: 'image/png', upsert: false });
  if (error) throw error;
  return admin.storage.from('book-images').getPublicUrl(path).data.publicUrl;
}

async function dispatchWorker(supabaseUrl: string, serviceKey: string, bookId: string, imageIndex: number) {
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-long-book-worker`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, imageIndex }),
      });
      if (response.ok) return;
      lastError = `Long-book image worker dispatch failed (${response.status})`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError || 'Long-book image worker dispatch failed');
}

async function queueNextOrFinish(admin: AdminClient, supabaseUrl: string, serviceKey: string, bookId: string) {
  const { data: book } = await admin.from('ai_books').select('id,status,pages').eq('id', bookId).maybeSingle();
  if (!book || book.status === 'canceled') {
    await admin.from('ai_long_book_image_jobs').update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('book_id', bookId).in('status', ['waiting', 'queued', 'processing']);
    return;
  }

  const { data: jobs, error: jobsError } = await admin.from('ai_long_book_image_jobs')
    .select('id,image_index,status').eq('book_id', bookId).order('image_index', { ascending: true });
  if (jobsError) throw jobsError;
  const total = jobs?.length || 0;
  const completed = (jobs || []).filter((item) => item.status === 'completed').length;
  const failed = (jobs || []).filter((item) => item.status === 'failed').length;
  const processed = completed + failed;
  const next = (jobs || []).find((item) => item.status === 'waiting');

  if (!next) {
    await admin.from('ai_books').update({
      status: 'ready',
      error_message: failed ? `${failed} image(s) could not be generated` : null,
      generation_progress: {
        stage: 'complete', completed_pages: Array.isArray(book.pages) ? book.pages.length : 0,
        target_pages: Array.isArray(book.pages) ? book.pages.length : 0,
        completed_images: processed, successful_images: completed, failed_images: failed, target_images: total,
        message_th: failed ? `หนังสือพร้อมอ่าน · สร้างภาพสำเร็จ ${completed}/${total}` : 'หนังสือพร้อมอ่านทั้งเล่ม',
      },
      published_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', bookId).neq('status', 'canceled');
    return;
  }

  const { data: queued } = await admin.from('ai_long_book_image_jobs')
    .update({ status: 'queued', updated_at: new Date().toISOString() })
    .eq('id', next.id).eq('status', 'waiting').select('id').maybeSingle();
  if (!queued) return;
  await admin.from('ai_books').update({
    status: 'partial', error_message: null,
    generation_progress: {
      stage: 'illustrating', completed_pages: Array.isArray(book.pages) ? book.pages.length : 0,
      target_pages: Array.isArray(book.pages) ? book.pages.length : 0,
      completed_images: processed, successful_images: completed, failed_images: failed, target_images: total,
      active_image: next.image_index + 1, message_th: `เนื้อหาพร้อมอ่าน · กำลังวาดภาพ ${processed}/${total}`,
    },
    updated_at: new Date().toISOString(),
  }).eq('id', bookId).neq('status', 'canceled');
  try {
    await dispatchWorker(supabaseUrl, serviceKey, bookId, next.image_index);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from('ai_books').update({
      status: 'partial', error_message: message.slice(0, 500),
      generation_progress: {
        stage: 'failed', completed_pages: Array.isArray(book.pages) ? book.pages.length : 0,
        target_pages: Array.isArray(book.pages) ? book.pages.length : 0,
        completed_images: processed, successful_images: completed, failed_images: failed, target_images: total,
        active_image: next.image_index + 1, message_th: `เนื้อหาพร้อมอ่าน · เริ่มสร้างภาพ ${next.image_index + 1}/${total} ไม่สำเร็จ กรุณายกเลิกแล้วสร้างใหม่`,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', bookId).neq('status', 'canceled');
  }
}

async function processImage(admin: AdminClient, apiKey: string, supabaseUrl: string, serviceKey: string, bookId: string, imageIndex: number) {
  const { data: initialJob, error: jobError } = await admin.from('ai_long_book_image_jobs')
    .select('*').eq('book_id', bookId).eq('image_index', imageIndex).maybeSingle();
  if (jobError) throw jobError;
  if (!initialJob || initialJob.status !== 'queued') return;
  const attempt = Number(initialJob.attempts || 0) + 1;
  const { data: claimed } = await admin.from('ai_long_book_image_jobs').update({
    status: 'processing', attempts: attempt, last_error: null, updated_at: new Date().toISOString(),
  }).eq('id', initialJob.id).eq('status', 'queued').select('*').maybeSingle();
  if (!claimed) return;

  try {
    const { data: book, error: bookError } = await admin.from('ai_books')
      .select('id,creator_id,status,pages,cover_url,content_image_url,content_image_page,generation_cost_usd').eq('id', bookId).maybeSingle();
    if (bookError) throw bookError;
    if (!book || book.status === 'canceled') {
      await admin.from('ai_long_book_image_jobs').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', claimed.id);
      return;
    }

    const response = await callImage(apiKey, claimed);
    const costUsd = imageCost(response.usage || {});
    await logRun(admin, book, claimed, response, costUsd);
    const imageUrl = await uploadImage(admin, bookId, claimed, response.data?.[0]?.b64_json);

    const { data: activeBook } = await admin.from('ai_books').select('status,pages,cover_url,content_image_url,generation_cost_usd').eq('id', bookId).maybeSingle();
    if (!activeBook || activeBook.status === 'canceled') {
      await admin.from('ai_long_book_image_jobs').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', claimed.id);
      return;
    }
    const update: JsonObject = {
      generation_cost_usd: Number(activeBook.generation_cost_usd || 0) + costUsd,
      generation_cost_thb: (Number(activeBook.generation_cost_usd || 0) + costUsd) * Number(Deno.env.get('USD_THB_RATE') || 34),
      exchange_rate: Number(Deno.env.get('USD_THB_RATE') || 34), updated_at: new Date().toISOString(),
    };
    if (claimed.kind === 'cover') {
      update.cover_url = imageUrl;
    } else {
      const pages = Array.isArray(activeBook.pages) ? activeBook.pages.map((page: JsonObject) => ({ ...page })) : [];
      const pageIndex = Number(claimed.page_number) - 1;
      if (pages[pageIndex]) pages[pageIndex] = { ...pages[pageIndex], image_url: imageUrl };
      update.pages = pages;
      if (!activeBook.content_image_url) {
        update.content_image_url = imageUrl;
        update.content_image_page = pageIndex;
      }
    }
    const { error: updateError } = await admin.from('ai_books').update(update).eq('id', bookId).neq('status', 'canceled');
    if (updateError) throw updateError;
    await admin.from('ai_long_book_image_jobs').update({
      status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', claimed.id);
    await queueNextOrFinish(admin, supabaseUrl, serviceKey, bookId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`generate-long-book-worker image ${imageIndex}:`, message);
    const { data: book } = await admin.from('ai_books').select('status,pages').eq('id', bookId).maybeSingle();
    if (!book || book.status === 'canceled') {
      await admin.from('ai_long_book_image_jobs').update({ status: 'canceled', last_error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', claimed.id);
      return;
    }
    if (attempt < 3) {
      await admin.from('ai_long_book_image_jobs').update({ status: 'queued', last_error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', claimed.id);
      const { data: imageJobs } = await admin.from('ai_long_book_image_jobs').select('status').eq('book_id', bookId);
      const targetImages = imageJobs?.length || 0;
      const completedImages = (imageJobs || []).filter((item) => item.status === 'completed' || item.status === 'failed').length;
      await admin.from('ai_books').update({
        status: 'partial', error_message: message.slice(0, 500),
        generation_progress: {
          stage: 'retrying_image', completed_pages: Array.isArray(book.pages) ? book.pages.length : 0,
          target_pages: Array.isArray(book.pages) ? book.pages.length : 0,
          completed_images: completedImages, target_images: targetImages,
          active_image: imageIndex + 1, message_th: `เนื้อหาพร้อมอ่าน · กำลังลองสร้างภาพ ${imageIndex + 1} ใหม่ (${attempt}/3)`,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', bookId).neq('status', 'canceled');
      try {
        await dispatchWorker(supabaseUrl, serviceKey, bookId, imageIndex);
      } catch (dispatchError) {
        console.error('image retry dispatch:', dispatchError);
        await admin.from('ai_long_book_image_jobs').update({
          status: 'failed', last_error: (dispatchError instanceof Error ? dispatchError.message : String(dispatchError)).slice(0, 500), updated_at: new Date().toISOString(),
        }).eq('id', claimed.id).eq('status', 'queued');
        await queueNextOrFinish(admin, supabaseUrl, serviceKey, bookId);
      }
      return;
    }
    await admin.from('ai_long_book_image_jobs').update({ status: 'failed', last_error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', claimed.id);
    await queueNextOrFinish(admin, supabaseUrl, serviceKey, bookId);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!supabaseUrl || !serviceKey || !apiKey) return json({ error: 'Server secrets are not configured' }, 500);
  if (request.headers.get('Authorization') !== `Bearer ${serviceKey}`) return json({ error: 'Forbidden' }, 403);
  try {
    const { bookId, imageIndex } = await request.json();
    const validBookId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(bookId || ''));
    if (!validBookId || !Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex > 10) return json({ error: 'Invalid image job' }, 400);
    const admin = createClient(supabaseUrl, serviceKey);
    const task = processImage(admin, apiKey, supabaseUrl, serviceKey, bookId, imageIndex);
    const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) { edgeRuntime.waitUntil(task); return json({ accepted: true }, 202); }
    await task;
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('generate-long-book-worker:', message);
    return json({ error: message }, 500);
  }
});
