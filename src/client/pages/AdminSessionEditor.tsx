import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  adminGetSession,
  adminUpdateSession,
  adminUpdateButton,
  adminResetButton,
  adminUpdateSessionGallery,
  type SessionWithButtons,
  type Button,
} from '../api';

const BTN_META: Record<string, { icon: string; label: string; color: string }> = {
  play:      { icon: '▶',  label: 'PLAY',      color: '#4caf50' },
  ffw:       { icon: '⏩', label: 'FAST FWD',  color: '#2196f3' },
  playpause: { icon: '⏯', label: 'PLAY/PAUSE', color: '#ff9800' },
  stop:      { icon: '■',  label: 'STOP',       color: '#e53935' },
};

function ButtonEditor({
  btn,
  onSaved,
}: {
  btn: Button;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState({
    display_label: btn.display_label,
    page_text: btn.page_text,
    link_url: btn.link_url,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adminUpdateButton(btn.session_id, btn.type, fields.display_label, fields.page_text, fields.link_url);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    await adminResetButton(btn.id);
    onSaved();
  };

  const meta = BTN_META[btn.type] ?? { icon: '?', label: btn.type.toUpperCase(), color: '#888' };

  const statusLabel = btn.qr_clicked
    ? 'QR cliccato'
    : btn.is_disabled
    ? 'Disabilitato'
    : 'Attivo';
  const statusClass = btn.qr_clicked ? 'status-clicked' : btn.is_disabled ? 'status-disabled' : 'status-ok';

  return (
    <div className="button-editor">
      <div className="button-editor-header">
        <span
          className="button-editor-title"
          style={{ color: meta.color }}
        >
          <span>{meta.icon}</span> {meta.label}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
          {(btn.is_disabled || btn.qr_clicked) && (
            <button className="btn btn-ghost btn-sm" onClick={reset}>
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="button-editor-fields">
        <div className="form-group" style={{ margin: 0 }}>
          <label>Etichetta pulsante</label>
          <input
            value={fields.display_label}
            onChange={(e) => setFields((f) => ({ ...f, display_label: e.target.value }))}
            placeholder="es. Infinito"
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>URL link (QR Code)</label>
          <input
            value={fields.link_url}
            onChange={(e) => setFields((f) => ({ ...f, link_url: e.target.value }))}
            placeholder="https://..."
          />
        </div>
        <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
          <label>Testo pagina</label>
          <textarea
            value={fields.page_text}
            onChange={(e) => setFields((f) => ({ ...f, page_text: e.target.value }))}
            placeholder="Testo mostrato sulla pagina del pulsante"
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? 'Salvo...' : 'Salva'}
        </button>
      </div>
    </div>
  );
}

export default function AdminSessionEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionWithButtons | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDate, setEditDate] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [galleryFolderPath, setGalleryFolderPath] = useState('');
  const [galleryPhoneNumbers, setGalleryPhoneNumbers] = useState('');
  const [savingGallery, setSavingGallery] = useState(false);

  const load = () => {
    if (!id) return;
    adminGetSession(id)
      .then((s) => {
        setSession(s);
        setEditDate(s.date);
        setEditLabel(s.label);
        setGalleryFolderPath(s.gallery_folder_path || '');
        setGalleryPhoneNumbers(s.gallery_phone_numbers || '');
      })
      .catch(() => navigate('/admin'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const saveMeta = async () => {
    if (!id) return;
    setSavingMeta(true);
    try {
      await adminUpdateSession(id, editDate, editLabel);
      load();
    } finally {
      setSavingMeta(false);
    }
  };

  const saveGallery = async () => {
    if (!id) return;
    setSavingGallery(true);
    try {
      await adminUpdateSessionGallery(id, galleryFolderPath || null, galleryPhoneNumbers || null);
      load();
    } finally {
      setSavingGallery(false);
    }
  };

  if (loading) return <div className="page"><p className="loading">Caricamento...</p></div>;
  if (!session) return <div className="page"><p className="loading">Sessione non trovata.</p></div>;

  return (
    <div className="page">
      <Link to="/admin/dashboard" className="back-link">‹ Dashboard</Link>

      <div className="section-header">
        <h1 className="section-title">Modifica Sessione</h1>
      </div>

      <div className="button-editor" style={{ marginBottom: '2rem' }}>
        <div className="button-editor-fields">
          <div className="form-group" style={{ margin: 0 }}>
            <label>Data</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Label</label>
            <input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
          <button className="btn btn-primary btn-sm" onClick={saveMeta} disabled={savingMeta}>
            {savingMeta ? 'Salvo...' : 'Salva metadati'}
          </button>
        </div>
      </div>

      <div className="button-editor" style={{ marginBottom: '2rem' }}>
        <div className="button-editor-header">
          <span className="button-editor-title">🖼 Galleria Foto</span>
        </div>
        <div className="button-editor-fields">
          <div className="form-group" style={{ margin: 0 }}>
            <label>Cartella foto (percorso server) o URL galleria</label>
            <input
              value={galleryFolderPath}
              onChange={(e) => setGalleryFolderPath(e.target.value)}
              placeholder="/var/data/gallery/sessione  oppure  https://..."
            />
          </div>
          <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <label>Indirizzi email per OTP (separati da virgola)</label>
            <input
              value={galleryPhoneNumbers}
              onChange={(e) => setGalleryPhoneNumbers(e.target.value)}
              placeholder="mario@esempio.com, giulia@esempio.com"
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
          <button className="btn btn-primary btn-sm" onClick={saveGallery} disabled={savingGallery}>
            {savingGallery ? 'Salvo...' : 'Salva galleria'}
          </button>
        </div>
      </div>

      <div
        className="section-title"
        style={{ alignSelf: 'flex-start', marginBottom: '1rem', maxWidth: '700px', width: '100%' }}
      >
        Pulsanti
      </div>

      {session.buttons.map((btn: Button) => (
        <ButtonEditor key={btn.type} btn={btn} onSaved={load} />
      ))}
    </div>
  );
}
