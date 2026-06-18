import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getCharacters, setSelectedCharacter, getCharacterStats, getUserItems, setEquippedItems } from '../utils/gameStorage';

const EFFECT_ICON = { add_hp: '❤️', add_attack: '⚔️', heal: '🧪', shield: '🛡️' };

export default function Dashboard({ setPage, user, gameState = { exp: 0, coin: 0 }, isAdmin = false, refreshGameState }) {
  const [username, setUsername] = useState('');
  const [showCharModal, setShowCharModal] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [charLoaded, setCharLoaded] = useState(false);
  const [stats, setStats] = useState({ maxHp: 3, attack: 1 });
  const [savingId, setSavingId] = useState(null);
  const [ownedItems, setOwnedItems] = useState([]); // [{item_id, quantity, name, icon_url, effect_type}]
  const [savingEquip, setSavingEquip] = useState(false);

  useEffect(() => {
    const fetchUsername = async () => {
      if (!user?.id) return;

      try {
        // ดึงข้อมูล username จากตาราง profiles
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('username, display_name, email')
          .eq('user_id', user.id)
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
          const fallbackName = user.email ? user.email.split('@')[0] : user.user_metadata?.username || 'User';
          setUsername(fallbackName);
        }
      } catch (error) {
        console.error('Error fetching username:', error);
        // Fallback: ใช้ username จาก email
        const fallbackName = user?.email ? user.email.split('@')[0] : 'User';
        setUsername(fallbackName);
      }
    };

    fetchUsername();
  }, [user]);

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

  // โหลดรายชื่อตัวละครตั้งแต่ตอน mount เพื่อให้ avatar แสดงทันที
  // (ไม่ต้องรอเปิด modal) และจำได้เมื่อสลับเมนูแล้วกลับมา
  useEffect(() => {
    loadCharData();
  }, [loadCharData]);

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

  const equippedIds = Array.isArray(gameState.equippedItemIds) ? gameState.equippedItemIds : [];

  const toggleEquip = async (itemId) => {
    if (!user?.id || savingEquip) return;
    let next;
    if (equippedIds.includes(itemId)) {
      next = equippedIds.filter(id => id !== itemId);
    } else {
      if (equippedIds.length >= 3) return; // เต็ม 3 ช่องแล้ว
      next = [...equippedIds, itemId];
    }
    setSavingEquip(true);
    const ok = await setEquippedItems(user.id, next);
    setSavingEquip(false);
    if (ok && refreshGameState) await refreshGameState();
  };

  const selectedChar = characters.find(c => c.id === gameState.selectedCharacterId) || null;

  // ไม่ต้องมี {page === 'dashboard' && ...} เพราะเราเช็คเงื่อนไขนี้จากไฟล์ App.jsx แล้ว
  return (
    <div className="space-y-4">
      {/* การ์ดต้อนรับ — คลิกเพื่อเลือกตัวละคร / ดูค่า EXP, HP */}
      <button
        onClick={openCharModal}
        className="w-full bg-gradient-to-r from-orange-100 to-orange-200 rounded-2xl p-4 border-2 border-orange-300 shadow-sm flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
      >
        <div className="w-24 h-24 flex items-center justify-center overflow-hidden shrink-0">
          {!charLoaded ? (
            <span className="w-9 h-9 rounded-full border-2 border-orange-300 border-t-transparent animate-spin" />
          ) : selectedChar?.image_url ? (
            <img src={selectedChar.image_url} alt={selectedChar.name} className="w-full h-full object-contain scale-110" />
          ) : (
            <span className="text-5xl">🧑‍🎓</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-slate-600 uppercase">ยินดีต้อนรับ</div>
          <div className="text-2xl font-black text-orange-600 uppercase truncate">{username || 'User'}</div>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="bg-orange-500 text-white text-sm font-black px-3 py-1 rounded-full shadow uppercase tracking-tight">
            LV.{gameState.level ?? 1}
          </div>
          <span className="text-orange-400 text-lg leading-none">›</span>
        </div>
      </button>

      <div 
        className="grid grid-cols-2 gap-4 pt-2 pb-10 select-none"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
      >
      <button onClick={() => setPage('fc-chars')} className="h-36 bg-orange-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">🎴</span> Flashcards
      </button>
      <button onClick={() => setPage('games')} className="h-36 bg-emerald-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">⚔️</span> Games
      </button>
      <button onClick={() => setPage('library')} className="h-36 bg-purple-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">📚</span> Library
      </button>
      <button onClick={() => setPage('score')} className="h-36 bg-yellow-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">📊</span> Score
      </button>
      <button onClick={() => setPage('statistics')} className="h-36 bg-amber-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">📈</span> Statistics
      </button>
      <button onClick={() => setPage('shop')} className="h-36 bg-pink-500 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all">
        <span className="text-3xl">🛒</span> Shop
      </button>
      {isAdmin && (
        <button onClick={() => setPage('admin')} className="h-36 bg-red-600 text-white rounded-[2rem] shadow-xl font-black flex flex-col items-center justify-center gap-1 italic tracking-tighter uppercase text-sm transform active:scale-95 transition-all col-span-2">
          <span className="text-3xl">🛠️</span> Admin Panel
        </button>
      )}
      </div>

      {/* Modal: เลือกตัวละคร + ดูค่า EXP / HP */}
      {showCharModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-4"
          onClick={() => setShowCharModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-5 pt-5 pb-4 text-center relative">
              <button
                onClick={() => setShowCharModal(false)}
                className="absolute top-3 right-4 text-white/90 text-3xl leading-none"
              >
                &times;
              </button>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tight">ตัวละครของฉัน</h2>
            </div>

            {/* ค่าพลังปัจจุบัน */}
            <div className="grid grid-cols-3 gap-2 px-5 py-4 border-b border-slate-100">
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl py-2 text-center">
                <div className="text-[10px] font-black text-emerald-500 uppercase">EXP</div>
                <div className="text-lg font-black text-emerald-600 leading-none mt-0.5">⭐ {gameState.exp ?? 0}</div>
              </div>
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl py-2 text-center">
                <div className="text-[10px] font-black text-red-500 uppercase">HP</div>
                <div className="text-lg font-black text-red-600 leading-none mt-0.5">❤️ {stats.maxHp}</div>
              </div>
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl py-2 text-center">
                <div className="text-[10px] font-black text-amber-500 uppercase">ATK</div>
                <div className="text-lg font-black text-amber-600 leading-none mt-0.5">⚔️ {stats.attack}</div>
              </div>
            </div>

            <div className="overflow-y-auto">
            {/* ช่องอาวุธ 3 ช่อง — เลือกอาวุธที่จะนำไปต่อสู้ */}
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-xs font-black text-slate-500 uppercase mb-2">อาวุธที่จะนำไปต่อสู้ (สูงสุด 3 ช่อง)</div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[0, 1, 2].map(i => {
                  const id = equippedIds[i];
                  const it = ownedItems.find(o => o.item_id === id);
                  return (
                    <button
                      key={i}
                      onClick={() => it && toggleEquip(id)}
                      disabled={savingEquip || !it}
                      className={`relative rounded-2xl border-2 aspect-square flex flex-col items-center justify-center gap-0.5 transition-all ${it ? 'bg-orange-50 border-orange-400 active:scale-95' : 'bg-slate-50 border-dashed border-slate-300'}`}
                    >
                      {it ? (
                        <>
                          {it.icon_url
                            ? <img src={it.icon_url} alt={it.name} className="w-10 h-10 object-contain" />
                            : <span className="text-3xl">{EFFECT_ICON[it.effect_type] || '🎁'}</span>}
                          <span className="text-[9px] font-black text-slate-600 truncate w-full text-center px-1">{it.name}</span>
                          <span className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center shadow">×</span>
                        </>
                      ) : (
                        <span className="text-slate-300 text-3xl">+</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="text-[11px] font-black text-slate-400 uppercase mb-2">ไอเทมของฉัน — แตะเพื่อเลือก</div>
              {ownedItems.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-3">ยังไม่มีไอเทม — ซื้อได้ที่หน้า Shop</div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {ownedItems.map(o => {
                    const equipped = equippedIds.includes(o.item_id);
                    const full = !equipped && equippedIds.length >= 3;
                    return (
                      <button
                        key={o.item_id}
                        onClick={() => toggleEquip(o.item_id)}
                        disabled={savingEquip || full}
                        className={`relative rounded-xl border-2 p-1.5 flex flex-col items-center gap-0.5 transition-all active:scale-95 ${equipped ? 'bg-orange-500 border-orange-600' : full ? 'bg-slate-100 border-slate-200 opacity-50' : 'bg-white border-slate-200'}`}
                        title={o.name}
                      >
                        {o.icon_url
                          ? <img src={o.icon_url} alt={o.name} className="w-7 h-7 object-contain" />
                          : <span className="text-xl">{EFFECT_ICON[o.effect_type] || '🎁'}</span>}
                        <span className={`text-[9px] font-black ${equipped ? 'text-white' : 'text-slate-400'}`}>x{o.quantity}</span>
                        {equipped && (
                          <span className="absolute -top-1.5 -right-1.5 bg-white text-orange-600 w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center shadow border border-orange-300">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* เลือกตัวละคร */}
            <div className="px-5 py-4">
              <div className="text-xs font-black text-slate-500 uppercase mb-2">เลือกตัวละคร</div>
              {characters.length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-6">
                  ยังไม่มีตัวละคร — ให้ admin เพิ่มในหน้า Admin Panel ก่อน
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {characters.map(c => {
                    const isSelected = c.id === gameState.selectedCharacterId;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCharacter(c.id)}
                        disabled={savingId === c.id}
                        className={`relative rounded-2xl border-2 p-2 flex flex-col items-center gap-1 transition-all active:scale-95 ${isSelected ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-300' : 'bg-slate-50 border-slate-200'}`}
                      >
                        <div className="w-full aspect-square rounded-xl bg-white overflow-hidden flex items-center justify-center">
                          <img src={c.image_url} alt={c.name} className="w-full h-full object-contain" />
                        </div>
                        <span className="text-[10px] font-black text-slate-600 truncate w-full text-center">{c.name}</span>
                        {isSelected && (
                          <span className="absolute -top-2 -right-2 bg-orange-500 text-white w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shadow">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            </div>

            <div className="px-5 pb-5 pt-1 border-t border-slate-100">
              <button
                onClick={() => setShowCharModal(false)}
                className="w-full bg-orange-600 text-white py-3 rounded-2xl font-black uppercase italic shadow-lg active:scale-95 transition-all"
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
