import { supabase } from '../supabaseClient';

export const DEFAULT_DAILY_MISSION_CONFIG = {
  enabled: true,
  new_words_target: 5,
  review_enabled: true,
  match_words_target: 10,
};

export const localDateKey = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export const dailyMissionErrorMessage = (error) => {
  const raw = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  if (
    raw.includes('daily_mission_config')
    || raw.includes('daily_mission_progress')
    || raw.includes('schema cache')
    || error?.code === '42703'
    || error?.code === '42P01'
    || error?.code === 'PGRST204'
    || error?.code === 'PGRST205'
  ) {
    return 'ยังไม่ได้ติดตั้งฐานข้อมูลภารกิจ กรุณารันไฟล์ sql/daily_missions.sql ใน Supabase SQL Editor แล้วรีเฟรชหน้าเว็บ';
  }
  return error?.message || 'กรุณาตรวจสอบฐานข้อมูล';
};

export async function fetchDailyMissionConfig() {
  const { data, error } = await supabase
    .from('game_settings')
    .select('daily_mission_config')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_DAILY_MISSION_CONFIG, ...(data?.daily_mission_config || {}) };
}

export async function fetchTodayMission(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('daily_mission_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('mission_date', localDateKey())
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ซ่อมความคืบหน้าจากสถานะจริง กรณี event ตอนเลื่อน Level บันทึกไม่ทัน/เครือข่ายหลุด
export async function syncTodayMissionProgress(userId) {
  let mission = await fetchTodayMission(userId);
  if (!mission) return null;
  let newWordIds = (mission.new_word_ids || []).map(Number);

  // รองรับบัญชีที่เพิ่มคำประจำวันไปก่อนติดตั้ง migration ภารกิจ:
  // ตอนนั้น last_daily_words_date ถูกบันทึกแล้ว แต่ ID คำใหม่ยังไม่ได้เก็บใน mission
  if (!newWordIds.length) {
    const { data: settings, error: settingsError } = await supabase.from('user_settings')
      .select('last_daily_words_date').eq('user_id', userId).maybeSingle();
    if (settingsError) throw settingsError;
    if (settings?.last_daily_words_date !== localDateKey()) return mission;

    const target = Math.max(1, Number(mission.config_snapshot?.new_words_target) || 5);
    const { data: recovered, error: recoveredError } = await supabase.from('user_progress')
      .select('flashcard_id, level').eq('user_id', userId)
      .gte('level', 3).order('flashcard_id', { ascending: false }).limit(target);
    if (recoveredError) throw recoveredError;
    newWordIds = (recovered || []).map((row) => Number(row.flashcard_id));
    if (!newWordIds.length) return mission;

    const { data: repaired, error: repairError } = await supabase.from('daily_mission_progress')
      .update({ new_word_ids: newWordIds, new_words_completed_ids: newWordIds })
      .eq('user_id', userId).eq('mission_date', localDateKey()).select().single();
    if (repairError) throw repairError;
    mission = repaired;
    announceMissionUpdate(mission);
  }

  const { data: progress, error: progressError } = await supabase
    .from('user_progress')
    .select('flashcard_id, level')
    .eq('user_id', userId)
    .in('flashcard_id', newWordIds);
  if (progressError) throw progressError;

  const reachedLevel3 = (progress || [])
    .filter((row) => Number(row.level) >= 3)
    .map((row) => Number(row.flashcard_id));
  const completedIds = [...new Set([
    ...(mission.new_words_completed_ids || []).map(Number),
    ...reachedLevel3,
  ])].filter((id) => newWordIds.includes(id));

  if (completedIds.length === (mission.new_words_completed_ids || []).length) return mission;
  const { data, error } = await supabase.from('daily_mission_progress')
    .update({ new_words_completed_ids: completedIds })
    .eq('user_id', userId).eq('mission_date', localDateKey()).select().single();
  if (error) throw error;
  announceMissionUpdate(data);
  return data;
}

export const getDailyMissionCompletion = (mission) => {
  if (!mission) return [false, false, false];
  return [
    (mission.new_word_ids || []).length > 0
      && (mission.new_words_completed_ids || []).length >= (mission.new_word_ids || []).length,
    (mission.review_word_ids || []).length > 0
      && (mission.review_completed_ids || []).length >= (mission.review_word_ids || []).length,
    (mission.matching_card_ids || []).length > 0
      && (mission.matching_completed_ids || []).length >= (mission.matching_card_ids || []).length,
  ];
};

const announceMissionUpdate = (mission) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('daily-mission-updated', { detail: mission }));
};

export async function initializeTodayMission(userId, newWordIds = []) {
  if (!userId) return null;
  const config = await fetchDailyMissionConfig();
  if (!config.enabled) return null;
  const today = localDateKey();
  const existing = await fetchTodayMission(userId);
  const { data: readyRows, error: readyError } = await supabase
    .from('character_words').select('flashcard_id').eq('sort_order', 2);
  if (readyError) throw readyError;
  const readyIds = [...new Set((readyRows || []).map((r) => Number(r.flashcard_id)))];
  for (let i = readyIds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [readyIds[i], readyIds[j]] = [readyIds[j], readyIds[i]];
  }
  const matchIds = readyIds.slice(0, Math.max(0, Number(config.match_words_target) || 10));
  if (existing) {
    const patch = {};
    if (newWordIds.length && !(existing.new_word_ids || []).length) patch.new_word_ids = newWordIds;
    if (!(existing.matching_card_ids || []).length && matchIds.length) patch.matching_card_ids = matchIds;
    if (!Object.keys(patch).length) return existing;
    const { data, error } = await supabase.from('daily_mission_progress')
      .update(patch).eq('user_id', userId).eq('mission_date', today).select().single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from('daily_mission_progress').insert({
    user_id: userId,
    mission_date: today,
    config_snapshot: config,
    new_word_ids: newWordIds,
    matching_card_ids: matchIds,
  }).select().single();
  if (error && error.code !== '23505') throw error;
  return data || fetchTodayMission(userId);
}

export async function startDailyReviewMission(userId, level, wordIds) {
  if (!userId || ![3, 4, 5, 6].includes(Number(level)) || !wordIds?.length) return;
  const mission = await initializeTodayMission(userId);
  if (!mission || mission.config_snapshot?.review_enabled === false || (mission.review_word_ids || []).length) return;
  await supabase.from('daily_mission_progress').update({
    review_level: Number(level), review_word_ids: wordIds.map(Number),
  }).eq('user_id', userId).eq('mission_date', localDateKey());
}

export async function recordDailyWordResult(userId, cardId, nextLevel, passed) {
  if (!userId || !passed) return;
  const mission = await fetchTodayMission(userId);
  if (!mission) return;
  const id = Number(cardId);
  const patch = {};
  if ((mission.new_word_ids || []).map(Number).includes(id) && Number(nextLevel) >= 3) {
    patch.new_words_completed_ids = [...new Set([...(mission.new_words_completed_ids || []).map(Number), id])];
  }
  if ((mission.review_word_ids || []).map(Number).includes(id)) {
    patch.review_completed_ids = [...new Set([...(mission.review_completed_ids || []).map(Number), id])];
  }
  if (Object.keys(patch).length) {
    const { data, error } = await supabase.from('daily_mission_progress').update(patch)
      .eq('user_id', userId).eq('mission_date', localDateKey()).select().single();
    if (error) throw error;
    announceMissionUpdate(data);
    return data;
  }
  return mission;
}

export async function recordDailyMatchComplete(userId, cardId) {
  const mission = await fetchTodayMission(userId);
  if (!mission || !(mission.matching_card_ids || []).map(Number).includes(Number(cardId))) return;
  const ids = [...new Set([...(mission.matching_completed_ids || []).map(Number), Number(cardId)])];
  const { data, error } = await supabase.from('daily_mission_progress').update({ matching_completed_ids: ids })
    .eq('user_id', userId).eq('mission_date', localDateKey()).select().single();
  if (error) throw error;
  announceMissionUpdate(data);
  return data;
}
