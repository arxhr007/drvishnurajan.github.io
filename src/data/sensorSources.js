// ---------------------------------------------------------------------------
// Telemetry sources: every Firebase Realtime Database the field nodes write to.
//
// The PRIMARY source also stores the dashboard's own configuration (config/,
// alerts/, parking/config, waste/bins). Extra sources only contribute
// readings. Each source has a default owner site for readings that are not
// placed explicitly (config/sensorPlacement), and a priority: when the same
// sensor exists in several sources, the lowest priority number wins.
//
// Reading paths from a non-primary source are prefixed "<sourceId>:" so that
// placement keys and write-backs (pump relays) route to the right database:
//   "rps-project-2:Watermanagement/relay_state"
//
// Overrides live in the primary database under config/sources/<id>:
//   { url, label, site, priority, enabled }
// and config/parkingSource = "<id>" picks which database the parking bays
// are read from.
// ---------------------------------------------------------------------------
import { SENSOR_DB_URL } from '../firebase.config';
import { CAMPUS_ID } from './villages';

export const PRIMARY_SOURCE_ID = 'rps-sahrdaya';

export const DEFAULT_SENSOR_SOURCES = [
    {
        id: PRIMARY_SOURCE_ID,
        label: 'RPS Sahrdaya (primary)',
        url: SENSOR_DB_URL,
        site: CAMPUS_ID,
        priority: 10,
        enabled: true,
        primary: true
    },
    {
        id: 'rps-project-2',
        label: 'RPS Project 2 (new nodes: water relay, irrigation pump, power)',
        url: 'https://rps-project-2-default-rtdb.asia-southeast1.firebasedatabase.app',
        site: CAMPUS_ID,
        priority: 5,
        enabled: true,
        primary: false
    }
];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const cleanUrl = (u) => String(u || '').trim().replace(/\/+$/, '');

/** Merge config/sources overrides (and any extra sources added there) into the defaults. */
export const resolveSensorSources = (configSources) => {
    const overrides = isObj(configSources) ? configSources : {};
    const byId = new Map(DEFAULT_SENSOR_SOURCES.map((s) => [s.id, { ...s }]));
    Object.entries(overrides).forEach(([id, raw]) => {
        if (!isObj(raw)) return;
        const base = byId.get(id) || { id, label: id, url: '', site: CAMPUS_ID, priority: 50, enabled: true, primary: false };
        byId.set(id, {
            ...base,
            label: typeof raw.label === 'string' && raw.label.trim() ? raw.label : base.label,
            url: base.primary ? base.url : (cleanUrl(raw.url) || base.url),
            site: typeof raw.site === 'string' && raw.site ? raw.site : base.site,
            priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : base.priority,
            enabled: base.primary ? true : (raw.enabled !== false)
        });
    });
    return [...byId.values()]
        .filter((s) => s.url)
        .sort((a, b) => a.priority - b.priority || Number(b.primary) - Number(a.primary));
};

/** Split "<sourceId>:<path>" into its parts; unprefixed paths belong to the primary. */
export const parseSourcePath = (path) => {
    const text = String(path || '');
    const m = text.match(/^([a-z0-9][a-z0-9_-]*):(.*)$/i);
    if (m && !text.startsWith('http')) return { sourceId: m[1], path: m[2] };
    return { sourceId: PRIMARY_SOURCE_ID, path: text };
};

export const sourcePrefix = (source) => (source.primary ? '' : `${source.id}:`);
