import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { cancelChineseSpeech, speakChinese } from '../utils/chineseSpeech';
import { recordDailyBookRead } from '../utils/dailyMissionStorage';

const CATEGORIES = [
  { id: 'daily-life', label: 'ชีวิตประจำวัน', icon: '🏡' },
  { id: 'school', label: 'โรงเรียน', icon: '🏫' },
  { id: 'family-friends', label: 'ครอบครัวและเพื่อน', icon: '👨‍👩‍👧‍👦' },
  { id: 'chinese-food', label: 'อาหารจีน', icon: '🥟' },
  { id: 'travel', label: 'การเดินทาง', icon: '🧳' },
  { id: 'animals', label: 'สัตว์', icon: '🐼' },
  { id: 'adventure', label: 'ผจญภัย', icon: '🧭' },
  { id: 'fantasy', label: 'แฟนตาซี', icon: '🐉' },
  { id: 'chinese-culture', label: 'วัฒนธรรมจีน', icon: '🏮' },
  { id: 'mystery', label: 'เรื่องลึกลับ', icon: '🔎' },
  { id: 'moral-story', label: 'นิทานสอนใจ', icon: '🌱' },
  { id: 'learned-words', label: 'คำศัพท์ที่เรียนแล้ว', icon: '🎓' },
  { id: 'one-hundred-thousand-whys', label: '十万个为什么', subtitle: 'คำถามทำไมรอบตัว', icon: '💡' },
  { id: 'jokes', label: 'เรื่องตลก', icon: '😄' },
  { id: 'series', label: 'ซีรีส์', icon: '🎬', filterOnly: true },
];

const LEVELS = [
  { id: 'beginner', label: 'เริ่มต้น', detail: 'ประโยคสั้น คำศัพท์พื้นฐาน' },
  { id: 'easy', label: 'ง่าย', detail: 'อ่านสบาย เหมาะกับผู้เรียนทั่วไป' },
  { id: 'intermediate', label: 'ปานกลาง', detail: 'ประโยคและเนื้อเรื่องซับซ้อนขึ้น' },
  { id: 'advanced', label: 'ยาก', detail: 'ประโยคซับซ้อน คำเชื่อมและสำนวนระดับสูง' },
];
const LENGTHS = [
  { minutes: 3, pages: 4 },
  { minutes: 5, pages: 6 },
  { minutes: 8, pages: 8 },
  { minutes: 15, pages: 12 },
];
const TEXT_MODELS = [
  { id: 'gpt-5.6-luna', label: 'ประหยัด', detail: 'Luna · $' },
  { id: 'gpt-5.6-terra', label: 'มาตรฐาน', detail: 'Terra · $$', recommended: true },
  { id: 'gpt-5.6-sol', label: 'คุณภาพสูง', detail: 'Sol · $$$' },
];
const SERIES_GENRES = [
  { id: 'adventure', label: 'ผจญภัย', icon: '🧭' },
  { id: 'school', label: 'ชีวิตในโรงเรียน', icon: '🏫' },
  { id: 'friendship', label: 'มิตรภาพและการเติบโต', icon: '🤝' },
  { id: 'fantasy', label: 'แฟนตาซี', icon: '🐉' },
  { id: 'mystery', label: 'ลึกลับสืบสวน', icon: '🔎' },
  { id: 'science', label: 'วิทยาศาสตร์และอนาคต', icon: '🚀' },
  { id: 'youth', label: 'ชีวิตวัยรุ่น', icon: '🌱' },
  { id: 'chinese-culture', label: 'วัฒนธรรมจีน', icon: '🏮' },
];
const FONT_SIZES = [18, 22, 26, 32, 40];
const DAILY_BOOK_LIMIT = 5;
const BOOKS_PER_PAGE = 60;

function money(value, currency = 'USD') {
  const amount = Number(value || 0);
  return currency === 'THB' ? `฿${amount.toFixed(2)}` : `$${amount.toFixed(5)}`;
}

function categoryMeta(id) {
  return CATEGORIES.find((item) => item.id === id) || { label: id || 'หนังสือ', icon: '📖' };
}

function levelLabel(id) {
  return LEVELS.find((item) => item.id === id)?.label || id || 'ไม่ระบุระดับ';
}

async function functionErrorMessage(data, invokeError, fallback) {
  if (data?.error) return data.error;
  if (invokeError?.context?.json) {
    try {
      const errorBody = await invokeError.context.json();
      if (errorBody?.error) return errorBody.error;
    } catch {
      // The response body may already have been consumed by the Supabase client.
    }
  }
  return invokeError?.message || fallback;
}

function BookCover({ book, onOpen, isRead = book._isRead || false, canDelete = false, deleting = false, onDelete, canCancel = false, canceling = false, onCancel }) {
  const category = categoryMeta(book.category);
  return (
    <div className="relative">
    <button type="button" onClick={() => onOpen(book)} className="group w-full overflow-hidden rounded-[1.4rem] border-2 border-white bg-white text-left shadow-lg transition active:scale-[0.98]">
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-orange-300 via-amber-100 to-cyan-200">
        {book.cover_url ? <img src={book.cover_url} alt={`ปก ${book.title_th || book.title_cn}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center"><span className="text-6xl">{category.icon}</span><span className="text-xl font-black text-slate-800">{book.title_cn || 'กำลังสร้างหนังสือ'}</span></div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-slate-950/75 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur">{book.book_format === 'series' ? `ซีรีส์ · ตอน ${book.episode_number || 1}/${book.series_total || 10}` : category.label}</span>
        {isRead && <span className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-lg font-black text-white shadow-lg" aria-label="อ่านจบแล้ว" title="อ่านจบแล้ว">✓</span>}
        {book.status !== 'ready' && <span className="absolute inset-x-2 bottom-2 rounded-xl bg-amber-400/95 px-2 py-1.5 text-center text-xs font-black text-slate-900">{book.status === 'failed' ? 'สร้างไม่สำเร็จ' : 'กำลังสร้าง...'}</span>}
      </div>
      <div className="space-y-1 p-3">
        <h3 className="line-clamp-1 text-base font-black text-slate-900">{book.title_cn || 'หนังสือเล่มใหม่'}</h3>
        <p className="line-clamp-1 text-xs font-bold text-orange-600">{book.title_pinyin || category.label}</p>
        <p className="line-clamp-1 text-xs text-slate-500">{book.title_th || `${book.reading_minutes || 5} นาที`}</p>
        <div className="flex items-center justify-between gap-2 pt-1 text-[10px] font-bold text-slate-400"><span className="min-w-0 truncate">{book.creator_name || 'นักอ่าน Nihao'} · {levelLabel(book.language_level)}</span><span className="shrink-0">{book.reading_minutes || 5} นาที</span></div>
      </div>
    </button>
    {canDelete && (
      <button
        type="button"
        onClick={() => onDelete(book)}
        disabled={deleting}
        className={`absolute right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-red-500 text-base text-white shadow-lg transition active:scale-90 disabled:opacity-50 ${isRead ? 'top-12' : 'top-2'}`}
        aria-label={`ลบหนังสือ ${book.title_th || book.title_cn || ''}`}
        title="ลบหนังสือ (Admin เท่านั้น)"
      >
        {deleting ? '…' : '🗑️'}
      </button>
    )}
    {canCancel && (
      <button
        type="button"
        onClick={() => onCancel(book)}
        disabled={canceling}
        className={`absolute right-2 z-10 min-h-9 rounded-full border-2 border-white bg-red-500 px-3 text-[10px] font-black text-white shadow-lg transition hover:bg-red-600 active:scale-90 disabled:opacity-50 ${(isRead && canDelete) ? 'top-[5.5rem]' : (isRead || canDelete) ? 'top-12' : 'top-2'}`}
        aria-label={`ยกเลิกการสร้าง ${book.title_th || book.title_cn || 'หนังสือ'}`}
      >
        {canceling ? 'กำลังยกเลิก…' : '✕ ยกเลิก'}
      </button>
    )}
    </div>
  );
}

function Reader({ book, onClose, onComplete, completing = false, canSeeCost, canCreateNext = false, creatingNext = false, onCreateNext }) {
  const [showPinyin, setShowPinyin] = useState(() => localStorage.getItem('book-reader-pinyin') !== 'false');
  const [showThai, setShowThai] = useState(() => localStorage.getItem('book-reader-thai') !== 'false');
  const [fontIndex, setFontIndex] = useState(() => {
    const stored = Number(localStorage.getItem('book-reader-font-index'));
    return Number.isInteger(stored) && stored >= 0 && stored < FONT_SIZES.length ? stored : 2;
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [audioMode, setAudioMode] = useState(() => localStorage.getItem('book-reader-audio-mode') || 'manual');
  const pages = Array.isArray(book.pages) ? book.pages : [];
  const page = pages[pageIndex];
  const speechText = useMemo(() => (page?.paragraphs || [])
    .map((paragraph) => (paragraph.segments || []).map((segment) => segment.hanzi).join(''))
    .join(' '), [page]);
  const saveToggle = (key, setter) => setter((value) => { localStorage.setItem(key, String(!value)); return !value; });
  const changeFont = (delta) => setFontIndex((value) => {
    const next = Math.max(0, Math.min(FONT_SIZES.length - 1, value + delta));
    localStorage.setItem('book-reader-font-index', String(next));
    return next;
  });

  useEffect(() => {
    if (audioMode !== 'auto' || !speechText) return undefined;
    speakChinese(speechText);
    return undefined;
  }, [audioMode, pageIndex, speechText]);

  useEffect(() => () => cancelChineseSpeech(), []);

  const selectAudioMode = (mode) => {
    localStorage.setItem('book-reader-audio-mode', mode);
    setAudioMode(mode);
    if (mode === 'manual') speakChinese(speechText);
  };

  if (!page) return null;
  const legacyHeading = String(page.heading || '').trim();
  const legacyHeadingIsChinese = /[\u3400-\u9fff]/u.test(legacyHeading);
  const headingCn = page.heading_cn || (legacyHeadingIsChinese ? legacyHeading : book.title_cn);
  const headingPinyin = page.heading_pinyin || '';
  const headingThai = page.heading_thai || (!legacyHeadingIsChinese ? legacyHeading : '');
  const showContentImage = book.content_image_url && pageIndex === Number(book.content_image_page ?? Math.floor(pages.length / 2));

  return (
    <div className="fixed inset-0 z-[120] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#FBF4E6] text-slate-800">
      <header className="flex flex-col gap-2 border-b border-orange-200 bg-white/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-sm backdrop-blur sm:flex-row sm:items-center">
        <div className="flex w-full min-w-0 items-center gap-2">
          <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl font-black" aria-label="ปิดหนังสือ">×</button>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-slate-900">{book.title_cn}</div><div className="text-[10px] font-bold text-slate-400">หน้า {pageIndex + 1} / {pages.length}</div></div>
        </div>
        <div className="grid w-full shrink-0 grid-cols-[1.2fr_0.9fr_0.65fr_0.65fr_0.65fr_0.65fr] gap-1.5 sm:w-auto sm:min-w-[30rem] sm:gap-2">
          <button type="button" onClick={() => saveToggle('book-reader-pinyin', setShowPinyin)} aria-pressed={showPinyin} className={`h-10 rounded-xl px-2 text-xs font-black ${showPinyin ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>拼 Pinyin</button>
          <button type="button" onClick={() => saveToggle('book-reader-thai', setShowThai)} aria-pressed={showThai} className={`h-10 rounded-xl px-2 text-xs font-black ${showThai ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-500'}`}>ไทย</button>
          <button type="button" onClick={() => selectAudioMode('manual')} aria-label="เล่นเสียงหน้าปัจจุบัน" title="เล่น" aria-pressed={audioMode === 'manual'} className={`h-10 rounded-xl border-2 text-lg transition active:scale-95 ${audioMode === 'manual' ? 'border-orange-500 bg-orange-500 text-white' : 'border-orange-200 bg-white text-orange-600'}`}>🔊</button>
          <button type="button" onClick={() => selectAudioMode('auto')} aria-label="เล่นเสียงอัตโนมัติเมื่อเปลี่ยนหน้า" title="เล่นอัตโนมัติ" aria-pressed={audioMode === 'auto'} className={`h-10 rounded-xl border-2 text-lg transition active:scale-95 ${audioMode === 'auto' ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-cyan-200 bg-white text-cyan-700'}`}>🔁</button>
          <button type="button" onClick={() => changeFont(-1)} disabled={fontIndex === 0} className="h-10 rounded-xl bg-slate-100 font-black disabled:opacity-30" aria-label="ลดขนาดอักษร">A−</button>
          <button type="button" onClick={() => changeFont(1)} disabled={fontIndex === FONT_SIZES.length - 1} className="h-10 rounded-xl bg-slate-100 text-lg font-black disabled:opacity-30" aria-label="เพิ่มขนาดอักษร">A+</button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-5 py-6">
        <article className="mx-auto max-w-2xl rounded-[2rem] border border-orange-100 bg-white p-5 shadow-xl sm:p-8">
          <div className="mb-5 min-w-0">
            <p className="text-xs font-black uppercase tracking-wider text-orange-500">บทที่ {pageIndex + 1}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">{headingCn}</h2>
            {showPinyin && headingPinyin && <p className="mt-1 text-sm font-bold text-orange-500">{headingPinyin}</p>}
            {showThai && headingThai && <p className="mt-1 text-sm font-bold text-slate-500">{headingThai}</p>}
          </div>
          {showContentImage && <img src={book.content_image_url} alt="ภาพประกอบเนื้อหา" className="mb-6 aspect-[4/3] w-full rounded-2xl object-cover shadow-md" />}
          <div className="space-y-6">
            {(page.paragraphs || []).map((paragraph, paragraphIndex) => (
              <div key={paragraphIndex} className="space-y-2">
                <div className="flex flex-wrap items-end gap-x-2 gap-y-3 leading-relaxed" style={{ fontSize: FONT_SIZES[fontIndex] }}>
                  {(paragraph.segments || []).map((segment, segmentIndex) => <span key={`${segment.hanzi}-${segmentIndex}`} className="inline-flex flex-col items-center">{showPinyin && <span className="mb-0.5 text-[0.52em] font-bold leading-tight text-orange-500">{segment.pinyin}</span>}<span className="font-semibold text-slate-900">{segment.hanzi}</span></span>)}
                </div>
                {showThai && paragraph.thai && <p className="rounded-xl bg-orange-50 px-3 py-2 text-sm leading-relaxed text-slate-600">{paragraph.thai}</p>}
              </div>
            ))}
          </div>
          {pageIndex === pages.length - 1 && canSeeCost && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm"><div className="font-black text-emerald-800">ค่าใช้จ่ายในการสร้างเล่มนี้</div><div className="mt-1 font-bold text-emerald-700">{money(book.generation_cost_usd)} · ประมาณ {money(book.generation_cost_thb, 'THB')}</div></div>}
          {pageIndex === pages.length - 1 && book.book_format === 'series' && (
            <div className="mt-6 rounded-2xl border-2 border-violet-200 bg-violet-50 p-4 text-center">
              <div className="font-black text-violet-900">ซีรีส์ตอนที่ {book.episode_number || 1} / {book.series_total || 10}</div>
              {Number(book.episode_number || 1) >= Number(book.series_total || 10)
                ? <p className="mt-1 text-sm font-bold text-violet-600">จบซีรีส์แล้ว 🎉</p>
                : canCreateNext
                  ? <button type="button" onClick={() => onCreateNext?.(book)} disabled={creatingNext} className="mt-3 min-h-12 w-full rounded-2xl bg-violet-600 px-4 py-3 font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60">{creatingNext ? 'กำลังสร้างตอนถัดไป…' : `สร้างตอนที่ ${Number(book.episode_number || 1) + 1} →`}</button>
                  : <p className="mt-1 text-sm font-bold text-violet-600">ผู้สร้างซีรีส์เป็นผู้สร้างตอนถัดไปได้</p>}
            </div>
          )}
        </article>
      </main>
      <footer className="shrink-0 border-t border-orange-200 bg-[#FBF4E6] px-4 pb-[max(0.8rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button type="button" onClick={() => setPageIndex((value) => Math.max(0, value - 1))} disabled={pageIndex === 0} className="h-12 flex-1 rounded-2xl bg-slate-200 font-black text-slate-700 disabled:opacity-30">← ก่อนหน้า</button>
          <div className="flex gap-1" aria-hidden="true">{pages.map((_, index) => <span key={index} className={`h-2 rounded-full transition-all ${index === pageIndex ? 'w-5 bg-orange-500' : 'w-2 bg-slate-200'}`} />)}</div>
          {pageIndex < pages.length - 1 ? <button type="button" onClick={() => setPageIndex((value) => Math.min(pages.length - 1, value + 1))} className="h-12 flex-1 rounded-2xl bg-orange-500 font-black text-white">ถัดไป →</button> : <button type="button" onClick={() => onComplete?.(book)} disabled={completing} className="h-12 flex-1 rounded-2xl bg-emerald-500 font-black text-white disabled:opacity-60">{completing ? 'กำลังบันทึก…' : 'อ่านจบแล้ว ✓'}</button>}
        </div>
      </footer>
    </div>
  );
}

function CreateBookModal({ user, allMasterCards, selectedIds, quotaUsed, quotaLimit, onClose, onCreated }) {
  const [bookFormat, setBookFormat] = useState('standalone');
  const [category, setCategory] = useState('daily-life');
  const [seriesGenre, setSeriesGenre] = useState('adventure');
  const [level, setLevel] = useState('easy');
  const [minutes, setMinutes] = useState(5);
  const [textModel, setTextModel] = useState('gpt-5.6-terra');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('สนุกและอบอุ่น');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const learnedWords = useMemo(() => {
    if (bookFormat !== 'standalone' || category !== 'learned-words') return [];
    const selected = new Set((selectedIds || []).map(Number));
    return (allMasterCards || []).filter((card) => selected.has(Number(card.id1 || card.id))).slice(0, 80).map((card) => ({ hanzi: card.cn || card.vocabulary, pinyin: card.pinyin || card.pinyin_vocab, thai: card.th })).filter((word) => word.hanzi);
  }, [allMasterCards, bookFormat, category, selectedIds]);

  useEffect(() => {
    if (!submitting) return undefined;
    const startedAt = Date.now();
    const timerId = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    const preventExit = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventExit);
    return () => {
      window.clearInterval(timerId);
      window.removeEventListener('beforeunload', preventExit);
    };
  }, [submitting]);

  const progress = elapsedSeconds < 15
    ? 10 + (elapsedSeconds * 1.3)
    : elapsedSeconds < 60
      ? 30 + ((elapsedSeconds - 15) * 0.8)
      : elapsedSeconds < 150
        ? 66 + ((elapsedSeconds - 60) * 0.27)
        : 92;
  const progressLabel = elapsedSeconds < 15
    ? 'กำลังเตรียมโครงเรื่อง…'
    : elapsedSeconds < 60
      ? 'กำลังเขียนภาษาจีน Pinyin และคำแปล…'
      : elapsedSeconds < 150
        ? 'กำลังวาดภาพปกและภาพประกอบ…'
        : 'กำลังบันทึกและตรวจสอบหนังสือ…';
  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
  const quotaReached = Number.isFinite(quotaUsed) && quotaUsed >= quotaLimit;

  const submit = async (event) => {
    event.preventDefault();
    if (quotaReached) {
      setError(`คุณใช้โควต้าครบ ${quotaLimit} ครั้งในช่วง 24 ชั่วโมงแล้ว กรุณารอให้โควต้าเปิดอีกครั้ง`);
      return;
    }
    setElapsedSeconds(0); setSubmitting(true); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-book', { body: { bookFormat, category, seriesGenre, languageLevel: level, readingMinutes: minutes, textModel, topic: topic.trim(), tone, learnedWords } });
      if (invokeError || !data?.book) {
        let serverMessage = data?.error;
        if (!serverMessage && invokeError?.context?.json) {
          try {
            const errorBody = await invokeError.context.json();
            serverMessage = errorBody?.error;
          } catch {
            // The response body may already have been consumed by the Supabase client.
          }
        }
        const message = serverMessage || invokeError?.message || 'ไม่สามารถสร้างหนังสือได้';
        setError(message.includes('Failed to send')
          ? 'เชื่อมต่อระบบสร้างหนังสือไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ต แล้วรอสักครู่ก่อนลองใหม่เพื่อป้องกันการสร้างซ้ำ'
          : message);
        return;
      }
      onCreated(data.book);
    } catch (submitError) {
      setError(submitError?.message || 'เชื่อมต่อระบบสร้างหนังสือไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/85 p-4 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm">
      <form onSubmit={submit} className="mx-auto max-w-lg overflow-hidden rounded-[2rem] bg-[#FBF4E6] shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-5 text-white"><div><p className="text-xs font-black uppercase tracking-widest text-orange-100">AI Book Studio</p><h2 className="text-2xl font-black">สร้างหนังสือใหม่</h2></div><button type="button" onClick={onClose} disabled={submitting} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20 disabled:cursor-not-allowed disabled:opacity-35" title={submitting ? 'กรุณารอจนสร้างหนังสือเสร็จ' : 'ปิด'} aria-label="ปิด"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
        <div className="space-y-6 p-5">
          <fieldset><legend className="mb-3 font-black text-slate-800">1. รูปแบบหนังสือ</legend><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setBookFormat('standalone')} className={`rounded-2xl border-2 p-3 text-center font-black ${bookFormat === 'standalone' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-white bg-white text-slate-700'}`}>📕 เล่มเดียวจบ</button><button type="button" onClick={() => setBookFormat('series')} className={`rounded-2xl border-2 p-3 text-center font-black ${bookFormat === 'series' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-white bg-white text-slate-700'}`}>🎬 ซีรีส์ 10 ตอน</button></div></fieldset>
          {bookFormat === 'standalone'
            ? <fieldset><legend className="mb-3 font-black text-slate-800">2. เลือกหมวดหมู่</legend><div className="grid grid-cols-2 gap-2">{CATEGORIES.filter((item) => !item.filterOnly).map((item) => <button key={item.id} type="button" onClick={() => setCategory(item.id)} className={`rounded-2xl border-2 p-3 text-left transition ${category === item.id ? 'border-orange-500 bg-orange-50 shadow-md' : 'border-white bg-white'}`}><span className="mr-2 text-xl">{item.icon}</span><span className="text-sm font-black text-slate-800">{item.label}</span>{item.subtitle && <span className="mt-1 block pl-8 text-[10px] text-slate-400">{item.subtitle}</span>}</button>)}</div></fieldset>
            : <fieldset><legend className="mb-3 font-black text-slate-800">2. แนวซีรีส์เยาวชน</legend><div className="grid grid-cols-2 gap-2">{SERIES_GENRES.map((item) => <button key={item.id} type="button" onClick={() => setSeriesGenre(item.id)} className={`rounded-2xl border-2 p-3 text-left transition ${seriesGenre === item.id ? 'border-violet-500 bg-violet-50 shadow-md' : 'border-white bg-white'}`}><span className="mr-2 text-xl">{item.icon}</span><span className="text-sm font-black text-slate-800">{item.label}</span></button>)}</div><p className="mt-2 text-xs font-bold text-violet-600">เริ่มจากตอนที่ 1 และสร้างตอนถัดไปได้เมื่ออ่านจบ สูงสุด 10 ตอน</p></fieldset>}
          <fieldset><legend className="mb-3 font-black text-slate-800">3. ระดับภาษาจีน</legend><div className="space-y-2">{LEVELS.map((item) => <button key={item.id} type="button" onClick={() => setLevel(item.id)} className={`flex w-full items-center justify-between rounded-2xl border-2 p-3 text-left ${level === item.id ? 'border-cyan-500 bg-cyan-50' : 'border-white bg-white'}`}><span><span className="block text-sm font-black text-slate-800">{item.label}</span><span className="text-xs text-slate-400">{item.detail}</span></span><span className={`h-5 w-5 rounded-full border-4 ${level === item.id ? 'border-cyan-500 bg-white' : 'border-slate-200'}`} /></button>)}</div></fieldset>
          <fieldset><legend className="mb-3 font-black text-slate-800">4. ความยาว</legend><div className="grid grid-cols-4 gap-2">{LENGTHS.map((item) => <button key={item.minutes} type="button" onClick={() => setMinutes(item.minutes)} className={`min-w-0 rounded-2xl border-2 px-1 py-4 text-center ${minutes === item.minutes ? 'border-violet-500 bg-violet-50' : 'border-white bg-white'}`}><span className="block whitespace-nowrap text-sm font-black text-slate-800 sm:text-base">{item.pages} หน้า</span></button>)}</div></fieldset>
          <fieldset><legend className="mb-3 font-black text-slate-800">5. โมเดลสร้างเนื้อหา</legend><div className="grid grid-cols-3 gap-2">{TEXT_MODELS.map((item) => <button key={item.id} type="button" onClick={() => setTextModel(item.id)} className={`relative rounded-2xl border-2 px-2 py-3 text-center ${textModel === item.id ? 'border-emerald-500 bg-emerald-50' : 'border-white bg-white'}`}>{item.recommended && <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-2 py-0.5 text-[8px] font-black text-white">แนะนำ</span>}<span className="block text-xs font-black text-slate-800">{item.label}</span><span className="mt-1 block text-[10px] text-slate-400">{item.detail}</span></button>)}</div></fieldset>
          <div><label htmlFor="book-topic" className="mb-2 block font-black text-slate-800">6. อยากอ่านเรื่องอะไร? <span className="font-normal text-slate-400">(ไม่บังคับ)</span></label><textarea id="book-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={240} rows={3} placeholder="เช่น แพนด้าตัวน้อยไปเที่ยวกำแพงเมืองจีน" className="w-full resize-none rounded-2xl border-2 border-white bg-white p-3 text-sm text-slate-800 outline-none focus:border-orange-400" /></div>
          <div><label htmlFor="book-tone" className="mb-2 block font-black text-slate-800">โทนของหนังสือ</label><select id="book-tone" value={tone} onChange={(event) => setTone(event.target.value)} className="w-full rounded-2xl border-2 border-white bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-400"><option>สนุกและอบอุ่น</option><option>ตลก</option><option>ผจญภัย</option><option>น่าตื่นเต้น</option><option>ให้ความรู้</option></select></div>
          {category === 'learned-words' && <p className="rounded-xl bg-cyan-50 p-3 text-xs font-bold text-cyan-700">จะใช้คำศัพท์ที่คุณเรียนแล้ว {learnedWords.length} คำเป็นวัตถุดิบในการแต่งเรื่อง</p>}
          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}
          {submitting && (
            <div className="rounded-2xl border-2 border-orange-200 bg-white p-4 shadow-inner" role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-slate-800">{progressLabel}</span><span className="shrink-0 font-mono text-xs font-bold text-orange-600">{elapsedLabel}</span></div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-orange-100"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(92, progress)}%` }} /></div>
              <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-400"><span>ความคืบหน้าโดยประมาณ</span><span>โดยทั่วไป 1–3 นาที</span></div>
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-black text-red-600">กรุณาอย่ากดซ้ำ อย่าปิดหน้าต่าง และอย่ารีเฟรชหน้านี้</p>
            </div>
          )}
          <button type="submit" disabled={submitting || !user?.id || quotaReached} className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 py-4 text-lg font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60">{submitting ? `กำลังสร้างหนังสือ… ${elapsedLabel}` : quotaReached ? 'โควต้าครบแล้ว' : '✨ สร้างหนังสือ'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Books({ user, isAdmin = false, setPage, allMasterCards = [], selectedIds = [] }) {
  const userId = user?.id;
  const [tab, setTab] = useState('public');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [activeBook, setActiveBook] = useState(null);
  const [readBookIds, setReadBookIds] = useState(() => new Set());
  const [completingBookId, setCompletingBookId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [quotaUsed, setQuotaUsed] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [creatingNextId, setCreatingNextId] = useState(null);
  const [seriesError, setSeriesError] = useState('');
  const loadBooks = useCallback(async () => {
    setLoading(true); setLoadError('');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const quotaRequest = userId
      ? supabase.from('ai_books').select('id', { count: 'exact', head: true }).eq('creator_id', userId).gte('created_at', since).neq('status', 'canceled')
      : Promise.resolve({ count: 0, error: null });
    const readsRequest = userId
      ? supabase.from('ai_book_reads').select('book_id').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null });
    const [booksResult, summaryResult, quotaResult, readsResult] = await Promise.all([supabase.from('ai_books').select('*').order('created_at', { ascending: false }).limit(1000), supabase.rpc('get_ai_book_cost_summary'), quotaRequest, readsRequest]);
    if (booksResult.error) { setLoadError(booksResult.error.code === '42P01' ? 'ยังไม่ได้ติดตั้งฐานข้อมูล Books กรุณารันไฟล์ sql/ai_books.sql ใน Supabase' : booksResult.error.message); setBooks([]); } else setBooks(booksResult.data || []);
    if (!summaryResult.error) setSummary(Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data);
    setQuotaUsed(quotaResult.error ? null : Number(quotaResult.count || 0));
    if (!readsResult.error) setReadBookIds(new Set((readsResult.data || []).map((item) => item.book_id)));
    setLoading(false);
  }, [userId]);
  useEffect(() => {
    // The async callback owns the initial loading lifecycle for this server-backed screen.
    loadBooks();
  }, [loadBooks]);
  const completeBook = async (book) => {
    if (!userId || completingBookId) return;
    setCompletingBookId(book.id);
    const { error } = await supabase.from('ai_book_reads').upsert({ user_id: userId, book_id: book.id, completed_at: new Date().toISOString() }, { onConflict: 'user_id,book_id' });
    if (!error) {
      try { await recordDailyBookRead(userId, book.id); } catch { /* Keep the reading record even if the mission upgrade is not installed yet. */ }
      setReadBookIds((current) => new Set([...current, book.id]));
      setActiveBook(null);
    } else {
      setSeriesError(error.code === '42P01' ? 'กรุณารันไฟล์ SQL อัปเกรดภารกิจและประวัติการอ่านก่อน' : error.message);
    }
    setCompletingBookId(null);
  };
  const deleteBook = async (book) => {
    if (!isAdmin || deletingId) return;
    const title = book.title_th || book.title_cn || 'หนังสือเล่มนี้';
    if (!window.confirm(`ยืนยันลบ “${title}” หรือไม่?\n\nข้อมูลหนังสือ รูปภาพ และประวัติค่าใช้จ่ายของเล่มนี้จะถูกลบถาวร`)) return;
    setDeletingId(book.id);
    const { data, error } = await supabase.functions.invoke('delete-book', { body: { bookId: book.id } });
    setDeletingId(null);
    if (error || !data?.ok) {
      window.alert(data?.error || error?.message || 'ลบหนังสือไม่สำเร็จ');
      return;
    }
    setBooks((current) => current.filter((item) => item.id !== book.id));
    if (activeBook?.id === book.id) setActiveBook(null);
    await loadBooks();
  };
  const cancelBook = async () => {
    const book = cancelTarget;
    if (!book?.id || cancelingId) return;
    setCancelError('');
    setCancelingId(book.id);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-book', { body: { bookId: book.id } });
      if (error || !data?.ok) {
        setCancelError(await functionErrorMessage(data, error, 'ยกเลิกการสร้างหนังสือไม่สำเร็จ'));
        return;
      }
      setBooks((current) => current.filter((item) => item.id !== book.id));
      setQuotaUsed((current) => Number.isFinite(current) ? Math.max(0, current - 1) : current);
      setCancelTarget(null);
      if (activeBook?.id === book.id) setActiveBook(null);
      await loadBooks();
    } catch (error) {
      setCancelError(error?.message || 'เชื่อมต่อระบบยกเลิกไม่สำเร็จ');
    } finally {
      setCancelingId(null);
    }
  };
  const tabBooks = books.filter((book) => tab === 'mine'
    ? book.creator_id === userId && book.status !== 'canceled'
    : (book.status === 'ready' && book.visibility === 'public')
      || (book.creator_id === userId && (book.status === 'generating' || book.status === 'failed')));
  const categoryCounts = tabBooks.reduce((counts, book) => {
    counts[book.category] = (counts[book.category] || 0) + 1;
    return counts;
  }, {});
  const visibleBooks = tabBooks.filter((book) => categoryFilter === 'all' || book.category === categoryFilter);
  const totalPages = Math.max(1, Math.ceil(visibleBooks.length / BOOKS_PER_PAGE));
  const displayedPage = Math.min(currentPage, totalPages);
  const paginatedBooks = visibleBooks
    .slice((displayedPage - 1) * BOOKS_PER_PAGE, displayedPage * BOOKS_PER_PAGE)
    .map((book) => ({ ...book, _isRead: readBookIds.has(book.id) }));
  const changePage = (nextPage) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const quotaReached = Number.isFinite(quotaUsed) && quotaUsed >= DAILY_BOOK_LIMIT;
  const quotaRemaining = Number.isFinite(quotaUsed) ? Math.max(0, DAILY_BOOK_LIMIT - quotaUsed) : null;
  const openCreateBook = () => {
    if (quotaReached) {
      setShowQuotaModal(true);
      return;
    }
    setShowCreate(true);
  };
  const createNextEpisode = async (book) => {
    if (creatingNextId || !book?.series_id) return;
    if (quotaReached) {
      setShowQuotaModal(true);
      return;
    }
    setSeriesError('');
    setCreatingNextId(book.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-book', { body: { seriesId: book.series_id } });
      if (error || !data?.book) {
        setSeriesError(await functionErrorMessage(data, error, 'ไม่สามารถสร้างตอนถัดไปได้'));
        return;
      }
      setBooks((current) => [data.book, ...current.filter((item) => item.id !== data.book.id)]);
      setActiveBook(data.book);
      setTab('mine');
      await loadBooks();
    } catch (error) {
      setSeriesError(error?.message || 'เชื่อมต่อระบบสร้างตอนถัดไปไม่สำเร็จ');
    } finally {
      setCreatingNextId(null);
    }
  };

  return (
    <div className="min-h-full pb-8 pt-[max(3.5rem,env(safe-area-inset-top))] sm:pt-0">
      <div className="relative z-20 mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setPage('dashboard')} className="min-h-11 touch-manipulation rounded-xl px-2 text-xs font-black uppercase italic text-orange-600 underline [-webkit-tap-highlight-color:transparent]">← กลับหน้าหลัก</button>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={openCreateBook} className="min-h-11 shrink-0 touch-manipulation whitespace-nowrap rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-black text-white shadow-lg active:scale-95 [-webkit-tap-highlight-color:transparent]">＋ สร้างหนังสือ</button>
          <span className={`flex h-11 min-w-11 items-center justify-center rounded-2xl border-2 px-2 text-lg font-black shadow-sm ${quotaReached ? 'border-red-200 bg-red-50 text-red-600' : 'border-orange-200 bg-white text-orange-600'}`} aria-label={`โควต้าสร้างหนังสือคงเหลือ ${quotaRemaining ?? 'กำลังตรวจสอบ'}`} title="จำนวนโควต้าสร้างหนังสือคงเหลือ">{quotaRemaining ?? '–'}</span>
        </div>
      </div>
      <section className="mb-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-5 text-white shadow-xl">
        <div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-4xl shadow-inner">📖</div><div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Nihao Books</p><h1 className="text-2xl font-black">หนังสือจีนจาก AI</h1><p className="mt-1 text-xs text-white/60">สร้าง แบ่งปัน และอ่านหนังสือของเพื่อน ๆ</p></div></div>
        {summary && <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 text-center"><div className="rounded-xl bg-white/5 p-2"><div className="text-[10px] font-bold text-white/50">{isAdmin ? 'ค่าใช้จ่ายรวมระบบ' : 'ค่าใช้จ่ายของฉัน'}</div><div className="text-base font-black text-emerald-300">{money(summary.total_thb, 'THB')}</div></div><div className="rounded-xl bg-white/5 p-2"><div className="text-[10px] font-bold text-white/50">หนังสือที่สร้าง</div><div className="text-base font-black text-amber-300">{summary.book_count || 0} เล่ม</div></div></div>}
      </section>
      <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-200 p-1"><button type="button" onClick={() => { setTab('public'); setCurrentPage(1); }} className={`rounded-xl py-2.5 text-sm font-black ${tab === 'public' ? 'bg-white text-orange-600 shadow' : 'text-slate-500'}`}>🌍 หนังสือทั้งหมด</button><button type="button" onClick={() => { setTab('mine'); setCurrentPage(1); }} className={`rounded-xl py-2.5 text-sm font-black ${tab === 'mine' ? 'bg-white text-orange-600 shadow' : 'text-slate-500'}`}>👤 หนังสือของฉัน</button></div>
      <div className="mb-5">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl" aria-hidden="true">{categoryFilter === 'all' ? '📚' : categoryMeta(categoryFilter).icon}</span>
          <select id="book-category-filter" aria-label="กรองประเภทหนังสือ" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setCurrentPage(1); }} className="w-full appearance-none rounded-2xl border-2 border-white bg-white py-3.5 pl-12 pr-10 text-sm font-black text-slate-800 shadow-md outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
            <option value="all">ทุกประเภท ({tabBooks.length})</option>
            {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.label}{item.subtitle ? ` — ${item.subtitle}` : ''} ({categoryCounts[item.id] || 0})</option>)}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400" aria-hidden="true">▼</span>
        </div>
      </div>
      {loading ? <div className="py-16 text-center font-bold text-slate-400">กำลังเปิดชั้นหนังสือ…</div> : loadError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center"><p className="text-sm font-bold text-amber-800">{loadError}</p><button type="button" onClick={loadBooks} className="mt-3 text-sm font-black text-orange-600 underline">ลองอีกครั้ง</button></div> : visibleBooks.length ? <><div className="grid grid-cols-2 gap-4">{paginatedBooks.map((book) => <BookCover key={book.id} book={book} onOpen={(item) => item.status === 'ready' && setActiveBook(item)} canDelete={isAdmin} deleting={deletingId === book.id} onDelete={deleteBook} canCancel={(isAdmin || book.creator_id === userId) && (book.status === 'generating' || book.status === 'failed')} canceling={cancelingId === book.id} onCancel={(item) => { setCancelError(''); setCancelTarget(item); }} />)}</div>{totalPages > 1 && <nav className="mt-6 flex items-center justify-between gap-2 rounded-2xl border-2 border-white bg-white p-2 shadow-md" aria-label="เลือกหน้าหนังสือ"><button type="button" onClick={() => changePage(displayedPage - 1)} disabled={displayedPage === 1} className="min-h-11 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700 disabled:opacity-35">← ก่อนหน้า</button><label className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-600"><span className="hidden sm:inline">หน้า</span><select aria-label="เลือกหน้าหนังสือ" value={displayedPage} onChange={(event) => changePage(Number(event.target.value))} className="min-h-11 rounded-xl border-2 border-orange-200 bg-orange-50 px-3 text-center font-black text-orange-700 outline-none">{Array.from({ length: totalPages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select><span>/ {totalPages}</span></label><button type="button" onClick={() => changePage(displayedPage + 1)} disabled={displayedPage === totalPages} className="min-h-11 rounded-xl bg-orange-500 px-3 text-sm font-black text-white disabled:opacity-35">ถัดไป →</button></nav>}</> : <div className="rounded-[2rem] border-2 border-dashed border-orange-200 bg-white/70 px-6 py-12 text-center"><div className="text-6xl">📚</div><h2 className="mt-4 text-lg font-black text-slate-800">{categoryFilter !== 'all' ? `ยังไม่มีหนังสือประเภท ${categoryMeta(categoryFilter).label}` : tab === 'mine' ? 'ยังไม่มีหนังสือของคุณ' : 'ชั้นหนังสือยังว่างอยู่'}</h2><p className="mt-1 text-sm text-slate-400">{categoryFilter !== 'all' ? 'ลองเลือกประเภทอื่นหรือแสดงหนังสือทั้งหมด' : 'เริ่มสร้างหนังสือจีนเล่มแรกกันเลย'}</p>{categoryFilter !== 'all' ? <button type="button" onClick={() => { setCategoryFilter('all'); setCurrentPage(1); }} className="mt-5 rounded-2xl bg-slate-700 px-5 py-3 font-black text-white">แสดงทุกประเภท</button> : <button type="button" onClick={openCreateBook} className="mt-5 rounded-2xl bg-orange-500 px-5 py-3 font-black text-white">สร้างหนังสือใหม่</button>}</div>}
      {visibleBooks.length > 0 && <div className="h-4" aria-hidden="true" />}
      {cancelTarget && (
        <div className="fixed inset-0 z-[145] flex items-center justify-center bg-slate-950/75 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cancel-book-title" onMouseDown={(event) => event.target === event.currentTarget && !cancelingId && setCancelTarget(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border-2 border-orange-100 bg-white text-center shadow-2xl">
            <div className="bg-gradient-to-br from-orange-500 to-red-500 px-6 py-6 text-white"><div className="text-5xl">✋</div><h2 id="cancel-book-title" className="mt-2 text-xl font-black">ยกเลิกการสร้างหนังสือ?</h2></div>
            <div className="px-6 py-6"><p className="font-black text-slate-800">{cancelTarget.title_th || cancelTarget.title_cn || 'หนังสือเล่มใหม่'}</p><p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">รายการนี้จะหายออกจากชั้นหนังสือ และคืนโควต้าให้คุณ 1 ครั้งทันที</p><p className="mt-2 text-xs font-bold leading-relaxed text-amber-600">ค่า API ที่ประมวลผลไปแล้วก่อนยกเลิกอาจยังมีค่าใช้จ่าย</p>{cancelError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-600">{cancelError}</p>}<div className="mt-6 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setCancelTarget(null); setCancelError(''); }} disabled={!!cancelingId} className="min-h-12 rounded-2xl bg-slate-100 px-4 font-black text-slate-600 disabled:opacity-50">กลับ</button><button type="button" onClick={cancelBook} disabled={!!cancelingId} className="min-h-12 rounded-2xl bg-red-500 px-4 font-black text-white shadow-lg disabled:opacity-60">{cancelingId ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิก'}</button></div></div>
          </div>
        </div>
      )}
      {showQuotaModal && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/75 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="book-quota-modal-title" onMouseDown={(event) => event.target === event.currentTarget && setShowQuotaModal(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border-2 border-orange-200 bg-white text-center shadow-2xl">
            <div className="bg-gradient-to-br from-orange-400 to-amber-400 px-6 py-6 text-white"><div className="text-5xl" aria-hidden="true">📚</div><h2 id="book-quota-modal-title" className="mt-2 text-xl font-black">โควต้าสร้างหนังสือครบแล้ว</h2></div>
            <div className="px-6 py-6"><p className="text-sm font-bold leading-relaxed text-slate-600">คุณใช้โควต้าครบ {DAILY_BOOK_LIMIT} ครั้งในช่วง 24 ชั่วโมงแล้ว กรุณารอให้โควต้าเปิดอีกครั้ง</p><button type="button" autoFocus onClick={() => setShowQuotaModal(false)} className="mt-6 min-h-12 w-full rounded-2xl bg-orange-500 px-5 py-3 text-base font-black text-white shadow-lg transition active:scale-95">ตกลง</button></div>
          </div>
        </div>
      )}
      {creatingNextId && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="series-progress-title">
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" aria-hidden="true" />
            <h2 id="series-progress-title" className="mt-5 text-xl font-black text-slate-900">กำลังสร้างตอนถัดไป…</h2>
            <p className="mt-2 text-sm font-bold text-slate-500">โดยทั่วไปใช้เวลาประมาณ 1–3 นาที</p>
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600">อย่าปิดหรือรีเฟรชหน้าต่างนี้ เพื่อป้องกันการสร้างซ้ำ</p>
          </div>
        </div>
      )}
      {seriesError && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/75 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="series-error-title" onMouseDown={(event) => event.target === event.currentTarget && setSeriesError('')}>
          <div className="w-full max-w-sm rounded-[2rem] border-2 border-red-100 bg-white p-6 text-center shadow-2xl"><div className="text-5xl">⚠️</div><h2 id="series-error-title" className="mt-3 text-xl font-black text-red-600">สร้างตอนถัดไปไม่สำเร็จ</h2><p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{seriesError}</p><button type="button" autoFocus onClick={() => setSeriesError('')} className="mt-6 min-h-12 w-full rounded-2xl bg-orange-500 px-5 py-3 font-black text-white">ตกลง</button></div>
        </div>
      )}
      {showCreate && <CreateBookModal user={user} allMasterCards={allMasterCards} selectedIds={selectedIds} quotaUsed={quotaUsed} quotaLimit={DAILY_BOOK_LIMIT} onClose={() => setShowCreate(false)} onCreated={(book) => { setShowCreate(false); setBooks((current) => [book, ...current]); setTab('mine'); setCurrentPage(1); setActiveBook(book); loadBooks(); }} />}
      {activeBook && <Reader book={activeBook} onClose={() => setActiveBook(null)} onComplete={completeBook} completing={completingBookId === activeBook.id} canSeeCost={isAdmin || activeBook.creator_id === user?.id} canCreateNext={(isAdmin || activeBook.creator_id === user?.id) && activeBook.book_format === 'series' && Number(activeBook.episode_number || 1) < Number(activeBook.series_total || 10)} creatingNext={creatingNextId === activeBook.id} onCreateNext={createNextEpisode} />}
    </div>
  );
}
