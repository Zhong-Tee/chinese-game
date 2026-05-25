import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Flashcards from './components/Flashcards';
import Settings from './components/Settings';
import FlashcardGame from './components/FlashcardGame';
import Library from './components/Library';
import MiniGames_th from './components/MiniGames_th';
import MiniGames_pinyin from './components/MiniGames_pinyin';
import MiniGames_vol from './components/MiniGames_vol';
import MiniGames_type from './components/MiniGames_type';
import Score from './components/Score';
import Statistics from './components/Statistics';
import Comics from './components/Comics';
import { saveWrongWord } from './utils/wrongWordsStorage';
import { createFlashcardSessionTracker } from './utils/flashcardStatsStorage';

export default function App() {
  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);
  
  // Settings & Data
  const [timerSetting, setTimerSetting] = useState(5); // สำหรับ Flashcard
  const [gameTimerSetting, setGameTimerSetting] = useState(5); // สำหรับ Mini Games
  const [typeTimerSetting, setTypeTimerSetting] = useState(5); // สำหรับ Type Game
  const [schedules, setSchedules] = useState({ lv3: [], lv4: [], lv5: [], lv6: [] });
  const [allMasterCards, setAllMasterCards] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [levelCounts, setLevelCounts] = useState({1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, mistakes: 0});
  
  // Game States
  const [activeLevel, setActiveLevel] = useState(1);
  const [currentCard, setCurrentCard] = useState(null);
  const [timer, setTimer] = useState(5);
  const [gameActive, setGameActive] = useState(false);
  const [gameQueue, setGameQueue] = useState([]);
  const [flashcardStage, setFlashcardStage] = useState('pinyin'); // pinyin | meaning | result
  const [flashcardChoices, setFlashcardChoices] = useState([]);
  const [flashcardSelectedAnswer, setFlashcardSelectedAnswer] = useState('');
  const [flashcardCorrectAnswer, setFlashcardCorrectAnswer] = useState('');
  const [flashcardStageCorrect, setFlashcardStageCorrect] = useState(false);
  const [flashcardStageAnswered, setFlashcardStageAnswered] = useState(false);
  const [flashcardStageResults, setFlashcardStageResults] = useState({ pinyin: null, meaning: null });
  const [flashcardTimedOut, setFlashcardTimedOut] = useState(false);
  const FLASHCARD_CORRECT_REVEAL_MS = 2000;
  const flashcardSessionRef = useRef(null);
  if (!flashcardSessionRef.current) {
    flashcardSessionRef.current = createFlashcardSessionTracker();
  }

  const endFlashcardSession = useCallback(async () => {
    await flashcardSessionRef.current?.end();
  }, []);

  const handleExitFlashcardGame = useCallback(async () => {
    await endFlashcardSession();
    setPage('fc-chars');
    setGameActive(false);
    setCurrentCard(null);
  }, [endFlashcardSession]);

  // UI States
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [libraryDetail, setLibraryDetail] = useState(null);
  const [libFlipped, setLibFlipped] = useState(false);
  const [username, setUsername] = useState('');
  const [wrongWordToast, setWrongWordToast] = useState(null); // popup "ได้เพิ่มคำผิดไว้ใน list ให้แล้ว"
  // ลากนิ้ว/เมาส์เพื่อเลือกคำ (Select Study Words) — ต้องกดค้าง 2 วินาทีก่อนถึงจะลากได้
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragSelectMode, setDragSelectMode] = useState('add'); // 'add' | 'remove'
  const [dragTouchedIds, setDragTouchedIds] = useState([]);
  
  // Audio Context สำหรับเสียงเตือนเวลา
  const audioContextRef = useRef(null);
  const selectWordsContainerRef = useRef(null);
  const justFinishedDragRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const longPressCardIdRef = useRef(null);
  const longPressSelectedRef = useRef(false);
  const longPressStartXYRef = useRef({ x: 0, y: 0 });
  const [longPressDragActiveToast, setLongPressDragActiveToast] = useState(false); // popup "โหมดลากเลือกเปิดแล้ว"
  const LONG_PRESS_MS = 2000;
  const LONG_PRESS_MOVE_THRESHOLD_PX = 15; // เลื่อนเกินนี้ถึงจะยกเลิก long-press (กันมือถือสั่น)

  // --- 1. Initial Load ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { 
        setUser(session.user); setPage('dashboard');
        fetchInitialData(session.user.id);
        fetchUserSettings(session.user.id);
      }
    });
  }, []);

  const fetchUserSettings = async (userId) => {
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', userId).single();
    if (data) { 
      setTimerSetting(data.timer_setting || 5); 
      setGameTimerSetting(data.game_timer_setting || data.minigame_timer || 5); // เพิ่ม fallback minigame_timer
      setTypeTimerSetting(data.type_timer || 5); // ดึงค่า type_timer
      setSchedules(data.schedules || { lv3: [], lv4: [], lv5: [], lv6: [] }); 
    }
    else { await supabase.from('user_settings').insert([{ user_id: userId }]); }
  };

  const saveSettings = async (newTimer, newGameTimer, newTypeTimer, newSchedules) => {
    if (!user || !user.id) {
      console.error('User not found, cannot save settings');
      return;
    }
    
    const { error } = await supabase.from('user_settings').update({ 
      timer_setting: newTimer, 
      minigame_timer: newGameTimer, // บันทึกค่า gameTimerSetting ไปยังคอลัมน์ minigame_timer
      type_timer: newTypeTimer || typeTimerSetting, // บันทึกค่า type_timer
      schedules: newSchedules 
    }).eq('user_id', user.id);
    
    if (error) {
      console.error('Error saving settings:', error);
      alert('ไม่สามารถบันทึกการตั้งค่าได้: ' + error.message);
    } else {
      console.log('Settings saved successfully:', { timer_setting: newTimer, minigame_timer: newGameTimer, type_timer: newTypeTimer || typeTimerSetting });
    }
  };

  const fetchInitialData = async (userId) => {
    try {
      const { data: master, error: masterError } = await supabase.from('flashcards').select('*').order('id1', { ascending: true });
      if (masterError) {
        console.error('Error fetching flashcards:', masterError);
        return;
      }
      console.log('Fetched flashcards:', master?.length || 0, 'items');
      setAllMasterCards(master || []);
      
      const { data: progress, error: progressError } = await supabase.from('user_progress').select('level, wrong_count, flashcard_id').eq('user_id', userId);
      if (progressError) {
        console.error('Error fetching progress:', progressError);
        return;
      }
      if (progress) {
        // แปลง flashcard_id เป็น number ทั้งหมดเพื่อให้ type ตรงกัน
        const selectedIdsNums = progress.map(p => Number(p.flashcard_id)).filter(id => !isNaN(id));
        console.log('Selected IDs:', selectedIdsNums);
        setSelectedIds(selectedIdsNums);
        const counts = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, mistakes: 0};
        progress.forEach(item => { 
          if (item.wrong_count >= 3) counts.mistakes++;
          else if (counts[item.level] !== undefined) counts[item.level]++;
        });
        setLevelCounts(counts);
      }
    } catch (error) {
      console.error('Error in fetchInitialData:', error);
    }
  };

  const toggleWordSelection = async (cardId) => {
    const isAlreadySelected = selectedIds.includes(cardId);
    if (isAlreadySelected) {
      await supabase.from('user_progress').delete().eq('user_id', user.id).eq('flashcard_id', cardId);
      setSelectedIds(prev => prev.filter(id => id !== cardId));
    } else {
      await supabase.from('user_progress').insert([{ user_id: user.id, flashcard_id: cardId, level: 1, wrong_count: 0 }]);
      setSelectedIds(prev => [...prev, cardId]);
    }
    setTimeout(() => fetchInitialData(user.id), 200);
  };

  // จบการลากเลือก แล้วอัปเดต DB แบบ batch
  const endDragSelect = useCallback(async () => {
    if (!isDragSelecting || !user?.id || dragTouchedIds.length === 0) {
      setIsDragSelecting(false);
      setDragTouchedIds([]);
      return;
    }
    const ids = [...new Set(dragTouchedIds)];
    if (dragSelectMode === 'add') {
      const toAdd = ids.filter(id => !selectedIds.includes(id));
      if (toAdd.length > 0) {
        await supabase.from('user_progress').insert(toAdd.map(id => ({ user_id: user.id, flashcard_id: id, level: 1, wrong_count: 0 })));
        setSelectedIds(prev => [...new Set([...prev, ...toAdd])]);
      }
    } else {
      const toRemove = ids.filter(id => selectedIds.includes(id));
      if (toRemove.length > 0) {
        for (const id of toRemove) {
          await supabase.from('user_progress').delete().eq('user_id', user.id).eq('flashcard_id', id);
        }
        setSelectedIds(prev => prev.filter(id => !toRemove.includes(id)));
      }
    }
    setIsDragSelecting(false);
    setDragTouchedIds([]);
    justFinishedDragRef.current = true;
    setTimeout(() => { justFinishedDragRef.current = false; }, 180);
    setTimeout(() => fetchInitialData(user.id), 200);
  }, [isDragSelecting, user?.id, dragTouchedIds, dragSelectMode, selectedIds]);

  // เริ่มโหมดลากเมื่อกดค้างครบ 2 วินาที (ใช้ค่าตอนกด ไม่ใช่ตอนครบเวลา)
  const startLongPressDrag = useCallback((clientX, clientY) => {
    if (longPressTimerRef.current != null) return;
    const cardId = longPressCardIdRef.current;
    const wasSelected = longPressSelectedRef.current;
    if (cardId == null) return;
    longPressStartXYRef.current = { x: clientX, y: clientY };
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      setIsDragSelecting(true);
      setDragSelectMode(wasSelected ? 'remove' : 'add');
      setDragTouchedIds([cardId]);
      setLongPressDragActiveToast(true);
      setTimeout(() => setLongPressDragActiveToast(false), 2500);
    }, LONG_PRESS_MS);
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // ยกเลิก long-press เฉพาะเมื่อเลื่อนเกินเกณฑ์ (กันมือสั่นบนมือถือ)
  const maybeClearLongPressOnMove = useCallback((clientX, clientY) => {
    if (longPressTimerRef.current == null) return;
    const start = longPressStartXYRef.current;
    const dx = clientX - start.x;
    const dy = clientY - start.y;
    if (dx * dx + dy * dy > LONG_PRESS_MOVE_THRESHOLD_PX * LONG_PRESS_MOVE_THRESHOLD_PX) {
      clearLongPressTimer();
    }
  }, [clearLongPressTimer]);

  // ฟัง mouseup/touchend ที่ window: ยกเลิก long-press หรือจบการลาก
  useEffect(() => {
    const end = (e) => {
      if (longPressTimerRef.current != null) {
        clearLongPressTimer();
        return;
      }
      if (isDragSelecting) endDragSelect();
    };
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, [isDragSelecting, endDragSelect, clearLongPressTimer]);

  const normalizeOptionText = (value) => String(value || '').trim();

  const shuffleArray = (arr) => [...arr].sort(() => Math.random() - 0.5);

  const buildChoices = useCallback((field, card) => {
    const correct = normalizeOptionText(card?.[field]);
    if (!correct) {
      return { choices: ['ไม่พบคำตอบ', 'ไม่พบคำตอบ 2', 'ไม่พบคำตอบ 3', 'ไม่พบคำตอบ 4'], correctAnswer: '' };
    }

    const primaryPool = allMasterCards
      .map(item => normalizeOptionText(item?.[field]))
      .filter(Boolean);

    const uniqueDistractors = [...new Set(primaryPool)].filter(text => text !== correct);
    let distractors = shuffleArray(uniqueDistractors).slice(0, 3);

    // ถ้าข้อมูลจริงมีไม่พอ 3 ตัวหลอก ให้เติมข้อความ fallback เพื่อให้ UI มี 4 ตัวเลือกเสมอ
    while (distractors.length < 3) {
      distractors.push(`ตัวเลือกอื่น ${distractors.length + 1}`);
    }

    return {
      choices: shuffleArray([correct, ...distractors]),
      correctAnswer: correct
    };
  }, [allMasterCards]);

  const resetStageState = useCallback(() => {
    setFlashcardSelectedAnswer('');
    setFlashcardCorrectAnswer('');
    setFlashcardStageCorrect(false);
    setFlashcardStageAnswered(false);
  }, []);

  const startLevelGame = async (level) => {
    try {
      setActiveLevel(level);
      let query = supabase.from('user_progress').select('flashcard_id').eq('user_id', user.id);
      if (level === 'mistakes') query = query.gte('wrong_count', 3); 
      else query = query.eq('level', level).lt('wrong_count', 3);
      const { data: progress, error: progressError } = await query;
      if (progressError) {
        console.error('Error fetching progress:', progressError);
        alert("เกิดข้อผิดพลาด: " + progressError.message);
        return;
      }
      if (!progress || progress.length === 0) { 
        alert("ไม่มีคำศัพท์"); 
        return; 
      }
      // แปลง flashcard_id เป็น number ก่อน query
      const flashcardIds = progress.map(p => Number(p.flashcard_id)).filter(id => !isNaN(id));
      console.log('Flashcard IDs for game:', flashcardIds);
      const { data: cards, error: cardsError } = await supabase.from('flashcards').select('*').in('id1', flashcardIds);
      if (cardsError) {
        console.error('Error fetching cards:', cardsError);
        alert("เกิดข้อผิดพลาด: " + cardsError.message);
        return;
      }
      if (!cards || cards.length === 0) {
        alert("ไม่พบคำศัพท์");
        return;
      }
      setGameQueue(shuffleArray(cards));
      flashcardSessionRef.current?.start(level);
      setPage('fc-play');
      setGameActive(true);
    } catch (error) {
      console.error('Error in startLevelGame:', error);
      alert("เกิดข้อผิดพลาด: " + error.message);
    }
  };

  const moveToNextCard = useCallback(async (isCardPassed) => {
    if (!currentCard || !user?.id) return;

    let nextLevel;
    let nextWrongCount;
    const cardId = currentCard.id1 || currentCard.id;
    const { data: currentProgress } = await supabase
      .from('user_progress')
      .select('wrong_count, level')
      .eq('user_id', user.id)
      .eq('flashcard_id', cardId)
      .single();

    const currentWrong = currentProgress?.wrong_count || 0;

    if (isCardPassed) {
      if (activeLevel === 'mistakes') {
        nextLevel = 1;
        nextWrongCount = 0;
      } else {
        nextLevel = Math.min(activeLevel + 1, 7);
        nextWrongCount = currentWrong;
      }
    } else {
      nextLevel = 1;
      nextWrongCount = currentWrong + 1;
    }

    await supabase
      .from('user_progress')
      .update({ level: nextLevel, wrong_count: nextWrongCount })
      .eq('user_id', user.id)
      .eq('flashcard_id', cardId);

    await flashcardSessionRef.current?.recordWord();
    setGameQueue(prev => prev.slice(1));
    setCurrentCard(null);
    fetchInitialData(user.id);
  }, [activeLevel, currentCard, user?.id]);

  const handleStageAnswer = useCallback((choice) => {
    if (!currentCard || flashcardStageAnswered) return;

    const field = flashcardStage === 'pinyin' ? 'pinyin' : 'th';
    const correctAnswer = normalizeOptionText(currentCard?.[field]);
    const selectedAnswer = normalizeOptionText(choice);
    const isCorrect = selectedAnswer === correctAnswer;

    setFlashcardSelectedAnswer(selectedAnswer);
    setFlashcardCorrectAnswer(correctAnswer);
    setFlashcardStageCorrect(isCorrect);
    setFlashcardStageAnswered(true);
    setFlashcardTimedOut(false);

    if (flashcardStage === 'pinyin') {
      setFlashcardStageResults(prev => ({ ...prev, pinyin: isCorrect }));
    } else if (flashcardStage === 'meaning') {
      setFlashcardStageResults(prev => ({ ...prev, meaning: isCorrect }));
    }
  }, [currentCard, flashcardStage, flashcardStageAnswered]);

  const moveToMeaningStage = useCallback(() => {
    if (!currentCard) return;
    const next = buildChoices('th', currentCard);
    resetStageState();
    setFlashcardStage('meaning');
    setFlashcardChoices(next.choices);
    setTimer(timerSetting);
  }, [buildChoices, currentCard, resetStageState, timerSetting]);

  const submitCurrentCard = useCallback(async () => {
    const passed = flashcardStageResults.pinyin === true && flashcardStageResults.meaning === true;
    await moveToNextCard(passed);
  }, [flashcardStageResults.meaning, flashcardStageResults.pinyin, moveToNextCard]);

  const handleContinueStage = useCallback(async () => {
    if (!currentCard || !flashcardStageAnswered) return;
    if (flashcardStage === 'pinyin') {
      moveToMeaningStage();
      return;
    }
    if (flashcardStage === 'meaning') {
      await submitCurrentCard();
    }
  }, [currentCard, flashcardStageAnswered, flashcardStage, moveToMeaningStage, submitCurrentCard]);

  const handleCardTimeout = useCallback(() => {
    if (!gameActive || !currentCard || flashcardStageAnswered) return;

    const field = flashcardStage === 'pinyin' ? 'pinyin' : 'th';
    const correctAnswer = normalizeOptionText(currentCard?.[field]);

    setFlashcardTimedOut(true);
    setFlashcardSelectedAnswer('');
    setFlashcardCorrectAnswer(correctAnswer);
    setFlashcardStageCorrect(false);
    setFlashcardStageAnswered(true);
    if (flashcardStage === 'pinyin') {
      setFlashcardStageResults(prev => ({ ...prev, pinyin: false }));
    } else {
      setFlashcardStageResults(prev => ({ ...prev, meaning: false }));
    }
  }, [currentCard, flashcardStage, flashcardStageAnswered, gameActive]);

  useEffect(() => {
    if (gameActive && gameQueue.length > 0 && !currentCard) {
      const nextCard = gameQueue[0];
      const firstStage = buildChoices('pinyin', nextCard);
      setCurrentCard(nextCard);
      setTimer(timerSetting);
      setFlashcardStage('pinyin');
      setFlashcardChoices(firstStage.choices);
      setFlashcardStageResults({ pinyin: null, meaning: null });
      setFlashcardTimedOut(false);
      resetStageState();
    } else if (gameActive && gameQueue.length === 0 && !currentCard) {
      endFlashcardSession().then(() => {
        alert("🎉 จบช่วงการฝึกแล้ว!");
        setPage('fc-chars');
        setGameActive(false);
      });
    }
  }, [buildChoices, currentCard, endFlashcardSession, gameActive, gameQueue, resetStageState, timerSetting]);

  useEffect(() => {
    let interval;
    if (gameActive && currentCard && !flashcardStageAnswered && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && !flashcardStageAnswered && gameActive) {
      handleCardTimeout();
    }
    return () => clearInterval(interval);
  }, [flashcardStageAnswered, gameActive, currentCard, handleCardTimeout, timer]);

  useEffect(() => {
    if (!gameActive || !currentCard || !flashcardStageAnswered || !flashcardStageCorrect) return;
    const timeoutId = setTimeout(() => {
      if (flashcardStage === 'pinyin') {
        moveToMeaningStage();
      } else if (flashcardStage === 'meaning') {
        submitCurrentCard();
      }
    }, FLASHCARD_CORRECT_REVEAL_MS);
    return () => clearTimeout(timeoutId);
  }, [
    FLASHCARD_CORRECT_REVEAL_MS,
    flashcardStage,
    flashcardStageAnswered,
    flashcardStageCorrect,
    gameActive,
    currentCard,
    moveToMeaningStage,
    submitCurrentCard
  ]);

  const checkLevelAvailable = (lv) => {
    if (lv === 'mistakes' || lv <= 2 || lv === 7) return true;
    const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์"];
    const today = new Date();
    const dayName = days[today.getDay() === 0 ? 6 : today.getDay() - 1];
    const dateNum = today.getDate();
    if (lv === 3) return schedules.lv3?.includes(dayName);
    if (lv === 4) return schedules.lv4?.includes(dayName);
    if (lv === 5) return schedules.lv5?.includes(dateNum);
    if (lv === 6) return schedules.lv6?.includes(dateNum);
    return false;
  };

  const handleLogout = async () => {
    try {
      if (flashcardSessionRef.current?.isActive()) {
        await flashcardSessionRef.current.end();
      }
      await supabase.auth.signOut();
      setUser(null);
      setPage('login');
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Error logging out:', error);
      alert('เกิดข้อผิดพลาดในการออกจากระบบ');
    }
  };

  const MenuOverlay = () => (
    <div 
      className={`fixed inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center transition-all duration-300 select-none ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      onDragStart={(e) => e.preventDefault()}
    >
      <button onClick={() => setIsMenuOpen(false)} className="absolute top-6 right-6 text-white text-4xl">&times;</button>
      <div className="flex flex-col space-y-8 text-center text-white font-black italic text-2xl uppercase">
        <button onClick={() => {setPage('dashboard'); setIsMenuOpen(false);}}>🏠 Home</button>
        <button onClick={() => {setPage('statistics'); setIsMenuOpen(false);}}>📈 Statistics</button>
        <button onClick={() => {setPage('settings'); setIsMenuOpen(false);}}>⚙️ Setting</button>
        <button onClick={handleLogout} className="block text-red-400 pt-10 text-xl font-bold uppercase">🚪 Logout</button>
      </div>
    </div>
  );

  if (page === 'login') return <Login setPage={setPage} setUser={setUser} fetchInitialData={fetchInitialData} fetchUserSettings={fetchUserSettings} />;
  const shouldShowTopBar = page !== 'fc-play';

  return (
    <div 
      className="bg-slate-50 font-sans text-slate-800 pb-10 overflow-x-hidden select-none" 
      style={{ 
        minHeight: '100vh',
        maxHeight: '100vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        userSelect: 'none', 
        WebkitUserSelect: 'none', 
        MozUserSelect: 'none', 
        msUserSelect: 'none' 
      }}
      onDragStart={(e) => {
        if (e.target.tagName === 'IMG') {
          e.preventDefault();
        }
      }}
    >
      {shouldShowTopBar && (
        <>
          <header className="p-4 bg-white shadow-sm border-b-4 border-orange-500 flex justify-between items-center sticky top-0 z-40">
            <div className="flex flex-col">
              <h1 className="font-black text-orange-600 text-xl uppercase italic tracking-tighter">Nihao Game</h1>
              {user?.email && (
                <p className="text-xs text-slate-600 font-bold mt-1">{user.email.replace('@nihao.com', '')}</p>
              )}
            </div>
            <button onClick={() => setIsMenuOpen(true)} className="w-12 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center text-2xl shadow-lg">☰</button>
          </header>
          <MenuOverlay />
        </>
      )}

      {/* Toast: ได้เพิ่มคำผิดไว้ใน list ให้แล้ว */}
      {wrongWordToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-xl font-black text-sm italic text-center max-w-[90%]">
          {wrongWordToast}
        </div>
      )}

      <main className="max-w-md mx-auto p-4" style={{ touchAction: 'pan-y' }}>
        {page === 'dashboard' && <Dashboard setPage={setPage} user={user} />}
        {page === 'fc-chars' && <Flashcards setPage={setPage} levelCounts={levelCounts} schedules={schedules} checkLevelAvailable={checkLevelAvailable} startLevelGame={startLevelGame} />}
        {page === 'fc-play' && currentCard && (
          <FlashcardGame
            onExitGame={handleExitFlashcardGame}
            setWrongWordToast={setWrongWordToast}
            onAddCurrentToWrongList={() => {
              if (currentCard && user?.id) {
                saveWrongWord(user.id, currentCard.id1 || currentCard.id, 'flashcard', currentCard);
                setWrongWordToast('ได้เพิ่มคำผิดไว้ใน list ให้แล้ว ดูรายการได้ที่ Settings');
                setTimeout(() => setWrongWordToast(null), 2500);
              }
            }}
            activeLevel={activeLevel}
            currentCard={currentCard}
            setCurrentCard={setCurrentCard}
            timer={timer}
            gameQueue={gameQueue}
            stage={flashcardStage}
            choices={flashcardChoices}
            selectedAnswer={flashcardSelectedAnswer}
            correctAnswer={flashcardCorrectAnswer}
            isStageCorrect={flashcardStageCorrect}
            isStageAnswered={flashcardStageAnswered}
            isTimedOut={flashcardTimedOut}
            onSelectChoice={handleStageAnswer}
            onContinueStage={handleContinueStage}
          />
        )}
        {page === 'library' && <Library setPage={setPage} allMasterCards={allMasterCards} selectedIds={selectedIds} libraryDetail={libraryDetail} setLibraryDetail={setLibraryDetail} libFlipped={libFlipped} setLibFlipped={setLibFlipped} />}
        {page === 'score' && <Score user={user} selectedIds={selectedIds} levelCounts={levelCounts} setPage={setPage} />}
        {page === 'statistics' && <Statistics user={user} setPage={setPage} />}
        {page === 'comics' && <Comics setPage={setPage} />}
        
        {(page === 'settings' || page === 'set-schedule') && (
          <Settings 
            page={page} 
            setPage={setPage} 
            user={user}
            allMasterCards={allMasterCards}
            timerSetting={timerSetting} 
            setTimerSetting={setTimerSetting} 
            gameTimerSetting={gameTimerSetting}
            setGameTimerSetting={setGameTimerSetting}
            typeTimerSetting={typeTimerSetting}
            setTypeTimerSetting={setTypeTimerSetting}
            schedules={schedules} 
            setSchedules={setSchedules} 
            saveSettings={(t, g, type, s) => saveSettings(t, g, type, s)} 
          />
        )}

        {/* --- 4. หน้าเมนูเลือก 4 เกม (Mini Games Hub) --- */}
        {page === 'minigames' && (
          <div 
            className="grid grid-cols-1 gap-4 pt-4 select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
            onDragStart={(e) => e.preventDefault()}
          >
            <button onClick={() => setPage('dashboard')} className="text-orange-600 font-black text-sm uppercase italic underline text-left mb-2">← Back</button>
            <button onClick={() => setPage('minigame-th')} className="h-28 bg-emerald-500 text-white rounded-[2rem] shadow-xl font-black flex items-center justify-center gap-4 transform active:scale-95 transition-all text-xl italic">
              <svg width="48" height="32" viewBox="0 0 48 32" className="rounded" style={{filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'}}>
                <rect y="0" width="48" height="6.4" fill="#ED1C24"/>
                <rect y="6.4" width="48" height="6.4" fill="#FFFFFF"/>
                <rect y="12.8" width="48" height="6.4" fill="#241D4F"/>
                <rect y="19.2" width="48" height="6.4" fill="#FFFFFF"/>
                <rect y="25.6" width="48" height="6.4" fill="#ED1C24"/>
              </svg>
              เกมแปลไทย
            </button>
            <button onClick={() => setPage('minigame-pinyin')} className="h-28 bg-blue-500 text-white rounded-[2rem] shadow-xl font-black flex items-center justify-center gap-4 transform active:scale-95 transition-all text-xl italic">
              <span className="text-4xl">🔤</span> Pinyin
            </button>
            <button onClick={() => setPage('minigame-vol')} className="h-28 bg-purple-500 text-white rounded-[2rem] shadow-xl font-black flex items-center justify-center gap-4 transform active:scale-95 transition-all text-xl italic">
              <span className="text-4xl">📝</span> เติมคำ
            </button>
            <button onClick={() => setPage('minigame-type')} className="h-28 bg-indigo-500 text-white rounded-[2rem] shadow-xl font-black flex items-center justify-center gap-4 transform active:scale-95 transition-all text-xl italic">
              <span className="text-4xl">⌨️</span> ฝึกพิมพ์
            </button>
          </div>
        )}

        {/* --- เรียกใช้ Mini Game 1 (แปลไทย) --- */}
        {page === 'minigame-th' && (
          <MiniGames_th 
            user={user}
            allMasterCards={allMasterCards}
            selectedIds={selectedIds}
            timerSetting={gameTimerSetting}
            setPage={setPage}
          />
        )}

        {/* --- เรียกใช้ Mini Game 2 (Pinyin) --- */}
        {page === 'minigame-pinyin' && (
          <MiniGames_pinyin 
            user={user}
            allMasterCards={allMasterCards}
            selectedIds={selectedIds}
            timerSetting={gameTimerSetting}
            setPage={setPage}
          />
        )}

        {/* --- เรียกใช้ Mini Game 3 (เติมคำ) --- */}
        {page === 'minigame-vol' && (
          <MiniGames_vol 
            user={user}
            allMasterCards={allMasterCards}
            selectedIds={selectedIds}
            timerSetting={gameTimerSetting}
            setPage={setPage}
          />
        )}

        {/* --- เรียกใช้ Mini Game 4 (ฝึกพิมพ์) --- */}
        {page === 'minigame-type' && (
          <MiniGames_type 
            user={user}
            allMasterCards={allMasterCards}
            selectedIds={selectedIds}
            timerSetting={typeTimerSetting}
            setPage={setPage}
          />
        )}
        
        {page === 'select-words' && (() => {
          const effectiveSelectedIds = isDragSelecting
            ? (dragSelectMode === 'add'
              ? [...new Set([...selectedIds, ...dragTouchedIds])]
              : selectedIds.filter(id => !dragTouchedIds.includes(id)))
            : selectedIds;
          return (
          <div 
            ref={selectWordsContainerRef}
            className="space-y-4 pb-10 text-center select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', touchAction: isDragSelecting ? 'none' : 'pan-y' }}
            onDragStart={(e) => e.preventDefault()}
            onMouseMove={(e) => {
              if (isDragSelecting && e.buttons === 1) {
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const cardEl = el?.closest('[data-card-id]');
                const id = cardEl ? parseInt(cardEl.getAttribute('data-card-id'), 10) : NaN;
                if (!isNaN(id)) setDragTouchedIds(prev => prev.includes(id) ? prev : [...prev, id]);
              } else if (longPressTimerRef.current != null) {
                maybeClearLongPressOnMove(e.clientX, e.clientY);
              }
            }}
            onTouchMove={(e) => {
              if (isDragSelecting && e.touches[0]) {
                e.preventDefault();
                const t = e.touches[0];
                const el = document.elementFromPoint(t.clientX, t.clientY);
                const cardEl = el?.closest('[data-card-id]');
                const id = cardEl ? parseInt(cardEl.getAttribute('data-card-id'), 10) : NaN;
                if (!isNaN(id)) setDragTouchedIds(prev => prev.includes(id) ? prev : [...prev, id]);
              } else if (longPressTimerRef.current != null && e.touches[0]) {
                maybeClearLongPressOnMove(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
          >
            {longPressDragActiveToast && (
              <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                <div className="bg-orange-500 text-white px-6 py-4 rounded-2xl shadow-xl font-black text-center text-sm animate-pulse max-w-[90%]">
                  โหมดลากเลือกเปิดแล้ว — ลากผ่านคำที่ต้องการ
                </div>
              </div>
            )}

            <div className="flex justify-between items-center sticky top-20 bg-slate-50 py-2 z-10 px-2 border-b border-slate-100">
              <button onClick={() => setPage('settings')} className="text-orange-600 font-black italic underline uppercase text-xs">← Back</button>
              <div className="flex flex-col items-end">
                <div className="bg-orange-600 text-white px-4 py-1 rounded-full font-black text-xs">Selected {selectedIds.length}</div>
                <span className="text-[10px] text-slate-400 mt-0.5">กดค้าง 2 วินาที แล้วลากเพื่อเลือกหลายคำ</span>
              </div>
            </div>

            {/* เลือกแบบช่วง (1–N) — อยู่ใต้แถบ Back ให้ scroll เห็นได้บน Vercel */}
            <div className="bg-white p-4 rounded-2xl border-2 border-orange-200 mb-4 shadow-sm">
              <label className="block text-xs font-black text-slate-600 mb-2 uppercase">เลือกแบบช่วง (1–{allMasterCards?.length ?? 0})</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  max={allMasterCards?.length ?? 0}
                  placeholder={`จำนวนคำ (เช่น 200) — สูงสุด ${allMasterCards?.length ?? 0}`}
                  className="flex-1 px-4 py-2 border-2 border-slate-200 rounded-xl text-center font-bold text-sm"
                  id="range-select-input"
                  style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                />
                <button
                  onClick={async () => {
                    if (!user?.id) {
                      alert('กรุณาเข้าสู่ระบบก่อน');
                      return;
                    }
                    const input = document.getElementById('range-select-input');
                    const count = parseInt(input?.value, 10);
                    const max = allMasterCards?.length ?? 0;
                    if (!count || count < 1 || count > max) {
                      alert(`กรุณากรอกตัวเลขระหว่าง 1–${max}`);
                      return;
                    }
                    const sorted = [...(allMasterCards || [])].sort((a, b) => {
                      const idA = Number(a?.id1 || a?.id || 0);
                      const idB = Number(b?.id1 || b?.id || 0);
                      return idA - idB;
                    });
                    const toSelect = sorted.slice(0, count).map(c => Number(c?.id1 || c?.id)).filter(id => !isNaN(id) && !selectedIds.includes(id));
                    if (toSelect.length === 0) {
                      alert('คำศัพท์ในช่วงนี้ถูกเลือกไว้แล้ว');
                      return;
                    }
                    const inserts = toSelect.map(id => ({ user_id: user.id, flashcard_id: id, level: 1, wrong_count: 0 }));
                    await supabase.from('user_progress').insert(inserts);
                    await fetchInitialData(user.id);
                    if (input) input.value = '';
                    alert(`เลือก ${toSelect.length} คำศัพท์เรียบร้อยแล้ว`);
                  }}
                  className="bg-orange-500 text-white px-6 py-2 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-orange-600 transition-colors"
                >
                  เลือก
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {allMasterCards && allMasterCards.length > 0 ? (
                allMasterCards
                  .sort((a, b) => {
                    const idA = Number(a?.id1 || a?.id || 0);
                    const idB = Number(b?.id1 || b?.id || 0);
                    return idA - idB;
                  })
                  .map(card => {
                    const cardId = Number(card?.id1 || card?.id);
                    const isSelected = effectiveSelectedIds.includes(cardId);
                    const isDragHighlight = isDragSelecting && dragTouchedIds.includes(cardId);
                    return (
                    <div
                      key={card?.id1 ?? card?.id}
                      data-card-id={cardId}
                      onClick={() => {
                        if (justFinishedDragRef.current) return;
                        toggleWordSelection(cardId);
                      }}
                      onMouseDown={(e) => {
                        if (!user?.id) return;
                        longPressCardIdRef.current = cardId;
                        longPressSelectedRef.current = selectedIds.includes(cardId);
                        startLongPressDrag(e.clientX, e.clientY);
                      }}
                      onTouchStart={(e) => {
                        if (!user?.id || !e.touches[0]) return;
                        const t = e.touches[0];
                        longPressCardIdRef.current = cardId;
                        longPressSelectedRef.current = selectedIds.includes(cardId);
                        startLongPressDrag(t.clientX, t.clientY);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`p-4 rounded-2xl border-2 text-center transition-all select-none ${isSelected ? "bg-orange-500 border-orange-600 text-white shadow-lg" : "bg-white border-slate-100"} ${isDragHighlight ? "ring-2 ring-orange-400 ring-offset-1" : ""}`}
                      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
                      onDragStart={(e) => e.preventDefault()}
                    >
                      <div className="text-2xl font-bold">{card?.cn || ''}</div>
                      <div className={`text-[9px] font-bold uppercase ${isSelected ? 'text-white' : 'text-slate-400'}`}>{card?.pinyin || ''}</div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-3 text-center text-slate-400 py-8">กำลังโหลดข้อมูล...</div>
              )}
            </div>
          </div>
        );
        })()}
      </main>
    </div>
  );
}