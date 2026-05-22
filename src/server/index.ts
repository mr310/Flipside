import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { queries } from './db';
import { createHash } from 'crypto';

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

app.post('/api/sessions/:sessionId/buttons/:type/click', (c) => {
  const { sessionId, type } = c.req.param();
  const btn = queries.getButton.get(sessionId, type);
  if (!btn) return c.json({ error: 'Non trovato' }, 404);
  if (btn.is_disabled) return c.json({ error: 'Pulsante disabilitato' }, 403);
  queries.clickQR(sessionId, type);
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
    const filePath = `./dist/client${c.req.path}`;
    const file = Bun.file(filePath);
    if (!(await file.exists())) return c.notFound();
    return new Response(file);
  });

  app.get('*', async () => {
    const file = Bun.file('./dist/client/index.html');
    return new Response(file, { headers: { 'Content-Type': 'text/html' } });
  });
}

const PORT = Number(process.env.PORT ?? 3010);
console.log(`Server in ascolto sulla porta ${PORT}`);

export default { port: PORT, fetch: app.fetch };
