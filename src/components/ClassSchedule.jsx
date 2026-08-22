import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createEmptyClassSchedule, loadClassSchedule, saveClassSchedule, WEEK_DAYS } from '../utils/classScheduleStorage';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
const SUBJECT_OPTIONS = [
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
const blank = () => ({ subject: '', start: '08:00', end: '09:00', book: '', bookImage: '', supplies: '', suppliesImage: '', location: 'school' });
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

export default function ClassSchedule({ user, setPage }) {
  const dayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const [day, setDay] = useState(WEEK_DAYS[dayIndex].id);
  const [data, setData] = useState(createEmptyClassSchedule);
  const [dataReady, setDataReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState('loading');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [draggingId, setDraggingId] = useState(null);
  const dragMovedRef = useRef(false);
  useEffect(() => {
    let active = true;
    loadClassSchedule(user?.id).then((schedule) => {
      if (!active) return;
      setData(schedule);
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
  const lessons = useMemo(() => [...data[day]].sort((a, b) => {
    const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
    return orderA - orderB || a.start.localeCompare(b.start);
  }), [data, day]);
  const openNew = () => { setForm(blank()); setEditing('new'); };
  const openEdit = (lesson) => { setForm({ ...lesson }); setEditing(lesson.id); };
  const save = (e) => { e.preventDefault(); if (!form.subject.trim()) return; const item = { ...form, subject: form.subject.trim(), book: form.book.trim(), supplies: (form.supplies || '').trim() }; setSaveStatus('saving'); setData((old) => ({ ...old, [day]: editing === 'new' ? [...old[day], { ...item, id: `${Date.now()}-${Math.random()}` }] : old[day].map((x) => x.id === editing ? { ...x, ...item } : x) })); setEditing(null); };
  const remove = () => { setSaveStatus('saving'); setData((old) => ({ ...old, [day]: old[day].filter((x) => x.id !== editing) })); setEditing(null); };
  const reorderLesson = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setData((old) => {
      const ordered = [...old[day]].sort((a, b) => {
        const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
        const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
        return orderA - orderB || a.start.localeCompare(b.start);
      });
      const from = ordered.findIndex((lesson) => lesson.id === sourceId);
      const to = ordered.findIndex((lesson) => lesson.id === targetId);
      if (from < 0 || to < 0) return old;
      const [moved] = ordered.splice(from, 1);
      ordered.splice(to, 0, moved);
      return { ...old, [day]: ordered.map((lesson, order) => ({ ...lesson, order })) };
    });
    dragMovedRef.current = true;
  };
  const finishDrag = () => {
    if (dragMovedRef.current) setSaveStatus('saving');
    setDraggingId(null);
  };
  const handleCardClick = (lesson) => {
    if (dragMovedRef.current) { dragMovedRef.current = false; return; }
    openEdit(lesson);
  };
  const handlePointerMove = (event) => {
    if (!draggingId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-lesson-id]');
    if (target?.dataset.lessonId) reorderLesson(draggingId, target.dataset.lessonId);
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
  return <div className="min-h-full bg-[#f5f7ff] text-slate-800 -m-4 p-4 pb-12 select-none" style={{ paddingTop: 'max(1rem, calc(env(safe-area-inset-top) + 0.75rem))', paddingLeft: 'max(1rem, calc(env(safe-area-inset-left) + 0.5rem))', paddingRight: 'max(1rem, calc(env(safe-area-inset-right) + 0.5rem))' }}>
    <header className="flex items-center gap-3 pt-1 mb-5"><button onClick={() => setPage('dashboard')} className="w-11 h-11 rounded-2xl bg-white shadow-sm border border-slate-200 text-2xl" aria-label="กลับ">‹</button><div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center shadow-lg shadow-indigo-200"><Icon/></div><div><h1 className="text-xl font-black">ตารางเรียน</h1><p className="text-xs text-slate-500 font-semibold">จัดวิชาและเตรียมหนังสือให้พร้อม</p></div></header>
    <nav className="grid grid-cols-7 gap-1.5 mb-5">{WEEK_DAYS.map((x, i) => <button key={x.id} onClick={() => setDay(x.id)} className={`relative rounded-xl py-2.5 text-xs font-black ${day === x.id ? 'bg-indigo-600 text-white shadow-lg -translate-y-0.5' : 'bg-white text-slate-500 border border-slate-200'}`}>{x.short}{i === dayIndex && <span className={`absolute bottom-1 left-1/2 w-1 h-1 rounded-full ${day === x.id ? 'bg-white' : 'bg-indigo-500'}`}/>}</button>)}</nav>
    <div className="flex items-end justify-between mb-3"><div><p className="text-xs font-bold text-indigo-500">{day === WEEK_DAYS[dayIndex].id ? 'วันนี้' : 'ตารางเรียน'} · {saveStatus === 'loading' ? 'กำลังโหลด...' : saveStatus === 'saving' ? 'กำลังบันทึก...' : saveStatus === 'error' ? 'บันทึกไม่สำเร็จ' : 'บันทึกบน Supabase แล้ว'}</p><h2 className="text-2xl font-black">{WEEK_DAYS.find((x) => x.id === day).label}</h2></div><button disabled={!dataReady} onClick={openNew} className="rounded-2xl bg-indigo-600 disabled:bg-slate-300 text-white px-4 py-2.5 font-black shadow-lg shadow-indigo-200">＋ เพิ่มวิชา</button></div>
    {!lessons.length ? <div className="mt-8 rounded-3xl border-2 border-dashed border-indigo-200 bg-white/70 p-8 text-center"><div className="mx-auto mb-3 w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-400 grid place-items-center"><Icon className="w-9 h-9"/></div><p className="font-black">ยังไม่มีวิชาในวันนี้</p><p className="text-sm text-slate-400">กด “เพิ่มวิชา” เพื่อเริ่มจัดตาราง</p></div> : <div className="space-y-3">{lessons.map((x, i) => <div key={x.id} data-lesson-id={x.id} onClick={() => handleCardClick(x)} draggable onDragStart={(event) => { setDraggingId(x.id); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); reorderLesson(draggingId, x.id); finishDrag(); }} onDragEnd={finishDrag} className={`w-full text-left bg-white rounded-3xl p-4 shadow-sm transition ${draggingId === x.id ? 'border-2 border-indigo-400 opacity-70 scale-[0.98]' : lessonHighlight(x)}`} role="button" tabIndex="0"><div className="flex gap-3"><i className="w-1.5 rounded-full shrink-0" style={{background: COLORS[i % COLORS.length]}}/><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><div className="min-w-0 flex items-center gap-2"><span className="shrink-0 rounded-lg bg-indigo-50 text-indigo-600 px-2 py-1 text-xs font-black">คาบ {i + 1}</span><h3 className="font-black text-lg truncate">{x.subject}</h3></div><span className="text-sm font-bold text-indigo-600 shrink-0">{x.start}–{x.end}</span></div><div className="mt-2 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-lg bg-amber-50 text-amber-700 px-2.5 py-1">📚 {x.book || 'ไม่ต้องใช้หนังสือ'}</span>{x.supplies && <span className="rounded-lg bg-violet-50 text-violet-700 px-2.5 py-1">🎒 {x.supplies}</span>}{x.book && <span className={`rounded-lg px-2.5 py-1 ${x.location === 'home' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>{x.location === 'home' ? '🏠 อยู่บ้าน' : '🏫 อยู่โรงเรียน'}</span>}</div></div><span onPointerDown={(event) => { event.stopPropagation(); dragMovedRef.current = false; setDraggingId(x.id); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={handlePointerMove} onPointerUp={(event) => { event.stopPropagation(); finishDrag(); }} className="self-center shrink-0 px-2 py-4 text-2xl leading-none text-slate-300 cursor-grab active:cursor-grabbing touch-none" aria-label={`ลากเปลี่ยนลำดับ ${x.subject}`}>⠿</span></div></div>)}</div>}
    {editing && <div className="fixed inset-0 z-[100] bg-slate-950/55 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}><form onSubmit={save} className="w-full max-w-md sm:max-w-2xl lg:max-w-3xl max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] bg-white p-5 sm:p-7 pb-[max(1.25rem,env(safe-area-inset-bottom))]"><div className="flex justify-between mb-4"><h2 className="text-xl font-black">{editing === 'new' ? 'เพิ่มวิชาใหม่' : 'แก้ไขวิชา'}</h2><button type="button" onClick={() => setEditing(null)} className="w-9 h-9 rounded-full bg-slate-100 text-xl">×</button></div>
      <label className="text-sm font-black">ชื่อวิชา<select autoFocus required value={form.subject} onChange={(e) => setForm({...form, subject:e.target.value})} className="mt-1.5 w-full rounded-xl border bg-slate-50 px-3.5 py-3 select-text"><option value="" disabled>เลือกชื่อวิชา</option>{form.subject && !SUBJECT_OPTIONS.includes(form.subject) && <option value={form.subject}>{form.subject}</option>}{SUBJECT_OPTIONS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label><div className="grid grid-cols-2 gap-3 sm:gap-5 mt-3">{[['start','เวลาเริ่ม'],['end','เวลาเลิก']].map(([key,label]) => <label key={key} className="min-w-0 text-sm font-black">{label}<input type="time" value={form[key]} onChange={(e) => setForm({...form,[key]:e.target.value})} className="mt-1.5 block w-full min-w-0 max-w-full box-border rounded-xl border bg-slate-50 px-3 py-3" style={{ WebkitAppearance: 'none' }}/></label>)}</div>
      <label className="block text-sm font-black mt-3">หนังสือที่ต้องใช้<input value={form.book} onChange={(e) => setForm({...form,book:e.target.value})} placeholder="เช่น หนังสือภาษาจีน เล่ม 1" className="mt-1.5 w-full rounded-xl border bg-slate-50 px-3.5 py-3 select-text"/></label>
      <div className="mt-3"><p className="text-sm font-black mb-1.5">รูปหนังสือ</p>{form.bookImage && <div className="relative mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><img src={form.bookImage} alt="รูปหนังสือ" className="w-full h-36 object-contain"/><button type="button" onClick={() => setForm({...form,bookImage:''})} className="absolute top-2 right-2 rounded-full bg-red-500 text-white w-8 h-8 font-black shadow">×</button></div>}<label className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 py-3 text-indigo-700 font-black cursor-pointer active:scale-[0.99]">📷 {form.bookImage ? 'เปลี่ยนรูปหนังสือ' : 'แนบรูปหนังสือ'}<input type="file" accept="image/*" capture="environment" onChange={(event) => attachImage(event, 'bookImage')} className="sr-only"/></label></div>
      <label className="block text-sm font-black mt-3">สิ่งของที่ต้องใช้เพิ่มเติม<textarea value={form.supplies || ''} onChange={(e) => setForm({...form,supplies:e.target.value})} placeholder="เช่น สมุด, ดินสอสี, ไม้บรรทัด" rows="2" className="mt-1.5 w-full resize-none rounded-xl border bg-slate-50 px-3.5 py-3 select-text"/></label>
      <div className="mt-3"><p className="text-sm font-black mb-1.5">รูปสิ่งของเพิ่มเติม</p>{form.suppliesImage && <div className="relative mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><img src={form.suppliesImage} alt="รูปสิ่งของที่ต้องใช้" className="w-full h-36 object-contain"/><button type="button" onClick={() => setForm({...form,suppliesImage:''})} className="absolute top-2 right-2 rounded-full bg-red-500 text-white w-8 h-8 font-black shadow">×</button></div>}<label className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 py-3 text-violet-700 font-black cursor-pointer active:scale-[0.99]">📷 {form.suppliesImage ? 'เปลี่ยนรูปสิ่งของ' : 'แนบรูปสิ่งของ'}<input type="file" accept="image/*" capture="environment" onChange={(event) => attachImage(event, 'suppliesImage')} className="sr-only"/></label></div>
      <p className="text-sm font-black mt-3 mb-1.5">ตอนนี้หนังสืออยู่ที่ไหน?</p><div className="grid grid-cols-2 gap-2">{[['home','🏠 บ้าน'],['school','🏫 โรงเรียน']].map(([v,l]) => <button type="button" key={v} onClick={() => setForm({...form,location:v})} className={`rounded-xl py-3 font-black border-2 ${form.location === v ? 'border-indigo-500 bg-indigo-50 text-indigo-700':'border-slate-100 text-slate-500'}`}>{l}</button>)}</div><div className="flex gap-2 mt-5">{editing !== 'new' && <button type="button" onClick={remove} className="px-4 rounded-xl bg-red-50 text-red-600 font-black">ลบ</button>}<button className="flex-1 rounded-xl py-3 bg-indigo-600 text-white font-black">บันทึกตาราง</button></div>
    </form></div>}
  </div>;
}
