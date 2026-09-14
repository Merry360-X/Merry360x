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
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getAudience() {
  const emailMap = new Map(); // normalized email -> { email, name, source }

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
          const norm = u.email.trim().toLowerCase();
          const fullName = u.user_metadata?.full_name || u.user_metadata?.name || "";
          emailMap.set(norm, {
            email: u.email.trim(),
            name: fullName,
            source: "auth.users",
            createdAt: u.created_at,
          });
        }
      }
    }
  } catch (e) {
    console.warn("auth list error:", e);
  }

  // 2. Fetch from profiles table
  try {
    const { data: profiles, error: profError } = await supabase
      .from("profiles")
      .select("user_id, full_name, nickname, created_at");
    if (!profError && profiles) {
      for (const p of profiles) {
        // match with auth users if available
        // note profiles table doesn't always have email directly, but we map full_name
      }
    }
  } catch (e) {
    console.warn("profiles query error:", e);
  }

  // 3. Fetch from bookings table
  try {
    const { data: bookings, error: bookError } = await supabase
      .from("bookings")
      .select("guest_email, guest_name, created_at");
    if (!bookError && bookings) {
      for (const b of bookings) {
        if (b.guest_email) {
          const norm = b.guest_email.trim().toLowerCase();
          if (!emailMap.has(norm)) {
            emailMap.set(norm, {
              email: b.guest_email.trim(),
              name: b.guest_name || "",
              source: "bookings",
              createdAt: b.created_at,
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn("bookings query error:", e);
  }

  // 4. Fetch from checkout_requests table
  try {
    const { data: checkouts, error: coError } = await supabase
      .from("checkout_requests")
      .select("guest_email, guest_name, customer_email, created_at");
    if (!coError && checkouts) {
      for (const c of checkouts) {
        const em = c.guest_email || c.customer_email;
        if (em) {
          const norm = em.trim().toLowerCase();
          if (!emailMap.has(norm)) {
            emailMap.set(norm, {
              email: em.trim(),
              name: c.guest_name || "",
              source: "checkout_requests",
              createdAt: c.created_at,
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn("checkouts query error:", e);
  }

  const list = Array.from(emailMap.values());
  console.log(`\n================================================`);
  console.log(`TOTAL UNIQUE CONTACTS FOUND IN DATABASE: ${list.length}`);
  console.log(`================================================`);
  list.slice(0, 15).forEach((item, idx) => {
    console.log(`${idx + 1}. [${item.source}] ${item.email} (Name: "${item.name || 'N/A'}")`);
  });
  if (list.length > 15) {
    console.log(`... and ${list.length - 15} more.`);
  }

  return list;
}

getAudience();
