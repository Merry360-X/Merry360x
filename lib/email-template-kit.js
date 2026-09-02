export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function keyValueRows(rows = []) {
  const safeRows = rows.filter((row) => row && row.label && row.value !== undefined && row.value !== null && row.value !== "");
  if (!safeRows.length) return "";

  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse;">
  ${safeRows
      .map(
        (row) => `
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">${escapeHtml(row.label)}</td>
      <td style="padding: 8px 0; color: #111827; font-size: 13px; text-align: right; font-weight: 500;">${row.value}</td>
    </tr>`
      )
      .join("")}
</table>`;
}

const DEFAULT_FROM_NAME = "Merry360X";
const DEFAULT_FROM_EMAIL = "support@merry360x.com";
const DEFAULT_LIGHT_LOGO = "https://merry360x.com/brand/logo.png";
const DEFAULT_DARK_LOGO = "https://merry360x.com/brand/logo-dark.png";

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "10minutemail.com",
  "temp-mail.org",
  "tempmail.com",
  "yopmail.com",
  "trashmail.com",
  "invalid",
  "test",
  "localhost",
  "localdomain",
]);

export function normalizeEmail(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.replace(/^<|>$/g, "");
}

export function validateRecipientEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, reason: "missing" };
  if (normalized.length > 254) return { ok: false, reason: "too_long" };
  if (/\s/.test(normalized)) return { ok: false, reason: "whitespace" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(normalized)) return { ok: false, reason: "format" };

  const parts = normalized.split("@");
  if (parts.length !== 2) return { ok: false, reason: "format" };
  const [localPart, domain] = parts;
  if (!localPart || !domain) return { ok: false, reason: "format" };
  if (localPart.length > 64) return { ok: false, reason: "local_too_long" };
  if (domain.length > 253) return { ok: false, reason: "domain_too_long" };
  if (localPart.includes("..") || domain.includes("..")) return { ok: false, reason: "double_dot" };
  if (domain.startsWith(".") || domain.endsWith(".")) return { ok: false, reason: "domain_dot" };
  if (domain.endsWith(".local") || domain.endsWith(".localhost")) return { ok: false, reason: "local_domain" };
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return { ok: false, reason: "blocked_domain" };

  return { ok: true, email: normalized };
}

export function getSafeRecipientEmail({ primaryEmail, previewEmail }) {
  if (previewEmail) {
    const previewValidation = validateRecipientEmail(previewEmail);
    if (previewValidation.ok) return { email: previewValidation.email, source: "preview" };
    return null;
  }

  const primaryValidation = validateRecipientEmail(primaryEmail);
  if (primaryValidation.ok) return { email: primaryValidation.email, source: "primary" };
  return null;
}

export function filterValidRecipients(recipients = []) {
  return (Array.isArray(recipients) ? recipients : [])
    .map((recipient) => {
      const validation = validateRecipientEmail(recipient?.email);
      if (!validation.ok) return null;
      return {
        ...recipient,
        email: validation.email,
      };
    })
    .filter(Boolean);
}

function htmlToText(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildBrevoSmtpPayload({
  to,
  subject,
  htmlContent,
  textContent,
  senderName = DEFAULT_FROM_NAME,
  senderEmail = DEFAULT_FROM_EMAIL,
  replyTo,
  tags,
  attachment,
}) {
  const resolvedReplyTo =
    replyTo && replyTo.email
      ? { email: replyTo.email, ...(replyTo.name ? { name: replyTo.name } : {}) }
      : { email: senderEmail, name: senderName };

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to,
    replyTo: resolvedReplyTo,
    subject,
    htmlContent,
    textContent: textContent || htmlToText(htmlContent),
    headers: {
      "X-Mailer": "Merry360X Transactional",
      "X-Entity-Ref-ID": `merry-${Date.now()}`,
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
    },
  };

  if (Array.isArray(tags) && tags.length) {
    payload.tags = tags;
  }

  if (Array.isArray(attachment) && attachment.length) {
    payload.attachment = attachment;
  }

  return payload;
}

export function renderMinimalEmail({
  title,
  subtitle,
  eyebrow,
  bodyHtml,
  ctaText,
  ctaUrl,
  footerText = "Merry360X · Redefining Travel & Hospitality in Africa",
  footerLink = "https://merry360x.com",
  supportEmail = "support@merry360x.com",
  lightLogoUrl = "https://merry360x.com/brand/logo.png",
  bannerUrl = "https://merry360x.com/brand/welcome-banner.jpg",
}) {
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(title || "Merry360X")}</title>
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
      .footer-split td {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
      }
      .qr-box {
        margin: 16px auto 0 auto !important;
      }
      .cta-btn {
        width: 100% !important;
        box-sizing: border-box !important;
        text-align: center !important;
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
          
          <!-- Scenic Header Banner -->
          <tr>
            <td style="padding: 0; position: relative; background-color: #0f766e; text-align: center;">
              <div style="width: 100%; line-height: 0;">
                <img src="${escapeHtml(bannerUrl)}" alt="Merry360X" width="620" style="display: block; width: 100%; max-width: 100%; height: auto;" />
              </div>
            </td>
          </tr>

          <!-- Floating Header Bubble -->
          <tr>
            <td style="padding: 0 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: rgba(255, 255, 255, 0.98); border: 2px solid #ffffff; border-radius: 20px; margin-top: -36px; position: relative; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); text-align: center;">
                <tr>
                  <td style="padding: 24px 22px 20px; text-align: center;">
                    
                    <!-- Top Logo Icon -->
                    <div style="margin-bottom: 12px;">
                      <img src="${escapeHtml(lightLogoUrl)}" alt="Merry360X" width="52" height="52" style="display: inline-block; width: 52px; height: 52px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
                    </div>

                    ${eyebrow ? `<p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; color: #dc2626; letter-spacing: 0.08em; text-transform: uppercase;">${escapeHtml(eyebrow)}</p>` : ""}

                    <h1 style="margin: 0 0 6px; font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.25;">
                      ${escapeHtml(title || "Merry360X Notification")}
                    </h1>
                    
                    ${subtitle ? `
                    <p style="margin: 0; font-size: 14px; font-weight: 500; color: #4b5563; line-height: 1.5;">
                      ${escapeHtml(subtitle)}
                    </p>` : ""}

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td style="padding: 24px 24px 16px;">
              ${bodyHtml || ""}
            </td>
          </tr>

          <!-- Optional CTA Button -->
          ${ctaText && ctaUrl ? `
          <tr>
            <td style="padding: 4px 24px 24px; text-align: center;">
              <a href="${escapeHtml(ctaUrl)}" class="cta-btn" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 34px; border-radius: 12px; font-size: 14.5px; font-weight: 700; letter-spacing: 0.02em; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);">
                ${escapeHtml(ctaText)} &rarr;
              </a>
            </td>
          </tr>` : ""}

          <!-- Info & Social Card (Frosted Light Background) -->
          <tr>
            <td style="padding: 0 20px 24px;">
              <div style="background-color: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 20px; padding: 20px 20px;">
                
                <!-- Need Help -->
                <div style="margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px dashed #cbd5e1;">
                  <h4 style="margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #1e40af;">
                    Need Help or Have Questions?
                  </h4>
                  <p style="margin: 0; font-size: 12.5px; color: #334155; line-height: 1.5;">
                    Our 24/7 concierge team is always ready to assist. Reach us at <a href="mailto:${escapeHtml(supportEmail)}" style="color: #1e40af; font-weight: 600;">${escapeHtml(supportEmail)}</a>.
                  </p>
                </div>

                <!-- Stay Connected -->
                <div style="margin-bottom: 18px;">
                  <h4 style="margin: 0 0 3px; font-size: 13px; font-weight: 700; color: #0f172a;">
                    Stay Connected on all social media: @merry360x
                  </h4>
                  <p style="margin: 0 0 10px; font-size: 12px; color: #64748b;">
                    Follow us for travel inspiration, exclusive deals, and insider tips
                  </p>
                  
                  <!-- Social Links Badges -->
                  <div>
                    <a href="https://www.instagram.com/merry360.x?utm_source=qr" target="_blank" style="display: inline-block; margin-right: 6px; text-decoration: none;">
                      <span style="display: inline-block; background-color: #e11d48; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">Instagram</span>
                    </a>
                    <a href="https://tiktok.com/@merry360x" target="_blank" style="display: inline-block; margin-right: 6px; text-decoration: none;">
                      <span style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">TikTok</span>
                    </a>
                    <a href="https://www.facebook.com/share/1QenskQsgG/?mibextid=wwXIfr" target="_blank" style="display: inline-block; margin-right: 6px; text-decoration: none;">
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
                ${escapeHtml(footerText)}
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Merry360X. All rights reserved.
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

import fs from "fs";
import path from "path";

function loadAndHydrateHtmlTemplate(relativeFilePath, data = {}) {
  try {
    if (typeof process !== "undefined" && process.cwd) {
      const fullPath = path.resolve(process.cwd(), relativeFilePath);
      if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, "utf-8");

        const rawFirstName = data.firstName || (data.name ? data.name.trim().split(" ")[0] : "");
        const rawFullName = data.name || data.fullName || rawFirstName || "Explorer";
        const chosenName = rawFirstName || rawFullName || "Explorer";

        // Replace Supabase conditionals and tags
        content = content.replace(
          /\{\{\s*if\s+\.Data\.first_name\s*\}\}[\s\S]*?\{\{\s*end\s*\}\}/g,
          chosenName ? `${chosenName},` : "Explorer,"
        );
        content = content.replace(/\{\{\s*\.Data\.first_name\s*\}\}/g, escapeHtml(rawFirstName || chosenName));
        content = content.replace(/\{\{\s*\.Data\.full_name\s*\}\}/g, escapeHtml(rawFullName || chosenName));
        content = content.replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, escapeHtml(data.confirmationUrl || "https://merry360x.com"));
        content = content.replace(/\{\{\s*\.Year\s*\}\}/g, String(new Date().getFullYear()));

        return content;
      }
    }
  } catch (err) {
    // Fallback to JS generator
  }
  return null;
}

export function generateConfirmEmailHtml({ firstName, name, email, confirmationUrl }) {
  const fileTemplate = loadAndHydrateHtmlTemplate("email-templates/confirm-email.html", { firstName, name, email, confirmationUrl });
  if (fileTemplate) {
    return fileTemplate;
  }
  return generateWelcomeEmailHtml({ firstName, name, email, confirmationUrl });
}

export function generateWelcomeEmailHtml({ firstName, name, email, confirmationUrl }) {
  const templatePath = confirmationUrl ? "email-templates/confirm-email.html" : "email-templates/welcome-email.html";
  const fileTemplate = loadAndHydrateHtmlTemplate(templatePath, { firstName, name, email, confirmationUrl });
  if (fileTemplate) {
    return fileTemplate;
  }

  const rawDisplayName = firstName || (name ? name.trim().split(" ")[0] : "");
  const displayName = rawDisplayName ? escapeHtml(rawDisplayName) : "";
  const lightLogoUrl = process.env.EMAIL_LOGO_LIGHT_URL || DEFAULT_LIGHT_LOGO;
  const bannerUrl = "https://merry360x.com/brand/welcome-banner.jpg";
  const staysImg = "https://merry360x.com/brand/email-stays.jpg";
  const toursImg = "https://merry360x.com/brand/email-tours.jpg";
  const transportImg = "https://merry360x.com/brand/email-transport.jpg";
  const qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https%3A%2F%2Fmerry360x.com";

  return `<!DOCTYPE html>
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
      .confirm-btn {
        width: 100% !important;
        box-sizing: border-box !important;
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
                <img src="${bannerUrl}" alt="Lake Kivu Rwanda" width="620" style="display: block; width: 100%; max-width: 100%; height: auto;" />
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
                      <img src="${escapeHtml(lightLogoUrl)}" alt="Merry 360X" width="50" height="50" style="display: inline-block; width: 50px; height: 50px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
                    </div>

                    <h2 style="margin: 0 0 6px; font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: #111827;">
                      Hi ${displayName ? `${displayName},` : ","}
                    </h2>
                    
                    <p style="margin: 0 0 8px; font-size: 15px; font-weight: 600; color: #1e293b;">
                      ${confirmationUrl ? "You&rsquo;re welcome! Confirm your email to start exploring..." : "You&rsquo;re welcome! Hope you enjoy your stay..."}
                    </p>

                    <p style="margin: 0 0 10px; font-size: 13.5px; color: #374151; line-height: 1.55;">
                      With <strong style="color: #dc2626;">Merry360X.com</strong>, you can book accommodations, tours and transport services in minutes.
                    </p>

                    ${confirmationUrl ? `
                    <div style="margin: 18px 0 14px;">
                      <a href="${escapeHtml(confirmationUrl)}" class="confirm-btn" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 34px; border-radius: 12px; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);">
                        Confirm Email &rarr;
                      </a>
                    </div>
                    <p style="margin: 0 0 4px; font-size: 12px; color: #64748b; line-height: 1.5;">
                      This link expires in 24 hours. If you didn&rsquo;t create an account, you can safely ignore this email.
                    </p>
                    ` : `
                    <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.5; font-style: italic;">
                      Whether you&rsquo;re looking for a luxury stay, a curated safari experience, or reliable private transport, we offer that and more.
                    </p>
                    `}

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
                      <img src="${staysImg}" alt="Accommodations" width="100" height="90" class="card-item-img" style="display: block; width: 100px; height: 90px; border-radius: 14px; object-fit: cover; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.12);" />
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
                      <img src="${toursImg}" alt="Tours and Safaris" width="100" height="90" class="card-item-img" style="display: block; width: 100px; height: 90px; border-radius: 14px; object-fit: cover; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.12);" />
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
                      <img src="${transportImg}" alt="Transport Services" width="100" height="90" class="card-item-img" style="display: block; width: 100px; height: 90px; border-radius: 14px; object-fit: cover; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.12);" />
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
                        <img src="${qrCodeUrl}" alt="Scan QR Code" width="105" height="105" style="display: block; width: 105px; height: 105px; border-radius: 8px; border: 1px solid #cbd5e1;" />
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
                &copy; ${new Date().getFullYear()} Merry360X. All rights reserved.
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

export function generateFounderWelcomeEmailHtml({ firstName, name, email }) {
  const fileTemplate = loadAndHydrateHtmlTemplate("email-templates/founder-welcome-email.html", { firstName, name, email });
  if (fileTemplate) {
    return fileTemplate;
  }

  const rawDisplayName = firstName || (name ? name.trim().split(" ")[0] : "");
  const displayName = rawDisplayName ? escapeHtml(rawDisplayName) : "Friend";
  const lightLogoUrl = process.env.EMAIL_LOGO_LIGHT_URL || DEFAULT_LIGHT_LOGO;
  const bannerUrl = "https://merry360x.com/brand/founder-banner.jpg";

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>A Personal Note From Our Founder</title>
  <style>
    /* Reset styles */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    
    /* Responsive breakpoints */
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .col-left, .col-right {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
      .col-left {
        padding-right: 0 !important;
        padding-bottom: 24px !important;
      }
      .col-right {
        padding-left: 0 !important;
      }
      .right-card {
        margin-top: 12px !important;
      }
      .header-title {
        font-size: 28px !important;
      }
      .header-subtitle {
        font-size: 26px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f5f7; padding: 32px 12px 48px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-container" style="max-width: 620px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;">
          
          <!-- Top Logo Header -->
          <tr>
            <td align="center" style="padding: 32px 24px 16px; background-color: #ffffff;">
              <a href="https://merry360x.com" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${escapeHtml(lightLogoUrl)}" alt="Merry 360X" width="56" height="56" style="display: block; width: 56px; height: 56px; border-radius: 50%; object-fit: contain;" />
              </a>
            </td>
          </tr>

          <!-- Title & Ornamental Divider -->
          <tr>
            <td align="center" style="padding: 0 24px 20px; text-align: center; background-color: #ffffff;">
              <h1 class="header-title" style="margin: 0; font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: 600; color: #111827; letter-spacing: -0.02em; line-height: 1.15;">
                A Personal Note
              </h1>
              <h2 class="header-subtitle" style="margin: 4px 0 0; font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size: 30px; font-weight: 600; color: #991b1b; letter-spacing: -0.02em; line-height: 1.15;">
                From Our Founder
              </h2>
              <!-- Ornate Divider Flourish -->
              <div style="margin: 12px auto 0; text-align: center; color: #d1a153; font-size: 14px; letter-spacing: 4px; line-height: 1;">
                <span style="display: inline-block; width: 36px; height: 1px; background-color: #d1a153; vertical-align: middle; margin-right: 6px;"></span>
                <span style="display: inline-block; vertical-align: middle; color: #c28830; font-size: 13px;">&#10070;</span>
                <span style="display: inline-block; width: 36px; height: 1px; background-color: #d1a153; vertical-align: middle; margin-left: 6px;"></span>
              </div>
            </td>
          </tr>

          <!-- Hero Banner Image -->
          <tr>
            <td style="padding: 0; background-color: #f8fafc; line-height: 0;">
              <img src="${bannerUrl}" alt="Merry 360 Experiences Skyline Rooftop" width="620" style="display: block; width: 100%; max-width: 100%; height: auto; border: 0;" />
            </td>
          </tr>

          <!-- Main Content Body (2 Columns) -->
          <tr>
            <td style="padding: 32px 28px 24px; background-color: #ffffff;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  
                  <!-- Left Column: Personal Note Letter -->
                  <td class="col-left" width="58%" valign="top" style="padding-right: 20px; font-size: 14px; line-height: 1.6; color: #374151;">
                    
                    <p style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #dc2626; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      Dear ${displayName},
                    </p>

                    <p style="margin: 0 0 12px; font-size: 14px; color: #111827; line-height: 1.5;">
                      Before anything else... <strong style="color: #dc2626;">Thank You.</strong>
                    </p>

                    <p style="margin: 0 0 12px; font-size: 14px; color: #374151; line-height: 1.5;">
                      Not for making a booking. Not for visiting our website.
                    </p>

                    <p style="margin: 0 0 16px; font-size: 15px; color: #111827; font-weight: 700; line-height: 1.4;">
                      But for believing in what we're building.
                    </p>

                    <p style="margin: 0 0 14px; font-size: 13.5px; color: #4b5563; line-height: 1.55;">
                      When we launched Merry360X, we weren't trying to create another booking platform.<br />
                      <strong>We saw a bigger opportunity.</strong>
                    </p>

                    <p style="margin: 0 0 14px; font-size: 13.5px; color: #4b5563; line-height: 1.55;">
                      Africa has incredible destinations. Beautiful accommodations. World-class experiences.
                    </p>

                    <p style="margin: 0 0 14px; font-size: 13.5px; color: #4b5563; line-height: 1.55;">
                      Yet travelers often struggle to find them.<br />
                      Property owners struggle to reach the right guests.<br />
                      Tour operators struggle to access global demand.<br />
                      <strong>We believed there had to be a better way.</strong>
                    </p>

                    <p style="margin: 0 0 18px; font-size: 13.5px; color: #4b5563; line-height: 1.55;">
                      Today, because of people like you, that vision is becoming reality.
                    </p>

                    <div style="margin-top: 20px; padding-top: 14px; border-top: 1px dashed #e5e7eb;">
                      <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.4;">
                        With deep gratitude,<br />
                        <strong style="color: #111827; font-size: 14px;">The Merry 360X Team &amp; Founders</strong>
                      </p>
                    </div>

                  </td>

                  <!-- Right Column: Sidebar "YOU ARE PART OF THE JOURNEY" -->
                  <td class="col-right" width="42%" valign="top" style="padding-left: 8px;">
                    <div class="right-card" style="background-color: #fce7ea; border-radius: 18px; padding: 24px 16px; text-align: center; border: 1px solid #f9d2d7;">
                      
                      <!-- Header -->
                      <p style="margin: 0; font-size: 13px; font-weight: 800; color: #1e293b; letter-spacing: 0.08em; text-transform: uppercase; line-height: 1.2;">
                        YOU ARE PART OF
                      </p>
                      <p style="margin: 2px 0 0; font-family: 'Playfair Display', Georgia, serif; font-size: 17px; font-weight: 800; color: #dc2626; letter-spacing: 0.05em; text-transform: uppercase; line-height: 1.2;">
                        THE JOURNEY
                      </p>
                      <p style="margin: 6px 0 20px; font-size: 12px; color: #64748b; font-style: italic;">
                        One of our earliest users
                      </p>

                      <!-- Milestone 1: Users / Shaping African Travel -->
                      <div style="margin-bottom: 22px;">
                        <div style="display: inline-block; margin-bottom: 6px;">
                          <!-- Users Silhouette Icon -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                            <tr>
                              <td align="center">
                                <svg width="34" height="34" viewBox="0 0 24 24" fill="#111827" style="display: block;">
                                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                                </svg>
                              </td>
                            </tr>
                          </table>
                        </div>
                        <p style="margin: 0; font-size: 12px; color: #1e293b; font-weight: 600; line-height: 1.35; padding: 0 4px;">
                          Helping shape the future of African travel.
                        </p>
                      </div>

                      <!-- Milestone 2: Globe / Supporting Hosts -->
                      <div style="margin-bottom: 22px;">
                        <div style="display: inline-block; margin-bottom: 6px;">
                          <!-- Red Globe Icon -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                            <tr>
                              <td align="center">
                                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <line x1="2" y1="12" x2="22" y2="12"></line>
                                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                                </svg>
                              </td>
                            </tr>
                          </table>
                        </div>
                        <p style="margin: 0; font-size: 12px; color: #1e293b; font-weight: 600; line-height: 1.35; padding: 0 4px;">
                          Supporting local hosts, operators &amp; tourism businesses.
                        </p>
                      </div>

                      <!-- Milestone 3: Property / Building Travel Ecosystem -->
                      <div style="margin-bottom: 22px;">
                        <div style="display: inline-block; margin-bottom: 6px;">
                          <!-- City / Building Icon -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                            <tr>
                              <td align="center">
                                <svg width="34" height="34" viewBox="0 0 24 24" fill="#111827" style="display: block;">
                                  <path d="M19 2H9c-1.1 0-2 .9-2 2v3H5c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM5 19V9h2v10H5zm6 0H9v-2h2v2zm0-4H9v-2h2v2zm0-4H9V9h2v2zm0-4H9V5h2v2zm4 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm4 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2z"/>
                                </svg>
                              </td>
                            </tr>
                          </table>
                        </div>
                        <p style="margin: 0; font-size: 12px; color: #1e293b; font-weight: 600; line-height: 1.35; padding: 0 4px;">
                          Building a stronger travel ecosystem for Africa
                        </p>
                      </div>

                      <!-- Milestone 4: Heart Badge -->
                      <div style="margin-top: 8px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                          <tr>
                            <td align="center" style="width: 44px; height: 44px; background-color: #dc2626; border-radius: 50%; text-align: center; vertical-align: middle; box-shadow: 0 4px 10px rgba(220, 38, 38, 0.25);">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff" style="display: inline-block; vertical-align: middle;">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                              </svg>
                            </td>
                          </tr>
                        </table>
                      </div>

                    </div>
                  </td>

                </tr>
              </table>
            </td>
          </tr>

          <!-- Explore Button CTA -->
          <tr>
            <td align="center" style="padding: 8px 28px 28px; background-color: #ffffff; text-align: center;">
              <a href="https://merry360x.com" target="_blank" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-size: 14px; font-weight: 600; letter-spacing: 0.02em;">
                Explore Merry 360X &rarr;
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 28px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 6px; font-size: 12px; color: #6b7280; font-weight: 600;">
                Merry 360 Experiences · East Africa
              </p>
              <p style="margin: 0 0 8px; font-size: 11.5px; color: #9ca3af; line-height: 1.4;">
                Kigali, Rwanda &bull; Connecting travelers with authentic local stays, safaris &amp; adventures.
              </p>
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                <a href="https://merry360x.com" style="color: #6b7280; text-decoration: underline;">merry360x.com</a> &bull; 
                <a href="mailto:support@merry360x.com" style="color: #6b7280; text-decoration: underline;">support@merry360x.com</a>
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

function formatDateHelper(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoneyHelper(amount, currency = "RWF") {
  if (!amount) return "—";
  const num = Number(amount);
  if (!Number.isFinite(num)) return "—";
  const code = String(currency || "RWF").toUpperCase();
  return `${Math.round(num).toLocaleString("en-US")} ${code}`;
}

export function generateEnhancedBookingConfirmationHtml(booking) {
  const firstName = booking.firstName || (booking.guestName ? String(booking.guestName).trim().split(" ")[0] : "Traveler");
  const reviewUrl = booking.reviewToken
    ? `https://merry360x.com/review/${booking.reviewToken}`
    : `https://merry360x.com/my-bookings`;

  const bookingRef = (booking.bookingId || booking.id || "—").slice(0, 8).toUpperCase();
  const bookingDateStr = booking.bookingDate || booking.createdAt || new Date();

  const isMultiItem = booking.items && Array.isArray(booking.items) && booking.items.length > 1;
  const itemsHtml = isMultiItem
    ? `<div style="margin:0 0 16px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px;">
        <p style="margin:0 0 8px; font-weight:600; font-size:13px; color:#111827;">Included in this Reservation:</p>
        ${booking.items
      .map(
        (item) => `<div style="padding: 4px 0; border-bottom: 1px dashed #e5e7eb; font-size:13px; color:#374151;">
              <span style="font-weight:500;">• ${escapeHtml(item.title || "Experience")}</span>
              <span style="float:right; font-weight:600; color:#111827;">${escapeHtml(formatMoneyHelper(item.price, item.currency || booking.currency))}</span>
            </div>`
      )
      .join("")}
      </div>`
    : "";

  const serviceName = booking.propertyTitle || booking.serviceName || booking.title || "Experience Booking";
  const location = booking.location || booking.city || "Rwanda";
  const checkIn = formatDateHelper(booking.checkIn || booking.startDate || booking.date);
  const checkOut = booking.checkOut || booking.endDate ? formatDateHelper(booking.checkOut || booking.endDate) : null;
  const checkInTime = booking.checkInTime ? ` (${booking.checkInTime})` : "";
  const checkOutTime = booking.checkOutTime ? ` (${booking.checkOutTime})` : "";

  const detailsRows = [
    { label: "Confirmation Code", value: `<span style="font-family:monospace; background:#f3f4f6; padding:2px 8px; border-radius:4px; font-weight:700; color:#111827;">#${escapeHtml(bookingRef)}</span>` },
    { label: "Guest", value: escapeHtml(booking.guestName || firstName) },
    { label: "Listing Name", value: `<strong>${escapeHtml(serviceName)}</strong>` },
    { label: "Booking Date", value: escapeHtml(formatDateHelper(bookingDateStr)) },
    { label: "Location", value: escapeHtml(location) },
    { label: "Check-in / Start Date", value: `${escapeHtml(checkIn)}${escapeHtml(checkInTime)}` },
  ];

  if (checkOut) {
    detailsRows.push({ label: "Check-out / End Date", value: `${escapeHtml(checkOut)}${escapeHtml(checkOutTime)}` });
  }

  if (booking.nights) {
    detailsRows.push({ label: "Duration", value: `${booking.nights} night${booking.nights > 1 ? "s" : ""}` });
  } else if (booking.duration) {
    detailsRows.push({ label: "Duration", value: escapeHtml(String(booking.duration)) });
  }

  detailsRows.push({ label: "Guests", value: `${booking.guests || 1} guest${(booking.guests || 1) > 1 ? "s" : ""}` });

  if (booking.hostName) {
    detailsRows.push({ label: "Host / Provider", value: escapeHtml(booking.hostName) });
  }

  detailsRows.push({
    label: "Amount Paid",
    value: `<strong style="font-size:15px; color:#111827;">${escapeHtml(formatMoneyHelper(booking.totalPrice || booking.totalAmount, booking.currency))}</strong>`,
  });

  detailsRows.push({
    label: "Status",
    value: `<span style="display:inline-block; background:#dcfce7; color:#166534; padding:3px 10px; border-radius:999px; font-weight:600; font-size:12px;">Confirmed</span>`,
  });

  const detailsTable = keyValueRows(detailsRows);

  const stars = [1, 2, 3, 4, 5]
    .map((star) => `<a href="${reviewUrl}?rating=${star}" style="display:inline-block; text-decoration:none; border:1px solid #e5e7eb; border-radius:8px; padding:6px 10px; margin-right:4px; color:#111827; font-size:13px; background:#f9fafb;">${"★".repeat(star)}</a>`)
    .join("");

  const bodyHtml = `
    <div style="font-size:15px; line-height:1.6; color:#374151;">
      <p style="margin:0 0 14px; font-size:16px; color:#111827;">
        <strong>Hello ${escapeHtml(firstName)},</strong>
      </p>
      <p style="margin:0 0 16px;">
        Your booking for <strong>${escapeHtml(serviceName)}</strong> is confirmed and fully paid! Here are your complete reservation details:
      </p>

      ${itemsHtml}
      ${detailsTable}

      <!-- Next Steps & Check-in Guide -->
      <div style="margin-top:20px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:14px 16px;">
        <h4 style="margin:0 0 6px; font-size:13px; color:#1e40af; font-weight:600;">✨ Reservation Notes & Check-in</h4>
        <p style="margin:0 0 6px; font-size:12px; color:#1e3a8a;">• Please keep your booking reference <strong>#${escapeHtml(bookingRef)}</strong> handy during check-in or arrival.</p>
        <p style="margin:0 0 6px; font-size:12px; color:#1e3a8a;">• You can manage your booking, get directions, or message your host directly from your account.</p>
        <p style="margin:0; font-size:12px; color:#1e3a8a;">• Need assistance? Contact our 24/7 concierge anytime at <a href="mailto:support@merry360x.com" style="color:#1d4ed8; text-decoration:underline;">support@merry360x.com</a>.</p>
      </div>

      <!-- Review Section -->
      <div style="margin-top:20px; border-top:1px solid #e5e7eb; padding-top:16px;">
        <p style="margin:0 0 8px; color:#6b7280; font-size:12px; font-weight:500;">Rate your booking experience:</p>
        <div>${stars}</div>
        <div style="margin-top:12px;">
          <a href="https://g.page/r/CaydY8tsMgH8EBM/review" style="display:inline-block; text-decoration:none; background:#f3f4f6; border:1px solid #d1d5db; color:#111827; border-radius:8px; padding:8px 14px; font-size:12px; font-weight:600;">Leave a Review on Google ★★★★★</a>
        </div>
      </div>
    </div>
  `;

  return renderMinimalEmail({
    eyebrow: "Booking Confirmation",
    title: "Your Booking is Confirmed! 🎉",
    subtitle: `Reservation #${escapeHtml(bookingRef)} · ${escapeHtml(serviceName)}`,
    bodyHtml,
    ctaText: "View My Bookings",
    ctaUrl: "https://merry360x.com/my-bookings",
  });
}
