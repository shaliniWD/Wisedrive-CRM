/**
 * Comprehensive DTC Knowledge Base
 * 
 * Contains detailed diagnostic information for each DTC including:
 * - Possible Causes (Top 5, concise descriptions)
 * - Symptoms (Top 5, what the driver might experience)
 * - Solutions (Top 5, recommended fixes)
 * 
 * This data is designed for API integration and customer-facing displays.
 */

export interface DTCKnowledge {
  causes: string[];      // Top 5 possible causes (5-6 words each)
  symptoms: string[];    // Top 5 symptoms (5-6 words each)
  solutions: string[];   // Top 5 solutions (5-6 words each)
}

/**
 * Comprehensive DTC Knowledge Database
 * Each entry contains causes, symptoms, and solutions
 */
export const DTC_KNOWLEDGE_BASE: Record<string, DTCKnowledge> = {
  // ============================================
  // P0xxx - Powertrain Generic Codes
  // ============================================
  
  // Misfire Codes
  'P0300': {
    causes: [
      'Worn or fouled spark plugs',
      'Faulty ignition coil or wires',
      'Low fuel pressure detected',
      'Vacuum leak in intake manifold',
      'Clogged or dirty fuel injectors',
    ],
    symptoms: [
      'Engine runs rough at idle',
      'Hesitation during acceleration',
      'Check engine light flashing',
      'Reduced fuel economy noticed',
      'Engine vibration felt strongly',
    ],
    solutions: [
      'Replace spark plugs immediately',
      'Inspect and test ignition coils',
      'Check fuel pressure regulator',
      'Repair any vacuum leaks found',
      'Clean or replace fuel injectors',
    ],
  },
  'P0301': {
    causes: [
      'Cylinder 1 spark plug worn',
      'Cylinder 1 ignition coil failed',
      'Fuel injector 1 clogged dirty',
      'Low compression in cylinder 1',
      'Vacuum leak near cylinder 1',
    ],
    symptoms: [
      'Engine misfires at idle',
      'Rough running when cold',
      'Loss of power acceleration',
      'Check engine light illuminated',
      'Fuel smell from exhaust',
    ],
    solutions: [
      'Replace cylinder 1 spark plug',
      'Test and replace ignition coil',
      'Clean or replace injector 1',
      'Perform compression test cylinder',
      'Check intake manifold gasket',
    ],
  },
  'P0302': {
    causes: [
      'Cylinder 2 spark plug fouled',
      'Ignition coil 2 malfunctioning',
      'Fuel injector 2 not working',
      'Valve problem in cylinder 2',
      'Head gasket leak cylinder 2',
    ],
    symptoms: [
      'Engine shakes at idle',
      'Power loss during driving',
      'Flashing check engine light',
      'Poor fuel economy observed',
      'Exhaust has rough sound',
    ],
    solutions: [
      'Replace spark plug cylinder 2',
      'Swap ignition coil to test',
      'Clean fuel injector thoroughly',
      'Check valve clearance adjustment',
      'Inspect head gasket condition',
    ],
  },
  'P0303': {
    causes: [
      'Spark plug 3 worn out',
      'Coil pack 3 has failed',
      'Injector 3 clogged or stuck',
      'Compression low cylinder 3',
      'Timing chain stretched worn',
    ],
    symptoms: [
      'Rough idle engine shaking',
      'Acceleration hesitation noticed',
      'Engine light flashing rapidly',
      'Vibration through steering wheel',
      'Decreased fuel mileage observed',
    ],
    solutions: [
      'Install new spark plug 3',
      'Replace ignition coil pack 3',
      'Service fuel injector 3',
      'Compression test needed immediately',
      'Inspect timing chain tensioner',
    ],
  },
  'P0304': {
    causes: [
      'Cylinder 4 spark plug bad',
      'Ignition coil 4 defective',
      'Fuel injector 4 blocked',
      'Intake valve 4 carbon buildup',
      'Wiring harness damage found',
    ],
    symptoms: [
      'Engine runs very rough',
      'Noticeable power reduction',
      'Check engine light on',
      'Uneven idle RPM fluctuation',
      'Strong vibration at stop',
    ],
    solutions: [
      'Replace spark plug immediately',
      'Test coil with multimeter',
      'Perform injector cleaning service',
      'Walnut blast intake valves',
      'Repair damaged wiring harness',
    ],
  },
  
  // Crankshaft/Camshaft Position Sensors
  'P0335': {
    causes: [
      'Crankshaft position sensor failed',
      'Sensor wiring damaged corroded',
      'Reluctor ring damaged broken',
      'ECM internal circuit failure',
      'Timing belt jumped teeth',
    ],
    symptoms: [
      'Engine will not start',
      'Engine stalls while driving',
      'Intermittent starting problems occur',
      'No spark to spark plugs',
      'Tachometer reads zero RPM',
    ],
    solutions: [
      'Replace crankshaft position sensor',
      'Inspect and repair wiring',
      'Check reluctor ring damage',
      'Test ECM signal output',
      'Verify timing belt alignment',
    ],
  },
  'P0336': {
    causes: [
      'Crankshaft sensor signal weak',
      'Air gap too large sensor',
      'Reluctor wheel teeth damaged',
      'Electrical interference affecting signal',
      'Sensor mounting loose incorrect',
    ],
    symptoms: [
      'Engine runs rough intermittent',
      'Hard starting when hot',
      'Random stalling while driving',
      'Check engine light comes on',
      'Engine hesitates under load',
    ],
    solutions: [
      'Adjust sensor air gap',
      'Replace crankshaft position sensor',
      'Inspect reluctor wheel condition',
      'Check for electrical interference',
      'Secure sensor mounting properly',
    ],
  },
  'P0340': {
    causes: [
      'Camshaft position sensor failed',
      'Sensor circuit wiring open',
      'Timing chain stretched excessively',
      'Camshaft reluctor damaged broken',
      'ECM camshaft circuit failure',
    ],
    symptoms: [
      'Engine cranks wont start',
      'Poor engine performance noticed',
      'Engine stalls unexpectedly sometimes',
      'Rough idle during warmup',
      'Decreased fuel economy significantly',
    ],
    solutions: [
      'Replace camshaft position sensor',
      'Repair wiring to sensor',
      'Replace timing chain components',
      'Inspect camshaft reluctor ring',
      'Test ECM cam circuit',
    ],
  },
  'P0341': {
    causes: [
      'Cam sensor signal erratic',
      'Timing chain slack loose',
      'Variable valve timing malfunction',
      'Camshaft phaser stuck position',
      'Low oil pressure to VVT',
    ],
    symptoms: [
      'Check engine light illuminated',
      'Engine performance reduced noticeably',
      'Rough running at idle',
      'Rattling noise from engine',
      'Hard starting occasionally noticed',
    ],
    solutions: [
      'Replace camshaft position sensor',
      'Service timing chain assembly',
      'Inspect VVT solenoid operation',
      'Replace camshaft phaser unit',
      'Change oil and filter',
    ],
  },
  
  // Oxygen Sensors
  'P0130': {
    causes: [
      'O2 sensor heater failed',
      'Sensor contaminated with coolant',
      'Exhaust leak before sensor',
      'Wiring to sensor damaged',
      'ECM O2 circuit malfunction',
    ],
    symptoms: [
      'Poor fuel economy observed',
      'Check engine light on',
      'Engine runs rich condition',
      'Rough idle at warmup',
      'Failed emissions test results',
    ],
    solutions: [
      'Replace oxygen sensor bank 1',
      'Check for coolant contamination',
      'Repair exhaust leak found',
      'Fix wiring harness damage',
      'Test ECM O2 circuit',
    ],
  },
  'P0131': {
    causes: [
      'O2 sensor stuck low voltage',
      'Vacuum leak causing lean',
      'Fuel pressure too low',
      'Mass airflow sensor dirty',
      'Exhaust leak pre-sensor location',
    ],
    symptoms: [
      'Engine runs lean constantly',
      'Check engine light illuminated',
      'Hesitation during acceleration noted',
      'Poor fuel mileage observed',
      'Rough idle engine shaking',
    ],
    solutions: [
      'Replace bank 1 O2 sensor',
      'Find and fix vacuum leak',
      'Test fuel pump pressure',
      'Clean or replace MAF sensor',
      'Seal exhaust manifold leak',
    ],
  },
  'P0133': {
    causes: [
      'O2 sensor response slow',
      'Sensor aging worn out',
      'Exhaust leak affecting readings',
      'Fuel system too rich',
      'Intake air leak present',
    ],
    symptoms: [
      'Decreased fuel economy noticed',
      'Check engine light on',
      'Slight hesitation when accelerating',
      'Emissions test failure likely',
      'Engine may run rough',
    ],
    solutions: [
      'Replace oxygen sensor immediately',
      'Inspect exhaust for leaks',
      'Check fuel injector operation',
      'Look for intake leaks',
      'Reset and monitor system',
    ],
  },
  'P0134': {
    causes: [
      'O2 sensor heater circuit open',
      'Sensor completely failed dead',
      'Wiring connector disconnected loose',
      'Fuse blown for heater',
      'ECM heater driver failed',
    ],
    symptoms: [
      'Check engine light on',
      'Poor fuel economy severely',
      'Engine may run rich',
      'Failed emissions inspection test',
      'Slow warmup performance noticed',
    ],
    solutions: [
      'Replace failed O2 sensor',
      'Check wiring connector secure',
      'Inspect and replace fuse',
      'Test ECM heater circuit',
      'Clear codes after repair',
    ],
  },
  
  // Catalyst Efficiency
  'P0420': {
    causes: [
      'Catalytic converter efficiency degraded',
      'Downstream O2 sensor faulty',
      'Exhaust leak before converter',
      'Engine misfire damaging catalyst',
      'Incorrect fuel mixture running',
    ],
    symptoms: [
      'Check engine light illuminated',
      'Sulfur smell from exhaust',
      'Reduced engine power noticed',
      'Failed emissions test results',
      'Fuel economy slightly decreased',
    ],
    solutions: [
      'Replace catalytic converter unit',
      'Check downstream O2 sensor',
      'Repair any exhaust leaks',
      'Fix misfire causing damage',
      'Verify fuel system operation',
    ],
  },
  'P0430': {
    causes: [
      'Bank 2 catalyst worn out',
      'Rear O2 sensor malfunction',
      'Exhaust manifold leak present',
      'Rich running condition prolonged',
      'Coolant contamination in exhaust',
    ],
    symptoms: [
      'Check engine light steady',
      'Rotten egg smell exhaust',
      'Power loss may occur',
      'Emissions test will fail',
      'Slight decrease fuel economy',
    ],
    solutions: [
      'Replace bank 2 catalytic converter',
      'Test rear oxygen sensor',
      'Fix exhaust manifold leaks',
      'Repair rich fuel condition',
      'Check for coolant leaks',
    ],
  },
  
  // EGR System
  'P0401': {
    causes: [
      'EGR passages blocked carbon',
      'EGR valve stuck closed',
      'EGR position sensor faulty',
      'Vacuum supply line blocked',
      'DPFE sensor malfunctioning now',
    ],
    symptoms: [
      'Check engine light on',
      'Slight ping under load',
      'Failed emissions NOx high',
      'May run slightly rough',
      'No noticeable drivability issues',
    ],
    solutions: [
      'Clean EGR passages thoroughly',
      'Replace stuck EGR valve',
      'Test position sensor function',
      'Clear vacuum line blockage',
      'Replace DPFE sensor unit',
    ],
  },
  'P0402': {
    causes: [
      'EGR valve stuck open',
      'EGR solenoid failed open',
      'Vacuum leak to EGR',
      'DPFE sensor reading incorrectly',
      'Carbon buildup in passages',
    ],
    symptoms: [
      'Rough idle engine stalling',
      'Check engine light illuminated',
      'Poor acceleration performance noted',
      'Engine may surge idle',
      'Hesitation at low speeds',
    ],
    solutions: [
      'Replace EGR valve assembly',
      'Test EGR solenoid operation',
      'Fix vacuum leak found',
      'Replace faulty DPFE sensor',
      'Clean intake EGR passages',
    ],
  },
  
  // EVAP System
  'P0440': {
    causes: [
      'Gas cap loose or missing',
      'EVAP canister vent blocked',
      'Purge valve stuck position',
      'EVAP line leak detected',
      'Charcoal canister saturated damaged',
    ],
    symptoms: [
      'Check engine light on',
      'Fuel smell occasionally noticed',
      'No drivability symptoms usually',
      'Failed emissions evap test',
      'Gas cap warning light',
    ],
    solutions: [
      'Tighten or replace gas cap',
      'Check canister vent valve',
      'Test purge valve operation',
      'Smoke test EVAP lines',
      'Replace charcoal canister unit',
    ],
  },
  'P0442': {
    causes: [
      'Small EVAP leak present',
      'Gas cap seal damaged',
      'EVAP hose cracked leaking',
      'Fuel tank leak small',
      'Purge valve not sealing',
    ],
    symptoms: [
      'Check engine light steady',
      'Slight fuel odor sometimes',
      'No performance issues noticed',
      'Emissions test may fail',
      'Hard to diagnose leak',
    ],
    solutions: [
      'Replace gas cap first',
      'Smoke test entire system',
      'Inspect all EVAP hoses',
      'Check fuel tank seals',
      'Replace purge valve unit',
    ],
  },
  'P0455': {
    causes: [
      'Gas cap off or loose',
      'Large EVAP system leak',
      'Purge valve stuck open',
      'EVAP canister cracked broken',
      'Fuel tank cap missing',
    ],
    symptoms: [
      'Check engine light on',
      'Strong fuel smell present',
      'Gas cap light illuminated',
      'Failed emissions inspection test',
      'May notice fuel loss',
    ],
    solutions: [
      'Install gas cap properly',
      'Perform smoke test system',
      'Replace purge solenoid valve',
      'Inspect EVAP canister condition',
      'Check all system connections',
    ],
  },
  
  // Fuel System
  'P0171': {
    causes: [
      'Vacuum leak in system',
      'Faulty mass airflow sensor',
      'Fuel pump weak pressure',
      'Clogged fuel filter dirty',
      'Leaking fuel injector seals',
    ],
    symptoms: [
      'Engine runs lean condition',
      'Hesitation during acceleration noticeable',
      'Check engine light on',
      'Rough idle when warm',
      'Poor fuel economy noticed',
    ],
    solutions: [
      'Find and fix vacuum leak',
      'Clean or replace MAF sensor',
      'Test fuel pump pressure',
      'Replace fuel filter immediately',
      'Inspect injector o-ring seals',
    ],
  },
  'P0172': {
    causes: [
      'Fuel injector leaking internally',
      'Faulty oxygen sensor reading',
      'Clogged air filter restricting',
      'Fuel pressure regulator failed',
      'EVAP purge valve stuck',
    ],
    symptoms: [
      'Engine runs rich condition',
      'Black smoke from exhaust',
      'Poor fuel economy observed',
      'Spark plugs fouled black',
      'Strong fuel smell present',
    ],
    solutions: [
      'Test and replace injectors',
      'Replace faulty O2 sensor',
      'Install new air filter',
      'Check fuel pressure regulator',
      'Inspect EVAP purge valve',
    ],
  },
  'P0087': {
    causes: [
      'Fuel pump failing weak',
      'Clogged fuel filter severely',
      'Fuel pressure regulator failed',
      'Fuel line restriction present',
      'Fuel tank pickup blocked',
    ],
    symptoms: [
      'Engine loses power driving',
      'Hard starting when hot',
      'Engine stalls under load',
      'Check engine light on',
      'Hesitation at high speed',
    ],
    solutions: [
      'Replace high pressure pump',
      'Install new fuel filter',
      'Test pressure regulator operation',
      'Inspect fuel lines thoroughly',
      'Check fuel tank condition',
    ],
  },
  
  // Throttle Position
  'P0121': {
    causes: [
      'Throttle position sensor worn',
      'Dirty throttle body buildup',
      'Wiring connector corroded damaged',
      'TPS out of adjustment',
      'Electronic throttle body failing',
    ],
    symptoms: [
      'Erratic idle speed fluctuation',
      'Poor acceleration response noticed',
      'Check engine light on',
      'Engine surges at idle',
      'Hesitation when pressing pedal',
    ],
    solutions: [
      'Replace throttle position sensor',
      'Clean throttle body thoroughly',
      'Repair wiring connector corrosion',
      'Recalibrate TPS if adjustable',
      'Replace electronic throttle body',
    ],
  },
  'P0122': {
    causes: [
      'TPS signal wire shorted',
      'Throttle position sensor failed',
      'Wiring harness damage found',
      'ECM TPS circuit problem',
      'Connector pins bent damaged',
    ],
    symptoms: [
      'Engine may not accelerate',
      'Check engine light illuminated',
      'Limp mode activated vehicle',
      'Idle very low rough',
      'No throttle response sometimes',
    ],
    solutions: [
      'Inspect TPS wiring carefully',
      'Replace throttle position sensor',
      'Repair damaged wiring harness',
      'Test ECM circuit operation',
      'Fix connector pin damage',
    ],
  },
  
  // Transmission Codes
  'P0700': {
    causes: [
      'Transmission control module fault',
      'Transmission solenoid failure detected',
      'Wiring issue to transmission',
      'Low transmission fluid level',
      'Internal transmission damage present',
    ],
    symptoms: [
      'Check engine light on',
      'Transmission warning light illuminated',
      'Harsh shifting between gears',
      'Transmission slipping during acceleration',
      'Vehicle may enter limp mode',
    ],
    solutions: [
      'Scan for additional codes',
      'Check transmission fluid level',
      'Inspect transmission wiring harness',
      'Test transmission solenoids individually',
      'Service transmission if needed',
    ],
  },
  'P0730': {
    causes: [
      'Incorrect gear ratio detected',
      'Transmission clutch pack worn',
      'Solenoid not functioning properly',
      'Low transmission fluid condition',
      'Internal transmission wear damage',
    ],
    symptoms: [
      'Transmission slipping noticeably bad',
      'RPM flare between shifts',
      'Check engine light on',
      'Delayed engagement when shifting',
      'Vehicle acceleration very poor',
    ],
    solutions: [
      'Check fluid level condition',
      'Perform transmission service flush',
      'Replace worn clutch packs',
      'Test and replace solenoids',
      'Rebuild or replace transmission',
    ],
  },
  'P0741': {
    causes: [
      'Torque converter clutch stuck',
      'TCC solenoid failed open',
      'Low transmission fluid pressure',
      'Wiring to TCC damaged',
      'Valve body issue present',
    ],
    symptoms: [
      'Shudder at highway speeds',
      'Check engine light on',
      'Poor fuel economy highway',
      'Engine stalls at stops',
      'Transmission overheating warning light',
    ],
    solutions: [
      'Replace TCC solenoid assembly',
      'Check transmission fluid condition',
      'Inspect TCC wiring harness',
      'Service valve body unit',
      'Replace torque converter unit',
    ],
  },
  
  // Cooling System
  'P0115': {
    causes: [
      'Engine coolant temp sensor failed',
      'Wiring to sensor damaged',
      'Sensor connector corroded badly',
      'ECM temperature circuit failure',
      'Open circuit in wiring',
    ],
    symptoms: [
      'Engine runs rough cold',
      'Poor fuel economy constant',
      'Check engine light on',
      'Cooling fans always running',
      'Temperature gauge reads wrong',
    ],
    solutions: [
      'Replace coolant temperature sensor',
      'Repair sensor wiring damage',
      'Clean connector corrosion thoroughly',
      'Test ECM temperature circuit',
      'Check for open circuits',
    ],
  },
  'P0117': {
    causes: [
      'Coolant sensor shorted low',
      'Wiring shorted to ground',
      'Sensor internally failed shorted',
      'Connector water damage present',
      'ECM input circuit damaged',
    ],
    symptoms: [
      'Gauge reads always hot',
      'Fans run continuously constant',
      'Check engine light illuminated',
      'Engine may run rich',
      'Hard starting when warm',
    ],
    solutions: [
      'Replace coolant temperature sensor',
      'Inspect wiring for shorts',
      'Check connector for moisture',
      'Repair shorted wiring found',
      'Test ECM input circuit',
    ],
  },
  'P0125': {
    causes: [
      'Thermostat stuck open position',
      'Coolant temperature sensor faulty',
      'Low coolant level system',
      'Cooling system leak present',
      'Heater core blocked clogged',
    ],
    symptoms: [
      'Engine slow to warmup',
      'Heater blows cool air',
      'Check engine light on',
      'Poor fuel economy cold',
      'Temperature gauge reads low',
    ],
    solutions: [
      'Replace thermostat assembly unit',
      'Test coolant temperature sensor',
      'Top off coolant level',
      'Fix cooling system leak',
      'Flush heater core passages',
    ],
  },
  
  // ABS System (Chassis Codes)
  'C0035': {
    causes: [
      'Left front wheel sensor failed',
      'Sensor wiring damaged broken',
      'Wheel bearing excessive play',
      'Sensor tone ring damaged',
      'ABS module circuit failure',
    ],
    symptoms: [
      'ABS warning light on',
      'ABS not functioning properly',
      'Traction control light illuminated',
      'Brake pedal pulsation abnormal',
      'Stability control warning light',
    ],
    solutions: [
      'Replace wheel speed sensor',
      'Repair sensor wiring damage',
      'Replace wheel bearing assembly',
      'Inspect tone ring condition',
      'Test ABS module function',
    ],
  },
  'C0040': {
    causes: [
      'Right front sensor malfunction',
      'Wiring harness damage sensor',
      'Tone ring cracked broken',
      'Sensor air gap incorrect',
      'ABS module input failure',
    ],
    symptoms: [
      'ABS light stays on',
      'No ABS function available',
      'Traction control disabled now',
      'Brake warning light on',
      'ESC system not working',
    ],
    solutions: [
      'Install new wheel sensor',
      'Repair damaged sensor wiring',
      'Replace damaged tone ring',
      'Adjust sensor gap properly',
      'Diagnose ABS module issue',
    ],
  },
  'C0045': {
    causes: [
      'Left rear wheel sensor bad',
      'Sensor connector disconnected loose',
      'Rear wheel bearing worn',
      'Wiring open or shorted',
      'Sensor mounting incorrect loose',
    ],
    symptoms: [
      'ABS warning light illuminated',
      'Rear ABS not functioning',
      'Traction control light on',
      'Parking brake warning sometimes',
      'Stability system disabled message',
    ],
    solutions: [
      'Replace left rear sensor',
      'Secure sensor connector properly',
      'Replace rear wheel bearing',
      'Repair wiring open short',
      'Properly mount sensor securely',
    ],
  },
  'C0050': {
    causes: [
      'Right rear sensor failed',
      'Sensor circuit open detected',
      'Tone ring damaged missing teeth',
      'Excessive wheel bearing play',
      'Sensor contaminated with debris',
    ],
    symptoms: [
      'ABS light stays illuminated',
      'Rear brake ABS inoperative',
      'Traction light warning on',
      'Stability control not available',
      'Abnormal brake feel sometimes',
    ],
    solutions: [
      'Install new sensor unit',
      'Check and repair wiring',
      'Replace damaged tone ring',
      'Service wheel bearing assembly',
      'Clean sensor face thoroughly',
    ],
  },
  
  // Body Codes
  'B1601': {
    causes: [
      'Ignition key not programmed',
      'PATS transceiver module failed',
      'Key transponder chip damaged',
      'Wiring to PATS damaged',
      'Instrument cluster communication lost',
    ],
    symptoms: [
      'Engine cranks wont start',
      'Security light flashing rapidly',
      'Theft light stays on',
      'Key not recognized message',
      'Intermittent starting problems occur',
    ],
    solutions: [
      'Reprogram key to vehicle',
      'Replace PATS transceiver module',
      'Get new programmed key',
      'Repair PATS wiring damage',
      'Check instrument cluster communication',
    ],
  },
  'B1681': {
    causes: [
      'PATS transceiver signal weak',
      'Key transponder battery dead',
      'Antenna ring around ignition damaged',
      'Module communication failure present',
      'Aftermarket key not compatible',
    ],
    symptoms: [
      'Intermittent no start condition',
      'Security light flashing sometimes',
      'Key works occasionally only',
      'Multiple key attempts needed',
      'Theft deterrent system active',
    ],
    solutions: [
      'Replace PATS antenna ring',
      'Replace key fob battery',
      'Reprogram all vehicle keys',
      'Update PATS module software',
      'Use OEM key only',
    ],
  },
  'B2680': {
    causes: [
      'Instrument cluster internal fault',
      'IPC communication bus failure',
      'Software corruption in cluster',
      'Power supply to IPC unstable',
      'Ground connection poor cluster',
    ],
    symptoms: [
      'Gauges acting erratically randomly',
      'Warning lights come on randomly',
      'Display shows incorrect information',
      'Odometer reading incorrect sometimes',
      'Fuel gauge reads wrong',
    ],
    solutions: [
      'Reset instrument cluster module',
      'Check IPC power supply',
      'Repair ground connection secure',
      'Reprogram cluster if possible',
      'Replace instrument cluster unit',
    ],
  },
  
  // Network Communication Codes
  'U0100': {
    causes: [
      'ECM not communicating bus',
      'CAN bus wiring damage',
      'ECM power supply failure',
      'Ground circuit open ECM',
      'ECM internal failure detected',
    ],
    symptoms: [
      'Multiple warning lights on',
      'Engine may not start',
      'No communication with ECM',
      'Various systems not working',
      'Check engine light illuminated',
    ],
    solutions: [
      'Check ECM power grounds',
      'Inspect CAN bus wiring',
      'Test ECM communication circuit',
      'Repair damaged CAN wires',
      'Replace ECM if necessary',
    ],
  },
  'U0101': {
    causes: [
      'TCM lost communication bus',
      'Transmission module powered off',
      'CAN bus fault transmission',
      'TCM internal failure present',
      'Wiring damage to TCM',
    ],
    symptoms: [
      'Transmission warning light on',
      'No communication with TCM',
      'Harsh shifting may occur',
      'Limp mode engaged transmission',
      'Multiple codes stored system',
    ],
    solutions: [
      'Check TCM power supply',
      'Inspect transmission wiring harness',
      'Test CAN bus continuity',
      'Reset TCM communication link',
      'Replace TCM if failed',
    ],
  },
  'U0121': {
    causes: [
      'ABS module communication lost',
      'ABS module power failure',
      'CAN bus wiring issue',
      'ABS module internally failed',
      'Ground circuit problem ABS',
    ],
    symptoms: [
      'ABS warning light on',
      'Traction control light on',
      'No ABS communication found',
      'Stability control disabled message',
      'Multiple network codes stored',
    ],
    solutions: [
      'Check ABS module power',
      'Inspect ABS wiring harness',
      'Test CAN bus network',
      'Check ground connections ABS',
      'Replace ABS module unit',
    ],
  },
  'U0140': {
    causes: [
      'BCM lost communication network',
      'Body control module failed',
      'CAN bus wiring damaged',
      'BCM power supply issue',
      'Ground connection poor BCM',
    ],
    symptoms: [
      'Interior lights malfunction random',
      'Door locks not working',
      'Windows inoperative sometimes now',
      'Multiple warning lights displayed',
      'Remote keyless entry failed',
    ],
    solutions: [
      'Check BCM power supply',
      'Inspect BCM wiring carefully',
      'Test CAN network integrity',
      'Repair BCM ground connection',
      'Replace BCM if necessary',
    ],
  },
};

/**
 * Get comprehensive DTC knowledge (causes, symptoms, solutions)
 * Returns generic information if specific code not found
 */
export function getDTCKnowledge(code: string): DTCKnowledge {
  const upperCode = code.toUpperCase();
  
  // Check if we have specific knowledge for this code
  if (DTC_KNOWLEDGE_BASE[upperCode]) {
    return DTC_KNOWLEDGE_BASE[upperCode];
  }
  
  // Generate generic knowledge based on code type
  return generateGenericKnowledge(upperCode);
}

/**
 * Generate generic causes, symptoms, and solutions based on DTC category
 */
function generateGenericKnowledge(code: string): DTCKnowledge {
  const category = code[0];
  
  switch (category) {
    case 'P':
      return {
        causes: [
          'Sensor malfunction or failure',
          'Wiring harness damage found',
          'Control module circuit issue',
          'Component wear or aging',
          'Electrical connection problem loose',
        ],
        symptoms: [
          'Check engine light illuminated',
          'Engine performance may decrease',
          'Possible rough running condition',
          'Fuel economy may decrease',
          'Drivability issues may occur',
        ],
        solutions: [
          'Diagnose with professional scanner',
          'Inspect related wiring harness',
          'Test sensor with multimeter',
          'Check connector for corrosion',
          'Replace faulty component found',
        ],
      };
    case 'B':
      return {
        causes: [
          'Body control module issue',
          'Wiring short or open',
          'Sensor or switch failed',
          'Communication network fault detected',
          'Module programming error present',
        ],
        symptoms: [
          'Warning light on dashboard',
          'Accessory function may fail',
          'Intermittent electrical issues noticed',
          'Interior features not working',
          'Display messages may appear',
        ],
        solutions: [
          'Scan for related codes',
          'Check module power supply',
          'Inspect wiring connections carefully',
          'Test related switches sensors',
          'Reprogram module if needed',
        ],
      };
    case 'C':
      return {
        causes: [
          'Wheel speed sensor failure',
          'ABS hydraulic unit problem',
          'Brake system component worn',
          'Wiring damage brake system',
          'Control module malfunction detected',
        ],
        symptoms: [
          'ABS warning light on',
          'Traction control light illuminated',
          'Stability control may disable',
          'Abnormal brake pedal feel',
          'Braking performance may change',
        ],
        solutions: [
          'Inspect wheel speed sensors',
          'Check brake fluid level',
          'Test ABS module function',
          'Repair damaged wiring found',
          'Service brake components needed',
        ],
      };
    case 'U':
      return {
        causes: [
          'CAN bus wiring fault',
          'Module communication failure detected',
          'Control module power issue',
          'Ground circuit problem found',
          'Network termination resistor failed',
        ],
        symptoms: [
          'Multiple warning lights displayed',
          'Various systems may fail',
          'Communication errors stored memory',
          'Intermittent system malfunctions occur',
          'Diagnostic trouble accessing modules',
        ],
        solutions: [
          'Check CAN bus wiring',
          'Test module power grounds',
          'Inspect network connections thoroughly',
          'Scan all modules codes',
          'Repair communication network issues',
        ],
      };
    default:
      return {
        causes: [
          'Unknown system malfunction detected',
          'Sensor or component failure',
          'Wiring or connection issue',
          'Control module problem present',
          'Diagnostic needed for clarity',
        ],
        symptoms: [
          'Warning light may illuminate',
          'System may not function',
          'Performance issues possible now',
          'Further diagnosis recommended strongly',
          'Professional inspection needed soon',
        ],
        solutions: [
          'Professional diagnosis recommended immediately',
          'Scan for additional codes',
          'Inspect related components thoroughly',
          'Check wiring and connectors',
          'Consult technical service information',
        ],
      };
  }
}
