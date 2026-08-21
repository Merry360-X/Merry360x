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

const DEFAULT_FROM_NAME = "Merry 360 Experiences";
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
      "X-Mailer": "Merry 360 Experiences Transactional",
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
  footerText = "Merry 360 Experiences · Book local. Travel better.",
  footerLink = "https://merry360x.com",
  supportEmail = "support@merry360x.com",
  lightLogoUrl = process.env.EMAIL_LOGO_LIGHT_URL || DEFAULT_LIGHT_LOGO,
  darkLogoUrl = process.env.EMAIL_LOGO_DARK_URL || DEFAULT_DARK_LOGO,
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(title || "Merry 360 Experiences")}</title>
  <style>
    .logo-dark {
      display: none !important;
      max-height: 0 !important;
      overflow: hidden !important;
    }
    @media (prefers-color-scheme: dark) {
      body, .email-bg {
        background: #0f172a !important;
      }
      .email-card {
        background: #111827 !important;
        border-color: #374151 !important;
      }
      .email-divider {
        background: #374151 !important;
      }
      .email-title {
        color: #f9fafb !important;
      }
      .email-subtitle,
      .email-eyebrow {
        color: #d1d5db !important;
      }
      .logo-light {
        display: none !important;
        max-height: 0 !important;
        overflow: hidden !important;
      }
      .logo-dark {
        display: inline-block !important;
        max-height: none !important;
      }
      .email-footer {
        background: #1f2937 !important;
        border-top-color: #374151 !important;
      }
      .email-footer p,
      .email-footer a {
        color: #d1d5db !important;
      }
    }
  </style>
</head>
<body class="email-bg" style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-bg" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 12px;text-align:center;">
              <img src="${escapeHtml(lightLogoUrl)}" alt="Merry 360 Experiences" width="44" height="44" class="logo-light" style="display:inline-block;border-radius:10px;" />
              <img src="${escapeHtml(darkLogoUrl)}" alt="Merry 360 Experiences" width="44" height="44" class="logo-dark" style="border-radius:10px;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 8px;text-align:center;">
              ${eyebrow ? `<p class="email-eyebrow" style="margin:0 0 8px;color:#6b7280;font-size:11px;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>` : ""}
              <h1 class="email-title" style="margin:0;color:#111827;font-size:24px;line-height:1.3;">${escapeHtml(title || "Update")}</h1>
              ${subtitle ? `<p class="email-subtitle" style="margin:10px 0 0;color:#4b5563;font-size:14px;line-height:1.6;">${escapeHtml(subtitle)}</p>` : ""}
            </td>
          </tr>
          <tr><td style="padding:16px 28px 0;"><div class="email-divider" style="height:1px;background:#e5e7eb;"></div></td></tr>
          <tr>
            <td style="padding:20px 28px;">
              ${bodyHtml || ""}
            </td>
          </tr>
          ${ctaText && ctaUrl ? `
          <tr>
            <td style="padding:4px 28px 24px;text-align:center;">
              <a href="${ctaUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(ctaText)}</a>
            </td>
          </tr>` : ""}
          <tr>
            <td class="email-footer" style="background:#f9fafb;padding:16px 28px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#6b7280;font-size:12px;">${escapeHtml(footerText)}</p>
              <p style="margin:6px 0 0;font-size:11px;"><a href="${footerLink}" style="color:#6b7280;text-decoration:none;">${escapeHtml(footerLink.replace("https://", ""))}</a> · <a href="mailto:${supportEmail}" style="color:#6b7280;text-decoration:none;">${escapeHtml(supportEmail)}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateWelcomeEmailHtml({ firstName, name, email }) {
  const displayName = firstName || (name ? name.split(" ")[0] : "Traveler");

  const bodyHtml = `
    <div style="font-size: 15px; line-height: 1.6; color: #374151;">
      <p style="margin: 0 0 16px; font-size: 16px; color: #111827;">
        <strong>Hello ${escapeHtml(displayName)},</strong>
      </p>
      <p style="margin: 0 0 16px;">
        Welcome to <strong>Merry 360 Experiences</strong>! We are thrilled to have you join our community of travelers and explorers.
      </p>
      <p style="margin: 0 0 20px;">
        Whether you are planning a peaceful getaway in Rwanda, an unforgettable safari across Tanzania and Kenya, or authentic cultural tours guided by passionate locals, we are here to make your journey seamless and extraordinary.
      </p>

      <!-- Value Props -->
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 14px; font-size: 14px; color: #111827; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">What You Can Explore:</h3>
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; vertical-align: top; width: 28px; font-size: 18px;">🏡</td>
            <td style="padding: 8px 0 12px; vertical-align: top;">
              <strong style="color: #111827; font-size: 14px; display: block; margin-bottom: 2px;">Unique Stays & Accommodations</strong>
              <span style="font-size: 13px; color: #6b7280; line-height: 1.5; display: block;">Handpicked villas, boutique hotels, eco-lodges, and cozy apartments verified for comfort and safety.</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; vertical-align: top; width: 28px; font-size: 18px;">🦁</td>
            <td style="padding: 8px 0 12px; vertical-align: top;">
              <strong style="color: #111827; font-size: 14px; display: block; margin-bottom: 2px;">Curated Tours & Safaris</strong>
              <span style="font-size: 13px; color: #6b7280; line-height: 1.5; display: block;">Gorilla trekking, wildlife game drives, volcano hiking, and rich cultural immersions.</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; vertical-align: top; width: 28px; font-size: 18px;">🚗</td>
            <td style="padding: 8px 0 12px; vertical-align: top;">
              <strong style="color: #111827; font-size: 14px; display: block; margin-bottom: 2px;">Reliable Transport & Transfers</strong>
              <span style="font-size: 13px; color: #6b7280; line-height: 1.5; display: block;">Airport pickups, private drivers, and robust 4x4 car rentals for seamless travel.</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; vertical-align: top; width: 28px; font-size: 18px;">🤝</td>
            <td style="padding: 8px 0; vertical-align: top;">
              <strong style="color: #111827; font-size: 14px; display: block; margin-bottom: 2px;">Direct Host Connections</strong>
              <span style="font-size: 13px; color: #6b7280; line-height: 1.5; display: block;">Chat directly with verified local hosts and guides before and during your stay.</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Welcome Bonus Badge -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 16px; margin: 20px 0; text-align: center;">
        <span style="font-size: 14px; font-weight: 600; color: #166534;">🎉 Welcome Loyalty Points Added to Your Account</span>
        <p style="margin: 4px 0 0; font-size: 12px; color: #15803d;">Earn points with every booking and unlock discounts on future experiences.</p>
      </div>

      <p style="margin: 20px 0 0; font-size: 14px; color: #4b5563;">
        Ready to plan your next journey? Start exploring today.
      </p>
    </div>
  `;

  return renderMinimalEmail({
    eyebrow: "Welcome to Merry 360 Experiences",
    title: "Your Adventure Begins Here ✨",
    subtitle: "Discover authentic stays, safaris, and local hospitality.",
    bodyHtml,
    ctaText: "Start Exploring Experiences",
    ctaUrl: "https://merry360x.com/accommodations",
  });
}

export function generateFounderWelcomeEmailHtml({ firstName, name, email }) {
  const displayName = firstName || (name ? name.split(" ")[0] : "Friend");

  const bodyHtml = `
    <div style="font-size: 15px; line-height: 1.7; color: #374151;">
      <p style="margin: 0 0 16px; font-size: 16px; color: #111827;">
        <strong>Dear ${escapeHtml(displayName)},</strong>
      </p>
      <p style="margin: 0 0 16px;">
        I wanted to take a moment to personally welcome you to <strong>Merry 360 Experiences</strong>.
      </p>
      <p style="margin: 0 0 16px;">
        When we started Merry 360, it grew out of a deep passion for East Africa and a simple belief: <em>travel should be immersive, authentic, and directly empower the local communities and hosts who make this region so special.</em>
      </p>
      <p style="margin: 0 0 16px;">
        Too often, visitors only scratch the surface of what Africa has to offer. We built Merry 360 Experiences so you can connect directly with genuine local hosts, experience mountain gorillas in the mist, witness the majesty of the savannah, relax on serene lakes and coastlines, and feel genuinely at home wherever you go.
      </p>
      
      <div style="background: #f8fafc; border-left: 4px solid #111827; border-radius: 4px; padding: 14px 18px; margin: 20px 0;">
        <p style="margin: 0; font-style: italic; color: #1e293b; font-size: 14px; line-height: 1.6;">
          "Our promise is simple: transparent pricing, verified hosts, authentic local adventures, and concierge support every step of the way."
        </p>
      </div>

      <p style="margin: 0 0 16px;">
        As a new member of our community, please know that our entire team is here to ensure your trip is unforgettable. If you ever have questions, need tailored recommendations, or want to share feedback with us, you can <strong>reply directly to this email</strong> — I read every response.
      </p>

      <p style="margin: 20px 0 24px;">
        Thank you for trusting us with your travel dreams. We can’t wait to welcome you on your next journey.
      </p>

      <!-- Founder Signature Card -->
      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 20px;">
        <p style="margin: 0; font-weight: 700; color: #111827; font-size: 15px;">The Merry 360 Experiences Team & Founders</p>
        <p style="margin: 2px 0 0; color: #6b7280; font-size: 13px;">Merry 360 Experiences · Kigali, Rwanda</p>
        <p style="margin: 4px 0 0; font-size: 12px; color: #9ca3af;">Empowering local hosts · Creating lifelong memories</p>
      </div>
    </div>
  `;

  return renderMinimalEmail({
    eyebrow: "A Note from Our Founder",
    title: "Welcome to Our Travel Community 🌍",
    subtitle: "A personal welcome from the founders of Merry 360 Experiences.",
    bodyHtml,
    ctaText: "Discover What's New",
    ctaUrl: "https://merry360x.com",
  });
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
    { label: "Guest Name", value: escapeHtml(booking.guestName || firstName) },
    { label: "Booking Reference", value: `<span style="font-family:monospace; background:#f3f4f6; padding:2px 8px; border-radius:4px; font-weight:700; color:#111827;">#${escapeHtml(bookingRef)}</span>` },
    { label: "Booking Date", value: escapeHtml(formatDateHelper(bookingDateStr)) },
    { label: "Service / Property", value: `<strong>${escapeHtml(serviceName)}</strong>` },
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
    label: "Payment Status",
    value: `<span style="display:inline-block; background:#dcfce7; color:#166534; padding:3px 10px; border-radius:999px; font-weight:600; font-size:12px;">PAID</span>`,
  });

  detailsRows.push({
    label: "Total Amount",
    value: `<strong style="font-size:16px; color:#111827;">${escapeHtml(formatMoneyHelper(booking.totalPrice || booking.totalAmount, booking.currency))}</strong>`,
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
