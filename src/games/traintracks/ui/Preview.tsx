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

type Pt = [number, number];

// Track render proportions (relative to CELL): a ballast bed with two rails.
const BED_W = CELL * 0.42;
const RAIL_OUTER_W = CELL * 0.3;
const RAIL_INNER_W = CELL * 0.15;

export function TrainTracksPreview() {
  const grid = SIZE * CELL;
  const pad = CELL; // room for the count strips
  const total = grid + pad;

  // Cell centres are the curve control points; the on-curve points are the
  // shared cell edges (and the two border stubs), giving smooth rounded corners.
  const centres: Pt[] = PATH.map(([r, c]) => centre(r, c, pad));
  const [c0x, c0y] = centres[0];
  const [cnx, cny] = centres[centres.length - 1];

  const onCurve: Pt[] = [];
  onCurve.push([c0x + (ENTRY_STUB[1] * CELL) / 2, c0y + (ENTRY_STUB[0] * CELL) / 2]);
  for (let i = 0; i < centres.length - 1; i++) {
    onCurve.push([(centres[i][0] + centres[i + 1][0]) / 2, (centres[i][1] + centres[i + 1][1]) / 2]);
  }
  onCurve.push([cnx + (EXIT_STUB[1] * CELL) / 2, cny + (EXIT_STUB[0] * CELL) / 2]);

  let d = `M ${onCurve[0][0]} ${onCurve[0][1]}`;
  for (let i = 0; i < centres.length; i++) {
    d += ` Q ${centres[i][0]} ${centres[i][1]} ${onCurve[i + 1][0]} ${onCurve[i + 1][1]}`;
  }

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

      {/* The railway: a ballast bed with two steel rails. */}
      <path
        d={d}
        fill="none"
        stroke="var(--tt-ballast, #d8c0a0)"
        strokeWidth={BED_W}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke="var(--tt-rail, #4a3826)"
        strokeWidth={RAIL_OUTER_W}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke="var(--tt-ballast, #d8c0a0)"
        strokeWidth={RAIL_INNER_W}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
