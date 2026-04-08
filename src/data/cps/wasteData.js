export const WASTE_BIN_SENSORS = [
    {
        id: 'S-01',
        zone: 'Canteen',
        wasteType: 'mixed',
        fillPct: 95,
        capacityKg: 180,
        currentLoadKg: 171,
        dailyGenerationKg: 29,
        segregationScore: 62,
        contaminationPct: 31,
        methanePpm: 88,
        tempC: 37.6,
        odorIndex: 8.2,
        batteryPct: 84,
        connectivity: 'online',
        distanceFromHubKm: 0.8,
        lastPickupHoursAgo: 14,
        actuators: { compactor: true, scrubber: false, conveyor: true }
    },
    {
        id: 'S-02',
        zone: 'Admin Block',
        wasteType: 'recyclable',
        fillPct: 68,
        capacityKg: 120,
        currentLoadKg: 82,
        dailyGenerationKg: 16,
        segregationScore: 88,
        contaminationPct: 8,
        methanePpm: 22,
        tempC: 30.1,
        odorIndex: 3.6,
        batteryPct: 91,
        connectivity: 'online',
        distanceFromHubKm: 1.2,
        lastPickupHoursAgo: 10,
        actuators: { compactor: true, scrubber: true, conveyor: true }
    },
    {
        id: 'S-03',
        zone: 'Hostel North',
        wasteType: 'organic',
        fillPct: 78,
        capacityKg: 140,
        currentLoadKg: 109,
        dailyGenerationKg: 24,
        segregationScore: 74,
        contaminationPct: 17,
        methanePpm: 74,
        tempC: 36.2,
        odorIndex: 6.4,
        batteryPct: 76,
        connectivity: 'online',
        distanceFromHubKm: 2.3,
        lastPickupHoursAgo: 12,
        actuators: { compactor: true, scrubber: false, conveyor: true }
    },
    {
        id: 'S-04',
        zone: 'Hostel South',
        wasteType: 'organic',
        fillPct: 83,
        capacityKg: 160,
        currentLoadKg: 133,
        dailyGenerationKg: 27,
        segregationScore: 70,
        contaminationPct: 20,
        methanePpm: 81,
        tempC: 37.8,
        odorIndex: 7.1,
        batteryPct: 72,
        connectivity: 'online',
        distanceFromHubKm: 2.7,
        lastPickupHoursAgo: 13,
        actuators: { compactor: true, scrubber: false, conveyor: true }
    },
    {
        id: 'S-05',
        zone: 'Labs',
        wasteType: 'hazardous',
        fillPct: 56,
        capacityKg: 90,
        currentLoadKg: 50,
        dailyGenerationKg: 8,
        segregationScore: 93,
        contaminationPct: 4,
        methanePpm: 14,
        tempC: 27.8,
        odorIndex: 1.8,
        batteryPct: 95,
        connectivity: 'online',
        distanceFromHubKm: 1.9,
        lastPickupHoursAgo: 8,
        actuators: { compactor: false, scrubber: true, conveyor: false }
    },
    {
        id: 'S-06',
        zone: 'Market Junction',
        wasteType: 'mixed',
        fillPct: 88,
        capacityKg: 200,
        currentLoadKg: 176,
        dailyGenerationKg: 32,
        segregationScore: 58,
        contaminationPct: 34,
        methanePpm: 96,
        tempC: 39.1,
        odorIndex: 8.9,
        batteryPct: 66,
        connectivity: 'online',
        distanceFromHubKm: 3.4,
        lastPickupHoursAgo: 16,
        actuators: { compactor: true, scrubber: false, conveyor: true }
    },
    {
        id: 'S-07',
        zone: 'Clinic',
        wasteType: 'hazardous',
        fillPct: 64,
        capacityKg: 70,
        currentLoadKg: 45,
        dailyGenerationKg: 7,
        segregationScore: 97,
        contaminationPct: 2,
        methanePpm: 10,
        tempC: 26.4,
        odorIndex: 1.2,
        batteryPct: 89,
        connectivity: 'online',
        distanceFromHubKm: 1.5,
        lastPickupHoursAgo: 6,
        actuators: { compactor: false, scrubber: true, conveyor: false }
    },
    {
        id: 'S-08',
        zone: 'Bus Stand',
        wasteType: 'recyclable',
        fillPct: 72,
        capacityKg: 130,
        currentLoadKg: 94,
        dailyGenerationKg: 18,
        segregationScore: 85,
        contaminationPct: 11,
        methanePpm: 29,
        tempC: 31.7,
        odorIndex: 3.3,
        batteryPct: 81,
        connectivity: 'offline',
        distanceFromHubKm: 2.9,
        lastPickupHoursAgo: 11,
        actuators: { compactor: true, scrubber: true, conveyor: true }
    },
    {
        id: 'S-09',
        zone: 'School',
        wasteType: 'e-waste',
        fillPct: 43,
        capacityKg: 60,
        currentLoadKg: 26,
        dailyGenerationKg: 4,
        segregationScore: 91,
        contaminationPct: 6,
        methanePpm: 8,
        tempC: 25.5,
        odorIndex: 0.9,
        batteryPct: 87,
        connectivity: 'online',
        distanceFromHubKm: 2.1,
        lastPickupHoursAgo: 22,
        actuators: { compactor: false, scrubber: false, conveyor: false }
    },
    {
        id: 'S-10',
        zone: 'Temple Road',
        wasteType: 'organic',
        fillPct: 81,
        capacityKg: 150,
        currentLoadKg: 122,
        dailyGenerationKg: 23,
        segregationScore: 77,
        contaminationPct: 15,
        methanePpm: 79,
        tempC: 35.9,
        odorIndex: 6.8,
        batteryPct: 75,
        connectivity: 'online',
        distanceFromHubKm: 3.1,
        lastPickupHoursAgo: 13,
        actuators: { compactor: true, scrubber: false, conveyor: true }
    }
];

export const WASTE_COMPOSITION_TREND = [
    { day: 'Mon', organic: 41, recyclable: 31, hazardous: 7, eWaste: 5, residual: 16 },
    { day: 'Tue', organic: 44, recyclable: 29, hazardous: 8, eWaste: 5, residual: 14 },
    { day: 'Wed', organic: 46, recyclable: 30, hazardous: 7, eWaste: 4, residual: 13 },
    { day: 'Thu', organic: 43, recyclable: 32, hazardous: 6, eWaste: 5, residual: 14 },
    { day: 'Fri', organic: 45, recyclable: 33, hazardous: 6, eWaste: 4, residual: 12 },
    { day: 'Sat', organic: 48, recyclable: 30, hazardous: 6, eWaste: 4, residual: 12 },
    { day: 'Sun', organic: 50, recyclable: 28, hazardous: 7, eWaste: 5, residual: 10 }
];

export const WASTE_GENERATION_SERIES = [
    { time: '06:00', generatedKg: 120, collectedKg: 90 },
    { time: '08:00', generatedKg: 158, collectedKg: 110 },
    { time: '10:00', generatedKg: 190, collectedKg: 135 },
    { time: '12:00', generatedKg: 228, collectedKg: 172 },
    { time: '14:00', generatedKg: 246, collectedKg: 195 },
    { time: '16:00', generatedKg: 258, collectedKg: 214 },
    { time: '18:00', generatedKg: 274, collectedKg: 241 },
    { time: '20:00', generatedKg: 292, collectedKg: 255 },
    { time: '22:00', generatedKg: 310, collectedKg: 266 },
    { time: '00:00', generatedKg: 286, collectedKg: 248 },
    { time: '02:00', generatedKg: 238, collectedKg: 206 },
    { time: '04:00', generatedKg: 182, collectedKg: 161 }
];

export const WASTE_SLA_BY_ZONE = [
    { zone: 'Canteen', planned: 6, completed: 5, late: 1, overflow: 1 },
    { zone: 'Admin Block', planned: 4, completed: 4, late: 0, overflow: 0 },
    { zone: 'Hostel North', planned: 5, completed: 4, late: 1, overflow: 1 },
    { zone: 'Hostel South', planned: 5, completed: 4, late: 1, overflow: 1 },
    { zone: 'Market Junction', planned: 7, completed: 5, late: 2, overflow: 2 },
    { zone: 'Bus Stand', planned: 4, completed: 3, late: 1, overflow: 0 }
];

export const WASTE_INCIDENT_FEED = [
    {
        id: 'INC-W-101',
        severity: 'critical',
        zone: 'Canteen',
        message: 'Bin S-01 crossed 95% fill and methane exceeded safe threshold.',
        recommendation: 'Dispatch Fleet-1 immediately, enable odor scrubber, and run compactor boost for 5 minutes.',
        source: 'Bin ultrasonic + gas sensor node',
        time: '08:42'
    },
    {
        id: 'INC-W-102',
        severity: 'warning',
        zone: 'Market Junction',
        message: 'Pickup SLA risk detected due to high visitor load.',
        recommendation: 'Re-route Fleet-2 before noon and apply dynamic compaction cycle.',
        source: 'Fleet GPS telemetry + zone occupancy sensors',
        time: '08:15'
    },
    {
        id: 'INC-W-103',
        severity: 'warning',
        zone: 'Bus Stand',
        message: 'Sensor S-08 connectivity loss for 16 minutes.',
        recommendation: 'Switch to edge-buffer mode and schedule communication module check.',
        source: 'Gateway link monitor + node heartbeat watchdog',
        time: '07:58'
    },
    {
        id: 'INC-W-104',
        severity: 'normal',
        zone: 'Clinic',
        message: 'Hazardous waste stream packed and tagged correctly.',
        recommendation: 'Maintain cold chain logistics and route to secure treatment unit.',
        source: 'Hazard tag reader + sealed-container weight sensor',
        time: '07:31'
    }
];

export const WASTE_COLLECTION_METHODS = [
    {
        channel: 'Smart bin node mesh (fill, gas, temperature)',
        coverage: 'All collection points',
        cadence: '10 sec to 1 min stream',
        owner: 'Waste IoT edge gateway'
    },
    {
        channel: 'Fleet GPS and fuel telemetry',
        coverage: 'All collection vehicles',
        cadence: '5-15 sec stream',
        owner: 'Route orchestration service'
    },
    {
        channel: 'Material transfer and weighbridge IoT',
        coverage: 'Transfer station and processing gate',
        cadence: 'Per dump event + 1 min sync',
        owner: 'Processing node controller'
    },
    {
        channel: 'Compost/biogas process PLC counters',
        coverage: 'Composting and digestion units',
        cadence: '30 sec process loop',
        owner: 'Plant automation controller'
    }
];

export const WASTE_CONTROL_PROFILES = {
    balanced: {
        label: 'Balanced',
        compactionGainPct: 10,
        collectionSpeedGainPct: 8,
        energyPenaltyPct: 4,
        segregationLiftPct: 3
    },
    aggressive: {
        label: 'Aggressive',
        compactionGainPct: 18,
        collectionSpeedGainPct: 15,
        energyPenaltyPct: 9,
        segregationLiftPct: 5
    },
    eco: {
        label: 'Eco Priority',
        compactionGainPct: 7,
        collectionSpeedGainPct: 5,
        energyPenaltyPct: 2,
        segregationLiftPct: 8
    }
};