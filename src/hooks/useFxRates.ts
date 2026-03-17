import { useEffect, useState } from "react";
import { DEFAULT_FX_RATES, type FxRates } from "@/lib/fx";
import { supabase } from "@/integrations/supabase/client";

const FX_CACHE_KEY = "fx_rates_admin_cache_v1";

const mergeRates = (loaded: FxRates | null | undefined): FxRates => {
  return {
    ...DEFAULT_FX_RATES,
    ...(loaded ?? {}),
    RWF: 1,
  };
};

const parseCachedRates = (): FxRates | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FxRates;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveCachedRates = (rates: FxRates) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FX_CACHE_KEY, JSON.stringify(rates));
  } catch {
    // Ignore storage failures.
  }
};

async function fetchAdminRates(): Promise<FxRates | null> {
  const { data, error } = await (supabase as any)
    .from("admin_fx_rates")
    .select("currency_code,rate_to_rwf,is_active")
    .eq("is_active", true);

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const loaded: FxRates = {};
  for (const row of data) {
    const code = String(row.currency_code || "").toUpperCase().trim();
    const rate = Number(row.rate_to_rwf || 0);
    if (!code || !Number.isFinite(rate) || rate <= 0) continue;
    loaded[code] = rate;
  }

  return Object.keys(loaded).length > 0 ? loaded : null;
}

export function useFxRates() {
  const [rates, setRates] = useState<FxRates | null>(() => {
    return mergeRates(parseCachedRates());
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const syncRates = async () => {
      setLoading(true);
      const liveRates = await fetchAdminRates();
      if (!active) return;

      const merged = mergeRates(liveRates);
      setRates(merged);
      saveCachedRates(merged);
      setLoading(false);
    };

    syncRates();

    const channel = supabase
      .channel("fx-rates-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_fx_rates" },
        () => {
          syncRates();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { usdRates: rates, fxLoading: loading };
}

