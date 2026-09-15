import React, { useEffect, useRef, useState } from 'react';
import { ActionButton, BOARD_W, COL, EquationPill, ErrorHint, StepChips, X, arrowDown, boxBase, branchPath, signBase } from './MathSplitKit';

/** ผังแยกจำนวนเพื่อทำให้ครบหลักสิบ (ด่านบวก ระดับ 2 และ 3) */
const Y = { row1: 0, row2: 104, row3: 214 };
const BOARD_H = 266;

export default function MathSplitAnswer({ visual, answer, onSubmit }) {
  const { first, second } = visual;
  const target = visual.target ?? 10;
  const toTarget = visual.toTarget ?? visual.toTen;
  const [firstPart, setFirstPart] = useState('');
  const [secondPart, setSecondPart] = useState('');
  const [firstDone, setFirstDone] = useState(false);
  const [secondDone, setSecondDone] = useState(false);
  const [firstError, setFirstError] = useState('');
  const [secondError, setSecondError] = useState('');
  const secondInputRef = useRef(null);

  useEffect(() => {
    if (firstDone) secondInputRef.current?.focus();
  }, [firstDone]);

  const cleanNumber = (value) => value.replace(/[^0-9]/g, '').slice(0, 2);

  const checkFirstPart = () => {
    if (Number(firstPart) === toTarget) {
      setFirstDone(true);
      setFirstError('');
    } else {
      setFirstError(`ลองคิดอีกครั้งว่า ${first} ต้องเติมเท่าไรจึงครบ ${target}`);
      setFirstPart('');
    }
  };

  const checkSecondPart = () => {
    if (Number(secondPart) === answer) {
      setSecondDone(true);
      setSecondError('');
    } else {
      setSecondError(`${second} แยกเป็น ${toTarget} กับอีกเท่าไร ลองใหม่อีกครั้ง`);
      setSecondPart('');
      secondInputRef.current?.focus();
    }
  };

  const step = !firstDone ? 1 : !secondDone ? 2 : 3;

  return (
    <div className="mt-5 rounded-[1.75rem] bg-gradient-to-b from-sky-50 to-indigo-50 p-4 shadow-inner ring-1 ring-sky-100">
      <StepChips steps={[
        { label: `ครบ ${target}`, tone: 'emerald', state: step === 1 ? 'active' : 'done' },
        { label: 'ส่วนที่เหลือ', tone: 'amber', state: step === 1 ? 'idle' : step === 2 ? 'active' : 'done' },
      ]} />

      <div
        className="relative mx-auto w-full max-w-[17rem] font-black text-slate-800"
        style={{ height: BOARD_H }}
        aria-label={`${first} บวก ${second} แยก ${second} เป็นสองส่วน แล้วทำให้ครบ ${target}`}
      >
        <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <g fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {/* แตกกิ่งจากตัวบวกด้านขวา ลงไปเป็นสองส่วน */}
            <path d={branchPath(X.c, 52, X.b, X.d, Y.row2)} stroke="#a78bfa" vectorEffect="non-scaling-stroke" />
            <path d={arrowDown(X.b, Y.row2)} stroke="#a78bfa" vectorEffect="non-scaling-stroke" />
            <path d={arrowDown(X.d, Y.row2)} stroke="#a78bfa" vectorEffect="non-scaling-stroke" />

            {/* ตัวตั้งด้านซ้ายวิ่งลงมารวมกับส่วนแรก กลายเป็นเลขครบสิบ */}
            <path d={`M${X.a} 52 V240 H${X.b - 32}`} stroke={firstDone ? '#38bdf8' : '#bae6fd'} vectorEffect="non-scaling-stroke" />
            <path d={`M${X.b - 39} 234 L${X.b - 26} 240 L${X.b - 39} 246`} stroke={firstDone ? '#38bdf8' : '#bae6fd'} vectorEffect="non-scaling-stroke" />
            <path d={`M${X.b} ${Y.row2 + 52} V${Y.row3 - 4} ${arrowDown(X.b, Y.row3)}`} stroke={firstDone ? '#34d399' : '#d1fae5'} vectorEffect="non-scaling-stroke" />

            {/* ส่วนที่เหลือหล่นลงมาเป็นคำตอบ */}
            <path d={`M${X.d} ${Y.row2 + 52} V${Y.row3 - 4} ${arrowDown(X.d, Y.row3)}`} stroke={secondDone ? '#fbbf24' : '#fef3c7'} vectorEffect="non-scaling-stroke" />
          </g>
        </svg>

        {/* แถวบน: โจทย์ตั้งต้น */}
        <span className={`${boxBase} bg-sky-500 text-white shadow-md shadow-sky-200`} style={{ left: COL.a, top: Y.row1 }}>{first}</span>
        <span className={`${signBase} text-sky-400`} style={{ left: COL.b, top: Y.row1 }}>+</span>
        <span className={`${boxBase} bg-violet-500 text-white shadow-md shadow-violet-200`} style={{ left: COL.c, top: Y.row1 }}>{second}</span>

        {/* แถวกลาง: สองส่วนที่แยกได้ */}
        <input
          value={firstPart}
          onChange={(event) => setFirstPart(cleanNumber(event.target.value))}
          onKeyDown={(event) => { if (event.key === 'Enter' && firstPart) checkFirstPart(); }}
          inputMode="numeric"
          disabled={firstDone}
          autoFocus
          aria-label={`เลขที่ทำให้ครบ ${target}`}
          placeholder="?"
          style={{ left: COL.b, top: Y.row2 }}
          className={`${boxBase} border-4 text-center outline-none ${firstDone
            ? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-200'
            : 'animate-pulse border-dashed border-emerald-400 bg-white text-emerald-600 shadow-sm focus:animate-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100'}`}
        />
        <input
          ref={secondInputRef}
          value={secondPart}
          onChange={(event) => setSecondPart(cleanNumber(event.target.value))}
          onKeyDown={(event) => { if (event.key === 'Enter' && secondPart) checkSecondPart(); }}
          inputMode="numeric"
          disabled={!firstDone || secondDone}
          aria-label="เลขส่วนที่เหลือ"
          placeholder="?"
          style={{ left: COL.d, top: Y.row2 }}
          className={`${boxBase} border-4 text-center outline-none ${secondDone
            ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-200'
            : 'border-dashed border-amber-400 bg-white text-amber-600 shadow-sm focus:border-amber-600 focus:ring-4 focus:ring-amber-100 disabled:animate-none disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none'} ${step === 2 ? 'animate-pulse focus:animate-none' : ''}`}
        />

        {/* แถวล่าง: ผลลัพธ์ที่ครบหลักสิบ */}
        <span
          className={`${boxBase} border-4 ${firstDone ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-dashed border-slate-200 bg-white text-slate-300'}`}
          style={{ left: COL.b, top: Y.row3 }}
        >{target}</span>
        <span className={`${signBase} ${secondDone ? 'text-amber-400' : 'text-slate-300'}`} style={{ left: COL.c, top: Y.row3 }}>+</span>
        <span
          className={`${boxBase} border-4 ${secondDone ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm' : 'border-dashed border-slate-200 bg-white text-slate-300'}`}
          style={{ left: COL.d, top: Y.row3 }}
        >{secondDone ? answer : '?'}</span>
      </div>

      <div className="mt-4 text-center">
        {step === 1 && (
          <>
            <p className="text-sm font-bold text-slate-600">ขั้นที่ 1: {first} ต้องเติมเท่าไรจึงครบ {target}?</p>
            <ErrorHint>{firstError}</ErrorHint>
            <ActionButton tone="emerald" disabled={!firstPart} onClick={checkFirstPart}>ตรวจเลขช่องแรก</ActionButton>
          </>
        )}

        {step === 2 && (
          <>
            <EquationPill tone="emerald">{first} + {toTarget} = {target} ✓</EquationPill>
            <p className="mt-3 text-sm font-bold text-slate-600">ขั้นที่ 2: {second} แยกเป็น {toTarget} กับเท่าไร?</p>
            <ErrorHint>{secondError}</ErrorHint>
            <ActionButton tone="amber" disabled={!secondPart} onClick={checkSecondPart}>ตรวจเลขช่องที่สอง</ActionButton>
          </>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <EquationPill tone="emerald">{first} + {toTarget} = {target} ✓</EquationPill>
            <div className="text-xl leading-none text-slate-300">↓</div>
            <EquationPill tone="amber">{target} + {answer} = {first + second}</EquationPill>
            <div className="rounded-2xl bg-indigo-600 px-4 py-3 text-xl font-black text-white shadow-md shadow-indigo-200">
              {first} + {second} = {first + second}
            </div>
            <ActionButton tone="indigo" onClick={() => onSubmit(answer)}>ยืนยันคำตอบ</ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
