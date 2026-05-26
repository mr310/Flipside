import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { queries } from './db';
import { createHash } from 'crypto';
import { join } from 'path';

const DIST = join(process.cwd(), 'dist/client');

const app = new Hono();

app.use('/api/*', cors());

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'flipside-dev-secret';
const VALID_TOKEN = createHash('sha256').update(ADMIN_PASSWORD + ADMIN_SECRET).digest('hex');

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

admin.put('/sessions/:id', async (c) => {
  const { date, label } = await c.req.json<{ date: string; label: string }>();
  queries.updateSession.run(date, label, c.req.param('id'));
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
