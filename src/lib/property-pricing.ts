/**
 * Property custom pricing helper functions
 */

export interface CustomPriceRange {
  id?: string;
  property_id?: string;
  start_date: string;
  end_date: string;
  custom_price_per_night: number;
  reason?: string | null;
}

export interface DailyRateBreakdown {
  dateStr: string;
  price: number;
  isCustom: boolean;
}

export interface PropertyStayPricing {
  nights: number;
  baseTotal: number;
  averageNightlyRate: number;
  dailyRates: DailyRateBreakdown[];
  hasCustomPrice: boolean;
}

/**
 * Format date to YYYY-MM-DD in local time
 */
export function formatDateOnly(d: Date | string): string {
  if (typeof d === "string") {
    const trimmed = d.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return trimmed;
    d = parsed;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculate the total stay base price and nightly breakdown
 * factoring in any custom prices for the property.
 */
export function calculatePropertyStayPrice(
  checkIn: string | Date | null | undefined,
  checkOut: string | Date | null | undefined,
  defaultPricePerNight: number,
  customPrices: CustomPriceRange[] = []
): PropertyStayPricing {
  const fallbackPrice = Math.max(0, Number(defaultPricePerNight) || 0);

  if (!checkIn || !checkOut) {
    return {
      nights: 1,
      baseTotal: fallbackPrice,
      averageNightlyRate: fallbackPrice,
      dailyRates: [],
      hasCustomPrice: false,
    };
  }

  const startStr = formatDateOnly(checkIn);
  const endStr = formatDateOnly(checkOut);

  const startParts = startStr.split("-").map(Number);
  const endParts = endStr.split("-").map(Number);

  const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);

  const diffMs = endDate.getTime() - startDate.getTime();
  const nights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  let baseTotal = 0;
  let hasCustomPrice = false;
  const dailyRates: DailyRateBreakdown[] = [];

  for (let i = 0; i < nights; i++) {
    const cur = new Date(startDate);
    cur.setDate(cur.getDate() + i);
    const dateStr = formatDateOnly(cur);

    let nightPrice = fallbackPrice;
    let isCustom = false;

    for (const cp of customPrices) {
      const cpStart = String(cp.start_date || "").slice(0, 10);
      const cpEnd = String(cp.end_date || "").slice(0, 10);
      if (dateStr >= cpStart && dateStr <= cpEnd) {
        nightPrice = Math.max(0, Number(cp.custom_price_per_night) || 0);
        isCustom = true;
        hasCustomPrice = true;
        break;
      }
    }

    dailyRates.push({
      dateStr,
      price: nightPrice,
      isCustom,
    });
    baseTotal += nightPrice;
  }

  const averageNightlyRate = nights > 0 ? baseTotal / nights : fallbackPrice;

  return {
    nights,
    baseTotal,
    averageNightlyRate,
    dailyRates,
    hasCustomPrice,
  };
}
