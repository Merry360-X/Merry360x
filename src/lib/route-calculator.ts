/**
 * Utility to calculate, estimate, and format distance in km and estimated driving time
 * for Rwanda airport transfers, city rides, and intercity routes.
 */

// Known distances (in km) and drive times (in minutes) for Rwanda routes
const KNOWN_ROUTES: Record<string, { distanceKm: number; durationMins: number; highlight?: string }> = {
  // Airport routes
  "kigali international airport-remera": { distanceKm: 10.5, durationMins: 20, highlight: "Quick city transfer" },
  "remera-kigali international airport": { distanceKm: 10.5, durationMins: 20, highlight: "Quick airport dropoff" },
  "kigali international airport-kimihurura": { distanceKm: 8.5, durationMins: 20, highlight: "Embassy & dining district" },
  "kimihurura-kigali international airport": { distanceKm: 8.5, durationMins: 20, highlight: "Direct airport transfer" },
  "kigali international airport-city center": { distanceKm: 12.0, durationMins: 30, highlight: "Kigali CBD & financial hub" },
  "city center-kigali international airport": { distanceKm: 12.0, durationMins: 30, highlight: "CBD to airport" },
  "kigali international airport-nyarutarama": { distanceKm: 9.0, durationMins: 22, highlight: "Upscale residential & golf area" },
  "nyarutarama-kigali international airport": { distanceKm: 9.0, durationMins: 22, highlight: "Direct transfer" },
  "kigali international airport-kacyiru": { distanceKm: 11.0, durationMins: 25, highlight: "Government ministries & embassies" },
  "kacyiru-kigali international airport": { distanceKm: 11.0, durationMins: 25, highlight: "Direct transfer" },
  "kigali international airport-gacuriro": { distanceKm: 12.0, durationMins: 28, highlight: "Residential hilltop area" },
  "gacuriro-kigali international airport": { distanceKm: 12.0, durationMins: 28, highlight: "Direct transfer" },
  "kigali airport-gacuriro": { distanceKm: 12.0, durationMins: 28, highlight: "Direct transfer" },
  "gacuriro-kigali airport": { distanceKm: 12.0, durationMins: 28, highlight: "Direct transfer" },
  "kigali international airport-kibagabaga": { distanceKm: 9.5, durationMins: 22, highlight: "Scenic residential suburb" },
  "kigali international airport-gisozi": { distanceKm: 14.0, durationMins: 32, highlight: "Genocide Memorial area" },
  "kigali international airport-nyamirambo": { distanceKm: 15.0, durationMins: 38, highlight: "Vibrant cultural neighborhood" },
  "kigali international airport-kicukiro": { distanceKm: 7.0, durationMins: 16, highlight: "Fast airport corridor" },
  "kigali international airport-rebero": { distanceKm: 13.5, durationMins: 30, highlight: "CanalOlympia & scenic viewpoints" },
  "kigali international airport-bugesera": { distanceKm: 35.0, durationMins: 45, highlight: "Bugesera District connection" },

  // Intercity routes
  "kigali-gisenyi": { distanceKm: 155, durationMins: 210, highlight: "Lake Kivu beach, waterfront & DRC border" },
  "gisenyi-kigali": { distanceKm: 155, durationMins: 210, highlight: "Scenic return drive to capital" },
  "kigali-rubavu": { distanceKm: 155, durationMins: 210, highlight: "Lake Kivu resort & waterfront" },
  "rubavu-kigali": { distanceKm: 155, durationMins: 210, highlight: "Return drive to capital" },
  "kigali-musanze": { distanceKm: 95, durationMins: 120, highlight: "Volcanoes National Park & Gorillas" },
  "musanze-kigali": { distanceKm: 95, durationMins: 120, highlight: "Return from Volcanoes" },
  "kigali-ruhengeri": { distanceKm: 95, durationMins: 120, highlight: "Volcanoes National Park gateway" },
  "ruhengeri-kigali": { distanceKm: 95, durationMins: 120, highlight: "Return to Kigali" },
  "kigali-karongi": { distanceKm: 135, durationMins: 180, highlight: "Lake Kivu island tours & tea plantations" },
  "karongi-kigali": { distanceKm: 135, durationMins: 180, highlight: "Return from Karongi" },
  "kigali-kibuye": { distanceKm: 135, durationMins: 180, highlight: "Lake Kivu resorts & peaceful bays" },
  "kibuye-kigali": { distanceKm: 135, durationMins: 180, highlight: "Return from Kibuye" },
  "kigali-huye": { distanceKm: 130, durationMins: 150, highlight: "Ethnographic Museum & Cultural Capital" },
  "huye-kigali": { distanceKm: 130, durationMins: 150, highlight: "Return from Huye" },
  "kigali-butare": { distanceKm: 130, durationMins: 150, highlight: "Heritage capital & University hub" },
  "butare-kigali": { distanceKm: 130, durationMins: 150, highlight: "Return from Butare" },
  "kigali-akagera": { distanceKm: 110, durationMins: 150, highlight: "Big 5 Safari Wildlife Gateway" },
  "akagera-kigali": { distanceKm: 110, durationMins: 150, highlight: "Return from Safari" },
  "kigali-akagera national park": { distanceKm: 110, durationMins: 150, highlight: "Big 5 Safari Wildlife Gateway" },
  "akagera national park-kigali": { distanceKm: 110, durationMins: 150, highlight: "Return from Safari" },
  "kigali-rusizi": { distanceKm: 240, durationMins: 330, highlight: "Nyungwe Forest Canopy Walk & Tea Estates" },
  "rusizi-kigali": { distanceKm: 240, durationMins: 330, highlight: "Return from Rusizi" },
  "kigali-nyungwe": { distanceKm: 215, durationMins: 300, highlight: "Canopy Walk & Chimpanzee Tracking" },
  "nyungwe-kigali": { distanceKm: 215, durationMins: 300, highlight: "Return from Nyungwe" },
  "kigali-nyagatare": { distanceKm: 140, durationMins: 170, highlight: "Eastern Province agricultural hub" },
  "nyagatare-kigali": { distanceKm: 140, durationMins: 170, highlight: "Return to Kigali" },
  "kigali-muhanga": { distanceKm: 50, durationMins: 60, highlight: "Central crossroads hub" },
  "muhanga-kigali": { distanceKm: 50, durationMins: 60, highlight: "Return to Kigali" },
  "kigali-rwamagana": { distanceKm: 60, durationMins: 75, highlight: "Lake Muhazi & Eastern gateway" },
  "rwamagana-kigali": { distanceKm: 60, durationMins: 75, highlight: "Return to Kigali" },
  "musanze-gisenyi": { distanceKm: 60, durationMins: 75, highlight: "Scenic Volcanoes to Lake Kivu route" },
  "gisenyi-musanze": { distanceKm: 60, durationMins: 75, highlight: "Lake Kivu to Volcanoes route" },
};

function normalizeKey(str: string): string {
  return (str || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // remove parenthesis content e.g. (Rubavu)
    .replace(/[^\w\s-]/g, "")
    .trim();
}

/**
 * Format minutes into a user-friendly duration string:
 * e.g. 20 -> "~20 mins"
 * e.g. 90 -> "~1.5 hrs"
 * e.g. 150 -> "~2.5 hrs"
 * e.g. 210 -> "~3.5 hrs"
 */
export function formatDuration(mins: number): string {
  if (!mins || mins <= 0) return "Direct";
  if (mins < 60) return `~${mins} mins`;

  const hours = mins / 60;
  if (hours % 1 === 0) return `~${hours} hr${hours > 1 ? "s" : ""}`;
  if (Math.abs((hours % 1) - 0.5) < 0.15) {
    return `~${Math.floor(hours)}.5 hrs`;
  }

  const h = Math.floor(hours);
  const m = mins % 60;
  return `~${h}h ${m}m`;
}

/**
 * Calculate or lookup distance and driving time between two locations in Rwanda.
 */
export function calculateRouteDetails(
  fromLocation: string,
  toLocation: string,
  explicitDistanceKm?: number | null
): {
  distanceKm: number;
  durationMins: number;
  distanceFormatted: string;
  durationFormatted: string;
  fullRouteSummary: string;
} {
  const normFrom = normalizeKey(fromLocation);
  const normTo = normalizeKey(toLocation);
  const lookupKey = `${normFrom}-${normTo}`;

  let distance = Number(explicitDistanceKm || 0);
  let durationMins = 0;

  // 1. Check known lookup dictionary
  if (KNOWN_ROUTES[lookupKey]) {
    const known = KNOWN_ROUTES[lookupKey];
    if (!distance) distance = known.distanceKm;
    durationMins = known.durationMins;
  } else {
    // Check reverse lookup
    const reverseKey = `${normTo}-${normFrom}`;
    if (KNOWN_ROUTES[reverseKey]) {
      const known = KNOWN_ROUTES[reverseKey];
      if (!distance) distance = known.distanceKm;
      durationMins = known.durationMins;
    }
  }

  // 2. If no exact match, check substring matching
  if (!distance || !durationMins) {
    for (const [key, value] of Object.entries(KNOWN_ROUTES)) {
      const [kFrom, kTo] = key.split("-");
      if (
        (normFrom.includes(kFrom) || kFrom.includes(normFrom)) &&
        (normTo.includes(kTo) || kTo.includes(normTo))
      ) {
        if (!distance) distance = value.distanceKm;
        if (!durationMins) durationMins = value.durationMins;
        break;
      }
    }
  }

  // 3. Fallback calculation if only distance is provided or estimated
  if (distance > 0 && !durationMins) {
    if (distance <= 20) {
      // City traffic ~25-28 km/h avg
      durationMins = Math.max(10, Math.round((distance / 28) * 60));
    } else if (distance <= 70) {
      // Suburban / semi-rural ~45 km/h avg
      durationMins = Math.round((distance / 45) * 60);
    } else {
      // Intercity highways ~48 km/h avg in hills
      durationMins = Math.round((distance / 48) * 60);
    }
  }

  // Default fallback if unknown
  if (!distance) distance = 10;
  if (!durationMins) durationMins = 25;

  const distanceFormatted = `${distance} km`;
  const durationFormatted = formatDuration(durationMins);
  const fullRouteSummary = `${distanceFormatted} • ${durationFormatted}`;

  return {
    distanceKm: distance,
    durationMins,
    distanceFormatted,
    durationFormatted,
    fullRouteSummary,
  };
}
