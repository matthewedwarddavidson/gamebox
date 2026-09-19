import { idx, isShip, type CellType, type Mark, type Puzzle } from '../engine';
import { colorForLength } from './colors';

interface BoardProps {
  puzzle: Puzzle;
  marks: Mark[];
  hintLocked: boolean[];
  review: boolean;
  onCycle: (row: number, col: number) => void;
}

/** Visual class for a ship segment shape (rounds the appropriate corners). */
function shipShapeClass(type: CellType): string {
  return `cell__ship cell__ship--${type === 'water' ? 'middle' : type}`;
}

/**
 * Derive a player ship cell's shape from its neighbouring ship marks so that
 * ends curve and middles stay square — matching the revealed hint shapes.
 */
function shipTypeFromMarks(marks: Mark[], r: number, c: number, size: number): CellType {
  const isS = (rr: number, cc: number) =>
    rr >= 0 && cc >= 0 && rr < size && cc < size && marks[idx(rr, cc, size)] === 'ship';
  const up = isS(r - 1, c);
  const down = isS(r + 1, c);
  const left = isS(r, c - 1);
  const right = isS(r, c + 1);

  if (!up && !down && !left && !right) return 'single';
  if (left || right) {
    if (left && right) return 'middle';
    return right ? 'left' : 'right';
  }
  if (up && down) return 'middle';
  return down ? 'top' : 'bottom';
}

/** Length of the straight ship run through a cell, per a ship-cell predicate. */
function shipRunLength(
  isShipAt: (r: number, c: number) => boolean,
  r: number,
  c: number,
  size: number,
): number {
  const inb = (rr: number, cc: number) => rr >= 0 && cc >= 0 && rr < size && cc < size;
  const run = (dr: number, dc: number) => {
    let n = 0;
    let rr = r + dr;
    let cc = c + dc;
    while (inb(rr, cc) && isShipAt(rr, cc)) {
      n++;
      rr += dr;
      cc += dc;
    }
    return n;
  };
  const horiz = 1 + run(0, -1) + run(0, 1);
  const vert = 1 + run(-1, 0) + run(1, 0);
  return Math.max(horiz, vert);
}

export function Board({ puzzle, marks, hintLocked, review, onCycle }: BoardProps) {
  const { size, rowCounts, colCounts, solution } = puzzle;

  // Current ship-mark tallies per row/column for live feedback.
  const rowFilled = new Array(size).fill(0);
  const colFilled = new Array(size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (marks[idx(r, c, size)] === 'ship') {
        rowFilled[r]++;
        colFilled[c]++;
      }
    }
  }

  const gridStyle = {
    gridTemplateColumns: `auto repeat(${size}, 1fr)`,
  } as React.CSSProperties;

  return (
    <div className="bs-board" style={gridStyle}>
      <div className="bs-corner" />
      {Array.from({ length: size }, (_, c) => {
        const state =
          colFilled[c] === colCounts[c] ? 'done' : colFilled[c] > colCounts[c] ? 'over' : '';
        return (
          <div key={`col-${c}`} className={`bs-count bs-count--col ${state}`}>
            {colCounts[c]}
          </div>
        );
      })}

      {Array.from({ length: size }, (_, r) => {
        const rowState =
          rowFilled[r] === rowCounts[r] ? 'done' : rowFilled[r] > rowCounts[r] ? 'over' : '';
        return (
          <div key={`row-${r}`} style={{ display: 'contents' }}>
            <div className={`bs-count bs-count--row ${rowState}`}>{rowCounts[r]}</div>
            {Array.from({ length: size }, (_, c) => {
              const i = idx(r, c, size);
              const mark = marks[i];
              const locked = hintLocked[i];
              const solType = solution[i];
              const showShip = review ? isShip(solType) : mark === 'ship';
              const showWater = review ? !isShip(solType) : mark === 'water';
              const typeForShape: CellType =
                review || locked ? solType : shipTypeFromMarks(marks, r, c, size);

              const shipLen = showShip
                ? shipRunLength(
                    (rr, cc) =>
                      review ? isShip(solution[idx(rr, cc, size)]) : marks[idx(rr, cc, size)] === 'ship',
                    r,
                    c,
                    size,
                  )
                : 0;
              const shipColor = shipLen > 0 ? colorForLength(shipLen) : null;

              return (
                <button
                  key={i}
                  className={`bs-cell ${locked ? 'bs-cell--locked' : ''} ${
                    showWater ? 'bs-cell--water' : ''
                  }`}
                  onClick={() => onCycle(r, c)}
                  disabled={review || locked}
                  aria-label={`row ${r + 1} column ${c + 1}: ${mark}`}
                >
                  {showShip && shipColor && (
                    <span
                      className={shipShapeClass(typeForShape)}
                      style={{ background: shipColor.fill, borderColor: shipColor.stroke }}
                    />
                  )}
                  {showWater && <span className="cell__water" />}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
