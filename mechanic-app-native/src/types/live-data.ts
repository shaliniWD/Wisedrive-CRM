/**
 * OBD-II Live Data Types
 * Mode 01 - Current Data / Live Data
 * Build #6 - WiseDrive OBD-II DTC Scanner
 */

export interface LiveDataPID {
  pid: string;
  name: string;
  shortName: string;
  unit: string;
  minValue: number;
  maxValue: number;
  bytes: number;  // Number of data bytes expected in response
  category: 'engine' | 'fuel' | 'emissions' | 'speed' | 'temperature' | 'electrical' | 'other';
  formula: (bytes: number[]) => number;
}

export interface LiveDataReading {
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

export interface LiveDataSnapshot {
  timestamp: string;
  readings: LiveDataReading[];
  vehicleInfo?: {
    manufacturerId: string;
    manufacturerName: string;
    year: number;
  };
}

export interface ScanResultJSON {
  scanId: string;
  scanTimestamp: string;
  scanDuration: number;
  vehicle: {
    manufacturer: string | null;
    manufacturerId: string | null;
    year: number | null;
  };
  protocol: string;
  dtcs: {
    stored: Array<{
      code: string;
      category: string;
      description: string;
      isManufacturerSpecific: boolean;
    }>;
    pending: Array<{
      code: string;
      category: string;
      description: string;
      isManufacturerSpecific: boolean;
    }>;
    permanent: Array<{
      code: string;
      category: string;
      description: string;
      isManufacturerSpecific: boolean;
    }>;
  };
  liveData: Array<{
    pid: string;
    name: string;
    value: number;
    unit: string;
    category: string;
    timestamp: number;
  }>;
  summary: {
    totalDTCs: number;
    totalLiveReadings: number;
    scanCycles: number;
  };
}

// Supported OBD-II PIDs for Mode 01
export const LIVE_DATA_PIDS: LiveDataPID[] = [
  {
    pid: '0C',
    name: 'Engine RPM',
    shortName: 'RPM',
    unit: 'rpm',
    minValue: 0,
    maxValue: 16383.75,
    bytes: 2,
    category: 'engine',
    formula: (bytes) => ((bytes[0] * 256) + bytes[1]) / 4,
  },
  {
    pid: '0D',
    name: 'Vehicle Speed',
    shortName: 'Speed',
    unit: 'km/h',
    minValue: 0,
    maxValue: 255,
    bytes: 1,
    category: 'speed',
    formula: (bytes) => bytes[0],
  },
  {
    pid: '05',
    name: 'Engine Coolant Temperature',
    shortName: 'Coolant',
    unit: '°C',
    minValue: -40,
    maxValue: 215,
    bytes: 1,
    category: 'temperature',
    formula: (bytes) => bytes[0] - 40,
  },
  {
    pid: '0F',
    name: 'Intake Air Temperature',
    shortName: 'Intake Air',
    unit: '°C',
    minValue: -40,
    maxValue: 215,
    bytes: 1,
    category: 'temperature',
    formula: (bytes) => bytes[0] - 40,
  },
  {
    pid: '11',
    name: 'Throttle Position',
    shortName: 'Throttle',
    unit: '%',
    minValue: 0,
    maxValue: 100,
    bytes: 1,
    category: 'engine',
    formula: (bytes) => (bytes[0] * 100) / 255,
  },
  {
    pid: '04',
    name: 'Calculated Engine Load',
    shortName: 'Load',
    unit: '%',
    minValue: 0,
    maxValue: 100,
    bytes: 1,
    category: 'engine',
    formula: (bytes) => (bytes[0] * 100) / 255,
  },
  {
    pid: '0B',
    name: 'Intake Manifold Pressure',
    shortName: 'MAP',
    unit: 'kPa',
    minValue: 0,
    maxValue: 255,
    bytes: 1,
    category: 'engine',
    formula: (bytes) => bytes[0],
  },
  {
    pid: '0E',
    name: 'Timing Advance',
    shortName: 'Timing',
    unit: '°',
    minValue: -64,
    maxValue: 63.5,
    bytes: 1,
    category: 'engine',
    formula: (bytes) => (bytes[0] / 2) - 64,
  },
  {
    pid: '10',
    name: 'MAF Air Flow Rate',
    shortName: 'MAF',
    unit: 'g/s',
    minValue: 0,
    maxValue: 655.35,
    bytes: 2,
    category: 'engine',
    formula: (bytes) => ((bytes[0] * 256) + bytes[1]) / 100,
  },
  {
    pid: '2F',
    name: 'Fuel Tank Level',
    shortName: 'Fuel',
    unit: '%',
    minValue: 0,
    maxValue: 100,
    bytes: 1,
    category: 'fuel',
    formula: (bytes) => (bytes[0] * 100) / 255,
  },
  {
    pid: '42',
    name: 'Control Module Voltage',
    shortName: 'Voltage',
    unit: 'V',
    minValue: 0,
    maxValue: 65.535,
    bytes: 2,
    category: 'electrical',
    formula: (bytes) => ((bytes[0] * 256) + bytes[1]) / 1000,
  },
  {
    pid: '46',
    name: 'Ambient Air Temperature',
    shortName: 'Ambient',
    unit: '°C',
    minValue: -40,
    maxValue: 215,
    bytes: 1,
    category: 'temperature',
    formula: (bytes) => bytes[0] - 40,
  },
  {
    pid: '5C',
    name: 'Engine Oil Temperature',
    shortName: 'Oil Temp',
    unit: '°C',
    minValue: -40,
    maxValue: 210,
    bytes: 1,
    category: 'temperature',
    formula: (bytes) => bytes[0] - 40,
  },
  {
    pid: '5E',
    name: 'Engine Fuel Rate',
    shortName: 'Fuel Rate',
    unit: 'L/h',
    minValue: 0,
    maxValue: 3212.75,
    bytes: 2,
    category: 'fuel',
    formula: (bytes) => ((bytes[0] * 256) + bytes[1]) / 20,
  },
  {
    pid: '1F',
    name: 'Run Time Since Engine Start',
    shortName: 'Run Time',
    unit: 'sec',
    minValue: 0,
    maxValue: 65535,
    bytes: 2,
    category: 'other',
    formula: (bytes) => (bytes[0] * 256) + bytes[1],
  },
  {
    pid: '21',
    name: 'Distance with MIL On',
    shortName: 'MIL Dist',
    unit: 'km',
    minValue: 0,
    maxValue: 65535,
    bytes: 2,
    category: 'other',
    formula: (bytes) => (bytes[0] * 256) + bytes[1],
  },
  {
    pid: '06',
    name: 'Short Term Fuel Trim Bank 1',
    shortName: 'STFT B1',
    unit: '%',
    minValue: -100,
    maxValue: 99.2,
    bytes: 1,
    category: 'fuel',
    formula: (bytes) => ((bytes[0] - 128) * 100) / 128,
  },
  {
    pid: '07',
    name: 'Long Term Fuel Trim Bank 1',
    shortName: 'LTFT B1',
    unit: '%',
    minValue: -100,
    maxValue: 99.2,
    bytes: 1,
    category: 'fuel',
    formula: (bytes) => ((bytes[0] - 128) * 100) / 128,
  },
  {
    pid: '0A',
    name: 'Fuel Pressure',
    shortName: 'Fuel Press',
    unit: 'kPa',
    minValue: 0,
    maxValue: 765,
    bytes: 1,
    category: 'fuel',
    formula: (bytes) => bytes[0] * 3,
  },
  {
    pid: '33',
    name: 'Barometric Pressure',
    shortName: 'Baro',
    unit: 'kPa',
    minValue: 0,
    maxValue: 255,
    bytes: 1,
    category: 'other',
    formula: (bytes) => bytes[0],
  },
];

// Get PID info by code
export function getPIDInfo(pidCode: string): LiveDataPID | undefined {
  return LIVE_DATA_PIDS.find(p => p.pid.toUpperCase() === pidCode.toUpperCase());
}

// Category colors for UI
export const LiveDataCategoryColors: Record<string, string> = {
  engine: '#E74C3C',
  fuel: '#F39C12',
  emissions: '#9B59B6',
  speed: '#3498DB',
  temperature: '#E67E22',
  electrical: '#27AE60',
  other: '#6C757D',
};

// Category icons
export const LiveDataCategoryIcons: Record<string, string> = {
  engine: 'settings',
  fuel: 'local-gas-station',
  emissions: 'cloud',
  speed: 'speed',
  temperature: 'thermostat',
  electrical: 'flash-on',
  other: 'info',
};
