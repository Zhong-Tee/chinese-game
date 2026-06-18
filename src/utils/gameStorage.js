import { supabase } from '../supabaseClient';

// ค่าฐานของตัวละคร (ก่อนรวมอัปเกรด)
export const BASE_MAX_HP = 3;
export const BASE_ATTACK = 1;

// ---------------------------------------------------------------------
// EXP / Coin ต่อผู้ใช้
// ---------------------------------------------------------------------
export async function getGameState(userId) {
  if (!userId) return { exp: 0, coin: 0 };
  const { data, error } = await supabase
    .from('user_game_state')
    .select('exp, coin')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('getGameState error:', error);
    return { exp: 0, coin: 0 };
  }
  if (!data) {
    await supabase.from('user_game_state').insert([{ user_id: userId, exp: 0, coin: 0 }]);
    return { exp: 0, coin: 0 };
  }
  return { exp: data.exp || 0, coin: data.coin || 0 };
}

// เพิ่ม EXP/Coin แบบ atomic ผ่าน RPC
export async function addCurrency({ exp = 0, coin = 0 }) {
  const { data, error } = await supabase.rpc('add_game_currency', { p_exp: exp, p_coin: coin });
  if (error) {
    console.error('addCurrency error:', error);
    return null;
  }
  // RPC คืน row เดียว (อาจมาเป็น object หรือ array)
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { exp: row.exp || 0, coin: row.coin || 0 } : null;
}

// หักเงินเพื่อซื้อของ คืน true ถ้าสำเร็จ
export async function spendCurrency(currency, amount) {
  const { data, error } = await supabase.rpc('spend_game_currency', {
    p_currency: currency,
    p_amount: amount,
  });
  if (error) {
    console.error('spendCurrency error:', error);
    return false;
  }
  return data === true;
}

// ---------------------------------------------------------------------
// EXP reward config ต่อ LV
// ---------------------------------------------------------------------
let _expRewardsCache = null;
export async function getExpRewards(force = false) {
  if (_expRewardsCache && !force) return _expRewardsCache;
  const { data, error } = await supabase.from('exp_rewards').select('*');
  if (error) {
    console.error('getExpRewards error:', error);
    return {};
  }
  const map = {};
  (data || []).forEach(r => { map[r.flashcard_level] = r.exp_amount; });
  _expRewardsCache = map;
  return map;
}

export function clearExpRewardsCache() { _expRewardsCache = null; }

export async function getExpForLevel(level) {
  const map = await getExpRewards();
  return map[level] ?? 0;
}

// ---------------------------------------------------------------------
// Stage / config
// ---------------------------------------------------------------------
export async function getStages() {
  const { data, error } = await supabase
    .from('game_stages')
    .select('*')
    .order('stage_no', { ascending: true });
  if (error) {
    console.error('getStages error:', error);
    return [];
  }
  return data || [];
}

export async function getStageConfig(stageNo) {
  const [stageRes, bgRes, enemyRes, musicRes] = await Promise.all([
    supabase.from('game_stages').select('*').eq('stage_no', stageNo).maybeSingle(),
    supabase.from('game_backgrounds').select('*').eq('stage_no', stageNo),
    supabase.from('game_enemies').select('*').eq('stage_no', stageNo),
    supabase.from('game_music').select('*').eq('stage_no', stageNo),
  ]);
  return {
    stage: stageRes.data || null,
    backgrounds: bgRes.data || [],
    enemies: enemyRes.data || [],
    music: musicRes.data || [],
  };
}

export async function getSfxMap() {
  const { data, error } = await supabase.from('game_sfx').select('*');
  if (error) {
    console.error('getSfxMap error:', error);
    return {};
  }
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.audio_url; });
  return map;
}

// ---------------------------------------------------------------------
// Shop / inventory / upgrades
// ---------------------------------------------------------------------
export async function getShopItems() {
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('getShopItems error:', error);
    return [];
  }
  return data || [];
}

export async function getUserUpgrades(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('user_upgrades')
    .select('item_id, shop_items(*)')
    .eq('user_id', userId);
  if (error) {
    console.error('getUserUpgrades error:', error);
    return [];
  }
  return data || [];
}

export async function getUserItems(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('user_items')
    .select('item_id, quantity, shop_items(*)')
    .eq('user_id', userId)
    .gt('quantity', 0);
  if (error) {
    console.error('getUserItems error:', error);
    return [];
  }
  return data || [];
}

// คำนวณค่าตัวละครจริง = ฐาน + ผลรวมจาก upgrade ที่ซื้อ
export async function getCharacterStats(userId) {
  const upgrades = await getUserUpgrades(userId);
  let maxHp = BASE_MAX_HP;
  let attack = BASE_ATTACK;
  upgrades.forEach(u => {
    const item = u.shop_items;
    if (!item) return;
    if (item.effect_type === 'add_hp') maxHp += item.effect_value;
    if (item.effect_type === 'add_attack') attack += item.effect_value;
  });
  return { maxHp, attack };
}

// ซื้อของจาก shop คืน { ok, reason }
export async function purchaseItem(userId, item) {
  if (!userId || !item) return { ok: false, reason: 'invalid' };

  // upgrade ถาวร: ห้ามซื้อซ้ำ
  if (item.kind === 'upgrade') {
    const { data: existing } = await supabase
      .from('user_upgrades')
      .select('id')
      .eq('user_id', userId)
      .eq('item_id', item.id)
      .maybeSingle();
    if (existing) return { ok: false, reason: 'owned' };
  }

  const paid = await spendCurrency(item.currency, item.cost);
  if (!paid) return { ok: false, reason: 'insufficient' };

  if (item.kind === 'upgrade') {
    const { error } = await supabase
      .from('user_upgrades')
      .insert([{ user_id: userId, item_id: item.id }]);
    if (error) {
      console.error('purchaseItem upgrade error:', error);
      // คืนเงินถ้า insert ล้มเหลว
      await addCurrency({ [item.currency]: item.cost });
      return { ok: false, reason: 'error' };
    }
  } else {
    // item ใช้แล้วหมด: upsert quantity + 1
    const { data: existing } = await supabase
      .from('user_items')
      .select('quantity')
      .eq('user_id', userId)
      .eq('item_id', item.id)
      .maybeSingle();
    const newQty = (existing?.quantity || 0) + 1;
    const { error } = await supabase
      .from('user_items')
      .upsert({ user_id: userId, item_id: item.id, quantity: newQty }, { onConflict: 'user_id,item_id' });
    if (error) {
      console.error('purchaseItem item error:', error);
      await addCurrency({ [item.currency]: item.cost });
      return { ok: false, reason: 'error' };
    }
  }
  return { ok: true };
}

// ใช้ไอเทม 1 ชิ้น (ลด quantity)
export async function consumeItem(userId, itemId) {
  if (!userId || !itemId) return false;
  const { data: existing } = await supabase
    .from('user_items')
    .select('quantity')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (!existing || existing.quantity <= 0) return false;
  const newQty = existing.quantity - 1;
  const { error } = await supabase
    .from('user_items')
    .update({ quantity: newQty })
    .eq('user_id', userId)
    .eq('item_id', itemId);
  if (error) {
    console.error('consumeItem error:', error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------
// utility: สุ่ม element เดียวจาก array
// ---------------------------------------------------------------------
export function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}
