import React, { useEffect, useState } from 'react';
import { getStages, MEDAL_INFO } from '../utils/gameStorage';
import CoinIcon from './CoinIcon';

const STAGE_COLORS = [
  'from-emerald-400 to-emerald-600',
  'from-sky-400 to-sky-600',
  'from-violet-400 to-violet-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
];

export default function GamesHub({ setPage, gameState = { exp: 0, coin: 0 }, onSelectStage, stageProgress = {} }) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getStages().then(data => {
      if (!alive) return;
      setStages(data);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  return (
    <div
      className="space-y-5 pt-2 pb-12 select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', touchAction: 'pan-y' }}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between">
        <button onClick={() => setPage('dashboard')} className="text-orange-400 font-black text-xs uppercase italic underline">← Back</button>
        <div className="flex gap-2">
          <span className="bg-emerald-500/15 text-emerald-300 px-3 py-1 rounded-full font-black text-xs">⭐ {gameState.exp ?? 0}</span>
          <span className="bg-yellow-500/15 text-yellow-300 px-3 py-1 rounded-full font-black text-xs inline-flex items-center gap-1"><CoinIcon className="w-4 h-4" /> {gameState.coin ?? 0}</span>
        </div>
      </div>

      <h2 className="text-3xl font-black text-center uppercase italic text-white tracking-tighter">⚔️ เลือกด่าน</h2>

      {loading ? (
        <div className="text-center text-white/40 py-10">กำลังโหลด...</div>
      ) : stages.length === 0 ? (
        <div className="text-center text-white/40 py-10 px-6">
          ยังไม่มีการตั้งค่าด่าน — ให้ admin ตั้งค่าในหน้า Admin Panel ก่อน
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-6 pt-2">
          {/* เส้นเชื่อมระหว่างด่าน (เหมือนแผนที่) */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-white/15 rounded-full -z-0" />
          {stages.map((s, idx) => {
            const color = STAGE_COLORS[idx % STAGE_COLORS.length];
            const alignClass = idx % 2 === 0 ? 'self-start ml-6' : 'self-end mr-6';
            const wStart = stages.slice(0, idx).reduce((sum, x) => sum + (x.monster_count || 0) + 1, 0) + 1;
            const wEnd = wStart + (s.monster_count || 0);
            const prog = stageProgress[s.stage_no] || null;
            // ด่านแรกปลดล็อกเสมอ ; ด่านถัดไปปลดล็อกเมื่อเล่นด่านก่อนหน้าผ่านแล้ว
            const prevStage = stages[idx - 1];
            const unlocked = idx === 0 || (prevStage && !!stageProgress[prevStage.stage_no]);
            const medalInfo = prog?.medal ? MEDAL_INFO[prog.medal] : null;
            return (
              <button
                key={s.stage_no}
                onClick={() => unlocked && onSelectStage(s.stage_no)}
                disabled={!unlocked}
                className={`relative z-10 w-40 h-32 rounded-[1.8rem] shadow-xl overflow-hidden text-white flex flex-col items-center justify-center gap-1 transform transition-all border-4 border-white ${unlocked ? 'active:scale-95 cursor-pointer' : 'cursor-not-allowed'} ${s.map_image_url ? '' : `bg-gradient-to-br ${color}`} ${alignClass}`}
              >
                {s.map_image_url && (
                  <>
                    <img src={s.map_image_url} alt={s.title || `ด่าน ${s.stage_no}`} className={`absolute inset-0 w-full h-full object-cover ${unlocked ? '' : 'grayscale'}`} />
                    <div className={`absolute inset-0 ${unlocked ? 'bg-black/30' : 'bg-black/65'}`} />
                  </>
                )}
                {!s.map_image_url && !unlocked && <div className="absolute inset-0 bg-black/55" />}

                {/* เหรียญรางวัลของด่านที่เล่นผ่านแล้ว */}
                {medalInfo && (
                  <span className="absolute top-1.5 right-2 text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" title={`เหรียญ${medalInfo.label}`}>
                    {medalInfo.emoji}
                  </span>
                )}

                <span className="relative text-4xl font-black italic leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{s.stage_no}</span>
                <span className="relative text-sm font-black uppercase italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{s.title || `ด่าน ${s.stage_no}`}</span>
                {unlocked ? (
                  prog ? (
                    <span className="relative text-[11px] font-bold bg-emerald-500/80 px-2 py-0.5 rounded-full">ตอบถูก {prog.correct}/{prog.total} คำ</span>
                  ) : (
                    <span className="relative text-[11px] font-bold bg-black/35 px-2 py-0.5 rounded-full">คำที่ {wStart}–{wEnd}</span>
                  )
                ) : (
                  <span className="relative text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">🔒</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
