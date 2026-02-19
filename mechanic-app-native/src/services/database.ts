import { ScanSession, DTCResult, RawECUResponse } from '../types';
import { logger, generateId } from './logger';

const MODULE = 'DATABASE';

// In-memory storage - works on all platforms including web preview
// On native builds, can be swapped with expo-sqlite for persistence
const store: {
  sessions: ScanSession[];
} = { sessions: [] };

let isInitialized = false;

export async function initDatabase(): Promise<void> {
  if (isInitialized) return;
  logger.info(MODULE, 'Database initialized (in-memory storage)', {
    note: 'Using in-memory storage. For persistence, use expo-sqlite in native builds.',
  });
  isInitialized = true;
}

export async function saveScanSession(session: ScanSession): Promise<void> {
  await initDatabase();

  const existing = store.sessions.findIndex((s) => s.id === session.id);
  if (existing >= 0) {
    store.sessions[existing] = { ...session };
  } else {
    store.sessions.unshift({ ...session });
  }

  logger.info(MODULE, 'Scan session saved', {
    sessionId: session.id,
    status: session.status,
    dtcCount: session.storedDTCs.length + session.pendingDTCs.length + session.permanentDTCs.length,
    totalSessions: store.sessions.length,
  });
}

export async function getScanSessions(): Promise<ScanSession[]> {
  await initDatabase();
  return store.sessions.map((s) => ({ ...s }));
}

export async function getScanSession(id: string): Promise<ScanSession | null> {
  await initDatabase();
  const session = store.sessions.find((s) => s.id === id);
  return session ? { ...session } : null;
}

export async function clearAllData(): Promise<void> {
  store.sessions = [];
  logger.info(MODULE, 'All data cleared');
}
