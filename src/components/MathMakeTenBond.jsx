import React, { useEffect, useRef, useState } from 'react';
import { ActionButton, EquationPill, ErrorHint, StepChips } from './MathSplitKit';

/**
 * ด่านบวก ระดับ 1: ให้เด็กกรอกการแยกตัวบวกตัวที่สองเป็น 2 ส่วนด้วยตัวเอง
 * ขั้นที่ 1 นับช่องว่างในกรอบสิบช่อง (รู้ว่าต้องเติมเท่าไรจึงครบ 10)
 * ขั้นที่ 2 แยกจำนวนที่สองเป็นสองส่วน โดยส่วนแรกคือจำนวนที่นับได้จากขั้นที่ 1
 */
const cleanNumber = (value) => value.replace(/[^0-9]/g, '').slice(0, 2);

function TenFrame({ first, added }) {
  return (
    <div className="mx-auto grid w-full max-w-[14rem] grid-cols-5 gap-1.5 rounded-2xl border-4 border-sky-200 bg-white/80 p-2">
      {Array.from({ length: 10 }, (_, index) => {
        const isFirst = index < first;
        const isAdded = !isFirst && index < first + added;
        return (
          <span
            key={index}
            className={`aspect-square rounded-full border-2 transition-colors duration-300 ${isFirst
              ? 'border-sky-500 bg-sky-400 shadow-sm'
              : isAdded
                ? 'border-emerald-500 bg-emerald-400 shadow-sm'
                : 'border-dashed border-slate-300 bg-white'}`}
          />
        );
      })}
    </div>
  );
}

function SplitDots({ second, left }) {
  const leftCount = Math.min(Math.max(left, 0), second);
  return (
    <div className="mx-auto flex max-w-[14rem] flex-wrap items-center justify-center gap-1.5">
      {Array.from({ length: second }, (_, index) => (
        <span
          key={index}
          className={`h-4 w-4 rounded-full border-2 transition-colors duration-300 ${index < leftCount
            ? 'border-emerald-500 bg-emerald-400'
            : 'border-amber-500 bg-amber-400'}`}
        />
      ))}
    </div>
  );
}

export default function MathMakeTenBond({ visual, answer, onSubmit }) {
  const { first, second } = visual;
  const toTen = visual.toTen ?? 10 - first;
  const rest = second - toTen;
  const [gap, setGap] = useState('');
  const [leftPart, setLeftPart] = useState('');
  const [rightPart, setRightPart] = useState('');
  const [gapDone, setGapDone] = useState(false);
  const [splitDone, setSplitDone] = useState(false);
  const [gapError, setGapError] = useState('');
  const [splitError, setSplitError] = useState('');
  const leftInputRef = useRef(null);

  useEffect(() => {
    if (gapDone) leftInputRef.current?.focus();
  }, [gapDone]);

  const checkGap = () => {
    if (Number(gap) === toTen) {
      setGapDone(true);
      setGapError('');
    } else {
      setGapError(`ลองนับช่องสีขาวอีกครั้ง มีทั้งหมด 10 ช่อง เต็มแล้ว ${first} ช่อง`);
      setGap('');
    }
  };

  const checkSplit = () => {
    const left = Number(leftPart);
    const right = Number(rightPart);
    if (left + right !== second) {
      setSplitError(`สองส่วนรวมกันต้องได้ ${second} แต่ตอนนี้ได้ ${left + right}`);
      return;
    }
    if (left !== toTen) {
      setSplitError(`ส่วนแรกต้องเป็น ${toTen} เพราะ ${first} ขาดอีก ${toTen} จึงจะครบ 10`);
      setLeftPart('');
      setRightPart('');
      leftInputRef.current?.focus();
      return;
    }
    setSplitDone(true);
    setSplitError('');
  };

  const step = !gapDone ? 1 : !splitDone ? 2 : 3;
  // ระหว่างกรอก ให้จุดสีเขียวในกรอบสิบช่องขยับตามเลขที่พิมพ์ เด็กจะเห็นทันทีว่าพอดี เกิน หรือขาด
  const typedLeft = step === 1 ? Number(gap || 0) : Number(leftPart || 0);
  const freeSlots = 10 - first;
  const previewAdded = Math.min(typedLeft, freeSlots);
  const overflow = typedLeft > freeSlots;

  const partBox = 'flex h-14 w-16 items-center justify-center rounded-2xl border-4 text-center text-2xl font-black outline-none transition-all duration-300';

  return (
    <div className="mt-5 rounded-[1.75rem] bg-gradient-to-b from-sky-50 to-indigo-50 p-4 shadow-inner ring-1 ring-sky-100">
      <StepChips steps={[
        { label: 'ว่างกี่ช่อง', tone: 'emerald', state: step === 1 ? 'active' : 'done' },
        { label: `แยก ${second}`, tone: 'amber', state: step === 1 ? 'idle' : step === 2 ? 'active' : 'done' },
      ]} />

      <TenFrame first={first} added={previewAdded} />
      <p className="mt-2 text-center text-xs font-bold text-slate-500">
        <span className="text-sky-600">มี {first} แล้ว</span>
        {' • '}
        {overflow
          ? <span className="text-rose-500">ใส่แล้วเกิน 10 ช่องนะ</span>
          : gapDone
            ? <span className="text-emerald-600">ว่างอีก {toTen} ช่อง</span>
            : <span>ว่างอีก ? ช่อง</span>}
      </p>

      {step === 1 && (
        <div className="mt-3 text-center">
          <p className="text-sm font-bold text-slate-600">ขั้นที่ 1: ในกรอบยังว่างอีกกี่ช่อง?</p>
          <input
            value={gap}
            onChange={(event) => setGap(cleanNumber(event.target.value))}
            onKeyDown={(event) => { if (event.key === 'Enter' && gap) checkGap(); }}
            inputMode="numeric"
            autoFocus
            aria-label="จำนวนช่องว่างที่เหลือ"
            placeholder="?"
            className={`${partBox} mx-auto mt-2 animate-pulse border-dashed border-emerald-400 bg-white text-emerald-600 shadow-sm focus:animate-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100`}
          />
          <ErrorHint>{gapError}</ErrorHint>
          <ActionButton tone="emerald" disabled={!gap} onClick={checkGap}>ตรวจคำตอบ</ActionButton>
        </div>
      )}

      {step >= 2 && (
        <div className="mt-3 text-center">
          <EquationPill tone="emerald">{first} + {toTen} = 10 ✓</EquationPill>

          <div className="mx-auto mt-4 w-full max-w-[13rem]">
            <div className="mx-auto flex h-14 w-16 items-center justify-center rounded-2xl bg-violet-500 text-2xl font-black text-white shadow-md shadow-violet-200">{second}</div>
            <div className="mx-auto mt-2 h-8 w-[9rem] rounded-t-xl border-x-4 border-t-4 border-violet-300" />
            <div className="flex items-start justify-between">
              <div className="w-16">
                <input
                  ref={leftInputRef}
                  value={leftPart}
                  onChange={(event) => { setLeftPart(cleanNumber(event.target.value)); setSplitError(''); }}
                  inputMode="numeric"
                  disabled={splitDone}
                  aria-label="ส่วนที่นำไปเติมให้ครบ 10"
                  placeholder="?"
                  className={`${partBox} ${splitDone
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'animate-pulse border-dashed border-emerald-400 bg-white text-emerald-600 shadow-sm focus:animate-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100'}`}
                />
                <p className="mt-1 text-[0.65rem] font-bold leading-tight text-emerald-600">เติมให้ครบ 10</p>
              </div>
              <div className="w-16">
                <input
                  value={rightPart}
                  onChange={(event) => { setRightPart(cleanNumber(event.target.value)); setSplitError(''); }}
                  onKeyDown={(event) => { if (event.key === 'Enter' && leftPart && rightPart) checkSplit(); }}
                  inputMode="numeric"
                  disabled={splitDone}
                  aria-label="ส่วนที่เหลือ"
                  placeholder="?"
                  className={`${partBox} ${splitDone
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-dashed border-amber-400 bg-white text-amber-600 shadow-sm focus:border-amber-600 focus:ring-4 focus:ring-amber-100'}`}
                />
                <p className="mt-1 text-[0.65rem] font-bold leading-tight text-amber-600">ส่วนที่เหลือ</p>
              </div>
            </div>
          </div>

          <div className="mt-3"><SplitDots second={second} left={step === 3 ? toTen : Number(leftPart || 0)} /></div>

          {step === 2 && (
            <>
              <p className="mt-3 text-sm font-bold text-slate-600">ขั้นที่ 2: แยก {second} เป็น 2 ส่วน โดยส่วนแรกคือ {toTen} ที่ใช้เติมให้ครบ 10</p>
              <ErrorHint>{splitError}</ErrorHint>
              <ActionButton tone="amber" disabled={!leftPart || !rightPart} onClick={checkSplit}>ตรวจการแยกจำนวน</ActionButton>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="mt-4 space-y-2 text-center">
          <EquationPill tone="amber">{second} = {toTen} + {rest} ✓</EquationPill>
          <div className="text-xl leading-none text-slate-300">↓</div>
          <EquationPill tone="violet">10 + {rest} = {first + second}</EquationPill>
          <div className="rounded-2xl bg-indigo-600 px-4 py-3 text-xl font-black text-white shadow-md shadow-indigo-200">
            {first} + {second} = {first + second}
          </div>
          <ActionButton tone="indigo" onClick={() => onSubmit(answer)}>ยืนยันคำตอบ</ActionButton>
        </div>
      )}
    </div>
  );
}
