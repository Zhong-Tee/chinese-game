import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRandom, generateQuestion, generateQuestionSet } from './questionGenerators.js';
import { buildDailyTraining } from './dailyTraining.js';

test('ทุก stage และ level สร้างโจทย์ที่มีคำตอบเดียวใน choices', () => {
  for (let stage = 1; stage <= 6; stage += 1) {
    for (let level = 1; level <= 4; level += 1) {
      const rng = createSeededRandom(`${stage}:${level}`);
      for (let i = 0; i < 100; i += 1) {
        const item = generateQuestion(stage, level, rng);
        assert.equal(typeof item.answer, 'number');
        assert.equal(item.choices.length, 4);
        assert.equal(new Set(item.choices).size, 4);
        assert.equal(item.choices.filter(value => value === item.answer).length, 1);
        assert.ok(item.explanation.length >= 2);
      }
    }
  }
});

test('ชุดโจทย์จาก seed เดิมเหมือนเดิมและไม่ซ้ำ', () => {
  const first = generateQuestionSet({ stage: 4, level: 4, count: 10, seed: 'today' });
  const second = generateQuestionSet({ stage: 4, level: 4, count: 10, seed: 'today' });
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map(item => item.prompt)).size, first.length);
});

test('Daily Training คงที่ในวันเดียวกันและใช้เฉพาะด่านที่ปลดล็อก', () => {
  const progress = { currentStage: 3, currentLevel: 2, skills: {} };
  const first = buildDailyTraining(progress, { userId: 'abc', date: '2026-09-15', count: 18 });
  const second = buildDailyTraining(progress, { userId: 'abc', date: '2026-09-15', count: 18 });
  assert.deepEqual(first, second);
  assert.equal(first.length, 18);
  assert.ok(first.every(item => item.stage <= 3));
});
