import React, { useEffect, useState } from 'react';
import { getStages, DIFFICULTIES, isStageCleared, getStageDifficultyProgress } from '../utils/gameStorage';
import { RewardTierRow } from './RewardIcon';
import CoinIcon from './CoinIcon';

const STAGE_COLORS = [
  'from-emerald-400 to-emerald-600',
  'from-sky-400 to-sky-600',
  'from-violet-400 to-violet-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
];

export default function GamesHub({
  setPage,
  gameState = { exp: 0, coin: 0 },
  onSelectStage,
  stageProgress = {},
  difficulty = 'easy',
  onBackToDifficulty,
}) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const diffCfg = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;

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
      style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'pan-y' }}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between">
        <button onClick={onBackToDifficulty || (() => setPage('dashboard'))} className="text-orange-400 font-black text-xs uppercase italic underline">
          ← {onBackToDifficulty ? 'เปลี่ยนระดับ' : 'Back'}
        </button>
        <div className="flex gap-2">
          <span className="bg-emerald-500/15 text-emerald-300 px-3 py-1 rounded-full font-black text-xs">⭐ {gameState.exp ?? 0}</span>
          <span className="bg-yellow-500/15 text-yellow-300 px-3 py-1 rounded-full font-black text-xs inline-flex items-center gap-1">
            <CoinIcon className="w-4 h-4" /> {gameState.coin ?? 0}
          </span>
        </div>
      </div>

      <h2 className="text-3xl font-black text-center uppercase italic text-white tracking-tighter">⚔️ เลือกด่าน</h2>
      <div className="text-center">
        <span className="inline-block bg-white/10 text-white/80 px-4 py-1 rounded-full text-xs font-black uppercase">
          ระดับ: {diffCfg.label} (×{diffCfg.multiplier})
        </span>
      </div>

      {loading ? (
        <div className="text-center text-white/40 py-10">กำลังโหลด...</div>
      ) : stages.length === 0 ? (
        <div className="text-center text-white/40 py-10 px-6">
          ยังไม่มีการตั้งค่าด่าน — ให้ admin ตั้งค่าในหน้า Admin Panel ก่อน
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-6 pt-4 pb-6 px-3 rounded-[2.5rem] bg-gradient-to-b from-[#24324a] via-[#1a2438] to-[#121c2e] border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="absolute top-4 bottom-4 left-1/2 -translate-x-1/2 w-1.5 bg-gradient-to-b from-amber-300/50 via-orange-400/35 to-amber-300/50 rounded-full -z-0 shadow-[0_0_12px_rgba(251,191,36,0.25)]" />
          {stages.map((s, idx) => {
            const color = STAGE_COLORS[idx % STAGE_COLORS.length];
            const alignClass = idx % 2 === 0 ? 'self-start ml-2 sm:ml-4' : 'self-end mr-2 sm:mr-4';
            const wStart = stages.slice(0, idx).reduce((sum, x) => sum + (x.monster_count || 0) + 1, 0) + 1;
            const wEnd = wStart + (s.monster_count || 0);
            const prog = getStageDifficultyProgress(stageProgress, s.stage_no, difficulty);
            const prevStage = stages[idx - 1];
            const unlocked = idx === 0 || (prevStage && isStageCleared(stageProgress, prevStage.stage_no));
            const rewardsOnLeft = idx % 2 === 0;

            return (
              <div key={s.stage_no} className={`relative z-10 flex items-center gap-2 ${alignClass}`}>
                {rewardsOnLeft && (
                  <RewardTierRow
                    rewardType={diffCfg.rewardType}
                    earnedMedal={prog?.medal}
                    className="shrink-0"
                  />
                )}
                <button
                  onClick={() => unlocked && onSelectStage(s.stage_no)}
                  disabled={!unlocked}
                  className={`relative w-40 sm:w-44 h-32 sm:h-36 rounded-[1.8rem] overflow-hidden text-white flex flex-col items-center justify-center gap-1 transform transition-all border-[3px] ${unlocked ? 'border-white/90 shadow-[0_10px_28px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.15)] active:scale-95 cursor-pointer' : 'border-white/35 shadow-[0_6px_20px_rgba(0,0,0,0.45)] cursor-not-allowed opacity-90'} ${s.map_image_url ? 'bg-slate-700' : `bg-gradient-to-br ${color}`}`}
                >
                  {s.map_image_url && (
                    <>
                      <img
                        src={s.map_image_url}
                        alt={s.title || `ด่าน ${s.stage_no}`}
                        className={`absolute inset-0 w-full h-full object-cover ${unlocked ? 'brightness-[1.12] contrast-[1.08] saturate-[1.12]' : 'grayscale brightness-[0.72] contrast-[0.95]'}`}
                      />
                      <div className={`absolute inset-0 ${unlocked ? 'bg-gradient-to-t from-black/50 via-black/15 to-transparent' : 'bg-gradient-to-t from-black/70 via-black/40 to-black/20'}`} />
                    </>
                  )}
                  {!s.map_image_url && !unlocked && <div className="absolute inset-0 bg-black/40" />}

                  <span className="relative text-4xl font-black italic leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{s.stage_no}</span>
                  <span className="relative text-sm font-black uppercase italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{s.title || `ด่าน ${s.stage_no}`}</span>
                  {unlocked ? (
                    prog ? (
                      <span className="relative text-[11px] font-bold bg-emerald-600/90 px-2.5 py-0.5 rounded-full shadow-md">
                        ตอบถูก {prog.correct}/{prog.total} คำ
                      </span>
                    ) : (
                      <span className="relative text-[11px] font-bold bg-black/55 backdrop-blur-[2px] px-2.5 py-0.5 rounded-full border border-white/20">
                        คำที่ {wStart}–{wEnd}
                      </span>
                    )
                  ) : (
                    <span className="relative text-2xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">🔒</span>
                  )}
                </button>
                {!rewardsOnLeft && (
                  <RewardTierRow
                    rewardType={diffCfg.rewardType}
                    earnedMedal={prog?.medal}
                    className="shrink-0"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
