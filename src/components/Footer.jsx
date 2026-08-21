import { Link } from 'react-router-dom';
import { MessageCircle, Mail, MapPin } from 'lucide-react';
import Logo from './Logo.jsx';
import './Footer.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo size={32} mark="light" />
          <p className="footer-tagline">
            A unified digital infrastructure connecting citizens to water, sanitation and
            hygiene services across East Africa.
          </p>
          <div className="footer-badges">
            <span className="footer-badge">Kenya</span>
            <span className="footer-badge">Uganda</span>
          </div>
        </div>

        <div className="footer-col">
          <h4>Product</h4>
          <ul>
            <li><Link to="/map">Find a facility</Link></li>
            <li><Link to="/map?report=1">Report an issue</Link></li>
            <li><Link to="/about">How it works</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>For Organizations</h4>
          <ul>
            <li><a href="#admin">Municipal dashboard</a></li>
            <li><a href="#whatsapp">WhatsApp assistant</a></li>
            <li><a href="#data">Submit baseline data</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Contact</h4>
          <ul className="footer-contact">
            <li><MessageCircle size={16} /> +256 761 267 314 (WhatsApp)</li>
            <li><Mail size={16} /> hello@sanflow-washlink.org</li>
            <li><MapPin size={16} /> Nairobi, KE · Kampala, UG</li>
          </ul>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>© {year} SanFlow Health WASHLink. Built for proactive WASH management.</span>
        <span className="footer-version">v1.0 · Phase 1</span>
      </div>
    </footer>
  );
}
