import React, { useState, useEffect, useCallback } from 'react';
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
import Rewards from './components/Rewards';
import Comics from './components/Comics';

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
  const [isFlipped, setIsFlipped] = useState(false);
  const [timer, setTimer] = useState(5);
  const [gameActive, setGameActive] = useState(false);
  const [gameQueue, setGameQueue] = useState([]);

  // UI States
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [libraryDetail, setLibraryDetail] = useState(null);
  const [libFlipped, setLibFlipped] = useState(false);
  const [username, setUsername] = useState('');

  // --- 1. Initial Load ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { 
        setUser(session.user); setPage('dashboard');
        fetchInitialData(session.user.id);
        fetchUserSettings(session.user.id);
        fetchUsername(session.user.id);
      }
    });
  }, []);

  // ดึง username เมื่อ user เปลี่ยน
  useEffect(() => {
    if (user?.id) {
      fetchUsername(user.id);
    }
  }, [user?.id]);

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

  const fetchUsername = async (userId) => {
    if (!userId) return;
    
    try {
      // ดึงข้อมูล username จากตาราง profiles
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('username, display_name, email')
        .eq('user_id', userId)
        .single();

      if (!error && profile) {
        // ลำดับความสำคัญ: username > display_name (ถ้าไม่ใช่ email) > username จาก email
        let displayName = profile.username;
        
        if (!displayName || displayName.trim() === '') {
          if (profile.display_name && !profile.display_name.includes('@')) {
            displayName = profile.display_name;
          } else {
            displayName = profile.email ? profile.email.split('@')[0] : null;
          }
        }
        
        if (!displayName || displayName.trim() === '') {
          displayName = profile.email || 'User';
        }
        
        setUsername(displayName);
      } else {
        // ถ้าไม่มีข้อมูลใน profiles ให้ใช้ username จาก email
        const currentUser = user || (await supabase.auth.getUser()).data.user;
        const fallbackName = currentUser?.email ? currentUser.email.split('@')[0] : currentUser?.user_metadata?.username || 'User';
        setUsername(fallbackName);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      // Fallback: ใช้ username จาก email
      const currentUser = user || (await supabase.auth.getUser()).data.user;
      const fallbackName = currentUser?.email ? currentUser.email.split('@')[0] : 'User';
      setUsername(fallbackName);
    }
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

  const startLevelGame = async (level) => {
    try {
      setActiveLevel(level); setIsPreloading(true); setPreloadProgress(0);
      let query = supabase.from('user_progress').select('flashcard_id').eq('user_id', user.id);
      if (level === 'mistakes') query = query.gte('wrong_count', 3); 
      else query = query.eq('level', level).lt('wrong_count', 3);
      const { data: progress, error: progressError } = await query;
      if (progressError) {
        console.error('Error fetching progress:', progressError);
        setIsPreloading(false);
        alert("เกิดข้อผิดพลาด: " + progressError.message);
        return;
      }
      if (!progress || progress.length === 0) { 
        setIsPreloading(false); 
        alert("ไม่มีคำศัพท์"); 
        return; 
      }
      // แปลง flashcard_id เป็น number ก่อน query
      const flashcardIds = progress.map(p => Number(p.flashcard_id)).filter(id => !isNaN(id));
      console.log('Flashcard IDs for game:', flashcardIds);
      const { data: cards, error: cardsError } = await supabase.from('flashcards').select('*').in('id1', flashcardIds);
      if (cardsError) {
        console.error('Error fetching cards:', cardsError);
        setIsPreloading(false);
        alert("เกิดข้อผิดพลาด: " + cardsError.message);
        return;
      }
      if (!cards || cards.length === 0) {
        setIsPreloading(false);
        alert("ไม่พบคำศัพท์");
        return;
      }
      console.log('Loading', cards.length, 'cards');
      let loaded = 0;
      const urls = cards.flatMap(c => [c.image_front_url, c.image_back_url]).filter(url => url);
      console.log('Total images to load:', urls.length);
      for (const url of urls) {
        await new Promise(r => { 
          const img = new Image(); 
          img.src = url; 
          img.onload = () => { 
            loaded++; 
            setPreloadProgress(Math.floor((loaded/(urls.length || 1))*100)); 
            r(); 
          };
          img.onerror = () => {
            console.warn('Failed to load image:', url);
            loaded++;
            setPreloadProgress(Math.floor((loaded/(urls.length || 1))*100));
            r();
          };
        });
      }
      setIsPreloading(false); 
      setGameQueue(cards.sort(() => Math.random() - 0.5)); 
      setPage('fc-play'); 
      setGameActive(true);
    } catch (error) {
      console.error('Error in startLevelGame:', error);
      setIsPreloading(false);
      alert("เกิดข้อผิดพลาด: " + error.message);
    }
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
    const { data: currentProgress } = await supabase.from('user_progress').select('wrong_count, level').eq('user_id', user.id).eq('flashcard_id', currentCard.id1 || currentCard.id).single();
    
    // ป้องกันแอปพังถ้าหาข้อมูล progress ไม่เจอ
    const currentWrong = currentProgress?.wrong_count || 0;
    const currentLv = currentProgress?.level || 1;

    if (isCorrect) {
      if (activeLevel === 'mistakes') { nextLevel = 1; nextWrongCount = 0; }
      else { nextLevel = Math.min(activeLevel + 1, 7); nextWrongCount = currentWrong; }
    } else { nextLevel = 1; nextWrongCount = currentWrong + 1; }

    await supabase.from('user_progress').update({ level: nextLevel, wrong_count: nextWrongCount }).eq('user_id', user.id).eq('flashcard_id', currentCard.id1 || currentCard.id);
    setGameQueue(gameQueue.slice(1)); setCurrentCard(null); fetchInitialData(user.id);
  };

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
        <button onClick={() => {setPage('rewards'); setIsMenuOpen(false);}}>🏆 Award</button>
        <button onClick={() => {setPage('settings'); setIsMenuOpen(false);}}>⚙️ Setting</button>
        <button onClick={handleLogout} className="block text-red-400 pt-10 text-xl font-bold uppercase">🚪 Logout</button>
      </div>
    </div>
  );

  if (page === 'login') return <Login setPage={setPage} setUser={setUser} fetchInitialData={fetchInitialData} fetchUserSettings={fetchUserSettings} />;

  return (
    <div 
      className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-10 overflow-x-hidden select-none" 
      style={{ overscrollBehavior: 'contain', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      onDragStart={(e) => e.preventDefault()}
    >
      <header className="p-4 bg-white shadow-sm border-b-4 border-orange-500 flex justify-between items-center sticky top-0 z-40">
        <div className="flex flex-col">
          <h1 className="font-black text-orange-600 text-xl uppercase italic tracking-tighter">Nihao Game</h1>
          {username && (
            <div className="text-xs font-black text-slate-500 uppercase italic mt-0.5">
              👤 {username}
            </div>
          )}
        </div>
        <button onClick={() => setIsMenuOpen(true)} className="w-12 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center text-2xl shadow-lg">☰</button>
      </header>

      <MenuOverlay />

      <main className="max-w-md mx-auto p-4">
        {isPreloading && (
          <div 
            className="fixed inset-0 bg-white/95 z-[60] flex flex-col items-center justify-center p-10 text-center select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
            onDragStart={(e) => e.preventDefault()}
          >
            <h2 className="text-xl font-black italic uppercase text-orange-600">Preparing...</h2>
            <div className="w-full bg-slate-100 h-4 rounded-full mt-8 border"><div className="bg-orange-500 h-full transition-all" style={{width: `${preloadProgress}%`}}></div></div>
          </div>
        )}

        {page === 'dashboard' && <Dashboard setPage={setPage} user={user} />}
        {page === 'fc-chars' && <Flashcards setPage={setPage} levelCounts={levelCounts} schedules={schedules} checkLevelAvailable={checkLevelAvailable} startLevelGame={startLevelGame} />}
        {page === 'fc-play' && currentCard && <FlashcardGame setPage={setPage} activeLevel={activeLevel} currentCard={currentCard} setCurrentCard={setCurrentCard} timer={timer} isFlipped={isFlipped} setIsFlipped={setIsFlipped} gameQueue={gameQueue} handleAnswer={handleAnswer} setGameActive={setGameActive} />}
        {page === 'library' && <Library setPage={setPage} allMasterCards={allMasterCards} selectedIds={selectedIds} libraryDetail={libraryDetail} setLibraryDetail={setLibraryDetail} libFlipped={libFlipped} setLibFlipped={setLibFlipped} />}
        {page === 'score' && <Score user={user} selectedIds={selectedIds} levelCounts={levelCounts} setPage={setPage} />}
        {page === 'rewards' && <Rewards setPage={setPage} />}
        {page === 'comics' && <Comics setPage={setPage} />}
        
        {(page === 'settings' || page === 'set-schedule') && (
          <Settings 
            page={page} 
            setPage={setPage} 
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
        
        {page === 'select-words' && (
          <div 
            className="space-y-4 pb-10 text-center select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
            onDragStart={(e) => e.preventDefault()}
          >
            <div className="flex justify-between items-center sticky top-20 bg-slate-50 py-2 z-10 px-2">
              <button onClick={() => setPage('settings')} className="text-orange-600 font-black italic underline uppercase text-xs">← Back</button>
              <div className="bg-orange-600 text-white px-4 py-1 rounded-full font-black text-xs">Selected {selectedIds.length}</div>
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
                    const isSelected = selectedIds.includes(cardId);
                  return (
                    <div 
                      key={card?.id1 || card?.id || Math.random()} 
                      onClick={() => toggleWordSelection(cardId)} 
                      className={`p-4 rounded-2xl border-2 text-center transition-all select-none ${isSelected ? "bg-orange-500 border-orange-600 text-white shadow-lg" : "bg-white border-slate-100"}`}
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
        )}
      </main>
    </div>
  );
}