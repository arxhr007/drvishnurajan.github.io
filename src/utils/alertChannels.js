// ---------------------------------------------------------------------------
// Mobile alert delivery.
//
// A static web app cannot send SMS on its own, so critical alerts are always
// written to the sensor database (alerts/outbox) where a relay can pick them
// up – `npm run alert:relay` on any machine with an SMS provider key, or a GSM
// (SIM800) node subscribed to the same path. Optionally the browser also fires
// the alert straight at a messaging API that accepts a plain GET/POST:
//
//   callmebot  – free WhatsApp messages (https://www.callmebot.com/blog/free-api-whatsapp-messages/)
//   fast2sms   – Indian SMS gateway, GET API with an authorization key
//   webhook    – any URL of yours (Twilio Function, Google Apps Script, n8n …)
//
// Those requests are sent with `mode: "no-cors"`, so the browser can fire them
// but cannot read the reply; the outbox row records what was attempted.
//
// SECURITY: the sensor database (rps-sahrdaya) has open read/write rules, so
// anything written to it is public. Provider API keys and webhook URLs are
// therefore NEVER written to Firebase — they live only in this browser's
// localStorage (readLocalAlertSecrets/writeLocalAlertSecrets below) and are
// merged into alertConfig client-side. Only non-secret settings (phone,
// name, channel, cooldown, enabled, includeWarnings) go to config/alerts,
// where every admin's browser can share them.
// ---------------------------------------------------------------------------

export const ALERT_CHANNELS = [
    { id: 'outbox', label: 'Firebase outbox only (relay script / GSM node)', needsKey: false, needsUrl: false },
    { id: 'callmebot', label: 'WhatsApp via CallMeBot', needsKey: true, needsUrl: false, keyLabel: 'CallMeBot API key' },
    { id: 'fast2sms', label: 'SMS via Fast2SMS (India)', needsKey: true, needsUrl: false, keyLabel: 'Fast2SMS authorization key' },
    { id: 'webhook', label: 'Custom webhook (POST JSON)', needsKey: false, needsUrl: true }
];

export const DEFAULT_ALERT_CONFIG = {
    enabled: false,
    phone: '',
    name: '',
    channel: 'outbox',
    apiKey: '',
    webhookUrl: '',
    cooldownMinutes: 30,
    includeWarnings: false
};

// Fields safe to store in the shared (public, no-auth) sensor database.
export const SHARED_ALERT_FIELDS = ['enabled', 'phone', 'name', 'channel', 'cooldownMinutes', 'includeWarnings'];
// Fields kept device-local only, never written to Firebase.
export const SECRET_ALERT_FIELDS = ['apiKey', 'webhookUrl'];

const LOCAL_SECRET_KEY = 'gramvista.alertSecrets';

/** Provider key / webhook URL for this browser only. Never synced to Firebase. */
export const readLocalAlertSecrets = () => {
    try {
        const raw = localStorage.getItem(LOCAL_SECRET_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return { apiKey: parsed.apiKey || '', webhookUrl: parsed.webhookUrl || '' };
    } catch {
        return { apiKey: '', webhookUrl: '' };
    }
};

export const writeLocalAlertSecrets = ({ apiKey = '', webhookUrl = '' }) => {
    try {
        localStorage.setItem(LOCAL_SECRET_KEY, JSON.stringify({ apiKey, webhookUrl }));
    } catch {
        /* storage unavailable (private browsing, quota) — secret channels just won't persist */
    }
};

/** Split a full alert-config draft into the part that is safe to share and the part that is not. */
export const splitAlertConfig = (cfg) => {
    const shared = {};
    SHARED_ALERT_FIELDS.forEach((key) => { shared[key] = cfg[key]; });
    const secret = {};
    SECRET_ALERT_FIELDS.forEach((key) => { secret[key] = cfg[key] || ''; });
    return { shared, secret };
};

/** Digits only with country code; 10-digit Indian numbers get +91. */
export const normalizePhone = (input) => {
    const digits = String(input || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
    return digits;
};

export const formatPhone = (digits) => (digits ? `+${digits}` : '');

const istTime = (date = new Date()) => date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
});

export const buildAlertMessage = (alert, siteName) => {
    const sev = String(alert.severity || 'critical').toUpperCase();
    const body = `${alert.title}. ${alert.message || ''}`.trim();
    return `[Gram Vista] ${sev} at ${siteName}: ${body} (${istTime()})`.slice(0, 480);
};

export const whatsappLink = (phone, text) => `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;
export const smsLink = (phone, text) => `sms:${formatPhone(normalizePhone(phone))}?body=${encodeURIComponent(text)}`;

/**
 * Fire the alert at the configured provider. Resolves to a small report; never
 * throws for provider errors because no-cors responses are opaque anyway.
 */
export const sendViaChannel = async (config, text) => {
    const phone = normalizePhone(config.phone);
    const channel = config.channel || 'outbox';

    if (channel === 'outbox') {
        return { channel, dispatched: false, note: 'Queued in Firebase outbox for the relay' };
    }
    if (!phone && channel !== 'webhook') {
        return { channel, dispatched: false, note: 'No phone number configured' };
    }

    try {
        if (channel === 'callmebot') {
            if (!config.apiKey) return { channel, dispatched: false, note: 'CallMeBot API key missing' };
            const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(config.apiKey)}`;
            await fetch(url, { mode: 'no-cors', cache: 'no-store' });
            return { channel, dispatched: true, note: 'WhatsApp request sent to CallMeBot' };
        }
        if (channel === 'fast2sms') {
            if (!config.apiKey) return { channel, dispatched: false, note: 'Fast2SMS key missing' };
            const numbers = phone.startsWith('91') ? phone.slice(2) : phone;
            const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(config.apiKey)}&route=q&message=${encodeURIComponent(text)}&numbers=${numbers}`;
            await fetch(url, { mode: 'no-cors', cache: 'no-store' });
            return { channel, dispatched: true, note: 'SMS request sent to Fast2SMS' };
        }
        if (channel === 'webhook') {
            if (!config.webhookUrl) return { channel, dispatched: false, note: 'Webhook URL missing' };
            await fetch(config.webhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: formatPhone(phone), text, source: 'gram-vista' })
            });
            return { channel, dispatched: true, note: 'Webhook called' };
        }
    } catch (error) {
        return { channel, dispatched: false, note: `Provider call failed: ${error?.message || error}` };
    }
    return { channel, dispatched: false, note: 'Unknown channel' };
};
