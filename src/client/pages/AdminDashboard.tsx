import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  adminGetSessions,
  adminDeleteSession,
  adminResetSession,
  adminCreateSession,
  type Session,
} from '../api';

interface NewSessionForm { date: string; label: string }

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewSessionForm>({ date: '', label: '' });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const load = () =>
    adminGetSessions()
      .then(setSessions)
      .catch(() => navigate('/admin'))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.date || !form.label) return;
    setSaving(true);
    try {
      await adminCreateSession(form.date, form.label);
      setShowModal(false);
      setForm({ date: '', label: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questa sessione?')) return;
    await adminDeleteSession(id);
    load();
  };

  const handleReset = async (id: string) => {
    await adminResetSession(id);
    load();
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin');
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="page">
      <div className="section-header">
        <h1 className="section-title">Dashboard Admin</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            + Nuova sessione
          </button>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            Esci
          </button>
        </div>
      </div>

      {loading ? (
        <p className="loading">Caricamento...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Label</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ color: 'var(--muted)' }}>Nessuna sessione</td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'VT323, monospace', fontSize: '1.1rem', color: 'var(--accent)' }}>
                    {formatDate(s.date)}
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{s.label}</td>
                  <td>
                    <div className="actions">
                      <Link to={`/admin/sessions/${s.id}`}>
                        <button className="btn btn-ghost btn-sm">Modifica</button>
                      </Link>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleReset(s.id)}>
                        Reset
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2 className="modal-title">Nuova Sessione</h2>
            <div className="form-group">
              <label>Data</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Label</label>
              <input
                type="text"
                value={form.label}
                placeholder="es. Concerto Primavera"
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleCreate}>
                {saving ? 'Salvataggio...' : 'Crea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
