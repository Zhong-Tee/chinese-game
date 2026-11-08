export function normalizeTopic(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('th').replace(/[\p{P}\p{Z}\s]/gu, '').trim();
}

export function validateCourse(course) {
  const fail = () => { throw new Error('ข้อมูลบทเรียนไม่สมบูรณ์ กรุณาลองสร้างใหม่'); };
  const text = value => typeof value === 'string' && value.trim().length > 0;
  if (!text(course?.title) || !text(course?.goal) || !Array.isArray(course.units) || course.units.length !== 3) fail();
  for (const unit of course.units) {
    if (!text(unit.title) || !text(unit.teaching_th) || !Array.isArray(unit.vocabulary) || unit.vocabulary.length < 4 || !Array.isArray(unit.patterns) || !unit.patterns.length) fail();
    for (const item of [...unit.vocabulary, ...unit.patterns]) {
      if (![item.cn, item.pinyin, item.th].every(text)) fail();
    }
    if (!Array.isArray(unit.questions) || unit.questions.length < 8 || unit.questions.length > 12) fail();
    for (const kind of ['choice', 'order', 'listen', 'reply']) {
      if (!unit.questions.some(q => q.kind === kind)) fail();
    }
    for (const q of unit.questions) {
      if (q.option_pinyin && (!Array.isArray(q.option_pinyin) || q.option_pinyin.length !== q.options?.length || !q.option_pinyin.every(v => typeof v === 'string'))) fail();
      if (q.token_pinyin && (!Array.isArray(q.token_pinyin) || q.token_pinyin.length !== q.tokens?.length || !q.token_pinyin.every(v => typeof v === 'string'))) fail();
      if (!['choice', 'order', 'listen', 'reply'].includes(q.kind) || ![q.prompt_th, q.cn, q.pinyin, q.th, q.explanation_th].every(text)) fail();
      if (q.kind === 'order') {
        if (!Array.isArray(q.tokens) || q.tokens.length < 2 || q.tokens.length > 10 || !q.tokens.every(text) || !Array.isArray(q.answer_order)) fail();
        if (q.answer_order.length !== q.tokens.length || new Set(q.answer_order).size !== q.tokens.length || q.answer_order.some(i => !Number.isInteger(i) || i < 0 || i >= q.tokens.length)) fail();
        const assembled = q.answer_order.map(i => q.tokens[i]).join('').replace(/[\p{P}\s]/gu, '');
        if (assembled !== q.cn.replace(/[\p{P}\s]/gu, '')) fail();
      } else {
        if (!Array.isArray(q.options) || q.options.length !== 3 || !q.options.every(text) || new Set(q.options.map(normalizeTopic)).size !== 3 || !Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 2) fail();
      }
    }
  }
  return course;
}

export function questionQueue(unit, answers = {}, review = false) {
  return unit.questions.map((_, i) => i).filter(i => review ? answers[i]?.correct === false : !answers[i]);
}

export function shuffleIndices(length, random = Math.random) {
  const values = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
