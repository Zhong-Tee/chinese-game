/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import {
  getShopItems,
  getUserUpgrades,
  getUserItems,
  purchaseItem,
  getGameState,
  getGameSettings,
  getStepCost,
  BASE_MAX_HP,
  BASE_ATTACK,
} from '../utils/gameStorage';
import CoinIcon from './CoinIcon';

const EFFECT_ICON = { add_hp: '❤️', add_attack: '⚔️', heal: '🧪', shield: '🛡️', add_time: '⏳', bomb: '💣' };

export default function Shop({ setPage, user, gameState = { exp: 0, coin: 0 }, onStateChange }) {
  const [items, setItems] = useState([]);
  const [ownedUpgrades, setOwnedUpgrades] = useState({}); // item_id -> qty ที่สะสมไว้
  const [inventory, setInventory] = useState({}); // item_id -> qty
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const [qtySel, setQtySel] = useState({}); // item_id -> จำนวนที่จะซื้อ
  const [caps, setCaps] = useState({ maxHpCap: Infinity, maxAttackCap: Infinity });

  const getQty = (id) => qtySel[id] || 1;
  const changeQty = (id, delta) => {
    setQtySel(prev => {
      const next = Math.min(99, Math.max(1, (prev[id] || 1) + delta));
      return { ...prev, [id]: next };
    });
  };

  const refresh = async () => {
    const [shop, ups, inv, settings] = await Promise.all([
      getShopItems(),
      getUserUpgrades(user?.id),
      getUserItems(user?.id),
      getGameSettings(true),
    ]);
    setItems(shop);
    setCaps(settings);
    const upMap = {};
    ups.forEach(u => { upMap[u.item_id] = u.quantity || 1; });
    setOwnedUpgrades(upMap);
    const invMap = {};
    inv.forEach(r => { invMap[r.item_id] = r.quantity; });
    setInventory(invMap);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  const handleBuy = async (item, count = 1) => {
    if (busyId) return;
    setBusyId(item.id);
    let bought = 0;
    let failReason = null;
    for (let i = 0; i < count; i++) {
      const res = await purchaseItem(user.id, item);
      if (res.ok) { bought++; }
      else { failReason = res.reason; break; }
    }
    if (bought > 0) {
      const state = await getGameState(user.id);
      onStateChange?.(state);
      await refresh();
      setQtySel(prev => ({ ...prev, [item.id]: 1 }));
    }
    if (bought === count) {
      showToast(count > 1 ? `ซื้อสำเร็จ! x${bought}` : 'ซื้อสำเร็จ!');
    } else if (bought > 0) {
      const why = failReason === 'maxed' ? 'ถึงเพดานแล้ว' : 'เงินไม่พอ';
      showToast(`ซื้อได้ ${bought}/${count} (${why})`);
    } else {
      const msg = failReason === 'insufficient' ? 'เงินไม่พอ'
        : failReason === 'owned' ? 'มีอยู่แล้ว'
        : failReason === 'maxed' ? 'อัปเกรดถึงเพดานแล้ว ไม่สามารถอัปเกรดเพิ่มได้'
        : 'ซื้อไม่สำเร็จ';
      showToast(msg);
    }
    setBusyId(null);
  };

  const upgrades = items.filter(i => i.kind === 'upgrade');
  const consumables = items.filter(i => i.kind === 'item');

  // ค่าพลังรวมปัจจุบันจากอัปเกรดถาวรที่มี (ฐาน + ผลรวม) เพื่อเช็คว่าถึงเพดานหรือยัง
  const curMaxHp = BASE_MAX_HP + upgrades.reduce(
    (sum, it) => sum + (it.effect_type === 'add_hp' ? (it.effect_value || 0) * (ownedUpgrades[it.id] || 0) : 0), 0);
  const curAttack = BASE_ATTACK + upgrades.reduce(
    (sum, it) => sum + (it.effect_type === 'add_attack' ? (it.effect_value || 0) * (ownedUpgrades[it.id] || 0) : 0), 0);

  // ราคารวมเมื่อซื้อ count ชิ้น (อัปเกรดคิดราคาขั้นบันไดต่อชิ้น)
  const totalCost = (item, count) => {
    if (item.kind === 'upgrade') {
      const owned = ownedUpgrades[item.id] || 0;
      let sum = 0;
      for (let i = 0; i < count; i++) sum += getStepCost(item, owned + i);
      return sum;
    }
    return (item.cost || 0) * count;
  };

  // อัปเกรดชิ้นนี้ถึงเพดานแล้วหรือยัง (ซื้อต่อไม่ได้)
  const isMaxed = (item) => {
    if (item.kind !== 'upgrade') return false;
    if (item.effect_type === 'add_hp') return curMaxHp >= caps.maxHpCap;
    if (item.effect_type === 'add_attack') return curAttack >= caps.maxAttackCap;
    return false;
  };

  const renderItem = (item) => {
    const isUpgrade = item.kind === 'upgrade';
    const ownedQty = isUpgrade ? (ownedUpgrades[item.id] || 0) : (inventory[item.id] || 0);
    const curIcon = item.currency === 'exp' ? '⭐' : <CoinIcon className="w-4 h-4" />;
    const buyCount = getQty(item.id);
    const ownedLabel = isUpgrade ? `ติดตั้งแล้ว x${ownedQty}` : `มีอยู่ x${ownedQty}`;
    const maxed = isMaxed(item);
    return (
      <div key={item.id} className={`bg-white/5 rounded-2xl border-2 shadow-sm p-3 flex items-center gap-3 ${maxed ? 'border-amber-400/40 bg-amber-500/10' : 'border-white/10'}`}>
        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl shrink-0">
          {item.icon_url ? <img src={item.icon_url} alt={item.name} className="w-9 h-9 object-contain" /> : (EFFECT_ICON[item.effect_type] || '🎁')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-white text-sm">{item.name}</div>
          <div className="text-[11px] text-white/50">{item.description}</div>
          {maxed
            ? <div className="text-[10px] font-black text-amber-300">⛔ ถึงเพดานสูงสุดแล้ว</div>
            : ownedQty > 0 && <div className="text-[10px] font-black text-emerald-400">{ownedLabel}</div>}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {maxed ? (
            <span className="px-3 py-1.5 rounded-xl font-black text-xs uppercase bg-amber-500/15 text-amber-300">เต็มแล้ว</span>
          ) : (
            <>
              <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
                <button
                  onClick={() => changeQty(item.id, -1)}
                  disabled={busyId === item.id || buyCount <= 1}
                  className="w-6 h-6 rounded-md bg-white/10 text-white font-black flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-40"
                >−</button>
                <span className="w-7 text-center font-black text-white text-sm">{buyCount}</span>
                <button
                  onClick={() => changeQty(item.id, 1)}
                  disabled={busyId === item.id || buyCount >= 99}
                  className="w-6 h-6 rounded-md bg-white/10 text-white font-black flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-40"
                >+</button>
              </div>
              <button
                onClick={() => handleBuy(item, buyCount)}
                disabled={busyId === item.id}
                className="px-3 py-1.5 rounded-xl font-black text-xs uppercase bg-orange-500 text-white active:scale-95 shadow inline-flex items-center gap-1 disabled:opacity-60"
              >
                {curIcon} {totalCost(item, buyCount)}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 pt-2 pb-12 select-none" style={{ touchAction: 'pan-y' }} onDragStart={(e) => e.preventDefault()}>
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[80] bg-white/10 backdrop-blur-md border border-white/15 text-white px-5 py-2 rounded-full shadow-xl font-black text-sm">{toast}</div>
      )}
      <div className="flex items-center justify-between">
        <button onClick={() => setPage('dashboard')} className="text-orange-400 font-black text-xs uppercase italic underline">← Back</button>
        <div className="flex gap-2">
          <span className="bg-emerald-500/15 text-emerald-300 px-3 py-1 rounded-full font-black text-xs">⭐ {gameState.exp ?? 0}</span>
          <span className="bg-yellow-500/15 text-yellow-300 px-3 py-1 rounded-full font-black text-xs inline-flex items-center gap-1"><CoinIcon className="w-4 h-4" /> {gameState.coin ?? 0}</span>
        </div>
      </div>

      <h2 className="text-3xl font-black text-center uppercase italic text-white tracking-tighter">🛒 Shop</h2>

      {loading ? (
        <div className="text-center text-white/40 py-10">กำลังโหลด...</div>
      ) : (
        <>
          <div>
            <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-2">อัปเกรดตัวละคร (ใช้ ⭐ EXP)</h3>
            <div className="space-y-2">
              {upgrades.length ? upgrades.map(renderItem) : <p className="text-white/40 text-sm italic">ยังไม่มีรายการ</p>}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-black text-yellow-400 uppercase tracking-widest mb-2 mt-4 inline-flex items-center gap-1">ไอเทมใช้ในด่าน (ใช้ <CoinIcon className="w-4 h-4" /> Coin)</h3>
            <div className="space-y-2">
              {consumables.length ? consumables.map(renderItem) : <p className="text-white/40 text-sm italic">ยังไม่มีรายการ</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
