import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { dailyMissionErrorMessage, initializeTodayMission, recordDailyMatchComplete } from '../utils/dailyMissionStorage';

// สีบ่งบอกคู่ที่จับ (6 สีต่างกันชัดเจน)
const PALETTE = ['#f97316', '#2563eb', '#16a34a', '#db2777', '#7c3aed', '#0891b2'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ไฮไลต์ตัวอักษรเป้าหมายในคำศัพท์ เช่น target=火 -> 火|车
function highlightTarget(text, target, color) {
  if (!target || !text) return text;
  const parts = String(text).split(target);
  return parts.map((p, i) => (
    <React.Fragment key={i}>
      {p}
      {i < parts.length - 1 && (
        <span style={{ color }} className="font-black">{target}</span>
      )}
    </React.Fragment>
  ));
}

export default function WordMatchGame({ user, setPage, allMasterCards, selectedIds }) {
  const [readyIds, setReadyIds] = useState(null);   // Set ของ flashcard_id ที่มีชุดคำ (>=2 คำ)
  const [picker, setPicker] = useState(true);        // true = หน้าเลือกตัวอักษร
  const [activeCard, setActiveCard] = useState(null); // { id1, cn, pinyin }
  const [loadingWords, setLoadingWords] = useState(false);
  const [dailyMission, setDailyMission] = useState(null);
  const [missionLoading, setMissionLoading] = useState(true);
  const [missionError, setMissionError] = useState('');

  const [leftItems, setLeftItems] = useState([]);    // [{ rowId, vocabulary, pinyin_vocab }]
  const [rightItems, setRightItems] = useState([]);  // [{ rowId, th }]
  const [selectedLeft, setSelectedLeft] = useState(null); // rowId
  const [connections, setConnections] = useState([]);     // [{ leftRowId, rightRowId }]
  const [checked, setChecked] = useState(false);

  const boardRef = useRef(null);
  const leftRefs = useRef({});
  const rightRefs = useRef({});
  const [lines, setLines] = useState([]);

  // ----- โหลดรายชื่อตัวอักษรที่พร้อมเล่น (มีคำที่ 2 ขึ้นไป) -----
  useEffect(() => {
    let alive = true;
    (async () => {
      const pageSize = 1000;
      const ids = new Set();

      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('character_words')
          .select('flashcard_id')
          .eq('sort_order', 2)
          .order('flashcard_id', { ascending: true })
          .range(from, from + pageSize - 1);

        if (!alive) return;
        if (error) {
          console.error('load ready ids error:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint);
          setReadyIds(new Set());
          return;
        }

        (data || []).forEach(row => ids.add(Number(row.flashcard_id)));
        if (!data || data.length < pageSize) break;
      }

      if (alive) setReadyIds(ids);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    setMissionLoading(true);
    setMissionError('');
    initializeTodayMission(user.id)
      .then((mission) => {
        setDailyMission(mission);
        if (!(mission?.matching_card_ids || []).length) setMissionError('ไม่พบคำศัพท์ที่พร้อมสำหรับสร้างภารกิจจับคู่');
      })
      .catch((error) => {
        console.error('daily match mission:', error);
        setMissionError(`สร้างชุดสุ่มไม่สำเร็จ: ${dailyMissionErrorMessage(error)}`);
      })
      .finally(() => setMissionLoading(false));
  }, [user?.id]);

  // รายชื่อตัวอักษรที่พร้อมเล่น เรียงตาม id (ใช้ทั้งหน้าเลือก + ปุ่มคำถัดไป)
  const readyCards = useMemo(() => {
    if (!readyIds) return [];
    const dailyIds = (dailyMission?.matching_card_ids || []).map(Number);
    if (!dailyIds.length) return [];
    const cardMap = new Map((allMasterCards || []).map((card) => [Number(card.id1 ?? card.id), card]));
    const source = dailyIds.map((id) => cardMap.get(id)).filter(Boolean);
    return source
      .filter(c => readyIds.has(Number(c.id1 ?? c.id)))
      .map(c => ({ id1: Number(c.id1 ?? c.id), cn: c.cn, pinyin: c.pinyin }));
  }, [allMasterCards, readyIds, dailyMission?.matching_card_ids]);

  const completedMatchIds = useMemo(
    () => new Set((dailyMission?.matching_completed_ids || []).map(Number)),
    [dailyMission?.matching_completed_ids],
  );

  const checkAnswers = async () => {
    setChecked(true);
    if (score !== leftItems.length || !activeCard?.id1 || !user?.id) return;
    try {
      const updated = await recordDailyMatchComplete(user.id, activeCard.id1);
      if (updated) setDailyMission(updated);
    } catch (error) {
      setMissionError(`บันทึกดาวไม่สำเร็จ: ${dailyMissionErrorMessage(error)}`);
    }
  };

  const colorOf = useCallback((leftRowId) => {
    const idx = leftItems.findIndex(i => i.rowId === leftRowId);
    return PALETTE[(idx + PALETTE.length) % PALETTE.length];
  }, [leftItems]);

  // ----- เลือกตัวอักษร -> โหลด 6 คำ -----
  const openCard = useCallback(async (card) => {
    setActiveCard(card);
    setPicker(false);
    setLoadingWords(true);
    setSelectedLeft(null);
    setConnections([]);
    setChecked(false);
    const { data, error } = await supabase
      .from('character_words')
      .select('id, vocabulary, pinyin_vocab, th, sort_order')
      .eq('flashcard_id', card.id1)
      .order('sort_order', { ascending: true });
    setLoadingWords(false);
    if (error) { console.error('load words error:', error); setLeftItems([]); setRightItems([]); return; }
    const rows = data || [];
    setLeftItems(shuffle(rows.map(r => ({ rowId: r.id, vocabulary: r.vocabulary, pinyin_vocab: r.pinyin_vocab }))));
    setRightItems(shuffle(rows.map(r => ({ rowId: r.id, th: r.th }))));
  }, []);

  // ----- คำนวณพิกัดเส้น -----
  const recalcLines = useCallback(() => {
    if (checked) {
      setLines([]);
      return;
    }
    const board = boardRef.current;
    if (!board) return;
    const b = board.getBoundingClientRect();
    const anchor = (el, side) => {
      const r = el.getBoundingClientRect();
      return { x: (side === 'right' ? r.right : r.left) - b.left, y: r.top + r.height / 2 - b.top };
    };
    const out = [];
    connections.forEach(c => {
      const lEl = leftRefs.current[c.leftRowId];
      const rEl = rightRefs.current[c.rightRowId];
      if (lEl && rEl) {
        const a = anchor(lEl, 'right'), z = anchor(rEl, 'left');
        const correct = c.leftRowId === c.rightRowId;
        out.push({
          key: `u-${c.leftRowId}-${c.rightRowId}`,
          x1: a.x, y1: a.y, x2: z.x, y2: z.y,
          color: checked ? (correct ? '#16a34a' : '#dc2626') : colorOf(c.leftRowId),
          dashed: false,
        });
      }
    });
    setLines(out);
  }, [connections, checked, colorOf]);

  useLayoutEffect(() => { recalcLines(); }, [recalcLines, leftItems, rightItems]);

  useEffect(() => {
    const onResize = () => recalcLines();
    window.addEventListener('resize', onResize);
    const board = boardRef.current;
    const ro = board && 'ResizeObserver' in window ? new ResizeObserver(onResize) : null;
    if (ro && board) ro.observe(board);
    return () => { window.removeEventListener('resize', onResize); if (ro) ro.disconnect(); };
  }, [recalcLines]);

  // ----- คลิกซ้าย / ขวา -----
  const clickLeft = (rowId) => {
    if (checked) return;
    const conn = connections.find(c => c.leftRowId === rowId);
    if (conn) {                    // จับไว้แล้ว -> แตะเพื่อลบ
      setConnections(prev => prev.filter(c => c.leftRowId !== rowId));
      if (selectedLeft === rowId) setSelectedLeft(null);
      return;
    }
    setSelectedLeft(prev => (prev === rowId ? null : rowId));
  };

  const clickRight = (rowId) => {
    if (checked) return;
    const conn = connections.find(c => c.rightRowId === rowId);
    if (conn) {                    // จับไว้แล้ว -> แตะเพื่อลบ
      setConnections(prev => prev.filter(c => c.rightRowId !== rowId));
      return;
    }
    if (selectedLeft == null) return;   // ต้องเลือกฝั่งซ้ายก่อน
    const left = selectedLeft;
    setConnections(prev => [...prev.filter(c => c.leftRowId !== left), { leftRowId: left, rightRowId: rowId }]);
    setSelectedLeft(null);
  };

  const undo = () => { if (!checked) setConnections(prev => prev.slice(0, -1)); setSelectedLeft(null); };
  const reset = () => { setConnections([]); setSelectedLeft(null); setChecked(false); };
  const allMatched = leftItems.length > 0 && connections.length === leftItems.length;
  const score = connections.filter(c => c.leftRowId === c.rightRowId).length;

  const curIdx = activeCard ? readyCards.findIndex(c => c.id1 === activeCard.id1) : -1;
  const hasNext = curIdx > -1 && curIdx < readyCards.length - 1;
  const goNext = () => { if (hasNext) openCard(readyCards[curIdx + 1]); };

  const leftConnected = (rowId) => connections.find(c => c.leftRowId === rowId);
  const rightConnected = (rowId) => connections.find(c => c.rightRowId === rowId);

  // ================= หน้าเลือกตัวอักษร =================
  if (picker) {
    const cards = readyCards;
    return (
      <div className="pb-10 select-none" style={{ userSelect: 'none' }}>
        <div className="flex items-center mb-4">
          <button onClick={() => setPage('dashboard')} className="text-orange-600 font-black italic underline uppercase text-xs">← กลับหน้าหลัก</button>
        </div>
        <h2 className="text-2xl font-black italic uppercase text-center mb-1 text-slate-800">
          เกมจับคู่คำศัพท์ {readyIds != null && `(${cards.length.toLocaleString()})`}
        </h2>
        <p className="text-center text-slate-500 text-sm mb-6">เลือกตัวอักษร แล้วจับคู่คำศัพท์กับคำแปล</p>

        {readyIds == null || missionLoading ? (
          <div className="text-center text-slate-400 py-10">กำลังสุ่มคำศัพท์ประจำวัน...</div>
        ) : missionError ? (
          <div className="text-center text-red-500 py-10 px-6 font-bold">{missionError}</div>
        ) : cards.length === 0 ? (
          <div className="text-center text-slate-500 py-10 px-6">
            ยังไม่มีชุดคำสำหรับเล่น<br />
            <span className="text-xs text-slate-400">(รันไฟล์ SQL character_words ก่อน)</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {cards.map((card, index) => {
              const id1 = Number(card.id1 ?? card.id);
              return (
                <button
                  key={id1}
                  onClick={() => openCard({ id1, cn: card.cn, pinyin: card.pinyin })}
                  className={`relative aspect-square rounded-xl shadow-md border-2 active:scale-95 transition flex flex-col items-center justify-center ${completedMatchIds.has(id1) ? 'border-emerald-500 bg-emerald-100' : 'border-white bg-white'}`}
                >
                  <span
                    className="absolute right-3 top-3 text-slate-600 text-[11px] font-bold leading-none"
                    aria-label={`ลำดับที่ ${index + 1}`}
                  >
                    {index + 1}
                  </span>
                  <div className="text-4xl font-black text-slate-900 leading-none">{card.cn}</div>
                  <div className="text-xs font-bold text-slate-500 mt-1">{card.pinyin}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ================= หน้ากระดานจับคู่ =================
  return (
    <div className="pb-10 select-none" style={{ userSelect: 'none' }}>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => { setPicker(true); }} className="text-orange-600 font-black italic underline uppercase text-xs">← เลือกตัวใหม่</button>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-black text-slate-900">{activeCard?.cn}</span>
          <span className="text-sm font-bold text-slate-500">{activeCard?.pinyin}</span>
        </div>
      </div>

      {loadingWords ? (
        <div className="text-center text-slate-400 py-16">กำลังโหลดคำศัพท์...</div>
      ) : (
        <>
          <p className="text-center text-slate-500 text-xs mb-3">แตะคำจีน (ซ้าย) แล้วแตะคำแปล (ขวา) เพื่อจับคู่ · แตะซ้ำเพื่อยกเลิก</p>

          {checked ? (
            <div className="space-y-3">
              {leftItems.map(item => {
                const answer = rightItems.find(right => right.rowId === item.rowId);
                const conn = leftConnected(item.rowId);
                const isCorrect = conn?.rightRowId === item.rowId;
                const statusColor = isCorrect ? '#16a34a' : '#dc2626';

                return (
                  <div key={item.rowId} className="relative grid grid-cols-2 gap-2 sm:gap-3">
                    <div
                      className="h-[68px] rounded-xl border-2 bg-white px-2 text-center shadow-sm flex flex-col items-center justify-center"
                      style={{ borderColor: statusColor }}
                    >
                      <div className="text-2xl font-black text-slate-900 leading-tight">
                        {highlightTarget(item.vocabulary, activeCard?.cn, statusColor)}
                      </div>
                      <div className="text-xs font-bold text-slate-500 mt-0.5">{item.pinyin_vocab}</div>
                    </div>
                    <div
                      className="relative h-[68px] rounded-xl border-2 bg-white px-7 text-center shadow-sm flex items-center justify-center"
                      style={{ borderColor: statusColor }}
                    >
                      <span
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-[13px] font-black shadow-md"
                        style={{ background: statusColor }}
                        aria-label={isCorrect ? 'ตอบถูก' : 'ตอบผิด'}
                      >
                        {isCorrect ? '✓' : '✕'}
                      </span>
                      <div className="text-base font-bold text-slate-800 leading-tight">{answer?.th}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <div ref={boardRef} className="relative grid grid-cols-2 gap-x-10 sm:gap-x-16">
            {/* เส้นเชื่อม */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
              {lines.map(l => (
                <g key={l.key}>
                  <line
                    x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                    stroke={l.color}
                    strokeWidth={l.dashed ? 2.5 : 3}
                    strokeLinecap="round"
                    strokeDasharray={l.dashed ? '7 5' : undefined}
                    opacity={l.dashed ? 0.85 : 1}
                  />
                  {!l.dashed && <circle cx={l.x1} cy={l.y1} r="4" fill={l.color} />}
                  {!l.dashed && <circle cx={l.x2} cy={l.y2} r="4" fill={l.color} />}
                </g>
              ))}
            </svg>

            {/* คอลัมน์ซ้าย: คำจีน + pinyin */}
            <div className="space-y-3">
              {leftItems.map(item => {
                const conn = leftConnected(item.rowId);
                const isSel = selectedLeft === item.rowId;
                const color = conn ? (checked ? (item.rowId === conn.rightRowId ? '#16a34a' : '#dc2626') : colorOf(item.rowId)) : null;
                return (
                  <button
                    key={item.rowId}
                    ref={el => (leftRefs.current[item.rowId] = el)}
                    onClick={() => clickLeft(item.rowId)}
                    className={`relative w-full h-[68px] rounded-xl border-2 bg-white px-3 text-center shadow-sm transition active:scale-[0.98] flex flex-col items-center justify-center ${isSel ? 'ring-4 ring-orange-300' : ''}`}
                    style={color ? { borderColor: color } : { borderColor: '#e2e8f0' }}
                  >
                    {checked && conn && (
                      <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-[13px] font-black shadow-md z-20"
                        style={{ background: item.rowId === conn.rightRowId ? '#16a34a' : '#dc2626' }}>
                        {item.rowId === conn.rightRowId ? '✓' : '✗'}
                      </span>
                    )}
                    <div className="text-2xl font-black text-slate-900 leading-tight">
                      {highlightTarget(item.vocabulary, activeCard?.cn, color || '#f97316')}
                    </div>
                    <div className="text-xs font-bold text-slate-500 mt-0.5">{item.pinyin_vocab}</div>
                  </button>
                );
              })}
            </div>

            {/* คอลัมน์ขวา: คำแปลไทย */}
            <div className="space-y-3">
              {rightItems.map(item => {
                const conn = rightConnected(item.rowId);
                const color = conn ? (checked ? (item.rowId === conn.leftRowId ? '#16a34a' : '#dc2626') : colorOf(conn.leftRowId)) : null;
                // ตอนตรวจแล้ว: ช่องนี้เป็น "คำเฉลย" ของคู่ที่จับผิดไหม (มีคู่ผิดชี้เส้นประมาหา)
                const isAnswerReveal = checked && connections.some(c => c.leftRowId === item.rowId && c.rightRowId !== item.rowId);
                const revealBorder = isAnswerReveal && !color;
                return (
                  <button
                    key={item.rowId}
                    ref={el => (rightRefs.current[item.rowId] = el)}
                    onClick={() => clickRight(item.rowId)}
                    className={`relative w-full h-[68px] rounded-xl border-2 bg-white px-3 text-center shadow-sm transition active:scale-[0.98] flex items-center justify-center ${revealBorder ? 'border-dashed' : ''}`}
                    style={color ? { borderColor: color } : revealBorder ? { borderColor: '#16a34a' } : { borderColor: '#e2e8f0' }}
                  >
                    {checked && conn && (
                      <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-[13px] font-black shadow-md z-20"
                        style={{ background: item.rowId === conn.leftRowId ? '#16a34a' : '#dc2626' }}>
                        {item.rowId === conn.leftRowId ? '✓' : '✗'}
                      </span>
                    )}
                    {revealBorder && (
                      <span className="absolute -top-2 -left-2 px-1.5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-md z-20 bg-emerald-600">เฉลย</span>
                    )}
                    <div className="text-base font-bold text-slate-800 leading-tight">{item.th}</div>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* แถบปุ่ม */}
          {!checked ? (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={undo} disabled={connections.length === 0}
                className="px-5 py-3 rounded-full font-black uppercase text-xs shadow bg-slate-200 text-slate-700 disabled:opacity-40">ย้อนกลับ</button>
              <button onClick={reset} disabled={connections.length === 0}
                className="px-5 py-3 rounded-full font-black uppercase text-xs shadow bg-slate-200 text-slate-700 disabled:opacity-40">เริ่มใหม่</button>
              <button onClick={checkAnswers} disabled={!allMatched}
                className="px-8 py-3 rounded-full font-black uppercase text-xs shadow-lg bg-orange-500 text-white disabled:opacity-40">ตรวจคำตอบ</button>
            </div>
          ) : (
            <div className="mt-6 text-center">
              <div className="inline-block rounded-2xl bg-white shadow-lg border-2 border-slate-100 px-8 py-4 mb-4">
                <div className="text-xs uppercase font-black text-slate-500">ผลการจับคู่</div>
                <div className="text-3xl font-black mt-1" style={{ color: score === leftItems.length ? '#16a34a' : '#f97316' }}>
                  ถูก {score}/{leftItems.length}
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button onClick={reset}
                  className="px-6 py-3 rounded-full font-black uppercase text-xs shadow bg-slate-200 text-slate-700">เล่นซ้ำ</button>
                <button onClick={() => setPicker(true)}
                  className="px-6 py-3 rounded-full font-black uppercase text-xs shadow bg-slate-200 text-slate-700">เลือกตัวใหม่</button>
                {hasNext && (
                  <button onClick={goNext}
                    className="px-8 py-3 rounded-full font-black uppercase text-xs shadow-lg bg-orange-500 text-white">คำถัดไป →</button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
