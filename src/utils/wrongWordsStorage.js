/**
 * บันทึก/ดึง "คำที่แปลผิด" (กด WRONG ในมินิเกม) — แสดงรายการใน Settings
 */

import { supabase } from '../supabaseClient';

/**
 * บันทึกคำที่แปลผิด (เมื่อกด WRONG)
 * @param {string} userId
 * @param {number} flashcardId
 * @param {string} gameType 'th' | 'pinyin' | 'vol' | 'type' | 'flashcard'
 * @param {object} cardData ข้อมูลคำศัพท์จาก flashcards
 */
export async function saveWrongWord(userId, flashcardId, gameType, cardData = {}) {
  if (!userId || flashcardId == null) return;
  const fid = Number(flashcardId);
  if (isNaN(fid)) return;
  const normalizeText = (value) => {
    if (value == null) return null;
    const text = String(value).trim();
    return text === '' ? null : text;
  };
  try {
    const { data, error } = await supabase
      .from('user_wrong_words')
      .insert({
        user_id: userId,
        flashcard_id: fid,
        game_type: gameType,
        cn: normalizeText(cardData?.cn),
        pinyin: normalizeText(cardData?.pinyin),
        vocabulary: normalizeText(cardData?.vocabulary),
        pinyin_vocab: normalizeText(cardData?.pinyin_vocab),
        th: normalizeText(cardData?.th),
        sentence_test: normalizeText(cardData?.sentence_test),
        translate: normalizeText(cardData?.translate),
      })
      .select('id')
      .maybeSingle();
    if (error) {
      console.warn('wrongWordsStorage saveWrongWord failed:', error.message, 'code:', error.code, 'details:', error.details);
      return false;
    }
    return !!data;
  } catch (err) {
    console.warn('wrongWordsStorage saveWrongWord failed', err?.message);
    return false;
  }
}

/**
 * ดึงรายการคำผิดของ user (ล่าสุดก่อน) — สำหรับแสดงใน Settings
 * @param {string} userId
 * @returns {Promise<Array<{ id: string, flashcard_id: number, game_type: string, created_at: string, cn: string | null, pinyin: string | null, vocabulary: string | null, pinyin_vocab: string | null, th: string | null, sentence_test: string | null, translate: string | null }>>
 */
export async function getWrongWords(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_wrong_words')
      .select('id, flashcard_id, game_type, created_at, cn, pinyin, vocabulary, pinyin_vocab, th, sentence_test, translate')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      flashcard_id: Number(r.flashcard_id),
      game_type: r.game_type,
      created_at: r.created_at,
      cn: r.cn ?? null,
      pinyin: r.pinyin ?? null,
      vocabulary: r.vocabulary ?? null,
      pinyin_vocab: r.pinyin_vocab ?? null,
      th: r.th ?? null,
      sentence_test: r.sentence_test ?? null,
      translate: r.translate ?? null,
    }));
  } catch (err) {
    console.warn('wrongWordsStorage getWrongWords failed', err?.message);
    return [];
  }
}

/**
 * ลบรายการคำผิดออกจากตาราง (ตาม id แถว)
 * @param {string} rowId - uuid ของแถวใน user_wrong_words
 * @returns {Promise<boolean>}
 */
export async function deleteWrongWord(rowId) {
  if (!rowId) return false;
  try {
    const { error } = await supabase
      .from('user_wrong_words')
      .delete()
      .eq('id', rowId);
    if (error) {
      console.warn('wrongWordsStorage deleteWrongWord failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('wrongWordsStorage deleteWrongWord failed', err?.message);
    return false;
  }
}
