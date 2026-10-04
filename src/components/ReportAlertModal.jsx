'use client';

import { useState } from 'react';
import { X, TriangleAlert } from 'lucide-react';
import './ReportAlertModal.css';

const OPTIONS_BY_CATEGORY = {
  toilet: [
    { value: 'filling', label: 'Filling up' },
    { value: 'full', label: 'Full / unusable' },
    { value: 'broken', label: 'Broken / damaged' },
  ],
  waste: [
    { value: 'filling', label: 'Filling up' },
    { value: 'full', label: 'Overflowing' },
  ],
  water: [
    { value: 'broken', label: 'Broken / not working' },
  ],
  health: [
    { value: 'closed', label: 'Closed / unstaffed' },
  ],
};

export default function ReportAlertModal({ facility, onClose, onSubmit }) {
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!facility) return null;

  const options = OPTIONS_BY_CATEGORY[facility.category] ?? OPTIONS_BY_CATEGORY.toilet;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!status) return;
    onSubmit(facility.id, status, note);
    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 1100);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {submitted ? (
          <div className="modal-success">
            <TriangleAlert size={28} />
            <h3>Alert sent</h3>
            <p>
              Thanks — {facility.name} has been flagged. If this stays open past 24 hours it
              auto-escalates to the County Health Officer.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <span className="eyebrow modal-eyebrow">
              <TriangleAlert size={13} /> Report an issue
            </span>
            <h3>{facility.name}</h3>
            <p className="modal-subtitle">{facility.area}</p>

            <div className="modal-options">
              {options.map((opt) => (
                <label
                  key={opt.value}
                  className={`modal-option ${status === opt.value ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={opt.value}
                    checked={status === opt.value}
                    onChange={() => setStatus(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <label className="modal-note-label" htmlFor="report-note">
              Additional details (optional)
            </label>
            <textarea
              id="report-note"
              className="modal-note"
              rows={3}
              placeholder="e.g. Door has been locked since Tuesday"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <button type="submit" className="btn btn-primary btn-block" disabled={!status}>
              Send alert
            </button>
          </form>
        )}
      </div>
    </div>
  );
}