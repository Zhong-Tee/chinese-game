export const norm = (v) => String(v || '').trim();

export const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

/** ตัดเครื่องหมายวรรคตอนทิ้ง (ทั้งไทย/อังกฤษ/จีน) */
export const stripPunct = (s) =>
  String(s || '').replace(/[,.，。、；;：:!?！？""''「」『』（）()\[\]【】~～·\-—_]/g, '');

/**
 * แบ่งประโยคเป็น token: ถ้ามีช่องว่าง → แบ่งตามช่องว่าง
 * ถ้าไม่มี (ภาษาจีน) → จับเป็นกลุ่มละ 2 ตัวอักษร จนเหลือเศษ 1 ตัวท้าย
 */
export function sentenceTokens(card) {
  let raw = stripPunct(norm(card?.sentence_test)).replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  if (raw.includes(' ')) return raw.split(/\s+/).filter(Boolean);

  const chars = Array.from(raw);
  const groups = [];
  for (let i = 0; i < chars.length; i += 2) {
    groups.push(chars.slice(i, i + 2).join(''));
  }
  return groups;
}

export function canRearrangeCard(card) {
  return sentenceTokens(card).length >= 2;
}

export function canTypingCard(card) {
  return Boolean(norm(card?.vocabulary));
}

export const FLASHCARD_EXTENDED_LEVELS = new Set([1, 2, 3, 4, 5, 6, 7]);

export function shouldFlashcardRearrange(level, card) {
  return FLASHCARD_EXTENDED_LEVELS.has(level) && canRearrangeCard(card);
}

export function shouldFlashcardTyping(level, card) {
  return FLASHCARD_EXTENDED_LEVELS.has(level) && canTypingCard(card);
}

export function compareTypingAnswer(typed, correct) {
  const clean = (s) => stripPunct(norm(s)).replace(/\s+/g, '');
  return clean(typed) === clean(correct);
}
