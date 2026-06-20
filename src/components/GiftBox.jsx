import React from 'react';

/** กล่องของขวัญ CSS — แสดงเหมือนกันทุกอุปกรณ์ (ไม่ใช้ emoji) */
export default function GiftBox({ size = 'sm', state = 'idle', animate = true, className = '' }) {
  return (
    <div
      className={[
        'gift-box',
        `gift-box--${size}`,
        state === 'opening' ? 'gift-box--shake' : '',
        state === 'opened' ? 'gift-box--opened' : '',
        animate ? 'gift-box--float' : '',
        className,
      ].filter(Boolean).join(' ')}
      aria-hidden
    >
      <div className="gift-box__bow">
        <span className="gift-box__bow-loop gift-box__bow-loop--left" />
        <span className="gift-box__bow-loop gift-box__bow-loop--right" />
        <span className="gift-box__bow-knot" />
      </div>
      <div className="gift-box__lid" />
      <div className="gift-box__ribbon-h" />
      <div className="gift-box__body">
        <div className="gift-box__ribbon-v" />
      </div>
    </div>
  );
}
