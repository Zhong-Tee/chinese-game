export const LEVEL_KEYS = ['1', '2', '3', '4', '5', '6', '7', 'mistakes'];

export const LEVEL_SCHEDULE_META = {
  '1': { label: 'LV1', scheduleLabel: 'ทุกวัน', color: 'orange', badgeClass: 'bg-orange-500 text-white' },
  '2': { label: 'LV2', scheduleLabel: 'ทุกวัน', color: 'orange', badgeClass: 'bg-orange-500 text-white' },
  '3': { label: 'LV3', scheduleLabel: 'รายสัปดาห์', color: 'orange', badgeClass: 'bg-orange-500 text-white' },
  '4': { label: 'LV4', scheduleLabel: 'รายสัปดาห์', color: 'blue', badgeClass: 'bg-blue-500 text-white' },
  '5': { label: 'LV5', scheduleLabel: 'รายเดือน', color: 'purple', badgeClass: 'bg-purple-500 text-white' },
  '6': { label: 'LV6', scheduleLabel: 'รายเดือน', color: 'emerald', badgeClass: 'bg-emerald-500 text-white' },
  '7': { label: 'LV7', scheduleLabel: 'ทุกวัน', color: 'orange', badgeClass: 'bg-orange-500 text-white' },
  mistakes: { label: 'คำผิด', scheduleLabel: 'ทุกวัน', color: 'red', badgeClass: 'bg-red-600 text-white' },
};

export function formatPlayDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatStatDate(dateStr) {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getDateRange(year, month) {
  const y = Number(year);
  if (month === 'all') {
    return {
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`,
    };
  }
  const m = Number(month);
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return {
    startDate: `${y}-${mm}-01`,
    endDate: `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

export const THAI_MONTHS = [
  { value: 'all', label: 'ทั้งปี' },
  { value: 1, label: 'ม.ค.' },
  { value: 2, label: 'ก.พ.' },
  { value: 3, label: 'มี.ค.' },
  { value: 4, label: 'เม.ย.' },
  { value: 5, label: 'พ.ค.' },
  { value: 6, label: 'มิ.ย.' },
  { value: 7, label: 'ก.ค.' },
  { value: 8, label: 'ส.ค.' },
  { value: 9, label: 'ก.ย.' },
  { value: 10, label: 'ต.ค.' },
  { value: 11, label: 'พ.ย.' },
  { value: 12, label: 'ธ.ค.' },
];

export const THAI_WEEKDAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

export const SCHEDULED_LEVEL_KEYS = ['3', '4', '5', '6'];

const EMPTY_SCHEDULES = { lv3: [], lv4: [], lv5: [], lv6: [] };

export function getThaiWeekdayName(date) {
  const dayIndex = date.getDay();
  return THAI_WEEKDAYS[dayIndex === 0 ? 6 : dayIndex - 1];
}

export function getScheduledLevelsForDate(dateStr, schedules = EMPTY_SCHEDULES) {
  if (!dateStr) return [];

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayName = getThaiWeekdayName(date);
  const dateNum = date.getDate();
  const matched = [];

  if (schedules.lv3?.includes(dayName)) matched.push('3');
  if (schedules.lv4?.includes(dayName)) matched.push('4');
  if (schedules.lv5?.some((d) => Number(d) === dateNum)) matched.push('5');
  if (schedules.lv6?.some((d) => Number(d) === dateNum)) matched.push('6');

  return matched;
}
