import React, { useEffect, useRef, useState } from 'react';
import { ActionButton, BOARD_W, COL, EquationPill, ErrorHint, StepChips, X, arrowDown, boxBase, branchPath, signBase, tagBase } from './MathSplitKit';

/**
 * ผังลบแบบยืมหลักสิบ (ด่านลบ ระดับ 2 และ 3)
 * ใช้กริด 4 คอลัมน์ชุดเดียวกับผังบวก/ผังลบข้ามสิบ แล้ววางเป็นการลบแนวตั้ง
 * คอลัมน์ซ้าย = หลักสิบ, คอลัมน์ขวา = หลักหน่วยหลังยืม
 */
const Y = { row1: 0, borrow: 80, row2: 104, tag: 164, rule: 192, row3: 200 };
const BOARD_H = 252;
const cleanNumber = (value) => value.replace(/[^0-9]/g, '').slice(0, 2);

export default function MathBorrowingSplit({ visual, onSubmit }) {
  const { whole, subtract, tensRemainder, borrowedOnes, subtractTens, subtractOnes, tensDifference, onesDifference, finalAnswer, requireFinal } = visual;
  const [borrowedValue, setBorrowedValue] = useState('');
  const [onesValue, setOnesValue] = useState('');
  const [finalValue, setFinalValue] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const onesRef = useRef(null);
  const finalRef = useRef(null);

  useEffect(() => {
    if (step === 2) onesRef.current?.focus();
    if (step === 3) finalRef.current?.focus();
  }, [step]);

  const checkBorrowed = () => {
    if (Number(borrowedValue) === borrowedOnes) {
      setError('');
      setStep(2);
    } else {
      setBorrowedValue('');
      setError(`เมื่อยืม 1 สิบ เลขหลักหน่วย ${whole % 10} จะเพิ่มขึ้นอีก 10`);
    }
  };

  const checkOnes = () => {
    if (Number(onesValue) === onesDifference) {
      setError('');
      setStep(requireFinal ? 3 : 4);
    } else {
      setOnesValue('');
      setError(`ลองคำนวณ ${borrowedOnes} − ${subtractOnes} อีกครั้ง`);
      onesRef.current?.focus();
    }
  };

  const checkFinal = () => {
    if (Number(finalValue) === finalAnswer) {
      setError('');
      setStep(4);
    } else {
      setFinalValue('');
      setError(`นำ ${tensDifference} บวกกับ ${onesDifference} อีกครั้ง`);
      finalRef.current?.focus();
    }
  };

  const stateOf = (target) => (step > target ? 'done' : step === target ? 'active' : 'idle');
  const steps = [
    { label: 'ยืม 1 สิบ', tone: 'emerald', state: stateOf(1) },
    { label: 'ลบหลักหน่วย', tone: 'amber', state: stateOf(2) },
    ...(requireFinal ? [{ label: 'รวมคำตอบ', tone: 'indigo', state: stateOf(3) }] : []),
  ];

  return (
    <div className="mt-5 rounded-[1.75rem] bg-gradient-to-b from-cyan-50 to-indigo-50 p-4 shadow-inner ring-1 ring-cyan-100">
      <StepChips steps={steps} />

      <div
        className="relative mx-auto w-full max-w-[17rem] font-black text-slate-800"
        style={{ height: BOARD_H }}
        aria-label={`${whole} ลบ ${subtract} โดยยืมหนึ่งสิบ`}
      >
        <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <g fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {/* แยกตัวตั้งเป็นหลักสิบกับหลักหน่วยหลังยืม */}
            <path d={branchPath(X.b, 52, X.a, X.c, Y.row2)} stroke="#22d3ee" vectorEffect="non-scaling-stroke" />
            <path d={arrowDown(X.a, Y.row2)} stroke="#22d3ee" vectorEffect="non-scaling-stroke" />
            <path d={arrowDown(X.c, Y.row2)} stroke="#22d3ee" vectorEffect="non-scaling-stroke" />

            {/* เส้นขีดของการลบแนวตั้ง */}
            <path d={`M${X.a - 30} ${Y.rule} H${X.a + 30}`} stroke="#67e8f9" vectorEffect="non-scaling-stroke" />
            <path d={`M${X.c - 30} ${Y.rule} H${X.c + 30}`} stroke={step > 2 ? '#fbbf24' : '#e2e8f0'} vectorEffect="non-scaling-stroke" />
          </g>
        </svg>

        {/* แถวบน: โจทย์ตั้งต้น */}
        <span className={`${boxBase} bg-cyan-500 text-white shadow-md shadow-cyan-200`} style={{ left: COL.b, top: Y.row1 }}>{whole}</span>
        <span className={`${signBase} text-rose-400`} style={{ left: COL.c, top: Y.row1 }}>−</span>
        <span className={`${boxBase} bg-rose-500 text-white shadow-md shadow-rose-200`} style={{ left: COL.d, top: Y.row1 }}>{subtract}</span>

        <span className="absolute flex h-5 w-[4.5rem] -translate-x-1/2 items-center justify-center rounded-full bg-orange-100 text-[0.625rem] font-black text-orange-600" style={{ left: COL.b, top: Y.borrow }}>ยืม 1 สิบ</span>

        {/* แถวกลาง: หลักสิบ + หลักหน่วยหลังยืม */}
        <span className={`${boxBase} border-4 border-cyan-300 bg-white text-cyan-700 shadow-sm`} style={{ left: COL.a, top: Y.row2 }}>{tensRemainder}</span>
        <span className={`${signBase} text-cyan-400`} style={{ left: COL.b, top: Y.row2 }}>+</span>
        <input
          value={borrowedValue}
          onChange={(event) => setBorrowedValue(cleanNumber(event.target.value))}
          onKeyDown={(event) => { if (event.key === 'Enter' && borrowedValue) checkBorrowed(); }}
          inputMode="numeric"
          disabled={step > 1}
          autoFocus
          aria-label="จำนวนหลักหน่วยหลังยืม"
          placeholder="?"
          style={{ left: COL.c, top: Y.row2 }}
          className={`${boxBase} border-4 text-center outline-none ${step > 1
            ? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-200'
            : 'animate-pulse border-dashed border-emerald-400 bg-white text-emerald-600 shadow-sm focus:animate-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100'}`}
        />

        {/* ป้ายบอกว่าแต่ละหลักถูกลบด้วยเท่าไร */}
        <span className={`${tagBase} ${subtractTens ? 'bg-rose-100 text-rose-600' : 'bg-cyan-100 text-cyan-600'}`} style={{ left: COL.a, top: Y.tag }}>{subtractTens ? `− ${subtractTens}` : 'คงเดิม'}</span>
        <span className={`${tagBase} bg-rose-100 text-rose-600`} style={{ left: COL.c, top: Y.tag }}>− {subtractOnes}</span>

        {/* แถวล่าง: ผลลัพธ์แต่ละหลัก */}
        <span className={`${boxBase} border-4 border-cyan-300 bg-cyan-50 text-cyan-700 shadow-sm`} style={{ left: COL.a, top: Y.row3 }}>{tensDifference}</span>
        <span className={`${signBase} ${step > 2 ? 'text-emerald-500' : 'text-slate-300'}`} style={{ left: COL.b, top: Y.row3 }}>+</span>
        <input
          ref={onesRef}
          value={onesValue}
          onChange={(event) => setOnesValue(cleanNumber(event.target.value))}
          onKeyDown={(event) => { if (event.key === 'Enter' && onesValue) checkOnes(); }}
          inputMode="numeric"
          disabled={step !== 2}
          aria-label="ผลลบหลักหน่วย"
          placeholder="?"
          style={{ left: COL.c, top: Y.row3 }}
          className={`${boxBase} border-4 text-center outline-none ${step > 2
            ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-200'
            : 'border-dashed border-amber-400 bg-white text-amber-600 shadow-sm focus:border-amber-600 focus:ring-4 focus:ring-amber-100 disabled:animate-none disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none'} ${step === 2 ? 'animate-pulse focus:animate-none' : ''}`}
        />
        <span
          className={`${signBase} whitespace-nowrap text-xl ${step >= 4 ? 'text-indigo-700' : 'text-slate-300'}`}
          style={{ left: COL.d, top: Y.row3 }}
        >= {step >= 4 ? finalAnswer : '?'}</span>
      </div>

      <div className="mt-4 text-center">
        {step === 1 && (
          <>
            <p className="text-sm font-bold text-slate-600">ขั้นที่ 1: ยืม 1 สิบ แล้วหลักหน่วยเป็นเท่าไร?</p>
            <ErrorHint>{error}</ErrorHint>
            <ActionButton tone="emerald" disabled={!borrowedValue} onClick={checkBorrowed}>ตรวจเลขช่องแรก</ActionButton>
          </>
        )}

        {step === 2 && (
          <>
            <EquationPill tone="cyan">{whole} = {tensRemainder} + {borrowedOnes} ✓</EquationPill>
            <p className="mt-3 text-sm font-bold text-slate-600">ขั้นที่ 2: {borrowedOnes} − {subtractOnes} เท่ากับเท่าไร?</p>
            <ErrorHint>{error}</ErrorHint>
            <ActionButton tone="amber" disabled={!onesValue} onClick={checkOnes}>ตรวจเลขช่องที่สอง</ActionButton>
          </>
        )}

        {step === 3 && (
          <>
            <EquationPill tone="amber">{borrowedOnes} − {subtractOnes} = {onesDifference} ✓</EquationPill>
            <p className="mt-3 text-sm font-bold text-slate-600">ขั้นที่ 3: {tensDifference} + {onesDifference} เท่ากับเท่าไร?</p>
            <input
              ref={finalRef}
              value={finalValue}
              onChange={(event) => setFinalValue(cleanNumber(event.target.value))}
              onKeyDown={(event) => { if (event.key === 'Enter' && finalValue) checkFinal(); }}
              inputMode="numeric"
              aria-label="คำตอบหลังยืม"
              placeholder="?"
              className="mt-3 w-full rounded-2xl border-4 border-indigo-200 bg-white p-3 text-center text-2xl font-black text-indigo-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
            <ErrorHint>{error}</ErrorHint>
            <ActionButton tone="indigo" disabled={!finalValue} onClick={checkFinal}>ตรวจคำตอบสุดท้าย</ActionButton>
          </>
        )}

        {step === 4 && (
          <div className="space-y-2">
            <EquationPill tone="cyan">{whole} = {tensRemainder} + {borrowedOnes} ✓</EquationPill>
            <div className="text-xl leading-none text-slate-300">↓</div>
            <EquationPill tone="amber">{borrowedOnes} − {subtractOnes} = {onesDifference}</EquationPill>
            <div className="rounded-2xl bg-indigo-600 px-4 py-3 text-xl font-black text-white shadow-md shadow-indigo-200">
              {tensDifference} + {onesDifference} = {finalAnswer}
            </div>
            <ActionButton tone="indigo" onClick={() => onSubmit(finalAnswer)}>ยืนยันคำตอบ</ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
