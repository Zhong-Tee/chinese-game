import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const LEVELS: Record<string, string> = {
  beginner: 'HSK 1; very short sentences and core vocabulary',
  easy: 'HSK 2; accessible sentences and familiar everyday vocabulary',
  intermediate: 'HSK 3–4; varied sentences, connectors, and richer description',
  advanced: 'HSK 5–6; natural sophisticated prose and age-appropriate idioms',
};
const TEXT_PRICES: Record<string, { input: number; cached: number; output: number }> = {
  'gpt-5.6-luna': { input: 0.2, cached: 0.02, output: 1.2 },
  'gpt-5.6-terra': { input: 2, cached: 0.2, output: 12 },
  'gpt-5.6-sol': { input: 4, cached: 0.4, output: 20 },
};
const IMAGE_MODEL = Deno.env.get('OPENAI_IMAGE_MODEL') || 'gpt-image-2.5-flare';
const PRICING_VERSION = Deno.env.get('OPENAI_PRICING_VERSION') || '2026-09-15';
type AdminClient = ReturnType<typeof createClient>;
type JsonObject = Record<string, any>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function outputText(response: JsonObject) {
  for (const item of response.output || []) {
    for (const content of item.content || []) if (content.type === 'output_text' && content.text) return content.text;
  }
  throw new Error('OpenAI did not return structured chapter data');
}

async function callOpenAI(path: string, apiKey: string, body: JsonObject) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), path === 'images/generations' ? 120000 : 150000);
  try {
    const response = await fetch(`https://api.openai.com/v1/${path}`, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `OpenAI ${path} failed (${response.status})`);
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

function textCost(model: string, usage: JsonObject = {}) {
  const price = TEXT_PRICES[model] || TEXT_PRICES['gpt-5.6-terra'];
  const input = Number(usage.input_tokens || 0);
  const cached = Number(usage.input_tokens_details?.cached_tokens || 0);
  const output = Number(usage.output_tokens || 0);
  return (((input - cached) * price.input) + (cached * price.cached) + (output * price.output)) / 1_000_000;
}

function imageCost(usage: JsonObject = {}) {
  const textInput = Number(usage.input_tokens_details?.text_tokens || usage.input_tokens || 0);
  const imageInput = Number(usage.input_tokens_details?.image_tokens || 0);
  const imageOutput = Number(usage.output_tokens || usage.output_tokens_details?.image_tokens || 0);
  return ((textInput * Number(Deno.env.get('OPENAI_IMAGE_TEXT_INPUT_USD_PER_M') || 5))
    + (imageInput * Number(Deno.env.get('OPENAI_IMAGE_INPUT_USD_PER_M') || 8))
    + (imageOutput * Number(Deno.env.get('OPENAI_IMAGE_OUTPUT_USD_PER_M') || 30))) / 1_000_000;
}

async function logRun(admin: AdminClient, bookId: string, userId: string, operation: string, model: string, response: JsonObject, costUsd: number) {
  await admin.from('ai_generation_runs').insert({
    book_id: bookId, user_id: userId, operation, model,
    input_tokens: response?.usage?.input_tokens || 0,
    cached_input_tokens: response?.usage?.input_tokens_details?.cached_tokens || 0,
    output_tokens: response?.usage?.output_tokens || 0,
    image_input_tokens: response?.usage?.input_tokens_details?.image_tokens || 0,
    image_output_tokens: response?.usage?.output_tokens_details?.image_tokens || response?.usage?.output_tokens || 0,
    cost_usd: costUsd, pricing_version: PRICING_VERSION, raw_usage: response?.usage || {}, status: 'success',
  });
}

async function structuredResponse(apiKey: string, model: string, name: string, schema: JsonObject, instructions: string, input: string) {
  return callOpenAI('responses', apiKey, {
    model, reasoning: { effort: model === 'gpt-5.6-sol' ? 'medium' : 'low' }, store: false,
    instructions, input, text: { format: { type: 'json_schema', name, strict: true, schema } },
  });
}

const segmentSchema = { type: 'object', additionalProperties: false, required: ['hanzi', 'pinyin'], properties: { hanzi: { type: 'string' }, pinyin: { type: 'string' } } };
const paragraphSchema = { type: 'object', additionalProperties: false, required: ['segments', 'thai'], properties: { segments: { type: 'array', minItems: 1, items: segmentSchema }, thai: { type: 'string' } } };
const chapterSchema = {
  type: 'object', additionalProperties: false,
  required: ['chapter_number', 'heading_cn', 'heading_pinyin', 'heading_thai', 'paragraphs', 'chapter_summary_th', 'ending_hook_th', 'image_prompt'],
  properties: {
    chapter_number: { type: 'integer', minimum: 2, maximum: 8 }, heading_cn: { type: 'string' }, heading_pinyin: { type: 'string' }, heading_thai: { type: 'string' },
    paragraphs: { type: 'array', minItems: 5, maxItems: 12, items: paragraphSchema }, chapter_summary_th: { type: 'string' }, ending_hook_th: { type: 'string' }, image_prompt: { type: 'string' },
  },
};
const chapterResponseSchema = { type: 'object', additionalProperties: false, required: ['chapter'], properties: { chapter: chapterSchema } };
const scoreProperties = ['opening_hook', 'curiosity', 'character', 'conflict', 'pacing', 'dialogue', 'emotion', 'show_dont_tell', 'age_appropriate', 'ending_hook']
  .reduce((result, key) => ({ ...result, [key]: { type: 'integer', minimum: 1, maximum: 10 } }), {});
const editorialSchema = {
  type: 'object', additionalProperties: false, required: ['chapter', 'review'], properties: {
    chapter: chapterSchema,
    review: { type: 'object', additionalProperties: false, required: ['chapter_number', 'verdict', 'scores', 'notes_th'], properties: {
      chapter_number: { type: 'integer' }, verdict: { type: 'string', enum: ['PASS', 'EDIT', 'REWRITE'] },
      scores: { type: 'object', additionalProperties: false, required: Object.keys(scoreProperties), properties: scoreProperties }, notes_th: { type: 'string' },
    } },
  },
};

async function uploadImage(admin: AdminClient, bookId: string, chapterNumber: number, base64: string) {
  if (!base64) throw new Error('OpenAI did not return chapter image data');
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const path = `${bookId}/chapter-${chapterNumber}-${crypto.randomUUID()}.png`;
  const { error } = await admin.storage.from('book-images').upload(path, bytes, { contentType: 'image/png', upsert: false });
  if (error) throw error;
  return { path, url: admin.storage.from('book-images').getPublicUrl(path).data.publicUrl };
}

function pageFromChapter(chapter: JsonObject, imageUrl: string) {
  return {
    heading_cn: chapter.heading_cn, heading_pinyin: chapter.heading_pinyin, heading_thai: chapter.heading_thai,
    paragraphs: chapter.paragraphs, image_url: imageUrl, chapter_summary_th: chapter.chapter_summary_th, ending_hook_th: chapter.ending_hook_th,
  };
}

async function dispatchWorker(supabaseUrl: string, serviceKey: string, bookId: string, chapterNumber: number) {
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-youth-novel-worker`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, chapterNumber }),
      });
      if (response.ok) return;
      lastError = `Worker dispatch failed (${response.status})`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError || 'Worker dispatch failed');
}

async function queueNext(admin: AdminClient, supabaseUrl: string, serviceKey: string, bookId: string, chapterNumber: number) {
  if (chapterNumber > 8) return;
  const { error } = await admin.from('ai_book_generation_jobs').update({ status: 'queued', updated_at: new Date().toISOString() })
    .eq('book_id', bookId).eq('chapter_number', chapterNumber).in('status', ['waiting', 'queued']);
  if (error) throw error;
  await dispatchWorker(supabaseUrl, serviceKey, bookId, chapterNumber);
}

async function processChapter(admin: AdminClient, apiKey: string, supabaseUrl: string, serviceKey: string, bookId: string, chapterNumber: number) {
  const { data: initialJob } = await admin.from('ai_book_generation_jobs').select('*').eq('book_id', bookId).eq('chapter_number', chapterNumber).maybeSingle();
  if (!initialJob || initialJob.status === 'completed' || initialJob.status === 'canceled' || initialJob.status !== 'queued') return;
  const attempt = Number(initialJob.attempts || 0) + 1;
  const { data: claimedJob } = await admin.from('ai_book_generation_jobs').update({ status: 'processing', attempts: attempt, last_error: null, updated_at: new Date().toISOString() })
    .eq('id', initialJob.id).eq('status', 'queued').select('id').maybeSingle();
  if (!claimedJob) return;

  let totalUsd = 0;
  let exchangeRate = 34;
  try {
    const { data: book, error: bookError } = await admin.from('ai_books').select('*').eq('id', bookId).maybeSingle();
    if (bookError) throw bookError;
    if (!book || book.status === 'canceled') {
      await admin.from('ai_book_generation_jobs').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', initialJob.id);
      return;
    }
    const pages = Array.isArray(book.pages) ? book.pages : [];
    if (pages.length >= chapterNumber) {
      await admin.from('ai_book_generation_jobs').update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', initialJob.id);
      if (chapterNumber < 8) await queueNext(admin, supabaseUrl, serviceKey, bookId, chapterNumber + 1);
      return;
    }
    if (pages.length !== chapterNumber - 1) throw new Error(`Chapter order mismatch: ready=${pages.length}, requested=${chapterNumber}`);

    const model = String(book.text_model || 'gpt-5.6-terra');
    exchangeRate = Number(book.exchange_rate || Deno.env.get('USD_THB_RATE') || 34);
    totalUsd = Number(book.generation_cost_usd || 0);
    const addTextUsage = async (operation: string, response: JsonObject) => {
      const cost = textCost(model, response.usage || {}); totalUsd += cost; await logRun(admin, bookId, book.creator_id, operation, model, response, cost);
    };
    const protectedNames = [book.protagonist_prompt, book.companion_prompt].filter(Boolean);
    const protectedNameRule = protectedNames.length
      ? `Protected names: ${JSON.stringify(protectedNames)}. Preserve each exactly as typed. Never translate, transliterate, localize, or invent a Chinese alias. Put the exact same protected name in both hanzi and pinyin fields.`
      : '';
    const storyBible = book.story_bible || {};
    const chapterPlan = (storyBible.chapter_plan || []).find((item: JsonObject) => Number(item.chapter_number) === chapterNumber);
    if (!chapterPlan) throw new Error(`Missing chapter ${chapterNumber} plan`);
    const continuity = pages.map((page: JsonObject, index: number) => ({
      chapter_number: index + 1, heading_cn: page.heading_cn, summary_th: page.chapter_summary_th, ending_hook_th: page.ending_hook_th,
    }));

    await admin.from('ai_books').update({
      generation_progress: { stage: 'writing_chapter', completed_chapters: pages.length, target_chapters: 8, active_chapter: chapterNumber, message_th: `กำลังเขียนบทที่ ${chapterNumber}` },
      updated_at: new Date().toISOString(),
    }).eq('id', bookId).neq('status', 'canceled');

    const writeResponse = await structuredResponse(apiKey, model, `youth_novel_chapter_${chapterNumber}`, chapterResponseSchema,
      'You are an award-winning Chinese youth-novel writer and expert Thai translator. Return only schema-valid data.',
      `Write chapter ${chapterNumber} only. Story bible and visual bible: ${JSON.stringify(storyBible)}. Exact chapter plan: ${JSON.stringify(chapterPlan)}. Previous chapter continuity: ${JSON.stringify(continuity)}. Chinese level: ${LEVELS[book.language_level]}. Reader age: ${book.target_age}. ${protectedNameRule} Write polished youth fiction of approximately 450–750 Chinese characters depending on level. Use natural dialogue, show-don't-tell, accurate tone-marked Pinyin, and natural Thai translation for every paragraph. Preserve all established facts. Chapter 8 must resolve the central plot; earlier chapters end with the planned hook. The English image_prompt must repeat exact character appearance from the visual bible and contain no text, letters, logos, watermark, or copyrighted characters.`);
    await addTextUsage(`novel_write_chapter_${chapterNumber}`, writeResponse);
    let chapter = JSON.parse(outputText(writeResponse)).chapter;
    chapter.chapter_number = chapterNumber;

    const editChapter = async (round: number) => {
      await admin.from('ai_books').update({
        generation_progress: { stage: 'editing_chapter', completed_chapters: pages.length, target_chapters: 8, active_chapter: chapterNumber, message_th: `กำลังตรวจแก้บทที่ ${chapterNumber}` }, updated_at: new Date().toISOString(),
      }).eq('id', bookId).neq('status', 'canceled');
      const response = await structuredResponse(apiKey, model, `youth_novel_editor_chapter_${chapterNumber}`, editorialSchema,
        'You are an independent senior youth-fiction editor and critic. Return one revised publication-ready chapter and an honest review. Preserve schema, learner level, pinyin, Thai meaning, continuity, and protected names.',
        `Edit and score chapter ${chapterNumber}: ${JSON.stringify(chapter)}. Story bible: ${JSON.stringify(storyBible)}. Previous continuity: ${JSON.stringify(continuity)}. ${protectedNameRule} Score all ten criteria. PASS at 8.5+, EDIT at 7.5–8.4, REWRITE below 7.5. Fix weak passages directly.`);
      await addTextUsage(`novel_edit_chapter_${chapterNumber}_round_${round}`, response);
      return JSON.parse(outputText(response));
    };
    let edited = await editChapter(1);
    chapter = edited.chapter;
    chapter.chapter_number = chapterNumber;
    const hardLimitThb = Number(Deno.env.get('AI_NOVEL_HARD_LIMIT_THB') || 60);
    if (edited.review.verdict !== 'PASS' && totalUsd * exchangeRate < hardLimitThb * 0.88) {
      edited = await editChapter(2);
      chapter = edited.chapter;
      chapter.chapter_number = chapterNumber;
    }

    await admin.from('ai_books').update({
      generation_progress: { stage: 'illustrating_chapter', completed_chapters: pages.length, target_chapters: 8, active_chapter: chapterNumber, message_th: `กำลังวาดภาพบทที่ ${chapterNumber}` }, updated_at: new Date().toISOString(),
    }).eq('id', bookId).neq('status', 'canceled');
    const imageResponse = await callOpenAI('images/generations', apiKey, {
      model: IMAGE_MODEL, prompt: `${chapter.image_prompt}. ${storyBible.visual_bible || ''}. Premium youth-novel interior illustration, consistent recurring characters, no text, no letters, no logo, no watermark.`,
      size: '1536x1024', quality: 'medium', output_format: 'png',
    });
    const imageRunCost = imageCost(imageResponse.usage || {});
    totalUsd += imageRunCost;
    await logRun(admin, bookId, book.creator_id, `novel_chapter_${chapterNumber}_image`, IMAGE_MODEL, imageResponse, imageRunCost);
    const uploadedImage = await uploadImage(admin, bookId, chapterNumber, imageResponse.data?.[0]?.b64_json);

    const { data: activeBook } = await admin.from('ai_books').select('status, pages, editorial_scores').eq('id', bookId).maybeSingle();
    if (!activeBook || activeBook.status === 'canceled') {
      await admin.storage.from('book-images').remove([uploadedImage.path]);
      await admin.from('ai_book_generation_jobs').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', initialJob.id);
      return;
    }
    const currentPages = Array.isArray(activeBook.pages) ? activeBook.pages : [];
    if (currentPages.length === chapterNumber - 1) currentPages.push(pageFromChapter(chapter, uploadedImage.url));
    const reviews = (Array.isArray(activeBook.editorial_scores) ? activeBook.editorial_scores : []).filter((item: JsonObject) => Number(item.chapter_number) !== chapterNumber);
    reviews.push(edited.review);
    reviews.sort((a: JsonObject, b: JsonObject) => Number(a.chapter_number) - Number(b.chapter_number));
    const complete = chapterNumber === 8;
    const { error: updateError } = await admin.from('ai_books').update({
      pages: currentPages, editorial_scores: reviews, status: complete ? 'ready' : 'partial', error_message: null,
      generation_cost_usd: totalUsd, generation_cost_thb: totalUsd * exchangeRate, exchange_rate: exchangeRate,
      generation_progress: complete
        ? { stage: 'complete', completed_chapters: 8, target_chapters: 8, message_th: 'นิยายพร้อมอ่านทั้งเล่ม' }
        : { stage: 'chapter_ready', completed_chapters: chapterNumber, target_chapters: 8, active_chapter: chapterNumber + 1, message_th: `บทที่ ${chapterNumber} พร้อมอ่าน กำลังเตรียมบทที่ ${chapterNumber + 1}` },
      published_at: complete ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
    }).eq('id', bookId).neq('status', 'canceled');
    if (updateError) throw updateError;
    await admin.from('ai_book_generation_jobs').update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', initialJob.id);
    if (!complete) await queueNext(admin, supabaseUrl, serviceKey, bookId, chapterNumber + 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`generate-youth-novel-worker chapter ${chapterNumber}:`, message);
    const { data: book } = await admin.from('ai_books').select('status, pages').eq('id', bookId).maybeSingle();
    if (!book || book.status === 'canceled') {
      await admin.from('ai_book_generation_jobs').update({ status: 'canceled', last_error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', initialJob.id);
      return;
    }
    const completed = Array.isArray(book.pages) ? book.pages.length : Math.max(1, chapterNumber - 1);
    if (attempt < 3) {
      await admin.from('ai_book_generation_jobs').update({ status: 'queued', last_error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', initialJob.id);
      await admin.from('ai_books').update({
        generation_cost_usd: totalUsd, generation_cost_thb: totalUsd * exchangeRate,
        generation_progress: { stage: 'retrying_chapter', completed_chapters: completed, target_chapters: 8, active_chapter: chapterNumber, message_th: `กำลังลองสร้างบทที่ ${chapterNumber} ใหม่ (${attempt}/3)` },
        updated_at: new Date().toISOString(),
      }).eq('id', bookId).neq('status', 'canceled');
      try { await dispatchWorker(supabaseUrl, serviceKey, bookId, chapterNumber); } catch (dispatchError) { console.error('retry dispatch:', dispatchError); }
      return;
    }
    await admin.from('ai_book_generation_jobs').update({ status: 'failed', last_error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', initialJob.id);
    await admin.from('ai_books').update({
      status: 'partial', error_message: message.slice(0, 500), generation_cost_usd: totalUsd, generation_cost_thb: totalUsd * exchangeRate,
      generation_progress: { stage: 'failed', completed_chapters: completed, target_chapters: 8, active_chapter: chapterNumber, message_th: `บทที่ ${completed} พร้อมอ่าน · สร้างบทที่ ${chapterNumber} ไม่สำเร็จ` },
      updated_at: new Date().toISOString(),
    }).eq('id', bookId).neq('status', 'canceled');
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
    const { bookId, chapterNumber } = await request.json();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(bookId || '')) || !Number.isInteger(chapterNumber) || chapterNumber < 2 || chapterNumber > 8) {
      return json({ error: 'Invalid chapter job' }, 400);
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const task = processChapter(admin, apiKey, supabaseUrl, serviceKey, bookId, chapterNumber);
    const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(task);
      return json({ accepted: true, bookId, chapterNumber }, 202);
    }
    await task;
    return json({ accepted: true, bookId, chapterNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('generate-youth-novel-worker:', message);
    return json({ error: message || 'Unable to start chapter worker' }, 500);
  }
});
