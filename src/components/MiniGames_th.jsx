import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export default function MiniGames_th({ user, allMasterCards, selectedIds, timerSetting, setPage }) {
  const [mode, setMode] = useState('normal');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timer, setTimer] = useState(timerSetting);
  const [gameQueue, setGameQueue] = useState([]); // คิวคำศัพท์

  // 1. ฟังก์ชันดึงคะแนนเดิมจาก DB และสร้างคิว
  const initGame = useCallback(async () => {
    // ดึงคะแนนสะสม
    const { data } = await supabase.from('user_scores').select('total_score').eq('user_id', user.id).eq('game_type', 'th').single();
    if (data) setScore(data.total_score);

    // สร้างคิวคำศัพท์
    let poolIds = [];
    if (mode === 'review') {
      const { data: reviewData } = await supabase.from('user_progress').select('flashcard_id').eq('user_id', user.id).gt('wrong_count', 0);
      poolIds = reviewData?.map(d => d.flashcard_id) || [];
    } else {
      poolIds = selectedIds;
    }

    if (poolIds.length === 0) {
      alert("ไม่มีคำศัพท์ให้เล่น"); setPage('minigames'); return;
    }

    const shuffled = poolIds.sort(() => Math.random() - 0.5);
    setGameQueue(shuffled);
    loadNextQuestion(shuffled[0], shuffled);
  }, [mode, selectedIds, user.id]);

  useEffect(() => { initGame(); }, [mode]);

  const loadNextQuestion = (id, currentQueue) => {
    if (!id) { alert("🎉 จบเกม! คุณเล่นครบทุกคำแล้ว"); setPage('minigames'); return; }
    const correctWord = allMasterCards.find(c => c.id === id);
    const wrongOptions = allMasterCards.filter(c => c.id !== id).sort(() => 0.5 - Math.random()).slice(0, 3);
    setOptions([correctWord, ...wrongOptions].sort(() => 0.5 - Math.random()));
    setCurrentQuestion(correctWord);
    setTimer(timerSetting);
  };

  // 2. ระบบบันทึกคะแนนลง DB (Upsert)
  const syncScore = async (newScore) => {
    await supabase.from('user_scores').upsert({ 
      user_id: user.id, 
      game_type: 'th', 
      total_score: newScore 
    });
  };

  const handleAnswer = async (selected) => {
    const isCorrect = selected && selected.id === currentQuestion.id;
    let newScore = score;
    let newStreak = streak;

    if (isCorrect) {
      newStreak += 1;
      newScore += (newStreak > 5 ? 2 : 1);
      if (mode === 'review') {
        await supabase.from('user_progress').update({ wrong_count: 0 }).eq('user_id', user.id).eq('flashcard_id', currentQuestion.id);
      }
    } else {
      newStreak = 0;
      newScore = Math.max(0, newScore - 3);
      const { data: prog } = await supabase.from('user_progress').select('wrong_count').eq('user_id', user.id).eq('flashcard_id', currentQuestion.id).single();
      await supabase.from('user_progress').update({ wrong_count: (prog?.wrong_count || 0) + 1, level: 1 }).eq('user_id', user.id).eq('flashcard_id', currentQuestion.id);
    }

    setScore(newScore);
    setStreak(newStreak);
    syncScore(newScore); // บันทึกลง DB

    const nextQueue = gameQueue.slice(1);
    setGameQueue(nextQueue);
    loadNextQuestion(nextQueue[0], nextQueue);
  };

  useEffect(() => {
    let interval;
    if (currentQuestion && timer > 0) interval = setInterval(() => setTimer(t => t - 1), 1000);
    else if (timer === 0) handleAnswer(null);
    return () => clearInterval(interval);
  }, [timer, currentQuestion]);

  if (!currentQuestion) return null;

  return (
    <div className="flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-4">
        <button onClick={() => setPage('minigames')} className="text-slate-800 font-black text-xs underline italic uppercase">Exit</button>
        <div className="flex gap-2">
           <div className="bg-orange-600 text-white px-3 py-1 rounded-full font-black text-[10px] italic">SCORE: {score}</div>
           <div className="bg-slate-800 text-white px-3 py-1 rounded-full font-black text-[10px] italic uppercase">Left: {gameQueue.length}</div>
        </div>
        <div className={`text-3xl font-black italic ${timer < 3 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>{timer}s</div>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setMode('normal')} className={`px-4 py-1 rounded-full font-black text-[10px] uppercase ${mode === 'normal' ? 'bg-slate-800 text-white' : 'bg-white border'}`}>Normal</button>
        <button onClick={() => setMode('review')} className={`px-4 py-1 rounded-full font-black text-[10px] uppercase ${mode === 'review' ? 'bg-red-600 text-white' : 'bg-white border'}`}>Review ({gameQueue.length})</button>
      </div>

      <div className="w-full max-w-[280px] aspect-[3/4] rounded-[2rem] overflow-hidden shadow-2xl border-8 border-white mb-8">
        <img src={currentQuestion.image_front_url} className="w-full h-full object-cover" alt="Q" />
      </div>

      <div className="grid grid-cols-1 gap-3 w-full max-w-sm px-4">
        {options.map((opt, idx) => (
          <button key={idx} onClick={() => handleAnswer(opt)} className="bg-white p-5 rounded-2xl border-b-4 border-slate-200 active:border-0 active:translate-y-1 transition-all shadow-sm font-black text-slate-700 italic uppercase">
            {opt.th}
          </button>
        ))}
      </div>
    </div>
  );
}