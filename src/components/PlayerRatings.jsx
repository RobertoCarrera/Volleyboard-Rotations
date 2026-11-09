import React from 'react';
import { PLAYER_POSITIONS } from '../data/playerRatings';

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
  return (
    <fieldset className="wb-ratings-editor">
      <legend>Posiciones y valoración</legend>
      <p>Asigna las posiciones que juega y valora su nivel de 0 a 5.</p>
      <div className="wb-rating-legend" aria-label="Escala de valoración">
        {[0, 1, 2, 3, 4, 5].map((value) => <RatingBadge key={value} value={value} />)}
        <span>De menor a mayor dominio</span>
      </div>
      <div className="wb-ratings-grid">
        {PLAYER_POSITIONS.map(({ key, label }) => (
          <label className="wb-rating-field" key={key}>
            <span>{label}</span>
            <select aria-label={`Valoración en ${label}`} value={ratings[key] ?? ''}
              onChange={(event) => onChange({ ...ratings, [key]: event.target.value === '' ? null : Number(event.target.value) })}>
              <option value="">Sin asignar</option>
              {[0, 1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}/5</option>)}
            </select>
            <RatingBadge value={ratings[key]} label={label} compact />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
