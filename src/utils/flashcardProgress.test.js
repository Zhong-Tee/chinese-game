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
