// A simplified thumbnail of a Shikaku board for the hub tile: a small grid
// partitioned into a few coloured rectangles, each labelled with its area.
const CELL = 12;
const COLS = 6;
const ROWS = 4;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

// A fixed, tidy partition of the 6×4 grid (areas: 6, 4, 4, 4, 2, 4).
const RECTS: Rect[] = [
  { x: 0, y: 0, w: 3, h: 2, fill: '#f2b8c6' },
  { x: 3, y: 0, w: 2, h: 2, fill: '#a7d3f0' },
  { x: 5, y: 0, w: 1, h: 4, fill: '#c9e3a8' },
  { x: 0, y: 2, w: 2, h: 2, fill: '#f6d69a' },
  { x: 2, y: 2, w: 1, h: 2, fill: '#c8bde8' },
  { x: 3, y: 2, w: 2, h: 2, fill: '#9fe0d0' },
];

export function ShikakuPreview() {
  const w = COLS * CELL;
  const h = ROWS * CELL;
  return (
    <svg
      className="game-preview"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Shikaku board preview"
    >
      <rect x={0} y={0} width={w} height={h} rx={3} fill="var(--surface, #fff)" />
      {RECTS.map((r, i) => {
        const px = r.x * CELL;
        const py = r.y * CELL;
        const pw = r.w * CELL;
        const ph = r.h * CELL;
        return (
          <g key={i}>
            <rect
              x={px + 0.75}
              y={py + 0.75}
              width={pw - 1.5}
              height={ph - 1.5}
              rx={2}
              fill={r.fill}
              stroke="rgba(0,0,0,0.28)"
              strokeWidth={1}
            />
            <text
              x={px + pw / 2}
              y={py + ph / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={8}
              fontWeight={700}
              fill="rgba(0,0,0,0.7)"
            >
              {r.w * r.h}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
