import { supabase } from "@/integrations/supabase/client";
import { getSiteOrigin } from "@/lib/site-origin";

export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = `${getSiteOrigin()}/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });

  if (error) throw error;
}
