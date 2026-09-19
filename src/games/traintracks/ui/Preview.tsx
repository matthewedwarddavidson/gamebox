// A simplified thumbnail of a Train Tracks board for the hub tile: a small grid
// with a single winding track between two border stubs, plus row/column count
// strips.
const CELL = 11;
const SIZE = 5;

// A fixed 5×5 winding path (row-major cell indices) from the top edge of column
// 1 down and around to the right edge of row 3.
const PATH: [number, number][] = [
  [0, 1],
  [1, 1],
  [1, 2],
  [2, 2],
  [2, 3],
  [3, 3],
  [3, 4],
];

const ROW_COUNTS = [1, 2, 2, 2, 0];
const COL_COUNTS = [0, 2, 2, 2, 1];

// Off-board stub directions for the two endpoints (N=up, E=right).
const ENTRY_STUB: [number, number] = [-1, 0]; // up from (0,1)
const EXIT_STUB: [number, number] = [0, 1]; // right from (3,4)

/** Centre point of a cell in SVG coordinates. */
function centre(r: number, c: number, pad: number): [number, number] {
  return [pad + c * CELL + CELL / 2, pad + r * CELL + CELL / 2];
}

export function TrainTracksPreview() {
  const grid = SIZE * CELL;
  const pad = CELL; // room for the count strips
  const total = grid + pad;

  // Build the track polyline through cell centres, extended by the two stubs.
  const pts: [number, number][] = PATH.map(([r, c]) => centre(r, c, pad));
  const [er, ec] = PATH[0];
  const [xr, xc] = PATH[PATH.length - 1];
  const entry: [number, number] = [
    pad + ec * CELL + CELL / 2 + (ENTRY_STUB[1] * CELL) / 2,
    pad + er * CELL + CELL / 2 + (ENTRY_STUB[0] * CELL) / 2,
  ];
  const exit: [number, number] = [
    pad + xc * CELL + CELL / 2 + (EXIT_STUB[1] * CELL) / 2,
    pad + xr * CELL + CELL / 2 + (EXIT_STUB[0] * CELL) / 2,
  ];
  const all: [number, number][] = [entry, ...pts, exit];
  const d = all.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');

  return (
    <svg
      className="game-preview"
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label="Train Tracks board preview"
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

      {/* The track: a wide bed with a thin centre rail. */}
      <path
        d={d}
        fill="none"
        stroke="var(--tt-bed, #b98a5a)"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke="var(--tt-rail, #6b4a2a)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
