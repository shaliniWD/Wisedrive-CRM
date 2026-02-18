// Enhanced inspection report data with proper checkpoint structure
// Each checkpoint can be: qa, photo (with optional qa), video (with optional qa)

export const inspectionReportData = {
  // Header/Summary
  header: {
    reportFor: "Discover Plus",
    customerName: "Rahul Sharma",
    customerPhone: "+91 98765 43210",
    vehicleNumber: "AP28CF0270",
    inspectionRequestedDate: "28-Jan-2026",
    inspectedOn: "01-Feb-2026",
    inspectedBy: "Arun Kumar",
    inspectionType: "Comprehensive",
    location: "Hyderabad",
    marketValue: {
      min: 440000,
      max: 480000,
      currency: "₹"
    },
    recommendedToBuy: false,
    overallRating: 6.9,
    checkpointsInspected: 200,
    isPublished: false,
    lastSaved: "01-Feb-2026 14:30"
  },

  // Vehicle Information
  vehicleInfo: {
    make: "TOYOTA KIRLOSKAR MOTOR PVT LTD",
    model: "TOYOTA FORTUNER 3.0L 4WD MT BS",
    year: 2011,
    mfgDate: "01/2011",
    fuel: "DIESEL",
    transmission: "Manual",
    owners: 2,
    regNo: "AP28CF0270",
    colour: "SILVER MICA METALLIC",
    regDate: "05-Feb-2011",
    engineCC: 2982,
    engineNo: "1KD6706795",
    chassisNo: "MBJ11JV5105015911~0111"
  },

  // AI Generated Assessment Summary
  assessmentSummary: {
    paragraph: "This 2011 Toyota Fortuner has been thoroughly inspected across 200+ checkpoints. The vehicle shows signs of heavy usage with 2,85,859 km on the odometer. While the structural integrity remains intact, several critical issues require immediate attention including ABS system faults, leaking rear shock absorbers, and significant interior wear. The engine produces heavy black exhaust smoke indicating potential turbocharger or fuel injection issues. Overall, this vehicle is NOT recommended for purchase without addressing the estimated ₹46,500 in repairs.",
    keyHighlights: [
      { type: "critical", text: "ABS/VSC system fault detected (Code C1241)" },
      { type: "critical", text: "Rear shock absorbers leaking - immediate replacement needed" },
      { type: "warning", text: "Heavy black exhaust smoke - engine diagnostics recommended" },
      { type: "warning", text: "AC not cooling properly - compressor inspection needed" },
      { type: "warning", text: "Interior seats have significant tears and wear" },
      { type: "info", text: "No accident or flood damage history" },
      { type: "info", text: "All RTO verifications clear - no challans or hypothecation" }
    ]
  },

  // Key Information - Enhanced
  keyInfo: {
    kmsDriven: 285859,
    engineCondition: "AVERAGE",
    interiorCondition: "AVERAGE",
    transmission: "GOOD",
    exteriorCondition: "AVERAGE",
    accident: false,
    floodDamage: false,
    dentsScratches: true,
    
    insurance: {
      status: "Expired",
      insurerName: "ICICI Lombard General Insurance",
      policyNumber: "3001/00123456/00/000",
      expiryDate: "05-Feb-2025",
      policyType: "Comprehensive",
      idvValue: 520000
    },
    
    tyreDetails: {
      avgLife: 54,
      tyres: [
        { position: "Front Left", treadLife: 55, brand: "MRF", photo: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400" },
        { position: "Front Right", treadLife: 52, brand: "MRF", photo: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400" },
        { position: "Rear Left", treadLife: 54, brand: "MRF", photo: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400" },
        { position: "Rear Right", treadLife: 55, brand: "MRF", photo: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400" }
      ]
    },
    
    repairs: [
      { id: 1, type: "minor", serviceType: "spare_part", description: "AC Compressor Clutch", cost: 8500 },
      { id: 2, type: "minor", serviceType: "labor", description: "AC Gas Refill & Service", cost: 2500 },
      { id: 3, type: "minor", serviceType: "spare_part", description: "Cabin Air Filter", cost: 1200 },
      { id: 4, type: "minor", serviceType: "spare_part", description: "Engine Oil + Filter", cost: 5500 },
      { id: 5, type: "minor", serviceType: "spare_part", description: "Brake Pads (Front)", cost: 4500 },
      { id: 6, type: "minor", serviceType: "labor", description: "Interior Deep Cleaning", cost: 3500 },
      { id: 7, type: "minor", serviceType: "spare_part", description: "Steering Control Module", cost: 9300 },
      { id: 8, type: "major", serviceType: "spare_part", description: "Rear Shock Absorbers (Pair)", cost: 6500 },
      { id: 9, type: "major", serviceType: "labor", description: "Turbo Inspection & Repair", cost: 5000 }
    ]
  },

  // RTO Verification
  rtoVerification: {
    trafficChallans: 0,
    hypothecation: true,
    financierName: "HDFC Bank Ltd",
    blacklistStatus: false,
    bankNOC: "Required"
  },

  // OBD-2 Scanning Report
  obdReport: {
    totalErrors: 8,
    systems: [
      {
        name: "ABS / Braking System",
        icon: "Shield",
        errorCount: 2,
        faults: [
          {
            code: "C1241",
            severity: "critical",
            status: "Active",
            description: "Low battery voltage detected in ABS control module",
            possibleCauses: ["Faulty charging system", "Faulty ABS control module", "Poor battery connections"],
            symptoms: ["ABS Light ON", "VSC warning light illuminated"],
            solutions: ["Check battery and wiring to ABS control module", "Test alternator output voltage", "If fault persists, check ABS control module"]
          },
          {
            code: "C1249",
            severity: "warning",
            status: "Pending",
            description: "Open circuit in stop light switch",
            possibleCauses: ["Faulty brake light switch", "Wiring issue"],
            symptoms: ["Brake lights may not function"],
            solutions: ["Inspect and replace brake light switch"]
          }
        ]
      },
      {
        name: "Engine Management",
        icon: "Settings",
        errorCount: 3,
        faults: [
          {
            code: "P0299",
            severity: "critical",
            status: "Active",
            description: "Turbocharger underboost condition",
            possibleCauses: ["Turbo wastegate stuck", "Boost leak in intercooler piping", "Faulty turbo actuator"],
            symptoms: ["Reduced power", "Black smoke from exhaust"],
            solutions: ["Check turbo wastegate operation", "Inspect boost pipes for leaks"]
          },
          {
            code: "P0401",
            severity: "warning",
            status: "Active",
            description: "EGR flow insufficient",
            possibleCauses: ["Clogged EGR valve", "Carbon buildup"],
            symptoms: ["Rough idle", "Increased emissions"],
            solutions: ["Clean or replace EGR valve"]
          },
          {
            code: "P0093",
            severity: "warning",
            status: "Pending",
            description: "Fuel system leak detected",
            possibleCauses: ["Loose fuel cap", "Cracked fuel line"],
            symptoms: ["Fuel smell", "Hard starting"],
            solutions: ["Check fuel cap", "Inspect fuel lines"]
          }
        ]
      },
      {
        name: "Transmission",
        icon: "Cog",
        errorCount: 1,
        faults: [
          {
            code: "P0715",
            severity: "info",
            status: "Stored",
            description: "Input/Turbine speed sensor circuit malfunction",
            possibleCauses: ["Faulty sensor", "Wiring issue"],
            symptoms: ["Erratic shifting"],
            solutions: ["Replace input speed sensor"]
          }
        ]
      },
      {
        name: "Climate Control",
        icon: "Snowflake",
        errorCount: 2,
        faults: [
          {
            code: "B1422",
            severity: "warning",
            status: "Active",
            description: "AC compressor clutch circuit malfunction",
            possibleCauses: ["Faulty compressor clutch", "Low refrigerant"],
            symptoms: ["AC not cooling"],
            solutions: ["Check refrigerant level", "Inspect compressor clutch"]
          },
          {
            code: "B1423",
            severity: "info",
            status: "Stored",
            description: "AC pressure sensor signal out of range",
            possibleCauses: ["Faulty sensor", "Refrigerant leak"],
            symptoms: ["AC cycles frequently"],
            solutions: ["Replace AC pressure sensor"]
          }
        ]
      }
    ]
  },

  // Inspection Categories with proper checkpoint types
  // type: "qa" = Question + Answer only
  // type: "photo" = Capture instruction + Photo + optional follow-up Q&A
  // type: "video" = Capture instruction + Video + optional follow-up Q&A
  inspectionCategories: [
    {
      id: "engine",
      name: "Engine Health",
      icon: "Settings",
      checkpoints: 25,
      rating: 6.5,
      status: "average",
      details: [
        { 
          item: "Engine Tray Rust", 
          status: "good", 
          note: "No rust found",
          type: "qa",
          question: "Is there any rust in the engine tray?",
          answer: "No"
        },
        { 
          item: "Engine Oil Condition", 
          status: "average", 
          note: "Due for change",
          type: "photo",
          captureInstruction: "Take a photo of the engine oil on the dipstick",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200", 
            full: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800" 
          },
          followUpQuestion: "What is the color of the engine oil?",
          followUpAnswer: "Dark brown, due for change"
        },
        { 
          item: "Engine Running Video", 
          status: "average", 
          note: "Heavy black smoke",
          type: "video",
          captureInstruction: "Record a 30-second video of the engine running",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=200", 
            duration: "30s", 
            url: "#" 
          },
          followUpQuestion: "Is there any abnormal smoke from the exhaust?",
          followUpAnswer: "Yes, heavy black smoke observed"
        },
        { 
          item: "Coolant Level", 
          status: "good", 
          note: "Adequate",
          type: "qa",
          question: "Is the coolant level between MIN and MAX marks?",
          answer: "Yes"
        },
        { 
          item: "Engine Belt", 
          status: "good", 
          note: "No cracks",
          type: "photo",
          captureInstruction: "Take a photo of the engine belt",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=200", 
            full: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800" 
          }
        },
        { 
          item: "Turbocharger Check", 
          status: "poor", 
          note: "Underboost detected",
          type: "qa",
          question: "Is the turbocharger producing adequate boost pressure?",
          answer: "No, underboost condition detected"
        },
        { 
          item: "Engine Mount", 
          status: "average", 
          note: "Minor wear",
          type: "photo",
          captureInstruction: "Take a photo of the engine mount",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200", 
            full: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800" 
          },
          followUpQuestion: "Is there any visible damage or cracks on the mount?",
          followUpAnswer: "Minor wear visible, no cracks"
        }
      ]
    },
    {
      id: "transmission",
      name: "Transmission",
      icon: "Cog",
      checkpoints: 8,
      rating: 6,
      status: "average",
      details: [
        { 
          item: "Gear Shifting Video", 
          status: "good", 
          note: "Smooth engagement",
          type: "video",
          captureInstruction: "Record a video showing gear shifts from 1st to 5th",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=200", 
            duration: "30s", 
            url: "#" 
          },
          followUpQuestion: "Are all gears engaging smoothly without grinding?",
          followUpAnswer: "Yes, smooth engagement in all gears"
        },
        { 
          item: "Clutch Condition", 
          status: "average", 
          note: "30% wear",
          type: "qa",
          question: "At what point does the clutch engage (low/mid/high)?",
          answer: "High - indicates approximately 30% clutch wear"
        },
        { 
          item: "Transmission Fluid", 
          status: "good", 
          note: "Level OK",
          type: "photo",
          captureInstruction: "Take a photo of the transmission fluid dipstick",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200", 
            full: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800" 
          },
          followUpQuestion: "What is the fluid color and level?",
          followUpAnswer: "Reddish-pink, level adequate"
        },
        { 
          item: "4WD Engagement", 
          status: "good", 
          note: "Working properly",
          type: "video",
          captureInstruction: "Record video of 4WD engagement and disengagement",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=200", 
            duration: "25s", 
            url: "#" 
          }
        }
      ]
    },
    {
      id: "ac",
      name: "Air Conditioning",
      icon: "Snowflake",
      checkpoints: 7,
      rating: 5,
      status: "poor",
      details: [
        { 
          item: "AC Cooling Test", 
          status: "poor", 
          note: "Not cooling adequately",
          type: "qa",
          question: "What is the AC vent temperature after 5 minutes?",
          answer: "18°C (should be below 10°C)"
        },
        { 
          item: "Compressor Video", 
          status: "average", 
          note: "Clutch engagement weak",
          type: "video",
          captureInstruction: "Record video of AC compressor with clutch engaging",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=200", 
            duration: "15s", 
            url: "#" 
          },
          followUpQuestion: "Is the compressor clutch engaging properly?",
          followUpAnswer: "Weak engagement, may need replacement"
        },
        { 
          item: "Blower Motor", 
          status: "good", 
          note: "All speeds working",
          type: "qa",
          question: "Are all blower speed settings (1-4) working?",
          answer: "Yes, all 4 speeds working correctly"
        },
        { 
          item: "Cabin Filter", 
          status: "average", 
          note: "Needs replacement",
          type: "photo",
          captureInstruction: "Take a photo of the cabin air filter",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200", 
            full: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800" 
          },
          followUpQuestion: "Is the filter dirty or clogged?",
          followUpAnswer: "Yes, dirty and needs replacement"
        }
      ]
    },
    {
      id: "battery",
      name: "Battery Health",
      icon: "Battery",
      checkpoints: 5,
      rating: 8,
      status: "good",
      details: [
        { 
          item: "Battery Voltage", 
          status: "good", 
          note: "12.6V",
          type: "qa",
          question: "What is the battery voltage reading?",
          answer: "12.6V (healthy range: 12.4V - 12.7V)"
        },
        { 
          item: "Battery Terminals", 
          status: "good", 
          note: "Clean, no corrosion",
          type: "photo",
          captureInstruction: "Take a photo of the battery terminals",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200", 
            full: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800" 
          },
          followUpQuestion: "Is there any corrosion on the terminals?",
          followUpAnswer: "No corrosion, terminals are clean"
        },
        { 
          item: "Cranking Power", 
          status: "good", 
          note: "520A CCA",
          type: "qa",
          question: "What is the Cold Cranking Amps (CCA) reading?",
          answer: "520A (specification: 500A minimum)"
        }
      ]
    },
    {
      id: "suspension",
      name: "Suspension & Brakes",
      icon: "CircleDot",
      checkpoints: 11,
      rating: 5,
      status: "poor",
      details: [
        { 
          item: "Front Shock Absorbers", 
          status: "good", 
          note: "No leaks",
          type: "photo",
          captureInstruction: "Take a photo of the front shock absorbers",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=200", 
            full: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800" 
          },
          followUpQuestion: "Is there any oil leakage from the shocks?",
          followUpAnswer: "No leakage detected"
        },
        { 
          item: "Rear Shock Absorbers", 
          status: "poor", 
          note: "Leaking - Replace",
          type: "photo",
          captureInstruction: "Take a photo of the rear shock absorbers",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200", 
            full: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800" 
          },
          followUpQuestion: "Is there any oil leakage from the rear shocks?",
          followUpAnswer: "Yes, visible oil leakage - immediate replacement required"
        },
        { 
          item: "Front Brake Pads", 
          status: "average", 
          note: "40% life remaining",
          type: "qa",
          question: "What is the front brake pad thickness?",
          answer: "4mm remaining (minimum: 2mm, new: 10mm)"
        },
        { 
          item: "ABS System Check", 
          status: "poor", 
          note: "Fault code C1241",
          type: "qa",
          question: "Is the ABS warning light illuminated?",
          answer: "Yes, fault code C1241 stored in system"
        }
      ]
    },
    {
      id: "exterior",
      name: "Exterior",
      icon: "Car",
      checkpoints: 16,
      rating: 7,
      status: "average",
      details: [
        { 
          item: "Body Panels", 
          status: "average", 
          note: "Multiple scratches",
          type: "photo",
          captureInstruction: "Take photos of all body panels (front, rear, sides)",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=200", 
            full: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800" 
          },
          followUpQuestion: "Are there any scratches, dents, or paint damage?",
          followUpAnswer: "Multiple scratches on driver side door and rear bumper"
        },
        { 
          item: "Windshield", 
          status: "good", 
          note: "No cracks",
          type: "qa",
          question: "Are there any chips or cracks on the windshield?",
          answer: "No, windshield is clear"
        },
        { 
          item: "Paint Condition", 
          status: "average", 
          note: "Fading on roof",
          type: "photo",
          captureInstruction: "Take a photo of the roof and bonnet paint",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200", 
            full: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800" 
          },
          followUpQuestion: "Is there any fading or oxidation on the paint?",
          followUpAnswer: "Yes, roof paint shows fading due to sun exposure"
        },
        { 
          item: "Underbody Inspection", 
          status: "good", 
          note: "No rust or damage",
          type: "video",
          captureInstruction: "Record a video of the complete underbody",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=200", 
            duration: "45s", 
            url: "#" 
          },
          followUpQuestion: "Is there any rust or structural damage underneath?",
          followUpAnswer: "No rust or damage found"
        }
      ]
    },
    {
      id: "interior",
      name: "Interior",
      icon: "Armchair",
      checkpoints: 8,
      rating: 5,
      status: "poor",
      details: [
        { 
          item: "Driver Seat", 
          status: "poor", 
          note: "Significant tears",
          type: "photo",
          captureInstruction: "Take a photo of the driver seat",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200", 
            full: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800" 
          },
          followUpQuestion: "Are there any tears, stains, or damage on the seat?",
          followUpAnswer: "Yes, significant tears on the side bolster and seat base"
        },
        { 
          item: "Passenger Seat", 
          status: "poor", 
          note: "Structural wear",
          type: "photo",
          captureInstruction: "Take a photo of the passenger seat",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=200", 
            full: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800" 
          },
          followUpQuestion: "Are there any stains or dust on the seat?",
          followUpAnswer: "Yes, visible wear and structural damage on foam"
        },
        { 
          item: "Dashboard", 
          status: "average", 
          note: "Minor wear",
          type: "photo",
          captureInstruction: "Take a photo of the dashboard",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200", 
            full: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800" 
          },
          followUpQuestion: "Are there any cracks or damage on the dashboard?",
          followUpAnswer: "Minor sun damage, no cracks"
        },
        { 
          item: "Carpet & Floor Mats", 
          status: "average", 
          note: "Needs cleaning",
          type: "qa",
          question: "What is the condition of carpets and floor mats?",
          answer: "Dirty, needs deep cleaning. No tears or damage."
        }
      ]
    },
    {
      id: "electrical",
      name: "Electrical",
      icon: "Radio",
      checkpoints: 12,
      rating: 7,
      status: "average",
      details: [
        { 
          item: "Audio System", 
          status: "good", 
          note: "Working properly",
          type: "qa",
          question: "Are all speakers and audio features working?",
          answer: "Yes, all speakers working, Bluetooth connected successfully"
        },
        { 
          item: "Power Windows", 
          status: "good", 
          note: "All functional",
          type: "video",
          captureInstruction: "Record video of all 4 power windows operating",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=200", 
            duration: "20s", 
            url: "#" 
          }
        },
        { 
          item: "Steering Controls", 
          status: "poor", 
          note: "Not working",
          type: "qa",
          question: "Are all steering wheel mounted controls working?",
          answer: "No, volume and call buttons not responding"
        }
      ]
    },
    {
      id: "lights",
      name: "Lights",
      icon: "Lightbulb",
      checkpoints: 11,
      rating: 8,
      status: "good",
      details: [
        { 
          item: "Headlights", 
          status: "good", 
          note: "Both working",
          type: "photo",
          captureInstruction: "Take a photo of both headlights turned ON",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=200", 
            full: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800" 
          },
          followUpQuestion: "Are both low beam and high beam working?",
          followUpAnswer: "Yes, both working correctly"
        },
        { 
          item: "Fog Lights", 
          status: "good", 
          note: "Working",
          type: "qa",
          question: "Are the fog lights working?",
          answer: "Yes, front fog lights working correctly"
        },
        { 
          item: "Tail Lights", 
          status: "good", 
          note: "Working",
          type: "photo",
          captureInstruction: "Take a photo of tail lights and brake lights",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200", 
            full: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800" 
          }
        }
      ]
    },
    {
      id: "tires",
      name: "Tires & Tools",
      icon: "CircleDashed",
      checkpoints: 7,
      rating: 6,
      status: "average",
      details: [
        { 
          item: "Front Left Tire", 
          status: "average", 
          note: "55% tread",
          type: "photo",
          captureInstruction: "Take a photo of front left tire tread",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=200", 
            full: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800" 
          },
          followUpQuestion: "What is the estimated tread depth percentage?",
          followUpAnswer: "Approximately 55% tread remaining"
        },
        { 
          item: "Front Right Tire", 
          status: "average", 
          note: "52% tread",
          type: "photo",
          captureInstruction: "Take a photo of front right tire tread",
          media: { 
            thumbnail: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=200", 
            full: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800" 
          },
          followUpQuestion: "What is the estimated tread depth percentage?",
          followUpAnswer: "Approximately 52% tread remaining"
        },
        { 
          item: "Spare Tire", 
          status: "good", 
          note: "Unused",
          type: "qa",
          question: "What is the condition of the spare tire?",
          answer: "Unused, pressure at 32 PSI"
        },
        { 
          item: "Jack & Tools", 
          status: "good", 
          note: "Complete",
          type: "qa",
          question: "Are all tools (jack, wheel wrench, toolkit) present?",
          answer: "Yes, all tools present and in working condition"
        }
      ]
    }
  ],

  // Footer Info
  footer: {
    reportFeatures: ["Easy to Read", "Easy to Track", "Comprehensive Report"],
    methods: "Physical Inspection, AI, OBD2 Scanning",
    url: "https://wisedrive.com/report",
    lastPublished: "01-Feb-2026",
    address: "K No-661/3-1114/3,4,5, 3rd Floor, No.46/4, Novel Tech Park, G B Palya, Bangalore, Karnataka - 560068"
  }
};

// Utility functions
export const getStatusColor = (status) => {
  const s = status ? status.toLowerCase() : '';
  if (s === 'good') return 'success';
  if (s === 'average') return 'warning';
  if (s === 'poor') return 'destructive';
  return 'muted';
};

export const getRatingColor = (rating) => {
  if (rating >= 8) return 'success';
  if (rating >= 6) return 'warning';
  return 'destructive';
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatNumber = (num) => {
  return new Intl.NumberFormat('en-IN').format(num);
};

export const getSeverityColor = (severity) => {
  if (severity === 'critical') return 'destructive';
  if (severity === 'warning') return 'warning';
  return 'info';
};
