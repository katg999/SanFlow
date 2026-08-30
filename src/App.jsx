import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import ChatBot from './components/ChatBot.jsx';
import Landing from './pages/Landing.jsx';
import MapPage from './pages/MapPage.jsx';
import About from './pages/About.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

function Layout() {
  const { pathname } = useLocation();
  const isAppView = pathname.startsWith('/map');

  return (
    <div className="app-shell">
      <Navbar />
      <main className={isAppView ? 'app-main-full' : 'app-main'}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </main>
      {!isAppView && <Footer />}
      <ChatBot />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Layout />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
