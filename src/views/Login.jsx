'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../data/roles.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import './Auth.css';

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (!result.ok) {
      setError(
        result.error === 'networkError'
          ? `${t('auth.networkError')}`
          : result.error === 'accountSuspended'
            ? 'This account has been suspended.'
            : t(`auth.${result.error}`)
      );
      return;
    }
    router.push(ROLES[result.user?.role]?.home ?? '/map');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{t('auth.loginTitle')}</h1>
        <p className="auth-notice">{t('auth.demoNotice')}</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="login-email">{t('auth.email')}</label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="login-password">{t('auth.password')}</label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary auth-submit">
            {t('auth.loginSubmit')}
          </button>
        </form>

        <p className="auth-switch">
          {t('auth.noAccount')} <Link href="/register">{t('auth.registerLink')}</Link>
        </p>
      </div>
    </div>
  );
}
