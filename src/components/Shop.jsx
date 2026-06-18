/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import {
  getShopItems,
  getUserUpgrades,
  getUserItems,
  purchaseItem,
  getGameState,
} from '../utils/gameStorage';
import CoinIcon from './CoinIcon';

const EFFECT_ICON = { add_hp: '❤️', add_attack: '⚔️', heal: '🧪', shield: '🛡️' };

export default function Shop({ setPage, user, gameState = { exp: 0, coin: 0 }, onStateChange }) {
  const [items, setItems] = useState([]);
  const [ownedUpgrades, setOwnedUpgrades] = useState([]); // item_id[]
  const [inventory, setInventory] = useState({}); // item_id -> qty
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const refresh = async () => {
    const [shop, ups, inv] = await Promise.all([
      getShopItems(),
      getUserUpgrades(user?.id),
      getUserItems(user?.id),
    ]);
    setItems(shop);
    setOwnedUpgrades(ups.map(u => u.item_id));
    const invMap = {};
    inv.forEach(r => { invMap[r.item_id] = r.quantity; });
    setInventory(invMap);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  const handleBuy = async (item) => {
    if (busyId) return;
    setBusyId(item.id);
    const res = await purchaseItem(user.id, item);
    if (res.ok) {
      const state = await getGameState(user.id);
      onStateChange?.(state);
      await refresh();
      showToast('ซื้อสำเร็จ!');
    } else {
      const msg = res.reason === 'insufficient' ? 'เงินไม่พอ'
        : res.reason === 'owned' ? 'มีอยู่แล้ว'
        : 'ซื้อไม่สำเร็จ';
      showToast(msg);
    }
    setBusyId(null);
  };

  const upgrades = items.filter(i => i.kind === 'upgrade');
  const consumables = items.filter(i => i.kind === 'item');

  const renderItem = (item) => {
    const owned = item.kind === 'upgrade' && ownedUpgrades.includes(item.id);
    const qty = inventory[item.id] || 0;
    const curIcon = item.currency === 'exp' ? '⭐' : <CoinIcon className="w-4 h-4" />;
    return (
      <div key={item.id} className="bg-white rounded-2xl border-2 border-slate-100 shadow-sm p-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-2xl shrink-0">
          {item.icon_url ? <img src={item.icon_url} alt={item.name} className="w-9 h-9 object-contain" /> : (EFFECT_ICON[item.effect_type] || '🎁')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-slate-800 text-sm">{item.name}</div>
          <div className="text-[11px] text-slate-500">{item.description}</div>
          {item.kind === 'item' && qty > 0 && <div className="text-[10px] font-black text-emerald-500">มีอยู่ x{qty}</div>}
        </div>
        <button
          onClick={() => handleBuy(item)}
          disabled={owned || busyId === item.id}
          className={`shrink-0 px-3 py-2 rounded-xl font-black text-xs uppercase ${owned ? 'bg-slate-200 text-slate-400' : 'bg-orange-500 text-white active:scale-95 shadow'}`}
        >
          {owned ? 'มีแล้ว' : <>{curIcon} {item.cost}</>}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4 pt-2 pb-12 select-none" style={{ touchAction: 'pan-y' }} onDragStart={(e) => e.preventDefault()}>
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[80] bg-slate-800 text-white px-5 py-2 rounded-full shadow-xl font-black text-sm">{toast}</div>
      )}
      <div className="flex items-center justify-between">
        <button onClick={() => setPage('dashboard')} className="text-orange-600 font-black text-xs uppercase italic underline">← Back</button>
        <div className="flex gap-2">
          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-black text-xs">⭐ {gameState.exp ?? 0}</span>
          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-black text-xs inline-flex items-center gap-1"><CoinIcon className="w-4 h-4" /> {gameState.coin ?? 0}</span>
        </div>
      </div>

      <h2 className="text-3xl font-black text-center uppercase italic text-slate-800 tracking-tighter">🛒 Shop</h2>

      {loading ? (
        <div className="text-center text-slate-400 py-10">กำลังโหลด...</div>
      ) : (
        <>
          <div>
            <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-2">อัปเกรดตัวละคร (ใช้ ⭐ EXP)</h3>
            <div className="space-y-2">
              {upgrades.length ? upgrades.map(renderItem) : <p className="text-slate-400 text-sm italic">ยังไม่มีรายการ</p>}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-black text-yellow-500 uppercase tracking-widest mb-2 mt-4 inline-flex items-center gap-1">ไอเทมใช้ในด่าน (ใช้ <CoinIcon className="w-4 h-4" /> Coin)</h3>
            <div className="space-y-2">
              {consumables.length ? consumables.map(renderItem) : <p className="text-slate-400 text-sm italic">ยังไม่มีรายการ</p>}
            </div>
          </div>
          <p className="text-center text-[11px] text-slate-400 italic px-4">ไอเทมที่ซื้อจะไปอยู่ในช่องด้านขวาตอนต่อสู้ (สูงสุด 3 ช่อง) ใช้แล้วหมดไป</p>
        </>
      )}
    </div>
  );
}
