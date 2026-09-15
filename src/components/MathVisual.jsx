import React from 'react';

function TenFrame({ filled = 0, removed = 0, total = 10 }) {
  return (
    <div className="grid grid-cols-5 gap-2 max-w-[250px] mx-auto p-3 rounded-2xl bg-white/70 border-4 border-sky-200">
      {Array.from({ length: total }, (_, index) => {
        const isFilled = index < filled;
        const isRemoved = isFilled && index >= filled - removed;
        return (
          <div key={index} className={`aspect-square rounded-full border-2 ${isRemoved ? 'bg-rose-100 border-rose-300 opacity-35' : isFilled ? 'bg-amber-400 border-amber-500 shadow-md' : 'bg-white border-sky-200'}`}>
            {isRemoved && <span className="flex h-full items-center justify-center text-rose-500 font-black">×</span>}
          </div>
        );
      })}
    </div>
  );
}

function Groups({ groups, size }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {Array.from({ length: groups }, (_, group) => (
        <div key={group} className="flex flex-wrap justify-center gap-1.5 max-w-24 rounded-2xl border-2 border-orange-200 bg-orange-50 p-2">
          {Array.from({ length: size }, (_, item) => <span key={item} className="h-5 w-5 rounded-full bg-orange-400 shadow-sm" />)}
        </div>
      ))}
    </div>
  );
}

function DotArray({ rows, columns }) {
  return (
    <div className="grid gap-2 justify-center" style={{ gridTemplateColumns: `repeat(${columns}, 1.25rem)` }}>
      {Array.from({ length: rows * columns }, (_, index) => <span key={index} className="h-5 w-5 rounded-full bg-violet-500 shadow-sm" />)}
    </div>
  );
}

function NumberTree({ whole, left, right }) {
  return (
    <div className="mx-auto w-52 text-center font-black text-slate-800">
      <div className="mx-auto w-16 rounded-xl bg-violet-500 py-2 text-xl text-white shadow">{whole}</div>
      <div className="mx-auto h-10 w-28 border-x-4 border-t-4 border-violet-300 mt-3" />
      <div className="flex justify-between">
        <span className="w-16 rounded-xl bg-white border-2 border-violet-200 py-2 text-lg">{left}</span>
        <span className="w-16 rounded-xl bg-white border-2 border-violet-200 py-2 text-lg">{right}</span>
      </div>
    </div>
  );
}

function Sharing({ total, groups }) {
  const perGroup = total / groups;
  return <Groups groups={groups} size={perGroup} />;
}

function NumberPair({ first, target = 10 }) {
  return (
    <div className="flex items-center justify-center gap-4 py-2 text-3xl font-black">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 text-white shadow-lg">{first}</div>
      <span className="text-emerald-400">+</span>
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-4 border-dashed border-indigo-300 bg-white text-indigo-300">?</div>
      <span className="text-slate-400">= {target}</span>
    </div>
  );
}

function MakeTenSplit({ first, second, toTen }) {
  return (
    <div className="mx-auto max-w-xs text-center font-black text-slate-800">
      <div className="flex items-center justify-center gap-3 text-3xl">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-md">{first}</span>
        <span className="text-sky-500">+</span>
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-md">{second}</span>
      </div>

      <div className="mx-auto mt-2 w-32 translate-x-10">
        <div className="mx-auto h-8 w-20 border-x-4 border-t-4 border-violet-300" />
        <div className="flex justify-between gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-2xl text-white shadow">{toTen}</span>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-dashed border-amber-400 bg-white text-2xl text-amber-500">?</span>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-lg text-emerald-700">
        {first} + {toTen} = 10
      </div>
      <div className="mt-2 text-xs font-bold text-slate-500">เลือกจำนวนที่อยู่ในช่อง ?</div>
    </div>
  );
}

function SubtractionBridge({ whole, subtract }) {
  return (
    <div className="mx-auto max-w-xs text-center">
      <div className="flex items-center justify-center gap-3 text-3xl font-black">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-500 text-white shadow-lg">{whole}</span>
        <span className="text-rose-500">−</span>
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500 text-white shadow-lg">{subtract}</span>
      </div>
      <div className="mt-4 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-slate-600">แยก {whole} โดยให้ 10 เป็นส่วนที่สอง</div>
    </div>
  );
}

function BorrowingIntro({ whole, tensValue, ones }) {
  return (
    <div className="mx-auto max-w-xs text-center font-black text-slate-800">
      <div className="rounded-2xl bg-white px-4 py-3 text-2xl text-cyan-700">{whole} = {tensValue} + {ones}</div>
      <div className="my-3 flex items-center justify-center gap-2 text-sm text-orange-600"><span className="text-2xl">↓</span><span>ยืม 1 สิบจากหลักสิบ</span></div>
      <div className="flex items-center justify-center gap-3 text-2xl">
        <span className="flex h-16 w-20 items-center justify-center rounded-2xl border-4 border-dashed border-cyan-300 bg-white text-cyan-300">?</span>
        <span className="text-cyan-500">+</span>
        <span className="flex h-16 w-20 items-center justify-center rounded-2xl border-4 border-dashed border-emerald-300 bg-white text-emerald-300">?</span>
      </div>
    </div>
  );
}

export default function MathVisual({ visual }) {
  if (!visual) return null;
  return (
    <div className="my-5 rounded-3xl bg-sky-50/90 p-4 shadow-inner">
      {visual.type === 'tenFrame' && <TenFrame {...visual} />}
      {visual.type === 'groups' && <Groups {...visual} />}
      {visual.type === 'array' && <DotArray {...visual} />}
      {visual.type === 'numberTree' && <NumberTree {...visual} />}
      {visual.type === 'sharing' && <Sharing {...visual} />}
      {visual.type === 'numberPair' && <NumberPair {...visual} />}
      {visual.type === 'makeTenSplit' && <MakeTenSplit {...visual} />}
      {visual.type === 'subtractionBridge' && <SubtractionBridge {...visual} />}
      {visual.type === 'borrowingIntro' && <BorrowingIntro {...visual} />}
    </div>
  );
}
