import React from 'react';

export default function Flashcards({ 
  setPage, 
  levelCounts, 
  schedules, 
  checkLevelAvailable, 
  startLevelGame 
}) {
  return (
    <div 
      className="space-y-4 pt-2 text-center pb-20 select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      onTouchStart={(e) => e.preventDefault()}
      onTouchMove={(e) => e.preventDefault()}
      onSelectStart={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex items-center mb-4">
        <button onClick={() => setPage('dashboard')} className="text-orange-600 font-black text-sm uppercase italic underline">← Back to Menu</button>
      </div>
      
      <h2 className="text-xl font-black text-slate-300 uppercase italic mb-6 tracking-widest">Flashcard Levels</h2>
      
      {/* Level 1-7 */}
      {[1, 2, 3, 4, 5, 6, 7].map(lv => {
        const available = checkLevelAvailable(lv);
        let dateInfo = "ทุกวัน";
        if (lv === 3) dateInfo = schedules.lv3.length > 0 ? schedules.lv3.join(", ") : "รอตั้งค่า";
        else if (lv === 4) dateInfo = schedules.lv4.length > 0 ? schedules.lv4.join(", ") : "รอตั้งค่า";
        else if (lv === 5) dateInfo = schedules.lv5.length > 0 ? "วันที่ " + schedules.lv5.sort((a,b)=>a-b).join(",") : "รอตั้งค่า";
        else if (lv === 6) dateInfo = schedules.lv6.length > 0 ? "วันที่ " + schedules.lv6.sort((a,b)=>a-b).join(",") : "รอตั้งค่า";

        return (
          <div key={lv} className={`bg-white p-5 rounded-[2rem] shadow-sm border-2 flex items-center min-h-[110px] mb-3 transition-all ${available ? 'border-orange-500 shadow-orange-50' : 'opacity-40 grayscale border-slate-200'}`}>
            {/* ซ้าย: LV และ จำนวนคำ (12pt) */}
            <div className="w-1/4 text-left flex flex-col justify-center">
              <span className="font-black text-lg italic uppercase leading-none text-slate-800">LV {lv}</span>
              <span className="text-[12pt] font-black text-orange-600 italic mt-1 whitespace-nowrap">
                {levelCounts[lv]} Words
              </span>
            </div>

            {/* กลาง: วันที่เล่น (Centered) */}
            <div className="w-2/4 text-center px-2">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic text-center w-full">Schedule</div>
              <div className="text-[12px] font-black text-slate-800 uppercase leading-tight bg-orange-50/50 py-2 px-1 rounded-xl border border-orange-100">
                {dateInfo}
              </div>
            </div>

            {/* ขวา: ปุ่มกดทรงเหลี่ยม */}
            <div className="w-1/4 text-right flex justify-end items-center">
              {available ? (
                <button 
                  onClick={() => startLevelGame(lv)} 
                  className="bg-orange-500 text-white px-5 py-3 rounded-xl font-black shadow-lg shadow-orange-200 text-xs uppercase tracking-tighter active:scale-90 transition-all"
                >
                  Start
                </button>
              ) : ( 
                <div className="text-[9px] font-black text-slate-400 italic border border-slate-100 px-2 py-1 rounded-lg uppercase text-center">Locked</div> 
              )}
            </div>
          </div>
        );
      })}

      {/* Level คำผิดบ่อย (Mistakes) */}
      <div className="bg-red-50 p-5 rounded-[2.5rem] shadow-md border-2 border-red-500 flex items-center min-h-[110px] mt-6 mb-10">
        <div className="w-1/4 text-left flex flex-col justify-center">
          <span className="font-black text-[13px] italic uppercase leading-none text-red-600">คำผิดบ่อย</span>
          <span className="text-[12pt] font-black text-red-600 italic mt-1 whitespace-nowrap">
            {levelCounts.mistakes} Words
          </span>
        </div>
        <div className="w-2/4 text-center px-2">
          <div className="text-[10px] font-black text-red-300 uppercase tracking-widest mb-1 italic text-center w-full">Priority</div>
          <div className="text-[12px] font-black text-red-600 uppercase bg-white py-2 px-1 rounded-xl shadow-sm border border-red-100">ทุกวัน</div>
        </div>
        <div className="w-1/4 text-right flex justify-end items-center">
          <button 
            onClick={() => startLevelGame('mistakes')} 
            className="bg-red-600 text-white px-5 py-3 rounded-xl font-black shadow-lg shadow-red-200 text-xs uppercase tracking-tighter active:scale-90 transition-all uppercase"
          >
            Fix it
          </button>
        </div>
      </div>
    </div>
  );
}