import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { queries } from './db';
import { createHash } from 'crypto';
import { join, resolve, extname } from 'path';
import { readdir } from 'fs/promises';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

const DIST = join(process.cwd(), 'dist/client');

const app = new Hono();

app.use('/api/*', cors());

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'flipside-dev-secret';
const VALID_TOKEN = createHash('sha256').update(ADMIN_PASSWORD + ADMIN_SECRET).digest('hex');

// ── Telegram (GramJS userbot) ────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.avif', '.tiff', '.tif']);

let _tgClient: TelegramClient | null = null;

async function getTelegramClient(): Promise<TelegramClient> {
  if (_tgClient?.connected) return _tgClient;

  const apiId   = parseInt(process.env.TELEGRAM_API_ID   ?? '');
  const apiHash = process.env.TELEGRAM_API_HASH ?? '';
  const session = process.env.TELEGRAM_SESSION  ?? '';

  if (!apiId || !apiHash || !session) {
    throw new Error('Telegram non configurato: imposta TELEGRAM_API_ID, TELEGRAM_API_HASH e TELEGRAM_SESSION');
  }

  _tgClient = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
  await _tgClient.connect();
  return _tgClient;
}

async function sendTelegram(to: string, message: string): Promise<void> {
  const client = await getTelegramClient();
  await client.sendMessage(to, { message });
}

// ── Public routes ────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (c) => {
  const { password } = await c.req.json<{ password: string }>();
  if (password === ADMIN_PASSWORD) return c.json({ token: VALID_TOKEN });
  return c.json({ error: 'Password errata' }, 401);
});

app.get('/api/sessions', (c) => {
  return c.json(queries.getSessions.all());
});

app.get('/api/sessions/:id', (c) => {
  const session = queries.getSession.get(c.req.param('id'));
  if (!session) return c.json({ error: 'Non trovato' }, 404);
  const buttons = queries.getButtons.all(session.id);
  return c.json({ ...session, buttons });
});

app.get('/api/sessions/:sessionId/buttons/:type', (c) => {
  const btn = queries.getButton.get(c.req.param('sessionId'), c.req.param('type'));
  if (!btn) return c.json({ error: 'Non trovato' }, 404);
  return c.json(btn);
});

app.post('/api/sessions/:sessionId/gallery/request-otp', async (c) => {
  const sessionId = c.req.param('sessionId');
  const session = queries.getSession.get(sessionId);
  if (!session) return c.json({ error: 'Sessione non trovata' }, 404);
  if (!session.gallery_folder_path) return c.json({ error: 'Galleria non configurata' }, 404);
  if (!session.gallery_phone_numbers) return c.json({ error: 'Nessun numero Telegram configurato per questa galleria' }, 404);

  const otp = queries.generateGalleryOTP(sessionId);
  const recipients = session.gallery_phone_numbers.split(',').map((e: string) => e.trim()).filter(Boolean);
  const message = `Il tuo codice per accedere alla galleria "${session.label}" è:\n\n*${otp}*\n\nValido per 5 minuti.`;

  const sendErrors: string[] = [];
  let lastError = '';
  for (const to of recipients) {
    await sendTelegram(to, message).catch((err: Error) => {
      lastError = err.message;
      console.error(`[Telegram] Errore invio a ${to}:`, err.message);
      sendErrors.push(to);
    });
  }

  if (sendErrors.length === recipients.length) {
    return c.json({ error: `Impossibile inviare OTP via Telegram: ${lastError}` }, 500);
  }

  return c.json({ success: true, message: 'OTP inviato via Telegram' });
});

app.post('/api/sessions/:sessionId/gallery/verify-otp', async (c) => {
  const { otp_code } = await c.req.json<{ otp_code: string }>();
  const sessionId = c.req.param('sessionId');

  const isValid = queries.validateGalleryOTP(sessionId, otp_code);
  if (!isValid) return c.json({ error: 'OTP non valido o scaduto' }, 401);

  const session = queries.getSession.get(sessionId);
  if (!session) return c.json({ error: 'Sessione non trovata' }, 404);

  const gallery_token = queries.generateGalleryToken(sessionId);

  return c.json({ success: true, folder_path: session.gallery_folder_path, gallery_token });
});

app.get('/api/sessions/:sessionId/gallery/photos', async (c) => {
  const sessionId = c.req.param('sessionId');
  const token = c.req.query('token');
  if (!token) return c.json({ error: 'Token mancante' }, 401);

  const access = queries.getGalleryToken.get(sessionId, token);
  if (!access) return c.json({ error: 'Token non valido o scaduto' }, 401);

  const session = queries.getSession.get(sessionId);
  if (!session?.gallery_folder_path) return c.json({ error: 'Galleria non configurata' }, 404);

  const folderPath = session.gallery_folder_path;

  if (folderPath.startsWith('http://') || folderPath.startsWith('https://')) {
    return c.json({ type: 'external', url: folderPath, photos: [] });
  }

  try {
    const files = await readdir(folderPath);
    const photos = files
      .filter(f => IMAGE_EXTENSIONS.has(extname(f).toLowerCase()))
      .sort()
      .map(f => ({
        name: f,
        url: `/api/gallery/image?session=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}&file=${encodeURIComponent(f)}`,
      }));
    return c.json({ type: 'local', photos });
  } catch {
    return c.json({ error: 'Impossibile leggere la cartella galleria' }, 500);
  }
});

app.get('/api/gallery/image', async (c) => {
  const sessionId = c.req.query('session');
  const token = c.req.query('token');
  const file = c.req.query('file');
  if (!sessionId || !token || !file) return c.json({ error: 'Parametri mancanti' }, 400);

  const access = queries.getGalleryToken.get(sessionId, token);
  if (!access) return c.json({ error: 'Token non valido' }, 401);

  const session = queries.getSession.get(sessionId);
  if (!session?.gallery_folder_path) return c.notFound();

  const folderPath = session.gallery_folder_path;
  const safeName = file.replace(/\.\./g, '');
  const imagePath = join(folderPath, safeName);
  const resolvedImage = resolve(imagePath);
  const resolvedFolder = resolve(folderPath);

  if (!resolvedImage.startsWith(resolvedFolder + '/') && resolvedImage !== resolvedFolder) {
    return c.json({ error: 'Percorso non valido' }, 400);
  }

  const bunFile = Bun.file(resolvedImage);
  if (!(await bunFile.exists())) return c.notFound();
  return new Response(bunFile);
});

function getClientIp(c: Context): string | null {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim() || null;
  }
  return (
    c.req.header('x-real-ip') ??
    c.req.header('cf-connecting-ip') ??
    c.req.header('true-client-ip') ??
    null
  );
}

async function lookupIpLocation(ip: string | null) {
  if (!ip) return null;

  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      country_name?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      error?: boolean;
    };
    if (data.error) return null;
    return {
      country: data.country_name ?? null,
      region: data.region ?? null,
      city: data.city ?? null,
      latitude: typeof data.latitude === 'number' ? data.latitude : null,
      longitude: typeof data.longitude === 'number' ? data.longitude : null,
    };
  } catch {
    return null;
  }
}

app.post('/api/sessions/:sessionId/buttons/:type/click', (c) => {
  const { sessionId, type } = c.req.param();
  const btn = queries.getButton.get(sessionId, type);
  if (!btn) return c.json({ error: 'Non trovato' }, 404);
  if (btn.is_disabled) return c.json({ error: 'Pulsante disabilitato' }, 403);
  queries.clickQR(sessionId, type);
  return c.json({ success: true });
});

app.post('/api/visits', async (c) => {
  const { latitude, longitude } = await c.req.json<{
    latitude?: number | null;
    longitude?: number | null;
  }>();

  const ipAddress = getClientIp(c);
  const ipLocation = await lookupIpLocation(ipAddress);

  queries.logVisit(
    latitude ?? null,
    longitude ?? null,
    ipAddress,
    ipLocation?.country ?? null,
    ipLocation?.region ?? null,
    ipLocation?.city ?? null,
    ipLocation?.latitude ?? null,
    ipLocation?.longitude ?? null,
  );

  return c.json({ success: true });
});

// ── Admin middleware ─────────────────────────────────────────────────────────

const admin = new Hono();

admin.use('/*', async (c, next) => {
  const auth = c.req.header('Authorization') ?? '';
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== VALID_TOKEN) {
    return c.json({ error: 'Non autorizzato' }, 401);
  }
  await next();
});

admin.get('/sessions', (c) => c.json(queries.getSessions.all()));

admin.get('/sessions/:id', (c) => {
  const session = queries.getSession.get(c.req.param('id'));
  if (!session) return c.json({ error: 'Non trovato' }, 404);
  const buttons = queries.getButtons.all(session.id);
  return c.json({ ...session, buttons });
});

admin.get('/visits', (c) => {
  const summary = queries.getVisitCount.get();
  const visits = queries.getRecentVisits.all();
  return c.json({ count: Number(summary.count ?? 0), visits });
});

admin.post('/sessions', async (c) => {
  const { date, label } = await c.req.json<{ date: string; label: string }>();
  const id = queries.createSession(date, label);
  return c.json({ id }, 201);
});

admin.post('/sessions/:id/duplicate', (c) => {
  const id = queries.duplicateSession(c.req.param('id'));
  return c.json({ id }, 201);
});

admin.put('/sessions/:id', async (c) => {
  const { date, label } = await c.req.json<{ date: string; label: string }>();
  queries.updateSession.run(date, label, c.req.param('id'));
  return c.json({ success: true });
});

admin.put('/sessions/:id/gallery', async (c) => {
  const { gallery_folder_path, gallery_phone_numbers } = await c.req.json<{ 
    gallery_folder_path: string | null; 
    gallery_phone_numbers: string | null;
  }>();
  queries.updateSessionGallery.run(gallery_folder_path, gallery_phone_numbers, c.req.param('id'));
  return c.json({ success: true });
});

admin.delete('/sessions/:id', (c) => {
  queries.deleteSession.run(c.req.param('id'));
  return c.json({ success: true });
});

admin.put('/sessions/:sessionId/buttons/:type', async (c) => {
  const { display_label, page_text, link_url } = await c.req.json<{
    display_label: string;
    page_text: string;
    link_url: string;
  }>();
  queries.updateButton.run(display_label, page_text, link_url, c.req.param('sessionId'), c.req.param('type'));
  return c.json({ success: true });
});

admin.post('/sessions/:id/reset', (c) => {
  queries.resetSession.run(c.req.param('id'));
  return c.json({ success: true });
});

admin.post('/buttons/:id/reset', (c) => {
  queries.resetButton.run(c.req.param('id'));
  return c.json({ success: true });
});

admin.get('/telegram/status', (c) => {
  const apiId   = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const session = process.env.TELEGRAM_SESSION;
  if (!apiId || !apiHash || !session) {
    return c.json({ configured: false, error: 'Variabili TELEGRAM_API_ID, TELEGRAM_API_HASH e TELEGRAM_SESSION non impostate' });
  }
  return c.json({ configured: true });
});

admin.post('/telegram/test', async (c) => {
  const { to } = await c.req.json<{ to: string }>();
  if (!to) return c.json({ error: 'Destinatario obbligatorio (numero +39... o @username)' }, 400);
  try {
    await sendTelegram(to, 'Messaggio di test da FlipSide ✓');
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.route('/api/admin', admin);

// ── Static files (production) ────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  app.get('/assets/*', async (c) => {
    try {
      const file = Bun.file(join(DIST, c.req.path));
      if (!(await file.exists())) return c.notFound();
      return new Response(file);
    } catch {
      return c.notFound();
    }
  });

  app.get('*', async () => {
    try {
      const html = await Bun.file(join(DIST, 'index.html')).text();
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (e) {
      console.error('index.html non trovato in', DIST, e);
      return new Response('Build non trovata. Esegui bun run build.', { status: 500 });
    }
  });
}

const PORT = Number(process.env.PORT ?? 3010);
console.log(`Server in ascolto sulla porta ${PORT}`);
if (process.env.NODE_ENV === 'production') console.log(`Serving static files da: ${DIST}`);

export default { port: PORT, fetch: app.fetch };
