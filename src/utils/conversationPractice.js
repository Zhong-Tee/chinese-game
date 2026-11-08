import { shuffleIndices } from '../../supabase/functions/_shared/conversation.js';

export const MEMORY_ROUNDS = ['start', 'middle', 'end'];
export const ROUND_LABELS = { start: 'ต้นบท · จับคู่คำศัพท์', middle: 'กลางบท · จำความหมาย', end: 'ท้ายบท · นึกคำศัพท์จีน' };
export function memoryPending(unit, progress, round) {
  return unit.vocabulary.map((_, i) => i).filter(i => !progress?.memory?.[round]?.[i]?.correct);
}
export function practicePlan(unit, progress, mode = 'learn') {
  if (mode === 'review') return unit.questions.map((_, i) => ({ type: 'question', index: i })).filter(step => progress?.answers?.[step.index]?.correct === false);
  const replay = progress?.completed && MEMORY_ROUNDS.every(round => !memoryPending(unit, progress, round).length);
  const steps = [];
  const checkpoint = round => { if (replay || memoryPending(unit, progress, round).length) steps.push({ type: 'memory', round }); };
  checkpoint('start');
  unit.questions.forEach((_, i) => {
    if (i === Math.ceil(unit.questions.length / 2)) checkpoint('middle');
    if (replay || !progress?.answers?.[i]) steps.push({ type: 'question', index: i });
  });
  checkpoint('end');
  return steps;
}
export function retryVocabulary(queue, correct) {
  return correct ? queue.slice(1) : [...queue.slice(1), queue[0]];
}
export function moveToken(tokens, from, to) {
  if (from < 0 || to < 0 || from >= tokens.length || to >= tokens.length) return tokens;
  const next = [...tokens];
  const [token] = next.splice(from, 1);
  next.splice(to, 0, token);
  return next;
}
export function vocabularyChoices(unit, index) {
  // Distinct meanings avoid impossible questions when a book repeats synonyms.
  const seen = new Set([unit.vocabulary[index].th]);
  const others = shuffleIndices(unit.vocabulary.length).filter(i => {
    if (i === index || seen.has(unit.vocabulary[i].th)) return false;
    seen.add(unit.vocabulary[i].th); return true;
  }).slice(0, 3);
  const choices = [index, ...others];
  return shuffleIndices(choices.length).map(i => choices[i]);
}
const clean = text => String(text || '').replace(/[\p{P}\s]/gu, '');
export function pinyinLookup(course) {
  const map = new Map();
  for (const unit of course.content.units) {
    for (const item of [...unit.vocabulary, ...unit.patterns, ...unit.questions]) {
      if (item.cn && item.pinyin) map.set(clean(item.cn), item.pinyin);
      item.options?.forEach((option, i) => { if (item.option_pinyin?.[i]) map.set(clean(option), item.option_pinyin[i]); });
      item.tokens?.forEach((token, i) => { if (item.token_pinyin?.[i]) map.set(clean(token), item.token_pinyin[i]); });
      if (item.kind === 'order' && item.answer_order?.length) {
        const syllables = item.pinyin.match(/[\p{L}\p{M}]+/gu) || [];
        const counts = item.answer_order.map(i => (item.tokens[i].match(/\p{Script=Han}/gu) || []).length);
        if (counts.every(n => n > 0) && counts.reduce((a, b) => a + b, 0) === syllables.length) {
          let offset = 0;
          item.answer_order.forEach((i, at) => {
            if (!map.has(clean(item.tokens[i]))) map.set(clean(item.tokens[i]), syllables.slice(offset, offset + counts[at]).join(' '));
            offset += counts[at];
          });
        }
      }
    }
  }
  return text => map.get(clean(text)) || '';
}
