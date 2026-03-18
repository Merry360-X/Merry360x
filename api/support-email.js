import {
  buildBrevoSmtpPayload,
  escapeHtml,
  getSafeRecipientEmail,
  keyValueRows,
  renderMinimalEmail,
  validateRecipientEmail,
} from "../lib/email-template-kit.js";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@merry360x.com";
const FINANCE_EMAIL = process.env.FINANCE_EMAIL || process.env.PAYMENTS_EMAIL || "support@merry360x.com";
const FINANCE_NAME = process.env.FINANCE_NAME || "Finance Team";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function asText(value, fallback = "") {
  const s = typeof value === "string" ? value.trim() : "";
  return s || fallback;
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

function buildSupportEmailHtml(payload) {
  const details = keyValueRows([
    { label: "Ticket ID", value: escapeHtml(payload.ticketId || "Pending") },
    { label: "Category", value: escapeHtml(payload.category || "general") },
    { label: "User Name", value: escapeHtml(payload.userName || "Customer") },
    { label: "User Email", value: escapeHtml(payload.userEmail || "Not provided") },
    { label: "User ID", value: escapeHtml(payload.userId || "Unknown") },
    { label: "Subject", value: escapeHtml(payload.subject || "Support request") },
  ]);

  const messageHtml = `<p style="margin: 12px 0 0; color: #111827; font-size: 14px; line-height: 1.6;">${escapeHtml(payload.message || "No message provided")}</p>`;

  return renderMinimalEmail({
    eyebrow: "Support",
    title: "New support ticket",
    subtitle: "A customer created a new support ticket from mobile or web.",
    bodyHtml: `${details}${messageHtml}`,
    ctaText: "Open Support Dashboard",
    ctaUrl: "https://merry360x.com/admin-support",
  });
}

function buildConfirmationHtml(payload) {
  const details = keyValueRows([
    { label: "Ticket ID", value: escapeHtml(payload.ticketId || "Pending") },
    { label: "Category", value: escapeHtml(payload.category || "general") },
    { label: "Subject", value: escapeHtml(payload.subject || "Support request") },
    { label: "Status", value: "OPEN" },
  ]);

  const bodyHtml = `
    <p style="margin: 0 0 12px; color: #111827; font-size: 14px; line-height: 1.6;">Hi ${escapeHtml(payload.userName || "there")},</p>
    <p style="margin: 0 0 12px; color: #111827; font-size: 14px; line-height: 1.6;">We have received your support request. Our team will reply as soon as possible.</p>
    ${details}
    <p style="margin: 12px 0 0; color: #111827; font-size: 14px; line-height: 1.6;">Your message:</p>
    <p style="margin: 8px 0 0; color: #111827; font-size: 14px; line-height: 1.6;">${escapeHtml(payload.message || "")}</p>
  `;

  return renderMinimalEmail({
    eyebrow: "Support",
    title: "Ticket received",
    subtitle: "Your support ticket has been created successfully.",
    bodyHtml,
    ctaText: "Open Support Center",
    ctaUrl: "https://merry360x.com/support",
  });
}

function formatMoney(amount, currency = "RWF") {
  const num = Number(amount || 0);
  const code = String(currency || "RWF").toUpperCase();
  return `${Math.round(num).toLocaleString("en-US")} ${code}`;
}

function generatePayoutEmailHtml(payout) {
  const createdAt = new Date().toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const methodDisplay = payout.method === "mobile_money" ? "Mobile Money" : "Bank Transfer";
  const isCompletedEvent = payout.eventType === "completed";
  const payoutStatus = String(payout.status || (isCompletedEvent ? "completed" : "pending")).toLowerCase();
  const detailsTable = keyValueRows([
    { label: "Request ID", value: escapeHtml(payout.payoutId || "N/A") },
    { label: "Host", value: escapeHtml(payout.hostName || "N/A") },
    { label: "Host Email", value: escapeHtml(payout.hostEmail || "N/A") },
    { label: "Amount", value: escapeHtml(formatMoney(payout.amount, payout.currency)) },
    { label: "Method", value: escapeHtml(methodDisplay) },
    { label: payout.method === "mobile_money" ? "Phone" : "Bank", value: escapeHtml(payout.method === "mobile_money" ? (payout.phone || "N/A") : (payout.bankName || "N/A")) },
    { label: payout.method === "mobile_money" ? "Account Name" : "Account", value: escapeHtml(payout.method === "mobile_money" ? (payout.accountName || "N/A") : (payout.bankAccount || "N/A")) },
    { label: isCompletedEvent ? "Processed" : "Requested", value: escapeHtml(createdAt) },
    { label: "Status", value: escapeHtml(payoutStatus.toUpperCase()) },
  ]);

  return renderMinimalEmail({
    eyebrow: isCompletedEvent ? "Payout Completed" : "Payout Request",
    title: isCompletedEvent ? "Payout processed" : "New payout request",
    subtitle: isCompletedEvent
      ? "A payout has been processed and recorded."
      : "A host has requested a payout and needs review.",
    bodyHtml: detailsTable,
    ctaText: "Open Admin Dashboard",
    ctaUrl: "https://merry360x.com/admin-dashboard",
  });
}

function generateHostPayoutConfirmationHtml(payout) {
  const createdAt = new Date().toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const methodDisplay = payout.method === "mobile_money" ? "Mobile Money" : "Bank Transfer";
  const isCompletedEvent = payout.eventType === "completed";
  const payoutStatus = String(payout.status || (isCompletedEvent ? "completed" : "pending")).toLowerCase();
  const detailsTable = keyValueRows([
    { label: "Request ID", value: escapeHtml(payout.payoutId || "N/A") },
    { label: "Amount", value: escapeHtml(formatMoney(payout.amount, payout.currency)) },
    { label: "Method", value: escapeHtml(methodDisplay) },
    { label: isCompletedEvent ? "Processed" : "Requested", value: escapeHtml(createdAt) },
    { label: "Status", value: escapeHtml(payoutStatus.toUpperCase()) },
  ]);

  return renderMinimalEmail({
    eyebrow: isCompletedEvent ? "Payout Update" : "Payout Request",
    title: isCompletedEvent ? "Your payout was processed" : "Your payout request was received",
    subtitle: isCompletedEvent
      ? "Your payout status has been updated."
      : "Our team will review and process it shortly.",
    bodyHtml: detailsTable,
    ctaText: "Open Host Dashboard",
    ctaUrl: "https://merry360x.com/host-dashboard",
  });
}

async function sendBrevo({ toEmail, toName, subject, htmlContent, textContent, tags }) {
  if (!BREVO_API_KEY) {
    return { skipped: true, reason: "missing_brevo_api_key" };
  }

  const recipient = getSafeRecipientEmail({ primaryEmail: toEmail });
  if (!recipient) {
    throw new Error("Invalid recipient email");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify(
      buildBrevoSmtpPayload({
        to: [{ email: recipient.email, name: toName }],
        subject,
        htmlContent,
        textContent,
        tags: Array.isArray(tags) && tags.length > 0 ? tags : ["support", "ticket"],
      })
    ),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result?.message || "Failed to send email");
    error.details = result;
    throw error;
  }

  return { messageId: result?.messageId || null };
}

async function handleSupportTicket(body) {
  const subject = asText(body.subject, "Support request");
  const message = asText(body.message);

  if (!message) {
    return { status: 400, body: { error: "message is required" } };
  }

  const payload = {
    ticketId: asText(body.ticketId),
    category: asText(body.category, "general"),
    subject,
    message,
    userId: asText(body.userId),
    userName: asText(body.userName, "Customer"),
    userEmail: asText(body.userEmail),
  };

  const htmlContent = buildSupportEmailHtml(payload);
  const result = await sendBrevo({
    toEmail: SUPPORT_EMAIL,
    toName: "Merry 360 Support",
    subject: `[Support] ${subject}`,
    htmlContent,
    tags: ["support", "ticket", "internal"],
  });

  return { status: 200, body: { ok: true, ...result } };
}

async function handleTicketConfirmation(body) {
  const payload = {
    ticketId: asText(body.ticketId),
    category: asText(body.category, "general"),
    subject: asText(body.subject, "Support request"),
    message: asText(body.message),
    userName: asText(body.userName, "there"),
    userEmail: asText(body.userEmail),
  };

  const emailValidation = validateRecipientEmail(payload.userEmail);
  if (!emailValidation.ok) {
    return { status: 200, body: { ok: true, skipped: true, reason: "invalid_or_missing_user_email" } };
  }

  const htmlContent = buildConfirmationHtml(payload);
  const result = await sendBrevo({
    toEmail: emailValidation.email,
    toName: payload.userName,
    subject: `Ticket received: ${payload.subject}`,
    htmlContent,
    tags: ["support", "ticket", "customer"],
  });

  return { status: 200, body: { ok: true, ...result } };
}

async function handlePayoutNotification(body) {
  const payout = body;
  if (!payout || !payout.amount) {
    return { status: 400, body: { error: "Missing payout data" } };
  }

  if (!BREVO_API_KEY) {
    return { status: 200, body: { ok: true, skipped: true, reason: "missing_brevo_api_key" } };
  }

  if (payout.previewTo) {
    const previewRecipient = getSafeRecipientEmail({ primaryEmail: null, previewEmail: payout.previewTo });
    if (!previewRecipient) {
      return { status: 200, body: { ok: true, skipped: true, reason: "invalid_preview_recipient" } };
    }

    await sendBrevo({
      toEmail: previewRecipient.email,
      toName: "Template Preview",
      subject: `[Preview] Payout Request: ${formatMoney(payout.amount, payout.currency)} - ${payout.hostName || "Host"}`,
      htmlContent: generatePayoutEmailHtml(payout),
      textContent: `Preview payout request for ${payout.hostName || "Host"} (${formatMoney(payout.amount, payout.currency)})`,
      tags: ["payout"],
    });

    return { status: 200, body: { ok: true, success: true, message: "Notification sent" } };
  }

  const isCompletedEvent = payout.eventType === "completed";
  const statusLabel = String(payout.status || (isCompletedEvent ? "completed" : "pending")).toUpperCase();
  const supportHtml = generatePayoutEmailHtml(payout);
  const supportText = `
${isCompletedEvent ? "Payout Processed" : "New Payout Request"}

Host: ${payout.hostName || "N/A"} (${payout.hostEmail || "N/A"})
Request ID: ${payout.payoutId || "N/A"}
Amount: ${formatMoney(payout.amount, payout.currency)}
Status: ${statusLabel}
Method: ${payout.method === "mobile_money" ? "Mobile Money" : "Bank Transfer"}
${payout.method === "mobile_money" ? `Phone: ${payout.phone || "N/A"}` : `Bank: ${payout.bankName || "N/A"}\nAccount: ${payout.bankAccount || "N/A"}`}
Account Name: ${payout.accountName || "N/A"}

Process this payout at: https://merry360x.com/admin-dashboard
  `.trim();

  const hostHtml = generateHostPayoutConfirmationHtml(payout);
  const hostText = `
Hi ${payout.hostName || "Host"},

${isCompletedEvent ? "Your payout has been processed." : "Your payout request has been received."}
Request ID: ${payout.payoutId || "N/A"}
Amount: ${formatMoney(payout.amount, payout.currency)}
Method: ${payout.method === "mobile_money" ? "Mobile Money" : "Bank Transfer"}

Current status: ${statusLabel}
You can track updates in your host dashboard: https://merry360x.com/host-dashboard
  `.trim();

  const adminFinanceRecipients = [
    { email: SUPPORT_EMAIL, name: "Merry 360 Experiences Support" },
    { email: FINANCE_EMAIL, name: FINANCE_NAME },
  ].filter((recipient, index, all) => recipient.email && all.findIndex((r) => String(r.email).toLowerCase() === String(recipient.email).toLowerCase()) === index);

  const supportSubjectPrefix = isCompletedEvent ? "Payout Completed" : "Payout Request";
  const sendTasks = adminFinanceRecipients.map((recipient) =>
    sendBrevo({
      toEmail: recipient.email,
      toName: recipient.name,
      subject: `${supportSubjectPrefix} ${payout.payoutId ? `#${payout.payoutId}` : ""}: ${formatMoney(payout.amount, payout.currency)} - ${payout.hostName || "Host"}`,
      htmlContent: supportHtml,
      textContent: supportText,
      tags: ["payout"],
    })
  );

  const hostEmailValidation = validateRecipientEmail(payout.hostEmail);
  if (hostEmailValidation.ok) {
    sendTasks.push(
      sendBrevo({
        toEmail: hostEmailValidation.email,
        toName: payout.hostName || "Host",
        subject: `${isCompletedEvent ? "Payout Update" : "Payout Request Received"} ${payout.payoutId ? `#${payout.payoutId}` : ""}: ${formatMoney(payout.amount, payout.currency)}`,
        htmlContent: hostHtml,
        textContent: hostText,
        tags: ["payout"],
      })
    );
  }

  const results = await Promise.allSettled(sendTasks);
  const firstCritical = results.find((result, idx) => idx < adminFinanceRecipients.length && result.status === "rejected");
  if (firstCritical?.status === "rejected") {
    throw firstCritical.reason;
  }

  return { status: 200, body: { ok: true, success: true, message: "Notification sent" } };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return json(res, 200, { ok: true });
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = parseBody(req);
    const action = asText(body.action).toLowerCase();

    if (action === "password_reset") {
      return json(res, 200, { ok: true, skipped: true, reason: "use_supabase_fallback" });
    }

    if (action === "ticket_confirmation") {
      const result = await handleTicketConfirmation(body);
      return json(res, result.status, result.body);
    }

    if (action === "payout_notification") {
      const result = await handlePayoutNotification(body);
      return json(res, result.status, result.body);
    }

    const result = await handleSupportTicket(body);
    return json(res, result.status, result.body);
  } catch (error) {
    console.error("support-email error", error);
    return json(res, 500, { error: error?.message || "Failed to process support email" });
  }
}
