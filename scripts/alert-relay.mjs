#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Alert relay: turns rows in alerts/outbox (written by the Gram Vista dashboard)
// into real SMS / WhatsApp messages using a provider key that never leaves this
// machine. Run it on any always-on PC or Raspberry Pi:
//
//   FAST2SMS_KEY=xxxx node scripts/alert-relay.mjs          # Indian SMS
//   TWILIO_SID=AC.. TWILIO_TOKEN=.. TWILIO_FROM=+1.. node scripts/alert-relay.mjs
//   CALLMEBOT_KEY=123456 node scripts/alert-relay.mjs       # WhatsApp
//   node scripts/alert-relay.mjs --dry-run                  # print only
//
// Options: SENSOR_DB_URL, DB_AUTH (database secret if rules require it),
//          INTERVAL (seconds, default 10)
// ---------------------------------------------------------------------------

const DB_URL = (process.env.SENSOR_DB_URL || 'https://rps-sahrdaya-bfe70-default-rtdb.asia-southeast1.firebasedatabase.app').replace(/\/+$/, '');
const AUTH = process.env.DB_AUTH ? `?auth=${encodeURIComponent(process.env.DB_AUTH)}` : '';
const INTERVAL_S = Number(process.env.INTERVAL || 10);
const DRY_RUN = process.argv.includes('--dry-run');

const provider = process.env.FAST2SMS_KEY ? 'fast2sms'
    : process.env.TWILIO_SID ? 'twilio'
        : process.env.CALLMEBOT_KEY ? 'callmebot'
            : 'print';

const log = (...args) => console.log(`[${new Date().toLocaleTimeString('en-IN', { hour12: false })}]`, ...args);

const digits = (phone) => String(phone || '').replace(/\D/g, '');

const deliver = async (row) => {
    const to = digits(row.to);
    const text = String(row.text || '').slice(0, 480);
    if (DRY_RUN || provider === 'print') { log('DRY', to, text); return { ok: true, via: 'print' }; }

    if (provider === 'fast2sms') {
        const numbers = to.startsWith('91') ? to.slice(2) : to;
        const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(process.env.FAST2SMS_KEY)}&route=q&message=${encodeURIComponent(text)}&numbers=${numbers}`);
        const body = await res.json().catch(() => ({}));
        return { ok: res.ok && body.return !== false, via: 'fast2sms', detail: JSON.stringify(body).slice(0, 200) };
    }
    if (provider === 'twilio') {
        const sid = process.env.TWILIO_SID; const token = process.env.TWILIO_TOKEN; const from = process.env.TWILIO_FROM;
        const params = new URLSearchParams({ To: `+${to}`, From: from, Body: text });
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        const body = await res.json().catch(() => ({}));
        return { ok: res.ok, via: 'twilio', detail: body.sid || body.message || '' };
    }
    if (provider === 'callmebot') {
        const res = await fetch(`https://api.callmebot.com/whatsapp.php?phone=${to}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(process.env.CALLMEBOT_KEY)}`);
        return { ok: res.ok, via: 'callmebot', detail: (await res.text().catch(() => '')).slice(0, 120) };
    }
    return { ok: false, via: provider, detail: 'no provider' };
};

const tick = async () => {
    const res = await fetch(`${DB_URL}/alerts/outbox.json${AUTH}`);
    if (!res.ok) { log('read failed', res.status); return; }
    const rows = (await res.json()) || {};
    const pending = Object.entries(rows).filter(([, r]) => r && r.status === 'pending');
    for (const [id, row] of pending) {
        try {
            const result = await deliver(row);
            const patch = { status: result.ok ? 'sent' : 'failed', relay: result.via, relayDetail: result.detail || '', relayedAt: Date.now() };
            await fetch(`${DB_URL}/alerts/outbox/${id}.json${AUTH}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
            log(result.ok ? 'sent' : 'FAILED', id, '->', row.to, 'via', result.via, result.detail || '');
        } catch (err) {
            log('error', id, err.message);
        }
    }
};

log(`Alert relay watching ${DB_URL}/alerts/outbox every ${INTERVAL_S}s via ${provider}${DRY_RUN ? ' (dry run)' : ''}`);
tick().catch((e) => log('error', e.message));
setInterval(() => tick().catch((e) => log('error', e.message)), INTERVAL_S * 1000);
