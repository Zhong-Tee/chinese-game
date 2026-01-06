import React from 'react';

export default function Settings({ 
  page, setPage, timerSetting, setTimerSetting, 
  gameTimerSetting, setGameTimerSetting, 
  schedules, setSchedules, saveSettings 
}) {
  const daysOfWeek = ["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์"];
  const datesOfMonth = Array.from({ length: 30 }, (_, i) => i + 1);

  // --- 1. หน้าตั้งค่าหลัก ---
  if (page === 'settings') {
    return (
      <div className="space-y-6 pt-4">
        <button onClick={() => setPage('dashboard')} className="text-orange-600 font-black text-sm uppercase italic underline">← Back</button>
        <h2 className="text-2xl font-black text-center uppercase italic">Settings</h2>
        
        <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm space-y-8">
          {/* ตั้งเวลา Flashcard */}
          <div className="text-center">
            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase">Flashcard Timer</label>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => {
                const val = Math.max(1, timerSetting - 1);
                setTimerSetting(val);
                saveSettings(val, gameTimerSetting, schedules); // บันทึกลง DB ทันที
              }} className="w-10 h-10 bg-slate-100 rounded-full font-black">-</button>
              
              <div className="text-2xl font-black text-orange-600 italic w-12">{timerSetting}s</div>
              
              <button onClick={() => {
                const val = timerSetting + 1;
                setTimerSetting(val);
                saveSettings(val, gameTimerSetting, schedules); // บันทึกลง DB ทันที
              }} className="w-10 h-10 bg-slate-100 rounded-full font-black">+</button>
            </div>
          </div>

          {/* ตั้งเวลา Mini Games */}
          <div className="text-center">
            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase text-emerald-500">Mini Game Timer</label>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => {
                const val = Math.max(1, gameTimerSetting - 1);
                setGameTimerSetting(val);
                saveSettings(timerSetting, val, schedules); // บันทึกลง DB ทันที
              }} className="w-10 h-10 bg-slate-100 rounded-full font-black">-</button>
              
              <div className="text-2xl font-black text-emerald-600 italic w-12">{gameTimerSetting}s</div>
              
              <button onClick={() => {
                const val = gameTimerSetting + 1;
                setGameTimerSetting(val);
                saveSettings(timerSetting, val, schedules); // บันทึกลง DB ทันที
              }} className="w-10 h-10 bg-slate-100 rounded-full font-black">+</button>
            </div>
          </div>

          <button onClick={() => setPage('select-words')} className="w-full bg-orange-500 text-white p-4 rounded-3xl font-black uppercase italic shadow-lg shadow-orange-100">📂 Select Study Words</button>
          <button onClick={() => setPage('set-schedule')} className="w-full bg-slate-800 text-white p-4 rounded-3xl font-black uppercase italic shadow-lg">📅 Set Level Schedule</button>
        </div>
      </div>
    );
  }

  // --- 2. หน้าจัดตารางเรียน (Scheduling) ---
  if (page === 'set-schedule') {
    return (
      <div className="space-y-4 pt-2">
        <button onClick={() => setPage('settings')} className="text-orange-600 font-black underline italic uppercase text-xs">← BACK</button>
        <h2 className="text-xl font-black uppercase italic mb-4">Scheduling</h2>
        
        {/* Weekly Schedule */}
        <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 space-y-4 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-full italic">Weekly (Lv 3: 2 Days | Lv 4: 1 Day)</p>
          <div className="grid grid-cols-4 gap-2">
            {daysOfWeek.map(day => (
              <button 
                key={day} 
                onClick={() => {
                  let s3 = [...(schedules.lv3 || [])], s4 = [...(schedules.lv4 || [])];
                  if (s3.includes(day)) s3 = s3.filter(d => d !== day);
                  else if (s4.includes(day)) s4 = s4.filter(d => d !== day);
                  else if (s3.length < 2) s3.push(day);
                  else if (s4.length < 1) s4.push(day);
                  const newS = { ...schedules, lv3: s3, lv4: s4 };
                  setSchedules(newS); 
                  saveSettings(timerSetting, gameTimerSetting, newS);
                }} 
                className={`text-[10px] p-2 rounded-xl font-black border-2 transition-all ${schedules.lv3?.includes(day) ? 'bg-orange-500 text-white border-orange-500' : schedules.lv4?.includes(day) ? 'bg-blue-500 text-white border-blue-500' : 'bg-slate-50 text-black border-slate-100'}`}
              >
                {day}<br/>{schedules.lv3?.includes(day) ? 'LV3' : schedules.lv4?.includes(day) ? 'LV4' : '-'}
              </button>
            ))}
          </div>
        </div>

        {/* Monthly Schedule */}
        <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 space-y-4 shadow-sm mb-10 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-full italic">Monthly (Lv 5: 2 Dates | Lv 6: 1 Date)</p>
          <div className="grid grid-cols-6 gap-2 p-1">
            {datesOfMonth.map(date => (
              <button 
                key={date} 
                onClick={() => {
                  let s5 = [...(schedules.lv5 || [])], s6 = [...(schedules.lv6 || [])];
                  if (s5.includes(date)) s5 = s5.filter(d => d !== date);
                  else if (s6.includes(date)) s6 = s6.filter(d => d !== date);
                  else if (s5.length < 2) s5.push(date);
                  else if (s6.length < 1) s6.push(date);
                  const newS = { ...schedules, lv5: s5, lv6: s6 };
                  setSchedules(newS); 
                  saveSettings(timerSetting, gameTimerSetting, newS);
                }} 
                className={`text-sm p-2.5 rounded-xl font-black border-2 transition-all ${schedules.lv5?.includes(date) ? 'bg-purple-500 text-white border-purple-500' : schedules.lv6?.includes(date) ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 text-black border-slate-100'}`}
              >
                {date}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}