'use client';

import { Coins, Users, Sparkles, ShieldCheck, Tag, Droplets } from 'lucide-react';
import { formatFee, formatAgo, QUEUE_LABEL, QUALITY_LABEL } from '../utils/enrich.js';
import './FacilityInfo.css';

// Real-time information strip (A.2): price, queue, last cleaned, water quality.
export default function FacilityInfo({ facility, compact = false }) {
  const fee = formatFee(facility.fee, facility.country);
  const items = [];
  if (fee) items.push({ key: 'fee', icon: Coins, text: fee });
  if (facility.queue) items.push({ key: 'queue', icon: Users, text: QUEUE_LABEL[facility.queue], tone: facility.queue === 'long' ? 'warn' : '' });
  if (facility.lastCleanedMins != null) items.push({ key: 'clean', icon: Sparkles, text: `Cleaned ${formatAgo(facility.lastCleanedMins)}`, tone: facility.lastCleanedMins > 360 ? 'warn' : '' });
  if (facility.waterQuality) items.push({ key: 'wq', icon: Droplets, text: QUALITY_LABEL[facility.waterQuality], tone: facility.waterQuality === 'untested' || facility.waterQuality === 'unsafe' ? 'warn' : '' });
  if (facility.licensed === false) items.push({ key: 'lic', icon: ShieldCheck, text: 'Unlicensed', tone: 'warn' });
  if (facility.discount) items.push({ key: 'disc', icon: Tag, text: facility.discount.label, tone: 'good' });

  if (!items.length) return null;
  return (
    <div className="fi">
      <ul className="fi-list">
        {items.map(({ key, icon: Icon, text, tone }) => (
          <li key={key} className={`fi-item ${tone ? `fi-${tone}` : ''}`}>
            <Icon size={12} /> {text}
          </li>
        ))}
      </ul>
      {!compact && facility.amenities?.length > 0 && (
        <p className="fi-amenities">{facility.amenities.join(' · ')}</p>
      )}
    </div>
  );
}
