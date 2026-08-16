import React, { useEffect, useState } from 'react';
import SpeakerButton from './SpeakerButton';
import { preloadChineseSpeech } from '../utils/chineseSpeech';

export default function Library({ 
  setPage, 
  allMasterCards, 
  selectedIds, 
  libraryDetail, 
  setLibraryDetail, 
  setLibFlipped 
}) {
  const [libView, setLibView] = useState('front'); // 'front' | 'sentence'
  const [searchQuery, setSearchQuery] = useState('');

  const libraryCards = (allMasterCards || [])
    .filter((card) => {
      const cardId = Number(card?.id1 || card?.id);
      return selectedIds.includes(cardId);
    })
    .filter((card) => {
      const query = searchQuery.trim().toLocaleLowerCase();
      if (!query) return true;

      return [card?.cn, card?.vocabulary]
        .some((value) => String(value ?? '').toLocaleLowerCase().includes(query));
    })
    .sort((a, b) => {
      const idA = Number(a?.id1 || a?.id || 0);
      const idB = Number(b?.id1 || b?.id || 0);
      return idA - idB;
    });

  useEffect(() => {
    if (libraryDetail) setLibView('front');
  }, [libraryDetail]);

  useEffect(() => {
    preloadChineseSpeech();
  }, []);

  return (
    <div 
      className="space-y-4 pb-10 select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex items-center mb-4">
        <button onClick={() => setPage('dashboard')} className="text-orange-600 font-black italic underline uppercase text-xs">← Back to Menu</button>
      </div>
      <h2 className="text-2xl font-black italic uppercase text-center mb-6 text-slate-800">Your Library ({selectedIds.length})</h2>
      <div className="relative mb-5">
        <span
          aria-hidden="true"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        >
          &#128269;
        </span>
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="ค้นหาคำศัพท์..."
          aria-label="ค้นหาใน Library"
          className="w-full rounded-2xl border-2 border-white bg-white py-3 pl-11 pr-11 text-base font-bold text-slate-800 shadow-md outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="ล้างคำค้นหา"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-xl font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            &times;
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {allMasterCards && allMasterCards.length > 0 ? (
          libraryCards.length > 0 ? libraryCards.map(card => (
          <div
            key={card?.id1 || card?.id}
            onClick={() => { setLibraryDetail(card); setLibFlipped(false); }}
            className="aspect-[3/4] rounded-xl shadow-md border-2 border-white active:scale-95 transition p-2.5 flex flex-col justify-between bg-white"
          >
            <div className="text-[10px] text-right text-slate-500 font-bold">{card?.id1 || card?.id}</div>
            <div className="text-center">
              <div className="text-4xl font-black text-slate-900 leading-tight break-words">{card?.cn || '—'}</div>
              <div className="text-sm font-bold text-slate-700 mt-1 break-words">{card?.pinyin || '—'}</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black text-slate-900 leading-tight break-words">{card?.vocabulary || '—'}</div>
              <div className="text-xs font-bold text-slate-700 mt-0.5 break-words">{card?.pinyin_vocab || '—'}</div>
            </div>
          </div>
            )) : (
              <div className="col-span-3 py-12 text-center">
                <div className="mb-2 text-3xl" aria-hidden="true">&#128269;</div>
                <p className="font-bold text-slate-500">ไม่พบคำศัพท์ที่ค้นหา</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-3 text-sm font-black text-orange-600 underline"
                >
                  ล้างคำค้นหา
                </button>
              </div>
            )
        ) : (
          <div className="col-span-3 text-center text-slate-400 py-8">กำลังโหลดข้อมูล...</div>
        )}
      </div>
      {libraryDetail && (
        <div 
          className="fixed inset-0 bg-slate-900/95 z-[70] flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto"
          style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
          onDragStart={(e) => e.preventDefault()}
        >
          <button onClick={() => setLibraryDetail(null)} className="absolute top-6 right-6 text-white text-3xl font-bold z-10">&times;</button>

          {libView === 'sentence' ? (
            <>
              <div className="w-full max-w-sm rounded-2xl bg-white border-2 border-slate-200 shadow-xl p-6 mb-8 text-left space-y-4">
                <div>
                  <p className="text-orange-500 font-bold text-xs uppercase mb-1">ประโยค</p>
                  <p className="text-slate-800 text-lg font-medium break-words">{libraryDetail.sentence_test || '—'}</p>
                </div>
                <div>
                  <p className="text-orange-500 font-bold text-xs uppercase mb-1">คำแปล</p>
                  <p className="text-slate-800 text-lg font-medium break-words">{libraryDetail.translate || '—'}</p>
                </div>
              </div>
              <button onClick={() => { setLibView('front'); setLibFlipped(false); }} className="bg-slate-600 text-white px-10 py-4 rounded-full font-black uppercase shadow-xl">การ์ด</button>
            </>
          ) : (
            <>
              <div className="w-full max-w-sm rounded-[2rem] shadow-2xl border-4 border-white mb-8 p-6 bg-white">
                <div className="text-center space-y-3">
                  <div className="text-7xl font-black text-slate-900 leading-none break-words">{libraryDetail.cn || '—'}</div>
                  <div className="relative pr-11">
                    <div className="text-2xl font-bold text-slate-700 break-words">{libraryDetail.pinyin || '—'}</div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                      <SpeakerButton
                        text={libraryDetail.cn}
                        label="ฟังเสียงตัวอักษรจีน"
                        className="w-9 h-9"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/70 p-4 text-center mt-3">
                    <div className="text-xs uppercase font-black text-slate-500">Vocabulary</div>
                    <div className="text-3xl font-black text-slate-900 mt-1 break-words">{libraryDetail.vocabulary || '—'}</div>
                    <div className="relative pr-10 mt-1">
                      <div className="text-xl font-bold text-slate-700 break-words">{libraryDetail.pinyin_vocab || '—'}</div>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2">
                        <SpeakerButton
                          text={libraryDetail.vocabulary}
                          label="ฟังเสียงคำศัพท์จีน"
                          className="w-8 h-8"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/70 p-4 text-center mt-2">
                    <div className="text-xs uppercase font-black text-slate-500">คำแปลไทย</div>
                    <div className="text-3xl font-black text-slate-900 mt-1 break-words">{libraryDetail.th || '—'}</div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setLibView('sentence')}
                className="bg-orange-500 text-white px-10 py-4 rounded-full font-black uppercase shadow-xl"
              >
                ประโยค
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
