import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  { id: 'series', label: 'เรื่องยาว', icon: '🎬', filterOnly: true },
  { id: 'youth-novel', label: 'นิยายเยาวชน', icon: '📗', filterOnly: true },
];

const LEVELS = [
  { id: 'beginner', label: 'เริ่มต้น · HSK 1', detail: 'ประโยคสั้น คำศัพท์พื้นฐาน' },
  { id: 'easy', label: 'ง่าย · HSK 2', detail: 'อ่านสบาย เหมาะกับผู้เรียนทั่วไป' },
  { id: 'intermediate', label: 'ปานกลาง · HSK 3–4', detail: 'ประโยคและเนื้อเรื่องซับซ้อนขึ้น' },
  { id: 'advanced', label: 'ยาก · HSK 5–6', detail: 'ประโยคซับซ้อน คำเชื่อมและสำนวนระดับสูง' },
];
const LENGTHS = [
  { minutes: 3, pages: 4 },
  { minutes: 5, pages: 6 },
  { minutes: 8, pages: 8 },
  { minutes: 15, pages: 12 },
];
const LONG_STORY_LENGTHS = [12, 16];
const NOVEL_LENGTHS = [16, 20, 24];
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
const NOVEL_AGES = ['7–9 ปี', '10–12 ปี', '13 ปีขึ้นไป'];
const NOVEL_GENRES = [
  { id: 'detective', label: 'สืบสวนและไขปริศนา', icon: '🔍' },
  { id: 'adventure', label: 'ผจญภัย', icon: '🧭' },
  { id: 'friendship', label: 'มิตรภาพ', icon: '🤝' },
  { id: 'school', label: 'ชีวิตในโรงเรียน', icon: '🏫' },
  { id: 'fantasy', label: 'แฟนตาซีและเวทมนตร์', icon: '🐉' },
  { id: 'science', label: 'วิทยาศาสตร์และอนาคต', icon: '🚀' },
  { id: 'comedy', label: 'ตลก', icon: '😂' },
  { id: 'animals', label: 'สัตว์และธรรมชาติ', icon: '🐾' },
  { id: 'family', label: 'ครอบครัว', icon: '👨‍👩‍👧' },
  { id: 'chinese-culture', label: 'วัฒนธรรมจีน', icon: '🏮' },
  { id: 'sports', label: 'กีฬาและการแข่งขัน', icon: '⚽' },
  { id: 'growing-up', label: 'การเติบโตและค้นหาตัวเอง', icon: '🌱' },
];
const NOVEL_TONES = ['สดใส', 'อบอุ่น', 'สนุกและตลก', 'ตื่นเต้น', 'ลึกลับ', 'ซึ้งใจ', 'สร้างแรงบันดาลใจ', 'ระทึกแบบเหมาะกับเด็ก', 'มหัศจรรย์', 'อ่อนโยนและสบายใจ'];
const NOVEL_INTERESTS = ['ปริศนา', 'อวกาศ', 'ไดโนเสาร์', 'สัตว์', 'ฟุตบอล', 'รถไฟ', 'เวทมนตร์', 'การทดลอง', 'เกม', 'การเดินทาง', 'อาหาร', 'ศิลปะ'];
const REVIEW_ENJOYMENT = [{ id: 'love', label: '😍 ชอบมาก' }, { id: 'like', label: '🙂 ชอบ' }, { id: 'neutral', label: '😐 เฉย ๆ' }, { id: 'dislike', label: '🙁 ไม่ค่อยชอบ' }];
const REVIEW_ASPECTS = [{ id: 'character', label: '🧑 ตัวละคร' }, { id: 'adventure', label: '🚀 การผจญภัย' }, { id: 'comedy', label: '😂 ความตลก' }, { id: 'mystery', label: '🔍 ปริศนา' }, { id: 'images', label: '🎨 รูปภาพ' }, { id: 'story', label: '📖 เนื้อเรื่อง' }];
const FONT_SIZES = [18, 22, 26, 32, 40];
const DAILY_BOOK_LIMIT = 5;
const BOOKS_PER_PAGE = 60;
const BANGKOK_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

function bangkokDayStartIso(now = Date.now()) {
  const bangkokTime = new Date(now + BANGKOK_UTC_OFFSET_MS);
  bangkokTime.setUTCHours(0, 0, 0, 0);
  return new Date(bangkokTime.getTime() - BANGKOK_UTC_OFFSET_MS).toISOString();
}

function millisecondsUntilBangkokMidnight(now = Date.now()) {
  const bangkokTime = new Date(now + BANGKOK_UTC_OFFSET_MS);
  bangkokTime.setUTCHours(24, 0, 0, 100);
  return bangkokTime.getTime() - BANGKOK_UTC_OFFSET_MS - now;
}

function money(value, currency = 'USD') {
  const amount = Number(value || 0);
  return currency === 'THB' ? `฿${amount.toFixed(2)}` : `$${amount.toFixed(5)}`;
}

function quizQuestionsFromBook(book) {
  const pages = Array.isArray(book?.pages) ? book.pages : [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    if (Array.isArray(pages[index]?.quiz_questions) && pages[index].quiz_questions.length === 3) return pages[index].quiz_questions;
  }
  return [];
}

function categoryMeta(id) {
  return CATEGORIES.find((item) => item.id === id) || { label: id || 'หนังสือ', icon: '📖' };
}

function levelLabel(id) {
  return LEVELS.find((item) => item.id === id)?.label || id || 'ไม่ระบุระดับ';
}

async function functionErrorMessage(data, invokeError, fallback) {
  if (data?.error) return typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error);
  if (invokeError?.context?.json) {
    try {
      const errorBody = await invokeError.context.json();
      if (errorBody?.error) return typeof errorBody.error === 'string' ? errorBody.error : errorBody.error.message || JSON.stringify(errorBody.error);
    } catch {
      // The response body may already have been consumed by the Supabase client.
    }
  }
  return invokeError?.message || fallback;
}

function BookCover({ book, onOpen, isRead = book._isRead || false, canSeeCost = false, canDelete = false, deleting = false, onDelete, canCancel = false, canceling = false, onCancel }) {
  const category = categoryMeta(book.category);
  const isSeriesCollection = Boolean(book._isSeriesCollection || Number(book._seriesEpisodeCount || 0) > 0);
  const pageCount = Number(book._pageCount ?? (Array.isArray(book.pages) ? book.pages.length : 0));
  const isYouthNovel = book.book_format === 'youth_novel';
  const isLegacyNovel = isYouthNovel && Number(book.generation_progress?.target_chapters || 0) === 8;
  const isLongStory = book.book_format === 'series' && !book.series_id;
  const completedChapters = Number(book.generation_progress?.completed_chapters || 0);
  const completedEpisodes = Number(book.generation_progress?.completed_episodes ?? book._seriesEpisodeCount ?? 0);
  const targetImages = Number(book.generation_progress?.target_images || 0);
  const completedImages = Number(book.generation_progress?.completed_images || 0);
  const hasImageProgress = targetImages > 0;
  const progressPercent = Math.max(0, Math.min(100, Number(book.generation_progress?.progress_percent || 0)));
  const hasPercentProgress = progressPercent > 0 && !isLegacyNovel && !isSeriesCollection;
  const progressMax = hasPercentProgress ? 100 : isLegacyNovel ? 8 : isSeriesCollection ? 5 : targetImages;
  const progressValue = hasPercentProgress ? progressPercent : isLegacyNovel ? Math.min(8, completedChapters) : isSeriesCollection ? Math.min(5, completedEpisodes) : Math.min(targetImages, completedImages);
  return (
    <div className="relative">
    <button type="button" onClick={() => onOpen(book)} className="group w-full overflow-hidden rounded-[1.4rem] border-2 border-white bg-white text-left shadow-lg transition active:scale-[0.98]">
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-orange-300 via-amber-100 to-cyan-200">
        {book.cover_url ? <img src={book.cover_url} alt={`ปก ${book.title_th || book.title_cn}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center"><span className="text-6xl">{category.icon}</span><span className="text-xl font-black text-slate-800">{book.title_cn || 'กำลังสร้างหนังสือ'}</span></div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-slate-950/75 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur">{isSeriesCollection ? `ซีรีส์ · ${book._seriesEpisodeCount || 0}/5 ตอน` : isLongStory ? `เรื่องยาว · ${pageCount || book.generation_progress?.target_pages || 16} หน้า` : book.book_format === 'series' ? `ซีรีส์ · ตอน ${book.episode_number || 1}/${book.series_total || 5}` : isLegacyNovel ? 'นิยายเยาวชน · 8 บท' : isYouthNovel ? `นิยายเยาวชน · ${pageCount || book.generation_progress?.target_pages || 16} หน้า` : category.label}</span>
        {isRead && <span className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-lg font-black text-white shadow-lg" aria-label="อ่านจบแล้ว" title="อ่านจบแล้ว">✓</span>}
        {book.status !== 'ready' && <span className="absolute inset-x-2 bottom-2 rounded-xl bg-amber-400/95 px-2 py-1.5 text-xs font-black text-slate-900"><span className="flex items-center justify-between gap-2"><span className="min-w-0 flex-1 text-center">{book.status === 'failed' ? 'สร้างไม่สำเร็จ' : book.status === 'canceled' ? 'ยกเลิกการสร้างแล้ว' : book.generation_progress?.message_th || (book.status === 'partial' ? 'เนื้อหาพร้อมอ่าน · กำลังสร้างภาพ' : 'กำลังสร้าง...')}</span>{(hasPercentProgress || isLegacyNovel || isSeriesCollection || hasImageProgress) && <span className="shrink-0 rounded-lg bg-white/70 px-1.5 py-0.5 font-mono text-[10px] text-emerald-800">{hasPercentProgress ? `${progressValue}%` : `${progressValue}/${progressMax}`}</span>}</span>{(hasPercentProgress || isLegacyNovel || isSeriesCollection || hasImageProgress) && <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-label={hasPercentProgress ? 'ความคืบหน้าการสร้างหนังสือ' : hasImageProgress ? 'ความคืบหน้าการสร้างภาพ' : isLegacyNovel ? 'ความคืบหน้าการสร้างนิยาย' : 'ความคืบหน้าการสร้างซีรีส์'} aria-valuemin="0" aria-valuemax={progressMax} aria-valuenow={progressValue}><span className="block h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.max(5, (progressValue / Math.max(1, progressMax)) * 100)}%` }} /></span>}</span>}
      </div>
      <div className="space-y-1 p-3">
        <h3 className="line-clamp-1 text-base font-black text-slate-900">{book.title_cn || 'หนังสือเล่มใหม่'}</h3>
        <p className="line-clamp-1 text-xs font-bold text-orange-600">{book.title_pinyin || category.label}</p>
        <p className="line-clamp-1 text-xs text-slate-500">{book.title_th || `${book.reading_minutes || 5} นาที`}</p>
        <div className="flex items-center justify-between gap-2 pt-1 text-[10px] font-bold text-slate-400"><span className="min-w-0 truncate">{book.creator_name || 'นักอ่าน Nihao'} · {levelLabel(book.language_level)}</span><span className="shrink-0">{pageCount > 0 && `${pageCount} ${isLegacyNovel ? 'บท' : 'หน้า'} · `}{canSeeCost ? <span className="text-emerald-600">{money(book._generationCostThb ?? book.generation_cost_thb, 'THB')}</span> : `${book.reading_minutes || 5} นาที`}</span></div>
      </div>
    </button>
    {canDelete && (
      <button
        type="button"
        onClick={() => onDelete(book)}
        disabled={deleting}
        className={`absolute right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-red-500 text-base text-white shadow-lg transition active:scale-90 disabled:opacity-50 ${isRead ? 'top-12' : 'top-2'}`}
        aria-label={`${isSeriesCollection ? 'ลบซีรีส์ทุกตอน' : 'ลบหนังสือ'} ${book.title_th || book.title_cn || ''}`}
        title={isSeriesCollection ? 'ลบซีรีส์ทุกตอน (Admin เท่านั้น)' : 'ลบหนังสือ (Admin เท่านั้น)'}
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

function buildShelfEntries(bookRows, seriesRows, readBookIds, allBookRows = bookRows) {
  const seriesMeta = new Map((seriesRows || []).map((series) => [series.id, series]));
  const groupedSeries = new Map();
  const entries = [];

  (bookRows || []).forEach((book) => {
    if (book.book_format !== 'series' || !book.series_id) {
      entries.push({
        key: book.id,
        book: { ...book, _isRead: readBookIds.has(book.id) },
        openBook: ['ready', 'partial'].includes(book.status) ? book : null,
        pendingBook: ['generating', 'partial', 'failed'].includes(book.status) ? book : null,
        isSeries: false,
        sortDate: book.created_at,
      });
      return;
    }
    const episodes = groupedSeries.get(book.series_id) || [];
    episodes.push(book);
    groupedSeries.set(book.series_id, episodes);
  });

  groupedSeries.forEach((unsortedEpisodes, seriesId) => {
    const completeSeriesEpisodes = (allBookRows || []).filter((book) => book.series_id === seriesId && book.status !== 'canceled');
    const episodes = [...(completeSeriesEpisodes.length ? completeSeriesEpisodes : unsortedEpisodes)].sort((a, b) => Number(a.episode_number || 0) - Number(b.episode_number || 0));
    const readyEpisodes = episodes.filter((episode) => episode.status === 'ready');
    const pendingEpisodes = episodes.filter((episode) => ['generating', 'failed'].includes(episode.status));
    const firstEpisode = readyEpisodes[0] || episodes[0];
    const latestEpisode = readyEpisodes[readyEpisodes.length - 1] || firstEpisode;
    const meta = seriesMeta.get(seriesId);
    const seriesPending = ['generating', 'failed'].includes(meta?.generation_status);
    const pendingBook = pendingEpisodes[pendingEpisodes.length - 1] || (seriesPending ? firstEpisode : null);
    const openBook = readyEpisodes.find((episode) => !readBookIds.has(episode.id)) || latestEpisode;
    const readCount = readyEpisodes.filter((episode) => readBookIds.has(episode.id)).length;
    const newestDate = episodes.reduce((latest, episode) => episode.created_at > latest ? episode.created_at : latest, episodes[0]?.created_at || '');
    entries.push({
      key: `series-${seriesId}`,
      book: {
        ...firstEpisode,
        title_cn: meta?.title_cn || firstEpisode.title_cn,
        title_pinyin: meta?.title_pinyin || firstEpisode.title_pinyin,
        title_th: meta?.title_th || firstEpisode.title_th,
        _isSeriesCollection: true,
        _seriesEpisodeCount: readyEpisodes.length,
        _seriesReadCount: readCount,
        _pageCount: readyEpisodes.reduce((total, episode) => total + (Array.isArray(episode.pages) ? episode.pages.length : 0), 0),
        _generationCostThb: readyEpisodes.reduce((total, episode) => total + Number(episode.generation_cost_thb || 0), 0),
        _isRead: readyEpisodes.length > 0 && readCount === readyEpisodes.length,
        status: seriesPending ? meta.generation_status : firstEpisode.status,
        generation_progress: meta?.generation_progress || firstEpisode.generation_progress,
      },
      openBook,
      pendingBook,
      episodes: readyEpisodes,
      isSeries: true,
      sortDate: newestDate,
    });
  });

  return entries.sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)));
}

function Reader({ book, seriesEpisodes = [], readBookIds = new Set(), savedPageIndex = null, onSaveProgress, onSelectEpisode, onClose, onComplete, completing = false, onReadingEvent, onEnsureQuiz }) {
  const [showPinyin, setShowPinyin] = useState(() => localStorage.getItem('book-reader-pinyin') !== 'false');
  const [showThai, setShowThai] = useState(() => localStorage.getItem('book-reader-thai') !== 'false');
  const [fontIndex, setFontIndex] = useState(() => {
    const stored = Number(localStorage.getItem('book-reader-font-index'));
    return Number.isInteger(stored) && stored >= 0 && stored < FONT_SIZES.length ? stored : 2;
  });
  const [pageIndex, setPageIndex] = useState(() => Math.max(0, Math.min(Number(savedPageIndex || 0), Math.max(0, (Array.isArray(book.pages) ? book.pages.length : 1) - 1))));
  const [audioMode, setAudioMode] = useState(() => localStorage.getItem('book-reader-audio-mode') || 'manual');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRunRef = useRef(0);
  const readerScrollRef = useRef(null);
  const touchStartRef = useRef(null);
  const [showExpandedImage, setShowExpandedImage] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState('');
  const trackedReadingEventsRef = useRef(new Set());
  const pages = Array.isArray(book.pages) ? book.pages : [];
  const quizQuestions = quizQuestionsFromBook(book);
  const isYouthNovel = book.book_format === 'youth_novel';
  const isLegacyNovel = isYouthNovel && Number(book.generation_progress?.target_chapters || 0) === 8;
  const novelInProgress = isLegacyNovel && book.status !== 'ready';
  const targetPageCount = novelInProgress ? 8 : pages.length;
  const isQuizPage = !novelInProgress && pageIndex === pages.length;
  const page = pages[pageIndex] || null;
  const pageImageUrl = page?.image_url || ((!isYouthNovel && book.content_image_url && pageIndex === Number(book.content_image_page ?? Math.floor(pages.length / 2))) ? book.content_image_url : '');
  const speechText = useMemo(() => (page?.paragraphs || [])
    .map((paragraph) => (paragraph.segments || []).map((segment) => segment.hanzi).join(''))
    .join(' '), [page]);
  const saveToggle = (key, setter) => setter((value) => { localStorage.setItem(key, String(!value)); return !value; });
  const changeFont = (delta) => setFontIndex((value) => {
    const next = Math.max(0, Math.min(FONT_SIZES.length - 1, value + delta));
    localStorage.setItem('book-reader-font-index', String(next));
    return next;
  });
  const saveCurrentPage = useCallback(() => {
    if (!book?.id || pageIndex >= pages.length) return;
    onSaveProgress?.(book.id, pageIndex);
  }, [book?.id, onSaveProgress, pageIndex, pages.length]);
  const closeReader = () => {
    saveCurrentPage();
    onClose?.();
  };

  useEffect(() => {
    if (!book?.id || isQuizPage || pageIndex >= pages.length) return undefined;
    const timerId = window.setTimeout(saveCurrentPage, 500);
    return () => window.clearTimeout(timerId);
  }, [book?.id, isQuizPage, pageIndex, pages.length, saveCurrentPage]);

  useEffect(() => {
    const scrollArea = readerScrollRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTop = 0;
  }, [book?.id, pageIndex]);

  const stopSpeech = useCallback(() => {
    speechRunRef.current += 1;
    cancelChineseSpeech();
    setIsSpeaking(false);
  }, []);
  const startSpeech = useCallback(() => {
    if (!speechText) return;
    const runId = speechRunRef.current + 1;
    speechRunRef.current = runId;
    setIsSpeaking(true);
    speakChinese(speechText, {
      shouldSpeak: () => speechRunRef.current === runId,
      onStart: () => speechRunRef.current === runId && setIsSpeaking(true),
      onEnd: () => speechRunRef.current === runId && setIsSpeaking(false),
      onError: () => speechRunRef.current === runId && setIsSpeaking(false),
    }).then((utterance) => {
      if (!utterance && speechRunRef.current === runId) setIsSpeaking(false);
    }).catch(() => {
      if (speechRunRef.current === runId) setIsSpeaking(false);
    });
  }, [speechText]);

  useEffect(() => {
    if (audioMode !== 'auto' || !speechText) return undefined;
    startSpeech();
    return stopSpeech;
  }, [audioMode, pageIndex, speechText, startSpeech, stopSpeech]);

  useEffect(() => stopSpeech, [stopSpeech]);

  useEffect(() => {
    if (!book?.id || isQuizPage) return;
    const eventType = pageIndex === 0 ? 'start' : 'chapter_open';
    const eventKey = `${book.id}:${eventType}:${pageIndex + 1}`;
    if (trackedReadingEventsRef.current.has(eventKey)) return;
    trackedReadingEventsRef.current.add(eventKey);
    onReadingEvent?.(book, eventType, pageIndex + 1);
  }, [book, isQuizPage, onReadingEvent, pageIndex]);

  useEffect(() => {
    if (!showExpandedImage) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setShowExpandedImage(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showExpandedImage]);

  const toggleManualAudio = () => {
    if (isQuizPage) return;
    if (isSpeaking) stopSpeech();
    else startSpeech();
  };
  const toggleAutoAudio = () => {
    if (isQuizPage) return;
    const nextMode = audioMode === 'auto' ? 'manual' : 'auto';
    localStorage.setItem('book-reader-audio-mode', nextMode);
    setAudioMode(nextMode);
    if (nextMode !== 'auto') stopSpeech();
  };

  const openQuiz = async () => {
    setQuizError('');
    if (quizQuestions.length === 3) {
      setPageIndex(pages.length);
      return;
    }
    setQuizLoading(true);
    try {
      const updatedBook = await onEnsureQuiz?.(book);
      if (!updatedBook) throw new Error('สร้างคำถามไม่สำเร็จ');
      setPageIndex(Array.isArray(updatedBook.pages) ? updatedBook.pages.length : pages.length);
    } catch (error) {
      setQuizError(error?.message || 'สร้างคำถามท้ายเล่มไม่สำเร็จ');
    } finally {
      setQuizLoading(false);
    }
  };
  const handleTouchStart = (event) => {
    if (event.touches.length !== 1 || event.target.closest('button, input, select, textarea, a')) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };
  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const elapsed = Date.now() - start.time;
    if (elapsed > 1000 || Math.abs(deltaX) < 60 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;
    if (deltaX < 0) {
      if (pageIndex < pages.length - 1) setPageIndex((value) => Math.min(pages.length - 1, value + 1));
      else if (!novelInProgress && !isQuizPage) openQuiz();
    } else if (pageIndex > 0) {
      setPageIndex((value) => Math.max(0, value - 1));
    }
  };
  const answeredCount = quizQuestions.filter((_, index) => quizAnswers[index] !== undefined).length;
  const quizScore = quizQuestions.reduce((score, question, index) => score + (quizAnswers[index] === Number(question.correct_index) ? 1 : 0), 0);
  const allQuizAnswered = quizQuestions.length === 3 && answeredCount === quizQuestions.length;

  if (!page && !isQuizPage) return null;
  const showContentImage = !isQuizPage && !!pageImageUrl;

  return (
    <div className="fixed inset-0 z-[120] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#FBF4E6] text-slate-800">
      <header className="flex flex-col gap-2 border-b border-orange-200 bg-white/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-sm backdrop-blur sm:flex-row sm:items-center">
        <div className="flex w-full min-w-0 items-center gap-2">
          <button type="button" onClick={closeReader} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800" aria-label="ปิดหนังสือ">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <div className={`min-w-0 truncate text-sm font-black text-slate-900 ${seriesEpisodes.length > 1 ? 'max-w-[40%] shrink' : 'flex-1'}`}>{book.title_cn}</div>
              {seriesEpisodes.length > 1 && (
                <select value={book.id} onChange={(event) => onSelectEpisode?.(event.target.value)} aria-label="เลือกตอนของซีรีส์" className="min-w-0 flex-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-black text-violet-800 outline-none">
                  {seriesEpisodes.map((episode) => <option key={episode.id} value={episode.id}>ตอน {episode.episode_number || 1}{readBookIds.has(episode.id) ? ' ✓' : ''} — {episode.title_th || episode.title_cn}</option>)}
                </select>
              )}
            </div>
            <div className="text-[10px] font-bold text-slate-400">{isQuizPage ? 'แบบทดสอบท้ายเล่ม' : `${isLegacyNovel ? 'บท' : 'หน้า'} ${pageIndex + 1} / ${targetPageCount}${novelInProgress ? ' · กำลังสร้างต่อ' : ''}`}</div>
          </div>
        </div>
        <div className="grid w-full shrink-0 grid-cols-[1.2fr_0.9fr_0.65fr_0.65fr_0.65fr_0.65fr] gap-1.5 sm:w-auto sm:min-w-[29rem] sm:gap-2">
          <button type="button" onClick={() => saveToggle('book-reader-pinyin', setShowPinyin)} aria-pressed={showPinyin} className={`h-10 rounded-xl px-2 text-xs font-black ${showPinyin ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>拼 Pinyin</button>
          <button type="button" onClick={() => saveToggle('book-reader-thai', setShowThai)} aria-pressed={showThai} className={`h-10 rounded-xl px-2 text-xs font-black ${showThai ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-500'}`}>ไทย</button>
          <button type="button" onClick={toggleManualAudio} disabled={isQuizPage} aria-label={isSpeaking ? 'หยุดเสียง' : 'เล่นเสียงหน้าปัจจุบัน'} title={isSpeaking ? 'หยุดเสียง' : 'เล่น'} aria-pressed={isSpeaking} className={`h-10 rounded-xl border-2 text-lg transition active:scale-95 disabled:opacity-30 ${isSpeaking ? 'border-orange-500 bg-orange-500 text-white' : 'border-orange-200 bg-white text-orange-600'}`}>{isSpeaking ? '⏹️' : '🔊'}</button>
          <button type="button" onClick={toggleAutoAudio} disabled={isQuizPage} aria-label={audioMode === 'auto' ? 'ปิดการเล่นเสียงอัตโนมัติ' : 'เปิดการเล่นเสียงอัตโนมัติเมื่อเปลี่ยนหน้า'} title={audioMode === 'auto' ? 'ปิดเล่นอัตโนมัติ' : 'เล่นอัตโนมัติ'} aria-pressed={audioMode === 'auto'} className={`h-10 rounded-xl border-2 text-lg transition active:scale-95 disabled:opacity-30 ${audioMode === 'auto' ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-cyan-200 bg-white text-cyan-700'}`}>🔁</button>
          <button type="button" onClick={() => changeFont(-1)} disabled={fontIndex === 0} className="h-10 rounded-xl bg-slate-100 font-black disabled:opacity-30" aria-label="ลดขนาดอักษร">A−</button>
          <button type="button" onClick={() => changeFont(1)} disabled={fontIndex === FONT_SIZES.length - 1} className="h-10 rounded-xl bg-slate-100 text-lg font-black disabled:opacity-30" aria-label="เพิ่มขนาดอักษร">A+</button>
        </div>
      </header>
      <main ref={readerScrollRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchCancel={() => { touchStartRef.current = null; }} className="flex-1 touch-pan-y overflow-y-auto px-5 py-6">
        <article className="mx-auto max-w-2xl rounded-[2rem] border border-orange-100 bg-white p-5 shadow-xl sm:p-8">
          {isQuizPage ? (
            <div>
              <div className="mb-6 text-center"><div className="text-5xl" aria-hidden="true">📝</div><h2 className="mt-2 text-2xl font-black text-slate-900">แบบทดสอบท้ายเล่ม</h2><p className="mt-1 text-sm font-bold text-slate-500">ตอบคำถามให้ครบทั้ง 3 ข้อ</p></div>
              <div className="space-y-5">
                {quizQuestions.map((question, questionIndex) => {
                  const selected = quizAnswers[questionIndex];
                  const answered = selected !== undefined;
                  const correctIndex = Number(question.correct_index);
                  return (
                    <section key={questionIndex} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
                      <div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-black text-white">{questionIndex + 1}</span><div className="min-w-0"><h3 className="text-lg font-black text-slate-900">{question.question_cn}</h3>{showPinyin && question.pinyin && <p className="mt-1 text-xs font-bold text-orange-500">{question.pinyin}</p>}{showThai && question.thai && <p className="mt-1 text-sm font-bold text-slate-500">{question.thai}</p>}</div></div>
                      <div className="mt-4 space-y-2">
                        {(question.options || []).map((option, optionIndex) => {
                          const revealCorrect = answered && optionIndex === correctIndex;
                          const revealWrong = answered && optionIndex === selected && selected !== correctIndex;
                          const optionColors = ['border-sky-300 bg-sky-50 hover:border-sky-500', 'border-violet-300 bg-violet-50 hover:border-violet-500', 'border-amber-300 bg-amber-50 hover:border-amber-500'];
                          const badgeColors = ['bg-sky-500 text-white', 'bg-violet-500 text-white', 'bg-amber-500 text-white'];
                          return <button key={optionIndex} type="button" disabled={answered} onClick={() => setQuizAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))} className={`flex min-h-12 w-full items-start gap-3 rounded-xl border-2 px-3 py-3 text-left shadow-sm transition active:scale-[0.99] ${revealCorrect ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : revealWrong ? 'border-red-400 bg-red-50 ring-2 ring-red-100' : optionColors[optionIndex] || optionColors[0]} disabled:cursor-default`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black shadow-sm ${revealCorrect ? 'bg-emerald-500 text-white' : revealWrong ? 'bg-red-500 text-white' : badgeColors[optionIndex] || badgeColors[0]}`}>{String.fromCharCode(65 + optionIndex)}</span><span className="min-w-0"><span className="block font-black text-slate-900">{option.text_cn}</span>{showPinyin && option.pinyin && <span className="mt-0.5 block text-[11px] font-bold text-orange-600">{option.pinyin}</span>}{showThai && option.thai && <span className="mt-0.5 block text-xs font-medium text-slate-600">{option.thai}</span>}</span></button>;
                        })}
                      </div>
                      {answered && <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${selected === correctIndex ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{selected === correctIndex ? '✓ ถูกต้อง' : '✕ ยังไม่ถูก'} — {question.explanation_th}</p>}
                    </section>
                  );
                })}
              </div>
              {allQuizAnswered && <div className="mt-6 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-center text-white"><p className="text-sm font-bold text-white/75">คะแนนของคุณ</p><p className="mt-1 text-4xl font-black">{quizScore} / 3</p><button type="button" onClick={() => setQuizAnswers({})} className="mt-3 rounded-xl bg-white/15 px-4 py-2 text-sm font-black">ลองอีกครั้ง</button></div>}
              <button type="button" onClick={() => onComplete?.(book)} disabled={completing || !allQuizAnswered} className="mt-6 min-h-14 w-full rounded-2xl bg-emerald-500 px-5 py-3 text-base font-black text-white shadow-lg shadow-emerald-100 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40">{completing ? 'กำลังบันทึก…' : allQuizAnswered ? 'อ่านจบแล้ว ✓' : `ตอบคำถามให้ครบ (${answeredCount}/3)`}</button>
            </div>
          ) : <>
          {(pageIndex === 0 || isLegacyNovel) && (
            <div className="mb-5 min-w-0">
              {isLegacyNovel && <p className="mb-1 text-xs font-black uppercase tracking-wider text-emerald-600">บทที่ {pageIndex + 1}</p>}
              <h2 className="text-2xl font-black text-slate-900">{isLegacyNovel ? (page.heading_cn || book.title_cn) : book.title_cn}</h2>
              {showPinyin && (isLegacyNovel ? page.heading_pinyin : book.title_pinyin) && <p className="mt-1 text-sm font-bold text-orange-500">{isLegacyNovel ? page.heading_pinyin : book.title_pinyin}</p>}
              {showThai && (isLegacyNovel ? page.heading_thai : book.title_th) && <p className="mt-1 text-sm font-bold text-slate-500">{isLegacyNovel ? page.heading_thai : book.title_th}</p>}
            </div>
          )}
          {showContentImage && (
            <button type="button" onClick={() => setShowExpandedImage(true)} className="group relative mb-6 block w-full overflow-hidden rounded-2xl shadow-md" aria-label="ขยายภาพประกอบ">
              <img src={pageImageUrl} alt={`ภาพประกอบ${isLegacyNovel ? `บทที่ ${pageIndex + 1}` : 'เนื้อหา'}`} className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
              <span className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-slate-950/65 text-lg text-white shadow-lg backdrop-blur" aria-hidden="true">🔍</span>
            </button>
          )}
          <div className="space-y-6">
            {(page.paragraphs || []).map((paragraph, paragraphIndex) => (
              <div key={paragraphIndex} className="space-y-2">
                <div className="flex flex-wrap items-end gap-x-2 gap-y-3 leading-relaxed" style={{ fontSize: FONT_SIZES[fontIndex] }}>
                  {(paragraph.segments || []).map((segment, segmentIndex) => <span key={`${segment.hanzi}-${segmentIndex}`} className="inline-flex flex-col items-center">{showPinyin && segment.pinyin && segment.pinyin.trim().toLocaleLowerCase() !== segment.hanzi.trim().toLocaleLowerCase() && <span className="mb-0.5 text-[0.52em] font-bold leading-tight text-orange-500">{segment.pinyin}</span>}<span className="font-semibold text-slate-900">{segment.hanzi}</span></span>)}
                </div>
                {showThai && paragraph.thai && <p className="rounded-xl bg-orange-50 px-3 py-2 text-sm leading-relaxed text-slate-600">{paragraph.thai}</p>}
              </div>
            ))}
          </div>
          {pageIndex === pages.length - 1 && quizError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm font-bold text-red-600">{quizError}</p>}
          {pageIndex === pages.length - 1 && (novelInProgress
            ? <div className="mt-6 rounded-2xl bg-amber-100 px-5 py-4 text-center text-sm font-black text-amber-800">กำลังเขียนบทถัดไป…</div>
            : <button type="button" onClick={openQuiz} disabled={quizLoading} className="mt-6 min-h-14 w-full rounded-2xl bg-violet-600 px-5 py-3 text-base font-black text-white shadow-lg shadow-violet-100 transition active:scale-[0.99] disabled:opacity-60">{quizLoading ? 'กำลังสร้างคำถาม…' : 'ทำแบบทดสอบ →'}</button>)}
          </>}
        </article>
      </main>
      {showExpandedImage && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="ภาพประกอบแบบขยาย" onMouseDown={(event) => event.target === event.currentTarget && setShowExpandedImage(false)}>
          <img src={pageImageUrl} alt="ภาพประกอบเนื้อหาแบบขยาย" className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" />
          <button type="button" autoFocus onClick={() => setShowExpandedImage(false)} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/70 bg-slate-950/75 text-white shadow-xl" aria-label="ปิดภาพขยาย">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
      <footer className="shrink-0 border-t border-orange-200 bg-[#FBF4E6] px-4 pb-[max(0.8rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-1 sm:gap-2">
          <button type="button" onClick={() => setPageIndex(0)} disabled={pageIndex === 0} className="flex h-12 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 disabled:opacity-30 sm:w-11" aria-label="ไปหน้าแรก" title="หน้าแรก">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M6 5v14M18 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" onClick={() => setPageIndex((value) => Math.max(0, value - 1))} disabled={pageIndex === 0} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-slate-700 transition active:scale-95 disabled:opacity-30" aria-label="หน้าก่อนหน้า" title="ก่อนหน้า">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="min-w-20 flex-1 text-center text-sm font-black tabular-nums text-slate-600" aria-live="polite">{isLegacyNovel ? 'บท' : 'หน้า'} {Math.min(pageIndex + 1, targetPageCount)} / {targetPageCount}</div>
          <button type="button" onClick={() => setPageIndex((value) => Math.min(pages.length - 1, value + 1))} disabled={isQuizPage || pageIndex >= pages.length - 1} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm transition active:scale-95 disabled:bg-slate-100 disabled:text-slate-600 disabled:opacity-30" aria-label="หน้าถัดไป" title="ถัดไป">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" onClick={() => setPageIndex(Math.max(0, pages.length - 1))} disabled={isQuizPage || pageIndex >= pages.length - 1} className="flex h-12 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 disabled:opacity-30 sm:w-11" aria-label="ไปหน้าสุดท้าย" title="สุดท้าย">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M18 5v14M6 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </footer>
    </div>
  );
}

function CreateBookModal({ user, isAdmin = false, allMasterCards, selectedIds, quotaUsed, quotaLimit, onClose, onCreated }) {
  const [bookFormat, setBookFormat] = useState('standalone');
  const [category, setCategory] = useState('daily-life');
  const [seriesGenre, setSeriesGenre] = useState('adventure');
  const [level, setLevel] = useState('easy');
  const [minutes, setMinutes] = useState(5);
  const [longPageCount, setLongPageCount] = useState(16);
  const [textModel, setTextModel] = useState('gpt-5.6-terra');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('สนุกและอบอุ่น');
  const [novelAge, setNovelAge] = useState('10–12 ปี');
  const [novelGenre, setNovelGenre] = useState('detective');
  const [novelSecondaryGenre, setNovelSecondaryGenre] = useState('');
  const [novelTone, setNovelTone] = useState('ตื่นเต้น');
  const [novelSecondaryTone, setNovelSecondaryTone] = useState('');
  const [novelInterests, setNovelInterests] = useState(['ปริศนา']);
  const [novelProtagonist, setNovelProtagonist] = useState('');
  const [novelCompanion, setNovelCompanion] = useState('');
  const [novelSetting, setNovelSetting] = useState('');
  const [novelExclusions, setNovelExclusions] = useState('');
  const [useReaderProfile, setUseReaderProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const learnedWords = useMemo(() => {
    if (bookFormat !== 'standalone' || category !== 'learned-words') return [];
    const selected = new Set((selectedIds || []).map(Number));
    return (allMasterCards || []).filter((card) => selected.has(Number(card.id1 || card.id))).slice(0, 80).map((card) => ({ hanzi: card.cn || card.vocabulary, pinyin: card.pinyin || card.pinyin_vocab, thai: card.th })).filter((word) => word.hanzi);
  }, [allMasterCards, bookFormat, category, selectedIds]);

  useEffect(() => {
    if (bookFormat === 'series' && !LONG_STORY_LENGTHS.includes(longPageCount)) setLongPageCount(16);
  }, [bookFormat, longPageCount]);

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

  const isYouthNovel = bookFormat === 'youth_novel';
  const isSeries = bookFormat === 'series';
  const progress = elapsedSeconds < 15
    ? 10 + (elapsedSeconds * 1.3)
    : elapsedSeconds < 60
      ? 30 + ((elapsedSeconds - 15) * 0.8)
      : elapsedSeconds < 150
        ? 66 + ((elapsedSeconds - 60) * 0.27)
        : 92;
  const progressLabel = elapsedSeconds < 15
    ? (isYouthNovel ? 'กำลังส่งนิยายเข้าคิวสร้าง…' : isSeries ? 'กำลังส่งเรื่องยาวเข้าคิวสร้าง…' : 'กำลังเตรียมโครงเรื่อง…')
    : elapsedSeconds < 60
      ? 'กำลังเขียนภาษาจีน Pinyin และคำแปล…'
      : elapsedSeconds < 150
        ? 'กำลังวาดภาพปกและภาพประกอบ…'
        : 'กำลังบันทึกและตรวจสอบหนังสือ…';
  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
  const quotaReached = !isAdmin && Number.isFinite(quotaUsed) && quotaUsed >= quotaLimit;
  const toggleNovelInterest = (interest) => setNovelInterests((current) => current.includes(interest)
    ? current.filter((item) => item !== interest)
    : [...current, interest].slice(0, 5));

  const submit = async (event) => {
    event.preventDefault();
    if (quotaReached) {
      setError(`คุณใช้โควต้าครบ ${quotaLimit} ครั้งสำหรับวันนี้แล้ว โควต้าจะรีเซ็ตเวลา 00:00 น.`);
      return;
    }
    if (isYouthNovel && novelInterests.length === 0) {
      setError('กรุณาเลือกสิ่งที่เด็กชอบอย่างน้อย 1 อย่าง');
      return;
    }
    setElapsedSeconds(0); setSubmitting(true); setError('');
    try {
      const functionName = isYouthNovel || isSeries ? 'generate-long-book' : 'generate-book';
      const { data, error: invokeError } = await supabase.functions.invoke(functionName, { body: {
        bookFormat, category, seriesGenre, languageLevel: level, readingMinutes: minutes, pageCount: longPageCount, textModel, topic: topic.trim(), tone, learnedWords, useReaderProfile,
        novelOptions: isYouthNovel ? {
          age: novelAge, primaryGenre: novelGenre, secondaryGenre: novelSecondaryGenre,
          primaryTone: novelTone, secondaryTone: novelSecondaryTone, interests: novelInterests,
          protagonist: novelProtagonist.trim(), companion: novelCompanion.trim(), setting: novelSetting.trim(),
          exclusions: novelExclusions.trim(), useReaderProfile,
        } : undefined,
      } });
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
        const rawMessage = serverMessage || invokeError?.message || 'ไม่สามารถสร้างหนังสือได้';
        const message = typeof rawMessage === 'string' ? rawMessage : rawMessage?.message || JSON.stringify(rawMessage);
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
          <fieldset>
            <legend className="mb-3 font-black text-slate-800">1. รูปแบบหนังสือ</legend>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setBookFormat('standalone')} className={`min-w-0 rounded-2xl border-2 px-1 py-3 text-center text-xs font-black sm:text-sm ${bookFormat === 'standalone' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-white bg-white text-slate-700'}`}>📕 เล่มเดียวจบ</button>
              <button type="button" onClick={() => { setBookFormat('series'); setLongPageCount(16); }} className={`min-w-0 rounded-2xl border-2 px-1 py-3 text-center text-xs font-black sm:text-sm ${bookFormat === 'series' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-white bg-white text-slate-700'}`}>🎬 เรื่องยาว</button>
              <button type="button" onClick={() => { setBookFormat('youth_novel'); setLongPageCount(20); }} className={`min-w-0 rounded-2xl border-2 px-1 py-3 text-center text-xs font-black sm:text-sm ${isYouthNovel ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-white bg-white text-slate-700'}`}>📗 นิยายเยาวชน</button>
            </div>
          </fieldset>
          {bookFormat === 'standalone' && <fieldset><legend className="mb-3 font-black text-slate-800">2. เลือกหมวดหมู่</legend><div className="grid grid-cols-2 gap-2">{CATEGORIES.filter((item) => !item.filterOnly).map((item) => <button key={item.id} type="button" onClick={() => setCategory(item.id)} className={`rounded-2xl border-2 p-3 text-left transition ${category === item.id ? 'border-orange-500 bg-orange-50 shadow-md' : 'border-white bg-white'}`}><span className="mr-2 text-xl">{item.icon}</span><span className="text-sm font-black text-slate-800">{item.label}</span>{item.subtitle && <span className="mt-1 block pl-8 text-[10px] text-slate-400">{item.subtitle}</span>}</button>)}</div></fieldset>}
          {bookFormat === 'series' && <fieldset><legend className="mb-3 font-black text-slate-800">2. แนวเรื่องยาว</legend><div className="grid grid-cols-2 gap-2">{SERIES_GENRES.map((item) => <button key={item.id} type="button" onClick={() => setSeriesGenre(item.id)} className={`rounded-2xl border-2 p-3 text-left transition ${seriesGenre === item.id ? 'border-violet-500 bg-violet-50 shadow-md' : 'border-white bg-white'}`}><span className="mr-2 text-xl">{item.icon}</span><span className="text-sm font-black text-slate-800">{item.label}</span></button>)}</div><p className="mt-2 rounded-xl bg-violet-50 p-3 text-xs font-bold leading-relaxed text-violet-700">เรื่องเดียวต่อเนื่องตั้งแต่ต้นจนจบ สร้างและตรวจความต่อเนื่องพร้อมกันทั้งเล่ม</p></fieldset>}
          {isYouthNovel && (
            <div className="space-y-5 rounded-3xl border-2 border-emerald-100 bg-emerald-50/60 p-4">
              <div><h3 className="font-black text-emerald-900">2. ออกแบบนิยายเยาวชนเล่มเดียวจบ</h3><p className="mt-1 text-xs font-bold text-emerald-700">สร้างเนื้อเรื่องต่อเนื่องพร้อมกันทั้งเล่ม ช่องที่มี * จำเป็นต้องเลือก</p></div>
              <fieldset><legend className="mb-2 text-sm font-black text-slate-800">ช่วงอายุ *</legend><div className="grid grid-cols-3 gap-2">{NOVEL_AGES.map((age) => <button key={age} type="button" onClick={() => setNovelAge(age)} className={`rounded-xl border-2 px-1 py-3 text-xs font-black ${novelAge === age ? 'border-emerald-500 bg-white text-emerald-700' : 'border-white bg-white text-slate-600'}`}>{age}</button>)}</div></fieldset>
              <fieldset><legend className="mb-2 text-sm font-black text-slate-800">แนวเรื่องหลัก *</legend><div className="grid grid-cols-2 gap-2">{NOVEL_GENRES.map((item) => <button key={item.id} type="button" onClick={() => setNovelGenre(item.id)} className={`rounded-xl border-2 p-2 text-left text-xs font-black ${novelGenre === item.id ? 'border-emerald-500 bg-white text-emerald-800' : 'border-white bg-white text-slate-700'}`}><span className="mr-1.5 text-base">{item.icon}</span>{item.label}</button>)}</div></fieldset>
              <label className="block text-sm font-black text-slate-800">แนวเรื่องรอง <span className="font-normal text-slate-400">(ไม่บังคับ)</span><select value={novelSecondaryGenre} onChange={(event) => setNovelSecondaryGenre(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-white bg-white p-3 text-sm"><option value="">ให้ AI เลือก</option>{NOVEL_GENRES.filter((item) => item.id !== novelGenre).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.label}</option>)}</select></label>
              <fieldset><legend className="mb-2 text-sm font-black text-slate-800">โทนหลัก *</legend><div className="grid grid-cols-2 gap-2">{NOVEL_TONES.map((item) => <button key={item} type="button" onClick={() => setNovelTone(item)} className={`rounded-xl border-2 p-2 text-xs font-black ${novelTone === item ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-white bg-white text-slate-700'}`}>{item}</button>)}</div></fieldset>
              <label className="block text-sm font-black text-slate-800">โทนเสริม <span className="font-normal text-slate-400">(ไม่บังคับ)</span><select value={novelSecondaryTone} onChange={(event) => setNovelSecondaryTone(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-white bg-white p-3 text-sm"><option value="">ไม่มี</option>{NOVEL_TONES.filter((item) => item !== novelTone).map((item) => <option key={item}>{item}</option>)}</select></label>
              <fieldset><legend className="mb-2 text-sm font-black text-slate-800">สิ่งที่เด็กชอบ * <span className="font-normal text-slate-400">(เลือก 1–5)</span></legend><div className="flex flex-wrap gap-2">{NOVEL_INTERESTS.map((item) => <button key={item} type="button" onClick={() => toggleNovelInterest(item)} className={`rounded-full border-2 px-3 py-2 text-xs font-black ${novelInterests.includes(item) ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-white bg-white text-slate-600'}`}>{item}</button>)}</div></fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-black text-slate-800">ชื่อตัวละครเอก <span className="font-normal text-slate-400">(ไม่บังคับ)</span><input value={novelProtagonist} onChange={(event) => setNovelProtagonist(event.target.value)} maxLength={100} placeholder="เช่น Techin หรือ เทคชิน" className="mt-2 w-full rounded-xl border-2 border-white bg-white p-3 text-sm font-normal" /></label>
                <label className="text-sm font-black text-slate-800">ชื่อเพื่อนร่วมทาง <span className="font-normal text-slate-400">(ไม่บังคับ)</span><input value={novelCompanion} onChange={(event) => setNovelCompanion(event.target.value)} maxLength={100} placeholder="เช่น Nan หรือ น้องน่าน" className="mt-2 w-full rounded-xl border-2 border-white bg-white p-3 text-sm font-normal" /></label>
                <label className="text-sm font-black text-slate-800">สถานที่ของเรื่อง <span className="font-normal text-slate-400">(ไม่บังคับ)</span><input value={novelSetting} onChange={(event) => setNovelSetting(event.target.value)} maxLength={120} placeholder="เช่น เมืองเก่าปักกิ่ง" className="mt-2 w-full rounded-xl border-2 border-white bg-white p-3 text-sm font-normal" /></label>
                <label className="text-sm font-black text-slate-800">สิ่งที่ไม่ต้องการ <span className="font-normal text-slate-400">(ไม่บังคับ)</span><input value={novelExclusions} onChange={(event) => setNovelExclusions(event.target.value)} maxLength={160} placeholder="เช่น ไม่เอาฉากน่ากลัว" className="mt-2 w-full rounded-xl border-2 border-white bg-white p-3 text-sm font-normal" /></label>
              </div>
              <p className="rounded-xl bg-white/80 px-3 py-2 text-xs font-bold leading-relaxed text-emerald-700">ชื่อที่กรอกจะใช้ตามตัวอักษรเดิมทุกประการ ไม่แปลเป็นภาษาจีนและไม่ตั้งชื่อจีนแทน</p>
            </div>
          )}
          <label className="flex items-center justify-between gap-3 rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-slate-700"><span><span className="block">ใช้ข้อมูลความชอบจากการอ่านครั้งก่อน</span><span className="mt-1 block text-xs font-bold text-emerald-700">ใช้เฉพาะประวัติอ่านและรีวิวของบัญชีนี้</span></span><input type="checkbox" checked={useReaderProfile} onChange={(event) => setUseReaderProfile(event.target.checked)} className="h-5 w-5 shrink-0 accent-emerald-500" /></label>
          <fieldset><legend className="mb-3 font-black text-slate-800">3. ระดับภาษาจีน</legend><div className="space-y-2">{LEVELS.map((item) => <button key={item.id} type="button" onClick={() => setLevel(item.id)} className={`flex w-full items-center justify-between rounded-2xl border-2 p-3 text-left ${level === item.id ? 'border-cyan-500 bg-cyan-50' : 'border-white bg-white'}`}><span><span className="block text-sm font-black text-slate-800">{item.label}</span><span className="text-xs text-slate-400">{item.detail}</span></span><span className={`h-5 w-5 rounded-full border-4 ${level === item.id ? 'border-cyan-500 bg-white' : 'border-slate-200'}`} /></button>)}</div></fieldset>
          {isYouthNovel || isSeries ? <fieldset><legend className="mb-3 font-black text-slate-800">4. ความยาว</legend><div className={`grid gap-2 ${isYouthNovel ? 'grid-cols-3' : 'grid-cols-2'}`}>{(isYouthNovel ? NOVEL_LENGTHS : LONG_STORY_LENGTHS).map((pages) => <button key={pages} type="button" onClick={() => setLongPageCount(pages)} className={`relative min-w-0 rounded-2xl border-2 px-1 py-4 text-center ${longPageCount === pages ? 'border-violet-500 bg-violet-50' : 'border-white bg-white'}`}>{((isYouthNovel && pages === 20) || (isSeries && pages === 16)) && <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-2 py-0.5 text-[8px] font-black text-white">แนะนำ</span>}<span className="block whitespace-nowrap text-sm font-black text-slate-800 sm:text-base">{pages} หน้า</span></button>)}</div><p className="mt-2 text-center text-xs font-bold text-slate-500">{isYouthNovel ? `ปก 1 ภาพ · ภาพประกอบ ${longPageCount === 16 ? 4 : longPageCount === 20 ? 5 : 6} ภาพ · แบบทดสอบท้ายเล่ม` : `ปก 1 ภาพ · ภาพประกอบ ${longPageCount === 12 ? 3 : 4} ภาพ · 1 ตอนจบ`}</p></fieldset> : <fieldset><legend className="mb-3 font-black text-slate-800">4. ความยาว</legend><div className="grid grid-cols-4 gap-2">{LENGTHS.map((item) => <button key={item.minutes} type="button" onClick={() => setMinutes(item.minutes)} className={`min-w-0 rounded-2xl border-2 px-1 py-4 text-center ${minutes === item.minutes ? 'border-violet-500 bg-violet-50' : 'border-white bg-white'}`}><span className="block whitespace-nowrap text-sm font-black text-slate-800 sm:text-base">{item.pages} หน้า</span></button>)}</div></fieldset>}
          <fieldset><legend className="mb-3 font-black text-slate-800">5. โมเดลสร้างเนื้อหา</legend><div className="grid grid-cols-3 gap-2">{TEXT_MODELS.map((item) => <button key={item.id} type="button" onClick={() => setTextModel(item.id)} className={`relative rounded-2xl border-2 px-2 py-3 text-center ${textModel === item.id ? 'border-emerald-500 bg-emerald-50' : 'border-white bg-white'}`}>{item.recommended && <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-2 py-0.5 text-[8px] font-black text-white">แนะนำ</span>}<span className="block text-xs font-black text-slate-800">{item.label}</span><span className="mt-1 block text-[10px] text-slate-400">{item.detail}</span></button>)}</div></fieldset>
          <div><label htmlFor="book-topic" className="mb-2 block font-black text-slate-800">6. {isYouthNovel ? 'ไอเดียหรือเหตุการณ์ที่อยากให้มี' : 'อยากอ่านเรื่องอะไร?'} <span className="font-normal text-slate-400">(ไม่บังคับ)</span></label><textarea id="book-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={240} rows={3} placeholder={isYouthNovel ? 'เว้นว่างเพื่อให้ AI ออกแบบเรื่องให้ทั้งหมด' : 'เช่น แพนด้าตัวน้อยไปเที่ยวกำแพงเมืองจีน'} className="w-full resize-none rounded-2xl border-2 border-white bg-white p-3 text-sm text-slate-800 outline-none focus:border-orange-400" /></div>
          {!isYouthNovel && <div><label htmlFor="book-tone" className="mb-2 block font-black text-slate-800">โทนของหนังสือ</label><select id="book-tone" value={tone} onChange={(event) => setTone(event.target.value)} className="w-full rounded-2xl border-2 border-white bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-400"><option>สนุกและอบอุ่น</option><option>ตลก</option><option>ผจญภัย</option><option>น่าตื่นเต้น</option><option>ให้ความรู้</option></select></div>}
          {category === 'learned-words' && <p className="rounded-xl bg-cyan-50 p-3 text-xs font-bold text-cyan-700">จะใช้คำศัพท์ที่คุณเรียนแล้ว {learnedWords.length} คำเป็นวัตถุดิบในการแต่งเรื่อง</p>}
          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}
          {submitting && (
            <div className="rounded-2xl border-2 border-orange-200 bg-white p-4 shadow-inner" role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-slate-800">{progressLabel}</span><span className="shrink-0 font-mono text-xs font-bold text-orange-600">{elapsedLabel}</span></div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-orange-100"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(92, progress)}%` }} /></div>
              <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-400"><span>ความคืบหน้าโดยประมาณ</span><span>โดยทั่วไป 1–3 นาที</span></div>
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-black text-red-600">{isSeries || isYouthNovel ? 'กรุณารอสักครู่จนระบบรับงานเข้าคิวสำเร็จ แล้วสามารถปิดหรือรีเฟรชได้' : 'กรุณาอย่ากดซ้ำ อย่าปิดหน้าต่าง และอย่ารีเฟรชหน้านี้'}</p>
            </div>
          )}
          <button type="submit" disabled={submitting || !user?.id || quotaReached} className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 py-4 text-lg font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60">{submitting ? `${isYouthNovel ? 'กำลังเริ่มสร้างนิยาย' : isSeries ? 'กำลังเริ่มสร้างเรื่องยาว' : 'กำลังสร้างหนังสือ'}… ${elapsedLabel}` : quotaReached ? 'โควต้าครบแล้ว' : isYouthNovel ? '✨ สร้างนิยายเล่มเดียวจบ' : isSeries ? '✨ สร้างเรื่องยาว' : '✨ สร้างหนังสือ'}</button>
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
  const [seriesRows, setSeriesRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [activeBook, setActiveBook] = useState(null);
  const [readBookIds, setReadBookIds] = useState(() => new Set());
  const [bookProgress, setBookProgress] = useState(() => new Map());
  const [completingBookId, setCompletingBookId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [quotaUsed, setQuotaUsed] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [seriesError, setSeriesError] = useState('');
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewEnjoyment, setReviewEnjoyment] = useState('');
  const [reviewAspect, setReviewAspect] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const refreshQuota = useCallback(async () => {
    if (!userId) { setQuotaUsed(0); return; }
    if (isAdmin) { setQuotaUsed(null); return; }
    const { count, error } = await supabase.from('ai_books').select('id', { count: 'exact', head: true }).eq('creator_id', userId).gte('created_at', bangkokDayStartIso()).neq('status', 'canceled').or('series_id.is.null,episode_number.eq.1');
    setQuotaUsed(error ? null : Number(count || 0));
  }, [isAdmin, userId]);
  const loadBooks = useCallback(async () => {
    setLoading(true); setLoadError('');
    const quotaRequest = userId && !isAdmin
      ? supabase.from('ai_books').select('id', { count: 'exact', head: true }).eq('creator_id', userId).gte('created_at', bangkokDayStartIso()).neq('status', 'canceled').or('series_id.is.null,episode_number.eq.1')
      : Promise.resolve({ count: 0, error: null });
    const readsRequest = userId
      ? supabase.from('ai_book_reads').select('book_id').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null });
    const progressRequest = userId
      ? supabase.from('ai_book_progress').select('book_id,page_index').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null });
    const seriesRequest = supabase.from('ai_book_series').select('id, title_cn, title_pinyin, title_th, total_episodes, generation_status, generation_progress, error_message').limit(1000);
    const [booksResult, summaryResult, quotaResult, readsResult, progressResult, seriesResult] = await Promise.all([supabase.from('ai_books').select('*').order('created_at', { ascending: false }).limit(1000), supabase.rpc('get_ai_book_cost_summary'), quotaRequest, readsRequest, progressRequest, seriesRequest]);
    if (booksResult.error) { setLoadError(booksResult.error.code === '42P01' ? 'ยังไม่ได้ติดตั้งฐานข้อมูล Books กรุณารันไฟล์ sql/ai_books.sql ใน Supabase' : booksResult.error.message); setBooks([]); } else setBooks(booksResult.data || []);
    if (!seriesResult.error) setSeriesRows(seriesResult.data || []);
    if (!summaryResult.error) setSummary(Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data);
    setQuotaUsed(isAdmin ? null : quotaResult.error ? null : Number(quotaResult.count || 0));
    if (!readsResult.error) setReadBookIds(new Set((readsResult.data || []).map((item) => item.book_id)));
    if (!progressResult.error) setBookProgress(new Map((progressResult.data || []).map((item) => [item.book_id, Number(item.page_index || 0)])));
    setLoading(false);
  }, [isAdmin, userId]);
  useEffect(() => {
    // The async callback owns the initial loading lifecycle for this server-backed screen.
    loadBooks();
  }, [loadBooks]);
  const hasBookInProgress = books.some((book) => book.status === 'generating' || (book.status === 'partial' && book.generation_progress?.stage !== 'failed')) || seriesRows.some((series) => series.generation_status === 'generating');
  useEffect(() => {
    if (!hasBookInProgress) return undefined;
    const poll = async () => {
      const [{ data, error }, { data: nextSeriesRows }] = await Promise.all([
        supabase.from('ai_books').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('ai_book_series').select('id, title_cn, title_pinyin, title_th, total_episodes, generation_status, generation_progress, error_message').limit(1000),
      ]);
      if (error) return;
      setBooks(data || []);
      if (nextSeriesRows) setSeriesRows(nextSeriesRows);
      setActiveBook((current) => current ? ((data || []).find((book) => book.id === current.id) || current) : current);
      if (!(data || []).some((book) => book.status === 'generating' || (book.status === 'partial' && book.generation_progress?.stage !== 'failed')) && !(nextSeriesRows || []).some((series) => series.generation_status === 'generating')) {
        const { data: nextSummary } = await supabase.rpc('get_ai_book_cost_summary');
        if (nextSummary) setSummary(Array.isArray(nextSummary) ? nextSummary[0] : nextSummary);
      }
    };
    const intervalId = window.setInterval(poll, 5000);
    return () => window.clearInterval(intervalId);
  }, [hasBookInProgress]);
  useEffect(() => {
    let midnightTimer;
    const scheduleMidnightRefresh = () => {
      midnightTimer = window.setTimeout(async () => {
        await refreshQuota();
        scheduleMidnightRefresh();
      }, millisecondsUntilBangkokMidnight());
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshQuota();
    };
    window.addEventListener('focus', refreshQuota);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    scheduleMidnightRefresh();
    return () => {
      window.clearTimeout(midnightTimer);
      window.removeEventListener('focus', refreshQuota);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshQuota]);
  const recordReadingEvent = useCallback(async (book, eventType, chapterNumber) => {
    if (!userId || book?.book_format !== 'youth_novel') return;
    const normalizedEvent = eventType === 'start' && readBookIds.has(book.id) ? 'reread' : eventType;
    await supabase.from('ai_book_reader_events').insert({
      user_id: userId,
      book_id: book.id,
      event_type: normalizedEvent,
      chapter_number: Number(chapterNumber || 1),
    });
  }, [readBookIds, userId]);
  const saveBookProgress = useCallback(async (bookId, pageIndex) => {
    if (!userId || !bookId || !Number.isInteger(pageIndex) || pageIndex < 0) return;
    setBookProgress((current) => new Map(current).set(bookId, pageIndex));
    const { error } = await supabase.from('ai_book_progress').upsert({
      user_id: userId,
      book_id: bookId,
      page_index: pageIndex,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,book_id' });
    if (error && error.code !== '42P01') console.error('save book progress:', error.message);
  }, [userId]);
  const completeBook = async (book) => {
    if (!userId || completingBookId) return;
    setCompletingBookId(book.id);
    const { error } = await supabase.from('ai_book_reads').upsert({ user_id: userId, book_id: book.id, completed_at: new Date().toISOString() }, { onConflict: 'user_id,book_id' });
    if (!error) {
      try { await recordDailyBookRead(userId, book.id); } catch { /* Keep the reading record even if the mission upgrade is not installed yet. */ }
      setReadBookIds((current) => new Set([...current, book.id]));
      await supabase.from('ai_book_progress').delete().eq('user_id', userId).eq('book_id', book.id);
      setBookProgress((current) => { const next = new Map(current); next.delete(book.id); return next; });
      if (book.book_format === 'youth_novel') {
        await recordReadingEvent(book, 'complete', 8);
      }
      const isFinalSeriesEpisode = book.book_format === 'series'
        && Number(book.episode_number || 0) >= Number(book.series_total || 5);
      if (book.book_format !== 'series' || isFinalSeriesEpisode) {
        setReviewEnjoyment('');
        setReviewAspect('');
        setReviewError('');
        setReviewTarget(book);
      }
      setActiveBook(null);
    } else {
      setSeriesError(error.code === '42P01' ? 'กรุณารันไฟล์ SQL อัปเกรดภารกิจและประวัติการอ่านก่อน' : error.message);
    }
    setCompletingBookId(null);
  };
  const saveBookReview = async () => {
    if (!userId || !reviewTarget?.id || !reviewEnjoyment || !reviewAspect || reviewSaving) return;
    setReviewSaving(true);
    setReviewError('');
    const { error } = await supabase.from('ai_book_reviews').upsert({
      user_id: userId,
      book_id: reviewTarget.id,
      enjoyment: reviewEnjoyment,
      favorite_aspect: reviewAspect,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,book_id' });
    setReviewSaving(false);
    if (error) {
      setReviewError(error.message);
      return;
    }
    setReviewTarget(null);
  };
  const deleteBook = async () => {
    const book = deleteTarget;
    if (!isAdmin || deletingId || !book) return;
    const isSeriesCollection = Boolean(book.series_id && book._isSeriesCollection);
    const deleteId = isSeriesCollection ? book.series_id : book.id;
    setDeleteError('');
    setDeletingId(deleteId);
    const { data, error } = await supabase.functions.invoke('delete-book', { body: isSeriesCollection ? { seriesId: book.series_id } : { bookId: book.id } });
    setDeletingId(null);
    if (error || !data?.ok) {
      setDeleteError(await functionErrorMessage(data, error, isSeriesCollection ? 'ลบซีรีส์ไม่สำเร็จ' : 'ลบหนังสือไม่สำเร็จ'));
      return;
    }
    setBooks((current) => current.filter((item) => isSeriesCollection ? item.series_id !== book.series_id : item.id !== book.id));
    if (isSeriesCollection ? activeBook?.series_id === book.series_id : activeBook?.id === book.id) setActiveBook(null);
    setDeleteTarget(null);
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
      setBooks((current) => current.filter((item) => book.series_id ? item.series_id !== book.series_id : item.id !== book.id));
      setQuotaUsed((current) => Number.isFinite(current) ? Math.max(0, current - 1) : current);
      setCancelTarget(null);
      if (book.series_id ? activeBook?.series_id === book.series_id : activeBook?.id === book.id) setActiveBook(null);
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
      || (book.creator_id === userId && ['generating', 'partial', 'failed'].includes(book.status)));
  const shelfEntries = buildShelfEntries(tabBooks, seriesRows, readBookIds, books);
  const categoryCounts = shelfEntries.reduce((counts, entry) => {
    counts[entry.book.category] = (counts[entry.book.category] || 0) + 1;
    return counts;
  }, {});
  const visibleBooks = shelfEntries.filter((entry) => categoryFilter === 'all' || entry.book.category === categoryFilter);
  const totalPages = Math.max(1, Math.ceil(visibleBooks.length / BOOKS_PER_PAGE));
  const displayedPage = Math.min(currentPage, totalPages);
  const paginatedBooks = visibleBooks.slice((displayedPage - 1) * BOOKS_PER_PAGE, displayedPage * BOOKS_PER_PAGE);
  const activeSeriesEpisodes = activeBook?.series_id
    ? books.filter((book) => book.series_id === activeBook.series_id && book.status === 'ready')
      .sort((a, b) => Number(a.episode_number || 0) - Number(b.episode_number || 0))
    : [];
  const changePage = (nextPage) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const quotaReached = !isAdmin && Number.isFinite(quotaUsed) && quotaUsed >= DAILY_BOOK_LIMIT;
  const quotaRemaining = isAdmin ? '∞' : Number.isFinite(quotaUsed) ? Math.max(0, DAILY_BOOK_LIMIT - quotaUsed) : null;
  const openCreateBook = () => {
    if (quotaReached) {
      setShowQuotaModal(true);
      return;
    }
    setShowCreate(true);
  };
  const ensureBookQuiz = async (book) => {
    const existingQuiz = quizQuestionsFromBook(book);
    if (existingQuiz.length === 3) return book;
    const { data, error } = await supabase.functions.invoke('generate-book-quiz', { body: { bookId: book.id } });
    if (error || !data?.book) throw new Error(await functionErrorMessage(data, error, 'สร้างคำถามท้ายเล่มไม่สำเร็จ'));
    const updatedBook = data.book;
    setBooks((current) => current.map((item) => item.id === updatedBook.id ? updatedBook : item));
    setActiveBook(updatedBook);
    return updatedBook;
  };

  return (
    <div className="min-h-full pb-8 pt-[max(3.5rem,env(safe-area-inset-top))] sm:pt-0">
      <div className="relative z-20 mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setPage('dashboard')} className="min-h-11 touch-manipulation rounded-xl px-2 text-xs font-black uppercase italic text-orange-600 underline [-webkit-tap-highlight-color:transparent]">← กลับหน้าหลัก</button>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={openCreateBook} className="min-h-11 shrink-0 touch-manipulation whitespace-nowrap rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-black text-white shadow-lg active:scale-95 [-webkit-tap-highlight-color:transparent]">＋ สร้างหนังสือ</button>
          <span className={`flex h-11 min-w-11 items-center justify-center rounded-2xl border-2 px-2 text-lg font-black shadow-sm ${quotaReached ? 'border-red-200 bg-red-50 text-red-600' : 'border-orange-200 bg-white text-orange-600'}`} aria-label={isAdmin ? 'Admin สร้างหนังสือได้ไม่จำกัด' : `โควต้าสร้างหนังสือคงเหลือ ${quotaRemaining ?? 'กำลังตรวจสอบ'}`} title={isAdmin ? 'Admin · ไม่จำกัดจำนวนหนังสือต่อวัน' : 'จำนวนโควต้าสร้างหนังสือคงเหลือ'}>{quotaRemaining ?? '–'}</span>
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
            <option value="all">ทุกประเภท ({shelfEntries.length})</option>
            {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.label}{item.subtitle ? ` — ${item.subtitle}` : ''} ({categoryCounts[item.id] || 0})</option>)}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400" aria-hidden="true">▼</span>
        </div>
      </div>
      {loading ? <div className="py-16 text-center font-bold text-slate-400">กำลังเปิดชั้นหนังสือ…</div> : loadError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center"><p className="text-sm font-bold text-amber-800">{loadError}</p><button type="button" onClick={loadBooks} className="mt-3 text-sm font-black text-orange-600 underline">ลองอีกครั้ง</button></div> : visibleBooks.length ? <><div className="grid grid-cols-2 gap-4">{paginatedBooks.map((entry) => <BookCover key={entry.key} book={entry.book} onOpen={() => entry.openBook && setActiveBook(entry.openBook)} canSeeCost={isAdmin || entry.book.creator_id === userId} canDelete={isAdmin} deleting={deletingId === (entry.isSeries ? entry.book.series_id : entry.book.id)} onDelete={(book) => { setDeleteError(''); setDeleteTarget(book); }} canCancel={!!entry.pendingBook && (isAdmin || entry.pendingBook.creator_id === userId)} canceling={cancelingId === entry.pendingBook?.id} onCancel={() => { setCancelError(''); setCancelTarget(entry.pendingBook); }} />)}</div>{totalPages > 1 && <nav className="mt-6 flex items-center justify-between gap-2 rounded-2xl border-2 border-white bg-white p-2 shadow-md" aria-label="เลือกหน้าหนังสือ"><button type="button" onClick={() => changePage(displayedPage - 1)} disabled={displayedPage === 1} className="min-h-11 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700 disabled:opacity-35">← ก่อนหน้า</button><label className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-600"><span className="hidden sm:inline">หน้า</span><select aria-label="เลือกหน้าหนังสือ" value={displayedPage} onChange={(event) => changePage(Number(event.target.value))} className="min-h-11 rounded-xl border-2 border-orange-200 bg-orange-50 px-3 text-center font-black text-orange-700 outline-none">{Array.from({ length: totalPages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select><span>/ {totalPages}</span></label><button type="button" onClick={() => changePage(displayedPage + 1)} disabled={displayedPage === totalPages} className="min-h-11 rounded-xl bg-orange-500 px-3 text-sm font-black text-white disabled:opacity-35">ถัดไป →</button></nav>}</> : <div className="rounded-[2rem] border-2 border-dashed border-orange-200 bg-white/70 px-6 py-12 text-center"><div className="text-6xl">📚</div><h2 className="mt-4 text-lg font-black text-slate-800">{categoryFilter !== 'all' ? `ยังไม่มีหนังสือประเภท ${categoryMeta(categoryFilter).label}` : tab === 'mine' ? 'ยังไม่มีหนังสือของคุณ' : 'ชั้นหนังสือยังว่างอยู่'}</h2><p className="mt-1 text-sm text-slate-400">{categoryFilter !== 'all' ? 'ลองเลือกประเภทอื่นหรือแสดงหนังสือทั้งหมด' : 'เริ่มสร้างหนังสือจีนเล่มแรกกันเลย'}</p>{categoryFilter !== 'all' ? <button type="button" onClick={() => { setCategoryFilter('all'); setCurrentPage(1); }} className="mt-5 rounded-2xl bg-slate-700 px-5 py-3 font-black text-white">แสดงทุกประเภท</button> : <button type="button" onClick={openCreateBook} className="mt-5 rounded-2xl bg-orange-500 px-5 py-3 font-black text-white">สร้างหนังสือใหม่</button>}</div>}
      {visibleBooks.length > 0 && <div className="h-4" aria-hidden="true" />}
      {deleteTarget && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/80 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-book-title" onMouseDown={(event) => event.target === event.currentTarget && !deletingId && setDeleteTarget(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border-2 border-red-100 bg-white text-center shadow-2xl">
            <div className="bg-gradient-to-br from-red-500 to-rose-600 px-6 py-6 text-white"><div className="text-5xl" aria-hidden="true">🗑️</div><h2 id="delete-book-title" className="mt-2 text-xl font-black">{deleteTarget._isSeriesCollection ? 'ลบซีรีส์ทั้งหมด?' : 'ลบหนังสือเล่มนี้?'}</h2></div>
            <div className="px-6 py-6">
              <p className="text-lg font-black text-slate-900">{deleteTarget.title_th || deleteTarget.title_cn || 'หนังสือเล่มนี้'}</p>
              {deleteTarget._isSeriesCollection && <p className="mt-2 inline-flex rounded-full bg-violet-100 px-3 py-1 text-sm font-black text-violet-700">ซีรีส์ {deleteTarget._seriesEpisodeCount || 0} ตอน</p>}
              <p className="mt-4 text-sm font-bold leading-relaxed text-slate-600">{deleteTarget._isSeriesCollection ? 'หนังสือทุกตอน รูปภาพ ประวัติการอ่าน และประวัติค่าใช้จ่ายของซีรีส์นี้จะถูกลบทั้งหมด' : 'ข้อมูลหนังสือ รูปภาพ ประวัติการอ่าน และประวัติค่าใช้จ่ายของเล่มนี้จะถูกลบ'}</p>
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-600">การลบนี้ไม่สามารถเรียกคืนได้</p>
              {deleteError && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{deleteError}</p>}
              <div className="mt-6 grid grid-cols-2 gap-2"><button type="button" autoFocus onClick={() => { setDeleteTarget(null); setDeleteError(''); }} disabled={!!deletingId} className="min-h-12 rounded-2xl bg-slate-100 px-4 font-black text-slate-600 disabled:opacity-50">ยกเลิก</button><button type="button" onClick={deleteBook} disabled={!!deletingId} className="min-h-12 rounded-2xl bg-red-500 px-4 font-black text-white shadow-lg disabled:opacity-60">{deletingId ? 'กำลังลบ…' : 'ยืนยันลบ'}</button></div>
            </div>
          </div>
        </div>
      )}
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
            <div className="px-6 py-6"><p className="text-sm font-bold leading-relaxed text-slate-600">คุณใช้โควต้าครบ {DAILY_BOOK_LIMIT} ครั้งสำหรับวันนี้แล้ว โควต้าจะรีเซ็ตเวลา 00:00 น. ตามเวลาไทย</p><button type="button" autoFocus onClick={() => setShowQuotaModal(false)} className="mt-6 min-h-12 w-full rounded-2xl bg-orange-500 px-5 py-3 text-base font-black text-white shadow-lg transition active:scale-95">ตกลง</button></div>
          </div>
        </div>
      )}
      {seriesError && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/75 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="series-error-title" onMouseDown={(event) => event.target === event.currentTarget && setSeriesError('')}>
          <div className="w-full max-w-sm rounded-[2rem] border-2 border-red-100 bg-white p-6 text-center shadow-2xl"><div className="text-5xl">⚠️</div><h2 id="series-error-title" className="mt-3 text-xl font-black text-red-600">ดำเนินการไม่สำเร็จ</h2><p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{seriesError}</p><button type="button" autoFocus onClick={() => setSeriesError('')} className="mt-6 min-h-12 w-full rounded-2xl bg-orange-500 px-5 py-3 font-black text-white">ตกลง</button></div>
        </div>
      )}
      {reviewTarget && (
        <div className="fixed inset-0 z-[155] flex items-center justify-center bg-slate-950/75 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="book-review-title">
          <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-[2rem] border-2 border-violet-100 bg-white p-6 shadow-2xl">
            <div className="text-center"><div className="text-5xl" aria-hidden="true">📚</div><h2 id="book-review-title" className="mt-2 text-xl font-black text-slate-900">{reviewTarget.book_format === 'series' && reviewTarget.series_id ? 'หนูชอบซีรีส์นี้แค่ไหน?' : reviewTarget.book_format === 'series' ? 'หนูชอบเรื่องยาวนี้แค่ไหน?' : 'หนูชอบหนังสือเล่มนี้แค่ไหน?'}</h2><p className="mt-1 text-sm font-bold text-slate-500">{reviewTarget.book_format === 'series' && reviewTarget.series_id ? `อ่านครบ ${reviewTarget.series_total || 5} ตอนแล้ว ตอบ 2 ข้อสั้น ๆ ได้เลย` : 'อ่านจบแล้ว ตอบ 2 ข้อสั้น ๆ ได้เลย'}</p></div>
            <div className="mt-5 grid grid-cols-2 gap-2">{REVIEW_ENJOYMENT.map((item) => <button key={item.id} type="button" onClick={() => setReviewEnjoyment(item.id)} aria-pressed={reviewEnjoyment === item.id} className={`min-h-12 rounded-2xl border-2 px-3 text-sm font-black transition ${reviewEnjoyment === item.id ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-slate-100 bg-slate-50 text-slate-700'}`}>{item.label}</button>)}</div>
            <h3 className="mt-6 text-center text-base font-black text-slate-900">ชอบอะไรมากที่สุด?</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">{REVIEW_ASPECTS.map((item) => <button key={item.id} type="button" onClick={() => setReviewAspect(item.id)} aria-pressed={reviewAspect === item.id} className={`min-h-12 rounded-2xl border-2 px-3 text-sm font-black transition ${reviewAspect === item.id ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-slate-100 bg-slate-50 text-slate-700'}`}>{item.label}</button>)}</div>
            {reviewError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-600">{reviewError}</p>}
            <div className="mt-6 grid grid-cols-[0.8fr_1.2fr] gap-2"><button type="button" onClick={() => setReviewTarget(null)} disabled={reviewSaving} className="min-h-12 rounded-2xl bg-slate-100 px-3 font-black text-slate-500 disabled:opacity-50">ไว้ทีหลัง</button><button type="button" onClick={saveBookReview} disabled={!reviewEnjoyment || !reviewAspect || reviewSaving} className="min-h-12 rounded-2xl bg-violet-600 px-3 font-black text-white shadow-lg disabled:opacity-40">{reviewSaving ? 'กำลังบันทึก…' : 'บันทึกรีวิว ✓'}</button></div>
          </div>
        </div>
      )}
      {showCreate && <CreateBookModal user={user} isAdmin={isAdmin} allMasterCards={allMasterCards} selectedIds={selectedIds} quotaUsed={quotaUsed} quotaLimit={DAILY_BOOK_LIMIT} onClose={() => setShowCreate(false)} onCreated={async (book) => { setShowCreate(false); setBooks((current) => [book, ...current.filter((item) => item.id !== book.id)]); setTab('mine'); setCurrentPage(1); if (['ready', 'partial'].includes(book.status)) setActiveBook(book); await loadBooks(); }} />}
      {activeBook && <Reader key={activeBook.id} book={activeBook} seriesEpisodes={activeSeriesEpisodes} readBookIds={readBookIds} savedPageIndex={bookProgress.has(activeBook.id) ? bookProgress.get(activeBook.id) : null} onSaveProgress={saveBookProgress} onSelectEpisode={(episodeId) => setActiveBook(activeSeriesEpisodes.find((episode) => episode.id === episodeId) || activeBook)} onClose={() => setActiveBook(null)} onComplete={completeBook} completing={completingBookId === activeBook.id} onReadingEvent={recordReadingEvent} onEnsureQuiz={ensureBookQuiz} />}
    </div>
  );
}
