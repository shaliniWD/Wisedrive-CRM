import AsyncStorage from '@react-native-async-storage/async-storage';

// Diagnostic logger for debugging save failures
const LOGS_KEY = '@debug_logs';
const MAX_LOGS = 100;

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'WARN';
  message: string;
  data?: any;
}

class DiagnosticLogger {
  private logs: LogEntry[] = [];
  private initialized = false;

  async init() {
    if (this.initialized) return;
    try {
      const stored = await AsyncStorage.getItem(LOGS_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
      this.initialized = true;
    } catch (e) {
      console.error('Failed to init logger:', e);
    }
  }

  private async persist() {
    try {
      // Keep only last MAX_LOGS entries
      if (this.logs.length > MAX_LOGS) {
        this.logs = this.logs.slice(-MAX_LOGS);
      }
      await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to persist logs:', e);
    }
  }

  log(level: 'INFO' | 'ERROR' | 'WARN', message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? this.sanitizeData(data) : undefined,
    };
    
    this.logs.push(entry);
    
    // Also log to console
    if (level === 'ERROR') {
      console.error(`[DIAG] ${message}`, data);
    } else {
      console.log(`[DIAG] ${message}`, data);
    }
    
    // Persist async
    this.persist();
  }

  // Sanitize data to avoid logging full base64 strings
  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      // If it's a base64 string, just show size
      if (data.startsWith('data:image')) {
        const sizeKB = Math.round(data.length * 0.75 / 1024);
        return `[BASE64_IMAGE: ${sizeKB}KB]`;
      }
      if (data.length > 500) {
        return data.substring(0, 500) + `... [TRUNCATED: ${data.length} chars]`;
      }
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }
    
    return data;
  }

  info(message: string, data?: any) {
    this.log('INFO', message, data);
  }

  error(message: string, data?: any) {
    this.log('ERROR', message, data);
  }

  warn(message: string, data?: any) {
    this.log('WARN', message, data);
  }

  async getLogs(): Promise<LogEntry[]> {
    await this.init();
    return this.logs;
  }

  async getLogsAsText(): Promise<string> {
    await this.init();
    return this.logs.map(log => 
      `[${log.timestamp}] ${log.level}: ${log.message}${log.data ? '\n  ' + JSON.stringify(log.data) : ''}`
    ).join('\n');
  }

  async clear() {
    this.logs = [];
    await AsyncStorage.removeItem(LOGS_KEY);
  }
}

export const diagLogger = new DiagnosticLogger();
export default diagLogger;
