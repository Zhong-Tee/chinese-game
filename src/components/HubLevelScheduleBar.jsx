import React from 'react';
import {
  SCHEDULED_LEVEL_KEYS,
  getDaysUntilLevelPlay,
  formatLevelCountdownText,
  hasLevelKey,
  isKeyLevelPlayableToday,
} from '../utils/levelScheduleMeta';

export default function HubLevelScheduleBar({ schedules, levelKeys = {}, onPlayLevel }) {
  const statuses = SCHEDULED_LEVEL_KEYS.map((key) => {
    const countdown = getDaysUntilLevelPlay(key, schedules);
    return {
      ...countdown,
      holdsKey: hasLevelKey(key, levelKeys),
      playable: isKeyLevelPlayableToday(key, levelKeys),
    };
  });

  // เรียง: เล่นได้ตอนนี้ก่อน → ถือกุญแจ → ใกล้เปิด → ยังไม่ตั้งค่า
  statuses.sort((a, b) => {
    const rank = (s) => (s.playable ? 0 : s.holdsKey ? 1 : s.unconfigured ? 3 : 2);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    const daysA = a.days ?? 9999;
    const daysB = b.days ?? 9999;
    if (daysA !== daysB) return daysA - daysB;
    return Number(a.levelKey) - Number(b.levelKey);
  });

  const handlePlay = (levelKey) => {
    onPlayLevel?.(Number(levelKey));
  };

  return (
    <div className="hub-level-schedule-bar w-full" role="status" aria-live="polite">
      <div className="hub-level-schedule-bar__header">
        <span className="hub-level-schedule-bar__icon" aria-hidden>🔑</span>
        <span className="hub-level-schedule-bar__title">ปลดล็อก LV3–6</span>
      </div>
      <div className="hub-level-schedule-bar__items">
        {statuses.map((status) => {
          const label = status.meta?.label || `LV${status.levelKey}`;

          // มีกุญแจ + ยังไม่ใช้สิทธิ์วันนี้ → กดเล่นได้เลย
          if (status.playable) {
            return (
              <button
                key={status.levelKey}
                type="button"
                onClick={() => handlePlay(status.levelKey)}
                className="hub-level-schedule-chip hub-level-schedule-chip--today"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(52, 211, 153, 0.35)' }}
                aria-label={`${label} ปลดล็อกด้วยลูกกุญแจ`}
              >
                <span className="hub-level-schedule-chip__lv">{label}</span>
                <span className="hub-level-schedule-chip__days">🔑 ปลดล็อก</span>
              </button>
            );
          }

          // มีกุญแจแต่ใช้สิทธิ์วันนี้ไปแล้ว (เล่นได้วันละ 1 level)
          if (status.holdsKey) {
            return (
              <div key={status.levelKey} className="hub-level-schedule-chip hub-level-schedule-chip--locked">
                <span className="hub-level-schedule-chip__lv">{label}</span>
                <span className="hub-level-schedule-chip__days">🔑 พรุ่งนี้</span>
              </div>
            );
          }

          if (status.unconfigured) {
            return (
              <div key={status.levelKey} className="hub-level-schedule-chip hub-level-schedule-chip--muted">
                <span className="hub-level-schedule-chip__lv">{label}</span>
                <span className="hub-level-schedule-chip__days">รอตั้งค่า</span>
              </div>
            );
          }

          return (
            <div key={status.levelKey} className="hub-level-schedule-chip hub-level-schedule-chip--locked">
              <span className="hub-level-schedule-chip__lv">{label}</span>
              <span className="hub-level-schedule-chip__days">{formatLevelCountdownText(status)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
