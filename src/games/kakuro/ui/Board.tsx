import { useMemo } from 'react';
import { computeRuns, type Puzzle } from '../engine';
import { noteDigits } from '../store/notes';

interface BoardProps {
  puzzle: Puzzle;
  digits: number[];
  notes: number[];
  selected: number | null;
  review: boolean;
  onSelect: (index: number) => void;
}

/** A black clue cell: a diagonal split carrying the across (top-right) and/or
 *  down (bottom-left) run sums. */
function ClueCell({
  right,
  down,
  rightMet,
  downMet,
}: {
  right?: number;
  down?: number;
  rightMet: boolean;
  downMet: boolean;
}) {
  const hasClue = right !== undefined || down !== undefined;
  if (!hasClue) return <div className="kk-cell kk-cell--block" aria-hidden="true" />;
  return (
    <div className="kk-cell kk-cell--clue">
      <svg viewBox="0 0 100 100" className="kk-clue" aria-hidden="true">
        <line x1="0" y1="0" x2="100" y2="100" className="kk-clue__slash" />
        {right !== undefined && (
          <text x="73" y="38" className={`kk-clue__num${rightMet ? ' kk-clue__num--met' : ''}`}>
            {right}
          </text>
        )}
        {down !== undefined && (
          <text x="27" y="86" className={`kk-clue__num${downMet ? ' kk-clue__num--met' : ''}`}>
            {down}
          </text>
        )}
      </svg>
    </div>
  );
}

export function Board({ puzzle, digits, notes, selected, review, onSelect }: BoardProps) {
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

  // A run's clue is met once every cell is filled, the digits are distinct and
  // they add up to the target. Keyed by clue cell index and direction.
  const met = useMemo(() => {
    const done = new Set<string>();
    for (const run of computeRuns(cells, size)) {
      const values = run.cells.map((ci) => digits[ci]);
      if (values.some((v) => v === 0) || new Set(values).size !== values.length) continue;
      const owner = cells[run.clueIndex];
      const target = run.dir === 'right' ? owner.right : owner.down;
      if (values.reduce((a, b) => a + b, 0) === target) done.add(`${run.clueIndex}-${run.dir}`);
    }
    return done;
  }, [cells, size, digits]);

  const gridStyle = {
    gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
  } as React.CSSProperties;

  return (
    <div className="kk-board" style={gridStyle}>
      {cells.map((cell, i) => {
        if (!cell.fill) return (
            <ClueCell
              key={i}
              right={cell.right}
              down={cell.down}
              rightMet={met.has(`${i}-right`)}
              downMet={met.has(`${i}-down`)}
            />
          );
        const r = Math.floor(i / size);
        const c = i % size;
        const value = digits[i];
        const pencilled = value === 0 ? noteDigits(notes[i] ?? 0) : [];
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
            aria-label={`row ${r + 1} column ${c + 1}${
              value ? `, ${value}` : pencilled.length ? `, notes ${pencilled.join(' ')}` : ', empty'
            }`}
          >
            {value !== 0 ? (
              value
            ) : pencilled.length > 0 ? (
              <span className="kk-notes" aria-hidden="true">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <span key={d}>{pencilled.includes(d) ? d : ''}</span>
                ))}
              </span>
            ) : (
              ''
            )}
          </button>
        );
      })}
    </div>
  );
}
