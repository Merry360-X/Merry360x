import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PESAPAL_CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY;
const PESAPAL_CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
const PESAPAL_BASE_URL = process.env.PESAPAL_BASE_URL || "https://pay.pesapal.com/v3";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function safeStr(value, max = 200) {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > max ? s.slice(0, max) : s;
}

async function getPesapalToken() {
  const authRes = await fetch(`${PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      consumer_key: PESAPAL_CONSUMER_KEY,
      consumer_secret: PESAPAL_CONSUMER_SECRET,
    }),
  });

  const authData = await authRes.json().catch(() => ({}));
  if (!authRes.ok || !authData?.token) {
    const message = authData?.message || "Unable to authenticate with Pesapal";
    const err = new Error(message);
    err.providerResponse = authData;
    throw err;
  }

  return authData.token;
}

function mapPesapalStatus(statusDescription) {
  const normalized = String(statusDescription || "").toUpperCase();
  if (normalized === "COMPLETED") return "paid";
  if (normalized === "FAILED" || normalized === "INVALID" || normalized === "REVERSED") return "failed";
  return "pending";
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function createBookingsForPaidCheckout(supabase, checkoutData) {
  const items = checkoutData?.metadata?.items || [];
  const bookingDetails = checkoutData?.metadata?.booking_details;

  for (const item of items) {
    try {
      const relationField =
        item.item_type === "property"
          ? "property_id"
          : item.item_type === "transport_vehicle"
            ? "transport_id"
            : "tour_id";

      const { data: existingBooking } = await supabase
        .from("bookings")
        .select("id")
        .eq("order_id", checkoutData.id)
        .eq(relationField, item.reference_id)
        .limit(1);

      if (existingBooking && existingBooking.length > 0) continue;

      const bookingData = {
        guest_id: checkoutData.user_id,
        guest_name: checkoutData.metadata?.guest_info?.name || checkoutData.name || null,
        guest_email: checkoutData.email || checkoutData.metadata?.guest_info?.email || null,
        guest_phone: checkoutData.metadata?.guest_info?.phone || checkoutData.phone || null,
        order_id: checkoutData.id,
        total_price: item.calculated_price || item.price,
        currency: item.calculated_price_currency || item.currency || checkoutData.currency || "RWF",
        status: "pending",
        confirmation_status: "pending",
        payment_status: "paid",
        payment_method: "pesapal",
        guests: bookingDetails?.guests || item.metadata?.guests || 1,
        review_token: crypto.randomUUID(),
      };

      if (item.item_type === "property") {
        bookingData.booking_type = "property";
        bookingData.property_id = item.reference_id;
        bookingData.check_in = bookingDetails?.check_in || item.metadata?.check_in;
        bookingData.check_out = bookingDetails?.check_out || item.metadata?.check_out;
      } else if (item.item_type === "tour" || item.item_type === "tour_package") {
        bookingData.booking_type = "tour";
        bookingData.tour_id = item.reference_id;
        bookingData.check_in =
          bookingDetails?.check_in ||
          item.metadata?.check_in ||
          new Date().toISOString().split("T")[0];
        bookingData.check_out =
          bookingDetails?.check_out ||
          item.metadata?.check_out ||
          new Date().toISOString().split("T")[0];
      } else if (item.item_type === "transport_vehicle") {
        bookingData.booking_type = "transport";
        bookingData.transport_id = item.reference_id;
        bookingData.check_in =
          bookingDetails?.check_in ||
          item.metadata?.check_in ||
          new Date().toISOString().split("T")[0];
        bookingData.check_out =
          bookingDetails?.check_out ||
          item.metadata?.check_out ||
          new Date().toISOString().split("T")[0];
      } else {
        continue;
      }

      await supabase.from("bookings").insert(bookingData);
    } catch (error) {
      console.error("Pesapal status booking create error", error);
    }
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 500, { error: "Server configuration error" });
  }

  if (!PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET) {
    return json(res, 500, { error: "Pesapal is not configured" });
  }

  try {
    const { checkoutId, orderTrackingId } = req.body || {};

    if (!checkoutId && !orderTrackingId) {
      return json(res, 400, { error: "checkoutId or orderTrackingId is required" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let checkoutData = null;
    let trackingId = safeStr(orderTrackingId, 80);

    if (checkoutId) {
      const { data } = await supabase
        .from("checkout_requests")
        .select("id, user_id, name, email, phone, total_amount, currency, payment_status, metadata")
        .eq("id", checkoutId)
        .single();

      checkoutData = data || null;
      trackingId = trackingId || safeStr(data?.metadata?.pesapal?.order_tracking_id, 80);
    }

    if (!trackingId) {
      return json(res, 400, { error: "Missing orderTrackingId" });
    }

    const token = await getPesapalToken();

    const statusRes = await fetch(
      `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(trackingId)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const statusData = await statusRes.json().catch(() => ({}));
    if (!statusRes.ok) {
      console.error("Pesapal status error:", statusData);
      return json(res, 502, { error: "Unable to fetch transaction status", providerResponse: statusData });
    }

    const mappedStatus = mapPesapalStatus(statusData?.payment_status_description);

    // If we have a checkout, update it (and create bookings if it just became paid)
    if (checkoutData) {
      const expectedAmount = toNumber(checkoutData.total_amount);
      const txAmount = toNumber(statusData.amount);
      const expectedCurrency = String(checkoutData.currency || "RWF").toUpperCase();
      const txCurrency = String(statusData.currency || "").toUpperCase();

      const amountMatches = expectedAmount !== null && txAmount !== null && Math.round(expectedAmount) === Math.round(txAmount);
      const currencyMatches = expectedCurrency === txCurrency;

      const paymentStatus = mappedStatus === "paid" && amountMatches && currencyMatches ? "paid" : (mappedStatus === "paid" ? "failed" : mappedStatus);

      const nextMetadata = {
        ...(checkoutData.metadata || {}),
        payment_provider: "PESAPAL",
        pesapal: {
          ...((checkoutData.metadata || {}).pesapal || {}),
          order_tracking_id: trackingId,
          payment_status_description: statusData.payment_status_description || null,
          status_code: statusData.status_code ?? null,
          amount: statusData.amount ?? null,
          currency: statusData.currency ?? null,
          confirmation_code: statusData.confirmation_code ?? null,
          payment_method: statusData.payment_method ?? null,
          amount_matches: amountMatches,
          currency_matches: currencyMatches,
          checked_at: new Date().toISOString(),
        },
      };

      await supabase
        .from("checkout_requests")
        .update({
          payment_status: paymentStatus,
          payment_method: "pesapal",
          metadata: nextMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", checkoutData.id);

      if (paymentStatus === "paid" && checkoutData.payment_status !== "paid") {
        await createBookingsForPaidCheckout(supabase, checkoutData);
      }

      return json(res, 200, {
        success: true,
        checkoutId: checkoutData.id,
        paymentStatus,
        orderTrackingId: trackingId,
        providerStatus: statusData.payment_status_description || null,
        amountMatches,
        currencyMatches,
        data: statusData,
      });
    }

    return json(res, 200, {
      success: true,
      orderTrackingId: trackingId,
      paymentStatus: mappedStatus,
      providerStatus: statusData.payment_status_description || null,
      data: statusData,
    });
  } catch (error) {
    console.error("Pesapal check status error", error?.providerResponse || error);
    return json(res, 500, { error: "Status check failed", message: error?.message || "Unexpected error" });
  }
}
