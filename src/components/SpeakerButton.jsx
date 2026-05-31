import React from 'react';
import { speakChinese } from '../utils/chineseSpeech';

export default function SpeakerButton({ text, label, className = 'w-9 h-9' }) {
  if (!text?.trim()) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    speakChinese(text);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label || `ฟังเสียง ${text}`}
      className={`inline-flex items-center justify-center rounded-lg border-2 border-orange-400 bg-white/90 text-orange-500 shadow-sm active:scale-95 transition shrink-0 ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-[55%] h-[55%]"
        aria-hidden="true"
      >
        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.513H4.508c-1.141 0-2.066.925-2.066 2.066v3.75c0 1.141.925 2.066 2.066 2.066h1.932l4.5 4.513c.944.945 2.56.276 2.56-1.06V4.06ZM18.584 5.46a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
        <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
      </svg>
    </button>
  );
}
