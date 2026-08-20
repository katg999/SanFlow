import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, ExternalLink, MapPin } from 'lucide-react';
import { CATEGORIES, STATUS } from '../data/facilities.js';
import { useFacilityStore } from '../hooks/useFacilityStore.js';
import { distanceKm, formatDistance, sortByProximity } from '../utils/geo.js';
import './ChatBot.css';

// Swap in a real WhatsApp Business number when one is provisioned —
// the rest of the widget works without it.
const WHATSAPP_NUMBER = '254700000000';

const NAIROBI_CENTER = { lat: -1.2921, lng: 36.8219 };

const CATEGORY_KEYWORDS = {
  toilet: ['toilet', 'latrine', 'washroom', 'bathroom', 'loo'],
  water: ['water', 'borehole', 'tap', 'well'],
  waste: ['waste', 'garbage', 'trash', 'rubbish', 'sewage', 'skip'],
  health: ['health', 'clinic', 'pharmacy', 'hospital', 'medicine'],
};

const REPORTABLE_STATUS = {
  toilet: ['clean', 'filling', 'full', 'broken'],
  water: ['operational', 'broken'],
  waste: ['clean', 'full', 'broken'],
  health: ['open', 'closed'],
};

let uid = 0;
const nextId = () => `m${++uid}`;

function greetingMessage() {
  return {
    id: nextId(),
    from: 'bot',
    text:
      "Hi! I'm the SanFlow Health WASHLink assistant. I can help you find a clean toilet, water point, waste site or health service nearby, or log a report on one. What do you need?",
    quickReplies: [
      { label: '🔍 Find a facility', value: 'find' },
      { label: '⚠️ Report an issue', value: 'report' },
      { label: 'ℹ️ About this site', value: 'about' },
      { label: '💬 Talk to a person', value: 'contact' },
    ],
  };
}

function detectCategory(text) {
  const q = text.toLowerCase();
  return Object.keys(CATEGORY_KEYWORDS).find((key) =>
    CATEGORY_KEYWORDS[key].some((kw) => q.includes(kw))
  );
}

function FacilityResult({ facility, origin, onReportThis }) {
  const status = STATUS[facility.status];
  const mapsUrl = `https://www.google.com/maps?q=${facility.lat},${facility.lng}`;
  const siteUrl = `/map?focus=${facility.id}&category=${facility.category}`;

  return (
    <div className="cb-facility">
      <div className="cb-facility-top">
        <strong>{facility.name}</strong>
        <span className={`cb-status cb-status-${status.tone}`}>{status.label}</span>
      </div>
      <p className="cb-facility-meta">
        {facility.area} · {formatDistance(distanceKm(origin, facility))} away
      </p>
      <div className="cb-facility-actions">
        <a href={siteUrl} className="cb-link">
          <MapPin size={13} /> View on map
        </a>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="cb-link">
          <ExternalLink size={13} /> Directions
        </a>
        <button type="button" className="cb-link cb-link-btn" onClick={() => onReportThis(facility)}>
          Report status
        </button>
      </div>
    </div>
  );
}

export default function ChatBot() {
  const { facilities, reportIssue } = useFacilityStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([greetingMessage()]);
  const [step, setStep] = useState('menu');
  const [draft, setDraft] = useState({});
  const [input, setInput] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const pushBot = (text, extra = {}) => {
    setMessages((prev) => [...prev, { id: nextId(), from: 'bot', text, ...extra }]);
  };

  const pushUser = (text) => {
    setMessages((prev) => [...prev, { id: nextId(), from: 'user', text }]);
  };

  const goToMenu = () => {
    setStep('menu');
    setDraft({});
    pushBot('Anything else I can help with?', {
      quickReplies: [
        { label: '🔍 Find a facility', value: 'find' },
        { label: '⚠️ Report an issue', value: 'report' },
        { label: 'ℹ️ About this site', value: 'about' },
        { label: '💬 Talk to a person', value: 'contact' },
      ],
    });
  };

  const askCategory = (mode) => {
    setStep(`${mode}:category`);
    pushBot(mode === 'find' ? 'What are you looking for?' : 'Which kind of facility do you want to report on?', {
      quickReplies: Object.values(CATEGORIES).map((c) => ({ label: c.label, value: c.key })),
    });
  };

  const runFindResults = (category, origin, originLabel) => {
    const matches = sortByProximity(
      facilities.filter((f) => f.category === category),
      origin
    ).slice(0, 3);

    if (matches.length === 0) {
      pushBot(`I couldn't find any ${CATEGORIES[category].label.toLowerCase()} in the seed data yet.`);
    } else {
      pushBot(`Here are the closest ${CATEGORIES[category].label.toLowerCase()} ${originLabel}:`, {
        facilityResults: matches.map((f) => ({ facility: f, origin })),
      });
    }
    setTimeout(goToMenu, 300);
  };

  const startReportPick = (category) => {
    setDraft({ category });
    setStep('report:pick');
    const options = facilities
      .filter((f) => f.category === category)
      .slice(0, 6)
      .map((f) => ({ label: f.name, value: f.id }));
    pushBot('Which facility is this about? Pick one, or type its name.', { quickReplies: options });
  };

  const startReportStatus = (facilityId) => {
    const facility = facilities.find((f) => f.id === facilityId);
    if (!facility) {
      pushBot("I couldn't match that facility — try picking one from the list.");
      return;
    }
    setDraft((d) => ({ ...d, facilityId }));
    setStep('report:status');
    const statuses = REPORTABLE_STATUS[facility.category] ?? [];
    pushBot(`Got it — what's the current status of "${facility.name}"?`, {
      quickReplies: statuses.map((s) => ({ label: STATUS[s].label, value: s })),
    });
  };

  const finishReport = (statusKey) => {
    const facility = facilities.find((f) => f.id === draft.facilityId);
    if (facility) {
      reportIssue(facility.id, statusKey, 'Reported via site assistant');
      pushBot(
        `Thanks! I've logged "${facility.name}" as ${STATUS[statusKey].label.toLowerCase()}. The community and site visitors will see this update.`
      );
    }
    setTimeout(goToMenu, 300);
  };

  const handleQuickReply = (value) => {
    pushUser(messagesLabelFor(value));

    if (step === 'menu') {
      if (value === 'find') return askCategory('find');
      if (value === 'report') return askCategory('report');
      if (value === 'about') {
        pushBot(
          'SanFlow Health WASHLink is a citizen-facing map for finding clean toilets, water points, waste disposal sites and health services across Kenya & Uganda — with community ratings and issue reporting. Check the "About" page for the full roadmap.'
        );
        return setTimeout(goToMenu, 300);
      }
      if (value === 'contact') {
        const text = encodeURIComponent("Hi, I'd like help finding a WASH facility.");
        pushBot('You can reach the team directly on WhatsApp:', {
          quickReplies: [
            { label: '💬 Open WhatsApp', value: `wa:${text}` },
          ],
        });
        return;
      }
    }

    if (value.startsWith('wa:')) {
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${value.slice(3)}`, '_blank', 'noreferrer');
      return setTimeout(goToMenu, 200);
    }

    if (step === 'find:category') {
      setDraft({ category: value });
      setStep('find:location');
      pushBot('Should I search near your current location, or a specific area?', {
        quickReplies: [
          { label: '📍 Use my location', value: 'geo' },
          { label: '🏙️ Nairobi CBD (default)', value: 'default' },
        ],
      });
      return;
    }

    if (step === 'find:location') {
      if (value === 'geo') {
        if (!navigator.geolocation) {
          pushBot("This browser doesn't support location sharing — using Nairobi CBD instead.");
          return runFindResults(draft.category, NAIROBI_CENTER, 'from Nairobi CBD');
        }
        pushBot('Locating you…');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            runFindResults(draft.category, origin, 'near you');
          },
          () => {
            pushBot("Couldn't get your location — using Nairobi CBD instead.");
            runFindResults(draft.category, NAIROBI_CENTER, 'from Nairobi CBD');
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
        return;
      }
      return runFindResults(draft.category, NAIROBI_CENTER, 'from Nairobi CBD');
    }

    if (step === 'report:category') {
      return startReportPick(value);
    }

    if (step === 'report:pick') {
      return startReportStatus(value);
    }

    if (step === 'report:status') {
      return finishReport(value);
    }
  };

  const messagesLabelFor = (value) => {
    const flat = messages.flatMap((m) => m.quickReplies ?? []);
    const match = flat.find((q) => q.value === value);
    return match ? match.label : value;
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    pushUser(text);

    if (step === 'find:location') {
      const q = text.toLowerCase();
      const areaMatches = facilities.filter(
        (f) => f.category === draft.category && (f.area.toLowerCase().includes(q) || f.country.toLowerCase().includes(q))
      );
      const origin = areaMatches[0] ?? NAIROBI_CENTER;
      return runFindResults(draft.category, origin, areaMatches[0] ? `near "${text}"` : `(couldn't match "${text}", showing from Nairobi CBD)`);
    }

    if (step === 'report:pick') {
      const q = text.toLowerCase();
      const match = facilities.find(
        (f) => f.category === draft.category && f.name.toLowerCase().includes(q)
      );
      if (!match) {
        pushBot(`I couldn't find a match for "${text}" — try a shorter name or pick from the list above.`);
        return;
      }
      return startReportStatus(match.id);
    }

    // Free-text at the top level: try to detect intent.
    const category = detectCategory(text);
    if (/report|broke|broken|full|dirty/i.test(text) && category) {
      pushBot(`Sounds like you want to report a ${CATEGORIES[category].label.toLowerCase()} issue.`);
      return startReportPick(category);
    }
    if (category) {
      setDraft({ category });
      setStep('find:location');
      pushBot(`Looking for ${CATEGORIES[category].label.toLowerCase()}. Search near your location or a specific area?`, {
        quickReplies: [
          { label: '📍 Use my location', value: 'geo' },
          { label: '🏙️ Nairobi CBD (default)', value: 'default' },
        ],
      });
      return;
    }

    pushBot("I didn't quite catch that — here's what I can help with:", {
      quickReplies: [
        { label: '🔍 Find a facility', value: 'find' },
        { label: '⚠️ Report an issue', value: 'report' },
        { label: 'ℹ️ About this site', value: 'about' },
        { label: '💬 Talk to a person', value: 'contact' },
      ],
    });
    setStep('menu');
  };

  return (
    <div className="cb-root">
      {open && (
        <div className="cb-panel" role="dialog" aria-label="SanFlow Health WASHLink assistant chat">
          <div className="cb-header">
            <div>
              <strong>SanFlow Health WASHLink</strong>
              <span>Usually replies instantly</span>
            </div>
            <button type="button" className="cb-close" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={18} />
            </button>
          </div>

          <div className="cb-messages" ref={listRef}>
            {messages.map((m) => (
              <div key={m.id} className={`cb-row cb-row-${m.from}`}>
                <div className={`cb-bubble cb-bubble-${m.from}`}>{m.text}</div>
                {m.facilityResults?.map(({ facility, origin }) => (
                  <FacilityResult
                    key={facility.id}
                    facility={facility}
                    origin={origin}
                    onReportThis={(f) => {
                      pushUser(`Report status for ${f.name}`);
                      setDraft({ category: f.category });
                      startReportStatus(f.id);
                    }}
                  />
                ))}
                {m.quickReplies && (
                  <div className="cb-quick-replies">
                    {m.quickReplies.map((qr) => (
                      <button key={qr.value} type="button" onClick={() => handleQuickReply(qr.value)}>
                        {qr.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form className="cb-input-row" onSubmit={handleTextSubmit}>
            <input
              type="text"
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" aria-label="Send">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="cb-launcher"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
