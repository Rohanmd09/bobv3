/**
 * Simple Node.js + Express SMS server (alternative to Cloudflare Worker)
 * ---------------------------------------------------------------------
 * 1. npm init -y
 * 2. npm install express cors dotenv twilio
 * 3. Create .env with the variables below
 * 4. node node-sms-server.js
 * 5. Put http://localhost:3001/send-sms into NOTIF_CONFIG.smsApiUrl
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'change-me';

// Twilio client (optional – only if using Twilio)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

app.post('/send-sms', async (req, res) => {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message' });
  }

  try {
    const provider = (process.env.SMS_PROVIDER || 'twilio').toLowerCase();

    if (provider === 'msg91') {
      // MSG91 via HTTP
      const authkey = process.env.MSG91_AUTH_KEY;
      const sender  = process.env.MSG91_SENDER_ID || 'HDFCBK';
      const number  = String(to).replace(/\D/g, '');
      const mobile  = number.startsWith('91') ? number : '91' + number;

      const url = `https://api.msg91.com/api/sendhttp.php?authkey=${authkey}&mobiles=${mobile}&message=${encodeURIComponent(message)}&sender=${sender}&route=4&country=91`;
      const r = await fetch(url);
      const text = await r.text();
      if (!r.ok) throw new Error(text);
      return res.json({ success: true, provider: 'msg91', requestId: text });
    }

    // Default: Twilio
    if (!twilioClient) throw new Error('Twilio not configured');
    const msg = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_FROM,
      to
    });
    res.json({ success: true, provider: 'twilio', sid: msg.sid, status: msg.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SMS server running on http://localhost:${PORT}`);
});
