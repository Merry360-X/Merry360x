import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Pre-defined realistic notification scenarios
const SCENARIOS = {
  // ── 1. CANCELLATIONS ──
  booking_cancelled_by_guest: {
    type: "booking_cancelled",
    title: "⚠️ Booking Cancelled",
    body: "Your booking for 'Gorilla Trek Safari Tour' (#BK-4109) has been cancelled as requested.",
    screen_route: "/my-bookings",
    metadata: { booking_id: "demo-booking-2", reason: "Guest requested cancellation" },
  },
  host_booking_cancelled: {
    type: "booking_cancelled_by_guest",
    title: "⚠️ Guest Cancelled Reservation",
    body: "Guest John cancelled booking #BK-8291 for 'Kigali Heights Villa'. Dates are now open.",
    screen_route: "/host/bookings",
    metadata: { booking_id: "demo-booking-2" },
  },
  booking_cancelled_by_host: {
    type: "booking_cancelled",
    title: "🚨 Booking Cancelled by Host",
    body: "Host cancelled reservation #BK-7712. A 100% full refund of 145,000 RWF has been initiated.",
    screen_route: "/my-bookings",
    metadata: { booking_id: "demo-booking-7", refund_amount: 145000 },
  },

  // ── 2. CHANGES & MODIFICATIONS ──
  booking_updated: {
    type: "booking_updated",
    title: "📅 Dates Updated Successfully",
    body: "Your stay dates for 'Nyungwe Forest Lodge' (#BK-5520) have been updated to Nov 2 - 5, 2026.",
    screen_route: "/my-bookings",
    metadata: { booking_id: "demo-booking-3", new_dates: "2026-11-02 to 2026-11-05" },
  },
  booking_guests_changed: {
    type: "booking_updated",
    title: "👥 Guest Count Modified",
    body: "Booking #BK-8291 guest count was adjusted to 4 guests. Host notified.",
    screen_route: "/my-bookings",
    metadata: { booking_id: "demo-booking-1", guest_count: 4 },
  },

  // ── 3. REGISTRATIONS & PROFILE ──
  registration_welcome: {
    type: "user_registration_welcome",
    title: "👋 Welcome to Merry360X!",
    body: "Your account is all set up. Start discovering amazing stays, tours, and experiences across Africa.",
    screen_route: "/explore",
    metadata: {},
  },
  profile_updated: {
    type: "profile_updated",
    title: "👤 Profile Updated",
    body: "Your personal details and phone verification have been updated successfully.",
    screen_route: "/profile",
    metadata: {},
  },
  host_application_approved: {
    type: "listing_approved",
    title: "🎉 Host Account Approved!",
    body: "Congratulations! Your host application has been verified. You can now publish listings.",
    screen_route: "/host/dashboard",
    metadata: { status: "approved" },
  },

  // ── 4. PAYMENTS, CHARGES & REFUNDS ──
  payment_success: {
    type: "payment_success",
    title: "💳 Payment Successful",
    body: "We received your payment of 120,000 RWF via Mobile Money for booking #BK-8291.",
    screen_route: "/my-bookings",
    metadata: { amount: 120000, currency: "RWF" },
  },
  refund_issued: {
    type: "refund_issued",
    title: "💵 Refund Processed",
    body: "A refund of 85,000 RWF for cancelled booking #BK-4109 has been sent to your Mobile Money account.",
    screen_route: "/my-bookings",
    metadata: { amount: 85000, currency: "RWF" },
  },
  extra_charge_requested: {
    type: "extra_charge_requested",
    title: "🧾 Extra Charge Requested",
    body: "Host requested an extra charge of 25,000 RWF for 'Airport Shuttle Service' (#BK-8291).",
    screen_route: "/post-booking",
    metadata: { booking_id: "demo-booking-1", amount: 25000 },
  },

  // ── 5. HOST ACTIONS ──
  new_booking_request: {
    type: "new_booking_request",
    title: "🛎️ New Booking Request",
    body: "Sarah Johnson requested to book 'Kigali Heights Apartment' for 3 nights (2 guests).",
    screen_route: "/host/bookings",
    metadata: { booking_id: "demo-booking-4" },
  },
  guest_checked_in: {
    type: "guest_checked_in",
    title: "🔑 Guest Checked In",
    body: "Guest Eric Kalisa completed check-in for 'Lake Kivu Cottage'.",
    screen_route: "/host/bookings",
    metadata: { booking_id: "demo-booking-5" },
  },
  payout_sent: {
    type: "payout_sent",
    title: "💰 Payout Sent to Bank",
    body: "Your payout of 340,000 RWF for completed stays has been dispatched to your bank account.",
    screen_route: "/host/earnings",
    metadata: { amount: 340000, currency: "RWF" },
  },
  new_review: {
    type: "new_review",
    title: "⭐ 5-Star Review Received!",
    body: "Alice left a 5-star review: 'Outstanding hospitality, spotless apartment, and stunning view!'",
    screen_route: "/host/reviews",
    metadata: { rating: 5 },
  },

  // ── 6. ADMIN ALERTS ──
  admin_new_user: {
    type: "admin_new_user",
    title: "🛡️ [Admin] New User Registered",
    body: "A new traveler registered on Merry360X: John Doe (john@example.com).",
    screen_route: "/admin/users",
    metadata: {},
  },
  admin_dispute_opened: {
    type: "dispute_requires_admin",
    title: "🚨 [Admin] Dispute Requires Attention",
    body: "Guest opened a dispute for booking #BK-8291: 'Check-in delay / Host unresponsive'.",
    screen_route: "/admin/post-booking",
    metadata: { dispute_id: "demo-disp-1" },
  },
  admin_listing_submitted: {
    type: "listing_submitted",
    title: "📋 [Admin] New Listing Pending Approval",
    body: "Host 'Akagera Safari Tours' submitted a new 3-day safari tour package for admin review.",
    screen_route: "/admin/listings",
    metadata: {},
  },
  admin_high_value_booking: {
    type: "high_value_booking",
    title: "💎 [Admin] High-Value Booking Placed",
    body: "A premium luxury safari booking of 1,850,000 RWF was placed for 'One&Only Gorilla's Nest'.",
    screen_route: "/admin/bookings",
    metadata: { amount: 1850000 },
  },
  admin_user_flagged: {
    type: "user_flagged",
    title: "🚩 [Admin] User Flagged by Community",
    body: "User profile @charlie99 was flagged for multiple suspicious reservation requests.",
    screen_route: "/admin/users",
    metadata: { flagged_user_id: "demo-user-flagged" },
  },
};

async function sendTestNotification({ targetEmailOrUserId, scenarioKey }) {
  const scenario = SCENARIOS[scenarioKey];
  if (!scenario) {
    console.error(`Unknown scenario: "${scenarioKey}". Available scenarios:`, Object.keys(SCENARIOS));
    process.exit(1);
  }

  let targetUserId = targetEmailOrUserId;

  // If input is an email, find corresponding user_id in auth.users
  if (targetEmailOrUserId.includes("@")) {
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authError || !authData?.users) {
      console.error("Could not find user by email:", authError?.message);
      process.exit(1);
    }
    const found = authData.users.find(
      (u) => u.email?.trim().toLowerCase() === targetEmailOrUserId.trim().toLowerCase()
    );
    if (!found) {
      console.error(`User with email "${targetEmailOrUserId}" was not found in auth.users.`);
      process.exit(1);
    }
    targetUserId = found.id;
    console.log(`Found User ID for ${targetEmailOrUserId}: ${targetUserId}`);
  }

  const payload = {
    user_id: targetUserId,
    notification_type: scenario.type,
    title: scenario.title,
    body: scenario.body,
    channel: "in_app",
    data: {
      ...scenario.metadata,
      screen_route: scenario.screen_route,
      deep_link: scenario.screen_route,
      source: "test_suite",
    },
    is_read: false,
    created_at: new Date().toISOString(),
  };

  console.log(`Sending notification [${scenarioKey}] to user ${targetUserId}...`);

  const { data, error } = await supabase
    .from("notifications")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("❌ Failed to insert notification:", error.message);
  } else {
    console.log("✅ NOTIFICATION DISPATCHED SUCCESSFULLY!");
    console.log("Row ID:", data.id);
    console.log("Type:", data.notification_type);
    console.log("Title:", data.title);
    console.log("Body:", data.body);
    console.log("Data:", JSON.stringify(data.data));
    console.log("\n🚀 Realtime trigger: The in-app banner will drop down immediately on the Flutter app!");
  }
}

// CLI Execution logic
const args = process.argv.slice(2);
const firstArg = args[0];

if (!firstArg || firstArg === "--list" || firstArg === "list" || firstArg === "--help") {
  console.log("================================================================================");
  console.log("MERRY360X REALTIME FLUTTER NOTIFICATION TEST SUITE");
  console.log("================================================================================\n");
  console.log("Available Action Scenarios:\n");
  Object.keys(SCENARIOS).forEach((k) => {
    console.log(` • ${k.padEnd(28)} -> [${SCENARIOS[k].type}] ${SCENARIOS[k].title}`);
  });
  console.log("\nUsage Options:");
  console.log("  1. Test single scenario:");
  console.log("     node scripts/test-notification.js <email_or_uuid> <scenario_name>");
  console.log("     Example: node scripts/test-notification.js niganzealain@gmail.com booking_cancelled_by_guest\n");
  console.log("  2. Test all primary scenarios in a sequence:");
  console.log("     node scripts/test-notification.js <email_or_uuid> all\n");
  console.log("  3. Send custom notification:");
  console.log('     node scripts/test-notification.js <email_or_uuid> custom "Title" "Body message" "/my-bookings"\n');
  process.exit(0);
}

const targetEmailOrUserId = firstArg;
const secondArg = args[1] || "booking_confirmed";

if (secondArg === "all") {
  (async () => {
    console.log(`\n🚀 Firing full notification test sequence to ${targetEmailOrUserId}...`);
    const keyList = Object.keys(SCENARIOS);
    for (let i = 0; i < keyList.length; i++) {
      const key = keyList[i];
      console.log(`\n[${i + 1}/${keyList.length}] Testing: ${key}`);
      await sendTestNotification({ targetEmailOrUserId, scenarioKey: key });
      await new Promise((r) => setTimeout(r, 2000));
    }
    console.log("\n🎉 All scenarios dispatched! Check your Flutter app for real-time banners and notification list updates.");
  })();
} else if (secondArg === "custom") {
  const customTitle = args[2] || "Custom Test Alert";
  const customBody = args[3] || "This is a live test notification from Merry360X test suite.";
  const customRoute = args[4] || "/explore";

  (async () => {
    let targetUserId = targetEmailOrUserId;
    if (targetEmailOrUserId.includes("@")) {
      const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const found = authData?.users?.find((u) => u.email?.trim().toLowerCase() === targetEmailOrUserId.trim().toLowerCase());
      if (found) targetUserId = found.id;
    }
    const payload = {
      user_id: targetUserId,
      notification_type: "custom_alert",
      title: customTitle,
      body: customBody,
      channel: "in_app",
      data: { screen_route: customRoute, deep_link: customRoute, source: "test_suite_custom" },
      is_read: false,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("notifications").insert(payload).select().single();
    if (error) console.error("❌ Failed:", error.message);
    else {
      console.log("✅ CUSTOM NOTIFICATION SENT!");
      console.log("Title:", data.title);
      console.log("Body:", data.body);
      console.log("Route:", customRoute);
    }
  })();
} else {
  sendTestNotification({
    targetEmailOrUserId,
    scenarioKey: secondArg,
  });
}

