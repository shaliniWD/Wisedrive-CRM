import { BLEDevice } from '../types';
import { logger } from './logger';
import { BLEAdapterInterface } from './ble-adapter';
import RNBluetoothClassic, {
  BluetoothDevice,
  BluetoothEventSubscription,
} from 'react-native-bluetooth-classic';
import { PermissionsAndroid, Platform } from 'react-native';

const MODULE = 'BT_CLASSIC';

export class BluetoothClassicAdapter implements BLEAdapterInterface {
  private connected = false;
  private connectedDevice: BluetoothDevice | null = null;
  private connectedBLEDevice: BLEDevice | null = null;
  private dataCallbacks: ((data: string) => void)[] = [];
  private readSubscription: BluetoothEventSubscription | null = null;
  private responseBuffer = '';
  private discoveredDevices: BLEDevice[] = [];

  async isAvailable(): Promise<boolean> {
    const start = Date.now();
    logger.info(MODULE, 'Checking Bluetooth Classic availability', {
      platform: Platform.OS,
    });

    try {
      const available = await RNBluetoothClassic.isBluetoothAvailable();
      const enabled = await RNBluetoothClassic.isBluetoothEnabled();

      logger.info(MODULE, 'Bluetooth Classic state', {
        available,
        enabled,
        durationMs: Date.now() - start,
      });

      if (available && !enabled) {
        logger.info(MODULE, 'Requesting Bluetooth enable...');
        try {
          await RNBluetoothClassic.requestBluetoothEnabled();
          logger.info(MODULE, 'Bluetooth enabled by user');
        } catch (e: any) {
          logger.warn(MODULE, 'User declined Bluetooth enable', { error: e.message });
          return false;
        }
      }

      return available && enabled;
    } catch (err: any) {
      logger.error(MODULE, 'Failed to check Bluetooth availability', {
        error: err.message,
        stack: err.stack?.substring(0, 500),
      });
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    const start = Date.now();
    logger.info(MODULE, 'Requesting Android Bluetooth permissions');

    try {
      if (Platform.OS !== 'android') {
        logger.info(MODULE, 'Non-Android platform, skipping permission request');
        return true;
      }

      const apiLevel = Platform.Version;
      logger.debug(MODULE, 'Android API level', { apiLevel });

      const permissions: string[] = [];

      if (typeof apiLevel === 'number' && apiLevel >= 31) {
        // Android 12+
        permissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
      } else {
        permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      }

      logger.debug(MODULE, 'Requesting permissions', { permissions });

      const results = await PermissionsAndroid.requestMultiple(
        permissions as any
      );

      const allGranted = Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED
      );

      logger.info(MODULE, 'Permission results', {
        results,
        allGranted,
        durationMs: Date.now() - start,
      });

      return allGranted;
    } catch (err: any) {
      logger.error(MODULE, 'Permission request failed', { error: err.message });
      return false;
    }
  }

  async startScan(onDeviceFound: (device: BLEDevice) => void): Promise<void> {
    logger.info(MODULE, 'Starting device scan (bonded + discovery)');
    this.discoveredDevices = [];

    try {
      // First, list already-bonded (paired) devices
      const bonded = await RNBluetoothClassic.getBondedDevices();
      logger.info(MODULE, 'Bonded devices found', {
        count: bonded.length,
        devices: bonded.map((d) => ({ id: d.id, name: d.name })),
      });

      for (const device of bonded) {
        const bleDevice: BLEDevice = {
          id: device.id || device.address,
          name: device.name || null,
          rssi: -50, // Not available for bonded
          isConnectable: true,
        };
        this.discoveredDevices.push(bleDevice);
        onDeviceFound(bleDevice);
      }

      // Then start discovery for unpaired devices
      logger.info(MODULE, 'Starting Bluetooth discovery for unpaired devices...');

      try {
        const discovered = await RNBluetoothClassic.startDiscovery();
        logger.info(MODULE, 'Discovery completed', {
          discoveredCount: discovered.length,
        });

        for (const device of discovered) {
          if (this.discoveredDevices.some((d) => d.id === (device.id || device.address))) {
            logger.debug(MODULE, 'Skipping duplicate device', { id: device.id });
            continue;
          }

          const bleDevice: BLEDevice = {
            id: device.id || device.address,
            name: device.name || null,
            rssi: -70,
            isConnectable: true,
          };
          this.discoveredDevices.push(bleDevice);
          onDeviceFound(bleDevice);
        }
      } catch (discErr: any) {
        logger.warn(MODULE, 'Discovery failed (bonded devices still available)', {
          error: discErr.message,
        });
      }
    } catch (err: any) {
      logger.error(MODULE, 'Scan failed', { error: err.message });
      throw err;
    }
  }

  async stopScan(): Promise<void> {
    logger.info(MODULE, 'Stopping scan');
    try {
      await RNBluetoothClassic.cancelDiscovery();
      logger.info(MODULE, 'Discovery cancelled');
    } catch (err: any) {
      logger.warn(MODULE, 'Cancel discovery failed (may not have been running)', {
        error: err.message,
      });
    }
  }

  async connect(deviceId: string): Promise<void> {
    const start = Date.now();
    logger.info(MODULE, 'Connecting to device via Bluetooth Classic SPP', {
      deviceId,
      attemptTime: new Date().toISOString(),
    });

    // Multiple connection strategies for different Android devices
    const connectionStrategies = [
      { name: 'Standard SPP', options: { delimiter: '>', charset: 'utf-8' } },
      { name: 'Secure RFCOMM', options: { delimiter: '>', charset: 'utf-8', secureSocket: true } },
      { name: 'Insecure RFCOMM', options: { delimiter: '>', charset: 'utf-8', secureSocket: false } },
      { name: 'Legacy mode', options: { delimiter: '\n', charset: 'utf-8' } },
      { name: 'Raw connection', options: { delimiter: '>' } },
    ];

    let lastError: Error | null = null;

    try {
      // Check if already connected
      const alreadyConnected = await RNBluetoothClassic.isDeviceConnected(deviceId);
      if (alreadyConnected) {
        logger.info(MODULE, 'Device already connected', { deviceId });
        this.connectedDevice = await RNBluetoothClassic.getConnectedDevice(deviceId);
        this.setupConnection(deviceId, start);
        return;
      }

      // Try multiple connection strategies
      for (const strategy of connectionStrategies) {
        try {
          logger.info(MODULE, `Trying connection strategy: ${strategy.name}`, { 
            deviceId,
            options: strategy.options 
          });

          // Small delay between attempts to allow socket cleanup
          if (lastError) {
            await new Promise(r => setTimeout(r, 1000));
          }

          this.connectedDevice = await RNBluetoothClassic.connectToDevice(
            deviceId, 
            strategy.options as any
          );

          logger.info(MODULE, `Connection successful with strategy: ${strategy.name}`, {
            deviceId,
            deviceName: this.connectedDevice?.name,
          });

          this.setupConnection(deviceId, start);
          return;

        } catch (strategyErr: any) {
          lastError = strategyErr;
          logger.warn(MODULE, `Strategy "${strategy.name}" failed`, {
            deviceId,
            error: strategyErr.message,
          });
          
          // Check if this is a fatal error that won't be helped by retrying
          const errorMsg = strategyErr.message?.toLowerCase() || '';
          if (errorMsg.includes('not found') || errorMsg.includes('not available')) {
            logger.error(MODULE, 'Device not available, stopping retry attempts');
            break;
          }
          
          // Continue to next strategy
          continue;
        }
      }

      // All strategies failed
      throw lastError || new Error('All connection strategies failed');

    } catch (err: any) {
      const duration = Date.now() - start;
      
      // Provide user-friendly error message
      let userMessage = err.message;
      const errorLower = (err.message || '').toLowerCase();
      
      if (errorLower.includes('read failed') || errorLower.includes('socket might closed')) {
        userMessage = 'Connection failed. Please try: 1) Turn Bluetooth off/on, 2) Unpair and re-pair the OBD adapter, 3) Restart the app';
      } else if (errorLower.includes('timeout')) {
        userMessage = 'Connection timed out. Make sure the OBD adapter is plugged in and the vehicle ignition is ON';
      } else if (errorLower.includes('denied') || errorLower.includes('permission')) {
        userMessage = 'Bluetooth permission denied. Please enable Bluetooth permissions in Settings';
      }
      
      logger.error(MODULE, 'Connection failed after all strategies', {
        deviceId,
        error: err.message,
        userMessage,
        durationMs: duration,
        stack: err.stack?.substring(0, 500),
      });
      
      this.connected = false;
      this.connectedDevice = null;
      
      const enhancedError = new Error(userMessage);
      (enhancedError as any).originalError = err;
      throw enhancedError;
    }
  }

  private setupConnection(deviceId: string, startTime: number): void {
    this.connected = true;
    this.connectedBLEDevice = {
      id: deviceId,
      name: this.connectedDevice?.name || null,
      rssi: -50,
      isConnectable: true,
    };

    // Set up data listener with error recovery
    this.readSubscription = this.connectedDevice!.onDataReceived((event) => {
      const data = event.data;
      logger.trace(MODULE, 'RX data received', {
        rxRaw: data?.replace(/\r/g, '\\r').replace(/\n/g, '\\n'),
        byteCount: data?.length || 0,
        hasDelimiter: data?.includes('>') || false,
      });

      if (data) {
        this.responseBuffer += data;
        // Add the delimiter back since the library strips it
        const fullResponse = data + '>';
        this.dataCallbacks.forEach((cb) => {
          try {
            cb(fullResponse);
          } catch (cbErr) {
            logger.warn(MODULE, 'Data callback error', { error: (cbErr as Error).message });
          }
        });
      }
    });

    const duration = Date.now() - startTime;
    logger.info(MODULE, 'Connection complete', {
      deviceId,
      deviceName: this.connectedDevice?.name,
      durationMs: duration,
      protocol: 'SPP (Serial Port Profile)',
    });
  }

  async disconnect(): Promise<void> {
    const start = Date.now();
    const deviceId = this.connectedBLEDevice?.id;
    logger.info(MODULE, 'Disconnecting', { deviceId });

    try {
      if (this.readSubscription) {
        this.readSubscription.remove();
        this.readSubscription = null;
      }

      if (this.connectedDevice) {
        await this.connectedDevice.disconnect();
      }
    } catch (err: any) {
      logger.warn(MODULE, 'Disconnect error (non-fatal)', { error: err.message });
    }

    this.connected = false;
    this.connectedDevice = null;
    this.connectedBLEDevice = null;
    this.dataCallbacks = [];
    this.responseBuffer = '';

    logger.info(MODULE, 'Disconnected', {
      deviceId,
      durationMs: Date.now() - start,
      cleanTeardown: true,
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

    logger.trace(MODULE, 'TX data sent', {
      txAscii: data.replace(/\r/g, '\\r').replace(/\n/g, '\\n'),
      txHex,
      byteCount: data.length,
      timestamp: new Date().toISOString(),
    });

    try {
      await this.connectedDevice.write(data);
    } catch (err: any) {
      logger.error(MODULE, 'Write failed', {
        error: err.message,
        data: data.replace(/\r/g, '\\r'),
      });
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
}
