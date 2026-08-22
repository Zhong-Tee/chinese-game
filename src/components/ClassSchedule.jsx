import React, { useEffect, useMemo, useState } from 'react';
import { createEmptyClassSchedule, loadClassSchedule, saveClassSchedule, WEEK_DAYS } from '../utils/classScheduleStorage';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
const GRADE_5_SUBJECT_OPTIONS = [
  'วิทยาศาสตร์ 5',
  'วิทยาการคำนวณ 5',
  'CEL',
  'คณิตศาสตร์ 5',
  'ภาษาจีน 5',
  'ภาษาไทย 5',
  'ภาษาอังกฤษ 5',
  'ทักษะภาษาอังกฤษ (Math)',
  'ทักษะภาษาอังกฤษ (Science)',
  'ศิลป์พื้นฐาน 5',
  'การงานอาชีพ 5',
  'ดนตรี 5',
  'STEM ACTIVITY 5',
  'สุขศึกษาและพลศึกษา 5',
  'ลูกเสือ',
  'สังคมศึกษา 5',
  'มงฟอร์ตศึกษา 5',
  'ประวัติศาสตร์ 5',
  'สอนเสริม',
];
const GRADE_2_SUBJECT_OPTIONS = [
  'วิทยาศาสตร์ 2',
  'วิทยาการคำนวณ 2',
  'CEL',
  'คณิตศาสตร์ 2',
  'ภาษาจีน 2',
  'ภาษาไทย 2',
  'ภาษาอังกฤษ 2',
  'ทักษะภาษาอังกฤษ (Math)',
  'ทักษะภาษาอังกฤษ (Science)',
  'ศิลปพื้นฐาน 2',
  'การงานอาชีพ 2',
  'ดนตรี 2',
  'STEM ACTIVITY 2',
  'สุขศึกษาและพลศึกษา 2',
  'ลูกเสือ',
  'สังคมศึกษา 2',
  'มงฟอร์ตศึกษา 2',
  'ประวัติศาสตร์ 2',
  'สอนเสริม',
];
const SUBJECT_OPTIONS_BY_GRADE = {
  2: GRADE_2_SUBJECT_OPTIONS,
  5: GRADE_5_SUBJECT_OPTIONS,
};
const blank = () => ({ gradeLevel: 5, subject: '', periodCount: 1, start: '08:00', end: '09:00', book: '', bookImage: '', supplies: '', suppliesImage: '', location: 'school' });
const blankLunchBreak = () => ({ type: 'break', subject: 'พักเที่ยง', periodCount: 0, start: '12:00', end: '13:00', book: '', bookImage: '', supplies: '', suppliesImage: '', location: 'school' });
function synchronizeWeeklyLunch(schedule) {
  const lunch = WEEK_DAYS.flatMap(({ id }) => schedule[id]).find((lesson) => lesson.type === 'break');
  if (!lunch) return schedule;
  return {
    ...schedule,
    ...Object.fromEntries(WEEK_DAYS.map(({ id }) => [id, [
      ...schedule[id].filter((lesson) => lesson.type !== 'break'),
      { ...lunch, id: schedule[id].find((lesson) => lesson.type === 'break')?.id || `lunch-${id}-${Date.now()}` },
    ]])),
  };
}
function resizeBookImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const maxSize = 700;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function Icon({ className = 'w-7 h-7' }) { return <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true"><path d="M5 3v3M19 3v3M4 9h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M7 13.2c1.8-.8 3.3-.55 5 .55v4.5c-1.7-1.1-3.2-1.35-5-.55v-4.5Zm10 0c-1.8-.8-3.3-.55-5 .55v4.5c1.7-1.1 3.2-1.35 5-.55v-4.5Z" fill="currentColor"/></svg>; }
function lessonHighlight(lesson) {
  const bookAtHome = Boolean(lesson.book) && lesson.location === 'home';
  const needsSupplies = Boolean(lesson.supplies || lesson.suppliesImage);
  if (bookAtHome && needsSupplies) return 'border-2 border-pink-400 ring-2 ring-pink-100 shadow-pink-100';
  if (bookAtHome) return 'border-2 border-amber-400 ring-2 ring-amber-100 shadow-amber-100';
  if (needsSupplies) return 'border-2 border-violet-400 ring-2 ring-violet-100 shadow-violet-100';
  return 'border border-slate-100';
}

function LunchBreakRow({ lesson, onOpen }) {
  return <div className="py-2">
    <div className="flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-300"/><span className="text-[10px] font-black tracking-[0.2em] text-amber-600">LUNCH BREAK</span><span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-300"/></div>
    <div onClick={onOpen} className="mt-2 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-4 py-3 ring-1 ring-amber-200/80 transition active:scale-[0.99]" role="button" tabIndex="0">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-2xl shadow-sm ring-1 ring-amber-200">🍱</span>
      <div className="min-w-0 flex-1"><p className="text-xs font-bold text-amber-600">เวลาพักผ่อนและรับประทานอาหาร</p><h3 className="text-lg font-black text-amber-950">พักเที่ยง</h3></div>
      <span className="shrink-0 rounded-xl bg-white/90 px-3 py-2 text-sm font-black text-amber-700 shadow-sm">{lesson.start}–{lesson.end}</span>
    </div>
  </div>;
}

export default function ClassSchedule({ user, setPage }) {
  const currentWeekDay = new Date().getDay();
  const todayDayId = currentWeekDay >= 1 && currentWeekDay <= 5 ? WEEK_DAYS[currentWeekDay - 1].id : null;
  const [day, setDay] = useState(todayDayId || WEEK_DAYS[0].id);
  const [data, setData] = useState(createEmptyClassSchedule);
  const [dataReady, setDataReady] = useState(false);
  const [, setSaveStatus] = useState('loading');
  const [editing, setEditing] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [form, setForm] = useState(blank);
  useEffect(() => {
    let active = true;
    loadClassSchedule(user?.id).then((schedule) => {
      if (!active) return;
      setData(synchronizeWeeklyLunch(schedule));
      setDataReady(true);
      setSaveStatus('saved');
    }).catch((error) => {
      console.error('load class schedule:', error);
      if (active) setSaveStatus('error');
    });
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => {
    if (!dataReady || !user?.id) return undefined;
    const timer = setTimeout(() => {
      saveClassSchedule(user.id, data)
        .then(() => setSaveStatus('saved'))
        .catch((error) => { console.error('save class schedule:', error); setSaveStatus('error'); });
    }, 500);
    return () => clearTimeout(timer);
  }, [data, dataReady, user?.id]);
  const lessons = useMemo(() => [...data[day]].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)), [data, day]);
  const lessonPeriods = useMemo(() => lessons.map((lesson, index) => {
      if (lesson.type === 'break') return null;
      const count = Math.max(1, Math.min(3, Number(lesson.periodCount) || 1));
      const startPeriod = 1 + lessons.slice(0, index).reduce(
        (total, previousLesson) => total + (previousLesson.type === 'break' ? 0 : Math.max(1, Math.min(3, Number(previousLesson.periodCount) || 1))),
        0,
      );
      const endPeriod = startPeriod + count - 1;
      return { startPeriod, endPeriod, count };
    }), [lessons]);
  const selectedGradeLevel = Number(form.gradeLevel) || 5;
  const subjectOptions = SUBJECT_OPTIONS_BY_GRADE[selectedGradeLevel] || GRADE_5_SUBJECT_OPTIONS;
  const openNew = () => { setForm(blank()); setEditing('new'); };
  const openNewLunchBreak = () => {
    const existing = WEEK_DAYS.flatMap(({ id }) => data[id]).find((lesson) => lesson.type === 'break');
    setForm(existing ? { ...existing } : blankLunchBreak());
    setEditing(existing?.id || 'new');
  };
  const openEdit = (lesson) => { setForm({ ...lesson }); setEditing(lesson.id); };
  const save = (e) => {
    e.preventDefault();
    if (!form.subject.trim()) return;
    const isBreak = form.type === 'break';
    const item = { ...form, gradeLevel: isBreak ? undefined : selectedGradeLevel, type: isBreak ? 'break' : undefined, periodCount: isBreak ? 0 : Math.max(1, Math.min(3, Number(form.periodCount) || 1)), subject: isBreak ? 'พักเที่ยง' : form.subject.trim(), book: isBreak ? '' : form.book.trim(), bookImage: isBreak ? '' : form.bookImage, supplies: isBreak ? '' : (form.supplies || '').trim(), suppliesImage: isBreak ? '' : form.suppliesImage };
    setSaveStatus('saving');
    setData((old) => {
      if (isBreak) return { ...old, ...Object.fromEntries(WEEK_DAYS.map(({ id }) => {
        const existingBreak = old[id].find((lesson) => lesson.type === 'break');
        const withoutBreaks = old[id].filter((lesson) => lesson.type !== 'break');
        return [id, [...withoutBreaks, { ...item, id: existingBreak?.id || `lunch-${id}-${Date.now()}` }]];
      })) };
      return { ...old, [day]: editing === 'new' ? [...old[day], { ...item, id: `${Date.now()}-${Math.random()}` }] : old[day].map((lesson) => lesson.id === editing ? { ...lesson, ...item } : lesson) };
    });
    setEditing(null);
  };
  const remove = () => {
    setSaveStatus('saving');
    setData((old) => form.type === 'break'
      ? { ...old, ...Object.fromEntries(WEEK_DAYS.map(({ id }) => [id, old[id].filter((lesson) => lesson.type !== 'break')])) }
      : { ...old, [day]: old[day].filter((lesson) => lesson.id !== editing) });
    setEditing(null);
  };
  const attachImage = async (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imageData = await resizeBookImage(file);
      setForm((current) => ({ ...current, [field]: imageData }));
    }
    catch { alert('ไม่สามารถอ่านรูปนี้ได้ กรุณาเลือกรูปอื่น'); }
    event.target.value = '';
  };
  return <div className="min-h-full bg-[#f5f7ff] text-slate-800 -m-4 p-4 select-none" style={{ paddingTop: 'max(1rem, calc(env(safe-area-inset-top) + 0.75rem))', paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1rem))', paddingLeft: 'max(1rem, calc(env(safe-area-inset-left) + 0.5rem))', paddingRight: 'max(1rem, calc(env(safe-area-inset-right) + 0.5rem))' }}>
    <header className="flex items-center gap-3 pt-1 mb-5"><button onClick={() => setPage('dashboard')} className="w-11 h-11 rounded-2xl bg-white shadow-sm border border-slate-200 text-2xl" aria-label="กลับ">‹</button><div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center shadow-lg shadow-indigo-200"><Icon/></div><h1 className="text-xl font-black">ตารางเรียน</h1></header>
    <nav className="grid grid-cols-5 gap-2 mb-5">{WEEK_DAYS.map((x) => <button key={x.id} onClick={() => setDay(x.id)} className={`relative rounded-xl py-2.5 text-xs font-black ${day === x.id ? 'bg-indigo-600 text-white shadow-lg -translate-y-0.5' : 'bg-white text-slate-500 border border-slate-200'}`}>{x.short}{x.id === todayDayId && <span className={`absolute bottom-1 left-1/2 w-1 h-1 rounded-full ${day === x.id ? 'bg-white' : 'bg-indigo-500'}`}/>}</button>)}</nav>
    <div className="flex items-end justify-between mb-3"><h2 className="text-2xl font-black">{WEEK_DAYS.find((x) => x.id === day).label}</h2><div className="flex flex-wrap justify-end gap-2"><button disabled={!dataReady} onClick={openNewLunchBreak} className="rounded-2xl bg-amber-500 disabled:bg-slate-300 text-white px-3 py-2.5 font-black shadow-lg shadow-amber-100">🍱 ตั้งค่าพักเที่ยง</button><button disabled={!dataReady} onClick={openNew} className="rounded-2xl bg-indigo-600 disabled:bg-slate-300 text-white px-4 py-2.5 font-black shadow-lg shadow-indigo-200">＋ เพิ่มวิชา</button></div></div>
    {!lessons.length ? <div className="mt-8 rounded-3xl border-2 border-dashed border-indigo-200 bg-white/70 p-8 text-center"><div className="mx-auto mb-3 w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-400 grid place-items-center"><Icon className="w-9 h-9"/></div><p className="font-black">ยังไม่มีวิชาในวันนี้</p><p className="text-sm text-slate-400">กด “เพิ่มวิชา” เพื่อเริ่มจัดตาราง</p></div> : <div className="space-y-3">{lessons.map((x, i) => { const period = lessonPeriods[i]; if (x.type === 'break') return <LunchBreakRow key={x.id} lesson={x} onOpen={() => openEdit(x)}/>; return <div key={x.id} onClick={() => openEdit(x)} className={`w-full text-left bg-white rounded-3xl p-4 shadow-sm transition active:scale-[0.99] ${lessonHighlight(x)}`} role="button" tabIndex="0"><div className="flex gap-3"><i className="w-1.5 rounded-full shrink-0" style={{background: COLORS[i % COLORS.length]}}/>{x.bookImage && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setPreviewImage({ src: x.bookImage, title: x.book || x.subject }); }} className="group relative h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm" aria-label={`ดูรูปหนังสือ ${x.subject}`}><img src={x.bookImage} alt={`ปกหนังสือ ${x.subject}`} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" draggable="false"/></button>}<div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><div className="min-w-0 flex items-center gap-2"><span className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-600">คาบ {period.startPeriod}{period.endPeriod > period.startPeriod ? `–${period.endPeriod}` : ''}</span><span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">ป.{x.gradeLevel || 5}</span><h3 className="font-black text-lg truncate">{x.subject}</h3>{period?.count > 1 && <span className="shrink-0 rounded-full bg-violet-100 text-violet-700 px-2 py-1 text-[10px] font-black">{period.count} คาบติด</span>}</div><span className="text-sm font-bold text-indigo-600 shrink-0">{x.start}–{x.end}</span></div><div className="mt-2 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-lg bg-amber-50 text-amber-700 px-2.5 py-1">📚 {x.book || 'ไม่ต้องใช้หนังสือ'}</span>{x.supplies && <span className="rounded-lg bg-violet-50 text-violet-700 px-2.5 py-1">🎒 {x.supplies}</span>}{x.book && <span className={`rounded-lg px-2.5 py-1 ${x.location === 'home' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>{x.location === 'home' ? '🏠 อยู่บ้าน' : '🏫 อยู่โรงเรียน'}</span>}</div></div></div></div>; })}</div>}
    <div className="h-24 shrink-0" aria-hidden="true"/>
    {editing && <div className="fixed inset-0 z-[100] bg-slate-950/55 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}><form onSubmit={save} className="w-full max-w-md sm:max-w-2xl lg:max-w-3xl max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] bg-white p-5 sm:p-7 pb-[max(1.25rem,env(safe-area-inset-bottom))]"><div className="flex justify-between mb-4"><h2 className="text-xl font-black">{form.type === 'break' ? (editing === 'new' ? 'เพิ่มเวลาพักเที่ยง' : 'แก้ไขเวลาพักเที่ยง') : (editing === 'new' ? 'เพิ่มวิชาใหม่' : 'แก้ไขวิชา')}</h2><button type="button" onClick={() => setEditing(null)} className="w-9 h-9 rounded-full bg-slate-100 text-xl">×</button></div>
      {form.type === 'break' && <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 ring-1 ring-amber-200">เวลานี้จะใช้กับวันจันทร์–ศุกร์ทั้งสัปดาห์ และจัดตำแหน่งตามเวลาให้อัตโนมัติ</div>}
      {form.type !== 'break' && <><div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3 sm:gap-5"><label className="min-w-0 text-sm font-black">ระดับชั้น<select autoFocus value={selectedGradeLevel} onChange={(e) => setForm({...form, gradeLevel:Number(e.target.value), subject:''})} className="mt-1.5 w-full rounded-xl border bg-slate-50 px-3.5 py-3 select-text"><option value={2}>ป.2</option><option value={5}>ป.5</option></select></label><label className="min-w-0 text-sm font-black">ชื่อวิชา<select required value={form.subject} onChange={(e) => setForm({...form, subject:e.target.value})} className="mt-1.5 w-full rounded-xl border bg-slate-50 px-3.5 py-3 select-text"><option value="" disabled>เลือกชื่อวิชา</option>{form.subject && !subjectOptions.includes(form.subject) && <option value={form.subject}>{form.subject}</option>}{subjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label></div><label className="block text-sm font-black mt-3">จำนวนคาบ<select value={form.periodCount || 1} onChange={(e) => setForm({...form, periodCount:Number(e.target.value)})} className="mt-1.5 w-full rounded-xl border bg-slate-50 px-3.5 py-3 select-text"><option value={1}>1 คาบ</option><option value={2}>2 คาบติด</option><option value={3}>3 คาบติด</option></select></label></>}<div className="grid grid-cols-2 gap-3 sm:gap-5 mt-3">{[['start','เวลาเริ่ม'],['end','เวลาเลิก']].map(([key,label]) => <label key={key} className="min-w-0 text-sm font-black">{label}<input type="time" value={form[key]} onChange={(e) => setForm({...form,[key]:e.target.value})} className="mt-1.5 block w-full min-w-0 max-w-full box-border rounded-xl border bg-slate-50 px-3 py-3" style={{ WebkitAppearance: 'none' }}/></label>)}</div>
      {form.type !== 'break' && <><label className="block text-sm font-black mt-3">หนังสือที่ต้องใช้<input value={form.book} onChange={(e) => setForm({...form,book:e.target.value})} placeholder="เช่น หนังสือภาษาจีน เล่ม 1" className="mt-1.5 w-full rounded-xl border bg-slate-50 px-3.5 py-3 select-text"/></label>
      <div className="mt-3"><p className="text-sm font-black mb-1.5">รูปหนังสือ</p>{form.bookImage && <div className="relative mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><img src={form.bookImage} alt="รูปหนังสือ" className="w-full h-36 object-contain"/><button type="button" onClick={() => setForm({...form,bookImage:''})} className="absolute top-2 right-2 rounded-full bg-red-500 text-white w-8 h-8 font-black shadow">×</button></div>}<label className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 py-3 text-indigo-700 font-black cursor-pointer active:scale-[0.99]">📷 {form.bookImage ? 'เปลี่ยนรูปหนังสือ' : 'แนบรูปหนังสือ'}<input type="file" accept="image/*" capture="environment" onChange={(event) => attachImage(event, 'bookImage')} className="sr-only"/></label></div>
      <label className="block text-sm font-black mt-3">สิ่งของที่ต้องใช้เพิ่มเติม<textarea value={form.supplies || ''} onChange={(e) => setForm({...form,supplies:e.target.value})} placeholder="เช่น สมุด, ดินสอสี, ไม้บรรทัด" rows="2" className="mt-1.5 w-full resize-none rounded-xl border bg-slate-50 px-3.5 py-3 select-text"/></label>
      <div className="mt-3"><p className="text-sm font-black mb-1.5">รูปสิ่งของเพิ่มเติม</p>{form.suppliesImage && <div className="relative mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><img src={form.suppliesImage} alt="รูปสิ่งของที่ต้องใช้" className="w-full h-36 object-contain"/><button type="button" onClick={() => setForm({...form,suppliesImage:''})} className="absolute top-2 right-2 rounded-full bg-red-500 text-white w-8 h-8 font-black shadow">×</button></div>}<label className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 py-3 text-violet-700 font-black cursor-pointer active:scale-[0.99]">📷 {form.suppliesImage ? 'เปลี่ยนรูปสิ่งของ' : 'แนบรูปสิ่งของ'}<input type="file" accept="image/*" capture="environment" onChange={(event) => attachImage(event, 'suppliesImage')} className="sr-only"/></label></div>
      <p className="text-sm font-black mt-3 mb-1.5">ตอนนี้หนังสืออยู่ที่ไหน?</p><div className="grid grid-cols-2 gap-2">{[['home','🏠 บ้าน'],['school','🏫 โรงเรียน']].map(([v,l]) => <button type="button" key={v} onClick={() => setForm({...form,location:v})} className={`rounded-xl py-3 font-black border-2 ${form.location === v ? 'border-indigo-500 bg-indigo-50 text-indigo-700':'border-slate-100 text-slate-500'}`}>{l}</button>)}</div></>}<div className="flex gap-2 mt-5">{editing !== 'new' && <button type="button" onClick={remove} className="px-4 rounded-xl bg-red-50 text-red-600 font-black">ลบ</button>}<button className="flex-1 rounded-xl py-3 bg-indigo-600 text-white font-black">บันทึกตาราง</button></div>
    </form></div>}
    {previewImage && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4" onClick={() => setPreviewImage(null)} role="dialog" aria-modal="true" aria-label="รูปหนังสือ">
      <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col items-center" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => setPreviewImage(null)} className="absolute -top-2 right-0 z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-2xl font-black text-slate-700 shadow-xl active:scale-95" aria-label="ปิดรูป">×</button>
        <img src={previewImage.src} alt={previewImage.title} className="max-h-[82dvh] max-w-full rounded-2xl bg-white object-contain shadow-2xl"/>
        <p className="mt-3 max-w-full truncate rounded-full bg-black/50 px-4 py-2 text-sm font-bold text-white">{previewImage.title}</p>
      </div>
    </div>}
  </div>;
}
