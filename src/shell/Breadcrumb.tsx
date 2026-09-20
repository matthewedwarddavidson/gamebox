import type { Crumb } from './breadcrumbStore';

/** The shell's top bar: the "Gamebox" root crumb followed by the given trail. */
export function Breadcrumb({ trail, onHome }: { trail: Crumb[]; onHome: () => void }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <button className="breadcrumb__crumb" onClick={onHome}>
        Gamebox
      </button>
      {trail.map((crumb, i) => (
        <span className="breadcrumb__group" key={i}>
          <span className="breadcrumb__sep" aria-hidden="true">
            ›
          </span>
          {crumb.onClick ? (
            <button className="breadcrumb__crumb" onClick={crumb.onClick}>
              {crumb.label}
            </button>
          ) : (
            <span className="breadcrumb__crumb breadcrumb__crumb--current" aria-current="page">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
