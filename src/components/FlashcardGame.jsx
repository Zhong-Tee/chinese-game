import React, { useEffect, useRef, useState } from 'react';
import SpeakerButton from './SpeakerButton';
import { preloadChineseSpeech } from '../utils/chineseSpeech';
import { shouldFlashcardRearrange } from '../utils/sentenceTokens';

export default function FlashcardGame({
  onExitGame,
  finishAfterCurrent = false,
  onToggleFinishAfterCurrent,
  setWrongWordToast,
  onAddCurrentToWrongList,
  activeLevel,
  currentCard,
  timer,
  remainingCount = 0,
  hasCardStarted = false,
  stage,
  choices,
  selectedAnswer,
  correctAnswer,
  isStageCorrect,
  isStageAnswered,
  isTimedOut,
  onSelectChoice,
  onContinueStage,
  rearrangeTokens = [],
  rearrangeAssembled = [],
  onRearrangeTapToken,
  onRearrangeRemoveAt,
  onRearrangeInsertToken,
  onRearrangeMoveToken,
  onRearrangeBackspace,
  onRearrangeReset,
  onSubmitRearrange,
  typedAnswer = '',
  onTypingChange,
  onSubmitTyping,
}) {
  const typingInputRef = useRef(null);
  const rearrangeAnswerRef = useRef(null);
  const rearrangeDragRef = useRef(null);
  const suppressRearrangeClickRef = useRef(false);
  const [rearrangeDrag, setRearrangeDrag] = useState(null);
  const [rearrangeDropIndex, setRearrangeDropIndex] = useState(null);
  const [pendingExit, setPendingExit] = useState(null);

  const showWrongToast = (msg) => {
    if (setWrongWordToast) {
      setWrongWordToast(msg);
      setTimeout(() => setWrongWordToast(null), 2500);
    }
  };
  const handleWrongButton = async () => {
    if (onAddCurrentToWrongList) await onAddCurrentToWrongList();
    else showWrongToast('ได้เพิ่มคำผิดไว้ใน list ให้แล้ว ดูรายการได้ที่ Settings');
  };

  const requestExit = (action) => {
    if (hasCardStarted) setPendingExit(() => action);
    else action?.();
  };

  const confirmExit = async () => {
    const action = pendingExit;
    setPendingExit(null);
    await action?.();
  };

  const isRearrange = stage === 'rearrange';
  const isTyping = stage === 'typing';
  const hasRearrange = shouldFlashcardRearrange(activeLevel, currentCard);
  const hasSelectedAllRearrangeTokens = rearrangeTokens.length > 0
    && rearrangeAssembled.length === rearrangeTokens.length;

  const typingStageNo = 3;
  const rearrangeStageNo = 4;

  const stageTitle = stage === 'pinyin'
    ? 'ช่วงที่ 1: เลือก Pinyin'
    : stage === 'meaning'
      ? 'ช่วงที่ 2: เลือกคำแปลไทย'
      : stage === 'typing'
        ? `ช่วงที่ ${typingStageNo}: พิมพ์คำศัพท์`
        : hasRearrange
          ? `ช่วงที่ ${rearrangeStageNo}: เรียงประโยค`
          : 'เรียงประโยค';

  const stageLabel = stage === 'pinyin'
    ? 'Pinyin ที่ถูกต้อง'
    : stage === 'meaning'
      ? 'คำแปลไทยที่ถูกต้อง'
      : stage === 'rearrange'
        ? 'ประโยคที่ถูกต้อง'
        : 'คำศัพท์ที่ถูกต้อง';

  const revealPinyin = stage === 'typing'
    ? currentCard.pinyin_vocab
    : '';

  const centerFeedback = stage === 'meaning' || stage === 'rearrange';
  const answerOnNewLine = stage === 'pinyin' || stage === 'meaning' || stage === 'rearrange';

  const hideSpeaker = typeof activeLevel === 'number' && activeLevel >= 3 && activeLevel <= 7;
  const canShowStageFeedback = isStageAnswered;
  const shouldShowManualNext = isStageAnswered && (!isStageCorrect || isTimedOut);
  const pastelCardBackground = stage === 'pinyin'
    ? '#FEF3C7'
    : stage === 'meaning'
      ? '#E0F2FE'
      : stage === 'rearrange'
        ? '#EDE9FE'
        : '#E0E7FF';

  useEffect(() => {
    preloadChineseSpeech();
  }, []);

  useEffect(() => {
    if (isTyping && !isStageAnswered) {
      const t = setTimeout(() => typingInputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isTyping, isStageAnswered]);

  const rearrangeTokenText = (tokenId) => rearrangeTokens.find((token) => token.id === tokenId)?.text || '';

  const findRearrangeDropIndex = (clientX, clientY) => {
    const container = rearrangeAnswerRef.current;
    if (!container) return null;
    const containerRect = container.getBoundingClientRect();
    const margin = 18;
    if (
      clientX < containerRect.left - margin
      || clientX > containerRect.right + margin
      || clientY < containerRect.top - margin
      || clientY > containerRect.bottom + margin
    ) return null;

    const itemRects = [...container.querySelectorAll('[data-rearrange-answer-token]')]
      .map((element, index) => ({ index, rect: element.getBoundingClientRect() }));
    if (!itemRects.length) return 0;

    const rows = itemRects.reduce((groups, item) => {
      const centerY = item.rect.top + item.rect.height / 2;
      const row = groups.find((group) => Math.abs(group.centerY - centerY) < 8);
      if (row) row.items.push(item);
      else groups.push({ centerY, items: [item] });
      return groups;
    }, []);
    const rowItems = rows.reduce((closest, row) => (
      Math.abs(row.centerY - clientY) < Math.abs(closest.centerY - clientY) ? row : closest
    )).items;
    const firstAfterPointer = rowItems.find(({ rect }) => clientX < rect.left + rect.width / 2);
    return firstAfterPointer ? firstAfterPointer.index : rowItems[rowItems.length - 1].index + 1;
  };

  const beginRearrangeDrag = (event, payload) => {
    if (isStageAnswered || event.button > 0) return;
    rearrangeDragRef.current = {
      ...payload,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveRearrangeDrag = (event) => {
    const activeDrag = rearrangeDragRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - activeDrag.startX, event.clientY - activeDrag.startY);
    if (!activeDrag.started && distance < 7) return;
    if (!activeDrag.started) {
      activeDrag.started = true;
      setRearrangeDrag({ ...activeDrag, x: event.clientX, y: event.clientY });
    } else {
      setRearrangeDrag((current) => current ? { ...current, x: event.clientX, y: event.clientY } : current);
    }
    event.preventDefault();
    setRearrangeDropIndex(findRearrangeDropIndex(event.clientX, event.clientY));
  };

  const endRearrangeDrag = (event) => {
    const activeDrag = rearrangeDragRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    if (activeDrag.started) {
      event.preventDefault();
      const insertIndex = findRearrangeDropIndex(event.clientX, event.clientY);
      if (insertIndex !== null) {
        if (activeDrag.source === 'bank') onRearrangeInsertToken?.(activeDrag.tokenId, insertIndex);
        else onRearrangeMoveToken?.(activeDrag.fromIndex, insertIndex);
      }
      suppressRearrangeClickRef.current = true;
      window.setTimeout(() => { suppressRearrangeClickRef.current = false; }, 0);
    }
    rearrangeDragRef.current = null;
    setRearrangeDrag(null);
    setRearrangeDropIndex(null);
  };

  const cancelRearrangeDrag = () => {
    rearrangeDragRef.current = null;
    setRearrangeDrag(null);
    setRearrangeDropIndex(null);
  };

  return (
    <div
      className="flex w-full flex-col items-center select-none pt-[calc(env(safe-area-inset-top)+2rem)]"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      onDragStart={(e) => e.preventDefault()}
    >
      {pendingExit && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="flashcard-exit-title">
          <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border-2 border-red-300 bg-white text-center shadow-2xl">
            <div className="bg-gradient-to-br from-red-500 to-red-700 px-6 py-6 text-white">
              <div className="text-5xl" aria-hidden="true">⚠️</div>
              <h2 id="flashcard-exit-title" className="mt-2 text-2xl font-black">ออกจากเกมตอนนี้?</h2>
            </div>
            <div className="px-6 py-6">
              <p className="font-bold text-slate-700">คำที่กำลังเล่นจะถูกนับว่าตอบผิดและกลับไป LV1</p>
              <div className={`my-4 text-5xl font-black italic ${timer < 3 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>{timer}s</div>
              <p className="text-xs font-bold text-slate-400">เวลายังคงเดินต่อระหว่างที่หน้าต่างนี้เปิดอยู่</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setPendingExit(null)} className="rounded-2xl border-2 border-slate-300 bg-white py-3 font-black text-slate-700 active:scale-95">เล่นต่อ</button>
                <button type="button" onClick={confirmExit} className="rounded-2xl border-2 border-red-700 bg-red-600 py-3 font-black text-white shadow-lg active:scale-95">ยืนยันออก</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-1">
        <div className="flex min-w-0 items-center gap-1.5 justify-self-start">
          <button
            onClick={() => requestExit(onExitGame)}
            className="text-slate-800 font-black text-xs underline italic uppercase"
          >
            Cancel
          </button>
          <button
            onClick={handleWrongButton}
            className="bg-amber-500 text-white px-2 py-1 rounded-full font-black text-[10px] italic uppercase"
          >
            คำผิด
          </button>
          <button
            type="button"
            onClick={() => onToggleFinishAfterCurrent?.()}
            aria-pressed={finishAfterCurrent}
            title={finishAfterCurrent ? 'จะจบเกมหลังคำนี้ กดอีกครั้งเพื่อยกเลิก' : 'จบเกมหลังเล่นคำนี้ครบทุกช่วง'}
            className={`rounded-full border-2 border-red-600 px-2.5 py-1 text-[10px] font-black italic shadow-md transition-all active:scale-90 ${
              finishAfterCurrent
                ? 'bg-red-600 text-white ring-2 ring-red-200'
                : 'bg-transparent text-red-600 shadow-none'
            }`}
          >
            จบ
          </button>
        </div>

        <div className="min-w-[2.5rem] rounded-xl bg-white/55 px-2 py-0.5 text-center text-3xl font-black tabular-nums text-slate-600 shadow-sm" aria-label={`เหลือ ${remainingCount} คำ`}>
          {remainingCount}
        </div>

        <div className={`justify-self-end text-3xl font-black italic ${timer < 3 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
          {timer}s
        </div>
      </div>

      <div className="w-full flex flex-col">
        <div
          className="w-full rounded-[1.8rem] border-4 border-white/80 shadow-2xl p-4 sm:p-5 flex flex-col"
          style={{ backgroundColor: pastelCardBackground }}
        >
          <div className="text-center mb-3">
            <p className="text-xs font-black uppercase italic text-orange-600">{stageTitle}</p>

            {isRearrange ? (
              <>
                {(currentCard.translate || currentCard.th) && (
                  <div className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-center">
                    <div className="text-xs font-black uppercase text-slate-500">ประโยคไทย</div>
                    <div
                      className="font-black text-slate-900 mt-1 break-words leading-snug"
                      style={{ fontSize: 'clamp(0.95rem, 4vw, 1.2rem)' }}
                    >
                      {currentCard.translate || currentCard.th}
                    </div>
                  </div>
                )}
                {(currentCard.pinyin_sentence || currentCard.sentence_test) && (
                  <div className="mt-2 rounded-2xl bg-white/70 px-4 py-3 text-center">
                    <div className="text-xs font-black uppercase text-slate-500">pinyin</div>
                    <div className={`relative mt-1 ${currentCard.sentence_test ? 'pr-11 sm:pr-12' : ''}`}>
                      {currentCard.pinyin_sentence ? (
                        <div
                          className="font-bold text-slate-700 break-words leading-snug"
                          style={{ fontSize: 'clamp(1rem, 4.2vw, 1.25rem)' }}
                        >
                          {currentCard.pinyin_sentence}
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-slate-400 italic">—</div>
                      )}
                      {currentCard.sentence_test && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2">
                          <SpeakerButton
                            text={currentCard.sentence_test}
                            label="ฟังเสียงประโยคจีน"
                            className="w-9 h-9 sm:w-10 sm:h-10"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : isTyping ? (
              <>
                <div className={`relative mt-2 ${hideSpeaker ? '' : 'pr-12 sm:pr-14'}`}>
                  <h2
                    className="font-black text-slate-900 leading-none break-words text-center"
                    style={{ fontSize: 'clamp(2rem, 11vw, 3rem)' }}
                  >
                    {currentCard.vocabulary || '-'}
                  </h2>
                  {!hideSpeaker && currentCard.vocabulary && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                      <SpeakerButton
                        text={currentCard.vocabulary}
                        label="ฟังเสียงคำศัพท์จีน"
                        className="w-10 h-10 sm:w-11 sm:h-11"
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={`relative mt-2 ${hideSpeaker ? '' : 'pr-12 sm:pr-14'}`}>
                  <h2
                    className="leading-none font-black text-slate-900 break-words text-center"
                    style={{ fontSize: 'clamp(2.1rem, 9.5vw, 3.5rem)' }}
                  >
                    {currentCard.cn || '-'}
                  </h2>
                  {!hideSpeaker && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                      <SpeakerButton
                        text={currentCard.cn}
                        label="ฟังเสียงตัวอักษรจีน"
                        className="w-10 h-10 sm:w-11 sm:h-11"
                      />
                    </div>
                  )}
                </div>
                {stage === 'meaning' && currentCard.pinyin && (
                  <p
                    className="text-slate-600 font-bold mt-1 break-words"
                    style={{ fontSize: 'clamp(1.45rem, 7vw, 2.1rem)' }}
                  >
                    {currentCard.pinyin}
                  </p>
                )}
                {(currentCard.vocabulary || currentCard.pinyin_vocab) && (
                  <div className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-center">
                    <div className="text-xs font-black uppercase text-slate-500">Vocabulary</div>
                    <div className={`relative mt-1 ${hideSpeaker ? '' : 'pr-11 sm:pr-12'}`}>
                      <div
                        className="font-black text-slate-900 leading-snug break-words text-center"
                        style={{
                          fontSize: stage === 'meaning'
                            ? 'clamp(1.35rem, 6.5vw, 1.85rem)'
                            : 'clamp(1.2rem, 5vw, 1.55rem)',
                        }}
                      >
                        {currentCard.vocabulary || '-'}
                      </div>
                      {!hideSpeaker && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2">
                          <SpeakerButton
                            text={currentCard.vocabulary}
                            label="ฟังเสียงคำศัพท์จีน"
                            className="w-9 h-9 sm:w-10 sm:h-10"
                          />
                        </div>
                      )}
                    </div>
                    {stage === 'meaning' && (
                      <div
                        className="font-bold text-slate-600 mt-1 break-words"
                        style={{ fontSize: 'clamp(1.05rem, 4.8vw, 1.35rem)' }}
                      >
                        {currentCard.pinyin_vocab || '-'}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {isRearrange ? (
            <>
              <div
                ref={rearrangeAnswerRef}
                className={`min-h-[3.25rem] rounded-2xl border-2 p-2 mb-2 flex flex-wrap gap-1.5 items-center justify-center transition-colors ${
                  canShowStageFeedback
                    ? isStageCorrect
                      ? 'bg-emerald-50 border-emerald-600'
                      : 'bg-red-50 border-red-600'
                    : 'bg-white/80 border-dashed border-slate-300'
                }`}
              >
                {rearrangeAssembled.length === 0 ? (
                  <span className={`text-sm italic font-bold ${rearrangeDropIndex === 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                    {rearrangeDropIndex === 0 ? 'ปล่อยคำที่นี่' : 'แตะหรือลากคำขึ้นมาเพื่อเรียงประโยค'}
                  </span>
                ) : (
                  rearrangeAssembled.map((id, i) => (
                    <React.Fragment key={id}>
                      {rearrangeDropIndex === i && <span className="h-9 w-1 shrink-0 rounded-full bg-orange-500 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]" aria-hidden="true" />}
                      <button
                        type="button"
                        data-rearrange-answer-token
                        onClick={() => {
                          if (!suppressRearrangeClickRef.current) onRearrangeRemoveAt?.(i);
                        }}
                        onPointerDown={(event) => beginRearrangeDrag(event, { source: 'answer', tokenId: id, fromIndex: i })}
                        onPointerMove={moveRearrangeDrag}
                        onPointerUp={endRearrangeDrag}
                        onPointerCancel={cancelRearrangeDrag}
                        disabled={isStageAnswered}
                        style={{ touchAction: 'none' }}
                        className={`cursor-grab bg-white border-2 border-orange-400 text-slate-800 px-2.5 py-1 rounded-xl font-black text-lg active:cursor-grabbing active:scale-95 disabled:opacity-90 ${rearrangeDrag?.source === 'answer' && rearrangeDrag.tokenId === id ? 'opacity-35' : ''}`}
                        aria-label={`${rearrangeTokenText(id)} ลากเพื่อย้ายลำดับ หรือแตะเพื่อนำออก`}
                      >
                        {rearrangeTokenText(id)}
                      </button>
                    </React.Fragment>
                  ))
                )}
                {rearrangeAssembled.length > 0 && rearrangeDropIndex === rearrangeAssembled.length && <span className="h-9 w-1 shrink-0 rounded-full bg-orange-500 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]" aria-hidden="true" />}
              </div>

              {!isStageAnswered && (
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => onRearrangeBackspace?.()}
                    disabled={rearrangeAssembled.length === 0}
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-black active:scale-95 disabled:opacity-40"
                    title="ลบคำตัวสุดท้าย"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRearrangeReset?.()}
                    disabled={rearrangeAssembled.length === 0}
                    className="flex items-center justify-center px-3 py-2 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-black active:scale-95 disabled:opacity-40"
                    title="ล้างทั้งหมด"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSubmitRearrange?.()}
                    disabled={!hasSelectedAllRearrangeTokens}
                    title={hasSelectedAllRearrangeTokens ? 'ส่งคำตอบ' : 'กรุณาเลือกคำให้ครบก่อนส่งคำตอบ'}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-orange-500 border-2 border-orange-600 text-white font-black text-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ส่งคำตอบ
                  </button>
                </div>
              )}

              {!isStageAnswered && (
                <p className="mb-2 text-center text-[11px] font-bold text-slate-500">
                  แตะเพื่อเพิ่ม · ลากขึ้นเพื่อแทรก · ลากคำด้านบนเพื่อย้ายลำดับ
                </p>
              )}

              <div className="flex flex-wrap gap-2 justify-center">
                {rearrangeTokens.map((tk) => {
                  const used = rearrangeAssembled.includes(tk.id);
                  return (
                    <button
                      key={tk.id}
                      type="button"
                      onClick={() => {
                        if (!suppressRearrangeClickRef.current) onRearrangeTapToken?.(tk.id);
                      }}
                      onPointerDown={(event) => beginRearrangeDrag(event, { source: 'bank', tokenId: tk.id })}
                      onPointerMove={moveRearrangeDrag}
                      onPointerUp={endRearrangeDrag}
                      onPointerCancel={cancelRearrangeDrag}
                      disabled={used || isStageAnswered}
                      style={{ touchAction: 'none' }}
                      className={`cursor-grab px-3.5 py-2 rounded-xl font-black text-lg border-2 transition-all active:cursor-grabbing active:scale-95 ${
                        used
                          ? 'opacity-25 bg-slate-100 border-slate-200 text-slate-400'
                          : `bg-white border-slate-200 text-slate-800 shadow-sm hover:border-orange-300 ${rearrangeDrag?.source === 'bank' && rearrangeDrag.tokenId === tk.id ? 'opacity-35' : ''}`
                      }`}
                      aria-label={`${tk.text} แตะเพื่อเพิ่ม หรือลากไปวางด้านบน`}
                    >
                      {tk.text}
                    </button>
                  );
                })}
              </div>
              {rearrangeDrag && (
                <div
                  className="pointer-events-none fixed z-[200] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-orange-500 bg-white px-3.5 py-2 text-lg font-black text-slate-800 shadow-2xl"
                  style={{ left: rearrangeDrag.x, top: rearrangeDrag.y }}
                  aria-hidden="true"
                >
                  {rearrangeTokenText(rearrangeDrag.tokenId)}
                </div>
              )}
            </>
          ) : isTyping ? (
            <div className="flex items-stretch gap-2">
              <input
                ref={typingInputRef}
                type="text"
                lang="zh-CN"
                inputMode="text"
                enterKeyHint="done"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={typedAnswer}
                disabled={isStageAnswered}
                onChange={(e) => onTypingChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSubmitTyping?.();
                  }
                }}
                placeholder="พิมพ์คำศัพท์ภาษาจีน"
                className={`flex-[4] min-w-0 rounded-2xl border-2 px-4 py-3 text-3xl font-black text-center outline-none transition-colors ${
                  isStageAnswered
                    ? isStageCorrect
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-700'
                      : 'bg-red-50 border-red-600 text-red-700'
                    : 'bg-white border-slate-200 text-slate-800 placeholder:text-base placeholder:font-bold placeholder:text-slate-400'
                }`}
              />
              {!isStageAnswered && (
                <button
                  type="button"
                  onClick={() => onSubmitTyping?.()}
                  disabled={!typedAnswer.trim()}
                  className="flex-1 min-w-0 flex items-center justify-center px-1 rounded-2xl bg-orange-500 border-2 border-orange-600 text-white font-black active:scale-95 disabled:opacity-40"
                  aria-label="ส่งคำตอบ"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {choices.map((choice, index) => {
                const isSelected = selectedAnswer === choice;
                const isCorrectChoice = correctAnswer === choice;
                const showAsCorrect = canShowStageFeedback && isCorrectChoice;
                const showAsWrong = canShowStageFeedback && isSelected && !isStageCorrect;

                return (
                  <button
                    key={`${stage}-${index}-${choice}`}
                    onClick={() => onSelectChoice(choice)}
                    disabled={isStageAnswered}
                    className={`rounded-2xl border-2 px-4 py-2.5 font-black text-left transition leading-tight ${
                      stage === 'meaning' ? 'text-[1.05rem]' : 'text-[1.2rem]'
                    } ${
                      showAsCorrect
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : showAsWrong
                          ? 'border-red-600 bg-red-50 text-red-700'
                          : isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-800'
                    } ${isStageAnswered ? 'opacity-95' : 'active:scale-[0.98]'}`}
                  >
                    <span className="mr-2 text-slate-400">{index + 1}.</span> {choice}
                  </button>
                );
              })}
            </div>
          )}

          {canShowStageFeedback && (
            <div className={`mt-4 rounded-2xl px-4 py-3.5 font-black ${isStageCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              <div className={`text-base sm:text-lg ${centerFeedback ? 'text-center' : ''}`}>
                <span>{revealPinyin ? 'Pinyin ที่ถูกต้อง' : stageLabel}: </span>
                {!revealPinyin && !answerOnNewLine && (
                  <span style={{ fontSize: 'clamp(1.5rem, 7vw, 2.25rem)' }}>{correctAnswer || '-'}</span>
                )}
              </div>
              {!revealPinyin && answerOnNewLine && (
                <div className="mt-1 font-black text-center" style={{ fontSize: 'clamp(1.6rem, 8vw, 2.5rem)' }}>{correctAnswer || '-'}</div>
              )}
              {revealPinyin && (
                <div className="mt-1 font-black text-center" style={{ fontSize: 'clamp(1.6rem, 8vw, 2.5rem)' }}>{revealPinyin}</div>
              )}
            </div>
          )}
        </div>

        <div className="w-full mt-3 shrink-0">
          {shouldShowManualNext ? (
            <button
              onClick={onContinueStage}
              className="w-full py-3.5 rounded-2xl font-black uppercase italic bg-orange-500 text-white shadow-xl active:scale-95 transition"
            >
              ข้อถัดไป
            </button>
          ) : (
            <div className="h-[52px]" />
          )}
        </div>
      </div>
    </div>
  );
}
