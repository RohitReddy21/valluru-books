# Resend Email Integration Setup Guide

This guide walks you through setting up email notifications for your newsletter using Resend.

## What's Installed

✅ **API Endpoint:** `/pages/api/subscribe.js` - Handles newsletter subscriptions  
✅ **Email Templates:** Two professional HTML templates ready to use  
✅ **Resend Package:** Added to frontend dependencies  

## Step 1: Install Dependencies

Run this command in your frontend directory:

```bash
npm install
```

This will install the `resend` package.

## Step 2: Get Your Resend API Key

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account
3. Go to your dashboard → **API Keys**
4. Create a new API key
5. Copy the key (it starts with `re_`)

## Step 3: Set Up Environment Variables

Add your Resend API key to your environment variables:

### For Development
Create or update `.env.local` in your `frontend` directory:

```env
RESEND_API_KEY=re_your_actual_api_key_here
```

### For Production
Add the environment variable in your hosting platform:

**If using Render.yaml:**
```yaml
envVars:
  - key: RESEND_API_KEY
    value: re_your_actual_api_key_here
```

**If using Vercel/Netlify:**
Add through their dashboard → Settings → Environment Variables

## Step 3: Verify Sender Domain

Before sending emails, you need to verify your domain in Resend:

1. Log in to Resend dashboard
2. Go to **Domains**
3. Add domain: `thevalluru.org`
4. Follow the DNS verification steps
5. Once verified, you can send emails from `hello@thevalluru.org`

## Email Configuration

Your setup is configured with:

| Setting | Value |
|---------|-------|
| **Admin Email** | sasi@thevalluru.org |
| **Sender Email** | hello@thevalluru.org |
| **API Endpoint** | /api/subscribe |

## Email Templates

### 1. Subscriber Confirmation Email
- **To:** Subscriber's email
- **From:** hello@thevalluru.org
- **Subject:** Welcome to The Inward Fire Letter
- **Features:**
  - Personalized greeting with subscriber's name
  - Explains what they'll receive
  - Matches your site's aesthetic (professional, minimal)
  - Unsubscribe information

### 2. Admin Notification Email
- **To:** sasi@thevalluru.org
- **From:** hello@thevalluru.org
- **Subject:** New Subscriber: [Subscriber Name]
- **Features:**
  - Subscriber details (name, email, timestamp)
  - Confirmation that welcome email was sent
  - Clean, readable format

## Testing the Integration

### 1. Test Locally
```bash
cd frontend
npm run dev
```

Then:
1. Navigate to your newsletter form
2. Subscribe with a test email
3. Check that:
   - Subscriber receives confirmation email
   - You receive admin notification at sasi@thevalluru.org

### 2. Common Issues

**"Resend API key not configured"**
- Make sure `.env.local` is created with your API key
- Restart the dev server after adding env vars

**"Emails not arriving"**
- Check spam/junk folder
- Verify sender domain is verified in Resend dashboard
- Check Resend dashboard for bounce or rejected emails

**"Domain verification failed"**
- Ensure your domain DNS records are updated
- Wait 24-48 hours for DNS propagation
- Resend usually verifies within a few minutes after DNS is correct

## Customizing Email Templates

Edit `/pages/api/subscribe.js` to modify the email templates:

```javascript
// For subscriber email, edit getSubscriberEmailTemplate(name)
// For admin email, edit getAdminEmailTemplate(name, email)
```

Change:
- Colors (currently using #d4af37 gold from your site)
- Text content
- Layout and styling
- Images/branding

## What Happens When Someone Subscribes

1. **User submits form** → Name & email sent to `/api/subscribe`
2. **Resend processes** → Two emails sent:
   - Welcome email to subscriber
   - Notification email to you
3. **User sees confirmation** → "Thank you. You will hear from us quietly."
4. **You get notified** → Check your email for new subscriber details

## Database Consideration

Currently, the emails are sent but subscribers aren't stored in a database. 

To save subscriber emails (recommended):
1. Add a database (Supabase, Neon, etc.)
2. Modify `/pages/api/subscribe.js` to also save to database
3. Build an admin interface to view all subscribers

Would you like help setting this up?

## Support

For Resend issues: https://resend.com/docs  
For Next.js API routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
