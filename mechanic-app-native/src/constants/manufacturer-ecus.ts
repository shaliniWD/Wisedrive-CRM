/**
 * Manufacturer-Specific ECU Module Addresses for Enhanced Diagnostics
 * 
 * Each manufacturer has specific CAN addresses for their ECU modules.
 * This allows targeted scanning for Body (B), Chassis (C), and Network (U) codes
 * that standard OBD-II modes don't report.
 */

export interface ECUModule {
  name: string;
  txId: string;  // Transmit ID (request)
  rxId: string;  // Receive ID (response)
  description?: string;
}

export interface ManufacturerECUConfig {
  name: string;
  ids: string[];  // Manufacturer IDs to match
  protocol?: string;  // Preferred protocol (6=CAN 500k, etc.)
  modules: ECUModule[];
}

/**
 * Comprehensive ECU module mappings for all major manufacturers
 * Sources: OBD-II specifications, manufacturer documentation, reverse engineering
 */
export const MANUFACTURER_ECU_CONFIGS: ManufacturerECUConfig[] = [
  // ============================================================================
  // INDIAN BRANDS
  // ============================================================================
  {
    name: 'Tata Motors',
    ids: ['tata', 'tata_motors'],
    protocol: '6', // CAN 11-bit 500k
    modules: [
      { name: 'ECM (Engine)', txId: '7E0', rxId: '7E8', description: 'Engine Control Module' },
      { name: 'TCM (Transmission)', txId: '7E1', rxId: '7E9', description: 'Transmission Control' },
      { name: 'ABS/ESP', txId: '7B0', rxId: '7B8', description: 'Anti-lock Brakes' },
      { name: 'BCM (Body)', txId: '720', rxId: '728', description: 'Body Control Module' },
      { name: 'IPC (Instrument)', txId: '720', rxId: '728', description: 'Instrument Panel Cluster' },
      { name: 'Airbag/SRS', txId: '720', rxId: '728', description: 'Supplemental Restraint System' },
      { name: 'EPS (Steering)', txId: '730', rxId: '738', description: 'Electric Power Steering' },
      { name: 'AC/HVAC', txId: '744', rxId: '74C', description: 'Climate Control' },
    ],
  },
  {
    name: 'Mahindra',
    ids: ['mahindra', 'mahindra_mahindra'],
    protocol: '6',
    modules: [
      { name: 'ECM (Engine)', txId: '7E0', rxId: '7E8' },
      { name: 'TCM (Transmission)', txId: '7E1', rxId: '7E9' },
      { name: 'ABS', txId: '760', rxId: '768' },
      { name: 'BCM', txId: '726', rxId: '72E' },
      { name: 'IPC', txId: '720', rxId: '728' },
      { name: 'SRS', txId: '720', rxId: '728' },
      { name: 'EPS', txId: '730', rxId: '738' },
      { name: '4WD Module', txId: '762', rxId: '76A' },
    ],
  },
  {
    name: 'Maruti Suzuki',
    ids: ['maruti', 'maruti_suzuki', 'suzuki'],
    protocol: '6',
    modules: [
      { name: 'ECM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM/CVT', txId: '7E1', rxId: '7E9' },
      { name: 'ABS/ESP', txId: '7B0', rxId: '7B8' },
      { name: 'SRS', txId: '7C0', rxId: '7C8' },
      { name: 'BCM', txId: '750', rxId: '758' },
      { name: 'EPS', txId: '7A0', rxId: '7A8' },
      { name: 'Meter (IPC)', txId: '7C4', rxId: '7CC' },
      { name: 'A/C', txId: '744', rxId: '74C' },
    ],
  },

  // ============================================================================
  // KOREAN BRANDS
  // ============================================================================
  {
    name: 'Hyundai',
    ids: ['hyundai'],
    protocol: '6',
    modules: [
      { name: 'ECM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM', txId: '7E1', rxId: '7E9' },
      { name: 'ABS/ESC', txId: '7D1', rxId: '7D9' },
      { name: 'SRS', txId: '7D2', rxId: '7DA' },
      { name: 'BCM', txId: '7A0', rxId: '7A8' },
      { name: 'IPC', txId: '7C6', rxId: '7CE' },
      { name: 'EPS/MDPS', txId: '7D4', rxId: '7DC' },
      { name: 'TPMS', txId: '7A1', rxId: '7A9' },
      { name: 'A/C', txId: '7B3', rxId: '7BB' },
      { name: 'Smart Key', txId: '7A5', rxId: '7AD' },
      { name: 'Parking Assist', txId: '7B1', rxId: '7B9' },
    ],
  },
  {
    name: 'Kia',
    ids: ['kia'],
    protocol: '6',
    modules: [
      { name: 'ECM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM', txId: '7E1', rxId: '7E9' },
      { name: 'ABS/ESC', txId: '7D1', rxId: '7D9' },
      { name: 'SRS', txId: '7D2', rxId: '7DA' },
      { name: 'BCM', txId: '7A0', rxId: '7A8' },
      { name: 'IPC', txId: '7C6', rxId: '7CE' },
      { name: 'EPS/MDPS', txId: '7D4', rxId: '7DC' },
      { name: 'TPMS', txId: '7A1', rxId: '7A9' },
      { name: 'A/C', txId: '7B3', rxId: '7BB' },
      { name: 'Smart Key', txId: '7A5', rxId: '7AD' },
    ],
  },

  // ============================================================================
  // JAPANESE BRANDS
  // ============================================================================
  {
    name: 'Toyota',
    ids: ['toyota', 'lexus'],
    protocol: '6',
    modules: [
      { name: 'ECM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM', txId: '7E1', rxId: '7E9' },
      { name: 'ABS/VSC', txId: '7B0', rxId: '7B8' },
      { name: 'SRS', txId: '7C0', rxId: '7C8' },
      { name: 'Body ECU', txId: '750', rxId: '758' },
      { name: 'A/C', txId: '7C4', rxId: '7CC' },
      { name: 'EPS', txId: '7A0', rxId: '7A8' },
      { name: 'Hybrid/EV', txId: '7E2', rxId: '7EA' },
      { name: 'Gateway', txId: '750', rxId: '758' },
      { name: 'Meter', txId: '7C4', rxId: '7CC' },
    ],
  },
  {
    name: 'Honda',
    ids: ['honda', 'acura'],
    protocol: '6',
    modules: [
      { name: 'ECM/PCM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM', txId: '7E1', rxId: '7E9' },
      { name: 'ABS/VSA', txId: '7B0', rxId: '7B8' },
      { name: 'SRS', txId: '7C0', rxId: '7C8' },
      { name: 'MICU (BCM)', txId: '750', rxId: '758' },
      { name: 'EPS', txId: '7A0', rxId: '7A8' },
      { name: 'A/C', txId: '7C4', rxId: '7CC' },
      { name: 'Gauge', txId: '760', rxId: '768' },
      { name: 'IMOES (Immobilizer)', txId: '7A2', rxId: '7AA' },
    ],
  },
  {
    name: 'Nissan',
    ids: ['nissan', 'infiniti', 'datsun'],
    protocol: '6',
    modules: [
      { name: 'ECM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM/CVT', txId: '7E1', rxId: '7E9' },
      { name: 'ABS/VDC', txId: '7B0', rxId: '7B8' },
      { name: 'SRS', txId: '7C0', rxId: '7C8' },
      { name: 'BCM/IPDM', txId: '750', rxId: '758' },
      { name: 'EPS', txId: '7A0', rxId: '7A8' },
      { name: 'A/C', txId: '7C4', rxId: '7CC' },
      { name: 'Meter', txId: '760', rxId: '768' },
      { name: 'NATS (Immobilizer)', txId: '7A2', rxId: '7AA' },
    ],
  },
  {
    name: 'Mitsubishi',
    ids: ['mitsubishi'],
    protocol: '6',
    modules: [
      { name: 'ECM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM', txId: '7E1', rxId: '7E9' },
      { name: 'ABS/ASC', txId: '7B0', rxId: '7B8' },
      { name: 'SRS', txId: '7C0', rxId: '7C8' },
      { name: 'ETACS (BCM)', txId: '750', rxId: '758' },
      { name: 'EPS', txId: '7A0', rxId: '7A8' },
      { name: 'A/C', txId: '7C4', rxId: '7CC' },
      { name: '4WD/AWC', txId: '762', rxId: '76A' },
    ],
  },

  // ============================================================================
  // GERMAN BRANDS - VAG GROUP (VW, Audi, Skoda)
  // ============================================================================
  {
    name: 'Volkswagen',
    ids: ['volkswagen', 'vw'],
    protocol: '6',
    modules: [
      { name: '01-Engine', txId: '7E0', rxId: '7E8' },
      { name: '02-Transmission', txId: '7E1', rxId: '7E9' },
      { name: '03-ABS/ESP', txId: '713', rxId: '77D' },
      { name: '08-A/C', txId: '715', rxId: '77F' },
      { name: '09-Central Electric', txId: '716', rxId: '780' },
      { name: '15-Airbag', txId: '714', rxId: '77E' },
      { name: '17-Instrument', txId: '714', rxId: '77E' },
      { name: '19-Gateway', txId: '710', rxId: '77A' },
      { name: '44-Steering', txId: '712', rxId: '77C' },
      { name: '46-Comfort', txId: '717', rxId: '781' },
      { name: '55-Headlights', txId: '718', rxId: '782' },
    ],
  },
  {
    name: 'Audi',
    ids: ['audi'],
    protocol: '6',
    modules: [
      { name: '01-Engine', txId: '7E0', rxId: '7E8' },
      { name: '02-Transmission', txId: '7E1', rxId: '7E9' },
      { name: '03-ABS/ESP', txId: '713', rxId: '77D' },
      { name: '08-A/C', txId: '715', rxId: '77F' },
      { name: '09-Central Electric', txId: '716', rxId: '780' },
      { name: '15-Airbag', txId: '714', rxId: '77E' },
      { name: '17-Instrument', txId: '714', rxId: '77E' },
      { name: '19-Gateway', txId: '710', rxId: '77A' },
      { name: '44-Steering', txId: '712', rxId: '77C' },
      { name: '4F-Central Electric 2', txId: '71F', rxId: '789' },
      { name: '5F-Infotainment', txId: '5F', rxId: '5F' },
      { name: '76-Park Assist', txId: '71A', rxId: '784' },
    ],
  },
  {
    name: 'Skoda',
    ids: ['skoda'],
    protocol: '6',
    modules: [
      { name: '01-Engine', txId: '7E0', rxId: '7E8' },
      { name: '02-Transmission', txId: '7E1', rxId: '7E9' },
      { name: '03-ABS/ESP', txId: '713', rxId: '77D' },
      { name: '08-A/C', txId: '715', rxId: '77F' },
      { name: '09-Central Electric', txId: '716', rxId: '780' },
      { name: '15-Airbag', txId: '714', rxId: '77E' },
      { name: '17-Instrument', txId: '714', rxId: '77E' },
      { name: '19-Gateway', txId: '710', rxId: '77A' },
      { name: '44-Steering', txId: '712', rxId: '77C' },
    ],
  },

  // ============================================================================
  // GERMAN BRANDS - BMW GROUP (BMW, Mini)
  // ============================================================================
  {
    name: 'BMW',
    ids: ['bmw'],
    protocol: '6',
    modules: [
      { name: 'DME (Engine)', txId: '7E0', rxId: '7E8' },
      { name: 'EGS (Transmission)', txId: '7E1', rxId: '7E9' },
      { name: 'DSC (ABS/Stability)', txId: '760', rxId: '768' },
      { name: 'ACSM (Airbag)', txId: '720', rxId: '728' },
      { name: 'FRM (Footwell)', txId: '727', rxId: '72F' },
      { name: 'CAS (Car Access)', txId: '725', rxId: '72D' },
      { name: 'KOMBI (Cluster)', txId: '720', rxId: '728' },
      { name: 'EPS (Steering)', txId: '730', rxId: '738' },
      { name: 'IHKA (A/C)', txId: '740', rxId: '748' },
      { name: 'CCC/CIC (iDrive)', txId: '7BF', rxId: '7CF' },
      { name: 'PDC (Parking)', txId: '750', rxId: '758' },
    ],
  },
  {
    name: 'Mini',
    ids: ['mini', 'mini_cooper'],
    protocol: '6',
    modules: [
      { name: 'DME (Engine)', txId: '7E0', rxId: '7E8' },
      { name: 'EGS (Transmission)', txId: '7E1', rxId: '7E9' },
      { name: 'DSC (ABS)', txId: '760', rxId: '768' },
      { name: 'ACSM (Airbag)', txId: '720', rxId: '728' },
      { name: 'FRM (Footwell)', txId: '727', rxId: '72F' },
      { name: 'CAS (Car Access)', txId: '725', rxId: '72D' },
      { name: 'KOMBI (Cluster)', txId: '720', rxId: '728' },
      { name: 'EPS', txId: '730', rxId: '738' },
    ],
  },

  // ============================================================================
  // GERMAN BRANDS - MERCEDES
  // ============================================================================
  {
    name: 'Mercedes-Benz',
    ids: ['mercedes', 'mercedes_benz', 'mercedes-benz'],
    protocol: '6',
    modules: [
      { name: 'ME (Engine)', txId: '7E0', rxId: '7E8' },
      { name: 'ISM/VGS (Transmission)', txId: '7E1', rxId: '7E9' },
      { name: 'ESP (ABS/Stability)', txId: '760', rxId: '768' },
      { name: 'SRS (Airbag)', txId: '720', rxId: '728' },
      { name: 'SAM-F (Front Signal)', txId: '740', rxId: '748' },
      { name: 'SAM-R (Rear Signal)', txId: '741', rxId: '749' },
      { name: 'IC (Instrument)', txId: '720', rxId: '728' },
      { name: 'EPS (Steering)', txId: '730', rxId: '738' },
      { name: 'KLA (A/C)', txId: '744', rxId: '74C' },
      { name: 'COMAND', txId: '7BF', rxId: '7CF' },
      { name: 'ESL (Steering Lock)', txId: '726', rxId: '72E' },
      { name: 'EIS (Ignition)', txId: '725', rxId: '72D' },
    ],
  },

  // ============================================================================
  // AMERICAN BRANDS
  // ============================================================================
  {
    name: 'Ford',
    ids: ['ford', 'lincoln'],
    protocol: '6',
    modules: [
      { name: 'PCM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM', txId: '7E1', rxId: '7E9' },
      { name: 'ABS', txId: '760', rxId: '768' },
      { name: 'RCM (Airbag)', txId: '737', rxId: '73F' },
      { name: 'IPC (Dashboard)', txId: '720', rxId: '728' },
      { name: 'BCM', txId: '726', rxId: '72E' },
      { name: 'PATS (Anti-Theft)', txId: '727', rxId: '72F' },
      { name: 'APIM (Sync)', txId: '7D0', rxId: '7D8' },
      { name: 'PSCM (Steering)', txId: '730', rxId: '738' },
      { name: 'DDM (Driver Door)', txId: '740', rxId: '748' },
      { name: 'PDM (Passenger Door)', txId: '741', rxId: '749' },
      { name: 'HVAC', txId: '733', rxId: '73B' },
      { name: 'SCCM (Column)', txId: '724', rxId: '72C' },
    ],
  },
  {
    name: 'Chevrolet/GM',
    ids: ['chevrolet', 'gm', 'general_motors', 'buick', 'cadillac'],
    protocol: '6',
    modules: [
      { name: 'ECM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM', txId: '7E1', rxId: '7E9' },
      { name: 'EBCM (ABS)', txId: '241', rxId: '541' },
      { name: 'BCM', txId: '244', rxId: '544' },
      { name: 'SDM (Airbag)', txId: '240', rxId: '540' },
      { name: 'IPC (Cluster)', txId: '24C', rxId: '54C' },
      { name: 'HVAC', txId: '251', rxId: '551' },
      { name: 'OnStar', txId: '24A', rxId: '54A' },
      { name: 'Radio', txId: '24D', rxId: '54D' },
      { name: 'EPS', txId: '242', rxId: '542' },
    ],
  },

  // ============================================================================
  // BRITISH BRANDS
  // ============================================================================
  {
    name: 'Jaguar',
    ids: ['jaguar'],
    protocol: '6',
    modules: [
      { name: 'ECM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM', txId: '7E1', rxId: '7E9' },
      { name: 'ABS', txId: '760', rxId: '768' },
      { name: 'RCM (Airbag)', txId: '720', rxId: '728' },
      { name: 'BCM', txId: '726', rxId: '72E' },
      { name: 'IPC', txId: '720', rxId: '728' },
      { name: 'HVAC', txId: '740', rxId: '748' },
      { name: 'EPS', txId: '730', rxId: '738' },
      { name: 'Park Assist', txId: '750', rxId: '758' },
    ],
  },
  {
    name: 'Land Rover',
    ids: ['landrover', 'land_rover', 'range_rover'],
    protocol: '6',
    modules: [
      { name: 'ECM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM', txId: '7E1', rxId: '7E9' },
      { name: 'ABS', txId: '760', rxId: '768' },
      { name: 'RCM (Airbag)', txId: '720', rxId: '728' },
      { name: 'BCM', txId: '726', rxId: '72E' },
      { name: 'IPC', txId: '720', rxId: '728' },
      { name: 'HVAC', txId: '740', rxId: '748' },
      { name: 'EPS', txId: '730', rxId: '738' },
      { name: 'TC (Transfer Case)', txId: '762', rxId: '76A' },
      { name: 'Air Suspension', txId: '764', rxId: '76C' },
      { name: 'Terrain Response', txId: '766', rxId: '76E' },
    ],
  },
  {
    name: 'Volvo',
    ids: ['volvo'],
    protocol: '6',
    modules: [
      { name: 'ECM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM', txId: '7E1', rxId: '7E9' },
      { name: 'ABS/STC', txId: '760', rxId: '768' },
      { name: 'SRS', txId: '720', rxId: '728' },
      { name: 'CEM (Central)', txId: '726', rxId: '72E' },
      { name: 'DIM (Cluster)', txId: '720', rxId: '728' },
      { name: 'CCM (Climate)', txId: '740', rxId: '748' },
      { name: 'SWM (Steering)', txId: '730', rxId: '738' },
      { name: 'PSM (Parking)', txId: '750', rxId: '758' },
    ],
  },

  // ============================================================================
  // CHINESE BRANDS
  // ============================================================================
  {
    name: 'MG Motors',
    ids: ['mg', 'mg_motors', 'saic'],
    protocol: '6',
    modules: [
      { name: 'ECM', txId: '7E0', rxId: '7E8' },
      { name: 'TCM', txId: '7E1', rxId: '7E9' },
      { name: 'ABS/ESP', txId: '7B0', rxId: '7B8' },
      { name: 'SRS', txId: '7C0', rxId: '7C8' },
      { name: 'BCM', txId: '750', rxId: '758' },
      { name: 'IPC', txId: '720', rxId: '728' },
      { name: 'EPS', txId: '7A0', rxId: '7A8' },
      { name: 'HVAC', txId: '744', rxId: '74C' },
      { name: 'Infotainment', txId: '7BF', rxId: '7CF' },
      { name: 'EV/Hybrid', txId: '7E2', rxId: '7EA' },
    ],
  },

  // ============================================================================
  // AMERICAN BRANDS (CHRYSLER/FCA/STELLANTIS GROUP)
  // ============================================================================
  {
    name: 'Jeep',
    ids: ['jeep', 'chrysler', 'dodge', 'ram', 'fiat', 'stellantis'],
    protocol: '6',
    modules: [
      { name: 'PCM (Engine)', txId: '7E0', rxId: '7E8', description: 'Powertrain Control Module' },
      { name: 'TCM (Transmission)', txId: '7E1', rxId: '7E9', description: 'Transmission Control Module' },
      { name: 'ABS/ESP', txId: '7E2', rxId: '7EA', description: 'Anti-lock Brakes/Stability' },
      { name: 'ORC (Airbag)', txId: '720', rxId: '728', description: 'Occupant Restraint Controller' },
      { name: 'BCM (Body)', txId: '740', rxId: '748', description: 'Body Control Module' },
      { name: 'IPC (Cluster)', txId: '760', rxId: '768', description: 'Instrument Panel Cluster' },
      { name: 'EPS (Steering)', txId: '762', rxId: '76A', description: 'Electric Power Steering' },
      { name: 'HVAC', txId: '764', rxId: '76C', description: 'Climate Control' },
      { name: 'SKREEM (Security)', txId: '744', rxId: '74C', description: 'Sentry Key Remote Entry Module' },
      { name: 'TPMS', txId: '746', rxId: '74E', description: 'Tire Pressure Monitor' },
      { name: 'Radio/Uconnect', txId: '7D0', rxId: '7D8', description: 'Infotainment System' },
      { name: 'FDCM (Driver Door)', txId: '750', rxId: '758', description: 'Front Door Control Module' },
      { name: 'PDCM (Passenger Door)', txId: '752', rxId: '75A', description: 'Passenger Door Control Module' },
      { name: 'Transfer Case', txId: '7E3', rxId: '7EB', description: '4WD Transfer Case Module' },
      { name: 'ESM (Shifter)', txId: '766', rxId: '76E', description: 'Electronic Shifter Module' },
    ],
  },

  // ============================================================================
  // FRENCH BRANDS
  // ============================================================================
  {
    name: 'Renault',
    ids: ['renault', 'dacia'],
    protocol: '6',
    modules: [
      { name: 'ECM (Engine)', txId: '7E0', rxId: '7E8', description: 'Engine Control Module' },
      { name: 'TCM (Gearbox)', txId: '7E1', rxId: '7E9', description: 'Automatic Gearbox' },
      { name: 'ABS/ESP', txId: '760', rxId: '768', description: 'Anti-lock Brakes' },
      { name: 'Airbag', txId: '772', rxId: '77A', description: 'Airbag ECU' },
      { name: 'UCH (BCM)', txId: '765', rxId: '76D', description: 'Habitacle Computer Unit' },
      { name: 'Instrument Panel', txId: '763', rxId: '76B', description: 'Dashboard' },
      { name: 'EPS', txId: '762', rxId: '76A', description: 'Electric Power Steering' },
      { name: 'Climate Control', txId: '764', rxId: '76C', description: 'A/C System' },
      { name: 'Parking Aid', txId: '761', rxId: '769', description: 'Parking Sensors' },
      { name: 'UPC (Fuse Box)', txId: '778', rxId: '780', description: 'Under-hood Fuse Box ECU' },
      { name: 'Keyless Entry', txId: '776', rxId: '77E', description: 'Keyless Entry Module' },
      { name: 'Radio/Media', txId: '7BC', rxId: '7C4', description: 'Multimedia System' },
    ],
  },

  // ============================================================================
  // ADDITIONAL JAPANESE BRANDS
  // ============================================================================
  {
    name: 'Datsun',
    ids: ['datsun'],
    protocol: '6',
    modules: [
      { name: 'ECM', txId: '7E0', rxId: '7E8', description: 'Engine Control Module' },
      { name: 'TCM/CVT', txId: '7E1', rxId: '7E9', description: 'Transmission/CVT Control' },
      { name: 'ABS', txId: '7B0', rxId: '7B8', description: 'Anti-lock Brakes' },
      { name: 'SRS', txId: '7C0', rxId: '7C8', description: 'Airbag System' },
      { name: 'BCM/IPDM', txId: '750', rxId: '758', description: 'Body Control Module' },
      { name: 'Meter', txId: '760', rxId: '768', description: 'Instrument Cluster' },
      { name: 'EPS', txId: '7A0', rxId: '7A8', description: 'Electric Power Steering' },
      { name: 'A/C', txId: '7C4', rxId: '7CC', description: 'Climate Control' },
    ],
  },
];

/**
 * Get ECU configuration for a manufacturer by ID
 */
export function getManufacturerECUConfig(manufacturerId: string): ManufacturerECUConfig | null {
  const lowerID = manufacturerId.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  for (const config of MANUFACTURER_ECU_CONFIGS) {
    for (const id of config.ids) {
      if (lowerID.includes(id) || id.includes(lowerID)) {
        return config;
      }
    }
  }
  
  return null;
}

/**
 * Get a generic/default ECU configuration for unknown manufacturers
 */
export function getDefaultECUConfig(): ManufacturerECUConfig {
  return {
    name: 'Generic',
    ids: ['generic'],
    protocol: '6',
    modules: [
      { name: 'Engine/PCM', txId: '7E0', rxId: '7E8' },
      { name: 'Transmission', txId: '7E1', rxId: '7E9' },
      { name: 'ABS', txId: '7B0', rxId: '7B8' },
      { name: 'Airbag/SRS', txId: '7C0', rxId: '7C8' },
      { name: 'Body/BCM', txId: '750', rxId: '758' },
      { name: 'Dashboard/IPC', txId: '720', rxId: '728' },
      { name: 'Steering/EPS', txId: '7A0', rxId: '7A8' },
    ],
  };
}

