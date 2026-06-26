import React from 'react';
import {
  getScheduledLevelCountdowns,
  formatLevelCountdownText,
  sortLevelCountdowns,
} from '../utils/levelScheduleMeta';

export default function HubLevelScheduleBar({ schedules, onPlayLevel }) {
  const statuses = sortLevelCountdowns(getScheduledLevelCountdowns(schedules));

  const handlePlay = (levelKey) => {
    onPlayLevel?.(Number(levelKey));
  };

  return (
    <div className="hub-level-schedule-bar w-full" role="status" aria-live="polite">
      <div className="hub-level-schedule-bar__header">
        <span className="hub-level-schedule-bar__icon" aria-hidden>📅</span>
        <span className="hub-level-schedule-bar__title">ตารางเปิด LV3–6</span>
      </div>
      <div className="hub-level-schedule-bar__items">
        {statuses.map((status) => {
          const label = status.meta?.label || `LV${status.levelKey}`;
          const text = formatLevelCountdownText(status);

          if (status.unconfigured) {
            return (
              <div key={status.levelKey} className="hub-level-schedule-chip hub-level-schedule-chip--muted">
                <span className="hub-level-schedule-chip__lv">{label}</span>
                <span className="hub-level-schedule-chip__days">{text}</span>
              </div>
            );
          }

          if (status.availableToday) {
            return (
              <button
                key={status.levelKey}
                type="button"
                onClick={() => handlePlay(status.levelKey)}
                className="hub-level-schedule-chip hub-level-schedule-chip--today"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(52, 211, 153, 0.35)' }}
                aria-label={`${label} เล่นได้วันนี้`}
              >
                <span className="hub-level-schedule-chip__lv">{label}</span>
                <span className="hub-level-schedule-chip__days">{text}</span>
              </button>
            );
          }

          return (
            <div
              key={status.levelKey}
              className="hub-level-schedule-chip hub-level-schedule-chip--locked"
            >
              <span className="hub-level-schedule-chip__lv">{label}</span>
              <span className="hub-level-schedule-chip__days">{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
