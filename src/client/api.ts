function authHeader(): Record<string, string> {
  const token = localStorage.getItem('adminToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
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
  type: string;
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

export interface VisitSummary {
  count: number;
  visits: Visit[];
}

export interface SessionWithButtons extends Session {
  buttons: Button[];
}

export const getSessions = () =>
  fetch('/api/sessions').then((r) => json<Session[]>(r));

export const getSession = (id: string) =>
  fetch(`/api/sessions/${id}`).then((r) => json<SessionWithButtons>(r));

export const getButton = (sessionId: string, type: string) =>
  fetch(`/api/sessions/${sessionId}/buttons/${type}`).then((r) => json<Button>(r));

export const clickQR = (sessionId: string, type: string) =>
  fetch(`/api/sessions/${sessionId}/buttons/${type}/click`, { method: 'POST' }).then((r) =>
    json<{ success: boolean }>(r),
  );

export const logVisit = (latitude?: number, longitude?: number) =>
  fetch('/api/visits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude, longitude }),
  }).then((r) => json<{ success: boolean }>(r));

export const login = (password: string) =>
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then((r) => json<{ token: string }>(r));

export const adminGetSessions = () =>
  fetch('/api/admin/sessions', { headers: authHeader() }).then((r) => json<Session[]>(r));

export const adminGetSession = (id: string) =>
  fetch(`/api/admin/sessions/${id}`, { headers: authHeader() }).then((r) =>
    json<SessionWithButtons>(r),
  );

export const adminGetVisits = () =>
  fetch('/api/admin/visits', { headers: authHeader() }).then((r) => json<VisitSummary>(r));

export const adminCreateSession = (date: string, label: string) =>
  fetch('/api/admin/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ date, label }),
  }).then((r) => json<{ id: string }>(r));

export const adminUpdateSession = (id: string, date: string, label: string) =>
  fetch(`/api/admin/sessions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ date, label }),
  }).then((r) => json<{ success: boolean }>(r));

export const adminDeleteSession = (id: string) =>
  fetch(`/api/admin/sessions/${id}`, {
    method: 'DELETE',
    headers: authHeader(),
  }).then((r) => json<{ success: boolean }>(r));

export const adminUpdateButton = (
  sessionId: string,
  type: string,
  display_label: string,
  page_text: string,
  link_url: string,
) =>
  fetch(`/api/admin/sessions/${sessionId}/buttons/${type}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ display_label, page_text, link_url }),
  }).then((r) => json<{ success: boolean }>(r));

export const adminResetSession = (id: string) =>
  fetch(`/api/admin/sessions/${id}/reset`, {
    method: 'POST',
    headers: authHeader(),
  }).then((r) => json<{ success: boolean }>(r));

export const adminResetButton = (id: string) =>
  fetch(`/api/admin/buttons/${id}/reset`, {
    method: 'POST',
    headers: authHeader(),
  }).then((r) => json<{ success: boolean }>(r));
