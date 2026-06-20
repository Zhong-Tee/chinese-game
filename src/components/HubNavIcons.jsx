import React from 'react';

const STROKE = 'currentColor';

function IconWrap({ children, active, className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl transition-colors ${
        active ? 'bg-amber-500/25 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.35)]' : 'text-white/55'
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function NavIconHome({ active }) {
  return (
    <IconWrap active={active}>
      <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
      </svg>
    </IconWrap>
  );
}

export function NavIconHero({ active }) {
  return (
    <IconWrap active={active}>
      <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]" stroke={STROKE} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    </IconWrap>
  );
}

export function NavIconShop({ active }) {
  return (
    <IconWrap active={active}>
      <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 7h15l-1.5 9H7.5L6 7z" />
        <path d="M6 7L5 3H2" />
        <circle cx="9" cy="19" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="17" cy="19" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    </IconWrap>
  );
}

export function NavIconStats({ active }) {
  return (
    <IconWrap active={active}>
      <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]" stroke={STROKE} strokeWidth="2" strokeLinecap="round">
        <path d="M5 18V10M12 18V6M19 18v-8" />
      </svg>
    </IconWrap>
  );
}

export function NavIconMore({ active }) {
  return (
    <IconWrap active={active}>
      <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]" stroke={STROKE} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
      </svg>
    </IconWrap>
  );
}

export function NavIconFight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 sm:w-8 sm:h-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 11c0-2 1.5-4 5-4s5 2 5 4c0 3-2 5-5 8-3-3-5-5-5-8z" />
      <path d="M12 3v2M9 5l1 1M15 5l-1 1" />
    </svg>
  );
}

const ICON_MAP = {
  home: NavIconHome,
  hero: NavIconHero,
  shop: NavIconShop,
  statistics: NavIconStats,
  settings: NavIconMore,
};

export function HubNavIcon({ action, active }) {
  const Comp = ICON_MAP[action] || NavIconMore;
  return <Comp active={active} />;
}
