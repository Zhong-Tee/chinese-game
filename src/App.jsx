import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Flashcards from './components/Flashcards';
import Settings from './components/Settings';
import FlashcardGame from './components/FlashcardGame';
import Library from './components/Library';

export default function App() {
  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);
  const [timerSetting, setTimerSetting] = useState(5);
  const [schedules, setSchedules] = useState({ lv3: [], lv4: [], lv5: [], lv6: [] });
  const [allMasterCards, setAllMasterCards] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [levelCounts, setLevelCounts] = useState({1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, mistakes: 0});
  const [activeLevel, setActiveLevel] = useState(1);
  const [currentCard, setCurrentCard] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [timer, setTimer] = useState(5);
  const [gameActive, setGameActive] = useState(false);
  const [gameQueue, setGameQueue] = useState([]);
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [libraryDetail, setLibraryDetail] = useState(null);
  const [libFlipped, setLibFlipped] = useState(false);

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
    if (data) { setTimerSetting(data.timer_setting); setSchedules(data.schedules); }
    else { await supabase.from('user_settings').insert([{ user_id: userId }]); }
  };

  const saveSettings = async (newTimer, newSchedules) => {
    await supabase.from('user_settings').update({ timer_setting: newTimer, schedules: newSchedules }).eq('user_id', user.id);
  };

  const fetchInitialData = async (userId) => {
    const { data: master } = await supabase.from('flashcards').select('*').order('id', { ascending: true });
    setAllMasterCards(master || []);
    const { data: progress } = await supabase.from('user_progress').select('level, wrong_count, flashcard_id').eq('user_id', userId);
    if (progress) {
      setSelectedIds(progress.map(p => p.flashcard_id));
      const counts = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, mistakes: 0};
      progress.forEach(item => { 
        if (item.wrong_count >= 3) counts.mistakes++;
        else if (counts[item.level] !== undefined) counts[item.level]++;
      });
      setLevelCounts(counts);
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

  const startLevelGame = async (level) => {
    setActiveLevel(level); setIsPreloading(true); setPreloadProgress(0);
    let query = supabase.from('user_progress').select('flashcard_id').eq('user_id', user.id);
    if (level === 'mistakes') query = query.gte('wrong_count', 3); 
    else query = query.eq('level', level).lt('wrong_count', 3);
    const { data: progress } = await query;
    if (!progress || progress.length === 0) { setIsPreloading(false); alert("ไม่มีคำศัพท์"); return; }
    const { data: cards } = await supabase.from('flashcards').select('*').in('id', progress.map(p => p.flashcard_id));
    let loaded = 0;
    const urls = cards.flatMap(c => [c.image_front_url, c.image_back_url]);
    for (const url of urls) {
      await new Promise(r => { const img = new Image(); img.src = url; img.onload = img.onerror = () => { loaded++; setPreloadProgress(Math.floor((loaded/urls.length)*100)); r(); }; });
    }
    setIsPreloading(false); setGameQueue(cards.sort(() => Math.random() - 0.5)); setPage('fc-play'); setGameActive(true);
  };

  useEffect(() => {
    if (gameActive && gameQueue.length > 0 && !currentCard) {
      setCurrentCard(gameQueue[0]); setTimer(timerSetting); setIsFlipped(false);
    } else if (gameActive && gameQueue.length === 0 && !currentCard) {
      alert("🎉 จบช่วงการฝึกแล้ว!"); setPage('fc-chars'); setGameActive(false);
    }
  }, [gameQueue, currentCard, gameActive, timerSetting]);

  useEffect(() => {
    let interval;
    if (gameActive && currentCard && !isFlipped && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && !isFlipped && gameActive) { setIsFlipped(true); }
    return () => clearInterval(interval);
  }, [timer, isFlipped, gameActive, currentCard]);

  const handleAnswer = async (isCorrect) => {
    let nextLevel; let nextWrongCount;
    const { data: currentProgress } = await supabase.from('user_progress').select('wrong_count, level').eq('user_id', user.id).eq('flashcard_id', currentCard.id).single();
    if (isCorrect) {
      if (activeLevel === 'mistakes') { nextLevel = 1; nextWrongCount = 0; }
      else { nextLevel = Math.min(activeLevel + 1, 7); nextWrongCount = currentProgress.wrong_count; }
    } else { nextLevel = 1; nextWrongCount = (currentProgress.wrong_count || 0) + 1; }
    await supabase.from('user_progress').update({ level: nextLevel, wrong_count: nextWrongCount }).eq('user_id', user.id).eq('flashcard_id', currentCard.id);
    setGameQueue(gameQueue.slice(1)); setCurrentCard(null); fetchInitialData(user.id);
  };

  const checkLevelAvailable = (lv) => {
    if (lv === 'mistakes' || lv <= 2 || lv === 7) return true;
    const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์"];
    const today = new Date();
    const dayName = days[today.getDay() === 0 ? 6 : today.getDay() - 1];
    const dateNum = today.getDate();
    if (lv === 3) return schedules.lv3.includes(dayName);
    if (lv === 4) return schedules.lv4.includes(dayName);
    if (lv === 5) return schedules.lv5.includes(dateNum);
    if (lv === 6) return schedules.lv6.includes(dateNum);
    return false;
  };

  const MenuOverlay = () => (
    <div className={`fixed inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center transition-all duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <button onClick={() => setIsMenuOpen(false)} className="absolute top-6 right-6 text-white text-4xl">&times;</button>
      <div className="flex flex-col space-y-8 text-center text-white font-black italic text-2xl uppercase">
        <button onClick={() => {setPage('dashboard'); setIsMenuOpen(false);}}>🏠 Home</button>
        <button onClick={() => {setPage('rewards'); setIsMenuOpen(false);}}>🏆 Award</button>
        <button onClick={() => {setPage('settings'); setIsMenuOpen(false);}}>⚙️ Setting</button>
        <button onClick={() => {supabase.auth.signOut(); window.location.reload();}} className="block text-red-400 pt-10 text-xl font-bold uppercase">🚪 Logout</button>
      </div>
    </div>
  );

  if (page === 'login') return <Login setPage={setPage} setUser={setUser} fetchInitialData={fetchInitialData} fetchUserSettings={fetchUserSettings} />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-10 overflow-x-hidden" style={{ overscrollBehavior: 'contain' }}>
      <header className="p-4 bg-white shadow-sm border-b-4 border-orange-500 flex justify-between items-center sticky top-0 z-40">
        <h1 className="font-black text-orange-600 text-xl uppercase italic tracking-tighter">Nihao Game</h1>
        <button onClick={() => setIsMenuOpen(true)} className="w-12 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center text-2xl shadow-lg">☰</button>
      </header>

      <MenuOverlay />

      <main className="max-w-md mx-auto p-4">
        {isPreloading && (
          <div className="fixed inset-0 bg-white/95 z-[60] flex flex-col items-center justify-center p-10 text-center">
            <h2 className="text-xl font-black italic uppercase text-orange-600">Preparing...</h2>
            <div className="w-full bg-slate-100 h-4 rounded-full mt-8 border"><div className="bg-orange-500 h-full transition-all" style={{width: `${preloadProgress}%`}}></div></div>
          </div>
        )}

        {page === 'dashboard' && <Dashboard setPage={setPage} />}
        {page === 'fc-chars' && <Flashcards setPage={setPage} levelCounts={levelCounts} schedules={schedules} checkLevelAvailable={checkLevelAvailable} startLevelGame={startLevelGame} />}
        {page === 'fc-play' && currentCard && <FlashcardGame setPage={setPage} activeLevel={activeLevel} currentCard={currentCard} setCurrentCard={setCurrentCard} timer={timer} isFlipped={isFlipped} setIsFlipped={setIsFlipped} gameQueue={gameQueue} handleAnswer={handleAnswer} setGameActive={setGameActive} />}
        {page === 'library' && <Library setPage={setPage} allMasterCards={allMasterCards} selectedIds={selectedIds} libraryDetail={libraryDetail} setLibraryDetail={setLibraryDetail} libFlipped={libFlipped} setLibFlipped={setLibFlipped} />}
        {(page === 'settings' || page === 'set-schedule') && <Settings page={page} setPage={setPage} timerSetting={timerSetting} setTimerSetting={setTimerSetting} schedules={schedules} setSchedules={setSchedules} saveSettings={saveSettings} />}
        
        {page === 'select-words' && (
          <div className="space-y-4 pb-10 text-center">
            <div className="flex justify-between items-center sticky top-20 bg-slate-50 py-2 z-10 px-2">
              <button onClick={() => setPage('settings')} className="text-orange-600 font-black italic underline uppercase text-xs">← Back</button>
              <div className="bg-orange-600 text-white px-4 py-1 rounded-full font-black text-xs uppercase shadow-sm">Selected {selectedIds.length}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {allMasterCards.map(card => {
                const isSelected = selectedIds.includes(card.id);
                return (
                  <div key={card.id} onClick={() => toggleWordSelection(card.id)} className={`p-4 rounded-2xl border-2 text-center transition-all ${isSelected ? "bg-orange-500 border-orange-600 text-white shadow-lg" : "bg-white border-slate-100"}`}>
                    <div className="text-2xl font-bold">{card.cn}</div>
                    <div className={`text-[9px] font-bold uppercase ${isSelected ? "text-white" : "text-slate-400"}`}>{card.pinyin}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}