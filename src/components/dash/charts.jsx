'use client';

// Small hand-rolled SVG/HTML charts. Colour is never the only encoding:
// every mark has a text label or value and every multi-series chart a legend.

export function Kpi({ label, value, hint, tone }) {
  return (
    <div className={`kpi ${tone ? `kpi-${tone}` : ''}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

export function ColumnChart({ data, unit = '', height = 150, color = 'var(--color-primary)' }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  return (
    <figure className="chart" aria-label="Column chart">
      <svg viewBox={`0 0 100 ${height / 2}`} preserveAspectRatio="none" style={{ height, width: '100%' }} role="img">
        <line x1="0" x2="100" y1={height / 2 - 0.5} y2={height / 2 - 0.5} stroke="var(--color-border)" strokeWidth="0.4" />
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 2 - 8);
          return (
            <g key={d.label}>
              <title>{`${d.label}: ${d.value}${unit}`}</title>
              <rect x={i * w + w * 0.2} y={height / 2 - 0.5 - h} width={w * 0.6} height={h} rx="1" fill={d.highlight ? 'var(--color-accent)' : color} />
            </g>
          );
        })}
      </svg>
      <div className="chart-axis" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
        {data.map((d) => (
          <span key={d.label}><b>{d.value}{unit}</b>{d.label}</span>
        ))}
      </div>
    </figure>
  );
}

export function BarList({ data, unit = '', max }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="barlist">
      {data.map((d) => (
        <li key={d.label}>
          <span className="barlist-label">{d.label}</span>
          <span className="barlist-track">
            <span className="barlist-fill" style={{ width: `${Math.min(100, (d.value / top) * 100)}%`, background: d.color ?? 'var(--color-primary)' }} />
          </span>
          <span className="barlist-value">{d.value}{unit}</span>
        </li>
      ))}
    </ul>
  );
}

// Part-to-whole bar with a legend carrying counts.
export function StackBar({ segments }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div>
      <div className="stackbar" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <span key={s.label} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <ul className="legend">
        {segments.map((s) => (
          <li key={s.label}><i style={{ background: s.color }} />{s.label} <b>{s.value}</b></li>
        ))}
      </ul>
    </div>
  );
}

export function FillMeter({ pct: rawPct }) {
  const pct = Math.min(100, rawPct);
  const tone = pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'ok';
  return (
    <div className="fill" title={`${pct}% full`}>
      <span className="fill-track"><span className={`fill-bar fill-${tone}`} style={{ width: `${Math.min(100, pct)}%` }} /></span>
      <b>{pct}%</b>
      <em>{tone === 'danger' ? 'Critical' : tone === 'warning' ? 'Nearly full' : 'OK'}</em>
    </div>
  );
}
