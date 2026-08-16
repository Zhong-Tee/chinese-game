import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { dailyMissionErrorMessage, DEFAULT_DAILY_MISSION_CONFIG, fetchDailyMissionConfig, localDateKey } from '../utils/dailyMissionStorage';
import { getWrongWords, deleteWrongWord } from '../utils/wrongWordsStorage';
import {
  SPEECH_RATE_MIN,
  SPEECH_RATE_MAX,
  SPEECH_RATE_STEP,
  getSpeechRate,
  setSpeechRate,
  speakChinese,
} from '../utils/chineseSpeech';

function NumericSettingInput({ value, onCommit, min, max, step = 1, suffix, className, decimals }) {
  const displayValue = (nextValue) => (
    decimals === undefined ? String(nextValue) : Number(nextValue).toFixed(decimals)
  );
  const [draft, setDraft] = useState(() => displayValue(value));

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(displayValue(value));
      return;
    }
    const bounded = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    setDraft(displayValue(bounded));
    onCommit(bounded);
  };

  return (
    <div className={`relative w-20 ${className || ''}`}>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(displayValue(value));
            event.currentTarget.blur();
          }
        }}
        onFocus={(event) => event.currentTarget.select()}
        aria-label={`กรอกค่า ${suffix}`}
        className="w-full appearance-none rounded-xl border border-white/15 bg-white/10 py-1.5 pl-2 pr-6 text-center text-xl font-black italic outline-none transition focus:border-current focus:bg-white/15 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm font-black">{suffix}</span>
    </div>
  );
}

export default function Settings({
  page, setPage, user, isAdmin = false, allMasterCards,
  timerSetting, setTimerSetting,
  gameTimerSetting, setGameTimerSetting,
  typeTimerSetting, setTypeTimerSetting,
  schedules, setSchedules, saveSettings, saveSchedules
}) {
  const daysOfWeek = ["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์"];
  const datesOfMonth = Array.from({ length: 30 }, (_, i) => i + 1);
  const [wrongWordsList, setWrongWordsList] = useState([]);
  const [speechRate, setSpeechRateState] = useState(getSpeechRate);
  const [missionConfig, setMissionConfig] = useState(DEFAULT_DAILY_MISSION_CONFIG);
  const [missionSaving, setMissionSaving] = useState(false);
  const [missionSaved, setMissionSaved] = useState(false);
  const [missionApplyUserId, setMissionApplyUserId] = useState('');
  const [missionApplying, setMissionApplying] = useState(false);
  const [missionApplyMessage, setMissionApplyMessage] = useState('');
  const [keyUsers, setKeyUsers] = useState([]);
  const [keyUserId, setKeyUserId] = useState('');
  const [keyLevel, setKeyLevel] = useState('3');
  const [keyGrantLoading, setKeyGrantLoading] = useState(false);
  const [keyGrantMessage, setKeyGrantMessage] = useState('');

  const applySpeechRate = (rate, playPreview = true) => {
    const saved = setSpeechRate(rate);
    setSpeechRateState(saved);
    if (playPreview) speakChinese('你好');
    return saved;
  };

  useEffect(() => {
    if (page === 'settings' && user?.id) {
      getWrongWords(user.id).then(setWrongWordsList);
    }
  }, [page, user?.id]);

  useEffect(() => {
    if (page === 'settings' && isAdmin) {
      fetchDailyMissionConfig().then(setMissionConfig).catch((error) => console.error('load daily mission config:', error));
      supabase.rpc('list_key_grant_users').then(({ data, error }) => {
        if (error) {
          console.error('load key grant users:', error);
          return;
        }
        const users = data || [];
        setKeyUsers(users);
        setKeyUserId((current) => current || users[0]?.user_id || '');
      });
    }
  }, [page, isAdmin]);

  const grantLevelKey = async () => {
    if (!keyUserId) return;
    setKeyGrantLoading(true);
    setKeyGrantMessage('');
    const { error } = await supabase.rpc('admin_grant_level_key', {
      target_user_id: keyUserId,
      target_level: Number(keyLevel),
    });
    setKeyGrantLoading(false);
    if (error) {
      setKeyGrantMessage(`ให้กุญแจไม่สำเร็จ: ${error.message}`);
      return;
    }
    const selectedUser = keyUsers.find((item) => item.user_id === keyUserId);
    setKeyGrantMessage(`✓ ให้กุญแจ LV.${keyLevel} แก่ ${selectedUser?.display_name || 'ผู้ใช้'} แล้ว`);
  };

  const saveMissionConfig = async () => {
    setMissionSaving(true);
    setMissionSaved(false);
    const normalized = {
      ...missionConfig,
      new_words_target: Math.max(1, Number(missionConfig.new_words_target) || 5),
      review_mode: missionConfig.review_mode === 'count' ? 'count' : 'all',
      review_words_target: Math.max(1, Number(missionConfig.review_words_target) || 20),
      match_words_target: Math.max(1, Number(missionConfig.match_words_target) || 10),
    };
    const { error } = await supabase.from('game_settings')
      .update({ daily_mission_config: normalized, updated_at: new Date().toISOString() }).eq('id', 1);
    setMissionSaving(false);
    if (error) {
      alert(`บันทึกภารกิจไม่สำเร็จ: ${dailyMissionErrorMessage(error)}`);
      return;
    }
    setMissionConfig(normalized);
    setMissionSaved(true);
    setTimeout(() => setMissionSaved(false), 2000);
  };

  const applyMissionConfigToday = async () => {
    if (!missionApplyUserId) return;
    setMissionApplying(true);
    setMissionApplyMessage('');
    const normalized = {
      ...missionConfig,
      new_words_target: Math.max(1, Number(missionConfig.new_words_target) || 5),
      review_mode: missionConfig.review_mode === 'count' ? 'count' : 'all',
      review_words_target: Math.max(1, Number(missionConfig.review_words_target) || 20),
      match_words_target: Math.max(1, Number(missionConfig.match_words_target) || 10),
    };

    try {
      const { error: configError } = await supabase.from('game_settings')
        .update({ daily_mission_config: normalized, updated_at: new Date().toISOString() }).eq('id', 1);
      if (configError) throw configError;

      const { data: mission, error: missionError } = await supabase.from('daily_mission_progress')
        .select('*')
        .eq('user_id', missionApplyUserId)
        .eq('mission_date', localDateKey())
        .maybeSingle();
      if (missionError) throw missionError;
      if (!mission) throw new Error('ผู้ใช้นี้ยังไม่มีภารกิจของวันนี้');

      const patch = {
        config_snapshot: { ...(mission.config_snapshot || {}), ...normalized },
      };

      if (mission.review_level && normalized.review_enabled !== false) {
        const completedIds = [...new Set((mission.review_completed_ids || []).map(Number))];
        const { data: currentLevelRows, error: progressError } = await supabase.from('user_progress')
          .select('flashcard_id')
          .eq('user_id', missionApplyUserId)
          .eq('level', Number(mission.review_level))
          .lt('wrong_count', 3);
        if (progressError) throw progressError;

        const availableIds = [...new Set([
          ...(mission.review_word_ids || []).map(Number),
          ...(currentLevelRows || []).map((row) => Number(row.flashcard_id)),
        ])].filter(Number.isFinite);

        patch.review_word_ids = [...new Set([...completedIds, ...availableIds])];
        patch.review_completed_ids = completedIds.filter((id) => patch.review_word_ids.includes(id));
      }

      const { error: updateError } = await supabase.from('daily_mission_progress')
        .update(patch)
        .eq('user_id', missionApplyUserId)
        .eq('mission_date', localDateKey());
      if (updateError) throw updateError;

      setMissionConfig(normalized);
      const selectedUser = keyUsers.find((item) => item.user_id === missionApplyUserId);
      setMissionApplyMessage(`✓ อัปเดตภารกิจวันนี้ของ ${selectedUser?.display_name || 'ผู้ใช้'} แล้ว`);
    } catch (error) {
      setMissionApplyMessage(`อัปเดตไม่สำเร็จ: ${dailyMissionErrorMessage(error)}`);
    } finally {
      setMissionApplying(false);
    }
  };

  // --- 1. หน้าตั้งค่าหลัก ---
  if (page === 'settings') {
    return (
      <div 
        className="space-y-6 pt-4 select-none"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
        onDragStart={(e) => e.preventDefault()}
      >
        <button onClick={() => setPage('dashboard')} className="text-orange-400 font-black text-sm uppercase italic underline">← Back</button>
        <h2 className="text-2xl font-black text-center uppercase italic">Settings</h2>
        
        <div className="bg-white/5 p-6 rounded-[2.5rem] border-2 border-white/10 shadow-sm space-y-8">
          {/* ความเร็วเสียงอ่าน */}
          <div className="text-center">
            <label className="block text-sm sm:text-base font-black mb-3 uppercase text-sky-400">Speech Speed</label>

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => applySpeechRate(speechRate - SPEECH_RATE_STEP)}
                disabled={speechRate <= SPEECH_RATE_MIN + 1e-6}
                className="w-10 h-10 bg-white/10 text-white rounded-full font-black select-none disabled:opacity-40"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
              >-</button>

              <NumericSettingInput
                key={speechRate}
                value={speechRate}
                min={SPEECH_RATE_MIN}
                max={SPEECH_RATE_MAX}
                step={SPEECH_RATE_STEP}
                decimals={2}
                suffix="x"
                onCommit={(value) => applySpeechRate(value)}
                className="text-sky-300"
              />

              <button
                type="button"
                onClick={() => applySpeechRate(speechRate + SPEECH_RATE_STEP)}
                disabled={speechRate >= SPEECH_RATE_MAX - 1e-6}
                className="w-10 h-10 bg-white/10 text-white rounded-full font-black select-none disabled:opacity-40"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
              >+</button>
            </div>

            <div className="flex items-center justify-center gap-2 mt-3 px-2">
              <span className="text-[10px] font-black text-white/40">ช้า</span>
              <input
                type="range"
                min={SPEECH_RATE_MIN}
                max={SPEECH_RATE_MAX}
                step={SPEECH_RATE_STEP}
                value={speechRate}
                onChange={(e) => applySpeechRate(parseFloat(e.target.value), false)}
                onMouseUp={() => speakChinese('你好')}
                onTouchEnd={() => speakChinese('你好')}
                className="flex-1 accent-sky-500"
              />
              <span className="text-[10px] font-black text-white/40">เร็ว</span>
            </div>

            <button
              type="button"
              onClick={() => speakChinese('你好')}
              className="mt-3 inline-block bg-sky-500 text-white text-xs font-black px-4 py-2 rounded-2xl uppercase shadow-md shadow-sky-100"
            >
              🔊 ทดลองฟัง
            </button>
          </div>

          {/* ตั้งเวลา Flashcard */}
          <div className="text-center">
            <label className="block text-sm sm:text-base font-black mb-3 uppercase text-orange-400">Flashcard Timer</label>
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={() => {
                  const val = Math.max(1, timerSetting - 1);
                  setTimerSetting(val);
                  saveSettings(val, gameTimerSetting, typeTimerSetting, schedules); // บันทึกลง DB ทันที
                }} 
                className="w-10 h-10 bg-white/10 text-white rounded-full font-black select-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
              >-</button>
              
              <NumericSettingInput
                key={timerSetting}
                value={timerSetting}
                min={1}
                suffix="s"
                onCommit={(value) => {
                  const val = Math.round(value);
                  setTimerSetting(val);
                  saveSettings(val, gameTimerSetting, typeTimerSetting, schedules);
                }}
                className="text-orange-400"
              />
              
              <button 
                onClick={() => {
                  const val = timerSetting + 1;
                  setTimerSetting(val);
                  saveSettings(val, gameTimerSetting, typeTimerSetting, schedules); // บันทึกลง DB ทันที
                }} 
                className="w-10 h-10 bg-white/10 text-white rounded-full font-black select-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
              >+</button>
            </div>
          </div>

          {/* ตั้งเวลาเรียงคำศัพท์ (Flashcard ช่วงที่ 3) */}
          <div className="text-center">
            <label className="block text-sm sm:text-base font-black mb-3 uppercase text-emerald-400">เวลาเรียงคำศัพท์</label>
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={() => {
                  const val = Math.max(1, gameTimerSetting - 1);
                  setGameTimerSetting(val);
                  saveSettings(timerSetting, val, typeTimerSetting, schedules); // บันทึกลง DB ทันที
                }} 
                className="w-10 h-10 bg-white/10 text-white rounded-full font-black select-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
              >-</button>
              
              <NumericSettingInput
                key={gameTimerSetting}
                value={gameTimerSetting}
                min={1}
                suffix="s"
                onCommit={(value) => {
                  const val = Math.round(value);
                  setGameTimerSetting(val);
                  saveSettings(timerSetting, val, typeTimerSetting, schedules);
                }}
                className="text-emerald-400"
              />
              
              <button 
                onClick={() => {
                  const val = gameTimerSetting + 1;
                  setGameTimerSetting(val);
                  saveSettings(timerSetting, val, typeTimerSetting, schedules); // บันทึกลง DB ทันที
                }} 
                className="w-10 h-10 bg-white/10 text-white rounded-full font-black select-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
              >+</button>
            </div>
          </div>

          {/* ตั้งเวลาพิมพ์คำศัพท์ (Flashcard ช่วงพิมพ์) */}
          <div className="text-center">
            <label className="block text-sm sm:text-base font-black mb-3 uppercase text-indigo-400">เวลาพิมพ์คำศัพท์</label>
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={() => {
                  const val = Math.max(1, typeTimerSetting - 1);
                  setTypeTimerSetting(val);
                  saveSettings(timerSetting, gameTimerSetting, val, schedules); // บันทึกลง DB ทันที
                }} 
                className="w-10 h-10 bg-white/10 text-white rounded-full font-black select-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
              >-</button>
              
              <NumericSettingInput
                key={typeTimerSetting}
                value={typeTimerSetting}
                min={1}
                suffix="s"
                onCommit={(value) => {
                  const val = Math.round(value);
                  setTypeTimerSetting(val);
                  saveSettings(timerSetting, gameTimerSetting, val, schedules);
                }}
                className="text-indigo-300"
              />
              
              <button 
                onClick={() => {
                  const val = typeTimerSetting + 1;
                  setTypeTimerSetting(val);
                  saveSettings(timerSetting, gameTimerSetting, val, schedules); // บันทึกลง DB ทันที
                }} 
                className="w-10 h-10 bg-white/10 text-white rounded-full font-black select-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
              >+</button>
            </div>
          </div>

          <button onClick={() => setPage('select-words')} className="w-full bg-orange-500 text-white p-4 rounded-3xl font-black uppercase italic shadow-lg shadow-orange-100">📂 Select Study Words</button>
          {isAdmin && (
            <button onClick={() => setPage('set-schedule')} className="w-full bg-white/10 border-2 border-white/15 text-white p-4 rounded-3xl font-black uppercase italic shadow-lg">📅 Set Level Schedule</button>
          )}

          {isAdmin && (
            <div className="pt-5 border-t border-white/10 space-y-3">
              <div className="text-center">
                <h3 className="text-base sm:text-lg font-black text-amber-300 uppercase italic">🔑 ให้กุญแจปลดล็อก LV</h3>
                <p className="mt-1 text-[11px] text-white/45">เลือกผู้ใช้และด่านที่ต้องการให้กุญแจ 1 ดอก</p>
              </div>
              <select value={keyUserId} onChange={(e) => { setKeyUserId(e.target.value); setKeyGrantMessage(''); }}
                className="w-full rounded-2xl bg-white p-3 text-slate-900 font-bold">
                {keyUsers.length === 0 && <option value="">ไม่พบผู้ใช้</option>}
                {keyUsers.map((item) => <option key={item.user_id} value={item.user_id}>{item.display_name}</option>)}
              </select>
              <select value={keyLevel} onChange={(e) => { setKeyLevel(e.target.value); setKeyGrantMessage(''); }}
                className="w-full rounded-2xl bg-white p-3 text-slate-900 font-bold">
                {[3, 4, 5, 6].map((level) => <option key={level} value={level}>LV.{level}</option>)}
              </select>
              <button type="button" onClick={grantLevelKey} disabled={!keyUserId || keyGrantLoading}
                className="w-full rounded-2xl bg-amber-400 p-3.5 font-black text-slate-900 shadow-lg disabled:opacity-50">
                {keyGrantLoading ? 'กำลังให้กุญแจ...' : '🔑 ให้กุญแจ 1 ดอก'}
              </button>
              {keyGrantMessage && <p className={`text-center text-xs font-bold ${keyGrantMessage.startsWith('✓') ? 'text-emerald-300' : 'text-red-300'}`}>{keyGrantMessage}</p>}
            </div>
          )}

          {isAdmin && (
            <div className="pt-5 border-t border-white/10 space-y-4">
              <div className="text-center">
                <h3 className="text-base sm:text-lg font-black text-amber-300 uppercase italic">🎯 ภารกิจประจำวัน</h3>
                <p className="text-[11px] text-white/45 mt-1">ตั้งค่ากลางสำหรับผู้เล่นทุกคน · มีผลกับภารกิจวันถัดไป</p>
              </div>
              <label className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
                <span className="font-bold text-white/80">เปิดใช้งานภารกิจ</span>
                <input type="checkbox" checked={missionConfig.enabled !== false}
                  onChange={(e) => setMissionConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                  className="w-5 h-5 accent-orange-500" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
                  <span className="block text-xs font-bold text-white/60 mb-2">คำใหม่ไปถึง LV.3</span>
                  <input type="number" min="1" max="100" value={missionConfig.new_words_target}
                    onChange={(e) => setMissionConfig((prev) => ({ ...prev, new_words_target: e.target.value }))}
                    className="w-full rounded-xl bg-white text-slate-900 p-2 text-center font-black" />
                </label>
                <label className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
                  <span className="block text-xs font-bold text-white/60 mb-2">เกมจับคู่ต่อวัน</span>
                  <input type="number" min="1" max="100" value={missionConfig.match_words_target}
                    onChange={(e) => setMissionConfig((prev) => ({ ...prev, match_words_target: e.target.value }))}
                    className="w-full rounded-xl bg-white text-slate-900 p-2 text-center font-black" />
                </label>
              </div>
              <label className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
                <span><span className="block font-bold text-white/80">เล่นคำใน LV.3–6 ให้ครบ</span><span className="block text-[10px] text-white/40 mt-0.5">นับ Level แรกที่เปิดเล่นในวันนั้น</span></span>
                <input type="checkbox" checked={missionConfig.review_enabled !== false}
                  onChange={(e) => setMissionConfig((prev) => ({ ...prev, review_enabled: e.target.checked }))}
                  className="w-5 h-5 accent-emerald-500" />
              </label>
              {missionConfig.review_enabled !== false && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <span className="block text-xs font-bold text-white/60">รูปแบบภารกิจทบทวน LV.3–6</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMissionConfig((prev) => ({ ...prev, review_mode: 'count' }))}
                      className={`rounded-xl border-2 px-3 py-2.5 text-sm font-black transition ${missionConfig.review_mode === 'count' ? 'border-emerald-400 bg-emerald-400 text-slate-900' : 'border-white/10 bg-white/5 text-white/60'}`}
                    >
                      กำหนดจำนวนคำ
                    </button>
                    <button
                      type="button"
                      onClick={() => setMissionConfig((prev) => ({ ...prev, review_mode: 'all' }))}
                      className={`rounded-xl border-2 px-3 py-2.5 text-sm font-black transition ${missionConfig.review_mode !== 'count' ? 'border-emerald-400 bg-emerald-400 text-slate-900' : 'border-white/10 bg-white/5 text-white/60'}`}
                    >
                      ทั้งหมดใน Level
                    </button>
                  </div>
                  {missionConfig.review_mode === 'count' && (
                    <label className="block">
                      <span className="mb-2 block text-center text-xs font-bold text-white/60">จำนวนคำที่ต้องผ่านไป Level ถัดไป</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="1000"
                        value={missionConfig.review_words_target}
                        onChange={(e) => setMissionConfig((prev) => ({ ...prev, review_words_target: e.target.value }))}
                        className="w-full appearance-none rounded-xl bg-white p-2 text-center font-black text-slate-900 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </label>
                  )}
                  <p className="text-center text-[10px] text-white/40">
                    {missionConfig.review_mode === 'count'
                      ? 'เล่นคำใดก็ได้ใน Level แรกที่เปิด และนับเฉพาะคำที่ผ่านไป Level ถัดไป'
                      : 'ต้องตอบผ่านทุกคำที่อยู่ใน Level ตอนเริ่มภารกิจ'}
                  </p>
                </div>
              )}
              <button type="button" onClick={saveMissionConfig} disabled={missionSaving}
                className="w-full bg-amber-400 text-slate-900 p-3.5 rounded-2xl font-black uppercase shadow-lg disabled:opacity-50">
                {missionSaving ? 'กำลังบันทึก...' : missionSaved ? '✓ บันทึกแล้ว' : 'บันทึกการตั้งค่าภารกิจ'}
              </button>
              <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-4 space-y-3">
                <div>
                  <div className="text-sm font-black text-cyan-300">อัปเดตภารกิจของวันนี้</div>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/45">
                    ใช้การตั้งค่าด้านบนกับผู้ใช้ที่เลือก โดยรักษาคำที่ทำสำเร็จแล้วไว้
                  </p>
                </div>
                <select
                  value={missionApplyUserId}
                  onChange={(event) => {
                    setMissionApplyUserId(event.target.value);
                    setMissionApplyMessage('');
                  }}
                  className="w-full rounded-xl bg-white p-2.5 text-sm font-bold text-slate-900"
                >
                  <option value="">เลือกผู้ใช้</option>
                  {keyUsers.map((item) => (
                    <option key={item.user_id} value={item.user_id}>{item.display_name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={applyMissionConfigToday}
                  disabled={!missionApplyUserId || missionApplying}
                  className="w-full rounded-xl bg-cyan-400 p-3 text-sm font-black text-slate-950 shadow-lg disabled:opacity-40"
                >
                  {missionApplying ? 'กำลังอัปเดต...' : 'ใช้การตั้งค่ากับภารกิจวันนี้'}
                </button>
                {missionApplyMessage && (
                  <p className={`text-center text-xs font-bold ${missionApplyMessage.startsWith('✓') ? 'text-emerald-300' : 'text-red-300'}`}>
                    {missionApplyMessage}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* รายการคำผิด (จากมินิเกม กด WRONG) */}
          <div className="pt-4 border-t border-white/10">
            <h3 className="text-base sm:text-lg font-black text-white/70 mb-3 uppercase tracking-wide">คำผิด</h3>
            {wrongWordsList.length === 0 ? (
              <p className="text-white/40 text-sm italic">ยังไม่มีคำที่บันทึกเป็นคำผิด</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {wrongWordsList.map((item, i) => {
                  const card = (allMasterCards || []).find(c => (c.id1 || c.id) === item.flashcard_id);
                  const gameLabel = { th: 'เกมแปลไทย', pinyin: 'Pinyin', vol: 'เติมคำ', type: 'ฝึกพิมพ์', flashcard: 'Flashcard' }[item.game_type] || item.game_type;
                  const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
                  return (
                    <li key={item.id || `${item.flashcard_id}-${item.created_at}-${i}`} className="bg-amber-500/10 border border-amber-400/25 rounded-xl p-3 text-left flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-bold text-white">{card?.cn || '—'}</span>
                            <span className="text-white/50 text-sm ml-1">{card?.pinyin || ''}</span>
                            <div className="text-red-300 text-sm font-medium">{card?.th || ''}</div>
                          </div>
                          <span className="text-[10px] text-white/40 whitespace-nowrap">{gameLabel} · {dateStr}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!item.id) return;
                          const ok = await deleteWrongWord(item.id);
                          if (ok) setWrongWordsList(prev => prev.filter(w => w.id !== item.id));
                        }}
                        className="shrink-0 bg-red-500 hover:bg-red-600 text-white text-xs font-black px-2 py-1 rounded-lg uppercase"
                      >
                        ลบ
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- 2. หน้าจัดตารางเรียน (Scheduling) — เฉพาะ admin ---
  if (page === 'set-schedule') {
    if (!isAdmin) {
      return (
        <div className="space-y-4 pt-2 select-none">
          <button onClick={() => setPage('settings')} className="text-orange-400 font-black underline italic uppercase text-xs">← BACK</button>
          <div className="bg-white/5 p-8 rounded-3xl border-2 border-white/10 text-center">
            <div className="text-4xl mb-3">🔒</div>
            <p className="text-white/70 font-black uppercase italic text-sm">เฉพาะผู้ดูแลระบบเท่านั้น</p>
          </div>
        </div>
      );
    }
    return (
      <div 
        className="space-y-4 pt-2 select-none"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
        onDragStart={(e) => e.preventDefault()}
      >
        <button onClick={() => setPage('settings')} className="text-orange-400 font-black underline italic uppercase text-xs">← BACK</button>
        <h2 className="text-xl font-black uppercase italic mb-4">Scheduling</h2>

        {/* Weekly Schedule */}
        <div className="bg-white/5 p-5 rounded-3xl border-2 border-white/10 space-y-4 shadow-sm">
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest text-center w-full italic">Weekly (Lv 3: 2 Days | Lv 4: 1 Day)</p>
          <div className="grid grid-cols-4 gap-2">
            {daysOfWeek.map(day => (
              <button 
                key={day} 
                onClick={() => {
                  let s3 = [...(schedules.lv3 || [])], s4 = [...(schedules.lv4 || [])];
                  if (s3.includes(day)) s3 = s3.filter(d => d !== day);
                  else if (s4.includes(day)) s4 = s4.filter(d => d !== day);
                  else if (s3.length < 2) s3.push(day);
                  else if (s4.length < 1) s4.push(day);
                  const newS = { ...schedules, lv3: s3, lv4: s4 };
                  setSchedules(newS);
                  saveSchedules(newS); // บันทึกเป็นค่ากลาง (มีผลทุก user)
                }}
                className={`text-[10px] p-2 rounded-xl font-black border-2 transition-all select-none ${schedules.lv3?.includes(day) ? 'bg-orange-500 text-white border-orange-500' : schedules.lv4?.includes(day) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/5 text-white border-white/10'}`}
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
              >
                {day}<br/>{schedules.lv3?.includes(day) ? 'LV3' : schedules.lv4?.includes(day) ? 'LV4' : '-'}
              </button>
            ))}
          </div>
        </div>

        {/* Monthly Schedule */}
        <div className="bg-white/5 p-5 rounded-3xl border-2 border-white/10 space-y-4 shadow-sm mb-10 text-center">
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest text-center w-full italic">Monthly (Lv 5: 2 Dates | Lv 6: 1 Date)</p>
          <div className="grid grid-cols-6 gap-2 p-1">
            {datesOfMonth.map(date => (
              <button 
                key={date} 
                onClick={() => {
                  let s5 = [...(schedules.lv5 || [])], s6 = [...(schedules.lv6 || [])];
                  if (s5.includes(date)) s5 = s5.filter(d => d !== date);
                  else if (s6.includes(date)) s6 = s6.filter(d => d !== date);
                  else if (s5.length < 2) s5.push(date);
                  else if (s6.length < 1) s6.push(date);
                  const newS = { ...schedules, lv5: s5, lv6: s6 };
                  setSchedules(newS);
                  saveSchedules(newS); // บันทึกเป็นค่ากลาง (มีผลทุก user)
                }}
                className={`text-sm p-2.5 rounded-xl font-black border-2 transition-all select-none ${schedules.lv5?.includes(date) ? 'bg-purple-500 text-white border-purple-500' : schedules.lv6?.includes(date) ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/5 text-white border-white/10'}`}
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
              >
                {date}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
