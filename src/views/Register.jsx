'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../data/roles.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import './Auth.css';

export default function Register() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('citizen');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await register(name, email, password, role);
    if (!result.ok) {
      setError(['emailTaken', 'networkError'].includes(result.error) ? t(`auth.${result.error}`) : result.error);
      return;
    }
    router.push(ROLES[result.user?.role]?.home ?? '/map');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{t('auth.registerTitle')}</h1>
        <p className="auth-notice">{t('auth.demoNotice')}</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="register-name">{t('auth.name')}</label>
            <input
              id="register-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="register-role">I am a…</label>
            <select id="register-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="citizen">Citizen — find &amp; report services</option>
              <option value="operator">Facility operator — toilet / water point owner</option>
              <option value="provider">Service provider — exhauster / waste collector</option>
            </select>
          </div>
          <div className="auth-field">
            <label htmlFor="register-email">{t('auth.email')}</label>
            <input
              id="register-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="register-password">{t('auth.password')}</label>
            <input
              id="register-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary auth-submit">
            {t('auth.registerSubmit')}
          </button>
        </form>

        <p className="auth-switch">
          {t('auth.haveAccount')} <Link href="/login">{t('auth.loginLink')}</Link>
        </p>
      </div>
    </div>
  );
}
