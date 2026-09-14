import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import {
  generateFounderWelcomeEmailHtml,
  validateRecipientEmail,
  filterValidRecipients,
  buildBrevoSmtpPayload,
} from "../lib/email-template-kit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

if (!BREVO_API_KEY) {
  console.error("Error: BREVO_API_KEY is not configured.");
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendBrevoEmail({ toEmail, toName }) {
  const htmlContent = generateFounderWelcomeEmailHtml({
    firstName: toName ? toName.trim().split(" ")[0] : "",
    name: toName || "Explorer",
    email: toEmail,
  });

  const payload = {
    sender: {
      name: "Founder @ Merry360X",
      email: "support@merry360x.com",
    },
    to: [
      {
        email: toEmail,
        name: toName || "Explorer",
      },
    ],
    subject: "A Personal Note From Our Founder ✨",
    htmlContent,
    tags: ["founder-campaign", "welcome-founder"],
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function runCampaign() {
  console.log("=================================================");
  console.log("🚀 STARTING FOUNDER WELCOME EMAIL CAMPAIGN");
  console.log("=================================================");

  const recipients = new Map(); // normalized email -> { email, name, userId, source }

  // 1. Fetch from Supabase Auth (auth.users)
  try {
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });
    if (authError) {
      console.warn("Could not list auth.users:", authError.message);
    } else if (authData?.users) {
      for (const u of authData.users) {
        if (u.email) {
          const validation = validateRecipientEmail(u.email);
          if (validation.ok) {
            const norm = validation.email;
            const fullName = u.user_metadata?.full_name || u.user_metadata?.name || "";
            recipients.set(norm, {
              email: norm,
              name: fullName,
              userId: u.id,
              source: "auth.users",
              alreadySent: Boolean(u.user_metadata?.founder_welcome_sent_at),
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn("Auth list error:", e);
  }

  // 2. Fetch from bookings
  try {
    const { data: bookings, error: bookError } = await supabase
      .from("bookings")
      .select("guest_email, guest_name");
    if (!bookError && bookings) {
      for (const b of bookings) {
        if (b.guest_email) {
          const validation = validateRecipientEmail(b.guest_email);
          if (validation.ok) {
            const norm = validation.email;
            if (!recipients.has(norm)) {
              recipients.set(norm, {
                email: norm,
                name: b.guest_name || "",
                userId: null,
                source: "bookings",
                alreadySent: false,
              });
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("Bookings fetch error:", e);
  }

  // 3. Fetch from checkout_requests
  try {
    const { data: checkouts, error: coError } = await supabase
      .from("checkout_requests")
      .select("guest_email, customer_email, guest_name");
    if (!coError && checkouts) {
      for (const c of checkouts) {
        const rawEmail = c.guest_email || c.customer_email;
        if (rawEmail) {
          const validation = validateRecipientEmail(rawEmail);
          if (validation.ok) {
            const norm = validation.email;
            if (!recipients.has(norm)) {
              recipients.set(norm, {
                email: norm,
                name: c.guest_name || "",
                userId: null,
                source: "checkout_requests",
                alreadySent: false,
              });
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("Checkout requests fetch error:", e);
  }

  const allList = Array.from(recipients.values());
  console.log(`Found ${allList.length} total valid unique contacts in database.`);

  let successCount = 0;
  let skippedCount = 0;
  let failureCount = 0;

  for (let i = 0; i < allList.length; i++) {
    const contact = allList[i];
    const progress = `[${i + 1}/${allList.length}]`;

    try {
      console.log(`${progress} Sending to ${contact.email} (${contact.name || "Traveler"})...`);
      const result = await sendBrevoEmail({
        toEmail: contact.email,
        toName: contact.name,
      });

      if (result.ok) {
        successCount++;
        console.log(`  ✅ Sent! (Message ID: ${result.data?.messageId || "ok"})`);

        // If user is from auth.users, mark founder_welcome_sent_at in metadata
        if (contact.userId) {
          await supabase.auth.admin.updateUserById(contact.userId, {
            user_metadata: {
              founder_welcome_sent_at: new Date().toISOString(),
            },
          }).catch(() => {});
        }
      } else {
        failureCount++;
        console.error(`  ❌ Failed: ${result.status}`, result.data);
      }
    } catch (sendErr) {
      failureCount++;
      console.error(`  ❌ Error sending to ${contact.email}:`, sendErr.message);
    }

    // Rate-limit delay (150ms between requests)
    await sleep(150);
  }

  console.log("\n=================================================");
  console.log("🏁 CAMPAIGN COMPLETE!");
  console.log(`✅ Successfully Sent: ${successCount}`);
  console.log(`❌ Failures: ${failureCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log("=================================================");
}

runCampaign();
