/**
 * เก็บ/ดึง "คำที่เล่นไปแล้วในเซสชัน" ต่อเกม/โหมด
 * ใช้ Supabase เพื่อให้จำนวน Review และ Normal ตรงกันทุกเครื่อง (sync ตาม user)
 * Fallback ไป localStorage ถ้า DB ยังไม่มีตารางหรือ error
 */

import { supabase } from '../supabaseClient';

const STORAGE_KEY_PREFIX = 'playedWords_';

function getStorageKey(gameType, mode) {
  return `${STORAGE_KEY_PREFIX}${gameType}_${mode}`;
}

/**
 * ดึงรายการ flashcard_id ที่เล่นไปแล้ว (จาก DB หรือ localStorage fallback)
 * @param {string} userId - user_id
 * @param {string} gameType - 'th' | 'pinyin' | 'vol' | 'type'
 * @param {string} mode - 'normal' | 'review'
 * @returns {Promise<number[]>}
 */
export async function getPlayedIds(userId, gameType, mode) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_minigame_played')
      .select('played_ids')
      .eq('user_id', userId)
      .eq('game_type', gameType)
      .eq('mode', mode)
      .maybeSingle();

    if (error) throw error;
    if (data && Array.isArray(data.played_ids)) return data.played_ids.map(Number);
    if (data && data.played_ids) return [].concat(data.played_ids).map(Number);
    return [];
  } catch (err) {
    console.warn('minigamePlayedStorage getPlayedIds fallback to localStorage', err?.message);
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(getStorageKey(gameType, mode)) : null;
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map(Number) : [];
    } catch {
      return [];
    }
  }
}

/**
 * บันทึกรายการ flashcard_id ที่เล่นไปแล้ว (ลง DB และ localStorage เป็น fallback)
 * @param {string} userId
 * @param {string} gameType
 * @param {string} mode
 * @param {number[]} ids
 */
export async function setPlayedIds(userId, gameType, mode, ids) {
  const arr = Array.isArray(ids) ? ids.map(Number) : [];
  const key = getStorageKey(gameType, mode);
  if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(arr));

  if (!userId) return;
  try {
    await supabase.from('user_minigame_played').upsert(
      {
        user_id: userId,
        game_type: gameType,
        mode,
        played_ids: arr,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,game_type,mode' }
    );
  } catch (err) {
    console.warn('minigamePlayedStorage setPlayedIds DB failed', err?.message);
  }
}

/**
 * ล้างรายการที่เล่นไปแล้ว (reset เซสชัน)
 */
export async function clearPlayedIds(userId, gameType, mode) {
  const key = getStorageKey(gameType, mode);
  if (typeof localStorage !== 'undefined') localStorage.removeItem(key);

  if (!userId) return;
  try {
    await supabase.from('user_minigame_played').upsert(
      {
        user_id: userId,
        game_type: gameType,
        mode,
        played_ids: [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,game_type,mode' }
    );
  } catch (err) {
    console.warn('minigamePlayedStorage clearPlayedIds DB failed', err?.message);
  }
}
