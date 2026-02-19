import { BLEDevice } from '../types';
import { logger } from './logger';
import { BLEAdapterInterface } from './ble-adapter';
import { BleManager, Device, Characteristic, Subscription } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import { Buffer } from 'buffer';

const MODULE = 'BLE_PLX';

// Common ELM327 BLE service/characteristic UUIDs
const ELM327_SERVICE_UUIDS = [
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

export class BLEPLXAdapter implements BLEAdapterInterface {
  private manager: BleManager;
  private connected = false;
  private connectedDevice: Device | null = null;
  private connectedBLEDevice: BLEDevice | null = null;
  private dataCallbacks: ((data: string) => void)[] = [];
  private notifySubscription: Subscription | null = null;
  private writeCharUUID: string = '';
  private notifyCharUUID: string = '';
  private serviceUUID: string = '';
  private scanning = false;
  private responseBuffer = '';

  constructor() {
    this.manager = new BleManager();
    logger.info(MODULE, 'BLE PLX manager created');
  }

  async isAvailable(): Promise<boolean> {
    const start = Date.now();
    logger.info(MODULE, 'Checking BLE availability', { platform: Platform.OS });

    return new Promise<boolean>((resolve) => {
      const sub = this.manager.onStateChange((state) => {
        logger.info(MODULE, 'BLE state', { state, durationMs: Date.now() - start });
        if (state === 'PoweredOn') {
          sub.remove();
          resolve(true);
        } else if (state === 'PoweredOff' || state === 'Unauthorized' || state === 'Unsupported') {
          sub.remove();
          resolve(false);
        }
      }, true);

      // Timeout after 5 seconds
      setTimeout(() => {
        sub.remove();
        logger.warn(MODULE, 'BLE state check timed out');
        resolve(false);
      }, 5000);
    });
  }

  async requestPermissions(): Promise<boolean> {
    const start = Date.now();
    logger.info(MODULE, 'BLE permissions (handled by config plugin)', {
      platform: Platform.OS,
    });

    // On iOS, permissions are handled via Info.plist (configured by plugin)
    // On Android 12+, need runtime permissions
    if (Platform.OS === 'android') {
      try {
        const { PermissionsAndroid } = require('react-native');
        const apiLevel = Platform.Version;
        const permissions: string[] = [];

        if (typeof apiLevel === 'number' && apiLevel >= 31) {
          permissions.push(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
        } else {
          permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        }

        const results = await PermissionsAndroid.requestMultiple(permissions as any);
        const allGranted = Object.values(results).every(
          (r: any) => r === PermissionsAndroid.RESULTS.GRANTED
        );

        logger.info(MODULE, 'Android BLE permissions', { results, allGranted });
        return allGranted;
      } catch (err: any) {
        logger.error(MODULE, 'Permission request failed', { error: err.message });
        return false;
      }
    }

    logger.info(MODULE, 'iOS permissions granted via Info.plist', {
      durationMs: Date.now() - start,
    });
    return true;
  }

  async startScan(onDeviceFound: (device: BLEDevice) => void): Promise<void> {
    if (this.scanning) {
      logger.warn(MODULE, 'Scan already in progress');
      return;
    }

    this.scanning = true;
    logger.info(MODULE, 'Starting BLE scan', {
      filterServiceUUIDs: ELM327_SERVICE_UUIDS,
    });

    this.manager.startDeviceScan(
      null, // Scan all services (ELM327 UUIDs vary by manufacturer)
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          logger.error(MODULE, 'Scan error', {
            errorCode: error.errorCode,
            message: error.message,
            reason: error.reason,
          });
          return;
        }

        if (device && device.name) {
          const bleDevice: BLEDevice = {
            id: device.id,
            name: device.name || device.localName || null,
            rssi: device.rssi || -100,
            isConnectable: device.isConnectable !== false,
          };

          logger.debug(MODULE, 'Device discovered', {
            deviceId: device.id,
            deviceName: device.name || device.localName,
            rssi: device.rssi,
            isConnectable: device.isConnectable,
            serviceUUIDs: device.serviceUUIDs,
          });

          onDeviceFound(bleDevice);
        }
      }
    );
  }

  async stopScan(): Promise<void> {
    this.scanning = false;
    this.manager.stopDeviceScan();
    logger.info(MODULE, 'BLE scan stopped');
  }

  async connect(deviceId: string): Promise<void> {
    const start = Date.now();
    logger.info(MODULE, 'Connecting to BLE device', { deviceId });

    try {
      // Stop scan first
      this.manager.stopDeviceScan();
      this.scanning = false;

      // Connect
      logger.debug(MODULE, 'Initiating BLE connection...', { deviceId });
      this.connectedDevice = await this.manager.connectToDevice(deviceId, {
        timeout: 10000,
      });

      logger.debug(MODULE, 'Connected, discovering services & characteristics...', {
        deviceId,
        deviceName: this.connectedDevice.name,
      });

      // Discover services & characteristics
      await this.connectedDevice.discoverAllServicesAndCharacteristics();

      const services = await this.connectedDevice.services();
      logger.debug(MODULE, 'Services discovered', {
        serviceCount: services.length,
        serviceUUIDs: services.map((s) => s.uuid),
      });

      // Find ELM327 service and characteristics
      let foundService = false;
      for (const service of services) {
        const chars = await service.characteristics();
        logger.trace(MODULE, 'Service characteristics', {
          serviceUUID: service.uuid,
          charCount: chars.length,
          chars: chars.map((c) => ({
            uuid: c.uuid,
            isWritableWithResponse: c.isWritableWithResponse,
            isWritableWithoutResponse: c.isWritableWithoutResponse,
            isNotifiable: c.isNotifiable,
            isIndicatable: c.isIndicatable,
          })),
        });

        const writeChar = chars.find(
          (c) => c.isWritableWithResponse || c.isWritableWithoutResponse
        );
        const notifyChar = chars.find((c) => c.isNotifiable || c.isIndicatable);

        if (writeChar && notifyChar) {
          this.serviceUUID = service.uuid;
          this.writeCharUUID = writeChar.uuid;
          this.notifyCharUUID = notifyChar.uuid;
          foundService = true;

          logger.info(MODULE, 'ELM327 characteristics found', {
            serviceUUID: service.uuid,
            writeCharUUID: writeChar.uuid,
            notifyCharUUID: notifyChar.uuid,
            writeWithResponse: writeChar.isWritableWithResponse,
          });
          break;
        }
      }

      if (!foundService) {
        throw new Error(
          'Could not find compatible service/characteristics. Ensure this is a BLE ELM327 adapter.'
        );
      }

      // Subscribe to notifications
      logger.debug(MODULE, 'Subscribing to notifications...', {
        serviceUUID: this.serviceUUID,
        charUUID: this.notifyCharUUID,
      });

      this.notifySubscription = this.connectedDevice.monitorCharacteristicForService(
        this.serviceUUID,
        this.notifyCharUUID,
        (error, characteristic) => {
          if (error) {
            logger.error(MODULE, 'Notification error', {
              errorCode: error.errorCode,
              message: error.message,
            });
            return;
          }

          if (characteristic?.value) {
            const decoded = Buffer.from(characteristic.value, 'base64').toString('utf-8');
            logger.trace(MODULE, 'RX notification', {
              base64: characteristic.value,
              decoded: decoded.replace(/\r/g, '\\r').replace(/\n/g, '\\n'),
              byteCount: decoded.length,
              hasPrompt: decoded.includes('>'),
            });

            this.responseBuffer += decoded;
            this.dataCallbacks.forEach((cb) => cb(decoded));
          }
        }
      );

      this.connected = true;
      this.connectedBLEDevice = {
        id: deviceId,
        name: this.connectedDevice.name || null,
        rssi: this.connectedDevice.rssi || -50,
        isConnectable: true,
      };

      const duration = Date.now() - start;
      logger.info(MODULE, 'BLE connection complete', {
        deviceId,
        deviceName: this.connectedDevice.name,
        durationMs: duration,
        serviceUUID: this.serviceUUID,
        writeCharUUID: this.writeCharUUID,
        notifyCharUUID: this.notifyCharUUID,
      });
    } catch (err: any) {
      const duration = Date.now() - start;
      logger.error(MODULE, 'BLE connection failed', {
        deviceId,
        error: err.message,
        durationMs: duration,
        stack: err.stack?.substring(0, 500),
      });
      this.connected = false;
      this.connectedDevice = null;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    const start = Date.now();
    const deviceId = this.connectedBLEDevice?.id;
    logger.info(MODULE, 'Disconnecting BLE device', { deviceId });

    try {
      if (this.notifySubscription) {
        this.notifySubscription.remove();
        this.notifySubscription = null;
      }

      if (this.connectedDevice) {
        await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      }
    } catch (err: any) {
      logger.warn(MODULE, 'Disconnect warning (non-fatal)', { error: err.message });
    }

    this.connected = false;
    this.connectedDevice = null;
    this.connectedBLEDevice = null;
    this.dataCallbacks = [];
    this.responseBuffer = '';
    this.writeCharUUID = '';
    this.notifyCharUUID = '';
    this.serviceUUID = '';

    logger.info(MODULE, 'BLE disconnected', {
      deviceId,
      durationMs: Date.now() - start,
    });
  }

  async write(data: string): Promise<void> {
    if (!this.connected || !this.connectedDevice) {
      logger.error(MODULE, 'Write failed - not connected');
      throw new Error('Not connected to device');
    }

    const txHex = Array.from(data)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(' ');

    logger.trace(MODULE, 'TX BLE write', {
      txAscii: data.replace(/\r/g, '\\r').replace(/\n/g, '\\n'),
      txHex,
      byteCount: data.length,
      serviceUUID: this.serviceUUID,
      charUUID: this.writeCharUUID,
    });

    try {
      const base64Data = Buffer.from(data, 'utf-8').toString('base64');
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        this.serviceUUID,
        this.writeCharUUID,
        base64Data
      );
    } catch (err: any) {
      logger.error(MODULE, 'BLE write failed', { error: err.message });
      throw err;
    }
  }

  async read(): Promise<string> {
    const buffer = this.responseBuffer;
    this.responseBuffer = '';
    return buffer;
  }

  onData(callback: (data: string) => void): () => void {
    this.dataCallbacks.push(callback);
    return () => {
      this.dataCallbacks = this.dataCallbacks.filter((cb) => cb !== callback);
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectedDevice(): BLEDevice | null {
    return this.connectedBLEDevice;
  }

  destroy(): void {
    this.manager.destroy();
    logger.info(MODULE, 'BLE manager destroyed');
  }
}
