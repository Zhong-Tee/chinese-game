import React, { useEffect } from 'react';
import { optimizeImageUrl } from '../utils/imageOptimizer';
import { preloadNextImages } from '../utils/imageLoader';

export default function FlashcardGame({ 
  setPage, 
  activeLevel, 
  currentCard, 
  setCurrentCard, 
  timer, 
  isFlipped, 
  setIsFlipped, 
  gameQueue, 
  handleAnswer, 
  setGameActive 
}) {
  // Lazy Load: โหลดภาพถัดไป 3-5 ภาพล่วงหน้าใน background
  useEffect(() => {
    if (currentCard && gameQueue.length > 0) {
      // หา index ของ currentCard ใน queue
      const currentIndex = gameQueue.findIndex(
        card => (card.id1 || card.id) === (currentCard.id1 || currentCard.id)
      );
      
      if (currentIndex >= 0 && currentIndex < gameQueue.length - 1) {
        // โหลดภาพถัดไป 5 ภาพ (background loading)
        const nextCards = gameQueue.slice(currentIndex + 1, currentIndex + 6);
        preloadNextImages(nextCards, 5);
      }
    }
  }, [currentCard, gameQueue]);

  return (
    <div 
      className="flex flex-col items-center select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      onDragStart={(e) => {
        if (e.target.tagName === 'IMG') {
          e.preventDefault();
        }
      }}
    >
      {/* Header ของเกม */}
      <div className="w-full flex justify-between items-center mb-6 px-2">
        <button 
          onClick={() => { setPage('fc-chars'); setGameActive(false); setCurrentCard(null); }} 
          className="text-slate-800 font-black text-xs underline italic uppercase"
        >
          Cancel
        </button>
        
        <div className="flex gap-2 font-black italic text-[10px]">
          <div className="bg-orange-600 text-white px-3 py-1 rounded-full shadow-sm">
            {activeLevel === 'mistakes' ? 'FIX' : 'LV ' + activeLevel}
          </div>
          <div className="bg-slate-800 text-white px-3 py-1 rounded-full shadow-sm uppercase tracking-tighter">
            Left: {gameQueue.length}
          </div>
        </div>

        <div className={`text-3xl font-black italic ${timer < 3 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
          {timer}s
        </div>
      </div>

      {/* ตัวการ์ด (3D Flip) */}
      <div className="w-full aspect-[3/4] perspective-1000 select-none">
        <div className={`relative w-full h-full transition-transform duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          {/* หน้าการ์ด (ภาษาจีน) */}
          <div className="absolute w-full h-full backface-hidden rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white">
            <img 
              src={optimizeImageUrl(currentCard.image_front_url)} 
              className="w-full h-full object-cover" 
              alt="front"
              loading="eager" // โหลดทันทีเพราะเป็นภาพปัจจุบัน
            />
          </div>
          {/* หลังการ์ด (คำแปล) */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white">
            <img 
              src={optimizeImageUrl(currentCard.image_back_url)} 
              className="w-full h-full object-cover" 
              alt="back"
              loading="eager" // โหลดทันทีเพราะเป็นภาพปัจจุบัน
            />
          </div>
        </div>
      </div>

      {/* ปุ่มควบคุม (จะแสดงเมื่อพลิกการ์ดแล้ว) */}
      {isFlipped ? (
        <div className="grid grid-cols-2 gap-4 w-full mt-10 animate-in zoom-in duration-300">
          <button 
            onClick={() => handleAnswer(false)} 
            className="bg-red-600 text-white py-6 rounded-3xl font-black shadow-xl active:scale-90 transition uppercase italic select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
          >
            WRONG
          </button>
          <button 
            onClick={() => handleAnswer(true)} 
            className="bg-emerald-600 text-white py-6 rounded-3xl font-black shadow-xl active:scale-90 transition uppercase italic select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
          >
            CORRECT
          </button>
        </div>
      ) : ( 
        <button 
          onClick={() => setIsFlipped(true)} 
          className="mt-10 text-slate-300 font-black border-b-2 border-slate-200 text-xs uppercase italic select-none"
          style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
        >
          Tap to reveal
        </button> 
      )}
    </div>
  );
}