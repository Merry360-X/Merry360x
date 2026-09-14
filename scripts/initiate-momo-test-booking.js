import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAWAPAY_BASE_URL = process.env.PAWAPAY_BASE_URL || "https://api.pawapay.cloud";
const PAWAPAY_API_KEY = process.env.PAWAPAY_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PAWAPAY_API_KEY) {
  console.error("❌ Missing required credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function initiateTestBooking() {
  const phoneNumber = "0783943932";
  const cleanPhone = "+250783943932";
  const rawMsisdn = "250783943932";
  const amountRwf = 500;
  const referralCode = "6376FEE1";
  const customerName = "Alain Test Momo";
  const customerEmail = "niganzealain@gmail.com";

  console.log("================================================================================");
  console.log("MERRY360X LIVE MOMO PAYMENT & REFERRAL TEST");
  console.log("================================================================================");
  console.log(`📱 Target Phone: ${cleanPhone}`);
  console.log(`💰 Amount: ${amountRwf} RWF`);
  console.log(`🎟️ Referral Code: ${referralCode}`);
  console.log(`🌐 Provider: MTN MoMo Rwanda (MTN_MOMO_RWA)\n`);

  // 1. Verify affiliate exists
  const { data: affiliate, error: affErr } = await supabase
    .from("affiliates")
    .select("id, user_id, referral_code, commission_rate, total_earnings, pending_earnings, total_referrals")
    .ilike("referral_code", referralCode)
    .single();

  if (affErr || !affiliate) {
    console.error("❌ Referral partner not found for code:", referralCode, affErr);
    process.exit(1);
  }

  console.log("👤 Referral Partner Owner Details:");
  console.log(` • Affiliate ID: ${affiliate.id}`);
  console.log(` • Owner User ID: ${affiliate.user_id}`);
  console.log(` • Commission Rate: ${affiliate.commission_rate}%`);
  console.log(` • Current Balance: ${affiliate.total_earnings} (Pending: ${affiliate.pending_earnings})\n`);

  // 2. Create checkout request record
  const depositId = crypto.randomUUID();
  const checkoutPayload = {
    name: customerName,
    email: customerEmail,
    phone: cleanPhone,
    total_amount: amountRwf,
    currency: "RWF",
    payment_status: "pending",
    payment_method: "mtn_momo",
    status: "pending_confirmation",
    dpo_transaction_id: depositId,
    referral_code: referralCode,
    base_price_amount: 450,
    service_fee_amount: 50,
    host_earnings_amount: 435,
    metadata: {
      deposit_id: depositId,
      referral_code: referralCode,
      payment_amount: amountRwf,
      payment_currency: "RWF",
      payment_provider: "MTN",
      payment_correspondent: "MTN_MOMO_RWA",
      booking_details: {
        guests: 1,
        check_in: new Date().toISOString().split("T")[0],
        check_out: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        property_id: "20cd731d-2f11-44cc-8b77-cb46eeb2c1a3",
      },
      items: [
        {
          id: "direct-20cd731d-2f11-44cc-8b77-cb46eeb2c1a3",
          title: "City Comfort Apartment (Live Test)",
          reference_id: "20cd731d-2f11-44cc-8b77-cb46eeb2c1a3",
          item_type: "property",
          price: 500,
          calculated_price: 500,
          currency: "RWF",
          calculated_price_currency: "RWF",
          quantity: 1,
          metadata: {
            guests: 1,
            nights: 1,
            check_in: new Date().toISOString().split("T")[0],
            check_out: new Date(Date.now() + 86400000).toISOString().split("T")[0],
          },
        },
      ],
      guest_info: {
        name: customerName,
        email: customerEmail,
        phone: cleanPhone,
      },
    },
  };

  const { data: checkout, error: chkErr } = await supabase
    .from("checkout_requests")
    .insert(checkoutPayload)
    .select()
    .single();

  if (chkErr || !checkout) {
    console.error("❌ Failed to create checkout request:", chkErr);
    process.exit(1);
  }

  console.log(`📝 Checkout request created: ${checkout.id}`);

  // 3. Initiate PawaPay Deposit
  console.log("🚀 Sending Mobile Money USSD prompt via PawaPay...");
  const pawaPayload = {
    depositId: depositId,
    amount: String(amountRwf),
    currency: "RWF",
    correspondent: "MTN_MOMO_RWA",
    payer: {
      type: "MSISDN",
      address: {
        value: rawMsisdn,
      },
    },
    customerTimestamp: new Date().toISOString(),
    statementDescription: "Merry360x Booking",
    metadata: [
      { fieldName: "orderId", fieldValue: checkout.id },
      { fieldName: "referralCode", fieldValue: referralCode },
    ],
  };

  const pawaResp = await fetch(`${PAWAPAY_BASE_URL}/deposits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PAWAPAY_API_KEY}`,
    },
    body: JSON.stringify(pawaPayload),
  });

  const pawaResult = await pawaResp.json().catch(() => ({}));
  console.log("PawaPay API Response:", pawaResp.status, pawaResult);

  if (pawaResp.status !== 200 && pawaResp.status !== 201 && pawaResult.status !== "ACCEPTED" && pawaResult.status !== "SUBMITTED") {
    console.error("❌ PawaPay initiation failed:", pawaResult);
    return;
  }

  console.log("\n📲 ================================================================================");
  console.log(`>>> PLEASE CHECK YOUR PHONE (${phoneNumber}) NOW! <<<`);
  console.log(`MTN MoMo will pop up with a prompt to authorize ${amountRwf} RWF.`);
  console.log(`Enter your PIN to complete the live payment.`);
  console.log("================================================================================\n");

  console.log("⏳ Waiting and polling for payment confirmation (press Ctrl+C to cancel)...");

  // 4. Poll for deposit status
  let isCompleted = false;
  let attempts = 0;
  const maxAttempts = 120; // 5-8 minutes

  while (!isCompleted && attempts < maxAttempts) {
    attempts++;
    await new Promise((r) => setTimeout(r, 2500));

    try {
      const statusResp = await fetch(`${PAWAPAY_BASE_URL}/deposits/${depositId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAWAPAY_API_KEY}`,
        },
      });

      const statusData = await statusResp.json().catch(() => ({}));
      const depositStatus = Array.isArray(statusData) && statusData[0] ? statusData[0].status : statusData.status;

      process.stdout.write(`\r[${attempts}/${maxAttempts}] Current Status: ${depositStatus || "PENDING"}... `);

      if (depositStatus === "COMPLETED") {
        isCompleted = true;
        console.log("\n\n🎉 PAYMENT CONFIRMED COMPLETED ON MOMO!");

        // 5. Update checkout request
        await supabase
          .from("checkout_requests")
          .update({
            payment_status: "paid",
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", checkout.id);

        // 6. Create Booking
        const bookingData = {
          guest_name: customerName,
          guest_email: customerEmail,
          guest_phone: cleanPhone,
          order_id: checkout.id,
          total_price: amountRwf,
          currency: "RWF",
          payment_status: "paid",
          payment_method: "mobile_money",
          booking_type: "property",
          property_id: "20cd731d-2f11-44cc-8b77-cb46eeb2c1a3",
          check_in: new Date().toISOString().split("T")[0],
          check_out: new Date(Date.now() + 86400000).toISOString().split("T")[0],
          status: "confirmed",
          confirmation_status: null,
          review_token: crypto.randomUUID(),
          affiliate_id: affiliate.id,
        };

        const { data: newBooking, error: bkErr } = await supabase
          .from("bookings")
          .insert(bookingData)
          .select()
          .single();

        if (bkErr) {
          console.error("❌ Failed to create booking:", bkErr);
        } else {
          console.log(`✅ Booking created in database: ${newBooking.id}`);
        }

        // 7. Calculate and insert 8% Referral Commission
        const commAmount = Number(((amountRwf * affiliate.commission_rate) / 100).toFixed(2));
        const commPayload = {
          affiliate_id: affiliate.id,
          booking_id: newBooking?.id || checkout.id,
          amount: commAmount,
          booking_value: amountRwf,
          affiliate_commission: commAmount,
          commission_rate: affiliate.commission_rate,
          status: "pending",
        };

        const { data: newComm, error: commErr } = await supabase
          .from("affiliate_commissions")
          .insert(commPayload)
          .select()
          .single();

        if (commErr) {
          console.error("❌ Commission insert error:", commErr);
        } else {
          console.log(`✅ Referral commission credited: ${commAmount} RWF (${affiliate.commission_rate}%) [ID: ${newComm.id}]`);
        }

        // 8. Update Affiliate aggregate earnings
        const { data: allComms } = await supabase
          .from("affiliate_commissions")
          .select("amount, status")
          .eq("affiliate_id", affiliate.id);

        const totalReferrals = allComms ? allComms.length : 1;
        const pendingEarnings = allComms ? allComms.filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0) : commAmount;
        const totalEarnings = allComms ? allComms.reduce((s, c) => s + Number(c.amount), 0) : commAmount;

        const { data: updatedAff } = await supabase
          .from("affiliates")
          .update({
            total_referrals: totalReferrals,
            pending_earnings: Number(pendingEarnings.toFixed(2)),
            total_earnings: Number(totalEarnings.toFixed(2)),
            updated_at: new Date().toISOString(),
          })
          .eq("id", affiliate.id)
          .select()
          .single();

        console.log("\n================================================================================");
        console.log("🌟 AFFILIATE DASHBOARD UPDATED FOR igizeneza100@gmail.com (6376FEE1):");
        console.log(` • Total Referrals: ${updatedAff.total_referrals}`);
        console.log(` • Pending Earnings: ${updatedAff.pending_earnings} RWF`);
        console.log(` • Total Earnings: ${updatedAff.total_earnings} RWF`);
        console.log("================================================================================\n");
        break;
      } else if (depositStatus === "FAILED" || depositStatus === "REJECTED" || depositStatus === "CANCELLED") {
        console.log(`\n❌ Payment ${depositStatus}: Customer did not authorize or transaction was declined.`);
        break;
      }
    } catch (pollErr) {
      // ignore network glitch in polling
    }
  }

  if (!isCompleted && attempts >= maxAttempts) {
    console.log("\n⏰ Polling timed out waiting for authorization.");
  }
}

initiateTestBooking();
