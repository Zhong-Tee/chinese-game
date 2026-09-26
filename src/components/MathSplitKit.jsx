import React from 'react';

/**
 * ชิ้นส่วนที่ใช้ร่วมกันของผังแยกจำนวน (บวกครบสิบ / ลบข้ามสิบ / ลบแบบยืม)
 *
 * ทุกผังวางบนกระดานกว้าง 272 หน่วย แบ่งเป็น 4 คอลัมน์ระยะเท่ากัน
 * (12.5% / 37.5% / 62.5% / 87.5%) กล่องตัวเลขจัดกึ่งกลางคอลัมน์ด้วย -translate-x-1/2
 * ส่วน SVG ใช้พิกัด X ชุดเดียวกัน เส้นเชื่อมจึงตรงกับกล่องเสมอทุกความกว้างหน้าจอ
 */
export function StepChip({ index, label, state, tone }) {
  const tones = {
    emerald: { active: 'bg-emerald-500 text-white shadow-emerald-200', done: 'bg-emerald-100 text-emerald-600' },
    amber: { active: 'bg-amber-500 text-white shadow-amber-200', done: 'bg-amber-100 text-amber-600' },
    indigo: { active: 'bg-indigo-500 text-white shadow-indigo-200', done: 'bg-indigo-100 text-indigo-600' },
  };
  const style = state === 'active' ? `${tones[tone].active} shadow-md` : state === 'done' ? tones[tone].done : 'bg-slate-100 text-slate-400';
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black transition-colors duration-300 ${style}`}>
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/30 text-[0.625rem] leading-none">{state === 'done' ? '✓' : index}</span>
      {label}
    </span>
  );
}

export function StepChips({ steps }) {
  // เกินสองขั้นจะขึ้นบรรทัดใหม่ จึงตัดขีดคั่นออกไม่ให้ค้างท้ายบรรทัด
  const withDivider = steps.length <= 2;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      {steps.map((item, index) => (
        <React.Fragment key={item.label}>
          {withDivider && index > 0 && <span className="h-0.5 w-4 rounded-full bg-slate-200" />}
          <StepChip index={index + 1} label={item.label} state={item.state} tone={item.tone} />
        </React.Fragment>
      ))}
    </div>
  );
}

export function EquationPill({ tone, children }) {
  const tones = {
    emerald: 'border-emerald-300 bg-emerald-100 text-emerald-700',
    amber: 'border-amber-300 bg-amber-100 text-amber-700',
    violet: 'border-violet-300 bg-violet-100 text-violet-700',
    cyan: 'border-cyan-300 bg-cyan-100 text-cyan-700',
  };
  return <div className={`rounded-2xl border-2 px-4 py-2.5 text-lg font-black ${tones[tone]}`}>{children}</div>;
}

export function ActionButton({ tone, disabled, onClick, children }) {
  const tones = {
    emerald: 'bg-emerald-500 shadow-[0_4px_0_#059669]',
    amber: 'bg-amber-500 shadow-[0_4px_0_#d97706]',
    indigo: 'bg-indigo-600 shadow-[0_4px_0_#3730a3]',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`mt-3 w-full rounded-2xl py-3.5 font-black text-white transition active:translate-y-1 active:shadow-none disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function ErrorHint({ children }) {
  if (!children) return null;
  return <p className="mt-2 rounded-xl bg-rose-100 px-3 py-2 text-xs font-bold text-rose-600">{children}</p>;
}
