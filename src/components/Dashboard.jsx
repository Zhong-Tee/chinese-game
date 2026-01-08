import React from 'react';

export default function Dashboard({ setPage }) {
  // ไม่ต้องมี {page === 'dashboard' && ...} เพราะเราเช็คเงื่อนไขนี้จากไฟล์ App.jsx แล้ว
  return (
    <div 
      className="grid grid-cols-2 gap-4 pt-2 pb-10 select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
    >
      <button onClick={() => setPage('fc-chars')} className="h-36 bg-orange-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">🎴</span> Flashcards
      </button>
      <button onClick={() => setPage('minigames')} className="h-36 bg-emerald-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">🎮</span> Mini Games
      </button>
      <button onClick={() => setPage('comics')} className="h-36 bg-pink-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">📖</span> Comics
      </button>
      <button onClick={() => setPage('library')} className="h-36 bg-purple-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">📚</span> Library
      </button>
      <button onClick={() => setPage('score')} className="h-36 bg-yellow-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">📊</span> Score
      </button>
      <button onClick={() => setPage('settings')} className="h-36 bg-slate-700 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">⚙️</span> Settings
      </button>
    </div>
  );
}