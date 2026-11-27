import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/app.ts';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const rawUrl = req.url || '/api';
  try {
    const urlObj = new URL(rawUrl, 'http://localhost');
    const pathParam = urlObj.searchParams.get('__vercel_path');
    if (pathParam !== null) {
      urlObj.searchParams.delete('__vercel_path');
      const cleanedPath = pathParam.replace(/^\/+/, '');
      const qs = urlObj.searchParams.toString();
      if (urlObj.pathname === '/api' || urlObj.pathname === '/api/') {
        req.url = `/api/${cleanedPath}${qs ? `?${qs}` : ''}`;
      } else {
        req.url = `${urlObj.pathname}${qs ? `?${qs}` : ''}`;
      }
    }
  } catch {
    // Keep original req.url if URL parsing fails
  }

  return app(
    req as unknown as Parameters<typeof app>[0],
    res as unknown as Parameters<typeof app>[1]
  );
}
