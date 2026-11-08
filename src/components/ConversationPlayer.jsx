import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { speakChinese, cancelChineseSpeech, preloadChineseSpeech } from '../utils/chineseSpeech';
import { getSfxMap } from '../utils/gameStorage';
import { playSfx, stopSfx } from '../utils/gameAudio';
import { shuffleIndices } from '../../supabase/functions/_shared/conversation';
import { memoryPending, practicePlan, retryVocabulary, moveToken, vocabularyChoices, pinyinLookup, ROUND_LABELS } from '../utils/conversationPractice';

const button = 'min-h-12 rounded-2xl px-4 py-3 font-bold disabled:opacity-40 disabled:cursor-not-allowed';
const primary = `${button} bg-teal-700 text-white`;
const secondary = `${button} border border-slate-300 bg-white text-slate-700`;
const panel = 'space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm';
const SFX_ID = 'conversation-correct';

function Chinese({ text, pinyin, lookup }) {
  const pronunciation = pinyin ? lookup(text) : '';
  return <span className="inline-flex flex-col items-center gap-1"><span lang="zh-CN">{text}</span>{pronunciation && <span className="text-sm font-normal text-teal-700">{pronunciation}</span>}</span>;
}
function Prompt({ text, pinyin, lookup }) {
  return String(text).split(/([\p{Script=Han}]+)/gu).map((part, i) => /\p{Script=Han}/u.test(part)
    ? <Chinese key={i} text={part} pinyin={pinyin} lookup={lookup} /> : part);
}

function usePracticeAudio() {
  const [error, setError] = useState('');
  const epoch = useRef(0);
  const alive = useRef(true);
  const sfx = useRef({});
  const cancel = useCallback(() => { epoch.current++; cancelChineseSpeech(); stopSfx(SFX_ID); }, []);
  useEffect(() => {
    alive.current = true;
    getSfxMap().then(value => { if (alive.current) sfx.current = value || {}; });
    preloadChineseSpeech();
    return () => { alive.current = false; cancel(); };
  }, [cancel]);
  const play = useCallback(async text => {
    cancel();
    const sequence = epoch.current;
    if (!text) return;
    if (!window.speechSynthesis) { setError('อุปกรณ์นี้ไม่รองรับเสียงอ่าน'); return; }
    setError('');
    try {
      await speakChinese(text, {
        shouldSpeak: () => alive.current && sequence === epoch.current,
        onError: event => {
          if (alive.current && sequence === epoch.current && !['interrupted', 'canceled'].includes(event.error)) setError('ยังเล่นเสียงอัตโนมัติไม่ได้ กรุณากดปุ่มฟังอีกครั้ง');
        },
      });
    } catch { if (alive.current && sequence === epoch.current) setError('เปิดเสียงไม่ได้ กรุณากดฟังอีกครั้ง'); }
  }, [cancel]);
  const correct = useCallback(() => {
    if (!alive.current) return;
    cancel();
    playSfx(sfx.current.flashcard_correct, 0.65, { stoppableId: SFX_ID });
  }, [cancel]);
  return { play, correct, cancel, error };
}

function Listen({ text, play }) {
  return <button type="button" className={secondary} onClick={() => play(text)} aria-label="ฟังเสียงภาษาจีนอีกครั้ง">🔊 ฟังอีกครั้ง</button>;
}
function useAutoAudio(text, play, cancel, turn = 0) {
  useEffect(() => { play(text); return cancel; }, [text, play, cancel, turn]);
}

function OrderWords({ q, value, onChange, disabled, pinyin, lookup, play }) {
  const [bank] = useState(() => shuffleIndices(q.tokens.length));
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const container = useRef(null);
  const [dragging, setDragging] = useState(null);
  function pointerDown(e, index) {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { index, token: value[index], x: e.clientX, y: e.clientY, moved: false };
  }
  function pointerMove(e) {
    const active = drag.current;
    if (!active || disabled) return;
    if (!active.moved && Math.hypot(e.clientX - active.x, e.clientY - active.y) < 8) return;
    active.moved = true;
    suppressClick.current = true;
    setDragging(active.token);
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-token-position]');
    if (!target || !container.current?.contains(target)) return;
    const to = Number(target.dataset.tokenPosition);
    if (to !== active.index) {
      const from = active.index;
      onChange(current => moveToken(current, from, to));
      active.index = to;
    }
  }
  function pointerEnd() {
    drag.current = null; setDragging(null);
    setTimeout(() => { suppressClick.current = false; }, 0);
  }
  return <>
    <p className="text-sm text-slate-500">แตะคำเพื่อเลือกและฟัง · ลากคำที่เลือกเพื่อสลับตำแหน่ง · แตะเพื่อนำออก หรือใช้ปุ่มลูกศรบนแป้นพิมพ์</p>
    <div ref={container} aria-label="ประโยคที่เรียงแล้ว" className="flex min-h-24 flex-wrap gap-2 rounded-2xl border-2 border-dashed border-teal-400 p-3">{value.map((id, i) => <button key={id} data-token-position={i} type="button" disabled={disabled} style={{ touchAction: 'none' }} className={`${secondary} ${dragging === id ? 'ring-2 ring-teal-500' : ''}`} onPointerDown={e => pointerDown(e, i)} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onKeyDown={e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); onChange(current => moveToken(current, i, i + (e.key === 'ArrowLeft' ? -1 : 1))); }
    }} onClick={() => { if (!suppressClick.current) onChange(current => current.filter(token => token !== id)); }}><Chinese text={q.tokens[id]} pinyin={pinyin} lookup={lookup} /></button>)}</div>
    <div className="flex flex-wrap gap-2">{bank.map(id => <button type="button" key={id} disabled={disabled || value.includes(id)} className={secondary} onClick={() => { onChange(current => [...current, id]); play(q.tokens[id]); }}><Chinese text={q.tokens[id]} pinyin={pinyin} lookup={lookup} /></button>)}</div>
  </>;
}

function Exercise({ course, unitIndex, index, onSaved, onNext, pinyin, lookup, audio }) {
  const q = course.content.units[unitIndex].questions[index];
  const [answer, setAnswer] = useState(q.kind === 'order' ? [] : null);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useAutoAudio(q.cn, audio.play, audio.cancel);
  async function check() {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError(''); audio.cancel();
    try {
      const { data, error } = await supabase.rpc('answer_conversation_question', { p_course: course.id, p_unit: unitIndex, p_question: index, p_answer: answer });
      if (error) throw error;
      onSaved(data); setResult(data.answers[index]);
      if (data.answers[index].correct) audio.correct();
    } catch { setError('บันทึกคำตอบไม่สำเร็จ กรุณาลองใหม่'); }
    finally { lock.current = false; setSaving(false); }
  }
  return <>
    <section className={panel}>
      <h3 className="text-xl font-bold"><Prompt text={q.prompt_th} pinyin={pinyin} lookup={lookup} /></h3>
      <Listen text={q.cn} play={audio.play} />
      {q.kind === 'listen' && <p className="text-sm text-slate-500">ฟังเสียงก่อนตอบ ข้อความและพินอินของเสียงจะเปิดหลังตอบ</p>}
      {q.kind === 'reply' && <div className="rounded-2xl bg-teal-50 p-4 text-2xl"><Chinese text={q.cn} pinyin={pinyin} lookup={lookup} /></div>}
      {q.kind === 'order' ? <OrderWords q={q} value={answer} onChange={setAnswer} disabled={saving || !!result} pinyin={pinyin} lookup={lookup} play={audio.play} /> : <div className="grid gap-3">{q.options.map((option, i) => <button key={i} type="button" disabled={saving || !!result} aria-pressed={answer === i} className={`${button} border-2 text-left ${answer === i ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-800'}`} onClick={() => setAnswer(i)}><Chinese text={option} pinyin={pinyin} lookup={lookup} /></button>)}</div>}
    </section>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {result ? <section role="status" className={`${panel} ${result.correct ? 'bg-emerald-50' : 'bg-amber-50'}`}><h3 className="text-xl font-black">{result.correct ? '✓ ถูกต้อง!' : 'ลองจำประโยคนี้อีกครั้ง'}</h3><p>คำตอบ: {q.kind === 'order' ? q.answer_order.map(i => q.tokens[i]).join('') : q.options[q.correct_index]}</p><div className="text-2xl"><Chinese text={q.cn} pinyin={pinyin} lookup={lookup} /></div><p>{q.th}</p><p>{q.explanation_th}</p><Listen text={q.cn} play={audio.play} /><button className={`${primary} w-full`} onClick={onNext}>ไปต่อ →</button></section> : <button className={`${primary} w-full`} disabled={saving || answer === null || (q.kind === 'order' && answer.length !== q.tokens.length)} onClick={check}>{saving ? 'กำลังบันทึก…' : 'ตรวจคำตอบ'}</button>}
  </>;
}

function MemoryRound({ course, unitIndex, round, initialProgress, onSaved, onNext, pinyin, lookup, audio }) {
  const unit = course.content.units[unitIndex];
  const [queue, setQueue] = useState(() => {
    const pending = memoryPending(unit, initialProgress, round);
    return shuffleIndices(pending.length || unit.vocabulary.length).map(i => pending.length ? pending[i] : i);
  });
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const [thaiOrder] = useState(() => shuffleIndices(unit.vocabulary.length));
  const [turn, setTurn] = useState(0);
  const [choices, setChoices] = useState(() => vocabularyChoices(unit, queue[0]));
  const word = round === 'start' ? left ?? queue[0] : queue[0];
  const item = unit.vocabulary[word];
  // End round asks Thai -> Chinese. Read an instruction in Chinese instead of leaking its answer.
  const speech = !queue.length ? '' : round === 'end' ? '请选择正确的词语。' : unit.vocabulary[queue[0]].cn;
  useAutoAudio(speech, audio.play, audio.cancel, turn);
  async function check() {
    if (lock.current || right === null || (round === 'start' && left === null)) return;
    lock.current = true; setSaving(true); setError(''); audio.cancel();
    try {
      const { data, error } = await supabase.rpc('answer_conversation_vocabulary', { p_course: course.id, p_unit: unitIndex, p_round: round, p_word: word, p_choice: right });
      if (error) throw error;
      const correct = data.memory[round][word].correct;
      setResult({ correct, word }); onSaved(data);
      if (correct) audio.correct();
    } catch { setError('บันทึกช่วงฝึกจำไม่ได้ กรุณาลองใหม่ หากเพิ่งอัปเดตให้ติดตั้งฐานข้อมูลช่วงฝึกจำก่อน'); }
    finally { lock.current = false; setSaving(false); }
  }
  function next() {
    const ordered = [word, ...queue.filter(i => i !== word)];
    const nextQueue = retryVocabulary(ordered, result.correct);
    setQueue(nextQueue); setLeft(null); setRight(null); setResult(null);
    setTurn(value => value + 1);
    if (nextQueue.length) setChoices(vocabularyChoices(unit, nextQueue[0]));
  }
  if (!queue.length) return <section className={panel}><h3 className="text-xl font-black">✓ จำคำศัพท์ครบช่วงนี้แล้ว</h3><p>ตอบถูกครบ {unit.vocabulary.length} คำ บันทึกไว้ให้เรียนต่อได้แล้ว</p><button className={`${primary} w-full`} onClick={onNext}>เรียนต่อ →</button></section>;
  return <>
    <section className={panel}><h3 className="text-xl font-black">{ROUND_LABELS[round]}</h3><p className="text-sm text-slate-500">เหลือ {queue.length} คำ · ตอบผิดจะกลับมาอีกหลังคำอื่น จนตอบถูกครบ</p><Listen text={speech} play={audio.play} />
      {round === 'start' ? <div className="grid grid-cols-2 gap-3"><div className="space-y-3"><p className="font-bold">คำศัพท์จีน</p>{queue.map(i => <button key={i} className={`${secondary} w-full ${left === i ? 'ring-2 ring-teal-500' : ''}`} disabled={saving || !!result} onClick={() => { setLeft(i); audio.play(unit.vocabulary[i].cn); }}><Chinese text={unit.vocabulary[i].cn} pinyin={pinyin} lookup={lookup} /></button>)}</div><div className="space-y-3"><p className="font-bold">ความหมายไทย</p>{thaiOrder.filter(i => queue.includes(i)).map(i => <button key={i} className={`${secondary} w-full ${right === i ? 'ring-2 ring-teal-500' : ''}`} disabled={saving || !!result} onClick={() => setRight(i)}>{unit.vocabulary[i].th}</button>)}</div></div> : <>
        <p className="text-sm font-bold">{round === 'middle' ? 'คำนี้หมายถึงอะไร?' : 'ความหมายนี้ตรงกับคำจีนใด?'}</p><div className="text-2xl font-bold">{round === 'middle' ? <Chinese text={item.cn} pinyin={pinyin} lookup={lookup} /> : item.th}</div>
        <div className="grid gap-3">{choices.map(i => <button key={i} className={`${secondary} text-left ${right === i ? 'ring-2 ring-teal-500' : ''}`} disabled={saving || !!result} onClick={() => setRight(i)}>{round === 'middle' ? unit.vocabulary[i].th : <Chinese text={unit.vocabulary[i].cn} pinyin={pinyin} lookup={lookup} />}</button>)}</div>
      </>}
    </section>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {result ? <section role="status" className={`${panel} ${result.correct ? 'bg-emerald-50' : 'bg-amber-50'}`}><h3 className="font-black">{result.correct ? '✓ ถูกต้อง!' : 'ยังไม่ถูก คำนี้จะกลับมาให้ฝึกอีกครั้ง'}</h3><div className="text-xl"><Chinese text={item.cn} pinyin={pinyin} lookup={lookup} /></div><p>{item.th}</p><Listen text={item.cn} play={audio.play} /><button className={`${primary} w-full`} onClick={next}>ไปต่อ →</button></section> : <button className={`${primary} w-full`} disabled={saving || right === null || (round === 'start' && left === null)} onClick={check}>{saving ? 'กำลังบันทึก…' : round === 'start' ? 'ตรวจคู่คำศัพท์' : 'ตรวจคำตอบ'}</button>}
  </>;
}

export default function ConversationPlayer({ course, unitIndex, initialProgress, mode, onSaved, onExit }) {
  const unit = course.content.units[unitIndex];
  const [stage, setStage] = useState(mode === 'review' ? 'practice' : 'teach');
  const [plan] = useState(() => practicePlan(unit, initialProgress, mode));
  const [position, setPosition] = useState(0);
  const [progress, setProgress] = useState(initialProgress);
  const [pinyin, setPinyin] = useState(() => { try { return localStorage.getItem('conversation-pinyin') !== 'off'; } catch { return true; } });
  const lookup = useMemo(() => pinyinLookup(course), [course]);
  const audio = usePracticeAudio();
  const step = plan[position];
  function saved(row) { setProgress(row); onSaved(row); }
  function next() { audio.cancel(); setPosition(current => current + 1); }
  const wrong = Object.values(progress?.answers || {}).filter(a => !a.correct).length;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><button className={secondary} onClick={onExit}>← พัก / กลับชุดบทเรียน</button><label className="flex min-h-12 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pinyin} onChange={e => { setPinyin(e.target.checked); try { localStorage.setItem('conversation-pinyin', e.target.checked ? 'on' : 'off'); } catch { /* Optional preference storage. */ } }} />แสดงพินอิน</label></div>
    <div><p className="text-sm font-bold text-teal-700">{course.topic} · บทที่ {unitIndex + 1}</p><h2 className="text-2xl font-black">{unit.title}</h2></div>
    {audio.error && <p role="status" className="text-sm text-amber-700">{audio.error}</p>}
    {stage === 'teach' ? <><section className={panel}><h3 className="text-xl font-bold">เรียนรู้ก่อนฝึก</h3><p className="whitespace-pre-line">{unit.teaching_th}</p><p className="text-sm text-slate-500">ฝึกจำต้นบท → แบบฝึกครึ่งแรก → ฝึกจำกลางบท → แบบฝึกครึ่งหลัง → ฝึกจำท้ายบท</p></section>{[...unit.vocabulary, ...unit.patterns].map((item, i) => <div key={i} className={panel}><div className="text-2xl"><Chinese text={item.cn} pinyin={pinyin} lookup={lookup} /></div><p>{item.th}</p><Listen text={item.cn} play={audio.play} /></div>)}<button className={`${primary} w-full`} onClick={() => setStage('practice')}>เริ่มฝึก / เรียนต่อ →</button></> : !step ? <section className={`${panel} text-center`}><p className="text-4xl">🎉</p><h3 className="text-2xl font-black">{mode === 'review' ? 'ทบทวนครบแล้ว!' : 'ฝึกครบแล้ว!'}</h3><p>บันทึกผลเรียบร้อยแล้ว</p><p>{wrong ? `มี ${wrong} ข้อที่ควรทบทวน` : 'คำตอบที่ฝึกแล้วถูกทั้งหมด'}</p><button className={primary} onClick={onExit}>กลับไปเลือกบทเรียน</button></section> : <>
      <div className="space-y-2"><p className="text-sm text-slate-500">ช่วงที่ {position + 1}/{plan.length} · {step.type === 'memory' ? ROUND_LABELS[step.round] : `แบบฝึกข้อ ${step.index + 1}`}</p><progress className="h-3 w-full accent-teal-600" value={position} max={plan.length} aria-label="ความคืบหน้าแบบฝึก" /></div>
      {step.type === 'memory' ? <MemoryRound key={`memory-${position}`} course={course} unitIndex={unitIndex} round={step.round} initialProgress={progress} onSaved={saved} onNext={next} pinyin={pinyin} lookup={lookup} audio={audio} /> : <Exercise key={`question-${position}`} course={course} unitIndex={unitIndex} index={step.index} onSaved={saved} onNext={next} pinyin={pinyin} lookup={lookup} audio={audio} />}
    </>}
  </div>;
}
