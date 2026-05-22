import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getButton, clickQR, type Button } from '../api';

const BTN_META: Record<string, { icon: string; label: string; colorClass: string }> = {
  play:      { icon: '▶',  label: 'PLAY',      colorClass: 'play' },
  ffw:       { icon: '⏩', label: 'FAST FWD',  colorClass: 'ffw' },
  playpause: { icon: '⏯', label: 'PLAY/PAUSE', colorClass: 'playpause' },
  stop:      { icon: '■',  label: 'STOP',       colorClass: 'stop' },
};

const BTN_COLORS: Record<string, string> = {
  play: '#4caf50',
  ffw: '#2196f3',
  playpause: '#ff9800',
  stop: '#e53935',
};

export default function ButtonPage() {
  const { sessionId, type } = useParams<{ sessionId: string; type: string }>();
  const [button, setButton] = useState<Button | null>(null);
  const [loading, setLoading] = useState(true);
  const [clicked, setClicked] = useState(false);
  const clickedRef = useRef(false);

  useEffect(() => {
    if (sessionId && type) {
      getButton(sessionId, type)
        .then((b) => {
          setButton(b);
          if (b.qr_clicked) setClicked(true);
        })
        .finally(() => setLoading(false));
    }
  }, [sessionId, type]);

  const handleQRClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (clickedRef.current || !sessionId || !type) return;
    clickedRef.current = true;
    setClicked(true);
    try {
      await clickQR(sessionId, type);
    } catch {
      // ignore — the link still opens
    }
  };

  if (loading) return <div className="page"><p className="loading">Caricamento...</p></div>;
  if (!button) return <div className="page"><p className="loading">Pulsante non trovato.</p></div>;

  const meta = BTN_META[button.type] ?? { icon: '?', label: button.type.toUpperCase(), colorClass: 'play' };
  const color = BTN_COLORS[button.type] ?? '#888';
  const hasUrl = !!button.link_url;

  return (
    <div className="page">
      <Link to={`/session/${sessionId}`} className="back-link">‹ Torna al player</Link>

      <div className="qr-page">
        <div
          className="qr-type-badge"
          style={{ background: `${color}22`, color, border: `1px solid ${color}` }}
        >
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </div>

        {button.page_text && (
          <p className="qr-page-text">{button.page_text}</p>
        )}

        {hasUrl ? (
          <div className="qr-container">
            <a
              className="qr-link"
              href={button.link_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleQRClick}
            >
              <QRCodeSVG value={button.link_url} size={220} level="H" />
            </a>
            <p className="qr-hint">
              {clicked ? '' : 'Scansiona o clicca per aprire il link'}
            </p>
            {clicked && (
              <div className="qr-clicked-badge">
                <span>✓</span> QR utilizzato
              </div>
            )}
          </div>
        ) : (
          <div className="no-url-msg">Nessun URL configurato per questo pulsante.</div>
        )}
      </div>
    </div>
  );
}
