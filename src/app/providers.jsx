'use client';

import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { ThemeProvider } from '../context/ThemeContext.jsx';

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>{children}</AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
