import { DTCResult, DTCCategory, DTCCategoryNames } from '../types';
import { logger } from './logger';
import { DTC_DESCRIPTIONS } from '../constants/dtc-descriptions';
import { 
  getManufacturerDTCDescription, 
  isManufacturerSpecificCode 
} from '../constants/manufacturer-dtc-codes';

const MODULE = 'DTC_PARSER';

const CATEGORY_MAP: Record<number, DTCCategory> = {
  0: 'P',
  1: 'C',
  2: 'B',
  3: 'U',
};

export function parseDTCFromBytes(
  byte1: number,
  byte2: number
): { code: string; category: DTCCategory } | null {
  if (byte1 === 0 && byte2 === 0) {
    logger.trace(MODULE, 'Null DTC bytes detected (0x00 0x00), skipping', {
      byte1Hex: '00',
      byte2Hex: '00',
    });
    return null;
  }

  const categoryIndex = (byte1 >> 6) & 0x03;
  const secondDigit = (byte1 >> 4) & 0x03;
  const thirdDigit = byte1 & 0x0f;
  const fourthDigit = (byte2 >> 4) & 0x0f;
  const fifthDigit = byte2 & 0x0f;

  const category = CATEGORY_MAP[categoryIndex];
  const code = `${category}${secondDigit}${thirdDigit.toString(16).toUpperCase()}${fourthDigit.toString(16).toUpperCase()}${fifthDigit.toString(16).toUpperCase()}`;

  logger.debug(MODULE, 'DTC decoded from hex bytes', {
    byte1Hex: byte1.toString(16).padStart(2, '0'),
    byte2Hex: byte2.toString(16).padStart(2, '0'),
    byte1Binary: byte1.toString(2).padStart(8, '0'),
    byte2Binary: byte2.toString(2).padStart(8, '0'),
    decodingSteps: {
      categoryBits: `${((byte1 >> 6) & 0x03).toString(2).padStart(2, '0')} → ${category}`,
      secondDigit: `${secondDigit}`,
      thirdDigit: `${thirdDigit.toString(16).toUpperCase()}`,
      fourthDigit: `${fourthDigit.toString(16).toUpperCase()}`,
      fifthDigit: `${fifthDigit.toString(16).toUpperCase()}`,
    },
    resultCode: code,
    category,
  });

  return { code, category };
}

export function parseOBDResponse(
  response: string, 
  mode: string,
  manufacturerId?: string,
  year?: number
): DTCResult[] {
  const expectedResponseByte = (0x40 + parseInt(mode, 16))
    .toString(16)
    .toUpperCase()
    .padStart(2, '0');

  logger.info(MODULE, 'Parsing OBD response', {
    mode,
    expectedResponseId: expectedResponseByte,
    rawResponse: response,
    manufacturerId,
    year,
  });

  const cleaned = response.replace(/[^0-9A-Fa-f]/g, '');

  logger.debug(MODULE, 'Response cleaned for parsing', {
    cleaned,
    cleanedLength: cleaned.length,
    removedChars: response.length - cleaned.length,
  });

  if (!cleaned.toUpperCase().startsWith(expectedResponseByte)) {
    logger.warn(MODULE, 'Response prefix mismatch', {
      expected: expectedResponseByte,
      actual: cleaned.substring(0, 2).toUpperCase(),
      fullCleaned: cleaned,
    });
    return [];
  }

  const dtcHex = cleaned.substring(2);

  logger.debug(MODULE, 'DTC hex data extracted', {
    dtcHex,
    dtcHexLength: dtcHex.length,
    potentialDTCCount: Math.floor(dtcHex.length / 4),
  });

  if (dtcHex.length < 4) {
    const isZeroResponse = dtcHex === '0000' || dtcHex === '00' || dtcHex.length === 0;
    logger.info(MODULE, 'No DTCs found in response', {
      mode,
      dataLength: dtcHex.length,
      isZeroResponse,
      zeroScenarioLogged: true,
    });
    return [];
  }

  const results: DTCResult[] = [];
  const seenCodes = new Set<string>();

  for (let i = 0; i <= dtcHex.length - 4; i += 4) {
    const hexPair = dtcHex.substring(i, i + 4);
    const byte1 = parseInt(hexPair.substring(0, 2), 16);
    const byte2 = parseInt(hexPair.substring(2, 4), 16);

    logger.trace(MODULE, `Processing DTC byte pair ${i / 4 + 1}`, {
      hexPair,
      byte1: byte1.toString(16).padStart(2, '0'),
      byte2: byte2.toString(16).padStart(2, '0'),
      offset: i,
      pairIndex: i / 4 + 1,
    });

    if (isNaN(byte1) || isNaN(byte2)) {
      logger.warn(MODULE, 'Invalid hex bytes encountered, skipping frame', {
        hexPair,
        offset: i,
        byte1Valid: !isNaN(byte1),
        byte2Valid: !isNaN(byte2),
      });
      continue;
    }

    const parsed = parseDTCFromBytes(byte1, byte2);
    if (!parsed) continue;

    if (seenCodes.has(parsed.code)) {
      logger.debug(MODULE, 'Duplicate DTC filtered out', {
        code: parsed.code,
        duplicateAtOffset: i,
      });
      continue;
    }
    seenCodes.add(parsed.code);

    // Check if it's a manufacturer-specific code
    const isMfrSpecific = isManufacturerSpecificCode(parsed.code);
    
    // Try to get manufacturer-specific description first, then fall back to generic
    let description: string;
    if (isMfrSpecific && manufacturerId) {
      const mfrDescription = getManufacturerDTCDescription(parsed.code, manufacturerId, year);
      description = mfrDescription || DTC_DESCRIPTIONS[parsed.code] || 'Manufacturer Specific Code';
    } else {
      description = DTC_DESCRIPTIONS[parsed.code] || 'Manufacturer Specific Code';
    }

    results.push({
      code: parsed.code,
      category: parsed.category,
      categoryName: DTCCategoryNames[parsed.category],
      rawHex: hexPair,
      mode,
      description,
      isManufacturerSpecific: isMfrSpecific,
    });

    logger.info(MODULE, 'DTC parsed and added to results', {
      code: parsed.code,
      category: parsed.category,
      categoryName: DTCCategoryNames[parsed.category],
      rawHex: hexPair,
      mode,
      description,
      resultIndex: results.length,
    });
  }

  logger.info(MODULE, `DTC parsing complete for Mode ${mode}`, {
    mode,
    totalParsed: results.length,
    codes: results.map((r) => r.code),
    categories: results.map((r) => r.category),
    duplicatesFiltered: seenCodes.size - results.length > 0,
  });

  return results;
}
