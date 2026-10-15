import test from 'node:test';
import assert from 'node:assert/strict';
import { bookWordTokens, createBookDictionary } from './bookWords.js';

const dictionary = createBookDictionary([
  { cn: '公园', pinyin: 'gōngyuán', th: 'สวนสาธารณะ' },
  { vocabulary: '星期天', pinyin_vocab: 'xīngqītiān', th: 'วันอาทิตย์' },
  { cn: '她', pinyin: 'tā', th: 'เธอ' },
]);

test('joins dictionary words across adjacent segments and keeps contextual pinyin', () => {
  const tokens = bookWordTokens([{ hanzi: '星期', pinyin: 'xīngqī' }, { hanzi: '天', pinyin: 'tiān' }, { hanzi: '她', pinyin: 'tā' }, { hanzi: '去', pinyin: 'qù' }, { hanzi: '公园', pinyin: 'gōng yuán' }], dictionary);
  assert.deepEqual(tokens.map(word => word.hanzi), ['星期天', '她', '去', '公园']);
  assert.equal(tokens[0].thai, 'วันอาทิตย์');
  assert.equal(tokens[0].pinyin, 'xīngqītiān');
  assert.equal(tokens[3].pinyin, 'gōng yuán');
  assert.equal(tokens[3].thai, 'สวนสาธารณะ');
});

test('does not merge vocabulary across punctuation or whitespace', () => {
  const tokens = bookWordTokens([{ hanzi: '星期' }, { hanzi: '，' }, { hanzi: '天' }, { hanzi: ' ' }, { hanzi: '公园' }], dictionary);
  assert.deepEqual(tokens.map(word => word.hanzi), ['星期', '，', '天', ' ', '公园']);
  assert.equal(tokens[1].clickable, false);
  assert.equal(tokens[3].clickable, false);
});

test('preserves unknown natural words so names and compounds can be looked up together', () => {
  const tokens = bookWordTokens([{ hanzi: '玲玲', pinyin: 'Língling' }, { hanzi: '香蕉皮', pinyin: 'xiāngjiāopí' }], dictionary);
  assert.deepEqual(tokens.map(word => word.hanzi), ['玲玲', '香蕉皮']);
  assert.equal(tokens[0].pinyin, 'Língling');
  assert.ok(tokens.every(word => word.clickable));
});

test('preserves every character and unique offsets with punctuation and supplementary Han', () => {
  const tokens = bookWordTokens([{ hanzi: '你好，𠮷！' }, { hanzi: 'ABC 123' }]);
  assert.equal(tokens.map(word => word.hanzi).join(''), '你好，𠮷！ABC 123');
  assert.equal(new Set(tokens.map(word => word.offset)).size, tokens.length);
  assert.equal(tokens.find(word => word.hanzi === '𠮷').clickable, true);
});

test('empty paragraphs and duplicate cards retain usable definitions', () => {
  assert.deepEqual(bookWordTokens(), []);
  const entries = createBookDictionary([{ cn: '好' }, { cn: '好', pinyin: 'hǎo', th: 'ดี' }, { cn: '' }]);
  assert.equal(entries.get('好').thai, 'ดี');
});
