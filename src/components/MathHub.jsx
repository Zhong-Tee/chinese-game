import React, { useEffect, useState } from 'react';
import { loadMathProgress } from '../utils/math/mathStorage';
import { getMathSummary, isMathLevelUnlocked, MATH_STAGE_META, normalizeMathProgress } from '../utils/math/mathProgress';

const LEVEL_NAMES = ['เริ่มเข้าใจ', 'ฝึกแยกจำนวน', 'ทำทีละขั้น', 'คิดในใจ'];
const BADGE_LABELS = {
  'Make 10 Master': 'เซียนเลขครบสิบ',
  'Addition Hero': 'ฮีโร่นักบวก',
  'Break 10 Master': 'เซียนแยกหลักสิบ',
  'Multiplication Explorer': 'นักสำรวจการคูณ',
  'Division Explorer': 'นักสำรวจการหาร',
};

export default function MathHub({ user, isAdmin = false, setPage, onStart }) {
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    let alive = true;
    loadMathProgress(user?.id).then(value => alive && setProgress(normalizeMathProgress(value)));
    return () => { alive = false; };
  }, [user?.id]);

  if (!progress) return <div className="py-20 text-center font-black text-indigo-400">กำลังเตรียมห้องคณิตศาสตร์...</div>;
  const summary = getMathSummary(progress);

  return (
    <div className="math-screen min-h-full rounded-[2rem] bg-gradient-to-b from-sky-100 via-indigo-50 to-amber-50 p-4 pb-12 text-slate-800">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setPage('dashboard')} className="rounded-full bg-white px-4 py-2 text-sm font-black text-indigo-600 shadow active:scale-95">← หน้าหลัก</button>
        <div className="rounded-full bg-white px-4 py-2 text-sm font-black text-orange-500 shadow">🔥 {progress.dailyStreak} วัน</div>
      </div>

      <div className="mt-5 text-center">
        <div className="text-5xl">🧮</div>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-indigo-700">คณิตหรรษา</h1>
        <p className="font-bold text-slate-500">เข้าใจวิธีคิด แล้วคณิตจะสนุก!</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white p-3 shadow"><div className="text-xl font-black text-emerald-500">{summary.accuracy}%</div><div className="text-[11px] font-bold text-slate-400">ความแม่นยำ</div></div>
        <div className="rounded-2xl bg-white p-3 shadow"><div className="text-xl font-black text-sky-500">{summary.mastery}</div><div className="text-[11px] font-bold text-slate-400">ความชำนาญ</div></div>
        <div className="rounded-2xl bg-white p-3 shadow"><div className="text-xl font-black text-violet-500">{progress.totalQuestions}</div><div className="text-[11px] font-bold text-slate-400">โจทย์ทั้งหมด</div></div>
      </div>

      <button
        onClick={() => onStart({ mode: 'daily', progress })}
        className="mt-5 w-full rounded-3xl bg-gradient-to-r from-orange-400 to-pink-500 p-4 text-left text-white shadow-[0_6px_0_#be3657] active:translate-y-1 active:shadow-[0_2px_0_#be3657]"
      >
        <div className="flex items-center gap-4">
          <span className="text-4xl">🌞</span>
          <div><div className="text-xl font-black">ฝึกประจำวัน</div><div className="text-sm font-bold text-white/85">18 ข้อ • ประมาณ 5–10 นาที</div></div>
          <span className="ml-auto text-2xl">▶</span>
        </div>
      </button>

      <h2 className="mt-7 mb-3 text-lg font-black text-indigo-800">เลือกด่าน</h2>
      <div className="space-y-4">
        {MATH_STAGE_META.map(stage => {
          const stageUnlocked = isMathLevelUnlocked(progress, stage.stage, 1, isAdmin);
          return (
            <section key={stage.stage} className={`rounded-3xl border-2 bg-white p-4 shadow-sm ${stageUnlocked ? 'border-white' : 'border-slate-200 opacity-65'}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${stage.color} text-2xl shadow`}>{stageUnlocked ? stage.icon : '🔒'}</div>
                <div className="min-w-0"><div className="text-xs font-black text-slate-400">ด่านที่ {stage.stage}</div><div className="truncate text-lg font-black">{stage.title}</div><div className="text-xs font-bold text-slate-500">{stage.thai}</div></div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(level => {
                  const unlocked = isMathLevelUnlocked(progress, stage.stage, level, isAdmin);
                  return (
                    <button key={level} disabled={!unlocked} onClick={() => onStart({ mode: 'stage', stage: stage.stage, level, progress })}
                      title={LEVEL_NAMES[level - 1]}
                      className={`rounded-2xl py-3 text-center font-black transition active:scale-95 ${unlocked ? `bg-gradient-to-br ${stage.color} text-white shadow` : 'bg-slate-100 text-slate-300'}`}>
                      <span className="block text-[10px]">{unlocked ? 'ระดับ' : '🔒'}</span>{unlocked ? level : ''}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {progress.badges.length > 0 && (
        <section className="mt-6 rounded-3xl bg-white p-4 shadow">
          <h2 className="font-black text-indigo-800">🏅 เหรียญรางวัลของฉัน</h2>
          <div className="mt-3 flex flex-wrap gap-2">{progress.badges.map(badge => <span key={badge} className="rounded-full bg-amber-100 px-3 py-2 text-xs font-black text-amber-700">⭐ {BADGE_LABELS[badge] || badge}</span>)}</div>
        </section>
      )}
    </div>
  );
}
