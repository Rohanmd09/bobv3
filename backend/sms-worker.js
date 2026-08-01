/**
 * Cloudflare Worker – SMS Notification API
 * -----------------------------------------
 * Deploy this free on Cloudflare Workers.
 *
 * Supports:
 *   1. Twilio
 *   2. MSG91  (popular in India)
 *
 * Setup:
 *   1. Create a Worker at https://dash.cloudflare.com → Workers
 *   2. Paste this entire file
 *   3. Add Environment Variables / Secrets:
 *        API_KEY          = a long random string (shared with frontend)
 *        SMS_PROVIDER     = "twilio"  or  "msg91"
 *
 *        // If using Twilio:
 *        TWILIO_ACCOUNT_SID = ACxxxxxxxx
 *        TWILIO_AUTH_TOKEN  = your_auth_token
 *        TWILIO_FROM        = +1xxxxxxxxxx   (or Messaging Service SID)
 *
 *        // If using MSG91:
 *        MSG91_AUTH_KEY    = your_authkey
 *        MSG91_SENDER_ID   = HDFCBK          (6 chars, approved)
 *        MSG91_ROUTE       = 4               (transactional)
 *        MSG91_TEMPLATE_ID = (optional for DLT India)
 *
 *   4. Deploy → copy the *.workers.dev URL into NOTIF_CONFIG.smsApiUrl
 */

export default {
  async fetch(request, env) {
    // CORS pre-flight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders()
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Simple shared-secret auth
    const apiKey = request.headers.get('X-API-Key') || '';
    if (!env.API_KEY || apiKey !== env.API_KEY) {
      return json({ error: 'Unauthorized' }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const { to, message } = body;
    if (!to || !message) {
      return json({ error: 'Missing "to" or "message"' }, 400);
    }

    try {
      const provider = (env.SMS_PROVIDER || 'twilio').toLowerCase();
      let result;

      if (provider === 'msg91') {
        result = await sendViaMsg91(env, to, message);
      } else {
        result = await sendViaTwilio(env, to, message);
      }

      return json({ success: true, provider, ...result });
    } catch (err) {
      console.error(err);
      return json({ error: err.message || 'SMS failed' }, 500);
    }
  }
};

/* ---------- Twilio ---------- */
async function sendViaTwilio(env, to, message) {
  const sid   = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from  = env.TWILIO_FROM;

  if (!sid || !token || !from) {
    throw new Error('Twilio credentials missing');
  }

  const auth = btoa(`${sid}:${token}`);
  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: message
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Twilio error');
  }
  return { sid: data.sid, status: data.status };
}

/* ---------- MSG91 ---------- */
async function sendViaMsg91(env, to, message) {
  const authkey = env.MSG91_AUTH_KEY;
  const sender  = env.MSG91_SENDER_ID || 'HDFCBK';
  const route   = env.MSG91_ROUTE || '4';

  if (!authkey) throw new Error('MSG91_AUTH_KEY missing');

  // Clean number (MSG91 expects 91xxxxxxxxxx without +)
  const number = String(to).replace(/\D/g, '').replace(/^0+/, '');
  const mobile = number.startsWith('91') ? number : '91' + number;

  const payload = {
    sender,
    route,
    country: '91',
    sms: [{ message, to: [mobile] }]
  };

  // Optional DLT template
  if (env.MSG91_TEMPLATE_ID) {
    payload.template_id = env.MSG91_TEMPLATE_ID;
  }

  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey
    },
    body: JSON.stringify(payload)
  });

  // Fallback to older bulk API if flow endpoint fails
  if (!res.ok) {
    const url = `https://api.msg91.com/api/sendhttp.php?authkey=${authkey}&mobiles=${mobile}&message=${encodeURIComponent(message)}&sender=${sender}&route=${route}&country=91`;
    const res2 = await fetch(url);
    const text = await res2.text();
    if (!res2.ok) throw new Error('MSG91 error: ' + text);
    return { requestId: text, status: 'submitted' };
  }

  const data = await res.json();
  return { requestId: data.request_id || data.type, status: 'submitted' };
}

/* ---------- helpers ---------- */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}
