'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, MapPin, Globe, LogOut, Sun, Moon, User } from 'lucide-react';
import Logo from './Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../data/roles.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import './Navbar.css';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const { user, logout } = useAuth();
  const { lang, setLang, t, languages } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!accountOpen) return undefined;
    const handlePointer = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [accountOpen]);

  const LINKS = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/map', label: t('nav.findServices') },
    { to: '/impact', label: t('nav.impact') },
    { to: '/circular-economy', label: t('nav.circular') },
    { to: '/about', label: t('nav.about') },
  ];

  if (user && user.role !== 'citizen' && ROLES[user.role]) {
    LINKS.splice(2, 0, { to: ROLES[user.role].home, label: 'My portal' });
  }

  const isActive = (to, end) => (end ? pathname === to : pathname.startsWith(to));

  const toggleLang = () => setLang(lang === 'en' ? 'sw' : 'en');

  const handleLogout = () => {
    logout();
    setOpen(false);
    router.push('/');
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link href="/" className="navbar-brand" onClick={() => setOpen(false)}>
          <Logo size={46} />
        </Link>

        <nav className={`navbar-links ${open ? 'is-open' : ''}`}>
          <div className="navbar-links-primary">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                href={link.to}
                className={`navbar-link ${isActive(link.to, link.end) ? 'is-active' : ''}`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="navbar-links-account">
            <Link href="/map" className="btn btn-accent btn-sm navbar-cta" onClick={() => setOpen(false)}>
              <MapPin size={16} />
              {t('nav.openMap')}
            </Link>
          </div>
        </nav>

        <div className="navbar-utility">
          <div className="navbar-account" ref={accountRef}>
            <button
              type="button"
              className="navbar-icon-btn"
              onClick={() => setAccountOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-label={user ? t('nav.hi', { name: user.name.split(' ')[0] }) : t('nav.account')}
              title={user ? user.name : t('nav.account')}
            >
              <User size={16} />
            </button>

            {accountOpen && (
              <div className="navbar-account-menu" role="menu">
                {user ? (
                  <>
                    <span className="navbar-account-hi">{t('nav.hi', { name: user.name.split(' ')[0] })} · {ROLES[user.role]?.label}</span>
                    {user.role !== 'citizen' && ROLES[user.role] && (
                      <Link href={ROLES[user.role].home} role="menuitem" className="navbar-account-item" onClick={() => setAccountOpen(false)}>
                        My portal
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      className="navbar-account-item"
                      onClick={() => {
                        setAccountOpen(false);
                        handleLogout();
                      }}
                    >
                      <LogOut size={15} /> {t('nav.logout')}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      role="menuitem"
                      className="navbar-account-item"
                      onClick={() => setAccountOpen(false)}
                    >
                      {t('nav.login')}
                    </Link>
                    <Link
                      href="/register"
                      role="menuitem"
                      className="navbar-account-item"
                      onClick={() => setAccountOpen(false)}
                    >
                      {t('nav.register')}
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className="navbar-icon-btn"
            onClick={toggleLang}
            aria-label={`Switch language, currently ${languages[lang]?.label}`}
            title={languages[lang]?.label}
          >
            <Globe size={16} />
            <span className="navbar-icon-btn-tag">{lang.toUpperCase()}</span>
          </button>

          <button
            type="button"
            className="navbar-icon-btn"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            className="navbar-toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
