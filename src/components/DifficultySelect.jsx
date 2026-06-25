import React from 'react';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../utils/gameStorage';
import CoinIcon from './CoinIcon';

const DIFFICULTY_STYLES = {
  easy: {
    grad: 'from-emerald-500 to-emerald-700',
    border: 'border-emerald-300/60',
    icon: '🌱',
    desc: 'HP/ATK ศัตรูตามปกติ (×1)',
  },
  medium: {
    grad: 'from-amber-500 to-orange-600',
    border: 'border-amber-300/60',
    icon: '⚡',
    desc: 'HP/ATK ศัตรู ×2',
  },
  hard: {
    grad: 'from-red-500 to-red-700',
    border: 'border-red-300/60',
    icon: '🔥',
    desc: 'HP/ATK ศัตรู ×3',
  },
};

export default function DifficultySelect({ setPage, gameState = { exp: 0, coin: 0 }, onSelectDifficulty }) {
  return (
    <div
      className="space-y-5 pt-2 pb-12 select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'pan-y' }}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between">
        <button onClick={() => setPage('dashboard')} className="text-orange-400 font-black text-xs uppercase italic underline">← Back</button>
        <div className="flex gap-2">
          <span className="bg-emerald-500/15 text-emerald-300 px-3 py-1 rounded-full font-black text-xs">⭐ {gameState.exp ?? 0}</span>
          <span className="bg-yellow-500/15 text-yellow-300 px-3 py-1 rounded-full font-black text-xs inline-flex items-center gap-1">
            <CoinIcon className="w-4 h-4" /> {gameState.coin ?? 0}
          </span>
        </div>
      </div>

      <h2 className="text-3xl font-black text-center uppercase italic text-white tracking-tighter">⚔️ เลือกระดับความยาก</h2>
      <p className="text-center text-white/50 text-xs font-bold px-4">เลือกระดับก่อนเข้าเลือกด่าน</p>

      <div className="flex flex-col gap-4 px-2 pt-2">
        {DIFFICULTY_IDS.map(id => {
          const cfg = DIFFICULTIES[id];
          const style = DIFFICULTY_STYLES[id];
          return (
            <button
              key={id}
              onClick={() => onSelectDifficulty(id)}
              className={`relative w-full rounded-2xl border-2 ${style.border} bg-gradient-to-r ${style.grad} p-5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.4)] active:scale-[0.98] transition-transform overflow-hidden`}
            >
              <div className="absolute inset-0 bg-black/10" />
              <div className="relative flex items-center gap-4">
                <span className="text-4xl drop-shadow-lg">{style.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-black text-white uppercase italic drop-shadow">{cfg.label}</div>
                  <div className="text-sm font-bold text-white/85 mt-0.5">{style.desc}</div>
                  <div className="text-[11px] font-bold text-white/60 mt-1">
                    รางวัล: {cfg.rewardLabel} ทอง / เงิน / ทองแดง
                  </div>
                </div>
                <span className="text-2xl text-white/80 font-black">→</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
