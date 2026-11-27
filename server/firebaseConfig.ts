import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logServerEvent } from './logger.ts';

export interface FirebaseRuntimeConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
}

let cachedConfig: FirebaseRuntimeConfig | null = null;

function tryReadConfigFile(filePath: string): Partial<FirebaseRuntimeConfig> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<FirebaseRuntimeConfig>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function getFirebaseRuntimeConfig(): FirebaseRuntimeConfig {
  if (cachedConfig) return cachedConfig;

  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(process.cwd(), '..', 'firebase-applet-config.json'),
  ];

  try {
    if (typeof import.meta?.url === 'string' && import.meta.url) {
      const moduleDir = path.dirname(fileURLToPath(import.meta.url));
      candidates.push(
        path.resolve(moduleDir, 'firebase-applet-config.json'),
        path.resolve(moduleDir, '..', 'firebase-applet-config.json')
      );
    }
  } catch {
    // Ignore URL resolution issues in non-file module contexts
  }

  let fileData: Partial<FirebaseRuntimeConfig> = {};
  let loadedFromFile = false;

  for (const candidate of candidates) {
    const parsed = tryReadConfigFile(candidate);
    if (parsed) {
      fileData = parsed;
      loadedFromFile = true;
      break;
    }
  }

  cachedConfig = {
    projectId: (process.env.FIREBASE_PROJECT_ID || fileData.projectId || '').trim(),
    appId: (process.env.FIREBASE_APP_ID || fileData.appId || '').trim(),
    apiKey: (process.env.FIREBASE_API_KEY || fileData.apiKey || '').trim(),
    authDomain: (process.env.FIREBASE_AUTH_DOMAIN || fileData.authDomain || '').trim(),
    firestoreDatabaseId: (
      process.env.FIREBASE_DATABASE_ID ||
      fileData.firestoreDatabaseId ||
      '(default)'
    ).trim(),
    storageBucket: (fileData.storageBucket || '').trim(),
    messagingSenderId: (fileData.messagingSenderId || '').trim(),
  };

  logServerEvent('info', 'firebase_config_loaded', {
    loadedFromFile,
    hasProjectId: Boolean(cachedConfig.projectId),
    hasApiKey: Boolean(cachedConfig.apiKey),
    firestoreDatabaseId: cachedConfig.firestoreDatabaseId || '(default)',
  });

  return cachedConfig;
}
