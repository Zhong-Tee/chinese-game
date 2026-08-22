import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Flashcards from './components/Flashcards';
import Settings from './components/Settings';
import FlashcardGame from './components/FlashcardGame';
import Library from './components/Library';
import WordMatchGame from './components/WordMatchGame';
import Score from './components/Score';
import Statistics from './components/Statistics';
import GamesHub from './components/GamesHub';
import DifficultySelect from './components/DifficultySelect';
import BattleGame from './components/BattleGame';
import Shop from './components/Shop';
import LuckyDraw from './components/LuckyDraw';
import LevelPlayPrompt from './components/LevelPlayPrompt';
import {
  SCHEDULED_LEVEL_KEYS,
  EMPTY_LEVEL_KEYS,
  applyKeyGrants,
  isKeyLevelPlayableToday,
  consumeLevelKey,
} from './utils/levelScheduleMeta';
import AdminPanel from './components/AdminPanel';
import { fetchDailyMissionConfig, fetchTodayMission, initializeTodayMission, localDateKey, recordDailyWordResult, startDailyReviewMission, syncTodayMissionProgress } from './utils/dailyMissionStorage';
import { saveWrongWord } from './utils/wrongWordsStorage';
import { createFlashcardSessionTracker, recordFlashcardWrongAnswer } from './utils/flashcardStatsStorage';
import { getGameState, addCurrency, getExpForLevel, getStageProgress, saveStageProgress, getSfxMap } from './utils/gameStorage';
import { playBgm, stopBgm } from './utils/gameAudio';
import {
  playFlashcardCorrectSfx,
  playFlashcardWrongSfx,
  playFlashcardTimerWarnSfx,
} from './utils/flashcardSfx';
import {
  sentenceTokens,
  shouldFlashcardRearrange,
  shouldFlashcardTyping,
  compareTypingAnswer,
} from './utils/sentenceTokens';

export default function App() {
  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Game economy
  const [gameState, setGameState] = useState({ exp: 0, coin: 0 });
  const [activeStage, setActiveStage] = useState(null); // ด่านที่กำลังเล่นใน GAMES
  const [activeDifficulty, setActiveDifficulty] = useState('easy'); // ระดับความยากที่เลือก
  const [stageProgress, setStageProgress] = useState({}); // ความคืบหน้าด่าน (ปลดล็อก + เหรียญ แยกตามระดับ)
  const [lastCoinToast, setLastCoinToast] = useState(null);

  const refreshGameState = useCallback(async (userId) => {
    const id = userId || user?.id;
    if (!id) return;
    const state = await getGameState(id);
    setGameState(state);
  }, [user?.id]);

  const refreshStageProgress = useCallback(async (userId) => {
    const id = userId || user?.id;
    if (!id) return;
    const prog = await getStageProgress(id);
    setStageProgress(prog);
  }, [user?.id]);
  
  // Settings & Data
  const [timerSetting, setTimerSetting] = useState(5); // สำหรับ Flashcard
  const [gameTimerSetting, setGameTimerSetting] = useState(5); // สำหรับช่วงเรียงคำศัพท์ Flashcard
  const [typeTimerSetting, setTypeTimerSetting] = useState(5); // สำหรับช่วงพิมพ์คำศัพท์ Flashcard
  const [schedules, setSchedules] = useState({ lv3: [], lv4: [], lv5: [], lv6: [] });
  const [levelKeys, setLevelKeys] = useState(EMPTY_LEVEL_KEYS);
  const [allMasterCards, setAllMasterCards] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [levelCounts, setLevelCounts] = useState({1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, mistakes: 0});
  
  // Game States
  const [activeLevel, setActiveLevel] = useState(1);
  const [currentCard, setCurrentCard] = useState(null);
  const [timer, setTimer] = useState(5);
  const [gameActive, setGameActive] = useState(false);
  const [gameQueue, setGameQueue] = useState([]);
  const [flashcardStage, setFlashcardStage] = useState('pinyin'); // pinyin | meaning | rearrange | typing
  const [flashcardChoices, setFlashcardChoices] = useState([]);
  const [flashcardSelectedAnswer, setFlashcardSelectedAnswer] = useState('');
  const [flashcardCorrectAnswer, setFlashcardCorrectAnswer] = useState('');
  const [flashcardStageCorrect, setFlashcardStageCorrect] = useState(false);
  const [flashcardStageAnswered, setFlashcardStageAnswered] = useState(false);
  const [flashcardStageResults, setFlashcardStageResults] = useState({ pinyin: null, meaning: null, rearrange: null, typing: null });
  const [flashcardTimedOut, setFlashcardTimedOut] = useState(false);
  const [flashcardRearrangeTokens, setFlashcardRearrangeTokens] = useState([]);
  const [flashcardRearrangeAssembled, setFlashcardRearrangeAssembled] = useState([]);
  const [flashcardRearrangeCorrect, setFlashcardRearrangeCorrect] = useState('');
  const [flashcardTypedAnswer, setFlashcardTypedAnswer] = useState('');
  const FLASHCARD_CORRECT_REVEAL_MS = 2000;
  const flashcardSessionRef = useRef(null);
  // กันโกงกด Cancel/back/refresh หนีกลางการ์ด: หักคำลง LV1 ทันทีที่ตอบช่วงแรก (ดู applyCardEntryPenalty)
  const cardPenaltyRef = useRef(null); // { cardId, baseWrong } = wrong_count เดิมก่อนหักโทษ
  const flashcardSfxRef = useRef({});
  const flashcardTimerWarnAtRef = useRef(null);
  if (!flashcardSessionRef.current) {
    flashcardSessionRef.current = createFlashcardSessionTracker();
  }

  const endFlashcardSession = useCallback(async () => {
    await flashcardSessionRef.current?.end();
  }, []);

  const handleExitFlashcardGame = useCallback(async () => {
    // ถ้าตอบช่วงแรกของการ์ดไปแล้ว คำถูกหักลง LV1 แล้ว (applyCardEntryPenalty) — ออกกลางคันจึงไม่รอด
    await endFlashcardSession();
    cardPenaltyRef.current = null;
    setPage('fc-chars');
    setGameActive(false);
    setCurrentCard(null);
    setGameQueue([]);
    if (user?.id) fetchInitialData(user.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endFlashcardSession, user?.id]);

  // Daily new-words popup
  const [dailyNewWords, setDailyNewWords] = useState(null);
  const [dailyMissionNotice, setDailyMissionNotice] = useState(null);
  const [levelPlayPrompt, setLevelPlayPrompt] = useState(null);

  // UI States
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showTrainingCompleteModal, setShowTrainingCompleteModal] = useState(false);
  const [appNoticeModal, setAppNoticeModal] = useState(null);

  const [libraryDetail, setLibraryDetail] = useState(null);
  const [libFlipped, setLibFlipped] = useState(false);
  const [username, setUsername] = useState('');
  const [wrongWordToast, setWrongWordToast] = useState(null); // popup "ได้เพิ่มคำผิดไว้ใน list ให้แล้ว"
  // ลากนิ้ว/เมาส์เพื่อเลือกคำ (Select Study Words) — ต้องกดค้าง 2 วินาทีก่อนถึงจะลากได้
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragSelectMode, setDragSelectMode] = useState('add'); // 'add' | 'remove'
  const [dragTouchedIds, setDragTouchedIds] = useState([]);
  
  // ปุ่มย้อนกลับมือถือ/เบราว์เซอร์ → ย้อนหน้าในแอพ (ไม่ออกจากแอพ)
  const isPoppingRef = useRef(false);     // true ระหว่างที่ setPage มาจากปุ่ม back
  const historyReadyRef = useRef(false);  // ตั้ง base entry ครั้งแรกแล้วหรือยัง
  const pageRef = useRef('login');        // หน้าปัจจุบัน (ให้ popstate handler อ่านค่าล่าสุดได้)

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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        setPage('dashboard');
        fetchInitialData(session.user.id);
        fetchUserSettings(session.user.id);
        const newWords = await checkAndAddDailyWords(session.user.id);
        if (newWords && newWords.length > 0) setDailyNewWords(newWords);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // กรณีเพิ่มคำของวันนี้ไปแล้วก่อนอัปเดตแอป: ยังแสดง Popup ภารกิจให้ 1 ครั้งต่อวัน
  useEffect(() => {
    if (!user?.id || page !== 'dashboard' || dailyNewWords || dailyMissionNotice) return undefined;
    const noticeKey = `daily-new-words-mission-notice:${user.id}:${localDateKey()}`;
    if (localStorage.getItem(noticeKey) === 'shown') return undefined;
    let alive = true;
    const timerId = setTimeout(async () => {
      try {
        const mission = await fetchTodayMission(user.id).catch(() => null);
        let addedCount = (mission?.new_word_ids || []).length;
        if (addedCount <= 0) {
          const { data: settings } = await supabase.from('user_settings')
            .select('last_daily_words_date').eq('user_id', user.id).maybeSingle();
          if (settings?.last_daily_words_date === localDateKey()) {
            const config = await fetchDailyMissionConfig().catch(() => ({ new_words_target: 5 }));
            addedCount = Math.max(1, Number(config.new_words_target) || 5);
          }
        }
        if (!alive || addedCount <= 0) return;
        localStorage.setItem(noticeKey, 'shown');
        setDailyMissionNotice({ addedCount });
      } catch (error) {
        console.error('load daily mission notice:', error);
      }
    }, 700);
    return () => { alive = false; clearTimeout(timerId); };
  }, [user?.id, page, dailyNewWords, dailyMissionNotice]);

  // --- 1.5 ปุ่มย้อนกลับ (มือถือ/เบราว์เซอร์) ให้ย้อนหน้าภายในแอพ ---
  // ฟัง popstate: เมื่อกด back ให้เปลี่ยน page กลับไปหน้าที่บันทึกไว้ใน history
  useEffect(() => {
    const onPopState = (e) => {
      const targetPage = e.state?.page;
      setIsMenuOpen(false);
      if (targetPage) {
        isPoppingRef.current = true;
        setPage(targetPage);
      } else {
        // ถึง base entry แล้ว (กำลังจะย้อนออกจากเว็บ) → ดักไว้ที่หน้า home ไม่ให้ออก
        window.history.pushState({ page: 'dashboard' }, '');
        if (pageRef.current !== 'dashboard') {
          isPoppingRef.current = true;
          setPage('dashboard');
        }
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // เมื่อ page เปลี่ยน: push entry ใหม่เข้า history (ยกเว้นกรณีมาจากปุ่ม back)
  useEffect(() => {
    pageRef.current = page;
    if (page === 'login') return;
    if (isPoppingRef.current) {
      isPoppingRef.current = false;
      return;
    }
    if (!historyReadyRef.current) {
      // หน้าแรกหลังล็อกอิน: ตั้งเป็น base entry โดยไม่เพิ่ม entry ใหม่
      window.history.replaceState({ page }, '');
      historyReadyRef.current = true;
    } else {
      window.history.pushState({ page }, '');
    }
  }, [page]);

  // เพลงหน้า Home — loop ขณะอยู่ dashboard หยุดเมื่อออก
  useEffect(() => {
    if (page !== 'dashboard') return undefined;
    let alive = true;
    (async () => {
      const sfx = await getSfxMap();
      if (!alive || !sfx.hub_music) return;
      playBgm(sfx.hub_music, 0.35);
    })();
    return () => {
      alive = false;
      stopBgm();
    };
  }, [page]);

  const fetchUserSettings = async (userId) => {
    // schedules = ค่ากลาง (game_settings) ใช้ร่วมทุกคน; timers/level_keys = รายคน (user_settings)
    const [{ data }, { data: gs }] = await Promise.all([
      supabase.from('user_settings').select('*').eq('user_id', userId).single(),
      supabase.from('game_settings').select('schedules').eq('id', 1).maybeSingle(),
    ]);

    const loadedSchedules = gs?.schedules || { lv3: [], lv4: [], lv5: [], lv6: [] };
    setSchedules(loadedSchedules);

    if (data) {
      setTimerSetting(data.timer_setting || 5);
      setGameTimerSetting(data.game_timer_setting || data.minigame_timer || 5); // เพิ่ม fallback minigame_timer
      setTypeTimerSetting(data.type_timer || 5); // ดึงค่า type_timer
      // ระบบลูกกุญแจ: มอบกุญแจตามวันเปิดของวันนี้ (ถ้าถึงกำหนด)
      const { levelKeys: grantedKeys, changed } = applyKeyGrants(loadedSchedules, data.level_keys || {});
      setLevelKeys(grantedKeys);
      if (changed) persistLevelKeys(userId, grantedKeys);
    }
    else { await supabase.from('user_settings').insert([{ user_id: userId }]); }
  };

  const persistLevelKeys = async (userId, newKeys) => {
    const id = userId || user?.id;
    if (!id) return;
    const { error } = await supabase.from('user_settings').update({ level_keys: newKeys }).eq('user_id', id);
    if (error) console.error('Error saving level_keys:', error);
  };

  const saveSettings = async (newTimer, newGameTimer, newTypeTimer) => {
    if (!user || !user.id) {
      console.error('User not found, cannot save settings');
      return;
    }

    const { error } = await supabase.from('user_settings').update({
      timer_setting: newTimer,
      minigame_timer: newGameTimer, // เวลาเรียงคำศัพท์ (Flashcard ช่วงที่ 3)
      type_timer: newTypeTimer || typeTimerSetting, // เวลาพิมพ์คำศัพท์ (Flashcard ช่วงพิมพ์)
    }).eq('user_id', user.id);

    if (error) {
      console.error('Error saving settings:', error);
      alert('ไม่สามารถบันทึกการตั้งค่าได้: ' + error.message);
    } else {
      console.log('Settings saved successfully:', { timer_setting: newTimer, minigame_timer: newGameTimer, type_timer: newTypeTimer || typeTimerSetting });
    }
  };

  // ตารางเปิด Level = ค่ากลาง (เฉพาะ admin แก้ได้) → มีผลกับทุก user
  const saveSchedules = async (newSchedules) => {
    if (!user || !user.id) return;
    const { error } = await supabase.from('game_settings')
      .update({ schedules: newSchedules, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) {
      console.error('Error saving schedules:', error);
      alert('ไม่สามารถบันทึกตารางได้: ' + error.message);
    }
  };

  const fetchInitialData = async (userId) => {
    try {
      // โหลด EXP/Coin + สถานะ admin (ไม่บล็อกการโหลดคำศัพท์)
      getGameState(userId).then(setGameState).catch(() => {});
      getStageProgress(userId).then(setStageProgress).catch(() => {});
      supabase.from('profiles').select('is_admin').eq('user_id', userId).maybeSingle()
        .then(({ data }) => setIsAdmin(!!data?.is_admin))
        .catch(() => {});

      // ดึง flashcards ทั้งหมดแบบแบ่งหน้า (Supabase จำกัด 1000 แถว/คำขอ) วนจนครบทุกแถว
      const PAGE_SIZE = 1000;
      let master = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data: page, error: masterError } = await supabase
          .from('flashcards')
          .select('*')
          .order('id1', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (masterError) {
          console.error('Error fetching flashcards:', masterError);
          return;
        }
        if (!page || page.length === 0) break;
        master = master.concat(page);
        if (page.length < PAGE_SIZE) break;
      }
      console.log('Fetched flashcards:', master.length, 'items');
      setAllMasterCards(master);
      
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

  const checkAndAddDailyWords = async (userId) => {
    try {
      // ใช้วันตามเวลาท้องถิ่นให้ตรงกับ daily_mission_progress
      // (toISOString เป็น UTC และจะเป็นคนละวันกับไทยในช่วงก่อน 07:00 น.)
      const today = localDateKey();

      const { data: settings } = await supabase
        .from('user_settings')
        .select('last_daily_words_date')
        .eq('user_id', userId)
        .maybeSingle();

      if (settings?.last_daily_words_date === today) {
        // รอให้แถวภารกิจพร้อมก่อนโหลดข้อมูลหน้าเกม ป้องกัน Dashboard
        // อ่านเร็วกว่าการสร้างภารกิจแล้วแสดงดาวเป็นศูนย์ตลอดทั้งวัน
        await initializeTodayMission(userId).catch(console.error);
        return null;
      }

      const { data: allCards } = await supabase
        .from('flashcards')
        .select('id1, cn, pinyin, th')
        .order('id1', { ascending: true });

      if (!allCards || allCards.length === 0) return null;

      const { data: progress } = await supabase
        .from('user_progress')
        .select('flashcard_id')
        .eq('user_id', userId);

      const selectedSet = new Set((progress || []).map(p => Number(p.flashcard_id)));
      const unselected = allCards.filter(c => !selectedSet.has(Number(c.id1)));

      if (unselected.length === 0) return null;

      const missionConfig = await fetchDailyMissionConfig().catch(() => ({ enabled: true, new_words_target: 5 }));
      if (missionConfig.enabled === false) return null;
      const dailyTarget = Math.max(1, Number(missionConfig.new_words_target) || 5);
      const toAdd = unselected.slice(0, Math.min(dailyTarget, unselected.length));

      const { error: insertError } = await supabase.from('user_progress').insert(
        toAdd.map(card => ({ user_id: userId, flashcard_id: card.id1, level: 1, wrong_count: 0 }))
      );

      if (insertError) {
        console.error('Error inserting daily words:', insertError);
        return null;
      }

      await supabase
        .from('user_settings')
        .upsert({ user_id: userId, last_daily_words_date: today }, { onConflict: 'user_id' });

      // ต้องบันทึก ID ของคำใหม่ให้เสร็จก่อน ผู้เล่นจึงเริ่มเล่นและสะสมดาวได้
      await initializeTodayMission(userId, toAdd.map((card) => Number(card.id1))).catch(console.error);

      return toAdd;
    } catch (err) {
      console.error('Error in checkAndAddDailyWords:', err);
      return null;
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
    setFlashcardRearrangeAssembled([]);
    setFlashcardTypedAnswer('');
  }, []);

  const startLevelGame = async (level) => {
    try {
      // LV3-6: ใช้กุญแจได้วันละ 1 ด่าน และกลับเข้าเล่นด่านที่ปลดล็อกแล้วได้ทั้งวัน
      const isKeyedLevel = SCHEDULED_LEVEL_KEYS.includes(String(level));
      if (isKeyedLevel && !isKeyLevelPlayableToday(level, levelKeys)) {
        alert("ยังไม่มีลูกกุญแจสำหรับด่านนี้ หรือวันนี้ใช้สิทธิ์ปลดล็อกกับด่านอื่นไปแล้ว");
        return;
      }
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
        setAppNoticeModal({
          title: 'ไม่พบคำศัพท์',
          message: 'ยังไม่มีคำศัพท์ใน Level นี้สำหรับเล่น',
          icon: '📭',
        });
        return; 
      }
      if ([3, 4, 5, 6].includes(Number(level))) {
        await startDailyReviewMission(user.id, Number(level), progress.map((row) => Number(row.flashcard_id)));
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
        setAppNoticeModal({
          title: 'ไม่พบคำศัพท์',
          message: 'ไม่พบข้อมูลคำศัพท์สำหรับ Level นี้ กรุณาลองใหม่อีกครั้ง',
          icon: '📭',
        });
        return;
      }
      // ใช้ลูกกุญแจของด่านนี้ครั้งแรกของวัน — การเข้าเล่นด่านเดิมซ้ำจะไม่หักเพิ่ม
      if (isKeyedLevel) {
        const nextKeys = consumeLevelKey(level, levelKeys);
        setLevelKeys(nextKeys);
        persistLevelKeys(user.id, nextKeys);
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

  const playFlashcardFeedbackSfx = useCallback((isCorrect) => {
    if (isCorrect) playFlashcardCorrectSfx(flashcardSfxRef.current);
    else playFlashcardWrongSfx(flashcardSfxRef.current);
  }, []);

  useEffect(() => {
    if (!gameActive) return;
    getSfxMap().then((map) => {
      flashcardSfxRef.current = map;
    });
  }, [gameActive]);

  useEffect(() => {
    flashcardTimerWarnAtRef.current = null;
  }, [currentCard, flashcardStage, flashcardStageAnswered, gameActive]);

  // กันโกง: ทันทีที่ตอบช่วงแรก (ถูก/ผิด/หมดเวลา) หักคำนี้ลง LV1 + wrong_count+1 ใน DB ก่อนเลย
  // ถ้าเล่นครบทุกช่วงแล้วผ่าน moveToNextCard จะเขียนทับเป็นเลเวลถัดไปให้เอง
  // ดังนั้นเมื่อเริ่มตอบแล้วหนีกลางคัน (Cancel / ปุ่ม back / refresh / ปิดแอพ) = คำค้างอยู่ LV1 เสมอ
  // (ยังไม่ตอบช่วงแรกแล้วออก = ไม่โดนโทษ)
  const applyCardEntryPenalty = useCallback(async (card) => {
    if (!user?.id || !card) return;
    const cardId = card.id1 || card.id;
    if (cardPenaltyRef.current?.cardId === cardId) return; // กัน effect ยิงซ้ำ (StrictMode)
    cardPenaltyRef.current = { cardId, baseWrong: 0 };
    const { data } = await supabase
      .from('user_progress')
      .select('wrong_count')
      .eq('user_id', user.id)
      .eq('flashcard_id', cardId)
      .single();
    const baseWrong = data?.wrong_count || 0;
    cardPenaltyRef.current = { cardId, baseWrong };
    const { error } = await supabase
      .from('user_progress')
      .update({ level: 1, wrong_count: baseWrong + 1 })
      .eq('user_id', user.id)
      .eq('flashcard_id', cardId);
    if (error) console.error('[applyCardEntryPenalty] UPDATE error:', error, { cardId });
  }, [user?.id]);

  const moveToNextCard = useCallback(async (isCardPassed) => {
    if (!currentCard || !user?.id) return;

    let nextLevel;
    let nextWrongCount;
    const cardId = currentCard.id1 || currentCard.id;

    // ใช้ wrong_count เดิมที่จำไว้ตอนหักโทษเข้าการ์ด (ใน DB ตอนนี้ถูก +1 ไปแล้ว จึงห้ามอ่านกลับมาบวกซ้ำ)
    const penalty = cardPenaltyRef.current?.cardId === cardId ? cardPenaltyRef.current : null;
    cardPenaltyRef.current = null;
    let currentWrong;
    if (penalty) {
      currentWrong = penalty.baseWrong;
    } else {
      // fallback (ไม่ควรเกิด): อ่านจาก DB ซึ่งรวมโทษ +1 ไว้แล้ว จึงลบออกก่อน
      const { data: currentProgress } = await supabase
        .from('user_progress')
        .select('wrong_count, level')
        .eq('user_id', user.id)
        .eq('flashcard_id', cardId)
        .single();
      currentWrong = Math.max((currentProgress?.wrong_count || 1) - 1, 0);
    }

    if (isCardPassed) {
      if (activeLevel === 'mistakes') {
        nextLevel = 1;
        nextWrongCount = 0;
      } else {
        nextLevel = Math.min(activeLevel + 1, 7);
        nextWrongCount = 0;
      }
    } else {
      nextLevel = 1;
      nextWrongCount = currentWrong + 1;
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from('user_progress')
      .update({ level: nextLevel, wrong_count: nextWrongCount })
      .eq('user_id', user.id)
      .eq('flashcard_id', cardId)
      .select('flashcard_id, level, wrong_count');

    if (updateError) {
      console.error('[moveToNextCard] UPDATE error:', updateError, { userId: user.id, cardId, nextLevel, nextWrongCount });
      setWrongWordToast?.(`บันทึกผลไม่สำเร็จ: ${updateError.message || updateError.code || 'unknown'}`);
      setTimeout(() => setWrongWordToast?.(null), 4000);
    } else if (!updatedRows || updatedRows.length === 0) {
      console.warn('[moveToNextCard] UPDATE matched 0 rows', { userId: user.id, cardId, cardIdType: typeof cardId, nextLevel, nextWrongCount });
      setWrongWordToast?.(`อัปเดต 0 แถว (cardId=${cardId})`);
      setTimeout(() => setWrongWordToast?.(null), 4000);
    } else {
      console.log('[moveToNextCard] UPDATE ok:', updatedRows);
      // รอให้ภารกิจบันทึกสำเร็จก่อนนำคำถัดไปขึ้น ป้องกันคำสุดท้าย
      // เลื่อน Level แล้วแต่ความคืบหน้าดาวยังค้างจากคำสั่งที่ทำงานเบื้องหลัง
      try {
        await recordDailyWordResult(user.id, cardId, nextLevel, isCardPassed);
      } catch (error) {
        console.error('record daily word result:', error);
      }
    }

    // ตอบถูกครบ → ได้รับ Coin ตาม LV ของคำนั้น (ค่ามาจากตาราง exp_rewards)
    if (isCardPassed) {
      const rewardLevel = activeLevel === 'mistakes' ? 1 : activeLevel;
      const gained = await getExpForLevel(rewardLevel);
      if (gained > 0) {
        const updated = await addCurrency({ coin: gained });
        if (updated) setGameState(updated);
        setLastCoinToast(`+${gained} Coin`);
        setTimeout(() => setLastCoinToast(null), 1500);
      }
    }

    if (!isCardPassed) {
      await recordFlashcardWrongAnswer();
    }

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
      applyCardEntryPenalty(currentCard); // เริ่มตอบแล้ว → หักโทษกันหนีกลางคัน
    } else if (flashcardStage === 'meaning') {
      setFlashcardStageResults(prev => ({ ...prev, meaning: isCorrect }));
    }
    playFlashcardFeedbackSfx(isCorrect);
  }, [applyCardEntryPenalty, currentCard, flashcardStage, flashcardStageAnswered, playFlashcardFeedbackSfx]);

  const moveToMeaningStage = useCallback(() => {
    if (!currentCard) return;
    const next = buildChoices('th', currentCard);
    resetStageState();
    setFlashcardStage('meaning');
    setFlashcardChoices(next.choices);
    setTimer(timerSetting);
  }, [buildChoices, currentCard, resetStageState, timerSetting]);

  const moveToRearrangeStage = useCallback(() => {
    if (!currentCard) return;
    const toks = sentenceTokens(currentCard);
    const withIds = toks.map((t, i) => ({ id: `${i}-${t}`, text: t }));
    resetStageState();
    setFlashcardRearrangeTokens(shuffleArray(withIds));
    setFlashcardRearrangeCorrect(toks.join(''));
    setFlashcardCorrectAnswer(toks.join(' '));
    setFlashcardStage('rearrange');
    setTimer(gameTimerSetting);
  }, [currentCard, gameTimerSetting, resetStageState]);

  const moveToTypingStage = useCallback(() => {
    if (!currentCard) return;
    const vocab = normalizeOptionText(currentCard?.vocabulary);
    resetStageState();
    setFlashcardCorrectAnswer(vocab);
    setFlashcardStage('typing');
    setTimer(typeTimerSetting);
  }, [currentCard, resetStageState, typeTimerSetting]);

  const submitCurrentCard = useCallback(async () => {
    const needsRearrange = shouldFlashcardRearrange(activeLevel, currentCard);
    const needsTyping = shouldFlashcardTyping(activeLevel, currentCard);
    const passed =
      flashcardStageResults.pinyin === true &&
      flashcardStageResults.meaning === true &&
      (!needsRearrange || flashcardStageResults.rearrange === true) &&
      (!needsTyping || flashcardStageResults.typing === true);
    await moveToNextCard(passed);
  }, [activeLevel, currentCard, flashcardStageResults, moveToNextCard]);

  const advanceAfterMeaning = useCallback(async () => {
    if (shouldFlashcardTyping(activeLevel, currentCard)) {
      moveToTypingStage();
    } else if (shouldFlashcardRearrange(activeLevel, currentCard)) {
      moveToRearrangeStage();
    } else {
      await submitCurrentCard();
    }
  }, [activeLevel, currentCard, moveToRearrangeStage, moveToTypingStage, submitCurrentCard]);

  const advanceAfterTyping = useCallback(async () => {
    if (shouldFlashcardRearrange(activeLevel, currentCard)) {
      moveToRearrangeStage();
    } else {
      await submitCurrentCard();
    }
  }, [activeLevel, currentCard, moveToRearrangeStage, submitCurrentCard]);

  const handleContinueStage = useCallback(async () => {
    if (!currentCard || !flashcardStageAnswered) return;
    if (flashcardStage === 'pinyin') {
      moveToMeaningStage();
      return;
    }
    if (flashcardStage === 'meaning') {
      await advanceAfterMeaning();
      return;
    }
    if (flashcardStage === 'typing') {
      await advanceAfterTyping();
      return;
    }
    if (flashcardStage === 'rearrange') {
      await submitCurrentCard();
    }
  }, [
    advanceAfterMeaning,
    advanceAfterTyping,
    currentCard,
    flashcardStageAnswered,
    flashcardStage,
    moveToMeaningStage,
    submitCurrentCard,
  ]);

  const handleRearrangeSubmit = useCallback(() => {
    if (!currentCard || flashcardStageAnswered || flashcardStage !== 'rearrange') return;
    if (flashcardRearrangeAssembled.length === 0) return;

    const text = flashcardRearrangeAssembled
      .map((id) => flashcardRearrangeTokens.find((t) => t.id === id)?.text || '')
      .join('');
    const isCorrect = text === flashcardRearrangeCorrect;
    const toks = sentenceTokens(currentCard);

    setFlashcardSelectedAnswer(text);
    setFlashcardCorrectAnswer(toks.join(' '));
    setFlashcardStageCorrect(isCorrect);
    setFlashcardStageAnswered(true);
    setFlashcardTimedOut(false);
    setFlashcardStageResults((prev) => ({ ...prev, rearrange: isCorrect }));
    playFlashcardFeedbackSfx(isCorrect);
  }, [
    currentCard,
    flashcardRearrangeAssembled,
    flashcardRearrangeCorrect,
    flashcardRearrangeTokens,
    flashcardStage,
    flashcardStageAnswered,
    playFlashcardFeedbackSfx,
  ]);

  const handleTypingSubmit = useCallback(() => {
    if (!currentCard || flashcardStageAnswered || flashcardStage !== 'typing') return;
    if (!flashcardTypedAnswer.trim()) return;

    const correct = normalizeOptionText(currentCard?.vocabulary);
    const isCorrect = compareTypingAnswer(flashcardTypedAnswer, correct);

    setFlashcardSelectedAnswer(flashcardTypedAnswer.trim());
    setFlashcardCorrectAnswer(correct);
    setFlashcardStageCorrect(isCorrect);
    setFlashcardStageAnswered(true);
    setFlashcardTimedOut(false);
    setFlashcardStageResults((prev) => ({ ...prev, typing: isCorrect }));
    playFlashcardFeedbackSfx(isCorrect);
  }, [currentCard, flashcardStage, flashcardStageAnswered, flashcardTypedAnswer, playFlashcardFeedbackSfx]);

  const handleRearrangeTapToken = useCallback((tokenId) => {
    if (flashcardStageAnswered || flashcardRearrangeAssembled.includes(tokenId)) return;
    setFlashcardRearrangeAssembled((prev) => [...prev, tokenId]);
  }, [flashcardRearrangeAssembled, flashcardStageAnswered]);

  const handleRearrangeRemoveAt = useCallback((index) => {
    if (flashcardStageAnswered) return;
    setFlashcardRearrangeAssembled((prev) => prev.filter((_, i) => i !== index));
  }, [flashcardStageAnswered]);

  const handleRearrangeBackspace = useCallback(() => {
    if (flashcardStageAnswered) return;
    setFlashcardRearrangeAssembled((prev) => prev.slice(0, -1));
  }, [flashcardStageAnswered]);

  const handleRearrangeReset = useCallback(() => {
    if (flashcardStageAnswered) return;
    setFlashcardRearrangeAssembled([]);
  }, [flashcardStageAnswered]);

  const handleCardTimeout = useCallback(() => {
    if (!gameActive || !currentCard || flashcardStageAnswered) return;

    setFlashcardTimedOut(true);
    setFlashcardSelectedAnswer('');
    setFlashcardStageCorrect(false);
    setFlashcardStageAnswered(true);
    playFlashcardWrongSfx(flashcardSfxRef.current);

    if (flashcardStage === 'rearrange') {
      const toks = sentenceTokens(currentCard);
      setFlashcardCorrectAnswer(toks.join(' '));
      setFlashcardStageResults((prev) => ({ ...prev, rearrange: false }));
      return;
    }

    if (flashcardStage === 'typing') {
      setFlashcardCorrectAnswer(normalizeOptionText(currentCard?.vocabulary));
      setFlashcardStageResults((prev) => ({ ...prev, typing: false }));
      return;
    }

    const field = flashcardStage === 'pinyin' ? 'pinyin' : 'th';
    const correctAnswer = normalizeOptionText(currentCard?.[field]);
    setFlashcardCorrectAnswer(correctAnswer);
    if (flashcardStage === 'pinyin') {
      setFlashcardStageResults((prev) => ({ ...prev, pinyin: false }));
      applyCardEntryPenalty(currentCard); // หมดเวลาช่วงแรก = ถือว่าเริ่มตอบแล้ว → หักโทษ
    } else {
      setFlashcardStageResults((prev) => ({ ...prev, meaning: false }));
    }
  }, [applyCardEntryPenalty, currentCard, flashcardStage, flashcardStageAnswered, gameActive]);

  useEffect(() => {
    if (gameActive && gameQueue.length > 0 && !currentCard) {
      const nextCard = gameQueue[0];
      const firstStage = buildChoices('pinyin', nextCard);
      setCurrentCard(nextCard);
      setTimer(timerSetting);
      setFlashcardStage('pinyin');
      setFlashcardChoices(firstStage.choices);
      setFlashcardStageResults({ pinyin: null, meaning: null, rearrange: null, typing: null });
      setFlashcardRearrangeTokens([]);
      setFlashcardRearrangeAssembled([]);
      setFlashcardRearrangeCorrect('');
      setFlashcardTypedAnswer('');
      setFlashcardTimedOut(false);
      resetStageState();
    } else if (gameActive && gameQueue.length === 0 && !currentCard) {
      endFlashcardSession().then(async () => {
        // ตรวจซ้ำจาก Level จริงก่อนแจ้งว่าจบรอบ เพื่อซ่อมข้อมูลภารกิจ
        // กรณีเครือข่ายช้าหรือ event ของคำสุดท้ายบันทึกไม่ทัน
        if (user?.id) {
          try {
            await syncTodayMissionProgress(user.id);
          } catch (error) {
            console.error('sync mission after training:', error);
          }
        }
        setGameActive(false);
        setShowTrainingCompleteModal(true);
      });
    }
  }, [buildChoices, currentCard, endFlashcardSession, gameActive, gameQueue, resetStageState, timerSetting, user?.id]);

  // ออกจากหน้าเกมกลางคันโดยไม่ผ่านปุ่ม Cancel (เช่น ปุ่ม back ของมือถือ/เบราว์เซอร์) → ปิดเกมให้เรียบร้อย
  // ถ้าตอบช่วงแรกไปแล้ว คำถูกหักลง LV1 ไว้ก่อนแล้ว จึงหนีโทษไม่ได้เช่นกัน
  useEffect(() => {
    if (!gameActive || page === 'fc-play') return;
    cardPenaltyRef.current = null;
    endFlashcardSession();
    setGameActive(false);
    setCurrentCard(null);
    setGameQueue([]);
    if (user?.id) fetchInitialData(user.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, gameActive, endFlashcardSession, user?.id]);

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
    if (!gameActive || !currentCard || flashcardStageAnswered) return;
    if (timer !== 10) return;
    if (flashcardTimerWarnAtRef.current) return;
    flashcardTimerWarnAtRef.current = true;
    playFlashcardTimerWarnSfx(flashcardSfxRef.current);
  }, [timer, gameActive, currentCard, flashcardStageAnswered]);

  useEffect(() => {
    if (!gameActive || !currentCard || !flashcardStageAnswered || !flashcardStageCorrect) return;
    const timeoutId = setTimeout(() => {
      if (flashcardStage === 'pinyin') {
        moveToMeaningStage();
      } else if (flashcardStage === 'meaning') {
        advanceAfterMeaning();
      } else if (flashcardStage === 'typing') {
        advanceAfterTyping();
      } else if (flashcardStage === 'rearrange') {
        submitCurrentCard();
      }
    }, FLASHCARD_CORRECT_REVEAL_MS);
    return () => clearTimeout(timeoutId);
  }, [
    FLASHCARD_CORRECT_REVEAL_MS,
    advanceAfterMeaning,
    advanceAfterTyping,
    flashcardStage,
    flashcardStageAnswered,
    flashcardStageCorrect,
    gameActive,
    currentCard,
    moveToMeaningStage,
    submitCurrentCard,
  ]);

  // LV1/2/7 + คำผิด เล่นได้ทุกวัน; LV3-6 ใช้กุญแจวันละ 1 ด่าน แล้วเล่นด่านนั้นซ้ำได้ทั้งวัน
  const checkLevelAvailable = (lv) => {
    if (lv === 'mistakes' || lv <= 2 || lv === 7) return true;
    return isKeyLevelPlayableToday(lv, levelKeys);
  };

  const showLevelPlayPromptOnce = useCallback(() => {
    if (!user?.id) return;
    const noticeKey = `daily-unlocked-level-notice:${user.id}:${localDateKey()}`;
    if (localStorage.getItem(noticeKey) === 'shown') return;

    const playable = SCHEDULED_LEVEL_KEYS
      .map((key) => Number(key))
      .filter((lv) => checkLevelAvailable(lv));
    if (playable.length === 0) return;

    // บันทึกทันทีที่แสดง เพื่อไม่ให้เปิดแอปใหม่แล้ว Popup เด้งซ้ำในวันเดียวกัน
    localStorage.setItem(noticeKey, 'shown');
    setLevelPlayPrompt(playable);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, levelKeys]);

  const handleDailyWordsConfirm = useCallback(() => {
    const addedCount = dailyNewWords?.length || 0;
    setDailyNewWords(null);
    if (user?.id) fetchInitialData(user.id);
    const noticeKey = user?.id
      ? `daily-new-words-mission-notice:${user.id}:${localDateKey()}`
      : '';
    const alreadyShown = noticeKey && localStorage.getItem(noticeKey) === 'shown';
    if (noticeKey) localStorage.setItem(noticeKey, 'shown');
    if (alreadyShown) showLevelPlayPromptOnce();
    else setDailyMissionNotice({ addedCount });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, dailyNewWords, showLevelPlayPromptOnce]);

  const handleDailyMissionNoticeConfirm = useCallback(() => {
    setDailyMissionNotice(null);
    showLevelPlayPromptOnce();
  }, [showLevelPlayPromptOnce]);

  const handlePlayLevelFromPrompt = useCallback(async (level) => {
    setLevelPlayPrompt(null);
    await startLevelGame(level);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    try {
      if (flashcardSessionRef.current?.isActive()) {
        await flashcardSessionRef.current.end();
      }
      await supabase.auth.signOut();
      setUser(null);
      historyReadyRef.current = false;
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
      <button
        onClick={() => setIsMenuOpen(false)}
        className="absolute top-[calc(env(safe-area-inset-top)+1.5rem)] right-[max(1.5rem,env(safe-area-inset-right))] text-white text-4xl min-w-[44px] min-h-[44px] flex items-center justify-center"
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      >&times;</button>
      <div className="flex flex-col space-y-8 text-center text-white font-black italic text-2xl uppercase">
        <button onClick={() => {setPage('dashboard'); setIsMenuOpen(false);}}>🏠 Home</button>
        <button onClick={() => {setPage('statistics'); setIsMenuOpen(false);}}>📈 Statistics</button>
        <button onClick={() => {setPage('settings'); setIsMenuOpen(false);}}>⚙️ Setting</button>
        <button onClick={handleLogout} className="block text-red-400 pt-10 text-xl font-bold uppercase">🚪 Logout</button>
      </div>
    </div>
  );

  if (page === 'login') {
    return (
      <div className="app-shell app-shell--scroll bg-slate-100">
        <Login setPage={setPage} setUser={setUser} fetchInitialData={fetchInitialData} fetchUserSettings={fetchUserSettings} checkAndAddDailyWords={checkAndAddDailyWords} setDailyNewWords={setDailyNewWords} />
      </div>
    );
  }
  const shouldShowTopBar = page !== 'fc-play' && page !== 'dashboard' && page !== 'lucky-draw' && page !== 'battle';
  const isSelectWordsPage = page === 'select-words';
  const isHubPage = page === 'dashboard' || page === 'lucky-draw';
  const isCreamPage = page === 'fc-play' || page === 'fc-chars' || page === 'library' || page === 'statistics' || page === 'word-match';

  return (
    <div
      className={`app-shell font-sans w-full select-none ${
        isCreamPage
          ? 'bg-[#FBF4E6] text-slate-800 app-shell--scroll'
          : isHubPage ? 'bg-[#0a0e1a] text-white' : `bg-[#0a0e1a] text-white${isSelectWordsPage ? '' : ' app-shell--scroll'}`
      }`}
      style={{
        touchAction: 'pan-y',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
      }}
      onDragStart={(e) => {
        if (e.target.tagName === 'IMG') {
          e.preventDefault();
        }
      }}
    >
      {shouldShowTopBar && (
        <>
          <header className="px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 bg-[#0a0e1a]/90 backdrop-blur-md shadow-lg border-b-4 border-orange-500 flex justify-between items-center sticky top-0 z-40">
            <div className="flex flex-col min-w-0">
              <h1 className="font-black text-orange-600 text-xl uppercase italic tracking-tighter">Nihao Game</h1>
            </div>
            <button
              onClick={() => setIsMenuOpen(true)}
              className="relative z-50 shrink-0 min-w-[44px] min-h-[44px] w-12 h-11 bg-slate-800 text-white rounded-xl flex items-center justify-center text-2xl shadow-lg active:scale-90 transition-transform"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', cursor: 'pointer' }}
              aria-label="เปิดเมนู"
            >☰</button>
          </header>
          {isMenuOpen && <MenuOverlay />}
        </>
      )}

      {showTrainingCompleteModal && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="training-complete-title"
        >
          <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border-2 border-orange-300 bg-white text-center shadow-2xl">
            <div className="bg-gradient-to-br from-orange-400 to-orange-600 px-6 py-7 text-white">
              <div className="mb-2 text-6xl drop-shadow-lg" aria-hidden="true">🎉</div>
              <h2 id="training-complete-title" className="text-2xl font-black uppercase italic tracking-tight">
                ฝึกครบแล้ว!
              </h2>
            </div>
            <div className="px-6 py-6">
              <p className="text-base font-bold text-slate-700">จบช่วงการฝึกเรียบร้อยแล้ว</p>
              <p className="mt-1 text-sm text-slate-400">ความคืบหน้าของคำศัพท์ถูกบันทึกแล้ว</p>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setShowTrainingCompleteModal(false);
                  setPage('fc-chars');
                }}
                className="mt-6 w-full rounded-2xl bg-orange-500 py-3.5 text-lg font-black uppercase italic text-white shadow-lg shadow-orange-200 active:scale-95 transition-transform"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {appNoticeModal && (
        <div
          className="fixed inset-0 z-[135] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-notice-title"
        >
          <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border-2 border-orange-300 bg-white text-center shadow-2xl">
            <div className="bg-gradient-to-br from-slate-800 to-slate-950 px-6 py-7 text-white">
              <div className="mb-2 text-6xl drop-shadow-lg" aria-hidden="true">{appNoticeModal.icon}</div>
              <h2 id="app-notice-title" className="text-2xl font-black uppercase italic tracking-tight">
                {appNoticeModal.title}
              </h2>
            </div>
            <div className="px-6 py-6">
              <p className="text-base font-bold text-slate-700">{appNoticeModal.message}</p>
              <button
                type="button"
                autoFocus
                onClick={() => setAppNoticeModal(null)}
                className="mt-6 w-full rounded-2xl bg-orange-500 py-3.5 text-lg font-black uppercase italic text-white shadow-lg shadow-orange-200 active:scale-95 transition-transform"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily new-words popup — mandatory, cannot be dismissed without confirming */}
      {dailyNewWords && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-orange-500 px-6 pt-6 pb-4 text-center">
              <div className="text-5xl mb-2">🎉</div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tight">คำศัพท์ใหม่วันนี้!</h2>
              <p className="text-orange-100 text-sm font-bold mt-1">เพิ่ม {dailyNewWords.length} คำใหม่ใน Level 1 ให้แล้ว</p>
            </div>
            <div className="px-5 py-4 space-y-2">
              {dailyNewWords.map((word, i) => (
                <div key={word.id1} className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3">
                  <span className="text-orange-400 font-black text-xs w-4 shrink-0">{i + 1}.</span>
                  <span className="text-2xl font-black text-slate-800 shrink-0">{word.cn}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-orange-500 truncate">{word.pinyin}</span>
                    <span className="text-xs text-slate-500 truncate">{word.th}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={handleDailyWordsConfirm}
                className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black text-lg uppercase italic shadow-lg active:scale-95 transition-all"
              >
                ยืนยันเข้าเกม!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* แจ้งภารกิจต่อจากการรับคำศัพท์ประจำวัน */}
      {dailyMissionNotice && (
        <div className="fixed inset-0 z-[109] flex items-center justify-center bg-slate-950/85 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border-2 border-amber-300 bg-slate-900 text-white shadow-2xl">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-6 text-center">
              <div className="mb-2 text-6xl drop-shadow-lg">⭐</div>
              <h2 className="text-2xl font-black uppercase italic">ภารกิจประจำวัน</h2>
            </div>
            <div className="space-y-4 px-6 py-5 text-center">
              <p className="text-base font-black text-amber-300">
                เล่นคำศัพท์ใหม่ {dailyMissionNotice.addedCount} คำให้ไปถึง Level 3
              </p>
              <p className="text-sm leading-relaxed text-white/70">
                เล่นคำใหม่ที่เพิ่งได้รับให้สำเร็จครบทุกคำ เมื่อคำทั้งหมดขึ้นถึง Level 3 จะได้รับดาวภารกิจดวงแรก
              </p>
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3">
                <span className="text-2xl text-white/20">★</span>
                <span className="text-2xl text-white/20">★</span>
                <span className="text-2xl text-white/20">★</span>
                <span className="ml-2 text-xs font-black text-white/50">0 / 3 ดาว</span>
              </div>
            </div>
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={handleDailyMissionNoticeConfirm}
                className="w-full rounded-2xl bg-amber-400 py-4 text-lg font-black uppercase italic text-slate-900 shadow-lg active:scale-95 transition-all"
              >
                รับภารกิจ!
              </button>
            </div>
          </div>
        </div>
      )}

      {levelPlayPrompt && (
        <LevelPlayPrompt
          levels={levelPlayPrompt}
          levelCounts={levelCounts}
          onPlayLevel={handlePlayLevelFromPrompt}
          onDismiss={() => setLevelPlayPrompt(null)}
        />
      )}

      {/* Toast: ได้รับ Coin */}
      {lastCoinToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[80] bg-yellow-500 text-white px-5 py-2 rounded-full shadow-xl font-black text-sm italic animate-bounce">
          {lastCoinToast}
        </div>
      )}

      {/* Toast: ได้เพิ่มคำผิดไว้ใน list ให้แล้ว */}
      {wrongWordToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-xl font-black text-sm italic text-center max-w-[90%]">
          {wrongWordToast}
        </div>
      )}

      <main className={`app-main ${isHubPage ? 'app-main--hub' : isSelectWordsPage ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'} ${page === 'admin' ? 'mx-auto max-w-5xl p-4' : isHubPage ? 'p-0' : 'mx-auto max-w-md p-4 pb-10'}`} style={{ touchAction: 'pan-y' }}>
        {page === 'dashboard' && (
          <Dashboard
            setPage={setPage}
            user={user}
            gameState={gameState}
            isAdmin={isAdmin}
            refreshGameState={() => refreshGameState()}
            onLogout={handleLogout}
            schedules={schedules}
            levelKeys={levelKeys}
            levelCounts={levelCounts}
            onPlayLevel={startLevelGame}
          />
        )}
        {page === 'fc-chars' && <Flashcards setPage={setPage} levelCounts={levelCounts} schedules={schedules} levelKeys={levelKeys} checkLevelAvailable={checkLevelAvailable} startLevelGame={startLevelGame} />}
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
            rearrangeTokens={flashcardRearrangeTokens}
            rearrangeAssembled={flashcardRearrangeAssembled}
            onRearrangeTapToken={handleRearrangeTapToken}
            onRearrangeRemoveAt={handleRearrangeRemoveAt}
            onRearrangeBackspace={handleRearrangeBackspace}
            onRearrangeReset={handleRearrangeReset}
            onSubmitRearrange={handleRearrangeSubmit}
            typedAnswer={flashcardTypedAnswer}
            onTypingChange={setFlashcardTypedAnswer}
            onSubmitTyping={handleTypingSubmit}
          />
        )}
        {page === 'library' && <Library setPage={setPage} allMasterCards={allMasterCards} selectedIds={selectedIds} libraryDetail={libraryDetail} setLibraryDetail={setLibraryDetail} libFlipped={libFlipped} setLibFlipped={setLibFlipped} />}
        {page === 'word-match' && <WordMatchGame user={user} setPage={setPage} allMasterCards={allMasterCards} selectedIds={selectedIds} />}
        {page === 'score' && <Score user={user} selectedIds={selectedIds} levelCounts={levelCounts} setPage={setPage} />}
        {page === 'statistics' && <Statistics user={user} setPage={setPage} />}
        
        {(page === 'settings' || page === 'set-schedule') && (
          <Settings
            page={page}
            setPage={setPage}
            user={user}
            isAdmin={isAdmin}
            allMasterCards={allMasterCards}
            timerSetting={timerSetting} 
            setTimerSetting={setTimerSetting} 
            gameTimerSetting={gameTimerSetting}
            setGameTimerSetting={setGameTimerSetting}
            typeTimerSetting={typeTimerSetting}
            setTypeTimerSetting={setTypeTimerSetting}
            schedules={schedules}
            setSchedules={setSchedules}
            saveSettings={(t, g, type) => saveSettings(t, g, type)}
            saveSchedules={saveSchedules}
          />
        )}

        {/* --- GAMES: เลือกระดับความยาก --- */}
        {page === 'games' && (
          <DifficultySelect
            setPage={setPage}
            gameState={gameState}
            onSelectDifficulty={(diff) => { setActiveDifficulty(diff); setPage('games-stages'); }}
          />
        )}

        {/* --- GAMES Hub: เลือกด่าน --- */}
        {page === 'games-stages' && (
          <GamesHub
            setPage={setPage}
            user={user}
            gameState={gameState}
            stageProgress={stageProgress}
            difficulty={activeDifficulty}
            onBackToDifficulty={() => setPage('games')}
            onSelectStage={(stageNo) => { setActiveStage(stageNo); setPage('battle'); }}
          />
        )}

        {/* --- หน้าต่อสู้ --- */}
        {page === 'battle' && activeStage != null && (
          <BattleGame
            user={user}
            stageNo={activeStage}
            difficulty={activeDifficulty}
            alreadyWon={!!stageProgress[activeStage]?.[activeDifficulty]?.medal}
            selectedCharacterId={gameState.selectedCharacterId}
            equippedItemIds={gameState.equippedItemIds}
            allMasterCards={allMasterCards}
            onExit={() => { setPage('games-stages'); refreshGameState(); refreshStageProgress(); }}
            onReward={(reward) => {
              if (reward) setGameState(prev => ({ ...prev, ...reward }));
            }}
            onLevelUp={(updated) => {
              if (updated) setGameState(prev => ({ ...prev, ...updated }));
            }}
            onStageComplete={(stageNo, stats) => {
              const diff = stats.difficulty || activeDifficulty;
              if (user?.id) {
                saveStageProgress(user.id, stageNo, diff, stats).then((saved) => {
                  if (saved) {
                    setStageProgress(prev => ({
                      ...prev,
                      [stageNo]: { ...(prev[stageNo] || {}), [diff]: saved },
                    }));
                  }
                });
              } else {
                setStageProgress(prev => ({
                  ...prev,
                  [stageNo]: { ...(prev[stageNo] || {}), [diff]: stats },
                }));
              }
            }}
          />
        )}

        {/* --- Shop --- */}
        {page === 'shop' && (
          <Shop
            setPage={setPage}
            user={user}
            gameState={gameState}
            onStateChange={setGameState}
          />
        )}

        {/* --- Lucky Draw: สุ่มรางวัลประจำวัน --- */}
        {page === 'lucky-draw' && (
          <LuckyDraw
            setPage={setPage}
            user={user}
            gameState={gameState}
            refreshGameState={() => refreshGameState()}
          />
        )}

        {/* --- Admin Panel (เฉพาะ admin) --- */}
        {page === 'admin' && (
          <AdminPanel setPage={setPage} user={user} isAdmin={isAdmin} />
        )}
        
        {page === 'select-words' && (() => {
          const effectiveSelectedIds = isDragSelecting
            ? (dragSelectMode === 'add'
              ? [...new Set([...selectedIds, ...dragTouchedIds])]
              : selectedIds.filter(id => !dragTouchedIds.includes(id)))
            : selectedIds;
          return (
          <div className="flex flex-col flex-1 min-h-0 -mx-4 text-center select-none">
            {longPressDragActiveToast && (
              <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                <div className="bg-orange-500 text-white px-6 py-4 rounded-2xl shadow-xl font-black text-center text-sm animate-pulse max-w-[90%]">
                  โหมดลากเลือกเปิดแล้ว — ลากผ่านคำที่ต้องการ
                </div>
              </div>
            )}

            <div className="shrink-0 flex justify-between items-center px-4 py-2 bg-[#0a0e1a] border-b border-white/10 z-20">
              <button onClick={() => setPage('settings')} className="text-orange-500 font-black italic underline uppercase text-xs">← Back</button>
              <div className="flex flex-col items-end">
                <div className="bg-orange-600 text-white px-4 py-1 rounded-full font-black text-xs">Selected {selectedIds.length}</div>
                <span className="text-[10px] text-slate-400 mt-0.5">กดค้าง 2 วินาที แล้วลากเพื่อเลือกหลายคำ</span>
              </div>
            </div>

            <div
              ref={selectWordsContainerRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-10 space-y-4"
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
                      <div className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>{card?.cn || ''}</div>
                      <div className={`text-[9px] font-bold uppercase ${isSelected ? 'text-white' : 'text-slate-400'}`}>{card?.pinyin || ''}</div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-3 text-center text-slate-400 py-8">กำลังโหลดข้อมูล...</div>
              )}
            </div>
            </div>
          </div>
        );
        })()}
      </main>
    </div>
  );
}
