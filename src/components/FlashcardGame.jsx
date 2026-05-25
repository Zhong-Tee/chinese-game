import React from 'react';

export default function FlashcardGame({ 
  onExitGame,
  setWrongWordToast,
  onAddCurrentToWrongList,
  activeLevel, 
  currentCard, 
  setCurrentCard, 
  timer, 
  gameQueue, 
  stage,
  choices,
  selectedAnswer,
  correctAnswer,
  isStageCorrect,
  isStageAnswered,
  isTimedOut,
  onSelectChoice,
  onContinueStage,
}) {
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

  const stageTitle = stage === 'pinyin'
    ? 'ช่วงที่ 1: เลือก Pinyin'
    : 'ช่วงที่ 2: เลือกคำแปลไทย';

  const stageLabel = stage === 'pinyin' ? 'Pinyin ที่ถูกต้อง' : 'คำแปลไทยที่ถูกต้อง';
  const canShowStageFeedback = isStageAnswered;
  const shouldShowManualNext = isStageAnswered && (!isStageCorrect || isTimedOut);
  const pastelCardBackground = stage === 'pinyin' ? '#FEF3C7' : '#E0F2FE';

  return (
    <div 
      className="flex flex-col items-center select-none w-full"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Header ของเกม */}
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
            <h2
              className="leading-none font-black mt-2 text-slate-900 break-words"
              style={{ fontSize: 'clamp(4rem, 18vw, 6.3rem)' }}
            >
              {currentCard.cn || '-'}
            </h2>
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
                <div
                  className="font-black text-slate-900 mt-1 leading-snug break-words"
                  style={{ fontSize: 'clamp(1.45rem, 6.2vw, 1.85rem)' }}
                >
                  {currentCard.vocabulary || '-'}
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
          </div>

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