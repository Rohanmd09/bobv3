export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Simple protection
  if (req.headers['x-api-key'] !== process.env.SMS_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { to, message } = req.body || {};
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message' });
  }

  try {
    const provider = (process.env.SMS_PROVIDER || 'twilio').toLowerCase();

    if (provider === 'msg91') {
      // ----- MSG91 -----
      const authkey = process.env.MSG91_AUTH_KEY;
      const sender  = process.env.MSG91_SENDER_ID || 'HDFCBK';
      const number  = String(to).replace(/\D/g, '');
      const mobile  = number.startsWith('91') ? number : '91' + number;

      const url = `https://api.msg91.com/api/sendhttp.php?authkey=${authkey}&mobiles=${mobile}&message=${encodeURIComponent(message)}&sender=${sender}&route=4&country=91`;
      const r = await fetch(url);
      const text = await r.text();
      if (!r.ok) throw new Error(text);
      return res.status(200).json({ success: true, provider: 'msg91', id: text });
    }

    // ----- Twilio (default) -----
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from  = process.env.TWILIO_FROM;

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({ To: to, From: from, Body: message });

    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Twilio error');

    return res.status(200).json({ success: true, provider: 'twilio', sid: data.sid });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
