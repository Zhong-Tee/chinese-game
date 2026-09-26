export const BOARD_W = 272;
export const COL = { a: '12.5%', b: '37.5%', c: '62.5%', d: '87.5%' };
export const X = { a: 34, b: 102, c: 170, d: 238 };

export const boxBase = 'absolute flex h-[3.25rem] w-[3.25rem] -translate-x-1/2 items-center justify-center rounded-2xl text-2xl font-black transition-all duration-300';
export const signBase = 'absolute flex h-[3.25rem] -translate-x-1/2 items-center justify-center text-2xl font-black transition-colors duration-300';
export const tagBase = 'absolute flex h-6 w-[3.25rem] -translate-x-1/2 items-center justify-center rounded-full text-xs font-black transition-colors duration-300';

export function branchPath(fromX, fromY, leftX, rightX, toY) {
  const midY = fromY + Math.round((toY - fromY) / 2);
  return `M${fromX} ${fromY} V${midY} M${leftX} ${midY} H${rightX} M${leftX} ${midY} V${toY - 4} M${rightX} ${midY} V${toY - 4}`;
}

export function arrowDown(x, y) {
  return `M${x - 6} ${y - 11} L${x} ${y} L${x + 6} ${y - 11}`;
}
