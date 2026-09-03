import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PartnerProgramSettings {
  commission_rate: number;
  cta_text: string;
  is_active: boolean;
  minimum_payout_amount: number;
  headline: string;
  description: string;
}

export const DEFAULT_PARTNER_SETTINGS: PartnerProgramSettings = {
  commission_rate: 10.0,
  cta_text: "Become a Partner & Earn 10%",
  is_active: true,
  minimum_payout_amount: 5000,
  headline: "Earn 10% Commission on Every Referral",
  description:
    "Join our partner network. Share your unique referral code with travelers, guests, and audiences to earn 10% cash commissions on every completed booking.",
};

const SETTINGS_KEY = "partner_program";

export const usePartnerProgramSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: settings = DEFAULT_PARTNER_SETTINGS,
    isLoading,
    error,
    refetch,
  } = useQuery<PartnerProgramSettings>({
    queryKey: ["platform-settings", SETTINGS_KEY],
    queryFn: async () => {
      let localFallback: PartnerProgramSettings | null = null;
      try {
        const stored = localStorage.getItem("merry360_partner_program_settings");
        if (stored) {
          localFallback = JSON.parse(stored);
        }
      } catch (e) {
        // ignore
      }

      try {
        const { data, error } = await supabase
          .from("platform_settings" as any)
          .select("value")
          .eq("key", SETTINGS_KEY)
          .maybeSingle();

        if (error) {
          console.warn("Could not query platform_settings (falling back to defaults/cache):", error.message);
          return localFallback || DEFAULT_PARTNER_SETTINGS;
        }

        if (data && (data as any).value) {
          const val = (data as any).value;
          const rate = Number(val.commission_rate ?? DEFAULT_PARTNER_SETTINGS.commission_rate);
          const parsed = {
            commission_rate: rate,
            cta_text: val.cta_text || `Become a Partner & Earn ${rate}%`,
            is_active: val.is_active !== false,
            minimum_payout_amount: Number(val.minimum_payout_amount ?? DEFAULT_PARTNER_SETTINGS.minimum_payout_amount),
            headline: val.headline || `Earn ${rate}% Commission on Every Referral`,
            description:
              val.description ||
              `Join our partner network. Share your unique referral code with travelers, guests, and audiences to earn ${rate}% cash commissions on every completed booking.`,
          };
          try {
            localStorage.setItem("merry360_partner_program_settings", JSON.stringify(parsed));
          } catch (e) {}
          return parsed;
        }

        return localFallback || DEFAULT_PARTNER_SETTINGS;
      } catch (err) {
        console.warn("Error in usePartnerProgramSettings:", err);
        return localFallback || DEFAULT_PARTNER_SETTINGS;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const mutation = useMutation({
    mutationFn: async ({
      newSettings,
      applyToAllExisting = false,
    }: {
      newSettings: Partial<PartnerProgramSettings>;
      applyToAllExisting?: boolean;
    }) => {
      const merged: PartnerProgramSettings = {
        ...settings,
        ...newSettings,
        commission_rate: Number(newSettings.commission_rate ?? settings.commission_rate),
      };

      // Always save to localStorage immediately for instant availability
      try {
        localStorage.setItem("merry360_partner_program_settings", JSON.stringify(merged));
      } catch (e) {}

      let tableMissing = false;

      // 1. Try to upsert into platform_settings
      try {
        const { error: upsertErr } = await supabase
          .from("platform_settings" as any)
          .upsert(
            {
              key: SETTINGS_KEY,
              value: merged,
              description: "Global configuration for the Partner & Referral program",
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "key" }
          );

        if (upsertErr) {
          console.warn("platform_settings upsert error:", upsertErr);
          if (upsertErr.message?.includes("platform_settings") || upsertErr.code === "PGRST205") {
            tableMissing = true;
          } else {
            throw upsertErr;
          }
        }
      } catch (err: any) {
        if (err?.message?.includes("platform_settings") || err?.code === "PGRST205") {
          tableMissing = true;
        } else {
          throw err;
        }
      }

      // 2. Optionally update all existing active affiliates' commission_rate
      let updatedAffiliatesCount = 0;
      if (applyToAllExisting) {
        const { data: updatedData, error: affiliateUpdateErr } = await supabase
          .from("affiliates")
          .update({ commission_rate: merged.commission_rate } as any)
          .eq("status", "active")
          .select("id");

        if (affiliateUpdateErr) {
          console.warn("Could not update existing affiliates:", affiliateUpdateErr.message);
        } else if (updatedData) {
          updatedAffiliatesCount = updatedData.length;
        }
      }

      return { saved: merged, tableMissing, updatedAffiliatesCount, applyToAllExisting };
    },
    onSuccess: ({ saved, tableMissing, updatedAffiliatesCount, applyToAllExisting }) => {
      queryClient.setQueryData(["platform-settings", SETTINGS_KEY], saved);
      queryClient.invalidateQueries({ queryKey: ["platform-settings", SETTINGS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
      queryClient.invalidateQueries({ queryKey: ["admin-affiliate-stats"] });

      if (tableMissing) {
        toast({
          title: "Settings applied (Database table pending)",
          description: `Commission updated to ${saved.commission_rate}% in local cache${applyToAllExisting ? ` & applied to active partners` : ""}. Please run the SQL migration in Supabase SQL editor to persist permanently.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Settings Saved",
          description: `Partner program commission updated to ${saved.commission_rate}%${applyToAllExisting ? ` and applied to ${updatedAffiliatesCount} active partners` : ""}.`,
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Failed to save settings",
        description: err.message || "An unexpected error occurred while saving platform settings.",
        variant: "destructive",
      });
    },
  });

  const commissionRate = Number(settings?.commission_rate ?? DEFAULT_PARTNER_SETTINGS.commission_rate);
  const ctaText = settings?.cta_text || `Become a Partner & Earn ${commissionRate}%`;
  const headline = settings?.headline || `Earn ${commissionRate}% Commission on Every Referral`;

  return {
    settings,
    commissionRate,
    ctaText,
    headline,
    isLoading,
    error,
    refetch,
    updateSettings: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
};
