import test from 'node:test';
import assert from 'node:assert/strict';
import { didPassFlashcard, getNextFlashcardProgress } from './flashcardProgress.js';

test('คำจะผ่านเมื่อช่วงบังคับทั้งหมดถูก', () => {
  assert.equal(didPassFlashcard({ pinyin: true, meaning: true }), true);
  assert.equal(didPassFlashcard({ pinyin: true, meaning: false }), false);
  assert.equal(didPassFlashcard(
    { pinyin: true, meaning: true, typing: true, rearrange: true },
    { needsTyping: true, needsRearrange: true },
  ), true);
  assert.equal(didPassFlashcard(
    { pinyin: true, meaning: true, typing: false, rearrange: true },
    { needsTyping: true, needsRearrange: true },
  ), false);
});

test('ผ่านแล้วเลื่อนระดับ แต่ไม่เกิน LV7', () => {
  assert.deepEqual(getNextFlashcardProgress({ activeLevel: 2, currentWrong: 2, passed: true }), { level: 3, wrongCount: 0 });
  assert.deepEqual(getNextFlashcardProgress({ activeLevel: 7, currentWrong: 2, passed: true }), { level: 7, wrongCount: 0 });
});

test('ไม่ผ่านจะกลับ LV1 และเพิ่มจำนวนผิดหนึ่งครั้ง', () => {
  assert.deepEqual(getNextFlashcardProgress({ activeLevel: 5, currentWrong: 2, passed: false }), { level: 1, wrongCount: 3 });
});

test('แก้คำผิดบ่อยผ่านแล้วกลับ LV1 และล้างจำนวนผิด', () => {
  assert.deepEqual(getNextFlashcardProgress({ activeLevel: 'mistakes', currentWrong: 6, passed: true }), { level: 1, wrongCount: 0 });
});


test('disabled stages 3 and 4 do not affect passing; stages 1 and 2 are always required', () => {
  for (const needsRearrange of [true, false]) {
    for (const needsTyping of [true, false]) {
      const options = { needsTyping, needsRearrange };
      const results = { pinyin: true, meaning: true, typing: needsTyping ? true : null, rearrange: needsRearrange ? true : null };
      assert.equal(didPassFlashcard(results, options), true);
      for (const stage of ['pinyin', 'meaning', ...(needsRearrange ? ['rearrange'] : []), ...(needsTyping ? ['typing'] : [])]) {
        assert.equal(didPassFlashcard({ ...results, [stage]: false }, options), false);
        assert.equal(didPassFlashcard({ ...results, [stage]: null }, options), false);
      }
      if (!needsRearrange) assert.equal(didPassFlashcard({ ...results, rearrange: false }, options), true);
      if (!needsTyping) assert.equal(didPassFlashcard({ ...results, typing: false }, options), true);
    }
  }
});
