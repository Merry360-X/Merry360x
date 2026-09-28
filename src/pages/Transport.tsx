import { Car, Search, MapPin, Frown, ArrowLeftRight, Plane, Building2, Map as MapIcon, Key, Users, Fuel, Settings, Calendar, Shield, ChevronRight, Clock, Sparkles, CheckCircle2, Navigation, Luggage, Check, AlertCircle, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import type { Tables } from "@/integrations/supabase/types";
import ListingImageCarousel from "@/components/ListingImageCarousel";
import { formatMoney } from "@/lib/money";
import { optimizeCloudinaryImage } from "@/lib/cloudinary";
import { useTripCart } from "@/hooks/useTripCart";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import { useFxRates } from "@/hooks/useFxRates";
import { convertAmount } from "@/lib/fx";
import { Badge } from "@/components/ui/badge";
import { calculateRouteDetails } from "@/lib/route-calculator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Transport service categories
const transportCategories = [
  { id: "airport_transfer", labelKey: "transport.categories.airportTransfer", descKey: "transport.categories.airportDesc", icon: Plane },
  { id: "intracity", labelKey: "transport.categories.intracity", descKey: "transport.categories.intracityDesc", icon: Building2 },
  { id: "intercity", labelKey: "transport.categories.intercity", descKey: "transport.categories.intercityDesc", icon: MapIcon },
  { id: "car_rental", labelKey: "transport.categories.carRental", descKey: "transport.categories.carRentalDesc", icon: Key },
];

const ALL_VEHICLES_VALUE = "All Vehicles";

type TransportServiceRow = Pick<Tables<"transport_services">, "id" | "title" | "description">;

// Extended vehicle type with all car rental fields
interface TransportVehicleRow {
  id: string;
  title: string;
  provider_name: string | null;
  vehicle_type: string | null;
  seats: number | null;
  price_per_day: number | null;
  daily_price?: number | null;
  weekly_price?: number | null;
  monthly_price?: number | null;
  currency: string | null;
  driver_included: boolean | null;
  image_url: string | null;
  media: string[] | null;
  // New car rental fields
  car_brand?: string | null;
  car_model?: string | null;
  car_year?: number | null;
  car_type?: string | null;
  transmission?: string | null;
  fuel_type?: string | null;
  drive_train?: string | null;
  key_features?: string[] | null;
  exterior_images?: string[] | null;
  interior_images?: string[] | null;
  // Documents (for verification badge)
  insurance_document_url?: string | null;
  registration_document_url?: string | null;
  roadworthiness_certificate_url?: string | null;
}

type TransportRouteRow = Pick<Tables<"transport_routes">, "id" | "from_location" | "to_location" | "base_price" | "currency">;

const getRouteMeta = (from: string, to: string, distanceKm?: number | null) => {
  const details = calculateRouteDetails(from, to, distanceKm);
  const combined = `${from || ""} ${to || ""}`.toLowerCase();
  
  let tag = "Private Ride";
  let highlight = "Door-to-door private transfer";

  if (combined.includes("gisenyi") || combined.includes("rubavu")) {
    tag = "Scenic Route";
    highlight = "Lake Kivu Beach, Waterfront & Border";
  } else if (combined.includes("musanze") || combined.includes("ruhengeri")) {
    tag = "Volcanoes Route";
    highlight = "Volcanoes National Park & Gorilla Trekking";
  } else if (combined.includes("karongi") || combined.includes("kibuye")) {
    tag = "Lakeside Route";
    highlight = "Lake Kivu Islands, Boat Tours & Tea Plantations";
  } else if (combined.includes("huye") || combined.includes("butare")) {
    tag = "Heritage Route";
    highlight = "Ethnographic Museum & Cultural Heritage";
  } else if (combined.includes("akagera")) {
    tag = "Safari Route";
    highlight = "Akagera Safari & Big 5 Wildlife Gateway";
  } else if (combined.includes("rusizi") || combined.includes("nyungwe") || combined.includes("cyangugu")) {
    tag = "Rainforest Route";
    highlight = "Nyungwe Forest Canopy Walk & Primates";
  }

  return {
    duration: details.durationFormatted,
    distance: details.distanceFormatted,
    distanceKm: details.distanceKm,
    durationMins: details.durationMins,
    highlight,
    tag,
  };
};

const DEFAULT_INTERCITY_ROUTES: TransportRouteRow[] = [
  { id: "preset-kigali-gisenyi", from_location: "Kigali", to_location: "Gisenyi (Rubavu)", base_price: 60000, currency: "RWF" },
  { id: "preset-gisenyi-kigali", from_location: "Gisenyi (Rubavu)", to_location: "Kigali", base_price: 60000, currency: "RWF" },
  { id: "preset-kigali-musanze", from_location: "Kigali", to_location: "Musanze (Ruhengeri)", base_price: 50000, currency: "RWF" },
  { id: "preset-musanze-kigali", from_location: "Musanze (Ruhengeri)", to_location: "Kigali", base_price: 50000, currency: "RWF" },
  { id: "preset-kigali-karongi", from_location: "Kigali", to_location: "Karongi (Kibuye)", base_price: 55000, currency: "RWF" },
  { id: "preset-kigali-huye", from_location: "Kigali", to_location: "Huye (Butare)", base_price: 50000, currency: "RWF" },
  { id: "preset-kigali-akagera", from_location: "Kigali", to_location: "Akagera National Park", base_price: 75000, currency: "RWF" },
  { id: "preset-musanze-gisenyi", from_location: "Musanze (Ruhengeri)", to_location: "Gisenyi (Rubavu)", base_price: 35000, currency: "RWF" },
];

const Transport = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [vehicle, setVehicle] = useState(ALL_VEHICLES_VALUE);
  const [expandedAirportVehicleId, setExpandedAirportVehicleId] = useState<string | null>(null);
  const [airportDirectionFilter, setAirportDirectionFilter] = useState<"from" | "to">("from");
  const [intercityDestinationFilter, setIntercityDestinationFilter] = useState<string>("all");
  const [bookingRouteId, setBookingRouteId] = useState<string | null>(null);

  // Booking Modal State for Intercity Rides
  const [bookingModalRoute, setBookingModalRoute] = useState<TransportRouteRow | null>(null);
  const [tripType, setTripType] = useState<"one_way" | "round_trip">("one_way");
  const [pickupDate, setPickupDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [pickupTime, setPickupTime] = useState("09:00");
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  });
  const [returnTime, setReturnTime] = useState("16:00");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [luggageCount, setLuggageCount] = useState(1);
  const [specialNotes, setSpecialNotes] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  const { addToCart: addCartItem, guestCart = [] } = useTripCart();
  const { currency: preferredCurrency } = usePreferences();
  const { usdRates } = useFxRates();
  const nearbyLat = searchParams.get("lat");
  const nearbyLng = searchParams.get("lng");
  const nearby =
    searchParams.get("nearby") === "1" && nearbyLat && nearbyLng
      ? { lat: Number(nearbyLat), lng: Number(nearbyLng) }
      : null;
  const nearbyRegion = (searchParams.get("region") ?? "").trim().toLowerCase();

  const displayMoney = (amount: number, fromCurrency: string | null) => {
    const code = String(fromCurrency ?? "RWF");
    const converted = convertAmount(Number(amount ?? 0), code, preferredCurrency, usdRates);
    return formatMoney(converted ?? Number(amount ?? 0), converted !== null ? preferredCurrency : code);
  };

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setVehicle(searchParams.get("vehicle") ?? ALL_VEHICLES_VALUE);
  }, [searchParams]);

  const runSearch = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (vehicle && vehicle !== ALL_VEHICLES_VALUE) params.set("vehicle", vehicle);
    const qs = params.toString();
    navigate(qs ? `/transport?${qs}` : "/transport");
  };

  const requestNearbyRecommendations = useCallback(async (options?: { silent?: boolean; position?: GeolocationPosition }) => {
    const silent = Boolean(options?.silent);

    const applyPosition = async (pos: GeolocationPosition) => {
      const params = new URLSearchParams(searchParams);
      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;
      const currentLat = Number(searchParams.get("lat"));
      const currentLng = Number(searchParams.get("lng"));
      const currentRegion = (searchParams.get("region") ?? "").trim();
      const coordsChanged =
        !Number.isFinite(currentLat) ||
        !Number.isFinite(currentLng) ||
        Math.abs(currentLat - latitude) > 0.0005 ||
        Math.abs(currentLng - longitude) > 0.0005;

      params.set("nearby", "1");
      params.set("lat", String(latitude));
      params.set("lng", String(longitude));

      if (coordsChanged || !currentRegion) {
        try {
          const reverse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            { headers: { Accept: "application/json" } }
          );
          const info = await reverse.json().catch(() => null);
          const address = info?.address || {};
          const region = [address.city, address.town, address.county, address.state, address.country]
            .filter(Boolean)
            .join(", ");
          if (region) params.set("region", region);
        } catch {
          // Keep nearby coords even if reverse geocoding fails
        }
      }

      const nextQuery = params.toString();
      if (nextQuery !== searchParams.toString()) {
        navigate(`/transport?${nextQuery}`, { replace: true });
      }
    };

    if (options?.position) {
      await applyPosition(options.position);
      return;
    }

    if (!("geolocation" in navigator)) {
      if (!silent) {
        toast({ variant: "destructive", title: "Location not available", description: "Your browser does not support geolocation." });
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void applyPosition(pos);
      },
      () => {
        if (!silent) {
          toast({ variant: "destructive", title: "Location permission denied", description: "Allow location access to get nearby recommendations." });
        }
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, [navigate, searchParams, toast]);

  useEffect(() => {
    let watchId: number | null = null;
    let permissionStatus: PermissionStatus | null = null;
    let cancelled = false;

    const stopWatching = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    const startWatching = () => {
      if (!("geolocation" in navigator) || watchId !== null) return;

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          void requestNearbyRecommendations({ silent: true, position: pos });
        },
        () => {
          stopWatching();
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
      );
    };

    const syncNearbyRecommendations = async () => {
      if (!("permissions" in navigator) || typeof navigator.permissions?.query !== "function") {
        await requestNearbyRecommendations({ silent: true });
        startWatching();
        return;
      }

      try {
        permissionStatus = await navigator.permissions.query({ name: "geolocation" });
        if (cancelled) return;

        const handlePermissionChange = () => {
          if (permissionStatus?.state === "granted") {
            void requestNearbyRecommendations({ silent: true });
            startWatching();
          } else {
            stopWatching();
          }
        };

        permissionStatus.onchange = handlePermissionChange;
        if (permissionStatus.state === "granted") {
          await requestNearbyRecommendations({ silent: true });
          startWatching();
        }
      } catch {
        await requestNearbyRecommendations({ silent: true });
        startWatching();
      }
    };

    void syncNearbyRecommendations();

    return () => {
      cancelled = true;
      stopWatching();
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [requestNearbyRecommendations]);

  const { data: services = [] } = useQuery({
    queryKey: ["transport_services"],
    queryFn: async (): Promise<TransportServiceRow[]> => {
      const { data, error } = await supabase
        .from("transport_services")
        .select("id, title, description, slug")
        .or("is_published.eq.true,is_published.is.null")
        .order("created_at", { ascending: true });
      if (error) return [];
      return (data as TransportServiceRow[] | null) ?? [];
    },
  });

  const { data: vehicles = [], isLoading: vehiclesLoading, isError: vehiclesError } = useQuery({
    queryKey: ["transport_vehicles", searchParams.get("vehicle") ?? ALL_VEHICLES_VALUE],
    queryFn: async (): Promise<TransportVehicleRow[]> => {
      let q = supabase
        .from("transport_vehicles")
        .select(`
          id, title, provider_name, vehicle_type, seats, 
          price_per_day, daily_price, weekly_price, monthly_price, 
          currency, driver_included, image_url, media,
          car_brand, car_model, car_year, car_type,
          transmission, fuel_type, drive_train, key_features,
          exterior_images, interior_images,
          insurance_document_url, registration_document_url, roadworthiness_certificate_url
        `)
        .eq("service_type", "car_rental")
        .or("is_published.eq.true,is_published.is.null")
        .order("created_at", { ascending: false });
      const vt = searchParams.get("vehicle");
      if (vt && vt !== ALL_VEHICLES_VALUE) q = (q as any).eq("vehicle_type", vt);
      const { data, error } = await q;
      if (error) throw error;
      return (data as TransportVehicleRow[] | null) ?? [];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ["transport_routes", searchParams.get("q") ?? ""],
    queryFn: async (): Promise<TransportRouteRow[]> => {
      let q = supabase
        .from("transport_routes")
        .select("id, from_location, to_location, base_price, currency")
        .or("is_published.eq.true,is_published.is.null")
        .order("created_at", { ascending: false });
      const trimmed = (searchParams.get("q") ?? "").trim();
      if (trimmed) {
        q = q.or(`from_location.ilike.%${trimmed}%,to_location.ilike.%${trimmed}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as TransportRouteRow[] | null) ?? [];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  const { data: tripCartCount = 0 } = useQuery({
    queryKey: ["trip_cart_items", "count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("trip_cart_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);

      if (error) return 0;
      return count ?? 0;
    },
  });

  // Fetch airport transfer routes with their vehicles and pricing
  interface AirportRoute {
    id: string;
    from_location: string;
    to_location: string;
    distance_km: number | null;
    base_price: number;
    currency: string;
  }

  interface AirportPricing {
    id: string;
    route_id: string;
    vehicle_id: string;
    price: number;
    currency: string;
    vehicle: TransportVehicleRow | null;
  }

  const { data: airportRoutes = [], isLoading: airportRoutesLoading } = useQuery({
    queryKey: ["airport_transfer_routes"],
    queryFn: async (): Promise<AirportRoute[]> => {
      const { data, error } = await (supabase as any)
        .from("airport_transfer_routes")
        .select("*")
        .eq("is_active", true)
        .order("from_location");
      if (error) throw error;
      return (data as AirportRoute[]) || [];
    },
  });

  const { data: airportPricing = [], isLoading: airportPricingLoading } = useQuery({
    queryKey: ["airport_transfer_pricing"],
    queryFn: async (): Promise<AirportPricing[]> => {
      const { data, error } = await (supabase as any)
        .from("airport_transfer_pricing")
        .select(`
          id, route_id, vehicle_id, price, currency,
          vehicle:transport_vehicles(
            id, title, provider_name, vehicle_type, seats,
            image_url, media, car_brand, car_model, car_year,
            transmission, fuel_type, key_features, exterior_images,
            is_published
          )
        `);
      if (error) throw error;
      return (data as AirportPricing[]) || [];
    },
    enabled: airportRoutes.length > 0,
  });

  // Group and rank routes by relevance
  const regionTokens = useMemo(
    () => nearbyRegion
      .split(/[\s,]+/)
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token.length > 2),
    [nearbyRegion]
  );

  const strictLocationMode = Boolean(nearby) && regionTokens.length > 0;

  const scoreText = useCallback((text: string) => {
    if (regionTokens.length === 0) return 0;
    const haystack = text.toLowerCase();
    return regionTokens.reduce((sum, token) => (haystack.includes(token) ? sum + 1 : sum), 0);
  }, [regionTokens]);

  const scoreRoute = useCallback((route: { from_location: string; to_location: string }) => {
    if (regionTokens.length === 0) return 0;
    const haystack = `${route.from_location || ""} ${route.to_location || ""}`.toLowerCase();
    return regionTokens.reduce((sum, token) => (haystack.includes(token) ? sum + 1 : sum), 0);
  }, [regionTokens]);

  const rankedRoutes = useMemo(() => {
    const scored = airportRoutes
      .map((route) => ({ route, score: scoreRoute(route) }))
      .sort((a, b) => {
        const byScore = b.score - a.score;
        if (byScore !== 0) return byScore;
        return Number(a.route.base_price ?? 0) - Number(b.route.base_price ?? 0);
      });

    if (!strictLocationMode) {
      return scored.map((item) => item.route);
    }

    const matched = scored.filter((item) => item.score > 0);
    const source = matched.length > 0 ? matched : scored;
    return source.map((item) => item.route);
  }, [airportRoutes, scoreRoute, strictLocationMode]);

  const airportRouteById = useMemo(
    () => new Map(rankedRoutes.map((route) => [route.id, route] as const)),
    [rankedRoutes]
  );

  const airportVehicles = useMemo(() => {
    const grouped = new Map<
      string,
      {
        vehicle: TransportVehicleRow;
        options: Array<{ pricingId: string; route: AirportRoute; price: number; currency: string | null }>;
      }
    >();

    for (const pricing of airportPricing) {
      const vehicleRow = pricing.vehicle as TransportVehicleRow | null;
      const route = airportRouteById.get(pricing.route_id);
      if (!vehicleRow || !route || (vehicleRow as any).is_published === false) continue;

      const current = grouped.get(vehicleRow.id);
      if (!current) {
        grouped.set(vehicleRow.id, {
          vehicle: vehicleRow,
          options: [{ pricingId: pricing.id, route, price: Number(pricing.price || 0), currency: pricing.currency }],
        });
      } else {
        current.options.push({ pricingId: pricing.id, route, price: Number(pricing.price || 0), currency: pricing.currency });
      }
    }

    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        options: entry.options.sort((a, b) => a.price - b.price),
      }))
      .sort((a, b) => {
        const aMin = a.options[0]?.price ?? Number.MAX_SAFE_INTEGER;
        const bMin = b.options[0]?.price ?? Number.MAX_SAFE_INTEGER;
        return aMin - bMin;
      });
  }, [airportPricing, airportRouteById]);
  const intercityRoutes = useMemo(() => {
    const scored = [...routes]
      .filter(r => !(r.from_location?.toLowerCase().includes("airport") || r.to_location?.toLowerCase().includes("airport")))
      .map((route) => ({ route, score: scoreRoute(route) }))
      .sort((a, b) => {
        const byScore = b.score - a.score;
        if (byScore !== 0) return byScore;
        return Number(a.route.base_price ?? 0) - Number(b.route.base_price ?? 0);
      });

    if (!strictLocationMode) {
      return scored.map((item) => item.route);
    }

    const matched = scored.filter((item) => item.score > 0);
    const source = matched.length > 0 ? matched : scored;
    return source.map((item) => item.route);
  }, [routes, scoreRoute, strictLocationMode]);

  const displayAirportVehicles = useMemo(() => {
    if (!query.trim()) return airportVehicles;
    const q = query.trim().toLowerCase();
    return airportVehicles.filter(({ vehicle, options }) => {
      const vehicleText = `${vehicle.title || ""} ${vehicle.provider_name || ""} ${vehicle.car_brand || ""} ${vehicle.car_model || ""} ${vehicle.vehicle_type || ""}`.toLowerCase();
      const routesText = options.map((opt) => `${opt.route.from_location} ${opt.route.to_location}`).join(" ").toLowerCase();
      return vehicleText.includes(q) || routesText.includes(q);
    });
  }, [airportVehicles, query]);

  const displayIntercityRoutes = useMemo(() => {
    const source = intercityRoutes.length > 0 ? intercityRoutes : DEFAULT_INTERCITY_ROUTES;
    let list = source;

    if (intercityDestinationFilter !== "all") {
      list = list.filter((r) => {
        const combined = `${r.from_location} ${r.to_location}`.toLowerCase();
        if (intercityDestinationFilter === "gisenyi") {
          return combined.includes("gisenyi") || combined.includes("rubavu");
        }
        if (intercityDestinationFilter === "musanze") {
          return combined.includes("musanze") || combined.includes("ruhengeri");
        }
        if (intercityDestinationFilter === "karongi") {
          return combined.includes("karongi") || combined.includes("kibuye");
        }
        if (intercityDestinationFilter === "huye") {
          return combined.includes("huye") || combined.includes("butare");
        }
        if (intercityDestinationFilter === "akagera") {
          return combined.includes("akagera");
        }
        return true;
      });
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => {
        const meta = getRouteMeta(r.from_location, r.to_location);
        const text = `${r.from_location} ${r.to_location} ${meta.tag} ${meta.highlight} ${meta.distance} ${meta.duration}`.toLowerCase();
        return text.includes(q);
      });
    }

    return list;
  }, [intercityRoutes, intercityDestinationFilter, query]);

  const filteredServices = useMemo(() => {
    const scored = services
      .map((service) => ({
        service,
        score: scoreText(`${service.title || ""} ${service.description || ""}`),
      }))
      .sort((a, b) => b.score - a.score);

    let list = !strictLocationMode
      ? scored.map((item) => item.service)
      : (scored.filter((item) => item.score > 0).length > 0
          ? scored.filter((item) => item.score > 0).map((item) => item.service)
          : scored.map((item) => item.service));

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((s) => {
        const text = `${s.title || ""} ${s.description || ""}`.toLowerCase();
        return text.includes(q);
      });
    }

    return list;
  }, [services, scoreText, strictLocationMode, query]);

  const filteredVehicles = useMemo(() => {
    const scored = vehicles
      .map((vehicleRow) => ({
        vehicleRow,
        score: scoreText(
          `${vehicleRow.provider_name || ""} ${vehicleRow.title || ""} ${vehicleRow.car_brand || ""} ${vehicleRow.car_model || ""}`
        ),
      }))
      .sort((a, b) => b.score - a.score);

    let list = !strictLocationMode
      ? scored.map((item) => item.vehicleRow)
      : (scored.filter((item) => item.score > 0).length > 0
          ? scored.filter((item) => item.score > 0).map((item) => item.vehicleRow)
          : scored.map((item) => item.vehicleRow));

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((v) => {
        const text = `${v.title || ""} ${v.provider_name || ""} ${v.car_brand || ""} ${v.car_model || ""} ${v.vehicle_type || ""}`.toLowerCase();
        return text.includes(q);
      });
    }

    return list;
  }, [vehicles, scoreText, strictLocationMode, query]);

  const addToCart = async (payload: { item_type: string; reference_id: string }) => {
    const hasExistingCartItems = user ? tripCartCount > 0 : guestCart.length > 0;

    if (!hasExistingCartItems) {
      const params = new URLSearchParams({
        mode: "transport",
        itemType: payload.item_type,
        referenceId: payload.reference_id,
      });
      navigate(`/checkout?${params.toString()}`);
      return;
    }

    const ok = await addCartItem(payload.item_type as any, payload.reference_id, 1);
    if (!ok) return;

    toast({ title: t("common.addedToCart") });
  };

  const handleOpenBookingModal = (r: TransportRouteRow) => {
    setBookingModalRoute(r);
    setTripType("one_way");
    setPickupAddress("");
    setDropoffAddress("");
    setPassengers(1);
    setLuggageCount(1);
    setSpecialNotes("");
  };

  const handleConfirmIntercityBooking = async (action: "cart" | "checkout") => {
    if (!bookingModalRoute) return;
    setIsSubmittingBooking(true);
    try {
      let targetId = bookingModalRoute.id;

      // If this is a fallback client preset id, ensure a matching route exists in DB
      if (bookingModalRoute.id.startsWith("preset-")) {
        const fromKeyword = bookingModalRoute.from_location.split(" ")[0];
        const toKeyword = bookingModalRoute.to_location.split(" ")[0];

        const { data: existing } = await supabase
          .from("transport_routes")
          .select("id")
          .ilike("from_location", `%${fromKeyword}%`)
          .ilike("to_location", `%${toKeyword}%`)
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          targetId = existing.id;
        } else {
          // Create route so checkout can reference it
          const { data: created, error: createErr } = await supabase
            .from("transport_routes")
            .insert({
              from_location: bookingModalRoute.from_location,
              to_location: bookingModalRoute.to_location,
              base_price: Number(bookingModalRoute.base_price || 60000),
              currency: bookingModalRoute.currency || "RWF",
              is_published: true,
            })
            .select("id")
            .single();

          if (!createErr && created?.id) {
            targetId = created.id;
          }
        }
      }

      const metadata = {
        pickup_date: pickupDate,
        pickup_time: pickupTime,
        pickup_address: pickupAddress.trim() || bookingModalRoute.from_location,
        dropoff_address: dropoffAddress.trim() || bookingModalRoute.to_location,
        passengers,
        luggage_count: luggageCount,
        is_round_trip: tripType === "round_trip",
        return_date: tripType === "round_trip" ? returnDate : undefined,
        return_time: tripType === "round_trip" ? returnTime : undefined,
        notes: specialNotes.trim() || undefined,
      };

      const quantity = tripType === "round_trip" ? 2 : 1;
      const ok = await addCartItem("transport_route" as any, targetId, quantity, metadata);

      if (action === "checkout") {
        setBookingModalRoute(null);
        navigate("/checkout");
      } else {
        toast({
          title: t("common.addedToCart", "Added to trip cart"),
          description: `${bookingModalRoute.from_location} → ${bookingModalRoute.to_location} (${pickupDate} at ${pickupTime})`,
        });
        setBookingModalRoute(null);
      }
    } catch (err) {
      console.error("Error booking intercity ride:", err);
      toast({
        variant: "destructive",
        title: "Booking error",
        description: "Could not add route to booking. Please try again.",
      });
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <div className="py-12 text-center">
        <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-2">{t("transport.title")}</h1>
        <p className="text-muted-foreground">{t("transport.subtitle")}</p>
      </div>

      {/* Category Cards */}
      <div className="container mx-auto px-4 lg:px-8 mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {transportCategories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`p-6 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]"
                    : "bg-card hover:bg-card/80 shadow-card hover:shadow-md"
                }`}
              >
                <Icon className={`w-8 h-8 mb-3 ${isActive ? "text-primary-foreground" : "text-primary"}`} />
                <h3 className={`font-semibold mb-1 ${isActive ? "text-primary-foreground" : "text-foreground"}`}>
                  {t(cat.labelKey)}
                </h3>
                <p className={`text-sm ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {t(cat.descKey)}
                </p>
              </button>
            );
          })}
        </div>
        {activeCategory !== "all" && (
          <div className="text-center mt-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveCategory("all")}>
              {t("transport.showAll")}
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="container mx-auto px-4 lg:px-8 mb-12">
        <div className="bg-card rounded-xl shadow-card p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4 max-w-3xl mx-auto border border-border/60">
          <div className="flex-1 flex items-center gap-2 px-4">
            <div className="w-full">
              <div className="mb-1 text-xs font-semibold text-primary">Merry AI Search</div>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Search destinations (e.g. Kigali, Gisenyi, Musanze, Karongi, Airport...)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      runSearch();
                    }
                  }}
                  className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm"
                />
                {query.trim() && (
                  <button
                    onClick={() => {
                      setQuery("");
                      const params = new URLSearchParams(searchParams);
                      params.delete("q");
                      navigate({ search: params.toString() }, { replace: true });
                    }}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {activeCategory === "car_rental" && (
              <select
                className="bg-transparent text-sm text-muted-foreground focus:outline-none"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
              >
                <option value={ALL_VEHICLES_VALUE}>{t("transport.vehicles.all")}</option>
                <option value="Sedan">{t("transport.vehicles.sedan")}</option>
                <option value="SUV">{t("transport.vehicles.suv")}</option>
                <option value="Van">{t("transport.vehicles.van")}</option>
                <option value="4x4">{t("transport.vehicles.fourByFour")}</option>
                <option value="Luxury">{t("transport.vehicles.luxury")}</option>
              </select>
            )}
            <Button variant="search" className="gap-2" type="button" onClick={runSearch}>
              <Search className="w-4 h-4" />
              {t("common.search")}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {!vehiclesLoading && !routesLoading && !airportRoutesLoading ? (
        <>
          {/* Airport Transfers */}
          {(activeCategory === "all" || activeCategory === "airport_transfer") && (
            <div className="container mx-auto px-4 lg:px-8 pb-12">
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Plane className="w-6 h-6 text-primary" />
                {t("transport.airportTransfers")}
              </h2>
              {airportRoutes.length === 0 ? (
                <div className="bg-card rounded-xl p-8 shadow-card text-center">
                  <Plane className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">{t("transport.noAirportRoutes")}</p>
                </div>
              ) : displayAirportVehicles.length === 0 ? (
                <div className="bg-card rounded-xl p-8 shadow-card text-center">
                  <Plane className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No vehicles available matching your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayAirportVehicles.map(({ vehicle, options }) => {
                    const allImages = vehicle.exterior_images?.length
                      ? vehicle.exterior_images
                      : (vehicle.media?.length ? vehicle.media : (vehicle.image_url ? [vehicle.image_url] : []));
                    const minOption = options[0];
                    const isExpanded = expandedAirportVehicleId === vehicle.id;
                    const filteredOptions = options.filter((option) => {
                      const fromHasAirport = option.route.from_location?.toLowerCase().includes("airport");
                      const toHasAirport = option.route.to_location?.toLowerCase().includes("airport");
                      return airportDirectionFilter === "from" ? fromHasAirport : toHasAirport;
                    });
                    const visibleOptions = filteredOptions.length > 0 ? filteredOptions : options;

                    return (
                      <div key={vehicle.id} className="bg-card rounded-xl shadow-card overflow-hidden border">
                        {allImages.length > 0 && (
                          <div className="aspect-video relative">
                            <img
                              src={optimizeCloudinaryImage(allImages[0], { width: 640, height: 360, quality: "auto", format: "auto" })}
                              alt={vehicle.title || ""}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                        )}

                        <div className="p-4">
                          <h4 className="font-semibold text-base">
                            {vehicle.car_brand} {vehicle.car_model} {vehicle.car_year}
                          </h4>
                          {vehicle.provider_name && (
                            <p className="text-xs text-muted-foreground mt-1">{vehicle.provider_name}</p>
                          )}

                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                            <Users className="w-3 h-3" />
                            <span>{vehicle.seats || 4} seats</span>
                            {vehicle.transmission && (
                              <>
                                <span>•</span>
                                <span>{vehicle.transmission}</span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Starting from</p>
                              <p className="font-bold text-primary">{displayMoney(minOption.price, minOption.currency)}</p>
                            </div>
                            <Badge variant="secondary">{options.length} routes</Badge>
                          </div>

                          <Button
                            variant="outline"
                            className="w-full mt-3 flex items-center justify-between"
                            onClick={() => setExpandedAirportVehicleId(isExpanded ? null : vehicle.id)}
                          >
                            <span>{isExpanded ? "Hide routes" : "Select route"}</span>
                            <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          </Button>

                          {isExpanded && (
                            <div className="mt-3">
                              <div className="mb-2 inline-flex rounded-md border p-1 bg-muted/30">
                                <Button
                                  size="sm"
                                  variant={airportDirectionFilter === "from" ? "default" : "ghost"}
                                  className="h-7 px-3 text-xs"
                                  onClick={() => setAirportDirectionFilter("from")}
                                >
                                  From Airport
                                </Button>
                                <Button
                                  size="sm"
                                  variant={airportDirectionFilter === "to" ? "default" : "ghost"}
                                  className="h-7 px-3 text-xs"
                                  onClick={() => setAirportDirectionFilter("to")}
                                >
                                  To Airport
                                </Button>
                              </div>

                              <div className="border rounded-lg divide-y">
                              {visibleOptions.map((option) => {
                                const routeDetails = calculateRouteDetails(
                                  option.route.from_location,
                                  option.route.to_location,
                                  option.route.distance_km
                                );

                                return (
                                  <div key={option.pricingId} className="p-3.5 flex items-start justify-between gap-3 hover:bg-muted/20 transition-colors">
                                    <div>
                                      <p className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                                        <span>{option.route.from_location}</span>
                                        <ArrowLeftRight className="w-3 h-3 text-muted-foreground" />
                                        <span>{option.route.to_location}</span>
                                      </p>
                                      <div className="flex items-center gap-2 mt-1 text-xs">
                                        <span className="font-semibold text-foreground/80">{routeDetails.distanceFormatted}</span>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="flex items-center gap-1 text-primary font-medium">
                                          <Clock className="w-3 h-3 text-primary shrink-0" />
                                          {routeDetails.durationFormatted} drive
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-sm font-bold text-primary">{displayMoney(option.price, option.currency)}</p>
                                      <Button
                                        size="sm"
                                        className="mt-1 h-8 px-3 font-semibold text-xs"
                                        onClick={() => addToCart({ item_type: "airport_transfer_pricing", reference_id: option.pricingId })}
                                      >
                                        Book
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Intracity Rides */}
          {(activeCategory === "all" || activeCategory === "intracity") && (
            <div className="container mx-auto px-4 lg:px-8 pb-12">
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Building2 className="w-6 h-6 text-primary" />
                Intracity Rides
              </h2>
              {filteredServices.length === 0 ? (
                <div className="bg-card rounded-xl p-8 shadow-card text-center">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No intracity ride services available yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {filteredServices.map((s) => (
                    <div key={s.id} className="bg-card rounded-xl shadow-card p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{s.title}</div>
                          <div className="text-sm text-muted-foreground">{s.description}</div>
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => addToCart({ item_type: "transport_service", reference_id: s.id })}
                      >
                        Book Ride
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Intercity Rides */}
          {(activeCategory === "all" || activeCategory === "intercity") && (
            <div className="container mx-auto px-4 lg:px-8 pb-16">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                  <div className="flex items-center gap-2 text-primary font-medium text-sm mb-1">
                    <Navigation className="w-4 h-4" />
                    <span>City-to-City Private Transfers</span>
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
                    <MapIcon className="w-7 h-7 text-primary" />
                    Intercity Rides in Rwanda
                  </h2>
                  <p className="text-muted-foreground mt-1 max-w-xl text-sm">
                    Comfortable, private door-to-door rides across Rwanda. Travel seamlessly between Kigali, Gisenyi (Lake Kivu), Musanze (Volcanoes), Karongi, and beyond.
                  </p>
                </div>

                {/* Quick filter destination chips */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "all", label: "All Routes" },
                    { id: "gisenyi", label: "Kigali ⇄ Gisenyi / Rubavu" },
                    { id: "musanze", label: "Kigali ⇄ Musanze" },
                    { id: "karongi", label: "Kigali ⇄ Karongi" },
                    { id: "huye", label: "Kigali ⇄ Huye" },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => setIntercityDestinationFilter(chip.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        intercityDestinationFilter === chip.id
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {displayIntercityRoutes.length === 0 ? (
                <div className="bg-card rounded-2xl p-10 shadow-card text-center border">
                  <MapIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-base font-semibold text-foreground">No routes found for this filter</p>
                  <p className="text-sm text-muted-foreground mt-1">Try switching to "All Routes" to view all available journeys.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setIntercityDestinationFilter("all")}>
                    Show All Routes
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayIntercityRoutes.map((r) => {
                    const meta = getRouteMeta(r.from_location, r.to_location);
                    const isBooking = bookingRouteId === r.id;

                    return (
                      <div
                        key={r.id}
                        className="group bg-card rounded-2xl border border-border/80 shadow-card hover:shadow-md transition-all duration-200 p-6 flex flex-col justify-between hover:border-primary/40 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <Badge variant="secondary" className="text-[11px] font-medium bg-primary/10 text-primary border-0">
                              {meta.tag}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              {meta.duration} • {meta.distance}
                            </span>
                          </div>

                          <div className="flex items-start gap-3 my-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                              <ArrowLeftRight className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-base font-bold text-foreground leading-snug">
                                {r.from_location} <span className="text-primary font-normal">→</span> {r.to_location}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {meta.highlight}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground my-4 bg-muted/40 p-2.5 rounded-lg">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                              <span>Door-to-door pickup</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                              <span>Private A/C vehicle</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                              <span>Luggage space</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                              <span>Professional driver</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t flex items-center justify-between gap-4 mt-2">
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">One-way private ride</div>
                            <div className="text-lg font-bold text-foreground">
                              {displayMoney(Number(r.base_price), String(r.currency ?? "RWF"))}
                            </div>
                          </div>

                          <Button
                            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-semibold text-xs px-4"
                            onClick={() => handleOpenBookingModal(r)}
                          >
                            Book Ride
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Car Rentals */}
          {(activeCategory === "all" || activeCategory === "car_rental") && (
            <div className="container mx-auto px-4 lg:px-8 pb-16">
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Key className="w-6 h-6 text-primary" />
                {t("transport.categories.carRental")}
              </h2>
              {vehiclesError ? (
                <div className="text-center py-12">
                  <Frown className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{t("transport.couldNotLoadVehicles")}</p>
                </div>
              ) : filteredVehicles.length === 0 ? (
                <div className="bg-card rounded-xl p-8 shadow-card text-center">
                  <Key className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">{t("transport.noRentalVehicles")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredVehicles.map((v) => {
                    // Determine if verified (has all required docs)
                    const isVerified = !!(v.insurance_document_url && v.registration_document_url && v.roadworthiness_certificate_url);
                    // Get all images
                    const allImages = [
                      ...(v.exterior_images || []),
                      ...(v.interior_images || []),
                      ...(v.media || []),
                      v.image_url
                    ].filter(Boolean) as string[];
                    // Car title
                    const carTitle = v.car_brand && v.car_model 
                      ? `${v.car_brand} ${v.car_model}${v.car_year ? ` ${v.car_year}` : ''}`
                      : v.title;
                    
                    return (
                      <div
                        key={v.id}
                        className="group rounded-xl overflow-hidden bg-card shadow-card hover:shadow-lg transition-all duration-300 animate-fade-in"
                      >
                        {/* Image Carousel */}
                        <div className="relative aspect-[4/3] overflow-hidden">
                          {allImages.length > 0 ? (
                            <ListingImageCarousel
                              images={allImages}
                              alt={carTitle}
                              className="w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-muted via-muted/70 to-muted/40 flex items-center justify-center">
                              <Car className="w-16 h-16 text-muted-foreground/50" />
                            </div>
                          )}
                          {/* Car type badge */}
                          <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-background/90 backdrop-blur-sm text-xs font-medium">
                            {v.car_type || v.vehicle_type}
                          </span>
                          {/* Verified badge */}
                          {isVerified && (
                            <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-green-500/90 text-white text-xs font-medium flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              Verified
                            </span>
                          )}
                        </div>

                        <div className="p-4 space-y-3">
                          {/* Title & Provider */}
                          <div>
                            <h3 className="font-semibold text-foreground line-clamp-1">{carTitle}</h3>
                            {v.provider_name && (
                              <p className="text-xs text-muted-foreground">{v.provider_name}</p>
                            )}
                          </div>

                          {/* Specs Row */}
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {v.seats && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {v.seats} seats
                              </span>
                            )}
                            {v.transmission && (
                              <span className="flex items-center gap-1">
                                <Settings className="w-3 h-3" />
                                {v.transmission}
                              </span>
                            )}
                            {v.fuel_type && (
                              <span className="flex items-center gap-1">
                                <Fuel className="w-3 h-3" />
                                {v.fuel_type}
                              </span>
                            )}
                            {v.drive_train && (
                              <span className="bg-muted px-2 py-0.5 rounded">
                                {v.drive_train}
                              </span>
                            )}
                          </div>

                          {/* Key Features */}
                          {v.key_features && v.key_features.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {v.key_features.slice(0, 4).map((feature) => (
                                <Badge key={feature} variant="secondary" className="text-xs py-0">
                                  {feature}
                                </Badge>
                              ))}
                              {v.key_features.length > 4 && (
                                <Badge variant="outline" className="text-xs py-0">
                                  +{v.key_features.length - 4} more
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Driver included */}
                          <p className="text-sm text-muted-foreground">
                            {v.driver_included ? "✓ Driver included" : "Self drive"}
                          </p>

                          {/* Pricing */}
                          <div className="space-y-1 pt-2 border-t border-border">
                            <div className="flex items-baseline justify-between">
                              <span className="text-foreground font-bold text-lg">
                                {displayMoney(Number(v.daily_price || v.price_per_day), String(v.currency ?? "RWF"))}
                              </span>
                              <span className="text-sm text-muted-foreground">{t("common.perDay")}</span>
                            </div>
                            {(v.weekly_price || v.monthly_price) && (
                              <div className="flex gap-3 text-xs text-muted-foreground">
                                {v.weekly_price && (
                                  <span>{displayMoney(Number(v.weekly_price), String(v.currency ?? "RWF"))}{t("common.perWeek")}</span>
                                )}
                                {v.monthly_price && (
                                  <span>{displayMoney(Number(v.monthly_price), String(v.currency ?? "RWF"))}{t("common.perMonth")}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action */}
                          <Button
                            className="w-full"
                            onClick={() => addToCart({ item_type: "transport_vehicle", reference_id: v.id })}
                          >
                            {t("transport.rentNow")}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      ) : null}

      {/* Intercity Ride Booking Modal */}
      <Dialog
        open={!!bookingModalRoute}
        onOpenChange={(open) => {
          if (!open && !isSubmittingBooking) {
            setBookingModalRoute(null);
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl">
          {bookingModalRoute && (() => {
            const meta = getRouteMeta(bookingModalRoute.from_location, bookingModalRoute.to_location);
            const basePrice = Number(bookingModalRoute.base_price || 60000);
            const multiplier = tripType === "round_trip" ? 2 : 1;
            const totalPrice = basePrice * multiplier;
            const currency = bookingModalRoute.currency || "RWF";

            return (
              <div className="space-y-5">
                <DialogHeader className="text-left space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary font-semibold text-xs border-0">
                      {meta.tag}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {meta.duration} • {meta.distance}
                    </span>
                  </div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                    <span>{bookingModalRoute.from_location}</span>
                    <ArrowLeftRight className="w-4 h-4 text-primary shrink-0" />
                    <span>{bookingModalRoute.to_location}</span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {meta.highlight}. Door-to-door private transfer with professional driver and air-conditioned vehicle.
                  </DialogDescription>
                </DialogHeader>

                {/* Trip Type Selector */}
                <div className="bg-muted/50 p-1 rounded-xl grid grid-cols-2 gap-1 border">
                  <button
                    type="button"
                    onClick={() => setTripType("one_way")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                      tripType === "one_way"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    One-Way Ride
                  </button>
                  <button
                    type="button"
                    onClick={() => setTripType("round_trip")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                      tripType === "round_trip"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Round-Trip (Return)
                  </button>
                </div>

                {/* Booking Inputs */}
                <div className="space-y-4 text-sm">
                  {/* Dates & Times */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1.5">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        {tripType === "round_trip" ? "Departure Date *" : "Travel Date *"}
                      </Label>
                      <Input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        Pickup Time *
                      </Label>
                      <Input
                        type="time"
                        value={pickupTime}
                        onChange={(e) => setPickupTime(e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>

                  {tripType === "round_trip" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/30 rounded-xl border">
                      <div>
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1.5">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          Return Date *
                        </Label>
                        <Input
                          type="date"
                          min={pickupDate || new Date().toISOString().split("T")[0]}
                          value={returnDate}
                          onChange={(e) => setReturnDate(e.target.value)}
                          className="text-xs h-9 bg-background"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1.5">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          Return Time *
                        </Label>
                        <Input
                          type="time"
                          value={returnTime}
                          onChange={(e) => setReturnTime(e.target.value)}
                          className="text-xs h-9 bg-background"
                        />
                      </div>
                    </div>
                  )}

                  {/* Pickup & Drop-off Addresses */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        Pickup Address in {bookingModalRoute.from_location} *
                      </Label>
                      <Input
                        placeholder={`e.g. Hotel, Airport, or Street address in ${bookingModalRoute.from_location}`}
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1.5">
                        <Navigation className="w-3.5 h-3.5 text-primary" />
                        Drop-off Address in {bookingModalRoute.to_location} *
                      </Label>
                      <Input
                        placeholder={`e.g. Hotel, Resort, or Street address in ${bookingModalRoute.to_location}`}
                        value={dropoffAddress}
                        onChange={(e) => setDropoffAddress(e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>

                  {/* Passengers & Luggage */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        Passengers
                      </Label>
                      <select
                        value={passengers}
                        onChange={(e) => setPassengers(Number(e.target.value))}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                          <option key={num} value={num}>
                            {num} {num === 1 ? "Passenger" : "Passengers"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1.5">
                        <Luggage className="w-3.5 h-3.5 text-primary" />
                        Luggage Pieces
                      </Label>
                      <select
                        value={luggageCount}
                        onChange={(e) => setLuggageCount(Number(e.target.value))}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {[0, 1, 2, 3, 4, 5, 6, 8].map((num) => (
                          <option key={num} value={num}>
                            {num} {num === 1 ? "Bag" : "Bags"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Special Notes */}
                  <div>
                    <Label className="text-xs font-semibold text-foreground mb-1.5 block">
                      Special Requests / Notes (Optional)
                    </Label>
                    <Textarea
                      placeholder="Any flight numbers, landmark directions, child seats, or special timing notes..."
                      value={specialNotes}
                      onChange={(e) => setSpecialNotes(e.target.value)}
                      className="text-xs min-h-[60px]"
                    />
                  </div>
                </div>

                {/* Included Amenities Badge Row */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-xl border">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                    <span>Private A/C Vehicle</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                    <span>Door-to-door Pickup</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                    <span>Fuel & Toll Fees Included</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                    <span>Free Waiting up to 30 mins</span>
                  </div>
                </div>

                {/* Price Breakdown & Actions */}
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground font-medium">
                        {tripType === "round_trip" ? "Total for Round-Trip" : "Total for One-Way Ride"}
                      </div>
                      <div className="text-2xl font-extrabold text-foreground">
                        {displayMoney(totalPrice, currency)}
                      </div>
                    </div>
                    {tripType === "round_trip" && (
                      <Badge variant="secondary" className="text-xs">
                        2x Single Ride
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      type="button"
                      disabled={isSubmittingBooking}
                      onClick={() => handleConfirmIntercityBooking("cart")}
                      className="text-xs font-semibold h-11"
                    >
                      {isSubmittingBooking ? "Saving..." : "Add to Trip Cart"}
                    </Button>
                    <Button
                      type="button"
                      disabled={isSubmittingBooking}
                      onClick={() => handleConfirmIntercityBooking("checkout")}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-11 shadow-sm"
                    >
                      {isSubmittingBooking ? "Processing..." : "Book & Checkout Now"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Transport;
