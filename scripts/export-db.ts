import { Database } from 'bun:sqlite';
import { join } from 'path';

const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), 'flipside.db');
const db = new Database(DB_PATH);

const sessions = db.prepare('SELECT * FROM sessions').all() as any[];
const buttons = db.prepare('SELECT * FROM buttons').all() as any[];

const lines: string[] = [];

for (const s of sessions) {
  lines.push(
    `INSERT OR REPLACE INTO sessions (id, date, label, created_at) VALUES ('${s.id}', '${s.date}', '${s.label.replace(/'/g, "''")}', '${s.created_at}');`
  );
}

for (const b of buttons) {
  lines.push(
    `INSERT OR REPLACE INTO buttons (id, session_id, type, display_label, page_text, link_url, is_disabled, qr_clicked) VALUES ('${b.id}', '${b.session_id}', '${b.type}', '${b.display_label.replace(/'/g, "''")}', '${b.page_text.replace(/'/g, "''")}', '${b.link_url.replace(/'/g, "''")}', ${b.is_disabled}, ${b.qr_clicked});`
  );
}

const sql = lines.join('\n');
await Bun.write('seed.sql', sql);
console.log(`Esportate ${sessions.length} sessioni e ${buttons.length} pulsanti → seed.sql`);
