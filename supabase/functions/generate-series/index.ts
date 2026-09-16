import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const SERIES_GENRES: Record<string, string> = {
  adventure: 'ผจญภัย', school: 'ชีวิตในโรงเรียน', friendship: 'มิตรภาพและการเติบโต', fantasy: 'แฟนตาซี',
  mystery: 'ลึกลับสืบสวน', science: 'วิทยาศาสตร์และอนาคต', youth: 'ชีวิตวัยรุ่น', 'chinese-culture': 'วัฒนธรรมจีน',
};
const LEVELS = new Set(['beginner', 'easy', 'intermediate', 'advanced']);
const MINUTES = new Set([3, 5, 8, 15]);
const MODELS = new Set(['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol']);
const BANGKOK_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || 'Unknown error');
  try { return JSON.stringify(error); } catch { return String(error); }
}

function bangkokDayStartIso(now = Date.now()) {
  const bangkokTime = new Date(now + BANGKOK_UTC_OFFSET_MS);
  bangkokTime.setUTCHours(0, 0, 0, 0);
  return new Date(bangkokTime.getTime() - BANGKOK_UTC_OFFSET_MS).toISOString();
}

async function dispatchWorker(supabaseUrl: string, serviceKey: string, seriesId: string) {
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-series-worker`, {
        method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId, episodeNumber: 1 }),
      });
      if (response.ok) return;
      lastError = `Series worker dispatch failed (${response.status})`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError || 'Series worker dispatch failed');
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
  if (authError || !user) return json({ error: 'กรุณาเข้าสู่ระบบก่อนสร้างซีรีส์' }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  let seriesId = '';
  let bookId = '';
  try {
    const body = await request.json();
    const genre = String(body.seriesGenre || '');
    const languageLevel = String(body.languageLevel || '');
    const readingMinutes = Number(body.readingMinutes);
    const textModel = String(body.textModel || 'gpt-5.6-terra');
    const topic = String(body.topic || '').slice(0, 240);
    const tone = String(body.tone || 'สนุกและอบอุ่น').slice(0, 80);
    if (!SERIES_GENRES[genre] || !LEVELS.has(languageLevel) || !MINUTES.has(readingMinutes) || !MODELS.has(textModel)) return json({ error: 'ข้อมูลสำหรับสร้างซีรีส์ไม่ถูกต้อง' }, 400);

    const dailyLimit = Number(Deno.env.get('AI_BOOKS_DAILY_LIMIT') || 5);
    const [{ count: recentCount }, { count: activeCount }] = await Promise.all([
      admin.from('ai_books').select('id', { count: 'exact', head: true }).eq('creator_id', user.id).gte('created_at', bangkokDayStartIso()).neq('status', 'canceled').or('series_id.is.null,episode_number.eq.1'),
      admin.from('ai_books').select('id', { count: 'exact', head: true }).eq('creator_id', user.id).in('status', ['generating', 'partial']),
    ]);
    if ((activeCount || 0) > 0) return json({ error: 'คุณมีหนังสือที่กำลังสร้างอยู่ กรุณารอให้เสร็จก่อน' }, 429);
    if ((recentCount || 0) >= dailyLimit) return json({ error: `สร้างหนังสือได้ไม่เกิน ${dailyLimit} ครั้งต่อวัน` }, 429);

    const { data: profile } = await admin.from('profiles').select('username, display_name, email').eq('user_id', user.id).maybeSingle();
    const creatorName = profile?.username || profile?.display_name || profile?.email?.split('@')[0] || user.email?.split('@')[0] || 'นักอ่าน Nihao';
    const { data: series, error: seriesError } = await admin.from('ai_book_series').insert({
      creator_id: user.id, creator_name: creatorName, genre, title_cn: '正在创作五集系列', title_pinyin: 'Zhèngzài chuàngzuò wǔ jí xìliè',
      title_th: 'กำลังออกแบบซีรีส์ 5 ตอน', bible: {}, total_episodes: 5, last_episode_number: 1, text_model: textModel,
      generation_status: 'generating', generation_progress: { stage: 'queued', completed_episodes: 0, target_episodes: 5, active_episode: 1, message_th: 'รับงานแล้ว · กำลังออกแบบโครงเรื่อง 5 ตอน' },
    }).select().single();
    if (seriesError) throw seriesError;
    seriesId = series.id;

    const { data: book, error: bookError } = await admin.from('ai_books').insert({
      creator_id: user.id, creator_name: creatorName, title_cn: '正在创作第一集', title_pinyin: 'Zhèngzài chuàngzuò dì yī jí', title_th: 'กำลังสร้างตอนที่ 1',
      category: 'series', language_level: languageLevel, reading_minutes: readingMinutes, tone, topic, text_model: textModel,
      book_format: 'series', series_id: series.id, episode_number: 1, series_total: 5, series_genre: genre,
      status: 'generating', visibility: 'public', generation_progress: { stage: 'queued', completed_episodes: 0, target_episodes: 5, active_episode: 1, message_th: 'กำลังรอเริ่มสร้างตอนที่ 1' },
    }).select().single();
    if (bookError) throw bookError;
    bookId = book.id;

    const jobs = Array.from({ length: 5 }, (_, index) => ({ series_id: series.id, episode_number: index + 1, status: index === 0 ? 'queued' : 'waiting' }));
    const { error: jobsError } = await admin.from('ai_series_generation_jobs').insert(jobs);
    if (jobsError) throw jobsError;
    await dispatchWorker(supabaseUrl, serviceKey, series.id);
    return json({ book, series, accepted: true }, 202);
  } catch (error) {
    const message = errorMessage(error);
    console.error('generate-series:', message);
    if (seriesId) await admin.from('ai_book_series').update({ generation_status: 'failed', error_message: message.slice(0, 500), generation_progress: { stage: 'failed', completed_episodes: 0, target_episodes: 5, active_episode: 1, message_th: 'เริ่มสร้างซีรีส์ไม่สำเร็จ' }, updated_at: new Date().toISOString() }).eq('id', seriesId);
    if (bookId) await admin.from('ai_books').update({ status: 'failed', error_message: message.slice(0, 500), generation_progress: { stage: 'failed', completed_episodes: 0, target_episodes: 5, active_episode: 1, message_th: 'เริ่มสร้างซีรีส์ไม่สำเร็จ' }, updated_at: new Date().toISOString() }).eq('id', bookId);
    return json({ error: message || 'เริ่มสร้างซีรีส์ไม่สำเร็จ' }, 500);
  }
});
