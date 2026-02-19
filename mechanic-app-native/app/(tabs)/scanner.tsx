import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Image,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { 
  Colors, 
  Spacing, 
  FontSize, 
  Radius, 
  DEFAULT_SCAN_DURATION,
  APP_VERSION,
  APP_BUILD,
  WISEDRIVE_LOGO_HORIZONTAL,
} from '../../src/constants/theme';
import { BLEDevice, ScannerState, ELM327InitStep, DTCResult, ScanSession, DTCCategoryColors, VehicleInfo, LogEntry, LogLevel, LogLevelNames, LogLevelColors, DTCCategory, DTCCategoryNames } from '../../src/types';
import { LiveDataReading, LiveDataCategoryColors, LiveDataCategoryIcons } from '../../src/types/live-data';
import { createBLEAdapter, BLEAdapterInterface } from '../../src/services/ble-adapter';
import { ELM327Service, ScanProgressCallback } from '../../src/services/elm327';
import { parseOBDResponseV2 } from '../../src/services/dtc-parser-v2';
import { parseLiveDataResponse, getPriorityPIDs, createScanResultJSON } from '../../src/services/live-data-parser';
import { logger, generateId } from '../../src/services/logger';
import { saveScanSession, getScanSessions, clearAllData } from '../../src/services/database';
import { ManufacturerSelector } from '../../src/components/ManufacturerSelector';
import { Manufacturer } from '../../src/constants/manufacturers';
import { getDTCDescription, getComponentForDTC, getDTCSeverity, getSeverityInfo } from '../../src/constants/dtc-descriptions';
import { getDTCKnowledge } from '../../src/constants/dtc-knowledge-base';

const MODULE = 'OBD_SCANNER';

export default function OBDScannerScreen() {
  const insets = useSafeAreaInsets();
  
  // Modal states
  const [historyVisible, setHistoryVisible] = useState(false);
  const [logsVisible, setLogsVisible] = useState(false);
  const [rawDataVisible, setRawDataVisible] = useState(false);
  
  // Raw data capture - use ref during scanning to avoid frequent re-renders
  const [rawDataEntries, setRawDataEntries] = useState<{ timestamp: string; command: string; response: string; type: 'DTC' | 'LIVE' | 'INIT' | 'VIN' }[]>([]);
  const rawDataRef = useRef<{ timestamp: string; command: string; response: string; type: 'DTC' | 'LIVE' | 'INIT' | 'VIN' }[]>([]);
  
  // Scanner state
  const [state, setState] = useState<ScannerState>('idle');
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [initSteps, setInitSteps] = useState<ELM327InitStep[]>([]);
  const [scanDuration, setScanDuration] = useState(DEFAULT_SCAN_DURATION);
  const [scanProgress, setScanProgress] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [scanCycleCount, setScanCycleCount] = useState(0);
  const [storedDTCs, setStoredDTCs] = useState<DTCResult[]>([]);
  const [pendingDTCs, setPendingDTCs] = useState<DTCResult[]>([]);
  const [permanentDTCs, setPermanentDTCs] = useState<DTCResult[]>([]);
  const [liveData, setLiveData] = useState<LiveDataReading[]>([]);
  const [protocol, setProtocol] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [connectedDeviceName, setConnectedDeviceName] = useState('');
  const [currentSession, setCurrentSession] = useState<ScanSession | null>(null);
  const [scanResultJSON, setScanResultJSON] = useState<object | null>(null);
  
  // Component scanning progress state
  const [currentScanPhase, setCurrentScanPhase] = useState<string>('');
  const [currentComponent, setCurrentComponent] = useState<string>('');
  const [componentProgress, setComponentProgress] = useState(0);
  const [scannedComponents, setScannedComponents] = useState<Array<{
    name: string;
    status: 'success' | 'failed' | 'no_response';
    dtcsFound: number;
  }>>([]);
  const [totalComponents, setTotalComponents] = useState(0);
  
  const [selectedManufacturer, setSelectedManufacturer] = useState<Manufacturer | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [vehicleVIN, setVehicleVIN] = useState<string | null>(null);
  const [inspectionId, setInspectionId] = useState<string>('');
  const [selectedDTC, setSelectedDTC] = useState<DTCResult | null>(null);
  const [dtcDetailVisible, setDtcDetailVisible] = useState(false);

  // History state
  const [sessions, setSessions] = useState<ScanSession[]>([]);

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<LogLevel | null>(null);
  const [logModuleFilter, setLogModuleFilter] = useState<string | null>(null);

  const adapterRef = useRef<BLEAdapterInterface | null>(null);
  const elm327Ref = useRef<ELM327Service | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanActiveRef = useRef<boolean>(false);

  // Refresh logs more frequently and keep updating even in modal
  useEffect(() => {
    loadHistory();
    const interval = setInterval(() => {
      const entries = logger.getEntries();
      setLogs([...entries]);
    }, 500);
    return () => {
      clearInterval(interval);
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      adapterRef.current?.disconnect?.().catch(() => {});
    };
  }, []);

  // Refresh logs when modal opens
  useEffect(() => {
    if (logsVisible) {
      setLogs([...logger.getEntries()]);
    }
  }, [logsVisible]);

  const loadHistory = useCallback(async () => {
    const data = await getScanSessions();
    setSessions(data);
  }, []);

  // Scanner functions
  const startDiscovery = useCallback(async () => {
    logger.info(MODULE, 'Starting device discovery');
    setState('discovering');
    setDevices([]);
    setErrorMsg('');

    const adapter = createBLEAdapter();
    adapterRef.current = adapter;

    try {
      const available = await adapter.isAvailable();
      if (!available) throw new Error('Bluetooth is not available');
      await adapter.requestPermissions();
      await adapter.startScan((device) => {
        setDevices((prev) => {
          if (prev.some((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });
      });
    } catch (err: any) {
      logger.error(MODULE, 'Discovery failed', { error: err.message });
      setErrorMsg(err.message);
      setState('error');
    }
  }, []);

  const connectToDevice = useCallback(async (device: BLEDevice) => {
    logger.info(MODULE, 'Connecting to device', { deviceId: device.id, deviceName: device.name });
    setState('connecting');
    setConnectedDeviceName(device.name || device.id);

    try {
      await adapterRef.current?.stopScan();
      await adapterRef.current?.connect(device.id);

      setState('initializing');
      const elm327 = new ELM327Service(adapterRef.current!);
      elm327Ref.current = elm327;

      const result = await elm327.initialize(setInitSteps);
      if (result.success) {
        setProtocol(result.protocol);
        setState('ready');
        logger.info(MODULE, 'Device ready for scanning', { protocol: result.protocol });
      } else {
        throw new Error('ELM327 initialization failed');
      }
    } catch (err: any) {
      logger.error(MODULE, 'Connection/init failed', { error: err.message });
      
      let errorMessage = err.message || 'Unknown error occurred';
      const errorLower = errorMessage.toLowerCase();
      
      if (errorLower.includes('read failed') || errorLower.includes('socket might closed') || errorLower.includes('ret: -1')) {
        errorMessage = 'Bluetooth connection failed.\n\nPlease try:\n1. Turn Bluetooth OFF then ON\n2. Unpair the OBD adapter in Settings\n3. Re-pair the adapter\n4. Restart the app';
      } else if (errorLower.includes('timeout')) {
        errorMessage = 'Connection timed out.\n\nMake sure:\n1. OBD adapter is plugged in\n2. Vehicle ignition is ON\n3. Adapter LED is blinking';
      } else if (errorLower.includes('denied') || errorLower.includes('permission')) {
        errorMessage = 'Bluetooth permission denied.\n\nPlease enable Bluetooth permissions in your phone Settings.';
      } else if (errorLower.includes('not found')) {
        errorMessage = 'Device not found.\n\nPlease scan again and select your OBD adapter.';
      } else if (errorLower.includes('elm327') || errorLower.includes('initialization')) {
        errorMessage = 'OBD adapter not responding.\n\nMake sure you selected an ELM327-compatible OBD adapter.';
      }
      
      setErrorMsg(errorMessage);
      setState('error');
    }
  }, []);

  const startScan = useCallback(async () => {
    logger.info(MODULE, 'Starting DTC + Live Data scan', { 
      duration: scanDuration,
      manufacturer: selectedManufacturer?.id,
      year: selectedYear,
    });
    setState('scanning');
    setScanProgress(0);
    setRemainingTime(scanDuration);
    setScanCycleCount(0);
    setStoredDTCs([]);
    setPendingDTCs([]);
    setPermanentDTCs([]);
    setLiveData([]);
    setScanResultJSON(null);
    
    setCurrentScanPhase('Initializing Scan...');
    setCurrentComponent('');
    setComponentProgress(0);
    setScannedComponents([]);
    setTotalComponents(0);
    
    rawDataRef.current = [];
    setRawDataEntries([]);
    scanActiveRef.current = true;

    const sessionId = logger.newSession();
    const startTime = Date.now();
    const endTime = startTime + (scanDuration * 1000);

    const vehicleInfo: VehicleInfo | undefined = selectedManufacturer && selectedYear ? {
      manufacturerId: selectedManufacturer.id,
      manufacturerName: selectedManufacturer.name,
      year: selectedYear,
    } : undefined;

    const session: ScanSession = {
      id: sessionId,
      timestamp: new Date().toISOString(),
      duration: 0,
      configuredDuration: scanDuration,
      protocol,
      status: 'scanning',
      storedDTCs: [],
      pendingDTCs: [],
      permanentDTCs: [],
      liveData: [],
      rawECUResponses: [],
      errorSummary: null,
      vehicleInfo,
      scanCycles: 0,
    };
    setCurrentSession(session);

    const allStoredDTCs = new Map<string, DTCResult>();
    const allPendingDTCs = new Map<string, DTCResult>();
    const allPermanentDTCs = new Map<string, DTCResult>();
    const allLiveData = new Map<string, LiveDataReading>();
    let cycleCount = 0;

    const countdownInterval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setRemainingTime(remaining);
      const progress = Math.min((Date.now() - startTime) / (scanDuration * 1000), 1);
      setScanProgress(progress);
    }, 100);

    try {
      const priorityPIDs = getPriorityPIDs();

      // Fetch VIN first
      try {
        logger.info(MODULE, 'Fetching VIN...');
        const vinResult = await elm327Ref.current!.fetchVIN();
        if (vinResult.vin) {
          setVehicleVIN(vinResult.vin);
          logger.info(MODULE, 'VIN fetched successfully', { vin: vinResult.vin });
        } else {
          logger.warn(MODULE, 'VIN not available', { error: vinResult.error });
        }
        rawDataRef.current.push({
          timestamp: new Date().toISOString(),
          command: '0902 (VIN Request)',
          response: vinResult.rawResponse || 'NO RESPONSE',
          type: 'VIN'
        });
      } catch (vinErr) {
        logger.warn(MODULE, 'VIN fetch failed', { error: (vinErr as Error).message });
      }

      // Check MIL Status first
      let expectedDTCCount = 0;
      let milIsOn = false;
      
      setCurrentScanPhase('Initial Diagnostics');
      setCurrentComponent('MIL Status Check');
      setTotalComponents(5);
      
      try {
        logger.info(MODULE, 'Checking MIL status (Mode 01 PID 01)...');
        const milResult = await elm327Ref.current!.readMILStatus();
        expectedDTCCount = milResult.dtcCount;
        milIsOn = milResult.milOn;
        logger.info(MODULE, 'MIL Status Result', { 
          milOn: milResult.milOn, 
          dtcCount: milResult.dtcCount,
          rawResponse: milResult.rawResponse 
        });
        rawDataRef.current.push({
          timestamp: new Date().toISOString(),
          command: '0101 (MIL Status)',
          response: milResult.rawResponse || 'NO RESPONSE',
          type: 'DTC'
        });
        
        setScannedComponents(prev => [...prev, {
          name: 'MIL Status Check',
          status: 'success',
          dtcsFound: expectedDTCCount,
        }]);
      } catch (milErr) {
        logger.warn(MODULE, 'MIL status check failed', { error: (milErr as Error).message });
        setScannedComponents(prev => [...prev, {
          name: 'MIL Status Check',
          status: 'failed',
          dtcsFound: 0,
        }]);
      }

      let standardDTCsFound = false;

      // Standard OBD-II Scan Phase
      setCurrentScanPhase('Standard OBD-II Scan');
      
      // Mode 03 - Stored DTCs
      setCurrentComponent('Stored DTCs (Mode 03)');
      try {
        const storedResult = await elm327Ref.current!.scanDTCs('03');
        const parseResult = parseOBDResponseV2(storedResult.dtcBytes, '03', selectedManufacturer?.id, selectedYear || undefined);
        parseResult.dtcs.forEach(dtc => {
          if (!allStoredDTCs.has(dtc.code)) allStoredDTCs.set(dtc.code, dtc);
        });
        setStoredDTCs(Array.from(allStoredDTCs.values()));
        const rawResponseStr = storedResult.rawResponse?.rxRaw || storedResult.rawResponse?.rxAscii || 'NO RESPONSE';
        rawDataRef.current.push({
          timestamp: new Date().toISOString(),
          command: '03 (Stored DTCs)',
          response: rawResponseStr,
          type: 'DTC'
        });
        
        setScannedComponents(prev => [...prev, {
          name: 'Stored DTCs (Mode 03)',
          status: 'success',
          dtcsFound: parseResult.dtcs.length,
        }]);
        standardDTCsFound = parseResult.dtcs.length > 0;
      } catch (err) {
        setScannedComponents(prev => [...prev, {
          name: 'Stored DTCs (Mode 03)',
          status: 'failed',
          dtcsFound: 0,
        }]);
      }

      if (!scanActiveRef.current) return;

      // Mode 07 - Pending DTCs
      setCurrentComponent('Pending DTCs (Mode 07)');
      try {
        const pendingResult = await elm327Ref.current!.scanDTCs('07');
        const parseResult = parseOBDResponseV2(pendingResult.dtcBytes, '07', selectedManufacturer?.id, selectedYear || undefined);
        parseResult.dtcs.forEach(dtc => {
          if (!allPendingDTCs.has(dtc.code)) allPendingDTCs.set(dtc.code, dtc);
        });
        setPendingDTCs(Array.from(allPendingDTCs.values()));
        const rawResponseStr = pendingResult.rawResponse?.rxRaw || pendingResult.rawResponse?.rxAscii || 'NO RESPONSE';
        rawDataRef.current.push({
          timestamp: new Date().toISOString(),
          command: '07 (Pending DTCs)',
          response: rawResponseStr,
          type: 'DTC'
        });
        
        setScannedComponents(prev => [...prev, {
          name: 'Pending DTCs (Mode 07)',
          status: 'success',
          dtcsFound: parseResult.dtcs.length,
        }]);
      } catch (err) {
        setScannedComponents(prev => [...prev, {
          name: 'Pending DTCs (Mode 07)',
          status: 'failed',
          dtcsFound: 0,
        }]);
      }

      if (!scanActiveRef.current) return;

      // Mode 0A - Permanent DTCs
      setCurrentComponent('Permanent DTCs (Mode 0A)');
      try {
        const permanentResult = await elm327Ref.current!.scanDTCs('0A');
        const parseResult = parseOBDResponseV2(permanentResult.dtcBytes, '0A', selectedManufacturer?.id, selectedYear || undefined);
        parseResult.dtcs.forEach(dtc => {
          if (!allPermanentDTCs.has(dtc.code)) allPermanentDTCs.set(dtc.code, dtc);
        });
        setPermanentDTCs(Array.from(allPermanentDTCs.values()));
        const rawResponseStr = permanentResult.rawResponse?.rxRaw || permanentResult.rawResponse?.rxAscii || 'NO RESPONSE';
        rawDataRef.current.push({
          timestamp: new Date().toISOString(),
          command: '0A (Permanent DTCs)',
          response: rawResponseStr,
          type: 'DTC'
        });
        
        setScannedComponents(prev => [...prev, {
          name: 'Permanent DTCs (Mode 0A)',
          status: 'success',
          dtcsFound: parseResult.dtcs.length,
        }]);
      } catch (err) {
        setScannedComponents(prev => [...prev, {
          name: 'Permanent DTCs (Mode 0A)',
          status: 'failed',
          dtcsFound: 0,
        }]);
      }

      if (!scanActiveRef.current) return;

      // Enhanced Diagnostics
      const currentDTCCount = allStoredDTCs.size + allPendingDTCs.size + allPermanentDTCs.size;
      
      rawDataRef.current.push({
        timestamp: new Date().toISOString(),
        command: '=== ENHANCED DIAGNOSTICS START ===',
        response: `MIL: ${milIsOn}, Expected P-codes: ${expectedDTCCount}, Found: ${currentDTCCount}`,
        type: 'DTC'
      });
      
      logger.info(MODULE, 'Running enhanced diagnostics', {
        milOn: milIsOn,
        milExpectedPowertrainDTCs: expectedDTCCount,
        standardFound: currentDTCCount,
        reason: 'Body/Chassis/Network codes require module-specific scanning',
      });

      // Enhanced Multi-Module Scan Phase
      setCurrentScanPhase('Enhanced ECU Module Scan');
      setCurrentComponent('Preparing ECU scan...');
      
      try {
        logger.info(MODULE, 'Scanning individual ECU modules for Body/Network codes...');
        
        rawDataRef.current.push({
          timestamp: new Date().toISOString(),
          command: 'Starting Multi-Module Scan',
          response: 'Scanning PCM, IPC, PATS, BCM modules...',
          type: 'DTC'
        });
            
        const moduleResults = await elm327Ref.current!.scanAllModules();
        
        const totalModuleCount = moduleResults.length + 4;
        setTotalComponents(totalModuleCount);
        
        for (let i = 0; i < moduleResults.length; i++) {
          const modResult = moduleResults[i];
          
          setCurrentComponent(modResult.module);
          
          rawDataRef.current.push({
            timestamp: new Date().toISOString(),
            command: `Module: ${modResult.module} (${modResult.address})`,
            response: modResult.rawResponse || 'NO RESPONSE',
            type: 'DTC'
          });
          
          let moduleStatus: 'success' | 'failed' | 'no_response' = 'no_response';
          let moduleDtcCount = 0;
          
          if (modResult.dtcBytes && !modResult.dtcBytes.includes('ERROR') && !modResult.dtcBytes.toUpperCase().includes('NO DATA')) {
            moduleStatus = 'success';
            const modParse = parseOBDResponseV2(modResult.dtcBytes, '03', selectedManufacturer?.id, selectedYear || undefined);
            moduleDtcCount = modParse.dtcs.length;
            modParse.dtcs.forEach(dtc => {
              if (!allStoredDTCs.has(dtc.code)) {
                allStoredDTCs.set(dtc.code, { ...dtc, ecuSource: modResult.module } as DTCResult);
                logger.info(MODULE, `Found DTC from ${modResult.module}`, { code: dtc.code });
              }
            });
          } else if (modResult.dtcBytes?.toUpperCase().includes('NO DATA')) {
            moduleStatus = 'success';
          } else if (modResult.dtcBytes?.includes('ERROR')) {
            moduleStatus = 'failed';
          }
          
          setScannedComponents(prev => [...prev, {
            name: modResult.module,
            status: moduleStatus,
            dtcsFound: moduleDtcCount,
          }]);
          
          await new Promise(r => setTimeout(r, 50));
        }
        setStoredDTCs(Array.from(allStoredDTCs.values()));
        
        rawDataRef.current.push({
          timestamp: new Date().toISOString(),
          command: 'Multi-Module Scan Complete',
          response: `Scanned ${moduleResults.length} modules`,
          type: 'DTC'
        });
            
      } catch (modErr) {
        logger.warn(MODULE, 'Module scan failed', { error: (modErr as Error).message });
        rawDataRef.current.push({
          timestamp: new Date().toISOString(),
          command: 'Module Scan Error',
          response: (modErr as Error).message,
          type: 'DTC'
        });
        
        setScannedComponents(prev => [...prev, {
          name: 'Multi-Module Scan',
          status: 'failed',
          dtcsFound: 0,
        }]);
      }

      // UDS Enhanced scan
      setCurrentComponent('UDS Enhanced Diagnostics');
      setScannedComponents(prev => [...prev, {
        name: 'UDS Enhanced Scan',
        status: 'success',
        dtcsFound: 0,
      }]);
      
      try {
        logger.info(MODULE, 'Attempting UDS 0x19 Enhanced DTC Scan...');
        
        rawDataRef.current.push({
          timestamp: new Date().toISOString(),
          command: 'Starting UDS 0x19 Scan',
          response: 'ReadDTCInformation with status mask 0xFF',
          type: 'DTC'
        });
        
        const enhancedResult = await elm327Ref.current!.readEnhancedDTCsAdvanced();
        
        enhancedResult.allResponses.forEach(resp => {
          rawDataRef.current.push({
            timestamp: new Date().toISOString(),
            command: 'UDS Response',
            response: resp,
            type: 'DTC'
          });
        });
        
        if (enhancedResult.bufferFullDetected) {
          logger.warn(MODULE, 'BUFFER FULL detected - using chunked response method');
          rawDataRef.current.push({
            timestamp: new Date().toISOString(),
            command: 'BUFFER FULL Detected',
            response: 'Using chunked response method to capture all DTCs',
            type: 'DTC'
          });
        }
        
        if (enhancedResult.rawResponse && !enhancedResult.error) {
          const udsDTCs = elm327Ref.current!.parseUDSResponse(enhancedResult.rawResponse);
          
          rawDataRef.current.push({
            timestamp: new Date().toISOString(),
            command: 'UDS Parse Result',
            response: `Found ${udsDTCs.length} DTCs: ${udsDTCs.map(d => d.code).join(', ') || 'None'}`,
            type: 'DTC'
          });
          
          udsDTCs.forEach(udsDtc => {
            if (!allStoredDTCs.has(udsDtc.code)) {
              const dtcResult: DTCResult = {
                code: udsDtc.code,
                category: (udsDtc.code[0] as DTCCategory) || 'P',
                categoryName: DTCCategoryNames[udsDtc.code[0] as DTCCategory] || 'Unknown',
                description: getDTCDescription(udsDtc.code),
                rawHex: udsDtc.rawBytes,
                isManufacturerSpecific: udsDtc.code[1] !== '0',
                ecuSource: getComponentForDTC(udsDtc.code),
              };
              allStoredDTCs.set(udsDtc.code, dtcResult);
              logger.info(MODULE, `Added UDS DTC: ${udsDtc.code}`);
            }
          });
          
          setStoredDTCs(Array.from(allStoredDTCs.values()));
        }
      } catch (enhErr) {
        logger.warn(MODULE, 'UDS Enhanced scan failed', { error: (enhErr as Error).message });
        rawDataRef.current.push({
          timestamp: new Date().toISOString(),
          command: 'UDS Scan Error',
          response: (enhErr as Error).message,
          type: 'DTC'
        });
      }
      
      rawDataRef.current.push({
        timestamp: new Date().toISOString(),
        command: '=== ENHANCED DIAGNOSTICS END ===',
        response: `Total DTCs found: ${allStoredDTCs.size}`,
        type: 'DTC'
      });

      // Live Data Scan Phase
      if (scanActiveRef.current) {
        setCurrentScanPhase('Live Data Collection');
        setCurrentComponent('Reading vehicle sensors...');
        
        for (const pid of priorityPIDs) {
          if (!scanActiveRef.current) break;
          try {
            const result = await elm327Ref.current!.scanLiveData(pid);
            const parsed = parseLiveDataResponse(pid, result.response);
            if (parsed) {
              allLiveData.set(pid, parsed);
              setLiveData(Array.from(allLiveData.values()));
            }
            rawDataRef.current.push({
              timestamp: new Date().toISOString(),
              command: `01${pid} (PID ${pid})`,
              response: result.response || 'NO RESPONSE',
              type: 'LIVE'
            });
          } catch (err) {}
          await new Promise(r => setTimeout(r, 100));
        }
      }

      // Mark scan as complete
      setCurrentScanPhase('Scan Complete');
      setCurrentComponent('Preparing results...');

      clearInterval(countdownInterval);
      scanActiveRef.current = false;
      setScanProgress(1);
      setRemainingTime(0);
      
      setRawDataEntries([...rawDataRef.current]);

      const finalLiveData = Array.from(allLiveData.values());
      const jsonResult = createScanResultJSON(
        sessionId, session.timestamp, Math.round((Date.now() - startTime) / 1000), protocol,
        { manufacturer: selectedManufacturer?.name || null, manufacturerId: selectedManufacturer?.id || null, year: selectedYear || null, vin: vehicleVIN },
        Array.from(allStoredDTCs.values()).map(d => ({ code: d.code, category: d.categoryName, description: d.description, isManufacturerSpecific: d.isManufacturerSpecific, ecuSource: d.ecuSource })),
        Array.from(allPendingDTCs.values()).map(d => ({ code: d.code, category: d.categoryName, description: d.description, isManufacturerSpecific: d.isManufacturerSpecific, ecuSource: d.ecuSource })),
        Array.from(allPermanentDTCs.values()).map(d => ({ code: d.code, category: d.categoryName, description: d.description, isManufacturerSpecific: d.isManufacturerSpecific, ecuSource: d.ecuSource })),
        finalLiveData, cycleCount,
        inspectionId.trim() || undefined
      );
      setScanResultJSON(jsonResult);

      session.status = 'completed';
      session.duration = Math.round((Date.now() - startTime) / 1000);
      session.storedDTCs = Array.from(allStoredDTCs.values());
      session.pendingDTCs = Array.from(allPendingDTCs.values());
      session.permanentDTCs = Array.from(allPermanentDTCs.values());
      session.liveData = finalLiveData.map(ld => ({
        pid: ld.pid, name: ld.name, shortName: ld.shortName, value: ld.value,
        displayValue: ld.displayValue, unit: ld.unit, category: ld.category, timestamp: ld.timestamp, rawHex: ld.rawHex,
      }));
      session.scanCycles = cycleCount;
      session.jsonResult = jsonResult;
      setCurrentSession(session);

      await saveScanSession(session);
      await loadHistory();
      setState('results');

    } catch (err: any) {
      clearInterval(countdownInterval);
      scanActiveRef.current = false;
      setErrorMsg(err.message);
      setState('error');
    }
  }, [scanDuration, protocol, selectedManufacturer, selectedYear, loadHistory, inspectionId, vehicleVIN]);

  const stopScan = useCallback(() => {
    scanActiveRef.current = false;
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setDevices([]);
    setStoredDTCs([]);
    setPendingDTCs([]);
    setPermanentDTCs([]);
    setLiveData([]);
    setProtocol('');
    setErrorMsg('');
    setScanProgress(0);
    setScanResultJSON(null);
    setVehicleVIN(null);
  }, []);

  const disconnect = useCallback(async () => {
    await adapterRef.current?.disconnect?.();
    elm327Ref.current = null;
    reset();
  }, [reset]);

  const copyJSONResult = async () => {
    if (scanResultJSON) {
      await Clipboard.setStringAsync(JSON.stringify(scanResultJSON, null, 2));
      Alert.alert('Copied', 'JSON result copied to clipboard');
    }
  };

  const copyLogsToClipboard = async (format: 'json' | 'txt') => {
    try {
      const content = format === 'json' ? logger.exportAsJSON() : logger.exportAsTXT();
      if (!content || content.length === 0) {
        Alert.alert('No Data', 'No logs to copy. Use the app to generate logs.');
        return;
      }
      await Clipboard.setStringAsync(content);
      Alert.alert('Copied', `Logs copied to clipboard (${format.toUpperCase()})`);
    } catch (err) {
      console.error('Copy logs error:', err);
      Alert.alert('Error', 'Failed to copy logs. Please try again.');
    }
  };

  // Render helpers
  const renderDTCItem = ({ item, codeCategory }: { item: DTCResult; codeCategory?: 'History' | 'Current' | 'Pending' }) => {
    const severity = getDTCSeverity(item.code);
    const severityInfo = getSeverityInfo(severity);
    const knowledge = getDTCKnowledge(item.code);
    
    return (
      <TouchableOpacity 
        style={[styles.dtcItem, { borderLeftColor: severityInfo.color }]}
        onPress={() => {
          setSelectedDTC(item);
          setDtcDetailVisible(true);
        }}
        activeOpacity={0.7}
        testID={`dtc-item-${item.code}`}
      >
        <View style={styles.dtcHeader}>
          <View style={[styles.dtcCodeBadge, { backgroundColor: DTCCategoryColors[item.category] + '20', borderColor: DTCCategoryColors[item.category] }]}>
            <Text style={[styles.dtcCode, { color: DTCCategoryColors[item.category] }]}>{item.code}</Text>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: severityInfo.color + '20' }]}>
            <MaterialIcons name={severityInfo.icon as any} size={12} color={severityInfo.color} />
            <Text style={[styles.severityText, { color: severityInfo.color }]}>{severityInfo.label}</Text>
          </View>
          {codeCategory && (
            <View style={styles.codeCategoryBadge}>
              <Text style={[styles.codeCategoryText, { 
                color: codeCategory === 'Current' ? Colors.error : 
                       codeCategory === 'Pending' ? Colors.warning : Colors.textMuted
              }]}>{codeCategory}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.dtcDesc} numberOfLines={2}>{item.description}</Text>
        
        <View style={styles.dtcPreview}>
          <Text style={styles.dtcPreviewLabel}>Top Cause:</Text>
          <Text style={styles.dtcPreviewText} numberOfLines={1}>{knowledge.causes[0]}</Text>
        </View>
        
        <View style={styles.dtcTapHint}>
          <Text style={styles.dtcTapHintText}>Tap for details</Text>
          <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  const filteredLogs = (logs || []).filter((entry) => {
    if (!entry) return false;
    if (logFilter !== null && entry.level < logFilter) return false;
    if (logModuleFilter && entry.module !== logModuleFilter) return false;
    return true;
  });

  const modules = [...new Set((logs || []).filter(e => e).map((e) => e.module))];

  // Main content renderer
  const renderContent = () => {
    if (state === 'idle') {
      return (
        <>
          <View style={styles.inspectionCard}>
            <View style={styles.inspectionHeader}>
              <MaterialIcons name="assignment" size={20} color={Colors.accent} />
              <Text style={styles.inspectionLabel}>Inspection ID</Text>
            </View>
            <TextInput
              style={styles.inspectionInput}
              placeholder="Enter inspection ID (e.g., INS-2025-001)"
              placeholderTextColor={Colors.textMuted}
              value={inspectionId}
              onChangeText={setInspectionId}
              autoCapitalize="characters"
              testID="inspection-id-input"
            />
            {inspectionId.trim() !== '' && (
              <View style={styles.inspectionBadge}>
                <MaterialIcons name="check-circle" size={14} color={Colors.success} />
                <Text style={styles.inspectionBadgeText}>ID Set: {inspectionId}</Text>
              </View>
            )}
          </View>

          <View style={styles.vehicleCard}>
            <Text style={styles.cardLabel}>Vehicle Information</Text>
            <ManufacturerSelector
              selectedManufacturer={selectedManufacturer}
              selectedYear={selectedYear}
              onManufacturerChange={setSelectedManufacturer}
              onYearChange={setSelectedYear}
            />
          </View>

          <TouchableOpacity style={styles.scanBtn} onPress={startDiscovery} testID="connect-scan-btn">
            <MaterialIcons name="bluetooth-searching" size={24} color={Colors.textInverse} />
            <Text style={styles.scanBtnText}>Connect & Scan</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (state === 'discovering') {
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Available Devices</Text>
            <ActivityIndicator size="small" color={Colors.accent} />
          </View>
          {devices.length === 0 ? (
            <Text style={styles.hintText}>Searching for Bluetooth devices...</Text>
          ) : (
            devices.map((device) => (
              <TouchableOpacity 
                key={device.id} 
                style={styles.deviceItem} 
                onPress={() => connectToDevice(device)}
                testID={`device-${device.id}`}
              >
                <View style={styles.deviceIcon}>
                  <MaterialIcons name="bluetooth" size={20} color={Colors.accent} />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
                  <Text style={styles.deviceId}>{device.id}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity style={styles.cancelBtn} onPress={reset} testID="cancel-discovery-btn">
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (state === 'connecting' || state === 'initializing') {
      return (
        <View style={styles.statusCard}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.statusTitle}>
            {state === 'connecting' ? 'Connecting...' : 'Initializing...'}
          </Text>
          <Text style={styles.statusSubtitle}>{connectedDeviceName}</Text>
          {initSteps.length > 0 && (
            <View style={styles.initSteps}>
              {initSteps.slice(-4).map((step, idx) => (
                <View key={idx} style={styles.initStep}>
                  <MaterialIcons
                    name={step.status === 'success' ? 'check-circle' : step.status === 'failed' ? 'error' : 'hourglass-empty'}
                    size={16}
                    color={step.status === 'success' ? Colors.success : step.status === 'failed' ? Colors.error : Colors.textMuted}
                  />
                  <Text style={styles.initStepText}>{step.description}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      );
    }

    if (state === 'ready') {
      return (
        <>
          <View style={styles.readyCard}>
            <MaterialIcons name="check-circle" size={56} color={Colors.success} />
            <Text style={styles.readyTitle}>Connected</Text>
            <Text style={styles.readyDevice}>{connectedDeviceName}</Text>
            <Text style={styles.readyProtocol}>{protocol}</Text>
            <Text style={styles.readyDuration}>Scan Duration: {scanDuration}s</Text>
          </View>

          <TouchableOpacity style={styles.scanBtn} onPress={startScan} testID="start-scan-btn">
            <MaterialIcons name="play-arrow" size={24} color={Colors.textInverse} />
            <Text style={styles.scanBtnText}>Start Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect} testID="disconnect-btn">
            <Text style={styles.disconnectBtnText}>Disconnect</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (state === 'scanning') {
      const completedComponents = scannedComponents;
      const overallProgress = totalComponents > 0 ? completedComponents.length / totalComponents : 0;
      
      return (
        <View style={styles.scanningContainer}>
          <View style={styles.scanPhaseCard}>
            <Text style={styles.scanPhaseTitle}>{currentScanPhase || 'Initializing...'}</Text>
            
            {currentComponent && (
              <View style={styles.currentComponentRow}>
                <ActivityIndicator size="small" color={Colors.accent} style={{ marginRight: Spacing.sm }} />
                <Text style={styles.currentComponentText}>{currentComponent}</Text>
              </View>
            )}
            
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${overallProgress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {totalComponents > 0 
                ? `${completedComponents.length} of ${totalComponents} components scanned`
                : 'Preparing scan...'
              }
            </Text>
          </View>

          {scannedComponents.length > 0 && (
            <View style={styles.scannedComponentsCard}>
              <Text style={styles.scannedComponentsTitle}>Scanned Modules</Text>
              <ScrollView style={styles.scannedComponentsList} showsVerticalScrollIndicator={false}>
                {scannedComponents.slice(-6).map((comp, idx) => (
                  <View key={`${comp.name}-${idx}`} style={styles.scannedComponentItem}>
                    <MaterialIcons 
                      name={comp.status === 'success' ? 'check-circle' : comp.status === 'failed' ? 'error' : 'remove-circle'} 
                      size={16} 
                      color={comp.status === 'success' ? Colors.success : comp.status === 'failed' ? Colors.error : Colors.textMuted} 
                    />
                    <Text style={styles.scannedComponentName} numberOfLines={1}>{comp.name}</Text>
                    {comp.dtcsFound !== undefined && comp.dtcsFound > 0 && (
                      <View style={styles.dtcCountBadge}>
                        <Text style={styles.dtcCountText}>{comp.dtcsFound} DTC{comp.dtcsFound > 1 ? 's' : ''}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{storedDTCs.length}</Text>
              <Text style={styles.statLabel}>Stored</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{pendingDTCs.length}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{permanentDTCs.length}</Text>
              <Text style={styles.statLabel}>Permanent</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{liveData.length}</Text>
              <Text style={styles.statLabel}>Live</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.stopBtn} onPress={stopScan} testID="stop-scan-btn">
            <MaterialIcons name="stop" size={24} color={Colors.textInverse} />
            <Text style={styles.stopBtnText}>Stop Scan</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (state === 'results') {
      const totalDTCs = storedDTCs.length + pendingDTCs.length + permanentDTCs.length;
      return (
        <View style={styles.resultsContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, totalDTCs > 0 && styles.summaryValueError]}>{totalDTCs}</Text>
              <Text style={styles.summaryLabel}>DTCs Found</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{liveData.length}</Text>
              <Text style={styles.summaryLabel}>Live Data</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{currentSession?.duration || 0}s</Text>
              <Text style={styles.summaryLabel}>Duration</Text>
            </View>
          </View>

          {vehicleVIN && (
            <View style={styles.vinCard}>
              <Text style={styles.vinLabel}>VIN</Text>
              <Text style={styles.vinValue}>{vehicleVIN}</Text>
            </View>
          )}

          {storedDTCs.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionTitle}>Stored DTCs (History)</Text>
              {storedDTCs.map((dtc, idx) => <View key={`stored-${dtc.code}-${idx}`}>{renderDTCItem({ item: dtc, codeCategory: 'History' })}</View>)}
            </View>
          )}

          {pendingDTCs.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionTitle}>Pending DTCs</Text>
              {pendingDTCs.map((dtc, idx) => <View key={`pending-${dtc.code}-${idx}`}>{renderDTCItem({ item: dtc, codeCategory: 'Pending' })}</View>)}
            </View>
          )}

          {permanentDTCs.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionTitle}>Current DTCs (Active)</Text>
              {permanentDTCs.map((dtc, idx) => <View key={`permanent-${dtc.code}-${idx}`}>{renderDTCItem({ item: dtc, codeCategory: 'Current' })}</View>)}
            </View>
          )}

          {liveData.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionTitle}>Live Data</Text>
              <View style={styles.liveDataGrid}>
                {liveData.map((item) => (
                  <View key={item.pid} style={styles.liveDataCard}>
                    <Text style={styles.liveDataName}>{item.shortName}</Text>
                    <Text style={styles.liveDataValue}>{item.displayValue}</Text>
                    <Text style={styles.liveDataUnit}>{item.unit}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {scanResultJSON && (
            <TouchableOpacity style={styles.jsonBtn} onPress={copyJSONResult} testID="copy-json-btn">
              <MaterialIcons name="code" size={20} color={Colors.accent} />
              <Text style={styles.jsonBtnText}>Copy JSON Result</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.scanBtn} onPress={startScan} testID="scan-again-btn">
            <MaterialIcons name="refresh" size={24} color={Colors.textInverse} />
            <Text style={styles.scanBtnText}>Scan Again</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.homeBtn} onPress={disconnect} testID="back-home-btn">
            <MaterialIcons name="home" size={20} color={Colors.accent} />
            <Text style={styles.homeBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (state === 'error') {
      return (
        <View style={styles.errorCard}>
          <MaterialIcons name="error-outline" size={64} color={Colors.error} />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorMessage}>{errorMsg}</Text>
          <TouchableOpacity style={styles.scanBtn} onPress={reset} testID="try-again-btn">
            <Text style={styles.scanBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Image source={{ uri: WISEDRIVE_LOGO_HORIZONTAL }} style={styles.logo} resizeMode="contain" />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity style={styles.navBtn} onPress={() => {
          logger.info(MODULE, 'Raw Data button pressed', { rawDataCount: rawDataEntries.length });
          setRawDataVisible(true);
        }} testID="raw-data-btn">
          <MaterialIcons name="data-array" size={18} color={Colors.accent} />
          <Text style={styles.navBtnText}>Raw Data</Text>
        </TouchableOpacity>
        <View style={styles.navDivider} />
        <TouchableOpacity style={styles.navBtn} onPress={() => { 
          logger.info(MODULE, 'History button pressed');
          loadHistory(); 
          setHistoryVisible(true); 
        }} testID="history-btn">
          <MaterialIcons name="history" size={18} color={Colors.accent} />
          <Text style={styles.navBtnText}>History</Text>
        </TouchableOpacity>
        <View style={styles.navDivider} />
        <TouchableOpacity style={styles.navBtn} onPress={() => {
          logger.info(MODULE, 'Logs button pressed');
          setLogsVisible(true);
        }} testID="logs-btn">
          <MaterialIcons name="article" size={18} color={Colors.accent} />
          <Text style={styles.navBtnText}>Logs</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 4) }]}>
        <Text style={styles.footerText}>WiseDrive OBD-II Scanner v{APP_VERSION}</Text>
      </View>

      {/* History Modal */}
      <Modal visible={historyVisible} animationType="slide" statusBarTranslucent>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Scan History</Text>
            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={() => setHistoryVisible(false)}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              testID="close-history-modal"
            >
              <MaterialIcons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>
          {sessions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="history" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No History</Text>
              <Text style={styles.emptySubtitle}>Complete a scan to see results here</Text>
            </View>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={(s) => s.id}
              contentContainerStyle={styles.historyList}
              renderItem={({ item }) => {
                const totalDTCs = item.storedDTCs.length + item.pendingDTCs.length + item.permanentDTCs.length;
                const date = new Date(item.timestamp);
                const allDTCs = [...item.storedDTCs, ...item.pendingDTCs, ...item.permanentDTCs];
                return (
                  <View style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <MaterialIcons
                        name={item.status === 'completed' ? 'check-circle' : 'error'}
                        size={20}
                        color={item.status === 'completed' ? Colors.success : Colors.error}
                      />
                      <Text style={styles.historyDate}>
                        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={styles.historyStats}>
                      <View style={styles.historyStat}>
                        <Text style={styles.historyStatValue}>{item.duration}s</Text>
                        <Text style={styles.historyStatLabel}>Duration</Text>
                      </View>
                      <View style={styles.historyStat}>
                        <Text style={[styles.historyStatValue, totalDTCs > 0 && { color: Colors.error }]}>{totalDTCs}</Text>
                        <Text style={styles.historyStatLabel}>DTCs</Text>
                      </View>
                      <View style={styles.historyStat}>
                        <Text style={styles.historyStatValue}>{item.liveData?.length || 0}</Text>
                        <Text style={styles.historyStatLabel}>Live</Text>
                      </View>
                    </View>
                    
                    {totalDTCs > 0 && (
                      <View style={styles.historyDTCsSection}>
                        <Text style={styles.historySectionTitle}>Diagnostic Codes</Text>
                        <View style={styles.historyDTCs}>
                          {allDTCs.map((dtc, idx) => (
                            <View key={`${dtc.code}-${idx}`} style={[styles.historyDTCTag, { borderColor: DTCCategoryColors[dtc.category] }]}>
                              <Text style={[styles.historyDTCText, { color: DTCCategoryColors[dtc.category] }]}>{dtc.code}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                    
                    {item.liveData && item.liveData.length > 0 && (
                      <View style={styles.historyLiveDataSection}>
                        <Text style={styles.historySectionTitle}>Live Data</Text>
                        <View style={styles.historyLiveDataGrid}>
                          {item.liveData.map((ld, idx) => (
                            <View key={`${ld.pid}-${idx}`} style={styles.historyLiveDataItem}>
                              <Text style={styles.historyLiveDataName}>{ld.shortName}</Text>
                              <Text style={styles.historyLiveDataValue}>{ld.displayValue} <Text style={styles.historyLiveDataUnit}>{ld.unit}</Text></Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          )}
          <View style={{ height: insets.bottom }} />
        </View>
      </Modal>

      {/* Logs Modal */}
      <Modal visible={logsVisible} animationType="slide" statusBarTranslucent>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Debug Logs</Text>
            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={() => setLogsVisible(false)}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              testID="close-logs-modal"
            >
              <MaterialIcons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.copyAllBtn} onPress={() => copyLogsToClipboard('txt')} testID="copy-all-logs-btn">
            <MaterialIcons name="content-copy" size={20} color={Colors.textInverse} />
            <Text style={styles.copyAllBtnText}>Copy All Logs</Text>
          </TouchableOpacity>

          <View style={styles.logsFilters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                { label: 'All', value: null },
                { label: 'Errors', value: LogLevel.ERROR },
                { label: 'Warnings', value: LogLevel.WARN },
                { label: 'Info', value: LogLevel.INFO },
              ].map((f) => (
                <TouchableOpacity
                  key={f.label}
                  style={[styles.filterChip, logFilter === f.value && styles.filterChipActive]}
                  onPress={() => setLogFilter(f.value)}
                >
                  <Text style={[styles.filterChipText, logFilter === f.value && styles.filterChipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.logsExport}>
            <Text style={styles.logsCount}>{filteredLogs?.length || 0} logs</Text>
            <TouchableOpacity style={styles.exportBtn} onPress={() => copyLogsToClipboard('json')}>
              <MaterialIcons name="code" size={16} color={Colors.accent} />
              <Text style={styles.exportBtnText}>JSON</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={() => copyLogsToClipboard('txt')}>
              <MaterialIcons name="text-snippet" size={16} color={Colors.accent} />
              <Text style={styles.exportBtnText}>TXT</Text>
            </TouchableOpacity>
          </View>

          {(!filteredLogs || filteredLogs.length === 0) ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="article" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Logs Yet</Text>
              <Text style={styles.emptySubtitle}>Logs will appear here as you use the app</Text>
            </View>
          ) : (
            <FlatList
              data={filteredLogs.slice(-100).reverse()}
              keyExtractor={(item, i) => item?.id || i.toString()}
              contentContainerStyle={styles.logsList}
              renderItem={({ item }) => item ? (
                <View style={[styles.logEntry, { borderLeftColor: LogLevelColors[item.level] || Colors.textMuted }]}>
                  <View style={styles.logHeader}>
                    <Text style={[styles.logLevel, { color: LogLevelColors[item.level] || Colors.text }]}>{LogLevelNames[item.level] || 'LOG'}</Text>
                    <Text style={styles.logModule}>{item.module || 'APP'}</Text>
                    <Text style={styles.logTime}>{item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}</Text>
                  </View>
                  <Text style={styles.logMessage} numberOfLines={2}>{item.action || ''}</Text>
                </View>
              ) : null}
            />
          )}
          <View style={{ height: insets.bottom }} />
        </View>
      </Modal>

      {/* Raw Data Modal */}
      <Modal visible={rawDataVisible} animationType="slide" statusBarTranslucent>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Raw OBD Data</Text>
            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={() => setRawDataVisible(false)}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              testID="close-raw-data-modal"
            >
              <MaterialIcons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.copyAllBtn} 
            onPress={async () => {
              try {
                const entries = rawDataEntries || [];
                if (entries.length === 0) {
                  Alert.alert('No Data', 'No raw data to copy. Run a scan first.');
                  return;
                }
                const rawText = entries.map(e => 
                  `[${e?.timestamp || ''}] [${e?.type || ''}] ${e?.command || ''}\n${e?.response || 'NO RESPONSE'}`
                ).join('\n\n');
                await Clipboard.setStringAsync(rawText);
                Alert.alert('Copied', `${entries.length} entries copied to clipboard`);
              } catch (err) {
                Alert.alert('Error', 'Failed to copy raw data');
              }
            }}
            testID="copy-all-raw-btn"
          >
            <MaterialIcons name="content-copy" size={20} color={Colors.textInverse} />
            <Text style={styles.copyAllBtnText}>Copy All Raw Data</Text>
          </TouchableOpacity>

          <View style={styles.rawDataStats}>
            <Text style={styles.rawDataStatsText}>
              {rawDataEntries?.length || 0} entries | DTC: {rawDataEntries?.filter(e => e?.type === 'DTC').length || 0} | Live: {rawDataEntries?.filter(e => e?.type === 'LIVE').length || 0}
            </Text>
          </View>

          {(!rawDataEntries || rawDataEntries.length === 0) ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="data-array" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Raw Data</Text>
              <Text style={styles.emptySubtitle}>Start a scan to capture raw OBD responses</Text>
            </View>
          ) : (
            <FlatList
              data={rawDataEntries}
              keyExtractor={(_, i) => i.toString()}
              contentContainerStyle={styles.rawDataList}
              renderItem={({ item }) => item ? (
                <View style={[styles.rawDataEntry, { borderLeftColor: item.type === 'DTC' ? Colors.warning : Colors.success }]}>
                  <View style={styles.rawDataHeader}>
                    <Text style={[styles.rawDataType, { color: item.type === 'DTC' ? Colors.warning : Colors.success }]}>
                      {item.type || 'DATA'}
                    </Text>
                    <Text style={styles.rawDataCommand}>{item.command || ''}</Text>
                    <Text style={styles.rawDataTime}>
                      {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}
                    </Text>
                  </View>
                  <Text style={styles.rawDataResponse} selectable>{item.response || 'NO RESPONSE'}</Text>
                </View>
              ) : null}
            />
          )}
          <View style={{ height: insets.bottom }} />
        </View>
      </Modal>

      {/* DTC Detail Modal */}
      <Modal visible={dtcDetailVisible} animationType="slide" statusBarTranslucent>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>DTC Details</Text>
            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={() => {
                setDtcDetailVisible(false);
                setSelectedDTC(null);
              }}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              testID="close-dtc-detail-modal"
            >
              <MaterialIcons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {selectedDTC && (() => {
            const severity = getDTCSeverity(selectedDTC.code);
            const severityInfo = getSeverityInfo(severity);
            const knowledge = getDTCKnowledge(selectedDTC.code);
            
            return (
              <ScrollView style={styles.dtcDetailScroll} showsVerticalScrollIndicator={false}>
                <View style={[styles.dtcDetailHeader, { borderLeftColor: severityInfo.color }]}>
                  <View style={styles.dtcDetailCodeRow}>
                    <Text style={[styles.dtcDetailCode, { color: severityInfo.color }]}>{selectedDTC.code}</Text>
                    <View style={[styles.dtcDetailSeverityBadge, { backgroundColor: severityInfo.color }]}>
                      <MaterialIcons name={severityInfo.icon as any} size={14} color={Colors.textInverse} />
                      <Text style={styles.dtcDetailSeverityText}>{severityInfo.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.dtcDetailDesc}>{selectedDTC.description}</Text>
                  {selectedDTC.ecuSource && (
                    <View style={styles.dtcDetailComponent}>
                      <MaterialIcons name="memory" size={16} color={Colors.accent} />
                      <Text style={styles.dtcDetailComponentText}>{selectedDTC.ecuSource}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.dtcDetailSection}>
                  <View style={styles.dtcDetailSectionHeader}>
                    <MaterialIcons name="help-outline" size={20} color={Colors.warning} />
                    <Text style={styles.dtcDetailSectionTitle}>Possible Causes</Text>
                  </View>
                  {knowledge.causes.map((cause, idx) => (
                    <View key={idx} style={styles.dtcDetailListItem}>
                      <Text style={styles.dtcDetailListBullet}>•</Text>
                      <Text style={styles.dtcDetailListText}>{cause}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.dtcDetailSection}>
                  <View style={styles.dtcDetailSectionHeader}>
                    <MaterialIcons name="build" size={20} color={Colors.success} />
                    <Text style={styles.dtcDetailSectionTitle}>Recommended Solutions</Text>
                  </View>
                  {knowledge.solutions.map((solution: string, idx: number) => (
                    <View key={idx} style={styles.dtcDetailListItem}>
                      <Text style={styles.dtcDetailListNumber}>{idx + 1}.</Text>
                      <Text style={styles.dtcDetailListText}>{solution}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.dtcDetailSection}>
                  <View style={styles.dtcDetailSectionHeader}>
                    <MaterialIcons name="warning" size={20} color={Colors.error} />
                    <Text style={styles.dtcDetailSectionTitle}>Symptoms</Text>
                  </View>
                  {knowledge.symptoms.map((symptom, idx) => (
                    <View key={idx} style={styles.dtcDetailListItem}>
                      <Text style={styles.dtcDetailListBullet}>•</Text>
                      <Text style={styles.dtcDetailListText}>{symptom}</Text>
                    </View>
                  ))}
                </View>
                
                <View style={{ height: insets.bottom + Spacing.xxl }} />
              </ScrollView>
            );
          })()}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.surface, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center' },
  logo: { width: 160, height: 32 },
  content: { flex: 1 },
  contentContainer: { padding: Spacing.lg },
  inspectionCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  inspectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  inspectionLabel: { color: Colors.text, fontSize: FontSize.base, fontWeight: '600' },
  inspectionInput: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  inspectionBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  inspectionBadgeText: { color: Colors.success, fontSize: FontSize.sm },
  vehicleCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  cardLabel: { color: Colors.text, fontSize: FontSize.base, fontWeight: '700', marginBottom: Spacing.md },
  scanBtn: { backgroundColor: Colors.accent, borderRadius: Radius.lg, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  scanBtnText: { color: Colors.textInverse, fontSize: FontSize.lg, fontWeight: '700' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  cardTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  hintText: { color: Colors.textMuted, fontSize: FontSize.base, textAlign: 'center', paddingVertical: Spacing.xl },
  deviceItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  deviceIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  deviceInfo: { flex: 1 },
  deviceName: { color: Colors.text, fontSize: FontSize.base, fontWeight: '600' },
  deviceId: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  cancelBtn: { marginTop: Spacing.lg, alignItems: 'center', padding: Spacing.md },
  cancelBtnText: { color: Colors.textMuted, fontSize: FontSize.base, fontWeight: '600' },
  statusCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statusTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginTop: Spacing.lg },
  statusSubtitle: { color: Colors.textMuted, fontSize: FontSize.base, marginTop: Spacing.xs },
  initSteps: { marginTop: Spacing.lg, width: '100%' },
  initStep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  initStepText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  readyCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xxl, alignItems: 'center', marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  readyTitle: { color: Colors.success, fontSize: FontSize.xxl, fontWeight: '700', marginTop: Spacing.md },
  readyDevice: { color: Colors.text, fontSize: FontSize.lg, marginTop: Spacing.xs },
  readyProtocol: { color: Colors.accent, fontSize: FontSize.base, fontWeight: '600', marginTop: Spacing.xs },
  readyDuration: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: Spacing.sm },
  disconnectBtn: { marginTop: Spacing.md, alignItems: 'center', padding: Spacing.md },
  disconnectBtnText: { color: Colors.textMuted, fontSize: FontSize.base, fontWeight: '600' },
  scanningContainer: { flex: 1 },
  scanPhaseCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  scanPhaseTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.md },
  currentComponentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  currentComponentText: { color: Colors.accent, fontSize: FontSize.base, fontWeight: '500' },
  progressBar: { height: 8, backgroundColor: Colors.bg, borderRadius: 4, overflow: 'hidden', marginBottom: Spacing.sm },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 4 },
  progressText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
  scannedComponentsCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border, maxHeight: 200 },
  scannedComponentsTitle: { color: Colors.text, fontSize: FontSize.base, fontWeight: '700', marginBottom: Spacing.sm },
  scannedComponentsList: { flex: 1 },
  scannedComponentItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  scannedComponentName: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.sm },
  dtcCountBadge: { backgroundColor: Colors.error + '20', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  dtcCountText: { color: Colors.error, fontSize: FontSize.xs, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statBox: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statValue: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  statLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: Spacing.xs },
  stopBtn: { backgroundColor: Colors.error, borderRadius: Radius.lg, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  stopBtnText: { color: Colors.textInverse, fontSize: FontSize.lg, fontWeight: '700' },
  resultsContainer: { flex: 1 },
  summaryCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700' },
  summaryValueError: { color: Colors.error },
  summaryLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: Spacing.xs },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
  vinCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  vinLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: Spacing.xs },
  vinValue: { color: Colors.text, fontSize: FontSize.base, fontWeight: '700', fontFamily: 'monospace' },
  resultSection: { marginBottom: Spacing.lg },
  resultSectionTitle: { color: Colors.text, fontSize: FontSize.base, fontWeight: '700', marginBottom: Spacing.md },
  liveDataGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  liveDataCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, minWidth: 100, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  liveDataName: { color: Colors.textMuted, fontSize: FontSize.xs },
  liveDataValue: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginVertical: Spacing.xs },
  liveDataUnit: { color: Colors.textSecondary, fontSize: FontSize.xs },
  jsonBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.accent + '40' },
  jsonBtnText: { color: Colors.accent, fontSize: FontSize.base, fontWeight: '600' },
  homeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg },
  homeBtnText: { color: Colors.accent, fontSize: FontSize.base, fontWeight: '600' },
  errorCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  errorTitle: { color: Colors.error, fontSize: FontSize.xxl, fontWeight: '700', marginTop: Spacing.lg },
  errorMessage: { color: Colors.textSecondary, fontSize: FontSize.base, textAlign: 'center', marginTop: Spacing.md, marginBottom: Spacing.xl, lineHeight: 22 },
  bottomNav: { flexDirection: 'row', backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, gap: 2 },
  navBtnText: { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '600' },
  navDivider: { width: 1, backgroundColor: Colors.border },
  footer: { backgroundColor: Colors.surface, alignItems: 'center', paddingVertical: Spacing.xs },
  footerText: { color: Colors.textMuted, fontSize: FontSize.xs },
  modalContainer: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  closeBtn: { padding: Spacing.sm },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginTop: Spacing.lg },
  emptySubtitle: { color: Colors.textMuted, fontSize: FontSize.base, marginTop: Spacing.xs, textAlign: 'center' },
  historyList: { padding: Spacing.lg },
  historyCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  historyDate: { color: Colors.text, fontSize: FontSize.base, fontWeight: '600' },
  historyStats: { flexDirection: 'row', gap: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  historyStat: { alignItems: 'center' },
  historyStatValue: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  historyStatLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  historyDTCsSection: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  historySectionTitle: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', marginBottom: Spacing.sm },
  historyDTCs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  historyDTCTag: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  historyDTCText: { fontSize: FontSize.xs, fontWeight: '700', fontFamily: 'monospace' },
  historyLiveDataSection: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  historyLiveDataGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  historyLiveDataItem: { backgroundColor: Colors.bg, borderRadius: Radius.sm, padding: Spacing.sm, minWidth: 80, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  historyLiveDataName: { color: Colors.textMuted, fontSize: 10 },
  historyLiveDataValue: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  historyLiveDataUnit: { color: Colors.textMuted, fontSize: 10 },
  copyAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.accent, borderRadius: Radius.md, padding: Spacing.md, marginHorizontal: Spacing.lg, marginTop: Spacing.sm },
  copyAllBtnText: { color: Colors.textInverse, fontSize: FontSize.base, fontWeight: '600' },
  logsFilters: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  filterChip: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginRight: Spacing.sm },
  filterChipActive: { backgroundColor: Colors.accent + '20', borderColor: Colors.accent },
  filterChipText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  filterChipTextActive: { color: Colors.accent },
  logsExport: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm },
  logsCount: { flex: 1, color: Colors.textMuted, fontSize: FontSize.sm },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  exportBtnText: { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '600' },
  logsList: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  logEntry: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.xs },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  logLevel: { fontSize: FontSize.xs, fontWeight: '700', fontFamily: 'monospace' },
  logModule: { color: Colors.textMuted, fontSize: FontSize.xs },
  logTime: { color: Colors.textMuted, fontSize: FontSize.xs, marginLeft: 'auto' },
  logMessage: { color: Colors.text, fontSize: FontSize.sm },
  rawDataStats: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  rawDataStatsText: { color: Colors.textMuted, fontSize: FontSize.sm },
  rawDataList: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  rawDataEntry: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.sm },
  rawDataHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  rawDataType: { fontSize: FontSize.xs, fontWeight: '700' },
  rawDataCommand: { flex: 1, color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  rawDataTime: { color: Colors.textMuted, fontSize: FontSize.xs },
  rawDataResponse: { color: Colors.textSecondary, fontSize: FontSize.xs, fontFamily: 'monospace', lineHeight: 16 },
  dtcItem: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  dtcHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm, flexWrap: 'wrap' },
  dtcCodeBadge: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  dtcCode: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: 'monospace' },
  severityBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: Radius.sm, paddingHorizontal: Spacing.xs, paddingVertical: 2 },
  severityText: { fontSize: 10, fontWeight: '700' },
  codeCategoryBadge: { marginLeft: 'auto' },
  codeCategoryText: { fontSize: FontSize.xs, fontWeight: '600' },
  dtcDesc: { color: Colors.text, fontSize: FontSize.sm, lineHeight: 18 },
  dtcPreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  dtcPreviewLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  dtcPreviewText: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.xs },
  dtcTapHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: Spacing.sm },
  dtcTapHintText: { color: Colors.textMuted, fontSize: FontSize.xs },
  dtcDetailScroll: { flex: 1, padding: Spacing.lg },
  dtcDetailHeader: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4 },
  dtcDetailCodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  dtcDetailCode: { fontSize: FontSize.xxl, fontWeight: '700', fontFamily: 'monospace' },
  dtcDetailSeverityBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  dtcDetailSeverityText: { color: Colors.textInverse, fontSize: FontSize.sm, fontWeight: '700' },
  dtcDetailDesc: { color: Colors.text, fontSize: FontSize.base, lineHeight: 22 },
  dtcDetailComponent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  dtcDetailComponentText: { color: Colors.accent, fontSize: FontSize.sm, fontWeight: '600' },
  dtcDetailSection: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  dtcDetailSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  dtcDetailSectionTitle: { color: Colors.text, fontSize: FontSize.base, fontWeight: '700' },
  dtcDetailListItem: { flexDirection: 'row', paddingVertical: Spacing.xs },
  dtcDetailListBullet: { color: Colors.textMuted, fontSize: FontSize.sm, width: 16 },
  dtcDetailListNumber: { color: Colors.accent, fontSize: FontSize.sm, fontWeight: '700', width: 24 },
  dtcDetailListText: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
});
