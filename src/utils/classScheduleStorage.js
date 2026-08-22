import { supabase } from '../supabaseClient';

const LEGACY_PREFIX = 'class-schedule:v1';
export const WEEK_DAYS = [
  ['monday', 'จ.', 'วันจันทร์'], ['tuesday', 'อ.', 'วันอังคาร'], ['wednesday', 'พ.', 'วันพุธ'],
  ['thursday', 'พฤ.', 'วันพฤหัสบดี'], ['friday', 'ศ.', 'วันศุกร์'],
].map(([id, short, label]) => ({ id, short, label }));

export const createEmptyClassSchedule = () => Object.fromEntries(WEEK_DAYS.map(({ id }) => [id, []]));
const normalize = (data = {}) => ({
  ...data,
  ...Object.fromEntries(WEEK_DAYS.map(({ id }) => [id, Array.isArray(data[id]) ? data[id] : []])),
});

function loadLegacySchedule(userId) {
  try { return normalize(JSON.parse(localStorage.getItem(`${LEGACY_PREFIX}:${userId}`) || '{}')); }
  catch { return createEmptyClassSchedule(); }
}

const hasLessons = (schedule) => WEEK_DAYS.some(({ id }) => schedule[id]?.length > 0);

export async function loadClassSchedule(userId) {
  if (!userId) return createEmptyClassSchedule();
  const { data, error } = await supabase
    .from('user_class_schedules')
    .select('schedule')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data?.schedule) return normalize(data.schedule);

  // ย้ายข้อมูลเดิมในเครื่องขึ้น Supabase อัตโนมัติครั้งแรก
  const legacy = loadLegacySchedule(userId);
  if (hasLessons(legacy)) await saveClassSchedule(userId, legacy);
  return legacy;
}

export async function saveClassSchedule(userId, schedule) {
  if (!userId) throw new Error('ไม่พบผู้ใช้สำหรับบันทึกตารางเรียน');
  const { error } = await supabase.from('user_class_schedules').upsert({
    user_id: userId,
    schedule,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}
