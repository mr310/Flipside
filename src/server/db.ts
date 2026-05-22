import { Database } from 'bun:sqlite';
import { join } from 'path';

const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), 'flipside.db');
export const db = new Database(DB_PATH, { create: true });

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS buttons (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('play','ffw','playpause','stop')),
    display_label TEXT NOT NULL DEFAULT '',
    page_text TEXT NOT NULL DEFAULT '',
    link_url TEXT NOT NULL DEFAULT '',
    is_disabled INTEGER NOT NULL DEFAULT 0,
    qr_clicked INTEGER NOT NULL DEFAULT 0,
    UNIQUE(session_id, type)
  );
`);

const BUTTON_TYPES = ['play', 'ffw', 'playpause', 'stop'] as const;
export type ButtonType = (typeof BUTTON_TYPES)[number];

function ensureButtons(sessionId: string) {
  for (const type of BUTTON_TYPES) {
    const existing = db
      .prepare('SELECT id FROM buttons WHERE session_id = ? AND type = ?')
      .get(sessionId, type);
    if (!existing) {
      db.prepare(
        'INSERT INTO buttons (id, session_id, type) VALUES (?, ?, ?)',
      ).run(crypto.randomUUID(), sessionId, type);
    }
  }
}

export interface Session {
  id: string;
  date: string;
  label: string;
  created_at: string;
}

export interface Button {
  id: string;
  session_id: string;
  type: ButtonType;
  display_label: string;
  page_text: string;
  link_url: string;
  is_disabled: number;
  qr_clicked: number;
}

export const queries = {
  getSessions: db.prepare<Session, []>('SELECT * FROM sessions ORDER BY date ASC, created_at ASC'),

  getSession: db.prepare<Session, [string]>('SELECT * FROM sessions WHERE id = ?'),

  createSession(date: string, label: string): string {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO sessions (id, date, label) VALUES (?, ?, ?)').run(id, date, label);
    ensureButtons(id);
    return id;
  },

  updateSession: db.prepare('UPDATE sessions SET date = ?, label = ? WHERE id = ?'),

  deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),

  getButtons: db.prepare<Button, [string]>(
    `SELECT * FROM buttons WHERE session_id = ?
     ORDER BY CASE type WHEN 'play' THEN 1 WHEN 'ffw' THEN 2 WHEN 'playpause' THEN 3 WHEN 'stop' THEN 4 END`,
  ),

  getButton: db.prepare<Button, [string, string]>(
    'SELECT * FROM buttons WHERE session_id = ? AND type = ?',
  ),

  updateButton: db.prepare(
    'UPDATE buttons SET display_label = ?, page_text = ?, link_url = ? WHERE session_id = ? AND type = ?',
  ),

  clickQR(sessionId: string, buttonType: string) {
    db.prepare('UPDATE buttons SET qr_clicked = 1 WHERE session_id = ? AND type = ?').run(sessionId, buttonType);
    db.prepare('UPDATE buttons SET is_disabled = 1 WHERE session_id = ? AND type != ?').run(sessionId, buttonType);
  },

  resetSession: db.prepare('UPDATE buttons SET is_disabled = 0, qr_clicked = 0 WHERE session_id = ?'),

  resetButton: db.prepare('UPDATE buttons SET is_disabled = 0, qr_clicked = 0 WHERE id = ?'),
};
