import { BLEDevice } from '../types';
import { logger } from './logger';
import { Platform } from 'react-native';

const MODULE = 'BLE_ADAPTER';

export interface BLEAdapterInterface {
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  startScan(onDeviceFound: (device: BLEDevice) => void): Promise<void>;
  stopScan(): Promise<void>;
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  write(data: string): Promise<void>;
  read(): Promise<string>;
  onData(callback: (data: string) => void): () => void;
  isConnected(): boolean;
  getConnectedDevice(): BLEDevice | null;
}

// ─── Mock adapter for web preview / development ──────────────────
class MockBLEAdapter implements BLEAdapterInterface {
  private connected = false;
  private connectedDevice: BLEDevice | null = null;
  private scanning = false;
  private dataCallbacks: ((data: string) => void)[] = [];
  private responseBuffer = '';

  private mockDevices: BLEDevice[] = [
    { id: 'elm327-001', name: 'OBDII ELM327 v1.5', rssi: -45, isConnectable: true },
    { id: 'elm327-002', name: 'Vgate iCar Pro BLE', rssi: -62, isConnectable: true },
    { id: 'audio-001', name: 'Car Audio BT-500', rssi: -78, isConnectable: true },
    { id: 'unknown-001', name: null, rssi: -88, isConnectable: false },
  ];

  private mockResponses: Record<string, string> = {
    'ATZ': '\r\nELM327 v1.5\r\n\r\n>',
    'ATE0': 'OK\r\n\r\n>',
    'ATL0': 'OK\r\n\r\n>',
    'ATS0': 'OK\r\n\r\n>',
    'ATH0': 'OK\r\n\r\n>',
    'ATSP0': 'OK\r\n\r\n>',
    'ATDPN': 'A6\r\n\r\n>',
    'ATDP': 'ISO 15765-4 (CAN 11/500)\r\n\r\n>',
    '0100': '41 00 BE 3E B8 13\r\n\r\n>',
    '03': '43 01 33 04 20 01 71\r\n\r\n>',
    '07': '47 03 01 40 35\r\n\r\n>',
    '0A': '4A 00 00\r\n\r\n>',
  };

  async isAvailable(): Promise<boolean> {
    logger.info(MODULE, 'BLE availability check (mock)', { platform: Platform.OS });
    await this.delay(200);
    logger.info(MODULE, 'BLE available (mock mode)', { available: true });
    return true;
  }

  async requestPermissions(): Promise<boolean> {
    const start = Date.now();
    logger.info(MODULE, 'Requesting BLE permissions (mock)');
    await this.delay(500);
    logger.info(MODULE, 'Permissions granted (mock)', { durationMs: Date.now() - start });
    return true;
  }

  async startScan(onDeviceFound: (device: BLEDevice) => void): Promise<void> {
    if (this.scanning) return;
    this.scanning = true;
    logger.info(MODULE, 'BLE scan started (mock)');

    for (let i = 0; i < this.mockDevices.length; i++) {
      if (!this.scanning) break;
      await this.delay(800 + Math.random() * 1200);
      if (!this.scanning) break;
      const device = this.mockDevices[i];
      logger.debug(MODULE, 'Device discovered (mock)', {
        deviceId: device.id,
        deviceName: device.name || 'Unknown',
        rssi: device.rssi,
      });
      onDeviceFound(device);
    }
  }

  async stopScan(): Promise<void> {
    this.scanning = false;
    logger.info(MODULE, 'BLE scan stopped (mock)');
  }

  async connect(deviceId: string): Promise<void> {
    const start = Date.now();
    const device = this.mockDevices.find((d) => d.id === deviceId);
    logger.info(MODULE, 'Connecting (mock)', { deviceId });
    if (!device) throw new Error(`Device ${deviceId} not found`);

    logger.debug(MODULE, 'Discovering services (mock)...', { deviceId });
    await this.delay(600);
    logger.debug(MODULE, 'Services discovered (mock)', { deviceId });
    await this.delay(400);
    logger.debug(MODULE, 'Characteristics found (mock)', { deviceId });
    await this.delay(300);

    this.connected = true;
    this.connectedDevice = device;
    logger.info(MODULE, 'Connected (mock)', { deviceId, durationMs: Date.now() - start });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.connectedDevice = null;
    this.dataCallbacks = [];
    logger.info(MODULE, 'Disconnected (mock)');
  }

  async write(data: string): Promise<void> {
    if (!this.connected) throw new Error('Not connected');
    const command = data.replace(/\r?\n?$/, '').trim();
    const responseDelay = command.startsWith('AT') ? 300 + Math.random() * 200 : 500 + Math.random() * 500;

    logger.trace(MODULE, 'TX (mock)', {
      txAscii: data.replace(/\r/g, '\\r'),
      byteCount: data.length,
    });

    await this.delay(responseDelay);
    const response = this.mockResponses[command] || 'NO DATA\r\n\r\n>';
    this.responseBuffer = response;

    logger.trace(MODULE, 'RX (mock)', {
      rxAscii: response.replace(/[\r\n]/g, '').trim(),
      latencyMs: Math.round(responseDelay),
      promptDetected: response.includes('>'),
    });

    this.dataCallbacks.forEach((cb) => cb(response));
  }

  async read(): Promise<string> { return this.responseBuffer; }

  onData(callback: (data: string) => void): () => void {
    this.dataCallbacks.push(callback);
    return () => { this.dataCallbacks = this.dataCallbacks.filter((cb) => cb !== callback); };
  }

  isConnected(): boolean { return this.connected; }
  getConnectedDevice(): BLEDevice | null { return this.connectedDevice; }
  private delay(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
}

// ─── Factory: auto-selects adapter based on platform ─────────────
export function createBLEAdapter(): BLEAdapterInterface {
  // Use BLE PLX adapter for both Android and iOS (BLE support)
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    try {
      const { BLEPLXAdapter } = require('./ble-plx-adapter');
      logger.info(MODULE, 'Creating BLE PLX adapter', {
        platform: Platform.OS,
        protocol: 'Bluetooth Low Energy',
      });
      return new BLEPLXAdapter();
    } catch (e: any) {
      logger.warn(MODULE, 'BLE PLX adapter unavailable, using mock', {
        error: e.message,
        platform: Platform.OS,
      });
    }
  }

  logger.info(MODULE, 'Creating mock BLE adapter', {
    platform: Platform.OS,
    reason: Platform.OS === 'web' ? 'Web platform' : 'Real adapter unavailable',
  });
  return new MockBLEAdapter();
}
