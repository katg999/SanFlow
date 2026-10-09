'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, ExternalLink, MapPin } from 'lucide-react';
import { CATEGORIES, STATUS } from '../data/facilities.js';
import { useFacilities } from '../hooks/useFacilities.js';
import { distanceKm, formatDistance, sortByProximity } from '../utils/geo.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import './ChatBot.css';

const WHATSAPP_NUMBER = '256772207616';

const KAMPALA_CENTER = { lat: 0.3136, lng: 32.5811 };

const CATEGORY_KEYWORDS = {
  toilet: ['toilet', 'latrine', 'washroom', 'bathroom', 'loo', 'choo'],
  water: ['water', 'borehole', 'tap', 'well', 'maji'],
  waste: ['waste', 'garbage', 'trash', 'rubbish', 'sewage', 'skip', 'taka'],
  health: ['health', 'clinic', 'pharmacy', 'hospital', 'medicine', 'afya'],
};

// What a person can tell the assistant. These become real reports (verified server-side), not direct status edits.
const REPORTABLE_STATUS = {
  toilet: ['dirty', 'full', 'broken'],
  water: ['operational', 'broken'],
  waste: ['dirty', 'full', 'broken'],
  health: ['closed'],
};
const REPORT_TYPE_FOR = { dirty: 'dirty', full: 'full', broken: 'broken', closed: 'broken' };

let uid = 0;
const nextId = () => `m${++uid}`;

function menuQuickReplies(t) {
  return [
    { label: t('chatbot.menuFind'), value: 'find' },
    { label: t('chatbot.menuReport'), value: 'report' },
    { label: t('chatbot.menuAbout'), value: 'about' },
    { label: t('chatbot.menuContact'), value: 'contact' },
  ];
}

function FacilityResult({ facility, origin, onReportThis, t }) {
  const status = STATUS[facility.status];
  const siteUrl = `/map?focus=${facility.id}&category=${facility.category}`;
  const navUrl = `${siteUrl}&navigate=1`;

  return (
    <div className="cb-facility">
      <div className="cb-facility-top">
        <strong>{facility.name}</strong>
        <span className={`cb-status cb-status-${status.tone}`}>{t(`status.${facility.status}`)}</span>
      </div>
      <p className="cb-facility-meta">
        {facility.area} · {formatDistance(distanceKm(origin, facility))} away
      </p>
      <div className="cb-facility-actions">
        <a href={siteUrl} className="cb-link">
          <MapPin size={13} /> View on map
        </a>
        <a href={navUrl} className="cb-link">
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
  const { facilities, submitReport, confirmAvailability } = useFacilities();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      id: nextId(),
      from: 'bot',
      text: t('chatbot.greeting'),
      quickReplies: menuQuickReplies(t),
    },
  ]);
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
    pushBot(t('chatbot.anythingElse'), { quickReplies: menuQuickReplies(t) });
  };

  const askCategory = (mode) => {
    setStep(`${mode}:category`);
    pushBot(mode === 'find' ? t('chatbot.askWhatLooking') : t('chatbot.askWhichReport'), {
      quickReplies: Object.keys(CATEGORIES).map((key) => ({ label: t(`categories.${key}`), value: key })),
    });
  };

  const runFindResults = (category, origin, originLabel) => {
    const matches = sortByProximity(
      facilities.filter((f) => f.category === category),
      origin
    ).slice(0, 3);

    if (matches.length === 0) {
      pushBot(`I couldn't find any ${t(`categories.${category}`).toLowerCase()} in the map data yet.`);
    } else {
      pushBot(`Here are the closest ${t(`categories.${category}`).toLowerCase()} ${originLabel}:`, {
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
      quickReplies: statuses.map((s) => ({ label: t(`status.${s}`), value: s })),
    });
  };

  const finishReport = async (statusKey) => {
    const facility = facilities.find((f) => f.id === draft.facilityId);
    if (facility) {
      if (statusKey === 'operational') {
        await confirmAvailability(facility, true);
        pushBot(`Thanks! I've noted that "${facility.name}" is working today.`);
      } else {
        const result = await submitReport({ facility, type: REPORT_TYPE_FOR[statusKey], note: 'Reported via site assistant', gps: null });
        if (result.code === 'duplicate') pushBot(`You've already reported "${facility.name}" today — thanks, we have it.`);
        else if (!result.ok) pushBot(result.message || "Sorry, I couldn't send that report right now.");
        else if (result.verified) pushBot(`Thanks! I've logged "${facility.name}" as ${t(`status.${statusKey}`).toLowerCase()} and alerted the people responsible.`);
        else pushBot(`Thanks! Your report about "${facility.name}" is recorded. It goes live once another person confirms it (this stops fake reports).`);
      }
    }
    setTimeout(goToMenu, 300);
  };

  const handleQuickReply = (value) => {
    pushUser(messagesLabelFor(value));

    if (step === 'menu') {
      if (value === 'find') return askCategory('find');
      if (value === 'report') return askCategory('report');
      if (value === 'about') {
        pushBot(t('chatbot.aboutText'));
        return setTimeout(goToMenu, 300);
      }
      if (value === 'contact') {
        const text = encodeURIComponent("Hi, I'd like help finding a WASH facility.");
        pushBot(t('chatbot.contactText'), {
          quickReplies: [
            { label: t('chatbot.openWhatsapp'), value: `wa:${text}` },
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
      pushBot(t('chatbot.searchNearPrompt'), {
        quickReplies: [
          { label: t('chatbot.useMyLocation'), value: 'geo' },
          { label: t('chatbot.kampalaDefault'), value: 'default' },
        ],
      });
      return;
    }

    if (step === 'find:location') {
      if (value === 'geo') {
        if (!navigator.geolocation) {
          pushBot("This browser doesn't support location sharing — using Kampala CBD instead.");
          return runFindResults(draft.category, KAMPALA_CENTER, 'from Kampala CBD');
        }
        pushBot('Locating you…');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            runFindResults(draft.category, origin, 'near you');
          },
          () => {
            pushBot("Couldn't get your location — using Kampala CBD instead.");
            runFindResults(draft.category, KAMPALA_CENTER, 'from Kampala CBD');
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
        return;
      }
      return runFindResults(draft.category, KAMPALA_CENTER, 'from Kampala CBD');
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
      const origin = areaMatches[0] ?? KAMPALA_CENTER;
      return runFindResults(draft.category, origin, areaMatches[0] ? `near "${text}"` : `(couldn't match "${text}", showing from Kampala CBD)`);
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
      pushBot(`Sounds like you want to report a ${t(`categories.${category}`).toLowerCase()} issue.`);
      return startReportPick(category);
    }
    if (category) {
      setDraft({ category });
      setStep('find:location');
      pushBot(`Looking for ${t(`categories.${category}`).toLowerCase()}. Search near your location or a specific area?`, {
        quickReplies: [
          { label: t('chatbot.useMyLocation'), value: 'geo' },
          { label: t('chatbot.kampalaDefault'), value: 'default' },
        ],
      });
      return;
    }

    pushBot(t('chatbot.fallbackReply'), { quickReplies: menuQuickReplies(t) });
    setStep('menu');
  };

  function detectCategory(text) {
    const q = text.toLowerCase();
    return Object.keys(CATEGORY_KEYWORDS).find((key) =>
      CATEGORY_KEYWORDS[key].some((kw) => q.includes(kw))
    );
  }

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
                    t={t}
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