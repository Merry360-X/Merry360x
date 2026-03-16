import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PESAPAL_CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY;
const PESAPAL_CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
const PESAPAL_BASE_URL = process.env.PESAPAL_BASE_URL || "https://pay.pesapal.com/v3";
const PESAPAL_IPN_ID = process.env.PESAPAL_IPN_ID;
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://merry360x.com";

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

function safeAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

function sanitizeMerchantReference(value) {
  // Pesapal allows: alphanumeric, dash, underscore, dot, colon. Max 50.
  const raw = safeStr(value, 120);
  const cleaned = raw.replace(/[^A-Za-z0-9\-_.:]/g, "-");
  return cleaned.length > 50 ? cleaned.slice(0, 50) : cleaned;
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

  if (!PESAPAL_IPN_ID) {
    return json(res, 500, { error: "Pesapal IPN ID is not configured" });
  }

  try {
    const {
      checkoutId,
      amount,
      currency,
      payerName,
      payerEmail,
      phoneNumber,
      description,
      redirectUrl,
      metadata,
    } = req.body || {};

    if (!checkoutId) {
      return json(res, 400, { error: "Checkout ID is required" });
    }

    const total = safeAmount(amount);
    if (total <= 0) {
      return json(res, 400, { error: "Invalid amount" });
    }

    const email = safeStr(payerEmail, 120);
    if (!email) {
      return json(res, 400, { error: "Payer email is required" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: checkout, error: checkoutError } = await supabase
      .from("checkout_requests")
      .select("id, metadata")
      .eq("id", checkoutId)
      .single();

    if (checkoutError || !checkout) {
      return json(res, 404, { error: "Checkout not found" });
    }

    const merchantReference = sanitizeMerchantReference(
      `mry:${String(checkoutId).slice(0, 12)}:${Date.now().toString(36)}`
    );

    const callbackUrl =
      safeStr(redirectUrl, 500) ||
      `${APP_BASE_URL}/payment-pending?checkoutId=${encodeURIComponent(checkoutId)}&provider=pesapal`;

    const token = await getPesapalToken();

    const [firstName, ...rest] = safeStr(payerName, 80).split(/\s+/).filter(Boolean);
    const lastName = rest.join(" ") || "Customer";

    const orderPayload = {
      id: merchantReference,
      currency: safeStr(currency, 10) || "RWF",
      amount: total,
      description: safeStr(description, 100) || "Payment for booking",
      callback_url: callbackUrl,
      notification_id: PESAPAL_IPN_ID,
      billing_address: {
        email_address: email,
        phone_number: safeStr(phoneNumber, 30) || undefined,
        first_name: firstName || "Customer",
        last_name: lastName,
      },
    };

    const submitRes = await fetch(`${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const submitData = await submitRes.json().catch(() => ({}));
    if (!submitRes.ok || !submitData?.redirect_url || !submitData?.order_tracking_id) {
      console.error("Pesapal submit order error:", submitData);
      return json(res, 502, {
        error: submitData?.message || "Failed to initialize Pesapal payment",
        providerResponse: submitData,
      });
    }

    const nextMetadata = {
      ...(checkout.metadata || {}),
      payment_provider: "PESAPAL",
      pesapal: {
        merchant_reference: merchantReference,
        order_tracking_id: submitData.order_tracking_id,
        redirect_url: submitData.redirect_url,
        initialized_at: new Date().toISOString(),
      },
      ...(metadata && typeof metadata === "object" ? metadata : {}),
    };

    await supabase
      .from("checkout_requests")
      .update({ metadata: nextMetadata })
      .eq("id", checkoutId);

    return json(res, 200, {
      success: true,
      provider: "pesapal",
      checkoutId,
      merchantReference,
      orderTrackingId: submitData.order_tracking_id,
      redirectUrl: submitData.redirect_url,
      data: submitData,
    });
  } catch (error) {
    console.error("Pesapal init error:", error?.providerResponse || error);
    return json(res, 500, {
      error: "Failed to initialize payment",
      message: error?.message || "Unexpected error",
      providerResponse: error?.providerResponse || undefined,
    });
  }
}
