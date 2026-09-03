import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Navigation, 
  ExternalLink, 
  Layers, 
  Maximize2, 
  Minimize2, 
  Copy, 
  Check, 
  ShieldCheck, 
  Compass,
  Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PropertyMapProps {
  title: string;
  location: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  imageUrl?: string | null;
  pricePerNight?: number | null;
  currency?: string | null;
  showBoundary?: boolean;
  boundaryRadiusMeters?: number;
  className?: string;
}

// Smart geographic coordinate dictionary for East African & International destinations
export function resolvePropertyCoordinates(
  latitude?: number | null,
  longitude?: number | null,
  lat?: number | null,
  lng?: number | null,
  locationStr?: string | null,
  addressStr?: string | null
): { lat: number; lng: number; isEstimated: boolean; areaName: string } {
  const explicitLat = Number(latitude ?? lat);
  const explicitLng = Number(longitude ?? lng);

  if (Number.isFinite(explicitLat) && Number.isFinite(explicitLng) && (explicitLat !== 0 || explicitLng !== 0)) {
    return {
      lat: explicitLat,
      lng: explicitLng,
      isEstimated: false,
      areaName: addressStr || locationStr || "Property Location",
    };
  }

  const query = `${locationStr || ""} ${addressStr || ""}`.toLowerCase();

  // Zanzibar & Tanzania locations
  if (query.includes("paje")) {
    return { lat: -6.2657, lng: 39.5339, isEstimated: true, areaName: "Paje Beach, Zanzibar" };
  }
  if (query.includes("nungwi")) {
    return { lat: -5.7262, lng: 39.2978, isEstimated: true, areaName: "Nungwi Beach, Zanzibar" };
  }
  if (query.includes("kendwa")) {
    return { lat: -5.7547, lng: 39.2889, isEstimated: true, areaName: "Kendwa Beach, Zanzibar" };
  }
  if (query.includes("stone town") || query.includes("stonetown") || query.includes("shangani")) {
    return { lat: -6.1639, lng: 39.1894, isEstimated: true, areaName: "Stone Town, Zanzibar" };
  }
  if (query.includes("kiwengwa") || query.includes("urua")) {
    return { lat: -5.9926, lng: 39.3789, isEstimated: true, areaName: "Kiwengwa Beach, Zanzibar" };
  }
  if (query.includes("jambiani")) {
    return { lat: -6.3197, lng: 39.5469, isEstimated: true, areaName: "Jambiani Beach, Zanzibar" };
  }
  if (query.includes("matemwe")) {
    return { lat: -5.8692, lng: 39.3514, isEstimated: true, areaName: "Matemwe, Zanzibar" };
  }
  if (query.includes("zanzibar")) {
    return { lat: -6.1659, lng: 39.2026, isEstimated: true, areaName: "Zanzibar Island, Tanzania" };
  }
  if (query.includes("arusha")) {
    return { lat: -3.3869, lng: 36.6830, isEstimated: true, areaName: "Arusha, Tanzania" };
  }
  if (query.includes("serengeti")) {
    return { lat: -2.3333, lng: 34.8333, isEstimated: true, areaName: "Serengeti National Park, Tanzania" };
  }
  if (query.includes("kilimanjaro") || query.includes("moshi")) {
    return { lat: -3.3411, lng: 37.3402, isEstimated: true, areaName: "Moshi, Mount Kilimanjaro" };
  }
  if (query.includes("dar es salaam") || query.includes("daressalaam")) {
    return { lat: -6.7924, lng: 39.2083, isEstimated: true, areaName: "Dar es Salaam, Tanzania" };
  }

  // Rwanda locations
  if (query.includes("kiyovu")) {
    return { lat: -1.9567, lng: 30.0615, isEstimated: true, areaName: "Kiyovu, Kigali" };
  }
  if (query.includes("nyarutarama")) {
    return { lat: -1.9367, lng: 30.0983, isEstimated: true, areaName: "Nyarutarama, Kigali" };
  }
  if (query.includes("kacyiru")) {
    return { lat: -1.9352, lng: 30.0815, isEstimated: true, areaName: "Kacyiru, Kigali" };
  }
  if (query.includes("kimihurura")) {
    return { lat: -1.9529, lng: 30.0864, isEstimated: true, areaName: "Kimihurura, Kigali" };
  }
  if (query.includes("gisozi")) {
    return { lat: -1.9214, lng: 30.0573, isEstimated: true, areaName: "Gisozi, Kigali" };
  }
  if (query.includes("rebero")) {
    return { lat: -1.9962, lng: 30.0784, isEstimated: true, areaName: "Rebero, Kigali" };
  }
  if (query.includes("kanombe") || query.includes("airport")) {
    return { lat: -1.9686, lng: 30.1345, isEstimated: true, areaName: "Kanombe Airport Area, Kigali" };
  }
  if (query.includes("kigali")) {
    return { lat: -1.9441, lng: 30.0619, isEstimated: true, areaName: "Kigali, Rwanda" };
  }
  if (query.includes("musanze") || query.includes("ruhengeri") || query.includes("volcanoes") || query.includes("kinigi")) {
    return { lat: -1.4998, lng: 29.6349, isEstimated: true, areaName: "Musanze / Volcanoes National Park, Rwanda" };
  }
  if (query.includes("gisenyi") || query.includes("rubavu") || query.includes("kivu")) {
    return { lat: -1.6967, lng: 29.2564, isEstimated: true, areaName: "Gisenyi, Lake Kivu, Rwanda" };
  }
  if (query.includes("kibuye") || query.includes("karongi")) {
    return { lat: -2.0603, lng: 29.3486, isEstimated: true, areaName: "Karongi, Lake Kivu, Rwanda" };
  }
  if (query.includes("nyungwe") || query.includes("rusizi") || query.includes("cyangugu")) {
    return { lat: -2.4842, lng: 29.1764, isEstimated: true, areaName: "Nyungwe Forest / Rusizi, Rwanda" };
  }
  if (query.includes("akagera")) {
    return { lat: -1.8833, lng: 30.7167, isEstimated: true, areaName: "Akagera National Park, Rwanda" };
  }
  if (query.includes("rwamagana") || query.includes("muhazi")) {
    return { lat: -1.9487, lng: 30.4347, isEstimated: true, areaName: "Lake Muhazi / Rwamagana, Rwanda" };
  }

  // Kenya & Uganda
  if (query.includes("nairobi") || query.includes("westlands") || query.includes("karen")) {
    return { lat: -1.2921, lng: 36.8219, isEstimated: true, areaName: "Nairobi, Kenya" };
  }
  if (query.includes("mombasa") || query.includes("diani")) {
    return { lat: -4.0435, lng: 39.6682, isEstimated: true, areaName: "Mombasa / Diani Beach, Kenya" };
  }
  if (query.includes("kampala") || query.includes("entebbe")) {
    return { lat: 0.3476, lng: 32.5825, isEstimated: true, areaName: "Kampala, Uganda" };
  }

  // Default fallback
  return { lat: -1.9441, lng: 30.0619, isEstimated: true, areaName: locationStr || "Kigali, Rwanda" };
}

export function PropertyMap({
  title,
  location,
  address,
  latitude,
  longitude,
  lat,
  lng,
  imageUrl,
  showBoundary = true,
  boundaryRadiusMeters = 400,
  className = "",
}: PropertyMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapLayer, setMapLayer] = useState<"streets" | "satellite">("streets");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedCoords, setCopiedCoords] = useState<boolean>(false);
  const { toast } = useToast();

  const coords = resolvePropertyCoordinates(latitude, longitude, lat, lng, location, address);

  // Google Maps links
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  const googleDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up prior map instance if existing
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize Map
    const map = L.map(mapContainerRef.current, {
      center: [coords.lat, coords.lng],
      zoom: coords.isEstimated ? 13 : 15,
      zoomControl: true,
      scrollWheelZoom: false,
    });
    mapInstanceRef.current = map;

    // Tile layers (100% Free & Open - No API Key Required)
    const streetLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }
    );

    const satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        maxZoom: 18,
      }
    );

    if (mapLayer === "satellite") {
      satelliteLayer.addTo(map);
    } else {
      streetLayer.addTo(map);
    }

    // Layer group for marker & boundary
    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;

    // 1. Boundary circle (Neighborhood area boundary)
    if (showBoundary) {
      L.circle([coords.lat, coords.lng], {
        radius: boundaryRadiusMeters,
        color: "#e11d48",
        weight: 2,
        opacity: 0.8,
        dashArray: "6, 8",
        fillColor: "#e11d48",
        fillOpacity: 0.12,
      }).addTo(layerGroup);
    }

    // 2. Custom Brand Pin
    const customIcon = L.divIcon({
      className: "custom-property-pin-container",
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 bg-primary/25 rounded-full animate-ping"></div>
          <div class="relative flex items-center justify-center w-10 h-10 bg-primary text-white rounded-full shadow-xl border-2 border-white ring-2 ring-primary/40">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    });

    const marker = L.marker([coords.lat, coords.lng], { icon: customIcon }).addTo(layerGroup);

    // Popup content
    const popupHtml = `
      <div class="p-2 max-w-[240px] font-sans">
        ${imageUrl ? `<img src="${imageUrl}" class="w-full h-24 object-cover rounded-md mb-2 shadow-sm" alt="Property" />` : ""}
        <h4 class="font-bold text-sm text-gray-900 leading-snug">${title}</h4>
        <p class="text-xs text-gray-600 mt-1 flex items-center gap-1">
          <span>📍</span> ${address || location}
        </p>
        <div class="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between">
          <a href="${googleDirectionsUrl}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-rose-600 hover:underline flex items-center gap-1">
            Get Directions ↗
          </a>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);

    // Invalidate size after layout completes
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [coords.lat, coords.lng, mapLayer, showBoundary, boundaryRadiusMeters, title, address, location, imageUrl, googleDirectionsUrl]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);
  };

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
    setCopiedCoords(true);
    toast({
      title: "Coordinates copied",
      description: `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)} copied to clipboard.`,
    });
    setTimeout(() => setCopiedCoords(false), 2500);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Map Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-bold text-foreground">Where you&apos;ll be</h2>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs gap-1">
              <Compass className="w-3 h-3" />
              {coords.areaName}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span>{address || location}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-9 bg-card hover:bg-muted"
            onClick={() => setMapLayer(mapLayer === "streets" ? "satellite" : "streets")}
          >
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{mapLayer === "streets" ? "Satellite View" : "Street Map"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-9 bg-card hover:bg-muted"
            asChild
          >
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Google Maps</span>
            </a>
          </Button>

          <Button
            size="sm"
            className="gap-1.5 text-xs h-9 shadow-sm"
            asChild
          >
            <a href={googleDirectionsUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="w-3.5 h-3.5" />
              <span>Directions</span>
            </a>
          </Button>
        </div>
      </div>

      {/* Map Container */}
      <div
        className={`relative rounded-2xl overflow-hidden border border-border shadow-sm bg-muted/40 transition-all duration-300 ${
          isFullscreen
            ? "fixed inset-4 z-50 rounded-2xl shadow-2xl h-[calc(100vh-2rem)]"
            : "h-[360px] md:h-[440px] w-full"
        }`}
      >
        {/* Leaflet DOM Anchor */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Top-Right Floating Controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-lg bg-background/90 backdrop-blur border border-border shadow-md flex items-center justify-center text-foreground hover:bg-background transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleCopyCoords}
            className="w-9 h-9 rounded-lg bg-background/90 backdrop-blur border border-border shadow-md flex items-center justify-center text-foreground hover:bg-background transition"
            title="Copy GPS coordinates"
          >
            {copiedCoords ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Bottom-Left Neighborhood Boundary Badge */}
        <div className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)]">
          <div className="bg-background/95 backdrop-blur border border-border/80 rounded-xl px-3.5 py-2 shadow-lg flex items-center gap-2.5 text-xs text-foreground">
            <div className="w-3 h-3 rounded-full bg-primary/20 border-2 border-primary shrink-0"></div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{coords.areaName} Boundary Area</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-green-600" />
                <span>Exact address & entry details sent upon booking confirmation</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Neighborhood Exploration Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
        <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Scenic Surroundings</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Convenient access to local attractions, coastal viewpoints, and authentic neighborhood spots.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-primary" />
            <span>Getting Around</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Airport transfer routes, private drivers, and rental vehicles available for seamless travel.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
            <span>Verified Neighborhood</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Safe, verified community with 24/7 host support and verified guest access protocols.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PropertyMap;
