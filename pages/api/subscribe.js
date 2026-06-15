import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "Resend API key not configured" });
  }

  try {
    // Send confirmation email to subscriber
    await resend.emails.send({
      from: "hello@thevalluru.org",
      to: email,
      subject: "Welcome to The Inward Fire Letter",
      html: getSubscriberEmailTemplate(name)
    });

    // Send admin notification
    await resend.emails.send({
      from: "hello@thevalluru.org",
      to: "sasi@thevalluru.org",
      subject: `New Subscriber: ${name}`,
      html: getAdminEmailTemplate(name, email)
    });

    return res.status(200).json({ success: true, message: "Subscribed successfully" });
  } catch (error) {
    console.error("Subscription error:", error);
    return res.status(500).json({ error: "Failed to process subscription" });
  }
}

function getSubscriberEmailTemplate(name) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #2d2d2d;
            background-color: #f9f7f4;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
            background-color: #ffffff;
          }
          .header {
            border-bottom: 2px solid #d4af37;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: 600;
            color: #2d2d2d;
            letter-spacing: 0.05em;
          }
          .content {
            font-size: 16px;
            line-height: 1.8;
            color: #555555;
            margin-bottom: 30px;
          }
          .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #2d2d2d;
          }
          .footer {
            border-top: 1px solid #e8e6e1;
            padding-top: 20px;
            margin-top: 40px;
            font-size: 13px;
            color: #999999;
            text-align: center;
          }
          .highlight {
            color: #d4af37;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">The Valluru</div>
          </div>
          
          <div class="content">
            <div class="greeting">Dear ${name},</div>
            
            <p>Thank you for subscribing to <span class="highlight">The Inward Fire Letter</span>.</p>
            
            <p>You'll receive quiet, unrushed reflections on dharma, grief, language, surrender, and the inner life — once a month. Plain. Literary. Restrained. No clickbait. No exclamation marks.</p>
            
            <p>Each letter brings:</p>
            <ul>
              <li>One short reflection</li>
              <li>One meaningful quote</li>
              <li>One booklet recommendation</li>
            </ul>
            
            <p>We write for the person who has optimized their external life but still needs an anchor for the inward fire. For the seeker who is tired of noise.</p>
            
            <p>Until the next letter,<br>
            <span class="highlight">Sasidhar Valluru</span></p>
          </div>
          
          <div class="footer">
            <p>You subscribed to The Inward Fire Letter with this email: <strong>${name}</strong></p>
            <p>You can unsubscribe at any time by replying to this email.</p>
            <p style="margin-top: 15px; color: #d4af37;">A quiet archive of writings on dharma, grief, language, surrender, and the inner life.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getAdminEmailTemplate(name, email) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #2d2d2d;
            background-color: #f9f7f4;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
            background-color: #ffffff;
          }
          .header {
            border-bottom: 2px solid #d4af37;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: 600;
            color: #2d2d2d;
            letter-spacing: 0.05em;
          }
          .content {
            font-size: 15px;
            line-height: 1.8;
            color: #555555;
            margin-bottom: 30px;
          }
          .subscriber-info {
            background-color: #f9f7f4;
            padding: 20px;
            border-left: 4px solid #d4af37;
            margin: 20px 0;
            border-radius: 4px;
          }
          .info-row {
            margin-bottom: 10px;
            display: flex;
            gap: 10px;
          }
          .info-label {
            font-weight: 600;
            color: #2d2d2d;
            min-width: 80px;
          }
          .info-value {
            color: #555555;
          }
          .footer {
            border-top: 1px solid #e8e6e1;
            padding-top: 20px;
            font-size: 13px;
            color: #999999;
            text-align: center;
          }
          .highlight {
            color: #d4af37;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">The Valluru — Admin Notification</div>
          </div>
          
          <div class="content">
            <p>New subscriber to The Inward Fire Letter:</p>
            
            <div class="subscriber-info">
              <div class="info-row">
                <div class="info-label">Name:</div>
                <div class="info-value">${name}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Email:</div>
                <div class="info-value">${email}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Date:</div>
                <div class="info-value">${new Date().toLocaleString()}</div>
              </div>
            </div>
            
            <p>A confirmation email has been sent to the subscriber.</p>
          </div>
          
          <div class="footer">
            <p>The Inward Fire Letter — Newsletter Management</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
