import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BleManager, Device, State } from 'react-native-ble-plx';
import { inspectionsApi } from '../../src/lib/api';
import { diagLogger } from '../../src/lib/diagLogger';

type ScanState = 'idle' | 'discovering' | 'connecting' | 'initializing' | 'scanning' | 'completed' | 'submitting' | 'submitted' | 'error';

interface BluetoothDevice {
  id: string;
  name: string | null;
  rssi: number;
}

interface DTCResult {
  code: string;
  category: string;
  description: string;
  status?: 'Active' | 'Pending';
}

export default function OBDScanScreen() {
  const { id: inspectionId } = useLocalSearchParams<{ id: string }>();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [dtcCodes, setDtcCodes] = useState<DTCResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const bleManager = useRef<BleManager | null>(null);
  const connectedDevice = useRef<Device | null>(null);

  useEffect(() => {
    bleManager.current = new BleManager();
    
    // Check Bluetooth state
    const subscription = bleManager.current.onStateChange((state) => {
      if (state === State.PoweredOn) {
        console.log('Bluetooth is powered on');
      }
    }, true);

    return () => {
      subscription.remove();
      bleManager.current?.destroy();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        
        return Object.values(granted).every(
          (permission) => permission === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const startDeviceDiscovery = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) {
      Alert.alert('Permissions Required', 'Please grant Bluetooth and Location permissions to scan for OBD devices.');
      return;
    }

    setScanState('discovering');
    setDevices([]);
    setErrorMessage(null);

    try {
      bleManager.current?.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          console.log('Scan error:', error);
          return;
        }

        if (device && device.name) {
          // Filter for OBD-II devices (common names)
          const obdNames = ['OBD', 'ELM', 'VEEP', 'OBDII', 'V-LINK', 'VGATE', 'KONNWEI'];
          const isOBDDevice = obdNames.some((name) => 
            device.name?.toUpperCase().includes(name)
          );

          if (isOBDDevice || device.name.includes('OBD')) {
            setDevices((prev) => {
              const exists = prev.some((d) => d.id === device.id);
              if (!exists) {
                return [...prev, {
                  id: device.id,
                  name: device.name,
                  rssi: device.rssi || -100,
                }];
              }
              return prev;
            });
          }
        }
      });

      // Stop scanning after 10 seconds
      setTimeout(() => {
        bleManager.current?.stopDeviceScan();
        if (devices.length === 0) {
          setScanState('idle');
        }
      }, 10000);
    } catch (error) {
      console.log('Discovery error:', error);
      setErrorMessage('Failed to start device discovery');
      setScanState('error');
    }
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    setSelectedDevice(device);
    setScanState('connecting');

    try {
      bleManager.current?.stopDeviceScan();
      
      const connectedDev = await bleManager.current?.connectToDevice(device.id);
      if (connectedDev) {
        connectedDevice.current = connectedDev;
        await connectedDev.discoverAllServicesAndCharacteristics();
        
        setScanState('initializing');
        
        // Simulate ELM327 initialization
        await initializeELM327();
        
        setScanState('scanning');
        await performOBDScan();
      }
    } catch (error: any) {
      console.log('Connection error:', error);
      setErrorMessage(error.message || 'Failed to connect to device');
      setScanState('error');
    }
  };

  const initializeELM327 = async () => {
    // Simulate ELM327 initialization steps
    const steps = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];
    
    for (let i = 0; i < steps.length; i++) {
      setScanProgress((i / steps.length) * 30);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  };

  const performOBDScan = async () => {
    // Simulate OBD scanning with progress
    for (let i = 30; i <= 100; i += 10) {
      setScanProgress(i);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    // Simulate some DTC results
    const mockDTCs: DTCResult[] = [
      { code: 'P0301', category: 'Powertrain', description: 'Cylinder 1 Misfire Detected', status: 'Active' },
      { code: 'P0420', category: 'Powertrain', description: 'Catalyst System Efficiency Below Threshold', status: 'Pending' },
    ];

    // 50% chance of finding DTCs for demo
    if (Math.random() > 0.5) {
      setDtcCodes(mockDTCs);
    } else {
      setDtcCodes([]);
    }

    setScanState('completed');
    setSubmitError(null);
  };

  const handleSubmitOBDResults = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setScanState('submitting');
    
    diagLogger.info('OBD_SUBMIT_START', { inspectionId, dtcCount: dtcCodes.length });
    
    try {
      // Prepare OBD data in the format expected by backend/CRM
      const obdData = {
        scanned_at: new Date().toISOString(),
        device_name: selectedDevice?.name || 'OBD Scanner',
        total_errors: dtcCodes.length,
        categories: groupDTCsByCategory(dtcCodes),
        raw_codes: dtcCodes,
      };
      
      // Submit to backend
      await inspectionsApi.submitOBDResults(inspectionId!, obdData);
      
      diagLogger.info('OBD_SUBMIT_SUCCESS', { inspectionId });
      setScanState('submitted');
      
      // Show success and navigate
      Alert.alert(
        'OBD Data Submitted',
        'The diagnostic results have been saved successfully.',
        [
          {
            text: 'Continue to Checklist',
            onPress: () => router.push(`/checklist/${inspectionId}`),
          },
        ]
      );
    } catch (error: any) {
      diagLogger.error('OBD_SUBMIT_FAILED', { inspectionId, error: error.message });
      setSubmitError(error.message || 'Failed to submit OBD data');
      setScanState('completed'); // Go back to completed state to allow retry
      
      Alert.alert(
        'Submission Failed',
        'Unable to save the diagnostic data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Helper function to group DTCs by category
  const groupDTCsByCategory = (dtcs: DTCResult[]) => {
    const grouped: { [key: string]: any } = {};
    
    dtcs.forEach((dtc) => {
      const cat = dtc.category || 'General';
      if (!grouped[cat]) {
        grouped[cat] = {
          name: cat,
          codes: [],
        };
      }
      grouped[cat].codes.push({
        code: dtc.code,
        description: dtc.description,
        status: dtc.status || 'Active',
      });
    });
    
    return Object.values(grouped);
  };

  const handleSaveResults = () => {
    // Save OBD results and navigate to checklist
    router.push(`/checklist/${inspectionId}`);
  };

  const renderContent = () => {
    switch (scanState) {
      case 'idle':
        return (
          <View style={styles.centerContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="bluetooth" size={64} color="#3B82F6" />
            </View>
            <Text style={styles.title}>Connect OBD Scanner</Text>
            <Text style={styles.subtitle}>
              Make sure your OBD-II scanner is powered on and in pairing mode
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={startDeviceDiscovery}>
              <Ionicons name="search" size={24} color="#FFF" />
              <Text style={styles.buttonText}>Scan for Devices</Text>
            </TouchableOpacity>
          </View>
        );

      case 'discovering':
        return (
          <View style={styles.content}>
            <View style={styles.scanningHeader}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.title}>Scanning for OBD Devices...</Text>
              <Text style={styles.subtitle}>This may take a few seconds</Text>
            </View>

            {devices.length > 0 && (
              <View style={styles.deviceList}>
                <Text style={styles.sectionTitle}>Found Devices</Text>
                {devices.map((device) => (
                  <TouchableOpacity
                    key={device.id}
                    style={styles.deviceCard}
                    onPress={() => connectToDevice(device)}
                  >
                    <View style={styles.deviceIcon}>
                      <Ionicons name="hardware-chip" size={24} color="#3B82F6" />
                    </View>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
                      <Text style={styles.deviceId}>{device.id}</Text>
                    </View>
                    <View style={styles.signalStrength}>
                      <Ionicons
                        name={device.rssi > -70 ? 'wifi' : device.rssi > -90 ? 'wifi-outline' : 'wifi'}
                        size={20}
                        color={device.rssi > -70 ? '#10B981' : '#F59E0B'}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                bleManager.current?.stopDeviceScan();
                setScanState('idle');
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'connecting':
      case 'initializing':
      case 'scanning':
        return (
          <View style={styles.centerContent}>
            <View style={styles.progressContainer}>
              <View style={styles.progressCircle}>
                <Text style={styles.progressText}>{Math.round(scanProgress)}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${scanProgress}%` }]} />
              </View>
            </View>
            <Text style={styles.title}>
              {scanState === 'connecting' && 'Connecting...'}
              {scanState === 'initializing' && 'Initializing Scanner...'}
              {scanState === 'scanning' && 'Scanning Vehicle...'}
            </Text>
            <Text style={styles.subtitle}>
              {selectedDevice?.name || 'OBD Scanner'}
            </Text>
          </View>
        );

      case 'completed':
      case 'submitting':
      case 'submitted':
        return (
          <View style={styles.content}>
            <View style={styles.resultHeader}>
              <View style={[styles.resultIcon, dtcCodes.length === 0 ? styles.successIcon : styles.warningIcon]}>
                <Ionicons
                  name={dtcCodes.length === 0 ? 'checkmark-circle' : 'warning'}
                  size={48}
                  color="#FFF"
                />
              </View>
              <Text style={styles.title}>
                {dtcCodes.length === 0 ? 'No Issues Found' : `${dtcCodes.length} Issues Found`}
              </Text>
              <Text style={styles.subtitle}>
                {scanState === 'submitted' ? 'Data submitted successfully' : 'Scan completed'}
              </Text>
            </View>

            {dtcCodes.length > 0 && (
              <View style={styles.dtcList}>
                {dtcCodes.map((dtc, index) => (
                  <View key={index} style={styles.dtcCard}>
                    <View style={styles.dtcCodeBadge}>
                      <Text style={styles.dtcCode}>{dtc.code}</Text>
                    </View>
                    <View style={styles.dtcInfo}>
                      <Text style={styles.dtcCategory}>{dtc.category}</Text>
                      <Text style={styles.dtcDescription}>{dtc.description}</Text>
                      {dtc.status && (
                        <View style={[styles.statusBadge, dtc.status === 'Active' ? styles.statusActive : styles.statusPending]}>
                          <Text style={[styles.statusText, dtc.status === 'Active' ? styles.statusTextActive : styles.statusTextPending]}>
                            {dtc.status}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Show error message if submission failed */}
            {submitError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={20} color="#DC2626" />
                <Text style={styles.errorBannerText}>
                  Data transfer failed. Please try again.
                </Text>
              </View>
            )}

            {/* Submit Button - Primary action */}
            {scanState !== 'submitted' ? (
              <TouchableOpacity 
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
                onPress={handleSubmitOBDResults}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.submitButtonText}>Submitting...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={24} color="#FFF" />
                    <Text style={styles.submitButtonText}>Submit OBD Data</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.continueButton} 
                onPress={() => router.push(`/checklist/${inspectionId}`)}
              >
                <Text style={styles.continueButtonText}>Continue to Checklist</Text>
                <Ionicons name="arrow-forward" size={24} color="#FFF" />
              </TouchableOpacity>
            )}

            {/* Show Scan Again only if there was an error */}
            {submitError && (
              <TouchableOpacity 
                style={styles.scanAgainButton} 
                onPress={() => {
                  setSubmitError(null);
                  setScanState('idle');
                  setDtcCodes([]);
                }}
              >
                <Ionicons name="refresh" size={20} color="#64748B" />
                <Text style={styles.scanAgainButtonText}>Scan Again</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'error':
        return (
          <View style={styles.centerContent}>
            <View style={[styles.resultIcon, styles.errorIcon]}>
              <Ionicons name="close-circle" size={48} color="#FFF" />
            </View>
            <Text style={styles.title}>Connection Failed</Text>
            <Text style={styles.subtitle}>{errorMessage || 'Unable to connect to OBD scanner'}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setScanState('idle')}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>OBD Scan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 16,
  },
  secondaryButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '500',
  },
  scanningHeader: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deviceList: {
    marginTop: 16,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  deviceId: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  signalStrength: {
    padding: 8,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progressCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  resultHeader: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  resultIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIcon: {
    backgroundColor: '#10B981',
  },
  warningIcon: {
    backgroundColor: '#F59E0B',
  },
  errorIcon: {
    backgroundColor: '#EF4444',
  },
  dtcList: {
    marginBottom: 24,
  },
  dtcCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  dtcCodeBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dtcCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  dtcInfo: {
    flex: 1,
    marginLeft: 12,
  },
  dtcCategory: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dtcDescription: {
    fontSize: 14,
    color: '#1E293B',
    marginTop: 4,
  },
});
