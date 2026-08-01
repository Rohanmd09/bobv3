# Email + SMS Notifications Setup

This app can send real **email** and **SMS** after every successful payment.

---

## 1. Email (EmailJS – free, no backend needed)

1. Go to → https://www.emailjs.com and create a free account  
2. **Email Services** → Add New Service → connect Gmail / Outlook etc.  
   → Copy the **Service ID**
3. **Email Templates** → Create New Template  
   Suggested template content:

   ```
   Subject: {{subject}}

   {{message}}

   Amount : {{amount}}
   Payee  : {{payee}}
   Ref    : {{ref}}
   Mode   : {{mode}}
   Time   : {{time}}
   Status : {{status}}
   ```

   → Copy the **Template ID**

4. **Account → API Keys** → Copy your **Public Key**

5. Open `index.html` and fill in:

```js
emailjs: {
  publicKey:  'xxxxxxxxxxxxxxxxxxxx',
  serviceId:  'service_xxxxxxx',
  templateId: 'template_xxxxxxx',
},
recipientEmail: 'minsultana919365@gmail.com',
```

Done! Email will now send for real.

---

## 2. SMS (needs a tiny backend)

You have two easy free options:

### Option A – Cloudflare Worker (recommended, free forever)

1. Go to https://dash.cloudflare.com → **Workers & Pages** → Create Worker  
2. Paste the entire content of `sms-worker.js`  
3. Go to **Settings → Variables** and add these **Secrets**:

| Name                 | Value                          | Required for |
|----------------------|--------------------------------|--------------|
| `API_KEY`            | any long random string         | both         |
| `SMS_PROVIDER`       | `twilio` or `msg91`            | both         |
| `TWILIO_ACCOUNT_SID` | ACxxxxxxxx                     | Twilio       |
| `TWILIO_AUTH_TOKEN`  | your token                     | Twilio       |
| `TWILIO_FROM`        | +1xxxxxxxxxx                   | Twilio       |
| `MSG91_AUTH_KEY`     | your authkey                   | MSG91        |
| `MSG91_SENDER_ID`    | HDFCBK (6 chars)               | MSG91        |

4. Deploy → copy the URL (e.g. `https://sms-xxx.yourname.workers.dev`)

5. In `index.html` set:

```js
smsApiUrl: 'https://sms-xxx.yourname.workers.dev',
smsApiKey: 'the-same-random-string-you-put-in-API_KEY',
recipientPhone: '+919876543210',   // real number with country code
```

### Option B – Local Node.js server

```bash
cd backend
npm init -y
npm install express cors dotenv twilio
```

Create `.env`:

```
API_KEY=your-secret
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_FROM=+1xxxx
# or for MSG91:
# SMS_PROVIDER=msg91
# MSG91_AUTH_KEY=xxxx
# MSG91_SENDER_ID=HDFCBK
```

Run:

```bash
node node-sms-server.js
```

Then in the app:

```js
smsApiUrl: 'http://localhost:3001/send-sms',
smsApiKey: 'your-secret',
```

---

## Testing

1. Fill the keys in `index.html`
2. Open the app → Login → Send Money → complete a payment
3. On the success screen you will see:

   - 📧 Email notification → **Sent** / Failed / Not configured  
   - 📱 SMS notification   → **Sent** / Failed / Not configured

---

## Notes

- EmailJS free plan = 200 emails / month  
- Never put Twilio / MSG91 secret keys in the frontend – that is why we use a Worker  
- For production India SMS you usually need DLT-registered templates (MSG91 helps with this)
