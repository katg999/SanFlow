import { STATUS } from '../data/facilities.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import './StatusBadge.css';

export default function StatusBadge({ status, size = 'md' }) {
  const { t } = useLanguage();
  const meta = STATUS[status] ?? { label: status, tone: 'muted' };
  const label = STATUS[status] ? t(`status.${status}`) : meta.label;

  return (
    <span className={`status-badge status-${meta.tone} status-${size}`}>
      <span className="status-dot" />
      {label}
    </span>
  );
}
