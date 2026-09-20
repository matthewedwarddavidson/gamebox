// A simplified thumbnail of a Kakuro board for the hub tile: a small grid with
// pastel clue cells (diagonal split carrying sums) and white cells holding a few
// sample digits.
// Pastel periwinkle clue cells, matching the board.
const CLUE_BG = '#ccd3f1';
const CLUE_INK = '#3e4779';
const CLUE_LINE = '#8b96d2';
const CELL = 12;
const SIZE = 4;

// Black clue cells carry an across sum (top-right) and/or a down sum
// (bottom-left). Keyed by row-major index.
const CLUES: Record<number, { right?: number; down?: number }> = {
  1: { down: 16 }, // header for column 1
  2: { down: 17 }, // header for column 2
  3: { down: 13 }, // header for column 3
  4: { right: 6 }, // header for row 1
  8: { right: 24 }, // header for row 2
  12: { right: 16 }, // header for row 3
};

// Sample digits shown in the white cells (row-major index → digit).
const DIGITS: Record<number, number> = {
  5: 2,
  6: 4,
  9: 7,
  10: 8,
  11: 9,
  13: 6,
  14: 5,
  15: 4,
};

export function KakuroPreview() {
  const total = SIZE * CELL;
  const cells = Array.from({ length: SIZE * SIZE }, (_, i) => i);

  return (
    <svg
      className="game-preview"
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label="Kakuro board preview"
    >
      {cells.map((i) => {
        const r = Math.floor(i / SIZE);
        const c = i % SIZE;
        const x = c * CELL;
        const y = r * CELL;
        const isWhite = r > 0 && c > 0;
        if (isWhite) {
          const d = DIGITS[i];
          return (
            <g key={i}>
              <rect x={x} y={y} width={CELL} height={CELL} fill="var(--surface, #fff)" />
              {d !== undefined && (
                <text
                  x={x + CELL / 2}
                  y={y + CELL / 2 + 0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={7}
                  fontWeight={600}
                  fill="var(--text, #222)"
                >
                  {d}
                </text>
              )}
            </g>
          );
        }
        const clue = CLUES[i];
        return (
          <g key={i}>
            <rect x={x} y={y} width={CELL} height={CELL} fill={CLUE_BG} />
            {clue && (
              <line
                x1={x}
                y1={y}
                x2={x + CELL}
                y2={y + CELL}
                stroke={CLUE_LINE}
                strokeWidth={0.75}
              />
            )}
            {clue?.right !== undefined && (
              <text
                x={x + CELL * 0.72}
                y={y + CELL * 0.3}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={5}
                fontWeight={700}
                fill={CLUE_INK}
              >
                {clue.right}
              </text>
            )}
            {clue?.down !== undefined && (
              <text
                x={x + CELL * 0.28}
                y={y + CELL * 0.72}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={5}
                fontWeight={700}
                fill={CLUE_INK}
              >
                {clue.down}
              </text>
            )}
          </g>
        );
      })}

      {/* Grid lines. */}
      {Array.from({ length: SIZE + 1 }, (_, k) => (
        <g key={`g${k}`} stroke="rgba(120, 105, 70, 0.28)" strokeWidth={0.75}>
          <line x1={k * CELL} y1={0} x2={k * CELL} y2={total} />
          <line x1={0} y1={k * CELL} x2={total} y2={k * CELL} />
        </g>
      ))}
    </svg>
  );
}
