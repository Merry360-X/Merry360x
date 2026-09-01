import { createClient } from "@supabase/supabase-js";
import {
  buildBrevoSmtpPayload,
  escapeHtml,
  keyValueRows,
  renderMinimalEmail,
  validateRecipientEmail,
} from "../lib/email-template-kit.js";
import { upsertSavedMobileMoneyMethod } from "../lib/payment-method-storage.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAWAPAY_API_KEY = process.env.PAWAPAY_API_KEY;
const PAWAPAY_BASE_URL = process.env.PAWAPAY_BASE_URL || "https://api.pawapay.io";
const BREVO_API_KEY = process.env.BREVO_API_KEY;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function parsePawaPayResponse(payload) {
  if (Array.isArray(payload)) return payload[0] || null;
  return payload || null;
}

function safeStr(value, max = 200) {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > max ? s.slice(0, max) : s;
}

function formatMoney(amount, currency = "USD") {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currency} 0.00`;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function mapPawaPayPayoutStatus(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "COMPLETED") return "completed";
  if (normalized === "FAILED" || normalized === "REJECTED" || normalized === "CANCELLED") return "rejected";
  if (normalized === "ENQUEUED" || normalized === "ACCEPTED" || normalized === "SUBMITTED") return "processing";
  return "processing";
}

function buildPayoutErrorMessage(payoutData) {
  return (
    payoutData?.rejectionReason?.rejectionMessage ||
    payoutData?.failureReason?.failureMessage ||
    payoutData?.errorMessage ||
    payoutData?.message ||
    "Payout failed"
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  try {
    const formatted = formatDate(dateStr);
    if (timeStr) {
      return `${formatted} at ${String(timeStr).trim()}`;
    }
    return formatted;
  } catch {
    return String(dateStr);
  }
}

function formatMoneyRwf(amount) {
  const num = Number(amount || 0);
  return `${Math.round(num).toLocaleString("en-US")} RWF`;
}

function getServiceTypeFromItem(itemType) {
  if (itemType === "property") return "accommodation";
  if (itemType === "tour" || itemType === "tour_package") return "tour";
  return "transport";
}

function getFeePercentsForItem(itemType) {
  const serviceType = getServiceTypeFromItem(itemType);
  if (serviceType === "accommodation") {
    return { guestFeePercent: 10, hostFeePercent: 3 };
  }
  if (serviceType === "tour") {
    return { guestFeePercent: 0, hostFeePercent: 10 };
  }
  return { guestFeePercent: 5, hostFeePercent: 7 };
}

function computeHostReceivesAmount(item, booking) {
  const itemHostEarnings = Number(item?.host_earnings_amount);
  if (Number.isFinite(itemHostEarnings) && itemHostEarnings >= 0) {
    return itemHostEarnings;
  }

  const bookingTotal = Number(booking?.total_price);
  const guestPaid = Number(item?.calculated_price);
  const guestPaidAmount = Number.isFinite(guestPaid) && guestPaid > 0
    ? guestPaid
    : (Number.isFinite(bookingTotal) && bookingTotal > 0 ? bookingTotal : 0);

  const { guestFeePercent, hostFeePercent } = getFeePercentsForItem(item?.item_type);
  const baseAmount = guestPaidAmount / (1 + (guestFeePercent / 100));
  const hostFee = (baseAmount * hostFeePercent) / 100;
  return Math.max(0, baseAmount - hostFee);
}

function generateConfirmationEmail(checkout, items, bookingIds, reviewTokens) {
  const guestName = checkout.name || checkout.metadata?.guest_info?.name || "Guest";
  const totalAmount = formatMoney(checkout.total_amount, checkout.currency);
  const receiptNumber = `MRY-${Date.now().toString(36).toUpperCase()}`;
  const isMultiItem = items && items.length > 1;

  const bookingDate = checkout.created_at ? new Date(checkout.created_at) : new Date();
  const bookingDateFormatted = bookingDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const firstItem = items && items[0];
  const listingName = isMultiItem
    ? items.map((i) => i.title || i.name || "Item").filter(Boolean).join(", ") || "Multiple Bookings"
    : (firstItem?.title || firstItem?.name || checkout.metadata?.item_name || checkout.title || "Experience");

  const checkInDate = checkout.metadata?.booking_details?.check_in || firstItem?.metadata?.check_in || firstItem?.check_in || checkout.metadata?.check_in;
  const checkInTime = checkout.metadata?.booking_details?.check_in_time || firstItem?.metadata?.check_in_time || firstItem?.check_in_time || checkout.metadata?.booking_details?.pickup_time || firstItem?.metadata?.pickup_time || checkout.metadata?.check_in_time;
  const checkInFormatted = formatDateTime(checkInDate, checkInTime);

  const checkOutDate = checkout.metadata?.booking_details?.check_out || firstItem?.metadata?.check_out || firstItem?.check_out || checkout.metadata?.check_out;
  const checkOutTime = checkout.metadata?.booking_details?.check_out_time || firstItem?.metadata?.check_out_time || firstItem?.check_out_time || checkout.metadata?.booking_details?.dropoff_time || firstItem?.metadata?.dropoff_time || checkout.metadata?.check_out_time;
  const checkOutFormatted = formatDateTime(checkOutDate, checkOutTime);

  const singleToken = Array.isArray(reviewTokens) && reviewTokens.length === 1 ? reviewTokens[0]?.review_token : null;
  const reviewUrl = singleToken
    ? `https://merry360x.com/review/${singleToken}`
    : `https://merry360x.com/my-bookings`;

  const itemsHtml = isMultiItem
    ? `<div style="margin-bottom:12px;">${items
        .map((item) => {
          const itemPrice = formatMoney(item.calculated_price || item.price, item.calculated_price_currency || item.currency || "USD");
          const itemTitle = item.title || item.name || "Item";
          return `<p style="margin:0 0 6px;color:#374151;font-size:14px;">• ${escapeHtml(itemTitle)} — ${escapeHtml(itemPrice)}</p>`;
        })
        .join("")}</div>`
    : "";

  const stars = [1, 2, 3, 4, 5]
    .map((star) => `<a href="${reviewUrl}${reviewUrl.includes("?") ? "&" : "?"}rating=${star}" style="display:inline-block;text-decoration:none;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;margin-right:6px;color:#111827;font-size:13px;">${"★".repeat(star)}</a>`)
    .join("");

  const detailsRows = [
    { label: "Confirmation Code", value: `<span style="font-family:monospace;font-weight:700;">${escapeHtml(receiptNumber)}</span>` },
    { label: "Guest", value: escapeHtml(guestName) },
    { label: "Listing Name", value: `<strong>${escapeHtml(listingName)}</strong>` },
    { label: "Booking Date", value: escapeHtml(bookingDateFormatted) },
  ];

  if (checkInFormatted) {
    detailsRows.push({ label: "Check-in / Start", value: escapeHtml(checkInFormatted) });
  }

  if (checkOutFormatted) {
    detailsRows.push({ label: "Check-out / End", value: escapeHtml(checkOutFormatted) });
  }

  detailsRows.push({ label: "Amount Paid", value: `<strong>${escapeHtml(totalAmount)}</strong>` });
  detailsRows.push({ label: "Status", value: `<span style="display:inline-block;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px;font-weight:600;font-size:12px;">Confirmed</span>` });

  if (isMultiItem) {
    detailsRows.push({ label: "Bookings", value: escapeHtml(String(Array.isArray(bookingIds) ? bookingIds.length : items.length)) });
  }

  const details = keyValueRows(detailsRows);

  return renderMinimalEmail({
    eyebrow: "Booking Confirmation",
    title: "Booking confirmed",
    subtitle: "Your payment was successful and your booking is complete.",
    bodyHtml: `${itemsHtml}${details}<div style="margin-top:14px;"><p style="margin:0 0 8px;color:#6b7280;font-size:12px;">Rate your experience:</p>${stars}</div>`,
    ctaText: "View My Bookings",
    ctaUrl: "https://merry360x.com/my-bookings",
  });
}

function generateReceiptPDF(checkout, items, bookingIds) {
  const guestName = checkout.name || checkout.metadata?.guest_info?.name || "Guest";
  const guestEmail = checkout.email || "";
  const guestPhone = checkout.phone || checkout.phone_number || "";
  const totalAmount = formatMoney(checkout.total_amount, checkout.currency);
  const bookingDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const receiptNumber = `MRY-${Date.now().toString(36).toUpperCase()}`;
  const bookingDetails = checkout.metadata?.booking_details || {};

  const receiptHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; padding: 40px; max-width: 600px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 24px; margin-bottom: 24px; }
    .logo { font-size: 28px; font-weight: bold; color: #dc2626; }
    .receipt-title { font-size: 12px; color: #6b7280; margin-top: 8px; text-transform: uppercase; letter-spacing: 2px; }
    .receipt-number { font-size: 16px; font-weight: 600; margin-top: 4px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .row:last-child { border-bottom: none; }
    .label { color: #6b7280; }
    .value { font-weight: 500; text-align: right; }
    .total-row { background: #f9fafb; padding: 12px; border-radius: 8px; margin-top: 16px; }
    .total-label { font-size: 14px; color: #1f2937; }
    .total-value { font-size: 20px; font-weight: 700; color: #dc2626; }
    .paid-badge { background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; display: inline-block; }
    .footer { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
    .footer p { font-size: 11px; color: #9ca3af; margin: 4px 0; }
    .order-ref { font-family: monospace; font-size: 10px; color: #9ca3af; word-break: break-all; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Merry360X</div>
    <div class="receipt-title">Payment Receipt</div>
    <div class="receipt-number">${receiptNumber}</div>
  </div>
  
  <div class="section">
    <div class="section-title">Customer Details</div>
    <div class="row"><span class="label">Name</span><span class="value">${guestName}</span></div>
    <div class="row"><span class="label">Email</span><span class="value">${guestEmail}</span></div>
    ${guestPhone ? `<div class="row"><span class="label">Phone</span><span class="value">${guestPhone}</span></div>` : ''}
  </div>
  
  <div class="section">
    <div class="section-title">Payment Details</div>
    <div class="row"><span class="label">Date</span><span class="value">${bookingDate}</span></div>
    <div class="row"><span class="label">Method</span><span class="value">Mobile Money</span></div>
    <div class="row"><span class="label">Status</span><span class="value"><span class="paid-badge">PAID</span></span></div>
  </div>
  
  ${items.length > 1 ? `
  <div class="section">
    <div class="section-title">Booking Items</div>
    ${items.map((item) => {
      const itemName = item.title || item.name || "Item";
      const itemPrice = formatMoney(item.calculated_price || item.price, item.calculated_price_currency || item.currency || 'USD');
      const itemIcon = item.metadata?.type === 'tour' ? '🗺️' : item.metadata?.type === 'transport' ? '🚗' : '🏠';
      return `<div class="row"><span class="label">${itemIcon} ${itemName}</span><span class="value">${itemPrice}</span></div>`;
    }).join('')}
  </div>
  ` : ''}
  
  ${checkout.base_price_amount || checkout.service_fee_amount ? `
  <div class="section">
    <div class="section-title">Price Breakdown</div>
    ${checkout.base_price_amount ? `<div class="row"><span class="label">Subtotal</span><span class="value">${formatMoney(checkout.base_price_amount, checkout.currency)}</span></div>` : ''}
    ${checkout.service_fee_amount ? `<div class="row"><span class="label">Service Fee</span><span class="value">+${formatMoney(checkout.service_fee_amount, checkout.currency)}</span></div>` : ''}
    ${checkout.host_earnings_amount ? `<div class="row"><span class="label">Host Receives</span><span class="value" style="color: #059669;">${formatMoney(checkout.host_earnings_amount, checkout.currency)}</span></div>` : ''}
  </div>
  ` : ''}
  
  <div class="total-row">
    <div class="row" style="border: none;">
      <span class="total-label">Total Amount</span>
      <span class="total-value">${totalAmount}</span>
    </div>
  </div>
  
  <div class="footer">
    <p>Thank you for booking with Merry360X</p>
    <p>support@merry360x.com | merry360x.com</p>
    <div class="order-ref">Order: ${checkout.id}</div>
  </div>
</body>
</html>
  `;

  return Buffer.from(receiptHtml).toString('base64');
}

async function sendConfirmationEmail(checkout, items, bookingIds, reviewTokens, supabase = null) {
  if (!BREVO_API_KEY) {
    console.log("⚠️ Brevo API key not configured, skipping email");
    return false;
  }

  if (checkout?.metadata?.confirmation_email_sent) {
    console.log(`ℹ️ Confirmation email already sent for checkout ${checkout.id}, skipping duplicate send.`);
    return true;
  }

  const targetEmail = checkout.email || checkout.metadata?.guest_info?.email;
  const guestEmailValidation = validateRecipientEmail(targetEmail);
  if (!guestEmailValidation.ok) {
    console.log("⚠️ Skipping guest confirmation email: invalid recipient", { reason: guestEmailValidation.reason });
    return false;
  }

  const html = generateConfirmationEmail(checkout, items, bookingIds, reviewTokens);
  const receiptBase64 = generateReceiptPDF(checkout, items, bookingIds);
  const guestName = checkout.name || checkout.metadata?.guest_info?.name || "Guest";
  const receiptNumber = `MRY-${Date.now().toString(36).toUpperCase()}`;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(
        buildBrevoSmtpPayload({
          senderName: "Merry360X",
          senderEmail: "support@merry360x.com",
          to: [
            {
              email: guestEmailValidation.email,
              name: guestName,
            },
          ],
          subject: `Booking Confirmed - ${receiptNumber}`,
          htmlContent: html,
          attachment: [
            {
              content: receiptBase64,
              name: `Receipt-${receiptNumber}.html`,
            },
          ],
          tags: ["booking", "payment-confirmation"],
        })
      ),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`📧 Confirmation email sent to ${guestEmailValidation.email}: ${result.messageId}`);
      if (supabase && checkout?.id) {
        try {
          const updatedMeta = {
            ...(checkout.metadata || {}),
            confirmation_email_sent: true,
            confirmation_email_sent_at: new Date().toISOString(),
          };
          await supabase
            .from("checkout_requests")
            .update({ metadata: updatedMeta })
            .eq("id", checkout.id);
        } catch (_) {}
      }
      return true;
    } else {
      console.error("❌ Brevo API error:", result);
      return false;
    }
  } catch (error) {
    console.error("❌ Failed to send confirmation email:", error.message);
    return false;
  }
}

async function sendHostNotification(supabase, booking, item) {
  if (!BREVO_API_KEY) {
    console.log("⚠️ Brevo API key not configured, skipping host notification");
    return false;
  }

  try {
    let hostEmail = null;
    let hostName = null;
    let hostId = null;
    let itemTitle = item.title || item.name || "Your Service";
    let itemType = "service";

    if (item.item_type === 'property') {
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select('title, host_id')
        .eq('id', item.reference_id)
        .single();
      
      if (propError) {
        console.error("❌ Error fetching property:", propError);
        return false;
      }
      
      if (property) {
        itemTitle = property.title;
        itemType = "property";
        hostId = property.host_id;
      }
    } else if (item.item_type === 'tour' || item.item_type === 'tour_package') {
      const table = item.item_type === 'tour' ? 'tours' : 'tour_packages';
      const hostField = item.item_type === 'tour' ? 'created_by' : 'host_id';
      
      const { data: tour, error: tourError } = await supabase
        .from(table)
        .select(`title, ${hostField}`)
        .eq('id', item.reference_id)
        .single();
      
      if (tourError) {
        console.error(`❌ Error fetching ${table}:`, tourError);
        return false;
      }
      
      if (tour) {
        itemTitle = tour.title;
        itemType = "tour";
        hostId = tour[hostField];
      }
    } else if (item.item_type === 'transport_vehicle') {
      const { data: vehicle, error: vehError } = await supabase
        .from('transport_vehicles')
        .select('title, owner_id')
        .eq('id', item.reference_id)
        .single();
      
      if (vehError) {
        console.error("❌ Error fetching vehicle:", vehError);
        return false;
      }
      
      if (vehicle) {
        itemTitle = vehicle.title;
        itemType = "transport";
        hostId = vehicle.owner_id;
      }
    }

    if (!hostId) {
      console.log("⚠️ No host ID found for item:", item.reference_id);
      return false;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', hostId)
      .single();
    
    if (profileError || !profile) {
      console.error("❌ Error fetching host profile:", profileError);
      return false;
    }
    
    hostEmail = profile.email;
    hostName = profile.full_name;

    const hostEmailValidation = validateRecipientEmail(hostEmail);
    if (!hostEmailValidation.ok) {
      console.log("⚠️ Skipping host notification email: invalid host recipient", { hostId, reason: hostEmailValidation.reason });
      return false;
    }

    hostEmail = hostEmailValidation.email;

    const guestName = booking.guest_name || "A guest";
    const guestEmail = booking.guest_email || "";
    const guestPhone = booking.guest_phone || "";
    const checkIn = formatDate(booking.check_in);
    const checkOut = formatDate(booking.check_out);
    const hostEarningsCurrency = item?.calculated_price_currency || item?.currency || booking.currency || "RWF";
    const hostReceivesAmount = formatMoney(
      computeHostReceivesAmount(item, booking),
      hostEarningsCurrency
    );
    const bookingRef = `MRY-${booking.id.slice(0, 8).toUpperCase()}`;

    const hostHtml = renderMinimalEmail({
      eyebrow: "New Booking",
      title: "You received a new booking",
      subtitle: `Hi ${hostName || "Host"}, a guest booked your ${itemType}.`,
      bodyHtml: keyValueRows([
        { label: "Item", value: escapeHtml(itemTitle) },
        { label: "Booking Ref", value: escapeHtml(bookingRef) },
        { label: "Guest", value: escapeHtml(guestName) },
        { label: "Guest Email", value: guestEmail ? `<a href="mailto:${escapeHtml(guestEmail)}" style="color:#111827;text-decoration:none;">${escapeHtml(guestEmail)}</a>` : "—" },
        { label: "Guest Phone", value: guestPhone ? `<a href="tel:${escapeHtml(guestPhone)}" style="color:#111827;text-decoration:none;">${escapeHtml(guestPhone)}</a>` : "—" },
        { label: "Check-in", value: escapeHtml(checkIn) },
        { label: "Check-out", value: escapeHtml(checkOut) },
        { label: "Guests", value: escapeHtml(`${booking.guests || 1}`) },
        { label: "Your Earnings", value: escapeHtml(hostReceivesAmount) },
      ]),
      ctaText: "Open Host Dashboard",
      ctaUrl: "https://merry360x.com/host-dashboard",
    });

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(
        buildBrevoSmtpPayload({
          senderName: "Merry360X",
          senderEmail: "support@merry360x.com",
          to: [
            {
              email: hostEmail,
              name: hostName || "Host",
            },
          ],
          subject: `New Booking: ${itemTitle} - ${bookingRef}`,
          htmlContent: hostHtml,
          tags: ["booking", "host-notification"],
        })
      ),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`📧 Host notification sent to ${hostEmail}: ${result.messageId}`);
      return true;
    } else {
      console.error("❌ Brevo API error for host notification:", result);
      return false;
    }
  } catch (error) {
    console.error("❌ Failed to send host notification:", error.message);
    return false;
  }
}

function buildPayoutResultEmailHtml({ status, amount, currency, method, reason }) {
  const statusLabel = status === "completed" ? "Completed" : "Rejected";
  const methodLabel = method === "mobile_money" ? "Mobile Money" : "Bank Transfer";
  const details = keyValueRows([
    { label: "Amount", value: escapeHtml(formatMoneyRwf(amount)) },
    { label: "Method", value: escapeHtml(methodLabel) },
    { label: "Status", value: escapeHtml(statusLabel) },
    { label: "Updated", value: escapeHtml(new Date().toLocaleString("en-US")) },
    { label: "Reason", value: escapeHtml(reason || "N/A") },
  ]);

  return renderMinimalEmail({
    eyebrow: "Payout Update",
    title: status === "completed" ? "Your payout is complete" : "Your payout could not be completed",
    subtitle:
      status === "completed"
        ? "Funds have been sent to your selected payout method."
        : "Your payout request was not completed. Please review details and request again if needed.",
    bodyHtml: details,
    ctaText: "Open Host Dashboard",
    ctaUrl: "https://merry360x.com/host-dashboard",
  });
}

async function sendHostPayoutStatusEmail({ toEmail, toName, status, amount, currency, method, reason }) {
  if (!BREVO_API_KEY) return { skipped: true, reason: "BREVO_API_KEY missing" };

  const recipient = validateRecipientEmail(toEmail);
  if (!recipient.ok) return { skipped: true, reason: "Invalid recipient" };

  const htmlContent = buildPayoutResultEmailHtml({ status, amount, currency, method, reason });
  const subject =
    status === "completed"
      ? `Payout Completed: ${formatMoneyRwf(amount)}`
      : `Payout Update: ${formatMoneyRwf(amount)}`;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify(
      buildBrevoSmtpPayload({
        senderName: "Merry360X",
        senderEmail: "support@merry360x.com",
        to: [{ email: recipient.email, name: toName || "Host" }],
        subject,
        htmlContent,
        tags: ["payout", "payout-status"],
      })
    ),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || `Brevo request failed (${response.status})`);
  }

  return { sent: true };
}

async function ensureHostAdjustmentForPostBookingCharge(supabase, charge) {
  if (!charge?.id || !charge?.booking_id) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, host_id")
    .eq("id", charge.booking_id)
    .maybeSingle();

  if (!booking?.host_id) return;

  const amount = Number(charge.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return;

  await supabase
    .from("host_earnings_adjustments")
    .upsert(
      {
        host_id: booking.host_id,
        amount,
        currency: safeStr(charge.currency || "USD", 12).toUpperCase(),
        reason: `Post-booking charge paid (${String(charge.id).slice(0, 8)})`,
        reference_key: `post_booking_charge_paid_${charge.id}`,
        created_by: null,
      },
      { onConflict: "reference_key", ignoreDuplicates: true },
    );
}

async function sendPostBookingGuestPaidEmail(supabase, charge, checkoutData) {
  if (!BREVO_API_KEY || !charge?.booking_id) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, guest_email, guest_name")
    .eq("id", charge.booking_id)
    .maybeSingle();

  const fallbackEmail = safeStr(checkoutData?.email || "", 160);
  const targetEmail = safeStr(booking?.guest_email || fallbackEmail, 160);
  const recipient = validateRecipientEmail(targetEmail);
  if (!recipient.ok) return;

  const guestName = safeStr(booking?.guest_name || checkoutData?.name || "Guest", 120) || "Guest";
  const amountLabel = formatMoney(charge.amount, charge.currency || "USD");
  const htmlContent = renderMinimalEmail({
    eyebrow: "Payment Receipt",
    title: "Post-booking payment received",
    subtitle: "Your additional mobile-money payment has been confirmed.",
    bodyHtml: keyValueRows([
      { label: "Amount Paid", value: escapeHtml(amountLabel) },
      { label: "Payment Method", value: "Mobile Money (PawaPay)" },
      { label: "Charge ID", value: escapeHtml(String(charge.id).slice(0, 12).toUpperCase()) },
      { label: "Booking ID", value: escapeHtml(String(charge.booking_id).slice(0, 12).toUpperCase()) },
      { label: "Status", value: "Paid" },
    ]),
      ctaText: "Open My Bookings",
      ctaUrl: "https://merry360x.com/my-bookings",
  });

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify(
      buildBrevoSmtpPayload({
        senderName: "Merry360X",
        senderEmail: "support@merry360x.com",
        to: [{ email: recipient.email, name: guestName }],
        subject: `Payment received - ${amountLabel}`,
        htmlContent,
        tags: ["post-booking", "payment-confirmation", "pawapay"],
      })
    ),
  }).catch(() => null);
}

async function sendPostBookingHostPaidEmail(supabase, charge, checkoutData) {
  if (!BREVO_API_KEY || !charge?.booking_id) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, host_id, guest_name")
    .eq("id", charge.booking_id)
    .maybeSingle();

  if (!booking?.host_id) return;

  let hostProfile = null;
  const { data: byUserId } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("user_id", booking.host_id)
    .maybeSingle();
  hostProfile = byUserId || null;

  if (!hostProfile?.email) {
    const { data: byId } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", booking.host_id)
      .maybeSingle();
    hostProfile = byId || hostProfile;
  }

  const targetEmail = safeStr(hostProfile?.email || "", 160);
  const recipient = validateRecipientEmail(targetEmail);
  if (!recipient.ok) return;

  const amountLabel = formatMoney(charge.amount, charge.currency || "USD");
  const htmlContent = renderMinimalEmail({
    eyebrow: "Payment Notice",
    title: "Post-booking charge paid",
    subtitle: "A guest completed a post-booking payment for your booking.",
    bodyHtml: keyValueRows([
      { label: "Amount Paid", value: escapeHtml(amountLabel) },
      { label: "Payment Method", value: "Mobile Money (PawaPay)" },
      { label: "Charge ID", value: escapeHtml(String(charge.id).slice(0, 12).toUpperCase()) },
      { label: "Booking ID", value: escapeHtml(String(charge.booking_id).slice(0, 12).toUpperCase()) },
      { label: "Guest", value: escapeHtml(safeStr(booking.guest_name || "Guest", 120) || "Guest") },
    ]),
    ctaText: "Open Host Dashboard",
    ctaUrl: "https://merry360x.com/host-dashboard",
  });

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify(
      buildBrevoSmtpPayload({
        senderName: "Merry360X",
        senderEmail: "support@merry360x.com",
        to: [{ email: recipient.email, name: safeStr(hostProfile?.full_name || "Host", 120) || "Host" }],
        subject: `Post-booking payment received - ${amountLabel}`,
        htmlContent,
        tags: ["post-booking", "host-notice", "payment-confirmation", "pawapay"],
      })
    ),
  }).catch(() => null);
}

async function sendPostBookingAdminPaidEmail(supabase, charge) {
  if (!BREVO_API_KEY || !charge?.booking_id) return;

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "financial_staff", "operations_staff", "customer_support"]);

  const adminIds = Array.from(new Set((roleRows || []).map((row) => String(row.user_id || "")).filter(Boolean)));
  if (!adminIds.length) return;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, email, full_name")
    .in("user_id", adminIds);

  const amountLabel = formatMoney(charge.amount, charge.currency || "USD");
  const htmlContent = renderMinimalEmail({
    eyebrow: "Post-booking Alert",
    title: "Post-booking payment completed",
    subtitle: "A post-booking charge was paid successfully.",
    bodyHtml: keyValueRows([
      { label: "Amount Paid", value: escapeHtml(amountLabel) },
      { label: "Payment Method", value: "Mobile Money (PawaPay)" },
      { label: "Charge ID", value: escapeHtml(String(charge.id).slice(0, 12).toUpperCase()) },
      { label: "Booking ID", value: escapeHtml(String(charge.booking_id).slice(0, 12).toUpperCase()) },
      { label: "Status", value: "Paid" },
    ]),
    ctaText: "Open Post-Booking Console",
    ctaUrl: "https://merry360x.com/admin/post-booking",
  });

  for (const admin of profiles || []) {
    const targetEmail = safeStr(admin?.email || "", 160);
    const recipient = validateRecipientEmail(targetEmail);
    if (!recipient.ok) continue;

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify(
        buildBrevoSmtpPayload({
          senderName: "Merry360X",
          senderEmail: "support@merry360x.com",
          to: [{ email: recipient.email, name: safeStr(admin?.full_name || "Admin", 120) || "Admin" }],
          subject: `Post-booking payment completed - ${amountLabel}`,
          htmlContent,
          tags: ["post-booking", "admin-notice", "payment-confirmation", "pawapay"],
        })
      ),
    }).catch(() => null);
  }
}

async function syncPostBookingChargeFromCheckout(supabase, checkoutData, paymentStatus) {
  const chargeId = checkoutData?.metadata?.post_booking_charge_id;
  if (!chargeId) return { handled: false };

  const nowIso = new Date().toISOString();

  const { data: charge } = await supabase
    .from("charges")
    .select("id, user_id, booking_id, status, amount, currency")
    .eq("id", chargeId)
    .maybeSingle();

  if (!charge) return { handled: true, updated: false, reason: "charge_not_found" };

  const wasAlreadyPaid = String(charge.status || "").toLowerCase() === "paid";

  if (paymentStatus === "paid") {
    await supabase
      .from("charges")
      .update({
        status: "paid",
        payment_method: "mobile_money",
        payment_provider: "pawapay",
        payment_reference: checkoutData.id,
        paid_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", charge.id);

    const { data: mods } = await supabase
      .from("booking_modifications")
      .select("*")
      .eq("charge_id", charge.id)
      .eq("status", "accepted")
      .limit(1);

    const linkedModification = Array.isArray(mods) && mods.length ? mods[0] : null;

    if (linkedModification) {
      await supabase
        .from("bookings")
        .update({
          check_in: linkedModification.new_check_in || linkedModification.old_check_in,
          check_out: linkedModification.new_check_out || linkedModification.old_check_out,
          total_price: linkedModification.new_price,
          ...(linkedModification.new_property_id ? { property_id: linkedModification.new_property_id } : {}),
        })
        .eq("id", linkedModification.booking_id);

      await supabase
        .from("booking_modifications")
        .update({ payment_status: "paid", updated_at: nowIso })
        .eq("id", linkedModification.id);
    }

    if (!wasAlreadyPaid) {
      try {
        await supabase.from("notifications").insert({
          user_id: charge.user_id,
          title: "Payment successful",
          body: "Your post-booking mobile money payment was successful.",
          notification_type: "payment_success",
          channel: "in_app",
          data: {
            charge_id: charge.id,
            booking_id: charge.booking_id,
            checkout_id: checkoutData.id,
          },
        });
      } catch (_) {
        // Notification is best effort.
      }

      try {
        await ensureHostAdjustmentForPostBookingCharge(supabase, charge);
      } catch (_) {
        // Host adjustment is best effort.
      }

      try {
        await sendPostBookingGuestPaidEmail(supabase, charge, checkoutData);
      } catch (_) {
        // Guest email is best effort.
      }

      try {
        await sendPostBookingHostPaidEmail(supabase, charge, checkoutData);
      } catch (_) {
        // Host email is best effort.
      }

      try {
        await sendPostBookingAdminPaidEmail(supabase, charge);
      } catch (_) {
        // Admin email is best effort.
      }
    }

    return { handled: true, updated: !wasAlreadyPaid, chargeId: charge.id, bookingModificationId: linkedModification?.id || null };
  }

  if (paymentStatus === "failed") {
    await supabase
      .from("charges")
      .update({
        status: "failed",
        payment_method: "mobile_money",
        payment_provider: "pawapay",
        payment_reference: checkoutData.id,
        failed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", charge.id);

    try {
      await supabase.from("notifications").insert({
        user_id: charge.user_id,
        title: "Payment failed",
        body: "Your post-booking mobile money payment failed. Please retry.",
        notification_type: "payment_failed",
        channel: "in_app",
        data: {
          charge_id: charge.id,
          booking_id: charge.booking_id,
          checkout_id: checkoutData.id,
        },
      });
    } catch (_) {
      // Notification is best effort.
    }
  }

  return { handled: true, updated: false };
}

async function fetchPawaPayPayout(pawapayPayoutId) {
  const url = `${PAWAPAY_BASE_URL}/payouts/${pawapayPayoutId}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${PAWAPAY_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { message: text };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: parsed?.errorMessage || parsed?.message || `PawaPay request failed (${response.status})`,
      payload: parsed,
    };
  }

  return {
    ok: true,
    payload: parsePawaPayResponse(parsed),
  };
}

async function syncPayoutStatuses(req, res, supabase) {
  const syncAll = String(req.query.syncAll || "").toLowerCase() === "1" || String(req.query.syncAll || "").toLowerCase() === "true";
  const limit = Number(req.query.limit || 25);
  const payoutId = req.query.payoutId || null;

  let payoutsToCheck = [];

  if (syncAll) {
    const { data, error } = await supabase
      .from("host_payouts")
      .select("id, host_id, amount, currency, payout_method, status, pawapay_payout_id")
      .eq("status", "processing")
      .not("pawapay_payout_id", "is", null)
      .order("updated_at", { ascending: true })
      .limit(Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 25);

    if (error) throw error;
    payoutsToCheck = data || [];
  } else if (payoutId) {
    const { data, error } = await supabase
      .from("host_payouts")
      .select("id, host_id, amount, currency, payout_method, status, pawapay_payout_id")
      .eq("id", payoutId)
      .single();

    if (error) throw error;
    payoutsToCheck = data ? [data] : [];
  } else {
    return json(res, 400, { error: "Provide payoutId or syncAll=1" });
  }

  const results = [];
  let updatedCount = 0;

  for (const payout of payoutsToCheck) {
    if (!payout?.pawapay_payout_id) {
      results.push({ id: payout?.id, updated: false, reason: "Missing pawapay_payout_id" });
      continue;
    }

    const providerResult = await fetchPawaPayPayout(payout.pawapay_payout_id);
    if (!providerResult.ok) {
      results.push({
        id: payout.id,
        updated: false,
        status: payout.status,
        pawapayPayoutId: payout.pawapay_payout_id,
        error: providerResult.error,
      });
      continue;
    }

    const providerPayload = providerResult.payload || {};
    const pawapayStatus = String(providerPayload.status || "").toUpperCase();
    const nextStatus = mapPawaPayPayoutStatus(pawapayStatus);
    const shouldUpdate = payout.status !== nextStatus;

    if (shouldUpdate) {
      const { error: updateError } = await supabase
        .from("host_payouts")
        .update({
          status: nextStatus,
          admin_notes:
            nextStatus === "rejected"
              ? `PawaPay Status: ${pawapayStatus}. ${buildPayoutErrorMessage(providerPayload)}`
              : pawapayStatus === "ENQUEUED"
                ? "PawaPay Status: ENQUEUED. Payout is queued and will complete once provider resumes."
                : `PawaPay Status: ${pawapayStatus || "UNKNOWN"}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payout.id);

      if (updateError) {
        results.push({
          id: payout.id,
          updated: false,
          status: payout.status,
          pawapayStatus,
          error: updateError.message,
        });
        continue;
      }

      updatedCount += 1;

      if (payout.status === "processing" && (nextStatus === "completed" || nextStatus === "rejected")) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("user_id", payout.host_id)
            .single();

          const reason = nextStatus === "rejected" ? buildPayoutErrorMessage(providerPayload) : null;
          await sendHostPayoutStatusEmail({
            toEmail: profile?.email,
            toName: profile?.full_name,
            status: nextStatus,
            amount: payout.amount,
            currency: payout.currency,
            method: payout.payout_method,
            reason,
          });
        } catch (emailError) {
          console.warn("Host payout status email failed", {
            payoutId: payout.id,
            error: emailError?.message || String(emailError),
          });
        }
      }
    }

    results.push({
      id: payout.id,
      updated: shouldUpdate,
      previousStatus: payout.status,
      status: nextStatus,
      pawapayStatus,
    });
  }

  return json(res, 200, {
    success: true,
    checkedCount: payoutsToCheck.length,
    updatedCount,
    results,
  });
}

/**
 * Vercel serverless function to check payment status from PawaPay
 * This provides an alternative to callbacks - directly querying PawaPay
 * 
 * GET /api/pawapay-check-status?depositId=xxx&checkoutId=xxx
 */
export default async function handler(req, res) {
  // Support both GET (web) and POST (mobile) requests
  const params = req.method === "POST" ? (req.body || {}) : req.query;

  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const { action, depositId, checkoutId, bookingId } = params;
  let orderId = checkoutId || bookingId;

  if (!PAWAPAY_API_KEY) {
    console.error("Missing PawaPay API token");
    return json(res, 500, { error: "Server configuration error" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 500, { error: "Supabase configuration missing" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (action === "sync-payouts") {
    return syncPayoutStatuses(req, res, supabase);
  }

  // If depositId is not provided but we have an orderId, try to look it up from the DB
  if (!depositId && orderId) {
    try {
      const { data: checkout } = await supabase
        .from("checkout_requests")
        .select("dpo_transaction_id")
        .eq("id", orderId)
        .maybeSingle();
      if (checkout?.dpo_transaction_id) {
        depositId = checkout.dpo_transaction_id;
        console.log(`Resolved depositId ${depositId} from checkout ${orderId}`);
      }
    } catch (lookupErr) {
      console.warn("Failed to look up depositId from checkout:", lookupErr);
    }
  }

  if (!depositId) {
    return json(res, 400, { error: "Missing depositId parameter" });
  }

  try {
    // Query PawaPay for payment status
    const pawapayUrl = `${PAWAPAY_BASE_URL}/deposits/${depositId}`;
    
    console.log(`Checking payment status at: ${pawapayUrl}`);
    
    const response = await fetch(pawapayUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${PAWAPAY_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const responseText = await response.text();
    console.log("PawaPay status response:", responseText);

    let pawaPayData;
    try {
      pawaPayData = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse PawaPay response:", e);
      return json(res, 500, { 
        error: "Payment provider error", 
        details: responseText.substring(0, 200)
      });
    }

    if (!response.ok) {
      console.error("PawaPay API error:", pawaPayData);
      return json(res, response.status, { 
        error: pawaPayData.errorMessage || "Failed to check payment status",
        code: pawaPayData.errorCode
      });
    }

    // Get the payment status from PawaPay
    // PawaPay returns an array for deposits endpoint
    const depositData = Array.isArray(pawaPayData) ? pawaPayData[0] : pawaPayData;
    const pawapayStatus = depositData?.status;
    const failureReason = depositData?.failureReason;

    console.log(`📊 PawaPay raw response for ${depositId}:`, JSON.stringify(depositData, null, 2));
    console.log(`📊 Extracted status: ${pawapayStatus}, failureReason:`, failureReason || 'none');

    // Extract human-readable failure message
    let failureMessage = null;
    if (failureReason) {
      const code = failureReason.failureCode || failureReason.code;
      const message = failureReason.failureMessage || failureReason.errorMessage;
      
      console.log(`Failure detected - Code: ${code}, Message: ${message}`);
      
      // Map common failure codes to user-friendly messages
      if (code === 'INSUFFICIENT_BALANCE' || code === 'PAYER_LIMIT_REACHED' || code === 'INSUFFICIENT_FUNDS') {
        failureMessage = 'Insufficient balance. Please recharge your mobile money account and try again.';
      } else if (code === 'PAYER_NOT_FOUND' || code === 'INVALID_PAYER') {
        failureMessage = 'Mobile money account not found. Please check your phone number.';
      } else if (code === 'TRANSACTION_DECLINED' || code === 'USER_DECLINED' || code === 'DECLINED') {
        failureMessage = 'Payment was declined. Please try again or use a different payment method.';
      } else if (code === 'TIMEOUT' || code === 'EXPIRED') {
        failureMessage = 'Payment request expired. Please try again.';
      } else if (code === 'DUPLICATE_TRANSACTION') {
        failureMessage = 'Duplicate transaction detected. Please wait or contact support.';
      } else if (code === 'CANCELLED' || code === 'USER_CANCELLED') {
        failureMessage = 'Payment was cancelled. Please try again if you wish to complete the booking.';
      } else if (message) {
        failureMessage = message;
      } else {
        failureMessage = 'Payment could not be completed. Please try again or use a different payment method.';
      }
    }
    
    // Also check if status itself indicates failure
    if (!failureMessage) {
      if (pawapayStatus === 'FAILED' || pawapayStatus === 'REJECTED') {
        failureMessage = 'Payment could not be completed. Please try again or use a different payment method.';
      } else if (pawapayStatus === 'CANCELLED') {
        failureMessage = 'Payment was cancelled. Please try again if you wish to complete the booking.';
      }
    }

    // If we have an order ID and Supabase credentials, update the checkout
    if (orderId) {

      // Map PawaPay status to our system
      let paymentStatus = "pending";

      if (pawapayStatus === "COMPLETED") {
        paymentStatus = "paid";
      } else if (pawapayStatus === "FAILED" || pawapayStatus === "REJECTED" || pawapayStatus === "CANCELLED") {
        paymentStatus = "failed";
      } else if (pawapayStatus === "SUBMITTED" || pawapayStatus === "ACCEPTED") {
        paymentStatus = "pending";
      }

      // Fetch full checkout to get items for booking creation
      const { data: checkoutData, error: checkoutFetchError } = await supabase
        .from("checkout_requests")
        .select("id, user_id, email, phone, payment_status, metadata, currency")
        .eq("id", orderId)
        .single();

      // Update the checkout request
      const { error: updateError } = await supabase
        .from("checkout_requests")
        .update({
          payment_status: paymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (updateError) {
        console.error("Failed to update checkout:", updateError);
      } else {
        console.log(`Checkout ${orderId} updated: payment=${paymentStatus}`);
      }

      if (checkoutData) {
        try {
          await syncPostBookingChargeFromCheckout(supabase, checkoutData, paymentStatus);
        } catch (syncErr) {
          console.warn("Post-booking charge sync failed", {
            checkoutId: checkoutData.id,
            error: syncErr?.message || String(syncErr),
          });
        }
      }

      // Create bookings if payment completed and not already created
      if (paymentStatus === "paid" && checkoutData && checkoutData.payment_status !== "paid") {
        await upsertSavedMobileMoneyMethod({
          supabase,
          checkoutData,
          providerHint: checkoutData?.metadata?.payment_provider || depositData?.correspondent || null,
          phoneNumberHint: depositData?.payer?.address?.value || checkoutData?.phone || null,
          depositId,
          correspondent: depositData?.correspondent || null,
          source: "pawapay_status_check",
        });

        console.log("📦 Creating bookings from checkout items (via status check)...");
        const items = checkoutData.metadata?.items || [];
        const bookingDetails = checkoutData.metadata?.booking_details;
        const createdBookingIds = [];
        
        for (const item of items) {
          try {
            // Check if booking already exists
            const { data: existingBooking } = await supabase
              .from("bookings")
              .select("id")
              .eq("order_id", orderId)
              .eq(item.item_type === 'property' ? "property_id" : item.item_type === 'transport_vehicle' ? "transport_id" : "tour_id", item.reference_id)
              .limit(1);

            if (existingBooking && existingBooking.length > 0) {
              console.log(`⏭️ Booking already exists for item ${item.reference_id}`);
              createdBookingIds.push(existingBooking[0].id);
              continue;
            }

            const bookingData = {
              guest_id: checkoutData.user_id,
              guest_name: checkoutData.metadata?.guest_info?.name || checkoutData.name || null,
              guest_email: checkoutData.email || checkoutData.metadata?.guest_info?.email || null,
              guest_phone: checkoutData.metadata?.guest_info?.phone || checkoutData.phone || null,
              order_id: checkoutData.id,
              total_price: item.calculated_price || item.price,
              currency: item.calculated_price_currency || item.currency || checkoutData.currency || 'USD',
              payment_status: 'paid',
              payment_method: 'mobile_money',
              referral_code: checkoutData.referral_code || checkoutData.metadata?.referral_code || null,
              guests: bookingDetails?.guests || item.metadata?.guests || 1,
              review_token: crypto.randomUUID(),
            };

            // Set booking_type and instant/pending confirmation status
            if (item.item_type === 'property') {
              bookingData.booking_type = 'property';
              bookingData.property_id = item.reference_id;
              bookingData.check_in = bookingDetails?.check_in || item.metadata?.check_in;
              bookingData.check_out = bookingDetails?.check_out || item.metadata?.check_out;
              bookingData.status = 'confirmed';
              bookingData.confirmation_status = null;
            } else if (item.item_type === 'tour' || item.item_type === 'tour_package') {
              bookingData.booking_type = 'tour';
              bookingData.tour_id = item.reference_id;
              bookingData.check_in = bookingDetails?.check_in || item.metadata?.check_in || new Date().toISOString().split('T')[0];
              bookingData.check_out = bookingDetails?.check_out || item.metadata?.check_out || new Date().toISOString().split('T')[0];
              const tourTable = item.item_type === 'tour' ? 'tours' : 'tour_packages';
              const { data: listing } = await supabase.from(tourTable).select('requires_confirmation').eq('id', item.reference_id).single();
              if (listing?.requires_confirmation === true) {
                bookingData.status = 'pending';
                bookingData.confirmation_status = 'pending';
              } else {
                bookingData.status = 'confirmed';
                bookingData.confirmation_status = null;
              }
            } else if (item.item_type === 'transport_vehicle') {
              bookingData.booking_type = 'transport';
              bookingData.transport_id = item.reference_id;
              bookingData.check_in = bookingDetails?.check_in || item.metadata?.check_in || new Date().toISOString().split('T')[0];
              bookingData.check_out = bookingDetails?.check_out || item.metadata?.check_out || new Date().toISOString().split('T')[0];
              bookingData.status = 'confirmed';
              bookingData.confirmation_status = null;
            }

            const { data: booking, error: bookingError } = await supabase
              .from("bookings")
              .insert(bookingData)
              .select("id")
              .single();

            if (bookingError) {
              console.error("❌ Failed to create booking:", bookingError);
            } else {
              console.log(`✅ Booking created: ${booking.id}`);
              createdBookingIds.push(booking.id);
            }
          } catch (bookingErr) {
            console.error("❌ Booking creation error:", bookingErr);
          }
        }

        // Send confirmation email and host notification
        const guestEmail = checkoutData.email || checkoutData.metadata?.guest_info?.email;
        if (guestEmail && paymentStatus === "paid") {
          console.log(`📧 Sending confirmation email to ${guestEmail} via status check...`);
          let reviewTokens = [];
          if (createdBookingIds.length > 0) {
            const { data: tokenData } = await supabase
              .from("bookings")
              .select("id, review_token")
              .in("id", createdBookingIds);
            reviewTokens = tokenData || [];
          }

          await sendConfirmationEmail(checkoutData, items, createdBookingIds, reviewTokens, supabase);

          // Send host notifications for each booking created
          if (createdBookingIds.length > 0 && items.length > 0) {
            console.log(`📧 Sending host notifications for ${createdBookingIds.length} bookings via status check...`);
            for (let i = 0; i < createdBookingIds.length; i++) {
              const bookingId = createdBookingIds[i];
              const item = items[i];
              if (bookingId && item) {
                const { data: booking, error: bookingError } = await supabase
                  .from("bookings")
                  .select("*")
                  .eq("id", bookingId)
                  .single();

                if (booking && !bookingError) {
                  await sendHostNotification(supabase, booking, item);
                }
              }
            }
          }
        }
      }

      return json(res, 200, {
        success: true,
        depositId,
        pawapayStatus,
        paymentStatus,
        failureMessage,
        depositData
      });
    }

    // Just return the PawaPay status if no booking update needed
    return json(res, 200, {
      success: true,
      depositId,
      pawapayStatus,
      depositData
    });

  } catch (error) {
    console.error("Status check error:", error);
    return json(res, 500, {
      error: "Status check failed",
      message: error.message
    });
  }
}
