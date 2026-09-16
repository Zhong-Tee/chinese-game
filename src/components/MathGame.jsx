import React, { useEffect, useMemo, useRef, useState } from 'react';
import MathVisual from './MathVisual';
import MathSplitAnswer from './MathSplitAnswer';
import MathMakeTenBond from './MathMakeTenBond';
import MathSubtractionSplit from './MathSubtractionSplit';
import MathBorrowingSplit from './MathBorrowingSplit';
import MathCutTenSplit from './MathCutTenSplit';
import MathMultiplyBuild from './MathMultiplyBuild';
import MathDivideBuild from './MathDivideBuild';
import { buildDailyTraining } from '../utils/math/dailyTraining';
import { createSeededRandom, generateQuestion, generateQuestionSet } from '../utils/math/questionGenerators';
import { getMathSummary, MATH_STAGE_META, recordMathAnswer } from '../utils/math/mathProgress';
import { saveMathProgress, saveMathSession } from '../utils/math/mathStorage';
import { getSfxMap } from '../utils/gameStorage';
import { playFlashcardCorrectSfx, playFlashcardWrongSfx } from '../utils/flashcardSfx';

const praise = ['เก่งมาก!', 'เยี่ยมเลย!', 'คิดได้ดีมาก!', 'สุดยอด!'];

export default function MathGame({ user, config, onExit, onReward }) {
  const initialQuestions = useMemo(() => config.mode === 'daily'
    ? buildDailyTraining(config.progress, { userId: user?.id, count: 18 })
    : generateQuestionSet({ stage: config.stage, level: config.level, count: 10, seed: config.seed }), [config, user?.id]);
  const [questions, setQuestions] = useState(initialQuestions);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [progress, setProgress] = useState(config.progress);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalResponseMs, setTotalResponseMs] = useState(0);
  const [finished, setFinished] = useState(initialQuestions.length === 0);
  const startedAt = useRef(0);
  const sfxRef = useRef({});
  const draggedAnswerRef = useRef(null);
  const question = questions[index];
  const stageMeta = MATH_STAGE_META.find(item => item.stage === question?.stage);

  useEffect(() => {
    startedAt.current = Date.now();
    getSfxMap().then(value => { sfxRef.current = value; }).catch(() => {});
  }, []);

  const commitSession = async (finalProgress, correct, responseTotal, total) => {
    await saveMathProgress(user?.id, finalProgress);
    await saveMathSession(user?.id, { mode: config.mode, stage: config.stage, level: config.level, total, correct, totalResponseMs: responseTotal });
    const earned = correct * 2 + (correct === total ? 10 : 0);
    if (earned > 0) await onReward?.(earned);
  };

  const submit = async (selected = answer) => {
    if (feedback || selected === '' || selected == null) return;
    const numeric = Number(selected);
    if (!Number.isFinite(numeric)) return;
    const correct = numeric === question.answer;
    if (correct) playFlashcardCorrectSfx(sfxRef.current);
    else playFlashcardWrongSfx(sfxRef.current);
    const responseMs = Math.max(200, Date.now() - startedAt.current);
    const updated = recordMathAnswer(progress, question, correct, responseMs);
    setProgress(updated);
    setCorrectCount(value => value + (correct ? 1 : 0));
    setTotalResponseMs(value => value + responseMs);
    setFeedback(correct ? { type: 'correct', title: praise[Math.floor(Math.random() * praise.length)] } : { type: 'wrong', title: 'ลองดูวิธีคิดกัน' });
    await saveMathProgress(user?.id, updated);
    if (!correct) {
      const rng = createSeededRandom(`${question.id}:retry`);
      const retry = generateQuestion(question.stage, question.level, rng);
      setQuestions(items => [...items.slice(0, index + 1), retry, ...items.slice(index + 1)]);
    }
  };

  const next = async () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      await commitSession(progress, correctCount, totalResponseMs, questions.length);
      return;
    }
    setIndex(value => value + 1);
    setAnswer('');
    setFeedback(null);
    startedAt.current = Date.now();
  };

  if (finished) {
    const summary = getMathSummary(progress);
    return (
      <div className="math-screen min-h-full rounded-[2rem] bg-gradient-to-b from-indigo-100 to-amber-50 p-5 flex flex-col items-center justify-center text-center">
        <div className="text-7xl">🏆</div>
        <h1 className="mt-3 text-3xl font-black text-indigo-700">ฝึกเสร็จแล้ว!</h1>
        <p className="mt-2 font-bold text-slate-500">วันนี้หนูตอบถูก {correctCount} จาก {questions.length} ข้อ</p>
        <div className="mt-6 grid w-full grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white p-3 shadow"><div className="text-2xl font-black text-emerald-500">{correctCount}</div><div className="text-xs font-bold">ถูก</div></div>
          <div className="rounded-2xl bg-white p-3 shadow"><div className="text-2xl font-black text-rose-500">{questions.length - correctCount}</div><div className="text-xs font-bold">ฝึกเพิ่ม</div></div>
          <div className="rounded-2xl bg-white p-3 shadow"><div className="text-2xl font-black text-violet-500">{summary.mastery}</div><div className="text-xs font-bold">ความชำนาญ</div></div>
        </div>
        <button onClick={onExit} className="mt-8 w-full rounded-2xl bg-indigo-600 py-4 text-lg font-black text-white shadow-[0_5px_0_#3730a3] active:translate-y-1">กลับหน้าคณิตศาสตร์</button>
      </div>
    );
  }

  return (
    <div className="math-screen min-h-full rounded-[2rem] bg-gradient-to-b from-sky-100 to-indigo-50 p-4 text-slate-800">
      <div className="flex items-center gap-3">
        <button onClick={onExit} className="h-10 w-10 rounded-full bg-white font-black text-indigo-500 shadow">×</button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white shadow-inner"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500 transition-all" style={{ width: `${((index + (feedback ? 1 : 0)) / questions.length) * 100}%` }} /></div>
        <span className="text-xs font-black text-indigo-500">{index + 1}/{questions.length}</span>
      </div>

      <div className="mt-4 text-center text-xs font-black tracking-wider text-indigo-400">{config.mode === 'daily' ? `ฝึกประจำวัน • ด่านที่ ${question.stage}` : `ด่านที่ ${question.stage} • ระดับ ${question.level}`}</div>
      <div className="mt-1 text-center text-sm font-black text-slate-500">{stageMeta?.icon} {stageMeta?.thai}</div>

      <section className="mt-4 rounded-[2rem] bg-white p-5 shadow-xl">
        <h1 className="whitespace-pre-line text-center text-2xl font-black leading-snug text-slate-800">{question.prompt}</h1>
        {!['bond-split', 'split-two', 'subtraction-split', 'borrowing-split', 'cut-ten-split', 'multiply-build', 'divide-build'].includes(question.inputMode) && <MathVisual visual={question.visual} />}
        {!feedback && question.inputMode === 'bond-split' && (
          <MathMakeTenBond key={question.id} visual={question.visual} answer={question.answer} onSubmit={submit} />
        )}
        {!feedback && question.inputMode === 'split-two' && (
          <MathSplitAnswer
            key={question.id}
            visual={question.visual}
            answer={question.answer}
            onSubmit={submit}
          />
        )}
        {!feedback && question.inputMode === 'subtraction-split' && (
          <MathSubtractionSplit key={question.id} visual={question.visual} answer={question.answer} onSubmit={submit} />
        )}
        {!feedback && question.inputMode === 'borrowing-split' && (
          <MathBorrowingSplit key={question.id} visual={question.visual} onSubmit={submit} />
        )}
        {!feedback && question.inputMode === 'cut-ten-split' && (
          <MathCutTenSplit key={question.id} visual={question.visual} answer={question.answer} onSubmit={submit} />
        )}
        {!feedback && question.inputMode === 'multiply-build' && (
          <MathMultiplyBuild key={question.id} visual={question.visual} answer={question.answer} onSubmit={submit} />
        )}
        {!feedback && question.inputMode === 'divide-build' && (
          <MathDivideBuild key={question.id} visual={question.visual} answer={question.answer} onSubmit={submit} />
        )}

        {!feedback && question.inputMode === 'choice' && (
          <div className="mt-5 grid grid-cols-2 gap-3">{question.choices.map(choice => <button key={choice} onClick={() => { setAnswer(choice); submit(choice); }} className={`rounded-2xl border-2 border-indigo-100 bg-indigo-50 py-4 font-black text-indigo-700 shadow-sm active:scale-95 ${question.choiceLabels ? 'text-base sm:text-lg' : 'text-2xl'}`}>{question.choiceLabels?.[String(choice)] || choice}</button>)}</div>
        )}
        {!feedback && question.inputMode === 'number' && (
          <form onSubmit={event => { event.preventDefault(); submit(); }} className="mt-5">
            <input value={answer} onChange={event => setAnswer(event.target.value.replace(/[^0-9-]/g, ''))} inputMode="numeric" autoFocus aria-label="คำตอบ" placeholder="?" className="w-full rounded-2xl border-4 border-indigo-100 bg-indigo-50 p-4 text-center text-3xl font-black outline-none focus:border-indigo-400" />
            <button disabled={answer === ''} className="mt-3 w-full rounded-2xl bg-indigo-600 py-4 text-lg font-black text-white shadow-[0_5px_0_#3730a3] disabled:opacity-40">ตรวจคำตอบ</button>
          </form>
        )}
        {!feedback && question.inputMode === 'drag' && (
          <div className="mt-5">
            <div
              data-math-drop-target
              onPointerUp={() => {
                if (draggedAnswerRef.current != null) submit(draggedAnswerRef.current);
                draggedAnswerRef.current = null;
              }}
              className="flex min-h-24 items-center justify-center rounded-3xl border-4 border-dashed border-indigo-300 bg-indigo-50 px-4 text-center font-black text-indigo-500"
            >
              ลากตัวเลขที่ถูกต้องมาวางตรงนี้
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {question.choices.map(choice => (
                <button
                  key={choice}
                  type="button"
                  onPointerDown={() => { draggedAnswerRef.current = choice; }}
                  onPointerUp={(event) => {
                    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-math-drop-target]');
                    if (target) submit(choice);
                    draggedAnswerRef.current = null;
                  }}
                  onClick={() => setAnswer(choice)}
                  className={`touch-none rounded-2xl border-2 py-4 text-2xl font-black shadow-sm active:scale-95 ${Number(answer) === choice ? 'border-indigo-500 bg-indigo-200 text-indigo-800' : 'border-indigo-100 bg-white text-indigo-600'}`}
                >
                  {choice}
                </button>
              ))}
            </div>
            <button type="button" disabled={answer === ''} onClick={() => submit(answer)} className="mt-3 w-full rounded-2xl bg-indigo-600 py-3 font-black text-white shadow disabled:opacity-40">
              แตะตัวเลขแล้วกดจับคู่
            </button>
          </div>
        )}

        {feedback && (
          <div className={`mt-5 rounded-3xl p-4 ${feedback.type === 'correct' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
            <div className={`text-center text-4xl ${feedback.type === 'correct' ? 'animate-bounce' : ''}`}>{feedback.type === 'correct' ? '🌟' : '💡'}</div>
            <h2 className="text-center text-xl font-black">{feedback.title}</h2>
            {feedback.type === 'wrong' && <div className="mt-4 space-y-2">{question.explanation.map((step, stepIndex) => <div key={step} className="flex items-center gap-3 rounded-xl bg-white/80 p-3 font-bold"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white">{stepIndex + 1}</span>{step}</div>)}</div>}
            {feedback.type === 'correct' && (
              question.inputMode === 'bond-split'
                ? <div className="mt-2 text-center font-bold">{question.visual.second} = {question.answer} + {question.visual.second - question.answer}<br />ดังนั้น {question.visual.first} + {question.visual.second} = {question.visual.first + question.visual.second}</div>
                : question.inputMode === 'split-two'
                ? <div className="mt-2 text-center font-bold">{question.visual.target ?? 10} + {question.answer} = {question.visual.first + question.visual.second}<br />ดังนั้น {question.visual.first} + {question.visual.second} = {question.visual.first + question.visual.second}</div>
                : question.inputMode === 'subtraction-split'
                  ? <div className="mt-2 text-center font-bold">{question.visual.base} − {question.visual.subtract} = {question.answer}<br />{question.visual.remainder} + {question.answer} = {question.visual.finalAnswer}</div>
                : question.inputMode === 'borrowing-split'
                  ? <div className="mt-2 text-center font-bold">{question.visual.borrowedOnes} − {question.visual.subtractOnes} = {question.visual.onesDifference}<br />{question.visual.tensDifference} + {question.visual.onesDifference} = {question.answer}</div>
                : question.inputMode === 'cut-ten-split'
                  ? <div className="mt-2 text-center font-bold">{question.visual.subtract} = {question.visual.firstCut} + {question.visual.secondCut}<br />{question.visual.whole} − {question.visual.firstCut} = {question.visual.base} แล้ว {question.visual.base} − {question.visual.secondCut} = {question.visual.finalAnswer}</div>
                : question.inputMode === 'multiply-build'
                  ? <div className="mt-2 text-center font-bold">{question.visual.groups} × {question.visual.size} = {question.visual.product}</div>
                : question.inputMode === 'divide-build'
                  ? <div className="mt-2 text-center font-bold">{question.visual.divisor} × {question.visual.quotient} = {question.visual.total}<br />{question.visual.total} ÷ {question.visual.divisor} = {question.visual.quotient}</div>
                : question.choiceLabels
                  ? <div className="mt-2 text-center font-bold">เลือก {question.choiceLabels[String(question.answer)]}</div>
                  : <div className="mt-2 text-center font-bold">คำตอบคือ {question.answer}</div>
            )}
            <button onClick={next} className={`mt-4 w-full rounded-2xl py-3 font-black text-white shadow ${feedback.type === 'correct' ? 'bg-emerald-500' : 'bg-amber-500'}`}>{feedback.type === 'wrong' ? 'ลองข้อใกล้เคียงต่อ →' : 'ข้อต่อไป →'}</button>
          </div>
        )}
      </section>
    </div>
  );
}
