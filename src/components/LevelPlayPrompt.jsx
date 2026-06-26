import React from 'react';
import { LEVEL_SCHEDULE_META } from '../utils/levelScheduleMeta';

export default function LevelPlayPrompt({ levels, levelCounts = {}, onPlayLevel, onDismiss }) {
  if (!levels?.length) return null;

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-900/85 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 pt-8 pb-6 text-center">
          <div className="text-6xl mb-3">🎮</div>
          <h2 className="text-3xl sm:text-4xl font-black text-white uppercase italic tracking-tight leading-tight">
            เล่นได้เลย !
          </h2>
        </div>
        <div className="px-5 py-5 space-y-3">
          {levels.map((levelKey) => {
            const meta = LEVEL_SCHEDULE_META[String(levelKey)];
            const count = levelCounts[Number(levelKey)] ?? 0;
            return (
              <button
                key={levelKey}
                type="button"
                onClick={() => onPlayLevel(levelKey)}
                disabled={count === 0}
                className={`w-full flex items-center justify-between gap-3 rounded-2xl px-5 py-4 border-2 font-black transition-all active:scale-[0.98] ${
                  count > 0
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <div className="text-left">
                  <div className="text-2xl uppercase italic">{meta?.label || `LV${levelKey}`}</div>
                  <div className="text-sm font-bold opacity-70 mt-0.5">{count} คำ · {meta?.scheduleLabel}</div>
                </div>
                <span className="text-base sm:text-lg uppercase italic shrink-0">
                  {count > 0 ? 'คลิกเพื่อเล่น →' : 'ยังไม่มีคำ'}
                </span>
              </button>
            );
          })}
        </div>
        <div className="px-5 pb-6">
          <button
            type="button"
            onClick={onDismiss}
            className="w-full bg-slate-200 text-slate-700 py-4 rounded-2xl font-black text-base uppercase italic active:scale-95 transition-all"
          >
            ไว้ทีหลัง
          </button>
        </div>
      </div>
    </div>
  );
}
