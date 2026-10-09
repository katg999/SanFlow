'use client';

import Link from 'next/link';
import { MessageCircle, Mail, MapPin, Globe } from 'lucide-react';
import Logo from './Logo.jsx';
import { ATTRIBUTION } from '../data/attribution.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import './Footer.css';

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo size={32} mark="light" />
          <p className="footer-tagline">{t('footer.tagline')}</p>
          <div className="footer-badges">
            <span className="footer-badge">Kenya</span>
            <span className="footer-badge">Uganda</span>
          </div>
        </div>

        <div className="footer-col">
          <h4>{t('footer.product')}</h4>
          <ul>
            <li><Link href="/map">{t('footer.findFacility')}</Link></li>
            <li><Link href="/map?report=1">{t('footer.reportIssue')}</Link></li>
            <li><Link href="/about">{t('footer.howItWorks')}</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>{t('footer.forOrgs')}</h4>
          <ul>
            <li><Link href="/dashboard/municipality">{t('footer.municipalDashboard')}</Link></li>
            <li><Link href="/circular-economy">Circular economy</Link></li>
            <li><a href="#whatsapp">{t('footer.whatsappAssistant')}</a></li>
            <li><a href="#data">{t('footer.submitData')}</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>{t('footer.contact')}</h4>
          <ul className="footer-contact">
            <li><MessageCircle size={16} /> +256 772 207 616 (WhatsApp)</li>
            <li><Mail size={16} /> info@sanflow.co.ke</li>
            <li><Globe size={16} /> www.sanflow.co.ke</li>
            <li><MapPin size={16} /> {t('footer.addressLine')}</li>
          </ul>
        </div>
      </div>

      <div className="container footer-attribution">{ATTRIBUTION}</div>

      <div className="container footer-bottom">
        <span>{t('footer.copyright', { year })}</span>
        <span className="footer-version">{t('footer.version')}</span>
      </div>
    </footer>
  );
}
