import React from 'react';

function TenFrame({ filled = 0, removed = 0 }) {
  return (
    <div className="grid grid-cols-5 gap-2 max-w-[250px] mx-auto p-3 rounded-2xl bg-white/70 border-4 border-sky-200">
      {Array.from({ length: 10 }, (_, index) => {
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

export default function MathVisual({ visual }) {
  if (!visual) return null;
  return (
    <div className="my-5 rounded-3xl bg-sky-50/90 p-4 shadow-inner">
      {visual.type === 'tenFrame' && <TenFrame {...visual} />}
      {visual.type === 'groups' && <Groups {...visual} />}
      {visual.type === 'array' && <DotArray {...visual} />}
      {visual.type === 'numberTree' && <NumberTree {...visual} />}
      {visual.type === 'sharing' && <Sharing {...visual} />}
    </div>
  );
}
