import React from 'react';

/** ภาพจุดที่ใช้ร่วมกันของด่านคูณและด่านหาร (กลุ่ม / ตาราง / กองรวม) */
const dotTones = {
  orange: 'border-orange-500 bg-orange-400',
  violet: 'border-violet-600 bg-violet-500',
  sky: 'border-sky-500 bg-sky-400',
  emerald: 'border-emerald-600 bg-emerald-500',
  ghost: 'border-dashed border-slate-300 bg-white',
};

export function Dot({ tone = 'orange' }) {
  return <span className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors duration-300 ${dotTones[tone]}`} />;
}

/** ตะกร้าหลายใบ ใบละเท่า ๆ กัน — ใช้ตอน "มีกี่กลุ่ม กลุ่มละเท่าไร" */
export function DotGroups({ groups, size, tone = 'orange' }) {
  return (
    <div className="flex flex-wrap items-start justify-center gap-2">
      {Array.from({ length: groups }, (_, index) => (
        <div key={index} className="flex max-w-[5rem] flex-wrap justify-center gap-1 rounded-2xl border-2 border-orange-200 bg-orange-50 p-1.5">
          {Array.from({ length: size }, (_, dot) => <Dot key={dot} tone={tone} />)}
        </div>
      ))}
    </div>
  );
}

/** ตารางจุด แถว × หลัก — ใช้ตอนสอนว่าสลับที่คูณกันได้ */
export function DotArray({ rows, columns, tone = 'violet' }) {
  return (
    <div className="mx-auto grid w-max gap-1.5 rounded-2xl border-2 border-violet-200 bg-violet-50 p-2" style={{ gridTemplateColumns: `repeat(${columns}, 1rem)` }}>
      {Array.from({ length: rows * columns }, (_, index) => <Dot key={index} tone={tone} />)}
    </div>
  );
}

/** กองของที่ยังไม่ได้แบ่ง — ใช้ตอนเริ่มโจทย์หาร */
export function DotPool({ count, tone = 'sky', columns = 10 }) {
  return (
    <div className="mx-auto grid w-max gap-1.5 rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 p-2" style={{ gridTemplateColumns: `repeat(${Math.min(columns, Math.max(1, count))}, 1rem)` }}>
      {Array.from({ length: count }, (_, index) => <Dot key={index} tone={tone} />)}
      {count === 0 && <span className="col-span-full px-2 text-xs font-black text-sky-400">แจกหมดแล้ว</span>}
    </div>
  );
}
