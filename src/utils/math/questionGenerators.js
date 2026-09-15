const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createSeededRandom(seed = Date.now()) {
  let state = typeof seed === 'number'
    ? seed >>> 0
    : [...String(seed)].reduce((acc, char) => Math.imul(acc ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (rng, values) => values[int(rng, 0, values.length - 1)];

function makeChoices(answer, rng, min = 0, max = 100) {
  const values = new Set([answer]);
  const offsets = [-10, -5, -3, -2, -1, 1, 2, 3, 5, 10];
  while (values.size < 4) {
    values.add(clamp(answer + pick(rng, offsets), min, max));
  }
  return [...values].sort(() => rng() - 0.5);
}

function question({ stage, level, skill, prompt, answer, explanation, rng, visual, inputMode, customChoices, choiceLabels }) {
  return {
    id: `${stage}-${level}-${skill}-${Math.floor(rng() * 1e9)}`,
    stage,
    level,
    skill,
    prompt,
    answer,
    choices: customChoices || makeChoices(answer, rng, 0, 100),
    choiceLabels: choiceLabels || null,
    explanation,
    visual: visual || null,
    inputMode: inputMode || (level >= 3 ? 'number' : 'choice'),
  };
}

export function generateStage1(level = 1, rng = Math.random) {
  if (level === 1) {
    const first = int(rng, 1, 4);
    const answer = 5 - first;
    const pair = [Math.min(first, answer), Math.max(first, answer)].join('-');
    return question({ stage: 1, level, skill: `numberBond.five.choice.${pair}`, prompt: `แยกจำนวน 5 = ${first} + ?`, answer, rng,
      customChoices: makeChoices(answer, rng, 0, 5), visual: { type: 'tenFrame', filled: first, total: 5 },
      explanation: [`ดูช่องทั้งหมด 5 ช่อง`, `มีอยู่แล้ว ${first} ช่อง`, `เติมอีก ${answer} ช่องจึงครบ 5`], inputMode: 'choice' });
  }

  const first = int(rng, 1, 9);
  const answer = 10 - first;
  const pair = [Math.min(first, answer), Math.max(first, answer)].join('-');
  if (level === 2) {
    return question({ stage: 1, level, skill: `numberBond.ten.frame.${pair}`, prompt: `แยกจำนวน 10 = ${first} + ?`, answer, rng,
      customChoices: makeChoices(answer, rng, 0, 10), visual: { type: 'tenFrame', filled: first, total: 10 },
      explanation: [`ดูช่องทั้งหมด 10 ช่อง`, `มีอยู่แล้ว ${first} ช่อง`, `เติมอีก ${answer} ช่องจึงครบ 10`], inputMode: 'choice' });
  }
  if (level === 3) {
    return question({ stage: 1, level, skill: `numberBond.ten.choice.${pair}`, prompt: `เลือกตัวเลขที่จับคู่กับ ${first} รวมกันได้ 10`, answer, rng,
      customChoices: makeChoices(answer, rng, 0, 10), visual: { type: 'numberPair', first, target: 10 },
      explanation: [`เริ่มจากเลข ${first}`, `นับต่ออีก ${answer} จึงถึง 10`, `${first} + ${answer} = 10`], inputMode: 'choice' });
  }
  if (level === 4) {
    return question({ stage: 1, level, skill: `numberBond.ten.decompose.${pair}`, prompt: `แยกจำนวน 10 = ${first} + ?`, answer, rng,
      customChoices: makeChoices(answer, rng, 0, 10), explanation: [`เริ่มจาก ${first}`, `นับต่ออีก ${answer} ครั้งจึงถึง 10`, `ดังนั้น 10 = ${first} + ${answer}`], inputMode: 'number' });
  }
  return question({ stage: 1, level: 4, skill: `numberBond.ten.decompose.${pair}`, prompt: `แยกจำนวน 10 = ${first} + ?`, answer, rng,
    customChoices: makeChoices(answer, rng, 0, 10), explanation: [`เริ่มจาก ${first}`, `นับต่ออีก ${answer} ครั้งจึงถึง 10`, `ดังนั้น 10 = ${first} + ${answer}`], inputMode: 'number' });
}

export function generateStage2(level = 1, rng = Math.random) {
  const first = int(rng, 6, 9);
  const toTen = 10 - first;
  // ตัวบวกตัวที่สองต้องมากกว่าส่วนที่ใช้เติมให้ครบ 10 เพื่อให้มี "ส่วนที่เหลือ" เป็นจำนวนบวกเสมอ
  const second = int(rng, Math.max(3, toTen + 1), 9);
  const rest = second - toTen;
  if (level === 1) {
    const bondFirst = int(rng, 5, 9);
    const bondToTen = 10 - bondFirst;
    // ตัวที่สองต้องมากกว่าส่วนที่ใช้เติมให้ครบ 10 เพื่อให้แยกได้สองส่วนที่เป็นจำนวนบวกทั้งคู่
    const bondSecond = int(rng, bondToTen + 1, 9);
    const bondRest = bondSecond - bondToTen;
    return question({ stage: 2, level, skill: 'addition.makeTenBond', prompt: `${bondFirst} + ${bondSecond} = ?\nแยก ${bondSecond} ออกเป็น 2 ส่วน`, answer: bondToTen, rng,
      visual: { type: 'makeTenBond', first: bondFirst, second: bondSecond, toTen: bondToTen },
      explanation: [`กรอบ 10 ช่องมี ${bondFirst} แล้ว ว่างอีก ${bondToTen} ช่อง`, `จึงแยก ${bondSecond} เป็น ${bondToTen} กับ ${bondRest}`, `${bondFirst} + ${bondToTen} = 10`, `10 + ${bondRest} = ${bondFirst + bondSecond}`], inputMode: 'bond-split' });
  }
  if (level === 2) {
    return question({ stage: 2, level, skill: 'addition.splitNumber', prompt: `แยก ${second} ออกเป็น 2 ส่วน`, answer: rest, rng,
      visual: { type: 'makeTenSplit', first, second, toTen },
      explanation: [`${first} ต้องการ ${toTen} เพื่อครบ 10`, `ช่องแรกจึงเป็น ${toTen}`, `แยก ${second} เป็น ${toTen} กับ ${rest}`, `10 + ${rest} = ${first + second}`], inputMode: 'split-two' });
  }
  if (level === 3) {
    const teen = int(rng, 12, 19);
    const toTwenty = 20 - teen;
    const units = int(rng, toTwenty + 1, 9);
    const unitsRest = units - toTwenty;
    return question({ stage: 2, level, skill: 'addition.bridge20', prompt: `แยก ${units} ออกเป็น 2 ส่วน`, answer: unitsRest, rng,
      visual: { type: 'makeTargetSplit', first: teen, second: units, target: 20, toTarget: toTwenty },
      explanation: [`${teen} ต้องการ ${toTwenty} เพื่อครบ 20`, `ช่องแรกจึงเป็น ${toTwenty}`, `แยก ${units} เป็น ${toTwenty} กับ ${unitsRest}`, `20 + ${unitsRest} = ${teen + units}`], inputMode: 'split-two' });
  }
  const teen = int(rng, 12, 19);
  const toTwenty = 20 - teen;
  const units = int(rng, toTwenty + 1, 9);
  const answer = teen + units;
  return question({ stage: 2, level, skill: 'addition.mentalAddition', prompt: `คิดในใจแบบครบ 20\n${teen} + ${units} = ?`, answer, rng,
    explanation: [`${teen} ต้องการ ${toTwenty} เพื่อครบ 20`, `แยก ${units} เป็น ${toTwenty} + ${units - toTwenty}`, `${teen} + ${toTwenty} = 20`, `20 + ${units - toTwenty} = ${answer}`], inputMode: 'number' });
}

export function generateStage3(level = 1, rng = Math.random) {
  const makeCrossTenProblem = (minWhole, maxWhole) => {
    const whole = int(rng, minWhole, maxWhole);
    const ones = whole % 10;
    const subtract = int(rng, ones + 1, 9);
    const base = 10;
    const remainder = whole - base;
    const fromBase = base - subtract;
    return { whole, subtract, base, remainder, fromBase, finalAnswer: whole - subtract };
  };

  if (level === 1) {
    const data = makeCrossTenProblem(11, 18);
    // ใช้เฉพาะคู่แบบเรียงจากน้อยไปมาก จึงไม่มีคำตอบกลับด้าน เช่น 3 + 10 กับ 10 + 3
    const splitOptions = Array.from({ length: Math.floor(data.whole / 2) }, (_, index) => index + 1)
      .filter(value => value !== data.remainder)
      .sort(() => rng() - 0.5)
      .slice(0, 3);
    const choices = [data.remainder, ...splitOptions].sort(() => rng() - 0.5);
    const choiceLabels = Object.fromEntries(choices.map(value => [value, `${data.whole} = ${value} + ${data.whole - value}`]));
    return question({ stage: 3, level, skill: 'subtraction.chooseSplit', prompt: `เลือกวิธีแยก ${data.whole} โดยให้ 10 เป็นส่วนที่สอง`, answer: data.remainder, rng,
      customChoices: choices, choiceLabels, visual: { type: 'subtractionBridge', whole: data.whole, subtract: data.subtract },
      explanation: [`แยก ${data.whole} เป็น ${data.remainder} + 10`, `10 − ${data.subtract} = ${data.fromBase}`, `${data.remainder} + ${data.fromBase} = ${data.finalAnswer}`] });
  }

  if (level === 2 || level === 3) {
    const data = makeCrossTenProblem(level === 2 ? 11 : 21, level === 2 ? 18 : 28);
    return question({ stage: 3, level, skill: level === 2 ? 'subtraction.break10' : 'subtraction.break20', prompt: `แยก ${data.whole} แล้วลบ ${data.subtract} ทีละขั้น`, answer: data.fromBase, rng,
      visual: { type: 'subtractionSplit', ...data },
      explanation: [`แยก ${data.whole} เป็น ${data.remainder} + 10`, `10 − ${data.subtract} = ${data.fromBase}`, `${data.remainder} + ${data.fromBase} = ${data.finalAnswer}`], inputMode: 'subtraction-split' });
  }

  const mentalDecade = pick(rng, [10, 20]);
  const data = makeCrossTenProblem(mentalDecade + 1, mentalDecade + 8);
  return question({ stage: 3, level, skill: 'subtraction.mentalSubtraction', prompt: `คิดในใจด้วยวิธีแยก 10\n${data.whole} − ${data.subtract} = ?`, answer: data.finalAnswer, rng,
    explanation: [`แยก ${data.whole} เป็น ${data.remainder} + 10`, `10 − ${data.subtract} = ${data.fromBase}`, `${data.remainder} + ${data.fromBase} = ${data.finalAnswer}`], inputMode: 'number' });
}

function makeBorrowingProblem(rng, twoDigitSubtrahend = false) {
  const tensDigit = int(rng, 2, 9);
  const ones = int(rng, 0, 8);
  const subtractOnes = int(rng, ones + 1, 9);
  const subtractTens = twoDigitSubtrahend ? int(rng, 1, tensDigit - 1) * 10 : 0;
  const whole = tensDigit * 10 + ones;
  const subtract = subtractTens + subtractOnes;
  const tensRemainder = (tensDigit - 1) * 10;
  const borrowedOnes = ones + 10;
  const tensDifference = tensRemainder - subtractTens;
  const onesDifference = borrowedOnes - subtractOnes;
  return { whole, subtract, tensRemainder, borrowedOnes, subtractTens, subtractOnes, tensDifference, onesDifference, finalAnswer: whole - subtract };
}

export function generateStage4(level = 1, rng = Math.random) {
  if (level === 1) {
    const data = makeBorrowingProblem(rng, false);
    const tensValue = data.tensRemainder + 10;
    const ones = data.whole % 10;
    const choices = [0, 1, 2, 3].sort(() => rng() - 0.5);
    const choiceLabels = {
      0: `${data.tensRemainder} และ ${data.borrowedOnes}`,
      1: `${tensValue} และ ${data.borrowedOnes}`,
      2: `${data.tensRemainder} และ ${ones}`,
      3: `${tensValue} และ ${ones}`,
    };
    return question({ stage: 4, level, skill: 'borrowing.exchangeTen', prompt: `หลังยืม 1 สิบ เลข ${data.whole} จะแยกเป็นเท่าไร?`, answer: 0, rng,
      customChoices: choices, choiceLabels, visual: { type: 'borrowingIntro', whole: data.whole, tensValue, ones },
      explanation: [`เริ่มจาก ${data.whole} = ${tensValue} + ${ones}`, `ยืม 10 จาก ${tensValue} จึงเหลือ ${data.tensRemainder}`, `นำ 10 ไปรวมกับ ${ones} ได้ ${data.borrowedOnes}`, `${data.whole} = ${data.tensRemainder} + ${data.borrowedOnes}`] });
  }

  if (level === 2 || level === 3) {
    const data = makeBorrowingProblem(rng, level === 3);
    return question({ stage: 4, level, skill: level === 2 ? 'borrowing.oneDigit' : 'borrowing.twoDigit', prompt: `${data.whole} − ${data.subtract} แบบยืม 1 สิบ`, answer: data.finalAnswer, rng,
      visual: { type: 'borrowingSplit', ...data, requireFinal: level === 3 },
      explanation: [`ยืม 1 สิบ: ${data.whole} = ${data.tensRemainder} + ${data.borrowedOnes}`, `${data.borrowedOnes} − ${data.subtractOnes} = ${data.onesDifference}`, `${data.tensRemainder} − ${data.subtractTens} = ${data.tensDifference}`, `${data.tensDifference} + ${data.onesDifference} = ${data.finalAnswer}`], inputMode: 'borrowing-split' });
  }

  const data = makeBorrowingProblem(rng, rng() >= 0.5);
  return question({ stage: 4, level, skill: 'borrowing.mental', prompt: `คิดในใจด้วยวิธียืมหลักสิบ\n${data.whole} − ${data.subtract} = ?`, answer: data.finalAnswer, rng,
    explanation: [`ยืม 1 สิบ: ${data.whole} = ${data.tensRemainder} + ${data.borrowedOnes}`, `${data.borrowedOnes} − ${data.subtractOnes} = ${data.onesDifference}`, `${data.tensRemainder} − ${data.subtractTens} = ${data.tensDifference}`, `${data.tensDifference} + ${data.onesDifference} = ${data.finalAnswer}`], inputMode: 'number' });
}

export function generateStage5(level = 1, rng = Math.random) {
  const groups = int(rng, 2, level === 4 ? 9 : 5);
  const size = int(rng, 2, level === 4 ? 9 : 6);
  const answer = groups * size;
  const skill = ['multiplication.equalGroups', 'multiplication.repeatedAddition', 'multiplication.array', 'multiplication.mentalMultiplication'][level - 1] || 'multiplication.mentalMultiplication';
  const prompts = [
    `มี ${groups} กลุ่ม กลุ่มละ ${size} มีทั้งหมดกี่ชิ้น?`,
    `${Array(groups).fill(size).join(' + ')} = ?`,
    `ตาราง ${groups} แถว แถวละ ${size} จุด มีทั้งหมดกี่จุด?`,
    `${groups} × ${size} = ?`,
  ];
  return question({ stage: 5, level, skill, prompt: prompts[level - 1] || prompts[3], answer, rng,
    visual: level === 1 ? { type: 'groups', groups, size } : level === 3 ? { type: 'array', rows: groups, columns: size } : null,
    explanation: [`มี ${groups} กลุ่ม กลุ่มละ ${size}`, `${Array(groups).fill(size).join(' + ')} = ${answer}`, `${groups} × ${size} = ${answer}`], inputMode: level === 4 ? 'number' : 'choice' });
}

export function generateStage6(level = 1, rng = Math.random) {
  const divisor = int(rng, 2, level === 4 ? 9 : 5);
  const quotient = int(rng, 2, level === 4 ? 9 : 6);
  const total = divisor * quotient;
  const skill = ['division.equalSharing', 'division.grouping', 'division.factFamily', 'division.mentalDivision'][level - 1] || 'division.mentalDivision';
  const prompts = [
    `แบ่งของ ${total} ชิ้นให้ ${divisor} คนเท่า ๆ กัน แต่ละคนได้กี่ชิ้น?`,
    `มี ${total} ชิ้น จัดกลุ่มละ ${quotient} ชิ้น ได้กี่กลุ่ม?`,
    `${divisor} × ${quotient} = ${total} ดังนั้น ${total} ÷ ${divisor} = ?`,
    `${total} ÷ ${divisor} = ?`,
  ];
  const answer = level === 2 ? divisor : quotient;
  return question({ stage: 6, level, skill, prompt: prompts[level - 1] || prompts[3], answer, rng,
    visual: level <= 2 ? { type: 'sharing', total, groups: level === 2 ? divisor : divisor } : null,
    explanation: [`เริ่มจากของ ${total} ชิ้น`, `แบ่งเป็น ${divisor} กลุ่มเท่า ๆ กัน`, `แต่ละกลุ่มมี ${quotient}`, `${total} ÷ ${divisor} = ${quotient}`], inputMode: level === 4 ? 'number' : 'choice' });
}

export const STAGE_GENERATORS = {
  1: generateStage1,
  2: generateStage2,
  3: generateStage3,
  4: generateStage4,
  5: generateStage5,
  6: generateStage6,
};

export function generateQuestion(stage, level, rng = Math.random) {
  const generator = STAGE_GENERATORS[Number(stage)];
  if (!generator) throw new Error(`Unknown math stage: ${stage}`);
  return generator(clamp(Number(level) || 1, 1, 4), rng);
}

export function generateQuestionSet({ stage, level, count = 10, seed = Date.now() }) {
  const rng = createSeededRandom(seed);
  const result = [];
  const signatures = new Set();
  let attempts = 0;
  while (result.length < count && attempts < count * 30) {
    attempts += 1;
    const item = generateQuestion(stage, level, rng);
    const signature = `${item.prompt}|${item.answer}|${JSON.stringify(item.visual)}`;
    if (!signatures.has(signature)) {
      signatures.add(signature);
      result.push(item);
    }
  }
  // แบบฝึกที่มีชุดคำตอบจำกัด เช่น การแยก 5 มีคู่ไม่ซ้ำไม่ถึง 10 คู่
  // เติมข้อทบทวนให้ครบจำนวน โดยยังใช้ลำดับสุ่มจาก seed เดิม
  while (result.length < count) result.push(generateQuestion(stage, level, rng));
  return result;
}
