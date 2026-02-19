import { BLEAdapterInterface } from './ble-adapter';
import { ELM327InitStep, RawECUResponse } from '../types';
import { logger, generateId } from './logger';
import { 
  getManufacturerECUConfig, 
  getDefaultECUConfig,
  ManufacturerECUConfig 
} from '../constants/manufacturer-ecus';

// Progress callback type for component-wise scanning
export type ScanProgressCallback = (progress: {
  phase: string;
  component: string;
  componentIndex: number;
  totalComponents: number;
  status: 'scanning' | 'success' | 'failed' | 'no_response';
  dtcsFound?: number;
}) => void;

const MODULE = 'ELM327';

/**
 * ELM327 Initialization Commands
 * 
 * CRITICAL CHANGES for Multi-ECU Support and BUFFER FULL Prevention:
 * - ATH1: Headers ON - Required to see which ECU is responding
 * - ATS1: Spaces ON - Easier to parse hex bytes
 * - ATCAF1: CAN Auto Formatting ON - Proper response parsing
 * - ATST FF: Set timeout to maximum (255 x 4ms = 1020ms) - Wait for all ECUs
 * - ATAL: Allow Long messages - Support multi-frame responses
 * - ATCEA: CAN Extended Addressing - Support for larger data
 * - ATCFC1: CAN Flow Control ON - CRITICAL for preventing BUFFER FULL
 * - ATCM: CAN Monitor mode settings
 */
const INIT_COMMANDS: { command: string; description: string }[] = [
  { command: 'ATZ', description: 'Reset ELM327' },
  { command: 'ATE0', description: 'Echo Off' },
  { command: 'ATL1', description: 'Linefeeds On (for multi-ECU parsing)' },
  { command: 'ATS1', description: 'Spaces On (for hex parsing)' },
  { command: 'ATH1', description: 'Headers On (CRITICAL: see ECU IDs)' },
  { command: 'ATCAF1', description: 'CAN Auto Formatting On' },
  { command: 'ATAT2', description: 'Adaptive Timing Aggressive' },
  { command: 'ATST FF', description: 'Set Timeout Max (wait for all ECUs)' },
  { command: 'ATAL', description: 'Allow Long Messages' },
  { command: 'ATCFC1', description: 'CAN Flow Control ON (prevents BUFFER FULL)' },
  { command: 'ATSP0', description: 'Auto Protocol Detection' },
  { command: 'ATDPN', description: 'Describe Protocol Number' },
  { command: '0100', description: 'ECU Capability Check' },
];

export class ELM327Service {
  private adapter: BLEAdapterInterface;
  private protocol = 'Unknown';
  private protocolNumber = '';
  private ecuResponses: RawECUResponse[] = [];
  private commandTimeout = 8000;  // Increased to 8s for multi-ECU responses
  private maxRetries = 3;
  private isInitialized = false;

  constructor(adapter: BLEAdapterInterface) {
    this.adapter = adapter;
    logger.info(MODULE, 'ELM327 service created', {
      commandTimeout: this.commandTimeout,
      maxRetries: this.maxRetries,
    });
  }

  async initialize(
    onStepUpdate: (steps: ELM327InitStep[]) => void
  ): Promise<{ success: boolean; protocol: string; steps: ELM327InitStep[] }> {
    const steps: ELM327InitStep[] = INIT_COMMANDS.map((c) => ({
      command: c.command,
      description: c.description,
      status: 'pending' as const,
    }));

    logger.info(MODULE, 'Starting ELM327 initialization sequence', {
      commandCount: steps.length,
      commands: steps.map((s) => s.command),
      timeout: this.commandTimeout,
      maxRetries: this.maxRetries,
    });

    onStepUpdate([...steps]);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      step.status = 'running';
      onStepUpdate([...steps]);

      logger.info(MODULE, `Executing init command ${i + 1}/${steps.length}`, {
        command: step.command,
        description: step.description,
        index: i,
      });

      const startTime = Date.now();
      let success = false;
      let lastError = '';

      for (let retry = 0; retry <= this.maxRetries; retry++) {
        try {
          if (retry > 0) {
            logger.warn(MODULE, `Retrying command (attempt ${retry + 1})`, {
              command: step.command,
              previousError: lastError,
              attempt: retry + 1,
            });
          }

          const response = await this.sendCommand(step.command);
          const duration = Date.now() - startTime;

          step.status = 'success';
          step.response = response;
          step.durationMs = duration;

          if (step.command === 'ATDPN') {
            this.protocol = this.parseProtocolNumber(response);
            logger.info(MODULE, 'Protocol detected', {
              protocolNumber: response.trim(),
              protocolName: this.protocol,
            });
          }

          logger.info(MODULE, `Init command completed successfully`, {
            command: step.command,
            response: response.trim(),
            durationMs: duration,
            attempt: retry + 1,
          });

          success = true;
          break;
        } catch (err: any) {
          lastError = err.message || 'Unknown error';
          logger.error(MODULE, `Init command failed`, {
            command: step.command,
            error: lastError,
            attempt: retry + 1,
            maxRetries: this.maxRetries,
          });
        }
      }

      if (!success) {
        step.status = 'failed';
        step.error = lastError;
        onStepUpdate([...steps]);

        logger.error(MODULE, 'Initialization sequence failed', {
          failedCommand: step.command,
          error: lastError,
          completedSteps: i,
          totalSteps: steps.length,
        });

        return { success: false, protocol: this.protocol, steps };
      }

      onStepUpdate([...steps]);
    }

    logger.info(MODULE, 'Initialization completed successfully', {
      protocol: this.protocol,
      stepsCompleted: steps.length,
      totalDuration: steps.reduce((sum, s) => sum + (s.durationMs || 0), 0),
    });

    return { success: true, protocol: this.protocol, steps };
  }

  async scanDTCs(
    mode: string
  ): Promise<{ dtcBytes: string; rawResponse: RawECUResponse }> {
    const modeNames: Record<string, string> = {
      '03': 'Stored DTCs',
      '07': 'Pending DTCs',
      '0A': 'Permanent DTCs',
    };

    logger.info(MODULE, `=== DTC SCAN START: Mode ${mode} (${modeNames[mode] || 'Unknown'}) ===`, {
      mode,
      modeName: modeNames[mode],
      protocol: this.protocol,
      protocolNumber: this.protocolNumber,
    });

    // Clear any pending data in the buffer first
    try {
      // Send a dummy command to clear any stale data
      await this.sendCommandQuiet('AT');
    } catch (e) {
      // Ignore errors from buffer clear
    }

    const startTime = Date.now();
    const response = await this.sendCommand(mode);
    const latency = Date.now() - startTime;

    // Create detailed hex representation
    const txHex = Array.from(mode)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(' ');
    
    // Clean response but preserve structure for parsing
    const cleanResponse = response
      .replace(/[\r\n>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Create byte-level hex dump of response
    const rxHex = Array.from(cleanResponse)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(' ');

    const rawResponse: RawECUResponse = {
      id: generateId(),
      command: mode,
      txAscii: mode,
      txHex,
      rxRaw: response,
      rxAscii: cleanResponse,
      rxHex,
      latencyMs: latency,
      timestamp: new Date().toISOString(),
    };

    this.ecuResponses.push(rawResponse);

    // Enhanced logging with full hex dump
    logger.info(MODULE, `DTC scan response received for Mode ${mode}`, {
      mode,
      modeName: modeNames[mode],
      latencyMs: latency,
      rawResponseFull: response,
      cleanResponse,
      rxHex,
      responseLength: response.length,
      cleanLength: cleanResponse.length,
      protocol: this.protocol,
      containsNoData: response.toUpperCase().includes('NO DATA'),
      containsError: response.toUpperCase().includes('ERROR'),
    });

    logger.info(MODULE, `=== DTC SCAN END: Mode ${mode} ===`, {
      mode,
      bytesReceived: cleanResponse.length,
    });

    return { dtcBytes: response, rawResponse };
  }

  /**
   * Read Mode 01 PID 01 - Monitor Status Since DTCs Cleared
   * This PID returns:
   * - Byte A: MIL status (bit 7), DTC count (bits 0-6)
   * - Bytes B-D: Available tests and results
   * 
   * CRITICAL: Use this to verify DTC count BEFORE reading Mode 03
   */
  async readMILStatus(): Promise<{
    milOn: boolean;
    dtcCount: number;
    rawResponse: string;
    error?: string;
  }> {
    logger.info(MODULE, '=== MIL STATUS CHECK (Mode 01 PID 01) ===');

    try {
      const response = await this.sendCommand('0101');
      
      logger.info(MODULE, 'MIL status raw response', {
        rawResponse: response,
      });

      // Parse response - look for 41 01 followed by data bytes
      const lines = response.split(/[\r\n]+/).filter(l => l.trim());
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        
        // Skip ECU header if present (7Ex)
        let dataStart = 0;
        if (/^7E[0-9A-F]$/i.test(parts[0])) {
          dataStart = 1;
        }
        
        const bytes = parts.slice(dataStart).map(p => parseInt(p, 16)).filter(b => !isNaN(b));
        
        // Find 41 01 response
        const idx = bytes.findIndex((b, i) => b === 0x41 && bytes[i + 1] === 0x01);
        if (idx !== -1 && bytes.length > idx + 2) {
          const byteA = bytes[idx + 2];
          const milOn = (byteA & 0x80) !== 0; // Bit 7 = MIL on
          const dtcCount = byteA & 0x7F; // Bits 0-6 = DTC count
          
          logger.info(MODULE, 'MIL status parsed', {
            milOn,
            dtcCount,
            byteA: byteA.toString(16),
          });
          
          return { milOn, dtcCount, rawResponse: response };
        }
      }
      
      logger.warn(MODULE, 'Could not parse MIL status response');
      return { milOn: false, dtcCount: 0, rawResponse: response, error: 'Parse failed' };
      
    } catch (err) {
      const error = err as Error;
      logger.error(MODULE, 'MIL status check failed', { error: error.message });
      return { milOn: false, dtcCount: 0, rawResponse: '', error: error.message };
    }
  }

  /**
   * Enhanced Diagnostics - UDS Service 0x19 (ReadDTCInformation)
   * This is what professional scan tools use to get ALL DTCs including:
   * - Manufacturer-specific codes
   * - Body (B), Chassis (C), Network (U) codes
   * - Module-specific DTCs
   * 
   * Sub-functions used:
   * - 0x02: Report DTC by Status Mask (ACTIVE/STORED DTCs only)
   * 
   * IMPORTANT: DO NOT use sub-function 0x0A (Report Supported DTCs)!
   * It returns ALL DTCs the ECU can potentially monitor, not actual faults.
   * This was causing ~139 phantom codes instead of real ~19 faults.
   */
  async readEnhancedDTCs(ecuAddress?: string): Promise<{
    dtcBytes: string;
    rawResponse: string;
    ecuAddress: string;
    error?: string;
  }> {
    // Default to broadcast address if not specified
    const targetECU = ecuAddress || '7DF'; // 7DF = functional broadcast
    
    logger.info(MODULE, '=== ENHANCED DTC SCAN (UDS 0x19) ===', {
      targetECU,
      service: '0x19 ReadDTCInformation',
    });

    try {
      // Set header to target specific ECU if provided
      if (ecuAddress && ecuAddress !== '7DF') {
        await this.sendCommand(`ATSH ${ecuAddress}`);
      }

      // UDS Service 0x19 Sub-function 0x02: Report DTC by Status Mask
      // Status mask 0xFF = all DTCs (confirmed, pending, etc.)
      const response = await this.sendCommand('1902FF');
      
      logger.info(MODULE, 'Enhanced DTC response', {
        targetECU,
        rawResponse: response,
      });

      // Reset to default header after scan
      if (ecuAddress && ecuAddress !== '7DF') {
        await this.sendCommand('ATSH 7DF');
      }

      return {
        dtcBytes: response,
        rawResponse: response,
        ecuAddress: targetECU,
      };
      
    } catch (err) {
      const error = err as Error;
      logger.warn(MODULE, 'Enhanced DTC scan failed', {
        targetECU,
        error: error.message,
      });
      return {
        dtcBytes: '',
        rawResponse: '',
        ecuAddress: targetECU,
        error: error.message,
      };
    }
  }

  /**
   * Advanced Enhanced DTC Scan with BUFFER FULL Prevention
   * 
   * Uses multiple techniques to prevent buffer overflow:
   * 1. Sets proper CAN flow control parameters
   * 2. Uses chunked reading for large responses
   * 3. Implements retry with different status masks if BUFFER FULL occurs
   * 4. Tries multiple UDS sub-functions to get complete DTC list
   */
  async readEnhancedDTCsAdvanced(ecuAddress?: string): Promise<{
    dtcBytes: string;
    rawResponse: string;
    ecuAddress: string;
    allResponses: string[];
    bufferFullDetected: boolean;
    error?: string;
  }> {
    const targetECU = ecuAddress || '7DF';
    const allResponses: string[] = [];
    let bufferFullDetected = false;
    let combinedResponse = '';

    logger.info(MODULE, '=== ADVANCED ENHANCED DTC SCAN ===', {
      targetECU,
      technique: 'Multi-method with BUFFER FULL prevention',
    });

    try {
      // Set header to target specific ECU
      if (ecuAddress && ecuAddress !== '7DF') {
        await this.sendCommand(`ATSH ${ecuAddress}`);
      }

      // Configure flow control for large responses
      // ATCFC1 = Flow Control ON (already set in init)
      // ATCRA = Set receive address filter
      await this.sendCommand('ATCFC1');
      
      // Set flow control data - allows more data per frame
      // ATFC SD = Set Flow Control Set Data
      // Format: BS (Block Size), STmin (Separation Time)
      // BS=00 means unlimited block size
      // STmin=00 means no delay between frames
      try {
        await this.sendCommand('ATFCSD300000');
        await this.sendCommand('ATFCSM1');
      } catch (e) {
        // Some adapters don't support these commands, continue anyway
        logger.debug(MODULE, 'Flow control setup skipped (not supported)');
      }

      // Method 1: Standard UDS 0x19 0x02 with status mask 0xFF
      logger.info(MODULE, 'Trying UDS 0x19 0x02 (all DTCs)');
      const response1 = await this.sendCommand('1902FF');
      allResponses.push(`[1902FF] ${response1}`);
      
      if (response1.toUpperCase().includes('BUFFER FULL')) {
        bufferFullDetected = true;
        logger.warn(MODULE, 'BUFFER FULL detected, trying alternative methods');
        
        // Method 2: Try with smaller status masks to get subsets
        // Status bit meanings:
        // 0x01 = testFailed
        // 0x02 = testFailedThisOperationCycle
        // 0x04 = pendingDTC
        // 0x08 = confirmedDTC
        // 0x10 = testNotCompletedSinceLastClear
        // 0x20 = testFailedSinceLastClear
        // 0x40 = testNotCompletedThisOperationCycle
        // 0x80 = warningIndicatorRequested
        
        // Get confirmed DTCs only
        logger.info(MODULE, 'Trying UDS 0x19 0x02 (confirmed DTCs only)');
        const response2 = await this.sendCommand('190208');
        allResponses.push(`[190208] ${response2}`);
        
        // Get pending DTCs only
        logger.info(MODULE, 'Trying UDS 0x19 0x02 (pending DTCs only)');
        const response3 = await this.sendCommand('190204');
        allResponses.push(`[190204] ${response3}`);
        
        // Get warning indicator DTCs
        logger.info(MODULE, 'Trying UDS 0x19 0x02 (warning indicator DTCs)');
        const response4 = await this.sendCommand('190280');
        allResponses.push(`[190280] ${response4}`);
        
        combinedResponse = [response1, response2, response3, response4].join('\n');
      } else {
        combinedResponse = response1;
      }

      // NOTE: DO NOT use UDS 0x19 0x0A (Report Supported DTCs) - this returns
      // ALL possible DTCs the ECU can monitor, not actual fault codes!
      // This was causing ~139 phantom DTCs instead of real ones.
      // 
      // Stick with 0x19 0x02 (Report DTC by Status Mask) which only returns
      // DTCs that have actually been triggered/stored.
      
      // Method 3: Try UDS 0x19 0x0F - Report First Confirmed DTC
      // Useful for getting at least the most recent DTC (optional additional info)
      logger.info(MODULE, 'Trying UDS 0x19 0x0F (first confirmed DTC)');
      try {
        const response5 = await this.sendCommand('190F');
        if (!response5.toUpperCase().includes('ERROR') && 
            !response5.toUpperCase().includes('NO DATA')) {
          allResponses.push(`[190F] ${response5}`);
          // Don't add to combinedResponse to avoid duplicates - just log it
        }
      } catch (e) {
        logger.debug(MODULE, 'UDS 0x19 0x0F not supported');
      }

      // Reset to default header
      if (ecuAddress && ecuAddress !== '7DF') {
        await this.sendCommand('ATSH 7DF');
      }

      logger.info(MODULE, '=== ADVANCED SCAN COMPLETE ===', {
        targetECU,
        bufferFullDetected,
        responsesCollected: allResponses.length,
      });

      return {
        dtcBytes: combinedResponse,
        rawResponse: combinedResponse,
        ecuAddress: targetECU,
        allResponses,
        bufferFullDetected,
      };

    } catch (err) {
      const error = err as Error;
      logger.error(MODULE, 'Advanced enhanced scan failed', {
        error: error.message,
      });
      return {
        dtcBytes: '',
        rawResponse: '',
        ecuAddress: targetECU,
        allResponses,
        bufferFullDetected,
        error: error.message,
      };
    }
  }

  /**
   * Parse UDS Service 0x19 multi-frame response to extract DTCs
   * 
   * UDS Response format:
   * - First frame: 7Ex 10 LL 59 02 FF [DTC data...]
   * - Consecutive frames: 7Ex 2x [DTC data...]
   * 
   * DTC format (4 bytes each):
   * - Byte 0-2: DTC (ISO 15031-6 format as 24-bit)
   * - Byte 3: Status mask
   * 
   * ISO 15031-6 DTC encoding (16-bit portion):
   * - 0x0000-0x3FFF: P codes (Powertrain)
   * - 0x4000-0x7FFF: C codes (Chassis)
   * - 0x8000-0xBFFF: B codes (Body)
   * - 0xC000-0xFFFF: U codes (Network)
   */
  parseUDSResponse(rawResponse: string): Array<{
    code: string;
    status: number;
    statusText: string;
    rawBytes: string;
  }> {
    const dtcs: Array<{
      code: string;
      status: number;
      statusText: string;
      rawBytes: string;
    }> = [];

    logger.info(MODULE, 'Parsing UDS 0x19 response...');

    // Collect all data bytes from multi-frame response
    const allBytes: number[] = [];
    const lines = rawResponse.split(/[\r\n]+/).filter(l => l.trim());
    
    for (const line of lines) {
      // Skip non-data lines
      if (line.includes('SEARCHING') || line.includes('BUFFER') || 
          line.includes('NO DATA') || line.includes('ERROR')) {
        continue;
      }

      const parts = line.trim().split(/\s+/);
      
      // Check for ECU header (7Ex format)
      let dataStart = 0;
      if (/^7[0-9A-F]{2}$/i.test(parts[0])) {
        dataStart = 1;
      }
      
      const bytes = parts.slice(dataStart)
        .map(p => parseInt(p, 16))
        .filter(b => !isNaN(b));
      
      if (bytes.length === 0) continue;

      // Handle ISO-TP frames
      const firstByte = bytes[0];
      
      // First frame (10 xx)
      if ((firstByte & 0xF0) === 0x10) {
        // Skip: length byte, response code (59), subfunction (02), status mask (FF)
        // Data starts after these
        const startIdx = bytes.findIndex((b, i) => i >= 2 && b === 0x59);
        if (startIdx !== -1) {
          // Skip 59 02 FF (3 bytes)
          allBytes.push(...bytes.slice(startIdx + 3));
        }
        continue;
      }
      
      // Consecutive frame (2x)
      if ((firstByte & 0xF0) === 0x20) {
        // Skip sequence number
        allBytes.push(...bytes.slice(1));
        continue;
      }
      
      // Single frame or non-ISO-TP
      const respIdx = bytes.findIndex(b => b === 0x59);
      if (respIdx !== -1) {
        // Skip 59 02 FF
        allBytes.push(...bytes.slice(respIdx + 3));
      }
    }

    logger.info(MODULE, `Collected ${allBytes.length} bytes from UDS response`);

    // Parse DTCs (4 bytes each: DTC_High, DTC_Mid, DTC_Low, Status)
    for (let i = 0; i < allBytes.length - 3; i += 4) {
      const dtcHigh = allBytes[i];
      const dtcMid = allBytes[i + 1];
      const dtcLow = allBytes[i + 2];
      const status = allBytes[i + 3];
      
      // Skip zero DTCs
      if (dtcHigh === 0 && dtcMid === 0 && dtcLow === 0) continue;
      
      // Decode DTC using ISO 15031-6 format
      // The DTC is encoded in the first 2 bytes (16-bit)
      const dtc16bit = (dtcHigh << 8) | dtcMid;
      const dtcCode = this.decode16BitDTC(dtc16bit);
      
      if (dtcCode) {
        const rawHex = `${dtcHigh.toString(16).padStart(2, '0')}${dtcMid.toString(16).padStart(2, '0')}${dtcLow.toString(16).padStart(2, '0')}${status.toString(16).padStart(2, '0')}`.toUpperCase();
        
        // Avoid duplicates
        if (!dtcs.find(d => d.code === dtcCode)) {
          dtcs.push({
            code: dtcCode,
            status,
            statusText: this.decodeUDSDTCStatus(status),
            rawBytes: rawHex,
          });
          
          logger.info(MODULE, `UDS DTC found: ${dtcCode}`, {
            rawBytes: rawHex,
            status: status.toString(16),
          });
        }
      }
    }

    logger.info(MODULE, `Parsed ${dtcs.length} DTCs from UDS response`);
    return dtcs;
  }

  /**
   * Decode 16-bit DTC to standard format (P0123, B1601, etc.)
   * 
   * ISO 15031-6 encoding:
   * - Bits 15-14: Category (00=P, 01=C, 10=B, 11=U)
   * - Bits 13-12: First digit (0-3)
   * - Bits 11-8: Second digit (0-F)
   * - Bits 7-4: Third digit (0-F)
   * - Bits 3-0: Fourth digit (0-F)
   * 
   * Examples:
   * - 0x0336 = P0336 (00 00 0011 0011 0110)
   * - 0x9601 = B1601 (10 01 0110 0000 0001)
   * - 0xA680 = B2680 (10 10 0110 1000 0000)
   */
  private decode16BitDTC(dtc16: number): string | null {
    const categories: Record<number, string> = { 0: 'P', 1: 'C', 2: 'B', 3: 'U' };
    
    const categoryBits = (dtc16 >> 14) & 0x03;
    const d1 = (dtc16 >> 12) & 0x03;
    const d2 = (dtc16 >> 8) & 0x0F;
    const d3 = (dtc16 >> 4) & 0x0F;
    const d4 = dtc16 & 0x0F;
    
    const category = categories[categoryBits];
    const code = `${category}${d1}${d2.toString(16).toUpperCase()}${d3.toString(16).toUpperCase()}${d4.toString(16).toUpperCase()}`;
    
    // Validate format
    if (/^[PCBU][0-3][0-9A-F]{3}$/i.test(code)) {
      return code;
    }
    
    return null;
  }

  /**
   * Scan multiple ECU modules for DTCs
   * Common ECU addresses:
   * - 7E0: Engine/PCM
   * - 7E1: Transmission
   * - 7E2: ABS
   * - 720: Dashboard/IPC
   * - 760: Airbag/SRS
   */
  async scanAllModules(): Promise<Array<{
    module: string;
    address: string;
    dtcBytes: string;
    rawResponse: string;
  }>> {
    const modules = [
      { name: 'Engine/PCM', address: '7E0' },
      { name: 'Transmission', address: '7E1' },
      { name: 'Dashboard/IPC', address: '720' },
      { name: 'ABS', address: '7E2' },
      { name: 'BCM (Body)', address: '726' },
      { name: 'PATS (Anti-Theft)', address: '727' },
      { name: 'Airbag/SRS', address: '737' },
    ];

    logger.info(MODULE, '=== MULTI-MODULE DTC SCAN START ===', {
      moduleCount: modules.length,
    });

    const results: Array<{
      module: string;
      address: string;
      dtcBytes: string;
      rawResponse: string;
    }> = [];

    for (const mod of modules) {
      try {
        logger.info(MODULE, `Scanning module: ${mod.name} (${mod.address})`);
        
        // Set header for this ECU
        await this.sendCommand(`ATSH ${mod.address}`);
        
        // Try standard Mode 03 first
        const mode03Response = await this.sendCommand('03');
        
        results.push({
          module: mod.name,
          address: mod.address,
          dtcBytes: mode03Response,
          rawResponse: mode03Response,
        });

        logger.info(MODULE, `Module ${mod.name} scan complete`, {
          address: mod.address,
          response: mode03Response,
        });
        
      } catch (err) {
        logger.warn(MODULE, `Module ${mod.name} scan failed`, {
          address: mod.address,
          error: (err as Error).message,
        });
        results.push({
          module: mod.name,
          address: mod.address,
          dtcBytes: 'ERROR',
          rawResponse: (err as Error).message,
        });
      }
      
      // Small delay between modules
      await new Promise(r => setTimeout(r, 200));
    }

    // Reset to functional broadcast header
    await this.sendCommand('ATSH 7DF');
    
    logger.info(MODULE, '=== MULTI-MODULE DTC SCAN COMPLETE ===', {
      modulesScanned: results.length,
    });

    return results;
  }

  /**
   * Scan manufacturer-specific ECU modules using UDS 0x19 (ReadDTCInformation)
   * This method uses the manufacturer ECU database to query the correct modules
   * for each brand, enabling detection of Body (B), Chassis (C), and Network (U) codes.
   * 
   * @param manufacturerId - The manufacturer identifier (e.g., 'tata', 'hyundai', 'ford')
   * @returns Array of DTCs found from all scanned modules
   */
  async scanManufacturerModules(manufacturerId?: string, onProgress?: ScanProgressCallback): Promise<{
    dtcs: Array<{ module: string; code: string; status: string; rawBytes: string; ecuSource: string }>;
    modulesScanned: Array<{ name: string; txId: string; rxId: string; responded: boolean; dtcCount: number }>;
    rawResponses: string[];
    config: ManufacturerECUConfig;
    error?: string;
  }> {
    // Get manufacturer-specific configuration or fall back to default
    const config = manufacturerId 
      ? getManufacturerECUConfig(manufacturerId) || getDefaultECUConfig()
      : getDefaultECUConfig();
    
    logger.info(MODULE, '=== MANUFACTURER-SPECIFIC ECU SCAN START ===', {
      manufacturerId: manufacturerId || 'unknown',
      configName: config.name,
      moduleCount: config.modules.length,
      modules: config.modules.map(m => `${m.name} (${m.txId})`),
      protocol: config.protocol,
    });

    const dtcs: Array<{ module: string; code: string; status: string; rawBytes: string; ecuSource: string }> = [];
    const modulesScanned: Array<{ name: string; txId: string; rxId: string; responded: boolean; dtcCount: number }> = [];
    const rawResponses: string[] = [];

    // Calculate unique modules (some share addresses)
    const uniqueAddresses = new Set<string>();
    config.modules.forEach(mod => uniqueAddresses.add(`${mod.txId}_${mod.rxId}`));
    const totalUniqueModules = uniqueAddresses.size;
    let moduleIndex = 0;

    try {
      // Set protocol if specified by manufacturer config
      if (config.protocol) {
        await this.sendCommand(`ATSP${config.protocol}`);
        logger.info(MODULE, `Protocol set to ${config.protocol} for ${config.name}`);
      }

      // Ensure headers are on and auto-formatting is enabled
      await this.sendCommand('ATH1');
      await this.sendCommand('ATCAF1');
      await this.sendCommand('ATST FF'); // Max timeout for slow modules

      // Track unique ECU addresses to avoid duplicate scans
      const scannedAddresses = new Set<string>();

      for (const mod of config.modules) {
        // Skip if we already scanned this address (some modules share addresses)
        const addressKey = `${mod.txId}_${mod.rxId}`;
        if (scannedAddresses.has(addressKey)) {
          logger.debug(MODULE, `Skipping duplicate address: ${mod.name} (${mod.txId})`);
          continue;
        }
        scannedAddresses.add(addressKey);
        moduleIndex++;

        // Report scanning progress
        onProgress?.({
          phase: `${config.name} ECU Scan`,
          component: mod.name,
          componentIndex: moduleIndex,
          totalComponents: totalUniqueModules,
          status: 'scanning',
        });

        const moduleResult = {
          name: mod.name,
          txId: mod.txId,
          rxId: mod.rxId,
          responded: false,
          dtcCount: 0,
        };

        try {
          logger.info(MODULE, `Scanning ${config.name} module: ${mod.name}`, {
            txId: mod.txId,
            rxId: mod.rxId,
            description: mod.description,
          });

          // Set transmit header for this module
          await this.sendCommand(`ATSH ${mod.txId}`);
          
          // Set receive filter to only see this module's response
          await this.sendCommand(`ATCRA ${mod.rxId}`);

          // UDS Service 0x19 SubFunction 0x02: Report DTC by Status Mask
          // Status mask 0xFF = all DTCs (confirmed, pending, history, etc.)
          const udsResponse = await this.sendCommand('1902FF');
          
          rawResponses.push(`[${mod.name}] TX:${mod.txId} RX:${mod.rxId}\n${udsResponse}`);

          // Check if we got a valid response
          if (!udsResponse.toUpperCase().includes('NO DATA') && 
              !udsResponse.toUpperCase().includes('ERROR') &&
              !udsResponse.toUpperCase().includes('?')) {
            
            moduleResult.responded = true;

            // Parse DTCs from this module's UDS response
            const parsedDTCs = this.parseUDSResponse(udsResponse);
            
            for (const dtc of parsedDTCs) {
              // Avoid duplicate DTCs across modules
              if (!dtcs.find(d => d.code === dtc.code)) {
                dtcs.push({
                  module: mod.name,
                  code: dtc.code,
                  status: dtc.statusText,
                  rawBytes: dtc.rawBytes,
                  ecuSource: `${mod.name} (${mod.txId})`,
                });
                moduleResult.dtcCount++;
              }
            }

            logger.info(MODULE, `${config.name} ${mod.name} scan complete`, {
              txId: mod.txId,
              dtcsFound: moduleResult.dtcCount,
              response: udsResponse.substring(0, 100),
            });
            
            // Report success with DTCs found
            onProgress?.({
              phase: `${config.name} ECU Scan`,
              component: mod.name,
              componentIndex: moduleIndex,
              totalComponents: totalUniqueModules,
              status: 'success',
              dtcsFound: moduleResult.dtcCount,
            });
          } else {
            logger.debug(MODULE, `${mod.name} did not respond or returned no data`, {
              response: udsResponse.substring(0, 50),
            });
            
            // Report no response
            onProgress?.({
              phase: `${config.name} ECU Scan`,
              component: mod.name,
              componentIndex: moduleIndex,
              totalComponents: totalUniqueModules,
              status: 'no_response',
            });
          }

        } catch (modErr) {
          logger.debug(MODULE, `${config.name} ${mod.name} scan error (module may not exist)`, {
            error: (modErr as Error).message,
          });
          rawResponses.push(`[${mod.name}] ERROR: ${(modErr as Error).message}`);
          
          // Report failure
          onProgress?.({
            phase: `${config.name} ECU Scan`,
            component: mod.name,
            componentIndex: moduleIndex,
            totalComponents: totalUniqueModules,
            status: 'failed',
          });
        }

        modulesScanned.push(moduleResult);

        // Small delay between modules to prevent bus overload
        await new Promise(r => setTimeout(r, 150));
      }

      // Reset CAN filters and header to functional broadcast
      await this.sendCommand('ATCRA');
      await this.sendCommand('ATSH 7DF');

      const respondedCount = modulesScanned.filter(m => m.responded).length;
      
      logger.info(MODULE, '=== MANUFACTURER-SPECIFIC ECU SCAN COMPLETE ===', {
        manufacturer: config.name,
        totalModulesScanned: modulesScanned.length,
        modulesResponded: respondedCount,
        totalDTCsFound: dtcs.length,
        dtcCodes: dtcs.map(d => d.code),
      });

      return { dtcs, modulesScanned, rawResponses, config };

    } catch (err) {
      logger.error(MODULE, 'Manufacturer-specific scan failed', { 
        manufacturer: config.name,
        error: (err as Error).message 
      });
      
      // Reset to safe state
      try {
        await this.sendCommand('ATCRA');
        await this.sendCommand('ATSH 7DF');
      } catch (e) {
        // Ignore reset errors
      }

      return { 
        dtcs, 
        modulesScanned, 
        rawResponses, 
        config,
        error: (err as Error).message 
      };
    }
  }

  /**
   * Force specific CAN protocol for manufacturers that need it
   * Ford, GM, Chrysler often need explicit CAN protocol setting
   */
  async forceCANProtocol(protocolNumber: string = '6'): Promise<boolean> {
    logger.info(MODULE, 'Forcing CAN protocol', { protocolNumber });
    
    try {
      // Protocol numbers:
      // 6 = ISO 15765-4 CAN (11 bit ID, 500 kbaud)
      // 7 = ISO 15765-4 CAN (29 bit ID, 500 kbaud)
      // 8 = ISO 15765-4 CAN (11 bit ID, 250 kbaud)
      // 9 = ISO 15765-4 CAN (29 bit ID, 250 kbaud)
      
      await this.sendCommand(`ATSP${protocolNumber}`);
      const protocolCheck = await this.sendCommand('ATDPN');
      
      logger.info(MODULE, 'Protocol forced', {
        requested: protocolNumber,
        actual: protocolCheck,
      });
      
      this.protocolNumber = protocolCheck.trim();
      this.protocol = this.parseProtocolNumber(protocolCheck);
      
      return true;
    } catch (err) {
      logger.error(MODULE, 'Failed to force CAN protocol', {
        error: (err as Error).message,
      });
      return false;
    }
  }

  // ============================================================================
  // PROTOCOL-SPECIFIC DTC SCANNING METHODS
  // ============================================================================

  /**
   * KWP2000 (ISO 14230) / ISO 9141-2 (K-Line) DTC Scanning
   * Used by: European vehicles (VW, BMW, Mercedes, Audi), Asian vehicles (Toyota, Honda)
   * 
   * KWP2000 Services for DTCs:
   * - Service 0x18: Read DTCs by Status
   * - Service 0x17: Read DTCs (legacy)
   * - Service 0x13: Read Identified DTCs
   */
  async scanKWP2000DTCs(): Promise<{
    dtcBytes: string;
    rawResponse: string;
    protocol: string;
    error?: string;
  }> {
    logger.info(MODULE, '=== KWP2000/ISO9141 DTC SCAN START ===');

    try {
      // Force K-Line protocol (ISO 9141-2 or KWP2000)
      // Protocol 3 = ISO 9141-2
      // Protocol 4 = ISO 14230-4 KWP (5 baud init)
      // Protocol 5 = ISO 14230-4 KWP (fast init)
      
      // Try KWP fast init first (Protocol 5)
      await this.sendCommand('ATSP5');
      await this.sendCommand('ATIB10'); // ISO baud rate 10400
      await this.sendCommand('ATIIA13'); // ISO init address
      await this.sendCommand('ATWM8113F111'); // Wakeup message for KWP
      
      // Initialize K-Line with start communication
      await this.sendCommand('ATSI'); // Slow init
      
      // KWP2000 Service 0x18 - ReadDTCByStatus
      // Format: 18 00 FF (Service, Group, Status Mask)
      // Status Mask FF = all DTCs
      let response = await this.sendCommand('1800FF');
      
      // If no response, try legacy service 0x17 (readDTCByGroupIdentifier)
      if (response.toUpperCase().includes('NO DATA') || response.toUpperCase().includes('ERROR')) {
        logger.info(MODULE, 'KWP 0x18 failed, trying legacy 0x17');
        response = await this.sendCommand('17FF00'); // Read all DTCs
      }
      
      // Also try service 0x13 (readIdentifiedDTC)
      if (response.toUpperCase().includes('NO DATA')) {
        logger.info(MODULE, 'Trying KWP service 0x13');
        response = await this.sendCommand('13'); 
      }

      logger.info(MODULE, 'KWP2000 DTC response', { rawResponse: response });

      return {
        dtcBytes: response,
        rawResponse: response,
        protocol: 'KWP2000/ISO9141',
      };
    } catch (err) {
      logger.warn(MODULE, 'KWP2000 scan failed', { error: (err as Error).message });
      return {
        dtcBytes: '',
        rawResponse: '',
        protocol: 'KWP2000/ISO9141',
        error: (err as Error).message,
      };
    }
  }

  /**
   * J1850 PWM (Ford) DTC Scanning
   * Used by: Ford vehicles (1996-2008)
   * Bus speed: 41.6 kbps
   * 
   * Ford specific headers and addressing
   */
  async scanJ1850PWMDTCs(): Promise<{
    dtcBytes: string;
    rawResponse: string;
    modules: Array<{ name: string; address: string; response: string }>;
    protocol: string;
    error?: string;
  }> {
    logger.info(MODULE, '=== J1850 PWM (Ford) DTC SCAN START ===');

    const modules: Array<{ name: string; address: string; response: string }> = [];

    try {
      // Force J1850 PWM protocol
      await this.sendCommand('ATSP1'); // Protocol 1 = SAE J1850 PWM
      await this.sendCommand('ATST FF'); // Max timeout
      
      // Ford J1850 PWM module addresses (functional)
      const fordModules = [
        { name: 'PCM (Engine)', address: '10', header: '6110F1' },
        { name: 'TCM (Transmission)', address: '11', header: '6111F1' },
        { name: 'ABS', address: '28', header: '6128F1' },
        { name: 'RCM (Restraints)', address: '58', header: '6158F1' },
        { name: 'IPC (Instrument)', address: '20', header: '6120F1' },
        { name: 'GEM (Generic Electronic)', address: '40', header: '6140F1' },
        { name: 'BCM (Body Control)', address: '30', header: '6130F1' },
      ];

      // Scan each Ford module
      for (const mod of fordModules) {
        try {
          // Set header for this module
          await this.sendCommand(`ATSH ${mod.header}`);
          
          // Request DTCs (Mode 03)
          const response = await this.sendCommand('03');
          
          modules.push({
            name: mod.name,
            address: mod.address,
            response: response,
          });

          logger.info(MODULE, `Ford ${mod.name} response`, { 
            address: mod.address, 
            response: response.substring(0, 100) 
          });
          
        } catch (modErr) {
          modules.push({
            name: mod.name,
            address: mod.address,
            response: 'ERROR: ' + (modErr as Error).message,
          });
        }
        
        await new Promise(r => setTimeout(r, 150));
      }

      // Reset to functional address
      await this.sendCommand('ATSH 6100F1');

      return {
        dtcBytes: modules.map(m => m.response).join('\n'),
        rawResponse: JSON.stringify(modules),
        modules,
        protocol: 'J1850 PWM (Ford)',
      };
    } catch (err) {
      logger.warn(MODULE, 'J1850 PWM scan failed', { error: (err as Error).message });
      return {
        dtcBytes: '',
        rawResponse: '',
        modules,
        protocol: 'J1850 PWM (Ford)',
        error: (err as Error).message,
      };
    }
  }

  /**
   * J1850 VPW (GM) DTC Scanning
   * Used by: GM vehicles (1996-2008), Chrysler
   * Bus speed: 10.4/41.6 kbps variable
   */
  async scanJ1850VPWDTCs(): Promise<{
    dtcBytes: string;
    rawResponse: string;
    modules: Array<{ name: string; address: string; response: string }>;
    protocol: string;
    error?: string;
  }> {
    logger.info(MODULE, '=== J1850 VPW (GM) DTC SCAN START ===');

    const modules: Array<{ name: string; address: string; response: string }> = [];

    try {
      // Force J1850 VPW protocol
      await this.sendCommand('ATSP2'); // Protocol 2 = SAE J1850 VPW
      await this.sendCommand('ATST FF');
      
      // GM J1850 VPW module addresses
      const gmModules = [
        { name: 'PCM (Engine)', address: '10', header: '6810F1' },
        { name: 'TCM (Transmission)', address: '18', header: '6818F1' },
        { name: 'EBCM (ABS)', address: '28', header: '6828F1' },
        { name: 'SDM (Airbag)', address: '58', header: '6858F1' },
        { name: 'BCM (Body)', address: '40', header: '6840F1' },
        { name: 'IPC (Cluster)', address: '60', header: '6860F1' },
        { name: 'HVAC', address: '52', header: '6852F1' },
      ];

      for (const mod of gmModules) {
        try {
          await this.sendCommand(`ATSH ${mod.header}`);
          const response = await this.sendCommand('03');
          
          modules.push({
            name: mod.name,
            address: mod.address,
            response: response,
          });

          logger.info(MODULE, `GM ${mod.name} response`, { 
            address: mod.address, 
            response: response.substring(0, 100) 
          });
          
        } catch (modErr) {
          modules.push({
            name: mod.name,
            address: mod.address,
            response: 'ERROR: ' + (modErr as Error).message,
          });
        }
        
        await new Promise(r => setTimeout(r, 150));
      }

      await this.sendCommand('ATSH 6800F1');

      return {
        dtcBytes: modules.map(m => m.response).join('\n'),
        rawResponse: JSON.stringify(modules),
        modules,
        protocol: 'J1850 VPW (GM)',
      };
    } catch (err) {
      logger.warn(MODULE, 'J1850 VPW scan failed', { error: (err as Error).message });
      return {
        dtcBytes: '',
        rawResponse: '',
        modules,
        protocol: 'J1850 VPW (GM)',
        error: (err as Error).message,
      };
    }
  }

  /**
   * SAE J1939 (Heavy-Duty/Truck) DTC Scanning
   * Used by: Trucks, buses, agricultural equipment, heavy machinery
   * Protocol: CAN-based, 250kbps or 500kbps
   * 
   * J1939 uses SPN (Suspect Parameter Number) + FMI (Failure Mode Identifier)
   * PGN 65226 (0xFECA) = DM1 - Active Diagnostic Trouble Codes
   * PGN 65227 (0xFECB) = DM2 - Previously Active DTCs
   * PGN 65228 (0xFECC) = DM3 - Diagnostic Data Clear/Reset
   */
  async scanJ1939DTCs(): Promise<{
    activeDTCs: string;
    previousDTCs: string;
    rawResponse: string;
    protocol: string;
    error?: string;
  }> {
    logger.info(MODULE, '=== J1939 (Heavy-Duty) DTC SCAN START ===');

    try {
      // Set J1939 protocol (CAN 29-bit, 250kbps typical)
      await this.sendCommand('ATSP9'); // Protocol 9 = ISO 15765-4 CAN 29-bit 250k
      await this.sendCommand('ATCAF0'); // CAN auto formatting off for J1939
      await this.sendCommand('ATH1'); // Headers on
      await this.sendCommand('ATST FF'); // Max timeout
      
      // Set J1939 priority and source address
      // Default: Priority 6, Source 0xF9 (off-board diagnostic tool)
      await this.sendCommand('ATCP 18'); // CAN priority 6 (0x18 = 0b11000)
      await this.sendCommand('ATSH 18EAFFF9'); // J1939 request header

      // Request DM1 - Active Diagnostic Trouble Codes (PGN 65226 = 0xFECA)
      // J1939 request format: Request PGN from all ECUs
      const dm1Response = await this.sendCommand('00FECA'); // Request PGN FECA
      
      logger.info(MODULE, 'J1939 DM1 (Active DTCs) response', { response: dm1Response });

      // Request DM2 - Previously Active DTCs (PGN 65227 = 0xFECB)
      const dm2Response = await this.sendCommand('00FECB');
      
      logger.info(MODULE, 'J1939 DM2 (Previous DTCs) response', { response: dm2Response });

      // Reset to normal CAN settings
      await this.sendCommand('ATCAF1');
      await this.sendCommand('ATSP0');

      return {
        activeDTCs: dm1Response,
        previousDTCs: dm2Response,
        rawResponse: `DM1: ${dm1Response}\nDM2: ${dm2Response}`,
        protocol: 'J1939 Heavy-Duty',
      };
    } catch (err) {
      logger.warn(MODULE, 'J1939 scan failed', { error: (err as Error).message });
      return {
        activeDTCs: '',
        previousDTCs: '',
        rawResponse: '',
        protocol: 'J1939 Heavy-Duty',
        error: (err as Error).message,
      };
    }
  }

  /**
   * DoIP (Diagnostics over IP) - ISO 13400
   * Used by: Modern vehicles (2020+), EV platforms
   * 
   * Note: DoIP requires IP network connection, not traditional OBD-II
   * This method prepares the ELM327 for DoIP gateway communication
   * Full DoIP requires Ethernet/WiFi adapter with DoIP stack
   */
  async scanDoIPDTCs(): Promise<{
    dtcBytes: string;
    rawResponse: string;
    protocol: string;
    supported: boolean;
    error?: string;
  }> {
    logger.info(MODULE, '=== DoIP (Diagnostics over IP) DTC SCAN ===');
    logger.warn(MODULE, 'DoIP requires IP-based adapter, attempting CAN-based UDS fallback');

    try {
      // DoIP typically uses UDS (ISO 14229) over IP
      // For ELM327, we use UDS over CAN as fallback
      
      // Set CAN protocol with maximum compatibility
      await this.sendCommand('ATSP6'); // CAN 11-bit 500k
      await this.sendCommand('ATCAF1');
      await this.sendCommand('ATH1');
      
      // UDS Service 0x19 SubFunction 0x02 - Report DTC by Status Mask
      // Status mask 0xFF = all active/stored DTCs
      // NOTE: DO NOT use 0x190A (Report Supported DTCs) - it returns ALL possible
      // DTCs the ECU can monitor, causing phantom codes (~139 instead of real ~19)
      const udsResponse = await this.sendCommand('1902FF');

      return {
        dtcBytes: udsResponse,
        rawResponse: `UDS 1902FF: ${udsResponse}`,
        protocol: 'DoIP/UDS (CAN fallback)',
        supported: true,
      };
    } catch (err) {
      logger.warn(MODULE, 'DoIP/UDS scan failed', { error: (err as Error).message });
      return {
        dtcBytes: '',
        rawResponse: '',
        protocol: 'DoIP/UDS',
        supported: false,
        error: (err as Error).message,
      };
    }
  }

  // ============================================================================
  // OEM-SPECIFIC ENHANCED DIAGNOSTICS
  // ============================================================================

  /**
   * Ford Enhanced Diagnostics (Ford-specific module addressing)
   * Uses Ford's proprietary DTC access with extended module scanning
   */
  async scanFordEnhanced(): Promise<{
    dtcs: Array<{ module: string; code: string; status: string; rawBytes: string }>;
    rawResponse: string;
    error?: string;
  }> {
    logger.info(MODULE, '=== FORD ENHANCED DIAGNOSTICS START ===');
    
    const dtcs: Array<{ module: string; code: string; status: string; rawBytes: string }> = [];

    try {
      // Detect Ford protocol first
      const protocolNum = this.protocolNumber.replace(/[^0-9A-F]/gi, '');
      
      if (['1', 'A1'].includes(protocolNum)) {
        // J1850 PWM - use Ford-specific scanning
        return await this.scanJ1850PWMDTCs().then(result => ({
          dtcs: [],
          rawResponse: result.rawResponse,
          error: result.error,
        }));
      }

      // For CAN-based Ford, use UDS with Ford module addresses
      // B1601 is typically in PCM or PATS module
      // B2680 is typically in IPC (Dashboard) module
      const fordCANModules = [
        { name: 'PCM', txId: '7E0', rxId: '7E8' },
        { name: 'TCM', txId: '7E1', rxId: '7E9' },
        { name: 'ABS', txId: '760', rxId: '768' },
        { name: 'RCM (Airbag)', txId: '737', rxId: '73F' },
        { name: 'IPC (Dashboard)', txId: '720', rxId: '728' }, // B2680 location
        { name: 'BCM', txId: '726', rxId: '72E' },
        { name: 'PATS (Anti-Theft)', txId: '727', rxId: '72F' }, // B1601 location
        { name: 'APIM (Sync)', txId: '7D0', rxId: '7D8' },
        { name: 'PSCM (Steering)', txId: '730', rxId: '738' },
        { name: 'DDM (Driver Door)', txId: '740', rxId: '748' },
        { name: 'PDM (Passenger Door)', txId: '741', rxId: '749' },
        { name: 'HVAC', txId: '733', rxId: '73B' },
        { name: 'SCCM (Steering Column)', txId: '724', rxId: '72C' },
      ];

      await this.sendCommand('ATCAF1');
      await this.sendCommand('ATH1');

      for (const mod of fordCANModules) {
        try {
          // Set transmit header
          await this.sendCommand(`ATSH ${mod.txId}`);
          
          // Set receive filter for this module's response
          await this.sendCommand(`ATCRA ${mod.rxId}`);
          
          // UDS Read DTC Information
          const response = await this.sendCommand('1902FF');
          
          if (!response.toUpperCase().includes('NO DATA') && 
              !response.toUpperCase().includes('ERROR')) {
            // Parse Ford DTCs from response
            const parsedDTCs = this.parseFordDTCResponse(response, mod.name);
            dtcs.push(...parsedDTCs);
          }

          logger.info(MODULE, `Ford ${mod.name} enhanced scan`, {
            txId: mod.txId,
            response: response.substring(0, 80),
          });
          
        } catch (modErr) {
          logger.debug(MODULE, `Ford ${mod.name} scan skipped`, { 
            error: (modErr as Error).message 
          });
        }
        
        await new Promise(r => setTimeout(r, 100));
      }

      // Reset CAN filters
      await this.sendCommand('ATCRA');
      await this.sendCommand('ATSH 7DF');

      return {
        dtcs,
        rawResponse: JSON.stringify(dtcs, null, 2),
      };
    } catch (err) {
      logger.error(MODULE, 'Ford enhanced scan failed', { error: (err as Error).message });
      return {
        dtcs,
        rawResponse: '',
        error: (err as Error).message,
      };
    }
  }

  /**
   * Parse Ford UDS DTC response
   */
  private parseFordDTCResponse(
    response: string, 
    moduleName: string
  ): Array<{ module: string; code: string; status: string; rawBytes: string }> {
    const dtcs: Array<{ module: string; code: string; status: string; rawBytes: string }> = [];
    
    const lines = response.split(/[\r\n]+/).filter(l => l.trim());
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      
      // Skip header if present
      let dataStart = 0;
      if (/^7[0-9A-F]{2}$/i.test(parts[0])) {
        dataStart = 1;
      }
      
      const bytes = parts.slice(dataStart).map(p => parseInt(p, 16)).filter(b => !isNaN(b));
      
      // Look for positive response 0x59 (UDS 0x19 + 0x40)
      const respIdx = bytes.findIndex(b => b === 0x59);
      if (respIdx !== -1 && bytes.length > respIdx + 4) {
        // UDS DTC format: [59] [subFunc] [DTCHighByte] [DTCMiddleByte] [DTCLowByte] [Status]
        // Each DTC is 4 bytes (3 bytes DTC + 1 byte status)
        for (let i = respIdx + 2; i < bytes.length - 3; i += 4) {
          const dtcHigh = bytes[i];
          const dtcMid = bytes[i + 1];
          const dtcLow = bytes[i + 2];
          const status = bytes[i + 3];
          
          if (dtcHigh === 0 && dtcMid === 0 && dtcLow === 0) continue;
          
          const dtcCode = this.decodeUDSDTC(dtcHigh, dtcMid, dtcLow);
          if (dtcCode) {
            dtcs.push({
              module: moduleName,
              code: dtcCode,
              status: this.decodeUDSDTCStatus(status),
              rawBytes: `${dtcHigh.toString(16).padStart(2, '0')}${dtcMid.toString(16).padStart(2, '0')}${dtcLow.toString(16).padStart(2, '0')}${status.toString(16).padStart(2, '0')}`.toUpperCase(),
            });
          }
        }
      }
    }
    
    return dtcs;
  }

  /**
   * Decode UDS 3-byte DTC to standard format (P0123, B0456, etc.)
   * 
   * DTC encoding (ISO 15031-6):
   * High byte bits 7-6: Category (00=P, 01=C, 10=B, 11=U)
   * High byte bits 5-4: First digit (0-3)
   * High byte bits 3-0: Second digit (0-F)
   * Mid byte bits 7-4: Third digit (0-F)
   * Mid byte bits 3-0: Fourth digit (0-F)
   * 
   * Examples:
   * B1601 = 0x96 0x01 = 10|01|0110 0000|0001 = B|1|6|0|1
   * B2680 = 0xA6 0x80 = 10|10|0110 1000|0000 = B|2|6|8|0
   * P0336 = 0x03 0x36 = 00|00|0011 0011|0110 = P|0|3|3|6
   */
  private decodeUDSDTC(high: number, mid: number, low: number): string | null {
    // Category from bits 7-6 of high byte
    const categoryBits = (high >> 6) & 0x03;
    const categories: Record<number, string> = { 0: 'P', 1: 'C', 2: 'B', 3: 'U' };
    const category = categories[categoryBits];
    
    // First digit from bits 5-4 of high byte
    const d1 = (high >> 4) & 0x03;
    
    // Second digit from bits 3-0 of high byte
    const d2 = high & 0x0F;
    
    // Third digit from bits 7-4 of mid byte
    const d3 = (mid >> 4) & 0x0F;
    
    // Fourth digit from bits 3-0 of mid byte
    const d4 = mid & 0x0F;
    
    // Build DTC code
    const code = `${category}${d1}${d2.toString(16).toUpperCase()}${d3.toString(16).toUpperCase()}${d4.toString(16).toUpperCase()}`;
    
    // Validate format: Category + 4 hex digits
    if (/^[PCBU][0-3][0-9A-F]{3}$/i.test(code)) {
      logger.debug(MODULE, 'UDS DTC decoded', {
        rawBytes: `${high.toString(16).padStart(2, '0')} ${mid.toString(16).padStart(2, '0')} ${low.toString(16).padStart(2, '0')}`,
        decoded: code,
        category,
      });
      return code;
    }
    
    logger.warn(MODULE, 'UDS DTC decode failed', {
      rawBytes: `${high.toString(16).padStart(2, '0')} ${mid.toString(16).padStart(2, '0')} ${low.toString(16).padStart(2, '0')}`,
      attemptedCode: code,
    });
    return null;
  }

  /**
   * Decode UDS DTC status byte
   */
  private decodeUDSDTCStatus(status: number): string {
    const flags: string[] = [];
    if (status & 0x01) flags.push('TestFailed');
    if (status & 0x02) flags.push('TestFailedThisOpCycle');
    if (status & 0x04) flags.push('PendingDTC');
    if (status & 0x08) flags.push('ConfirmedDTC');
    if (status & 0x10) flags.push('TestNotCompletedSinceLastClear');
    if (status & 0x20) flags.push('TestFailedSinceLastClear');
    if (status & 0x40) flags.push('TestNotCompletedThisOpCycle');
    if (status & 0x80) flags.push('WarningIndicatorRequested');
    
    return flags.length > 0 ? flags.join(', ') : 'Unknown';
  }

  /**
   * GM Enhanced Diagnostics
   * Uses GM-specific proprietary module addressing
   */
  async scanGMEnhanced(): Promise<{
    dtcs: Array<{ module: string; code: string; status: string; rawBytes: string }>;
    rawResponse: string;
    error?: string;
  }> {
    logger.info(MODULE, '=== GM ENHANCED DIAGNOSTICS START ===');
    
    const dtcs: Array<{ module: string; code: string; status: string; rawBytes: string }> = [];

    try {
      // GM CAN module addresses
      const gmCANModules = [
        { name: 'ECM (Engine)', txId: '7E0', rxId: '7E8' },
        { name: 'TCM (Trans)', txId: '7E1', rxId: '7E9' },
        { name: 'EBCM (ABS)', txId: '241', rxId: '541' },
        { name: 'BCM (Body)', txId: '244', rxId: '544' },
        { name: 'SDM (Airbag)', txId: '240', rxId: '540' },
        { name: 'IPC (Cluster)', txId: '24C', rxId: '54C' },
        { name: 'HVAC', txId: '251', rxId: '551' },
        { name: 'OnStar', txId: '24A', rxId: '54A' },
        { name: 'Radio', txId: '24D', rxId: '54D' },
      ];

      await this.sendCommand('ATSP6'); // CAN 11-bit 500k
      await this.sendCommand('ATCAF1');
      await this.sendCommand('ATH1');

      for (const mod of gmCANModules) {
        try {
          await this.sendCommand(`ATSH ${mod.txId}`);
          await this.sendCommand(`ATCRA ${mod.rxId}`);
          
          // GM often uses Mode 03 and UDS
          let response = await this.sendCommand('03');
          
          // Also try UDS 0x19
          const udsResponse = await this.sendCommand('1902FF');
          
          logger.info(MODULE, `GM ${mod.name} scan`, {
            mode03: response.substring(0, 50),
            uds: udsResponse.substring(0, 50),
          });
          
          // Parse any DTCs found
          const parsedDTCs = this.parseFordDTCResponse(udsResponse, mod.name);
          dtcs.push(...parsedDTCs);
          
        } catch (modErr) {
          logger.debug(MODULE, `GM ${mod.name} scan skipped`);
        }
        
        await new Promise(r => setTimeout(r, 100));
      }

      await this.sendCommand('ATCRA');
      await this.sendCommand('ATSH 7DF');

      return {
        dtcs,
        rawResponse: JSON.stringify(dtcs, null, 2),
      };
    } catch (err) {
      logger.error(MODULE, 'GM enhanced scan failed', { error: (err as Error).message });
      return {
        dtcs,
        rawResponse: '',
        error: (err as Error).message,
      };
    }
  }

  /**
   * VAG (VW/Audi/Seat/Skoda) Enhanced Diagnostics
   * Uses KWP2000 or UDS depending on vehicle age
   */
  async scanVAGEnhanced(): Promise<{
    dtcs: Array<{ module: string; code: string; status: string; rawBytes: string }>;
    rawResponse: string;
    error?: string;
  }> {
    logger.info(MODULE, '=== VAG ENHANCED DIAGNOSTICS START ===');
    
    const dtcs: Array<{ module: string; code: string; status: string; rawBytes: string }> = [];

    try {
      // VAG module addresses (CAN)
      const vagModules = [
        { name: 'Engine', address: '01', txId: '7E0', rxId: '7E8' },
        { name: 'Transmission', address: '02', txId: '7E1', rxId: '7E9' },
        { name: 'ABS/ESP', address: '03', txId: '713', rxId: '77D' },
        { name: 'Steering', address: '44', txId: '712', rxId: '77C' },
        { name: 'Airbag', address: '15', txId: '714', rxId: '77E' },
        { name: 'Instrument', address: '17', txId: '714', rxId: '77E' },
        { name: 'AC/Climatronic', address: '08', txId: '715', rxId: '77F' },
        { name: 'Central Electronics', address: '09', txId: '716', rxId: '780' },
        { name: 'Gateway', address: '19', txId: '710', rxId: '77A' },
      ];

      // Try CAN first
      await this.sendCommand('ATSP6');
      await this.sendCommand('ATH1');

      for (const mod of vagModules) {
        try {
          await this.sendCommand(`ATSH ${mod.txId}`);
          
          // VAG diagnostic request
          const response = await this.sendCommand('1902FF');
          
          logger.info(MODULE, `VAG ${mod.name} scan`, {
            response: response.substring(0, 80),
          });

          const parsedDTCs = this.parseFordDTCResponse(response, mod.name);
          dtcs.push(...parsedDTCs);
          
        } catch (modErr) {
          logger.debug(MODULE, `VAG ${mod.name} scan skipped`);
        }
        
        await new Promise(r => setTimeout(r, 100));
      }

      await this.sendCommand('ATSH 7DF');

      return {
        dtcs,
        rawResponse: JSON.stringify(dtcs, null, 2),
      };
    } catch (err) {
      logger.error(MODULE, 'VAG enhanced scan failed', { error: (err as Error).message });
      return {
        dtcs,
        rawResponse: '',
        error: (err as Error).message,
      };
    }
  }

  /**
   * Toyota/Lexus Enhanced Diagnostics
   */
  async scanToyotaEnhanced(): Promise<{
    dtcs: Array<{ module: string; code: string; status: string; rawBytes: string }>;
    rawResponse: string;
    error?: string;
  }> {
    logger.info(MODULE, '=== TOYOTA ENHANCED DIAGNOSTICS START ===');
    
    const dtcs: Array<{ module: string; code: string; status: string; rawBytes: string }> = [];

    try {
      // Toyota CAN module addresses
      const toyotaModules = [
        { name: 'ECM (Engine)', txId: '7E0', rxId: '7E8' },
        { name: 'TCM (Trans)', txId: '7E1', rxId: '7E9' },
        { name: 'ABS/VSC', txId: '7B0', rxId: '7B8' },
        { name: 'Airbag/SRS', txId: '7C0', rxId: '7C8' },
        { name: 'Body', txId: '750', rxId: '758' },
        { name: 'A/C', txId: '7C4', rxId: '7CC' },
        { name: 'Power Steering', txId: '7A0', rxId: '7A8' },
        { name: 'Hybrid/EV', txId: '7E2', rxId: '7EA' },
      ];

      await this.sendCommand('ATSP6');
      await this.sendCommand('ATH1');

      for (const mod of toyotaModules) {
        try {
          await this.sendCommand(`ATSH ${mod.txId}`);
          await this.sendCommand(`ATCRA ${mod.rxId}`);
          
          const response = await this.sendCommand('1902FF');
          
          logger.info(MODULE, `Toyota ${mod.name} scan`, {
            response: response.substring(0, 80),
          });

          const parsedDTCs = this.parseFordDTCResponse(response, mod.name);
          dtcs.push(...parsedDTCs);
          
        } catch (modErr) {
          logger.debug(MODULE, `Toyota ${mod.name} scan skipped`);
        }
        
        await new Promise(r => setTimeout(r, 100));
      }

      await this.sendCommand('ATCRA');
      await this.sendCommand('ATSH 7DF');

      return {
        dtcs,
        rawResponse: JSON.stringify(dtcs, null, 2),
      };
    } catch (err) {
      logger.error(MODULE, 'Toyota enhanced scan failed', { error: (err as Error).message });
      return {
        dtcs,
        rawResponse: '',
        error: (err as Error).message,
      };
    }
  }

  /**
   * Comprehensive Multi-Protocol DTC Scan
   * Automatically detects protocol and uses appropriate scanning method
   * 
   * UPDATED: Now uses manufacturer-specific ECU database for all brands
   * This enables detection of Body (B), Chassis (C), and Network (U) codes
   * that standard OBD-II modes don't report.
   */
  async comprehensiveDTCScan(manufacturerId?: string, onProgress?: ScanProgressCallback): Promise<{
    standardDTCs: string[];
    enhancedDTCs: Array<{ module: string; code: string; status: string }>;
    milStatus: { on: boolean; count: number };
    protocol: string;
    scanMethods: string[];
    rawResponses: string[];
    manufacturerConfig?: string;
    modulesScanned?: number;
    modulesResponded?: number;
    error?: string;
  }> {
    logger.info(MODULE, '=== COMPREHENSIVE MULTI-PROTOCOL DTC SCAN START ===', {
      manufacturerId,
      currentProtocol: this.protocol,
    });

    const result = {
      standardDTCs: [] as string[],
      enhancedDTCs: [] as Array<{ module: string; code: string; status: string }>,
      milStatus: { on: false, count: 0 },
      protocol: this.protocol,
      scanMethods: [] as string[],
      rawResponses: [] as string[],
      manufacturerConfig: undefined as string | undefined,
      modulesScanned: 0,
      modulesResponded: 0,
    };

    // Calculate total phases for progress tracking
    let currentPhaseIndex = 0;
    const totalPhases = 5; // MIL, Mode03, Mode07, Manufacturer Modules, Protocol-specific

    try {
      // 1. Check MIL Status first
      onProgress?.({
        phase: 'Initial Diagnostics',
        component: 'MIL Status Check',
        componentIndex: ++currentPhaseIndex,
        totalComponents: totalPhases,
        status: 'scanning',
      });
      
      const milResult = await this.readMILStatus();
      result.milStatus = { on: milResult.milOn, count: milResult.dtcCount };
      result.scanMethods.push('MIL Status (0101)');
      result.rawResponses.push(`MIL: ${milResult.rawResponse}`);
      
      onProgress?.({
        phase: 'Initial Diagnostics',
        component: 'MIL Status Check',
        componentIndex: currentPhaseIndex,
        totalComponents: totalPhases,
        status: 'success',
        dtcsFound: milResult.dtcCount,
      });

      // 2. Standard OBD-II modes (always run these)
      onProgress?.({
        phase: 'Standard OBD-II Scan',
        component: 'Stored DTCs (Mode 03)',
        componentIndex: ++currentPhaseIndex,
        totalComponents: totalPhases,
        status: 'scanning',
      });
      
      const mode03 = await this.scanDTCs('03');
      result.rawResponses.push(`Mode03: ${mode03.dtcBytes}`);
      result.scanMethods.push('Standard Mode 03');
      
      onProgress?.({
        phase: 'Standard OBD-II Scan',
        component: 'Stored DTCs (Mode 03)',
        componentIndex: currentPhaseIndex,
        totalComponents: totalPhases,
        status: 'success',
      });

      onProgress?.({
        phase: 'Standard OBD-II Scan',
        component: 'Pending DTCs (Mode 07)',
        componentIndex: ++currentPhaseIndex,
        totalComponents: totalPhases,
        status: 'scanning',
      });
      
      const mode07 = await this.scanDTCs('07');
      result.rawResponses.push(`Mode07: ${mode07.dtcBytes}`);
      result.scanMethods.push('Standard Mode 07');
      
      onProgress?.({
        phase: 'Standard OBD-II Scan',
        component: 'Pending DTCs (Mode 07)',
        componentIndex: currentPhaseIndex,
        totalComponents: totalPhases,
        status: 'success',
      });

      // 3. MANUFACTURER-SPECIFIC ECU SCAN (PRIMARY ENHANCED METHOD)
      // This uses the comprehensive ECU database for all supported manufacturers
      // Covers: Tata, Mahindra, Maruti, Hyundai, Kia, Toyota, Honda, Nissan,
      // VW, Audi, Skoda, BMW, Mercedes, Ford, GM, Jaguar, Land Rover, Volvo, MG, etc.
      logger.info(MODULE, 'Starting manufacturer-specific ECU scan', {
        manufacturerId: manufacturerId || 'generic',
      });

      const mfrScanResult = await this.scanManufacturerModules(manufacturerId, onProgress);
      
      result.manufacturerConfig = mfrScanResult.config.name;
      result.modulesScanned = mfrScanResult.modulesScanned.length;
      result.modulesResponded = mfrScanResult.modulesScanned.filter(m => m.responded).length;
      result.scanMethods.push(`${mfrScanResult.config.name} ECU Scan (${result.modulesResponded}/${result.modulesScanned} modules)`);
      
      // Add raw responses from manufacturer scan
      mfrScanResult.rawResponses.forEach(r => result.rawResponses.push(r));
      
      // Add DTCs found from manufacturer-specific scan
      for (const dtc of mfrScanResult.dtcs) {
        // Avoid duplicates
        if (!result.enhancedDTCs.find(d => d.code === dtc.code)) {
          result.enhancedDTCs.push({
            module: dtc.module,
            code: dtc.code,
            status: dtc.status,
          });
        }
      }

      logger.info(MODULE, 'Manufacturer-specific scan complete', {
        config: mfrScanResult.config.name,
        dtcsFound: mfrScanResult.dtcs.length,
        modulesResponded: result.modulesResponded,
      });

      // 4. Protocol-specific scanning (legacy fallback for specific protocols)
      const protocolNum = this.protocolNumber.replace(/[^0-9]/g, '');

      // J1850 PWM (Protocol 1) - Ford legacy vehicles
      if (protocolNum === '1') {
        const j1850Result = await this.scanJ1850PWMDTCs();
        result.rawResponses.push(`J1850PWM: ${j1850Result.rawResponse}`);
        result.scanMethods.push('J1850 PWM Legacy');
      }

      // J1850 VPW (Protocol 2) - GM legacy vehicles
      if (protocolNum === '2') {
        const vpwResult = await this.scanJ1850VPWDTCs();
        result.rawResponses.push(`J1850VPW: ${vpwResult.rawResponse}`);
        result.scanMethods.push('J1850 VPW Legacy');
      }

      // ISO 9141 / KWP2000 (Protocols 3, 4, 5) - Older European/Asian vehicles
      if (['3', '4', '5'].includes(protocolNum)) {
        const kwpResult = await this.scanKWP2000DTCs();
        result.rawResponses.push(`KWP2000: ${kwpResult.rawResponse}`);
        result.scanMethods.push('KWP2000/ISO9141');
      }

      // 5. Broadcast UDS scan as additional fallback for CAN protocols
      if (['6', '7', '8', '9'].includes(protocolNum) || !protocolNum) {
        // Try broadcast UDS (may catch additional ECUs not in manufacturer config)
        const udsResult = await this.readEnhancedDTCs();
        if (!udsResult.error && udsResult.rawResponse) {
          result.rawResponses.push(`UDS Broadcast: ${udsResult.rawResponse}`);
          result.scanMethods.push('UDS 0x19 Broadcast');
          
          // Parse any additional DTCs from broadcast
          const broadcastDTCs = this.parseUDSResponse(udsResult.rawResponse);
          for (const dtc of broadcastDTCs) {
            if (!result.enhancedDTCs.find(d => d.code === dtc.code)) {
              result.enhancedDTCs.push({
                module: 'Broadcast',
                code: dtc.code,
                status: dtc.statusText,
              });
            }
          }
        }
      }

      logger.info(MODULE, '=== COMPREHENSIVE SCAN COMPLETE ===', {
        standardCount: result.standardDTCs.length,
        enhancedCount: result.enhancedDTCs.length,
        milOn: result.milStatus.on,
        expectedCount: result.milStatus.count,
        methodsUsed: result.scanMethods,
        manufacturerConfig: result.manufacturerConfig,
        modulesScanned: result.modulesScanned,
        modulesResponded: result.modulesResponded,
      });

      return result;

    } catch (err) {
      logger.error(MODULE, 'Comprehensive scan failed', { error: (err as Error).message });
      return {
        ...result,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Send command without logging (for buffer clearing)
   */
  private async sendCommandQuiet(command: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve('');
      }, 500);

      let buffer = '';

      const cleanup = this.adapter.onData((data: string) => {
        buffer += data;
        if (buffer.includes('>')) {
          clearTimeout(timeout);
          cleanup();
          resolve(buffer.trim());
        }
      });

      this.adapter.write(command + '\r').catch(() => {
        clearTimeout(timeout);
        cleanup();
        resolve('');
      });
    });
  }

  private async sendCommand(command: string): Promise<string> {
    const txHex = Array.from(command)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(' ');

    logger.trace(MODULE, 'Sending command to ELM327', {
      commandName: command,
      txAscii: command,
      txHex,
      byteCount: command.length,
    });

    const startTime = Date.now();

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        const error = `Command ${command} timed out after ${this.commandTimeout}ms`;
        logger.error(MODULE, 'Command timeout', {
          command,
          timeoutMs: this.commandTimeout,
        });
        reject(new Error(error));
      }, this.commandTimeout);

      let buffer = '';

      const cleanup = this.adapter.onData((data: string) => {
        buffer += data;

        logger.trace(MODULE, 'RX fragment received', {
          command,
          fragment: data.replace(/[\r\n]/g, '\\n'),
          bufferSize: buffer.length,
          bufferAssemblyStep: 'appending',
          promptDetected: data.includes('>'),
        });

        if (buffer.includes('>')) {
          clearTimeout(timeout);
          cleanup();

          const latency = Date.now() - startTime;
          const cleanBuffer = buffer
            .replace(/>/g, '')
            .replace(/[\r\n]+/g, '\n')
            .trim();

          logger.trace(MODULE, 'Response complete - end marker detected', {
            command,
            fullBuffer: buffer.replace(/[\r\n]/g, '\\n'),
            cleanResponse: cleanBuffer,
            latencyMs: latency,
            endMarkerDetected: true,
          });

          resolve(cleanBuffer);
        }
      });

      this.adapter.write(command + '\r').catch((err) => {
        clearTimeout(timeout);
        cleanup();
        reject(err);
      });
    });
  }

  private parseProtocolNumber(response: string): string {
    const protocols: Record<string, string> = {
      'A0': 'SAE J1850 PWM',
      'A1': 'SAE J1850 PWM',
      'A2': 'SAE J1850 VPW',
      'A3': 'ISO 9141-2',
      'A4': 'ISO 14230-4 KWP (5 baud)',
      'A5': 'ISO 14230-4 KWP (fast init)',
      'A6': 'ISO 15765-4 CAN (11/500)',
      'A7': 'ISO 15765-4 CAN (29/500)',
      'A8': 'ISO 15765-4 CAN (11/250)',
      'A9': 'ISO 15765-4 CAN (29/250)',
    };
    const num = response.trim().toUpperCase();
    return protocols[num] || `Unknown Protocol (${num})`;
  }

  getProtocol(): string {
    return this.protocol;
  }

  getECUResponses(): RawECUResponse[] {
    return [...this.ecuResponses];
  }

  clearResponses(): void {
    this.ecuResponses = [];
  }

  /**
   * Scan for live data using Mode 01
   * @param pid The PID to query (e.g., '0C' for RPM)
   * @returns Raw response from ECU
   */
  async scanLiveData(pid: string): Promise<{ response: string; rawResponse: RawECUResponse }> {
    const command = `01${pid.toUpperCase()}`;
    const modeName = `Live Data PID ${pid}`;

    logger.info(MODULE, `Requesting ${modeName}`, {
      pid,
      command,
    });

    try {
      // Use sendCommand (the existing method) instead of non-existent sendCommandWithRetry
      const response = await this.sendCommand(command);

      const cleanResponse = response.replace(/[\r\n>]/g, '').trim();
      const txHex = Array.from(command)
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
      const rxHex = Array.from(cleanResponse)
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
        .join(' ');

      const rawResponse: RawECUResponse = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        command,
        txAscii: command,
        txHex,
        rxRaw: response,
        rxAscii: cleanResponse,
        rxHex,
        latencyMs: 0,
      };
      this.ecuResponses.push(rawResponse);

      logger.info(MODULE, `Live data response received for PID ${pid}`, {
        pid,
        rawResponse: response,
        cleanResponse,
      });

      return { response: cleanResponse, rawResponse };
    } catch (err) {
      const error = err as Error;
      logger.warn(MODULE, `Live data scan failed for PID ${pid}`, {
        pid,
        error: error.message,
      });

      const rawResponse: RawECUResponse = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        command,
        txAscii: command,
        txHex: '',
        rxRaw: '',
        rxAscii: '',
        rxHex: '',
        latencyMs: 0,
      };
      this.ecuResponses.push(rawResponse);

      throw error;
    }
  }

  /**
   * Fetch Vehicle Identification Number (VIN) using Mode 09, PID 02
   * VIN is a 17-character alphanumeric code
   * 
   * Response format (multi-frame ISO-TP):
   * First frame: 7E8 10 14 49 02 01 [VIN bytes...]
   * Consecutive: 7E8 21 [more VIN bytes...], 7E8 22 [more VIN bytes...]
   * 
   * Or single ECU without headers:
   * 49 02 01 [17 ASCII bytes for VIN]
   */
  async fetchVIN(): Promise<{ vin: string | null; rawResponse: string; error?: string }> {
    logger.info(MODULE, '=== VIN FETCH START ===');

    try {
      // Send Mode 09 PID 02 command
      const response = await this.sendCommand('0902');
      
      logger.info(MODULE, 'VIN raw response received', {
        rawResponse: response,
        length: response.length,
      });

      // Parse VIN from response
      const vin = this.parseVINResponse(response);
      
      logger.info(MODULE, '=== VIN FETCH COMPLETE ===', {
        vin: vin || 'NOT FOUND',
        success: !!vin,
      });

      return { 
        vin, 
        rawResponse: response,
        error: vin ? undefined : 'Could not parse VIN from response'
      };
    } catch (err) {
      const error = err as Error;
      logger.error(MODULE, 'VIN fetch failed', { error: error.message });
      return { 
        vin: null, 
        rawResponse: '', 
        error: error.message 
      };
    }
  }

  /**
   * Parse VIN from OBD-II Mode 09 response
   * Handles both single-frame and multi-frame (ISO-TP) responses
   */
  private parseVINResponse(response: string): string | null {
    const lines = response.split(/[\r\n]+/).filter(l => l.trim());
    let vinBytes: number[] = [];
    
    logger.debug(MODULE, 'Parsing VIN response', { 
      lineCount: lines.length,
      lines 
    });

    // Collect all data bytes from response
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      
      // Skip known non-data patterns
      if (parts.some(p => ['NO', 'DATA', 'ERROR', 'UNABLE', '?'].includes(p.toUpperCase()))) {
        continue;
      }

      let dataStart = 0;
      
      // Check for ECU header (7Ex format)
      if (/^7E[0-9A-F]$/i.test(parts[0])) {
        dataStart = 1;
      }

      const bytes = parts.slice(dataStart).map(p => parseInt(p, 16)).filter(b => !isNaN(b));
      
      if (bytes.length === 0) continue;

      // Check for ISO-TP first frame (10 xx)
      if ((bytes[0] & 0xF0) === 0x10) {
        // First frame: skip length bytes and mode response (49 02 01)
        // Format: 10 LL 49 02 01 [VIN data...]
        const startIdx = bytes.findIndex((b, i) => i >= 2 && b === 0x49);
        if (startIdx !== -1 && bytes[startIdx + 1] === 0x02) {
          // Skip 49 02 01 (mode response + message count)
          vinBytes.push(...bytes.slice(startIdx + 3));
        }
        continue;
      }

      // Check for consecutive frame (2x)
      if ((bytes[0] & 0xF0) === 0x20) {
        // Consecutive frame: skip sequence number
        vinBytes.push(...bytes.slice(1));
        continue;
      }

      // Single frame or non-ISO-TP response
      // Look for 49 02 (Mode 09 response for PID 02)
      const modeIdx = bytes.findIndex((b, i) => b === 0x49 && bytes[i + 1] === 0x02);
      if (modeIdx !== -1) {
        // Format: [length] 49 02 01 [VIN data...] or 49 02 01 [VIN data...]
        const vinStart = modeIdx + 3; // Skip 49 02 01
        vinBytes.push(...bytes.slice(vinStart));
      }
    }

    // Remove any padding (0x00) and limit to 17 characters
    vinBytes = vinBytes.filter(b => b > 0 && b < 128);
    
    if (vinBytes.length >= 17) {
      // Take first 17 valid ASCII characters
      const vinChars = vinBytes.slice(0, 17).map(b => String.fromCharCode(b));
      const vin = vinChars.join('');
      
      // Validate VIN format (17 alphanumeric characters, no I, O, Q)
      if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
        logger.info(MODULE, 'VIN parsed successfully', { vin });
        return vin.toUpperCase();
      } else {
        logger.warn(MODULE, 'VIN format validation failed', { 
          vin, 
          bytes: vinBytes.slice(0, 17).map(b => b.toString(16)) 
        });
      }
    }

    logger.warn(MODULE, 'Could not extract VIN', { 
      bytesCollected: vinBytes.length,
      bytes: vinBytes.map(b => b.toString(16))
    });
    
    return null;
  }
}
