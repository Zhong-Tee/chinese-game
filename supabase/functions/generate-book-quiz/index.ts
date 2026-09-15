import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MODEL = 'gpt-5.6-luna';
const PRICING_VERSION = Deno.env.get('OPENAI_PRICING_VERSION') || '2026-09-14';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function responseOutputText(response: Record<string, any>) {
  for (const item of response.output || []) {
    for (const content of item.content || []) if (content.type === 'output_text' && content.text) return content.text;
  }
  throw new Error('OpenAI did not return quiz JSON');
}

function textCost(usage: Record<string, any> = {}) {
  const input = Number(usage.input_tokens || 0);
  const cached = Number(usage.input_tokens_details?.cached_tokens || 0);
  const output = Number(usage.output_tokens || 0);
  return (((input - cached) * 0.2) + (cached * 0.02) + (output * 1.2)) / 1_000_000;
}

function quizFromPages(pages: Record<string, any>[]) {
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    if (Array.isArray(pages[index]?.quiz_questions) && pages[index].quiz_questions.length === 3) return pages[index].quiz_questions;
  }
  return null;
}

const optionSchema = {
  type: 'object', additionalProperties: false, required: ['text_cn', 'pinyin', 'thai'],
  properties: { text_cn: { type: 'string' }, pinyin: { type: 'string' }, thai: { type: 'string' } },
};
const questionSchema = {
  type: 'object', additionalProperties: false,
  required: ['question_cn', 'pinyin', 'thai', 'options', 'correct_index', 'explanation_th'],
  properties: {
    question_cn: { type: 'string' }, pinyin: { type: 'string' }, thai: { type: 'string' },
    options: { type: 'array', minItems: 3, maxItems: 3, items: optionSchema },
    correct_index: { type: 'integer', minimum: 0, maximum: 2 }, explanation_th: { type: 'string' },
  },
};
const quizSchema = {
  type: 'object', additionalProperties: false, required: ['quiz_questions'],
  properties: { quiz_questions: { type: 'array', minItems: 3, maxItems: 3, items: questionSchema } },
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey || !openaiKey) return json({ error: 'Server secrets are not configured' }, 500);

  const authorization = request.headers.get('Authorization') || '';
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: 'กรุณาเข้าสู่ระบบก่อนทำแบบทดสอบ' }, 401);
  const admin = createClient(supabaseUrl, serviceKey);

  let bookId = '';
  let claimedPages: Record<string, any>[] = [];
  try {
    const body = await request.json();
    bookId = String(body.bookId || '');
    if (!bookId) return json({ error: 'ไม่พบรหัสหนังสือ' }, 400);

    const [{ data: book, error: bookError }, { data: profile }] = await Promise.all([
      admin.from('ai_books').select('*').eq('id', bookId).maybeSingle(),
      admin.from('profiles').select('is_admin').eq('user_id', user.id).maybeSingle(),
    ]);
    if (bookError) throw bookError;
    if (!book || book.status !== 'ready') return json({ error: 'ไม่พบหนังสือที่พร้อมอ่าน' }, 404);
    if (book.visibility !== 'public' && book.creator_id !== user.id && !profile?.is_admin) return json({ error: 'คุณไม่มีสิทธิ์เปิดหนังสือเล่มนี้' }, 403);

    const pages = Array.isArray(book.pages) ? book.pages : [];
    if (!pages.length) return json({ error: 'หนังสือเล่มนี้ไม่มีเนื้อหาสำหรับสร้างคำถาม' }, 400);
    const existingQuiz = quizFromPages(pages);
    if (existingQuiz) return json({ book, quizQuestions: existingQuiz });
    const lastPage = pages[pages.length - 1] || {};
    const generationStartedAt = Date.parse(String(lastPage.quiz_generation_started_at || ''));
    if (lastPage.quiz_generation_status === 'generating' && Number.isFinite(generationStartedAt) && Date.now() - generationStartedAt < 5 * 60 * 1000) {
      return json({ error: 'กำลังสร้างคำถามสำหรับหนังสือเล่มนี้ กรุณาลองอีกครั้งในสักครู่' }, 409);
    }

    claimedPages = pages.map((page: Record<string, any>, index: number) => index === pages.length - 1
      ? { ...page, quiz_generation_status: 'generating', quiz_generation_started_at: new Date().toISOString() }
      : page);
    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin.from('ai_books').update({ pages: claimedPages, updated_at: claimedAt }).eq('id', bookId).eq('updated_at', book.updated_at).select('id').maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return json({ error: 'กำลังสร้างคำถามสำหรับหนังสือเล่มนี้ กรุณาลองอีกครั้งในสักครู่' }, 409);

    const contentPages = pages.map((page: Record<string, any>) => ({ paragraphs: page.paragraphs || [] }));
    const prompt = `Create exactly 3 multiple-choice comprehension questions for this Chinese learner book. Questions must be grounded only in the supplied content, unambiguous, suitable for the learner level, and test understanding rather than obscure details. Each question must have exactly 3 plausible options and exactly one correct answer. Include accurate tone-marked Hanyu Pinyin and natural Thai for every question and option, plus a short Thai explanation. Book: ${JSON.stringify({ title_cn: book.title_cn, title_th: book.title_th, language_level: book.language_level, pages: contentPages })}`;
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, reasoning: { effort: 'low' }, store: false, instructions: 'You are an expert Chinese educator. Return only data matching the schema.', input: prompt, text: { format: { type: 'json_schema', name: 'book_quiz', strict: true, schema: quizSchema } } }),
    });
    const responseData = await response.json();
    if (!response.ok) throw new Error(responseData?.error?.message || `OpenAI responses failed (${response.status})`);
    const quizQuestions = JSON.parse(responseOutputText(responseData)).quiz_questions;
    const completedPages = pages.map((page: Record<string, any>, index: number) => index === pages.length - 1 ? { ...page, quiz_questions: quizQuestions } : page);
    const costUsd = textCost(responseData.usage || {});
    const exchangeRate = Number(book.exchange_rate || Deno.env.get('USD_THB_RATE') || 34);
    await admin.from('ai_generation_runs').insert({ book_id: bookId, user_id: book.creator_id, operation: 'text', model: MODEL, input_tokens: responseData.usage?.input_tokens || 0, cached_input_tokens: responseData.usage?.input_tokens_details?.cached_tokens || 0, output_tokens: responseData.usage?.output_tokens || 0, cost_usd: costUsd, pricing_version: PRICING_VERSION, raw_usage: responseData.usage || {}, status: 'success' });
    const { data: updatedBook, error: updateError } = await admin.from('ai_books').update({ pages: completedPages, generation_cost_usd: Number(book.generation_cost_usd || 0) + costUsd, generation_cost_thb: Number(book.generation_cost_thb || 0) + (costUsd * exchangeRate), updated_at: new Date().toISOString() }).eq('id', bookId).select().single();
    if (updateError) throw updateError;
    return json({ book: updatedBook, quizQuestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('generate-book-quiz:', message);
    if (bookId && claimedPages.length) {
      const failedPages = claimedPages.map((page, index) => index === claimedPages.length - 1 ? { ...page, quiz_generation_status: 'failed', quiz_generation_error: message.slice(0, 300) } : page);
      await admin.from('ai_books').update({ pages: failedPages, updated_at: new Date().toISOString() }).eq('id', bookId);
    }
    return json({ error: message }, 500);
  }
});
