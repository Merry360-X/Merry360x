import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildBrevoSmtpPayload,
  filterValidRecipients,
  generateFounderWelcomeEmailHtml,
  validateRecipientEmail,
  escapeHtml,
} from "../lib/email-template-kit.js";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const DEFAULT_FROM_NAME = "Merry360X";
const DEFAULT_FROM_EMAIL = "support@merry360x.com";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (!req?.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

/**
 * Loads email-templates/welcome-email.html and hydrates template variables:
 * - {{ if .Data.first_name }}...{{ end }}
 * - {{ .Data.first_name }}
 * - {{ .Data.full_name }}
 * - {{ .Year }}
 */
function loadWelcomeEmailHtml({ firstName, fullName }) {
  const rawFirstName = firstName || (fullName ? fullName.trim().split(" ")[0] : "");
  const rawFullName = fullName || rawFirstName || "Explorer";
  const chosenName = rawFirstName || rawFullName || "Explorer";

  let templateContent = "";

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const candidatePaths = [
      path.resolve(__dirname, "../email-templates/welcome-email.html"),
      path.resolve(process.cwd(), "email-templates/welcome-email.html"),
      path.resolve(process.cwd(), "../email-templates/welcome-email.html"),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        templateContent = fs.readFileSync(p, "utf-8");
        break;
      }
    }
  } catch (err) {
    console.warn("[welcome-email] Failed to read welcome-email.html from disk, falling back to embedded template", err);
  }

  if (!templateContent) {
    templateContent = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Welcome to Merry360X</title>
  <style>
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .card-item-table td {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
      }
      .card-item-img {
        margin: 0 auto 12px auto !important;
      }
      .footer-split td {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
      }
      .qr-box {
        margin: 16px auto 0 auto !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 24px 12px 48px;">
    <tr>
      <td align="center">
        
        <!-- Outer Card Wrapper -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-container" style="max-width: 620px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 35px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb;">
          
          <!-- Scenic Header with Brand Logo -->
          <tr>
            <td style="padding: 0; position: relative; background-color: #0f766e; text-align: center;">
              <div style="width: 100%; line-height: 0;">
                <img src="https://merry360x.com/brand/welcome-banner.jpg" alt="Lake Kivu Rwanda" width="620" style="display: block; width: 100%; max-width: 100%; height: auto;" />
              </div>
            </td>
          </tr>

          <!-- Floating Welcome Bubble -->
          <tr>
            <td style="padding: 0 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: rgba(255, 255, 255, 0.98); border: 2px solid #ffffff; border-radius: 20px; margin-top: -36px; position: relative; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); text-align: center;">
                <tr>
                  <td style="padding: 24px 22px 20px; text-align: center;">
                    
                    <!-- Top Logo Icon -->
                    <div style="margin-bottom: 12px;">
                      <img src="https://merry360x.com/brand/logo.png" alt="Merry360X" width="50" height="50" style="display: inline-block; width: 50px; height: 50px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
                    </div>

                    <h2 style="margin: 0 0 6px; font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: #111827;">
                      Hi {{ if .Data.first_name }}{{ .Data.first_name }},{{ else if .Data.full_name }}{{ .Data.full_name }},{{ else }}Explorer,{{ end }}
                    </h2>
                    
                    <p style="margin: 0 0 8px; font-size: 15px; font-weight: 600; color: #1e293b;">
                      You&rsquo;re welcome! Hope you enjoy your stay...
                    </p>

                    <p style="margin: 0 0 10px; font-size: 13.5px; color: #374151; line-height: 1.55;">
                      With <strong style="color: #dc2626;">Merry360X.com</strong>, you can book accommodations, tours and transport services in minutes.
                    </p>

                    <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.5; font-style: italic;">
                      Whether you&rsquo;re looking for a luxury stay, a curated safari experience, or reliable private transport, we offer that and more.
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 3 Service Pillars Section -->
          <tr>
            <td style="padding: 28px 20px 16px;">

              <!-- Pillar 1: Accommodations -->
              <div style="background-color: #ffffff; border: 1.5px solid #fee2e2; border-radius: 18px; padding: 14px; margin-bottom: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.06);">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="card-item-table">
                  <tr>
                    <td width="110" valign="middle" align="center" style="padding-right: 14px;">
                      <img src="https://merry360x.com/brand/email-stays.jpg" alt="Accommodations" width="100" height="90" class="card-item-img" style="display: block; width: 100px; height: 90px; border-radius: 14px; object-fit: cover; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.12);" />
                    </td>
                    <td valign="middle" style="line-height: 1.45;">
                      <h3 style="margin: 0 0 4px; font-family: 'Playfair Display', Georgia, serif; font-size: 17px; font-weight: 700; color: #dc2626;">
                        Book Premium Accommodations
                      </h3>
                      <p style="margin: 0 0 8px; font-size: 12.5px; color: #4b5563; line-height: 1.45;">
                        Discover apartments, villas, and hotels tailored for comfort, style &amp; convenience.
                      </p>
                      <a href="https://merry360x.com/accommodations" target="_blank" style="display: inline-block; font-size: 12px; font-weight: 700; color: #dc2626; text-decoration: none;">
                        Browse Stays &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Pillar 2: Tours & Experiences -->
              <div style="background-color: #ffffff; border: 1.5px solid #dcfce7; border-radius: 18px; padding: 14px; margin-bottom: 16px; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.06);">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="card-item-table">
                  <tr>
                    <td width="110" valign="middle" align="center" style="padding-right: 14px;">
                      <img src="https://merry360x.com/brand/email-tours.jpg" alt="Tours and Safaris" width="100" height="90" class="card-item-img" style="display: block; width: 100px; height: 90px; border-radius: 14px; object-fit: cover; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.12);" />
                    </td>
                    <td valign="middle" style="line-height: 1.45;">
                      <h3 style="margin: 0 0 4px; font-family: 'Playfair Display', Georgia, serif; font-size: 17px; font-weight: 700; color: #166534;">
                        Explore Curated Tours/Experiences
                      </h3>
                      <p style="margin: 0 0 8px; font-size: 12.5px; color: #4b5563; line-height: 1.45;">
                        From gorilla trekking to city escapes, access unique tours crafted for memorable moments.
                      </p>
                      <a href="https://merry360x.com/tours" target="_blank" style="display: inline-block; font-size: 12px; font-weight: 700; color: #166534; text-decoration: none;">
                        Explore Experiences &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Pillar 3: Transport -->
              <div style="background-color: #ffffff; border: 1.5px solid #dbeafe; border-radius: 18px; padding: 14px; margin-bottom: 16px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.06);">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="card-item-table">
                  <tr>
                    <td width="110" valign="middle" align="center" style="padding-right: 14px;">
                      <img src="https://merry360x.com/brand/email-transport.jpg" alt="Transport Services" width="100" height="90" class="card-item-img" style="display: block; width: 100px; height: 90px; border-radius: 14px; object-fit: cover; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.12);" />
                    </td>
                    <td valign="middle" style="line-height: 1.45;">
                      <h3 style="margin: 0 0 4px; font-family: 'Playfair Display', Georgia, serif; font-size: 17px; font-weight: 700; color: #1d4ed8;">
                        Move Conveniently
                      </h3>
                      <p style="margin: 0 0 8px; font-size: 12.5px; color: #4b5563; line-height: 1.45;">
                        Enjoy trusted transport services. Airport pickups, car rentals, intra &amp; Inter-city rides.
                      </p>
                      <a href="https://merry360x.com/transport" target="_blank" style="display: inline-block; font-size: 12px; font-weight: 700; color: #1d4ed8; text-decoration: none;">
                        Book Transport &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

            </td>
          </tr>

          <!-- Host & Planning Info Card (Frosted Light Background) -->
          <tr>
            <td style="padding: 0 20px 24px;">
              <div style="background-color: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 20px; padding: 22px 20px;">
                
                <!-- For Property Owners & Providers -->
                <div style="margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px dashed #cbd5e1;">
                  <h4 style="margin: 0 0 4px; font-size: 14.5px; font-weight: 700; color: #ea580c;">
                    For Property Owners, Tour &amp; Transportation Service Providers
                  </h4>
                  <p style="margin: 0 0 8px; font-size: 12.5px; color: #334155; line-height: 1.5;">
                    List your property/service on Merry360X and start earning from a growing network of premium travelers.
                  </p>
                  <a href="https://merry360x.com/auth" target="_blank" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 6px 16px; border-radius: 8px; font-size: 12px; font-weight: 700;">
                    Become a Host: merry360x.com/auth &rarr;
                  </a>
                </div>

                <!-- Need Help Planning -->
                <div style="margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px dashed #cbd5e1;">
                  <h4 style="margin: 0 0 4px; font-size: 14.5px; font-weight: 700; color: #1e40af;">
                    Need Help Planning?
                  </h4>
                  <p style="margin: 0; font-size: 12.5px; color: #334155; line-height: 1.5;">
                    Our team is ready to assist you with custom travel planning. Simply reach us anytime at <a href="mailto:support@merry360x.com" style="color: #1e40af; font-weight: 600;">support@merry360x.com</a>.
                  </p>
                </div>

                <!-- Stay Connected -->
                <div style="margin-bottom: 20px;">
                  <h4 style="margin: 0 0 3px; font-size: 13.5px; font-weight: 700; color: #0f172a;">
                    Stay Connected on all social media: @merry360x
                  </h4>
                  <p style="margin: 0 0 10px; font-size: 12px; color: #64748b;">
                    Follow us for travel inspiration, exclusive deals, and insider tips
                  </p>
                  
                  <!-- Social Links Badges -->
                  <div>
                    <a href="https://instagram.com/merry360x" target="_blank" style="display: inline-block; margin-right: 6px; text-decoration: none;">
                      <span style="display: inline-block; background-color: #e11d48; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">Instagram</span>
                    </a>
                    <a href="https://tiktok.com/@merry360x" target="_blank" style="display: inline-block; margin-right: 6px; text-decoration: none;">
                      <span style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">TikTok</span>
                    </a>
                    <a href="https://facebook.com/merry360x" target="_blank" style="display: inline-block; margin-right: 6px; text-decoration: none;">
                      <span style="display: inline-block; background-color: #1d4ed8; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">Facebook</span>
                    </a>
                    <a href="https://x.com/merry360x" target="_blank" style="display: inline-block; margin-right: 6px; text-decoration: none;">
                      <span style="display: inline-block; background-color: #111827; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">X</span>
                    </a>
                    <a href="https://linkedin.com/company/merry360x" target="_blank" style="display: inline-block; text-decoration: none;">
                      <span style="display: inline-block; background-color: #0369a1; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">LinkedIn</span>
                    </a>
                  </div>
                </div>

                <!-- Brand Card + QR Code Footer Grid -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="footer-split" style="background-color: #ffffff; border-radius: 16px; padding: 16px; border: 1px solid #e2e8f0;">
                  <tr>
                    <td valign="middle" style="line-height: 1.4;">
                      <h3 style="margin: 0; font-size: 20px; font-weight: 800; color: #dc2626; letter-spacing: -0.02em;">
                        Merry360X
                      </h3>
                      <p style="margin: 2px 0 6px; font-size: 11.5px; color: #475569; font-weight: 500;">
                        Redefining Travel &amp; Hospitality in Africa
                      </p>
                      <p style="margin: 0 0 10px; font-family: 'Playfair Display', Georgia, serif; font-size: 13.5px; font-style: italic; color: #b91c1c; font-weight: 600;">
                        One Platform, Endless Experiences...
                      </p>
                      
                      <div style="font-size: 11.5px; color: #334155; line-height: 1.7;">
                        <div>&#128222; <strong>0796 214 719</strong></div>
                        <div>&#127760; <a href="https://www.merry360x.com" style="color: #dc2626; text-decoration: none; font-weight: 600;">www.merry360x.com</a></div>
                        <div>&#128205; KN 626 Street, Remera Kigali.</div>
                      </div>
                    </td>

                    <td width="130" align="center" valign="middle" class="qr-box" style="padding-left: 12px; text-align: center;">
                      <p style="margin: 0 0 4px; font-size: 11px; font-weight: 800; color: #1e293b; letter-spacing: 0.08em; text-transform: uppercase;">
                        SCAN ME
                      </p>
                      <a href="https://merry360x.com" target="_blank" style="display: inline-block;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https%3A%2F%2Fmerry360x.com" alt="Scan QR Code" width="105" height="105" style="display: block; width: 105px; height: 105px; border-radius: 8px; border: 1px solid #cbd5e1;" />
                      </a>
                    </td>
                  </tr>
                </table>

              </div>
            </td>
          </tr>

          <!-- Standard Email Unsubscribe Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 4px; font-size: 11.5px; color: #64748b;">
                You received this email because you signed up on <a href="https://merry360x.com" style="color: #64748b; text-decoration: underline;">merry360x.com</a>.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; {{ .Year }} Merry360X. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  let rendered = templateContent;
  rendered = rendered.replace(
    /\{\{\s*if\s+\.Data\.first_name\s*\}\}[\s\S]*?\{\{\s*end\s*\}\}/g,
    chosenName ? `${escapeHtml(chosenName)},` : "Explorer,"
  );
  rendered = rendered.replace(/\{\{\s*\.Data\.first_name\s*\}\}/g, escapeHtml(rawFirstName || chosenName));
  rendered = rendered.replace(/\{\{\s*\.Data\.full_name\s*\}\}/g, escapeHtml(rawFullName || chosenName));
  rendered = rendered.replace(/\{\{\s*\.Year\s*\}\}/g, String(new Date().getFullYear()));

  return rendered;
}

async function sendBrevoEmail({ to, subject, htmlContent, senderName, senderEmail, tags = [] }) {
  const validRecipients = filterValidRecipients(to);
  if (!validRecipients.length) {
    return { ok: false, status: 400, result: { reason: "No valid recipient email address" } };
  }

  if (!BREVO_API_KEY) {
    console.warn("[welcome-email] BREVO_API_KEY not configured. Email simulated in dev environment.");
    return { ok: true, simulated: true, status: 200 };
  }

  const payload = buildBrevoSmtpPayload({
    senderName: senderName || DEFAULT_FROM_NAME,
    senderEmail: senderEmail || DEFAULT_FROM_EMAIL,
    to: validRecipients,
    subject,
    htmlContent,
    tags,
  });

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, result };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed. Use POST." });
  }

  try {
    const body = parseBody(req);
    const email = body.email || body.userEmail || body.targetEmail;
    const validation = validateRecipientEmail(email);

    if (!validation.ok) {
      return json(res, 400, { error: "Invalid or missing email address", reason: validation.reason });
    }

    const recipientEmail = validation.email;
    const firstName = body.firstName || (body.fullName ? body.fullName.trim().split(" ")[0] : (body.name ? body.name.trim().split(" ")[0] : ""));
    const fullName = body.fullName || body.name || firstName || "Traveler";
    const type = String(body.type || "welcome").toLowerCase();

    const recipient = [{ email: recipientEmail, name: fullName }];
    const sentResults = [];

    // 1. Welcome Email using email-templates/welcome-email.html
    if (type === "welcome" || type === "both" || type === "all") {
      const welcomeHtml = loadWelcomeEmailHtml({
        firstName,
        fullName,
      });

      const welcomeRes = await sendBrevoEmail({
        to: recipient,
        subject: `Welcome to Merry360X, ${firstName || "Explorer"}! ✨`,
        htmlContent: welcomeHtml,
        tags: ["welcome-registration", "onboarding"],
      });
      sentResults.push({ type: "welcome", ...welcomeRes });
    }

    // 2. Founder Welcome Email
    if (type === "founder" || type === "both" || type === "all") {
      const founderHtml = generateFounderWelcomeEmailHtml({
        firstName,
        name: fullName,
        email: recipientEmail,
      });

      const founderRes = await sendBrevoEmail({
        to: recipient,
        subject: `A Personal Note From Our Founder ✨`,
        htmlContent: founderHtml,
        senderName: "Founder @ Merry360X",
        senderEmail: DEFAULT_FROM_EMAIL,
        tags: ["welcome-founder", "founder-letter"],
      });
      sentResults.push({ type: "founder", ...founderRes });
    }

    return json(res, 200, {
      success: true,
      email: recipientEmail,
      firstName,
      type,
      results: sentResults,
    });
  } catch (err) {
    console.error("[welcome-email] Unhandled error:", err);
    return json(res, 500, {
      error: "Failed to send welcome email",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
