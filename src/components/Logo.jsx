export default function Logo({ size = 36, mark = 'color', showWordmark = true, className = '' }) {
  const stroke = mark === 'light' ? '#ffffff' : '#1b3a5c';

  return (
    <span className={`logo ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path
          d="M32 8c9.5 11.5 15 19 15 26.5A15 15 0 1 1 17 34.5C17 27 22.5 19.5 32 8Z"
          stroke={stroke}
          strokeWidth="3.4"
          strokeLinejoin="round"
        />
        <path d="M39 30a7 7 0 0 1-7 7" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" />
        <path
          d="M17 39c3 3.4 6.6 5.4 10.5 5.4 4.6 0 8-2.2 11-5.4l6.2-6.6a3.6 3.6 0 0 1 5.2 4.9l-7 7.6c-4 4.3-9.2 7.4-15.4 7.4"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="21" cy="47" r="7.4" fill={mark === 'light' ? '#ffffff' : '#1b3a5c'} />
        <path
          d="M21 43.6v6.8M17.6 47h6.8"
          stroke={mark === 'light' ? '#1b3a5c' : '#ffffff'}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {showWordmark && (
        <span className="logo-wordmark" style={{ color: mark === 'light' ? '#ffffff' : 'var(--color-primary-dark)' }}>
          <strong>SanFlow</strong> Health WASHLink
        </span>
      )}
    </span>
  );
}
