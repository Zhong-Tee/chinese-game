import React, { useEffect, useRef, useState } from 'react';
import { ActionButton, EquationPill, ErrorHint, StepChips } from './MathSplitKit';
import { DotArray, DotGroups } from './MathDotPictures';

/**
 * ด่านคูณ ระดับ 1–3: อ่านภาพให้ออกเป็นประโยคคูณ แล้วหาผลลัพธ์ด้วยการบวกซ้ำ
 * ขั้นที่ 1 กรอก "กี่กลุ่ม" กับ "กลุ่มละเท่าไร" (โครงสร้างของการคูณ)
 * ขั้นที่ 2 กรอกผลลัพธ์ โดยมีแถวบวกซ้ำให้เห็นว่าคูณคือการบวกจำนวนเท่า ๆ กัน
 */
const cleanNumber = (value) => value.replace(/[^0-9]/g, '').slice(0, 3);
const slotBox = 'flex h-12 w-14 items-center justify-center rounded-2xl border-4 text-center text-2xl font-black outline-none transition-all duration-300';

const MODE_TEXT = {
  groups: {
    countLabel: 'มีกี่กลุ่ม',
    sizeLabel: 'กลุ่มละกี่ชิ้น',
    countHint: 'ลองนับจำนวนตะกร้าในภาพอีกครั้ง',
    sizeHint: 'นับจุดในตะกร้าเพียงใบเดียว ทุกใบมีเท่ากัน',
    question: 'ในภาพมีกี่กลุ่ม และกลุ่มละกี่ชิ้น?',
  },
  repeat: {
    countLabel: 'บวกกี่ครั้ง',
    sizeLabel: 'ครั้งละเท่าไร',
    countHint: 'นับว่ามีเลขกี่ตัวที่นำมาบวกกัน',
    sizeHint: 'ดูว่าเลขที่บวกซ้ำ ๆ กันคือเลขอะไร',
    question: 'บวกเลขอะไร ซ้ำกี่ครั้ง?',
  },
  array: {
    countLabel: 'กี่แถว',
    sizeLabel: 'แถวละกี่จุด',
    countHint: 'นับจำนวนแถวจากบนลงล่าง',
    sizeHint: 'นับจุดในแถวเดียวจากซ้ายไปขวา',
    question: 'ตารางนี้มีกี่แถว แถวละกี่จุด?',
  },
};

export default function MathMultiplyBuild({ visual, answer, onSubmit }) {
  const { mode, groups, size, product } = visual;
  const text = MODE_TEXT[mode];
  const chain = Array(groups).fill(size).join(' + ');
  const [countValue, setCountValue] = useState('');
  const [sizeValue, setSizeValue] = useState('');
  const [productValue, setProductValue] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const countRef = useRef(null);
  const productRef = useRef(null);

  useEffect(() => {
    if (step === 2) productRef.current?.focus();
  }, [step]);

  const checkStructure = () => {
    if (Number(countValue) !== groups) {
      setError(text.countHint);
      setCountValue('');
      countRef.current?.focus();
      return;
    }
    if (Number(sizeValue) !== size) {
      setError(text.sizeHint);
      setSizeValue('');
      return;
    }
    setError('');
    setStep(2);
  };

  const checkProduct = () => {
    if (Number(productValue) === product) {
      setError('');
      setStep(3);
    } else {
      setProductValue('');
      setError(`ลองบวกทีละตัว: ${chain}`);
      productRef.current?.focus();
    }
  };

  const stateOf = (target) => (step > target ? 'done' : step === target ? 'active' : 'idle');

  return (
    <div className="mt-5 rounded-[1.75rem] bg-gradient-to-b from-amber-50 to-orange-50 p-4 shadow-inner ring-1 ring-amber-100">
      <StepChips steps={[
        { label: 'อ่านภาพ', tone: 'emerald', state: stateOf(1) },
        { label: 'หาผลลัพธ์', tone: 'amber', state: stateOf(2) },
      ]} />

      <div className="overflow-x-auto">
        {mode === 'array'
          ? <DotArray rows={groups} columns={size} />
          : mode === 'groups'
            ? <DotGroups groups={groups} size={size} />
            : (
              <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-amber-200 bg-white/70 p-3 text-2xl font-black text-amber-700">
                {Array.from({ length: groups }, (_, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <span className="text-amber-400">+</span>}
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-white shadow-sm">{size}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
      </div>

      {/* ประโยคคูณที่เด็กประกอบเอง */}
      <div className="mt-4 flex items-center justify-center gap-2 text-2xl font-black text-slate-700">
        <div>
          <input
            ref={countRef}
            value={countValue}
            onChange={(event) => { setCountValue(cleanNumber(event.target.value)); setError(''); }}
            inputMode="numeric"
            disabled={step > 1}
            autoFocus
            aria-label={text.countLabel}
            placeholder="?"
            className={`${slotBox} ${step > 1
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'animate-pulse border-dashed border-emerald-400 bg-white text-emerald-600 focus:animate-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100'}`}
          />
          <p className="mt-1 text-center text-[0.65rem] font-bold leading-tight text-emerald-600">{text.countLabel}</p>
        </div>
        <span className="mb-5 text-amber-500">×</span>
        <div>
          <input
            value={sizeValue}
            onChange={(event) => { setSizeValue(cleanNumber(event.target.value)); setError(''); }}
            onKeyDown={(event) => { if (event.key === 'Enter' && countValue && sizeValue) checkStructure(); }}
            inputMode="numeric"
            disabled={step > 1}
            aria-label={text.sizeLabel}
            placeholder="?"
            className={`${slotBox} ${step > 1
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-dashed border-emerald-400 bg-white text-emerald-600 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100'}`}
          />
          <p className="mt-1 text-center text-[0.65rem] font-bold leading-tight text-emerald-600">{text.sizeLabel}</p>
        </div>
        <span className="mb-5 text-slate-400">=</span>
        <div>
          {step === 2 ? (
            <input
              ref={productRef}
              value={productValue}
              onChange={(event) => { setProductValue(cleanNumber(event.target.value)); setError(''); }}
              onKeyDown={(event) => { if (event.key === 'Enter' && productValue) checkProduct(); }}
              inputMode="numeric"
              aria-label="ผลคูณ"
              placeholder="?"
              className={`${slotBox} animate-pulse border-dashed border-amber-400 bg-white text-amber-600 focus:animate-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100`}
            />
          ) : (
            <span className={`${slotBox} ${step > 2 ? 'border-amber-500 bg-amber-500 text-white' : 'border-dashed border-slate-200 bg-white text-slate-300'}`}>{step > 2 ? product : '?'}</span>
          )}
          <p className="mt-1 text-center text-[0.65rem] font-bold leading-tight text-amber-600">ทั้งหมด</p>
        </div>
      </div>

      <div className="mt-3 text-center">
        {step === 1 && (
          <>
            <p className="text-sm font-bold text-slate-600">ขั้นที่ 1: {text.question}</p>
            <ErrorHint>{error}</ErrorHint>
            <ActionButton tone="emerald" disabled={!countValue || !sizeValue} onClick={checkStructure}>ตรวจประโยคคูณ</ActionButton>
          </>
        )}

        {step === 2 && (
          <>
            <EquationPill tone="emerald">{groups} กลุ่ม กลุ่มละ {size} ✓</EquationPill>
            <div className="mt-3 rounded-2xl bg-white px-3 py-2 text-lg font-black text-slate-600">{chain} = ?</div>
            <p className="mt-2 text-sm font-bold text-slate-600">ขั้นที่ 2: คูณคือการบวก {size} ซ้ำ {groups} ครั้ง รวมได้เท่าไร?</p>
            <ErrorHint>{error}</ErrorHint>
            <ActionButton tone="amber" disabled={!productValue} onClick={checkProduct}>ตรวจผลคูณ</ActionButton>
          </>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <EquationPill tone="amber">{chain} = {product}</EquationPill>
            <div className="text-xl leading-none text-slate-300">↓</div>
            <div className="rounded-2xl bg-indigo-600 px-4 py-3 text-xl font-black text-white shadow-md shadow-indigo-200">
              {groups} × {size} = {product}
            </div>
            {mode === 'array' && (
              <p className="rounded-2xl bg-violet-100 px-3 py-2 text-xs font-bold text-violet-700">
                หมุนตารางดูก็ได้เท่ากัน {size} × {groups} = {product}
              </p>
            )}
            <ActionButton tone="indigo" onClick={() => onSubmit(answer)}>ยืนยันคำตอบ</ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
