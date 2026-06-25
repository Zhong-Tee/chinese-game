import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { fetchFlashcardStatistics } from '../utils/flashcardStatsStorage';
import {
  LEVEL_KEYS,
  LEVEL_SCHEDULE_META,
  THAI_MONTHS,
  formatPlayDuration,
  formatStatDate,
  getDateRange,
  getScheduledLevelsForDate,
} from '../utils/levelScheduleMeta';

const EMPTY_SUMMARY = { active_days: 0, total_words: 0, total_seconds: 0 };

function SummaryCard({ label, value, accent = 'orange', compact = false }) {
  const accents = {
    orange: 'from-orange-500/15 to-orange-500/10 border-orange-400/25 text-orange-300',
    blue: 'from-blue-500/15 to-blue-500/10 border-blue-400/25 text-blue-300',
    purple: 'from-purple-500/15 to-purple-500/10 border-purple-400/25 text-purple-300',
    emerald: 'from-emerald-500/15 to-emerald-500/10 border-emerald-400/25 text-emerald-300',
  };
  const classes = accents[accent] || accents.orange;
  const valueSize = compact ? 'text-base leading-tight' : 'text-2xl';

  return (
    <div className={`p-4 rounded-2xl border-2 bg-gradient-to-r ${classes}`}>
      <div className="text-xs font-black text-white/60 uppercase mb-1">{label}</div>
      <div className={`${valueSize} font-black ${classes.split(' ').pop()} ${compact ? 'whitespace-nowrap' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function LevelBadge({ levelKey }) {
  const meta = LEVEL_SCHEDULE_META[levelKey];
  if (!meta) return null;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
}

function DailyBreakdownTable({ dailyRows, schedules }) {
  if (!dailyRows.length) {
    return (
      <div className="text-center py-8 text-white/40 font-bold">
        ยังไม่มีประวัติการเล่นในช่วงนี้
      </div>
    );
  }

  const totals = LEVEL_KEYS.reduce((acc, key) => {
    acc[key] = dailyRows.reduce((sum, row) => sum + (row.by_level?.[key] || 0), 0);
    return acc;
  }, {});

  const grandTotalWords = dailyRows.reduce((sum, row) => sum + (row.total_words || 0), 0);
  const grandTotalSeconds = dailyRows.reduce((sum, row) => sum + (row.total_seconds || 0), 0);

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full min-w-[640px] text-xs">
        <thead>
          <tr className="border-b-2 border-white/15">
            <th className="text-left py-2 px-2 font-black text-white/60 uppercase">วันที่</th>
            {LEVEL_KEYS.map((key) => (
              <th key={key} className="text-center py-2 px-1 font-black text-white/60">
                <LevelBadge levelKey={key} />
              </th>
            ))}
            <th className="text-center py-2 px-2 font-black text-white/60 uppercase">รวม</th>
            <th className="text-center py-2 px-2 font-black text-white/60 uppercase">เวลา</th>
          </tr>
        </thead>
        <tbody>
          {dailyRows.map((row) => {
            const scheduledLevels = getScheduledLevelsForDate(row.stat_date, schedules);
            return (
            <tr key={row.stat_date} className="border-b border-white/10 hover:bg-white/5">
              <td className="py-2 px-2 font-bold text-white">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="whitespace-nowrap">{formatStatDate(row.stat_date)}</span>
                  {scheduledLevels.map((levelKey) => (
                    <LevelBadge key={levelKey} levelKey={levelKey} />
                  ))}
                </div>
              </td>
              {LEVEL_KEYS.map((key) => {
                const count = row.by_level?.[key] || 0;
                return (
                  <td key={key} className="text-center py-2 px-1 font-black text-white/70">
                    {count > 0 ? count : <span className="text-white/25">-</span>}
                  </td>
                );
              })}
              <td className="text-center py-2 px-2 font-black text-orange-400">{row.total_words || 0}</td>
              <td className="text-center py-2 px-2 font-bold text-white/60 whitespace-nowrap">
                {formatPlayDuration(row.total_seconds || 0)}
              </td>
            </tr>
            );
          })}
          <tr className="bg-white/10 font-black">
            <td className="py-2 px-2 uppercase text-white/70">รวม</td>
            {LEVEL_KEYS.map((key) => (
              <td key={key} className="text-center py-2 px-1 text-white">{totals[key] || 0}</td>
            ))}
            <td className="text-center py-2 px-2 text-orange-400">{grandTotalWords}</td>
            <td className="text-center py-2 px-2 text-white/70">{formatPlayDuration(grandTotalSeconds)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardSection({ title, items, valueKey, formatValue }) {
  const topItems = (items || []).slice(0, 5);
  if (!topItems.length) {
    return (
      <div className="bg-white/5 p-4 rounded-2xl border-2 border-white/10">
        <h4 className="font-black text-sm uppercase italic mb-2 text-white/70">{title}</h4>
        <div className="text-white/40 text-sm">ยังไม่มีข้อมูล</div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 p-4 rounded-2xl border-2 border-white/10">
      <h4 className="font-black text-sm uppercase italic mb-3 text-white/70">{title}</h4>
      <div className="space-y-2">
        {topItems.map((item, index) => (
          <div key={item.user_id} className="flex items-center justify-between p-2 rounded-xl bg-white/5">
            <div className="flex items-center gap-2">
              <span className="text-lg">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}</span>
              <span className="font-black text-white text-sm">{item.display_name}</span>
            </div>
            <span className="font-black text-orange-400">{formatValue(item[valueKey], item)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Statistics({ user, setPage }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState('personal');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState(null);
  const [error, setError] = useState(null);
  const [viewSchedules, setViewSchedules] = useState({ lv3: [], lv4: [], lv5: [], lv6: [] });

  const yearOptions = useMemo(() => {
    const start = statsData?.earliest_stat_date
      ? Number(statsData.earliest_stat_date.split('-')[0])
      : currentYear;
    const years = [];
    for (let y = currentYear; y >= start; y -= 1) years.push(y);
    return years.length ? years : [currentYear];
  }, [statsData?.earliest_stat_date, currentYear]);

  const loadStats = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getDateRange(year, month);
      let targetUserId = selectedUserId || null;
      if (!targetUserId && activeTab === 'personal') {
        targetUserId = user.id;
      }
      const data = await fetchFlashcardStatistics(startDate, endDate, targetUserId);
      setStatsData(data);
    } catch (err) {
      setError(err.message || 'ไม่สามารถโหลดข้อมูลได้');
      setStatsData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [user?.id, year, month, selectedUserId, activeTab]);

  useEffect(() => {
    const fetchSchedules = async () => {
      const targetId = selectedUserId || (activeTab === 'personal' ? user?.id : null);
      if (!targetId) {
        setViewSchedules({ lv3: [], lv4: [], lv5: [], lv6: [] });
        return;
      }

      try {
        const { data, error: scheduleError } = await supabase
          .from('user_settings')
          .select('schedules')
          .eq('user_id', targetId)
          .single();

        if (scheduleError) {
          setViewSchedules({ lv3: [], lv4: [], lv5: [], lv6: [] });
          return;
        }

        setViewSchedules(data?.schedules || { lv3: [], lv4: [], lv5: [], lv6: [] });
      } catch {
        setViewSchedules({ lv3: [], lv4: [], lv5: [], lv6: [] });
      }
    };

    fetchSchedules();
  }, [user?.id, selectedUserId, activeTab]);

  const summary = statsData?.summary || EMPTY_SUMMARY;
  const dailyRows = statsData?.daily || [];
  const leaderboard = statsData?.leaderboard || [];
  const activeDays = summary.active_days || 0;
  const avgWordsPerDay = activeDays > 0 ? Math.round((summary.total_words || 0) / activeDays) : 0;
  const avgSecondsPerDay = activeDays > 0
    ? Math.round((summary.total_seconds || 0) / activeDays)
    : 0;

  const sortedByDays = [...leaderboard].sort((a, b) => b.active_days - a.active_days);
  const sortedByWords = [...leaderboard].sort((a, b) => b.total_words - a.total_words);
  const sortedByTime = [...leaderboard].sort((a, b) => b.total_seconds - a.total_seconds);

  const handleLeaderboardRowClick = (userId) => {
    setSelectedUserId(userId);
    setActiveTab('personal');
  };

  const selectedUserName = selectedUserId
    ? (statsData?.users || []).find((u) => u.user_id === selectedUserId)?.display_name
    : null;

  if (loading && !statsData) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-2xl font-black italic text-white/60">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 pt-4 pb-10 select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
      onDragStart={(e) => e.preventDefault()}
    >
      <button onClick={() => setPage('dashboard')} className="text-orange-400 font-black text-sm uppercase italic underline">
        ← Back
      </button>
      <h2 className="text-3xl font-black text-center uppercase italic mb-2">📈 Statistics</h2>
      <p className="text-center text-xs font-bold text-white/50 px-4">
        ประวัติการเล่น Flashcards — นับเฉพาะวันที่มีการเล่นเกม
      </p>

      <div className="bg-white/5 p-4 rounded-2xl border-2 border-white/10 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-black text-white/50 uppercase block mb-1">ปี</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full p-2 rounded-xl border-2 border-white/15 bg-white/10 text-white font-black text-sm [&>option]:text-slate-800"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-white/50 uppercase block mb-1">เดือน</label>
            <select
              value={month}
              onChange={(e) => {
                const val = e.target.value;
                setMonth(val === 'all' ? 'all' : Number(val));
              }}
              className="w-full p-2 rounded-xl border-2 border-white/15 bg-white/10 text-white font-black text-sm [&>option]:text-slate-800"
            >
              {THAI_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-white/50 uppercase block mb-1">User</label>
          <select
            value={selectedUserId}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedUserId(value);
              setActiveTab(value ? 'personal' : 'overview');
            }}
            className="w-full p-2 rounded-xl border-2 border-white/15 bg-white/10 text-white font-black text-sm [&>option]:text-slate-800"
          >
            <option value="">ทุกคน (ภาพรวม)</option>
            {(statsData?.users || []).map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.user_id === user?.id ? `${u.display_name} (ฉัน)` : u.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border-2 border-red-400/30 rounded-2xl p-4 text-red-300 font-bold text-sm text-center">
          {error}
          <div className="text-xs font-normal mt-2 text-red-300/70">
            กรุณารัน migration `supabase_migration_flashcard_statistics.sql` บน Supabase
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="วันเข้าเล่น" value={activeDays} accent="orange" />
        <SummaryCard label="เวลาเล่นรวม" value={formatPlayDuration(summary.total_seconds || 0)} accent="blue" />
        <SummaryCard label="คำศัพท์รวม" value={summary.total_words || 0} accent="purple" />
        <SummaryCard
          label="เฉลี่ย/วัน"
          compact
          value={
            <span className="inline-flex items-baseline gap-1.5">
              <span>{avgWordsPerDay} คำ</span>
              <span className="text-white/40">·</span>
              <span>{formatPlayDuration(avgSecondsPerDay)}</span>
            </span>
          }
          accent="emerald"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            setSelectedUserId('');
            setActiveTab('personal');
          }}
          className={`flex-1 py-3 rounded-full font-black text-sm uppercase transition-all ${
            activeTab === 'personal' ? 'bg-orange-500 text-white' : 'bg-white/5 border-2 border-white/15 text-white/70'
          }`}
        >
          ของฉัน
        </button>
        {!selectedUserId && (
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 rounded-full font-black text-sm uppercase transition-all ${
              activeTab === 'overview' ? 'bg-orange-500 text-white' : 'bg-white/5 border-2 border-white/15 text-white/70'
            }`}
          >
            ภาพรวม
          </button>
        )}
        {selectedUserId && (
          <button
            onClick={() => setActiveTab('personal')}
            className="flex-1 py-3 rounded-full font-black text-sm uppercase transition-all bg-orange-500 text-white"
          >
            รายละเอียด User
          </button>
        )}
      </div>

      {activeTab === 'personal' && (
        <div className="bg-white/5 p-4 rounded-3xl border-2 border-white/10 shadow-sm">
          <h3 className="text-lg font-black uppercase italic mb-4 text-center">
            รายวัน — {selectedUserName || 'ของฉัน'}
          </h3>
          {loading ? (
            <div className="text-center py-8 text-white/40 font-bold">กำลังโหลด...</div>
          ) : (
            <DailyBreakdownTable dailyRows={dailyRows} schedules={viewSchedules} />
          )}
        </div>
      )}

      {activeTab === 'overview' && !selectedUserId && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <LeaderboardSection
              title="🗓️ เข้าเล่นมากสุด"
              items={sortedByDays}
              valueKey="active_days"
              formatValue={(v) => `${v} วัน`}
            />
            <LeaderboardSection
              title="📚 คำศัพท์มากสุด"
              items={sortedByWords}
              valueKey="total_words"
              formatValue={(v) => `${v} คำ`}
            />
            <LeaderboardSection
              title="⏱️ ใช้เวลานานสุด"
              items={sortedByTime}
              valueKey="total_seconds"
              formatValue={(v) => formatPlayDuration(v)}
            />
          </div>

          <div className="bg-white/5 p-4 rounded-3xl border-2 border-white/10 shadow-sm">
            <h3 className="text-lg font-black uppercase italic mb-4 text-center">Ranking รวม</h3>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {leaderboard.length === 0 && (
                <div className="text-center py-8 text-white/40 font-bold">ยังไม่มีข้อมูล Ranking</div>
              )}
              {leaderboard.map((item, index) => (
                <button
                  key={item.user_id}
                  type="button"
                  onClick={() => handleLeaderboardRowClick(item.user_id)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-white/10 bg-white/5 hover:bg-orange-500/10 hover:border-orange-400/30 transition-all text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </span>
                    <div className="min-w-0">
                      <div className="font-black text-white truncate">{item.display_name}</div>
                      <div className="text-[10px] font-bold text-white/50">
                        {item.active_days} วัน · {formatPlayDuration(item.total_seconds)} · {item.total_words} คำ
                      </div>
                    </div>
                  </div>
                  <span className="text-orange-400 font-black text-sm shrink-0">ดู →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
