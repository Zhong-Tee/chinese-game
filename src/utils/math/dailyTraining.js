import { createSeededRandom, generateQuestion } from './questionGenerators.js';
import { localDateKey, normalizeMathProgress } from './mathProgress.js';

const hash = (value) => [...String(value)].reduce((acc, char) => Math.imul(acc ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

export function buildDailyTraining(progress, { userId = 'guest', date = localDateKey(), count = 18 } = {}) {
  const state = normalizeMathProgress(progress);
  const rng = createSeededRandom(hash(`${userId}:${date}`));
  const unlocked = [];
  for (let stage = 1; stage <= Math.min(6, state.currentStage); stage += 1) {
    const maxLevel = stage < state.currentStage ? 4 : state.currentLevel;
    for (let level = 1; level <= maxLevel; level += 1) unlocked.push({ stage, level });
  }
  const weakStages = Object.entries(state.skills)
    .filter(([, data]) => data.attempts > 0 && data.score < 60)
    .map(([key]) => {
      if (key.startsWith('numberBond')) return 1;
      if (key.startsWith('addition')) return 2;
      if (key.startsWith('subtraction')) return 3;
      if (key.startsWith('borrowing')) return 4;
      if (key.startsWith('multiplication')) return 5;
      if (key.startsWith('division')) return 6;
      return null;
    })
    .filter(Boolean);
  const questions = [];
  const signatures = new Set();
  let guard = 0;
  while (questions.length < count && guard < count * 50) {
    guard += 1;
    const roll = rng();
    let target;
    if (roll < 0.5 && weakStages.length) {
      const availableWeakStages = weakStages.filter(value => value <= state.currentStage);
      const stage = availableWeakStages.length ? pick(rng, availableWeakStages) : null;
      const candidates = unlocked.filter(value => value.stage === stage);
      target = candidates.length ? pick(rng, candidates) : pick(rng, unlocked);
    } else if (roll < 0.8) {
      target = pick(rng, unlocked.slice(0, Math.max(1, unlocked.length - 1)));
    } else {
      target = pick(rng, unlocked);
    }
    const item = generateQuestion(target.stage, target.level, rng);
    const signature = `${item.prompt}|${item.answer}`;
    if (!signatures.has(signature)) {
      signatures.add(signature);
      questions.push(item);
    }
  }
  return questions;
}
