export const MATH_STAGE_META = [
  { stage: 1, title: 'ความเข้าใจจำนวน', thai: 'ฝึกแยกจำนวน 5 และ 10', icon: '🔟', color: 'from-emerald-400 to-teal-600' },
  { stage: 2, title: 'การบวก', thai: 'บวกแบบทำให้ครบหลักสิบ', icon: '➕', color: 'from-sky-400 to-blue-600' },
  { stage: 3, title: 'การลบ', thai: 'ลบแบบแยกหลักสิบ', icon: '➖', color: 'from-violet-400 to-purple-600' },
  { stage: 4, title: 'การยืม', thai: 'ลบแบบยืมหลักสิบ', icon: '🔄', color: 'from-cyan-400 to-teal-600' },
  { stage: 5, title: 'การคูณ', thai: 'เข้าใจการคูณเป็นกลุ่ม', icon: '✖️', color: 'from-amber-400 to-orange-600' },
  { stage: 6, title: 'การหาร', thai: 'แบ่งจำนวนเท่า ๆ กัน', icon: '➗', color: 'from-rose-400 to-pink-600' },
];

export const EMPTY_MATH_PROGRESS = {
  curriculumVersion: 2,
  currentStage: 1,
  currentLevel: 1,
  totalQuestions: 0,
  correctAnswers: 0,
  wrongAnswers: 0,
  totalResponseMs: 0,
  dailyStreak: 0,
  lastPlayedDate: null,
  skills: {},
  badges: [],
};

export const localDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const previousDateKey = (date = new Date()) => {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return localDateKey(previous);
};

export function normalizeMathProgress(raw = {}) {
  const sourceStage = Number(raw.currentStage) || 1;
  const sourceVersion = Number(raw.curriculumVersion) || 1;
  const migratedStage = sourceVersion < 2 && sourceStage >= 4 ? Math.min(6, sourceStage + 1) : sourceStage;
  const migratedLevel = sourceVersion < 2 && sourceStage > 5
    ? 4
    : Math.min(4, Math.max(1, Number(raw.currentLevel) || 1));
  return {
    ...EMPTY_MATH_PROGRESS,
    ...raw,
    curriculumVersion: 2,
    currentStage: Math.min(6, Math.max(1, migratedStage)),
    currentLevel: migratedLevel,
    skills: raw.skills || {},
    badges: Array.isArray(raw.badges) ? raw.badges : [],
  };
}

export function isMathLevelUnlocked(progress, stage, level, isAdmin = false) {
  if (isAdmin) return true;
  if (stage === 1 && level === 1) return true;
  const current = normalizeMathProgress(progress);
  return stage < current.currentStage || (stage === current.currentStage && level <= current.currentLevel);
}

function badgesFor(progress) {
  const badges = new Set(progress.badges || []);
  const entries = Object.entries(progress.skills || {});
  if (entries.some(([key, value]) => key.startsWith('numberBond.') && value.score >= 80)) badges.add('Make 10 Master');
  if ((progress.skills['addition.mentalAddition']?.score || 0) >= 80) badges.add('Addition Hero');
  if ((progress.skills['subtraction.break10']?.score || 0) >= 80) badges.add('Break 10 Master');
  if ((progress.skills['multiplication.array']?.score || 0) >= 80) badges.add('Multiplication Explorer');
  if ((progress.skills['division.factFamily']?.score || 0) >= 80) badges.add('Division Explorer');
  return [...badges];
}

export function recordMathAnswer(progress, question, correct, responseMs) {
  const next = normalizeMathProgress(progress);
  const today = localDateKey();
  const previousSkill = next.skills[question.skill] || { score: 0, attempts: 0, correct: 0, totalResponseMs: 0 };
  const speedBonus = correct && question.stage >= 4 && responseMs <= 10000 ? 2 : 0;
  const score = Math.min(100, Math.max(0, previousSkill.score + (correct ? 5 + speedBonus : -3)));
  next.skills = {
    ...next.skills,
    [question.skill]: {
      score,
      attempts: previousSkill.attempts + 1,
      correct: previousSkill.correct + (correct ? 1 : 0),
      totalResponseMs: previousSkill.totalResponseMs + responseMs,
    },
  };
  next.totalQuestions += 1;
  next.correctAnswers += correct ? 1 : 0;
  next.wrongAnswers += correct ? 0 : 1;
  next.totalResponseMs += responseMs;

  if (next.lastPlayedDate !== today) {
    next.dailyStreak = next.lastPlayedDate === previousDateKey() ? next.dailyStreak + 1 : 1;
    next.lastPlayedDate = today;
  }

  if (score >= 80 && previousSkill.attempts + 1 >= 15 && question.stage === next.currentStage && question.level === next.currentLevel) {
    if (next.currentLevel < 4) next.currentLevel += 1;
    else if (next.currentStage < 6) {
      next.currentStage += 1;
      next.currentLevel = 1;
    }
  }
  next.badges = badgesFor(next);
  return next;
}

export function getMathSummary(progress) {
  const value = normalizeMathProgress(progress);
  return {
    accuracy: value.totalQuestions ? Math.round((value.correctAnswers / value.totalQuestions) * 100) : 0,
    averageResponseTime: value.totalQuestions ? Math.round(value.totalResponseMs / value.totalQuestions / 100) / 10 : 0,
    mastery: Math.round(Object.values(value.skills).reduce((sum, skill) => sum + (skill.score || 0), 0) / Math.max(1, Object.keys(value.skills).length)),
  };
}
