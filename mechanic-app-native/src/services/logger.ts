import { LogEntry, LogLevel, LogLevelNames } from '../types';
import { APP_VERSION, MAX_BREADCRUMBS } from '../constants/theme';

export const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

class LoggerService {
  private static instance: LoggerService;
  private entries: LogEntry[] = [];
  private breadcrumbs: LogEntry[] = [];
  private currentSessionId: string;
  private listeners: ((entry: LogEntry) => void)[] = [];

  private constructor() {
    this.currentSessionId = generateId();
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  setSessionId(id: string): void {
    this.currentSessionId = id;
  }

  getSessionId(): string {
    return this.currentSessionId;
  }

  newSession(): string {
    this.currentSessionId = generateId();
    this.info('LOGGER', 'New session started', { sessionId: this.currentSessionId });
    return this.currentSessionId;
  }

  private createEntry(
    level: LogLevel,
    module: string,
    action: string,
    metadata: Record<string, any> = {}
  ): LogEntry {
    return {
      id: generateId(),
      timestamp: new Date().toISOString(),
      sessionId: this.currentSessionId,
      level,
      levelName: LogLevelNames[level],
      module,
      action,
      metadata,
      appVersion: APP_VERSION,
    };
  }

  private addEntry(entry: LogEntry): void {
    this.entries.push(entry);
    this.breadcrumbs.push(entry);
    if (this.breadcrumbs.length > MAX_BREADCRUMBS) {
      this.breadcrumbs.shift();
    }
    this.listeners.forEach((cb) => {
      try { cb(entry); } catch (_) {}
    });
  }

  trace(module: string, action: string, metadata?: Record<string, any>): void {
    this.addEntry(this.createEntry(LogLevel.TRACE, module, action, metadata));
  }

  debug(module: string, action: string, metadata?: Record<string, any>): void {
    this.addEntry(this.createEntry(LogLevel.DEBUG, module, action, metadata));
  }

  info(module: string, action: string, metadata?: Record<string, any>): void {
    this.addEntry(this.createEntry(LogLevel.INFO, module, action, metadata));
  }

  warn(module: string, action: string, metadata?: Record<string, any>): void {
    this.addEntry(this.createEntry(LogLevel.WARN, module, action, metadata));
  }

  error(module: string, action: string, metadata?: Record<string, any>): void {
    this.addEntry(this.createEntry(LogLevel.ERROR, module, action, metadata));
  }

  fatal(module: string, action: string, metadata?: Record<string, any>): void {
    this.addEntry(this.createEntry(LogLevel.FATAL, module, action, metadata));
  }

  getEntries(filters?: {
    sessionId?: string;
    level?: LogLevel;
    module?: string;
  }): LogEntry[] {
    let result = [...this.entries];
    if (filters?.sessionId) {
      result = result.filter((e) => e.sessionId === filters.sessionId);
    }
    if (filters?.level !== undefined) {
      result = result.filter((e) => e.level >= filters.level!);
    }
    if (filters?.module) {
      result = result.filter((e) => e.module === filters.module);
    }
    return result;
  }

  getBreadcrumbs(): LogEntry[] {
    return [...this.breadcrumbs];
  }

  getSessions(): string[] {
    const sessions = new Set(this.entries.map((e) => e.sessionId));
    return Array.from(sessions);
  }

  getModules(): string[] {
    const modules = new Set(this.entries.map((e) => e.module));
    return Array.from(modules);
  }

  clearEntries(): void {
    this.entries = [];
    this.breadcrumbs = [];
  }

  onEntry(callback: (entry: LogEntry) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  exportAsJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  exportAsTXT(): string {
    return this.entries
      .map((e) => {
        const meta =
          Object.keys(e.metadata).length > 0
            ? ` | ${JSON.stringify(e.metadata)}`
            : '';
        return `${e.timestamp} [${e.levelName}] [${e.module}] ${e.action}${meta}`;
      })
      .join('\n');
  }

  getAllEntries(): LogEntry[] {
    return [...this.entries];
  }

  getEntryCount(): number {
    return this.entries.length;
  }
}

export const logger = LoggerService.getInstance();
