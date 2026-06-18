import React, { useId } from 'react';

// ไอคอนเหรียญทองคำ (SVG) — แสดงคมชัดทุกระบบ ไม่ขึ้นกับฟอนต์ emoji
export default function CoinIcon({ className = 'w-6 h-6', title }) {
  const uid = useId();
  const faceId = `coinFace-${uid}`;
  const edgeId = `coinEdge-${uid}`;
  return (
    <svg
      viewBox="0 0 48 48"
      className={`inline-block align-middle shrink-0 ${className}`}
      role="img"
      aria-label={title || 'coin'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={faceId} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#FFF6C9" />
          <stop offset="45%" stopColor="#FFD24D" />
          <stop offset="100%" stopColor="#E8930C" />
        </radialGradient>
        <linearGradient id={edgeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6A91B" />
          <stop offset="100%" stopColor="#B4670A" />
        </linearGradient>
      </defs>
      {/* ขอบเหรียญ */}
      <circle cx="24" cy="24" r="22" fill={`url(#${edgeId})`} />
      <circle cx="24" cy="24" r="22" fill="none" stroke="#8A4E06" strokeWidth="1" opacity="0.35" />
      {/* หน้าเหรียญ */}
      <circle cx="24" cy="24" r="18" fill={`url(#${faceId})`} stroke="#FFE9A8" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="18" fill="none" stroke="#C9760A" strokeWidth="1" opacity="0.5" />
      {/* ดาวกลางเหรียญ */}
      <path
        d="M24 15 L26.23 20.93 L32.56 21.22 L27.61 25.17 L29.29 31.28 L24 27.8 L18.71 31.28 L20.39 25.17 L15.44 21.22 L21.77 20.93 Z"
        fill="#F0930C"
        stroke="#C9760A"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* ประกายแสง */}
      <ellipse cx="17" cy="15" rx="5" ry="3" fill="#FFFFFF" opacity="0.55" />
    </svg>
  );
}
