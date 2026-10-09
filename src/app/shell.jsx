'use client';

import { usePathname } from 'next/navigation';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import ChatBot from '../components/ChatBot.jsx';
import NoticeBanner from '../components/NoticeBanner.jsx';

export default function Shell({ children }) {
  const pathname = usePathname();
  const isMap = pathname.startsWith('/map');
  const isDash = pathname.startsWith('/dashboard');
  const isAppView = isMap;

  return (
    <div className="app-shell">
      <Navbar />
      <NoticeBanner />
      <main className={isAppView ? 'app-main-full' : 'app-main'}>{children}</main>
      {!isAppView && !isDash && <Footer />}
      <ChatBot />
    </div>
  );
}
