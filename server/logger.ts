type LogLevel = 'info' | 'warn' | 'error';

const REDACTED_KEYS = new Set([
  'apikey',
  'api_key',
  'gemini_api_key',
  'firebase_api_key',
  'google_maps_api_key',
  'authorization',
  'token',
  'idtoken',
  'password',
  'secret',
  'sync_webhook_secret',
  'email',
  'phone',
]);

function sanitizeMeta(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 3) return '[truncated]';
  if (typeof value === 'string') {
    if (/^(AIza|sk-|ghp_|Bearer\s+)/i.test(value.trim())) {
      return '[redacted]';
    }
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeMeta(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const normalized = k.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (REDACTED_KEYS.has(normalized)) {
        out[k] = '[redacted]';
      } else {
        out[k] = sanitizeMeta(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export function logServerEvent(
  level: LogLevel,
  stage: string,
  meta: Record<string, unknown> = {}
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'wcr-dubai-api',
    stage,
    ...(sanitizeMeta(meta) as Record<string, unknown>),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logServerError(
  stage: string,
  err: unknown,
  meta: Record<string, unknown> = {}
): void {
  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorStack =
    err instanceof Error && err.stack ? err.stack.slice(0, 2000) : undefined;
  logServerEvent('error', stage, {
    ...meta,
    errorMessage,
    errorStack,
  });
}
