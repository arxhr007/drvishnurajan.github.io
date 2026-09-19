// ---------------------------------------------------------------------------
// Sites monitored by Gram Vista: the Sahrdaya campus (where the CPS prototype
// nodes physically sit) and the five Unnat Bharat Abhiyan (UBA) adopted
// villages. Every site has `zones` – campus blocks or village areas – that
// sensors are placed in (see config/sensorPlacement in the sensor database).
//
// Campus block outlines come from OpenStreetMap (src/data/campusGeometry.json,
// keyed by OSM way id). Blocks flagged `approx` have no named OSM footprint yet;
// their positions can be corrected in Site & Alerts configuration
// (config/zones/<site>/<zone> = { lat, lng }).
// ---------------------------------------------------------------------------
import campusGeometry from './campusGeometry.json' with { type: 'json' };

export const UBA_PROGRAMME = {
    title: 'Unnat Bharat Abhiyan – Adopted Villages',
    shortTitle: 'UBA Adopted Villages',
    description:
        'Under the Unnat Bharat Abhiyan (UBA), Gram Vista is actively engaged with the following adopted villages, ' +
        'enabling real-world deployment and validation of inclusive Cyber-Physical Systems (CPS) solutions in ' +
        'collaboration with the local community.'
};

// Sahrdaya College of Engineering & Technology, Kodakara
export const SAHRDAYA_CAMPUS = [10.3589, 76.2860];
export const CAMPUS_ID = 'campus';
export const CAMPUS_BOUNDARY_OSM_ID = '953912527';

const osmZone = (id, osmId, name, category, extra = {}) => {
    const g = campusGeometry[osmId];
    return { id, name, category, osmId, center: g ? g.center : SAHRDAYA_CAMPUS, polygon: g ? g.polygon : null, ...extra };
};

// Campus blocks. Categories drive the highlight colour on the map.
export const CAMPUS_ZONES = [
    osmZone('main_block', '1030845009', 'Main Block', 'academic'),
    { id: 'bio_block', name: 'Bio Block', category: 'academic', center: [10.35985, 76.28545], polygon: null, approx: true },
    osmZone('decennial_block', '1030847379', 'Decennial Block', 'academic'),
    osmZone('auditorium', '1030845010', 'Auditorium', 'academic', { approx: true }),
    osmZone('knowledge_center', '1030847393', 'Knowledge Center', 'academic'),
    osmZone('sims', '1030847396', 'Institute of Management Studies', 'academic'),
    osmZone('workshop', '1030847380', 'Mechanical & Electrical Workshop', 'academic'),
    osmZone('boys_hostel', '1030847389', 'Boys Hostel', 'hostel'),
    osmZone('hostel_annex', '1030847390', 'Hostel Annex', 'hostel', { approx: true }),
    osmZone('pg_girls_hostel', '1030847382', 'Girls PG Hostel', 'hostel'),
    osmZone('shalome_hostel', '1030847383', 'Shalome Girls Hostel', 'hostel'),
    osmZone('thejus_hostel', '1030847384', 'Thejus Girls Hostel', 'hostel'),
    osmZone('jyothis_hostel', '1030847385', 'Jyothis Girls Hostel', 'hostel'),
    osmZone('mess', '1030847387', 'College Mess', 'facility'),
    osmZone('chapel', '1030847381', 'Sahrdaya Chapel', 'facility'),
    osmZone('indoor_stadium', '802164634', 'Indoor Stadium', 'facility'),
    { id: 'campus_grounds', name: 'Campus Grounds', category: 'open', center: [10.35905, 76.28480], polygon: null, approx: true }
];

// Village areas: offsets from the village centre in degrees (0.001° ≈ 110 m)
export const VILLAGE_ZONES = [
    { id: 'paddy_field', name: 'Paddy Field', category: 'agriculture', offset: [-0.0018, 0.0022] },
    { id: 'weather_mast', name: 'Weather Mast', category: 'agriculture', offset: [-0.0024, 0.0030] },
    { id: 'panchayat_office', name: 'Panchayat Office', category: 'facility', offset: [0.0004, 0.0008] },
    { id: 'water_quality_station', name: 'Water Quality Station', category: 'water', offset: [0.0016, -0.0010] },
    { id: 'check_dam', name: 'Check Dam', category: 'water', offset: [-0.0006, -0.0038] },
    { id: 'overhead_tank', name: 'Overhead Tank', category: 'water', offset: [0.0026, -0.0002] },
    { id: 'pump_house', name: 'Pump House', category: 'water', offset: [0.0020, 0.0012] },
    { id: 'solar_array', name: 'Solar Array', category: 'energy', offset: [-0.0030, -0.0012] },
    { id: 'windmill_ridge', name: 'Windmill Ridge', category: 'energy', offset: [0.0008, 0.0042] },
    { id: 'model_household', name: 'Model Household', category: 'energy', offset: [-0.0004, 0.0014] },
    { id: 'anganwadi', name: 'Anganwadi / School', category: 'facility', offset: [0.0012, 0.0024] }
];

export const SITES = [
    {
        id: CAMPUS_ID,
        name: 'Sahrdaya Campus',
        fullName: 'Sahrdaya College of Engineering and Technology',
        type: 'campus',
        deployment: 'live',
        center: [10.3591, 76.2860],
        zoom: 17,
        zones: CAMPUS_ZONES,
        description:
            'Home of the CPS laboratory. The prototype agriculture, water, energy and parking nodes are installed ' +
            'across the campus blocks and stream live readings to the RPS Sahrdaya Firebase Realtime Database.'
    },
    {
        id: 'vadakkumbhagom',
        name: 'Vadakkumbhagom',
        type: 'village',
        deployment: 'planned',
        center: [10.2790, 76.2410],
        zoom: 15,
        approx: true,
        zones: VILLAGE_ZONES,
        description: 'Adopted under UBA. Field sensor nodes are yet to be deployed.'
    },
    {
        id: 'puthenchira',
        name: 'Puthenchira',
        type: 'village',
        deployment: 'live',
        center: [10.2659, 76.2369],
        zoom: 15,
        zones: VILLAGE_ZONES,
        description:
            'First UBA deployment site. Agriculture, water-management and energy nodes validated on campus are ' +
            'being installed here and stream to the same database.'
    },
    {
        id: 'karumathra',
        name: 'Karumathra',
        type: 'village',
        deployment: 'planned',
        center: [10.2715, 76.2122],
        zoom: 15,
        zones: VILLAGE_ZONES,
        description: 'Adopted under UBA. Field sensor nodes are yet to be deployed.'
    },
    {
        id: 'thekkumkara',
        name: 'Thekkumkara',
        type: 'village',
        deployment: 'planned',
        center: [10.2886, 76.2170],
        zoom: 15,
        approx: true,
        zones: VILLAGE_ZONES,
        description: 'Adopted under UBA. Field sensor nodes are yet to be deployed.'
    },
    {
        id: 'kaduppassery',
        name: 'Kaduppassery',
        type: 'village',
        deployment: 'planned',
        center: [10.3255, 76.2573],
        zoom: 15,
        zones: VILLAGE_ZONES,
        description: 'Adopted under UBA. Field sensor nodes are yet to be deployed.'
    }
];

export const VILLAGES = SITES.filter((site) => site.type === 'village');

// Site selected on first load, and the site that owns prototype readings whose
// Firebase path has not been placed anywhere (config/prototypeSite overrides).
export const DEFAULT_SITE_ID = CAMPUS_ID;
export const DEFAULT_VILLAGE_ID = 'puthenchira';

export const getSite = (id) => SITES.find((site) => site.id === id) || null;
export const getVillage = getSite;

export const zonesOf = (site) => (site && site.zones) || [];

/** Centre of a zone, honouring an admin override from config/zones/<site>/<zone>. */
export const resolveZoneCenter = (site, zoneId, overrides = {}) => {
    if (!site) return null;
    const override = overrides?.[site.id]?.[zoneId];
    if (override && Number.isFinite(Number(override.lat)) && Number.isFinite(Number(override.lng))) {
        return [Number(override.lat), Number(override.lng)];
    }
    const zone = zonesOf(site).find((z) => z.id === zoneId);
    if (!zone) return null;
    if (zone.center) return zone.center;
    if (zone.offset && site.center) return [site.center[0] + zone.offset[0], site.center[1] + zone.offset[1]];
    return site.center || null;
};

export const campusBoundary = () => campusGeometry[CAMPUS_BOUNDARY_OSM_ID]?.polygon || null;
