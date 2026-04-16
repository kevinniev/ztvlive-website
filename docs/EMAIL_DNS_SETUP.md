# ZTVLIVE Email & DNS Setup Guide

## 1. SendGrid Setup (Email Delivery)

### Step 1: Create SendGrid Account
1. Go to https://sendgrid.com and sign up (free tier: 100 emails/day)
2. Verify your email address
3. Complete the account setup

### Step 2: Generate API Key
1. Log into SendGrid Dashboard
2. Go to **Settings → API Keys**
3. Click **Create API Key**
4. Name it: `ZTVLIVE Production`
5. Select **Full Access** permissions
6. Click **Create & View**
7. **COPY THE KEY IMMEDIATELY** (you won't see it again!)

### Step 3: Add to ZTVLIVE
Add to `/app/backend/.env`:
```
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_SENDER_EMAIL=noreply@ztvlivestream.com
```

---

## 2. Namecheap DNS Configuration (SPF & DKIM)

### Why This Matters
Without SPF and DKIM, your emails will:
- Go to spam folders
- Be rejected by Gmail, Yahoo, etc.
- Show "via sendgrid.net" instead of your domain

### Step 1: Log into Namecheap
1. Go to https://www.namecheap.com
2. Log in to your account
3. Click **Domain List** → Find `ztvlivestream.com`
4. Click **Manage** → **Advanced DNS**

### Step 2: Add SPF Record
| Type | Host | Value | TTL |
|------|------|-------|-----|
| TXT | @ | `v=spf1 include:sendgrid.net ~all` | Auto |

### Step 3: Add DKIM Record (from SendGrid)
1. In SendGrid, go to **Settings → Sender Authentication**
2. Click **Authenticate Your Domain**
3. Select DNS host: **Namecheap**
4. Enter domain: `ztvlivestream.com`
5. SendGrid will give you 3 CNAME records to add

Example CNAME records (yours will be different):
| Type | Host | Value |
|------|------|-------|
| CNAME | em1234.ztvlivestream.com | u1234567.wl001.sendgrid.net |
| CNAME | s1._domainkey.ztvlivestream.com | s1.domainkey.u1234567.wl001.sendgrid.net |
| CNAME | s2._domainkey.ztvlivestream.com | s2.domainkey.u1234567.wl001.sendgrid.net |

### Step 4: Add DMARC Record (Recommended)
| Type | Host | Value | TTL |
|------|------|-------|-----|
| TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:admin@ztvlivestream.com` | Auto |

### Step 5: Verify in SendGrid
1. After adding DNS records, wait 5-10 minutes
2. Go back to SendGrid → Sender Authentication
3. Click **Verify** next to your domain
4. All should show green checkmarks ✅

---

## 3. Test Email Delivery

After setup, test with:
```bash
curl -X POST https://www.ztvlivestream.com/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@gmail.com", "subject": "Test", "message": "Hello!"}'
```

---

## Quick Checklist

- [ ] SendGrid account created
- [ ] API key generated and added to .env
- [ ] SPF record added in Namecheap
- [ ] DKIM CNAME records added (3 records)
- [ ] DMARC record added
- [ ] Domain verified in SendGrid (green checkmarks)
- [ ] Test email sent successfully

---

## Troubleshooting

**Emails going to spam?**
- Wait 24-48 hours for DNS propagation
- Check SendGrid Activity for delivery status
- Ensure all 3 DKIM records are correct

**Domain verification failing?**
- Double-check CNAME values (no extra spaces)
- DNS changes can take up to 48 hours
- Try the "Verify" button again after 1 hour

**Need help?**
SendGrid Support: https://support.sendgrid.com
