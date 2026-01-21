import React from 'react';

export default function Comics({ setPage }) {
  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', touchAction: 'pan-y' }}
      onDragStart={(e) => {
        if (e.target.tagName === 'IMG') {
          e.preventDefault();
        }
      }}
    >
      <div className="max-w-md w-full space-y-8">
        <div className="space-y-4">
          <div className="text-6xl mb-4">📖</div>
          <h1 className="text-4xl font-black text-slate-800 uppercase italic tracking-tighter">
            Coming Soon
          </h1>
          <p className="text-lg font-bold text-slate-600">
            Comics feature is coming soon!
          </p>
        </div>
        
        <button 
          onClick={() => setPage('dashboard')}
          className="w-full bg-orange-600 text-white p-4 rounded-3xl font-black shadow-lg uppercase active:scale-95 transition-all text-lg"
        >
          กลับเมนูหลัก
        </button>
      </div>
    </div>
  );
}

