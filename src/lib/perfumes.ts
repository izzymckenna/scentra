import scrapedPerfumes from "../data/scraped-perfumes.json";

export type LivePerfumeSource = {
  retailer_slug: string;
  source_name: string;
  source_url: string;
  brand: string;
  name: string;
  size?: string | null;
  price?: number | null;
  currency: string;
  image_url?: string | null;
};

export type LivePerfume = {
  brand: string;
  name: string;
  size?: string | null;
  size_ml?: number | null;
  price?: number | null;
  price_per_100ml?: number | null;
  currency: string;
  image_url?: string | null;
  description?: string | null;
  source_name: string;
  source_url: string;
  source_price?: number | null;
  source_count: number;
  sources?: LivePerfumeSource[];
};

export type PerfumeResponse = {
  count: number;
  cheapest?: LivePerfume | null;
  results: LivePerfume[];
  errors?: { retailer_slug: string; error: string }[];
};

type ScentProfile = {
  label: string;
  keywords: string[];
};

const scentProfiles: ScentProfile[] = [
  { label: "Floral", keywords: ["floral", "flower", "rose", "jasmine", "peony", "tuberose", "iris", "violet", "gardenia", "orange blossom", "ylang"] },
  { label: "Woody", keywords: ["woody", "wood", "cedar", "sandalwood", "oud", "vetiver", "oakmoss", "patchouli", "pine"] },
  { label: "Citrus", keywords: ["citrus", "bergamot", "lemon", "lime", "orange", "mandarin", "grapefruit", "neroli"] },
  { label: "Vanilla", keywords: ["vanilla", "tonka", "benzoin"] },
  { label: "Gourmand", keywords: ["gourmand", "caramel", "chocolate", "coffee", "cocoa", "honey", "praline", "pistachio", "marshmallow", "sugar"] },
  { label: "Amber", keywords: ["amber", "resin", "labdanum", "myrrh", "incense"] },
  { label: "Musk", keywords: ["musk", "skin", "powder", "clean"] },
  { label: "Fresh", keywords: ["fresh", "aqua", "aquatic", "marine", "ozonic", "rain", "linen"] },
  { label: "Fruity", keywords: ["fruit", "berry", "pear", "apple", "peach", "plum", "cherry", "coconut", "lychee", "fig"] },
  { label: "Spicy", keywords: ["spice", "spicy", "pink pepper", "pepper", "cardamom", "cinnamon", "clove", "saffron", "ginger"] },
  { label: "Green", keywords: ["green", "leaf", "herbal", "mint", "basil", "tea", "matcha", "grass"] },
  { label: "Sweet", keywords: ["sweet", "candy", "cotton candy", "syrup"] },
];

export function localPerfumeData(): PerfumeResponse {
  return scrapedPerfumes as PerfumeResponse;
}

export function formatMoney(amount: number | null | undefined, currency: string) {
  if (amount == null || Number.isNaN(amount)) return "-";
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function perfumeSlug(item: LivePerfume) {
  return [item.brand, item.name, item.size ?? ""]
    .join(" ")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function perfumeSearchText(item: LivePerfume) {
  const sourceText = (item.sources ?? [])
    .map((source) => [source.brand, source.name, source.size, source.source_name].filter(Boolean).join(" "))
    .join(" ");
  const profiles = scentProfileLabels(item).join(" ");
  return [item.brand, item.name, item.size, item.description, item.source_name, profiles, sourceText].filter(Boolean).join(" ").toLowerCase();
}

export function scentProfileLabels(item: LivePerfume) {
  const text = [item.brand, item.name, item.description, item.sources?.map((source) => source.name).join(" ")].filter(Boolean).join(" ").toLowerCase();
  return scentProfiles.filter((profile) => profile.keywords.some((keyword) => text.includes(keyword))).map((profile) => profile.label);
}

export function scentProfileOptions(items: LivePerfume[]) {
  const names = new Set<string>();
  for (const item of items) {
    for (const label of scentProfileLabels(item)) names.add(label);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function findPerfumeBySlug(slug: string | undefined, items = localPerfumeData().results) {
  if (!slug) return null;
  return items.find((item) => perfumeSlug(item) === slug) ?? null;
}

export function comparableSources(item: LivePerfume) {
  const sources = item.sources?.length
    ? item.sources
    : [
        {
          retailer_slug: item.source_name,
          source_name: item.source_name,
          source_url: item.source_url,
          brand: item.brand,
          name: item.name,
          size: item.size,
          price: item.price,
          currency: item.currency,
          image_url: item.image_url,
        },
      ];

  return [...sources].sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY));
}

export function sizeMl(size: string | null | undefined) {
  if (!size) return null;
  const match = size.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (Number.isNaN(amount)) return null;
  return match[2] === "l" ? amount * 1000 : amount;
}

export function sourcePricePer100ml(source: LivePerfumeSource) {
  const ml = sizeMl(source.size);
  if (!ml || source.price == null) return null;
  return (source.price / ml) * 100;
}

export function similarPerfumes(item: LivePerfume, items = localPerfumeData().results) {
  const profiles = new Set(scentProfileLabels(item));
  return items
    .filter((candidate) => perfumeSlug(candidate) !== perfumeSlug(item))
    .map((candidate) => ({
      item: candidate,
      score:
        (candidate.brand.toLowerCase() === item.brand.toLowerCase() ? 4 : 0) +
        scentProfileLabels(candidate).filter((label) => profiles.has(label)).length +
        (candidate.price_per_100ml != null ? 1 : 0),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || (a.item.price_per_100ml ?? a.item.price ?? 0) - (b.item.price_per_100ml ?? b.item.price ?? 0))
    .slice(0, 6)
    .map((candidate) => candidate.item);
}
