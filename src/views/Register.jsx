'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import './Auth.css';

export default function Register() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await register(name, email, password);
    if (!result.ok) {
      setError(t(`auth.${result.error}`));
      return;
    }
    router.push('/map');
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
              minLength={6}
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
