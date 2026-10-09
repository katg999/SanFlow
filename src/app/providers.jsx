'use client';

import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { OpsProvider } from '../context/OpsContext.jsx';
import { ThemeProvider } from '../context/ThemeContext.jsx';

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <OpsProvider>{children}</OpsProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
