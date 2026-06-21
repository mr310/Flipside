import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { logVisit } from './api';
import Home from './pages/Home';
import SessionPage from './pages/SessionPage';
import ButtonPage from './pages/ButtonPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminSessionEditor from './pages/AdminSessionEditor';
import GalleryPage from './pages/GalleryPage';

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return;
    if (sessionStorage.getItem('siteVisitLogged')) return;

    const reportVisit = (latitude?: number, longitude?: number) => {
      logVisit(latitude, longitude).catch(() => {});
      sessionStorage.setItem('siteVisitLogged', '1');
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          reportVisit(position.coords.latitude, position.coords.longitude);
        },
        () => {
          reportVisit();
        },
        { maximumAge: 300000, timeout: 5000 },
      );
    } else {
      reportVisit();
    }
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/session/:id" element={<SessionPage />} />
      <Route path="/session/:sessionId/gallery" element={<GalleryPage />} />
      <Route path="/session/:sessionId/button/:type" element={<ButtonPage />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/sessions/:id" element={<AdminSessionEditor />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
