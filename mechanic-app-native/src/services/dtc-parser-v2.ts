/**
 * DTC Parser V2 - Professional-Grade Multi-ECU OBD-II DTC Parsing
 * 
 * CRITICAL FIXES for proper DTC scanning:
 * 
 * 1. Multi-ECU Support:
 *    - With ATH1 (headers on), each ECU response includes its address
 *    - Format: "7E8 06 43 02 01 16 01 25" (ECU 7E8, 6 bytes, Mode 43, 2 DTCs)
 *    - Different ECUs: 7E8 (Engine), 7E9 (Transmission), 7EA (ABS), etc.
 * 
 * 2. ISO-TP Multi-Frame Handling:
 *    - First frame: "7E8 10 14 43 06 01 16 01 25" (10=first frame, 14=total length)
 *    - Consecutive: "7E8 21 01 33 01 37 01 38" (21=consecutive frame 1)
 * 
 * 3. DTC Format (2 bytes per DTC):
 *    - Byte 1: [CC][DD][EEEE] where CC=category, DD=first digit, EEEE=second digit
 *    - Byte 2: [FFFF][GGGG] where FFFF=third digit, GGGG=fourth digit
 * 
 * 4. Response Format Variations:
 *    - CAN with headers: "7E8 06 43 02 01 16 01 25"
 *    - CAN without headers: "43 02 01 16 01 25"
 *    - Legacy protocols: "43 02 01 16 01 25"
 */

import { DTCResult, DTCCategory, DTCCategoryNames } from '../types';
import { logger } from './logger';
import { DTC_DESCRIPTIONS } from '../constants/dtc-descriptions';
import { 
  getManufacturerDTCDescription, 
  isManufacturerSpecificCode 
} from '../constants/manufacturer-dtc-codes';

const MODULE = 'DTC_PARSER_V2';

// DTC Category mapping based on bits 7-6 of first byte
const CATEGORY_MAP: Record<number, DTCCategory> = {
  0b00: 'P',  // Powertrain
  0b01: 'C',  // Chassis
  0b10: 'B',  // Body
  0b11: 'U',  // Network/Communication
};

// Mode response codes
const MODE_RESPONSE_MAP: Record<string, string> = {
  '03': '43',  // Stored DTCs
  '07': '47',  // Pending DTCs
  '0A': '4A',  // Permanent DTCs
  '19': '59',  // UDS ReadDTCInformation (Service 0x19 -> 0x59)
};

// Known ECU addresses (CAN 11-bit)
const ECU_NAMES: Record<string, string> = {
  '7E8': 'Engine (PCM)',
  '7E9': 'Transmission (TCM)',
  '7EA': 'ABS/VSC',
  '7EB': 'Airbag (SRS)',
  '7EC': 'Body Control',
  '7ED': 'Climate Control',
  '7EE': 'Battery/Hybrid',
  '7EF': 'Reserved',
  // 29-bit CAN addresses (shown as last 2 digits typically)
  '10': 'Engine (Legacy)',
  '11': 'Engine (PCM)',
  '18': 'Transmission',
  '1D': 'Transmission (TCM)',
  '28': 'ABS',
  '40': 'Body Control',
  '58': 'Airbag',
};

// Patterns to ignore
const IGNORE_PATTERNS = [
  'NO DATA',
  'NODATA',
  'UNABLE',
  'ERROR',
  'BUS INIT',
  'STOPPED',
  'CAN ERROR',
  'SEARCHING',
  '?',
  'OK',
  'ELM327',
  'ATZ',
  'ATE',
];

export interface ECUDTCResponse {
  ecuId: string;
  ecuName: string;
  rawLine: string;
  dtcCount: number;
  dtcs: DTCResult[];
  parseError?: string;
}

export interface ParsedDTCResponse {
  success: boolean;
  totalDTCs: number;
  dtcs: DTCResult[];
  ecuResponses: ECUDTCResponse[];
  rawResponse: string;
  mode: string;
  parseErrors: string[];
  debugInfo: {
    linesProcessed: number;
    ecuCount: number;
    duplicatesRemoved: number;
    invalidBytesSkipped: number;
    headersDetected: boolean;
    multiFrameDetected: boolean;
  };
}

/**
 * Decode a DTC from two hex bytes
 */
function decodeDTC(byte1: number, byte2: number): { code: string; category: DTCCategory; rawHex: string } | null {
  // Skip null DTCs (0x0000)
  if (byte1 === 0 && byte2 === 0) {
    return null;
  }
  
  const rawHex = byte1.toString(16).padStart(2, '0').toUpperCase() + 
                 byte2.toString(16).padStart(2, '0').toUpperCase();
  
  // Extract components per SAE J2012
  const categoryBits = (byte1 >> 6) & 0x03;      // Bits 7-6: Category
  const firstDigit = (byte1 >> 4) & 0x03;         // Bits 5-4: First digit (0-3)
  const secondDigit = byte1 & 0x0F;               // Bits 3-0: Second digit (0-F)
  const thirdDigit = (byte2 >> 4) & 0x0F;         // Bits 7-4: Third digit (0-F)
  const fourthDigit = byte2 & 0x0F;               // Bits 3-0: Fourth digit (0-F)
  
  const category = CATEGORY_MAP[categoryBits];
  if (!category) {
    logger.trace(MODULE, 'Unknown category bits', { categoryBits, rawHex });
    return null;
  }
  
  // Build code string
  const code = `${category}${firstDigit}${secondDigit.toString(16).toUpperCase()}${thirdDigit.toString(16).toUpperCase()}${fourthDigit.toString(16).toUpperCase()}`;
  
  // Validate format
  if (!/^[PCBU][0-3][0-9A-F]{3}$/i.test(code)) {
    logger.trace(MODULE, 'Invalid DTC format', { code, rawHex });
    return null;
  }
  
  return { code, category, rawHex };
}

/**
 * Parse a hex string into byte array
 */
function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/\s+/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length - 1; i += 2) {
    const byte = parseInt(clean.substring(i, i + 2), 16);
    if (!isNaN(byte)) {
      bytes.push(byte);
    }
  }
  return bytes;
}

/**
 * Extract ECU ID from a response line (if headers are on)
 */
function extractECUId(line: string): { ecuId: string; dataStart: number } | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2) return null;
  
  const firstPart = parts[0].toUpperCase();
  
  // CAN 11-bit header format: "7E8", "7E9", etc.
  if (/^7E[0-9A-F]$/.test(firstPart)) {
    return { ecuId: firstPart, dataStart: 1 };
  }
  
  // CAN 29-bit or legacy format: "18DA10F1" or just "10", "11", "1D"
  if (/^[0-9A-F]{2}$/.test(firstPart) && parseInt(firstPart, 16) <= 0x7F) {
    return { ecuId: firstPart, dataStart: 1 };
  }
  
  // Extended CAN header
  if (/^[0-9A-F]{8}$/.test(firstPart)) {
    return { ecuId: firstPart.slice(-2), dataStart: 1 };
  }
  
  return null;
}

/**
 * Check if a line is a multi-frame first frame (ISO-TP)
 */
function isFirstFrame(bytes: number[]): boolean {
  // First frame starts with 1x (where x is upper nibble of length)
  return bytes.length > 0 && (bytes[0] & 0xF0) === 0x10;
}

/**
 * Check if a line is a consecutive frame (ISO-TP)
 */
function isConsecutiveFrame(bytes: number[]): boolean {
  // Consecutive frames start with 2x (where x is sequence number)
  return bytes.length > 0 && (bytes[0] & 0xF0) === 0x20;
}

/**
 * Parse DTC bytes from a single ECU response
 */
function parseDTCBytes(
  dtcBytes: number[],
  mode: string,
  ecuId: string,
  manufacturerId?: string,
  year?: number
): DTCResult[] {
  const results: DTCResult[] = [];
  const expectedResponse = MODE_RESPONSE_MAP[mode];
  
  logger.debug(MODULE, 'Parsing DTC bytes', {
    ecuId,
    mode,
    expectedResponse,
    byteCount: dtcBytes.length,
    bytes: dtcBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '),
  });
  
  // Find the mode response byte (43, 47, or 4A)
  let dataStart = -1;
  for (let i = 0; i < dtcBytes.length; i++) {
    if (dtcBytes[i].toString(16).toUpperCase() === expectedResponse) {
      dataStart = i + 1; // Start after mode response byte
      break;
    }
  }
  
  if (dataStart === -1 || dataStart >= dtcBytes.length) {
    logger.trace(MODULE, 'No mode response found in bytes', { 
      expectedResponse, 
      bytes: dtcBytes.map(b => b.toString(16).toUpperCase()).join(' ')
    });
    return results;
  }
  
  // The byte after mode response is the DTC count (for some protocols)
  // But in CAN, it might be included or not. Let's try to be smart about it.
  let dtcDataStart = dataStart;
  const possibleCount = dtcBytes[dataStart];
  
  // Heuristic: If the "count" is reasonable and matches available bytes, skip it
  const remainingBytes = dtcBytes.length - dataStart - 1;
  if (possibleCount <= 127 && possibleCount * 2 <= remainingBytes) {
    dtcDataStart = dataStart + 1;
    logger.trace(MODULE, 'Skipping count byte', { possibleCount, remainingBytes });
  }
  
  // Parse DTC pairs
  for (let i = dtcDataStart; i < dtcBytes.length - 1; i += 2) {
    const byte1 = dtcBytes[i];
    const byte2 = dtcBytes[i + 1];
    
    const decoded = decodeDTC(byte1, byte2);
    if (decoded) {
      // Get description
      const isMfrSpecific = isManufacturerSpecificCode(decoded.code);
      let description = DTC_DESCRIPTIONS[decoded.code];
      
      if (!description) {
        if (isMfrSpecific && manufacturerId) {
          description = getManufacturerDTCDescription(decoded.code, manufacturerId, year) || 
                       `Manufacturer Specific - ${ECU_NAMES[ecuId] || 'Unknown ECU'}`;
        } else {
          description = getGenericDescription(decoded.code);
        }
      }
      
      results.push({
        code: decoded.code,
        category: decoded.category,
        categoryName: DTCCategoryNames[decoded.category],
        rawHex: decoded.rawHex,
        mode,
        description,
        isManufacturerSpecific: isMfrSpecific,
      });
      
      logger.info(MODULE, 'DTC decoded', {
        code: decoded.code,
        ecuId,
        ecuName: ECU_NAMES[ecuId] || 'Unknown',
        description: description.substring(0, 50),
      });
    }
  }
  
  return results;
}

/**
 * Generate a generic description based on code structure
 */
function getGenericDescription(code: string): string {
  const category = code[0];
  const firstDigit = code[1];
  
  const categoryNames: Record<string, string> = {
    'P': 'Powertrain',
    'B': 'Body',
    'C': 'Chassis',
    'U': 'Network/Communication',
  };
  
  const isGeneric = firstDigit === '0' || firstDigit === '2';
  const typeStr = isGeneric ? 'Generic' : 'Manufacturer Specific';
  
  return `${categoryNames[category] || 'Unknown'} - ${typeStr} Code`;
}

/**
 * Main parsing function - handles multi-ECU responses
 */
export function parseOBDResponseV2(
  rawResponse: string,
  mode: string,
  manufacturerId?: string,
  year?: number
): ParsedDTCResponse {
  const result: ParsedDTCResponse = {
    success: false,
    totalDTCs: 0,
    dtcs: [],
    ecuResponses: [],
    rawResponse,
    mode,
    parseErrors: [],
    debugInfo: {
      linesProcessed: 0,
      ecuCount: 0,
      duplicatesRemoved: 0,
      invalidBytesSkipped: 0,
      headersDetected: false,
      multiFrameDetected: false,
    },
  };
  
  const expectedResponse = MODE_RESPONSE_MAP[mode];
  
  logger.info(MODULE, '=== DTC PARSE START ===', {
    mode,
    expectedResponse,
    responseLength: rawResponse.length,
    rawPreview: rawResponse.substring(0, 200),
  });
  
  // Check for empty/error responses
  const upperResponse = rawResponse.toUpperCase();
  for (const pattern of IGNORE_PATTERNS) {
    if (upperResponse.includes(pattern)) {
      logger.info(MODULE, 'Response indicates no data', { pattern });
      result.success = true;
      return result;
    }
  }
  
  // Split into lines
  const lines = rawResponse
    .split(/[\r\n]+/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !IGNORE_PATTERNS.some(p => l.toUpperCase().includes(p)));
  
  logger.debug(MODULE, 'Processing response lines', {
    lineCount: lines.length,
    lines: lines.slice(0, 10),
  });
  
  // Track multi-frame data per ECU
  const ecuMultiFrameData: Map<string, number[]> = new Map();
  const seenCodes = new Set<string>();
  
  for (const line of lines) {
    result.debugInfo.linesProcessed++;
    
    // Try to extract ECU ID
    const ecuInfo = extractECUId(line);
    let ecuId = 'DEFAULT';
    let dataParts: string[];
    
    if (ecuInfo) {
      ecuId = ecuInfo.ecuId;
      dataParts = line.trim().split(/\s+/).slice(ecuInfo.dataStart);
      result.debugInfo.headersDetected = true;
    } else {
      dataParts = line.trim().split(/\s+/);
    }
    
    // Convert to bytes
    const bytes = dataParts.map(p => parseInt(p, 16)).filter(b => !isNaN(b));
    
    if (bytes.length === 0) continue;
    
    // Check for multi-frame (ISO-TP)
    if (isFirstFrame(bytes)) {
      result.debugInfo.multiFrameDetected = true;
      // First frame: [10 LL] [MODE] [DATA...]
      const length = ((bytes[0] & 0x0F) << 8) | bytes[1];
      const frameData = bytes.slice(2);
      ecuMultiFrameData.set(ecuId, frameData);
      logger.debug(MODULE, 'Multi-frame first frame', { ecuId, length, dataLength: frameData.length });
      continue;
    }
    
    if (isConsecutiveFrame(bytes)) {
      // Consecutive frame: [2X] [DATA...]
      const existing = ecuMultiFrameData.get(ecuId) || [];
      const frameData = bytes.slice(1);
      ecuMultiFrameData.set(ecuId, [...existing, ...frameData]);
      logger.debug(MODULE, 'Multi-frame consecutive frame', { ecuId, newDataLength: frameData.length });
      continue;
    }
    
    // Single frame response - parse directly
    // Check if this line contains the expected mode response
    const modeByteIndex = bytes.findIndex(b => b.toString(16).toUpperCase() === expectedResponse);
    if (modeByteIndex === -1) {
      logger.trace(MODULE, 'Line does not contain mode response', { 
        line, 
        expectedResponse,
        bytes: bytes.map(b => b.toString(16).toUpperCase()).join(' ')
      });
      continue;
    }
    
    // Parse this single-frame response
    const dtcBytes = bytes.slice(modeByteIndex);
    const ecuDTCs = parseDTCBytes(dtcBytes, mode, ecuId, manufacturerId, year);
    
    if (ecuDTCs.length > 0) {
      const ecuResponse: ECUDTCResponse = {
        ecuId,
        ecuName: ECU_NAMES[ecuId] || 'Unknown ECU',
        rawLine: line,
        dtcCount: ecuDTCs.length,
        dtcs: ecuDTCs,
      };
      result.ecuResponses.push(ecuResponse);
      
      // Add unique DTCs
      for (const dtc of ecuDTCs) {
        if (!seenCodes.has(dtc.code)) {
          seenCodes.add(dtc.code);
          result.dtcs.push(dtc);
        } else {
          result.debugInfo.duplicatesRemoved++;
        }
      }
    }
  }
  
  // Process any remaining multi-frame data
  for (const [ecuId, frameData] of ecuMultiFrameData) {
    logger.debug(MODULE, 'Processing multi-frame data', { ecuId, dataLength: frameData.length });
    const ecuDTCs = parseDTCBytes(frameData, mode, ecuId, manufacturerId, year);
    
    if (ecuDTCs.length > 0) {
      const ecuResponse: ECUDTCResponse = {
        ecuId,
        ecuName: ECU_NAMES[ecuId] || 'Unknown ECU',
        rawLine: `[Multi-frame: ${frameData.length} bytes]`,
        dtcCount: ecuDTCs.length,
        dtcs: ecuDTCs,
      };
      result.ecuResponses.push(ecuResponse);
      
      for (const dtc of ecuDTCs) {
        if (!seenCodes.has(dtc.code)) {
          seenCodes.add(dtc.code);
          result.dtcs.push(dtc);
        } else {
          result.debugInfo.duplicatesRemoved++;
        }
      }
    }
  }
  
  result.success = true;
  result.totalDTCs = result.dtcs.length;
  result.debugInfo.ecuCount = result.ecuResponses.length;
  
  logger.info(MODULE, '=== DTC PARSE COMPLETE ===', {
    success: result.success,
    totalDTCs: result.totalDTCs,
    ecuCount: result.debugInfo.ecuCount,
    codes: result.dtcs.map(d => `${d.code} (${ECU_NAMES[d.rawHex?.slice(0,2)] || 'ECU'})`),
    debugInfo: result.debugInfo,
  });
  
  return result;
}

// Export for backward compatibility
export { parseOBDResponseV2 as parseOBDResponse };
