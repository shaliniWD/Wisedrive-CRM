export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

export const LogLevelNames: Record<LogLevel, string> = {
  [LogLevel.TRACE]: 'TRACE',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
};

export const LogLevelColors: Record<LogLevel, string> = {
  [LogLevel.TRACE]: '#6C757D',
  [LogLevel.DEBUG]: '#6C757D',
  [LogLevel.INFO]: '#3498DB',
  [LogLevel.WARN]: '#F39C12',
  [LogLevel.ERROR]: '#E74C3C',
  [LogLevel.FATAL]: '#C0392B',
};

export interface LogEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  level: LogLevel;
  levelName: string;
  module: string;
  action: string;
  metadata: Record<string, any>;
  appVersion: string;
}

export interface BLEDevice {
  id: string;
  name: string | null;
  rssi: number;
  isConnectable: boolean;
}

export interface DTCResult {
  code: string;
  category: DTCCategory;
  categoryName: string;
  rawHex: string;
  mode?: string;
  description: string;
  isManufacturerSpecific?: boolean;
  ecuSource?: string; // Which ECU module reported this DTC
}

export interface RawECUResponse {
  id: string;
  command: string;
  txAscii: string;
  txHex: string;
  rxRaw: string;
  rxAscii: string;
  rxHex: string;
  latencyMs: number;
  timestamp: string;
}

export interface VehicleInfo {
  manufacturerId: string;
  manufacturerName: string;
  year: number;
}

export interface LiveDataReadingSimple {
  pid: string;
  name: string;
  shortName: string;
  value: number;
  displayValue: string;
  unit: string;
  category: string;
  timestamp: number;
  rawHex: string;
}

export interface ScanSession {
  id: string;
  timestamp: string;
  duration: number;
  configuredDuration: number;
  protocol: string;
  status: 'pending' | 'initializing' | 'scanning' | 'completed' | 'failed';
  storedDTCs: DTCResult[];
  pendingDTCs: DTCResult[];
  permanentDTCs: DTCResult[];
  liveData: LiveDataReadingSimple[];
  rawECUResponses: RawECUResponse[];
  errorSummary: string | null;
  vehicleInfo?: VehicleInfo;
  scanCycles?: number;
  jsonResult?: object;
}

export interface ELM327InitStep {
  command: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  response?: string;
  error?: string;
  durationMs?: number;
}

export type ScannerState =
  | 'idle'
  | 'discovering'
  | 'connecting'
  | 'initializing'
  | 'ready'
  | 'scanning'
  | 'results'
  | 'error';

export type DTCCategory = 'P' | 'B' | 'C' | 'U';

export const DTCCategoryNames: Record<DTCCategory, string> = {
  P: 'Powertrain',
  B: 'Body',
  C: 'Chassis',
  U: 'Network',
};

export const DTCCategoryColors: Record<DTCCategory, string> = {
  P: '#E74C3C',  // Powertrain - Red
  B: '#9B59B6',  // Body - Purple
  C: '#E67E22',  // Chassis - Orange
  U: '#3498DB',  // Network - Blue
};
