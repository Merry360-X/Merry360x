import type { LucideIcon } from "lucide-react";
import {
  Wifi,
  Waves,
  ParkingCircle,
  Utensils,
  Dumbbell,
  Sparkles,
  Tv,
  WashingMachine,
  CookingPot,
  Cctv,
  ShieldCheck,
  CigaretteOff,
  Coffee,
  Leaf,
  Baby,
  Flame,
  Droplets,
  Monitor,
  Laptop,
  SprayCan,
  ShowerHead,
  Shirt,
  Lock,
  Thermometer,
  Fan,
  Refrigerator,
  Microwave,
  ChefHat,
  GlassWater,
  Zap,
  Mountain,
  Sunrise,
  TreePine,
  Building2,
  Accessibility,
  Presentation,
  Phone,
  Bed,
  UtensilsCrossed,
  Plus,
  CircleOff,
} from "lucide-react";

export type AmenityOption = {
  value: string; // stored in DB array
  label: string;
  icon: LucideIcon;
  category?: string;
};

export type AmenityCategory = {
  name: string;
  items: AmenityOption[];
};

const allAmenities: AmenityOption[] = [
  // Connectivity & Entertainment
  { value: "wifi", label: "Wi-Fi", icon: Wifi, category: "Entertainment" },
  { value: "tv_smart", label: "Smart TV", icon: Monitor, category: "Entertainment" },
  { value: "tv_basic", label: "Basic TV", icon: Tv, category: "Entertainment" },
  
  // Parking
  { value: "parking_free", label: "Free Parking", icon: ParkingCircle, category: "Parking" },
  { value: "parking_paid", label: "Paid Parking", icon: ParkingCircle, category: "Parking" },
  
  // Work & Storage
  { value: "workspace", label: "Dedicated Workspace", icon: Laptop, category: "Work & Storage" },
  { value: "wardrobe", label: "Wardrobe", icon: Shirt, category: "Work & Storage" },
  { value: "hangers", label: "Hangers", icon: Shirt, category: "Work & Storage" },
  { value: "safe", label: "Safe", icon: Lock, category: "Work & Storage" },
  
  // Climate Control
  { value: "ac", label: "Air Conditioning", icon: Thermometer, category: "Climate Control" },
  { value: "heating", label: "Heating", icon: Flame, category: "Climate Control" },
  { value: "fans", label: "Fans", icon: Fan, category: "Climate Control" },
  
  // Water & Bathroom
  { value: "hot_water", label: "Hot Water", icon: Droplets, category: "Bathroom" },
  { value: "toiletries", label: "Toiletries", icon: SprayCan, category: "Bathroom" },
  { value: "bathroom_essentials", label: "Bathroom Essentials", icon: ShowerHead, category: "Bathroom" },
  { value: "cleaning_items", label: "Cleaning Supplies", icon: SprayCan, category: "Bathroom" },
  
  // Bedding & Linens
  { value: "bedsheets_pillows", label: "Bed Linens & Pillows", icon: Bed, category: "Bedroom" },
  
  // Laundry
  { value: "washing_machine", label: "Washing Machine", icon: WashingMachine, category: "Laundry" },
  { value: "dryer", label: "Dryer", icon: WashingMachine, category: "Laundry" },
  { value: "iron", label: "Iron & Ironing Board", icon: Zap, category: "Laundry" },
  
  // Kitchen & Dining
  { value: "kitchen", label: "Full Kitchen", icon: CookingPot, category: "Kitchen" },
  { value: "kitchenette", label: "Kitchenette", icon: CookingPot, category: "Kitchen" },
  { value: "refrigerator", label: "Refrigerator", icon: Refrigerator, category: "Kitchen" },
  { value: "microwave", label: "Microwave", icon: Microwave, category: "Kitchen" },
  { value: "stove", label: "Stove/Cooker", icon: Flame, category: "Kitchen" },
  { value: "oven", label: "Oven", icon: ChefHat, category: "Kitchen" },
  { value: "dishwasher", label: "Dishwasher", icon: Sparkles, category: "Kitchen" },
  { value: "cookware", label: "Cookware (Pots & Pans)", icon: CookingPot, category: "Kitchen" },
  { value: "dishes", label: "Dishes & Utensils", icon: GlassWater, category: "Kitchen" },
  { value: "dining_table", label: "Dining Table", icon: UtensilsCrossed, category: "Kitchen" },
  { value: "blender", label: "Blender", icon: Zap, category: "Kitchen" },
  { value: "kettle", label: "Electric Kettle", icon: Coffee, category: "Kitchen" },
  { value: "coffee_maker", label: "Coffee Maker", icon: Coffee, category: "Kitchen" },
  
  // Meals
  { value: "breakfast_included", label: "Breakfast Included", icon: UtensilsCrossed, category: "Meals" },
  { value: "breakfast_available", label: "Breakfast Available (Paid)", icon: UtensilsCrossed, category: "Meals" },
  
  // Fitness & Recreation
  { value: "gym", label: "Gym/Fitness Center", icon: Dumbbell, category: "Recreation" },
  { value: "pool", label: "Swimming Pool", icon: Waves, category: "Recreation" },
  { value: "spa", label: "Spa", icon: Sparkles, category: "Recreation" },
  { value: "sauna", label: "Sauna", icon: Flame, category: "Recreation" },
  { value: "jacuzzi", label: "Hot Tub/Jacuzzi", icon: Waves, category: "Recreation" },
  
  // Safety & Security
  { value: "smoke_alarm", label: "Smoke Alarm", icon: CircleOff, category: "Safety" },
  { value: "carbon_monoxide_alarm", label: "Carbon Monoxide Alarm", icon: CircleOff, category: "Safety" },
  { value: "fire_extinguisher", label: "Fire Extinguisher", icon: Flame, category: "Safety" },
  { value: "first_aid", label: "First Aid Kit", icon: Plus, category: "Safety" },
  { value: "security_cameras", label: "Security Cameras (Exterior)", icon: Cctv, category: "Safety" },
  { value: "security_system", label: "Security System", icon: ShieldCheck, category: "Safety" },
  
  // Rules & Policies
  { value: "no_smoking", label: "No Smoking", icon: CigaretteOff, category: "Rules" },
  { value: "pets_allowed", label: "Pets Allowed", icon: Baby, category: "Rules" },
  
  // Views & Outdoor
  { value: "balcony", label: "Balcony", icon: Sunrise, category: "Outdoor" },
  { value: "patio", label: "Patio", icon: Sunrise, category: "Outdoor" },
  { value: "garden", label: "Garden", icon: Leaf, category: "Outdoor" },
  { value: "terrace", label: "Terrace", icon: Sunrise, category: "Outdoor" },
  { value: "city_view", label: "City View", icon: Building2, category: "Views" },
  { value: "mountain_view", label: "Mountain View", icon: Mountain, category: "Views" },
  { value: "sea_view", label: "Sea/Ocean View", icon: Waves, category: "Views" },
  { value: "lake_view", label: "Lake View", icon: Waves, category: "Views" },
  { value: "landscape_view", label: "Landscape View", icon: TreePine, category: "Views" },
  
  // Accessibility & Building Features
  { value: "elevator", label: "Elevator", icon: Building2, category: "Accessibility" },
  { value: "wheelchair_accessible", label: "Wheelchair Accessible", icon: Accessibility, category: "Accessibility" },
  { value: "ground_floor", label: "Ground Floor Access", icon: Building2, category: "Accessibility" },
  
  // Business & Services
  { value: "meeting_room", label: "Meeting Room", icon: Presentation, category: "Services" },
  { value: "conference_room", label: "Conference Room", icon: Presentation, category: "Services" },
  { value: "reception", label: "24/7 Reception", icon: Phone, category: "Services" },
  { value: "concierge", label: "Concierge Service", icon: Phone, category: "Services" },
  { value: "restaurant", label: "On-site Restaurant", icon: Utensils, category: "Services" },
  { value: "room_service", label: "Room Service", icon: Utensils, category: "Services" },
  
  // Family & Kids
  { value: "family_friendly", label: "Family Friendly", icon: Baby, category: "Family" },
  { value: "crib", label: "Crib/Baby Bed", icon: Baby, category: "Family" },
  { value: "high_chair", label: "High Chair", icon: Baby, category: "Family" },
  
  // Other Amenities
  { value: "fireplace", label: "Fireplace", icon: Flame, category: "Climate Control" },
  { value: "air_purifier", label: "Air Purifier", icon: Leaf, category: "Climate Control" },
  { value: "soundproofing", label: "Soundproofing", icon: ShieldCheck, category: "Bedroom" },
];

// Flat list for backward compatibility
export const AMENITIES = allAmenities;

// Grouped by category
export const AMENITIES_BY_CATEGORY: AmenityCategory[] = [
  {
    name: "Entertainment",
    items: allAmenities.filter(a => a.category === "Entertainment"),
  },
  {
    name: "Parking",
    items: allAmenities.filter(a => a.category === "Parking"),
  },
  {
    name: "Kitchen",
    items: allAmenities.filter(a => a.category === "Kitchen"),
  },
  {
    name: "Bathroom",
    items: allAmenities.filter(a => a.category === "Bathroom"),
  },
  {
    name: "Bedroom",
    items: allAmenities.filter(a => a.category === "Bedroom"),
  },
  {
    name: "Laundry",
    items: allAmenities.filter(a => a.category === "Laundry"),
  },
  {
    name: "Climate Control",
    items: allAmenities.filter(a => a.category === "Climate Control"),
  },
  {
    name: "Work & Storage",
    items: allAmenities.filter(a => a.category === "Work & Storage"),
  },
  {
    name: "Recreation",
    items: allAmenities.filter(a => a.category === "Recreation"),
  },
  {
    name: "Safety",
    items: allAmenities.filter(a => a.category === "Safety"),
  },
  {
    name: "Services",
    items: allAmenities.filter(a => a.category === "Services"),
  },
  {
    name: "Outdoor",
    items: allAmenities.filter(a => a.category === "Outdoor"),
  },
  {
    name: "Views",
    items: allAmenities.filter(a => a.category === "Views"),
  },
  {
    name: "Accessibility",
    items: allAmenities.filter(a => a.category === "Accessibility"),
  },
  {
    name: "Meals",
    items: allAmenities.filter(a => a.category === "Meals"),
  },
  {
    name: "Rules",
    items: allAmenities.filter(a => a.category === "Rules"),
  },
  {
    name: "Family",
    items: allAmenities.filter(a => a.category === "Family"),
  },
].filter(cat => cat.items.length > 0); // Only include categories with items

export const amenityByValue = new Map(AMENITIES.map((a) => [a.value, a]));

// Comprehensive alias map mapping labels, variants, and alternative keys to standard amenity values
const AMENITY_ALIAS_MAP: Record<string, string> = {
  // Wifi / Internet
  "wifi": "wifi",
  "wi-fi": "wifi",
  "wireless internet": "wifi",
  "internet": "wifi",
  "free wifi": "wifi",
  "free wi-fi": "wifi",
  "high-speed wifi": "wifi",
  "fast wifi": "wifi",

  // TV
  "tv": "tv_smart",
  "smart tv": "tv_smart",
  "tv_smart": "tv_smart",
  "smart_tv": "tv_smart",
  "basic tv": "tv_basic",
  "tv_basic": "tv_basic",
  "cable tv": "tv_basic",
  "television": "tv_basic",

  // Parking
  "parking": "parking_free",
  "free parking": "parking_free",
  "parking_free": "parking_free",
  "free_parking": "parking_free",
  "free on-site parking": "parking_free",
  "paid parking": "parking_paid",
  "parking_paid": "parking_paid",
  "paid_parking": "parking_paid",

  // Workspace
  "workspace": "workspace",
  "dedicated workspace": "workspace",
  "dedicated_workspace": "workspace",
  "desk": "workspace",
  "work desk": "workspace",

  // Wardrobe / Storage / Safe
  "wardrobe": "wardrobe",
  "closet": "wardrobe",
  "hangers": "hangers",
  "safe": "safe",
  "in-room safe": "safe",

  // Climate
  "ac": "ac",
  "a/c": "ac",
  "air conditioning": "ac",
  "air conditioner": "ac",
  "air_conditioning": "ac",
  "heating": "heating",
  "heater": "heating",
  "fans": "fans",
  "fan": "fans",
  "ceiling fan": "fans",

  // Bathroom & Water
  "hot water": "hot_water",
  "hot_water": "hot_water",
  "water heater": "hot_water",
  "toiletries": "toiletries",
  "free toiletries": "toiletries",
  "bathroom essentials": "bathroom_essentials",
  "bathroom_essentials": "bathroom_essentials",
  "cleaning supplies": "cleaning_items",
  "cleaning_items": "cleaning_items",
  "cleaning items": "cleaning_items",

  // Bedroom & Linens
  "bed linens": "bedsheets_pillows",
  "bed linens & pillows": "bedsheets_pillows",
  "bedsheets_pillows": "bedsheets_pillows",
  "bed sheets": "bedsheets_pillows",
  "pillows": "bedsheets_pillows",
  "linens": "bedsheets_pillows",
  "soundproofing": "soundproofing",
  "soundproof": "soundproofing",

  // Laundry
  "washing machine": "washing_machine",
  "washing_machine": "washing_machine",
  "washer": "washing_machine",
  "laundry": "washing_machine",
  "dryer": "dryer",
  "clothes dryer": "dryer",
  "iron": "iron",
  "iron & ironing board": "iron",
  "ironing board": "iron",

  // Kitchen
  "kitchen": "kitchen",
  "full kitchen": "kitchen",
  "kitchenette": "kitchenette",
  "refrigerator": "refrigerator",
  "fridge": "refrigerator",
  "microwave": "microwave",
  "stove": "stove",
  "cooker": "stove",
  "stove/cooker": "stove",
  "oven": "oven",
  "dishwasher": "dishwasher",
  "cookware": "cookware",
  "cookware (pots & pans)": "cookware",
  "pots & pans": "cookware",
  "dishes": "dishes",
  "dishes & utensils": "dishes",
  "cutlery": "dishes",
  "dining table": "dining_table",
  "dining_table": "dining_table",
  "blender": "blender",
  "electric kettle": "kettle",
  "kettle": "kettle",
  "coffee maker": "coffee_maker",
  "coffee_maker": "coffee_maker",
  "coffee": "coffee_maker",

  // Meals
  "breakfast included": "breakfast_included",
  "breakfast_included": "breakfast_included",
  "free breakfast": "breakfast_included",
  "breakfast available": "breakfast_available",
  "breakfast available (paid)": "breakfast_available",
  "breakfast_available": "breakfast_available",

  // Recreation & Wellness
  "gym": "gym",
  "gym/fitness center": "gym",
  "fitness center": "gym",
  "fitness": "gym",
  "swimming pool": "pool",
  "pool": "pool",
  "swimming_pool": "pool",
  "outdoor pool": "pool",
  "spa": "spa",
  "sauna": "sauna",
  "jacuzzi": "jacuzzi",
  "hot tub": "jacuzzi",
  "hot tub/jacuzzi": "jacuzzi",

  // Safety
  "smoke alarm": "smoke_alarm",
  "smoke_alarm": "smoke_alarm",
  "carbon monoxide alarm": "carbon_monoxide_alarm",
  "carbon_monoxide_alarm": "carbon_monoxide_alarm",
  "fire extinguisher": "fire_extinguisher",
  "fire_extinguisher": "fire_extinguisher",
  "first aid kit": "first_aid",
  "first_aid": "first_aid",
  "first aid": "first_aid",
  "security cameras": "security_cameras",
  "security cameras (exterior)": "security_cameras",
  "security_cameras": "security_cameras",
  "cctv": "security_cameras",
  "security system": "security_system",
  "security_system": "security_system",

  // Rules
  "no smoking": "no_smoking",
  "no_smoking": "no_smoking",
  "non-smoking": "no_smoking",
  "pets allowed": "pets_allowed",
  "pets_allowed": "pets_allowed",
  "pet friendly": "pets_allowed",

  // Views & Outdoor
  "balcony": "balcony",
  "patio": "patio",
  "garden": "garden",
  "terrace": "terrace",
  "city view": "city_view",
  "city_view": "city_view",
  "mountain view": "mountain_view",
  "mountain_view": "mountain_view",
  "sea view": "sea_view",
  "sea/ocean view": "sea_view",
  "sea_view": "sea_view",
  "ocean view": "sea_view",
  "lake view": "lake_view",
  "lake_view": "lake_view",
  "landscape view": "landscape_view",
  "landscape_view": "landscape_view",

  // Accessibility
  "elevator": "elevator",
  "lift": "elevator",
  "wheelchair accessible": "wheelchair_accessible",
  "wheelchair_accessible": "wheelchair_accessible",
  "ground floor access": "ground_floor",
  "ground_floor": "ground_floor",

  // Services
  "meeting room": "meeting_room",
  "meeting_room": "meeting_room",
  "conference room": "conference_room",
  "conference_room": "conference_room",
  "conference": "conference_room",
  "24/7 reception": "reception",
  "reception": "reception",
  "front desk": "reception",
  "concierge": "concierge",
  "concierge service": "concierge",
  "restaurant": "restaurant",
  "on-site restaurant": "restaurant",
  "room service": "room_service",
  "room_service": "room_service",

  // Family
  "family friendly": "family_friendly",
  "family_friendly": "family_friendly",
  "crib": "crib",
  "crib/baby bed": "crib",
  "baby bed": "crib",
  "high chair": "high_chair",
  "high_chair": "high_chair",
  "fireplace": "fireplace",
  "air purifier": "air_purifier",
  "air_purifier": "air_purifier",
};

/**
 * Resolves any raw amenity string (e.g. "Wi-Fi", "Free Parking", "pool", "Air conditioning")
 * into its standardized amenity key (e.g. "wifi", "parking_free", "pool", "ac").
 */
export const resolveAmenityKey = (input: string): string | null => {
  if (!input || typeof input !== "string") return null;
  const clean = input.trim().toLowerCase();
  if (!clean) return null;

  // Direct alias lookup
  if (AMENITY_ALIAS_MAP[clean]) {
    return AMENITY_ALIAS_MAP[clean];
  }

  // Check normalized slug (e.g. "free-parking" -> "parking_free" or matching value)
  const slug = clean.replace(/[\s-]+/g, "_");
  if (AMENITY_ALIAS_MAP[slug]) {
    return AMENITY_ALIAS_MAP[slug];
  }
  if (amenityByValue.has(slug)) {
    return slug;
  }
  if (amenityByValue.has(clean)) {
    return clean;
  }

  // Check by label lowercase match
  const matchedByLabel = allAmenities.find(
    (a) => a.label.toLowerCase() === clean || a.label.toLowerCase() === slug.replace(/_/g, " ")
  );
  if (matchedByLabel) {
    return matchedByLabel.value;
  }

  return null;
};

/**
 * Normalizes raw amenities from database / API / forms into a deduplicated array
 * of standardized amenity key strings.
 */
export const normalizeAmenityList = (raw: unknown): string[] => {
  if (!raw) return [];
  let items: string[] = [];

  if (Array.isArray(raw)) {
    items = raw.map((item) => String(item).trim()).filter(Boolean);
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          items = parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch { }
    }
    if (items.length === 0 && trimmed.startsWith("{") && trimmed.endsWith("}")) {
      items = trimmed
        .slice(1, -1)
        .split(",")
        .map((s) => s.replace(/^["']|["']$/g, "").trim())
        .filter(Boolean);
    }
    if (items.length === 0) {
      items = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!item) continue;
    const canonical = resolveAmenityKey(item);
    const valueToAdd = canonical || item;
    if (!seen.has(valueToAdd)) {
      seen.add(valueToAdd);
      result.push(valueToAdd);
    }
  }

  return result;
};
