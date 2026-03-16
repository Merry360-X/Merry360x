export type TourPricingModel = "per_person" | "per_group" | "per_hour" | "per_minute";

const VALID_MODELS: TourPricingModel[] = ["per_person", "per_group", "per_hour", "per_minute"];

const normalizeTourPricingModel = (value: unknown): TourPricingModel | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return (VALID_MODELS as string[]).includes(normalized)
    ? (normalized as TourPricingModel)
    : null;
};

export function getTourPricingModels(pricingTiers: unknown): TourPricingModel[] {
  if (!pricingTiers || Array.isArray(pricingTiers) || typeof pricingTiers !== "object") {
    return ["per_person"];
  }

  const rawArray = (pricingTiers as { pricing_models?: unknown }).pricing_models;
  if (Array.isArray(rawArray)) {
    const asSet = new Set(
      rawArray
        .map((item) => normalizeTourPricingModel(item))
        .filter((item): item is TourPricingModel => Boolean(item))
    );

    const ordered = VALID_MODELS.filter((model) => asSet.has(model));
    if (ordered.length > 0) return ordered;
  }

  const single = normalizeTourPricingModel((pricingTiers as { pricing_model?: unknown }).pricing_model);
  return [single || "per_person"];
}

export function getTourPricingModel(pricingTiers: unknown): TourPricingModel {
  return getTourPricingModels(pricingTiers)[0] || "per_person";
}

export function getTourPriceSuffix(model: TourPricingModel): string {
  if (model === "per_group") return "per group";
  if (model === "per_hour") return "per hour";
  if (model === "per_minute") return "per minute";
  return "per person";
}

export function getTourBillingQuantity(model: TourPricingModel, participants: number): number {
  if (model === "per_person") return Math.max(1, participants);
  return 1;
}

export type TourGroupPricingTier = {
  group_size: number;
  price_per_person: number;
};

export function getTourGroupPricingTiers(pricingMetadata: unknown): TourGroupPricingTier[] {
  const raw = Array.isArray(pricingMetadata) ? pricingMetadata : (pricingMetadata as any)?.tiers;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((tier: any) => ({
      group_size: Math.max(1, Math.floor(Number(tier?.group_size) || 0)),
      price_per_person: Number(tier?.price_per_person) || 0,
    }))
    .filter((tier) => tier.group_size >= 1 && tier.price_per_person > 0)
    .sort((a, b) => a.group_size - b.group_size);
}

export function getTourTieredPerPersonPrice(pricingMetadata: unknown, participants: number): number | null {
  const safeParticipants = Math.max(1, Math.floor(Number(participants) || 1));
  const tiers = getTourGroupPricingTiers(pricingMetadata);
  if (tiers.length === 0) return null;

  const exact = tiers.find((tier) => tier.group_size === safeParticipants);
  if (exact) return exact.price_per_person;

  const maxTier = tiers[tiers.length - 1];
  if (maxTier && safeParticipants >= maxTier.group_size) return maxTier.price_per_person;

  return null;
}

export function getTourPerPersonUnitPrice(
  pricingModel: TourPricingModel,
  pricingMetadata: unknown,
  participants: number,
  fallbackPrice: number
): number {
  if (pricingModel !== "per_person") return Number(fallbackPrice) || 0;
  const tiered = getTourTieredPerPersonPrice(pricingMetadata, participants);
  return tiered ?? (Number(fallbackPrice) || 0);
}
