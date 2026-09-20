import { useMemo } from 'react';
import { computeRuns, type Puzzle } from '../engine';

interface BoardProps {
  puzzle: Puzzle;
  digits: number[];
  selected: number | null;
  review: boolean;
  onSelect: (index: number) => void;
}

/** A black clue cell: a diagonal split carrying the across (top-right) and/or
 *  down (bottom-left) run sums. */
function ClueCell({ right, down }: { right?: number; down?: number }) {
  const hasClue = right !== undefined || down !== undefined;
  if (!hasClue) return <div className="kk-cell kk-cell--block" aria-hidden="true" />;
  return (
    <div className="kk-cell kk-cell--clue">
      <svg viewBox="0 0 100 100" className="kk-clue" aria-hidden="true">
        <line x1="0" y1="0" x2="100" y2="100" className="kk-clue__slash" />
        {right !== undefined && (
          <text x="72" y="30" className="kk-clue__num kk-clue__num--right">
            {right}
          </text>
        )}
        {down !== undefined && (
          <text x="28" y="76" className="kk-clue__num kk-clue__num--down">
            {down}
          </text>
        )}
      </svg>
    </div>
  );
}

export function Board({ puzzle, digits, selected, review, onSelect }: BoardProps) {
  const { size, cells } = puzzle;

  // Peers: the across and down run cells sharing a run with the selected cell.
  const peers = useMemo(() => {
    const set = new Set<number>();
    if (selected === null) return set;
    for (const run of computeRuns(cells, size)) {
      if (run.cells.includes(selected)) for (const c of run.cells) set.add(c);
    }
    return set;
  }, [cells, size, selected]);

  const gridStyle = {
    gridTemplateColumns: `repeat(${size}, 1fr)`,
  } as React.CSSProperties;

  return (
    <div className="kk-board" style={gridStyle}>
      {cells.map((cell, i) => {
        if (!cell.fill) return <ClueCell key={i} right={cell.right} down={cell.down} />;
        const r = Math.floor(i / size);
        const c = i % size;
        const value = digits[i];
        const isSelected = selected === i;
        const isPeer = !isSelected && peers.has(i);
        return (
          <button
            key={i}
            className={[
              'kk-cell',
              'kk-cell--fill',
              isSelected ? 'kk-cell--selected' : '',
              isPeer ? 'kk-cell--peer' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(i)}
            disabled={review}
            aria-label={`row ${r + 1} column ${c + 1}${value ? `, ${value}` : ', empty'}`}
          >
            {value !== 0 ? value : ''}
          </button>
        );
      })}
    </div>
  );
}
