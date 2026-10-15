const hasChinese = (text) => /\p{Script=Han}/u.test(text);

export function createBookDictionary(cards = []) {
  const dictionary = new Map();
  for (const card of cards) {
    const hanzi = String(card.cn || card.vocabulary || '').trim();
    if (!hanzi || !hasChinese(hanzi)) continue;
    const entry = { hanzi, pinyin: String(card.pinyin || card.pinyin_vocab || '').trim(), thai: String(card.th || card.thai || '').trim() };
    if (!dictionary.has(hanzi) || (!dictionary.get(hanzi).thai && entry.thai)) dictionary.set(hanzi, entry);
  }
  return dictionary;
}

// Preserve natural word boundaries, joining segments for longer dictionary words.
// Punctuation and whitespace always stop a match.
export function bookWordTokens(segments = [], dictionary = new Map()) {
  const text = segments.map((segment) => segment.hanzi || '').join('');
  const sources = new Map();
  let offset = 0;
  for (const segment of segments) {
    const hanzi = String(segment.hanzi || '');
    sources.set(offset, { ...segment, hanzi });
    offset += hanzi.length;
  }
  const tokens = [];
  for (let index = 0; index < text.length;) {
    const source = sources.get(index);
    const remaining = text.slice(index);
    const chineseRun = remaining.match(/^\p{Script=Han}+/u)?.[0] || '';
    let hanzi = chineseRun && source ? source.hanzi.match(/^\p{Script=Han}+/u)?.[0] || '' : '';
    if (!hanzi && chineseRun) hanzi = Array.from(chineseRun)[0];
    for (let length = chineseRun.length; length > hanzi.length; length -= 1) {
      const candidate = chineseRun.slice(0, length);
      if (dictionary.has(candidate)) { hanzi = candidate; break; }
    }
    if (!hanzi) hanzi = Array.from(remaining)[0];
    const entry = dictionary.get(hanzi);
    const exactSource = source?.hanzi === hanzi ? source : null;
    tokens.push({ hanzi, pinyin: exactSource?.pinyin || entry?.pinyin || '', thai: exactSource?.thai || entry?.thai || '', clickable: hasChinese(hanzi), offset: index });
    index += hanzi.length;
  }
  return tokens;
}
