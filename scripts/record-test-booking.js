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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const checkoutId = "6ec91b27-7d66-49cf-8d71-a3566756b8a4";
  const referralCode = "6376FEE1";
  const amountRwf = 500;

  const { data: aff } = await supabase
    .from("affiliates")
    .select("*")
    .eq("referral_code", referralCode)
    .single();

  console.log("Referral partner:", aff.id, aff.referral_code, aff.commission_rate);

  // 1. Create or fetch booking
  const { data: existingBk } = await supabase
    .from("bookings")
    .select("id")
    .eq("order_id", checkoutId)
    .maybeSingle();

  let bookingId = existingBk?.id;

  if (!bookingId) {
    const { data: newBk, error: bkErr } = await supabase
      .from("bookings")
      .insert({
        guest_name: "Alain Test Momo",
        guest_email: "niganzealain@gmail.com",
        guest_phone: "+250783943932",
        order_id: checkoutId,
        total_price: amountRwf,
        currency: "RWF",
        payment_status: "paid",
        payment_method: "mobile_money",
        booking_type: "property",
        property_id: "20cd731d-2f11-44cc-8b77-cb46eeb2c1a3",
        check_in: new Date().toISOString().split("T")[0],
        check_out: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        status: "confirmed",
        review_token: crypto.randomUUID(),
        affiliate_id: aff.id,
      })
      .select()
      .single();

    if (bkErr) {
      console.error("❌ Failed to create booking:", bkErr);
      return;
    }
    bookingId = newBk.id;
    console.log("✅ Created 500 RWF Booking:", bookingId);
  } else {
    console.log("ℹ️ Booking already exists:", bookingId);
  }

  // 2. Insert 40 RWF commission (8% of 500 RWF)
  const commAmount = Number(((amountRwf * aff.commission_rate) / 100).toFixed(2)); // 40 RWF
  const { data: existingComm } = await supabase
    .from("affiliate_commissions")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("affiliate_id", aff.id)
    .maybeSingle();

  if (!existingComm) {
    const { data: newComm, error: cErr } = await supabase
      .from("affiliate_commissions")
      .insert({
        affiliate_id: aff.id,
        booking_id: bookingId,
        amount: commAmount,
        booking_value: amountRwf,
        affiliate_commission: commAmount,
        commission_rate: aff.commission_rate,
        status: "pending",
      })
      .select()
      .single();

    console.log("✅ Created Commission:", newComm?.id, commAmount, "RWF", cErr);
  }

  // 3. Update checkout status
  await supabase
    .from("checkout_requests")
    .update({ payment_status: "paid", status: "completed" })
    .eq("id", checkoutId);

  // 4. Recalculate affiliate stats
  const { data: allComms } = await supabase
    .from("affiliate_commissions")
    .select("amount, status")
    .eq("affiliate_id", aff.id);

  const totalReferrals = allComms ? allComms.length : 2;
  const pendingEarnings = allComms ? allComms.filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0) : 0;
  const totalEarnings = allComms ? allComms.reduce((s, c) => s + Number(c.amount), 0) : 0;

  const { data: updatedAff } = await supabase
    .from("affiliates")
    .update({
      total_referrals: totalReferrals,
      pending_earnings: Number(pendingEarnings.toFixed(2)),
      total_earnings: Number(totalEarnings.toFixed(2)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", aff.id)
    .select()
    .single();

  console.log("\n================================================================================");
  console.log("🎉 LIVE REFERRAL DASHBOARD SUMMARY FOR igizeneza100@gmail.com (6376FEE1):");
  console.log(` • Total Referred Bookings: ${updatedAff.total_referrals}`);
  console.log(` • Pending Commissions: ${updatedAff.pending_earnings} RWF`);
  console.log(` • Total Earnings: ${updatedAff.total_earnings} RWF`);
  console.log("================================================================================\n");
}

main();
