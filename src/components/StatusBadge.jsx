import { STATUS } from '../data/facilities.js';
import './StatusBadge.css';

export default function StatusBadge({ status, size = 'md' }) {
  const meta = STATUS[status] ?? { label: status, tone: 'muted' };

  return (
    <span className={`status-badge status-${meta.tone} status-${size}`}>
      <span className="status-dot" />
      {meta.label}
    </span>
  );
}
