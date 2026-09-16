import React, { useEffect, useRef, useState } from 'react';
import { ActionButton, BOARD_W, COL, EquationPill, ErrorHint, StepChips, X, arrowDown, boxBase, branchPath, signBase } from './MathSplitKit';

/**
 * ผังลบแบบตัด 10 (ด่านลบ10 ระดับ 1–3)
 * แยก "ตัวลบ" เป็นสองส่วน ส่วนแรกเท่ากับหลักหน่วยของตัวตั้งเพื่อตัดให้ลงมาพอดีหลักสิบ
 * แล้วจึงลบส่วนที่เหลือต่อ เช่น 14 − 9 → แยก 9 เป็น 4 กับ 5 → 14 − 4 = 10 → 10 − 5 = 5
 */
const Y = { row1: 0, row2: 104, tag: 164 };
const BOARD_H = 190;
const cleanNumber = (value) => value.replace(/[^0-9]/g, '').slice(0, 2);
const chainBox = 'flex h-11 w-12 items-center justify-center rounded-xl border-4 text-center text-xl font-black outline-none transition-all duration-300';

export default function MathCutTenSplit({ visual, answer, onSubmit }) {
  const { whole, subtract, firstCut, secondCut, base, finalAnswer, requireBase, requireFinal } = visual;
  const [firstValue, setFirstValue] = useState('');
  const [secondValue, setSecondValue] = useState('');
  const [baseValue, setBaseValue] = useState('');
  const [finalValue, setFinalValue] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const firstRef = useRef(null);
  const baseRef = useRef(null);
  const finalRef = useRef(null);

  const afterSplit = requireBase ? 2 : requireFinal ? 3 : 4;

  useEffect(() => {
    if (step === 2) baseRef.current?.focus();
    if (step === 3) finalRef.current?.focus();
  }, [step]);

  const checkSplit = () => {
    const left = Number(firstValue);
    const right = Number(secondValue);
    if (left + right !== subtract) {
      setError(`สองส่วนรวมกันต้องได้ ${subtract} แต่ตอนนี้ได้ ${left + right}`);
      return;
    }
    if (left !== firstCut) {
      setError(`ส่วนแรกต้องเท่ากับหลักหน่วยของ ${whole} คือ ${firstCut} จึงจะตัดลงมาเหลือ ${base} พอดี`);
      setFirstValue('');
      setSecondValue('');
      firstRef.current?.focus();
      return;
    }
    setError('');
    setStep(afterSplit);
  };

  const checkBase = () => {
    if (Number(baseValue) === base) {
      setError('');
      setStep(requireFinal ? 3 : 4);
    } else {
      setBaseValue('');
      setError(`ตัด ${firstCut} ออกจาก ${whole} แล้วจะเหลือพอดีหลักสิบ ลองอีกครั้ง`);
      baseRef.current?.focus();
    }
  };

  const checkFinal = () => {
    if (Number(finalValue) === finalAnswer) {
      setError('');
      setStep(4);
    } else {
      setFinalValue('');
      setError(`ลองคำนวณ ${base} − ${secondCut} อีกครั้ง`);
      finalRef.current?.focus();
    }
  };

  const stateOf = (target) => (step > target ? 'done' : step === target ? 'active' : 'idle');
  const steps = [
    { label: `แยก ${subtract}`, tone: 'emerald', state: stateOf(1) },
    ...(requireBase ? [{ label: `ตัดเหลือ ${base}`, tone: 'amber', state: stateOf(2) }] : []),
    ...(requireFinal ? [{ label: 'ลบต่อ', tone: 'indigo', state: stateOf(3) }] : []),
  ];

  return (
    <div className="mt-5 rounded-[1.75rem] bg-gradient-to-b from-lime-50 to-emerald-50 p-4 shadow-inner ring-1 ring-lime-100">
      <StepChips steps={steps} />

      <div
        className="relative mx-auto w-full max-w-[17rem] font-black text-slate-800"
        style={{ height: BOARD_H }}
        aria-label={`${whole} ลบ ${subtract} โดยแยก ${subtract} เป็นสองส่วน แล้วตัด ${whole} ให้เหลือ ${base}`}
      >
        <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <g fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {/* แตกกิ่งจากตัวลบลงไปเป็นสองส่วน */}
            <path d={branchPath(X.c, 52, X.b, X.d, Y.row2)} stroke="#fb7185" vectorEffect="non-scaling-stroke" />
            <path d={arrowDown(X.b, Y.row2)} stroke="#fb7185" vectorEffect="non-scaling-stroke" />
            <path d={arrowDown(X.d, Y.row2)} stroke="#fb7185" vectorEffect="non-scaling-stroke" />

            {/* ส่วนแรกวิ่งกลับไปตัดกับตัวตั้ง */}
            <path d={`M${X.b} ${Y.row2 + 52} V${Y.row2 + 74} H${X.a} V78`} stroke={step > 1 ? '#65a30d' : '#d9f99d'} vectorEffect="non-scaling-stroke" />
            <path d={`M${X.a - 6} 89 L${X.a} 78 L${X.a + 6} 89`} stroke={step > 1 ? '#65a30d' : '#d9f99d'} vectorEffect="non-scaling-stroke" />
          </g>
        </svg>

        {/* แถวบน: โจทย์ตั้งต้น */}
        <span className={`${boxBase} bg-lime-600 text-white shadow-md shadow-lime-200`} style={{ left: COL.a, top: Y.row1 }}>{whole}</span>
        <span className={`${signBase} text-rose-400`} style={{ left: COL.b, top: Y.row1 }}>−</span>
        <span className={`${boxBase} bg-rose-500 text-white shadow-md shadow-rose-200`} style={{ left: COL.c, top: Y.row1 }}>{subtract}</span>

        {/* แถวกลาง: สองส่วนของตัวลบที่เด็กกรอกเอง */}
        <input
          ref={firstRef}
          value={firstValue}
          onChange={(event) => { setFirstValue(cleanNumber(event.target.value)); setError(''); }}
          inputMode="numeric"
          disabled={step > 1}
          autoFocus
          aria-label={`ส่วนที่ตัด ${whole} ให้เหลือ ${base}`}
          placeholder="?"
          style={{ left: COL.b, top: Y.row2 }}
          className={`${boxBase} border-4 text-center outline-none ${step > 1
            ? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-200'
            : 'animate-pulse border-dashed border-emerald-400 bg-white text-emerald-600 shadow-sm focus:animate-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100'}`}
        />
        <input
          value={secondValue}
          onChange={(event) => { setSecondValue(cleanNumber(event.target.value)); setError(''); }}
          onKeyDown={(event) => { if (event.key === 'Enter' && firstValue && secondValue) checkSplit(); }}
          inputMode="numeric"
          disabled={step > 1}
          aria-label="ส่วนที่เหลือของตัวลบ"
          placeholder="?"
          style={{ left: COL.d, top: Y.row2 }}
          className={`${boxBase} border-4 text-center outline-none ${step > 1
            ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-200'
            : 'border-dashed border-amber-400 bg-white text-amber-600 shadow-sm focus:border-amber-600 focus:ring-4 focus:ring-amber-100'}`}
        />

        <span className="absolute flex h-6 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-emerald-100 text-[0.625rem] font-black text-emerald-600" style={{ left: COL.b, top: Y.tag }}>ตัดก่อน</span>
        <span className="absolute flex h-6 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-amber-100 text-[0.625rem] font-black text-amber-600" style={{ left: COL.d, top: Y.tag }}>ลบต่อ</span>
      </div>

      {/* บันไดลบสองขั้น เผยให้เห็นหลังแยกตัวลบถูก */}
      {step > 1 && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xl font-black text-slate-700">
            <span>{whole}</span>
            <span className="text-rose-400">−</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-lg text-white">{firstCut}</span>
            <span className="text-slate-400">=</span>
            {requireBase && step === 2 ? (
              <input
                ref={baseRef}
                value={baseValue}
                onChange={(event) => { setBaseValue(cleanNumber(event.target.value)); setError(''); }}
                onKeyDown={(event) => { if (event.key === 'Enter' && baseValue) checkBase(); }}
                inputMode="numeric"
                aria-label={`ผลลัพธ์ของ ${whole} ลบ ${firstCut}`}
                placeholder="?"
                className={`${chainBox} animate-pulse border-dashed border-amber-400 bg-white text-amber-600 focus:animate-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100`}
              />
            ) : (
              <span className={`${chainBox} border-lime-400 bg-lime-50 text-lime-700`}>{base}</span>
            )}
          </div>

          <div className={`flex items-center justify-center gap-1.5 text-xl font-black ${step >= 3 ? 'text-slate-700' : 'text-slate-300'}`}>
            <span>{base}</span>
            <span className={step >= 3 ? 'text-rose-400' : 'text-slate-300'}>−</span>
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${step >= 3 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-white'}`}>{secondCut}</span>
            <span className="text-slate-400">=</span>
            {requireFinal && step === 3 ? (
              <input
                ref={finalRef}
                value={finalValue}
                onChange={(event) => { setFinalValue(cleanNumber(event.target.value)); setError(''); }}
                onKeyDown={(event) => { if (event.key === 'Enter' && finalValue) checkFinal(); }}
                inputMode="numeric"
                aria-label="คำตอบสุดท้าย"
                placeholder="?"
                className={`${chainBox} animate-pulse border-dashed border-indigo-400 bg-white text-indigo-600 focus:animate-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100`}
              />
            ) : (
              <span className={`${chainBox} ${step >= 4 ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-dashed border-slate-200 bg-white text-slate-300'}`}>{step >= 4 ? finalAnswer : '?'}</span>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 text-center">
        {step === 1 && (
          <>
            <p className="text-sm font-bold text-slate-600">ขั้นที่ 1: แยก {subtract} เป็น 2 ส่วน ให้ส่วนแรกตัด {whole} เหลือ {base} พอดี</p>
            <ErrorHint>{error}</ErrorHint>
            <ActionButton tone="emerald" disabled={!firstValue || !secondValue} onClick={checkSplit}>ตรวจการแยกตัวลบ</ActionButton>
          </>
        )}

        {step === 2 && (
          <>
            <EquationPill tone="emerald">{subtract} = {firstCut} + {secondCut} ✓</EquationPill>
            <p className="mt-3 text-sm font-bold text-slate-600">ขั้นที่ 2: {whole} − {firstCut} เท่ากับเท่าไร?</p>
            <ErrorHint>{error}</ErrorHint>
            <ActionButton tone="amber" disabled={!baseValue} onClick={checkBase}>ตรวจเลขที่ตัดได้</ActionButton>
          </>
        )}

        {step === 3 && (
          <>
            <EquationPill tone="amber">{whole} − {firstCut} = {base} ✓</EquationPill>
            <p className="mt-3 text-sm font-bold text-slate-600">ขั้นที่ {requireBase ? 3 : 2}: {base} − {secondCut} เท่ากับเท่าไร?</p>
            <ErrorHint>{error}</ErrorHint>
            <ActionButton tone="indigo" disabled={!finalValue} onClick={checkFinal}>ตรวจคำตอบสุดท้าย</ActionButton>
          </>
        )}

        {step === 4 && (
          <div className="space-y-2">
            <EquationPill tone="emerald">{subtract} = {firstCut} + {secondCut} ✓</EquationPill>
            <div className="text-xl leading-none text-slate-300">↓</div>
            <div className="rounded-2xl bg-indigo-600 px-4 py-3 text-xl font-black text-white shadow-md shadow-indigo-200">
              {whole} − {subtract} = {finalAnswer}
            </div>
            <ActionButton tone="indigo" onClick={() => onSubmit(answer)}>ยืนยันคำตอบ</ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
