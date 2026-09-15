import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatStatDate, THAI_MONTHS } from '../utils/levelScheduleMeta';

const PAGE_SIZE = 1000;

function dateKeysBetween(startDate, endDate) {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  const keys = [];
  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function displayName(profile) {
  const username = String(profile?.username || '').trim();
  const named = String(profile?.display_name || '').trim();
  const email = String(profile?.email || '').trim();
  return username || (named && !named.includes('@') ? named : '') || email.split('@')[0] || 'นักเรียน';
}

function missionTasks(mission) {
  if (!mission) return [];
  const config = mission.config_snapshot || {};
  const newIds = mission.new_word_ids || [];
  const reviewIds = mission.review_word_ids || [];
  const matchingIds = mission.matching_card_ids || [];
  const reviewTotal = config.review_mode === 'count'
    ? Math.min(reviewIds.length, Math.max(1, Number(config.review_words_target) || 20))
    : reviewIds.length;
  const tasks = [
    {
      key: 'new', icon: '📚', label: 'คำใหม่ไปถึง LV.3',
      done: (mission.new_words_completed_ids || []).length,
      total: newIds.length || Math.max(1, Number(config.new_words_target) || 5),
      waiting: newIds.length === 0,
    },
  ];
  if (config.review_enabled !== false) {
    tasks.push({
      key: 'review', icon: '🔁',
      label: mission.review_level ? `ผ่านคำ LV.${mission.review_level} ไป Level ถัดไป` : 'ทบทวนคำ LV.3–6',
      done: (mission.review_completed_ids || []).length,
      total: reviewTotal || Math.max(1, Number(config.review_words_target) || 20),
      waiting: reviewIds.length === 0,
    });
  }
  tasks.push({
    key: 'matching', icon: '🧩', label: 'เกมจับคู่ประจำวัน',
    done: (mission.matching_completed_ids || []).length,
    total: matchingIds.length || Math.max(1, Number(config.match_words_target) || 10),
    waiting: matchingIds.length === 0,
  });
  if (mission.mistakes_required) {
    tasks.push({
      key: 'mistakes', icon: '🧹', label: 'เคลียร์คำผิดบ่อย',
      done: mission.mistakes_completed || Number(mission.mistakes_remaining || 0) === 0 ? 1 : 0,
      total: 1,
    });
  }
  tasks.push({
    key: 'book', icon: '📖', label: 'อ่านหนังสือให้จบ 1 เล่ม',
    done: Math.min(1, (mission.books_read_ids || []).length), total: 1,
  });
  return tasks.map((task) => ({
    ...task,
    complete: !task.waiting && task.total > 0 && task.done >= task.total,
    percent: task.waiting || task.total <= 0 ? 0 : Math.min(100, Math.round((task.done / task.total) * 100)),
  }));
}

function missionStatus(mission) {
  if (!mission) return { kind: 'none', percent: 0, done: 0, total: 0, tasks: [] };
  const tasks = missionTasks(mission);
  const done = tasks.filter((task) => task.complete).length;
  const percent = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + task.percent, 0) / tasks.length) : 0;
  return { kind: done === tasks.length && tasks.length ? 'complete' : 'partial', percent, done, total: tasks.length, tasks };
}

function statusStyle(kind) {
  if (kind === 'complete') return 'border-emerald-300 bg-emerald-100 text-emerald-700';
  if (kind === 'partial') return 'border-amber-300 bg-amber-100 text-amber-700';
  if (kind === 'future') return 'border-transparent bg-slate-50 text-slate-300';
  return 'border-slate-200 bg-slate-100 text-slate-400';
}

function DetailPanel({ item, studentName, onClose }) {
  if (!item) return null;
  const status = missionStatus(item);
  return (
    <div className="rounded-3xl border-2 border-indigo-200 bg-white p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-indigo-500">รายละเอียดภารกิจ</p>
          <h4 className="mt-1 text-lg font-black text-slate-800">{studentName}</h4>
          <p className="text-sm font-bold text-slate-500">{formatStatDate(item.mission_date)} · สำเร็จ {status.done}/{status.total} ภารกิจ</p>
        </div>
        <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 font-black text-slate-500" aria-label="ปิดรายละเอียด">×</button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {status.tasks.map((task) => (
          <div key={task.key} className={`rounded-2xl border-2 p-3 ${task.complete ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-black text-slate-700"><span className="mr-1.5">{task.icon}</span>{task.label}</span>
              <span className={`shrink-0 text-xs font-black ${task.complete ? 'text-emerald-600' : 'text-amber-600'}`}>{task.waiting ? 'ยังไม่เปิด' : `${task.done}/${task.total}`}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${task.complete ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${task.percent}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminMissionOverview({ startDate, endDate, month, fallbackUsers = [], currentUserId, onOpenStudent }) {
  const [missions, setMissions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const tableScrollRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true); setError(''); setDetail(null);
      try {
        const allRows = [];
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data, error: missionError } = await supabase.from('daily_mission_progress').select('*')
            .gte('mission_date', startDate).lte('mission_date', endDate)
            .order('mission_date', { ascending: true }).range(from, from + PAGE_SIZE - 1);
          if (missionError) throw missionError;
          allRows.push(...(data || []));
          if ((data || []).length < PAGE_SIZE) break;
        }
        const { data: profileRows } = await supabase.from('profiles').select('user_id, username, display_name, email, is_admin').order('username');
        if (!alive) return;
        setMissions(allRows);
        setProfiles(profileRows || []);
      } catch (loadError) {
        if (!alive) return;
        setError(loadError?.message || 'ไม่สามารถโหลดภาพรวมภารกิจได้');
        setMissions([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [startDate, endDate]);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const days = useMemo(() => dateKeysBetween(startDate, endDate), [startDate, endDate]);
  const eligibleDays = days.filter((day) => day <= today);
  const missionMap = useMemo(() => new Map(missions.map((item) => [`${item.user_id}:${item.mission_date}`, item])), [missions]);
  const students = useMemo(() => {
    const fallbackMap = new Map(fallbackUsers.map((item) => [item.user_id, { ...item, display_name: item.display_name || 'นักเรียน' }]));
    profiles.forEach((profile) => {
      if (profile.is_admin) fallbackMap.delete(profile.user_id);
      else fallbackMap.set(profile.user_id, { ...profile, display_name: displayName(profile) });
    });
    missions.forEach((item) => {
      if (!fallbackMap.has(item.user_id) && item.user_id !== currentUserId) fallbackMap.set(item.user_id, { user_id: item.user_id, display_name: `นักเรียน ${String(item.user_id).slice(0, 6)}` });
    });
    return [...fallbackMap.values()].filter((item) => item.user_id !== currentUserId).sort((a, b) => a.display_name.localeCompare(b.display_name, 'th'));
  }, [fallbackUsers, profiles, missions, currentUserId]);

  const studentSummaries = useMemo(() => students.map((student) => {
    const rows = eligibleDays.map((day) => missionMap.get(`${student.user_id}:${day}`)).filter(Boolean);
    const completed = rows.filter((row) => missionStatus(row).kind === 'complete').length;
    const partial = rows.length - completed;
    return { ...student, rows, completed, partial, missing: Math.max(0, eligibleDays.length - rows.length), rate: eligibleDays.length ? Math.round((completed / eligibleDays.length) * 100) : 0 };
  }), [students, eligibleDays, missionMap]);

  const visibleStudents = studentSummaries.filter((student) => {
    const matchesSearch = student.display_name.toLocaleLowerCase('th').includes(search.trim().toLocaleLowerCase('th'));
    if (!matchesSearch) return false;
    if (filter === 'complete') return student.completed === eligibleDays.length && eligibleDays.length > 0;
    if (filter === 'partial') return student.partial > 0;
    return true;
  });
  const studentIds = new Set(students.map((student) => student.user_id));
  const studentMissions = missions.filter((item) => studentIds.has(item.user_id));
  const completeRecords = studentMissions.filter((item) => missionStatus(item).kind === 'complete').length;
  const todayRows = studentMissions.filter((item) => item.mission_date === today);
  const todayComplete = todayRows.filter((item) => missionStatus(item).kind === 'complete').length;
  const completionRate = studentMissions.length ? Math.round((completeRecords / studentMissions.length) * 100) : 0;
  const includesToday = startDate <= today && endDate >= today;
  const studentsWithRecords = new Set(studentMissions.map((item) => item.user_id)).size;
  const monthBuckets = THAI_MONTHS.filter((item) => item.value !== 'all');

  useEffect(() => {
    if (loading || month === 'all' || today < startDate || today > endDate) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      const container = tableScrollRef.current;
      const currentDay = container?.querySelector(`[data-mission-day="${today}"]`);
      if (!container || !currentDay) return;
      container.scrollLeft = Math.max(0, currentDay.offsetLeft - (container.clientWidth / 2) + (currentDay.offsetWidth / 2));
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [loading, month, startDate, endDate, today]);

  if (loading) return <div className="rounded-3xl border-2 border-slate-200 bg-white py-16 text-center font-black text-slate-400">กำลังสรุปภารกิจของนักเรียน…</div>;
  if (error) return <div className="rounded-3xl border-2 border-red-200 bg-red-50 p-5 text-center font-bold text-red-600">โหลดภาพรวมภารกิจไม่สำเร็จ<br /><span className="text-xs font-normal">{error}</span></div>;

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-violet-900 to-indigo-800 p-5 text-white shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">Admin mission overview</p>
        <h3 className="mt-1 text-2xl font-black">🎯 ภาพรวมภารกิจนักเรียน</h3>
        <p className="mt-1 text-xs font-bold text-white/65">เห็นทั้งคนที่ทำครบ ทำบางส่วน และวันที่ไม่มีข้อมูลในหน้าจอเดียว</p>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['นักเรียน', students.length, 'คน'],
            [includesToday ? 'สำเร็จวันนี้' : 'นักเรียนมีข้อมูล', includesToday ? todayComplete : studentsWithRecords, `จาก ${students.length}`],
            ['วันทำครบ', completeRecords, `จาก ${studentMissions.length} รายการ`],
            ['อัตราสำเร็จ', `${completionRate}%`, 'เฉพาะวันที่มีข้อมูล'],
          ].map(([label, value, note]) => <div key={label} className="rounded-2xl bg-white/10 p-3"><div className="text-[10px] font-black text-white/55">{label}</div><div className="mt-1 text-2xl font-black">{value}</div><div className="text-[10px] font-bold text-white/55">{note}</div></div>)}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-stretch gap-2">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="🔎 ค้นหาชื่อ" className="min-h-11 w-36 shrink-0 rounded-xl border-2 border-slate-200 px-3 text-sm font-bold outline-none focus:border-violet-400 sm:w-40" />
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {[['all', 'ทั้งหมด'], ['partial', 'บางส่วน'], ['complete', 'ทำครบ']].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-lg px-1 py-2 text-[11px] font-black sm:text-xs ${filter === value ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
          <span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-emerald-400" />ครบทุกภารกิจ</span>
          <span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-amber-400" />ทำบางส่วน</span>
          <span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-slate-300" />ไม่มีข้อมูล</span>
        </div>
      </div>

      {detail && <DetailPanel item={detail.mission} studentName={detail.studentName} onClose={() => setDetail(null)} />}

      <div className="overflow-hidden rounded-3xl border-2 border-slate-200 bg-white shadow-sm">
        <div ref={tableScrollRef} className="overflow-x-auto">
          <table className={`w-full text-xs ${month === 'all' ? 'min-w-[760px]' : 'min-w-[1120px]'}`}>
            <thead className="sticky top-0 z-20 bg-slate-900 text-white">
              <tr>
                <th className="sticky left-0 z-30 w-28 min-w-28 max-w-28 bg-slate-900 px-3 py-3 text-left font-black">นักเรียน</th>
                {(month === 'all' ? monthBuckets : days).map((item) => {
                  const label = month === 'all' ? item.label : Number(item.slice(-2));
                  return <th key={month === 'all' ? item.value : item} data-mission-day={month === 'all' ? undefined : item} className="min-w-9 px-1 py-3 text-center font-black">{label}</th>;
                })}
                <th className="sticky right-0 z-30 min-w-24 bg-slate-900 px-2 py-3 text-center font-black">สรุป</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => (
                <tr key={student.user_id} className="border-b border-slate-100 hover:bg-violet-50/40">
                  <td className="sticky left-0 z-10 w-28 min-w-28 max-w-28 bg-white px-3 py-2 shadow-[4px_0_8px_-7px_rgba(15,23,42,0.5)]">
                    <button type="button" title={student.display_name} onClick={() => onOpenStudent(student.user_id)} className="block max-w-24 truncate text-left font-black text-slate-800 hover:text-violet-700">{student.display_name}</button>
                  </td>
                  {month === 'all' ? monthBuckets.map((monthItem) => {
                    const prefix = `${startDate.slice(0, 4)}-${String(monthItem.value).padStart(2, '0')}`;
                    const rows = student.rows.filter((row) => row.mission_date.startsWith(prefix));
                    const completed = rows.filter((row) => missionStatus(row).kind === 'complete').length;
                    const kind = !rows.length ? 'none' : completed === rows.length ? 'complete' : 'partial';
                    return <td key={monthItem.value} className="px-1 py-2 text-center"><span className={`inline-flex min-h-8 min-w-10 items-center justify-center rounded-lg border px-1 text-[10px] font-black ${statusStyle(kind)}`} title={`${completed}/${rows.length} วันที่มีข้อมูล`}>{rows.length ? `${completed}/${rows.length}` : '–'}</span></td>;
                  }) : days.map((day) => {
                    const mission = missionMap.get(`${student.user_id}:${day}`);
                    const state = day > today ? { kind: 'future', percent: 0 } : missionStatus(mission);
                    return <td key={day} className="px-0.5 py-2 text-center"><button type="button" disabled={!mission} onClick={() => setDetail({ mission, studentName: student.display_name })} className={`h-8 w-8 rounded-lg border text-[10px] font-black ${statusStyle(state.kind)} ${mission ? 'cursor-pointer hover:ring-2 hover:ring-violet-400' : 'cursor-default'}`} title={mission ? `สำเร็จ ${state.done}/${state.total} ภารกิจ (${state.percent}%)` : day > today ? 'ยังไม่ถึงวันนี้' : 'ไม่มีข้อมูล'}>{mission ? state.percent : '–'}{mission && <span className="text-[8px]">%</span>}</button></td>;
                  })}
                  <td className="sticky right-0 z-10 bg-white px-2 py-2 text-center shadow-[-4px_0_8px_-7px_rgba(15,23,42,0.5)]">
                    <div className="font-black text-emerald-600">{student.completed} วัน</div>
                    <div className="text-[9px] font-bold text-slate-400">{student.rate}% ของช่วง</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleStudents.length && <div className="py-12 text-center font-bold text-slate-400">ไม่พบนักเรียนตามตัวกรอง</div>}
      </div>
      <p className="px-2 text-[10px] font-bold leading-relaxed text-slate-400">หมายเหตุ: “ไม่มีข้อมูล” หมายถึงระบบไม่พบแถวภารกิจของนักเรียนในวันนั้น อาจเป็นวันที่ไม่ได้เข้าใช้งานหรือภารกิจยังไม่ถูกสร้าง</p>
    </section>
  );
}
