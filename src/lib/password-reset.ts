import { supabase } from "@/integrations/supabase/client";
import { getSiteOrigin } from "@/lib/site-origin";

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const redirectTo = `${getSiteOrigin()}/reset-password`;

  // 1. Try sending via backend Brevo API first (reliable transactional delivery)
  try {
    const res = await fetch("/api/support-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "password_reset", email: normalizedEmail, redirectTo }),
    });

    if (res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (payload?.ok && !payload?.skipped) {
        return;
      }
    }
  } catch {
    // Ignore fetch error and proceed to Supabase fallback
  }

  // 2. Fallback to Supabase client directly
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });

  if (error) throw error;
}
