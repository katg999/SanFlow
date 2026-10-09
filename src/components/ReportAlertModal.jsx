'use client';

import { useState } from 'react';
import { X, TriangleAlert, Camera, LocateFixed, CheckCircle2, Clock } from 'lucide-react';
import { fileToDataUrl } from '../utils/image.js';
import './ReportAlertModal.css';

// Report types from the brief (A.3): broken, full toilet/septic, dirty, illegal dumping.
const OPTIONS_BY_CATEGORY = {
  toilet: [
    { value: 'full', label: 'Full toilet / septic' },
    { value: 'broken', label: 'Broken / damaged' },
    { value: 'dirty', label: 'Dirty facility' },
  ],
  waste: [
    { value: 'full', label: 'Full / overflowing' },
    { value: 'dirty', label: 'Dirty / smelly' },
    { value: 'broken', label: 'Damaged' },
  ],
  water: [{ value: 'broken', label: 'Broken / not working' }],
  health: [{ value: 'broken', label: 'Closed / unstaffed' }],
};
const DUMPING = [{ value: 'dumping', label: 'Illegal dumping' }];

const RESULT_COPY = {
  verified: 'Report verified and sent. The responsible operator / provider has been alerted. If it stays open for 24 hours it escalates to the county health officer.',
  pending: 'Report received. It will be confirmed once a second citizen nearby reports the same problem (anti-fake-report check).',
  duplicate: 'You already reported this today — thanks, we have it.',
  error: 'We could not send your report.',
};

// `facility` null + `dumping` => illegal-dumping report at the user's GPS pin.
export default function ReportAlertModal({ open, facility, dumping = false, userLocation, onClose, onSubmit }) {
  const [type, setType] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [gps, setGps] = useState(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);

  if (!open) return null;
  const options = dumping ? DUMPING : OPTIONS_BY_CATEGORY[facility?.category] ?? OPTIONS_BY_CATEGORY.toilet;
  const pin = gps ?? userLocation ?? null;

  const close = () => {
    setType('');
    setNote('');
    setPhoto(null);
    setGps(null);
    setResult(null);
    onClose();
  };

  const attachGps = () => {
    if (!navigator.geolocation) return;
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGpsBusy(false);
      },
      () => setGpsBusy(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (file) setPhoto(await fileToDataUrl(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const chosen = dumping ? 'dumping' : type;
    if (!chosen || (dumping && !pin)) return;
    setSending(true);
    try {
      setResult(await onSubmit({ facility, type: chosen, note, photo, gps: pin }));
    } catch (err) {
      setResult({ ok: false, code: 'error', message: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={close} aria-label="Close">
          <X size={18} />
        </button>

        {result ? (
          <div className="modal-success">
            {result.code === 'pending' ? <Clock size={28} /> : <CheckCircle2 size={28} />}
            <h3>{result.code === 'duplicate' ? 'Already reported' : result.code === 'pending' ? 'Awaiting confirmation' : result.code === 'error' ? 'Not sent' : 'Alert sent'}</h3>
            <p>{result.message || RESULT_COPY[result.code]}</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={close}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <span className="eyebrow modal-eyebrow">
              <TriangleAlert size={13} /> Report an issue
            </span>
            <h3>{facility?.name ?? 'Illegal dumping'}</h3>
            <p className="modal-subtitle">{facility?.area ?? 'Drop a GPS pin where the waste is'}</p>

            <div className="modal-options">
              {options.map((opt) => (
                <label key={opt.value} className={`modal-option ${(dumping ? 'dumping' : type) === opt.value ? 'is-selected' : ''}`}>
                  <input type="radio" name="status" value={opt.value} checked={(dumping ? 'dumping' : type) === opt.value} onChange={() => setType(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>

            <label className="modal-note-label" htmlFor="report-note">Additional details (optional)</label>
            <textarea id="report-note" className="modal-note" rows={2} placeholder="e.g. Door has been locked since Tuesday" value={note} onChange={(e) => setNote(e.target.value)} />

            <div className="modal-attach">
              <label className="btn btn-outline btn-sm modal-attach-btn">
                <Camera size={14} /> {photo ? 'Change photo' : 'Add photo'}
                <input type="file" accept="image/*" capture="environment" hidden onChange={handlePhoto} />
              </label>
              <button type="button" className="btn btn-outline btn-sm" onClick={attachGps}>
                <LocateFixed size={14} /> {gpsBusy ? 'Locating…' : pin ? 'GPS pin attached' : 'Attach GPS pin'}
              </button>
            </div>
            {photo && <img className="modal-photo-preview" src={photo} alt="Report evidence" />}
            {pin && <p className="modal-gps">📍 {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</p>}

            <button type="submit" className="btn btn-primary btn-block" disabled={sending || (!dumping && !type) || (dumping && !pin)}>
              {sending ? 'Sending…' : 'Send alert'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
