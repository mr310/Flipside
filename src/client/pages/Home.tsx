import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSessions, type Session } from '../api';

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessions().then(setSessions).finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="page">
      <h1 className="home-title">FLIPSIDE</h1>

      {loading ? (
        <p className="loading">Caricamento...</p>
      ) : sessions.length === 0 ? (
        <p className="empty-state">Nessuna sessione disponibile.</p>
      ) : (
        <ul className="session-list">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link to={`/session/${s.id}`} className="session-card">
                <div>
                  <span className="session-date">{formatDate(s.date)}</span>
                  <span className="session-label">{s.label}</span>
                </div>
                <span className="session-arrow">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
