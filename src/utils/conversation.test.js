import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTopic, validateCourse, questionQueue, shuffleIndices } from '../../supabase/functions/_shared/conversation.js';
import { conversationCost, formatConversationCost } from '../../supabase/functions/_shared/conversation-cost.js';
import { conversationErrorMessage } from './conversationErrors.js';
import { practicePlan, memoryPending, retryVocabulary, moveToken, pinyinLookup, vocabularyChoices } from './conversationPractice.js';

const phrase = { cn: '茶', pinyin: 'chá', th: 'ชา' };
function fixture() {
  const base = { prompt_th: 'เลือกคำแปล', cn: '我想喝茶。', pinyin: 'Wǒ xiǎng hē chá.', th: 'ฉันอยากดื่มชา', explanation_th: '想 วางหน้ากริยา', options: ['ชา', 'น้ำ', 'กาแฟ'], correct_index: 0, tokens: [], answer_order: [] };
  return { title: 'สั่งเครื่องดื่ม', goal: 'สั่งชาได้', units: Array.from({ length: 3 }, () => ({ title: 'เลือกเครื่องดื่ม', teaching_th: 'ฝึกพูดสั่งชา', vocabulary: Array.from({ length: 4 }, () => ({ ...phrase })), patterns: [{ ...phrase }], questions: Array.from({ length: 8 }, (_, i) => i % 4 === 1
    ? { ...base, kind: 'order', options: [], tokens: ['喝茶', '我', '想'], answer_order: [1, 2, 0] }
    : { ...base, kind: ['choice', 'order', 'listen', 'reply'][i % 4] }) })) };
}

test('normalization merges punctuation, fullwidth, spaces and casing without stripping tone marks', () => {
  assert.equal(normalizeTopic('  สั่ง ชานม！ '), normalizeTopic('สั่งชานม'));
  assert.equal(normalizeTopic('ＴＥＡ'), normalizeTopic('tea'));
  assert.notEqual(normalizeTopic('mā'), normalizeTopic('má'));
});
test('validates a course and rejects ambiguous or broken generated structures', () => {
  assert.equal(validateCourse(fixture()).units.length, 3);
  const brokenCases = [
    c => { c.units.pop(); },
    c => { c.units[0].questions[0].correct_index = 3; },
    c => { c.units[0].questions[0].options = ['ชา', ' ชา ', 'น้ำ']; },
    c => { c.units[0].questions[1].answer_order = [1, 1, 0]; },
    c => { c.units[0].questions[1].answer_order = [0, 1, 2]; },
    c => { c.units[0].questions[1].answer_order = [1, 2]; },
    c => { c.units[0].questions = c.units[0].questions.filter(q => q.kind !== 'listen'); },
    c => { c.units[0].patterns[0].pinyin = ''; },
  ];
  for (const mutate of brokenCases) {
    const course = fixture(); mutate(course);
    assert.throws(() => validateCourse(course));
  }
});
test('resume skips answered questions while review selects only current mistakes', () => {
  const unit = fixture().units[0];
  const answers = { 0: { correct: true }, 2: { correct: false }, 7: { correct: true } };
  assert.deepEqual(questionQueue(unit, answers), [1, 3, 4, 5, 6]);
  assert.deepEqual(questionQueue(unit, answers, true), [2]);
  assert.deepEqual(questionQueue(unit, { ...answers, 2: { correct: true } }, true), []);
});
test('shuffle preserves identity of repeated tokens without losing any index', () => {
  const order = shuffleIndices(8, () => 0.25);
  assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.notDeepEqual(order, [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('cost separates cached input, preserves small charges and supports configured rates', () => {
  const usage = { input_tokens: 1000, input_tokens_details: { cached_tokens: 400 }, output_tokens: 200 };
  const result = conversationCost('gpt-5.6-luna', usage);
  assert.ok(Math.abs(result.cost_usd - 0.000368) < 1e-12);
  assert.ok(Math.abs(result.cost_thb - 0.012512) < 1e-12);
  const custom = conversationCost('custom', usage, { CONVERSATION_INPUT_USD_PER_M: '2', CONVERSATION_CACHED_INPUT_USD_PER_M: '1', CONVERSATION_OUTPUT_USD_PER_M: '3', USD_THB_RATE: '35' });
  assert.equal(custom.cost_usd, 0.0022);
  assert.equal(custom.cost_thb, 0.077);
  assert.equal(formatConversationCost(0.000001), '< ฿0.0001');
  assert.equal(formatConversationCost(null), 'ยังไม่มีข้อมูลราคา');
  assert.notEqual(formatConversationCost(0), 'ยังไม่มีข้อมูลราคา');
});

test('unknown models, incomplete pricing and missing or invalid usage never become a false zero', () => {
  const usage = { input_tokens: 100, output_tokens: 20 };
  assert.equal(conversationCost('unknown', usage).cost_usd, null);
  assert.equal(conversationCost('gpt-5.6-luna', undefined).cost_usd, null);
  assert.equal(conversationCost('gpt-5.6-luna', usage, { CONVERSATION_INPUT_USD_PER_M: '2' }).cost_usd, null);
  assert.equal(conversationCost('gpt-5.6-luna', usage, { USD_THB_RATE: '-1' }).cost_thb, null);
  assert.equal(conversationCost('gpt-5.6-luna', { ...usage, input_tokens_details: { cached_tokens: 101 } }).cost_usd, null);
});

test('creation errors distinguish missing deployment, authentication, backend and connection problems', async () => {
  assert.match(await conversationErrorMessage({ context: new Response('{}', { status: 404 }) }), /generate-conversation/);
  assert.match(await conversationErrorMessage({ context: new Response('{}', { status: 401 }) }), /เข้าสู่ระบบ/);
  assert.equal(await conversationErrorMessage({ context: new Response(JSON.stringify({ error: 'ยังไม่ได้ตั้งค่าบริการสร้างบทเรียน' }), { status: 503 }) }), 'ยังไม่ได้ตั้งค่าบริการสร้างบทเรียน');
  assert.match(await conversationErrorMessage({ context: new Response('bad gateway', { status: 502 }) }), /ขัดข้องชั่วคราว/);
  assert.match(await conversationErrorMessage(new Error('Failed to fetch')), /อินเทอร์เน็ต/);
});

test('practice inserts three memory checkpoints and resumes only unfinished work', () => {
  const unit = fixture().units[0];
  const plan = practicePlan(unit);
  assert.deepEqual(plan.filter(s => s.type === 'memory').map(s => s.round), ['start', 'middle', 'end']);
  assert.equal(plan[0].round, 'start');
  assert.equal(plan[5].round, 'middle');
  assert.equal(plan.at(-1).round, 'end');
  const progress = { answers: { 0: { correct: false }, 1: { correct: true } }, memory: { start: Object.fromEntries(unit.vocabulary.map((_, i) => [i, { correct: true }])) } };
  const resumed = practicePlan(unit, progress);
  assert.equal(resumed.some(s => s.round === 'start'), false);
  assert.equal(resumed.find(s => s.type === 'question').index, 2);
  assert.deepEqual(practicePlan(unit, progress, 'review'), [{ type: 'question', index: 0 }]);
  assert.deepEqual(memoryPending(unit, { memory: { middle: { 0: { correct: true }, 1: { correct: false } } } }, 'middle'), [1, 2, 3]);
});
test('wrong vocabulary returns after other words and drag preserves every token', () => {
  assert.deepEqual(retryVocabulary([1, 2, 3], false), [2, 3, 1]);
  assert.deepEqual(retryVocabulary([1], false), [1]);
  assert.deepEqual(retryVocabulary([1], true), []);
  assert.deepEqual(moveToken([4, 2, 7], 0, 2), [2, 7, 4]);
  assert.deepEqual(moveToken([4, 2, 7], 2, 0), [7, 4, 2]);
  assert.deepEqual(moveToken([4, 2, 7], 0, -1), [4, 2, 7]);
});
test('pinyin uses saved pronunciation and derives order tokens in answer order', () => {
  const course = { content: fixture() };
  const lookup = pinyinLookup(course);
  assert.equal(lookup('我'), 'Wǒ');
  assert.equal(lookup('喝茶'), 'hē chá');
  assert.equal(lookup('茶'), 'chá');
  assert.equal(lookup('unknown'), '');
  const unit = { vocabulary: [{ th: 'ชา' }, { th: 'น้ำ' }, { th: 'ชา' }, { th: 'กาแฟ' }] };
  const choices = vocabularyChoices(unit, 0);
  assert.ok(choices.includes(0));
  assert.equal(new Set(choices.map(i => unit.vocabulary[i].th)).size, choices.length);
});
