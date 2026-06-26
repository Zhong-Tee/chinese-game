/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  clearExpRewardsCache,
  createStage,
  deleteStage,
  getGameSettings,
  saveGameSettings,
  BASE_MAX_HP,
  BASE_ATTACK,
} from '../utils/gameStorage';

const BUCKET = 'game-assets';
// อีโมจิ fallback ตาม effect ให้ตรงกับที่แสดงในร้าน/ตอนต่อสู้จริง
const EFFECT_ICON = { add_hp: '❤️', add_attack: '⚔️', heal: '🧪', shield: '🛡️', add_time: '⏳', bomb: '💣' };
const SFX_KEYS = [
  { key: 'player_attack', label: 'ผู้เล่นโจมตี' },
  { key: 'enemy_attack', label: 'ศัตรูโจมตี' },
  { key: 'hit', label: 'โดนโจมตี' },
  { key: 'win', label: 'ชนะ' },
  { key: 'lose', label: 'แพ้' },
  { key: 'item', label: 'ใช้ไอเทม' },
  { key: 'lucky_draw', label: 'Lucky Draw' },
  { key: 'hub_music', label: 'เพลงหน้า Home' },
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

const StagePicker = ({ value, onChange }) => {
  const [stageNos, setStageNos] = useState([]);
  useEffect(() => {
    supabase.from('game_stages').select('stage_no').order('stage_no').then(({ data }) => {
      setStageNos((data || []).map(r => r.stage_no));
    });
  }, []);
  return (
    <div className="flex gap-2 flex-wrap">
      {stageNos.map(n => (
        <button key={n} onClick={() => onChange(n)}
          className={`py-2.5 px-4 rounded-xl font-black text-sm transition-colors ${value === n ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
          ด่าน {n}
        </button>
      ))}
    </div>
  );
};

// ไอคอนถังขยะ (ใช้กับปุ่มลบ)
const TrashIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
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

// ============ TAB: ด่าน (รายการ + แก้ไขรายละเอียด) ============
function StagesTab({ notify }) {
  const [stages, setStages] = useState([]);
  const [selectedNo, setSelectedNo] = useState(null); // ด่านที่กำลังแก้ไข (null = แสดงรายการ)
  const [uploadingStage, setUploadingStage] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('game_stages').select('*').order('stage_no');
    setStages(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveStage = async (st) => {
    const { error } = await supabase.from('game_stages').update({
      answer_time_sec: st.answer_time_sec,
      answer_time_rearrange_sec: st.answer_time_rearrange_sec,
      answer_time_typing_sec: st.answer_time_typing_sec,
      monster_count: st.monster_count, title: st.title,
      q_choice_count: st.q_choice_count ?? 20,
      q_typing_count: st.q_typing_count ?? 5,
      q_rearrange_count: st.q_rearrange_count ?? 5,
    }).eq('stage_no', st.stage_no);
    if (error) console.error('saveStage error:', error);
    notify(error ? `บันทึกล้มเหลว: ${error.message || error.code || 'unknown'}` : 'บันทึกด่านแล้ว');
  };

  const addStage = async () => {
    const created = await createStage();
    if (created) { await load(); setSelectedNo(created.stage_no); notify(`เพิ่มด่าน ${created.stage_no} แล้ว`); }
    else notify('เพิ่มด่านล้มเหลว');
  };

  const removeStage = async (stageNo) => {
    if (!window.confirm(`ลบด่าน ${stageNo}? (รูป/เพลง/ศัตรูของด่านนี้จะถูกลบด้วย)`)) return;
    const ok = await deleteStage(stageNo);
    if (ok) { await load(); setSelectedNo(null); notify(`ลบด่าน ${stageNo} แล้ว`); }
    else notify('ลบด่านล้มเหลว');
  };

  // จำนวนคำสะสมก่อนหน้าแต่ละด่าน เพื่อแสดงช่วงคำ (ด่านละ monster_count + 1 คำ)
  const wordStart = (idx) => stages.slice(0, idx).reduce((sum, s) => sum + (s.monster_count || 0) + 1, 0) + 1;

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
    if (!window.confirm('ลบรูปด่านนี้?')) return;
    const { error } = await supabase.from('game_stages').update({ map_image_url: null }).eq('stage_no', stageNo);
    if (!error) setStages(s => s.map(x => x.stage_no === stageNo ? { ...x, map_image_url: null } : x));
    notify(error ? 'ลบล้มเหลว' : 'ลบรูปด่านแล้ว');
  };

  const selectedIdx = stages.findIndex(s => s.stage_no === selectedNo);
  const st = selectedIdx >= 0 ? stages[selectedIdx] : null;

  // ---- มุมมองรายการด่าน ----
  if (selectedNo == null || !st) {
    return (
      <div className="space-y-4">
        <Section title="ตั้งค่าด่าน">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">{stages.length} ด่าน</span>
            <button onClick={addStage} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-black text-sm uppercase transition-colors active:scale-95">+ เพิ่มด่าน</button>
          </div>
          <div className="space-y-2">
            {stages.length === 0 ? (
              <div className="text-center text-slate-400 py-8 text-sm font-bold">ยังไม่มีด่าน — กด “เพิ่มด่าน” เพื่อสร้าง</div>
            ) : stages.map((s, idx) => {
              const start = wordStart(idx);
              const end = start + (s.monster_count || 0);
              return (
                <button
                  key={s.stage_no}
                  onClick={() => setSelectedNo(s.stage_no)}
                  className="group w-full flex items-center gap-3 bg-white border-2 border-b-4 border-slate-200 rounded-2xl p-3 text-left shadow-sm hover:border-orange-400 hover:bg-orange-50/50 hover:shadow-md transition-all active:translate-y-0.5 active:border-b-2"
                >
                  <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-orange-500 text-white text-lg font-black shadow">{s.stage_no}</div>
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {s.map_image_url
                      ? <img src={s.map_image_url} alt="stage" className="w-full h-full object-cover" />
                      : <span className="text-2xl text-slate-300">🗺️</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-slate-700 text-sm truncate group-hover:text-orange-600 transition-colors">{s.title || `ด่าน ${s.stage_no}`}</div>
                    <div className="text-[11px] font-bold text-emerald-600">คำที่ {start}–{end} ({(s.monster_count || 0) + 1} คำ)</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px]">
                      {[
                        ['มอนสเตอร์', s.monster_count ?? 0],
                        ['เวลาเลือกตอบ', `${s.answer_time_sec ?? 0} วิ`],
                        ['เวลาเรียงประโยค', `${s.answer_time_rearrange_sec ?? 12} วิ`],
                        ['เวลาพิมพ์', `${s.answer_time_typing_sec ?? 15} วิ`],
                        ['โจทย์ตัวเลือก', s.q_choice_count ?? 20],
                        ['โจทย์พิมพ์', s.q_typing_count ?? 5],
                        ['โจทย์เรียงคำ', s.q_rearrange_count ?? 5],
                      ].map(([label, val]) => (
                        <span key={label} className="whitespace-nowrap">
                          <span className="font-bold text-slate-400">{label} </span>
                          <span className="font-black text-slate-600">{val}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xl leading-none group-hover:bg-orange-500 group-hover:text-white transition-colors">›</span>
                </button>
              );
            })}
          </div>
        </Section>
      </div>
    );
  }

  // ---- มุมมองแก้ไขรายละเอียดด่าน ----
  const idx = selectedIdx;
  const start = wordStart(idx);
  const end = start + (st.monster_count || 0);
  return (
    <div className="space-y-4">
      <Section title={`ตั้งค่าด่าน ${st.stage_no}`}>
        <div className="flex items-center justify-between">
          <button onClick={() => setSelectedNo(null)} className="inline-flex items-center gap-1.5 bg-white border-2 border-b-4 border-orange-300 text-orange-600 px-4 py-2 rounded-xl font-black text-xs uppercase shadow-sm hover:bg-orange-50 hover:border-orange-400 transition-all active:translate-y-0.5 active:border-b-2">← รายการด่าน</button>
          <button onClick={() => removeStage(st.stage_no)} title="ลบด่าน" aria-label="ลบด่าน" className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors active:scale-95">
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-lg px-2 py-1">
          คำที่ {start}–{end} ({(st.monster_count || 0) + 1} คำ)
        </div>

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
              <button onClick={() => removeStageImage(st.stage_no)} title="ลบรูป" aria-label="ลบรูป" className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors active:scale-95 text-xs font-black">
                <TrashIcon className="w-4 h-4" /> ลบรูป
              </button>
            )}
          </div>
        </div>

        <input className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="ชื่อด่าน"
          value={st.title || ''} onChange={e => setStages(s => s.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))} />
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-500">
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
          <label className="flex flex-col gap-1">เวลาพิมพ์ (วิ)
            <input type="number" min="1" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
              value={st.answer_time_typing_sec ?? 15} onChange={e => setStages(s => s.map((x, i) => i === idx ? { ...x, answer_time_typing_sec: +e.target.value } : x))} />
          </label>
        </div>

        {/* จำนวนโจทย์แต่ละประเภท (สัดส่วนที่จะสุ่มออกมาต่อรอบ) */}
        <div className="text-[11px] font-black text-slate-500 pt-1">จำนวนโจทย์แต่ละประเภท</div>
        <div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-500">
          <label className="flex flex-col gap-1">ตัวเลือก
            <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
              value={st.q_choice_count ?? 20} onChange={e => setStages(s => s.map((x, i) => i === idx ? { ...x, q_choice_count: +e.target.value } : x))} />
          </label>
          <label className="flex flex-col gap-1">พิมพ์
            <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
              value={st.q_typing_count ?? 5} onChange={e => setStages(s => s.map((x, i) => i === idx ? { ...x, q_typing_count: +e.target.value } : x))} />
          </label>
          <label className="flex flex-col gap-1">เรียงคำ
            <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
              value={st.q_rearrange_count ?? 5} onChange={e => setStages(s => s.map((x, i) => i === idx ? { ...x, q_rearrange_count: +e.target.value } : x))} />
          </label>
        </div>
        <button onClick={() => saveStage(st)} className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-black text-sm uppercase w-full transition-colors active:scale-95">บันทึก</button>
      </Section>
    </div>
  );
}

// ============ TAB: COIN ที่ได้ต่อ LV ของ Flashcards ============
function ExpTab({ notify }) {
  const [exp, setExp] = useState({});

  useEffect(() => {
    supabase.from('exp_rewards').select('*').order('flashcard_level').then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[r.flashcard_level] = r.exp_amount; });
      setExp(map);
    });
  }, []);

  const saveExp = async (lv, val) => {
    const { error } = await supabase.from('exp_rewards').upsert({ flashcard_level: lv, exp_amount: val }, { onConflict: 'flashcard_level' });
    clearExpRewardsCache();
    notify(error ? 'บันทึกล้มเหลว' : `บันทึก Coin LV${lv} แล้ว`);
  };

  return (
    <Section title="Coin ที่ได้ต่อ LV ของ Flashcards">
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
      <Section title={`เพิ่มศัตรูในด่าน ${stage}`}>
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
    <Section title="เสียง Sound Effects">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
        {SFX_KEYS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 border-b border-slate-100 py-3">
            <span className="text-sm font-black text-slate-600 w-28 shrink-0">{label}</span>
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
  const [savingOrder, setSavingOrder] = useState(false);

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

  // ย้ายลำดับไอเทมขึ้น/ลง แล้วบันทึก sort_order ใหม่ (ลำดับ = ตำแหน่งในรายการ)
  const move = async (index, dir) => {
    const target = index + dir;
    if (savingOrder || target < 0 || target >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    setItems(reordered); // อัปเดตทันที (optimistic) คงค่าที่กำลังแก้ไว้
    setSavingOrder(true);
    try {
      await Promise.all(reordered.map((it, i) =>
        supabase.from('shop_items').update({ sort_order: i + 1 }).eq('id', it.id)
      ));
      notify('จัดลำดับแล้ว');
    } catch (e) {
      notify('จัดลำดับล้มเหลว: ' + e.message);
      await load();
    }
    setSavingOrder(false);
  };

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
              <option value="add_hp">เพิ่มหัวใจ</option>
              <option value="add_attack">เพิ่มพลังโจมตี</option>
              <option value="heal">ฟื้น HP</option>
              <option value="shield">โล่ป้องกัน</option>
              <option value="add_time">เพิ่มเวลา</option>
              <option value="bomb">ระเบิด</option>
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
        <p className="text-[11px] font-bold text-slate-400 -mt-1">ใช้ปุ่ม ▲ / ▼ เพื่อจัดลำดับการแสดงในร้าน</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((it, idx) => (
            <div key={it.id} className={`flex flex-col gap-3 rounded-xl p-3 border-2 ${it.active ? 'bg-slate-50 border-slate-100' : 'bg-slate-200/60 border-slate-300'}`}>
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => move(idx, -1)} disabled={savingOrder || idx === 0} title="เลื่อนขึ้น" aria-label="เลื่อนขึ้น"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border-2 border-slate-200 text-slate-600 font-black hover:bg-slate-100 transition-colors active:scale-95 disabled:opacity-30">▲</button>
                  <span className="text-[10px] font-black text-slate-400 text-center">{idx + 1}</span>
                  <button onClick={() => move(idx, 1)} disabled={savingOrder || idx === items.length - 1} title="เลื่อนลง" aria-label="เลื่อนลง"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border-2 border-slate-200 text-slate-600 font-black hover:bg-slate-100 transition-colors active:scale-95 disabled:opacity-30">▼</button>
                </div>
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
                    <option value="add_hp">เพิ่มหัวใจ</option>
                    <option value="add_attack">เพิ่มพลังโจมตี</option>
                    <option value="heal">ฟื้น HP</option>
                    <option value="shield">โล่ป้องกัน</option>
                    <option value="add_time">เพิ่มเวลา</option>
                    <option value="bomb">ระเบิด</option>
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

// ============ ส่วนตั้งค่า: จำกัดค่าพลังสูงสุดของผู้เล่น ============
function PlayerStatCaps({ notify }) {
  const [caps, setCaps] = useState({ maxHpCap: '', maxAttackCap: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getGameSettings(true).then(s => {
      setCaps({ maxHpCap: s.maxHpCap, maxAttackCap: s.maxAttackCap });
      setLoading(false);
    });
  }, []);

  const save = async () => {
    const hp = Math.max(BASE_MAX_HP, +caps.maxHpCap || BASE_MAX_HP);
    const atk = Math.max(BASE_ATTACK, +caps.maxAttackCap || BASE_ATTACK);
    setSaving(true);
    const ok = await saveGameSettings({ maxHpCap: hp, maxAttackCap: atk });
    if (ok) setCaps({ maxHpCap: hp, maxAttackCap: atk });
    setSaving(false);
    notify(ok ? 'บันทึกเพดานพลังแล้ว' : 'บันทึกล้มเหลว');
  };

  return (
    <Section title="จำกัดค่าพลังสูงสุดของผู้เล่น">
      <p className="text-[11px] font-bold text-slate-400 -mt-1">
        เพดานนี้ใช้กับ HP/พลังโจมตีรวมที่ได้จากอัปเกรดถาวร — ผู้เล่นจะอัปเกรดเกินค่านี้ไม่ได้
        (ค่าฐานเริ่มต้น: HP {BASE_MAX_HP} / โจมตี {BASE_ATTACK})
      </p>
      {loading ? (
        <div className="text-center text-slate-400 py-4 text-sm font-bold">กำลังโหลด...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-500">
            <label className="flex flex-col gap-1">❤️ HP สูงสุด
              <input type="number" min={BASE_MAX_HP} className="border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-normal"
                value={caps.maxHpCap} onChange={e => setCaps(c => ({ ...c, maxHpCap: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1">⚔️ พลังโจมตีสูงสุด
              <input type="number" min={BASE_ATTACK} className="border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-normal"
                value={caps.maxAttackCap} onChange={e => setCaps(c => ({ ...c, maxAttackCap: e.target.value }))} />
            </label>
          </div>
          <button onClick={save} disabled={saving} className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-black text-sm uppercase w-full transition-colors active:scale-95 disabled:opacity-50">
            {saving ? 'กำลังบันทึก...' : 'บันทึกเพดานพลัง'}
          </button>
        </>
      )}
    </Section>
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
      if (c._coverFile) patch.cover_url = await uploadFile(c._coverFile, 'character-covers');
      const { error } = await supabase.from('game_characters').update(patch).eq('id', c.id);
      if (error) throw error;
      await load(); notify('บันทึกตัวละครแล้ว');
    } catch (e) { notify('บันทึกล้มเหลว: ' + e.message); }
  };
  const clearCover = async (c) => {
    if (!window.confirm('ลบรูปปกของตัวละครนี้?')) return;
    const { error } = await supabase.from('game_characters').update({ cover_url: null }).eq('id', c.id);
    if (error) notify('ลบรูปปกล้มเหลว');
    else { await load(); notify('ลบรูปปกแล้ว'); }
  };
  const del = async (id) => { await supabase.from('game_characters').delete().eq('id', id); await load(); };

  return (
    <div className="space-y-4">
      <PlayerStatCaps notify={notify} />
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
                  <div className="flex flex-col gap-1 col-span-2">รูปปก (พื้นหลัง Home)
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileButton accept="image/*" onSelect={file => editLocal(c.id, { _coverFile: file })} className="px-3 py-1.5 text-xs">
                        {c._coverFile ? 'ปกใหม่แล้ว' : 'เลือกรูปปก'}
                      </FileButton>
                      {c.cover_url && !c._coverFile && (
                        <button type="button" onClick={() => clearCover(c)} className="text-xs font-black text-red-500 underline">ลบปก</button>
                      )}
                    </div>
                    {c._coverFile && (
                        <span className="text-[10px] font-bold text-emerald-600 truncate">{c._coverFile.name}</span>
                      )}
                      {c.cover_url && !c._coverFile && (
                        <div className="mt-1 rounded-lg overflow-hidden border border-slate-200 aspect-video max-h-20 bg-slate-900">
                          <img src={c.cover_url} alt="cover" className="w-full h-full object-cover" />
                        </div>
                      )}
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

// ============ TAB: Lucky Draw (คลังรางวัล + น้ำหนักการสุ่ม) ============
const LUCKY_TIERS = [
  { id: 'common', label: 'ธรรมดา' },
  { id: 'rare', label: 'หายาก' },
  { id: 'epic', label: 'หายากมาก' },
];

function LuckyDrawTab({ notify }) {
  const [prizes, setPrizes] = useState([]);
  const [itemOptions, setItemOptions] = useState([]); // shop_items kind='item'
  const [cfg, setCfg] = useState({ lucky_common_weight: 65, lucky_rare_weight: 28, lucky_epic_weight: 7, lucky_epic_streak_days: 7 });
  const [savingCfg, setSavingCfg] = useState(false);
  const [form, setForm] = useState({ tier: 'common', reward_type: 'coin', coin_amount: 10, item_id: '', item_qty: 1, weight: 1, label: '' });

  const load = useCallback(async () => {
    const [{ data: pz }, { data: items }, { data: settings }] = await Promise.all([
      supabase.from('lucky_draw_prizes').select('*, shop_items(name, icon_url, effect_type)').order('sort_order').order('id'),
      supabase.from('shop_items').select('id, name, icon_url, effect_type').eq('kind', 'item').order('sort_order'),
      supabase.from('game_settings').select('lucky_common_weight, lucky_rare_weight, lucky_epic_weight, lucky_epic_streak_days').eq('id', 1).maybeSingle(),
    ]);
    setPrizes(pz || []);
    setItemOptions(items || []);
    if (settings) setCfg({
      lucky_common_weight: settings.lucky_common_weight ?? 65,
      lucky_rare_weight: settings.lucky_rare_weight ?? 28,
      lucky_epic_weight: settings.lucky_epic_weight ?? 7,
      lucky_epic_streak_days: settings.lucky_epic_streak_days ?? 7,
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveCfg = async () => {
    setSavingCfg(true);
    const { error } = await supabase.from('game_settings').update({
      lucky_common_weight: Math.max(0, +cfg.lucky_common_weight || 0),
      lucky_rare_weight: Math.max(0, +cfg.lucky_rare_weight || 0),
      lucky_epic_weight: Math.max(0, +cfg.lucky_epic_weight || 0),
      lucky_epic_streak_days: Math.max(0, +cfg.lucky_epic_streak_days || 0),
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSavingCfg(false);
    notify(error ? `บันทึกล้มเหลว: ${error.message}` : 'บันทึกน้ำหนักการสุ่มแล้ว');
  };

  const add = async () => {
    const payload = {
      tier: form.tier,
      reward_type: form.reward_type,
      coin_amount: form.reward_type === 'coin' ? Math.max(0, +form.coin_amount || 0) : 0,
      item_id: form.reward_type === 'item' ? (form.item_id ? +form.item_id : null) : null,
      item_qty: Math.max(1, +form.item_qty || 1),
      weight: Math.max(0, +form.weight || 0),
      label: form.label?.trim() || null,
      sort_order: prizes.length + 1,
    };
    if (form.reward_type === 'item' && !payload.item_id) { notify('เลือกไอเทมก่อน'); return; }
    const { error } = await supabase.from('lucky_draw_prizes').insert(payload);
    if (error) { notify(`เพิ่มล้มเหลว: ${error.message}`); return; }
    setForm({ tier: 'common', reward_type: 'coin', coin_amount: 10, item_id: '', item_qty: 1, weight: 1, label: '' });
    await load(); notify('เพิ่มรางวัลแล้ว');
  };

  const editLocal = (id, patch) => setPrizes(list => list.map(x => x.id === id ? { ...x, ...patch } : x));
  const savePrize = async (p) => {
    const { error } = await supabase.from('lucky_draw_prizes').update({
      tier: p.tier,
      reward_type: p.reward_type,
      coin_amount: p.reward_type === 'coin' ? Math.max(0, +p.coin_amount || 0) : 0,
      item_id: p.reward_type === 'item' ? (p.item_id ? +p.item_id : null) : null,
      item_qty: Math.max(1, +p.item_qty || 1),
      weight: Math.max(0, +p.weight || 0),
      label: p.label?.trim() || null,
    }).eq('id', p.id);
    if (error) { notify(`บันทึกล้มเหลว: ${error.message}`); return; }
    await load(); notify('บันทึกรางวัลแล้ว');
  };
  const toggleActive = async (p) => { await supabase.from('lucky_draw_prizes').update({ active: !p.active }).eq('id', p.id); await load(); };
  const del = async (id) => { if (!window.confirm('ลบรางวัลนี้?')) return; await supabase.from('lucky_draw_prizes').delete().eq('id', id); await load(); };

  const tierWeightTotal = (+cfg.lucky_common_weight || 0) + (+cfg.lucky_rare_weight || 0) + (+cfg.lucky_epic_weight || 0);
  const pct = (w) => tierWeightTotal > 0 ? Math.round((w / tierWeightTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      <Section title="โอกาสสุ่มแต่ละระดับ + Streak">
        <p className="text-[11px] font-bold text-slate-400 -mt-1">
          ระบบจะสุ่มระดับความหายากตามน้ำหนักด้านล่างก่อน แล้วค่อยสุ่มของในระดับนั้น
        </p>
        <div className="grid grid-cols-3 gap-3 text-xs font-bold text-slate-500">
          <label className="flex flex-col gap-1">⚪ ธรรมดา ({pct(+cfg.lucky_common_weight || 0)}%)
            <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
              value={cfg.lucky_common_weight} onChange={e => setCfg(c => ({ ...c, lucky_common_weight: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">🔵 หายาก ({pct(+cfg.lucky_rare_weight || 0)}%)
            <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
              value={cfg.lucky_rare_weight} onChange={e => setCfg(c => ({ ...c, lucky_rare_weight: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">🟣 หายากมาก ({pct(+cfg.lucky_epic_weight || 0)}%)
            <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
              value={cfg.lucky_epic_weight} onChange={e => setCfg(c => ({ ...c, lucky_epic_weight: e.target.value }))} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
          การันตีของหายากมากทุกๆ กี่วันที่รับติดต่อกัน (0 = ปิด)
          <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal w-32"
            value={cfg.lucky_epic_streak_days} onChange={e => setCfg(c => ({ ...c, lucky_epic_streak_days: e.target.value }))} />
        </label>
        <button onClick={saveCfg} disabled={savingCfg} className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-black text-sm uppercase w-full transition-colors active:scale-95 disabled:opacity-50">
          {savingCfg ? 'กำลังบันทึก...' : 'บันทึกโอกาสสุ่ม'}
        </button>
      </Section>

      <Section title="เพิ่มรางวัลในกล่องสุ่ม">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-bold text-slate-500">
          <label className="flex flex-col gap-1">ระดับ
            <select value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))} className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal">
              {LUCKY_TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">ประเภทรางวัล
            <select value={form.reward_type} onChange={e => setForm(f => ({ ...f, reward_type: e.target.value }))} className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal">
              <option value="coin">COIN</option>
              <option value="item">ไอเทมใช้แล้วหมด</option>
            </select>
          </label>
          {form.reward_type === 'coin' ? (
            <label className="flex flex-col gap-1">จำนวน COIN
              <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
                value={form.coin_amount} onChange={e => setForm(f => ({ ...f, coin_amount: e.target.value }))} />
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1">ไอเทม
                <select value={form.item_id} onChange={e => setForm(f => ({ ...f, item_id: e.target.value }))} className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal">
                  <option value="">— เลือก —</option>
                  {itemOptions.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">จำนวน
                <input type="number" min="1" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
                  value={form.item_qty} onChange={e => setForm(f => ({ ...f, item_qty: e.target.value }))} />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1">น้ำหนัก (ในระดับ)
            <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal"
              value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 col-span-2 lg:col-span-3">ชื่อที่แสดง (ไม่บังคับ)
            <input className="border-2 border-slate-200 rounded-lg px-2 py-2 text-sm font-normal" placeholder="เช่น 100 เหรียญ / ยาฟื้นพลัง x2"
              value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
          </label>
        </div>
        <button onClick={add} className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white px-4 py-3 rounded-xl font-black text-sm uppercase w-full transition-colors active:scale-95">+ เพิ่มรางวัล</button>
      </Section>

      <Section title="รางวัลทั้งหมดในกล่อง">
        <div className="space-y-4">
          {LUCKY_TIERS.map(t => {
            const list = prizes.filter(p => p.tier === t.id);
            const wsum = list.filter(p => p.active).reduce((s, p) => s + (p.weight || 0), 0);
            return (
              <div key={t.id}>
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  {t.id === 'epic' ? '🟣' : t.id === 'rare' ? '🔵' : '⚪'} {t.label} <span className="text-slate-300">(น้ำหนักรวม {wsum})</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {list.map(p => (
                    <div key={p.id} className={`flex flex-col gap-2 rounded-xl p-3 border-2 ${p.active ? 'bg-slate-50 border-slate-100' : 'bg-slate-200/60 border-slate-300'}`}>
                      <div className="flex items-center gap-2">
                        {p.reward_type === 'item'
                          ? (p.shop_items?.icon_url ? <img src={p.shop_items.icon_url} alt="" className="w-9 h-9 object-contain shrink-0" /> : <span className="w-9 h-9 shrink-0 flex items-center justify-center text-2xl">{EFFECT_ICON[p.shop_items?.effect_type] || '🎁'}</span>)
                          : <span className="w-9 h-9 shrink-0 flex items-center justify-center text-2xl">🪙</span>}
                        <input className="flex-1 border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold" placeholder="ชื่อที่แสดง (ไม่บังคับ)"
                          value={p.label || ''} onChange={e => editLocal(p.id, { label: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold text-slate-500">
                        <label className="flex flex-col gap-1">ระดับ
                          <select value={p.tier} onChange={e => editLocal(p.id, { tier: e.target.value })} className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal">
                            {LUCKY_TIERS.map(tt => <option key={tt.id} value={tt.id}>{tt.label}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">ประเภท
                          <select value={p.reward_type} onChange={e => editLocal(p.id, { reward_type: e.target.value })} className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal">
                            <option value="coin">COIN</option>
                            <option value="item">ไอเทม</option>
                          </select>
                        </label>
                        {p.reward_type === 'coin' ? (
                          <label className="flex flex-col gap-1">COIN
                            <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal"
                              value={p.coin_amount ?? 0} onChange={e => editLocal(p.id, { coin_amount: +e.target.value })} />
                          </label>
                        ) : (
                          <>
                            <label className="flex flex-col gap-1">ไอเทม
                              <select value={p.item_id ?? ''} onChange={e => editLocal(p.id, { item_id: e.target.value ? +e.target.value : null })} className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal">
                                <option value="">— เลือก —</option>
                                {itemOptions.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">จำนวน
                              <input type="number" min="1" className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal"
                                value={p.item_qty ?? 1} onChange={e => editLocal(p.id, { item_qty: +e.target.value })} />
                            </label>
                          </>
                        )}
                        <label className="flex flex-col gap-1">น้ำหนัก
                          <input type="number" min="0" className="border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-normal"
                            value={p.weight ?? 0} onChange={e => editLocal(p.id, { weight: +e.target.value })} />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => savePrize(p)} className="flex-1 bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-black transition-colors active:scale-95">บันทึก</button>
                        <button onClick={() => toggleActive(p)} className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-black transition-colors active:scale-95">{p.active ? 'ปิด' : 'เปิด'}</button>
                        <button onClick={() => del(p.id)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-black transition-colors active:scale-95">ลบ</button>
                      </div>
                    </div>
                  ))}
                  {list.length === 0 && <p className="text-slate-400 text-sm">ยังไม่มีรางวัลในระดับนี้</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

const TABS = [
  { id: 'stages', label: 'ด่าน' },
  { id: 'exp', label: 'COIN' },
  { id: 'assets', label: 'พื้นหลัง/เพลง' },
  { id: 'characters', label: 'ตัวละคร' },
  { id: 'enemies', label: 'ศัตรู' },
  { id: 'sfx', label: 'เสียง' },
  { id: 'shop', label: 'ไอเทม' },
  { id: 'lucky', label: 'Lucky Draw' },
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
    <div className="admin-panel space-y-4 pt-2 pb-12 text-slate-800">
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
      {tab === 'exp' && <ExpTab notify={notify} />}
      {tab === 'assets' && <StageAssetsTab notify={notify} />}
      {tab === 'characters' && <CharactersTab notify={notify} />}
      {tab === 'enemies' && <EnemiesTab notify={notify} />}
      {tab === 'sfx' && <SfxTab notify={notify} />}
      {tab === 'shop' && <ShopTab notify={notify} />}
      {tab === 'lucky' && <LuckyDrawTab notify={notify} />}
    </div>
  );
}
