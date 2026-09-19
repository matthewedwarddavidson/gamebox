import { useState } from 'react';
import { E, EMPTY, N, S, W, idx, type Piece, type Puzzle } from '../engine';
import type { Tool } from '../store/gameStore';

interface BoardProps {
  puzzle: Puzzle;
  pieces: Piece[];
  crosses: boolean[];
  locked: boolean[];
  review: boolean;
  onPlace: (row: number, col: number) => void;
  onDrop: (row: number, col: number, tool: Tool) => void;
}

// Edge-midpoint anchor points within a 0..100 cell for each connected side.
const ANCHOR: Record<number, [number, number]> = {
  [N]: [50, 2],
  [E]: [98, 50],
  [S]: [50, 98],
  [W]: [2, 50],
};

const CENTRE: [number, number] = [50, 50];

/** The two connected directions of a track piece, or null if not a track. */
function pieceDirs(piece: Piece): [number, number] | null {
  if (piece === EMPTY) return null;
  const dirs: number[] = [];
  for (const d of [N, E, S, W]) if ((piece & d) !== 0) dirs.push(d);
  if (dirs.length !== 2) return null;
  return [dirs[0], dirs[1]];
}

/** SVG path for a track piece: a smooth quadratic through the cell centre. */
function piecePath(piece: Piece): string | null {
  const dirs = pieceDirs(piece);
  if (!dirs) return null;
  const [ax, ay] = ANCHOR[dirs[0]];
  const [bx, by] = ANCHOR[dirs[1]];
  return `M ${ax} ${ay} Q ${CENTRE[0]} ${CENTRE[1]} ${bx} ${by}`;
}

/** Quadratic Bézier point at parameter t (control point fixed at the centre). */
function bezier(t: number, a: [number, number], b: [number, number]): [number, number] {
  const mt = 1 - t;
  return [
    mt * mt * a[0] + 2 * mt * t * CENTRE[0] + t * t * b[0],
    mt * mt * a[1] + 2 * mt * t * CENTRE[1] + t * t * b[1],
  ];
}

/** Quadratic Bézier tangent (unnormalised) at parameter t. */
function tangent(t: number, a: [number, number], b: [number, number]): [number, number] {
  const mt = 1 - t;
  return [
    2 * mt * (CENTRE[0] - a[0]) + 2 * t * (b[0] - CENTRE[0]),
    2 * mt * (CENTRE[1] - a[1]) + 2 * t * (b[1] - CENTRE[1]),
  ];
}

const SLEEPER_TS = [0.12, 0.32, 0.5, 0.68, 0.88];
const SLEEPER_HALF = 17;

/** Perpendicular sleeper (tie) segments spaced along the track centreline. */
function sleepers(piece: Piece): Array<[number, number, number, number]> {
  const dirs = pieceDirs(piece);
  if (!dirs) return [];
  const a = ANCHOR[dirs[0]];
  const b = ANCHOR[dirs[1]];
  return SLEEPER_TS.map((t) => {
    const [px, py] = bezier(t, a, b);
    const [tx, ty] = tangent(t, a, b);
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    return [
      px + nx * SLEEPER_HALF,
      py + ny * SLEEPER_HALF,
      px - nx * SLEEPER_HALF,
      py - ny * SLEEPER_HALF,
    ];
  });
}

/** A railway glyph: wooden sleepers on a ballast bed beneath two steel rails. */
export function TrackGlyph({ piece }: { piece: Piece }) {
  const d = piecePath(piece);
  if (!d) return null;
  return (
    <svg className="tt-track" viewBox="0 0 100 100" aria-hidden="true">
      <path className="tt-track__bed" d={d} />
      {sleepers(piece).map(([x1, y1, x2, y2], k) => (
        <line key={k} className="tt-track__sleeper" x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
      <path className="tt-track__rail-outer" d={d} />
      <path className="tt-track__rail-inner" d={d} />
    </svg>
  );
}

export function Board({ puzzle, pieces, crosses, locked, review, onPlace, onDrop }: BoardProps) {
  const { size, rowCounts, colCounts } = puzzle;
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Current fill tallies per row/column for live feedback.
  const rowFilled = new Array(size).fill(0);
  const colFilled = new Array(size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (pieces[idx(r, c, size)] !== EMPTY) {
        rowFilled[r]++;
        colFilled[c]++;
      }
    }
  }

  const gridStyle = {
    gridTemplateColumns: `auto repeat(${size}, 1fr)`,
  } as React.CSSProperties;

  return (
    <div className="tt-board" style={gridStyle}>
      <div className="tt-corner" />
      {Array.from({ length: size }, (_, c) => {
        const state =
          colFilled[c] === colCounts[c] ? 'done' : colFilled[c] > colCounts[c] ? 'over' : '';
        return (
          <div key={`col-${c}`} className={`tt-count tt-count--col ${state}`}>
            {colCounts[c]}
          </div>
        );
      })}

      {Array.from({ length: size }, (_, r) => {
        const rowState =
          rowFilled[r] === rowCounts[r] ? 'done' : rowFilled[r] > rowCounts[r] ? 'over' : '';
        return (
          <div key={`row-${r}`} style={{ display: 'contents' }}>
            <div className={`tt-count tt-count--row ${rowState}`}>{rowCounts[r]}</div>
            {Array.from({ length: size }, (_, c) => {
              const i = idx(r, c, size);
              const piece = pieces[i];
              const isLocked = locked[i];
              const isCross = crosses[i];
              return (
                <button
                  key={i}
                  className={`tt-cell ${isLocked ? 'tt-cell--locked' : ''} ${
                    piece !== EMPTY ? 'tt-cell--track' : ''
                  } ${dragOver === i ? 'tt-cell--dragover' : ''}`}
                  onClick={() => onPlace(r, c)}
                  onDragOver={(ev) => {
                    if (review || isLocked) return;
                    ev.preventDefault();
                    setDragOver(i);
                  }}
                  onDragLeave={() => setDragOver((cur) => (cur === i ? null : cur))}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    setDragOver(null);
                    if (review || isLocked) return;
                    const raw = ev.dataTransfer.getData('text/plain');
                    if (!raw) return;
                    const tool: Tool = raw === 'cross' ? 'cross' : (Number(raw) as Piece);
                    onDrop(r, c, tool);
                  }}
                  disabled={review || isLocked}
                  aria-label={`row ${r + 1} column ${c + 1}`}
                >
                  <TrackGlyph piece={piece} />
                  {isCross && piece === EMPTY && <span className="tt-cross" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
