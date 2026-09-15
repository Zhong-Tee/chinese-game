import React, { useEffect, useRef, useState } from 'react';
import { ActionButton, BOARD_W, COL, EquationPill, ErrorHint, StepChips, X, arrowDown, boxBase, branchPath, signBase, tagBase } from './MathSplitKit';

/**
 * ผังลบข้ามหลักสิบ (ด่านลบ ระดับ 2 และ 3)
 * แยกตัวตั้งเป็น "เศษที่เหลือ" กับ "สิบ" แล้วลบเฉพาะคอลัมน์สิบ
 * วางเป็นคอลัมน์แบบการลบแนวตั้ง จึงอ่านง่ายและได้สัดส่วนเท่ากันทั้งสองฝั่ง
 */
const Y = { row1: 0, row2: 104, tag: 164, rule: 192, row3: 200 };
const BOARD_H = 252;
const cleanNumber = (value) => value.replace(/[^0-9]/g, '').slice(0, 2);

export default function MathSubtractionSplit({ visual, answer, onSubmit }) {
  const { whole, subtract, base, remainder, finalAnswer } = visual;
  const [remainderValue, setRemainderValue] = useState('');
  const [differenceValue, setDifferenceValue] = useState('');
  const [remainderDone, setRemainderDone] = useState(false);
  const [differenceDone, setDifferenceDone] = useState(false);
  const [error, setError] = useState('');
  const differenceRef = useRef(null);

  useEffect(() => {
    if (remainderDone) differenceRef.current?.focus();
  }, [remainderDone]);

  const checkRemainder = () => {
    if (Number(remainderValue) === remainder) {
      setRemainderDone(true);
      setError('');
    } else {
      setRemainderValue('');
      setError(`ลองแยก ${whole} ให้มี ${base} อยู่หนึ่งส่วน`);
    }
  };

  const checkDifference = () => {
    if (Number(differenceValue) === answer) {
      setDifferenceDone(true);
      setError('');
    } else {
      setDifferenceValue('');
      setError(`ลองคำนวณ ${base} − ${subtract} อีกครั้ง`);
      differenceRef.current?.focus();
    }
  };

  const step = !remainderDone ? 1 : !differenceDone ? 2 : 3;

  return (
    <div className="mt-5 rounded-[1.75rem] bg-gradient-to-b from-violet-50 to-indigo-50 p-4 shadow-inner ring-1 ring-violet-100">
      <StepChips steps={[
        { label: `แยก ${whole}`, tone: 'emerald', state: step === 1 ? 'active' : 'done' },
        { label: `${base} − ${subtract}`, tone: 'amber', state: step === 1 ? 'idle' : step === 2 ? 'active' : 'done' },
      ]} />

      <div
        className="relative mx-auto w-full max-w-[17rem] font-black text-slate-800"
        style={{ height: BOARD_H }}
        aria-label={`${whole} ลบ ${subtract} โดยแยก ${whole} เป็น ${remainder} กับ ${base}`}
      >
        <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <g fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {/* แยกตัวตั้งออกเป็นเศษที่เหลือ กับ หลักสิบ */}
            <path d={branchPath(X.b, 52, X.a, X.c, Y.row2)} stroke="#a78bfa" vectorEffect="non-scaling-stroke" />
            <path d={arrowDown(X.a, Y.row2)} stroke="#a78bfa" vectorEffect="non-scaling-stroke" />
            <path d={arrowDown(X.c, Y.row2)} stroke="#a78bfa" vectorEffect="non-scaling-stroke" />

            {/* ตัวลบวิ่งลงไปเข้าคอลัมน์หลักสิบ */}
            <path d={`M${X.d} 52 V176 H${X.c + 36}`} stroke="#fb7185" vectorEffect="non-scaling-stroke" />
            <path d={`M${X.c + 43} 170 L${X.c + 30} 176 L${X.c + 43} 182`} stroke="#fb7185" vectorEffect="non-scaling-stroke" />

            {/* เส้นขีดของการลบแนวตั้ง */}
            <path d={`M${X.a - 30} ${Y.rule} H${X.a + 30}`} stroke={remainderDone ? '#34d399' : '#e2e8f0'} vectorEffect="non-scaling-stroke" />
            <path d={`M${X.c - 30} ${Y.rule} H${X.c + 30}`} stroke={differenceDone ? '#fbbf24' : '#e2e8f0'} vectorEffect="non-scaling-stroke" />
          </g>
        </svg>

        {/* แถวบน: โจทย์ตั้งต้น */}
        <span className={`${boxBase} bg-violet-500 text-white shadow-md shadow-violet-200`} style={{ left: COL.b, top: Y.row1 }}>{whole}</span>
        <span className={`${signBase} text-rose-400`} style={{ left: COL.c, top: Y.row1 }}>−</span>
        <span className={`${boxBase} bg-rose-500 text-white shadow-md shadow-rose-200`} style={{ left: COL.d, top: Y.row1 }}>{subtract}</span>

        {/* แถวกลาง: สองส่วนที่แยกได้ */}
        <input
          value={remainderValue}
          onChange={(event) => setRemainderValue(cleanNumber(event.target.value))}
          onKeyDown={(event) => { if (event.key === 'Enter' && remainderValue) checkRemainder(); }}
          inputMode="numeric"
          disabled={remainderDone}
          autoFocus
          aria-label="จำนวนที่เหลือเมื่อแยกสิบออก"
          placeholder="?"
          style={{ left: COL.a, top: Y.row2 }}
          className={`${boxBase} border-4 text-center outline-none ${remainderDone
            ? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-200'
            : 'animate-pulse border-dashed border-emerald-400 bg-white text-emerald-600 shadow-sm focus:animate-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100'}`}
        />
        <span className={`${signBase} text-violet-400`} style={{ left: COL.b, top: Y.row2 }}>+</span>
        <span className={`${boxBase} border-4 border-violet-300 bg-white text-violet-700 shadow-sm`} style={{ left: COL.c, top: Y.row2 }}>{base}</span>

        {/* ป้ายบอกว่าคอลัมน์ไหนถูกลบ */}
        <span className={`${tagBase} bg-emerald-100 text-emerald-600`} style={{ left: COL.a, top: Y.tag }}>คงเดิม</span>
        <span className={`${tagBase} bg-rose-100 text-rose-600`} style={{ left: COL.c, top: Y.tag }}>− {subtract}</span>

        {/* แถวล่าง: ผลลัพธ์ */}
        <span
          className={`${boxBase} border-4 ${remainderDone ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-dashed border-slate-200 bg-white text-slate-300'}`}
          style={{ left: COL.a, top: Y.row3 }}
        >{remainderDone ? remainder : '?'}</span>
        <span className={`${signBase} ${differenceDone ? 'text-emerald-500' : 'text-slate-300'}`} style={{ left: COL.b, top: Y.row3 }}>+</span>
        <input
          ref={differenceRef}
          value={differenceValue}
          onChange={(event) => setDifferenceValue(cleanNumber(event.target.value))}
          onKeyDown={(event) => { if (event.key === 'Enter' && differenceValue) checkDifference(); }}
          inputMode="numeric"
          disabled={!remainderDone || differenceDone}
          aria-label={`ผลลัพธ์ของ ${base} ลบ ${subtract}`}
          placeholder="?"
          style={{ left: COL.c, top: Y.row3 }}
          className={`${boxBase} border-4 text-center outline-none ${differenceDone
            ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-200'
            : 'border-dashed border-amber-400 bg-white text-amber-600 shadow-sm focus:border-amber-600 focus:ring-4 focus:ring-amber-100 disabled:animate-none disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none'} ${step === 2 ? 'animate-pulse focus:animate-none' : ''}`}
        />
        <span
          className={`${signBase} -translate-x-1/2 whitespace-nowrap text-xl ${differenceDone ? 'text-indigo-700' : 'text-slate-300'}`}
          style={{ left: COL.d, top: Y.row3 }}
        >= {differenceDone ? finalAnswer : '?'}</span>
      </div>

      <div className="mt-4 text-center">
        {step === 1 && (
          <>
            <p className="text-sm font-bold text-slate-600">ขั้นที่ 1: {whole} แยกเป็นเท่าไรกับ {base}?</p>
            <ErrorHint>{error}</ErrorHint>
            <ActionButton tone="emerald" disabled={!remainderValue} onClick={checkRemainder}>ตรวจเลขช่องแรก</ActionButton>
          </>
        )}

        {step === 2 && (
          <>
            <EquationPill tone="violet">{whole} = {remainder} + {base} ✓</EquationPill>
            <p className="mt-3 text-sm font-bold text-slate-600">ขั้นที่ 2: {base} − {subtract} เท่ากับเท่าไร?</p>
            <ErrorHint>{error}</ErrorHint>
            <ActionButton tone="amber" disabled={!differenceValue} onClick={checkDifference}>ตรวจเลขช่องที่สอง</ActionButton>
          </>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <EquationPill tone="violet">{whole} = {remainder} + {base} ✓</EquationPill>
            <div className="text-xl leading-none text-slate-300">↓</div>
            <EquationPill tone="amber">{base} − {subtract} = {answer}</EquationPill>
            <div className="rounded-2xl bg-indigo-600 px-4 py-3 text-xl font-black text-white shadow-md shadow-indigo-200">
              {remainder} + {answer} = {finalAnswer}
            </div>
            <ActionButton tone="indigo" onClick={() => onSubmit(answer)}>ยืนยันคำตอบ</ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
