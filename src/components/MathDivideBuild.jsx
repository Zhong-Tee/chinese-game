import React, { useRef, useState } from 'react';
import { ActionButton, EquationPill, ErrorHint, StepChips } from './MathSplitKit';
import { Dot, DotArray, DotPool } from './MathDotPictures';

/**
 * ด่านหาร ระดับ 1–3
 * ระดับ 1 แบ่งของทีละรอบจนหมดกอง แล้วอ่านว่าคนละกี่ชิ้น (การแบ่งเท่า ๆ กัน)
 * ระดับ 2 วงทีละกลุ่มจนหมดกอง แล้วอ่านว่าได้กี่กลุ่ม (การจัดกลุ่ม)
 * ระดับ 3 ใช้ประโยคคูณที่รู้แล้วมาเขียนเป็นประโยคหาร 2 ประโยค (ครอบครัวสูตรคูณ)
 */
const cleanNumber = (value) => value.replace(/[^0-9]/g, '').slice(0, 3);
const slotBox = 'flex h-12 w-14 items-center justify-center rounded-2xl border-4 text-center text-2xl font-black outline-none transition-all duration-300';

function Basket({ count, label }) {
  return (
    <div className="flex w-[4.25rem] flex-col items-center gap-1 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-1.5">
      <div className="flex min-h-8 flex-wrap items-center justify-center gap-1">
        {count === 0
          ? <span className="text-[0.625rem] font-black text-emerald-400">ว่าง</span>
          : Array.from({ length: count }, (_, index) => <Dot key={index} tone="emerald" />)}
      </div>
      <span className="text-[0.625rem] font-black text-emerald-600">{label}</span>
    </div>
  );
}

export default function MathDivideBuild({ visual, answer, onSubmit }) {
  const { mode, total, divisor, quotient } = visual;
  // ระดับ 1 แจกทีละรอบ (รอบละ divisor ชิ้น) ระดับ 2 วงทีละกลุ่ม (กลุ่มละ quotient ชิ้น)
  const perAction = mode === 'share' ? divisor : quotient;
  const maxActions = mode === 'share' ? quotient : divisor;
  const [done, setDone] = useState(0);
  const [firstValue, setFirstValue] = useState('');
  const [secondValue, setSecondValue] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const firstRef = useRef(null);

  const remaining = total - done * perAction;

  const checkQuotient = () => {
    if (Number(firstValue) === answer) {
      setError('');
      setStep(2);
    } else {
      setFirstValue('');
      setError(mode === 'share'
        ? `ลองกด "แจกคนละ 1 ชิ้น" จนของหมดกอง แล้วนับว่าตะกร้าหนึ่งใบมีกี่ชิ้น`
        : `ลองกด "วงอีก 1 กลุ่ม" จนของหมดกอง แล้วนับว่าได้ทั้งหมดกี่กลุ่ม`);
      firstRef.current?.focus();
    }
  };

  const checkFamily = () => {
    if (Number(firstValue) !== quotient) {
      setError(`แบ่ง ${total} ออกเป็น ${divisor} กลุ่มเท่า ๆ กัน ดูจากตารางว่าแถวหนึ่งมีกี่จุด`);
      setFirstValue('');
      firstRef.current?.focus();
      return;
    }
    if (Number(secondValue) !== divisor) {
      setError(`อีกประโยคใช้ตัวเลขชุดเดียวกัน ${total} ÷ ${quotient} จึงได้อีกตัวที่เหลือ`);
      setSecondValue('');
      return;
    }
    setError('');
    setStep(2);
  };

  if (mode === 'factFamily') {
    return (
      <div className="mt-5 rounded-[1.75rem] bg-gradient-to-b from-rose-50 to-indigo-50 p-4 shadow-inner ring-1 ring-rose-100">
        <StepChips steps={[
          { label: 'เขียน 2 ประโยคหาร', tone: 'emerald', state: step === 1 ? 'active' : 'done' },
        ]} />

        <div className="overflow-x-auto"><DotArray rows={divisor} columns={quotient} /></div>

        <div className="mt-3 space-y-2">
          <EquationPill tone="violet">{divisor} × {quotient} = {total}</EquationPill>

          <div className="flex items-center justify-center gap-2 text-2xl font-black text-slate-700">
            <span>{total}</span><span className="text-rose-400">÷</span><span>{divisor}</span><span className="text-slate-400">=</span>
            <input
              ref={firstRef}
              value={firstValue}
              onChange={(event) => { setFirstValue(cleanNumber(event.target.value)); setError(''); }}
              inputMode="numeric"
              disabled={step > 1}
              autoFocus
              aria-label={`ผลหาร ${total} หารด้วย ${divisor}`}
              placeholder="?"
              className={`${slotBox} ${step > 1
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'animate-pulse border-dashed border-emerald-400 bg-white text-emerald-600 focus:animate-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100'}`}
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-2xl font-black text-slate-700">
            <span>{total}</span><span className="text-rose-400">÷</span><span>{quotient}</span><span className="text-slate-400">=</span>
            <input
              value={secondValue}
              onChange={(event) => { setSecondValue(cleanNumber(event.target.value)); setError(''); }}
              onKeyDown={(event) => { if (event.key === 'Enter' && firstValue && secondValue) checkFamily(); }}
              inputMode="numeric"
              disabled={step > 1}
              aria-label={`ผลหาร ${total} หารด้วย ${quotient}`}
              placeholder="?"
              className={`${slotBox} ${step > 1
                ? 'border-amber-500 bg-amber-500 text-white'
                : 'border-dashed border-amber-400 bg-white text-amber-600 focus:border-amber-600 focus:ring-4 focus:ring-amber-100'}`}
            />
          </div>
        </div>

        <div className="mt-3 text-center">
          {step === 1 ? (
            <>
              <p className="text-sm font-bold text-slate-600">ประโยคคูณหนึ่งประโยค เขียนเป็นประโยคหารได้ 2 ประโยค</p>
              <ErrorHint>{error}</ErrorHint>
              <ActionButton tone="emerald" disabled={!firstValue || !secondValue} onClick={checkFamily}>ตรวจทั้งสองประโยค</ActionButton>
            </>
          ) : (
            <div className="space-y-2">
              <div className="rounded-2xl bg-indigo-600 px-4 py-3 text-lg font-black text-white shadow-md shadow-indigo-200">
                {divisor} × {quotient} = {total}<br />{total} ÷ {divisor} = {quotient} และ {total} ÷ {quotient} = {divisor}
              </div>
              <ActionButton tone="indigo" onClick={() => onSubmit(answer)}>ยืนยันคำตอบ</ActionButton>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-[1.75rem] bg-gradient-to-b from-rose-50 to-indigo-50 p-4 shadow-inner ring-1 ring-rose-100">
      <StepChips steps={[
        { label: mode === 'share' ? 'แจกให้ครบ' : 'วงให้ครบ', tone: 'emerald', state: step === 1 ? 'active' : 'done' },
        { label: 'ตอบ', tone: 'amber', state: step === 1 ? 'idle' : 'done' },
      ]} />

      <p className="mb-2 text-center text-xs font-black text-sky-600">เหลือในกอง {remaining} ชิ้น</p>
      <div className="overflow-x-auto"><DotPool count={remaining} /></div>

      <div className="mt-3 flex flex-wrap items-start justify-center gap-2">
        {Array.from({ length: mode === 'share' ? divisor : done }, (_, index) => (
          <Basket
            key={index}
            count={mode === 'share' ? done : quotient}
            label={mode === 'share' ? `คนที่ ${index + 1}` : `กลุ่มที่ ${index + 1}`}
          />
        ))}
        {mode === 'group' && done === 0 && <p className="py-3 text-xs font-bold text-slate-400">ยังไม่ได้วงกลุ่มเลย</p>}
      </div>

      <button
        type="button"
        disabled={remaining < perAction}
        onClick={() => setDone(value => Math.min(maxActions, value + 1))}
        className="mt-3 w-full rounded-2xl bg-sky-500 py-3 font-black text-white shadow-[0_4px_0_#0284c7] transition active:translate-y-1 active:shadow-none disabled:opacity-40"
      >
        {mode === 'share' ? `แจกคนละ 1 ชิ้น (ใช้ ${perAction} ชิ้น)` : `วงอีก 1 กลุ่ม (กลุ่มละ ${perAction} ชิ้น)`}
      </button>

      <div className="mt-4 flex items-center justify-center gap-2 text-2xl font-black text-slate-700">
        <span>{total}</span>
        <span className="text-rose-400">÷</span>
        <span>{mode === 'share' ? divisor : quotient}</span>
        <span className="text-slate-400">=</span>
        {step === 1 ? (
          <input
            ref={firstRef}
            value={firstValue}
            onChange={(event) => { setFirstValue(cleanNumber(event.target.value)); setError(''); }}
            onKeyDown={(event) => { if (event.key === 'Enter' && firstValue) checkQuotient(); }}
            inputMode="numeric"
            autoFocus
            aria-label={mode === 'share' ? 'จำนวนที่แต่ละคนได้' : 'จำนวนกลุ่มที่ได้'}
            placeholder="?"
            className={`${slotBox} animate-pulse border-dashed border-amber-400 bg-white text-amber-600 focus:animate-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100`}
          />
        ) : (
          <span className={`${slotBox} border-amber-500 bg-amber-500 text-white`}>{answer}</span>
        )}
      </div>
      <p className="mt-1 text-center text-[0.65rem] font-bold text-amber-600">{mode === 'share' ? 'คนละกี่ชิ้น' : 'ได้กี่กลุ่ม'}</p>

      <div className="mt-3 text-center">
        {step === 1 ? (
          <>
            <ErrorHint>{error}</ErrorHint>
            <ActionButton tone="amber" disabled={!firstValue} onClick={checkQuotient}>ตรวจคำตอบ</ActionButton>
          </>
        ) : (
          <div className="space-y-2">
            <EquationPill tone="emerald">
              {mode === 'share' ? `แบ่ง ${total} ให้ ${divisor} คน คนละ ${quotient}` : `${total} จัดกลุ่มละ ${quotient} ได้ ${divisor} กลุ่ม`} ✓
            </EquationPill>
            <div className="rounded-2xl bg-indigo-600 px-4 py-3 text-xl font-black text-white shadow-md shadow-indigo-200">
              {divisor} × {quotient} = {total}
            </div>
            <ActionButton tone="indigo" onClick={() => onSubmit(answer)}>ยืนยันคำตอบ</ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
