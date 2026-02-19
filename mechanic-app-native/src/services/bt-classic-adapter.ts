import { BLEDevice } from '../types';
import { logger } from './logger';
import { BLEAdapterInterface } from './ble-adapter';

const MODULE = 'BT_CLASSIC';

/**
 * Bluetooth Classic Adapter - Placeholder
 * 
 * This adapter is a placeholder for Bluetooth Classic (SPP) connectivity.
 * The full implementation requires react-native-bluetooth-classic which
 * is not compatible with Expo's managed workflow.
 * 
 * For now, the app uses BLE (Bluetooth Low Energy) via react-native-ble-plx
 * which works with most modern OBD-II adapters.
 * 
 * To enable Bluetooth Classic support:
 * 1. Eject from Expo managed workflow, or
 * 2. Use a custom development client with native module integration
 */
export class BluetoothClassicAdapter implements BLEAdapterInterface {
  async isAvailable(): Promise<boolean> {
    logger.warn(MODULE, 'Bluetooth Classic adapter not available in managed Expo builds');
    logger.info(MODULE, 'Please use a BLE-compatible OBD-II adapter');
    return false;
  }

  async requestPermissions(): Promise<boolean> {
    logger.warn(MODULE, 'Bluetooth Classic not available');
    return false;
  }

  async startScan(onDeviceFound: (device: BLEDevice) => void): Promise<void> {
    logger.warn(MODULE, 'Bluetooth Classic scanning not available');
    throw new Error('Bluetooth Classic not available. Please use a BLE OBD-II adapter.');
  }

  async stopScan(): Promise<void> {
    // No-op
  }

  async connect(deviceId: string): Promise<void> {
    logger.warn(MODULE, 'Bluetooth Classic connection not available');
    throw new Error('Bluetooth Classic not available. Please use a BLE OBD-II adapter.');
  }

  async disconnect(): Promise<void> {
    // No-op
  }

  async write(data: string): Promise<void> {
    throw new Error('Bluetooth Classic not available');
  }

  async read(): Promise<string> {
    return '';
  }

  onData(callback: (data: string) => void): () => void {
    return () => {};
  }

  isConnected(): boolean {
    return false;
  }

  getConnectedDevice(): BLEDevice | null {
    return null;
  }
}
