// Cookieless, privacy-first usage analytics. Events are written straight to a
// Firestore `metrics` collection via its REST API using `fetch` — so, unlike
// the auth/sync code, this pulls in *none* of the Firebase SDK and adds no
// bundle weight for anyone.
//
// Privacy posture (designed to avoid needing a consent banner under UK/EU
// PECR): we never store a persistent identifier on the device. The only state
// is a per-tab session id in `sessionStorage`, which is cleared when the tab
// closes and is not a durable cross-visit identifier — the same approach used
// by banner-free tools like Cloudflare Web Analytics and Plausible.
// - No cookies, no `localStorage`, no cross-session tracking.
// - We honour the browser's Do-Not-Track signal and send nothing when it's set.
// - When Firebase isn't configured (dev/CI/tests), every function is a no-op.
//
// The collection is create-only and read-locked by Firestore rules (see the
// README), so events can't be scraped and the owner reads them via the console.

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
const COLLECTION = 'metrics';

const SID_KEY = 'gamebox:analytics:sid';
const VISIT_KEY = 'gamebox:analytics:visited';

type Primitive = string | number | boolean;
type EventData = Record<string, Primitive | undefined>;

/** Whether analytics has enough config to send anything. */
function isConfigured(): boolean {
  return Boolean(PROJECT_ID && API_KEY);
}

/** Respect the browser's Do-Not-Track preference. */
function doNotTrack(): boolean {
  if (typeof navigator === 'undefined') return false;
  const dnt =
    navigator.doNotTrack ??
    (typeof window !== 'undefined' ? (window as { doNotTrack?: string }).doNotTrack : undefined);
  return dnt === '1' || dnt === 'yes';
}

/** Computed once: analytics is only active when configured and not DNT. */
const enabled = isConfigured() && !doNotTrack();

/**
 * A per-tab-session id; a fresh visit gets a new one and it's cleared when the
 * tab closes. This is deliberately *not* persisted across sessions so no
 * durable device identifier is stored (keeping us in the banner-free,
 * privacy-preserving analytics category).
 */
function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SID_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

/** Convert a flat data object into Firestore REST typed `fields`. Exported for tests. */
export function toFirestoreFields(data: EventData): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (typeof value === 'string') fields[key] = { stringValue: value };
    else if (typeof value === 'boolean') fields[key] = { booleanValue: value };
    else if (Number.isInteger(value)) fields[key] = { integerValue: String(value) };
    else fields[key] = { doubleValue: value };
  }
  return fields;
}

/** Fire-and-forget an event document. Never throws. */
function send(type: string, data: EventData = {}): void {
  if (!enabled) return;
  const fields = {
    ...toFirestoreFields({ type, sid: sessionId(), ...data }),
    ts: { timestampValue: new Date().toISOString() },
  };
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}?key=${API_KEY}`;
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break the app.
  }
}

/** Record a site visit, once per browser session. */
export function trackVisit(): void {
  if (!enabled) return;
  try {
    if (sessionStorage.getItem(VISIT_KEY)) return;
    sessionStorage.setItem(VISIT_KEY, '1');
  } catch {
    // If storage is unavailable, still record the visit (may double-count).
  }
  send('visit');
}

export interface GameStartedEvent {
  game: string;
  mode: string;
  difficulty: string;
}

/** Record that a puzzle was started. */
export function trackGameStarted(event: GameStartedEvent): void {
  send('game_started', { ...event });
}

export interface GameCompletedEvent extends GameStartedEvent {
  durationMs: number;
  won?: boolean;
}

/** Record that a puzzle was completed (solve time in `durationMs`). */
export function trackGameCompleted(event: GameCompletedEvent): void {
  send('game_completed', { ...event, won: event.won ?? true });
}
