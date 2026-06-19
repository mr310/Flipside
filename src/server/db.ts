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

  CREATE TABLE IF NOT EXISTS site_visits (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    browser_latitude REAL,
    browser_longitude REAL,
    ip_address TEXT,
    ip_country TEXT,
    ip_region TEXT,
    ip_city TEXT,
    ip_latitude REAL,
    ip_longitude REAL
  );
`);

const existingSiteVisitColumns = new Set(
  db.prepare<{ name: string }, []>('PRAGMA table_info(site_visits)').all().map((row) => row.name),
);
const addColumn = (name: string, definition: string) => {
  if (!existingSiteVisitColumns.has(name)) {
    db.exec(`ALTER TABLE site_visits ADD COLUMN ${name} ${definition}`);
  }
};

addColumn('browser_latitude', 'REAL');
addColumn('browser_longitude', 'REAL');
addColumn('ip_address', 'TEXT');
addColumn('ip_country', 'TEXT');
addColumn('ip_region', 'TEXT');
addColumn('ip_city', 'TEXT');
addColumn('ip_latitude', 'REAL');
addColumn('ip_longitude', 'REAL');

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

export interface Visit {
  id: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  ip_address: string | null;
  ip_country: string | null;
  ip_region: string | null;
  ip_city: string | null;
  ip_latitude: number | null;
  ip_longitude: number | null;
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

  duplicateSession(existingSessionId: string): string {
    const session = db.prepare<Session, [string]>('SELECT * FROM sessions WHERE id = ?').get(existingSessionId);
    if (!session) throw new Error('Sessione non trovata');

    const newSessionId = crypto.randomUUID();
    db.prepare('INSERT INTO sessions (id, date, label) VALUES (?, ?, ?)')
      .run(newSessionId, session.date, session.label);

    const buttons = db.prepare<Button, [string]>('SELECT * FROM buttons WHERE session_id = ?').all(existingSessionId);
    for (const button of buttons) {
      db.prepare(
        'INSERT INTO buttons (id, session_id, type, display_label, page_text, link_url, is_disabled, qr_clicked) VALUES (?, ?, ?, ?, ?, ?, ?, ?)' 
      ).run(
        crypto.randomUUID(),
        newSessionId,
        button.type,
        button.display_label,
        button.page_text,
        button.link_url,
        0,
        0,
      );
    }

    return newSessionId;
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

  logVisit(
    browserLatitude: number | null,
    browserLongitude: number | null,
    ipAddress: string | null,
    ipCountry: string | null,
    ipRegion: string | null,
    ipCity: string | null,
    ipLatitude: number | null,
    ipLongitude: number | null,
  ) {
    db.prepare(
      'INSERT INTO site_visits (id, browser_latitude, browser_longitude, ip_address, ip_country, ip_region, ip_city, ip_latitude, ip_longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      crypto.randomUUID(),
      browserLatitude,
      browserLongitude,
      ipAddress,
      ipCountry,
      ipRegion,
      ipCity,
      ipLatitude,
      ipLongitude,
    );
  },

  getVisitCount: db.prepare<{ count: number }, []>(
    'SELECT COUNT(*) AS count FROM site_visits',
  ),

  getRecentVisits: db.prepare<Visit, []>(
    'SELECT id, created_at, browser_latitude AS latitude, browser_longitude AS longitude, ip_address, ip_country, ip_region, ip_city, ip_latitude, ip_longitude FROM site_visits ORDER BY created_at DESC LIMIT 20',
  ),
};
