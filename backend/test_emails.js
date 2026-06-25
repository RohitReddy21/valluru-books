const dotenv = require('dotenv');
const { Resend } = require('resend');

// Load env relative to backend folder
dotenv.config();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPublicSiteUrl() {
  return String(process.env.PUBLIC_SITE_URL || "https://www.thevalluru.org")
    .trim()
    .replace(/\/$/, "");
}

function emailShell({ preheader, eyebrow, title, content, footer }) {
  const siteUrl = getPublicSiteUrl();
  const logoUrl = `${siteUrl}/valluru-logo.png`;
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeHtml(title)}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap');
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      body { margin: 0; padding: 0; width: 100% !important; }
      @media only screen and (max-width: 640px) {
        .email-shell { width: 100% !important; }
        .email-pad { padding-left: 20px !important; padding-right: 20px !important; }
        .email-title { font-size: 28px !important; line-height: 36px !important; }
        .email-hero-pad { padding: 28px 20px 24px !important; }
        .email-content-pad { padding: 32px 20px 28px !important; }
        .email-footer-pad { padding: 20px 20px 24px !important; }
        .email-detail-label { font-size: 10px !important; }
        .email-detail-value { font-size: 14px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#0f0d0a;color:#2b261f;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">
      ${escapeHtml(preheader)}
      ${'\u200c\u00a0'.repeat(30)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f0d0a;">
      <tr>
        <td align="center" style="padding:40px 16px 48px;">
          <!-- Floating brand mark -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
            <tr>
              <td align="center">
                <a href="${siteUrl}" style="text-decoration:none;display:inline-block;">
                  <img src="${logoUrl}" alt="The Valluru" style="height:60px;width:auto;display:block;border:0;outline:none;text-decoration:none;" />
                </a>
              </td>
            </tr>
          </table>
          <!-- Main email card -->
          <table class="email-shell" role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:620px;max-width:620px;background:#faf6ef;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.35),0 0 0 1px rgba(181,139,53,0.25);">
            <!-- Hero header -->
            <tr>
              <td class="email-hero-pad" style="padding:38px 48px 30px;background:linear-gradient(180deg,#1a1610 0%,#221e16 100%);border-bottom:2px solid #3d3425;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <div style="font-family:'Inter',Arial,Helvetica,sans-serif;font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#b89446;">${escapeHtml(eyebrow)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 0 0;">
                      <div style="width:36px;height:2px;background:#b89446;border-radius:1px;margin-bottom:20px;"></div>
                      <h1 class="email-title" style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:38px;line-height:46px;font-weight:400;color:#f0e8d8;letter-spacing:-0.3px;">${escapeHtml(title)}</h1>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Decorative gold accent line -->
            <tr>
              <td style="height:3px;background:linear-gradient(90deg,#8a6a2e,#d4af37,#c9a24e,#8a6a2e);font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <!-- Content -->
            <tr>
              <td class="email-content-pad email-pad" style="padding:40px 48px 36px;background:#faf6ef;">
                ${content}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="height:1px;background:linear-gradient(90deg,transparent 5%,#d5c3a2 50%,transparent 95%);font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td class="email-footer-pad email-pad" style="padding:22px 48px 28px;background:#f0e8d8;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="font-family:'Inter',Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;color:#8a7b63;">
                      ${footer}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0 0;">
                      <div style="width:24px;height:1px;background:#c9a24e;opacity:0.5;"></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0 0;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:12px;font-style:italic;color:#a99d87;letter-spacing:0.5px;">
                      thevalluru.org
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <!-- Bottom flourish -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;">
            <tr>
              <td align="center">
                <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;color:#5d4c2c;letter-spacing:8px;">&#10043;</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildSubscriberEmail({ name, bookletTitle }) {
  const safeName = escapeHtml(name);
  const safeBookletTitle = bookletTitle ? escapeHtml(bookletTitle) : "";
  const siteUrl = getPublicSiteUrl();
  const seriesUrl = `${siteUrl}/series`;

  const requestedBooklet = safeBookletTitle
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
        <tr>
          <td style="padding:22px 24px;background:linear-gradient(135deg,#f5efe3 0%,#ebe1cf 100%);border-left:4px solid #c9a24e;border-radius:0 10px 10px 0;">
            <div style="font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#8a6a2e;margin-bottom:8px;">&#9670;&ensp;Your requested booklet</div>
            <div style="font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:22px;line-height:30px;color:#000000;font-weight:600;">${safeBookletTitle}</div>
          </td>
        </tr>
      </table>`
    : "";

  return {
    subject: safeBookletTitle
      ? `Your reading access: ${bookletTitle}`
      : "Welcome to The Inward Fire Letter",
    html: emailShell({
      preheader: "Your subscription to The Inward Fire Letter is confirmed.",
      eyebrow: "The Inward Fire Letter",
      title: `Welcome, ${name}`,
      content: `
        <p style="margin:0 0 20px;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:20px;line-height:34px;color:#453d32;">
          Dear ${safeName},
        </p>
        <p style="margin:0 0 20px;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:20px;line-height:34px;color:#453d32;">
          Thank you for subscribing. You are now part of a quiet correspondence on <em>dharma, grief, language, surrender,</em> and the inner life.
        </p>
        ${requestedBooklet}
        <p style="margin:0 0 32px;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:20px;line-height:34px;color:#453d32;">
          No noise and no urgency&mdash;only considered writing for the inward journey.
        </p>
        <!-- Decorative divider -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 32px;">
          <tr>
            <td style="height:1px;background:linear-gradient(90deg,#c9a24e 0%,transparent 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>
        <!-- CTA Button -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="border-radius:8px;background:linear-gradient(135deg,#a77d2d 0%,#c9a24e 100%);box-shadow:0 2px 8px rgba(167,125,45,0.3);">
              <a href="${escapeHtml(seriesUrl)}" style="display:inline-block;padding:16px 32px;font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;color:#ffffff;">Explore the Booklets &rarr;</a>
            </td>
          </tr>
        </table>
        <!-- Sign-off -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:40px 0 0;">
          <tr>
            <td style="padding:24px 0 0;border-top:1px solid #e5d7bf;">
              <p style="margin:0 0 4px;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:19px;line-height:28px;color:#453d32;font-style:italic;">With warmth,</p>
              <p style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:20px;line-height:28px;color:#2b261f;font-weight:600;">Sasidhar Valluru</p>
            </td>
          </tr>
        </table>`,
      footer: `You received this message because you subscribed at <a href="${escapeHtml(siteUrl)}" style="color:#8a6a2e;text-decoration:underline;">thevalluru.org</a>. We respect your inbox.`
    }),
    text: `Dear ${name},
Thank you for subscribing to The Inward Fire Letter.
${bookletTitle ? `\nRequested booklet: ${bookletTitle}\n` : ""}
Explore the booklets: ${seriesUrl}
With warmth,
Sasidhar Valluru`
  };
}

async function run() {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "The Valluru <hello@thevalluru.org>").trim();
  const to = String(process.env.ADMIN_NOTIFICATION_EMAIL || "sasi@thevalluru.org").trim();

  console.log('API Key:', apiKey ? 'FOUND (starts with ' + apiKey.substring(0, 5) + ')' : 'MISSING');
  console.log('From:', from);
  console.log('To:', to);

  if (!apiKey) {
    console.error('Cannot run test: RESEND_API_KEY is missing.');
    return;
  }

  const resend = new Resend(apiKey);
  const subscriberEmail = buildSubscriberEmail({
    name: 'Sasidhar Valluru',
    bookletTitle: 'Test Booklet: The Inward Fire'
  });

  console.log('\nSending test subscriber welcome email...');
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: `[Test Layout] ${subscriberEmail.subject}`,
    html: subscriberEmail.html,
    text: subscriberEmail.text
  });

  if (error) {
    console.error('Error sending email:', JSON.stringify(error, null, 2));
  } else {
    console.log('Email sent successfully!', data);
  }
}

run();
