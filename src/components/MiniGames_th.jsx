import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { getPlayedIds, setPlayedIds, clearPlayedIds } from '../utils/minigamePlayedStorage';
import { saveWrongWord } from '../utils/wrongWordsStorage';
import { optimizeImageUrl } from '../utils/imageOptimizer';
import { preloadNextImages } from '../utils/imageLoader';

export default function MiniGames_th({ user, allMasterCards, selectedIds, timerSetting, setPage }) {
  const [mode, setMode] = useState('normal');
  const [gameStarted, setGameStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timer, setTimer] = useState(timerSetting);
  const [gameQueue, setGameQueue] = useState([]); // คิวคำศัพท์
  const [reviewCount, setReviewCount] = useState(0); // จำนวนคำศัพท์ใน Review Mode
  const [reviewCountDisplay, setReviewCountDisplay] = useState(0); // จำนวนคำศัพท์ที่เหลือใน Review Mode (แสดงผล)
  const [normalCount, setNormalCount] = useState(0); // จำนวนคำที่เหลือใน Normal (sync จาก DB)
  const [showFeedback, setShowFeedback] = useState(false); // แสดง feedback
  const [feedbackType, setFeedbackType] = useState(null); // 'correct' หรือ 'wrong'
  const [showCombo, setShowCombo] = useState(false); // แสดง Combo X2
  const [wrongWordToast, setWrongWordToast] = useState(null); // popup "ได้เพิ่มคำผิดไว้ใน list ให้แล้ว"
  const audioContextRef = useRef(null); // AudioContext instance เดียว

  // ฟังก์ชันดึง Review count จาก DB (แยกตาม game_type: th)
  const fetchReviewCount = async () => {
    const { data } = await supabase
      .from('user_progress')
      .select('flashcard_id, minigame_wrong_count')
      .eq('user_id', user.id);
    
    if (!data) return 0;
    
    // ถ้า minigame_wrong_count เป็น JSON object ให้เช็ค game_type 'th'
    // ถ้าเป็น number ให้ใช้ค่าเดิม (backward compatibility)
    const count = data.filter(item => {
      if (typeof item.minigame_wrong_count === 'object' && item.minigame_wrong_count !== null) {
        return (item.minigame_wrong_count.th || 0) > 0;
      }
      return (item.minigame_wrong_count || 0) > 0;
    }).length;
    
    return count;
  };

  // 1. ฟังก์ชันดึงคะแนนเดิมจาก DB และสร้างคิว
  const initGame = useCallback(async () => {
    // ดึงคะแนนสะสม
    const { data } = await supabase.from('user_scores').select('total_score').eq('user_id', user.id).eq('game_type', 'th').single();
    if (data) setScore(data.total_score);

    // สร้างคิวคำศัพท์
    let poolIds = [];
    if (mode === 'review') {
      const { data: reviewData } = await supabase.from('user_progress').select('flashcard_id, minigame_wrong_count').eq('user_id', user.id);
      // กรองเฉพาะคำที่มี minigame_wrong_count > 0 สำหรับ game_type 'th'
      poolIds = (reviewData || []).filter(item => {
        if (typeof item.minigame_wrong_count === 'object' && item.minigame_wrong_count !== null) {
          return (item.minigame_wrong_count.th || 0) > 0;
        }
        return (item.minigame_wrong_count || 0) > 0;
      }).map(d => d.flashcard_id);
    } else {
      poolIds = selectedIds;
    }

    // ดึง reviewCount ทุกครั้งไม่ว่า mode ไหน
    const count = await fetchReviewCount();
    setReviewCount(count);

    if (poolIds.length === 0) {
      alert("ไม่มีคำศัพท์ให้เล่น"); setPage('minigames'); return;
    }

    // ดึงคำที่เล่นไปแล้วจาก DB (sync ทุกเครื่อง)
    const playedWords = await getPlayedIds(user.id, 'th', mode);
    
    // กรองคำที่เล่นไปแล้วออก (เฉพาะคำที่ยังอยู่ใน poolIds)
    const validPlayedWords = playedWords.filter(id => poolIds.includes(id));
    if (validPlayedWords.length !== playedWords.length) {
      await setPlayedIds(user.id, 'th', mode, validPlayedWords);
    }
    
    const remainingIds = poolIds.filter(id => !validPlayedWords.includes(id));
    
    let shuffled;
    if (remainingIds.length === 0) {
      await clearPlayedIds(user.id, 'th', mode);
      shuffled = poolIds.sort(() => Math.random() - 0.5);
    } else {
      shuffled = remainingIds.sort(() => Math.random() - 0.5);
    }
    
    setGameQueue(shuffled);
    
    // เริ่มเกมเมื่อกด Start
    if (gameStarted) {
      loadNextQuestion(shuffled[0], shuffled);
    }
  }, [mode, selectedIds, user.id, gameStarted]);

  useEffect(() => { 
    if (gameStarted) {
      initGame(); 
    }
  }, [mode, gameStarted]);

  // ดึง reviewCount + normalCount จาก DB เมื่ออยู่หน้า Start Screen (ให้ตัวเลขตรงกันทุกเครื่อง)
  useEffect(() => {
    if (!gameStarted && user?.id) {
      (async () => {
        const { data: reviewData } = await supabase.from('user_progress').select('flashcard_id, minigame_wrong_count').eq('user_id', user.id);
        const reviewPoolIds = (reviewData || []).filter(item => {
          if (typeof item.minigame_wrong_count === 'object' && item.minigame_wrong_count !== null) {
            return (item.minigame_wrong_count.th || 0) > 0;
          }
          return (item.minigame_wrong_count || 0) > 0;
        }).map(d => d.flashcard_id);
        
        setReviewCountDisplay(reviewPoolIds.length);
        setReviewCount(reviewPoolIds.length);

        const normalPlayedWords = await getPlayedIds(user.id, 'th', 'normal');
        const normalRemaining = selectedIds.filter(id => !normalPlayedWords.includes(id));
        setNormalCount(normalRemaining.length > 0 ? normalRemaining.length : selectedIds.length);
      })();
    }
  }, [gameStarted, user?.id, selectedIds]);

  const handleStartGame = () => {
    setGameStarted(true);
    initGame();
  };

  const loadNextQuestion = (id, currentQueue) => {
    if (!id) { 
      clearPlayedIds(user.id, 'th', mode);
      alert("🎉 จบเกม! คุณเล่นครบทุกคำแล้ว"); 
      setPage('minigames'); 
      return; 
    }
    const correctWord = allMasterCards.find(c => (c.id1 || c.id) === id);
    const wrongOptions = allMasterCards.filter(c => (c.id1 || c.id) !== id).sort(() => 0.5 - Math.random()).slice(0, 3);
    setOptions([correctWord, ...wrongOptions].sort(() => 0.5 - Math.random()));
    setCurrentQuestion(correctWord);
    setTimer(timerSetting);
    
    // Lazy Load: โหลดภาพถัดไป 3-5 ภาพล่วงหน้า
    if (currentQueue && currentQueue.length > 1) {
      const nextIds = currentQueue.slice(1, 6); // 5 ภาพถัดไป
      const nextCards = nextIds.map(nextId => 
        allMasterCards.find(c => (c.id1 || c.id) === nextId)
      ).filter(Boolean);
      preloadNextImages(nextCards, 5);
    }
  };

  // 2. ระบบบันทึกคะแนนลง DB (Upsert)
  const syncScore = async (newScore, currentStreak) => {
    // ดึง best_score และ best_streak ปัจจุบัน
    const { data: currentData } = await supabase
      .from('user_scores')
      .select('best_score, best_streak')
      .eq('user_id', user.id)
      .eq('game_type', 'th')
      .single();
    
    const currentBestScore = currentData?.best_score || 0;
    const newBestScore = Math.max(currentBestScore, newScore);
    const currentBestStreak = currentData?.best_streak || 0;
    const newBestStreak = Math.max(currentBestStreak, currentStreak || 0);
    
    await supabase.from('user_scores').upsert({ 
      user_id: user.id, 
      game_type: 'th',
      total_score: newScore,
      best_score: newBestScore,
      best_streak: newBestStreak // อัพเดท best_streak
    });
  };

  // ฟังก์ชันเล่นเสียง
  const playSound = (type) => {
    try {
      // สร้างหรือใช้ AudioContext instance เดียว
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      
      // Resume ถ้า AudioContext ถูก suspend
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(err => console.log('Failed to resume audio:', err));
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (type === 'correct') {
        // เสียงตอบถูก - ไล่เสียงสูงขึ้น
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } else if (type === 'correct-combo') {
        // เสียง Combo - ตื่นเต้นกว่าเดิม (เสียงสูงขึ้นเรื่อยๆ)
        const notes = [523.25, 659.25, 783.99, 987.77, 1174.66]; // C5, E5, G5, B5, D6
        notes.forEach((freq, i) => {
          oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.08);
        });
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } else if (type === 'wrong') {
        // เสียงตอบผิด - ไล่เสียงต่ำลง
        oscillator.frequency.setValueAtTime(392, audioContext.currentTime); // G4
        oscillator.frequency.setValueAtTime(330, audioContext.currentTime + 0.1); // E4
        oscillator.frequency.setValueAtTime(262, audioContext.currentTime + 0.2); // C4
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } else if (type === 'timer-warning') {
        // เสียงเตือนเวลาใกล้หมด - เสียงเตือนตื่นเต้น
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        oscillator.frequency.setValueAtTime(554.37, audioContext.currentTime + 0.05); // C#5
        gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
      }
    } catch (error) {
      console.log('ไม่สามารถเล่นเสียงได้:', error);
    }
  };

  const handleAnswer = async (selected) => {
    const questionId = currentQuestion?.id1 || currentQuestion?.id;
    const selectedId = selected?.id1 || selected?.id;
    const isCorrect = selected && selectedId === questionId;
    
    let newScore = score;
    let newStreak = streak;

    if (isCorrect) {
      newStreak += 1;
      newScore += (newStreak > 5 ? 2 : 1);
      
      // เช็คว่าเป็น Combo หรือไม่ (streak >= 5)
      const isCombo = newStreak >= 5;
      
      // แสดง feedback และเล่นเสียง
      setFeedbackType('correct');
      setShowFeedback(true);
      if (isCombo) {
        setShowCombo(true);
        playSound('correct-combo');
        // ซ่อน Combo หลังจาก 1.5 วินาที
        setTimeout(() => {
          setShowCombo(false);
        }, 1500);
      } else {
        playSound('correct');
      }

      // บันทึกคำที่เล่นไปแล้วลง DB (sync ทุกเครื่อง)
      const playedWords = await getPlayedIds(user.id, 'th', mode);
      if (!playedWords.includes(questionId)) {
        await setPlayedIds(user.id, 'th', mode, [...playedWords, questionId]);
      }

      // กรณี Review Mode — อัปเดต user_progress ให้ minigame_wrong_count.th = 0 เพื่อให้ Review/Left ลดลงเมื่อกลับเข้าเกม
      if (mode === 'review') {
        const idsToTry = [questionId, String(questionId), Number(questionId)].filter((v, i, a) => a.indexOf(v) === i && v != null && v !== '');
        const { data: prog } = await supabase.from('user_progress').select('minigame_wrong_count').eq('user_id', user.id).eq('flashcard_id', idsToTry[0]).maybeSingle();
        let newWrongCount = {};
        if (typeof prog?.minigame_wrong_count === 'object' && prog?.minigame_wrong_count !== null) {
          newWrongCount = { ...prog.minigame_wrong_count, th: 0 };
        } else {
          newWrongCount = { th: 0 };
        }
        let updateOk = false;
        for (const idVal of idsToTry) {
          const { data: updated, error: updateErr } = await supabase.from('user_progress').update({ minigame_wrong_count: newWrongCount }).eq('user_id', user.id).eq('flashcard_id', idVal).select('flashcard_id').maybeSingle();
          if (!updateErr && updated) {
            updateOk = true;
            break;
          }
          if (updateErr) console.warn('Review reset update failed (flashcard_id=', idVal, ')', updateErr.message);
        }
        if (!updateOk) console.warn('Review reset: no row updated for flashcard_id', questionId, '- check RLS on user_progress');
        const newCount = await fetchReviewCount();
        setReviewCount(newCount);
        setReviewCountDisplay(newCount);
        const filteredQueue = gameQueue.filter(id => id !== questionId);
        setGameQueue(filteredQueue);
        
        setScore(newScore);
        setStreak(newStreak);
        syncScore(newScore, newStreak);
        
        // ซ่อน feedback หลังจาก 1 วินาที
        setTimeout(() => {
          setShowFeedback(false);
          setFeedbackType(null);
        }, 1000);
        
        // ถ้ายังมีคำศัพท์เหลืออยู่ ให้โหลดคำต่อไป
        if (filteredQueue.length > 0) {
          loadNextQuestion(filteredQueue[0], filteredQueue);
        } else {
          await clearPlayedIds(user.id, 'th', mode);
          alert("🎉 จบเกม Review! คุณตอบถูกทุกคำแล้ว");
          setPage('minigames');
        }
        return;
      }
    } else {
      setFeedbackType('wrong');
      setShowFeedback(true);
      playSound('wrong');
      saveWrongWord(user.id, questionId, 'th');
      setWrongWordToast('ได้เพิ่มคำผิดไว้ใน list ให้แล้ว');
      setTimeout(() => setWrongWordToast(null), 2500);
      const playedWords = await getPlayedIds(user.id, 'th', mode);
      if (!playedWords.includes(questionId)) {
        await setPlayedIds(user.id, 'th', mode, [...playedWords, questionId]);
      }
      
      newStreak = 0;
      newScore = Math.max(0, newScore - 3);
      const { data: prog } = await supabase.from('user_progress').select('minigame_wrong_count').eq('user_id', user.id).eq('flashcard_id', questionId).single();
      
      // อัพเดท minigame_wrong_count แยกตาม game_type 'th'
      let newWrongCount = {};
      if (typeof prog?.minigame_wrong_count === 'object' && prog?.minigame_wrong_count !== null) {
        newWrongCount = { ...prog.minigame_wrong_count, th: (prog.minigame_wrong_count.th || 0) + 1 };
      } else {
        // ถ้าเป็น number เก่า ให้แปลงเป็น object
        const oldCount = prog?.minigame_wrong_count || 0;
        newWrongCount = { th: oldCount + 1 };
      }
      
      await supabase.from('user_progress').update({ minigame_wrong_count: newWrongCount, level: 1 }).eq('user_id', user.id).eq('flashcard_id', questionId);
      
      // ถ้าใน Review Mode และตอบผิด
      if (mode === 'review') {
        // ไม่ reset minigame_wrong_count (เก็บไว้ใน Review)
        // แต่ให้ลบออกจาก queue ชั่วคราว (ไม่แสดงทันทีในรอบนี้) และจะสุ่มใหม่ในรอบถัดไป
        const nextQueue = gameQueue.filter(id => id !== questionId);
        setGameQueue(nextQueue);
        
        setTimeout(() => {
          setShowFeedback(false);
          setFeedbackType(null);
        }, 1000);
        
        setScore(newScore);
        setStreak(newStreak);
        syncScore(newScore, newStreak);
        
        if (nextQueue.length > 0) {
          setTimeout(() => {
            loadNextQuestion(nextQueue[0], nextQueue);
          }, 1500);
        } else {
          await clearPlayedIds(user.id, 'th', mode);
          setTimeout(() => {
            alert("🎉 จบเกม Review! คุณเล่นครบทุกคำแล้ว");
            setPage('minigames');
          }, 1500);
        }
        return;
      }
    }
    
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackType(null);
    }, 1000);

    setScore(newScore);
    setStreak(newStreak);
    syncScore(newScore, newStreak);

    const nextQueue = gameQueue.slice(1);
    setGameQueue(nextQueue);
    
    if (nextQueue.length === 0) {
      await clearPlayedIds(user.id, 'th', mode);
      alert("🎉 จบเกม! คุณเล่นครบทุกคำแล้ว");
      setPage('minigames');
      return;
    }
    
    loadNextQuestion(nextQueue[0], nextQueue);
  };

  useEffect(() => {
    let interval;
    if (gameStarted && currentQuestion && timer > 0) {
      interval = setInterval(() => {
        setTimer(t => {
          const newTime = t - 1;
          // เล่นเสียงเตือนเมื่อเหลือ 5 วินาทีหรือน้อยกว่า
          if (newTime <= 5 && newTime > 0) {
            playSound('timer-warning');
          }
          return newTime;
        });
      }, 1000);
    } else if (timer === 0 && gameStarted) {
      handleAnswer(null);
    }
    return () => clearInterval(interval);
  }, [timer, currentQuestion, gameStarted]);

  // หน้า Start Screen (normalCount, reviewCountDisplay มาจาก DB ใน useEffect)
  if (!gameStarted) {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-[80vh] select-none"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
        onDragStart={(e) => {
          if (e.target.tagName === 'IMG') {
            e.preventDefault();
          }
        }}
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-black italic uppercase text-emerald-600 mb-4">เกมแปลไทย</h1>
          <p className="text-slate-600 font-bold mb-2 text-base md:text-xl">เลือกคำแปลที่ถูกต้อง</p>
          <p className="text-sm md:text-lg text-slate-500">เวลา: {timerSetting} วินาที/คำ</p>
        </div>
        
        <div className="flex gap-2 md:gap-4 mb-8">
          <button onClick={() => {setMode('normal');}} className={`px-6 md:px-10 py-3 md:py-5 rounded-full font-black text-sm md:text-lg uppercase ${mode === 'normal' ? 'bg-slate-800 text-white' : 'bg-white border-2 border-slate-300'}`}>
            Normal ({normalCount})
          </button>
          <button onClick={() => {setMode('review');}} className={`px-6 md:px-10 py-3 md:py-5 rounded-full font-black text-sm md:text-lg uppercase ${mode === 'review' ? 'bg-red-600 text-white' : 'bg-white border-2 border-slate-300'}`}>
            Review ({reviewCountDisplay})
          </button>
        </div>

        <button 
          onClick={handleStartGame}
          className="bg-emerald-500 text-white px-12 md:px-16 py-4 md:py-6 rounded-[2rem] shadow-xl font-black text-xl md:text-3xl italic uppercase transform active:scale-95 transition-all"
        >
          🎮 Start Game
        </button>

        <button 
          onClick={() => setPage('minigames')}
          className="mt-6 text-slate-600 font-bold text-sm md:text-base underline italic uppercase"
        >
          ← Back to Menu
        </button>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div 
      className="flex flex-col items-center select-none" 
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
            onDragStart={(e) => {
              if (e.target.tagName === 'IMG') {
                e.preventDefault();
              }
            }}
    >
      <div className="w-full flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setPage('minigames')} className="text-slate-800 font-black text-xs underline italic uppercase">Exit</button>
          <button onClick={async () => { const qId = currentQuestion?.id1 ?? currentQuestion?.id; if (qId != null) await saveWrongWord(user.id, qId, 'th'); setWrongWordToast('ได้เพิ่มคำผิดไว้ใน list ให้แล้ว ดูรายการได้ที่ Settings'); setTimeout(() => setWrongWordToast(null), 2500); }} className="bg-amber-500 text-white px-2 py-1 rounded-full font-black text-[10px] italic uppercase">คำผิด</button>
        </div>
        <div className="flex gap-2">
           <div className="bg-orange-600 text-white px-3 py-1 rounded-full font-black text-[10px] italic">SCORE: {score}</div>
           <div className="bg-slate-800 text-white px-3 py-1 rounded-full font-black text-[10px] italic uppercase">Left: {mode === 'review' ? reviewCountDisplay : gameQueue.length}</div>
        </div>
        <div className={`text-3xl font-black italic ${timer < 3 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>{timer}s</div>
      </div>

      {/* Feedback Overlay */}
      {showFeedback && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none ${
          feedbackType === 'correct' 
            ? 'bg-emerald-500/20' 
            : 'bg-red-500/20'
        }`}>
          <div className={`text-6xl font-black italic uppercase animate-bounce ${
            feedbackType === 'correct' 
              ? 'text-emerald-600' 
              : 'text-red-600'
          }`}>
            {feedbackType === 'correct' ? '✓ ถูกต้อง!' : '✗ ผิด'}
          </div>
          {feedbackType === 'wrong' && (
            <div className="text-xl text-slate-700 font-bold mt-4 animate-pulse">
              ไม่เป็นไร ลองใหม่นะ! 💪
            </div>
          )}
        </div>
      )}

      {/* Combo X2 Overlay */}
      {showCombo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="text-8xl font-black italic uppercase animate-ping text-yellow-400 drop-shadow-2xl">
            X2 COMBO!
          </div>
        </div>
      )}

      <div className="w-full max-w-[280px] md:max-w-[400px] lg:max-w-[500px] aspect-[3/4] rounded-[2rem] overflow-hidden shadow-2xl border-4 md:border-8 border-white mb-4 md:mb-8 relative">
        <img 
          src={optimizeImageUrl(currentQuestion.image_front_url)} 
          className="w-full h-full object-cover" 
          alt="Q"
          loading="eager"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-6 w-full max-w-sm md:max-w-2xl px-4">
        {options.map((opt, idx) => (
          <button 
            key={idx} 
            onClick={() => handleAnswer(opt)} 
            className="bg-white p-4 md:p-8 rounded-2xl border-b-4 border-slate-200 active:border-0 active:translate-y-1 transition-all shadow-sm font-black text-slate-700 italic uppercase text-base md:text-2xl select-none" 
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
            onDragStart={(e) => {
              if (e.target.tagName === 'IMG') {
                e.preventDefault();
              }
            }}
          >
            {opt.th}
          </button>
        ))}
      </div>

      {wrongWordToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-xl font-black text-sm italic text-center max-w-[90%]">
          {wrongWordToast}
        </div>
      )}
    </div>
  );
}