import type { Express } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/app.ts';
import { logServerError, logServerEvent } from '../server/logger.ts';

let cachedApp: Express | null = null;

function getOrCreateApp(): Express {
  if (!cachedApp) {
    cachedApp = createApiApp();
  }
  return cachedApp;
}

function sendJsonError(res: ServerResponse, statusCode: number, message: string): void {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(
    JSON.stringify({
      ok: false,
      error: message,
    })
  );
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const rawUrl = req.url || '/api';
  try {
    const urlObj = new URL(rawUrl, 'http://localhost');
    const pathParam = urlObj.searchParams.get('__vercel_path');
    if (pathParam !== null) {
      urlObj.searchParams.delete('__vercel_path');
      const cleanedPath = pathParam.replace(/^\/+/, '');
      const qs = urlObj.searchParams.toString();
      if (
        urlObj.pathname === '/api' ||
        urlObj.pathname === '/api/' ||
        urlObj.pathname === '/api/index'
      ) {
        req.url = `/api/${cleanedPath}${qs ? `?${qs}` : ''}`;
      } else {
        req.url = `${urlObj.pathname}${qs ? `?${qs}` : ''}`;
      }
    }
  } catch {
    // Keep original req.url if URL parsing fails
  }

  logServerEvent('info', 'vercel_handler_invoked', {
    method: req.method || 'GET',
    url: req.url || '/api',
  });

  let app: Express;
  try {
    app = getOrCreateApp();
  } catch (err) {
    logServerError('vercel_app_init_error', err, { url: req.url || '/api' });
    sendJsonError(
      res,
      500,
      err instanceof Error
        ? `Server initialization failed: ${err.message}`
        : 'Server initialization failed'
    );
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      res.removeListener('finish', finish);
      res.removeListener('close', finish);
      resolve();
    };

    res.on('finish', finish);
    res.on('close', finish);

    try {
      app(
        req as unknown as Parameters<typeof app>[0],
        res as unknown as Parameters<typeof app>[1],
        (err?: unknown) => {
          if (err) {
            logServerError('vercel_express_unhandled_error', err, {
              url: req.url || '/api',
            });
            sendJsonError(
              res,
              500,
              err instanceof Error ? err.message : 'Internal server error'
            );
          } else if (!res.headersSent) {
            sendJsonError(res, 404, 'API endpoint not found');
          }
          finish();
        }
      );
    } catch (err) {
      logServerError('vercel_handler_sync_error', err, { url: req.url || '/api' });
      sendJsonError(
        res,
        500,
        err instanceof Error ? err.message : 'Internal server error'
      );
      finish();
    }
  });
}
