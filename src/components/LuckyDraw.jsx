/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useRef, useState } from 'react';
import { getLuckyDrawStatus, claimLuckyDraw, getSfxMap } from '../utils/gameStorage';
import { playSfx } from '../utils/gameAudio';
import CoinIcon from './CoinIcon';
import GiftBox from './GiftBox';

const EFFECT_ICON = { add_hp: '❤️', add_attack: '⚔️', heal: '🧪', shield: '🛡️', add_time: '⏳', bomb: '💣' };

const TIER_INFO = {
  common: { label: 'ธรรมดา', ring: 'border-slate-300', text: 'text-slate-500', bg: 'bg-slate-100', glow: 'shadow-slate-300' },
  rare: { label: 'หายาก', ring: 'border-sky-400', text: 'text-sky-600', bg: 'bg-sky-50', glow: 'shadow-sky-300' },
  epic: { label: 'หายากมาก', ring: 'border-fuchsia-400', text: 'text-fuchsia-600', bg: 'bg-fuchsia-50', glow: 'shadow-fuchsia-300' },
};

// แสดงไอคอน + ข้อความของรางวัลหนึ่งชิ้น
function PrizeFace({ prize, size = 'sm' }) {
  const isCoin = (prize.rewardType || prize.reward_type) === 'coin';
  const iconUrl = prize.itemIconUrl || prize.shop_items?.icon_url || null;
  const effect = prize.itemEffectType || prize.shop_items?.effect_type;
  const coinClass = size === 'lg' ? 'w-10 h-10' : 'w-5 h-5';
  const imgClass = size === 'lg' ? 'w-14 h-14 object-contain' : 'w-7 h-7 object-contain';
  const emojiClass = size === 'lg' ? 'text-5xl' : 'text-2xl';
  if (isCoin) {
    return <CoinIcon className={coinClass} />;
  }
  if (iconUrl) return <img src={iconUrl} alt="" className={imgClass} />;
  return <span className={emojiClass}>{EFFECT_ICON[effect] || '🎁'}</span>;
}

export default function LuckyDraw({ setPage, user, gameState = { exp: 0, coin: 0 }, refreshGameState }) {
  const [loading, setLoading] = useState(true);
  const [claimedToday, setClaimedToday] = useState(false);
  const [streak, setStreak] = useState(0);
  const [epicCycle, setEpicCycle] = useState(7);

  const [boxState, setBoxState] = useState('idle'); // idle | opening | revealed | done
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const sfxRef = useRef({});

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  useEffect(() => {
    (async () => {
      const [status, sfx] = await Promise.all([getLuckyDrawStatus(), getSfxMap()]);
      sfxRef.current = sfx;
      setClaimedToday(status.claimedToday);
      setStreak(status.streak);
      setEpicCycle(status.epicCycle || 7);
      if (status.claimedToday) setBoxState('done');
      setLoading(false);
    })();
  }, [user?.id]);

  const handleOpen = async () => {
    if (busy || claimedToday) return;
    setBusy(true);
    setResult(null);
    setBoxState('opening');
    playSfx(sfxRef.current.lucky_draw);
    const start = Date.now();
    const res = await claimLuckyDraw();
    const wait = Math.max(0, 1300 - (Date.now() - start));
    setTimeout(() => {
      if (res.ok) {
        setResult(res);
        setStreak(res.streak);
        setClaimedToday(true);
        setBoxState('revealed');
        refreshGameState?.();
      } else if (res.alreadyClaimed) {
        setClaimedToday(true);
        setBoxState('done');
        showToast('วันนี้รับรางวัลไปแล้ว กลับมาใหม่พรุ่งนี้');
      } else {
        setBoxState('idle');
        showToast(res.error ? `เปิดไม่สำเร็จ: ${res.error}` : 'ยังไม่มีรางวัลในกล่อง ลองใหม่ภายหลัง');
      }
      setBusy(false);
    }, wait);
  };

  // ความคืบหน้าสู่รอบการันตี epic
  const cyclePos = epicCycle > 0 ? (streak % epicCycle) : 0;
  const daysToEpic = epicCycle > 0 ? ((epicCycle - cyclePos) % epicCycle || epicCycle) : 0;

  return (
    <div className="ld-screen flex flex-col w-full h-full flex-1 min-h-0 pb-[max(2rem,env(safe-area-inset-bottom))] select-none" style={{ touchAction: 'pan-y' }} onDragStart={(e) => e.preventDefault()}>
      <div className="ld-bg" />
      <style>{`
        @keyframes ld-pop { 0%{transform:scale(0.4);opacity:0} 60%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
        .ld-pop { animation: ld-pop 0.5s cubic-bezier(.18,.89,.32,1.28) both; }
      `}</style>

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] hub-glass text-white px-5 py-2 rounded-full shadow-xl font-black text-sm text-center max-w-[90%]">{toast}</div>
      )}

      <div className="relative z-10 px-4 pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between">
        <button onClick={() => setPage('dashboard')} className="hub-glass text-amber-300 font-black text-xs uppercase px-3 py-1.5 rounded-full active:scale-95">← Home</button>
        <div className="flex gap-2">
          <span className="hub-resource-pill text-emerald-300">⭐ {gameState.exp ?? 0}</span>
          <span className="hub-resource-pill text-amber-300 inline-flex items-center gap-1"><CoinIcon className="w-4 h-4" /> {gameState.coin ?? 0}</span>
        </div>
      </div>

      <div className="relative z-10 text-center px-4 pt-2 pb-4">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter bg-gradient-to-r from-purple-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">🎁 Lucky Draw</h2>
        <p className="text-xs font-bold text-purple-300/60 mt-1">เปิดกล่องสุ่มรับรางวัลฟรี — วันละ 1 ครั้ง</p>
      </div>

      {loading ? (
        <div className="relative z-10 text-center text-white/40 py-10">กำลังโหลด...</div>
      ) : (
        <div className="relative z-10 px-4 space-y-4 flex-1">
          {/* Streak */}
          <div className="hub-lucky-card rounded-2xl p-4 border border-purple-400/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔥</span>
                <div>
                  <div className="text-[11px] font-black text-orange-300/80 uppercase">รับต่อเนื่อง</div>
                  <div className="text-lg font-black text-orange-200 leading-none">{streak} วัน</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-black text-fuchsia-300/80 uppercase">การันตี 🟣 Epic</div>
                <div className="text-sm font-black text-fuchsia-200 leading-tight">อีก {daysToEpic} วัน</div>
              </div>
            </div>
            <div className="flex gap-1 mt-3">
              {Array.from({ length: epicCycle }).map((_, i) => (
                <div key={i} className={`h-2 flex-1 rounded-full ${i < cyclePos ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>

          {/* Mystery box */}
          <div className="hub-glass rounded-3xl py-10 flex flex-col items-center gap-5 hub-lucky-glow">
            <GiftBox
              size="lg"
              state={boxState === 'opening' ? 'opening' : claimedToday ? 'opened' : 'idle'}
              animate={!claimedToday && boxState !== 'opening'}
            />
            {claimedToday ? (
              <div className="text-center px-6">
                <div className="text-base font-black text-white/70">วันนี้รับรางวัลไปแล้ว 🎉</div>
                <div className="text-xs font-bold text-white/40 mt-1">รีเซ็ตเที่ยงคืน — กลับมาพรุ่งนี้!</div>
              </div>
            ) : (
              <button
                onClick={handleOpen}
                disabled={busy}
                className="hub-fight-btn px-10 py-3.5 rounded-2xl font-black text-lg uppercase italic text-white active:scale-95 transition-all disabled:opacity-60"
              >
                {busy ? 'กำลังเปิด...' : '✨ เปิดกล่อง!'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reveal modal */}
      {boxState === 'revealed' && result && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setBoxState('done')}>
          <div className="ld-pop hub-glass rounded-3xl shadow-2xl w-full max-w-xs overflow-hidden text-center border border-white/20" onClick={(e) => e.stopPropagation()}>
            <div className={`px-6 pt-6 pb-4 ${result.tier === 'epic' ? 'bg-gradient-to-r from-fuchsia-600/90 to-purple-700/90' : result.tier === 'rare' ? 'bg-gradient-to-r from-sky-600/90 to-blue-700/90' : 'bg-gradient-to-r from-slate-500/90 to-slate-600/90'}`}>
              <div className="text-xs font-black text-white/90 uppercase tracking-widest">
                {result.guaranteed ? '🔥 รางวัลการันตี!' : 'คุณได้รับ'}
              </div>
              <div className="text-lg font-black text-white uppercase italic mt-0.5">
                {TIER_INFO[result.tier]?.label || ''}
              </div>
            </div>
            <div className="px-6 py-6 flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-2xl hub-glass border border-white/15 flex items-center justify-center hub-lucky-glow">
                <PrizeFace prize={result} size="lg" />
              </div>
              <div className="text-2xl font-black text-white">
                {result.rewardType === 'coin'
                  ? <span className="inline-flex items-center gap-1.5"><CoinIcon className="w-7 h-7" /> +{result.coinAmount}</span>
                  : `${result.itemName || 'ไอเทม'} x${result.itemQty}`}
              </div>
            </div>
            <div className="px-5 pb-5">
              <button onClick={() => setBoxState('done')} className="w-full hub-fight-btn text-white py-3.5 rounded-2xl font-black text-lg uppercase italic active:scale-95 transition-all">
                เยี่ยม!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
