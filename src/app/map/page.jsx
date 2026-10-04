import { Suspense } from 'react';
import MapPage from '../../views/MapPage.jsx';

export const metadata = {
  title: 'Find Services — SanFlow Health WASHLink',
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MapPage />
    </Suspense>
  );
}
