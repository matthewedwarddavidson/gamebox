interface NumberPadProps {
  onDigit: (digit: number) => void;
  onErase: () => void;
  pencil: boolean;
  disabled: boolean;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function NumberPad({ onDigit, onErase, pencil, disabled }: NumberPadProps) {
  return (
    <div className={`kk-pad${pencil ? ' kk-pad--pencil' : ''}`}>
      {DIGITS.map((d) => (
        <button
          key={d}
          className="kk-pad__key"
          onClick={() => onDigit(d)}
          disabled={disabled}
          aria-label={`${pencil ? 'Pencil in' : 'Enter'} ${d}`}
        >
          {d}
        </button>
      ))}
      <button
        className="kk-pad__key kk-pad__key--erase"
        onClick={onErase}
        disabled={disabled}
        aria-label="Erase"
      >
        ⌫
      </button>
    </div>
  );
}
