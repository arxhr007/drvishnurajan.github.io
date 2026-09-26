# Gram Vista: Sahrdaya CPS Digital Twin Dashboard

![Dashboard Hero](assets/screenshots/dashboard.png)

A state-of-the-art Digital Twin interface for monitoring and controlling Cyber-Physical Systems (CPS) such as smart energy grids, water networks, and environmental sensors. Built with React and powered by Firebase Realtime Database for sub-millisecond data synchronization..

**Live Demo**: [https://drvishnurajan.github.io/cps/](https://drvishnurajan.github.io/cps/)

---

## 🚀 Features

### 1. Real-Time Monitoring
View live telemetry from hundreds of IoT sensors across the campus.
- **Energy**: Solar array output, battery levels, feeder status.
- **Water**: Tank levels, flow rates, pump status.
- **Incidents**: Traffic congestion alerts, sensor timeouts.

### 2. Interactive Digital Twin Map
A Leaflet-based map visualizing the geolocation of all assets.
- **Filtering**: Switch layers to focus on Energy Grid, Water Network, or System Controls.
- **Status Indicators**: Color-coded markers (Red=Critical, Amber=Warning, Green=Normal).

### 3. Bi-Directional System Control
Control physical actuators directly from the dashboard. Toggling a switch updates Firebase instantly, which can trigger your IoT device.
- **Street Lights**: Remote On/Off.
- **Irrigation Pumps**: Remote activation.
- **Generators**: Status control.

![System Controls](assets/screenshots/controls.png)

---

## 🛠 IoT Integration Guide

The dashboard uses **Firebase Realtime Database** as the broker between the UI and your physical devices.

### 1. Data Structure
All devices are stored under the `/assets` node. Each device has a unique ID (e.g., `E-01`, `W-02`).

**Schema Reference:**
```json
{
  "assets": {
    "E-01": {
      "id": "E-01",
      "type": "Main Substation",
      "category": "energy",      // 'energy', 'water', 'controls', 'incidents'
      "val": "482kW",            // Display value
      "status": "normal",        // 'normal', 'warning', 'critical', 'offline'
      "coords": [10.359, 76.285],// [Latitude, Longitude]
      "details": "Grid Connection"
    },
    "C-01": {
      "id": "C-01",
      "type": "Street Lights",
      "category": "controls",
      "val": "Off",              // Actuator State: 'Active' / 'Off' or 'On' / 'Off'
      "status": "offline"
    }
  }
}
```

### 2. Connecting Sensors (Upload Data)
Your IoT device (ESP32, Raspberry Pi, Python script) should write to the database whenever a reading changes.

**Example (Node.js / Python):**
```javascript
// Update Sensor Reading
firebase.database().ref('assets/E-01').update({
  val: "495kW",
  status: "normal"
});
```

### 3. Controlling Devices (Listen for Commands)
To control a device (e.g., Turn on Street Lights), your device must **subscribe** to changes on its specific node.

**Logic Flow:**
1.  User clicks "Toggle" on Dashboard.
2.  Dashboard updates `assets/C-01/val` to `"Active"`.
3.  IoT Device receives update event.
4.  IoT Device triggers physical relay.

**Example (Arduino/ESP32 Code Logic):**
```cpp
// Pseudo-code for ESP32 Firebase Client
if (Firebase.getString(firebaseData, "/assets/C-01/val")) {
  String state = firebaseData.stringData();
  if (state == "Active" || state == "On") {
    digitalWrite(RELAY_PIN, HIGH); // Turn Light ON
  } else {
    digitalWrite(RELAY_PIN, LOW);  // Turn Light OFF
  }
}
```

---

## 🖥 Dashboard Sections

### Main Dashboard
![Dashboard View](assets/screenshots/dashboard.png)
- **KPI Board**: Aggregated stats (Total Energy Load, Active Alerts).
- **Hourly Load**: Real-time chart of power consumption.
- **Active Alerts**: Scrollable list of systems reporting 'warning' or 'critical' status.

### Live Monitoring
![Live Monitoring](assets/screenshots/live_monitoring.png)
- **Grid View**: Real-time status of all sensors with visual indicators.
- **Detail View**: In-depth telemetry history and user tracking (Created/Modified By).

### City Map
![City Map](assets/screenshots/map.png)
Located in the sidebar, the Map View offers a full-screen geospatial perspective.
- **Energy Layer**: Visualizes power infrastructure.
- **Water Layer**: Visualizes tanks and pipes.
- **System Controls**: Overlay panel to toggle system states while viewing their location.

### System Configuration (Asset Management)
![System Config](assets/screenshots/system_config.png)
A dedicated interface for managing the digital twin assets.
- **CRUD Operations**: Create, Read, Update, and Delete assets.
- **Location Picker**: Integrated map to set asset coordinates.
- **Mobile Responsive**: Optimized layout for mobile devices (Sidebar stacks on top).

---

## 🔧 Technology Stack

- **Frontend**: React 18, Vite
- **Styling**: Tailwind CSS, Lucide Icons
- **Mapping**: React Leaflet, OpenStreetMap
- **Data**: Firebase Realtime Database
- **Charts**: Recharts

## 📦 Deployment

The project is deployed via GitHub Pages.
- **Build Command**: `npm run build` (Outputs to `dist/cps`)
- **Deploy Command**: `npm run deploy` (Pushes to `master` branch)

---
*Developed for Sahrdaya College of Engineering & Technology - CPS Department.*

---

## 🌾 UBA Village Field Sensors (RPS Sahrdaya Realtime Database)

Under **Unnat Bharat Abhiyan (UBA)** Gram Vista is engaged with five adopted villages:
Vadakkumbhagom, **Puthenchira** (live prototype), Karumathra, Thekkumkara and Kaduppassery.
The **Live Monitoring** page has a village pull-down; the Agriculture, Water and Energy
dashboards show the same village's live field sensors in a strip at the top.

Field telemetry lives in a **second** Firebase project, separate from the login / assets project:

| Purpose | Project | URL |
| --- | --- | --- |
| Google sign-in, `assets`, `categories`, `soil_monitoring` | `sahrdayacps` | `https://sahrdayacps-default-rtdb.firebaseio.com` |
| Village field sensors (UBA prototype) | `rps-sahrdaya` | `https://rps-sahrdaya-bfe70-default-rtdb.asia-southeast1.firebasedatabase.app` |

The sensor URL is set in `src/firebase.config.js` and can be overridden with `VITE_SENSOR_DB_URL` in a local `.env` file.

### Node layout the field devices should write

```json
{
  "villages": {
    "puthenchira": {
      "agriculture": { "soil_moisture": 42.5, "temperature": 29.1, "humidity": 71 },
      "water": {
        "ph": 7.2, "rain_intensity": 4, "water_level_dam": 63,
        "water_level_tank": 78, "pump": "off", "turbidity": 2.4
      },
      "energy": { "solar_output_wh": 1250, "windmill_output_wh": 430, "household_consumption_wh": 1610 },
      "updated_at": 1758100000
    }
  }
}
```

A ready-to-import copy is in `src/data/sensor_seed.json` (Firebase console → Realtime Database → ⋮ → Import JSON).

| Group | Key | Unit | Notes |
| --- | --- | --- | --- |
| agriculture | `soil_moisture` | % | warning outside 20–80 |
| agriculture | `temperature` | °C | warning > 38, critical > 45 |
| agriculture | `humidity` | % | warning outside 25–90 |
| water | `ph` | pH | warning outside 6.5–8.5, critical outside 5–10. A value above 14 is treated as a raw ADC count and converted (pH ≈ 3.5 × volts; tune `PH_SLOPE`/`PH_OFFSET` in `sensorSchema.js` after buffer calibration) |
| water | `rain_intensity` | % (0–100 rain index) | warning > 30, critical > 60. A raw analog value under `rainValue` (4095 = dry) is converted automatically |
| water | `rain_detected` | 0/1 | from `rainDetected` |
| water | `water_level_dam` | % | warning > 85, critical > 95 |
| water | `water_level_tank` | % | warning < 20, critical < 10 |
| water | `pump` | on/off | `"on"`/`"off"`, `true`/`false` or `1`/`0`; admins can toggle it from the metric detail view |
| water | `turbidity` | NTU | warning > 5, critical > 10. A value above 300 is treated as a raw ADC count (4095 = clear) and mapped to 0–100 NTU |
| energy | `solar_output_wh` | Wh | producer |
| energy | `windmill_output_wh` | Wh | producer |
| energy | `household_consumption_wh` | Wh | consumer |

The reader is tolerant, so firmware does not have to match the layout exactly:

- Keys are matched case-insensitively after removing spaces, dashes and underscores (`Soil moisture value`, `soilMoisture` and `soil_moisture` all work), and common aliases are accepted (see `src/data/sensorSchema.js`).
- The `agriculture` / `water` / `energy` grouping is optional; keys can sit directly under the village.
- Writing flat keys at the database root (no `villages/puthenchira` wrapper) is treated as Puthenchira data,
  and is merged with anything under `villages/puthenchira`. The current ESP32 firmware layout
  (`agriculture/environment/{temperature, humidity}`, `agriculture/soil/moisturePercent`) is read as-is,
  as is the flat `Agriculture/{humidity, temperature, soilMoisture, waterLevel, rainValue, rainDetected}` node.
- A node that reports `online: false` is treated as stale and its readings are ignored.
- Numeric `timestamp` values below 1 000 000 000 (device uptime in seconds) are ignored; send epoch seconds
  or millis for a real device timestamp.
- Values can be numbers, numeric strings (`"42.5%"`) or `{ "value": 42.5, "timestamp": 1758100000 }` objects.

**ESP32 example (Firebase ESP Client):**
```cpp
Firebase.RTDB.setFloat(&fbdo, "/villages/puthenchira/agriculture/soil_moisture", 42.5);
Firebase.RTDB.setFloat(&fbdo, "/villages/puthenchira/water/ph", 7.2);
Firebase.RTDB.setString(&fbdo, "/villages/puthenchira/water/pump", pumpOn ? "on" : "off");
Firebase.RTDB.setInt(&fbdo, "/villages/puthenchira/updated_at", (int)time(nullptr));
```

To receive pump commands, subscribe to `/villages/puthenchira/water/pump` on the device.

### City Map: village selection and sensor placement

The **City Map** (and the mini-map on the Dashboard) uses OpenStreetMap tiles, which need no API key.
A village pull-down sits at the top-left of the map; choosing a village flies the map to its centre
and draws its sensor nodes (green = agriculture, cyan = water, yellow = energy; red/amber ring = alert;
grey = no reading yet). Clicking a node opens a popup with the live value and a link to Live Monitoring.

Village centres are in `src/data/villages.js`. Sensors are drawn at the village centre plus a default
offset per sensor (`offset` in `src/data/sensorSchema.js`) until real positions are published. To use
real GPS positions, write either of these to the sensor database:

    villages/puthenchira/center            = { "lat": 10.2659, "lng": 76.2369 }
    villages/puthenchira/locations/ph      = { "lat": 10.2671, "lng": 76.2360 }
    villages/puthenchira/water/ph          = { "value": 7.2, "lat": 10.2671, "lng": 76.2360 }

Vadakkumbhagom and Thekkumkara centres are approximate (not resolvable via OpenStreetMap geocoding);
set `villages/<id>/center` to correct them.

### Village Overview dashboard: live data, baseline, predictions and alerts

The Dashboard is driven by the village sensor database plus a **synthetic baseline**:

- **Live readings** arrive from `villages/<id>/...` in the RPS Sahrdaya database. Every change is also
  appended to an in-session sample list used for trends and models.
- **Synthetic baseline**: a seeded, deterministic 7-day hourly history per village
  (`src/data/syntheticHistory.js`) with diurnal temperature/solar curves, household peaks, monsoon rain
  events, soil drying (evapotranspiration), tank/pump cycles and dam/turbidity responses. Live hours
  override the baseline hour they fall in. KPI tiles carry a **Live** or **Baseline** badge so the
  source is always visible, and the header shows *All sensors live / N live · rest baseline / Synthetic baseline*.
- **Trends**: 24 h / 3 d / 7 d charts for energy, water and agriculture.
- **Machine-learning models** (`src/utils/ml/`), run in the browser on every update:
  - *Agriculture*: Holt double-exponential smoothing of soil moisture corrected by an evapotranspiration
    term (12 h forecast, hours until the 25 % dry threshold), a logistic irrigation-need model, a crop
    stress index and z-score temperature anomalies.
  - *Water*: least-squares regression on tank level (hours until low / empty / full), a logistic
    flood-risk score from rain and dam level, a Water Quality Index from pH and turbidity, a Holt rain
    nowcast and z-score turbidity anomalies.
  - *Energy*: hour-of-day seasonal profiles learned from the last 7 days (level-adjusted to today) for
    solar and household load, Holt smoothing for wind, projected surplus/deficit at midnight,
    self-sufficiency, peak-load hour, and anomaly checks for solar under-performance and load spikes.
- **Alerts** combine threshold rules on each reading with the model alerts above; each card is labelled
  *rule* or *model* and links to the sensor in Live Monitoring.
- The same prediction cards appear on the Agriculture, Water and Energy dashboards.

#### Demo the real-time flow without hardware

`npm run simulate:sensors` streams realistic readings for the 12 sensors into
`villages/puthenchira` every 5 s through the REST API (it reads the pump state first, so dashboard
toggles are honoured). Options:

    npm run simulate:sensors -- --once          # write one snapshot
    VILLAGE=karumathra INTERVAL=10 npm run simulate:sensors
    DB_AUTH=<database secret> npm run simulate:sensors   # if rules require auth

Energy values are treated as watt-hours produced or consumed in the last hour.

### Hospital Parking module

**Hospital Parking** (sidebar) shows a live bay map driven by ultrasonic sensors in the sensor database.
Enter the number of slots, the occupied threshold (cm) and which bay is the ambulance/emergency bay in
*Parking Setup*; admins can save the setup to `parking/config` so every viewer sees the same layout.

- **The node's own state always wins.** If a bay publishes `status: "FREE"/"OCCUPIED"` or `occupied: true/false`,
  the dashboard shows that verbatim and never re-derives it from the distance.
- Only a bay with no published state falls back to distance. The threshold is **learned** from the bays the node
  has already labelled (midpoint between the closest free reading and the farthest occupied one); the Parking Setup
  value is used only when nothing can be learned. These nodes read ~17 cm free and ~5 cm occupied, so the old fixed
  60 cm default inverted every bay.
- A distance of 999 or more is the firmware's "no echo" value and is treated as no reading, not as a far wall.
- `parking/freeSlots` and `parking/occupiedSlots` from the node are shown beside the dashboard's own counts as a
  cross-check (the node's counters exclude the emergency bay; both readings are accepted).
- Until a setup is saved, the lot is sized to the number of sensors found, with the emergency bay last.
- The **emergency bay** raises a red banner (optional audible alarm) and a critical alert on the Overview
  dashboard whenever it is occupied; otherwise it shows *Free*.
- Free / occupied / occupancy % / sensors online are counted from the bays that have a reading.

Firmware layout (centimetres):

    parking/slots/1/distance      = 42.5
    parking/slots/2/distance      = 310.2
    ...
    parking/emergency/distance    = 305.0

Any other numeric key whose name contains `ultrasonic`, `distance` or `sonar` (for example the current
`Agriculture/ultrasonicDistance`) is detected as well and assigned to the next free bay in path order;
the mapping can be overridden per bay in Parking Setup.

### Sites: Sahrdaya campus and UBA villages

The site pull-down (Dashboard, City Map, Live Monitoring, every domain page) now lists **Sahrdaya Campus**
alongside the five UBA villages. The campus is where the prototype nodes physically sit, so by default every
reading published at the root of the database belongs to it. The City Map draws the campus with real building
footprints from OpenStreetMap (Main Block, Decennial Block, Auditorium, Knowledge Center, Chapel, Mess, Workshop,
Indoor Stadium, SIMS, Boys Hostel and the four girls' hostels); Bio Block and the Auditorium/Hostel Annex
outlines are approximate until confirmed. Villages get named areas (paddy field, weather mast, check dam,
overhead tank, pump house, solar array, windmill ridge, model household, panchayat office, anganwadi).

**Site & Alerts** (sidebar, admins) is where sensors are placed and alerts are configured. Everything it
writes lives under `config/` in the sensor database so all viewers share it:

| Path | Purpose |
| --- | --- |
| `config/sensorPlacement/<path with / as ~>` = `{ site, zone }` | Which site and block/area a Firebase sensor path belongs to |
| `config/prototypeSite` | Site that owns root-level readings that have not been placed (default `campus`) |
| `config/zones/<site>/<zone>` = `{ lat, lng }` | Corrected centre of a block or area |
| `config/alerts` | Mobile alert settings (below) |

The node power monitor at `village/water_management/power_consumption` (solar voltage/current/power, node
power draw and per-sensor power) is read as a fourth sensor group, **Node Power**.

### Mobile alerts for critical events

Set a recipient name, mobile number, channel and cooldown in **Site & Alerts**. When enabled, every critical
reading (any site), critical model alert (selected site) and the occupied emergency parking bay is sent once
per cooldown window. Each send is logged to `alerts/outbox`; `alerts/lastSent/<key>` prevents repeats across
browsers. Warnings can be included with a checkbox.

| Channel | How the message reaches the phone |
| --- | --- |
| Firebase outbox | Nothing leaves the browser. Run `FAST2SMS_KEY=… npm run alert:relay` (or `TWILIO_SID/TWILIO_TOKEN/TWILIO_FROM`, or `CALLMEBOT_KEY`) on any always-on machine, or point a GSM (SIM800) node at `alerts/outbox`; rows go `pending` → `sent`/`failed` |
| WhatsApp via CallMeBot | Browser calls the free CallMeBot API with your key (one-time WhatsApp opt-in) |
| SMS via Fast2SMS | Browser calls the Fast2SMS quick-SMS API with your authorization key |
| Custom webhook | Browser POSTs `{ to, text }` to your URL (Twilio Function, Apps Script, n8n …) |

Browser-side calls are fire-and-forget (`no-cors`), so delivery is confirmed only through the relay. Critical
alerts on the Overview also carry **Send on WhatsApp** / **Send as SMS** links for manual forwarding, and a
**Send test alert** button is provided on the configuration page.


### LoRaWAN waste bins (Ubidots)

Smart bins report over LoRaWAN into Ubidots STEM. The dashboard reads the **public Ubidots dashboard**
directly from the browser: it fetches the dashboard page, takes the short-lived public token embedded in it,
and calls the Ubidots API (`/api/v2.0/devices`, `/variables`, `/api/v1.6/variables/<id>/values`) with
`Authorization: Bearer`. Both endpoints allow cross-origin requests, so no relay or account key is needed;
the token is refreshed automatically before it expires.

- **Waste Management** shows every bin as a tank gauge with fill %, the node's own status word, last
  uplink, fill-rate and hours-to-full from recent history, and folds live bins into the KPI, risk and
  routing models beside the modelled bins.
- **Live Monitoring** lists the bins of the selected site; **City Map** draws them (brown markers, red ring
  when nearly full). A bin is attached to a site and block by its Ubidots name ("Bin #001 - bio block" →
  Campus / Bio Block); override in Site & Alerts with placement key `ubidots~<device label>`. The node's
  GPS is used only when it lies within 1.5 km of the site; otherwise the bin is drawn at its block.
- A bin at or above the full threshold (default 85 %) raises a critical alert (Overview + mobile alerts).
- Settings live in `config/ubidots`: `dashboardUrl`, `pollSeconds`, `historyPoints`,
  `offlineAfterMinutes`, `fullAlertPct`, `enabled`.
- A gateway may also write bins straight to the sensor database as `waste/bins/<label> = { name, fillPct,
  status, lat, lng, timestamp }`; these merge with the Ubidots bins by label.


### Telemetry sources (several Firebase databases) and actuators

The nodes now write to two Realtime Databases. Both are read live and merged; the primary one also holds
the dashboard's own configuration.

| Source id | Database | Default owner | Role |
| --- | --- | --- | --- |
| `rps-sahrdaya` | rps-sahrdaya-bfe70 (asia-southeast1) | Sahrdaya Campus | primary: readings + `config/`, `alerts/`, `parking/config`, `waste/bins` |
| `rps-project-2` | rps-project-2 (asia-southeast1) | Sahrdaya Campus | readings, water-pump relay, irrigation pump node, `powerData` |

When the same sensor exists in both, the source with the lower `priority` wins (rps-project-2 = 5,
rps-sahrdaya = 10). Readings from a non-primary source carry a `<sourceId>:` path prefix
(`rps-project-2:Watermanagement/relay_state`), so placement keys and relay write-backs go to the right
database. Manage sources in **Site & Alerts → Telemetry sources** (stored at `config/sources/<id>` =
`{ url, label, site, priority, enabled, ignoreKeys }`); `config/parkingSource` selects the database the
parking bays are read from.

Layout understood from the new firmware (flat, at the root):

    Watermanagement/{ ph, rain, turbidity, waterlevel1 (tank), waterlevel2 (dam), relay_state }
    soilMoisturePump/{ soilMoisturePercent, relayState, pumpSafetyCutoff }
    agriculture/{ soilMoisture, temperature, humidity }
    powerData/{ household | solar | windmill }/{ voltage, current, power }
    village/water_management/power_consumption/{ *_power, *_voltage, *_current }

Keys that depend on their parent (`relayState` under `soilMoisturePump` is the irrigation pump; under
`Watermanagement` it is the water pump; `power` under `solar` is solar power) are resolved by context
rules in `src/data/sensorSchema.js`.

**Actuators.** Three control points are exposed as toggles on the Overview (System Controls) and in each
sensor's detail view (admins only). The dashboard writes back the same JSON type the node published
(`true`/`false` for these):

| Control | Firebase key | Meaning |
| --- | --- | --- |
| Water Pump | `Watermanagement/relay_state` | tank / supply pump relay |
| Irrigation Pump | `soilMoisturePump/relayState` | irrigation pump relay |
| Irrigation Safety Cutoff | `soilMoisturePump/pumpSafetyCutoff` | when `true` the node keeps the irrigation pump locked off |
| Lake Pump | `pumpControl/lakePump` | lake / intake pump relay; the dashboard creates the key (`false`) if the node has not written it yet |

`Water/waterLevel` is read as the tank level and `Watermanagement/waterlevel1` / `waterlevel2` as tank /
dam respectively; swap the aliases in `sensorSchema.js` if the probes are the other way round.

### Live sites, the Agriculture page and soil calibration

- A site is **live** when it is flagged so in `src/data/villages.js` **or** when any sensor is actually placed on it.
  Puthenchira is now `planned` until its nodes are installed; placing a sensor on it in Site & Alerts makes it live.
- On the first load of a browser session, if the remembered site has no data but another site does, the dashboard
  switches to the live site once (so nobody is left looking at the synthetic baseline by accident).
- The Agriculture page's Sensor State, Active Alerts, KPIs, trend, quick facts, recommended actions and field-node
  status are driven by the live readings and the agriculture model; the leaf-disease image classifier is unchanged.
  Leaf wetness and VOC show "No sensor" until such sensors exist.
- **Soil probe calibration** (Site & Alerts): the node publishes the probe's raw ADC count as `soilRaw`. The two
  databases report 100 % and 30 % moisture for the same raw count (2593), so the firmware percentage is unreliable.
  Enter the dry-air and in-water raw counts and enable the option to compute moisture from the raw value everywhere;
  the firmware figure is still shown beside it. Stored at `config/calibration/soil = { enabled, dryRaw, wetRaw }`.
- Live Monitoring and Site & Alerts show the **last node write** time per database so a silent node is obvious.

### Two nodes reporting the same sensor

When more than one node publishes the same sensor for a site (today: an agriculture node in `rps-sahrdaya` and
another in `rps-project-2`), the node from the highest-priority database is the headline value and every other
node is listed as **"other node"** on the Live Monitoring card, in the sensor detail view and in the Agriculture
page's Sensor State. To make a different node the headline, lower its database's priority number in
Site & Alerts → Telemetry sources, or add the stale node's root key (e.g. `agriculture`) to the other database's
*Ignore root keys*.
