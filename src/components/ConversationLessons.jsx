import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { cancelChineseSpeech, speakChinese } from '../utils/chineseSpeech';
import { questionQueue, shuffleIndices } from '../../supabase/functions/_shared/conversation';
import { formatConversationCost } from '../../supabase/functions/_shared/conversation-cost';

const LEVELS = { beginner: 'เริ่มต้น', basic: 'พื้นฐาน', intermediate: 'ปานกลาง' };
const TOPICS = ['สั่งเครื่องดื่ม', 'ซื้อของในร้านสะดวกซื้อ', 'แนะนำตัว', 'สั่งอาหาร', 'เดินทางด้วยแท็กซี่', 'เข้าพักโรงแรม'];
const button = 'min-h-12 rounded-2xl px-5 py-3 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed';
const primary = `${button} bg-teal-700 text-white hover:bg-teal-800`;
const secondary = `${button} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const panel = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm';

function CourseCost({ course }) {
  const recorded = course.cost_record_count > 0;
  return <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
    <p className="font-bold">ค่าใช้จ่ายสะสมในการสร้าง (ประมาณ)</p>
    <p className="mt-1 font-bold text-teal-800">{recorded ? `${formatConversationCost(course.generation_cost_thb)} · ${formatConversationCost(course.generation_cost_usd, 'USD')}` : course.status === 'generating' ? 'รอข้อมูลค่าใช้จ่ายจาก API…' : 'ยังไม่มีข้อมูลค่าใช้จ่าย'}</p>
    {recorded && <p className="mt-1 text-xs">ตรวจหัวข้อ: {formatConversationCost(course.lookup_cost_thb)} · สร้างเนื้อหา: {formatConversationCost(course.content_cost_thb)}</p>}
    <p className="mt-1 text-xs">คำนวณจาก token และอัตราที่ตั้งไว้ รวมการลองสร้างใหม่ · เข้าเรียนซ้ำไม่สร้างเนื้อหาใหม่</p>
  </div>;
}

async function readUserProgress(userId) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('conversation_progress').select('*').eq('user_id', userId)
      .order('course_id').order('unit_index').range(offset, offset + 499);
    if (error) return { error };
    rows.push(...data);
    if (data.length < 500) return { data: rows };
  }
}

function AudioButton({ text }) {
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function play() {
    if (!window.speechSynthesis) return setError('เบราว์เซอร์นี้ไม่รองรับเสียงอ่าน');
    setError('');
    try {
      await speakChinese(text, { shouldSpeak: () => alive.current, onError: () => { if (alive.current) setError('เปิดเสียงไม่ได้ กรุณาลองอีกครั้ง'); } });
    } catch { setError('เปิดเสียงไม่ได้ กรุณาลองอีกครั้ง'); }
  }
  return <span className="inline-flex flex-wrap items-center gap-2"><button type="button" onClick={play} className={secondary} aria-label="ฟังเสียงภาษาจีน">🔊 ฟังเสียง</button>{error && <span role="status" className="text-sm text-red-700">{error}</span>}</span>;
}

function LessonPlayer({ course, unitIndex, initialProgress, mode, onSaved, onExit }) {
  const unit = course.content.units[unitIndex];
  const [stage, setStage] = useState(mode === 'review' ? 'practice' : 'teach');
  const [queue] = useState(() => {
    const pending = questionQueue(unit, initialProgress?.answers, mode === 'review');
    return pending.length || mode === 'review' ? pending : unit.questions.map((_, i) => i);
  });
  const [position, setPosition] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(initialProgress);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pinyin, setPinyin] = useState(true);
  const savingRef = useRef(false);
  const index = queue[position];
  const q = unit.questions[index];
  const [tokenOrder, setTokenOrder] = useState(() => q?.kind === 'order' ? shuffleIndices(q.tokens.length) : []);
  useEffect(() => () => cancelChineseSpeech(), []);

  async function check() {
    if (savingRef.current || answer === null) return;
    savingRef.current = true;
    setSaving(true); setError('');
    const { data, error: saveError } = await supabase.rpc('answer_conversation_question', {
      p_course: course.id, p_unit: unitIndex, p_question: index, p_answer: answer,
    });
    savingRef.current = false; setSaving(false);
    if (saveError) { setError('บันทึกคำตอบไม่สำเร็จ กรุณาลองอีกครั้งก่อนเรียนต่อ'); return; }
    setProgress(data); onSaved(data); setResult(data.answers[index]);
  }
  function next() {
    cancelChineseSpeech();
    setAnswer(null); setResult(null); setError('');
    const nextPosition = position + 1;
    setPosition(nextPosition);
    const nextQuestion = unit.questions[queue[nextPosition]];
    setTokenOrder(nextQuestion?.kind === 'order' ? shuffleIndices(nextQuestion.tokens.length) : []);
  }
  const wrong = Object.values(progress?.answers || {}).filter(a => !a.correct).length;
  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3"><button className={secondary} onClick={onExit} disabled={saving}>← กลับชุดบทเรียน</button><span className="text-sm text-slate-500">บันทึกแยกตามบัญชี</span></div>
    <div><p className="text-sm font-bold text-teal-700">{course.topic} · บทที่ {unitIndex + 1}</p><h2 className="mt-1 text-2xl font-black">{unit.title}</h2></div>
    {stage === 'teach' ? <>
      <section className={panel}><h3 className="text-lg font-bold">เรียนรู้ก่อนฝึก</h3><p className="mt-3 whitespace-pre-line leading-relaxed">{unit.teaching_th}</p></section>
      <div className="flex items-center justify-between"><h3 className="font-bold">คำศัพท์และรูปประโยค</h3><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pinyin} onChange={e => setPinyin(e.target.checked)} />แสดงพินอิน</label></div>
      {[...unit.vocabulary, ...unit.patterns].map((item, i) => <div className={`${panel} space-y-2`} key={i}><p lang="zh-CN" className="text-2xl font-bold">{item.cn}</p>{pinyin && <p className="text-teal-700">{item.pinyin}</p>}<p>{item.th}</p><AudioButton text={item.cn} /></div>)}
      <button className={`${primary} w-full`} onClick={() => setStage('practice')}>เริ่มฝึก · {queue.length} ข้อ →</button>
    </> : !q ? <section className={`${panel} space-y-4 text-center`}><p className="text-4xl">🎉</p><h3 className="text-2xl font-black">{mode === 'review' ? 'ทบทวนครบแล้ว!' : 'ฝึกครบแล้ว!'}</h3><p>บันทึกผลเรียบร้อยแล้ว</p><p>{wrong ? `ยังมี ${wrong} ข้อที่ควรทบทวนในบทนี้` : 'คำตอบที่ฝึกแล้วถูกทั้งหมด'}</p><button className={primary} onClick={onExit}>กลับไปเลือกบทเรียน</button></section> : <>
      <div><div className="mb-2 flex justify-between text-sm text-slate-500"><span>{mode === 'review' ? 'ทบทวนข้อผิด' : 'ฝึกบทสนทนา'}</span><span>ข้อ {position + 1} / {queue.length}</span></div><progress className="h-3 w-full accent-teal-600" value={position} max={queue.length} aria-label="ความคืบหน้าแบบฝึก" /></div>
      <section className={`${panel} space-y-5`}>
        <h3 className="text-xl font-bold">{q.prompt_th}</h3>
        {q.kind === 'listen' ? <><AudioButton text={q.cn} /><p className="text-sm text-slate-500">กดฟังซ้ำได้ ไม่สะดวกฟังสามารถกลับไปเลือกบทอื่นได้</p></> : q.kind === 'reply' ? <div className="space-y-2 rounded-2xl bg-teal-50 p-4"><p className="text-sm font-bold text-teal-700">คู่สนทนาพูดว่า</p><p lang="zh-CN" className="text-2xl">{q.cn}</p><AudioButton text={q.cn} /></div> : null}
        {q.kind === 'order' ? <>
          <p className="text-sm text-slate-500">แตะคำเพื่อเรียงประโยค · แตะคำที่เลือกเพื่อนำออก</p>
          <div className="flex min-h-20 flex-wrap gap-2 rounded-2xl border-2 border-dashed border-teal-300 p-3" aria-label="ประโยคที่เรียงแล้ว">{(answer || []).map((id, i) => <button lang="zh-CN" key={id} disabled={!!result || saving} className={secondary} onClick={() => setAnswer(answer.filter((_, at) => at !== i))}>{q.tokens[id]}</button>)}</div>
          <div className="flex flex-wrap gap-2">{tokenOrder.map(id => <button lang="zh-CN" key={id} disabled={!!result || saving || (answer || []).includes(id)} className={secondary} onClick={() => setAnswer([...(answer || []), id])}>{q.tokens[id]}</button>)}</div>
        </> : <div className="grid gap-3">{q.options.map((option, i) => <button key={i} disabled={!!result || saving} aria-pressed={answer === i} className={`${button} border-2 text-left ${answer === i ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white'}`} onClick={() => setAnswer(i)}>{option}</button>)}</div>}
      </section>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {result ? <section role="status" className={`rounded-3xl p-5 ${result.correct ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'}`}><h3 className="text-xl font-bold">{result.correct ? '✓ ถูกต้อง!' : 'ลองจำรูปประโยคนี้อีกครั้ง'}</h3><p className="mt-3 font-bold">คำตอบ: {q.kind === 'order' ? q.answer_order.map(i => q.tokens[i]).join('') : q.options[q.correct_index]}</p><p className="mt-2 text-xl" lang="zh-CN">{q.cn}</p><p>{q.pinyin}</p><p>{q.th}</p><p className="my-3">{q.explanation_th}</p><AudioButton text={q.cn} /><button className={`${primary} mt-4 w-full`} onClick={next}>{position + 1 === queue.length ? 'ดูผลการฝึก' : 'ข้อต่อไป →'}</button></section> : <button className={`${primary} w-full`} disabled={saving || answer === null || (q.kind === 'order' && answer.length !== q.tokens.length)} onClick={check}>{saving ? 'กำลังบันทึก…' : 'ตรวจคำตอบ'}</button>}
    </>}
  </div>;
}

export default function ConversationLessons({ user, setPage }) {
  const [courses, setCourses] = useState([]);
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('beginner');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState(false);
  const [progressRows, setProgressRows] = useState([]);
  const [course, setCourse] = useState(null);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [limit, setLimit] = useState(60);
  const [more, setMore] = useState(false);
  const requestRef = useRef(false);
  const loadSequence = useRef(0);
  const mounted = useRef(true);
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const columns = 'id,topic,level,goal,status,error_message,created_at,updated_at,generation_cost_usd,generation_cost_thb,lookup_cost_thb,content_cost_thb,cost_record_count';
    let request = supabase.from('conversation_courses').select(mine ? `${columns},conversation_progress!inner(unit_index)` : columns).order('updated_at', { ascending: false }).order('id').limit(limit + 1);
    if (filter !== 'all') request = request.eq('level', filter);
    const search = query.trim().replace(/[%_\\]/g, '');
    if (search) request = request.ilike('topic', `%${search}%`);
    const [library, records] = await Promise.all([request, readUserProgress(user.id)]);
    if (!mounted.current || sequence !== loadSequence.current) return;
    setLoading(false);
    if (library.error || records.error) { setError('โหลดบทเรียนไม่ได้ กรุณาลองใหม่ หากเพิ่งติดตั้ง ให้รัน migration ฝึกสนทนาก่อน'); return; }
    setCourses(library.data.slice(0, limit)); setMore(library.data.length > limit); setProgressRows(records.data);
  }, [filter, query, limit, mine, user.id]);
  useEffect(() => {
    mounted.current = true;
    const initial = setTimeout(() => { load(); }, 250);
    return () => { mounted.current = false; clearTimeout(initial); cancelChineseSpeech(); };
  }, [load]);
  useEffect(() => {
    if (!courses.some(c => c.status === 'generating')) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [courses, load]);

  async function open(id) {
    if (requestRef.current) return;
    requestRef.current = true; setBusy(true); setError('');
    const { data, error: readError } = await supabase.from('conversation_courses').select('*').eq('id', id).single();
    requestRef.current = false; setBusy(false);
    if (readError || data?.status !== 'ready' || !data.content?.units?.length) { setError('บทเรียนยังไม่พร้อม กรุณาโหลดใหม่'); return; }
    setCourse(data); setSession(null); window.scrollTo(0, 0);
  }
  async function generate(requestedTopic = topic, requestedLevel = level) {
    if (requestRef.current || requestedTopic.trim().length < 2) return;
    requestRef.current = true; setBusy(true); setError(''); setNotice('กำลังตรวจสอบหัวข้อที่มีอยู่ในคลัง…');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-conversation', { body: { topic: requestedTopic, level: requestedLevel } });
      if (invokeError) {
        let message = 'ค้นหาหรือสร้างไม่สำเร็จ กรุณาลองใหม่ และตรวจสอบการ deploy ฟังก์ชัน';
        try { const body = await invokeError.context?.json(); if (body?.error) message = body.error; } catch { /* Use the connection error fallback. */ }
        throw new Error(message);
      }
      if (data.error) throw new Error(data.error);
      const found = data.course;
      loadSequence.current++;
      setQuery(''); setFilter('all'); setMine(false);
      setCourses(current => [found, ...current.filter(c => c.id !== found.id)]);
      setNotice(data.reused ? 'พบหัวข้อเดียวกันในคลัง ใช้บทเรียนร่วมกันได้เลย' : 'รับคำขอแล้ว กำลังสร้างบทเรียนกลางให้ทุกคน · กลับมาเรียนได้เมื่อสร้างเสร็จ');
      if (found.status === 'ready') { setCourse(found); setSession(null); window.scrollTo(0, 0); }
    } catch (error) { setError(error.message); setNotice(''); }
    finally { requestRef.current = false; setBusy(false); }
  }
  function saved(row) {
    loadSequence.current++;
    setProgressRows(current => [...current.filter(p => !(p.course_id === row.course_id && p.unit_index === row.unit_index)), row]);
  }
  const ownRows = progressRows.filter(p => p.course_id === course?.id);
  const visible = courses.filter(c => !mine || progressRows.some(p => p.course_id === c.id));
  return <main className="conversation-lessons mx-auto w-full max-w-3xl space-y-6 px-4 py-6 pb-16 text-slate-800">
    {!session && <header className="rounded-3xl bg-gradient-to-br from-teal-800 to-slate-900 p-6 text-white"><button className="mb-5 min-h-11 text-sm font-bold text-teal-100" onClick={() => course ? (setCourse(null), setNotice('')) : setPage('dashboard')}>← {course ? 'คลังบทเรียน' : 'หน้าหลัก'}</button><p className="text-sm font-bold tracking-wide text-teal-200">เรียนภาษาจีนจากสถานการณ์จริง</p><h1 className="mt-2 text-3xl font-black">{course ? course.content.title : 'ฝึกสนทนา'}</h1><p className="mt-3 text-sm leading-relaxed text-teal-50">{course ? course.content.goal : 'เลือกเรื่องที่อยากพูด ฝึกคำศัพท์ เรียงประโยค และฟังเสียง · ไม่มีรูปภาพ'}</p></header>}
    {error && <div role="alert" className="rounded-2xl bg-red-50 p-4 text-red-700">{error}<button className="ml-3 underline" onClick={() => { setError(''); load(); }}>โหลดใหม่</button></div>}
    {notice && !session && <p role="status" className="rounded-2xl bg-teal-50 p-4 text-teal-900">{notice}</p>}
    {session ? <LessonPlayer key={`${course.id}-${session.unit}-${session.mode}`} course={course} unitIndex={session.unit} initialProgress={ownRows.find(p => p.unit_index === session.unit)} mode={session.mode} onSaved={saved} onExit={() => setSession(null)} /> : course ? <>
      <p className="text-sm text-slate-500">ระดับ{LEVELS[course.level]} · เนื้อหากลางใช้ร่วมกัน ผลการเรียนเป็นของคุณ</p>
      <CourseCost course={course} />
      {course.content.units.map((unit, i) => {
        const progress = ownRows.find(p => p.unit_index === i);
        const count = Object.keys(progress?.answers || {}).length;
        const wrong = Object.values(progress?.answers || {}).filter(a => !a.correct).length;
        return <section key={i} className={`${panel} space-y-3`}><p className="text-sm font-bold text-teal-700">บทที่ {i + 1} · ประมาณ 3–5 นาที</p><h2 className="text-xl font-black">{unit.title}</h2><p className="text-sm text-slate-500">{progress?.completed ? '✓ เรียนจบแล้ว' : count ? `เรียนแล้ว ${count}/${unit.questions.length} ข้อ` : `${unit.vocabulary.length} คำศัพท์ · ${unit.questions.length} แบบฝึก`}{wrong > 0 && ` · ควรทบทวน ${wrong} ข้อ`}</p><div className="flex flex-wrap gap-2"><button className={primary} onClick={() => { setSession({ unit: i, mode: 'learn' }); window.scrollTo(0, 0); }}>{progress?.completed ? 'ฝึกอีกครั้ง' : count ? 'เรียนต่อ' : 'เริ่มเรียน'}</button>{wrong > 0 && <button className={secondary} onClick={() => setSession({ unit: i, mode: 'review' })}>ทบทวนข้อผิด</button>}</div></section>;
      })}
    </> : <>
      <section className={`${panel} space-y-4`}><h2 className="text-xl font-black">วันนี้อยากพูดเรื่องอะไร?</h2><div className="flex flex-wrap gap-2">{TOPICS.map(item => <button key={item} className="min-h-11 rounded-full bg-teal-50 px-4 py-2 text-sm font-bold text-teal-900" onClick={() => setTopic(item)}>{item}</button>)}</div><form className="space-y-3" onSubmit={e => { e.preventDefault(); generate(); }}><label className="block text-sm font-bold" htmlFor="conversation-topic">หัวข้อหรือสถานการณ์ที่อยากฝึก</label><input id="conversation-topic" value={topic} onChange={e => setTopic(e.target.value)} minLength={2} maxLength={200} required className="min-h-12 w-full rounded-xl border border-slate-300 px-4" placeholder="เช่น สั่งชานม หวานน้อย ไม่ใส่ไข่มุก" /><label className="block text-sm font-bold" htmlFor="conversation-level">ระดับภาษาจีน</label><select id="conversation-level" value={level} onChange={e => setLevel(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4">{Object.entries(LEVELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><p className="text-xs leading-relaxed text-slate-500">ระบบจะค้นหาหัวข้อที่มีความหมายเดียวกันก่อนสร้าง บทเรียนที่สร้างจะอยู่ในคลังให้ทุกคนเรียนได้ กรุณาไม่ใส่ข้อมูลส่วนตัว</p><button className={`${primary} w-full`} disabled={busy || topic.trim().length < 2}>{busy ? 'กำลังตรวจสอบ…' : 'ค้นหาหรือสร้างบทเรียน'}</button></form></section>
      <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">คลังบทเรียนกลาง</h2><button className={secondary} onClick={() => { setError(''); load(); }}>↻ โหลดใหม่</button></div><div className="grid gap-3 sm:grid-cols-2"><input aria-label="ค้นหาในคลังบทเรียน" value={query} onChange={e => { setQuery(e.target.value); setLimit(60); }} className="min-h-12 rounded-xl border border-slate-300 px-4" placeholder="ค้นหาชื่อบทเรียน" /><select aria-label="กรองระดับบทเรียน" value={filter} onChange={e => { setFilter(e.target.value); setLimit(60); }} className="min-h-12 rounded-xl border border-slate-300 px-4"><option value="all">ทุกระดับ</option>{Object.entries(LEVELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />เฉพาะบทเรียนที่ฉันเริ่มเรียนแล้ว</label>
      {loading && <p role="status">กำลังโหลดคลังบทเรียน…</p>}
      {!loading && !visible.length && <div className={`${panel} text-center text-slate-500`}>ยังไม่พบบทเรียน ลองค้นหาหัวข้ออื่นหรือสร้างชุดแรกได้เลย</div>}
      {visible.map(item => {
        const records = progressRows.filter(p => p.course_id === item.id);
        const finished = records.filter(p => p.completed).length;
        const stalled = item.status === 'generating' && Date.now() - Date.parse(item.updated_at) > 10 * 60 * 1000;
        return <article key={item.id} className={`${panel} space-y-3`}><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">{LEVELS[item.level]}</span><span className="text-xs text-slate-500">{item.status === 'ready' ? records.length ? `จบแล้ว ${finished}/3 บท` : '3 บทเรียน' : item.status === 'failed' || stalled ? 'สร้างไม่สำเร็จ / ลองใหม่ได้' : 'กำลังสร้าง…'}</span></div><h3 className="text-xl font-black">{item.topic}</h3><p className="text-sm leading-relaxed text-slate-500">{item.goal}</p><CourseCost course={item} />{item.status === 'ready' ? <button className={primary} disabled={busy} onClick={() => open(item.id)}>{records.length ? 'เรียนต่อ / ทบทวน' : 'ดูบทเรียน →'}</button> : item.status === 'failed' || stalled ? <button className={secondary} disabled={busy} onClick={() => generate(item.topic, item.level)}>ลองสร้างใหม่</button> : <p role="status" className="text-sm text-teal-700">ระบบจะอัปเดตอัตโนมัติ คุณกลับมาดูภายหลังได้</p>}</article>;
      })}{more && <button className={`${secondary} w-full`} onClick={() => setLimit(current => current + 60)}>โหลดบทเรียนเพิ่ม</button>}</section>
    </>}
  </main>;
}
