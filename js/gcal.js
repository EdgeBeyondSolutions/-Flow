const GIS_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = '792931558499-f16bghuikh65rdbmk1ekdb9cflocu105.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;
let gisReady = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function initGis() {
  if (!gisReady) {
    gisReady = loadScript(GIS_SRC).then(() => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: () => {},
      });
    });
  }
  return gisReady;
}

export function isConnected() {
  return !!accessToken && Date.now() < tokenExpiry;
}

export async function connect(interactive = true) {
  await initGis();
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in * 1000) - 60000;
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

async function ensureToken() {
  if (isConnected()) return accessToken;
  return connect(true);
}

async function apiFetch(path, opts = {}) {
  const token = await ensureToken();
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Calendar API ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

export async function listCalendars() {
  const data = await apiFetch('/users/me/calendarList?maxResults=250');
  return data.items || [];
}

export async function listEvents(calendarId, timeMinISO, timeMaxISO) {
  const params = new URLSearchParams({ timeMin: timeMinISO, timeMax: timeMaxISO, singleEvents: 'true', orderBy: 'startTime' });
  const data = await apiFetch(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  return data.items || [];
}

export async function listEventsFromCalendars(calendarIds, timeMinISO, timeMaxISO) {
  const results = await Promise.all(calendarIds.map(async (id) => {
    try {
      const events = await listEvents(id, timeMinISO, timeMaxISO);
      return events.map((e) => ({ ...e, __calendarId: id }));
    } catch {
      return [];
    }
  }));
  return results.flat();
}

export async function createEvent(calendarId, event) {
  return apiFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body: JSON.stringify(event) });
}

export async function updateEvent(calendarId, eventId, event) {
  return apiFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(event) });
}

export async function deleteEvent(calendarId, eventId) {
  try {
    await apiFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, { method: 'DELETE' });
  } catch {
    // already deleted or inaccessible — ignore
  }
}
