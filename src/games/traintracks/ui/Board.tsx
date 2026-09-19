import { E, EMPTY, N, S, W, idx, type Piece, type Puzzle } from '../engine';

interface BoardProps {
  puzzle: Puzzle;
  pieces: Piece[];
  locked: boolean[];
  review: boolean;
  onCycle: (row: number, col: number, reverse?: boolean) => void;
}

// Edge-midpoint anchor points within a 0..100 cell for each connected side.
const ANCHOR: Record<number, [number, number]> = {
  [N]: [50, 2],
  [E]: [98, 50],
  [S]: [50, 98],
  [W]: [2, 50],
};

/** SVG path for a track piece: a smooth quadratic through the cell centre. */
function piecePath(piece: Piece): string | null {
  if (piece === EMPTY) return null;
  const dirs: number[] = [];
  for (const d of [N, E, S, W]) if ((piece & d) !== 0) dirs.push(d);
  if (dirs.length !== 2) return null;
  const [a, b] = dirs;
  const [ax, ay] = ANCHOR[a];
  const [bx, by] = ANCHOR[b];
  return `M ${ax} ${ay} Q 50 50 ${bx} ${by}`;
}

/** Perpendicular sleeper ticks approximated by short marks near each anchor. */
function TrackGlyph({ piece }: { piece: Piece }) {
  const d = piecePath(piece);
  if (!d) return null;
  return (
    <svg className="tt-track" viewBox="0 0 100 100" aria-hidden="true">
      <path className="tt-track__bed" d={d} />
      <path className="tt-track__rail" d={d} />
    </svg>
  );
}

export function Board({ puzzle, pieces, locked, review, onCycle }: BoardProps) {
  const { size, rowCounts, colCounts } = puzzle;

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
              return (
                <button
                  key={i}
                  className={`tt-cell ${isLocked ? 'tt-cell--locked' : ''} ${
                    piece !== EMPTY ? 'tt-cell--track' : ''
                  }`}
                  onClick={() => onCycle(r, c, false)}
                  onContextMenu={(ev) => {
                    ev.preventDefault();
                    onCycle(r, c, true);
                  }}
                  disabled={review || isLocked}
                  aria-label={`row ${r + 1} column ${c + 1}`}
                >
                  <TrackGlyph piece={piece} />
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
