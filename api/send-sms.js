export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Protect the endpoint
  if (req.headers['x-api-key'] !== process.env.SMS_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { to, message } = req.body || {};
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message' });
  }

  try {
    const deviceId = process.env.TEXTBEE_DEVICE_ID;
    const apiKey   = process.env.TEXTBEE_API_KEY;

    if (!deviceId || !apiKey) {
      throw new Error('Textbee credentials missing');
    }

    const response = await fetch(
      `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          recipients: [to],
          message: message
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Textbee error');
    }

    return res.status(200).json({ success: true, provider: 'textbee', data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
