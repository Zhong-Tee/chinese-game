import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import SpeakerButton from './SpeakerButton';

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
];

const LEVELS = [
  { id: 'beginner', label: 'เริ่มต้น', detail: 'ประโยคสั้น คำศัพท์พื้นฐาน' },
  { id: 'easy', label: 'ง่าย', detail: 'อ่านสบาย เหมาะกับผู้เรียนทั่วไป' },
  { id: 'intermediate', label: 'ปานกลาง', detail: 'ประโยคและเนื้อเรื่องซับซ้อนขึ้น' },
];
const LENGTHS = [
  { minutes: 3, detail: 'ประมาณ 4 หน้า' },
  { minutes: 5, detail: 'ประมาณ 6 หน้า' },
  { minutes: 8, detail: 'ประมาณ 8 หน้า' },
];
const FONT_SIZES = [18, 22, 26, 32, 40];

function money(value, currency = 'USD') {
  const amount = Number(value || 0);
  return currency === 'THB' ? `฿${amount.toFixed(2)}` : `$${amount.toFixed(5)}`;
}

function categoryMeta(id) {
  return CATEGORIES.find((item) => item.id === id) || { label: id || 'หนังสือ', icon: '📖' };
}

function BookCover({ book, onOpen, canDelete = false, deleting = false, onDelete }) {
  const category = categoryMeta(book.category);
  return (
    <div className="relative">
    <button type="button" onClick={() => onOpen(book)} className="group w-full overflow-hidden rounded-[1.4rem] border-2 border-white bg-white text-left shadow-lg transition active:scale-[0.98]">
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-orange-300 via-amber-100 to-cyan-200">
        {book.cover_url ? <img src={book.cover_url} alt={`ปก ${book.title_th || book.title_cn}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center"><span className="text-6xl">{category.icon}</span><span className="text-xl font-black text-slate-800">{book.title_cn || 'กำลังสร้างหนังสือ'}</span></div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-slate-950/75 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur">{category.label}</span>
        {book.status !== 'ready' && <span className="absolute inset-x-2 bottom-2 rounded-xl bg-amber-400/95 px-2 py-1.5 text-center text-xs font-black text-slate-900">{book.status === 'failed' ? 'สร้างไม่สำเร็จ' : 'กำลังสร้าง...'}</span>}
      </div>
      <div className="space-y-1 p-3">
        <h3 className="line-clamp-1 text-base font-black text-slate-900">{book.title_cn || 'หนังสือเล่มใหม่'}</h3>
        <p className="line-clamp-1 text-xs font-bold text-orange-600">{book.title_pinyin || category.label}</p>
        <p className="line-clamp-1 text-xs text-slate-500">{book.title_th || `${book.reading_minutes || 5} นาที`}</p>
        <div className="flex items-center justify-between gap-2 pt-1 text-[10px] font-bold text-slate-400"><span>{book.creator_name || 'นักอ่าน Nihao'}</span><span>{book.reading_minutes || 5} นาที</span></div>
      </div>
    </button>
    {canDelete && (
      <button
        type="button"
        onClick={() => onDelete(book)}
        disabled={deleting}
        className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-red-500 text-base text-white shadow-lg transition active:scale-90 disabled:opacity-50"
        aria-label={`ลบหนังสือ ${book.title_th || book.title_cn || ''}`}
        title="ลบหนังสือ (Admin เท่านั้น)"
      >
        {deleting ? '…' : '🗑️'}
      </button>
    )}
    </div>
  );
}

function Reader({ book, onClose, canSeeCost }) {
  const [showPinyin, setShowPinyin] = useState(() => localStorage.getItem('book-reader-pinyin') !== 'false');
  const [showThai, setShowThai] = useState(() => localStorage.getItem('book-reader-thai') !== 'false');
  const [fontIndex, setFontIndex] = useState(() => {
    const stored = Number(localStorage.getItem('book-reader-font-index'));
    return Number.isInteger(stored) && stored >= 0 && stored < FONT_SIZES.length ? stored : 2;
  });
  const [pageIndex, setPageIndex] = useState(0);
  const pages = Array.isArray(book.pages) ? book.pages : [];
  const page = pages[pageIndex];
  const saveToggle = (key, setter) => setter((value) => { localStorage.setItem(key, String(!value)); return !value; });
  const changeFont = (delta) => setFontIndex((value) => {
    const next = Math.max(0, Math.min(FONT_SIZES.length - 1, value + delta));
    localStorage.setItem('book-reader-font-index', String(next));
    return next;
  });

  if (!page) return null;
  const speechText = (page.paragraphs || []).map((paragraph) => (paragraph.segments || []).map((segment) => segment.hanzi).join('')).join(' ');
  const showContentImage = book.content_image_url && pageIndex === Number(book.content_image_page ?? Math.floor(pages.length / 2));

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#FBF4E6] text-slate-800">
      <header className="flex items-center gap-2 border-b border-orange-200 bg-white/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-sm backdrop-blur">
        <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl font-black" aria-label="ปิดหนังสือ">×</button>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-slate-900">{book.title_cn}</div><div className="text-[10px] font-bold text-slate-400">หน้า {pageIndex + 1} / {pages.length}</div></div>
        <button type="button" onClick={() => saveToggle('book-reader-pinyin', setShowPinyin)} className={`h-10 rounded-xl px-3 text-xs font-black ${showPinyin ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>拼 Pinyin</button>
        <button type="button" onClick={() => changeFont(-1)} disabled={fontIndex === 0} className="h-10 w-10 rounded-xl bg-slate-100 font-black disabled:opacity-30">A−</button>
        <button type="button" onClick={() => changeFont(1)} disabled={fontIndex === FONT_SIZES.length - 1} className="h-10 w-10 rounded-xl bg-slate-100 text-lg font-black disabled:opacity-30">A+</button>
      </header>
      <main className="flex-1 overflow-y-auto px-5 py-6">
        <article className="mx-auto max-w-2xl rounded-[2rem] border border-orange-100 bg-white p-5 shadow-xl sm:p-8">
          <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-orange-500">บทที่ {pageIndex + 1}</p><h2 className="mt-1 text-2xl font-black text-slate-900">{page.heading || book.title_cn}</h2></div><SpeakerButton text={speechText} label="ฟังเนื้อหาหน้านี้" className="h-11 w-11 shrink-0" /></div>
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
          <button type="button" onClick={() => saveToggle('book-reader-thai', setShowThai)} className="mt-6 text-xs font-black text-orange-600 underline">{showThai ? 'ซ่อนคำแปลไทย' : 'แสดงคำแปลไทย'}</button>
          {pageIndex === pages.length - 1 && canSeeCost && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm"><div className="font-black text-emerald-800">ค่าใช้จ่ายในการสร้างเล่มนี้</div><div className="mt-1 font-bold text-emerald-700">{money(book.generation_cost_usd)} · ประมาณ {money(book.generation_cost_thb, 'THB')}</div></div>}
        </article>
      </main>
      <footer className="border-t border-orange-200 bg-white px-4 pb-[max(0.8rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button type="button" onClick={() => setPageIndex((value) => Math.max(0, value - 1))} disabled={pageIndex === 0} className="h-12 flex-1 rounded-2xl bg-slate-200 font-black text-slate-700 disabled:opacity-30">← ก่อนหน้า</button>
          <div className="flex gap-1" aria-hidden="true">{pages.map((_, index) => <span key={index} className={`h-2 rounded-full transition-all ${index === pageIndex ? 'w-5 bg-orange-500' : 'w-2 bg-slate-200'}`} />)}</div>
          {pageIndex < pages.length - 1 ? <button type="button" onClick={() => setPageIndex((value) => Math.min(pages.length - 1, value + 1))} className="h-12 flex-1 rounded-2xl bg-orange-500 font-black text-white">ถัดไป →</button> : <button type="button" onClick={onClose} className="h-12 flex-1 rounded-2xl bg-emerald-500 font-black text-white">อ่านจบแล้ว ✓</button>}
        </div>
      </footer>
    </div>
  );
}

function CreateBookModal({ user, allMasterCards, selectedIds, onClose, onCreated }) {
  const [category, setCategory] = useState('daily-life');
  const [level, setLevel] = useState('easy');
  const [minutes, setMinutes] = useState(5);
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('สนุกและอบอุ่น');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const learnedWords = useMemo(() => {
    if (category !== 'learned-words') return [];
    const selected = new Set((selectedIds || []).map(Number));
    return (allMasterCards || []).filter((card) => selected.has(Number(card.id1 || card.id))).slice(0, 80).map((card) => ({ hanzi: card.cn || card.vocabulary, pinyin: card.pinyin || card.pinyin_vocab, thai: card.th })).filter((word) => word.hanzi);
  }, [allMasterCards, category, selectedIds]);

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

  const submit = async (event) => {
    event.preventDefault(); setElapsedSeconds(0); setSubmitting(true); setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('generate-book', { body: { category, languageLevel: level, readingMinutes: minutes, topic: topic.trim(), tone, learnedWords } });
    setSubmitting(false);
    if (invokeError || !data?.book) {
      const message = data?.error || invokeError?.message || 'ไม่สามารถสร้างหนังสือได้';
      setError(message.includes('Failed to send') ? 'ยังไม่ได้ deploy ฟังก์ชัน generate-book ใน Supabase' : message);
      return;
    }
    onCreated(data.book);
  };

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/85 p-4 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm">
      <form onSubmit={submit} className="mx-auto max-w-lg overflow-hidden rounded-[2rem] bg-[#FBF4E6] shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-5 text-white"><div><p className="text-xs font-black uppercase tracking-widest text-orange-100">AI Book Studio</p><h2 className="text-2xl font-black">สร้างหนังสือใหม่</h2></div><button type="button" onClick={onClose} disabled={submitting} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-3xl font-bold disabled:cursor-not-allowed disabled:opacity-35" title={submitting ? 'กรุณารอจนสร้างหนังสือเสร็จ' : 'ปิด'}>×</button></div>
        <div className="space-y-6 p-5">
          <fieldset><legend className="mb-3 font-black text-slate-800">1. เลือกหมวดหมู่</legend><div className="grid grid-cols-2 gap-2">{CATEGORIES.map((item) => <button key={item.id} type="button" onClick={() => setCategory(item.id)} className={`rounded-2xl border-2 p-3 text-left transition ${category === item.id ? 'border-orange-500 bg-orange-50 shadow-md' : 'border-white bg-white'}`}><span className="mr-2 text-xl">{item.icon}</span><span className="text-sm font-black text-slate-800">{item.label}</span>{item.subtitle && <span className="mt-1 block pl-8 text-[10px] text-slate-400">{item.subtitle}</span>}</button>)}</div></fieldset>
          <fieldset><legend className="mb-3 font-black text-slate-800">2. ระดับภาษาจีน</legend><div className="space-y-2">{LEVELS.map((item) => <button key={item.id} type="button" onClick={() => setLevel(item.id)} className={`flex w-full items-center justify-between rounded-2xl border-2 p-3 text-left ${level === item.id ? 'border-cyan-500 bg-cyan-50' : 'border-white bg-white'}`}><span><span className="block text-sm font-black text-slate-800">{item.label}</span><span className="text-xs text-slate-400">{item.detail}</span></span><span className={`h-5 w-5 rounded-full border-4 ${level === item.id ? 'border-cyan-500 bg-white' : 'border-slate-200'}`} /></button>)}</div></fieldset>
          <fieldset><legend className="mb-3 font-black text-slate-800">3. ความยาว</legend><div className="grid grid-cols-3 gap-2">{LENGTHS.map((item) => <button key={item.minutes} type="button" onClick={() => setMinutes(item.minutes)} className={`rounded-2xl border-2 p-3 text-center ${minutes === item.minutes ? 'border-violet-500 bg-violet-50' : 'border-white bg-white'}`}><span className="block text-lg font-black text-slate-800">{item.minutes} นาที</span><span className="text-[10px] text-slate-400">{item.detail}</span></button>)}</div></fieldset>
          <div><label htmlFor="book-topic" className="mb-2 block font-black text-slate-800">4. อยากอ่านเรื่องอะไร? <span className="font-normal text-slate-400">(ไม่บังคับ)</span></label><textarea id="book-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={240} rows={3} placeholder="เช่น แพนด้าตัวน้อยไปเที่ยวกำแพงเมืองจีน" className="w-full resize-none rounded-2xl border-2 border-white bg-white p-3 text-sm text-slate-800 outline-none focus:border-orange-400" /></div>
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
          <button type="submit" disabled={submitting || !user?.id} className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 py-4 text-lg font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60">{submitting ? `กำลังสร้างหนังสือ… ${elapsedLabel}` : '✨ สร้างหนังสือ'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Books({ user, isAdmin = false, setPage, allMasterCards = [], selectedIds = [] }) {
  const [tab, setTab] = useState('public');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [activeBook, setActiveBook] = useState(null);
  const [summary, setSummary] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const loadBooks = useCallback(async () => {
    setLoading(true); setLoadError('');
    const [booksResult, summaryResult] = await Promise.all([supabase.from('ai_books').select('*').order('created_at', { ascending: false }).limit(100), supabase.rpc('get_ai_book_cost_summary')]);
    if (booksResult.error) { setLoadError(booksResult.error.code === '42P01' ? 'ยังไม่ได้ติดตั้งฐานข้อมูล Books กรุณารันไฟล์ sql/ai_books.sql ใน Supabase' : booksResult.error.message); setBooks([]); } else setBooks(booksResult.data || []);
    if (!summaryResult.error) setSummary(Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data);
    setLoading(false);
  }, []);
  useEffect(() => {
    // The async callback owns the initial loading lifecycle for this server-backed screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBooks();
  }, [loadBooks]);
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
  const tabBooks = books.filter((book) => tab === 'mine'
    ? book.creator_id === user?.id
    : book.status === 'ready' && book.visibility === 'public');
  const categoryCounts = tabBooks.reduce((counts, book) => {
    counts[book.category] = (counts[book.category] || 0) + 1;
    return counts;
  }, {});
  const visibleBooks = tabBooks.filter((book) => categoryFilter === 'all' || book.category === categoryFilter);

  return (
    <div className="min-h-full pb-8">
      <div className="mb-5 flex items-center justify-between gap-3"><button type="button" onClick={() => setPage('dashboard')} className="text-xs font-black uppercase italic text-orange-600 underline">← กลับหน้าหลัก</button><button type="button" onClick={() => setShowCreate(true)} className="rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-black text-white shadow-lg active:scale-95">＋ สร้างหนังสือ</button></div>
      <section className="mb-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-5 text-white shadow-xl">
        <div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-4xl shadow-inner">📖</div><div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Nihao Books</p><h1 className="text-2xl font-black">หนังสือจีนจาก AI</h1><p className="mt-1 text-xs text-white/60">สร้าง แบ่งปัน และอ่านหนังสือของเพื่อน ๆ</p></div></div>
        {summary && <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 text-center"><div className="rounded-xl bg-white/5 p-2"><div className="text-[10px] font-bold text-white/50">{isAdmin ? 'ค่าใช้จ่ายรวมระบบ' : 'ค่าใช้จ่ายของฉัน'}</div><div className="text-base font-black text-emerald-300">{money(summary.total_thb, 'THB')}</div></div><div className="rounded-xl bg-white/5 p-2"><div className="text-[10px] font-bold text-white/50">หนังสือที่สร้าง</div><div className="text-base font-black text-amber-300">{summary.book_count || 0} เล่ม</div></div></div>}
      </section>
      <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-200 p-1"><button type="button" onClick={() => setTab('public')} className={`rounded-xl py-2.5 text-sm font-black ${tab === 'public' ? 'bg-white text-orange-600 shadow' : 'text-slate-500'}`}>🌍 หนังสือทั้งหมด</button><button type="button" onClick={() => setTab('mine')} className={`rounded-xl py-2.5 text-sm font-black ${tab === 'mine' ? 'bg-white text-orange-600 shadow' : 'text-slate-500'}`}>👤 หนังสือของฉัน</button></div>
      <div className="mb-5">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl" aria-hidden="true">{categoryFilter === 'all' ? '📚' : categoryMeta(categoryFilter).icon}</span>
          <select id="book-category-filter" aria-label="กรองประเภทหนังสือ" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-full appearance-none rounded-2xl border-2 border-white bg-white py-3.5 pl-12 pr-10 text-sm font-black text-slate-800 shadow-md outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
            <option value="all">ทุกประเภท ({tabBooks.length})</option>
            {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.label}{item.subtitle ? ` — ${item.subtitle}` : ''} ({categoryCounts[item.id] || 0})</option>)}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400" aria-hidden="true">▼</span>
        </div>
      </div>
      {loading ? <div className="py-16 text-center font-bold text-slate-400">กำลังเปิดชั้นหนังสือ…</div> : loadError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center"><p className="text-sm font-bold text-amber-800">{loadError}</p><button type="button" onClick={loadBooks} className="mt-3 text-sm font-black text-orange-600 underline">ลองอีกครั้ง</button></div> : visibleBooks.length ? <div className="grid grid-cols-2 gap-4">{visibleBooks.map((book) => <BookCover key={book.id} book={book} onOpen={(item) => item.status === 'ready' && setActiveBook(item)} canDelete={isAdmin} deleting={deletingId === book.id} onDelete={deleteBook} />)}</div> : <div className="rounded-[2rem] border-2 border-dashed border-orange-200 bg-white/70 px-6 py-12 text-center"><div className="text-6xl">📚</div><h2 className="mt-4 text-lg font-black text-slate-800">{categoryFilter !== 'all' ? `ยังไม่มีหนังสือประเภท ${categoryMeta(categoryFilter).label}` : tab === 'mine' ? 'ยังไม่มีหนังสือของคุณ' : 'ชั้นหนังสือยังว่างอยู่'}</h2><p className="mt-1 text-sm text-slate-400">{categoryFilter !== 'all' ? 'ลองเลือกประเภทอื่นหรือแสดงหนังสือทั้งหมด' : 'เริ่มสร้างหนังสือจีนเล่มแรกกันเลย'}</p>{categoryFilter !== 'all' ? <button type="button" onClick={() => setCategoryFilter('all')} className="mt-5 rounded-2xl bg-slate-700 px-5 py-3 font-black text-white">แสดงทุกประเภท</button> : <button type="button" onClick={() => setShowCreate(true)} className="mt-5 rounded-2xl bg-orange-500 px-5 py-3 font-black text-white">สร้างหนังสือใหม่</button>}</div>}
      {showCreate && <CreateBookModal user={user} allMasterCards={allMasterCards} selectedIds={selectedIds} onClose={() => setShowCreate(false)} onCreated={(book) => { setShowCreate(false); setBooks((current) => [book, ...current]); setTab('mine'); setActiveBook(book); loadBooks(); }} />}
      {activeBook && <Reader book={activeBook} onClose={() => setActiveBook(null)} canSeeCost={isAdmin || activeBook.creator_id === user?.id} />}
    </div>
  );
}
