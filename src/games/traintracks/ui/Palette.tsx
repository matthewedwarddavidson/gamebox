import { PIECES, type Piece } from '../engine';
import type { Tool } from '../store/gameStore';
import { TrackGlyph } from './Board';

interface PaletteProps {
  tool: Tool;
  onSelect: (tool: Tool) => void;
}

/** Serialise a tool for drag-and-drop transfer. */
function toolData(tool: Tool): string {
  return tool === 'cross' ? 'cross' : String(tool);
}

/**
 * The piece palette: pick one of the six track pieces or the empty (cross) mark,
 * then tap a cell to place it. Tiles can also be dragged onto the board.
 */
export function Palette({ tool, onSelect }: PaletteProps) {
  return (
    <div className="tt-palette" role="radiogroup" aria-label="Track piece">
      {PIECES.map((p: Piece) => (
        <button
          key={p}
          type="button"
          className={`tt-palette__tile ${tool === p ? 'tt-palette__tile--active' : ''}`}
          role="radio"
          aria-checked={tool === p}
          aria-label={`Track piece ${p}`}
          draggable
          onDragStart={(ev) => ev.dataTransfer.setData('text/plain', toolData(p))}
          onClick={() => onSelect(p)}
        >
          <TrackGlyph piece={p} />
        </button>
      ))}
      <button
        type="button"
        className={`tt-palette__tile tt-palette__tile--cross ${
          tool === 'cross' ? 'tt-palette__tile--active' : ''
        }`}
        role="radio"
        aria-checked={tool === 'cross'}
        aria-label="Mark empty"
        draggable
        onDragStart={(ev) => ev.dataTransfer.setData('text/plain', toolData('cross'))}
        onClick={() => onSelect('cross')}
      >
        <span className="tt-cross" aria-hidden="true" />
      </button>
    </div>
  );
}
