import { supabase } from '../../supabaseClient';
import { EMPTY_MATH_PROGRESS, normalizeMathProgress } from './mathProgress';

const storageKey = (userId) => `nihao_math_progress_${userId || 'guest'}`;

function loadLocal(userId) {
  try {
    return normalizeMathProgress(JSON.parse(localStorage.getItem(storageKey(userId)) || '{}'));
  } catch {
    return normalizeMathProgress(EMPTY_MATH_PROGRESS);
  }
}

function saveLocal(userId, progress) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(progress)); } catch { /* storage unavailable */ }
}

export async function loadMathProgress(userId) {
  if (!userId) return loadLocal('guest');
  const { data, error } = await supabase.from('user_math_progress').select('*').eq('user_id', userId).maybeSingle();
  if (error) return loadLocal(userId);
  if (!data) return loadLocal(userId);
  return normalizeMathProgress({
    curriculumVersion: data.curriculum_version,
    currentStage: data.current_stage,
    currentLevel: data.current_level,
    totalQuestions: data.total_questions,
    correctAnswers: data.correct_answers,
    wrongAnswers: data.wrong_answers,
    totalResponseMs: Number(data.total_response_ms || 0),
    dailyStreak: data.daily_streak,
    lastPlayedDate: data.last_played_date,
    skills: data.mastery || {},
    badges: data.badges || [],
  });
}

export async function saveMathProgress(userId, progress) {
  const normalized = normalizeMathProgress(progress);
  saveLocal(userId, normalized);
  if (!userId) return normalized;
  const { error } = await supabase.from('user_math_progress').upsert({
    user_id: userId,
    curriculum_version: normalized.curriculumVersion,
    current_stage: normalized.currentStage,
    current_level: normalized.currentLevel,
    total_questions: normalized.totalQuestions,
    correct_answers: normalized.correctAnswers,
    wrong_answers: normalized.wrongAnswers,
    total_response_ms: normalized.totalResponseMs,
    daily_streak: normalized.dailyStreak,
    last_played_date: normalized.lastPlayedDate,
    mastery: normalized.skills,
    badges: normalized.badges,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) console.warn('Nihao Math: using local progress until migration is applied.', error.message);
  return normalized;
}

export async function saveMathSession(userId, session) {
  if (!userId) return;
  const { error } = await supabase.from('math_training_sessions').insert({
    user_id: userId,
    mode: session.mode,
    stage: session.stage || null,
    level: session.level || null,
    total_questions: session.total,
    correct_answers: session.correct,
    average_response_ms: session.total ? Math.round(session.totalResponseMs / session.total) : 0,
  });
  if (error) console.warn('Nihao Math session was not synced:', error.message);
}
