'use client';

import { usePathname } from 'next/navigation';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import ChatBot from '../components/ChatBot.jsx';

export default function Shell({ children }) {
  const pathname = usePathname();
  const isAppView = pathname.startsWith('/map');

  return (
    <div className="app-shell">
      <Navbar />
      <main className={isAppView ? 'app-main-full' : 'app-main'}>{children}</main>
      {!isAppView && <Footer />}
      <ChatBot />
    </div>
  );
}
