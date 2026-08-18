import { useState } from 'react';
import { Star } from 'lucide-react';
import './RatingStars.css';

export default function RatingStars({
  value = 0,
  count,
  interactive = false,
  size = 16,
  onRate,
}) {
  const [hover, setHover] = useState(0);
  const display = hover || Math.round(value);

  return (
    <span className={`rating-stars ${interactive ? 'is-interactive' : ''}`}>
      <span
        className="rating-stars-icons"
        onMouseLeave={() => interactive && setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="rating-star-btn"
            disabled={!interactive}
            aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
            onMouseEnter={() => interactive && setHover(n)}
            onClick={() => interactive && onRate?.(n)}
          >
            <Star
              size={size}
              fill={n <= display ? '#dd9a2b' : 'none'}
              color={n <= display ? '#dd9a2b' : '#c7d2dc'}
              strokeWidth={1.8}
            />
          </button>
        ))}
      </span>
      <span className="rating-value">{value?.toFixed ? value.toFixed(1) : value}</span>
      {typeof count === 'number' && <span className="rating-count">({count})</span>}
    </span>
  );
}
