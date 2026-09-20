import { supabase } from '../supabaseClient';

export const DEFAULT_DAILY_MISSION_CONFIG = {
  enabled: true,
  new_words_target: 5,
  review_enabled: true,
  review_mode: 'all',
  review_words_target: 20,
  match_words_target: 10,
};

export const localDateKey = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const PAGE_SIZE = 1000;

// Supabase คืนค่าสูงสุด 1000 แถว/คำขอ ถ้าไม่วนอ่านจะได้ข้อมูลไม่ครบ
// แล้วสรุปสถานะผิด (เช่น นึกว่าไม่มีคำค้าง LV1/LV2 ทั้งที่มี)
async function fetchAllRows(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

const isMissingDailyWordIdsColumn = (error) => {
  if (!error) return false;
  const raw = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return raw.includes('last_daily_word_ids')
    && ['42703', 'PGRST204', 'PGRST205'].includes(error.code || '');
};

// บันทึก/อ่าน "คำใหม่ที่แจกไปแล้ววันนี้" คู่กับวันที่แบบ atomic
// เพื่อให้ซ่อมภารกิจได้จาก ID จริง ไม่ต้องเดาจาก Level ของคำเก่า
export async function fetchDailyWordsStamp(userId) {
  if (!userId) return { date: null, ids: [] };
  const { data, error } = await supabase.from('user_settings')
    .select('last_daily_words_date, last_daily_word_ids').eq('user_id', userId).maybeSingle();
  if (!error) {
    return {
      date: data?.last_daily_words_date || null,
      ids: (data?.last_daily_word_ids || []).map(Number).filter(Number.isFinite),
    };
  }
  if (!isMissingDailyWordIdsColumn(error)) throw error;

  // ยังไม่ได้รัน sql/daily_words_ids_column.sql → ใช้ได้เฉพาะวันที่ (ซ่อมภารกิจไม่ได้)
  const { data: legacy, error: legacyError } = await supabase.from('user_settings')
    .select('last_daily_words_date').eq('user_id', userId).maybeSingle();
  if (legacyError) throw legacyError;
  return { date: legacy?.last_daily_words_date || null, ids: [] };
}

export async function saveDailyWordsStamp(userId, date, wordIds = []) {
  const ids = wordIds.map(Number).filter(Number.isFinite);
  const { error } = await supabase.from('user_settings')
    .upsert({ user_id: userId, last_daily_words_date: date, last_daily_word_ids: ids }, { onConflict: 'user_id' });
  if (!error) return true;
  if (!isMissingDailyWordIdsColumn(error)) throw error;

  const { error: legacyError } = await supabase.from('user_settings')
    .upsert({ user_id: userId, last_daily_words_date: date }, { onConflict: 'user_id' });
  if (legacyError) throw legacyError;
  return false;
}

export const dailyMissionErrorMessage = (error) => {
  const raw = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  if (error?.code === '42501' || raw.includes('row-level security')) {
    return 'ไม่มีสิทธิ์บันทึกภารกิจรายวัน กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่ หากยังพบปัญหาให้รันไฟล์ sql/daily_missions_rls_hotfix.sql ใน Supabase SQL Editor';
  }
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

async function syncExtraMissionProgress(userId, mission) {
  if (!mission) return mission;
  const { count, error: mistakesError } = await supabase.from('user_progress')
    .select('flashcard_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('wrong_count', 3);
  if (mistakesError) throw mistakesError;

  const remaining = Number(count || 0);
  const required = mission.mistakes_required || remaining > 0;
  const completed = required && remaining === 0;
  if (
    required === !!mission.mistakes_required
    && remaining === Number(mission.mistakes_remaining || 0)
    && completed === !!mission.mistakes_completed
  ) return mission;

  const { data, error } = await supabase.from('daily_mission_progress')
    .update({ mistakes_required: required, mistakes_remaining: remaining, mistakes_completed: completed })
    .eq('user_id', userId).eq('mission_date', localDateKey()).select().single();
  if (error) throw error;
  announceMissionUpdate(data);
  return data;
}

async function syncReviewMissionProgress(userId, mission) {
  const reviewIds = (mission?.review_word_ids || []).map(Number);
  const reviewLevel = Number(mission?.review_level);
  if (!reviewIds.length || ![3, 4, 5, 6].includes(reviewLevel)) return syncExtraMissionProgress(userId, mission);

  const { data: rows, error: progressError } = await supabase.from('user_progress')
    .select('flashcard_id, level')
    .eq('user_id', userId)
    .in('flashcard_id', reviewIds);
  if (progressError) throw progressError;

  // กติกาทบทวน: นับเฉพาะคำที่ผ่านและเลื่อนไป Level ถัดไป
  const playedIds = (rows || [])
    .filter((row) => Number(row.level) > reviewLevel)
    .map((row) => Number(row.flashcard_id));
  const completedIds = [...new Set([
    ...(mission.review_completed_ids || []).map(Number),
    ...playedIds,
  ])].filter((id) => reviewIds.includes(id));
  const previousIds = (mission.review_completed_ids || []).map(Number);
  const unchanged = completedIds.length === previousIds.length
    && completedIds.every((id) => previousIds.includes(id));
  if (unchanged) return syncExtraMissionProgress(userId, mission);

  const { data, error } = await supabase.from('daily_mission_progress')
    .update({ review_completed_ids: completedIds })
    .eq('user_id', userId).eq('mission_date', localDateKey()).select().single();
  if (error) throw error;
  announceMissionUpdate(data);
  return syncExtraMissionProgress(userId, data);
}

// ซ่อมความคืบหน้าจากสถานะจริง กรณี event ตอนเลื่อน Level บันทึกไม่ทัน/เครือข่ายหลุด
export async function syncTodayMissionProgress(userId) {
  let mission = await fetchTodayMission(userId);
  // การสร้างภารกิจเดิมเกิดแบบ background จึงมีโอกาสที่ผู้เล่นเริ่มเล่นแล้ว
  // แต่ยังไม่มีแถวของวันนี้ ให้สร้างและซ่อมจากสถานะจริงแทนการแสดง 0 ดาวถาวร
  if (!mission) mission = await initializeTodayMission(userId);
  if (!mission) return null;
  let newWordIds = (mission.new_word_ids || []).map(Number);

  // ซ่อมกรณีแจกคำใหม่สำเร็จแต่บันทึก ID ลงภารกิจไม่ทัน (เครือข่ายหลุด/สร้างแถวชนกัน)
  // ใช้ ID ที่แจกจริงจาก user_settings เท่านั้น และเติมแค่รายการเป้าหมาย
  // ห้ามติ๊กว่าผ่าน — ดาวต้องมาจาก Level จริงของคำเสมอ
  if (!newWordIds.length) {
    const stamp = await fetchDailyWordsStamp(userId);
    if (stamp.date !== localDateKey() || !stamp.ids.length) return syncReviewMissionProgress(userId, mission);

    const { data: repaired, error: repairError } = await supabase.from('daily_mission_progress')
      .update({ new_word_ids: stamp.ids })
      .eq('user_id', userId).eq('mission_date', localDateKey()).select().single();
    if (repairError) throw repairError;
    mission = repaired;
    newWordIds = stamp.ids;
    announceMissionUpdate(mission);
  }

  const { data: progress, error: progressError } = await supabase
    .from('user_progress')
    .select('flashcard_id, level')
    .eq('user_id', userId)
    .in('flashcard_id', newWordIds);
  if (progressError) throw progressError;

  // นับเฉพาะคำที่ขึ้นถึง LV3 จริงเท่านั้น ห้ามเดาจากสถานะรวมของบัญชี
  const reachedLevel3 = (progress || [])
    .filter((row) => Number(row.level) >= 3)
    .map((row) => Number(row.flashcard_id));

  const completedIds = [...new Set([
    ...(mission.new_words_completed_ids || []).map(Number),
    ...reachedLevel3,
  ])].filter((id) => newWordIds.includes(id));

  const previousCompletedIds = (mission.new_words_completed_ids || []).map(Number);
  const completionUnchanged = completedIds.length === previousCompletedIds.length
    && completedIds.every((id) => previousCompletedIds.includes(id));
  if (completionUnchanged) return syncReviewMissionProgress(userId, mission);
  const { data, error } = await supabase.from('daily_mission_progress')
    .update({ new_words_completed_ids: completedIds })
    .eq('user_id', userId).eq('mission_date', localDateKey()).select().single();
  if (error) throw error;
  announceMissionUpdate(data);
  return syncReviewMissionProgress(userId, data);
}

export const getDailyMissionCompletion = (mission) => {
  if (!mission) return [false, false, false, false, false];
  const reviewTotal = mission.config_snapshot?.review_mode === 'count'
    ? Math.min(
      (mission.review_word_ids || []).length,
      Math.max(1, Number(mission.config_snapshot?.review_words_target) || 20),
    )
    : (mission.review_word_ids || []).length;
  return [
    (mission.new_word_ids || []).length > 0
      && (mission.new_words_completed_ids || []).length >= (mission.new_word_ids || []).length,
    (mission.review_word_ids || []).length > 0
      && (mission.review_completed_ids || []).length >= reviewTotal,
    (mission.matching_card_ids || []).length > 0
      && (mission.matching_completed_ids || []).length >= (mission.matching_card_ids || []).length,
    !!mission.mistakes_required && !!mission.mistakes_completed,
    (mission.books_read_ids || []).length > 0,
  ];
};

const announceMissionUpdate = (mission) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('daily-mission-updated', { detail: mission }));
};

export async function initializeTodayMission(userId, newWordIds = [], retryOnConflict = true) {
  if (!userId) return null;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error('เซสชันหมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่');
  }
  if (authData.user.id !== userId) {
    throw new Error('บัญชีผู้ใช้ในแอปไม่ตรงกับเซสชัน กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่');
  }
  const config = await fetchDailyMissionConfig();
  if (!config.enabled) return null;
  const today = localDateKey();
  const existing = await fetchTodayMission(userId);
  const readyRows = await fetchAllRows(() => supabase
    .from('character_words').select('flashcard_id').eq('sort_order', 2)
    .order('flashcard_id', { ascending: true }));
  const learnedRows = await fetchAllRows(() => supabase
    .from('user_progress').select('flashcard_id').eq('user_id', userId)
    .order('flashcard_id', { ascending: true }));

  const learnedIds = new Set((learnedRows || []).map((row) => Number(row.flashcard_id)));
  const readyIds = [...new Set((readyRows || [])
    .map((row) => Number(row.flashcard_id))
    .filter((id) => learnedIds.has(id)))];
  const readySet = new Set(readyIds);
  const missionNewWordIds = [...new Set([
    ...(existing?.new_word_ids || []).map(Number),
    ...newWordIds.map(Number),
  ])].filter(Number.isFinite);
  // เกมจับคู่ใช้คำใหม่ชุดเดียวกับภารกิจดาวดวงแรก เพื่อให้ผู้เรียน
  // ทบทวนคำที่เพิ่งได้รับในวันนั้น ไม่ดึงคำที่ยังไม่เคยเรียนจากคลังทั้งหมด
  const matchingCandidates = missionNewWordIds
    .filter((id) => learnedIds.has(id) && readySet.has(id));
  if (existing) {
    const patch = {};
    if (newWordIds.length && !(existing.new_word_ids || []).length) patch.new_word_ids = newWordIds;
    const matchTarget = Math.max(0, Number(existing.config_snapshot?.match_words_target) || 10);
    const repairedMatchIds = matchingCandidates.slice(0, matchTarget);
    const existingMatchIds = (existing.matching_card_ids || []).map(Number);
    // ยังไม่รู้ชุดคำใหม่ของวันนี้ (ถูกเรียกแบบไม่ส่ง ID) → ห้ามล้างเกมจับคู่ที่สร้างไว้แล้ว
    const matchingSetChanged = missionNewWordIds.length > 0
      && (repairedMatchIds.length !== existingMatchIds.length
        || repairedMatchIds.some((id) => !existingMatchIds.includes(id)));
    if (matchingSetChanged) {
      patch.matching_card_ids = repairedMatchIds;
      const repairedSet = new Set(repairedMatchIds);
      patch.matching_completed_ids = (existing.matching_completed_ids || [])
        .map(Number)
        .filter((id) => repairedSet.has(id));
    }
    if (!Object.keys(patch).length) return existing;
    const { data, error } = await supabase.from('daily_mission_progress')
      .update(patch).eq('user_id', userId).eq('mission_date', today).select().single();
    if (error) throw error;
    return data;
  }

  const matchIds = matchingCandidates.slice(0, Math.max(0, Number(config.match_words_target) || 10));
  const { data, error } = await supabase.from('daily_mission_progress').insert({
    user_id: userId,
    mission_date: today,
    config_snapshot: config,
    new_word_ids: newWordIds,
    matching_card_ids: matchIds,
  }).select().single();
  if (!error) return data;
  if (error.code !== '23505') throw error;

  // มีคนสร้างแถวของวันนี้ชนกันพอดี (เช่น Dashboard ซิงก์พร้อมกัน)
  // ต้องเขียน ID คำใหม่ลงแถวที่มีอยู่ต่อ ไม่อย่างนั้นภารกิจจะว่างทั้งวัน
  if (!retryOnConflict) return fetchTodayMission(userId);
  return initializeTodayMission(userId, newWordIds, false);
}

export async function startDailyReviewMission(userId, level, wordIds) {
  if (!userId || ![3, 4, 5, 6].includes(Number(level)) || !wordIds?.length) return;
  const mission = await initializeTodayMission(userId);
  if (!mission || mission.config_snapshot?.review_enabled === false) return mission;
  if ((mission.review_word_ids || []).length) {
    // ย้ายข้อมูลจาก Logic เดิมที่สุ่มล็อกเฉพาะจำนวนเป้าหมาย:
    // โหมดจำนวนคำใหม่เปิดให้คำใดก็ได้ใน Level นี้นับเป็นความคืบหน้า
    if (mission.config_snapshot?.review_mode === 'count'
      && Number(mission.review_level) === Number(level)) {
      const expandedIds = [...new Set([
        ...(mission.review_word_ids || []).map(Number),
        ...wordIds.map(Number),
      ])].filter(Number.isFinite);
      if (expandedIds.length !== (mission.review_word_ids || []).length) {
        const { data, error } = await supabase.from('daily_mission_progress')
          .update({ review_word_ids: expandedIds })
          .eq('user_id', userId).eq('mission_date', localDateKey()).select().single();
        if (error) throw error;
        announceMissionUpdate(data);
        return data;
      }
    }
    return mission;
  }
  const reviewIds = [...new Set(wordIds.map(Number).filter(Number.isFinite))];
  const { data, error } = await supabase.from('daily_mission_progress').update({
    review_level: Number(level), review_word_ids: reviewIds,
  }).eq('user_id', userId).eq('mission_date', localDateKey()).select().single();
  if (error) throw error;
  announceMissionUpdate(data);
  return data;
}

export async function recordDailyWordResult(userId, cardId, nextLevel, passed) {
  if (!userId) return;
  const mission = await fetchTodayMission(userId);
  if (!mission) return;
  const id = Number(cardId);
  const patch = {};
  if (passed && (mission.new_word_ids || []).map(Number).includes(id) && Number(nextLevel) >= 3) {
    patch.new_words_completed_ids = [...new Set([...(mission.new_words_completed_ids || []).map(Number), id])];
  }
  // ภารกิจทบทวนนับเมื่อผ่านจนคำเลื่อนไป Level ถัดไปเท่านั้น
  if (passed && (mission.review_word_ids || []).map(Number).includes(id)) {
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
  if (!mission) return;
  const id = Number(cardId);
  const patch = {
    matching_passed_ids: [...new Set([...(mission.matching_passed_ids || []).map(Number), id])],
  };
  if ((mission.matching_card_ids || []).map(Number).includes(id)) {
    patch.matching_completed_ids = [...new Set([...(mission.matching_completed_ids || []).map(Number), id])];
  }
  const { data, error } = await supabase.from('daily_mission_progress').update(patch)
    .eq('user_id', userId).eq('mission_date', localDateKey()).select().single();
  if (error) throw error;
  announceMissionUpdate(data);
  return data;
}

export async function recordDailyBookRead(userId, bookId) {
  if (!userId || !bookId) return null;
  const mission = await initializeTodayMission(userId);
  if (!mission) return null;
  const bookIds = [...new Set([...(mission.books_read_ids || []).map(String), String(bookId)])];
  const { data, error } = await supabase.from('daily_mission_progress')
    .update({ books_read_ids: bookIds })
    .eq('user_id', userId).eq('mission_date', localDateKey()).select().single();
  if (error) throw error;
  announceMissionUpdate(data);
  return data;
}
