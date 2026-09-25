// ---------------------------------------------------------------------------
// Ubidots public-dashboard client (LoRaWAN waste bins).
//
// The college's bins publish over LoRaWAN into Ubidots STEM. Their public
// dashboard page embeds a short-lived JWT ("public token") that grants
// read-only access to the dashboard's devices. Both the dashboard page and
// the API answer with `Access-Control-Allow-Origin: *`, so the browser can:
//   1. fetch the dashboard HTML and pull the token out of it,
//   2. list devices, their variables and last values with `Authorization: Bearer`,
//   3. repeat step 1 whenever the token is about to expire (a few minutes).
// No account API key is ever needed or stored.
// ---------------------------------------------------------------------------

export const DEFAULT_UBIDOTS_DASHBOARD_URL =
    'https://stem.ubidots.com/app/dashboards/public/dashboard/9TtC81qHtt365oHkfxyj16gnXDqmBoxy';

export const DEFAULT_UBIDOTS_CONFIG = {
    enabled: true,
    dashboardUrl: DEFAULT_UBIDOTS_DASHBOARD_URL,
    pollSeconds: 60,
    historyPoints: 48,
    offlineAfterMinutes: 30,   // no uplink for this long → bin shown offline
    fullAlertPct: 85           // fill level that raises a critical alert
};

const TOKEN_MARGIN_MS = 90 * 1000;

/** The dashboard link to open for people: full-screen layout without the layers/context bars. */
export const ubidotsLiveUrl = (dashboardUrl = DEFAULT_UBIDOTS_DASHBOARD_URL) => {
    try {
        const u = new URL(dashboardUrl);
        u.searchParams.set('navbar', 'true');
        u.searchParams.set('contextbar', 'false');
        u.searchParams.set('layersBar', 'false');
        return u.toString();
    } catch {
        return dashboardUrl;
    }
};

const apiBaseFor = (dashboardUrl) => {
    try {
        const u = new URL(dashboardUrl);
        return `${u.protocol}//${u.host}`;
    } catch {
        return 'https://stem.ubidots.com';
    }
};

const decodeJwtExp = (token) => {
    try {
        const payload = token.split('.')[1];
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '='));
        const exp = JSON.parse(json).exp;
        return typeof exp === 'number' ? exp * 1000 : 0;
    } catch {
        return 0;
    }
};

let tokenCache = { token: null, exp: 0, url: null };

/** Read the public token from the dashboard page (cached until it nears expiry). */
export const fetchPublicToken = async (dashboardUrl, { force = false } = {}) => {
    const now = Date.now();
    if (!force && tokenCache.token && tokenCache.url === dashboardUrl && tokenCache.exp - now > TOKEN_MARGIN_MS) {
        return tokenCache.token;
    }
    const res = await fetch(dashboardUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Dashboard page HTTP ${res.status}`);
    const html = await res.text();
    const match = html.match(/token\s*=\s*['"]([A-Za-z0-9\-_.]+)['"]/) || html.match(/public_token['"]?\s*[:=]\s*['"]([A-Za-z0-9\-_.]+)['"]/);
    if (!match) throw new Error('No public token found in the dashboard page');
    tokenCache = { token: match[1], exp: decodeJwtExp(match[1]) || now + 4 * 60 * 1000, url: dashboardUrl };
    return tokenCache.token;
};

const apiGet = async (base, token, path) => {
    const res = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store'
    });
    if (res.status === 401) { const err = new Error('unauthorized'); err.status = 401; throw err; }
    if (!res.ok) throw new Error(`Ubidots HTTP ${res.status} for ${path}`);
    return res.json();
};

const numberOr = (v, fallback = null) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/**
 * Devices + variables + last values + a short history of the level variable.
 * Returns `{ bins: [...], fetchedAt }`. Each bin:
 *   { id, label, name, fillPct, status, lat, lng, lastActivity, variables, history }
 */
export const fetchUbidotsBins = async (config = DEFAULT_UBIDOTS_CONFIG) => {
    const dashboardUrl = config.dashboardUrl || DEFAULT_UBIDOTS_DASHBOARD_URL;
    const base = apiBaseFor(dashboardUrl);
    const historyPoints = Math.max(2, Math.min(200, Number(config.historyPoints) || 48));

    const run = async (token) => {
        const devices = await apiGet(base, token, '/api/v2.0/devices/?page_size=100');
        const bins = [];
        for (const device of devices.results || []) {
            const varsRes = await apiGet(base, token, `/api/v2.0/devices/${device.id}/variables/?page_size=50`);
            const variables = (varsRes.results || []).map((v) => ({
                id: v.id,
                label: v.label,
                name: v.name,
                unit: v.unit || '',
                value: numberOr(v.lastValue?.value),
                context: v.lastValue?.context || {},
                timestamp: numberOr(v.lastValue?.timestamp) || numberOr(v.lastActivity) || null
            }));

            const level = variables.find((v) => /level|fill|waste/i.test(`${v.label} ${v.name}`))
                || variables.find((v) => v.value !== null && !/location|gps|lat|lng/i.test(`${v.label} ${v.name}`));
            const location = variables.find((v) => /location|gps/i.test(`${v.label} ${v.name}`));
            const battery = variables.find((v) => /batt|volt/i.test(`${v.label} ${v.name}`));
            const temperature = variables.find((v) => /temp/i.test(`${v.label} ${v.name}`));

            let history = [];
            if (level) {
                try {
                    const values = await apiGet(base, token, `/api/v1.6/variables/${level.id}/values/?page_size=${historyPoints}`);
                    history = (values.results || [])
                        .map((r) => ({ ts: r.timestamp, value: numberOr(r.value), status: r.context?.status || null }))
                        .filter((r) => r.value !== null)
                        .sort((a, b) => a.ts - b.ts);
                } catch (err) {
                    console.warn('Ubidots history fetch failed for', device.label, err.message);
                }
            }

            const lat = numberOr(location?.context?.lat) ?? numberOr(device.properties?._location_fixed_lat) ?? null;
            const lng = numberOr(location?.context?.lng) ?? numberOr(device.properties?._location_fixed_lng) ?? null;
            const lastActivity = numberOr(device.lastActivity) || level?.timestamp || null;

            bins.push({
                id: device.id,
                label: device.label,
                name: device.name || device.label,
                fillPct: level?.value !== null && level?.value !== undefined ? Math.max(0, Math.min(100, level.value)) : null,
                levelLabel: level?.name || 'Waste level',
                status: level?.context?.status || null,
                batteryPct: numberOr(battery?.value),
                tempC: numberOr(temperature?.value),
                lat, lng,
                lastActivity,
                variables,
                history,
                deviceUrl: `${base}/app/devices/${device.id}`
            });
        }
        return bins;
    };

    let token = await fetchPublicToken(dashboardUrl);
    let bins;
    try {
        bins = await run(token);
    } catch (err) {
        if (err.status !== 401) throw err;
        token = await fetchPublicToken(dashboardUrl, { force: true });
        bins = await run(token);
    }
    return { bins, fetchedAt: Date.now(), dashboardUrl };
};

/** Overflow state from the fill level and the node's own status word. */
export const classifyBin = (bin, fullAlertPct = DEFAULT_UBIDOTS_CONFIG.fullAlertPct) => {
    if (bin.fillPct === null || bin.fillPct === undefined) return { state: 'unknown', label: 'No level reading' };
    const word = String(bin.status || '').toLowerCase();
    if (bin.fillPct >= fullAlertPct || word.includes('fill')) return { state: 'critical', label: 'Nearly full – collect now' };
    if (bin.fillPct >= 60 || word.includes('alert')) return { state: 'warning', label: 'Filling up' };
    return { state: 'normal', label: 'Capacity available' };
};

/** Fill-rate (percent points per hour) from the recent history, or null. */
export const fillRatePerHour = (history) => {
    if (!history || history.length < 2) return null;
    const first = history[0]; const last = history[history.length - 1];
    const hours = (last.ts - first.ts) / 3600000;
    if (hours <= 0) return null;
    return (last.value - first.value) / hours;
};
