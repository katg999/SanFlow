import { Poppins, Inter, Anton } from 'next/font/google';
import '../index.css';
import Providers from './providers.jsx';
import Shell from './shell.jsx';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
});

export const metadata = {
  title: 'SanFlow Health WASHLink — Find Water, Sanitation & Health Near You',
  description:
    'SanFlow Health WASHLink — find clean toilets, safe water points, and health services near you across East Africa. Report issues, rate facilities, and help your community access WASH services.',
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport = {
  themeColor: '#12283f',
  width: 'device-width',
  initialScale: 1,
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('washlink_theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${poppins.variable} ${inter.variable} ${anton.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
