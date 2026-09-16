import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRandom, generateQuestion, generateQuestionSet } from './questionGenerators.js';
import { buildDailyTraining } from './dailyTraining.js';
import { EMPTY_MATH_PROGRESS, isMathLevelUnlocked, MATH_STAGE_META, normalizeMathProgress } from './mathProgress.js';

test('ทุก stage และ level สร้างโจทย์ที่มีคำตอบเดียวใน choices', () => {
  for (let stage = 1; stage <= 7; stage += 1) {
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
  assert.equal(new Set(first.map(item => `${item.prompt}|${item.answer}|${JSON.stringify(item.visual)}`)).size, first.length);
});

test('Daily Training คงที่ในวันเดียวกันและใช้เฉพาะด่านที่ปลดล็อก', () => {
  const progress = { currentStage: 3, currentLevel: 2, skills: {} };
  const first = buildDailyTraining(progress, { userId: 'abc', date: '2026-09-15', count: 18 });
  const second = buildDailyTraining(progress, { userId: 'abc', date: '2026-09-15', count: 18 });
  assert.deepEqual(first, second);
  assert.equal(first.length, 18);
  assert.ok(first.every(item => item.stage <= 3));
});

test('ด่าน 1 แต่ละระดับใช้รูปแบบฝึกและคะแนนความชำนาญแยกกัน', () => {
  const items = [1, 2, 3, 4].map(level => generateQuestion(1, level, createSeededRandom(`level-${level}`)));
  assert.deepEqual(items.map(item => item.inputMode), ['choice', 'choice', 'choice', 'number']);
  assert.equal(items[0].visual.total, 5);
  assert.equal(items[0].visual.filled + items[0].answer, 5);
  assert.equal(items[1].visual.type, 'tenFrame');
  assert.equal(items[1].visual.total, 10);
  assert.equal(items[2].visual.type, 'numberPair');
  assert.match(items[3].prompt, /^แยกจำนวน 10 = \d \+ \?$/);
  assert.equal(new Set(items.map(item => item.skill.split('.').slice(0, 4).join('.'))).size, 4);
});

test('ด่าน 1 ทุกระดับมีแบบฝึกครบ 10 ข้อแม้จำนวนคู่ไม่ซ้ำมีจำกัด', () => {
  for (let level = 1; level <= 4; level += 1) {
    assert.equal(generateQuestionSet({ stage: 1, level, count: 10, seed: `stage-1-${level}` }).length, 10);
  }
});

test('การบวกระดับ 2 และ 3 ไม่ใช้ mastery ร่วมกัน', () => {
  const level2 = generateQuestion(2, 2, createSeededRandom('addition-2'));
  const level3 = generateQuestion(2, 3, createSeededRandom('addition-3'));
  assert.equal(level2.skill, 'addition.splitNumber');
  assert.equal(level3.skill, 'addition.bridge20');
  assert.equal(level3.inputMode, 'split-two');
  assert.equal(level3.visual.type, 'makeTargetSplit');
  assert.equal(level3.visual.target, 20);
  assert.equal(level3.visual.first + level3.visual.toTarget, 20);
  assert.equal(level3.visual.toTarget + level3.answer, level3.visual.second);
});

test('การบวกระดับ 3 สร้างโจทย์สิบกว่าบวกหลักหน่วยได้ครบ 10 ข้อ', () => {
  const items = generateQuestionSet({ stage: 2, level: 3, count: 10, seed: 'addition-level-3' });
  assert.equal(items.length, 10);
  assert.equal(new Set(items.map(item => `${item.visual.first}+${item.visual.second}`)).size, 10);
  assert.ok(items.every(item => item.visual.first >= 12 && item.visual.first <= 19));
  assert.ok(items.every(item => item.visual.second >= 2 && item.visual.second <= 9));
  assert.ok(items.every(item => item.visual.first + item.visual.second > 20));
});

test('การบวกระดับ 2 แสดงต้นไม้แยกจำนวนและไม่มีส่วนที่เหลือติดลบ', () => {
  const rng = createSeededRandom('split-tree');
  for (let index = 0; index < 100; index += 1) {
    const item = generateQuestion(2, 2, rng);
    assert.equal(item.visual.type, 'makeTenSplit');
    assert.equal(item.inputMode, 'split-two');
    assert.ok(item.answer > 0);
    assert.equal(item.visual.toTen + item.answer, item.visual.second);
    assert.equal(item.visual.first + item.visual.toTen, 10);
  }
});

test('การบวกระดับ 1 ให้เด็กกรอกการแยกจำนวนเอง และแยกได้สองส่วนเป็นบวกเสมอ', () => {
  const rng = createSeededRandom('addition-bond');
  for (let index = 0; index < 100; index += 1) {
    const item = generateQuestion(2, 1, rng);
    assert.equal(item.skill, 'addition.makeTenBond');
    assert.equal(item.inputMode, 'bond-split');
    assert.equal(item.visual.type, 'makeTenBond');
    assert.ok(item.visual.first >= 5 && item.visual.first <= 9);
    assert.equal(item.visual.first + item.visual.toTen, 10);
    assert.equal(item.answer, item.visual.toTen);
    assert.ok(item.visual.second - item.visual.toTen > 0);
    assert.ok(item.visual.first + item.visual.second > 10);
  }
});

test('การบวกระดับ 1 มีโจทย์ไม่ซ้ำครบ 10 ข้อ', () => {
  const items = generateQuestionSet({ stage: 2, level: 1, count: 10, seed: 'addition-bond-set' });
  assert.equal(items.length, 10);
  assert.equal(new Set(items.map(item => `${item.visual.first}+${item.visual.second}`)).size, 10);
});

test('การลบทั้ง 4 ระดับเรียงจากเลือกวิธี สิบกว่า ยี่สิบกว่า และคิดในใจ', () => {
  const levels = [1, 2, 3, 4].map(level => generateQuestion(3, level, createSeededRandom(`subtraction-${level}`)));
  assert.equal(levels[0].skill, 'subtraction.chooseSplit');
  assert.equal(levels[0].choices.filter(value => levels[0].visual.whole - value === 10).length, 1);
  assert.equal(new Set(levels[0].choices.map(value => [value, levels[0].visual.whole - value].sort((a, b) => a - b).join('+'))).size, 4);
  assert.ok(!levels[0].choices.includes(10));
  assert.equal(levels[1].inputMode, 'subtraction-split');
  assert.ok(levels[1].visual.whole >= 11 && levels[1].visual.whole <= 18);
  assert.equal(levels[2].inputMode, 'subtraction-split');
  assert.ok(levels[2].visual.whole >= 21 && levels[2].visual.whole <= 28);
  assert.equal(levels[3].inputMode, 'number');
  levels.slice(1, 3).forEach(item => {
    assert.equal(item.visual.base - item.visual.subtract, item.answer);
    assert.equal(item.visual.remainder + item.answer, item.visual.finalAnswer);
    assert.equal(item.visual.finalAnswer, item.visual.whole - item.visual.subtract);
  });
});

test('การยืมทั้ง 4 ระดับเรียงจากเข้าใจการยืม ฝึกทีละขั้น และคิดในใจ', () => {
  const levels = [1, 2, 3, 4].map(level => generateQuestion(4, level, createSeededRandom(`borrowing-${level}`)));

  assert.equal(levels[0].skill, 'borrowing.exchangeTen');
  assert.equal(levels[0].visual.type, 'borrowingIntro');
  assert.equal(levels[0].choiceLabels[String(levels[0].answer)], `${levels[0].visual.tensValue - 10} และ ${levels[0].visual.ones + 10}`);

  assert.equal(levels[1].skill, 'borrowing.oneDigit');
  assert.equal(levels[1].inputMode, 'borrowing-split');
  assert.ok(levels[1].visual.subtract < 10);
  assert.equal(levels[1].visual.requireFinal, false);

  assert.equal(levels[2].skill, 'borrowing.twoDigit');
  assert.equal(levels[2].inputMode, 'borrowing-split');
  assert.ok(levels[2].visual.subtract >= 10);
  assert.equal(levels[2].visual.requireFinal, true);

  assert.equal(levels[3].skill, 'borrowing.mental');
  assert.equal(levels[3].inputMode, 'number');

  levels.slice(1, 3).forEach(item => {
    const visual = item.visual;
    assert.equal(visual.tensRemainder + visual.borrowedOnes, visual.whole);
    assert.equal(visual.borrowedOnes - visual.subtractOnes, visual.onesDifference);
    assert.equal(visual.tensRemainder - visual.subtractTens, visual.tensDifference);
    assert.equal(visual.tensDifference + visual.onesDifference, visual.finalAnswer);
    assert.equal(visual.finalAnswer, item.answer);
  });
});

test('ด่านลบ10 ทั้ง 4 ระดับเรียงจากแยกตัวลบ สิบกว่า ยี่สิบกว่า และคิดในใจ', () => {
  const levels = [1, 2, 3, 4].map(level => generateQuestion(5, level, createSeededRandom(`cut-ten-${level}`)));

  assert.equal(levels[0].skill, 'cutTen.splitSubtract');
  assert.equal(levels[0].inputMode, 'cut-ten-split');
  assert.equal(levels[0].visual.type, 'cutTenSplit');
  assert.equal(levels[0].answer, levels[0].visual.firstCut);
  assert.equal(levels[0].visual.requireBase, false);
  assert.equal(levels[0].visual.requireFinal, false);

  assert.equal(levels[1].skill, 'cutTen.under20');
  assert.equal(levels[1].visual.base, 10);
  assert.equal(levels[1].visual.requireBase, false);
  assert.equal(levels[1].visual.requireFinal, true);
  assert.equal(levels[1].answer, levels[1].visual.finalAnswer);

  assert.equal(levels[2].skill, 'cutTen.under30');
  assert.equal(levels[2].visual.base, 20);
  assert.equal(levels[2].visual.requireBase, true);

  assert.equal(levels[3].skill, 'cutTen.mental');
  assert.equal(levels[3].inputMode, 'number');
});

test('ด่านลบ10 ทุกระดับตัดลงหลักสิบได้พอดีและไม่มีส่วนที่เหลือติดลบ', () => {
  for (let level = 1; level <= 4; level += 1) {
    const rng = createSeededRandom(`cut-ten-rules-${level}`);
    for (let index = 0; index < 100; index += 1) {
      const item = generateQuestion(5, level, rng);
      const data = item.visual || { ...item };
      const { whole, subtract, firstCut, secondCut, base, finalAnswer } = level === 4
        ? (() => {
            // ระดับ 4 ไม่มีผัง จึงถอดค่าจากคำอธิบายว่าเป็นวิธีตัด 10 จริง
            const [, w, s] = item.prompt.match(/(\d+) − (\d+)/);
            const ones = Number(w) % 10;
            return { whole: Number(w), subtract: Number(s), firstCut: ones, secondCut: Number(s) - ones, base: Number(w) - ones, finalAnswer: Number(w) - Number(s) };
          })()
        : data;
      assert.ok(firstCut >= 1 && firstCut <= 8, `firstCut ${firstCut}`);
      assert.ok(secondCut >= 1, `secondCut ${secondCut}`);
      assert.equal(firstCut + secondCut, subtract);
      assert.equal(whole - firstCut, base);
      assert.equal(base % 10, 0);
      assert.equal(base - secondCut, finalAnswer);
      assert.ok(finalAnswer >= 0 && finalAnswer < base);
    }
  }
});

test('ด่านลบ10 ระดับ 1 มีโจทย์ไม่ซ้ำครบ 10 ข้อ', () => {
  const items = generateQuestionSet({ stage: 5, level: 1, count: 10, seed: 'cut-ten-set' });
  assert.equal(items.length, 10);
  assert.equal(new Set(items.map(item => `${item.visual.whole}-${item.visual.subtract}`)).size, 10);
});

test('ด่านคูณให้เด็กประกอบประโยคคูณเอง และไล่จากกลุ่มเล็ก แม่ 2/5/10 ตาราง จนคิดในใจ', () => {
  const levels = [1, 2, 3, 4].map(level => generateQuestion(6, level, createSeededRandom(`multiply-${level}`)));
  assert.deepEqual(levels.map(item => item.inputMode), ['multiply-build', 'multiply-build', 'multiply-build', 'number']);
  assert.deepEqual(levels.slice(0, 3).map(item => item.visual.mode), ['groups', 'repeat', 'array']);
  assert.deepEqual(levels.map(item => item.skill), ['multiplication.equalGroups', 'multiplication.repeatedAddition', 'multiplication.array', 'multiplication.mentalMultiplication']);

  for (let level = 1; level <= 3; level += 1) {
    const rng = createSeededRandom(`multiply-rules-${level}`);
    for (let index = 0; index < 100; index += 1) {
      const item = generateQuestion(6, level, rng);
      const { groups, size, product } = item.visual;
      assert.equal(groups * size, product);
      assert.equal(item.answer, product);
      assert.ok(groups >= 2 && size >= 2);
      // ระดับ 1–3 ต้องนับจุดไหวบนจอเดียว
      assert.ok(product <= 60, `product ${product}`);
      if (level === 2) assert.ok([2, 5, 10].includes(size), `size ${size}`);
    }
  }
});

test('ด่านหารเริ่มจากแบ่งของจริง แล้วจบที่ครอบครัวสูตรคูณและคิดในใจ', () => {
  const levels = [1, 2, 3, 4].map(level => generateQuestion(7, level, createSeededRandom(`divide-${level}`)));
  assert.deepEqual(levels.map(item => item.inputMode), ['divide-build', 'divide-build', 'divide-build', 'number']);
  assert.deepEqual(levels.slice(0, 3).map(item => item.visual.mode), ['share', 'group', 'factFamily']);
  assert.deepEqual(levels.map(item => item.skill), ['division.equalSharing', 'division.grouping', 'division.factFamily', 'division.mentalDivision']);

  // ระดับ 1 ตอบว่าคนละกี่ชิ้น ระดับ 2 ตอบว่าได้กี่กลุ่ม
  assert.equal(levels[0].answer, levels[0].visual.quotient);
  assert.equal(levels[1].answer, levels[1].visual.divisor);

  for (let level = 1; level <= 3; level += 1) {
    const rng = createSeededRandom(`divide-rules-${level}`);
    for (let index = 0; index < 100; index += 1) {
      const item = generateQuestion(7, level, rng);
      const { total, divisor, quotient } = item.visual;
      assert.equal(divisor * quotient, total);
      assert.ok(divisor >= 2 && quotient >= 2);
      if (level === 1) assert.ok(total <= 20, `total ${total}`);
      if (level === 2) assert.ok(total <= 30, `total ${total}`);
      // ระดับ 3 ต้องได้ประโยคหารสองประโยคที่ไม่ซ้ำกันเอง
      if (level === 3) assert.notEqual(divisor, quotient);
    }
  }
});

test('ด่านคูณและด่านหารทุกระดับมีโจทย์ไม่ซ้ำครบ 10 ข้อ', () => {
  for (const stage of [6, 7]) {
    for (let level = 1; level <= 4; level += 1) {
      const items = generateQuestionSet({ stage, level, count: 10, seed: `stage-${stage}-${level}` });
      assert.equal(items.length, 10);
      assert.equal(new Set(items.map(item => `${item.prompt}|${JSON.stringify(item.visual)}`)).size, 10);
    }
  }
});

test('Admin เข้าได้ทุกด่านและทุกระดับ โดยผู้เล่นทั่วไปยังใช้เงื่อนไขเดิม', () => {
  for (let stage = 1; stage <= 7; stage += 1) {
    for (let level = 1; level <= 4; level += 1) {
      assert.equal(isMathLevelUnlocked(EMPTY_MATH_PROGRESS, stage, level, true), true);
    }
  }
  assert.equal(isMathLevelUnlocked(EMPTY_MATH_PROGRESS, 1, 1), true);
  assert.equal(isMathLevelUnlocked(EMPTY_MATH_PROGRESS, 1, 2), false);
  assert.equal(isMathLevelUnlocked(EMPTY_MATH_PROGRESS, 2, 1), false);
});

test('หลักสูตรใหม่แทรกการยืมและลบ10 แล้วย้ายความคืบหน้าจากหลักสูตรเดิมเพียงครั้งเดียว', () => {
  assert.deepEqual(MATH_STAGE_META.map(item => item.stage), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(MATH_STAGE_META.map(item => item.title), ['ความเข้าใจจำนวน', 'การบวก', 'การลบ', 'การยืม', 'ลบ10', 'การคูณ', 'การหาร']);

  // หลักสูตร v1: ด่าน 4 คือการคูณ ด่าน 5 คือการหาร จึงต้องเลื่อนผ่านทั้งการยืมและลบ10
  assert.equal(normalizeMathProgress({ currentStage: 4, currentLevel: 2 }).currentStage, 6);
  assert.equal(normalizeMathProgress({ currentStage: 5, currentLevel: 3 }).currentStage, 7);
  assert.equal(normalizeMathProgress({ currentStage: 3, currentLevel: 2 }).currentStage, 3);

  // หลักสูตร v2: ด่าน 4 คือการยืมอยู่แล้ว มีแต่การคูณ/หารที่ต้องเลื่อนให้ลบ10
  assert.equal(normalizeMathProgress({ curriculumVersion: 2, currentStage: 4, currentLevel: 2 }).currentStage, 4);
  assert.equal(normalizeMathProgress({ curriculumVersion: 2, currentStage: 5, currentLevel: 1 }).currentStage, 6);
  assert.equal(normalizeMathProgress({ curriculumVersion: 2, currentStage: 6, currentLevel: 1 }).currentStage, 7);

  // หลักสูตรปัจจุบันต้องไม่ถูกเลื่อนซ้ำอีก
  const currentCurriculum = normalizeMathProgress({ curriculumVersion: 3, currentStage: 5, currentLevel: 2 });
  assert.equal(currentCurriculum.currentStage, 5);
  assert.equal(currentCurriculum.currentLevel, 2);
  assert.equal(normalizeMathProgress(currentCurriculum).currentStage, 5);

  const formerGraduate = normalizeMathProgress({ currentStage: 6, currentLevel: 1 });
  assert.equal(formerGraduate.currentStage, 7);
  assert.equal(formerGraduate.currentLevel, 4);

  const daily = buildDailyTraining(formerGraduate, { userId: 'former-stage-6', date: '2026-09-15', count: 18 });
  assert.ok(daily.every(item => item.stage >= 1 && item.stage <= 7));
});
