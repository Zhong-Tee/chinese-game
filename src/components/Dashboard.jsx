import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  getCharacters, setSelectedCharacter, getCharacterStats, getUserItems,
  setEquippedItems, MAX_ITEM_CARRY, getLuckyDrawStatus,
} from '../utils/gameStorage';
import CoinIcon from './CoinIcon';
import GiftBox from './GiftBox';
import HubLevelScheduleBar from './HubLevelScheduleBar';
import { HubNavIcon } from './HubNavIcons';
import fightBtnImg from '../../game/icon/fight-btn.png';
import gameLogoImg from '../../game/word fighter.png?v=3';
import packageInfo from '../../package.json';
import { getDailyMissionCompletion, localDateKey, syncTodayMissionProgress } from '../utils/dailyMissionStorage';

const EFFECT_ICON = { add_hp: '❤️', add_attack: '⚔️', heal: '🧪', shield: '🛡️', add_time: '⏳', bomb: '💣' };

const MODE_BUTTONS = [
  { page: 'games', label: 'Battle', icon: '⚔️', grad: 'from-red-500 to-red-700' },
  { page: 'library', label: 'Library', icon: '📚', grad: 'from-orange-400 to-orange-600' },
  { page: 'fc-chars', label: 'Flashcards', icon: '🎴', grad: 'from-emerald-400 to-emerald-600' },
  { page: 'statistics', label: 'Stats', icon: '📈', grad: 'from-cyan-400 to-cyan-600' },
  { page: 'shop', label: 'Shop', icon: '🛒', grad: 'from-pink-400 to-pink-600' },
  { page: 'lucky-draw', label: 'Lucky', icon: '🎁', grad: 'from-purple-400 to-purple-600' },
];

const BOTTOM_NAV = [
  { id: 'home', label: 'Home', icon: '🏠', action: 'home' },
  { id: 'hero', label: 'Hero', icon: '🧑', action: 'hero' },
  { id: 'shop', label: 'Shop', icon: '🛒', action: 'shop' },
  { id: 'stats', label: 'Stats', icon: '📊', action: 'statistics' },
  { id: 'settings', label: 'More', icon: '⚙️', action: 'settings' },
];

export default function Dashboard({
  setPage,
  user,
  gameState = { exp: 0, coin: 0 },
  isAdmin = false,
  refreshGameState,
  onLogout,
  schedules = { lv3: [], lv4: [], lv5: [], lv6: [] },
  levelKeys = {},
  levelCounts = {},
  onPlayLevel,
}) {
  const [username, setUsername] = useState('');
  const [showCharModal, setShowCharModal] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [charLoaded, setCharLoaded] = useState(false);
  const [stats, setStats] = useState({ maxHp: 3, attack: 1 });
  const [savingId, setSavingId] = useState(null);
  const [ownedItems, setOwnedItems] = useState([]);
  const [savingEquip, setSavingEquip] = useState(false);
  const [luckyPending, setLuckyPending] = useState(false);
  const [dailyMission, setDailyMission] = useState(null);
  const [missionToast, setMissionToast] = useState(null);
  const [missionCollapsed, setMissionCollapsed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const applyMission = (mission) => {
      if (!alive) return;
      setDailyMission(mission);
      if (!mission) return;
      const completeStates = getDailyMissionCompletion(mission);
      const completed = completeStates.filter(Boolean).length;
      const storageKey = `daily-mission-stars:${user.id}:${localDateKey()}`;
      const previous = Number(sessionStorage.getItem(storageKey));
      if (Number.isFinite(previous) && completed > previous) {
        const gained = completed - previous;
        setMissionToast(`ภารกิจสำเร็จ! ได้รับดาว ${gained} ดวง ⭐`);
        setTimeout(() => setMissionToast(null), 3500);
      }
      sessionStorage.setItem(storageKey, String(completed));
    };
    const refresh = () => syncTodayMissionProgress(user.id).then(applyMission).catch((error) => console.error('dashboard daily mission:', error));
    const onMissionUpdated = (event) => applyMission(event.detail);
    refresh();
    window.addEventListener('daily-mission-updated', onMissionUpdated);
    window.addEventListener('focus', refresh);
    const intervalId = setInterval(refresh, 5000);
    return () => {
      alive = false;
      clearInterval(intervalId);
      window.removeEventListener('daily-mission-updated', onMissionUpdated);
      window.removeEventListener('focus', refresh);
    };
  }, [user?.id]);

  useEffect(() => {
    const fetchUsername = async () => {
      if (!user?.id) return;
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('username, display_name, email')
          .eq('user_id', user.id)
          .single();
        if (!error && profile) {
          let displayName = profile.username;
          if (!displayName || displayName.trim() === '') {
            if (profile.display_name && !profile.display_name.includes('@')) {
              displayName = profile.display_name;
            } else {
              displayName = profile.email ? profile.email.split('@')[0] : null;
            }
          }
          if (!displayName || displayName.trim() === '') displayName = profile.email || 'User';
          setUsername(displayName);
        } else {
          setUsername(user.email ? user.email.split('@')[0] : user.user_metadata?.username || 'User');
        }
      } catch {
        setUsername(user?.email ? user.email.split('@')[0] : 'User');
      }
    };
    fetchUsername();
  }, [user]);

  useEffect(() => {
    getLuckyDrawStatus().then(s => { if (s.ok) setLuckyPending(!s.claimedToday); }).catch(() => {});
  }, [user?.id]);

  const loadCharData = useCallback(async () => {
    const [chars, st, inv] = await Promise.all([
      getCharacters(),
      getCharacterStats(user?.id),
      getUserItems(user?.id),
    ]);
    setCharacters(chars);
    setStats(st);
    setOwnedItems((inv || []).map(r => ({
      item_id: r.item_id,
      quantity: r.quantity,
      name: r.shop_items?.name,
      icon_url: r.shop_items?.icon_url,
      effect_type: r.shop_items?.effect_type,
    })));
    setCharLoaded(true);
  }, [user?.id]);

  useEffect(() => { loadCharData(); }, [loadCharData]);

  const openCharModal = async () => {
    setShowCharModal(true);
    await loadCharData();
  };

  const handleSelectCharacter = async (charId) => {
    if (!user?.id) return;
    setSavingId(charId);
    const ok = await setSelectedCharacter(user.id, charId);
    setSavingId(null);
    if (ok && refreshGameState) await refreshGameState();
  };

  const rawEquippedIds = Array.isArray(gameState.equippedItemIds) ? gameState.equippedItemIds : [];
  const ownedIdSet = new Set(ownedItems.map(o => o.item_id));
  const equippedIds = rawEquippedIds.filter(id => ownedIdSet.has(id));

  useEffect(() => {
    if (!charLoaded || !user?.id || savingEquip) return;
    if (equippedIds.length !== rawEquippedIds.length) {
      setEquippedItems(user.id, equippedIds).then(ok => {
        if (ok && refreshGameState) refreshGameState();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charLoaded, ownedItems, gameState.equippedItemIds]);

  const toggleEquip = async (itemId) => {
    if (!user?.id || savingEquip) return;
    let next;
    if (equippedIds.includes(itemId)) next = equippedIds.filter(id => id !== itemId);
    else {
      if (equippedIds.length >= 3) return;
      next = [...equippedIds, itemId];
    }
    setSavingEquip(true);
    const ok = await setEquippedItems(user.id, next);
    setSavingEquip(false);
    if (ok && refreshGameState) await refreshGameState();
  };

  const selectedChar = characters.find(c => c.id === gameState.selectedCharacterId) || null;
  const coverUrl = selectedChar?.cover_url || null;
  const exp = gameState.exp ?? 0;
  const coin = gameState.coin ?? 0;
  const xpInLevel = exp % 100;
  const xpPct = Math.min(100, xpInLevel || (exp > 0 ? 100 : 8));

  const missionConfig = dailyMission?.config_snapshot || {};
  const reviewWordsAvailable = [3, 4, 5, 6]
    .reduce((total, level) => total + Number(levelCounts?.[level] || 0), 0);
  const missionRows = [];
  const addMissionRow = ({ star, label, done, total, waiting = false }) => {
    const safeDone = Math.max(0, Number(done) || 0);
    const safeTotal = Math.max(0, Number(total) || 0);
    const completed = safeTotal > 0 && safeDone >= safeTotal;
    missionRows.push({
      star,
      label,
      done: safeDone,
      total: safeTotal,
      waiting,
      completed,
      percent: safeTotal > 0 ? Math.min(100, Math.round((safeDone / safeTotal) * 100)) : 0,
    });
  };

  if ((dailyMission?.new_word_ids || []).length > 0) {
    addMissionRow({
      star: 1,
      label: 'คำใหม่ถึง LV3',
      done: (dailyMission.new_words_completed_ids || []).length,
      total: dailyMission.new_word_ids.length,
    });
  }

  const reviewIds = dailyMission?.review_word_ids || [];
  if (missionConfig.review_enabled !== false && (reviewIds.length > 0 || reviewWordsAvailable > 0)) {
    const waitingForLevel = reviewIds.length === 0;
    const estimatedTotal = missionConfig.review_mode === 'count'
      ? Math.min(reviewWordsAvailable, Math.max(1, Number(missionConfig.review_words_target) || 20))
      : 0;
    const activeTotal = missionConfig.review_mode === 'count'
      ? Math.min(reviewIds.length, Math.max(1, Number(missionConfig.review_words_target) || 20))
      : reviewIds.length;
    addMissionRow({
      star: 2,
      label: dailyMission?.review_level ? `ทบทวน LV${dailyMission.review_level}` : 'ทบทวน LV3–6',
      done: (dailyMission?.review_completed_ids || []).length,
      total: waitingForLevel ? estimatedTotal : activeTotal,
      waiting: waitingForLevel && estimatedTotal === 0,
    });
  }

  if ((dailyMission?.matching_card_ids || []).length > 0) {
    addMissionRow({
      star: 3,
      label: 'เกมจับคู่ประจำวัน',
      done: (dailyMission.matching_completed_ids || []).length,
      total: dailyMission.matching_card_ids.length,
    });
  }

  const handleBottomNav = (action) => {
    if (action === 'home') return;
    if (action === 'hero') { openCharModal(); return; }
    setPage(action);
  };

  return (
    <div className="hub-screen flex flex-col w-full h-full flex-1 min-h-0">
      {coverUrl && (
        <div className="hub-bg-cover" style={{ backgroundImage: `url(${coverUrl})` }} aria-hidden />
      )}
      <div className="hub-bg" style={{ opacity: coverUrl ? 0.2 : 1 }} />
      <div className="hub-scanlines" />

      {missionToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[120] rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-center text-sm font-black text-white shadow-2xl animate-bounce whitespace-nowrap">
          {missionToast}
        </div>
      )}

      {/* Top HUD */}
      <header className="relative z-20 px-3 sm:px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={openCharModal} className="relative shrink-0 active:scale-95 transition-transform">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-amber-400/80 overflow-hidden bg-slate-800 shadow-lg shadow-amber-500/20">
              {!charLoaded ? (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                </div>
              ) : selectedChar?.image_url ? (
                <img src={selectedChar.image_url} alt="" className="w-full h-full object-cover object-top scale-125" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🧑</div>
              )}
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-amber-300 whitespace-nowrap">
              LV.{gameState.level ?? 1}
            </span>
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-sm sm:text-base font-black truncate drop-shadow">{username || 'Player'}</div>
            <div className="hub-xp-bar mt-1 max-w-[220px] sm:max-w-xs">
              <div className="hub-xp-fill" style={{ width: `${xpPct}%` }} />
            </div>
            <div className="hub-stat-row max-w-[220px] sm:max-w-xs">
              <span className="highlight">EXP {exp}</span>
              <span>·</span>
              <span>HP {stats.maxHp}</span>
              <span>·</span>
              <span>ATK {stats.attack}</span>
              <span className="ml-auto text-white/40">{xpInLevel}/100</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hub-resource-pill text-amber-300">
              <CoinIcon className="w-4 h-4" /> {coin}
            </span>
            <span className="hub-resource-pill text-emerald-300">
              ⭐ {exp}
            </span>
            {isAdmin && (
              <button
                onClick={() => setPage('admin')}
                className="w-9 h-9 rounded-xl hub-glass flex items-center justify-center text-base active:scale-95"
                title="Admin"
              >
                🛠️
              </button>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-9 h-9 rounded-xl hub-glass flex items-center justify-center text-base active:scale-95 text-red-400"
                title="Logout"
                aria-label="Logout"
              >
                🚪
              </button>
            )}
          </div>
        </div>
        {missionRows.length > 0 && (
          <div
            className="mt-2 ml-auto block w-full max-w-[170px] rounded-2xl border border-amber-300/25 bg-slate-950/65 p-1.5 shadow-lg backdrop-blur-sm active:scale-[0.98] transition-transform"
          >
            <button
              type="button"
              onClick={() => setMissionCollapsed((current) => !current)}
              className={`flex w-full items-center justify-between gap-2 px-1 py-0.5 text-left ${missionCollapsed ? '' : 'mb-1'}`}
              aria-expanded={!missionCollapsed}
              aria-controls="daily-mission-progress"
            >
              <span className="text-[9px] font-black uppercase tracking-wider text-white/45">ภารกิจวันนี้</span>
              <span className="flex items-center gap-1.5">
                {missionCollapsed && (
                  <span className="flex items-center gap-0.5" aria-label="สถานะดาวภารกิจ 3 ดวง">
                    {getDailyMissionCompletion(dailyMission).map((completed, index) => (
                      <span
                        key={index}
                        className={`text-base leading-none ${completed ? 'text-amber-300 drop-shadow-[0_0_5px_rgba(251,191,36,0.9)]' : 'text-white/20 grayscale'}`}
                      >
                        ★
                      </span>
                    ))}
                  </span>
                )}
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs font-black text-white/60">
                  {missionCollapsed ? '⌄' : '⌃'}
                </span>
              </span>
            </button>
            {!missionCollapsed && (
              <button
                id="daily-mission-progress"
                type="button"
                onClick={() => setPage('statistics')}
                className="block w-full space-y-1.5 text-left"
                title="ดูภารกิจประจำวัน"
                aria-label="ดูความคืบหน้าภารกิจประจำวัน"
              >
                {missionRows.map((mission) => (
                  <span key={mission.star} className="flex items-center gap-1 rounded-xl bg-white/[0.06] px-1 py-1.5">
                    <span
                      className={`w-5 shrink-0 text-lg leading-none ${mission.completed ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.95)]' : 'text-white/20 grayscale'}`}
                      aria-label={`ดาวดวงที่ ${mission.star}${mission.completed ? ' สำเร็จแล้ว' : ''}`}
                    >
                      ★
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-[10px] font-black leading-none">
                        <span className="truncate text-white/75">{mission.label}</span>
                        <span className={mission.completed ? 'text-amber-300' : 'text-white/50'}>
                          {mission.waiting ? 'รอเปิด Level' : `${mission.done}/${mission.total}`}
                        </span>
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10">
                        <span
                          className={`block h-full rounded-full transition-all duration-500 ${mission.completed ? 'bg-amber-300' : 'bg-cyan-400'}`}
                          style={{ width: `${mission.percent}%` }}
                        />
                      </span>
                    </span>
                  </span>
                ))}
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main — เว้นพื้นที่กลางให้รูปปกตัวละคร */}
      <div className="hub-main-stage relative z-10 flex-1 min-h-0">
        {/* Lucky Draw + โลโก้ — มุมซ้ายล่าง ไม่บังตัวละครกลางจอ */}
        <div className="hub-lucky-anchor pointer-events-auto">
          <img
            src={gameLogoImg}
            alt="Word Fighter"
            className="hub-lucky-logo pointer-events-none select-none"
            draggable={false}
          />
          <HubLevelScheduleBar
            schedules={schedules}
            levelKeys={levelKeys}
            onPlayLevel={onPlayLevel}
          />
          <button
            onClick={() => setPage('lucky-draw')}
            className={`hub-lucky-premium hub-lucky-banner w-full text-left active:scale-[0.98] transition-transform ${luckyPending ? 'hub-lucky-premium-pending' : 'opacity-90'}`}
          >
            <GiftBox size="sm" animate={luckyPending} className="hub-lucky-banner__gift" />
            <div className="hub-lucky-banner__text">
              <div className="hub-lucky-banner__title">Lucky Draw</div>
              <div className="hub-lucky-banner__subtitle">
                {luckyPending ? (
                  <>
                    <span className="hub-lucky-banner__line hub-lucky-banner__line--wide">✨ เปิดกล่องวันนี้!</span>
                    <span className="hub-lucky-banner__line hub-lucky-banner__line--narrow">✨ เปิดวันนี้!</span>
                  </>
                ) : (
                  <>
                    <span className="hub-lucky-banner__line hub-lucky-banner__line--wide">กลับมาพรุ่งนี้</span>
                    <span className="hub-lucky-banner__line hub-lucky-banner__line--narrow">พรุ่งนี้</span>
                  </>
                )}
              </div>
            </div>
            {luckyPending && <span className="hub-badge hub-lucky-banner__badge">!</span>}
          </button>
        </div>

        {/* ปุ่มโหมด — ขวากึ่งกลางลงล่าง */}
        <div className="hub-action-rail pointer-events-auto">
          <div className="mb-1 text-center text-[10px] font-black uppercase tracking-widest text-white/55">
            Version {packageInfo.version}
          </div>
          {/* เมนูใหม่: เกมจับคู่คำศัพท์ — อยู่เหนือกริดเมนู (เหนือ Library) */}
          <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={() => setPage('class-schedule')}
            className="hub-mode-btn bg-gradient-to-br from-indigo-500 to-violet-700 flex flex-col items-center justify-center gap-1 py-2 active:scale-[0.97]"
            aria-label="ตารางเรียน"
          >
            <span className="hub-mode-icon drop-shadow-md">🗓️</span>
            <span className="hub-mode-label drop-shadow">ตารางเรียน</span>
          </button>
          <button
            onClick={() => setPage('word-match')}
            className="hub-mode-btn bg-gradient-to-br from-orange-500 to-pink-500 flex flex-col items-center justify-center gap-1 py-2 active:scale-[0.97]"
          >
            <span className="hub-mode-icon drop-shadow-md">🔗</span>
            <span className="hub-mode-label drop-shadow">จับคู่คำศัพท์</span>
          </button>
          </div>
          <div className="hub-mode-grid">
            {MODE_BUTTONS.map(btn => (
              <button
                key={btn.page}
                onClick={() => setPage(btn.page)}
                className={`hub-mode-btn hub-mode-btn-compact bg-gradient-to-br ${btn.grad} flex flex-col items-center justify-center gap-0.5 active:scale-[0.97]`}
              >
                <span className="hub-mode-icon drop-shadow-md">{btn.icon}</span>
                <span className="hub-mode-label drop-shadow">{btn.label}</span>
                {btn.page === 'lucky-draw' && luckyPending && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 border border-white animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom nav + FIGHT */}
      <div className="relative z-20 hub-bottom-nav px-2 sm:px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
        <div className="relative flex items-end justify-around w-full max-w-none px-1 sm:px-2">
          {BOTTOM_NAV.slice(0, 2).map(item => (
            <button
              key={item.id}
              onClick={() => handleBottomNav(item.action)}
              className="hub-nav-btn"
            >
              <HubNavIcon action={item.action} active={item.action === 'home'} />
              <span className={`hub-nav-btn-label ${item.action === 'home' ? 'active' : 'inactive'}`}>{item.label}</span>
            </button>
          ))}

          <button
            onClick={() => setPage('games')}
            className="hub-fight-btn relative -mt-5 sm:-mt-6 w-[4.5rem] h-[4.5rem] sm:w-[5rem] sm:h-[5rem] rounded-full p-0 overflow-hidden active:scale-95 transition-transform z-10"
            aria-label="Fight"
          >
            <img
              src={fightBtnImg}
              alt="Fight"
              className="w-full h-full object-cover pointer-events-none select-none"
              draggable={false}
            />
          </button>

          {BOTTOM_NAV.slice(2).map(item => (
            <button
              key={item.id}
              onClick={() => handleBottomNav(item.action)}
              className="hub-nav-btn"
            >
              <HubNavIcon action={item.action} active={false} />
              <span className="hub-nav-btn-label inactive">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Character modal */}
      {showCharModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setShowCharModal(false)}>
          <div className="hub-glass rounded-3xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-600/80 to-orange-600/80 px-5 pt-5 pb-4 text-center relative border-b border-white/10">
              <button onClick={() => setShowCharModal(false)} className="absolute top-3 right-4 text-white/90 text-3xl leading-none">&times;</button>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tight">ตัวละครของฉัน</h2>
            </div>

            <div className="grid grid-cols-3 gap-2 px-5 py-4 border-b border-white/10">
              {[
                { label: 'EXP', val: `⭐ ${gameState.exp ?? 0}`, color: 'text-emerald-400' },
                { label: 'HP', val: `❤️ ${stats.maxHp}`, color: 'text-red-400' },
                { label: 'ATK', val: `⚔️ ${stats.attack}`, color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="hub-glass rounded-2xl py-2 text-center">
                  <div className="text-[10px] font-black text-white/50 uppercase">{s.label}</div>
                  <div className={`text-lg font-black leading-none mt-0.5 ${s.color}`}>{s.val}</div>
                </div>
              ))}
            </div>

            <div className="overflow-y-auto">
              <div className="px-5 py-4 border-b border-white/10">
                <div className="text-xs font-black text-white/50 uppercase mb-2">อาวุธ (สูงสุด 3 • ชนิดละ {MAX_ITEM_CARRY})</div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[0, 1, 2].map(i => {
                    const id = equippedIds[i];
                    const it = ownedItems.find(o => o.item_id === id);
                    const carry = it ? Math.min(it.quantity, MAX_ITEM_CARRY) : 0;
                    return (
                      <button
                        key={i}
                        onClick={() => it && toggleEquip(id)}
                        disabled={savingEquip || !it}
                        className={`relative rounded-2xl border-2 aspect-square flex flex-col items-center justify-center gap-0.5 transition-all ${it ? 'hub-glass border-amber-400/50 active:scale-95' : 'border-dashed border-white/20 bg-white/5'}`}
                      >
                        {it ? (
                          <>
                            {it.icon_url
                              ? <img src={it.icon_url} alt={it.name} className="w-10 h-10 object-contain" />
                              : <span className="text-3xl">{EFFECT_ICON[it.effect_type] || '🎁'}</span>}
                            <span className="text-[9px] font-black text-white/70 truncate w-full text-center px-1">{it.name}</span>
                            <span className="absolute -bottom-1.5 -left-1.5 bg-amber-500 text-white min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-black flex items-center justify-center shadow">x{carry}</span>
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center shadow">×</span>
                          </>
                        ) : (
                          <span className="text-white/30 text-3xl">+</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="text-[11px] font-black text-white/40 uppercase mb-2">ไอเทมของฉัน</div>
                {ownedItems.length === 0 ? (
                  <div className="text-center text-white/40 text-xs py-3">ยังไม่มีไอเทม — ซื้อได้ที่ Shop</div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {ownedItems.map(o => {
                      const equipped = equippedIds.includes(o.item_id);
                      const full = !equipped && equippedIds.length >= 3;
                      return (
                        <button
                          key={o.item_id}
                          onClick={() => toggleEquip(o.item_id)}
                          disabled={savingEquip || full}
                          className={`relative rounded-xl border-2 p-1.5 flex flex-col items-center gap-0.5 transition-all active:scale-95 ${equipped ? 'bg-amber-500/30 border-amber-400' : full ? 'opacity-40 border-white/10' : 'hub-glass border-white/15'}`}
                          title={o.name}
                        >
                          {o.icon_url
                            ? <img src={o.icon_url} alt={o.name} className="w-7 h-7 object-contain" />
                            : <span className="text-xl">{EFFECT_ICON[o.effect_type] || '🎁'}</span>}
                          <span className={`text-[9px] font-black ${equipped ? 'text-amber-300' : 'text-white/50'}`}>x{o.quantity}</span>
                          {equipped && (
                            <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-900 w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center shadow">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="px-5 py-4">
                <div className="text-xs font-black text-white/50 uppercase mb-2">เลือกตัวละคร</div>
                {characters.length === 0 ? (
                  <div className="text-center text-white/40 text-sm py-6">ยังไม่มีตัวละคร</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {characters.map(c => {
                      const isSelected = c.id === gameState.selectedCharacterId;
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleSelectCharacter(c.id)}
                          disabled={savingId === c.id}
                          className={`relative rounded-2xl border-2 p-2 flex flex-col items-center gap-1 transition-all active:scale-95 ${isSelected ? 'border-amber-400 ring-2 ring-amber-400/40 bg-amber-500/10' : 'hub-glass border-white/15'}`}
                        >
                          <div className="w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center bg-black/20">
                            <img src={c.image_url} alt={c.name} className="w-full h-full object-contain" />
                          </div>
                          <span className="text-[10px] font-black text-white/70 truncate w-full text-center">{c.name}</span>
                          {isSelected && (
                            <span className="absolute -top-2 -right-2 bg-amber-400 text-slate-900 w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shadow">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pb-5 pt-1 border-t border-white/10">
              <button
                onClick={() => setShowCharModal(false)}
                className="w-full hub-fight-btn text-white py-3 rounded-2xl font-black uppercase italic active:scale-95 transition-all"
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
