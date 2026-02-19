/**
 * Live Data Parser Service
 * Parses OBD-II Mode 01 responses for live vehicle data
 * Build #12 - WiseDrive OBD-II DTC Scanner
 * 
 * CRITICAL FIX: Handles responses with headers (ATH1) and CAN formatting (ATCAF1)
 * Response format with headers: "7E8 04 41 0C 0F A0" (ECU_ID LENGTH MODE+40 PID DATA...)
 */

import { LiveDataReading, LIVE_DATA_PIDS, getPIDInfo } from '../types/live-data';
import { logger } from './logger';
import { getDTCSeverity, DTCSeverity } from '../constants/dtc-descriptions';
import { getDTCKnowledge } from '../constants/dtc-knowledge-base';

const MODULE = 'LIVE_DATA_PARSER';

/**
 * Parse a Mode 01 response for a specific PID
 * Handles multiple response formats:
 * 1. Standard: "41 0C 0F A0"
 * 2. With headers: "7E8 04 41 0C 0F A0"
 * 3. With spaces: "7E8 04 41 0C 0F A0"
 * 4. Multi-line multi-ECU: "7E8 04 41 0C 0F A0\n7E9 04 41 0C 0F 50"
 * 
 * @param pidCode The PID code that was requested (e.g., "0C" for RPM)
 * @param response Raw response string from ELM327
 * @returns LiveDataReading or null if parsing failed
 */
export function parseLiveDataResponse(pidCode: string, response: string): LiveDataReading | null {
  const pidInfo = getPIDInfo(pidCode);
  if (!pidInfo) {
    logger.warn(MODULE, 'Unknown PID', { pidCode });
    return null;
  }

  // Normalize PID to uppercase
  const pid = pidCode.toUpperCase();
  
  logger.debug(MODULE, 'Parsing live data response', { 
    pid, 
    rawResponse: response,
    responseLength: response.length,
  });

  // Check for NO DATA or error responses
  const upperResponse = response.toUpperCase();
  if (upperResponse.includes('NO DATA') || 
      upperResponse.includes('ERROR') || 
      upperResponse.includes('UNABLE') ||
      upperResponse.includes('STOPPED') ||
      upperResponse.includes('?')) {
    logger.debug(MODULE, 'Response indicates no data or error', { pid, response: upperResponse.substring(0, 50) });
    return null;
  }

  // Check for negative response (7F = service not supported)
  if (upperResponse.includes('7F')) {
    // 7F XX YY means negative response - service XX failed with code YY
    logger.debug(MODULE, 'Negative response received (service not supported)', { pid });
    return null;
  }

  // Clean and normalize response
  const cleaned = response
    .replace(/SEARCHING\.\.\./gi, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/>/g, '')
    .trim()
    .toUpperCase();

  logger.debug(MODULE, 'Cleaned response', { pid, cleaned });

  // The Mode 01 response prefix is 41 (01 + 40 = 41)
  const responsePrefix = '41' + pid;
  
  let dataBytes: number[] = [];
  
  // Try multiple parsing strategies
  
  // Strategy 1: Look for the response pattern with optional header
  // Format: [7E8] [LENGTH] 41 PID DATA...
  // Example: "7E8 04 41 0C 0F A0" or "41 0C 0F A0"
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);
  
  for (let i = 0; i < tokens.length - 1; i++) {
    // Look for "41" followed by our PID
    if (tokens[i] === '41' && tokens[i + 1] === pid) {
      // Found the response! Extract data bytes starting from i+2
      for (let j = i + 2; j < tokens.length; j++) {
        const token = tokens[j];
        // Stop if we hit another header (7E8, 7E9, etc.) or non-hex
        if (/^7E[0-9A-F]$/i.test(token) || !/^[0-9A-F]{2}$/i.test(token)) {
          break;
        }
        const byteValue = parseInt(token, 16);
        if (!isNaN(byteValue)) {
          dataBytes.push(byteValue);
        }
      }
      if (dataBytes.length > 0) {
        logger.debug(MODULE, 'Parsed with token strategy', { pid, dataBytes, tokensUsed: tokens.slice(i, i + 2 + dataBytes.length) });
        break;
      }
    }
  }

  // Strategy 2: Regex pattern matching (for responses without spaces)
  if (dataBytes.length === 0) {
    const noSpaces = cleaned.replace(/\s/g, '');
    
    // Pattern: Look for 41+PID followed by data bytes
    // Allow for optional header (7E8 + length byte = 5 chars)
    const patterns = [
      // With header: 7E8 + byte count + 41 + PID + data
      new RegExp(`7E[0-9A-F][0-9A-F]{2}41${pid}([0-9A-F]{2,})`, 'i'),
      // Without header: 41 + PID + data
      new RegExp(`41${pid}([0-9A-F]{2,})`, 'i'),
    ];
    
    for (const pattern of patterns) {
      const match = noSpaces.match(pattern);
      if (match && match[1]) {
        const hexData = match[1];
        // Take only the data bytes we need (based on PID definition)
        const expectedBytes = pidInfo.bytes || 1;
        const bytesToTake = Math.min(expectedBytes, Math.floor(hexData.length / 2));
        
        for (let i = 0; i < bytesToTake * 2; i += 2) {
          const byteHex = hexData.substring(i, i + 2);
          const byteValue = parseInt(byteHex, 16);
          if (!isNaN(byteValue)) {
            dataBytes.push(byteValue);
          }
        }
        
        if (dataBytes.length > 0) {
          logger.debug(MODULE, 'Parsed with regex strategy', { pid, dataBytes, pattern: pattern.toString(), hexData });
          break;
        }
      }
    }
  }

  // Strategy 3: Line-by-line parsing for multi-ECU responses
  if (dataBytes.length === 0) {
    const lines = response.split(/[\r\n]+/);
    for (const line of lines) {
      const lineTokens = line.toUpperCase().split(/\s+/).filter(t => t.length > 0);
      
      for (let i = 0; i < lineTokens.length - 1; i++) {
        if (lineTokens[i] === '41' && lineTokens[i + 1] === pid) {
          for (let j = i + 2; j < lineTokens.length; j++) {
            const token = lineTokens[j];
            if (!/^[0-9A-F]{2}$/i.test(token)) break;
            const byteValue = parseInt(token, 16);
            if (!isNaN(byteValue)) {
              dataBytes.push(byteValue);
            }
          }
          if (dataBytes.length > 0) {
            logger.debug(MODULE, 'Parsed with line-by-line strategy', { pid, dataBytes, line });
            break;
          }
        }
      }
      if (dataBytes.length > 0) break;
    }
  }

  // Check if we got any data
  if (dataBytes.length === 0) {
    logger.debug(MODULE, 'No valid data bytes found', { pid, cleaned });
    return null;
  }

  // Ensure we have enough bytes for the formula
  const requiredBytes = pidInfo.bytes || 1;
  if (dataBytes.length < requiredBytes) {
    logger.warn(MODULE, 'Insufficient data bytes', { pid, got: dataBytes.length, required: requiredBytes });
    return null;
  }

  // Calculate value using PID formula
  try {
    const value = pidInfo.formula(dataBytes);
    const displayValue = formatValue(value, pidInfo.unit);

    const reading: LiveDataReading = {
      pid: pidCode,
      name: pidInfo.name,
      shortName: pidInfo.shortName,
      value: Math.round(value * 100) / 100,
      displayValue,
      unit: pidInfo.unit,
      category: pidInfo.category,
      timestamp: Date.now(),
      rawHex: dataBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '),
    };

    logger.info(MODULE, 'Successfully parsed live data', { 
      pid, 
      value: reading.value, 
      displayValue: reading.displayValue,
      dataBytes,
      rawHex: reading.rawHex,
    });

    return reading;
  } catch (err) {
    const error = err as Error;
    logger.warn(MODULE, 'Formula calculation failed', { pid, dataBytes, error: error.message });
    return null;
  }
}

/**
 * Format a value for display
 */
function formatValue(value: number, unit: string): string {
  if (unit === 'rpm') {
    return Math.round(value).toLocaleString();
  }
  if (unit === '%') {
    return value.toFixed(1);
  }
  if (unit === '°C' || unit === '°') {
    return value.toFixed(1);
  }
  if (unit === 'V') {
    return value.toFixed(2);
  }
  if (unit === 'g/s' || unit === 'L/h') {
    return value.toFixed(2);
  }
  if (unit === 'km/h' || unit === 'kPa' || unit === 'km' || unit === 'sec') {
    return Math.round(value).toString();
  }
  return value.toFixed(1);
}

/**
 * Get list of PIDs to query for live data
 * Returns the most commonly supported PIDs first
 */
export function getPriorityPIDs(): string[] {
  // Priority order: RPM, Speed, Coolant, Throttle, Load, then others
  return ['0C', '0D', '05', '11', '04', '0F', '0B', '2F', '42', '46'];
}

/**
 * Create a comprehensive JSON-ready scan result object for API integration
 * 
 * This function generates a complete diagnostic report including:
 * - Inspection ID for business tracking
 * - DTC severity classification (Critical, Important, Non-Critical)
 * - Code category (History/Stored, Current, Pending)
 * - Possible causes (Top 5)
 * - Symptoms (Top 5)
 * - Solutions (Top 5)
 */
export function createScanResultJSON(
  scanId: string,
  timestamp: string,
  duration: number,
  protocol: string,
  vehicle: { manufacturer: string | null; manufacturerId: string | null; year: number | null; vin?: string | null },
  storedDTCs: Array<{ code: string; category: string; description: string; isManufacturerSpecific?: boolean; ecuSource?: string }>,
  pendingDTCs: Array<{ code: string; category: string; description: string; isManufacturerSpecific?: boolean; ecuSource?: string }>,
  permanentDTCs: Array<{ code: string; category: string; description: string; isManufacturerSpecific?: boolean; ecuSource?: string }>,
  liveData: LiveDataReading[],
  scanCycles: number,
  inspectionId?: string
): object {
  // Helper function to create comprehensive DTC entry
  const mapDTCComprehensive = (
    dtc: { code: string; category: string; description: string; isManufacturerSpecific?: boolean; ecuSource?: string },
    codeCategory: 'History' | 'Current' | 'Pending'
  ) => {
    const severity = getDTCSeverity(dtc.code);
    const knowledge = getDTCKnowledge(dtc.code);
    
    // Map severity to display name
    const severityDisplay = {
      'CRITICAL': 'Critical',
      'IMPORTANT': 'Important',
      'NON_CRITICAL': 'Non-Critical',
    }[severity] || 'Non-Critical';
    
    return {
      code: dtc.code,
      component: dtc.ecuSource || 'Unknown Module',
      description: dtc.description,
      codeType: severityDisplay,
      codeCategory: codeCategory,
      isManufacturerSpecific: dtc.isManufacturerSpecific || false,
      possibleCauses: knowledge.causes,
      symptoms: knowledge.symptoms,
      solutions: knowledge.solutions,
    };
  };

  // Map all DTCs with comprehensive information
  // Stored DTCs = History codes (codes that have been stored in memory)
  // Permanent DTCs = Current codes (confirmed active issues)
  // Pending DTCs = Pending codes (issues detected but not yet confirmed)
  const storedComprehensive = storedDTCs.map(dtc => mapDTCComprehensive(dtc, 'History'));
  const permanentComprehensive = permanentDTCs.map(dtc => mapDTCComprehensive(dtc, 'Current'));
  const pendingComprehensive = pendingDTCs.map(dtc => mapDTCComprehensive(dtc, 'Pending'));

  // Combine all DTCs for the flat array
  const allDTCs = [...storedComprehensive, ...permanentComprehensive, ...pendingComprehensive];

  // Count DTCs by severity
  const criticalCount = allDTCs.filter(d => d.codeType === 'Critical').length;
  const importantCount = allDTCs.filter(d => d.codeType === 'Important').length;
  const nonCriticalCount = allDTCs.filter(d => d.codeType === 'Non-Critical').length;

  // Count by category
  const historyCount = storedComprehensive.length;
  const currentCount = permanentComprehensive.length;
  const pendingCount = pendingComprehensive.length;

  return {
    // Inspection tracking
    inspectionId: inspectionId || null,
    scanId,
    scanTimestamp: timestamp,
    scanDuration: duration,
    
    // Vehicle information
    vehicle: {
      manufacturer: vehicle.manufacturer,
      manufacturerId: vehicle.manufacturerId,
      year: vehicle.year,
      vin: vehicle.vin || null,
    },
    
    // Protocol used
    protocol,
    
    // Comprehensive DTC list (flat array for easy integration)
    diagnosticTroubleCodes: allDTCs,
    
    // Categorized DTCs (for backward compatibility)
    dtcsByCategory: {
      history: storedComprehensive,
      current: permanentComprehensive,
      pending: pendingComprehensive,
    },
    
    // Live data readings
    liveData: liveData.map(ld => ({
      pid: ld.pid,
      name: ld.name,
      value: ld.value,
      unit: ld.unit,
      category: ld.category,
      timestamp: ld.timestamp,
    })),
    
    // Summary statistics
    summary: {
      totalDTCs: allDTCs.length,
      byType: {
        critical: criticalCount,
        important: importantCount,
        nonCritical: nonCriticalCount,
      },
      byCategory: {
        history: historyCount,
        current: currentCount,
        pending: pendingCount,
      },
      totalLiveReadings: liveData.length,
      scanCycles,
    },
    
    // API metadata
    apiVersion: '2.0',
    generatedAt: new Date().toISOString(),
  };
}
