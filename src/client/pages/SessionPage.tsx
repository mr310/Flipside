import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSession, type SessionWithButtons, type Button } from '../api';

const BTN_META: Record<string, { icon: string; className: string }> = {
  play:      { icon: '▶',  className: 'play' },
  ffw:       { icon: '⏩', className: 'ffw' },
  playpause: { icon: '⏯', className: 'playpause' },
  stop:      { icon: '■',  className: 'stop' },
};

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionWithButtons | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) getSession(id).then(setSession).finally(() => setLoading(false));
  }, [id]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  if (loading) return <div className="page"><p className="loading">Caricamento...</p></div>;
  if (!session) return <div className="page"><p className="loading">Sessione non trovata.</p></div>;

  return (
    <div className="page">
      <Link to="/" className="back-link">‹ Home</Link>

      <div className="cassette-wrapper">
        <span className="cassette-label-title">TAPE DECK</span>

        <div className="cassette">
          <div className="cassette-window">
            <div className="reel"><div className="reel-inner" /></div>
            <div className="tape-info">
              <span className="tape-date">{formatDate(session.date)}</span>
              <span className="tape-label">{session.label}</span>
            </div>
            <div className="reel"><div className="reel-inner" /></div>
          </div>

          <div className="cassette-buttons">
            {session.buttons.map((btn: Button) => {
              const meta = BTN_META[btn.type] ?? { icon: '?', className: btn.type };
              const disabled = !!btn.is_disabled;
              const label = btn.display_label || btn.type.toUpperCase();

              if (disabled) {
                return (
                  <button
                    key={btn.type}
                    className={`cassette-btn ${meta.className} disabled`}
                    disabled
                  >
                    <span className="btn-icon">{meta.icon}</span>
                    <span className="btn-label">{label}</span>
                  </button>
                );
              }

              return (
                <Link key={btn.type} to={`/session/${session.id}/button/${btn.type}`}>
                  <button className={`cassette-btn ${meta.className}`} style={{ width: '100%' }}>
                    <span className="btn-icon">{meta.icon}</span>
                    <span className="btn-label">{label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
