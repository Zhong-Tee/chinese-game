export function didPassFlashcard(stageResults, { needsTyping = false, needsRearrange = false } = {}) {
  return stageResults?.pinyin === true
    && stageResults?.meaning === true
    && (!needsTyping || stageResults?.typing === true)
    && (!needsRearrange || stageResults?.rearrange === true);
}

export function getNextFlashcardProgress({ activeLevel, currentWrong = 0, passed }) {
  if (!passed) {
    return { level: 1, wrongCount: Math.max(0, Number(currentWrong) || 0) + 1 };
  }

  if (activeLevel === 'mistakes') {
    return { level: 1, wrongCount: 0 };
  }

  return {
    level: Math.min(Math.max(1, Number(activeLevel) || 1) + 1, 7),
    wrongCount: 0,
  };
}
