import { supabase } from '../supabaseClient';

export function normalizeFlashcardLevel(level) {
  if (level === 'mistakes') return 'mistakes';
  return String(level);
}

export async function recordFlashcardWordPlayed(level) {
  const normalizedLevel = normalizeFlashcardLevel(level);
  try {
    const { error } = await supabase.rpc('upsert_flashcard_daily_stat', {
      p_level: normalizedLevel,
      p_words_delta: 1,
      p_seconds_delta: 0,
    });
    if (error) console.error('recordFlashcardWordPlayed:', error);
  } catch (err) {
    console.error('recordFlashcardWordPlayed:', err);
  }
}

export async function recordFlashcardPlaySeconds(level, secondsDelta) {
  const normalizedLevel = normalizeFlashcardLevel(level);
  const seconds = Math.max(0, Math.round(Number(secondsDelta) || 0));
  if (seconds <= 0) return;

  try {
    const { error } = await supabase.rpc('upsert_flashcard_daily_stat', {
      p_level: normalizedLevel,
      p_words_delta: 0,
      p_seconds_delta: seconds,
    });
    if (error) console.error('recordFlashcardPlaySeconds:', error);
  } catch (err) {
    console.error('recordFlashcardPlaySeconds:', err);
  }
}

export async function recordFlashcardWrongAnswer() {
  try {
    const { error } = await supabase.rpc('increment_flashcard_wrong_answer');
    if (error) console.error('recordFlashcardWrongAnswer:', error);
  } catch (err) {
    console.error('recordFlashcardWrongAnswer:', err);
  }
}

export async function fetchFlashcardStatistics(startDate, endDate, targetUserId = null) {
  const { data, error } = await supabase.rpc('get_flashcard_statistics', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_target_user_id: targetUserId,
  });

  if (error) {
    console.error('fetchFlashcardStatistics:', error);
    throw error;
  }

  return data;
}

export function createFlashcardSessionTracker() {
  let session = null;

  return {
    start(level) {
      session = {
        level: normalizeFlashcardLevel(level),
        startedAt: Date.now(),
        lastFlushAt: Date.now(),
        wordsInSession: 0,
      };
    },
    async recordWord() {
      if (!session) return;
      session.wordsInSession += 1;
      await recordFlashcardWordPlayed(session.level);
    },
    async flushElapsedTime() {
      if (!session) return;
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - session.lastFlushAt) / 1000);
      session.lastFlushAt = now;
      await recordFlashcardPlaySeconds(session.level, elapsedSeconds);
    },
    async end() {
      if (!session) return;
      await this.flushElapsedTime();
      session = null;
    },
    isActive() {
      return session !== null;
    },
    getLevel() {
      return session?.level ?? null;
    },
  };
}
