import { useSyncExternalStore } from 'react';
import { getThemePreference, setThemePreference, subscribeTheme } from '../utils/theme';

export default function ThemeSettings() {
  const preference = useSyncExternalStore(subscribeTheme, getThemePreference);
  return (
    <fieldset className="theme-settings">
      <legend>รูปแบบหน้าจอ</legend>
      <div className="theme-options">
        {[['original', '🎨', 'สีเดิม'], ['system', '📱', 'ตามระบบ'], ['light', '☀️', 'สว่าง'], ['dark', '🌙', 'มืด']].map(([value, icon, label]) => (
          <label key={value} className="theme-option">
            <input type="radio" name="appearance" value={value} checked={preference === value} onChange={() => setThemePreference(value)} />
            <span aria-hidden="true">{icon}</span> {label}
          </label>
        ))}
      </div>
      <p>ตามระบบจะเปลี่ยนตามโหมดของมือถือ · จำตัวเลือกในเบราว์เซอร์นี้อัตโนมัติ</p>
    </fieldset>
  );
}
