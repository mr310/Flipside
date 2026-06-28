import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { requestGalleryOTP, verifyGalleryOTP, getGalleryPhotos, type GalleryPhoto } from '../api';

type Step = 'request' | 'verify' | 'gallery';

export default function GalleryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [step, setStep] = useState<Step>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [galleryToken, setGalleryToken] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<'lorena' | 'max' | null>(null);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const handleRequestOTP = async () => {
    if (!sessionId || !recipient) return;
    setLoading(true);
    setError(null);
    try {
      await requestGalleryOTP(sessionId, recipient);
      setStep('verify');
    } catch (err) {
      setError((err as Error).message || 'Errore nella richiesta OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!sessionId || !otp.trim()) {
      setError('Inserisci il codice OTP');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await verifyGalleryOTP(sessionId, otp.trim());
      setGalleryToken(result.gallery_token);
      setStep('gallery');
      loadPhotos(result.gallery_token);
    } catch (err) {
      setError((err as Error).message || 'OTP non valido');
    } finally {
      setLoading(false);
    }
  };

  const loadPhotos = async (token: string) => {
    if (!sessionId) return;
    setLoadingPhotos(true);
    setError(null);
    try {
      const result = await getGalleryPhotos(sessionId, token);
      if (result.type === 'external' && result.url) {
        setExternalUrl(result.url);
      } else {
        setPhotos(result.photos);
      }
    } catch (err) {
      setError((err as Error).message || 'Errore nel caricamento delle foto');
    } finally {
      setLoadingPhotos(false);
    }
  };

  return (
    <div className="page">
      <Link to={`/session/${sessionId}`} className="back-link">‹ Torna alla sessione</Link>

      <div className="section-header">
        <h1 className="section-title">🖼 Galleria Foto</h1>
      </div>

      {step === 'request' && (
        <div className="button-editor">
          <p style={{ margin: '0 0 1rem', color: 'var(--muted)' }}>
            A chi vuoi inviare il codice OTP?
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <button
              className={`btn ${recipient === 'lorena' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setRecipient('lorena')}
            >
              Lorena
            </button>
            <button
              className={`btn ${recipient === 'max' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setRecipient('max')}
            >
              Max
            </button>
          </div>
          {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
          <button className="btn btn-primary" onClick={handleRequestOTP} disabled={loading || !recipient}>
            {loading ? 'Invio...' : 'Richiedi OTP'}
          </button>
        </div>
      )}

      {step === 'verify' && (
        <div className="button-editor">
          <p style={{ margin: 0, color: 'var(--muted)', marginBottom: '1rem' }}>
            Inserisci il codice OTP ricevuto via SMS.
          </p>
          {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
          <div className="form-group">
            <label>Codice OTP</label>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyOTP()}
              placeholder="000000"
              maxLength={6}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              className="btn btn-ghost"
              onClick={() => { setStep('request'); setOtp(''); setError(null); }}
            >
              Indietro
            </button>
            <button className="btn btn-primary" onClick={handleVerifyOTP} disabled={loading}>
              {loading ? 'Verifica...' : 'Verifica'}
            </button>
          </div>
        </div>
      )}

      {step === 'gallery' && (
        <div style={{ width: '100%', maxWidth: '700px' }}>
          {externalUrl ? (
            <div className="button-editor" style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
                La galleria è disponibile nel link qui sotto.
              </p>
              <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                <button className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
                  Apri Galleria
                </button>
              </a>
            </div>
          ) : loadingPhotos ? (
            <p className="loading">Caricamento foto...</p>
          ) : error ? (
            <div className="button-editor">
              <p style={{ color: 'var(--danger)' }}>{error}</p>
              {galleryToken && (
                <button className="btn btn-ghost" onClick={() => loadPhotos(galleryToken)}>
                  Riprova
                </button>
              )}
            </div>
          ) : photos.length === 0 ? (
            <div className="button-editor">
              <p style={{ color: 'var(--muted)', margin: 0 }}>Nessuna foto disponibile.</p>
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                {photos.length} foto — clicca per ingrandire
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '0.5rem',
              }}>
                {photos.map((photo) => (
                  <div
                    key={photo.name}
                    onClick={() => setLightbox(photo.url)}
                    style={{
                      aspectRatio: '1',
                      overflow: 'hidden',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: 'var(--surface)',
                    }}
                  >
                    <img
                      src={photo.url}
                      alt={photo.name}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, cursor: 'zoom-out', padding: '1rem',
          }}
        >
          <img
            src={lightbox}
            alt="Preview"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              borderRadius: '50%', width: '2.5rem', height: '2.5rem',
              fontSize: '1.2rem', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
