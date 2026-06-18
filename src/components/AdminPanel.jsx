/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { clearExpRewardsCache } from '../utils/gameStorage';

const BUCKET = 'game-assets';
const STAGE_NOS = [1, 2, 3, 4, 5];
// อีโมจิ fallback ตาม effect ให้ตรงกับที่แสดงในร้าน/ตอนต่อสู้จริง
const EFFECT_ICON = { add_hp: '❤️', add_attack: '⚔️', heal: '🧪', shield: '🛡️' };
const SFX_KEYS = [
  { key: 'player_attack', label: 'ผู้เล่นโจมตี' },
  { key: 'enemy_attack', label: 'ศัตรูโจมตี' },
  { key: 'hit', label: 'โดนโจมตี' },
  { key: 'win', label: 'ชนะ' },
  { key: 'lose', label: 'แพ้' },
  { key: 'item', label: 'ใช้ไอเทม' },
];

async function uploadFile(file, folder) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

const Section = ({ title, children }) => (
  <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-sm p-5 space-y-4">
    <h3 className="text-base font-black text-slate-700 uppercase tracking-wide">{title}</h3>
    {children}
  </div>
);

const StagePicker = ({ value, onChange }) => (
  <div className="flex gap-2">
    {STAGE_NOS.map(n => (
      <button key={n} onClick={() => onChange(n)}
        className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-colors ${value === n ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
        ด่าน {n}
      </button>
    ))}
  </div>
);

// ปุ่มเลือกไฟล์ (ซ่อน input file ไว้ข้างใน label ที่ทำเป็นปุ่มกด)
const FileButton = ({ accept, onSelect, children, disabled, className = '' }) => (
  <label className={`inline-flex items-center justify-center gap-2 cursor-pointer bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-black text-sm uppercase shadow-md transition-colors active:scale-95 ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
    <span className="text-base">📁</span>
    <span>{children || 'เลือกไฟล์'}</span>
    <input type="file" accept={accept} disabled={disabled} className="hidden"
      onChange={e => { onSelect(e.target.files?.[0]); e.target.value = ''; }} />
  </label>
);

// ============ TAB: ด่าน + EXP ============
function StagesTab({ notify }) {
  const [stages, setStages] = useState([]);
  const [exp, setExp] = useState({});
  const [uploadingStage, setUploadingStage] = useState(null);

  const load = useCallback(async () => {
    const [s, e] = await Promise.all([
      supabase.from('game_stages').select('*').order('stage_no'),
      supabase.from('exp_rewards').select('*').order('flashcard_level'),
    ]);
    setStages(s.data || []);
    const map = {}; (e.data || []).forEach(r => { map[r.flashcard_level] = r.exp_amount; });
    setExp(map);
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveStage = async (st) => {
    const { error } = await supabase.from('game_stages').update({
      source_level: st.source_level, answer_time_sec: st.answer_time_sec,
      answer_time_rearrange_sec: st.answer_time_rearrange_sec,
      monster_count: st.monster_count, title: st.title,
    }).eq('stage_no', st.stage_no);
    notify(error ? 'บันทึกล้มเหลว' : 'บันทึกด่านแล้ว');
  };

  const uploadStageImage = async (stageNo, file) => {
    if (!file) return;
    setUploadingStage(stageNo);
    try {
      const url = await uploadFile(file, 'stage-maps');
      const { error } = await supabase.from('game_stages').update({ map_image_url: url }).eq('stage_no', stageNo);
      if (error) throw error;
      setStages(s => s.map(x => x.stage_no === stageNo ? { ...x, map_image_url: url } : x));
      notify('เปลี่ยนรูปด่านแล้ว');
    } catch (e) { notify('อัปโหลดล้มเหลว: ' + e.message); }
    setUploadingStage(null);
  };

  const removeStageImage = async (stageNo) => {
    const { error } = await supabase.from('game_stages').update({ map_image_url: null }).eq('stage_no', stageNo);
    if (!error) setStages(s => s.map(x => x.stage_no === stageNo ? { ...x, map_image_url: null } : x));
    notify(error ? 'ลบล้มเหลว' : 'ลบรูปด่านแล้ว');
  };

  const saveExp = async (lv, val) => {
    const { error } = await supabase.from('exp_rewards').upsert({ flashcard_level: lv, exp_amount: val }, { onConflict: 'flashcard_level' });
    clearExpRewardsCache();
    notify(error ? 'บันทึกล้มเหลว' : `บันทึก EXP LV${lv} แล้ว`);
  };

  return (
    <div className="space-y-4">
      <Section title="ตั้งค่าด่าน (รูป / เวลาตอบ / LV / มอนสเตอร์)">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {stages.map((st, idx) => (
            <div key={st.stage_no} className="border-2 border-slate-100 rounded-xl p-4 space-y-3">
              <div className="font-black text-orange-600 text-sm">ด่าน {st.stage_no}</div>

              {/* รูปด่าน (map icon) */}
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {st.map_image_url
                    ? <img src={st.map_image_url} alt="stage" className="w-full h-full object-cover" />
                    : <span className="text-2xl text-slate-300">🗺️</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <FileButton accept="image/*" onSelect={file => uploadStageImage(st.stage_no, file)} disabled={uploadingStage === st.stage_no} className="px-3 py-1.5 text-xs">
                    {uploadingStage === st.stage_no ? '...' : 'เปลี่ยนรูปด่าน'}
                  </FileButton>
                  {st.map_image_url && (
                    <button onClick={() => removeStageImage(st.stage_no)} className="text-xs text-red-500 font-black underline">ลบรูป</button>
                  )}
                </div>
              </div>

              <input className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="ชื่อด่าน"
                value={st.title || ''} onChange={e => setStages(s => s.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))} />
              <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-500">
                <label className="flex flex-col gap-1">ใช้คำ LV
                  <input type="number" min="1" max="7" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
                    value={st.source_level} onChange={e => setStages(s => s.map((x, i) => i === idx ? { ...x, source_level: +e.target.value } : x))} />
                </label>
                <label className="flex flex-col gap-1">มอนสเตอร์
                  <input type="number" min="1" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
                    value={st.monster_count} onChange={e => setStages(s => s.map((x, i) => i === idx ? { ...x, monster_count: +e.target.value } : x))} />
                </label>
                <label className="flex flex-col gap-1">เวลาเลือกตอบ (วิ)
                  <input type="number" min="1" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
                    value={st.answer_time_sec} onChange={e => setStages(s => s.map((x, i) => i === idx ? { ...x, answer_time_sec: +e.target.value } : x))} />
                </label>
                <label className="flex flex-col gap-1">เวลาเรียงประโยค (วิ)
                  <input type="number" min="1" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
                    value={st.answer_time_rearrange_sec ?? 12} onChange={e => setStages(s => s.map((x, i) => i === idx ? { ...x, answer_time_rearrange_sec: +e.target.value } : x))} />
                </label>
              </div>
              <button onClick={() => saveStage(st)} className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-black text-sm uppercase w-full transition-colors active:scale-95">บันทึก</button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="EXP ที่ได้ต่อ LV ของ Flashcards">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7].map(lv => (
            <div key={lv} className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-500 w-12">LV{lv}</span>
              <input type="number" min="0" className="flex-1 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={exp[lv] ?? 0} onChange={e => setExp(m => ({ ...m, [lv]: +e.target.value }))} />
              <button onClick={() => saveExp(lv, exp[lv] ?? 0)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase transition-colors active:scale-95">ตั้ง</button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ============ TAB: พื้นหลัง / เพลง (asset list ต่อด่าน) ============
function StageAssetsTab({ notify }) {
  const [stage, setStage] = useState(1);
  const [bgs, setBgs] = useState([]);
  const [music, setMusic] = useState([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (s) => {
    const [b, m] = await Promise.all([
      supabase.from('game_backgrounds').select('*').eq('stage_no', s),
      supabase.from('game_music').select('*').eq('stage_no', s),
    ]);
    setBgs(b.data || []); setMusic(m.data || []);
  }, []);
  useEffect(() => { load(stage); }, [stage, load]);

  const addBg = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, 'backgrounds');
      await supabase.from('game_backgrounds').insert({ stage_no: stage, image_url: url });
      await load(stage); notify('เพิ่มพื้นหลังแล้ว');
    } catch (e) { notify('อัปโหลดล้มเหลว: ' + e.message); }
    setUploading(false);
  };
  const addMusic = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, 'music');
      await supabase.from('game_music').insert({ stage_no: stage, music_url: url });
      await load(stage); notify('เพิ่มเพลงแล้ว');
    } catch (e) { notify('อัปโหลดล้มเหลว: ' + e.message); }
    setUploading(false);
  };
  const delBg = async (id) => { await supabase.from('game_backgrounds').delete().eq('id', id); await load(stage); };
  const delMusic = async (id) => { await supabase.from('game_music').delete().eq('id', id); await load(stage); };

  return (
    <div className="space-y-4">
      <StagePicker value={stage} onChange={setStage} />
      {uploading && <div className="text-center text-sm text-orange-500 font-black">กำลังอัปโหลด...</div>}

      <Section title={`พื้นหลังด่าน ${stage} (หลายรูปได้ สุ่มแสดง)`}>
        <FileButton accept="image/*" onSelect={addBg} disabled={uploading}>เลือกรูปพื้นหลัง</FileButton>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {bgs.map(b => (
            <div key={b.id} className="relative rounded-lg overflow-hidden border">
              <img src={b.image_url} alt="bg" className="w-full h-28 object-cover" />
              <button onClick={() => delBg(b.id)} className="absolute top-1 right-1 bg-red-500 text-white w-7 h-7 rounded-full text-base font-black shadow-md">×</button>
            </div>
          ))}
          {bgs.length === 0 && <p className="text-slate-400 text-sm col-span-full">ยังไม่มีพื้นหลัง</p>}
        </div>
      </Section>

      <Section title={`เพลงด่าน ${stage} (หลายเพลงได้ สุ่มเล่น)`}>
        <FileButton accept="audio/*" onSelect={addMusic} disabled={uploading}>เลือกไฟล์เพลง</FileButton>
        <ul className="space-y-2">
          {music.map(m => (
            <li key={m.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
              <audio src={m.music_url} controls className="h-9 flex-1" />
              <button onClick={() => delMusic(m.id)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-black transition-colors active:scale-95">ลบ</button>
            </li>
          ))}
          {music.length === 0 && <p className="text-slate-400 text-sm">ยังไม่มีเพลง</p>}
        </ul>
      </Section>
    </div>
  );
}

// ============ TAB: ศัตรู (Monster/Boss) ============
function EnemiesTab({ notify }) {
  const [stage, setStage] = useState(1);
  const [enemies, setEnemies] = useState([]);
  const [form, setForm] = useState({ type: 'monster', name: '', hp: 3, attack: 1, file: null });
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (s) => {
    const { data } = await supabase.from('game_enemies').select('*').eq('stage_no', s).order('type');
    setEnemies(data || []);
  }, []);
  useEffect(() => { load(stage); }, [stage, load]);

  const add = async () => {
    if (!form.file) { notify('เลือกรูปก่อน'); return; }
    setUploading(true);
    try {
      const url = await uploadFile(form.file, form.type === 'boss' ? 'bosses' : 'monsters');
      await supabase.from('game_enemies').insert({
        stage_no: stage, type: form.type, name: form.name || null,
        image_url: url, hp: form.hp, attack: form.attack,
      });
      setForm({ type: 'monster', name: '', hp: 3, attack: 1, file: null });
      await load(stage); notify('เพิ่มศัตรูแล้ว');
    } catch (e) { notify('ล้มเหลว: ' + e.message); }
    setUploading(false);
  };
  const editLocal = (id, patch) => setEnemies(list => list.map(x => x.id === id ? { ...x, ...patch } : x));
  const saveEnemy = async (en) => {
    const { error } = await supabase.from('game_enemies').update({
      type: en.type, name: en.name || null, hp: en.hp, attack: en.attack,
    }).eq('id', en.id);
    notify(error ? 'บันทึกล้มเหลว' : 'บันทึกศัตรูแล้ว');
  };
  const del = async (id) => { await supabase.from('game_enemies').delete().eq('id', id); await load(stage); };

  return (
    <div className="space-y-4">
      <StagePicker value={stage} onChange={setStage} />
      <Section title={`เพิ่มศัตรูในด่าน ${stage} (.png โปร่งใส)`}>
        <div className="flex gap-2">
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="border-2 border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="monster">Monster</option>
            <option value="boss">Boss</option>
          </select>
          <input className="flex-1 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="ชื่อ (ไม่บังคับ)"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-500">
          <label className="flex flex-col gap-1">HP
            <input type="number" min="1" className="border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-normal" value={form.hp} onChange={e => setForm(f => ({ ...f, hp: +e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">พลังโจมตี
            <input type="number" min="1" className="border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-normal" value={form.attack} onChange={e => setForm(f => ({ ...f, attack: +e.target.value }))} />
          </label>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <FileButton accept="image/png,image/*" onSelect={file => setForm(f => ({ ...f, file }))} disabled={uploading}>เลือกรูปศัตรู</FileButton>
          {form.file && <span className="text-sm text-slate-500 font-bold truncate max-w-[200px]">{form.file.name}</span>}
        </div>
        <button onClick={add} disabled={uploading} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-xl font-black text-sm uppercase w-full transition-colors active:scale-95 disabled:opacity-50">{uploading ? 'กำลังอัปโหลด...' : '+ เพิ่มศัตรู'}</button>
      </Section>

      <Section title="ศัตรูในด่านนี้">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {enemies.map(en => (
            <div key={en.id} className="flex flex-col gap-3 bg-slate-50 rounded-xl p-3">
              <div className="flex items-start gap-3">
                <img src={en.image_url} alt={en.name} className="w-16 h-16 object-contain shrink-0" />
                <div className="flex-1 grid grid-cols-3 gap-2 text-xs font-bold text-slate-500">
                  <label className="flex flex-col gap-1 col-span-1">ประเภท
                    <select value={en.type} onChange={e => editLocal(en.id, { type: e.target.value })} className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal">
                      <option value="monster">Monster</option>
                      <option value="boss">Boss</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 col-span-2">ชื่อ
                    <input className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal" placeholder="ชื่อ (ไม่บังคับ)"
                      value={en.name || ''} onChange={e => editLocal(en.id, { name: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1">HP
                    <input type="number" min="1" className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal" value={en.hp} onChange={e => editLocal(en.id, { hp: +e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1">พลังโจมตี
                    <input type="number" min="1" className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal" value={en.attack} onChange={e => editLocal(en.id, { attack: +e.target.value })} />
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveEnemy(en)} className="flex-1 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-black transition-colors active:scale-95">บันทึก</button>
                <button onClick={() => del(en.id)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-black transition-colors active:scale-95">ลบ</button>
              </div>
            </div>
          ))}
          {enemies.length === 0 && <p className="text-slate-400 text-sm">ยังไม่มีศัตรู</p>}
        </div>
      </Section>
    </div>
  );
}

// ============ TAB: SFX ============
function SfxTab({ notify }) {
  const [sfx, setSfx] = useState({});
  const [uploading, setUploading] = useState(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from('game_sfx').select('*');
    const map = {}; (data || []).forEach(r => { map[r.key] = r.audio_url; });
    setSfx(map);
  }, []);
  useEffect(() => { load(); }, [load]);

  const upload = async (key, file) => {
    if (!file) return;
    setUploading(key);
    try {
      const url = await uploadFile(file, 'sfx');
      await supabase.from('game_sfx').upsert({ key, audio_url: url }, { onConflict: 'key' });
      await load(); notify('บันทึกเสียงแล้ว');
    } catch (e) { notify('ล้มเหลว: ' + e.message); }
    setUploading(null);
  };

  return (
    <Section title="เสียง Fighting Sound Effects">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
        {SFX_KEYS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 border-b border-slate-100 py-3">
            <span className="text-sm font-black text-slate-600 w-24 shrink-0">{label}</span>
            {sfx[key] && <audio src={sfx[key]} controls className="h-8 flex-1 min-w-0" />}
            <FileButton accept="audio/*" onSelect={file => upload(key, file)} disabled={uploading === key} className="shrink-0 px-4 py-2">
              {uploading === key ? '...' : 'เลือกเสียง'}
            </FileButton>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ============ TAB: Shop items ============
function ShopTab({ notify }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', kind: 'upgrade', currency: 'exp', cost: 50, effect_type: 'add_hp', effect_value: 1, file: null });
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('shop_items').select('*').order('sort_order');
    setItems(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setUploading(true);
    try {
      let icon_url = null;
      if (form.file) icon_url = await uploadFile(form.file, 'items');
      await supabase.from('shop_items').insert({
        name: form.name, description: form.description, kind: form.kind,
        currency: form.currency, cost: form.cost, effect_type: form.effect_type,
        effect_value: form.effect_value, icon_url, sort_order: items.length + 1,
      });
      setForm({ name: '', description: '', kind: 'upgrade', currency: 'exp', cost: 50, effect_type: 'add_hp', effect_value: 1, file: null });
      await load(); notify('เพิ่มไอเทมแล้ว');
    } catch (e) { notify('ล้มเหลว: ' + e.message); }
    setUploading(false);
  };
  const toggleActive = async (it) => { await supabase.from('shop_items').update({ active: !it.active }).eq('id', it.id); await load(); };
  const editLocal = (id, patch) => setItems(list => list.map(x => x.id === id ? { ...x, ...patch } : x));
  const saveItem = async (it) => {
    let patch = {
      name: it.name, description: it.description, kind: it.kind,
      currency: it.currency, cost: it.cost, effect_type: it.effect_type, effect_value: it.effect_value,
    };
    try {
      if (it._file) patch.icon_url = await uploadFile(it._file, 'items');
      const { error } = await supabase.from('shop_items').update(patch).eq('id', it.id);
      if (error) throw error;
      await load(); notify('บันทึกไอเทมแล้ว');
    } catch (e) { notify('บันทึกล้มเหลว: ' + e.message); }
  };
  const del = async (id) => { await supabase.from('shop_items').delete().eq('id', id); await load(); };

  return (
    <div className="space-y-4">
      <Section title="เพิ่มไอเทม / อัปเกรด">
        <input className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="ชื่อ" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="คำอธิบาย" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-bold text-slate-500">
          <label className="flex flex-col gap-1">ประเภท
            <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value, currency: e.target.value === 'upgrade' ? 'exp' : 'coin' }))} className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal">
              <option value="upgrade">อัปเกรดถาวร</option>
              <option value="item">ไอเทมใช้แล้วหมด</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">สกุลเงิน
            <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal">
              <option value="exp">EXP</option>
              <option value="coin">Coin</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">ราคา
            <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: +e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">Effect
            <select value={form.effect_type} onChange={e => setForm(f => ({ ...f, effect_type: e.target.value }))} className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal">
              <option value="add_hp">เพิ่ม HP สูงสุด</option>
              <option value="add_attack">เพิ่มพลังโจมตี</option>
              <option value="heal">ฟื้น HP</option>
              <option value="shield">โล่ป้องกัน</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">ค่า Effect
            <input type="number" min="1" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal" value={form.effect_value} onChange={e => setForm(f => ({ ...f, effect_value: +e.target.value }))} />
          </label>
          <div className="flex flex-col gap-1">ไอคอน
            <div className="flex items-center gap-2">
              <FileButton accept="image/*" onSelect={file => setForm(f => ({ ...f, file }))}>เลือกไอคอน</FileButton>
              {form.file && <span className="text-xs text-slate-500 font-bold truncate max-w-[100px]">{form.file.name}</span>}
            </div>
          </div>
        </div>
        <button onClick={add} disabled={uploading || !form.name} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-xl font-black text-sm uppercase w-full transition-colors active:scale-95 disabled:opacity-50">{uploading ? 'กำลังบันทึก...' : '+ เพิ่ม'}</button>
      </Section>

      <Section title="รายการในร้าน">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map(it => (
            <div key={it.id} className={`flex flex-col gap-3 rounded-xl p-3 border-2 ${it.active ? 'bg-slate-50 border-slate-100' : 'bg-slate-200/60 border-slate-300'}`}>
              <div className="flex items-start gap-3">
                {it.icon_url ? <img src={it.icon_url} alt={it.name} className="w-12 h-12 object-contain shrink-0" /> : <span className="w-12 h-12 shrink-0 flex items-center justify-center text-3xl">{EFFECT_ICON[it.effect_type] || '🎁'}</span>}
                <div className="flex-1 min-w-0 space-y-2">
                  <input className="w-full border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold" placeholder="ชื่อ"
                    value={it.name || ''} onChange={e => editLocal(it.id, { name: e.target.value })} />
                  <input className="w-full border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm" placeholder="คำอธิบาย"
                    value={it.description || ''} onChange={e => editLocal(it.id, { description: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold text-slate-500">
                <label className="flex flex-col gap-1">ประเภท
                  <select value={it.kind} onChange={e => editLocal(it.id, { kind: e.target.value })} className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal">
                    <option value="upgrade">อัปเกรดถาวร</option>
                    <option value="item">ไอเทมใช้แล้วหมด</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">สกุลเงิน
                  <select value={it.currency} onChange={e => editLocal(it.id, { currency: e.target.value })} className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal">
                    <option value="exp">EXP</option>
                    <option value="coin">Coin</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">ราคา
                  <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal" value={it.cost} onChange={e => editLocal(it.id, { cost: +e.target.value })} />
                </label>
                <label className="flex flex-col gap-1">Effect
                  <select value={it.effect_type} onChange={e => editLocal(it.id, { effect_type: e.target.value })} className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal">
                    <option value="add_hp">เพิ่ม HP สูงสุด</option>
                    <option value="add_attack">เพิ่มพลังโจมตี</option>
                    <option value="heal">ฟื้น HP</option>
                    <option value="shield">โล่ป้องกัน</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">ค่า Effect
                  <input type="number" min="1" className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal" value={it.effect_value} onChange={e => editLocal(it.id, { effect_value: +e.target.value })} />
                </label>
                <div className="flex flex-col gap-1">ไอคอน
                  <FileButton accept="image/*" onSelect={file => editLocal(it.id, { _file: file })} className="px-3 py-1.5 text-xs">
                    {it._file ? 'เปลี่ยนแล้ว' : 'เลือกรูป'}
                  </FileButton>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveItem(it)} className="flex-1 bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-black transition-colors active:scale-95">บันทึก</button>
                <button onClick={() => toggleActive(it)} className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-black transition-colors active:scale-95">{it.active ? 'ปิด' : 'เปิด'}</button>
                <button onClick={() => del(it.id)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-black transition-colors active:scale-95">ลบ</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-slate-400 text-sm">ยังไม่มีไอเทม</p>}
        </div>
      </Section>
    </div>
  );
}

// ============ TAB: ตัวละคร ============
function CharactersTab({ notify }) {
  const [chars, setChars] = useState([]);
  const [form, setForm] = useState({ name: '', file: null });
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('game_characters').select('*').order('sort_order');
    setChars(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.file) { notify('เลือกรูปก่อน'); return; }
    if (!form.name.trim()) { notify('ใส่ชื่อตัวละครก่อน'); return; }
    setUploading(true);
    try {
      const url = await uploadFile(form.file, 'characters');
      await supabase.from('game_characters').insert({ name: form.name.trim(), image_url: url, sort_order: chars.length + 1 });
      setForm({ name: '', file: null });
      await load(); notify('เพิ่มตัวละครแล้ว');
    } catch (e) { notify('ล้มเหลว: ' + e.message); }
    setUploading(false);
  };
  const editLocal = (id, patch) => setChars(list => list.map(x => x.id === id ? { ...x, ...patch } : x));
  const saveChar = async (c) => {
    try {
      const patch = { name: c.name, sort_order: c.sort_order, active: c.active };
      if (c._file) patch.image_url = await uploadFile(c._file, 'characters');
      const { error } = await supabase.from('game_characters').update(patch).eq('id', c.id);
      if (error) throw error;
      await load(); notify('บันทึกตัวละครแล้ว');
    } catch (e) { notify('บันทึกล้มเหลว: ' + e.message); }
  };
  const del = async (id) => { await supabase.from('game_characters').delete().eq('id', id); await load(); };

  return (
    <div className="space-y-4">
      <Section title="เพิ่มตัวละคร">
        <input className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="ชื่อตัวละคร"
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <div className="flex items-center gap-3 flex-wrap">
          <FileButton accept="image/*" onSelect={file => setForm(f => ({ ...f, file }))} disabled={uploading}>เลือกรูปตัวละคร</FileButton>
          {form.file && <span className="text-sm text-slate-500 font-bold truncate max-w-[200px]">{form.file.name}</span>}
        </div>
        <button onClick={add} disabled={uploading} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-xl font-black text-sm uppercase w-full transition-colors active:scale-95 disabled:opacity-50">{uploading ? 'กำลังอัปโหลด...' : '+ เพิ่มตัวละคร'}</button>
      </Section>

      <Section title="ตัวละครทั้งหมด">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {chars.map(c => (
            <div key={c.id} className={`flex flex-col gap-3 rounded-xl p-3 border-2 ${c.active ? 'bg-slate-50 border-slate-100' : 'bg-slate-200/60 border-slate-300'}`}>
              <div className="flex items-start gap-3">
                <img src={c.image_url} alt={c.name} className="w-16 h-16 object-contain shrink-0 bg-white rounded-lg" />
                <div className="flex-1 grid grid-cols-2 gap-2 text-xs font-bold text-slate-500">
                  <label className="flex flex-col gap-1 col-span-2">ชื่อ
                    <input className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal"
                      value={c.name || ''} onChange={e => editLocal(c.id, { name: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1">ลำดับ
                    <input type="number" className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal"
                      value={c.sort_order} onChange={e => editLocal(c.id, { sort_order: +e.target.value })} />
                  </label>
                  <div className="flex flex-col gap-1">รูปใหม่
                    <FileButton accept="image/*" onSelect={file => editLocal(c.id, { _file: file })} className="px-3 py-1.5 text-xs">
                      {c._file ? 'เปลี่ยนแล้ว' : 'เลือกรูป'}
                    </FileButton>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveChar(c)} className="flex-1 bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-black transition-colors active:scale-95">บันทึก</button>
                <button onClick={() => editLocal(c.id, { active: !c.active })} className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-black transition-colors active:scale-95">{c.active ? 'ปิด' : 'เปิด'}</button>
                <button onClick={() => del(c.id)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-black transition-colors active:scale-95">ลบ</button>
              </div>
            </div>
          ))}
          {chars.length === 0 && <p className="text-slate-400 text-sm">ยังไม่มีตัวละคร</p>}
        </div>
      </Section>
    </div>
  );
}

const TABS = [
  { id: 'stages', label: 'ด่าน/EXP' },
  { id: 'assets', label: 'พื้นหลัง/เพลง' },
  { id: 'characters', label: 'ตัวละคร' },
  { id: 'enemies', label: 'ศัตรู' },
  { id: 'sfx', label: 'เสียง' },
  { id: 'shop', label: 'ไอเทม' },
];

export default function AdminPanel({ setPage, isAdmin }) {
  const [tab, setTab] = useState('stages');
  const [toast, setToast] = useState(null);
  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  if (!isAdmin) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="text-5xl">🔒</div>
        <p className="text-slate-500 font-bold">เฉพาะผู้ดูแลระบบเท่านั้น</p>
        <button onClick={() => setPage('dashboard')} className="bg-orange-500 text-white px-6 py-2 rounded-xl font-black uppercase">กลับ</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2 pb-12">
      {toast && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[80] bg-slate-800 text-white px-5 py-2 rounded-full shadow-xl font-black text-sm">{toast}</div>}
      <div className="flex items-center justify-between">
        <button onClick={() => setPage('dashboard')} className="text-orange-600 font-black text-sm uppercase italic underline hover:text-orange-700">← Back</button>
        <h2 className="text-2xl font-black uppercase italic text-red-600">🛠️ Admin</h2>
        <span className="w-12" />
      </div>

      <div className="flex flex-wrap gap-2 pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full font-black text-sm transition-colors ${tab === t.id ? 'bg-red-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stages' && <StagesTab notify={notify} />}
      {tab === 'assets' && <StageAssetsTab notify={notify} />}
      {tab === 'characters' && <CharactersTab notify={notify} />}
      {tab === 'enemies' && <EnemiesTab notify={notify} />}
      {tab === 'sfx' && <SfxTab notify={notify} />}
      {tab === 'shop' && <ShopTab notify={notify} />}
    </div>
  );
}
