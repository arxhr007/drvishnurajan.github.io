// Unnat Bharat Abhiyan (UBA) adopted villages served by Gram Vista.
// `deployment` = 'live' means field nodes are streaming telemetry to the
// RPS Sahrdaya Firebase Realtime Database; 'planned' villages have no nodes yet.
//
// `center` is [latitude, longitude]. Centres were geocoded with OpenStreetMap
// Nominatim (Mukundapuram taluk, Thrissur). Entries flagged `approx: true`
// could not be geocoded exactly; a device or admin can override any centre by
// writing `villages/<id>/center = { lat, lng }` to the sensor database.

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

export const VILLAGES = [
    {
        id: 'vadakkumbhagom',
        name: 'Vadakkumbhagom',
        deployment: 'planned',
        center: [10.2790, 76.2410],
        zoom: 15,
        approx: true,
        description: 'Adopted under UBA. Field sensor nodes are yet to be deployed.'
    },
    {
        id: 'puthenchira',
        name: 'Puthenchira',
        deployment: 'live',
        center: [10.2659, 76.2369],
        zoom: 15,
        description:
            'Current CPS prototype site. Agriculture, water-management and energy nodes stream live readings ' +
            'to the RPS Sahrdaya Firebase Realtime Database.'
    },
    {
        id: 'karumathra',
        name: 'Karumathra',
        deployment: 'planned',
        center: [10.2715, 76.2122],
        zoom: 15,
        description: 'Adopted under UBA. Field sensor nodes are yet to be deployed.'
    },
    {
        id: 'thekkumkara',
        name: 'Thekkumkara',
        deployment: 'planned',
        center: [10.2886, 76.2170],
        zoom: 15,
        approx: true,
        description: 'Adopted under UBA. Field sensor nodes are yet to be deployed.'
    },
    {
        id: 'kaduppassery',
        name: 'Kaduppassery',
        deployment: 'planned',
        center: [10.3255, 76.2573],
        zoom: 15,
        description: 'Adopted under UBA. Field sensor nodes are yet to be deployed.'
    }
];

// The village whose telemetry is currently written to the sensor database.
export const DEFAULT_VILLAGE_ID = 'puthenchira';

export const getVillage = (id) => VILLAGES.find((village) => village.id === id) || null;
