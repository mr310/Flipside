import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SessionPage from './pages/SessionPage';
import ButtonPage from './pages/ButtonPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminSessionEditor from './pages/AdminSessionEditor';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/session/:id" element={<SessionPage />} />
        <Route path="/session/:sessionId/button/:type" element={<ButtonPage />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/sessions/:id" element={<AdminSessionEditor />} />
      </Routes>
    </BrowserRouter>
  );
}
