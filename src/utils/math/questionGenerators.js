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

function question({ stage, level, skill, prompt, answer, explanation, rng, visual, inputMode }) {
  return {
    id: `${stage}-${level}-${skill}-${Math.floor(rng() * 1e9)}`,
    stage,
    level,
    skill,
    prompt,
    answer,
    choices: makeChoices(answer, rng, 0, 100),
    explanation,
    visual: visual || null,
    inputMode: inputMode || (level >= 3 ? 'number' : 'choice'),
  };
}

export function generateStage1(level = 1, rng = Math.random) {
  const first = int(rng, 1, 9);
  const answer = 10 - first;
  const pair = [Math.min(first, answer), Math.max(first, answer)].join('-');
  if (level === 2) {
    return question({ stage: 1, level, skill: `numberBond.${pair}`, prompt: `ลากความคิดมาจับคู่: ${first} ต้องจับคู่กับเลขใดจึงเป็น 10?`, answer, rng,
      visual: { type: 'tenFrame', filled: first }, explanation: [`ในกรอบสิบมีแล้ว ${first} จุด`, `ยังว่างอีก ${answer} จุด`, `${first} + ${answer} = 10`] });
  }
  if (level === 4) {
    return question({ stage: 1, level, skill: `numberBond.${pair}`, prompt: `10 = ${first} + ?`, answer, rng,
      explanation: [`เริ่มจาก ${first}`, `นับต่ออีก ${answer} ครั้งจึงถึง 10`, `ดังนั้น 10 = ${first} + ${answer}`] });
  }
  return question({ stage: 1, level, skill: `numberBond.${pair}`, prompt: `${first} + ? = 10`, answer, rng,
    visual: { type: 'tenFrame', filled: first }, explanation: [`ดูช่องที่มีอยู่ ${first} ช่อง`, `เติมช่องว่าง ${answer} ช่อง`, `${first} + ${answer} = 10`], inputMode: level === 3 ? 'number' : 'choice' });
}

export function generateStage2(level = 1, rng = Math.random) {
  const first = int(rng, 6, 9);
  const second = int(rng, 3, 9);
  const toTen = 10 - first;
  const rest = second - toTen;
  if (level === 1) {
    return question({ stage: 2, level, skill: 'addition.make10', prompt: `${first} + ? = 10`, answer: toTen, rng,
      visual: { type: 'tenFrame', filled: first }, explanation: [`${first} ต้องการอีก ${toTen} เพื่อให้ครบ 10`, `${first} + ${toTen} = 10`] });
  }
  if (level === 2) {
    return question({ stage: 2, level, skill: 'addition.splitNumber', prompt: `${first} + ${second} โดยแยก ${second} = ${toTen} + ?`, answer: rest, rng,
      explanation: [`${first} ต้องการ ${toTen} เพื่อครบ 10`, `จึงแยก ${second} เป็น ${toTen} + ${rest}`, `${first} + ${toTen} = 10`] });
  }
  const answer = first + second;
  return question({ stage: 2, level, skill: level === 3 ? 'addition.splitNumber' : 'addition.mentalAddition', prompt: `${first} + ${second} = ?`, answer, rng,
    explanation: [`${first} ต้องการ ${toTen} เพื่อครบ 10`, `แยก ${second} เป็น ${toTen} + ${rest}`, `${first} + ${toTen} = 10`, `10 + ${rest} = ${answer}`], inputMode: 'number' });
}

export function generateStage3(level = 1, rng = Math.random) {
  if (level === 1) {
    const subtract = int(rng, 1, 9);
    return question({ stage: 3, level, skill: 'subtraction.subtractFrom10', prompt: `10 − ${subtract} = ?`, answer: 10 - subtract, rng,
      visual: { type: 'tenFrame', filled: 10, removed: subtract }, explanation: [`มี 10 เอาออก ${subtract}`, `เหลือ ${10 - subtract}`] });
  }
  const ones = int(rng, 1, 8);
  const whole = 10 + ones;
  if (level === 2) {
    return question({ stage: 3, level, skill: 'subtraction.splitTeenNumber', prompt: `${whole} = 10 + ?`, answer: ones, rng,
      visual: { type: 'numberTree', whole, left: 10, right: ones }, explanation: [`แยกหลักสิบของ ${whole}`, `${whole} มี 10 กับ ${ones}`, `${whole} = 10 + ${ones}`] });
  }
  const subtract = int(rng, ones + 1, 9);
  const fromTen = 10 - subtract;
  const answer = ones + fromTen;
  return question({ stage: 3, level, skill: level === 3 ? 'subtraction.break10' : 'subtraction.mentalSubtraction', prompt: `${whole} − ${subtract} = ?`, answer, rng,
    visual: { type: 'numberTree', whole, left: 10, right: ones }, explanation: [`แยก ${whole} เป็น 10 กับ ${ones}`, `10 − ${subtract} = ${fromTen}`, `${fromTen} + ${ones} = ${answer}`], inputMode: 'number' });
}

export function generateStage4(level = 1, rng = Math.random) {
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
  return question({ stage: 4, level, skill, prompt: prompts[level - 1] || prompts[3], answer, rng,
    visual: level === 1 ? { type: 'groups', groups, size } : level === 3 ? { type: 'array', rows: groups, columns: size } : null,
    explanation: [`มี ${groups} กลุ่ม กลุ่มละ ${size}`, `${Array(groups).fill(size).join(' + ')} = ${answer}`, `${groups} × ${size} = ${answer}`], inputMode: level === 4 ? 'number' : 'choice' });
}

export function generateStage5(level = 1, rng = Math.random) {
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
  return question({ stage: 5, level, skill, prompt: prompts[level - 1] || prompts[3], answer, rng,
    visual: level <= 2 ? { type: 'sharing', total, groups: level === 2 ? divisor : divisor } : null,
    explanation: [`เริ่มจากของ ${total} ชิ้น`, `แบ่งเป็น ${divisor} กลุ่มเท่า ๆ กัน`, `แต่ละกลุ่มมี ${quotient}`, `${total} ÷ ${divisor} = ${quotient}`], inputMode: level === 4 ? 'number' : 'choice' });
}

export function generateStage6(level = 1, rng = Math.random, preferredStage) {
  const source = preferredStage || pick(rng, [2, 3, 4, 5]);
  const generators = { 2: generateStage2, 3: generateStage3, 4: generateStage4, 5: generateStage5 };
  const generated = generators[source](4, rng);
  return { ...generated, id: `6-${generated.id}`, stage: 6, level, skill: `mental.${generated.skill}` };
}

export const STAGE_GENERATORS = {
  1: generateStage1,
  2: generateStage2,
  3: generateStage3,
  4: generateStage4,
  5: generateStage5,
  6: generateStage6,
};

export function generateQuestion(stage, level, rng = Math.random, options = {}) {
  const generator = STAGE_GENERATORS[Number(stage)];
  if (!generator) throw new Error(`Unknown math stage: ${stage}`);
  return generator(clamp(Number(level) || 1, 1, 4), rng, options.preferredStage);
}

export function generateQuestionSet({ stage, level, count = 10, seed = Date.now() }) {
  const rng = createSeededRandom(seed);
  const result = [];
  const signatures = new Set();
  let attempts = 0;
  while (result.length < count && attempts < count * 30) {
    attempts += 1;
    const item = generateQuestion(stage, level, rng);
    const signature = `${item.prompt}|${item.answer}`;
    if (!signatures.has(signature)) {
      signatures.add(signature);
      result.push(item);
    }
  }
  return result;
}
