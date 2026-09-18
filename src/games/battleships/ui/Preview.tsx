// A simplified thumbnail of a Battleships board for the hub tile: a small grid
// with a few ships (drawn as rounded capsules) and water dots, plus row/column
// count strips.
const CELL = 11;
const SIZE = 5;

interface Ship {
  r: number;
  c: number;
  len: number;
  horizontal: boolean;
}

// A fixed 5×5 scene: a 1×1 sub, a horizontal 3-ship and a vertical 2-ship.
const SHIPS: Ship[] = [
  { r: 0, c: 1, len: 3, horizontal: true },
  { r: 1, c: 4, len: 2, horizontal: false },
  { r: 2, c: 0, len: 1, horizontal: true },
];

const ROW_COUNTS = [3, 1, 2, 0, 0];
const COL_COUNTS = [1, 1, 1, 1, 2];

/** Cells covered by a ship, as a set of "r,c" keys. */
function shipCells(ships: Ship[]): Set<string> {
  const set = new Set<string>();
  for (const s of ships) {
    for (let k = 0; k < s.len; k++) {
      const r = s.horizontal ? s.r : s.r + k;
      const c = s.horizontal ? s.c + k : s.c;
      set.add(`${r},${c}`);
    }
  }
  return set;
}

export function BattleshipsPreview() {
  const grid = SIZE * CELL;
  const pad = CELL; // room for the count strips
  const total = grid + pad;
  const ships = shipCells(SHIPS);

  return (
    <svg
      className="game-preview"
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label="Battleships board preview"
    >
      {/* Column counts along the top. */}
      {COL_COUNTS.map((n, c) => (
        <text
          key={`c${c}`}
          x={pad + c * CELL + CELL / 2}
          y={pad / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={7}
          fontWeight={700}
          fill="var(--muted, #888)"
        >
          {n}
        </text>
      ))}
      {/* Row counts down the left. */}
      {ROW_COUNTS.map((n, r) => (
        <text
          key={`r${r}`}
          x={pad / 2}
          y={pad + r * CELL + CELL / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={7}
          fontWeight={700}
          fill="var(--muted, #888)"
        >
          {n}
        </text>
      ))}

      <rect x={pad} y={pad} width={grid} height={grid} rx={3} fill="var(--surface, #fff)" />

      {/* Grid lines. */}
      {Array.from({ length: SIZE + 1 }, (_, k) => (
        <g key={`g${k}`} stroke="rgba(0,0,0,0.15)" strokeWidth={0.75}>
          <line x1={pad + k * CELL} y1={pad} x2={pad + k * CELL} y2={pad + grid} />
          <line x1={pad} y1={pad + k * CELL} x2={pad + grid} y2={pad + k * CELL} />
        </g>
      ))}

      {/* Water dots on empty cells. */}
      {Array.from({ length: SIZE * SIZE }, (_, i) => {
        const r = Math.floor(i / SIZE);
        const c = i % SIZE;
        if (ships.has(`${r},${c}`)) return null;
        return (
          <circle
            key={`w${i}`}
            cx={pad + c * CELL + CELL / 2}
            cy={pad + r * CELL + CELL / 2}
            r={1.3}
            fill="var(--muted, #9aa)"
          />
        );
      })}

      {/* Ships as rounded capsules. */}
      {SHIPS.map((s, i) => {
        const w = (s.horizontal ? s.len : 1) * CELL;
        const h = (s.horizontal ? 1 : s.len) * CELL;
        return (
          <rect
            key={`s${i}`}
            x={pad + s.c * CELL + 1.5}
            y={pad + s.r * CELL + 1.5}
            width={w - 3}
            height={h - 3}
            rx={(Math.min(w, h) - 3) / 2}
            fill="var(--text, #333)"
          />
        );
      })}
    </svg>
  );
}
