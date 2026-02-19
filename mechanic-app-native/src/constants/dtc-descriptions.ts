/**
 * Comprehensive OBD-II DTC Descriptions Database
 * 
 * This file contains standard SAE J2012 DTC codes and their descriptions.
 * 
 * Code Categories:
 * - P0xxx: Powertrain - Generic (SAE)
 * - P1xxx: Powertrain - Manufacturer Specific
 * - P2xxx: Powertrain - Generic (SAE)
 * - P3xxx: Powertrain - Manufacturer Specific / Generic (depending on code)
 * - B0xxx: Body - Generic
 * - B1xxx: Body - Manufacturer Specific
 * - B2xxx: Body - Manufacturer Specific
 * - B3xxx: Body - Reserved
 * - C0xxx: Chassis - Generic
 * - C1xxx: Chassis - Manufacturer Specific
 * - C2xxx: Chassis - Manufacturer Specific
 * - C3xxx: Chassis - Reserved
 * - U0xxx: Network - Generic
 * - U1xxx: Network - Manufacturer Specific
 * - U2xxx: Network - Manufacturer Specific
 * - U3xxx: Network - Reserved
 */

export const DTC_DESCRIPTIONS: Record<string, string> = {
  // ============================================
  // P0xxx - Powertrain Generic Codes
  // ============================================
  
  // Fuel and Air Metering (P00xx-P0099)
  'P0001': 'Fuel Volume Regulator Control Circuit/Open',
  'P0002': 'Fuel Volume Regulator Control Circuit Range/Performance',
  'P0003': 'Fuel Volume Regulator Control Circuit Low',
  'P0004': 'Fuel Volume Regulator Control Circuit High',
  'P0005': 'Fuel Shutoff Valve Control Circuit/Open',
  'P0006': 'Fuel Shutoff Valve Control Circuit Low',
  'P0007': 'Fuel Shutoff Valve Control Circuit High',
  'P0008': 'Engine Position System Performance (Bank 1)',
  'P0009': 'Engine Position System Performance (Bank 2)',
  'P0010': 'A Camshaft Position Actuator Circuit (Bank 1)',
  'P0011': 'A Camshaft Position Timing Over-Advanced (Bank 1)',
  'P0012': 'A Camshaft Position Timing Over-Retarded (Bank 1)',
  'P0013': 'B Camshaft Position Actuator Circuit (Bank 1)',
  'P0014': 'B Camshaft Position Timing Over-Advanced (Bank 1)',
  'P0015': 'B Camshaft Position Timing Over-Retarded (Bank 1)',
  'P0016': 'Crankshaft Position - Camshaft Position Correlation (Bank 1 Sensor A)',
  'P0017': 'Crankshaft Position - Camshaft Position Correlation (Bank 1 Sensor B)',
  'P0018': 'Crankshaft Position - Camshaft Position Correlation (Bank 2 Sensor A)',
  'P0019': 'Crankshaft Position - Camshaft Position Correlation (Bank 2 Sensor B)',
  'P001A': 'A Camshaft Position Slow Response (Bank 1)',
  'P001B': 'A Camshaft Position Slow Response (Bank 2)',
  'P001C': 'B Camshaft Position Slow Response (Bank 1)',
  'P001D': 'B Camshaft Position Slow Response (Bank 2)',
  'P001E': 'A Camshaft Position Position Not Reached (Bank 1)',
  'P001F': 'A Camshaft Position Position Not Reached (Bank 2)',
  'P0020': 'A Camshaft Position Actuator Circuit (Bank 2)',
  'P0021': 'A Camshaft Position Timing Over-Advanced (Bank 2)',
  'P0022': 'A Camshaft Position Timing Over-Retarded (Bank 2)',
  'P0023': 'B Camshaft Position Actuator Circuit (Bank 2)',
  'P0024': 'B Camshaft Position Timing Over-Advanced (Bank 2)',
  'P0025': 'B Camshaft Position Timing Over-Retarded (Bank 2)',
  'P0026': 'Intake Valve Control Solenoid Range/Performance (Bank 1)',
  'P0027': 'Exhaust Valve Control Solenoid Range/Performance (Bank 1)',
  'P0028': 'Intake Valve Control Solenoid Range/Performance (Bank 2)',
  'P0029': 'Exhaust Valve Control Solenoid Range/Performance (Bank 2)',
  'P002A': 'B Camshaft Position Exceeded Learning Limit (Bank 1)',
  'P002B': 'B Camshaft Position Exceeded Learning Limit (Bank 2)',
  'P002C': 'A Camshaft Position Exceeded Learning Limit (Bank 1)',
  'P002D': 'A Camshaft Position Exceeded Learning Limit (Bank 2)',
  'P002E': 'Intake Manifold Tuning Valve Position Sensor/Switch (Bank 1)',
  'P002F': 'Intake Manifold Tuning Valve Position Sensor/Switch (Bank 2)',
  'P0030': 'HO2S Heater Control Circuit (Bank 1 Sensor 1)',
  'P0031': 'HO2S Heater Control Circuit Low (Bank 1 Sensor 1)',
  'P0032': 'HO2S Heater Control Circuit High (Bank 1 Sensor 1)',
  'P0033': 'Turbo Charger Bypass Valve Control Circuit',
  'P0034': 'Turbo Charger Bypass Valve Control Circuit Low',
  'P0035': 'Turbo Charger Bypass Valve Control Circuit High',
  'P0036': 'HO2S Heater Control Circuit (Bank 1 Sensor 2)',
  'P0037': 'HO2S Heater Control Circuit Low (Bank 1 Sensor 2)',
  'P0038': 'HO2S Heater Control Circuit High (Bank 1 Sensor 2)',
  'P0039': 'Turbo/Super Charger Bypass Valve Control Circuit Range/Performance',
  'P0040': 'O2 Sensor Signals Swapped Bank 1 Sensor 1/ Bank 2 Sensor 1',
  'P0041': 'O2 Sensor Signals Swapped Bank 1 Sensor 2/ Bank 2 Sensor 2',
  'P0042': 'HO2S Heater Control Circuit (Bank 1 Sensor 3)',
  'P0043': 'HO2S Heater Control Circuit Low (Bank 1 Sensor 3)',
  'P0044': 'HO2S Heater Control Circuit High (Bank 1 Sensor 3)',
  'P0045': 'Turbo/Super Charger Boost Control Solenoid Circuit/Open',
  'P0046': 'Turbo/Super Charger Boost Control Solenoid Circuit Range/Performance',
  'P0047': 'Turbo/Super Charger Boost Control Solenoid Circuit Low',
  'P0048': 'Turbo/Super Charger Boost Control Solenoid Circuit High',
  'P0049': 'Turbo/Super Charger Turbine Overspeed',
  'P0050': 'HO2S Heater Control Circuit (Bank 2 Sensor 1)',
  'P0051': 'HO2S Heater Control Circuit Low (Bank 2 Sensor 1)',
  'P0052': 'HO2S Heater Control Circuit High (Bank 2 Sensor 1)',
  'P0053': 'HO2S Heater Resistance (Bank 1 Sensor 1)',
  'P0054': 'HO2S Heater Resistance (Bank 1 Sensor 2)',
  'P0055': 'HO2S Heater Resistance (Bank 1 Sensor 3)',
  'P0056': 'HO2S Heater Control Circuit (Bank 2 Sensor 2)',
  'P0057': 'HO2S Heater Control Circuit Low (Bank 2 Sensor 2)',
  'P0058': 'HO2S Heater Control Circuit High (Bank 2 Sensor 2)',
  'P0059': 'HO2S Heater Resistance (Bank 2 Sensor 1)',
  'P0060': 'HO2S Heater Resistance (Bank 2 Sensor 2)',
  'P0061': 'HO2S Heater Resistance (Bank 2 Sensor 3)',
  'P0062': 'HO2S Heater Control Circuit (Bank 2 Sensor 3)',
  'P0063': 'HO2S Heater Control Circuit Low (Bank 2 Sensor 3)',
  'P0064': 'HO2S Heater Control Circuit High (Bank 2 Sensor 3)',
  'P0065': 'Air Assisted Injector Control Range/Performance',
  'P0066': 'Air Assisted Injector Control Circuit Low',
  'P0067': 'Air Assisted Injector Control Circuit High',
  'P0068': 'MAP/MAF - Throttle Position Correlation',
  'P0069': 'Manifold Absolute Pressure - Barometric Pressure Correlation',
  'P0070': 'Ambient Air Temperature Sensor Circuit',
  'P0071': 'Ambient Air Temperature Sensor Range/Performance',
  'P0072': 'Ambient Air Temperature Sensor Circuit Low',
  'P0073': 'Ambient Air Temperature Sensor Circuit High',
  'P0074': 'Ambient Air Temperature Sensor Circuit Intermittent',
  'P0075': 'Intake Valve Control Solenoid Circuit (Bank 1)',
  'P0076': 'Intake Valve Control Solenoid Circuit Low (Bank 1)',
  'P0077': 'Intake Valve Control Solenoid Circuit High (Bank 1)',
  'P0078': 'Exhaust Valve Control Solenoid Circuit (Bank 1)',
  'P0079': 'Exhaust Valve Control Solenoid Circuit Low (Bank 1)',
  'P0080': 'Exhaust Valve Control Solenoid Circuit High (Bank 1)',
  'P0081': 'Intake Valve Control Solenoid Circuit (Bank 2)',
  'P0082': 'Intake Valve Control Solenoid Circuit Low (Bank 2)',
  'P0083': 'Intake Valve Control Solenoid Circuit High (Bank 2)',
  'P0084': 'Exhaust Valve Control Solenoid Circuit (Bank 2)',
  'P0085': 'Exhaust Valve Control Solenoid Circuit Low (Bank 2)',
  'P0086': 'Exhaust Valve Control Solenoid Circuit High (Bank 2)',
  
  // Mass Air Flow / Volume Air Flow (P0100-P0109)
  'P0100': 'Mass or Volume Air Flow Circuit',
  'P0101': 'Mass or Volume Air Flow Circuit Range/Performance',
  'P0102': 'Mass or Volume Air Flow Circuit Low Input',
  'P0103': 'Mass or Volume Air Flow Circuit High Input',
  'P0104': 'Mass or Volume Air Flow Circuit Intermittent',
  'P0105': 'Manifold Absolute Pressure/Barometric Pressure Circuit',
  'P0106': 'Manifold Absolute Pressure/Barometric Pressure Circuit Range/Performance',
  'P0107': 'Manifold Absolute Pressure/Barometric Pressure Circuit Low Input',
  'P0108': 'Manifold Absolute Pressure/Barometric Pressure Circuit High Input',
  'P0109': 'Manifold Absolute Pressure/Barometric Pressure Circuit Intermittent',
  
  // Intake Air Temperature (P0110-P0119)
  'P0110': 'Intake Air Temperature Sensor 1 Circuit',
  'P0111': 'Intake Air Temperature Sensor 1 Circuit Range/Performance',
  'P0112': 'Intake Air Temperature Sensor 1 Circuit Low',
  'P0113': 'Intake Air Temperature Sensor 1 Circuit High',
  'P0114': 'Intake Air Temperature Sensor 1 Circuit Intermittent',
  'P0115': 'Engine Coolant Temperature Circuit',
  'P0116': 'Engine Coolant Temperature Circuit Range/Performance',
  'P0117': 'Engine Coolant Temperature Circuit Low',
  'P0118': 'Engine Coolant Temperature Circuit High',
  'P0119': 'Engine Coolant Temperature Circuit Intermittent',
  
  // Throttle/Pedal Position Sensor (P0120-P0129)
  'P0120': 'Throttle/Pedal Position Sensor/Switch A Circuit',
  'P0121': 'Throttle/Pedal Position Sensor/Switch A Circuit Range/Performance',
  'P0122': 'Throttle/Pedal Position Sensor/Switch A Circuit Low',
  'P0123': 'Throttle/Pedal Position Sensor/Switch A Circuit High',
  'P0124': 'Throttle/Pedal Position Sensor/Switch A Circuit Intermittent',
  'P0125': 'Insufficient Coolant Temperature for Closed Loop Fuel Control',
  'P0126': 'Insufficient Coolant Temperature for Stable Operation',
  'P0127': 'Intake Air Temperature Too High',
  'P0128': 'Coolant Thermostat (Coolant Temperature Below Thermostat Regulating Temperature)',
  'P0129': 'Barometric Pressure Too Low',
  
  // O2 Sensors (P0130-P0167)
  'P0130': 'O2 Sensor Circuit (Bank 1 Sensor 1)',
  'P0131': 'O2 Sensor Circuit Low Voltage (Bank 1 Sensor 1)',
  'P0132': 'O2 Sensor Circuit High Voltage (Bank 1 Sensor 1)',
  'P0133': 'O2 Sensor Circuit Slow Response (Bank 1 Sensor 1)',
  'P0134': 'O2 Sensor Circuit No Activity Detected (Bank 1 Sensor 1)',
  'P0135': 'O2 Sensor Heater Circuit (Bank 1 Sensor 1)',
  'P0136': 'O2 Sensor Circuit (Bank 1 Sensor 2)',
  'P0137': 'O2 Sensor Circuit Low Voltage (Bank 1 Sensor 2)',
  'P0138': 'O2 Sensor Circuit High Voltage (Bank 1 Sensor 2)',
  'P0139': 'O2 Sensor Circuit Slow Response (Bank 1 Sensor 2)',
  'P0140': 'O2 Sensor Circuit No Activity Detected (Bank 1 Sensor 2)',
  'P0141': 'O2 Sensor Heater Circuit (Bank 1 Sensor 2)',
  'P0142': 'O2 Sensor Circuit (Bank 1 Sensor 3)',
  'P0143': 'O2 Sensor Circuit Low Voltage (Bank 1 Sensor 3)',
  'P0144': 'O2 Sensor Circuit High Voltage (Bank 1 Sensor 3)',
  'P0145': 'O2 Sensor Circuit Slow Response (Bank 1 Sensor 3)',
  'P0146': 'O2 Sensor Circuit No Activity Detected (Bank 1 Sensor 3)',
  'P0147': 'O2 Sensor Heater Circuit (Bank 1 Sensor 3)',
  'P0150': 'O2 Sensor Circuit (Bank 2 Sensor 1)',
  'P0151': 'O2 Sensor Circuit Low Voltage (Bank 2 Sensor 1)',
  'P0152': 'O2 Sensor Circuit High Voltage (Bank 2 Sensor 1)',
  'P0153': 'O2 Sensor Circuit Slow Response (Bank 2 Sensor 1)',
  'P0154': 'O2 Sensor Circuit No Activity Detected (Bank 2 Sensor 1)',
  'P0155': 'O2 Sensor Heater Circuit (Bank 2 Sensor 1)',
  'P0156': 'O2 Sensor Circuit (Bank 2 Sensor 2)',
  'P0157': 'O2 Sensor Circuit Low Voltage (Bank 2 Sensor 2)',
  'P0158': 'O2 Sensor Circuit High Voltage (Bank 2 Sensor 2)',
  'P0159': 'O2 Sensor Circuit Slow Response (Bank 2 Sensor 2)',
  'P0160': 'O2 Sensor Circuit No Activity Detected (Bank 2 Sensor 2)',
  'P0161': 'O2 Sensor Heater Circuit (Bank 2 Sensor 2)',
  'P0162': 'O2 Sensor Circuit (Bank 2 Sensor 3)',
  'P0163': 'O2 Sensor Circuit Low Voltage (Bank 2 Sensor 3)',
  'P0164': 'O2 Sensor Circuit High Voltage (Bank 2 Sensor 3)',
  'P0165': 'O2 Sensor Circuit Slow Response (Bank 2 Sensor 3)',
  'P0166': 'O2 Sensor Circuit No Activity Detected (Bank 2 Sensor 3)',
  'P0167': 'O2 Sensor Heater Circuit (Bank 2 Sensor 3)',
  
  // Fuel System (P0170-P0199)
  'P0170': 'Fuel Trim (Bank 1)',
  'P0171': 'System Too Lean (Bank 1)',
  'P0172': 'System Too Rich (Bank 1)',
  'P0173': 'Fuel Trim (Bank 2)',
  'P0174': 'System Too Lean (Bank 2)',
  'P0175': 'System Too Rich (Bank 2)',
  'P0176': 'Fuel Composition Sensor Circuit',
  'P0177': 'Fuel Composition Sensor Circuit Range/Performance',
  'P0178': 'Fuel Composition Sensor Circuit Low',
  'P0179': 'Fuel Composition Sensor Circuit High',
  'P0180': 'Fuel Temperature Sensor A Circuit',
  'P0181': 'Fuel Temperature Sensor A Circuit Range/Performance',
  'P0182': 'Fuel Temperature Sensor A Circuit Low',
  'P0183': 'Fuel Temperature Sensor A Circuit High',
  'P0184': 'Fuel Temperature Sensor A Circuit Intermittent',
  'P0185': 'Fuel Temperature Sensor B Circuit',
  'P0186': 'Fuel Temperature Sensor B Circuit Range/Performance',
  'P0187': 'Fuel Temperature Sensor B Circuit Low',
  'P0188': 'Fuel Temperature Sensor B Circuit High',
  'P0189': 'Fuel Temperature Sensor B Circuit Intermittent',
  'P0190': 'Fuel Rail Pressure Sensor Circuit',
  'P0191': 'Fuel Rail Pressure Sensor Circuit Range/Performance',
  'P0192': 'Fuel Rail Pressure Sensor Circuit Low',
  'P0193': 'Fuel Rail Pressure Sensor Circuit High',
  'P0194': 'Fuel Rail Pressure Sensor Circuit Intermittent',
  'P0195': 'Engine Oil Temperature Sensor',
  'P0196': 'Engine Oil Temperature Sensor Range/Performance',
  'P0197': 'Engine Oil Temperature Sensor Low',
  'P0198': 'Engine Oil Temperature Sensor High',
  'P0199': 'Engine Oil Temperature Sensor Intermittent',
  
  // Injector Circuit (P0200-P0299)
  'P0200': 'Injector Circuit',
  'P0201': 'Injector Circuit - Cylinder 1',
  'P0202': 'Injector Circuit - Cylinder 2',
  'P0203': 'Injector Circuit - Cylinder 3',
  'P0204': 'Injector Circuit - Cylinder 4',
  'P0205': 'Injector Circuit - Cylinder 5',
  'P0206': 'Injector Circuit - Cylinder 6',
  'P0207': 'Injector Circuit - Cylinder 7',
  'P0208': 'Injector Circuit - Cylinder 8',
  'P0209': 'Injector Circuit - Cylinder 9',
  'P0210': 'Injector Circuit - Cylinder 10',
  'P0211': 'Injector Circuit - Cylinder 11',
  'P0212': 'Injector Circuit - Cylinder 12',
  'P0213': 'Cold Start Injector 1',
  'P0214': 'Cold Start Injector 2',
  'P0215': 'Engine Shutoff Solenoid',
  'P0216': 'Injection Timing Control Circuit',
  'P0217': 'Engine Coolant Over Temperature Condition',
  'P0218': 'Transmission Fluid Over Temperature Condition',
  'P0219': 'Engine Overspeed Condition',
  'P0220': 'Throttle/Pedal Position Sensor/Switch B Circuit',
  'P0221': 'Throttle/Pedal Position Sensor/Switch B Circuit Range/Performance',
  'P0222': 'Throttle/Pedal Position Sensor/Switch B Circuit Low',
  'P0223': 'Throttle/Pedal Position Sensor/Switch B Circuit High',
  'P0224': 'Throttle/Pedal Position Sensor/Switch B Circuit Intermittent',
  'P0225': 'Throttle/Pedal Position Sensor/Switch C Circuit',
  'P0226': 'Throttle/Pedal Position Sensor/Switch C Circuit Range/Performance',
  'P0227': 'Throttle/Pedal Position Sensor/Switch C Circuit Low',
  'P0228': 'Throttle/Pedal Position Sensor/Switch C Circuit High',
  'P0229': 'Throttle/Pedal Position Sensor/Switch C Circuit Intermittent',
  'P0230': 'Fuel Pump Primary Circuit',
  'P0231': 'Fuel Pump Secondary Circuit Low',
  'P0232': 'Fuel Pump Secondary Circuit High',
  'P0233': 'Fuel Pump Secondary Circuit Intermittent',
  'P0234': 'Turbo/Super Charger Overboost Condition',
  'P0235': 'Turbo/Super Charger Boost Sensor A Circuit',
  'P0236': 'Turbo/Super Charger Boost Sensor A Circuit Range/Performance',
  'P0237': 'Turbo/Super Charger Boost Sensor A Circuit Low',
  'P0238': 'Turbo/Super Charger Boost Sensor A Circuit High',
  'P0239': 'Turbo/Super Charger Boost Sensor B Circuit',
  'P0240': 'Turbo/Super Charger Boost Sensor B Circuit Range/Performance',
  'P0241': 'Turbo/Super Charger Boost Sensor B Circuit Low',
  'P0242': 'Turbo/Super Charger Boost Sensor B Circuit High',
  'P0243': 'Turbo/Super Charger Wastegate Solenoid A',
  'P0244': 'Turbo/Super Charger Wastegate Solenoid A Range/Performance',
  'P0245': 'Turbo/Super Charger Wastegate Solenoid A Low',
  'P0246': 'Turbo/Super Charger Wastegate Solenoid A High',
  'P0247': 'Turbo/Super Charger Wastegate Solenoid B',
  'P0248': 'Turbo/Super Charger Wastegate Solenoid B Range/Performance',
  'P0249': 'Turbo/Super Charger Wastegate Solenoid B Low',
  'P0250': 'Turbo/Super Charger Wastegate Solenoid B High',
  'P0251': 'Injection Pump Fuel Metering Control A (Cam/Rotor/Injector)',
  'P0252': 'Injection Pump Fuel Metering Control A Range/Performance',
  'P0253': 'Injection Pump Fuel Metering Control A Low',
  'P0254': 'Injection Pump Fuel Metering Control A High',
  'P0255': 'Injection Pump Fuel Metering Control A Intermittent',
  'P0256': 'Injection Pump Fuel Metering Control B (Cam/Rotor/Injector)',
  'P0257': 'Injection Pump Fuel Metering Control B Range/Performance',
  'P0258': 'Injection Pump Fuel Metering Control B Low',
  'P0259': 'Injection Pump Fuel Metering Control B High',
  'P0260': 'Injection Pump Fuel Metering Control B Intermittent',
  'P0261': 'Cylinder 1 Injector Circuit Low',
  'P0262': 'Cylinder 1 Injector Circuit High',
  'P0263': 'Cylinder 1 Contribution/Balance',
  'P0264': 'Cylinder 2 Injector Circuit Low',
  'P0265': 'Cylinder 2 Injector Circuit High',
  'P0266': 'Cylinder 2 Contribution/Balance',
  'P0267': 'Cylinder 3 Injector Circuit Low',
  'P0268': 'Cylinder 3 Injector Circuit High',
  'P0269': 'Cylinder 3 Contribution/Balance',
  'P0270': 'Cylinder 4 Injector Circuit Low',
  'P0271': 'Cylinder 4 Injector Circuit High',
  'P0272': 'Cylinder 4 Contribution/Balance',
  'P0273': 'Cylinder 5 Injector Circuit Low',
  'P0274': 'Cylinder 5 Injector Circuit High',
  'P0275': 'Cylinder 5 Contribution/Balance',
  'P0276': 'Cylinder 6 Injector Circuit Low',
  'P0277': 'Cylinder 6 Injector Circuit High',
  'P0278': 'Cylinder 6 Contribution/Balance',
  'P0279': 'Cylinder 7 Injector Circuit Low',
  'P0280': 'Cylinder 7 Injector Circuit High',
  'P0281': 'Cylinder 7 Contribution/Balance',
  'P0282': 'Cylinder 8 Injector Circuit Low',
  'P0283': 'Cylinder 8 Injector Circuit High',
  'P0284': 'Cylinder 8 Contribution/Balance',
  
  // Misfire Codes (P0300-P0399)
  'P0300': 'Random/Multiple Cylinder Misfire Detected',
  'P0301': 'Cylinder 1 Misfire Detected',
  'P0302': 'Cylinder 2 Misfire Detected',
  'P0303': 'Cylinder 3 Misfire Detected',
  'P0304': 'Cylinder 4 Misfire Detected',
  'P0305': 'Cylinder 5 Misfire Detected',
  'P0306': 'Cylinder 6 Misfire Detected',
  'P0307': 'Cylinder 7 Misfire Detected',
  'P0308': 'Cylinder 8 Misfire Detected',
  'P0309': 'Cylinder 9 Misfire Detected',
  'P0310': 'Cylinder 10 Misfire Detected',
  'P0311': 'Cylinder 11 Misfire Detected',
  'P0312': 'Cylinder 12 Misfire Detected',
  'P0313': 'Misfire Detected with Low Fuel',
  'P0314': 'Single Cylinder Misfire (Cylinder Not Specified)',
  'P0315': 'Crankshaft Position System Variation Not Learned',
  'P0316': 'Engine Misfire Detected on Startup (First 1000 Revolutions)',
  'P0317': 'Rough Road Hardware Not Present',
  'P0318': 'Rough Road Sensor A Signal Circuit',
  'P0319': 'Rough Road Sensor B',
  'P0320': 'Ignition/Distributor Engine Speed Input Circuit',
  'P0321': 'Ignition/Distributor Engine Speed Input Circuit Range/Performance',
  'P0322': 'Ignition/Distributor Engine Speed Input Circuit No Signal',
  'P0323': 'Ignition/Distributor Engine Speed Input Circuit Intermittent',
  'P0324': 'Knock Control System Error',
  'P0325': 'Knock Sensor 1 Circuit (Bank 1 or Single Sensor)',
  'P0326': 'Knock Sensor 1 Circuit Range/Performance (Bank 1)',
  'P0327': 'Knock Sensor 1 Circuit Low (Bank 1)',
  'P0328': 'Knock Sensor 1 Circuit High (Bank 1)',
  'P0329': 'Knock Sensor 1 Circuit Intermittent (Bank 1)',
  'P0330': 'Knock Sensor 2 Circuit (Bank 2)',
  'P0331': 'Knock Sensor 2 Circuit Range/Performance (Bank 2)',
  'P0332': 'Knock Sensor 2 Circuit Low (Bank 2)',
  'P0333': 'Knock Sensor 2 Circuit High (Bank 2)',
  'P0334': 'Knock Sensor 2 Circuit Intermittent (Bank 2)',
  'P0335': 'Crankshaft Position Sensor A Circuit',
  'P0336': 'Crankshaft Position Sensor A Circuit Range/Performance',
  'P0337': 'Crankshaft Position Sensor A Circuit Low',
  'P0338': 'Crankshaft Position Sensor A Circuit High',
  'P0339': 'Crankshaft Position Sensor A Circuit Intermittent',
  'P0340': 'Camshaft Position Sensor A Circuit (Bank 1 or Single Sensor)',
  'P0341': 'Camshaft Position Sensor A Circuit Range/Performance (Bank 1)',
  'P0342': 'Camshaft Position Sensor A Circuit Low (Bank 1)',
  'P0343': 'Camshaft Position Sensor A Circuit High (Bank 1)',
  'P0344': 'Camshaft Position Sensor A Circuit Intermittent (Bank 1)',
  'P0345': 'Camshaft Position Sensor A Circuit (Bank 2)',
  'P0346': 'Camshaft Position Sensor A Circuit Range/Performance (Bank 2)',
  'P0347': 'Camshaft Position Sensor A Circuit Low (Bank 2)',
  'P0348': 'Camshaft Position Sensor A Circuit High (Bank 2)',
  'P0349': 'Camshaft Position Sensor A Circuit Intermittent (Bank 2)',
  'P0350': 'Ignition Coil Primary/Secondary Circuit',
  'P0351': 'Ignition Coil A Primary/Secondary Circuit',
  'P0352': 'Ignition Coil B Primary/Secondary Circuit',
  'P0353': 'Ignition Coil C Primary/Secondary Circuit',
  'P0354': 'Ignition Coil D Primary/Secondary Circuit',
  'P0355': 'Ignition Coil E Primary/Secondary Circuit',
  'P0356': 'Ignition Coil F Primary/Secondary Circuit',
  'P0357': 'Ignition Coil G Primary/Secondary Circuit',
  'P0358': 'Ignition Coil H Primary/Secondary Circuit',
  'P0359': 'Ignition Coil I Primary/Secondary Circuit',
  'P0360': 'Ignition Coil J Primary/Secondary Circuit',
  'P0361': 'Ignition Coil K Primary/Secondary Circuit',
  'P0362': 'Ignition Coil L Primary/Secondary Circuit',
  
  // EGR and Secondary Air (P0400-P0499)
  'P0400': 'Exhaust Gas Recirculation Flow',
  'P0401': 'Exhaust Gas Recirculation Flow Insufficient Detected',
  'P0402': 'Exhaust Gas Recirculation Flow Excessive Detected',
  'P0403': 'Exhaust Gas Recirculation Control Circuit',
  'P0404': 'Exhaust Gas Recirculation Control Circuit Range/Performance',
  'P0405': 'Exhaust Gas Recirculation Sensor A Circuit Low',
  'P0406': 'Exhaust Gas Recirculation Sensor A Circuit High',
  'P0407': 'Exhaust Gas Recirculation Sensor B Circuit Low',
  'P0408': 'Exhaust Gas Recirculation Sensor B Circuit High',
  'P0409': 'Exhaust Gas Recirculation Sensor A Circuit',
  'P0410': 'Secondary Air Injection System',
  'P0411': 'Secondary Air Injection System Incorrect Flow Detected',
  'P0412': 'Secondary Air Injection System Switching Valve A Circuit',
  'P0413': 'Secondary Air Injection System Switching Valve A Circuit Open',
  'P0414': 'Secondary Air Injection System Switching Valve A Circuit Shorted',
  'P0415': 'Secondary Air Injection System Switching Valve B Circuit',
  'P0416': 'Secondary Air Injection System Switching Valve B Circuit Open',
  'P0417': 'Secondary Air Injection System Switching Valve B Circuit Shorted',
  'P0418': 'Secondary Air Injection System Relay A Circuit',
  'P0419': 'Secondary Air Injection System Relay B Circuit',
  'P0420': 'Catalyst System Efficiency Below Threshold (Bank 1)',
  'P0421': 'Warm Up Catalyst Efficiency Below Threshold (Bank 1)',
  'P0422': 'Main Catalyst Efficiency Below Threshold (Bank 1)',
  'P0423': 'Heated Catalyst Efficiency Below Threshold (Bank 1)',
  'P0424': 'Heated Catalyst Temperature Below Threshold (Bank 1)',
  'P0425': 'Catalyst Temperature Sensor (Bank 1)',
  'P0426': 'Catalyst Temperature Sensor Range/Performance (Bank 1)',
  'P0427': 'Catalyst Temperature Sensor Low (Bank 1)',
  'P0428': 'Catalyst Temperature Sensor High (Bank 1)',
  'P0429': 'Catalyst Heater Control Circuit (Bank 1)',
  'P0430': 'Catalyst System Efficiency Below Threshold (Bank 2)',
  'P0431': 'Warm Up Catalyst Efficiency Below Threshold (Bank 2)',
  'P0432': 'Main Catalyst Efficiency Below Threshold (Bank 2)',
  'P0433': 'Heated Catalyst Efficiency Below Threshold (Bank 2)',
  'P0434': 'Heated Catalyst Temperature Below Threshold (Bank 2)',
  'P0435': 'Catalyst Temperature Sensor (Bank 2)',
  'P0436': 'Catalyst Temperature Sensor Range/Performance (Bank 2)',
  'P0437': 'Catalyst Temperature Sensor Low (Bank 2)',
  'P0438': 'Catalyst Temperature Sensor High (Bank 2)',
  'P0439': 'Catalyst Heater Control Circuit (Bank 2)',
  'P0440': 'Evaporative Emission Control System',
  'P0441': 'Evaporative Emission Control System Incorrect Purge Flow',
  'P0442': 'Evaporative Emission Control System Leak Detected (Small Leak)',
  'P0443': 'Evaporative Emission Control System Purge Control Valve Circuit',
  'P0444': 'Evaporative Emission Control System Purge Control Valve Circuit Open',
  'P0445': 'Evaporative Emission Control System Purge Control Valve Circuit Shorted',
  'P0446': 'Evaporative Emission Control System Vent Control Circuit',
  'P0447': 'Evaporative Emission Control System Vent Control Circuit Open',
  'P0448': 'Evaporative Emission Control System Vent Control Circuit Shorted',
  'P0449': 'Evaporative Emission Control System Vent Valve/Solenoid Circuit',
  'P0450': 'Evaporative Emission Control System Pressure Sensor',
  'P0451': 'Evaporative Emission Control System Pressure Sensor Range/Performance',
  'P0452': 'Evaporative Emission Control System Pressure Sensor Low',
  'P0453': 'Evaporative Emission Control System Pressure Sensor High',
  'P0454': 'Evaporative Emission Control System Pressure Sensor Intermittent',
  'P0455': 'Evaporative Emission Control System Leak Detected (Gross Leak)',
  'P0456': 'Evaporative Emission Control System Leak Detected (Very Small Leak)',
  'P0457': 'Evaporative Emission Control System Leak Detected (Fuel Cap Loose/Off)',
  'P0458': 'Evaporative Emission Control System Purge Control Valve Circuit Low',
  'P0459': 'Evaporative Emission Control System Purge Control Valve Circuit High',
  'P0460': 'Fuel Level Sensor Circuit',
  'P0461': 'Fuel Level Sensor Circuit Range/Performance',
  'P0462': 'Fuel Level Sensor Circuit Low',
  'P0463': 'Fuel Level Sensor Circuit High',
  'P0464': 'Fuel Level Sensor Circuit Intermittent',
  'P0465': 'Purge Flow Sensor Circuit',
  'P0466': 'Purge Flow Sensor Circuit Range/Performance',
  'P0467': 'Purge Flow Sensor Circuit Low',
  'P0468': 'Purge Flow Sensor Circuit High',
  'P0469': 'Purge Flow Sensor Circuit Intermittent',
  
  // Vehicle Speed and Idle Control (P0500-P0599)
  'P0500': 'Vehicle Speed Sensor A',
  'P0501': 'Vehicle Speed Sensor A Range/Performance',
  'P0502': 'Vehicle Speed Sensor A Circuit Low',
  'P0503': 'Vehicle Speed Sensor A Circuit Intermittent/Erratic/High',
  'P0504': 'Brake Switch A/B Correlation',
  'P0505': 'Idle Air Control System',
  'P0506': 'Idle Air Control System RPM Lower Than Expected',
  'P0507': 'Idle Air Control System RPM Higher Than Expected',
  'P0508': 'Idle Air Control System Circuit Low',
  'P0509': 'Idle Air Control System Circuit High',
  'P0510': 'Closed Throttle Position Switch',
  'P0511': 'Idle Air Control Circuit',
  'P0512': 'Starter Request Circuit',
  'P0513': 'Incorrect Immobilizer Key',
  'P0514': 'Battery Temperature Sensor Circuit Range/Performance',
  'P0515': 'Battery Temperature Sensor Circuit',
  'P0516': 'Battery Temperature Sensor Circuit Low',
  'P0517': 'Battery Temperature Sensor Circuit High',
  'P0518': 'Idle Air Control Circuit Intermittent',
  'P0519': 'Idle Air Control System Performance',
  'P0520': 'Engine Oil Pressure Sensor/Switch Circuit',
  'P0521': 'Engine Oil Pressure Sensor/Switch Range/Performance',
  'P0522': 'Engine Oil Pressure Sensor/Switch Low Voltage',
  'P0523': 'Engine Oil Pressure Sensor/Switch High Voltage',
  'P0524': 'Engine Oil Pressure Too Low',
  'P0525': 'Cruise Control Servo Control Circuit Range/Performance',
  'P0526': 'Fan Speed Sensor Circuit',
  'P0527': 'Fan Speed Sensor Circuit Range/Performance',
  'P0528': 'Fan Speed Sensor Circuit No Signal',
  'P0529': 'Fan Speed Sensor Circuit Intermittent',
  'P0530': 'A/C Refrigerant Pressure Sensor A Circuit',
  'P0531': 'A/C Refrigerant Pressure Sensor A Circuit Range/Performance',
  'P0532': 'A/C Refrigerant Pressure Sensor A Circuit Low',
  'P0533': 'A/C Refrigerant Pressure Sensor A Circuit High',
  'P0534': 'Air Conditioner Refrigerant Charge Loss',
  'P0535': 'A/C Evaporator Temperature Sensor Circuit',
  'P0536': 'A/C Evaporator Temperature Sensor Circuit Range/Performance',
  'P0537': 'A/C Evaporator Temperature Sensor Circuit Low',
  'P0538': 'A/C Evaporator Temperature Sensor Circuit High',
  'P0539': 'A/C Evaporator Temperature Sensor Circuit Intermittent',
  'P0540': 'Intake Air Heater A Circuit',
  'P0541': 'Intake Air Heater A Circuit Low',
  'P0542': 'Intake Air Heater A Circuit High',
  'P0543': 'Intake Air Heater A Circuit Open',
  'P0544': 'Exhaust Gas Temperature Sensor Circuit (Bank 1 Sensor 1)',
  'P0545': 'Exhaust Gas Temperature Sensor Circuit Low (Bank 1 Sensor 1)',
  'P0546': 'Exhaust Gas Temperature Sensor Circuit High (Bank 1 Sensor 1)',
  'P0547': 'Exhaust Gas Temperature Sensor Circuit (Bank 2 Sensor 1)',
  'P0548': 'Exhaust Gas Temperature Sensor Circuit Low (Bank 2 Sensor 1)',
  'P0549': 'Exhaust Gas Temperature Sensor Circuit High (Bank 2 Sensor 1)',
  'P0550': 'Power Steering Pressure Sensor/Switch Circuit',
  'P0551': 'Power Steering Pressure Sensor/Switch Circuit Range/Performance',
  'P0552': 'Power Steering Pressure Sensor/Switch Circuit Low',
  'P0553': 'Power Steering Pressure Sensor/Switch Circuit High',
  'P0554': 'Power Steering Pressure Sensor/Switch Circuit Intermittent',
  'P0560': 'System Voltage',
  'P0561': 'System Voltage Unstable',
  'P0562': 'System Voltage Low',
  'P0563': 'System Voltage High',
  'P0564': 'Cruise Control Multi-Function Input A Circuit',
  'P0565': 'Cruise Control On Signal',
  'P0566': 'Cruise Control Off Signal',
  'P0567': 'Cruise Control Resume Signal',
  'P0568': 'Cruise Control Set Signal',
  'P0569': 'Cruise Control Coast Signal',
  'P0570': 'Cruise Control Accel Signal',
  'P0571': 'Cruise Control/Brake Switch A Circuit',
  'P0572': 'Cruise Control/Brake Switch A Circuit Low',
  'P0573': 'Cruise Control/Brake Switch A Circuit High',
  'P0574': 'Cruise Control System - Vehicle Speed Too High',
  'P0575': 'Cruise Control Input Circuit',
  'P0576': 'Cruise Control Input Circuit Low',
  'P0577': 'Cruise Control Input Circuit High',
  'P0578': 'Cruise Control Multi-Function Input A Circuit Stuck',
  'P0579': 'Cruise Control Multi-Function Input A Circuit Range/Performance',
  'P0580': 'Cruise Control Multi-Function Input A Circuit Low',
  'P0581': 'Cruise Control Multi-Function Input A Circuit High',
  
  // PCM / ECM Communication (P0600-P0699)
  'P0600': 'Serial Communication Link',
  'P0601': 'Internal Control Module Memory Check Sum Error',
  'P0602': 'Control Module Programming Error',
  'P0603': 'Internal Control Module Keep Alive Memory (KAM) Error',
  'P0604': 'Internal Control Module Random Access Memory (RAM) Error',
  'P0605': 'Internal Control Module Read Only Memory (ROM) Error',
  'P0606': 'ECM/PCM Processor',
  'P0607': 'Control Module Performance',
  'P0608': 'Control Module VSS Output A',
  'P0609': 'Control Module VSS Output B',
  'P0610': 'Control Module Vehicle Options Error',
  'P0611': 'Fuel Injector Control Module Performance',
  'P0612': 'Fuel Injector Control Module Relay Control',
  'P0613': 'TCM Processor',
  'P0614': 'ECM/TCM Incompatible',
  'P0615': 'Starter Relay Circuit',
  'P0616': 'Starter Relay Circuit Low',
  'P0617': 'Starter Relay Circuit High',
  'P0618': 'Alternative Fuel Control Module KAM Error',
  'P0619': 'Alternative Fuel Control Module RAM/ROM Error',
  'P0620': 'Generator Control Circuit',
  'P0621': 'Generator Lamp L Control Circuit',
  'P0622': 'Generator Field F Control Circuit',
  'P0623': 'Generator Lamp Control Circuit',
  'P0624': 'Fuel Cap Lamp Control Circuit',
  'P0625': 'Generator Field/F Terminal Circuit Low',
  'P0626': 'Generator Field/F Terminal Circuit High',
  'P0627': 'Fuel Pump A Control Circuit/Open',
  'P0628': 'Fuel Pump A Control Circuit Low',
  'P0629': 'Fuel Pump A Control Circuit High',
  'P0630': 'VIN Not Programmed or Incompatible - ECM/PCM',
  'P0631': 'VIN Not Programmed or Incompatible - TCM',
  'P0632': 'Odometer Not Programmed - ECM/PCM',
  'P0633': 'Immobilizer Key Not Programmed - ECM/PCM',
  'P0634': 'PCM/ECM/TCM Internal Temperature Too High',
  'P0635': 'Power Steering Control Circuit',
  'P0636': 'Power Steering Control Circuit Low',
  'P0637': 'Power Steering Control Circuit High',
  'P0638': 'Throttle Actuator Control Range/Performance (Bank 1)',
  'P0639': 'Throttle Actuator Control Range/Performance (Bank 2)',
  'P0640': 'Intake Air Heater Control Circuit',
  'P0641': '5V Reference A Circuit/Open',
  'P0642': 'Sensor Reference Voltage A Circuit Low',
  'P0643': 'Sensor Reference Voltage A Circuit High',
  'P0644': 'Driver Display Serial Communication Circuit',
  'P0645': 'A/C Clutch Relay Control Circuit',
  'P0646': 'A/C Clutch Relay Control Circuit Low',
  'P0647': 'A/C Clutch Relay Control Circuit High',
  'P0648': 'Immobilizer Lamp Control Circuit',
  'P0649': 'Speed Control Lamp Control Circuit',
  'P0650': 'Malfunction Indicator Lamp (MIL) Control Circuit',
  'P0651': '5V Reference B Circuit/Open',
  'P0652': 'Sensor Reference Voltage B Circuit Low',
  'P0653': 'Sensor Reference Voltage B Circuit High',
  'P0654': 'Engine RPM Output Circuit',
  'P0655': 'Engine Hot Lamp Output Control Circuit',
  'P0656': 'Fuel Level Output Circuit',
  'P0657': 'Actuator Supply Voltage A Circuit/Open',
  'P0658': 'Actuator Supply Voltage A Circuit Low',
  'P0659': 'Actuator Supply Voltage A Circuit High',
  'P0660': 'Intake Manifold Tuning Valve Control Circuit/Open (Bank 1)',
  'P0661': 'Intake Manifold Tuning Valve Control Circuit Low (Bank 1)',
  'P0662': 'Intake Manifold Tuning Valve Control Circuit High (Bank 1)',
  'P0663': 'Intake Manifold Tuning Valve Control Circuit/Open (Bank 2)',
  'P0664': 'Intake Manifold Tuning Valve Control Circuit Low (Bank 2)',
  'P0665': 'Intake Manifold Tuning Valve Control Circuit High (Bank 2)',
  
  // Transmission Codes (P0700-P0899)
  'P0700': 'Transmission Control System (MIL Request)',
  'P0701': 'Transmission Control System Range/Performance',
  'P0702': 'Transmission Control System Electrical',
  'P0703': 'Brake Switch B Circuit',
  'P0704': 'Clutch Switch Input Circuit',
  'P0705': 'Transmission Range Sensor Circuit (PRNDL Input)',
  'P0706': 'Transmission Range Sensor Circuit Range/Performance',
  'P0707': 'Transmission Range Sensor Circuit Low',
  'P0708': 'Transmission Range Sensor Circuit High',
  'P0709': 'Transmission Range Sensor Circuit Intermittent',
  'P0710': 'Transmission Fluid Temperature Sensor A Circuit',
  'P0711': 'Transmission Fluid Temperature Sensor A Circuit Range/Performance',
  'P0712': 'Transmission Fluid Temperature Sensor A Circuit Low',
  'P0713': 'Transmission Fluid Temperature Sensor A Circuit High',
  'P0714': 'Transmission Fluid Temperature Sensor A Circuit Intermittent',
  'P0715': 'Input/Turbine Speed Sensor A Circuit',
  'P0716': 'Input/Turbine Speed Sensor A Circuit Range/Performance',
  'P0717': 'Input/Turbine Speed Sensor A Circuit No Signal',
  'P0718': 'Input/Turbine Speed Sensor A Circuit Intermittent',
  'P0719': 'Brake Switch B Circuit Low',
  'P0720': 'Output Speed Sensor Circuit',
  'P0721': 'Output Speed Sensor Circuit Range/Performance',
  'P0722': 'Output Speed Sensor Circuit No Signal',
  'P0723': 'Output Speed Sensor Circuit Intermittent',
  'P0724': 'Brake Switch B Circuit High',
  'P0725': 'Engine Speed Input Circuit',
  'P0726': 'Engine Speed Input Circuit Range/Performance',
  'P0727': 'Engine Speed Input Circuit No Signal',
  'P0728': 'Engine Speed Input Circuit Intermittent',
  'P0729': 'Gear 6 Incorrect Ratio',
  'P0730': 'Incorrect Gear Ratio',
  'P0731': 'Gear 1 Incorrect Ratio',
  'P0732': 'Gear 2 Incorrect Ratio',
  'P0733': 'Gear 3 Incorrect Ratio',
  'P0734': 'Gear 4 Incorrect Ratio',
  'P0735': 'Gear 5 Incorrect Ratio',
  'P0736': 'Reverse Incorrect Ratio',
  'P0740': 'Torque Converter Clutch Circuit/Open',
  'P0741': 'Torque Converter Clutch Circuit Performance or Stuck Off',
  'P0742': 'Torque Converter Clutch Circuit Stuck On',
  'P0743': 'Torque Converter Clutch Circuit Electrical',
  'P0744': 'Torque Converter Clutch Circuit Intermittent',
  'P0745': 'Pressure Control Solenoid A',
  'P0746': 'Pressure Control Solenoid A Performance or Stuck Off',
  'P0747': 'Pressure Control Solenoid A Stuck On',
  'P0748': 'Pressure Control Solenoid A Electrical',
  'P0749': 'Pressure Control Solenoid A Intermittent',
  'P0750': 'Shift Solenoid A',
  'P0751': 'Shift Solenoid A Performance or Stuck Off',
  'P0752': 'Shift Solenoid A Stuck On',
  'P0753': 'Shift Solenoid A Electrical',
  'P0754': 'Shift Solenoid A Intermittent',
  'P0755': 'Shift Solenoid B',
  'P0756': 'Shift Solenoid B Performance or Stuck Off',
  'P0757': 'Shift Solenoid B Stuck On',
  'P0758': 'Shift Solenoid B Electrical',
  'P0759': 'Shift Solenoid B Intermittent',
  'P0760': 'Shift Solenoid C',
  'P0761': 'Shift Solenoid C Performance or Stuck Off',
  'P0762': 'Shift Solenoid C Stuck On',
  'P0763': 'Shift Solenoid C Electrical',
  'P0764': 'Shift Solenoid C Intermittent',
  'P0765': 'Shift Solenoid D',
  'P0766': 'Shift Solenoid D Performance or Stuck Off',
  'P0767': 'Shift Solenoid D Stuck On',
  'P0768': 'Shift Solenoid D Electrical',
  'P0769': 'Shift Solenoid D Intermittent',
  'P0770': 'Shift Solenoid E',
  'P0771': 'Shift Solenoid E Performance or Stuck Off',
  'P0772': 'Shift Solenoid E Stuck On',
  'P0773': 'Shift Solenoid E Electrical',
  'P0774': 'Shift Solenoid E Intermittent',
  'P0775': 'Pressure Control Solenoid B',
  'P0776': 'Pressure Control Solenoid B Performance or Stuck Off',
  'P0777': 'Pressure Control Solenoid B Stuck On',
  'P0778': 'Pressure Control Solenoid B Electrical',
  'P0779': 'Pressure Control Solenoid B Intermittent',
  'P0780': 'Shift Error',
  'P0781': '1-2 Shift',
  'P0782': '2-3 Shift',
  'P0783': '3-4 Shift',
  'P0784': '4-5 Shift',
  'P0785': 'Shift/Timing Solenoid',
  'P0786': 'Shift/Timing Solenoid Range/Performance',
  'P0787': 'Shift/Timing Solenoid Low',
  'P0788': 'Shift/Timing Solenoid High',
  'P0789': 'Shift/Timing Solenoid Intermittent',
  'P0790': 'Normal/Performance Switch Circuit',
  'P0791': 'Intermediate Shaft Speed Sensor A Circuit',
  'P0792': 'Intermediate Shaft Speed Sensor A Circuit Range/Performance',
  'P0793': 'Intermediate Shaft Speed Sensor A Circuit No Signal',
  'P0794': 'Intermediate Shaft Speed Sensor A Circuit Intermittent',
  'P0795': 'Pressure Control Solenoid C',
  'P0796': 'Pressure Control Solenoid C Performance or Stuck Off',
  'P0797': 'Pressure Control Solenoid C Stuck On',
  'P0798': 'Pressure Control Solenoid C Electrical',
  'P0799': 'Pressure Control Solenoid C Intermittent',
  'P0800': 'Transfer Case Control System (MIL Request)',
  'P0801': 'Reverse Inhibit Control Circuit',
  'P0802': 'Transmission Control System MIL Request Circuit/Open',
  'P0803': '1-4 Upshift (Skip Shift) Solenoid Control Circuit',
  'P0804': '1-4 Upshift (Skip Shift) Lamp Control Circuit',
  'P0805': 'Clutch Position Sensor Circuit',
  'P0806': 'Clutch Position Sensor Circuit Range/Performance',
  'P0807': 'Clutch Position Sensor Circuit Low',
  'P0808': 'Clutch Position Sensor Circuit High',
  'P0809': 'Clutch Position Sensor Circuit Intermittent',
  'P0810': 'Clutch Position Control Error',
  'P0811': 'Excessive Clutch Slippage',
  'P0812': 'Reverse Input Circuit',
  'P0813': 'Reverse Output Circuit',
  'P0814': 'Transmission Range Display Circuit',
  'P0815': 'Upshift Switch Circuit',
  'P0816': 'Downshift Switch Circuit',
  'P0817': 'Starter Disable Circuit',
  'P0818': 'Driveline Disconnect Switch Input Circuit',
  'P0819': 'Up and Down Shift Switch to Transmission Range Correlation',
  'P0820': 'Gear Lever X-Y Position Sensor Circuit',
  'P0821': 'Gear Lever X Position Circuit',
  'P0822': 'Gear Lever Y Position Circuit',
  'P0823': 'Gear Lever X Position Circuit Intermittent',
  'P0824': 'Gear Lever Y Position Circuit Intermittent',
  'P0825': 'Gear Lever Push-Pull Switch (Shift Anticipate)',
  'P0826': 'Up and Down Shift Switch Circuit',
  'P0827': 'Up and Down Shift Switch Circuit Low',
  'P0828': 'Up and Down Shift Switch Circuit High',
  'P0829': '5-6 Shift',
  'P0830': 'Clutch Pedal Switch A Circuit',
  'P0831': 'Clutch Pedal Switch A Circuit Low',
  'P0832': 'Clutch Pedal Switch A Circuit High',
  'P0833': 'Clutch Pedal Switch B Circuit',
  'P0834': 'Clutch Pedal Switch B Circuit Low',
  'P0835': 'Clutch Pedal Switch B Circuit High',
  'P0836': 'Four Wheel Drive (4WD) Switch Circuit',
  'P0837': 'Four Wheel Drive (4WD) Switch Circuit Range/Performance',
  'P0838': 'Four Wheel Drive (4WD) Switch Circuit Low',
  'P0839': 'Four Wheel Drive (4WD) Switch Circuit High',
  'P0840': 'Transmission Fluid Pressure Sensor/Switch A Circuit',
  'P0841': 'Transmission Fluid Pressure Sensor/Switch A Circuit Range/Performance',
  'P0842': 'Transmission Fluid Pressure Sensor/Switch A Circuit Low',
  'P0843': 'Transmission Fluid Pressure Sensor/Switch A Circuit High',
  'P0844': 'Transmission Fluid Pressure Sensor/Switch A Circuit Intermittent',
  'P0845': 'Transmission Fluid Pressure Sensor/Switch B Circuit',
  'P0846': 'Transmission Fluid Pressure Sensor/Switch B Circuit Range/Performance',
  'P0847': 'Transmission Fluid Pressure Sensor/Switch B Circuit Low',
  'P0848': 'Transmission Fluid Pressure Sensor/Switch B Circuit High',
  'P0849': 'Transmission Fluid Pressure Sensor/Switch B Circuit Intermittent',
  'P0850': 'Park/Neutral Switch Input Circuit',
  'P0851': 'Park/Neutral Switch Input Circuit Low',
  'P0852': 'Park/Neutral Switch Input Circuit High',
  'P0853': 'Drive Switch Input Circuit',
  'P0854': 'Drive Switch Input Circuit Low',
  'P0855': 'Drive Switch Input Circuit High',
  'P0856': 'Traction Control Input Signal',
  'P0857': 'Traction Control Input Signal Range/Performance',
  'P0858': 'Traction Control Input Signal Low',
  'P0859': 'Traction Control Input Signal High',
  'P0860': 'Gear Shift Module Communication Circuit',
  'P0861': 'Gear Shift Module Communication Circuit Low',
  'P0862': 'Gear Shift Module Communication Circuit High',
  'P0863': 'TCM Communication Circuit',
  'P0864': 'TCM Communication Circuit Range/Performance',
  'P0865': 'TCM Communication Circuit Low',
  'P0866': 'TCM Communication Circuit High',
  'P0867': 'Transmission Fluid Pressure',
  'P0868': 'Transmission Fluid Pressure Low',
  'P0869': 'Transmission Fluid Pressure High',
  'P0870': 'Transmission Fluid Pressure Sensor/Switch C Circuit',
  'P0871': 'Transmission Fluid Pressure Sensor/Switch C Circuit Range/Performance',
  'P0872': 'Transmission Fluid Pressure Sensor/Switch C Circuit Low',
  'P0873': 'Transmission Fluid Pressure Sensor/Switch C Circuit High',
  'P0874': 'Transmission Fluid Pressure Sensor/Switch C Circuit Intermittent',
  
  // ============================================
  // P1xxx - Manufacturer Specific Powertrain Codes (Common)
  // ============================================
  'P1658': 'Electronic Throttle Control Module Malfunction',
  'P1683': 'Metering Oil Pump Position Sensor Circuit Malfunction',
  'P1684': 'Battery Power to Module Disconnected',
  'P1746': 'Pressure Control Solenoid A Open Circuit',
  'P1780': 'Transmission Control Switch Out of Self Test Range',
  
  // ============================================
  // P2xxx - Generic Powertrain Codes (Extended)
  // ============================================
  'P2000': 'NOx Adsorber Efficiency Below Threshold (Bank 1)',
  'P2001': 'NOx Adsorber Efficiency Below Threshold (Bank 2)',
  'P2002': 'Diesel Particulate Filter Efficiency Below Threshold (Bank 1)',
  'P2003': 'Diesel Particulate Filter Efficiency Below Threshold (Bank 2)',
  'P2004': 'Intake Manifold Runner Control Stuck Open (Bank 1)',
  'P2005': 'Intake Manifold Runner Control Stuck Open (Bank 2)',
  'P2006': 'Intake Manifold Runner Control Stuck Closed (Bank 1)',
  'P2007': 'Intake Manifold Runner Control Stuck Closed (Bank 2)',
  'P2008': 'Intake Manifold Runner Control Circuit/Open (Bank 1)',
  'P2009': 'Intake Manifold Runner Control Circuit Low (Bank 1)',
  'P2010': 'Intake Manifold Runner Control Circuit High (Bank 1)',
  'P2011': 'Intake Manifold Runner Control Circuit/Open (Bank 2)',
  'P2012': 'Intake Manifold Runner Control Circuit Low (Bank 2)',
  'P2013': 'Intake Manifold Runner Control Circuit High (Bank 2)',
  'P2014': 'Intake Manifold Runner Position Sensor/Switch Circuit (Bank 1)',
  'P2015': 'Intake Manifold Runner Position Sensor/Switch Circuit Range/Performance (Bank 1)',
  'P2016': 'Intake Manifold Runner Position Sensor/Switch Circuit Low (Bank 1)',
  'P2017': 'Intake Manifold Runner Position Sensor/Switch Circuit High (Bank 1)',
  'P2018': 'Intake Manifold Runner Position Sensor/Switch Circuit Intermittent (Bank 1)',
  'P2019': 'Intake Manifold Runner Position Sensor/Switch Circuit (Bank 2)',
  'P2020': 'Intake Manifold Runner Position Sensor/Switch Circuit Range/Performance (Bank 2)',
  'P2088': 'A Camshaft Position Actuator Control Circuit Low (Bank 1)',
  'P2089': 'A Camshaft Position Actuator Control Circuit High (Bank 1)',
  'P2090': 'B Camshaft Position Actuator Control Circuit Low (Bank 1)',
  'P2091': 'B Camshaft Position Actuator Control Circuit High (Bank 1)',
  'P2092': 'A Camshaft Position Actuator Control Circuit Low (Bank 2)',
  'P2093': 'A Camshaft Position Actuator Control Circuit High (Bank 2)',
  'P2094': 'B Camshaft Position Actuator Control Circuit Low (Bank 2)',
  'P2095': 'B Camshaft Position Actuator Control Circuit High (Bank 2)',
  'P2096': 'Post Catalyst Fuel Trim System Too Lean (Bank 1)',
  'P2097': 'Post Catalyst Fuel Trim System Too Rich (Bank 1)',
  'P2098': 'Post Catalyst Fuel Trim System Too Lean (Bank 2)',
  'P2099': 'Post Catalyst Fuel Trim System Too Rich (Bank 2)',
  'P2100': 'Throttle Actuator Control Motor Circuit/Open',
  'P2101': 'Throttle Actuator Control Motor Circuit Range/Performance',
  'P2102': 'Throttle Actuator Control Motor Circuit Low',
  'P2103': 'Throttle Actuator Control Motor Circuit High',
  'P2104': 'Throttle Actuator Control System - Forced Idle',
  'P2105': 'Throttle Actuator Control System - Forced Engine Shutdown',
  'P2106': 'Throttle Actuator Control System - Forced Limited Power',
  'P2107': 'Throttle Actuator Control Module Processor',
  'P2108': 'Throttle Actuator Control Module Performance',
  'P2109': 'Throttle/Pedal Position Sensor A Minimum Stop Performance',
  'P2110': 'Throttle Actuator Control System - Forced Limited RPM',
  'P2111': 'Throttle Actuator Control System - Stuck Open',
  'P2112': 'Throttle Actuator Control System - Stuck Closed',
  'P2113': 'Throttle/Pedal Position Sensor B Minimum Stop Performance',
  'P2114': 'Throttle/Pedal Position Sensor C Minimum Stop Performance',
  'P2115': 'Throttle/Pedal Position Sensor D Minimum Stop Performance',
  'P2116': 'Throttle/Pedal Position Sensor E Minimum Stop Performance',
  'P2117': 'Throttle/Pedal Position Sensor F Minimum Stop Performance',
  'P2118': 'Throttle Actuator Control Motor Current Range/Performance',
  'P2119': 'Throttle Actuator Control Throttle Body Range/Performance',
  'P2120': 'Throttle/Pedal Position Sensor/Switch D Circuit',
  'P2121': 'Throttle/Pedal Position Sensor/Switch D Circuit Range/Performance',
  'P2122': 'Throttle/Pedal Position Sensor/Switch D Circuit Low',
  'P2123': 'Throttle/Pedal Position Sensor/Switch D Circuit High',
  'P2124': 'Throttle/Pedal Position Sensor/Switch D Circuit Intermittent',
  'P2125': 'Throttle/Pedal Position Sensor/Switch E Circuit',
  'P2126': 'Throttle/Pedal Position Sensor/Switch E Circuit Range/Performance',
  'P2127': 'Throttle/Pedal Position Sensor/Switch E Circuit Low',
  'P2128': 'Throttle/Pedal Position Sensor/Switch E Circuit High',
  'P2129': 'Throttle/Pedal Position Sensor/Switch E Circuit Intermittent',
  'P2130': 'Throttle/Pedal Position Sensor/Switch F Circuit',
  'P2131': 'Throttle/Pedal Position Sensor/Switch F Circuit Range/Performance',
  'P2132': 'Throttle/Pedal Position Sensor/Switch F Circuit Low',
  'P2133': 'Throttle/Pedal Position Sensor/Switch F Circuit High',
  'P2134': 'Throttle/Pedal Position Sensor/Switch F Circuit Intermittent',
  'P2135': 'Throttle/Pedal Position Sensor/Switch A/B Voltage Correlation',
  'P2136': 'Throttle/Pedal Position Sensor/Switch A/C Voltage Correlation',
  'P2137': 'Throttle/Pedal Position Sensor/Switch B/C Voltage Correlation',
  'P2138': 'Throttle/Pedal Position Sensor/Switch D/E Voltage Correlation',
  'P2139': 'Throttle/Pedal Position Sensor/Switch D/F Voltage Correlation',
  'P2140': 'Throttle/Pedal Position Sensor/Switch E/F Voltage Correlation',
  'P2A00': 'O2 Sensor Circuit Range/Performance (Bank 1 Sensor 1)',
  'P2A01': 'O2 Sensor Circuit Range/Performance (Bank 1 Sensor 2)',
  'P2A02': 'O2 Sensor Circuit Range/Performance (Bank 1 Sensor 3)',
  'P2A03': 'O2 Sensor Circuit Range/Performance (Bank 2 Sensor 1)',
  'P2A04': 'O2 Sensor Circuit Range/Performance (Bank 2 Sensor 2)',
  'P2A05': 'O2 Sensor Circuit Range/Performance (Bank 2 Sensor 3)',
  
  // ============================================
  // Body Codes (B0xxx)
  // ============================================
  'B0001': 'Driver Frontal Stage 1 Deployment Control',
  'B0002': 'Driver Frontal Stage 2 Deployment Control',
  'B0003': 'Driver Frontal Stage 1 Deployment Control - Loss of Ground',
  'B0004': 'Driver Frontal Stage 1 Deployment Control - Short to Ground',
  'B0005': 'Driver Frontal Stage 1 Deployment Control - Short to Battery',
  'B0100': 'Electronic Frontal Sensor 1',
  'B0101': 'Electronic Frontal Sensor 1 - Short to Battery',
  'B0102': 'Electronic Frontal Sensor 1 - Open Circuit',
  'B0103': 'Electronic Frontal Sensor 2',
  
  // ============================================
  // Chassis Codes (C0xxx)
  // ============================================
  'C0035': 'Left Front Wheel Speed Sensor Circuit',
  'C0040': 'Right Front Wheel Speed Sensor Circuit',
  'C0045': 'Left Rear Wheel Speed Sensor Circuit',
  'C0050': 'Right Rear Wheel Speed Sensor Circuit',
  'C0060': 'Left Front ABS Solenoid 1 Circuit',
  'C0065': 'Left Front ABS Solenoid 2 Circuit',
  'C0070': 'Right Front ABS Solenoid 1 Circuit',
  'C0075': 'Right Front ABS Solenoid 2 Circuit',
  'C0080': 'Left Rear ABS Solenoid 1 Circuit',
  'C0085': 'Left Rear ABS Solenoid 2 Circuit',
  'C0090': 'Right Rear ABS Solenoid 1 Circuit',
  'C0095': 'Right Rear ABS Solenoid 2 Circuit',
  'C0110': 'Pump Motor Circuit',
  'C0121': 'Valve Relay Circuit',
  'C0128': 'Low Brake Fluid',
  'C0161': 'ABS/TCS Brake Switch Circuit',
  'C0186': 'Lateral Accelerometer Circuit',
  'C0196': 'Yaw Rate Sensor Circuit',
  'C0221': 'Right Front Wheel Speed Sensor Circuit Range/Performance',
  'C0222': 'Right Front Wheel Speed Signal Missing',
  'C0223': 'Right Front Wheel Speed Signal Erratic',
  'C0226': 'Left Front Wheel Speed Sensor Circuit Range/Performance',
  'C0227': 'Left Front Wheel Speed Signal Missing',
  'C0228': 'Left Front Wheel Speed Signal Erratic',
  'C0235': 'Rear Wheel Speed Signal Circuit',
  'C0236': 'Rear Wheel Speed Signal Circuit Range/Performance',
  'C0237': 'Rear Wheel Speed Signal Missing',
  'C0238': 'Wheel Speed Mismatch',
  'C0241': 'EBCM Control Valve Circuit',
  'C0242': 'PCM Indicated Requested Torque',
  'C0244': 'Pulse Width Modulated Delivered Torque',
  'C0245': 'Wheel Speed Sensor Frequency Error',
  'C0252': 'Active Brake Control Sensors Uncorrelated',
  'C0265': 'EBCM Relay Circuit',
  'C0266': 'BPMV Supply Voltage Circuit Low',
  'C0267': 'Pump Motor Circuit Low',
  'C0268': 'Pump Motor Circuit High',
  'C0269': 'Pump Motor Circuit Open',
  'C0271': 'EBCM Requested Lamp On Time Exceeded',
  'C0272': 'EBCM/EBTCM Indicates a DTC Stored',
  'C0273': 'EBCM/EBTCM Cycle Count Error',
  'C0274': 'Excessive Dump/Isolation Time',
  'C0279': 'Powertrain Configuration Not Valid',
  'C0281': 'Brake Switch Circuit',
  'C0283': 'Traction Switch Shorted to Ground',
  'C0284': 'EBCM Calibration Out of Range',
  'C0287': 'Delivered Torque Signal Circuit',
  'C0290': 'Lost Communication with PCM',
  'C0291': 'Lost Communications with BCM',
  'C0292': 'Lost Communications with RCDLR',
  'C0297': 'Powertrain Configuration Data Not Received',
  'C0298': 'PCM Class 2 Serial Data Line Malfunction',
  'C0300': 'Rear Speed Sensor Circuit',
  'C0305': 'Front Axle Speed Signal Missing',
  'C0306': 'Motor A or B Circuit',
  'C0315': 'Motor Ground Circuit Open',
  'C0321': 'Transfer Case Lock Feedback Circuit',
  'C0323': 'Front Axle Does Not Engage',
  'C0327': 'Encoder Circuit Failure',
  'C0359': 'Front Axle System Performance',
  'C0376': 'Device Voltage Low',
  'C0387': 'Device Voltage Reference Output Circuit',
  'C0710': 'Steering Position Signal',
  'C0800': 'Device Power Circuit',
  
  // ============================================
  // Network Codes (U0xxx)
  // ============================================
  'U0001': 'High Speed CAN Communication Bus',
  'U0002': 'High Speed CAN Communication Bus Performance',
  'U0003': 'High Speed CAN Communication Bus (+) Open',
  'U0004': 'High Speed CAN Communication Bus (+) Low',
  'U0005': 'High Speed CAN Communication Bus (+) High',
  'U0006': 'High Speed CAN Communication Bus (-) Open',
  'U0007': 'High Speed CAN Communication Bus (-) Low',
  'U0008': 'High Speed CAN Communication Bus (-) High',
  'U0009': 'High Speed CAN Communication Bus (-) Shorted to Bus (+)',
  'U0010': 'Medium Speed CAN Communication Bus',
  'U0011': 'Medium Speed CAN Communication Bus Performance',
  'U0012': 'Medium Speed CAN Communication Bus (+) Open',
  'U0013': 'Medium Speed CAN Communication Bus (+) Low',
  'U0014': 'Medium Speed CAN Communication Bus (+) High',
  'U0015': 'Medium Speed CAN Communication Bus (-) Open',
  'U0016': 'Medium Speed CAN Communication Bus (-) Low',
  'U0017': 'Medium Speed CAN Communication Bus (-) High',
  'U0018': 'Medium Speed CAN Communication Bus (-) Shorted to Bus (+)',
  'U0019': 'Low Speed CAN Communication Bus',
  'U0020': 'Low Speed CAN Communication Bus Performance',
  'U0021': 'Low Speed CAN Communication Bus (+) Open',
  'U0022': 'Low Speed CAN Communication Bus (+) Low',
  'U0023': 'Low Speed CAN Communication Bus (+) High',
  'U0024': 'Low Speed CAN Communication Bus (-) Open',
  'U0025': 'Low Speed CAN Communication Bus (-) Low',
  'U0026': 'Low Speed CAN Communication Bus (-) High',
  'U0027': 'Low Speed CAN Communication Bus (-) Shorted to Bus (+)',
  'U0028': 'Vehicle Communication Bus A',
  'U0029': 'Vehicle Communication Bus A Performance',
  'U0030': 'Vehicle Communication Bus A (+) Open',
  'U0031': 'Vehicle Communication Bus A (+) Low',
  'U0032': 'Vehicle Communication Bus A (+) High',
  'U0033': 'Vehicle Communication Bus A (-) Open',
  'U0034': 'Vehicle Communication Bus A (-) Low',
  'U0035': 'Vehicle Communication Bus A (-) High',
  'U0036': 'Vehicle Communication Bus A (-) Shorted to Bus (+)',
  'U0100': 'Lost Communication with ECM/PCM "A"',
  'U0101': 'Lost Communication with TCM',
  'U0102': 'Lost Communication with Transfer Case Control Module',
  'U0103': 'Lost Communication with Gear Shift Control Module',
  'U0104': 'Lost Communication with Cruise Control Module',
  'U0105': 'Lost Communication with Fuel Injector Control Module',
  'U0106': 'Lost Communication with Glow Plug Control Module',
  'U0107': 'Lost Communication with Throttle Actuator Control Module',
  'U0108': 'Lost Communication with Alternative Fuel Control Module',
  'U0109': 'Lost Communication with Fuel Pump Control Module',
  'U0110': 'Lost Communication with Drive Motor Control Module',
  'U0111': 'Lost Communication with Battery Energy Control Module A',
  'U0112': 'Lost Communication with Battery Energy Control Module B',
  'U0113': 'Lost Communication with Emissions Critical Control Information',
  'U0114': 'Lost Communication with Four-Wheel Drive Clutch Control Module',
  'U0115': 'Lost Communication with ECM/PCM "B"',
  'U0116': 'Lost Communication with Vehicle Dynamics Control Module',
  'U0117': 'Lost Communication with Electric Power Steering Control Module',
  'U0118': 'Lost Communication with Power Steering Control Module',
  'U0119': 'Lost Communication with Battery Energy Control Module',
  'U0120': 'Lost Communication with Starter/Generator Control Module',
  'U0121': 'Lost Communication with Antilock Brake System (ABS) Control Module',
  'U0122': 'Lost Communication with Vehicle Dynamics Control Module',
  'U0123': 'Lost Communication with Yaw Rate Sensor Module',
  'U0124': 'Lost Communication with Lateral Acceleration Sensor Module',
  'U0125': 'Lost Communication with Multi-Axis Acceleration Sensor Module',
  'U0126': 'Lost Communication with Steering Angle Sensor Module',
  'U0127': 'Lost Communication with Tire Pressure Monitor Module',
  'U0128': 'Lost Communication with Park Brake Control Module',
  'U0129': 'Lost Communication with Brake System Control Module',
  'U0130': 'Lost Communication with Steering Effort Control Module',
  'U0131': 'Lost Communication with Power Steering Control Module',
  'U0132': 'Lost Communication with Ride Level Control Module',
  'U0140': 'Lost Communication with Body Control Module',
  'U0141': 'Lost Communication with Body Control Module "A"',
  'U0142': 'Lost Communication with Body Control Module "B"',
  'U0143': 'Lost Communication with Body Control Module "C"',
  'U0144': 'Lost Communication with Body Control Module "D"',
  'U0145': 'Lost Communication with Body Control Module "E"',
  'U0146': 'Lost Communication with Gateway "A"',
  'U0147': 'Lost Communication with Gateway "B"',
  'U0148': 'Lost Communication with Gateway "C"',
  'U0149': 'Lost Communication with Gateway "D"',
  'U0150': 'Lost Communication with Gateway "E"',
  'U0151': 'Lost Communication with Restraints Control Module',
  'U0152': 'Lost Communication with Side Restraints Control Module - Left',
  'U0153': 'Lost Communication with Side Restraints Control Module - Right',
  'U0154': 'Lost Communication with Restraints Occupant Sensing Control Module',
  'U0155': 'Lost Communication with Instrument Panel Cluster (IPC) Control Module',
  'U0156': 'Lost Communication with Information Center "A"',
  'U0157': 'Lost Communication with Information Center "B"',
  'U0158': 'Lost Communication with Head Up Display',
  'U0159': 'Lost Communication with Parking Assist Control Module',
  'U0160': 'Lost Communication with Audible Alert Control Module',
  'U0161': 'Lost Communication with Compass Module',
  'U0162': 'Lost Communication with Navigation Display Module',
  'U0163': 'Lost Communication with Navigation Control Module',
  'U0164': 'Lost Communication with HVAC Control Module',
  'U0165': 'Lost Communication with HVAC Control Module - Rear',
  'U0166': 'Lost Communication with Auxiliary Heater Control Module',
  'U0167': 'Lost Communication with Vehicle Immobilizer Control Module',
  'U0168': 'Lost Communication with Vehicle Security Control Module',
  'U0169': 'Lost Communication with Sunroof Control Module',
  'U0170': 'Lost Communication with Restraints System Sensor "A"',
  'U0171': 'Lost Communication with Restraints System Sensor "B"',
  'U0172': 'Lost Communication with Restraints System Sensor "C"',
  'U0173': 'Lost Communication with Restraints System Sensor "D"',
  'U0174': 'Lost Communication with Restraints System Sensor "E"',
  'U0175': 'Lost Communication with Restraints System Sensor "F"',
  'U0176': 'Lost Communication with Restraints System Sensor "G"',
  'U0177': 'Lost Communication with Restraints System Sensor "H"',
  'U0178': 'Lost Communication with Restraints System Sensor "I"',
  'U0179': 'Lost Communication with Restraints System Sensor "J"',
  'U0180': 'Lost Communication with Automatic Lighting Control Module',
  'U0181': 'Lost Communication with Headlamp Leveling Control Module',
  'U0182': 'Lost Communication with Lighting Control Module - Front',
  'U0183': 'Lost Communication with Lighting Control Module - Rear',
  'U0184': 'Lost Communication with Radio',
  'U0185': 'Lost Communication with Antenna Control Module',
  'U0186': 'Lost Communication with Audio Amplifier',
  'U0187': 'Lost Communication with Digital Disc Player/Changer Module "A"',
  'U0188': 'Lost Communication with Digital Disc Player/Changer Module "B"',
  'U0189': 'Lost Communication with Digital Disc Player/Changer Module "C"',
  'U0190': 'Lost Communication with Digital Disc Player/Changer Module "D"',
  'U0191': 'Lost Communication with Television',
  'U0192': 'Lost Communication with Personal Computer',
  'U0193': 'Lost Communication with Digital Audio Input Module "A"',
  'U0194': 'Lost Communication with Digital Audio Input Module "B"',
  'U0195': 'Lost Communication with Subscription Entertainment Receiver Module',
  'U0196': 'Lost Communication with Rear Seat Entertainment Control Module',
  'U0197': 'Lost Communication with Telephone Control Module',
  'U0198': 'Lost Communication with Telematics Control Module',
  'U0199': 'Lost Communication with Door Control Module "A"',
  'U0200': 'Lost Communication with Door Control Module "B"',
  'U0201': 'Lost Communication with Door Control Module "C"',
  'U0202': 'Lost Communication with Door Control Module "D"',
  'U0203': 'Lost Communication with Door Control Module "E"',
  'U0204': 'Lost Communication with Door Control Module "F"',
  'U0205': 'Lost Communication with Door Control Module "G"',
  'U0206': 'Lost Communication with Folding Top Control Module',
  'U0207': 'Lost Communication with Moveable Roof Control Module',
  'U0208': 'Lost Communication with Seat Control Module "A"',
  'U0209': 'Lost Communication with Seat Control Module "B"',
  'U0210': 'Lost Communication with Seat Control Module "C"',
  'U0211': 'Lost Communication with Seat Control Module "D"',
  'U0212': 'Lost Communication with Steering Column Control Module',
  'U0213': 'Lost Communication with Mirror Control Module',
  'U0214': 'Lost Communication with Remote Function Actuation',
  'U0215': 'Lost Communication with Door Switch Module "A"',
  'U0216': 'Lost Communication with Door Switch Module "B"',
  'U0217': 'Lost Communication with Door Switch Module "C"',
  'U0218': 'Lost Communication with Door Switch Module "D"',
  'U0219': 'Lost Communication with Door Window Motor "A"',
  'U0220': 'Lost Communication with Door Window Motor "B"',
  'U0221': 'Lost Communication with Door Window Motor "C"',
  'U0222': 'Lost Communication with Door Window Motor "D"',
  'U0223': 'Lost Communication with Tailgate Control Module',
  'U0224': 'Lost Communication with Trailer Brake Control Module',
  'U0225': 'Lost Communication with Trailer Tow Control Module',
  'U0226': 'Lost Communication with Garage Door Opener Control Module',
  'U0227': 'Lost Communication with Fuel Cell System Module',
  'U0228': 'Lost Communication with Front Distance Sensing Control Module',
  'U0229': 'Lost Communication with Rear Distance Sensing Control Module',
  'U0230': 'Lost Communication with Side Distance Sensing Control Module - Left',
  'U0231': 'Lost Communication with Side Distance Sensing Control Module - Right',
  'U0232': 'Lost Communication with Vertical Distance Sensing Control Module',
  'U0233': 'Lost Communication with Drive Motor "A" Control Module',
  'U0234': 'Lost Communication with Drive Motor "B" Control Module',
  'U0235': 'Lost Communication with Generator/Inverter Module',
  'U0300': 'Internal Control Module Software Incompatibility',
  'U0301': 'Software Incompatibility with ECM/PCM',
  'U0302': 'Software Incompatibility with TCM',
  'U0303': 'Software Incompatibility with Transfer Case Control Module',
  'U0304': 'Software Incompatibility with Gear Shift Control Module',
  'U0305': 'Software Incompatibility with Cruise Control Module',
  'U0400': 'Invalid Data Received',
  'U0401': 'Invalid Data Received from ECM/PCM',
  'U0402': 'Invalid Data Received from TCM',
  'U0403': 'Invalid Data Received from Transfer Case Control Module',
  'U0404': 'Invalid Data Received from Gear Shift Control Module',
  'U0405': 'Invalid Data Received from Cruise Control Module',
  'U0406': 'Invalid Data Received from Fuel Injector Control Module',
  'U0407': 'Invalid Data Received from Glow Plug Control Module',
  'U0408': 'Invalid Data Received from Throttle Actuator Control Module',
  'U0409': 'Invalid Data Received from Alternative Fuel Control Module',
  'U0410': 'Invalid Data Received from Fuel Pump Control Module',
  'U0411': 'Invalid Data Received from Drive Motor Control Module',
  'U0412': 'Invalid Data Received from Battery Energy Control Module "A"',
  'U0413': 'Invalid Data Received from Battery Energy Control Module "B"',
  'U0414': 'Invalid Data Received from Four-Wheel Drive Clutch Control Module',
  'U0415': 'Invalid Data Received from ECM/PCM "B"',
  'U0416': 'Invalid Data Received from Vehicle Dynamics Control Module',
  'U0417': 'Invalid Data Received from Electric Power Steering Control Module',
  'U0418': 'Invalid Data Received from Power Steering Control Module',
  'U0419': 'Invalid Data Received from Battery Energy Control Module',
  'U0420': 'Invalid Data Received from Starter/Generator Control Module',
  'U0421': 'Invalid Data Received from ABS Control Module',
  'U0422': 'Invalid Data Received from Body Control Module',
  'U0423': 'Invalid Data Received from Instrument Panel Cluster Control Module',
  'U0424': 'Invalid Data Received from HVAC Control Module',
  'U0425': 'Invalid Data Received from Auxiliary Heater Control Module',
  'U0426': 'Invalid Data Received from Vehicle Immobilizer Control Module',
  'U0427': 'Invalid Data Received from Vehicle Security Control Module',
  'U0428': 'Invalid Data Received from Steering Effort Control Module',

  // ============================================================================
  // MANUFACTURER-SPECIFIC CODES (P1xxx, B1xxx, C1xxx, U1xxx)
  // ============================================================================

  // --- VOLKSWAGEN/AUDI/SKODA/SEAT (VAG) SPECIFIC ---
  'P1127': 'Long Term Fuel Trim Add. Air. Bank 1 System Too Rich',
  'P1128': 'Long Term Fuel Trim Add. Air. Bank 1 System Too Lean',
  'P1136': 'Long Term Fuel Trim Add. Air. Bank 2 System Too Lean',
  'P1137': 'Long Term Fuel Trim Add. Air. Bank 2 System Too Rich',
  'P1176': 'O2 Correction Behind Catalyst B1 Limit Attained',
  'P1177': 'O2 Correction Behind Catalyst B2 Limit Attained',
  'P1250': 'Fuel Level Too Low',
  'P1287': 'Turbocharger Bypass Valve Open',
  'P1296': 'Cooling System Malfunction',
  'P1297': 'Connection Turbocharger/Throttle Valve Pressure Hose',
  'P1340': 'Camshaft Position Sensor Bank 1 Timing Not Plausible',
  'P1341': 'Ignition Coil Power Stage 1 Short to Ground',
  'P1343': 'Ignition Coil Power Stage 2 Short to Ground',
  'P1345': 'Ignition Coil Power Stage 3 Short to Ground',
  'P1347': 'Ignition Coil Power Stage 4 Short to Ground',
  'P1355': 'Cylinder 1 Burn Off Diagnostic',
  'P1386': 'Internal Control Module Knock Control Circuit Error',
  'P1388': 'Internal Control Module Drive by Wire Error',
  'P1420': 'Secondary Air Injection Module Short Circuit to B+',
  'P1421': 'Secondary Air Injection Module Short Circuit to Ground',
  'P1425': 'Tank Ventilation Valve Short Circuit to Ground',
  'P1426': 'Tank Ventilation Valve Open Circuit',
  'P1450': 'Secondary Air Injection System Circuit Short to B+',
  'P1471': 'EVAP Emission Control LDP Circuit Short to B+',
  'P1472': 'EVAP Emission Control LDP Circuit Short to Ground',
  'P1473': 'EVAP Emission Control LDP Circuit Open Circuit',
  'P1475': 'EVAP Emission Control LDP Circuit Malfunction/Signal Circuit Open',
  'P1476': 'EVAP Emission Control LDP Circuit Malfunction/Insufficient Vacuum',
  'P1477': 'EVAP Emission Control LDP Circuit Malfunction',
  'P1500': 'Fuel Pump Relay Circuit Electrical Malfunction',
  'P1502': 'Fuel Pump Relay Circuit Short to B+',
  'P1505': 'Closed Throttle Position Switch Does Not Close/Open Circuit',
  'P1512': 'Intake Manifold Changeover Valve Circuit Short to B+',
  'P1515': 'Intake Manifold Changeover Valve Circuit Short to Ground',
  'P1516': 'Intake Manifold Changeover Valve Circuit Open',
  'P1519': 'Intake Camshaft Control Bank 1 Malfunction',
  'P1522': 'Intake Camshaft Control Bank 2 Malfunction',
  'P1543': 'Throttle Actuation Potentiometer Signal Too Low',
  'P1544': 'Throttle Actuation Potentiometer Signal Too High',
  'P1545': 'Throttle Position Control Malfunction',
  'P1546': 'Boost Pressure Control Valve Short to B+',
  'P1547': 'Boost Pressure Control Valve Short to Ground',
  'P1548': 'Boost Pressure Control Valve Open',
  'P1555': 'Charge Pressure Upper Limit Exceeded',
  'P1556': 'Charge Pressure Control Negative Deviation',
  'P1557': 'Charge Pressure Control Positive Deviation',
  'P1558': 'Throttle Actuator Electrical Malfunction',
  'P1559': 'Idle Speed Control Throttle Position Adaptation Malfunction',
  'P1560': 'Maximum Engine Speed Exceeded',
  'P1564': 'Idle Speed Control Throttle Position Low Voltage During Adaptation',
  'P1565': 'Idle Speed Control Throttle Position Lower Limit Not Attained',
  'P1568': 'Idle Speed Control Throttle Position Mechanical Malfunction',
  'P1569': 'Cruise Control Switch Incorrect Signal',
  'P1570': 'Control Module Locked',
  'P1580': 'Throttle Actuator B1 Malfunction',
  'P1582': 'Idle Adaptation At Limit',
  'P1602': 'Power Supply B+ Terminal 30 Low Voltage',
  'P1603': 'Internal Control Module Malfunction',
  'P1604': 'Internal Control Module Driver Error',
  'P1606': 'Rough Road/Engine Torque Signal Electrical Malfunction',
  'P1609': 'Crash Shut-Off Activated',
  'P1611': 'MIL Call-up Circuit/Transmission Control Module Short to Ground',
  'P1612': 'Electronic Control Module Incorrect Coding',
  'P1613': 'MIL Call-up Circuit Open/Short to B+',
  'P1624': 'MIL Request Signal Active',
  'P1626': 'Data Bus Powertrain Missing Message from Transmission Control',
  'P1628': 'Data Bus Powertrain Missing Message from Fuel Pump',
  'P1629': 'Data Bus Powertrain Missing Message from Engine Control',
  'P1630': 'Accelerator Position Sensor 1 Signal Too Low',
  'P1631': 'Accelerator Position Sensor 1 Signal Too High',
  'P1632': 'Accelerator Position Sensor 1+2 Range/Performance',
  'P1633': 'Accelerator Position Sensor 2 Signal Too Low',
  'P1634': 'Accelerator Position Sensor 2 Signal Too High',
  'P1639': 'Accelerator Position Sensor 1+2 Range/Performance',
  'P1640': 'Internal Control Module EEPROM Error',
  'P1649': 'Data Bus Powertrain Missing Message from ABS Control Module',
  'P1676': 'Drive by Wire MIL Circuit Electrical Malfunction',
  'P1677': 'Drive by Wire MIL Circuit Short to B+',
  'P1681': 'Control Unit Programming Not Finished',
  'P1690': 'Malfunction Indication Light Malfunction',
  'P1693': 'Malfunction Indication Light Open Circuit',

  // --- HYUNDAI/KIA SPECIFIC ---
  'P1121': 'Throttle Position Sensor Intermittent High Voltage',
  'P1122': 'Throttle Position Sensor Intermittent Low Voltage',
  'P1123': 'Long Term Fuel Trim Malfunction - Bank 1',
  'P1124': 'Long Term Fuel Trim Malfunction - Bank 2',
  'P1151': 'A/F Sensor-11 Heater Circuit',
  'P1153': 'A/F Sensor-21 Heater Circuit',
  'P1154': 'A/F Sensor-11',
  'P1155': 'A/F Sensor-12 (Bank1 Sensor2)',
  'P1157': 'A/F Sensor-11 Lean Shift Monitoring',
  'P1158': 'A/F Sensor-11 Rich Shift Monitoring',
  'P1159': 'A/F Sensor-11 Slow Response',
  'P1166': 'A/F Sensor-21 Lean Shift Monitoring',
  'P1167': 'A/F Sensor-21 Rich Shift Monitoring',
  'P1168': 'A/F Sensor-21 Slow Response',
  'P1193': 'EGR Boost Sensor Circuit Input High',
  'P1194': 'EGR Boost Sensor Circuit Input Low',
  'P1195': 'EGR Boost/Baro Sensor Correlation',
  'P1211': 'IMRC (Intake Manifold Runner Control) System',
  'P1212': 'IMRC System Low RPM',
  'P1213': 'IMRC System High RPM',
  'P1226': 'Fuel Injector Control Circuit',
  'P1230': 'Fuel Pump Primary Circuit',
  'P1234': 'Fuel Pump Secondary Circuit',
  'P1301': 'Catalyst System Efficiency Below Threshold Bank 1',
  'P1302': 'Catalyst System Efficiency Below Threshold Bank 2',
  'P1307': 'Chassis Acceleration Sensor Circuit',
  'P1308': 'Chassis Acceleration Sensor Performance',
  'P1336': 'CSA (Crankshaft Acceleration) Sensor',
  'P1402': 'EGR Valve Position Sensor Circuit',
  'P1403': 'EGR Valve Position Sensor Circuit Low',
  'P1404': 'EGR Valve Position Sensor Circuit High',
  'P1507': 'IAC Valve Circuit',
  'P1508': 'IAC Valve Circuit Low Input',
  'P1509': 'IAC Valve Circuit High Input',
  'P1513': 'A/C Idle Up Control Circuit',
  'P1523': 'VICS (Variable Induction Control System) Solenoid',
  'P1529': 'CVVT System',
  'P1552': 'Variable Intake Motor',
  'P1553': 'VIS (Variable Intake Solenoid) Valve Circuit',
  'P1586': 'A/T-M/T Codification',
  'P1590': 'Transaxle Range Switch Circuit',
  'P1608': 'PCM Internal Malfunction',
  'P1614': 'Immobilizer Communication Error',
  'P1615': 'Immobilizer Code Mismatch',
  'P1616': 'Immobilizer Antenna Fault',
  'P1617': 'Transponder Key Fault',
  'P1625': 'Immobilizer ID Registration Mismatch',
  'P1665': 'Power Stage Group A',
  'P1670': 'Output Speed Sensor Signal Missing',

  // --- MARUTI SUZUKI SPECIFIC ---
  'P1400': 'Sub Throttle Position Sensor',
  'P1401': 'Sub Throttle Position Sensor Low Input',
  'P1410': 'Secondary Air Injection System',
  'P1451': 'Barometric Pressure Sensor Circuit',
  'P1460': 'Cooling Fan Control',
  'P1506': 'IAC System RPM Higher Than Expected',
  'P1510': 'Backup Power Supply Circuit',
  'P1554': 'Idle Characteristics Not Learned',
  'P1600': 'Serial Communication Error',
  'P1601': 'ECM/TCM Communication Error',
  'P1605': 'Knock Sensor Circuit',
  'P1620': 'ROM/RAM Error',
  'P1621': 'Control Module Read Only Memory',
  'P1622': 'Control Module Random Access Memory',
  'P1650': 'EMS-ETACS Communication Error',
  'P1652': 'Idle Air Control Valve Opening Coil 1',
  'P1656': 'Idle Air Control Valve Closing Coil',

  // --- MAHINDRA SPECIFIC ---
  'P1189': 'Engine Oil Pressure Switch Circuit',
  'P1191': 'Air Intake System Leak',
  'P1235': 'Fuel Pressure Out of Range',
  'P1261': 'Cylinder 1 High to Low Side Short',
  'P1262': 'Cylinder 2 High to Low Side Short',
  'P1263': 'Cylinder 3 High to Low Side Short',
  'P1264': 'Cylinder 4 High to Low Side Short',
  'P1405': 'EGR Stuck Open',
  'P1441': 'EVAP System Flow During Non-Purge',
  'P1607': 'MIL Control Circuit',
  'P1610': 'Engine Coolant Blower Motor Circuit',
  'P1618': 'Main Relay Contact',
  'P1619': 'Generator Control Circuit',
  'P1623': 'NATS Learning Not Completed',
  'P1627': 'Fuel Injector Group 1 Supply Voltage',

  // --- TATA MOTORS SPECIFIC ---
  'P1217': 'Engine Coolant Over Temperature Condition',
  'P1220': 'Throttle Position Sensor 2 Circuit',
  'P1221': 'Throttle Position Sensor 1-2 Correlation',
  'P1222': 'Injector Control Pressure Too High',
  'P1223': 'Pedal Demand Sensor A Circuit',
  'P1224': 'Pedal Demand Sensor A Performance',
  'P1225': 'Pedal Demand Sensor A Circuit Low',
  'P1227': 'Pedal Demand Sensor B Circuit',
  'P1228': 'Pedal Demand Sensor B Circuit Low',
  'P1229': 'Pedal Demand Sensor B Circuit High',
  'P1236': 'Fuel Rail Pressure Above Expected Level',
  'P1237': 'Fuel Rail Pressure Below Expected Level',
  'P1244': 'Fuel Delivery Metering System',
  'P1266': 'CAN Communication Bus Off',
  'P1267': 'Fuel Level Input Low',
  'P1268': 'Fuel Level Sensor Circuit Malfunction',
  'P1270': 'Engine RPM/Vehicle Speed Limiter Reached',
  'P1273': 'EGR Insufficient Flow',
  'P1274': 'EGR System Flow Malfunction',
  'P1295': 'Throttle Position Sensor 1 or 2 Malfunction',
  'P1335': 'CMP Sensor Circuit Malfunction',
  'P1392': 'Glow Plug Circuit Open',
  'P1393': 'Glow Plug Circuit Short',
  'P1394': 'Glow Plug Relay Circuit Open',
  'P1395': 'Glow Plug Relay Circuit Short',
  'P1396': 'Glow Plug Control Module Communication',
  'P1430': 'EGR Position Sensor Circuit Low',
  'P1431': 'EGR Position Sensor Circuit High',
  'P1462': 'EGR Position Sensor Circuit',
  'P1504': 'Idle Air Control Valve Circuit',
  'P1518': 'Starter Cut Relay Malfunction',
  'P1537': 'A/C Control Module Communication',
  'P1562': 'TCU Communication Error',
  'P1575': 'Pedal Position Sensor Signals',
  'P1585': 'Cruise Control Release Switch Error',
  'P1654': 'A/C Relay Circuit',
  'P1655': 'Starter Motor Relay Circuit',
  'P1698': 'CAN Bus Failure with TCM',

  // --- TOYOTA/LEXUS SPECIFIC ---
  'P1100': 'BARO Sensor Circuit',
  'P1120': 'Accelerator Pedal Position Sensor Circuit',
  'P1125': 'Throttle Control Motor Circuit',
  'P1126': 'Magnetic Clutch Circuit',
  'P1129': 'Electric Throttle Control System',
  'P1130': 'A/F Sensor (Bank 1 Sensor 1) Circuit Range/Performance',
  'P1133': 'A/F Sensor Circuit Response (Bank 1 Sensor 1)',
  'P1135': 'A/F Sensor Heater Circuit (Bank 1 Sensor 1)',
  'P1150': 'A/F Sensor (Bank 2 Sensor 1) Circuit Range/Performance',
  'P1200': 'Fuel Pump Circuit',
  'P1300': 'Igniter Circuit (Bank 1)',
  'P1305': 'Igniter Circuit (Bank 2)',
  'P1310': 'Igniter Circuit',
  'P1315': 'Igniter Circuit',
  'P1320': 'Igniter Circuit',
  'P1325': 'Igniter Circuit',
  'P1330': 'Igniter Circuit',
  'P1346': 'VVT Sensor (Bank 1) Range/Performance',
  'P1349': 'VVT System (Bank 1)',
  'P1350': 'VVT Sensor (Bank 2) Circuit',
  'P1351': 'VVT Sensor (Bank 2) Range/Performance',
  'P1354': 'VVT System (Bank 2)',
  'P1411': 'EGR Position Sensor Rationality',
  'P1520': 'Stop Light Switch Circuit',

  // --- HONDA/ACURA SPECIFIC ---
  'P1106': 'BARO Sensor Circuit Range/Performance',
  'P1107': 'BARO Sensor Circuit Low',
  'P1108': 'BARO Sensor Circuit High',
  'P1149': 'Primary HO2S (Sensor 1) Circuit Range/Performance',
  'P1162': 'Primary HO2S (Sensor 1) Circuit Slow Response',
  'P1163': 'Primary HO2S (Sensor 1) Circuit Slow Response',
  'P1164': 'A/F Sensor (Sensor 1) Range/Performance',
  'P1165': 'A/F Sensor (Sensor 1) Range/Performance',
  'P1169': 'Primary HO2S Sensor 1 Label Circuit High',
  'P1241': 'Throttle Valve Control Motor 1',
  'P1242': 'Throttle Valve Control Motor 2',
  'P1243': 'Insufficient Throttle Position Detected',
  'P1246': 'Accelerator Position Sensor 1 Circuit',
  'P1247': 'Accelerator Position Sensor 2 Circuit',
  'P1248': 'Accelerator Position Sensor 1-2 Correlation',
  'P1253': 'VTEC System Malfunction',
  'P1257': 'VTEC System Malfunction',
  'P1259': 'VTEC System Malfunction',
  'P1298': 'ELD Circuit High',
  'P1337': 'CSF Sensor No Signal',
  'P1359': 'CKP-TDC Sensor Connector Disconnection',
  'P1361': 'TDC Sensor 1 Intermittent Interruption',
  'P1362': 'TDC Sensor 1 No Signal',
  'P1366': 'TDC Sensor 2 Intermittent Interruption',
  'P1367': 'TDC Sensor 2 No Signal',
  'P1381': 'CYP Sensor Intermittent Interruption',
  'P1382': 'CYP Sensor No Signal',
  'P1456': 'EVAP System Leak Detected (Fuel Tank)',
  'P1457': 'EVAP System Leak Detected (Control Canister)',
  'P1459': 'EVAP Purge Flow Switch Malfunction',
  'P1486': 'Thermostat Range/Performance',
  'P1491': 'EGR Valve Lift Insufficient Detected',
  'P1498': 'EGR Valve Lift Position Sensor High',
  'P1678': 'FPCM Disconnection',
  'P1682': 'A/T FI Signal A',

  // --- NISSAN/INFINITI/DATSUN SPECIFIC ---
  'P1105': 'MAP/BARO Switch Solenoid',
  'P1110': 'Intake Valve Timing Control',
  'P1111': 'Intake Valve Timing Control Circuit',
  'P1112': 'Intake Valve Timing Control Position Sensor',
  'P1113': 'Exhaust Valve Timing Control',
  'P1114': 'Exhaust Valve Timing Control Circuit',
  'P1115': 'Exhaust Valve Timing Control Position Sensor',
  'P1140': 'Intake Valve Timing Control Bank 2',
  'P1145': 'Intake Valve Timing Control Bank 2 Position Sensor',
  'P1146': 'Intake Valve Timing Control Bank 2 Target Error',
  'P1147': 'Exhaust Valve Timing Control Bank 2',
  'P1148': 'Closed Loop Control Function Bank 1',
  'P1210': 'Traction Control Signal',
  'P1440': 'EVAP Small Leak',
  'P1443': 'EVAP Canister Purge Volume Control Solenoid',
  'P1444': 'EVAP Canister Purge Volume Control Solenoid',
  'P1445': 'EVAP Canister Purge Volume Control Solenoid',
  'P1446': 'EVAP Canister Vent Control Valve',
  'P1447': 'EVAP Control System Purge Volume Control Valve Circuit',
  'P1448': 'EVAP Control System Vent Control Circuit',
  'P1490': 'Vacuum Cut Valve Bypass Valve',
  'P1492': 'EVAP Canister Purge Control/Solenoid',
  'P1493': 'EVAP Canister Purge Control Valve',
  'P1550': 'Battery Direct Monitor Circuit',
  'P1551': 'A/T Driving Position Signal',
  'P1572': 'Brake Pedal Switch Circuit',
  'P1574': 'ASCD Vehicle Speed Sensor',
  'P1705': 'Throttle Position Sensor A/T',
  'P1706': 'PNP Switch Circuit',

  // --- BMW/MINI SPECIFIC ---
  'P1083': 'Fuel Control Mixture Lean',
  'P1084': 'Fuel Control Mixture Rich',
  'P1085': 'Fuel Control Mixture Lean',
  'P1086': 'Fuel Control Mixture Rich',
  'P1188': 'Fuel Rail Pressure Sensor Circuit',
  'P1219': 'Throttle Actuator Motor Current',
  'P1344': 'Misfire Cylinder 2 With Fuel Cut-Off',
  'P1348': 'Misfire Cylinder 6 With Fuel Cut-Off',
  'P1397': 'Camshaft Position Sensor Bank 2',
  'P1417': 'Secondary Air Mass Flow Sensor',
  'P1418': 'Secondary Air Mass Flow Sensor',
  'P1501': 'Idle Speed Control Valve Closing Coil',
  'P1524': 'Intake Camshaft Control Bank 2',
  'P1530': 'A/C Pressure Sensor Circuit',
  'P1542': 'Throttle Actuator Control Range',
  'P1637': 'Exhaust Camshaft Control Bank 1',
  'P1638': 'Exhaust Camshaft Control Bank 2',
  'P1679': 'Drive by Wire ECU',

  // --- MERCEDES-BENZ SPECIFIC ---
  'P1031': 'Intake Manifold Switchover Valve',
  'P1032': 'HO2S Heater Circuit Short (Bank 1 Sensor 1)',
  'P1033': 'HO2S Heater Circuit Short (Bank 2 Sensor 1)',
  'P1131': 'O2 Sensor Signal Inverted (Bank 2)',
  'P1186': 'ME-SFI Control Module',
  'P1187': 'ME-SFI Control Module',
  'P1280': 'A/C Refrigerant Pressure Circuit High',
  'P1281': 'A/C Refrigerant Pressure Circuit Low',
  'P1442': 'Fuel Tank Level Too Low',
  'P1453': 'Atmospheric Pressure',
  'P1455': 'A/C-Heat Evaporator Temp. Sensor',
  'P1463': 'Air Pump',
  'P1469': 'Air Pump Relay Circuit',
  'P1470': 'Leak Diagnostic Pump',
  'P1581': 'Idle Speed Not Obtained',
  'P1587': 'Idle Speed',
  'P1635': 'Accelerator Position',
  'P1636': 'Accelerator Position',

  // --- FORD/LINCOLN SPECIFIC ---
  'P1000': 'OBD Systems Readiness Test Not Complete',
  'P1101': 'MAF Sensor Out of Self-Test Range',
  'P1116': 'ECT Sensor Out of Self-Test Range',
  'P1117': 'ECT Sensor Intermittent',
  'P1132': 'Lack of HO2S-11 Switch - Sensor Indicates Rich',
  'P1138': 'Lack of HO2S-12 Switch - Sensor Indicates Rich',
  'P1152': 'Lack of HO2S-21 Switch - Sensor Indicates Rich',
  'P1233': 'Fuel Pump Driver Module Off-Line',
  'P1238': 'Fuel Pump Secondary Circuit',
  'P1260': 'THEFT Detected - Vehicle Immobilized',
  'P1285': 'CHT Over Temperature Condition',
  'P1289': 'CHT Sensor High Input',
  'P1290': 'CHT Sensor Low Input',
  'P1299': 'CHT Sensor High/Temperature exceeded',
  'P1309': 'Misfire Monitor AICE Chip Disabled',
  'P1406': 'DPFE Sensor Downstream Hose Off Or Plugged',
  'P1407': 'EGR No Flow Detected',
  'P1408': 'EGR Flow Out Of Self-Test Range',
  'P1409': 'EGR Vacuum Regulator Solenoid Circuit',
  'P1461': 'A/C Pressure Sensor High',
  'P1464': 'A/C Demand Out of Self-Test Range',
  'P1474': 'Low Fan Control Primary Circuit',
  'P1538': 'Intake Manifold Runner Control Malfunction (Bank 1 Stuck Closed)',
  'P1539': 'Power to A/C Clutch Circuit Overcurrent',
  'P1549': 'IMRC Output Circuit',
  'P1651': 'PSP Switch Input Malfunction',
  'P1701': 'Reverse Engagement Error',
  'P1703': 'Brake Switch Out of Self-Test Range',
  'P1709': 'PNP Switch Out of Self-Test Range',
  'P1729': '4x4 Low Switch Error',
  'P1744': 'Torque Converter Clutch System Performance',
  'P1747': 'EPC Solenoid Open Circuit',
  'P1751': 'Shift Solenoid A Performance',
  'P1756': 'Shift Solenoid B Performance',

  // --- JEEP/CHRYSLER/DODGE SPECIFIC ---
  'P1282': 'Fuel Pump Relay Control Circuit',
  'P1283': 'Idle Select Signal Invalid',
  'P1284': 'Fuel Injection Pump Battery Supply',
  'P1286': 'Accelerator Pedal Position Sensor 1 Supply Circuit',
  'P1288': 'Intake Air Temperature Sensor 2 Circuit High',
  'P1291': 'No Temp Rise Seen From Intake Heaters',
  'P1292': 'CNG Pressure Sensor Voltage Too High',
  'P1293': 'CNG Pressure Sensor Voltage Too Low',
  'P1294': 'Target Idle Not Reached',
  'P1389': 'No Auto Shutdown Relay Output Voltage',
  'P1390': 'Timing Belt Skipped 1 Tooth Or More',
  'P1391': 'Intermittent Loss Of CMP Or CKP',
  'P1398': 'Misfire Adaptive Numerator at Limit',
  'P1399': 'Wait To Start Lamp Circuit',
  'P1489': 'High Speed Rad Fan Ctrl Relay Circuit',
  'P1494': 'EVAP Leak Detection Pump Sw or Mechanical',
  'P1495': 'EVAP Leak Detection Pump Solenoid Circuit',
  'P1496': '5-Volt Supply Output Too Low',
  'P1499': 'Hydraulic Cooling Fan Solenoid Circuit',
  'P1594': 'Charging System Voltage Too High',
  'P1595': 'Speed Control Solenoid Circuits',
  'P1596': 'Speed Control Switch Always High',
  'P1597': 'Speed Control Switch Always Low',
  'P1598': 'A/C Pressure Sensor Volts Too High',
  'P1599': 'A/C Pressure Sensor Volts Too Low',
  'P1685': 'SKIM Invalid Key',
  'P1686': 'SKIM Not Learned',
  'P1687': 'No SKIM Bus Message',
  'P1688': 'Internal Fuel Injection Pump Controller',
  'P1689': 'No Communication With SKIM',
  'P1691': 'Fuel Injection Pump Controller Calibration',
  'P1694': 'No CCD Bus Message Received From TCM',
  'P1695': 'No CCD Bus Message From Body Control Module',
  'P1696': 'PCM Failure - EEPROM Write Denied',
};

/**
 * Get the component/module name that typically reports this DTC
 * Based on SAE J2012 code structure
 */
export function getComponentForDTC(code: string): string {
  if (!code || code.length < 2) return 'Unknown Module';
  
  const category = code[0].toUpperCase();
  const upperCode = code.toUpperCase();
  
  // Check for specific component mappings first
  const specificComponent = DTC_COMPONENT_MAP[upperCode];
  if (specificComponent) return specificComponent;
  
  // Fall back to category-based component
  const systemDigit = code.length > 2 ? code[2] : '0';
  
  switch (category) {
    case 'P':
      // P07xx and P08xx are transmission codes
      if (systemDigit === '7' || systemDigit === '8') {
        return 'Transmission Control Module (TCM)';
      }
      // P0Axx are hybrid/EV codes
      if (systemDigit.toUpperCase() === 'A') {
        return 'Hybrid/EV Control Module';
      }
      return 'Engine Control Module (ECM)';
    case 'C':
      // C00xx-C01xx are ABS
      if (systemDigit === '0' || systemDigit === '1') {
        return 'ABS/ESP Control Module';
      }
      // C02xx is steering
      if (systemDigit === '2') {
        return 'Power Steering Module (EPS)';
      }
      return 'Chassis Control Module';
    case 'B':
      // B00xx-B01xx are airbag/restraints
      if (systemDigit === '0' || systemDigit === '1') {
        return 'Airbag/SRS Module';
      }
      // B02xx is body electronics
      if (systemDigit === '2') {
        return 'Body Control Module (BCM)';
      }
      // B03xx is HVAC
      if (systemDigit === '3') {
        return 'HVAC Control Module';
      }
      // B04xx is instrument panel
      if (systemDigit === '4') {
        return 'Instrument Panel Cluster (IPC)';
      }
      // B1xxx manufacturer-specific body codes
      if (code[1] === '1' || code[1] === '2') {
        // Check for common patterns
        if (upperCode.startsWith('B16')) return 'PATS/Immobilizer Module';
        if (upperCode.startsWith('B26')) return 'Instrument Panel Cluster (IPC)';
        if (upperCode.startsWith('B19')) return 'Body Control Module (BCM)';
        return 'Body Control Module (BCM)';
      }
      return 'Body Control Module (BCM)';
    case 'U':
      return 'CAN Bus/Gateway Module';
    default:
      return 'Unknown Module';
  }
}

/**
 * Specific component mappings for known DTCs
 */
const DTC_COMPONENT_MAP: Record<string, string> = {
  // Engine codes
  'P0016': 'Engine Control Module (ECM)',
  'P0017': 'Engine Control Module (ECM)',
  'P0018': 'Engine Control Module (ECM)',
  'P0019': 'Engine Control Module (ECM)',
  'P001C': 'Engine Control Module (ECM)',
  'P001D': 'Engine Control Module (ECM)',
  'P002B': 'Engine Control Module (ECM)',
  'P0300': 'Engine Control Module (ECM)',
  'P0335': 'Engine Control Module (ECM)',
  'P0340': 'Engine Control Module (ECM)',
  
  // Transmission codes
  'P0700': 'Transmission Control Module (TCM)',
  'P0730': 'Transmission Control Module (TCM)',
  'P0741': 'Transmission Control Module (TCM)',
  
  // Body codes - Ford/Lincoln specific
  'B1600': 'PATS/Immobilizer Module',
  'B1601': 'PATS/Immobilizer Module',
  'B1602': 'PATS/Immobilizer Module',
  'B1681': 'PATS/Immobilizer Module',
  'B2680': 'Instrument Panel Cluster (IPC)',
  'B1900': 'Body Control Module (BCM)',
  
  // Chassis codes
  'C2921': 'ABS/ESP Control Module',
  'C2922': 'ABS/ESP Control Module',
  
  // Manufacturer-specific powertrain
  'P3400': 'Engine Control Module (ECM)',
};

/**
 * Get description for a DTC code
 * Returns the description or a generic one if not found
 */
export function getDTCDescription(code: string): string {
  const upperCode = code.toUpperCase();
  
  // Check database first
  if (DTC_DESCRIPTIONS[upperCode]) {
    return DTC_DESCRIPTIONS[upperCode];
  }
  
  // Generate generic description based on code structure
  return generateGenericDescription(upperCode);
}

/**
 * Generate a generic description for unknown codes
 */
function generateGenericDescription(code: string): string {
  if (!code || code.length < 4) return 'Unknown Diagnostic Code';
  
  const category = code[0];
  const firstDigit = parseInt(code[1]);
  const isManufacturerSpecific = firstDigit === 1 || firstDigit === 3;
  
  let categoryName = '';
  switch (category) {
    case 'P': categoryName = 'Powertrain'; break;
    case 'C': categoryName = 'Chassis'; break;
    case 'B': categoryName = 'Body'; break;
    case 'U': categoryName = 'Network Communication'; break;
    default: categoryName = 'Unknown';
  }
  
  const typeStr = isManufacturerSpecific ? 'Manufacturer-Specific' : 'Generic';
  return `${categoryName} ${typeStr} Code ${code}`;
}

/**
 * DTC Severity Classification
 * 
 * CRITICAL: Codes that can cause immediate safety issues, engine damage, or vehicle breakdown
 * IMPORTANT: Codes that affect performance or emissions but vehicle is still drivable
 * NON_CRITICAL: Codes related to comfort features, minor sensors, or informational
 */
export type DTCSeverity = 'CRITICAL' | 'IMPORTANT' | 'NON_CRITICAL';

// Critical DTC patterns - safety and engine protection
const CRITICAL_PATTERNS = [
  // Engine critical failures
  /^P0[0-3][0-5][0-9]$/, // Fuel and air metering - can cause engine damage
  /^P0[1][0-9][0-9]$/, // Fuel trim issues
  /^P0300$/, // Random/Multiple cylinder misfire - engine damage
  /^P030[1-9]$/, // Cylinder misfire
  /^P031[0-9]$/, // Cylinder misfire
  /^P0335$/, // Crankshaft position sensor - no start
  /^P0336$/, // Crankshaft position sensor range
  /^P0340$/, // Camshaft position sensor - no start
  /^P0341$/, // Camshaft position sensor range
  /^P050[0-9]$/, // Idle control issues
  /^P06[0-9][0-9]$/, // PCM/ECM internal failures
  /^P062F$/, // EEPROM error - critical
  /^P1000$/, // OBD system not ready
  
  // Transmission critical
  /^P07[0-9][0-9]$/, // Transmission mechanical failures
  /^P08[0-9][0-9]$/, // Transmission electronic failures
  
  // Safety systems
  /^C0[0-9][0-9][0-9]$/, // ABS system failures
  /^C1[0-9][0-9][0-9]$/, // ABS manufacturer specific
  /^B0[0-9][0-9][0-9]$/, // Airbag/SRS system
  
  // Cooling system - engine protection
  /^P011[5-9]$/, // Coolant temperature issues
  /^P0125$/, // Insufficient coolant temp
  /^P0217$/, // Engine overheating
  
  // Oil pressure - engine protection
  /^P052[0-9]$/, // Oil pressure issues
  
  // Fuel system critical
  /^P008[0-9]$/, // Fuel rail pressure
  /^P0087$/, // Fuel rail pressure too low
  /^P0088$/, // Fuel rail pressure too high
  /^P019[0-9]$/, // Fuel rail pressure sensor
  /^P023[0-9]$/, // Fuel pump issues
  
  // Turbo/Supercharger
  /^P0234$/, // Turbo overboost
  /^P0299$/, // Turbo underboost
];

// Important DTC patterns - affects performance/emissions but drivable
const IMPORTANT_PATTERNS = [
  // Emissions related
  /^P04[0-9][0-9]$/, // EGR system
  /^P041[0-9]$/, // Secondary air injection
  /^P042[0-9]$/, // Catalyst efficiency
  /^P043[0-9]$/, // Evaporative emission system
  /^P044[0-9]$/, // EVAP system
  /^P045[0-9]$/, // EVAP system
  
  // Oxygen sensors
  /^P013[0-9]$/, // O2 sensor
  /^P014[0-9]$/, // O2 sensor
  /^P015[0-9]$/, // O2 sensor
  /^P016[0-9]$/, // O2 sensor
  /^P022[0-9]$/, // Throttle position
  /^P023[0-9]$/, // Throttle position
  
  // MAF/MAP sensors
  /^P010[0-9]$/, // MAF sensor
  /^P0105$/, // MAP sensor
  /^P0106$/, // MAP sensor range
  /^P0107$/, // MAP sensor low
  /^P0108$/, // MAP sensor high
  
  // VVT/Timing
  /^P001[0-9]$/, // Camshaft timing
  /^P002[0-9]$/, // Camshaft timing
  
  // Knock sensor
  /^P032[0-9]$/, // Knock sensor
  
  // Transmission performance
  /^P073[0-9]$/, // Gear ratio incorrect
  /^P074[0-9]$/, // Torque converter
  /^P075[0-9]$/, // Shift solenoid
  
  // Brake system (non-ABS)
  /^C[1-2][0-9][0-9][0-9]$/, // Chassis manufacturer codes
  
  // Network critical
  /^U0[0-1][0-9][0-9]$/, // CAN bus issues
  /^U010[0-9]$/, // Lost communication with ECM
  /^U011[0-9]$/, // Lost communication with TCM
  /^U012[0-9]$/, // Lost communication with ABS
];

/**
 * Get the severity level of a DTC code
 * 
 * @param code - The DTC code (e.g., "P0300", "B1601")
 * @returns The severity level: 'CRITICAL', 'IMPORTANT', or 'NON_CRITICAL'
 */
export function getDTCSeverity(code: string): DTCSeverity {
  const upperCode = code.toUpperCase();
  
  // Check critical patterns first
  for (const pattern of CRITICAL_PATTERNS) {
    if (pattern.test(upperCode)) {
      return 'CRITICAL';
    }
  }
  
  // Check important patterns
  for (const pattern of IMPORTANT_PATTERNS) {
    if (pattern.test(upperCode)) {
      return 'IMPORTANT';
    }
  }
  
  // Default classification based on code type
  const category = upperCode[0];
  
  // Safety-related categories default to higher severity
  if (category === 'C') {
    // Chassis codes - ABS, stability control
    return 'IMPORTANT';
  }
  
  if (category === 'B' && upperCode[1] === '0') {
    // B0xxx are generic body codes (often airbag)
    return 'CRITICAL';
  }
  
  if (category === 'U' && upperCode[1] === '0') {
    // U0xxx are network communication - can affect safety systems
    return 'IMPORTANT';
  }
  
  // Default to NON_CRITICAL for comfort/convenience codes
  return 'NON_CRITICAL';
}

/**
 * Get severity display info for UI
 */
export function getSeverityInfo(severity: DTCSeverity): {
  label: string;
  color: string;
  icon: string;
  priority: number;
} {
  switch (severity) {
    case 'CRITICAL':
      return {
        label: 'Critical',
        color: '#DC2626', // Red
        icon: 'error',
        priority: 1,
      };
    case 'IMPORTANT':
      return {
        label: 'Important',
        color: '#F59E0B', // Amber
        icon: 'warning',
        priority: 2,
      };
    case 'NON_CRITICAL':
      return {
        label: 'Non-Critical',
        color: '#10B981', // Green
        icon: 'info',
        priority: 3,
      };
  }
}
