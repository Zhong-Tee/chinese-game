import React, { useState } from 'react';
import { optimizeImageUrl } from '../utils/imageOptimizer';

export default function Library({ 
  setPage, 
  allMasterCards, 
  selectedIds, 
  libraryDetail, 
  setLibraryDetail, 
  libFlipped, 
  setLibFlipped 
}) {
  const [showSentence, setShowSentence] = useState(false);
  return (
    <div 
      className="space-y-4 pb-10 select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex items-center mb-4">
        <button onClick={() => setPage('dashboard')} className="text-orange-600 font-black italic underline uppercase text-xs">← Back to Menu</button>
      </div>
      <h2 className="text-2xl font-black italic uppercase text-center mb-6">Your Library ({selectedIds.length})</h2>
      <div className="grid grid-cols-3 gap-2">
        {allMasterCards && allMasterCards.length > 0 ? (
          allMasterCards
            .filter(c => {
              const cardId = Number(c?.id1 || c?.id);
              return selectedIds.includes(cardId);
            })
            .sort((a, b) => {
              const idA = Number(a?.id1 || a?.id || 0);
              const idB = Number(b?.id1 || b?.id || 0);
              return idA - idB;
            })
            .map(card => (
          <div key={card?.id1 || card?.id || Math.random()} onClick={() => { setLibraryDetail(card); setLibFlipped(false); setShowSentence(false); }} className="aspect-[3/4] rounded-xl overflow-hidden shadow-md border-2 border-white active:scale-95 transition">
            <img 
              src={optimizeImageUrl(card?.image_front_url || '')} 
              className="w-full h-full object-cover" 
              alt="thumb"
              loading="lazy"
            />
          </div>
            ))
        ) : (
          <div className="col-span-3 text-center text-slate-400 py-8">กำลังโหลดข้อมูล...</div>
        )}
      </div>
      {libraryDetail && (
        <div 
          className="fixed inset-0 bg-slate-900/95 z-[70] flex flex-col items-center justify-center p-6 text-center select-none"
          style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
          onDragStart={(e) => e.preventDefault()}
        >
          <button onClick={() => { setLibraryDetail(null); setShowSentence(false); }} className="absolute top-6 right-6 text-white text-3xl font-bold">&times;</button>
          
          {showSentence ? (
            // หน้าแสดงประโยค
            <>
              {/* กล่องข้อความสำหรับประโยค */}
              <div className="w-full max-w-2xl mb-6">
                <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-slate-200">
                  <div className="text-slate-800 text-[24pt] font-bold leading-relaxed text-left">
                    {libraryDetail.sentence_test || libraryDetail.sentence_text || libraryDetail.sentence || 'ไม่มีข้อมูลประโยค'}
                  </div>
                </div>
              </div>
              
              {/* กล่องข้อความแชทสำหรับคำแปล */}
              {libraryDetail.translate && (
                <div className="w-full max-w-2xl mb-6">
                  <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-slate-200">
                    <div className="text-slate-800 text-[24pt] font-bold leading-relaxed text-left">
                      {libraryDetail.translate}
                    </div>
                  </div>
                </div>
              )}
              
              <button 
                onClick={() => setShowSentence(false)} 
                className="bg-slate-600 text-white px-10 py-4 rounded-full font-black uppercase shadow-xl"
              >
                ← ย้อนกลับ
              </button>
            </>
          ) : (
            // หน้าแสดงการ์ดปกติ
            <>
              <div className="w-full max-w-sm aspect-[3/4] rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white mb-8">
                <img 
                  src={optimizeImageUrl(libFlipped ? libraryDetail.image_back_url : libraryDetail.image_front_url)} 
                  className="w-full h-full object-cover" 
                  alt="detail"
                  loading="eager"
                />
              </div>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setLibFlipped(!libFlipped)} 
                  className="bg-orange-500 text-white px-8 py-4 rounded-full font-black uppercase shadow-xl"
                >
                  {libFlipped ? "หน้า" : "คำแปล"}
                </button>
                
                <button 
                  onClick={() => setShowSentence(true)} 
                  className="bg-blue-500 text-white px-8 py-4 rounded-full font-black uppercase shadow-xl"
                >
                  ประโยค
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}