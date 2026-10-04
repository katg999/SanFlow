'use client';

import { useState } from 'react';
import { X, MapPin } from 'lucide-react';
import { CATEGORIES } from '../data/facilities.js';
import './ReportAlertModal.css';

const COUNTRIES = ['Kenya', 'Uganda'];

export default function AddFacilityModal({ open, onClose, onSubmit, defaultLocation }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('toilet');
  const [area, setArea] = useState('');
  const [country, setCountry] = useState('Uganda');
  const [lat, setLat] = useState(defaultLocation?.lat ?? '');
  const [lng, setLng] = useState(defaultLocation?.lng ?? '');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const reset = () => {
    setName('');
    setCategory('toilet');
    setArea('');
    setCountry('Uganda');
    setLat(defaultLocation?.lat ?? '');
    setLng(defaultLocation?.lng ?? '');
    setHours('');
    setDescription('');
    setError(null);
    setSubmitted(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !area.trim() || lat === '' || lng === '') {
      setError('Name, area and location are required.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        category,
        area: area.trim(),
        country,
        lat: Number(lat),
        lng: Number(lng),
        hours: hours.trim() || undefined,
        description: description.trim() || undefined,
      });
      setSubmitted(true);
      setTimeout(handleClose, 1100);
    } catch (err) {
      setError(err.code === 'Missing token' ? 'You need to log in before adding a facility.' : err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose} aria-label="Close">
          <X size={18} />
        </button>

        {submitted ? (
          <div className="modal-success">
            <MapPin size={28} />
            <h3>Facility added</h3>
            <p>{name} has been added to the map for everyone to see.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <span className="eyebrow modal-eyebrow">
              <MapPin size={13} /> Add a facility
            </span>
            <h3>New facility</h3>
            <p className="modal-subtitle">Add a toilet, waste point, water source or clinic to the map.</p>

            {error && <p className="modal-note-label" style={{ color: 'var(--color-danger)' }}>{error}</p>}

            <label className="modal-note-label" htmlFor="af-name">
              Name
            </label>
            <input
              id="af-name"
              className="modal-note"
              style={{ resize: 'none' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ntinda Market Toilet"
            />

            <label className="modal-note-label" htmlFor="af-category">
              Category
            </label>
            <div className="modal-options">
              {Object.values(CATEGORIES).map((c) => (
                <label
                  key={c.key}
                  className={`modal-option ${category === c.key ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={c.key}
                    checked={category === c.key}
                    onChange={() => setCategory(c.key)}
                  />
                  {c.singular}
                </label>
              ))}
            </div>

            <label className="modal-note-label" htmlFor="af-area">
              Area
            </label>
            <input
              id="af-area"
              className="modal-note"
              style={{ resize: 'none' }}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. Ntinda, Kampala"
            />

            <label className="modal-note-label" htmlFor="af-country">
              Country
            </label>
            <div className="modal-options">
              {COUNTRIES.map((c) => (
                <label key={c} className={`modal-option ${country === c ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="country"
                    value={c}
                    checked={country === c}
                    onChange={() => setCountry(c)}
                  />
                  {c}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="modal-note-label" htmlFor="af-lat">
                  Latitude
                </label>
                <input
                  id="af-lat"
                  className="modal-note"
                  style={{ resize: 'none' }}
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="0.3136"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="modal-note-label" htmlFor="af-lng">
                  Longitude
                </label>
                <input
                  id="af-lng"
                  className="modal-note"
                  style={{ resize: 'none' }}
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="32.5811"
                />
              </div>
            </div>

            <label className="modal-note-label" htmlFor="af-hours">
              Hours (optional)
            </label>
            <input
              id="af-hours"
              className="modal-note"
              style={{ resize: 'none' }}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 6:00 AM – 9:00 PM"
            />

            <label className="modal-note-label" htmlFor="af-description">
              Description (optional)
            </label>
            <textarea
              id="af-description"
              className="modal-note"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />

            <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add facility'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
