import React, { useId } from 'react';
import { PLAYER_POSITIONS } from '../data/playerRatings';

const SCORES = [0, 1, 2, 3, 4, 5];
const RATING_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']);

export function RatingBadge({ value, label, compact = false }) {
  const rated = Number.isInteger(value) && value >= 0 && value <= 5;
  return (
    <span className={`wb-rating ${rated ? `wb-rating-${value}` : 'wb-rating-none'}`}
      data-score={rated ? value : undefined}
      aria-label={label ? `${label}: ${rated ? `${value} de 5` : 'sin asignar'}` : undefined}>
      {label && !compact && <span>{label}</span>}
      <b>{rated ? `${value}/5` : 'Sin asignar'}</b>
    </span>
  );
}

export function RatingSummary({ ratings }) {
  const assigned = PLAYER_POSITIONS.filter(({ key }) => ratings?.[key] != null);
  return (
    <div className="wb-rating-summary">
      {assigned.length ? assigned.map(({ key, short }) => <RatingBadge key={key} value={ratings[key]} label={short} />)
        : <span className="wb-muted">Sin posiciones asignadas</span>}
    </div>
  );
}

export default function PlayerRatings({ ratings, onChange }) {
  const id = useId();
  const setScore = (key, value, control) => {
    // Native disabled fieldsets also cover the extra pointer/keyboard handlers.
    if (control?.matches?.(':disabled')) return;
    const score = value === null ? null : Number(value);
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 5)) return;
    if (ratings[key] !== score) onChange({ ...ratings, [key]: score });
  };

  return (
    <fieldset className="wb-ratings-editor">
      <legend>Posiciones y valoración</legend>
      <p>Pulsa en la barra o en una nota para valorar cada posición.</p>
      <div className="wb-ratings-grid">
        {PLAYER_POSITIONS.map(({ key, label }) => {
          const value = ratings[key];
          const rated = Number.isInteger(value) && value >= 0 && value <= 5;
          const controlId = `${id}-${key}`;
          return (
            <div className={`wb-rating-field ${rated ? `wb-rating-${value}` : 'is-unrated'}`} key={key}>
              <label className="wb-rating-position" htmlFor={controlId}>
                <span className="wb-position-code" aria-hidden="true">{key}</span>
                <span>{label}</span>
              </label>
              <div className="wb-rating-control">
                <div className="wb-rating-track">
                  <input id={controlId} className="wb-rating-range" type="range" min="0" max="5" step="1"
                    aria-label={`Valoración en ${label}`} aria-describedby={`${controlId}-guide`}
                    aria-valuetext={rated ? `${value} de 5` : 'Sin asignar'} value={rated ? value : 0}
                    onChange={(event) => setScore(key, event.target.value, event.currentTarget)}
                    onPointerUp={(event) => {
                      if (event.button === 0) setScore(key, event.currentTarget.value, event.currentTarget);
                    }}
                    onKeyUp={(event) => {
                      if (RATING_KEYS.has(event.key)) setScore(key, event.currentTarget.value, event.currentTarget);
                    }} />
                </div>
                <div className="wb-rating-stops">
                  {SCORES.map((score) => (
                    <button type="button" key={score} tabIndex={-1} style={{ '--stop': `${score * 20}%` }}
                      aria-label={`${score} de 5 en ${label}`} aria-pressed={rated && value === score}
                      onClick={(event) => setScore(key, score, event.currentTarget)}>{score}</button>
                  ))}
                </div>
                <div className="wb-rating-guide" id={`${controlId}-guide`}>
                  <span>Menor dominio</span><span>Mayor dominio</span>
                </div>
              </div>
              <div className="wb-rating-result">
                <RatingBadge value={value} label={label} compact />
                <button className="wb-rating-clear" type="button" disabled={!rated}
                  aria-label={`Quitar valoración de ${label}`} title="Dejar sin asignar"
                  onClick={(event) => {
                    setScore(key, null, event.currentTarget);
                    event.currentTarget.ownerDocument?.getElementById(controlId)?.focus();
                  }}>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
