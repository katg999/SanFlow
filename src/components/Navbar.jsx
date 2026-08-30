import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, MapPin, Globe, LogOut } from 'lucide-react';
import Logo from './Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import './Navbar.css';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { lang, setLang, t, languages } = useLanguage();
  const navigate = useNavigate();

  const LINKS = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/map', label: t('nav.findServices') },
    { to: '/about', label: t('nav.about') },
  ];

  const toggleLang = () => setLang(lang === 'en' ? 'sw' : 'en');

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/');
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <NavLink to="/" className="navbar-brand" onClick={() => setOpen(false)}>
          <Logo size={46} />
        </NavLink>

        <nav className={`navbar-links ${open ? 'is-open' : ''}`}>
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `navbar-link ${isActive ? 'is-active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}

          <button
            type="button"
            className="navbar-link navbar-lang-btn"
            onClick={toggleLang}
            title={languages[lang]?.label}
          >
            <Globe size={15} /> {lang.toUpperCase()}
          </button>

          {user ? (
            <>
              <span className="navbar-link navbar-hi">{t('nav.hi', { name: user.name.split(' ')[0] })}</span>
              <button type="button" className="btn btn-outline btn-sm navbar-cta" onClick={handleLogout}>
                <LogOut size={15} /> {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="navbar-link" onClick={() => setOpen(false)}>
                {t('nav.login')}
              </NavLink>
              <NavLink to="/register" className="btn btn-outline btn-sm navbar-cta" onClick={() => setOpen(false)}>
                {t('nav.register')}
              </NavLink>
            </>
          )}

          <NavLink to="/map" className="btn btn-accent btn-sm navbar-cta" onClick={() => setOpen(false)}>
            <MapPin size={16} />
            {t('nav.openMap')}
          </NavLink>
        </nav>

        <button
          className="navbar-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}
