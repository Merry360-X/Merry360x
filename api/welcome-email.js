import {
  buildBrevoSmtpPayload,
  filterValidRecipients,
  generateFounderWelcomeEmailHtml,
  generateWelcomeEmailHtml,
  validateRecipientEmail,
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

    // 1. Welcome Email
    if (type === "welcome" || type === "both" || type === "all") {
      const welcomeHtml = generateWelcomeEmailHtml({
        firstName,
        name: fullName,
        email: recipientEmail,
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
