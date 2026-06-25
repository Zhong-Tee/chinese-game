import React, { useId } from 'react';

const TIER_COLORS = {
  gold: {
    main: ['#FFF6C9', '#FFD24D', '#E8930C'],
    edge: ['#F6A91B', '#B4670A'],
    stroke: '#8A4E06',
    accent: '#F0930C',
  },
  silver: {
    main: ['#F5F7FA', '#C8D0DA', '#8A96A8'],
    edge: ['#B8C4D0', '#6B7A8C'],
    stroke: '#5A6678',
    accent: '#9AA8B8',
  },
  bronze: {
    main: ['#F5D0B0', '#CD7F4A', '#8B4513'],
    edge: ['#B87333', '#6B3410'],
    stroke: '#5C2E0A',
    accent: '#A0522D',
  },
};

function TierGradients({ uid, tier }) {
  const c = TIER_COLORS[tier];
  const faceId = `rewardFace-${uid}`;
  const edgeId = `rewardEdge-${uid}`;
  return (
    <defs>
      <radialGradient id={faceId} cx="38%" cy="32%" r="75%">
        <stop offset="0%" stopColor={c.main[0]} />
        <stop offset="45%" stopColor={c.main[1]} />
        <stop offset="100%" stopColor={c.main[2]} />
      </radialGradient>
      <linearGradient id={edgeId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={c.edge[0]} />
        <stop offset="100%" stopColor={c.edge[1]} />
      </linearGradient>
    </defs>
  );
}

function MedalShape({ uid, tier }) {
  const c = TIER_COLORS[tier];
  const faceId = `rewardFace-${uid}`;
  const edgeId = `rewardEdge-${uid}`;
  return (
  <g>
    <path d="M16 6 L20 14 L28 14 L22 20 L24 28 L16 24 L8 28 L10 20 L4 14 L12 14 Z" fill={`url(#${edgeId})`} />
    <circle cx="16" cy="18" r="10" fill={`url(#${edgeId})`} />
    <circle cx="16" cy="18" r="8" fill={`url(#${faceId})`} stroke={c.main[0]} strokeWidth="1" />
    <path
      d="M16 12 L17.5 15.5 L21 15.8 L18.2 18.2 L19 21.8 L16 19.8 L13 21.8 L13.8 18.2 L11 15.8 L14.5 15.5 Z"
      fill={c.accent}
      stroke={c.stroke}
      strokeWidth="0.4"
      strokeLinejoin="round"
    />
    <ellipse cx="12" cy="14" rx="3" ry="2" fill="#FFFFFF" opacity="0.45" />
  </g>
  );
}

function CupShape({ uid, tier }) {
  const c = TIER_COLORS[tier];
  const faceId = `rewardFace-${uid}`;
  const edgeId = `rewardEdge-${uid}`;
  return (
  <g>
    <path d="M6 10 L6 18 Q6 24 16 24 Q26 24 26 18 L26 10 Z" fill={`url(#${faceId})`} stroke={c.stroke} strokeWidth="0.8" />
    <path d="M6 10 L26 10 L24 8 L8 8 Z" fill={`url(#${edgeId})`} stroke={c.stroke} strokeWidth="0.6" />
    <path d="M4 12 Q2 14 4 16" fill="none" stroke={`url(#${edgeId})`} strokeWidth="2.5" strokeLinecap="round" />
    <path d="M28 12 Q30 14 28 16" fill="none" stroke={`url(#${edgeId})`} strokeWidth="2.5" strokeLinecap="round" />
    <rect x="12" y="24" width="8" height="3" rx="1" fill={`url(#${edgeId})`} />
    <rect x="10" y="27" width="12" height="2" rx="1" fill={c.stroke} opacity="0.7" />
    <ellipse cx="16" cy="14" rx="6" ry="4" fill="#FFFFFF" opacity="0.35" />
  </g>
  );
}

function ShieldShape({ uid, tier }) {
  const c = TIER_COLORS[tier];
  const faceId = `rewardFace-${uid}`;
  const edgeId = `rewardEdge-${uid}`;
  return (
  <g>
    <path
      d="M16 4 L26 8 L26 16 Q26 24 16 30 Q6 24 6 16 L6 8 Z"
      fill={`url(#${faceId})`}
      stroke={c.stroke}
      strokeWidth="1"
      strokeLinejoin="round"
    />
    <path
      d="M16 4 L26 8 L26 16 Q26 24 16 30 Q6 24 6 16 L6 8 Z"
      fill="none"
      stroke={`url(#${edgeId})`}
      strokeWidth="2"
      strokeLinejoin="round"
      opacity="0.5"
    />
    <path
      d="M16 10 L18.5 14.5 L23.5 15 L19.5 18.5 L20.5 23.5 L16 21 L11.5 23.5 L12.5 18.5 L8.5 15 L13.5 14.5 Z"
      fill={c.accent}
      stroke={c.stroke}
      strokeWidth="0.4"
      strokeLinejoin="round"
      opacity="0.85"
    />
    <ellipse cx="12" cy="10" rx="4" ry="3" fill="#FFFFFF" opacity="0.35" />
  </g>
  );
}

const SHAPE_MAP = { medal: MedalShape, cup: CupShape, shield: ShieldShape };

export default function RewardIcon({
  type = 'medal',
  tier = 'gold',
  earned = false,
  className = 'w-8 h-8',
  title,
}) {
  const uid = useId().replace(/:/g, '');
  const Shape = SHAPE_MAP[type] || MedalShape;
  const label = title || `${type} ${tier}`;
  const dimClass = earned ? '' : 'opacity-35 grayscale';

  return (
    <svg
      viewBox="0 0 32 32"
      className={`inline-block align-middle shrink-0 ${dimClass} ${className}`}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <TierGradients uid={uid} tier={tier} />
      <Shape uid={uid} tier={tier} />
    </svg>
  );
}

export function RewardTierRow({ rewardType, earnedMedal, className = '' }) {
  const earnedRank = earnedMedal ? (['bronze', 'silver', 'gold'].indexOf(earnedMedal) + 1) : 0;
  const tiers = ['gold', 'silver', 'bronze'];
  const tierRanks = { gold: 3, silver: 2, bronze: 1 };

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      {tiers.map(tier => (
        <RewardIcon
          key={tier}
          type={rewardType}
          tier={tier}
          earned={earnedRank >= tierRanks[tier]}
          className="w-7 h-7 sm:w-8 sm:h-8"
          title={`${tier}${earnedRank >= tierRanks[tier] ? ' (ได้รับแล้ว)' : ''}`}
        />
      ))}
    </div>
  );
}
