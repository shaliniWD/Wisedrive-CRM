/**
 * Comprehensive Debug Logger for Mechanic App
 * Tracks the entire answer lifecycle: local save -> API call -> server response -> reload
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'DEBUG';
  category: 'STATE' | 'API_REQUEST' | 'API_RESPONSE' | 'STORAGE' | 'NAVIGATION' | 'LIFECYCLE';
  action: string;
  data?: any;
  questionId?: string;
  inspectionId?: string;
  error?: string;
}

const LOGS_STORAGE_KEY = '@mechanic_debug_logs';
const MAX_LOGS = 500;

class DebugLogger {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    try {
      const stored = await AsyncStorage.getItem(LOGS_STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
      this.initialized = true;
    } catch (e) {
      console.error('[Logger] Failed to load logs:', e);
      this.logs = [];
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async persist() {
    try {
      // Keep only last MAX_LOGS
      if (this.logs.length > MAX_LOGS) {
        this.logs = this.logs.slice(-MAX_LOGS);
      }
      await AsyncStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.error('[Logger] Failed to persist logs:', e);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.logs]));
  }

  subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  async log(
    level: LogEntry['level'],
    category: LogEntry['category'],
    action: string,
    data?: any,
    meta?: { questionId?: string; inspectionId?: string; error?: string }
  ) {
    await this.initialize();
    
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      category,
      action,
      data: data !== undefined ? this.sanitizeData(data) : undefined,
      questionId: meta?.questionId,
      inspectionId: meta?.inspectionId,
      error: meta?.error,
    };

    this.logs.push(entry);
    await this.persist();
    this.notifyListeners();

    // Also log to console for development
    const emoji = {
      INFO: 'ℹ️',
      WARN: '⚠️',
      ERROR: '❌',
      SUCCESS: '✅',
      DEBUG: '🔍',
    }[level];
    
    console.log(`${emoji} [${category}] ${action}`, data ? JSON.stringify(data, null, 2).substring(0, 500) : '');
  }

  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      // Truncate long strings (like base64 images)
      if (data.length > 100 && data.startsWith('data:')) {
        return `${data.substring(0, 50)}...[BASE64_TRUNCATED length=${data.length}]`;
      }
      if (data.length > 500) {
        return data.substring(0, 500) + `...[TRUNCATED length=${data.length}]`;
      }
      return data;
    }
    if (data && typeof data === 'object') {
      const sanitized: any = Array.isArray(data) ? [] : {};
      for (const key in data) {
        sanitized[key] = this.sanitizeData(data[key]);
      }
      return sanitized;
    }
    return data;
  }

  // Convenience methods for common actions
  async logStateChange(action: string, data: any, questionId?: string) {
    await this.log('INFO', 'STATE', action, data, { questionId });
  }

  async logApiRequest(endpoint: string, payload: any, inspectionId?: string, questionId?: string) {
    await this.log('INFO', 'API_REQUEST', `POST ${endpoint}`, payload, { inspectionId, questionId });
  }

  async logApiResponse(endpoint: string, response: any, success: boolean, inspectionId?: string) {
    await this.log(
      success ? 'SUCCESS' : 'ERROR',
      'API_RESPONSE',
      `Response from ${endpoint}`,
      response,
      { inspectionId }
    );
  }

  async logApiError(endpoint: string, error: any, inspectionId?: string, questionId?: string) {
    await this.log(
      'ERROR',
      'API_RESPONSE',
      `Error from ${endpoint}`,
      { 
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      },
      { inspectionId, questionId, error: error.message }
    );
  }

  async logLifecycle(action: string, data?: any, inspectionId?: string) {
    await this.log('DEBUG', 'LIFECYCLE', action, data, { inspectionId });
  }

  async logNavigation(from: string, to: string, params?: any) {
    await this.log('INFO', 'NAVIGATION', `${from} -> ${to}`, params);
  }

  async logStorageRead(key: string, value: any) {
    await this.log('DEBUG', 'STORAGE', `Read: ${key}`, { found: value !== null, preview: value ? 'data present' : 'null' });
  }

  async logStorageWrite(key: string, success: boolean) {
    await this.log(success ? 'SUCCESS' : 'ERROR', 'STORAGE', `Write: ${key}`, { success });
  }

  // Get all logs
  async getLogs(): Promise<LogEntry[]> {
    await this.initialize();
    return [...this.logs];
  }

  // Get logs filtered by inspection
  async getLogsForInspection(inspectionId: string): Promise<LogEntry[]> {
    await this.initialize();
    return this.logs.filter(l => l.inspectionId === inspectionId);
  }

  // Get logs filtered by question
  async getLogsForQuestion(questionId: string): Promise<LogEntry[]> {
    await this.initialize();
    return this.logs.filter(l => l.questionId === questionId);
  }

  // Get recent logs
  async getRecentLogs(count: number = 100): Promise<LogEntry[]> {
    await this.initialize();
    return this.logs.slice(-count);
  }

  // Clear all logs
  async clearLogs() {
    this.logs = [];
    await AsyncStorage.removeItem(LOGS_STORAGE_KEY);
    this.notifyListeners();
    await this.log('INFO', 'LIFECYCLE', 'Logs cleared');
  }

  // Export logs as string for sharing
  async exportLogs(): Promise<string> {
    await this.initialize();
    const exportData = {
      exportedAt: new Date().toISOString(),
      deviceInfo: {
        platform: 'React Native',
      },
      totalLogs: this.logs.length,
      logs: this.logs,
    };
    return JSON.stringify(exportData, null, 2);
  }

  // Get summary statistics
  async getStats(): Promise<{
    total: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
    errors: LogEntry[];
  }> {
    await this.initialize();
    const byLevel: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const errors: LogEntry[] = [];

    this.logs.forEach(log => {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      if (log.level === 'ERROR') {
        errors.push(log);
      }
    });

    return {
      total: this.logs.length,
      byLevel,
      byCategory,
      errors,
    };
  }
}

// Singleton instance
export const debugLogger = new DebugLogger();
