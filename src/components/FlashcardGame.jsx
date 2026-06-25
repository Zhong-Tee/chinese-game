import React, { useEffect, useRef } from 'react';
import SpeakerButton from './SpeakerButton';
import { preloadChineseSpeech } from '../utils/chineseSpeech';
import { shouldFlashcardRearrange } from '../utils/sentenceTokens';

export default function FlashcardGame({
  onExitGame,
  setWrongWordToast,
  onAddCurrentToWrongList,
  activeLevel,
  currentCard,
  timer,
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
  onRearrangeBackspace,
  onRearrangeReset,
  onSubmitRearrange,
  typedAnswer = '',
  onTypingChange,
  onSubmitTyping,
}) {
  const typingInputRef = useRef(null);

  const showWrongToast = (msg) => {
    if (setWrongWordToast) {
      setWrongWordToast(msg);
      setTimeout(() => setWrongWordToast(null), 2500);
    }
  };
  const handleWrongButton = () => {
    if (onAddCurrentToWrongList) onAddCurrentToWrongList();
    else showWrongToast('ได้เพิ่มคำผิดไว้ใน list ให้แล้ว ดูรายการได้ที่ Settings');
  };

  const isRearrange = stage === 'rearrange';
  const isTyping = stage === 'typing';
  const hasRearrange = shouldFlashcardRearrange(activeLevel, currentCard);

  const typingStageNo = hasRearrange ? 4 : 3;

  const stageTitle = stage === 'pinyin'
    ? 'ช่วงที่ 1: เลือก Pinyin'
    : stage === 'meaning'
      ? 'ช่วงที่ 2: เลือกคำแปลไทย'
      : stage === 'rearrange'
        ? 'ช่วงที่ 3: เรียงประโยค'
        : `ช่วงที่ ${typingStageNo}: พิมพ์คำศัพท์`;

  const stageLabel = stage === 'pinyin'
    ? 'Pinyin ที่ถูกต้อง'
    : stage === 'meaning'
      ? 'คำแปลไทยที่ถูกต้อง'
      : stage === 'rearrange'
        ? 'ประโยคที่ถูกต้อง'
        : 'คำศัพท์ที่ถูกต้อง';

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

  return (
    <div
      className="flex flex-col items-center select-none w-full"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="w-full flex justify-between items-center mb-4 px-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExitGame?.()}
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
        </div>

        <div className={`text-3xl font-black italic ${timer < 3 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
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
                <p className="text-xs font-black uppercase text-slate-500 mt-2">คำแปลประโยค</p>
                <h2
                  className="mt-1 font-black text-slate-900 leading-snug break-words text-center"
                  style={{ fontSize: 'clamp(1.6rem, 7vw, 2.4rem)' }}
                >
                  {currentCard.translate || currentCard.th || '-'}
                </h2>
                {(currentCard.vocabulary || currentCard.pinyin_vocab) && (
                  <div className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-center">
                    <div className="text-xs font-black uppercase text-slate-500">Vocabulary</div>
                    <div className="font-bold text-slate-600 mt-1 break-words" style={{ fontSize: 'clamp(1rem, 4.5vw, 1.25rem)' }}>
                      {currentCard.pinyin_vocab || '-'}
                    </div>
                  </div>
                )}
              </>
            ) : isTyping ? (
              <>
                <div className={`relative mt-2 ${hideSpeaker ? '' : 'pr-12 sm:pr-14'}`}>
                  <h2
                    className="font-black text-slate-900 leading-none break-words text-center"
                    style={{ fontSize: 'clamp(2.5rem, 14vw, 4rem)' }}
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
                    style={{ fontSize: 'clamp(4rem, 18vw, 6.3rem)' }}
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
                            ? 'clamp(2.25rem, 11vw, 3.25rem)'
                            : 'clamp(1.45rem, 6.2vw, 1.85rem)',
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
                className={`min-h-[3.25rem] rounded-2xl border-2 p-2 mb-2 flex flex-wrap gap-1.5 items-center justify-center transition-colors ${
                  canShowStageFeedback
                    ? isStageCorrect
                      ? 'bg-emerald-50 border-emerald-600'
                      : 'bg-red-50 border-red-600'
                    : 'bg-white/80 border-dashed border-slate-300'
                }`}
              >
                {rearrangeAssembled.length === 0 ? (
                  <span className="text-slate-400 text-sm italic font-bold">แตะคำด้านล่างเพื่อเรียงประโยค</span>
                ) : (
                  rearrangeAssembled.map((id, i) => (
                    <button
                      key={`${id}-${i}`}
                      type="button"
                      onClick={() => onRearrangeRemoveAt?.(i)}
                      disabled={isStageAnswered}
                      className="bg-white border-2 border-orange-400 text-slate-800 px-2.5 py-1 rounded-xl font-black text-xl active:scale-95 disabled:opacity-90"
                    >
                      {rearrangeTokens.find((t) => t.id === id)?.text}
                    </button>
                  ))
                )}
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
                    disabled={rearrangeAssembled.length === 0}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-orange-500 border-2 border-orange-600 text-white font-black text-lg active:scale-95 disabled:opacity-40"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ส่งคำตอบ
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 justify-center">
                {rearrangeTokens.map((tk) => {
                  const used = rearrangeAssembled.includes(tk.id);
                  return (
                    <button
                      key={tk.id}
                      type="button"
                      onClick={() => onRearrangeTapToken?.(tk.id)}
                      disabled={used || isStageAnswered}
                      className={`px-3.5 py-2 rounded-xl font-black text-xl border-2 transition-all active:scale-95 ${
                        used
                          ? 'opacity-25 bg-slate-100 border-slate-200 text-slate-400'
                          : 'bg-white border-slate-200 text-slate-800 shadow-sm hover:border-orange-300'
                      }`}
                    >
                      {tk.text}
                    </button>
                  );
                })}
              </div>
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
                    className={`rounded-2xl border-2 px-4 py-2.5 font-black text-left transition text-[1.65rem] leading-tight ${
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
            <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-black ${isStageCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              <span>{isTimedOut ? 'หมดเวลา' : isStageCorrect ? 'ตอบถูกต้อง' : 'ตอบผิด'}: </span>
              <span>{stageLabel}: {correctAnswer || '-'}</span>
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
