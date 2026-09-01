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

export type PerfumeComparisonGroup = {
  key: string;
  brand: string;
  name: string;
  size?: string | null;
  currency: string;
  image_url?: string | null;
  description?: string | null;
  items: LivePerfume[];
  sources: LivePerfumeSource[];
  bestSource: LivePerfumeSource;
  lowestPrice: number;
  highestPrice: number;
  bestValue: number | null;
  savings: number;
};

type ScentProfile = {
  label: string;
  keywords: string[];
};

export type PerfumeNotes = {
  family: string[];
  top: string[];
  heart: string[];
  base: string[];
  all: string[];
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

export const approvedNzRetailerSlugs = new Set([
  "life-pharmacy",
  "chemist-warehouse-nz",
  "bargain-chemist",
  "healthpost",
  "the-warehouse",
  "perfume-nz",
  "scent-boutique",
  "miller-road",
  "unichem",
  "flo-and-frankie",
  "gadgets-online",
  "wally",
  "world",
  "sisters-and-co",
]);

export function localPerfumeData(): PerfumeResponse {
  return filterPerfumeData(scrapedPerfumes as PerfumeResponse);
}

export async function fetchLatestPerfumeSnapshot() {
  const configuredUrl = import.meta.env.VITE_SCRAPED_PERFUMES_URL as string | undefined;
  const snapshotUrl = configuredUrl || "https://raw.githubusercontent.com/izzymckenna/scentra/main/src/data/scraped-perfumes.json";
  const url = new URL(snapshotUrl);
  url.searchParams.set("v", Date.now().toString());
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new Error(`Snapshot request failed with ${response.status}`);
  return filterPerfumeData((await response.json()) as PerfumeResponse);
}

function filterPerfumeData(data: PerfumeResponse): PerfumeResponse {
  const results = (data.results ?? [])
    .map(filterPerfumeItem)
    .filter((item): item is LivePerfume => Boolean(item))
    .sort((a, b) => (a.price_per_100ml ?? a.price ?? Number.POSITIVE_INFINITY) - (b.price_per_100ml ?? b.price ?? Number.POSITIVE_INFINITY));

  return {
    ...data,
    count: results.length,
    cheapest: results[0] ?? null,
    results,
  };
}

function filterPerfumeItem(item: LivePerfume): LivePerfume | null {
  const sources = comparableSources(item).filter(isApprovedPerfumeSource);
  const bestSource = sources[0];
  if (!bestSource) return null;
  const value = sourcePricePer100ml(bestSource);

  return {
    ...item,
    source_name: bestSource.source_name,
    source_url: bestSource.source_url,
    source_price: bestSource.price ?? item.source_price,
    price: bestSource.price ?? item.price,
    price_per_100ml: value ?? item.price_per_100ml,
    currency: bestSource.currency || item.currency,
    image_url: bestSource.image_url || item.image_url,
    size: bestSource.size ?? item.size,
    size_ml: sizeMl(bestSource.size) ?? item.size_ml,
    source_count: sources.length,
    sources,
  };
}

function isApprovedPerfumeSource(source: Pick<LivePerfumeSource, "retailer_slug" | "source_name" | "source_url">) {
  const retailerKey = sourceRetailerKey(source);
  return approvedNzRetailerSlugs.has(retailerKey);
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
  const notes = perfumeNotes(item).all.join(" ");
  return [item.brand, item.name, item.size, item.description, item.source_name, profiles, notes, sourceText].filter(Boolean).join(" ").toLowerCase();
}

export function comparisonSearchText(group: PerfumeComparisonGroup) {
  const sourceText = group.sources
    .map((source) => [source.brand, source.name, source.size, source.source_name].filter(Boolean).join(" "))
    .join(" ");
  const itemText = group.items.map(perfumeSearchText).join(" ");
  return [group.brand, group.name, group.size, group.description, sourceText, itemText].filter(Boolean).join(" ").toLowerCase();
}

export function scentProfileLabels(item: LivePerfume) {
  const notes = perfumeNotes(item).all.join(" ");
  const text = [item.brand, item.name, item.description, notes, item.sources?.map((source) => source.name).join(" ")].filter(Boolean).join(" ").toLowerCase();
  return scentProfiles.filter((profile) => profile.keywords.some((keyword) => text.includes(keyword))).map((profile) => profile.label);
}

export function perfumeNotes(item: LivePerfume): PerfumeNotes {
  const description = normalizeDescription(item.description || "");
  const family = extractLabeledNotes(description, ["fragrance family", "family"]);
  const top = extractLabeledNotes(description, ["top notes", "top note", "top"]);
  const heart = extractLabeledNotes(description, ["heart notes", "heart note", "middle notes", "middle note", "heart"]);
  const base = extractLabeledNotes(description, ["base notes", "base note", "base"]);
  const fallback = inferLooseNotes([item.name, description].join(" "));
  const all = uniqueNotes([...family, ...top, ...heart, ...base, ...fallback]);
  return {
    family: uniqueNotes(family),
    top: uniqueNotes(top),
    heart: uniqueNotes(heart),
    base: uniqueNotes(base),
    all,
  };
}

function normalizeDescription(value: string) {
  return value
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLabeledNotes(description: string, labels: string[]) {
  if (!description) return [];
  const labelPattern = labels.map(escapeRegExp).join("|");
  const boundaryLabels = [
    "fragrance family",
    "family",
    "top notes?",
    "heart notes?",
    "middle notes?",
    "base notes?",
    "accords?",
    "notes?",
    "scent profile",
    "performance(?: & character)?",
    "who is it for",
    "when to wear",
    "season",
    "occasion",
    "longevity(?: & sillage)?",
    "how to wear",
    "how to use",
    "directions?",
    "layering suggestions?",
    "more .{0,40} fragrances?",
    "similar .{0,30} fragrances?",
    "premium & niche alternatives?",
    "explore more fragrances?",
    "why buy from .{0,40}",
    "product details",
    "fragrance care tips?",
    "ingredients?",
    "safety",
    "warnings?",
    "cautions?",
    "disclaimer",
    "specifications?",
    "about .{0,40}",
    "brand",
    "fragrance",
    "size",
    "concentration",
    "gender",
    "format",
    "formulation",
    "packaging",
    "what['’]s included",
    "product type",
    "condition",
    "launch year",
    "perfumers?",
  ].join("|");
  const match = description.match(
    new RegExp(`\\b(?:${labelPattern})\\b\\s*(?::|[-–—])\\s*(.*?)(?=\\b(?:${boundaryLabels})\\b\\s*(?::|[-–—])?|$)`, "i"),
  );
  if (!match?.[1]) return [];
  return splitNotes(match[1]);
}

function inferLooseNotes(text: string) {
  const lower = text.toLowerCase();
  const knownNotes = [
    "apple",
    "amber",
    "bergamot",
    "black cherry",
    "caramel",
    "cedar",
    "cherry",
    "citrus",
    "coconut",
    "coffee",
    "fig",
    "grapefruit",
    "jasmine",
    "lavender",
    "lemon",
    "mandarin",
    "musk",
    "orange blossom",
    "patchouli",
    "peach",
    "pear",
    "pepper",
    "pistachio",
    "plum",
    "rose",
    "sandalwood",
    "strawberry",
    "tonka",
    "vanilla",
    "vetiver",
    "violet",
  ];
  return knownNotes.filter((note) => lower.includes(note));
}

function splitNotes(value: string) {
  return uniqueNotes(
    value
      .replace(/\b(and|with)\b/gi, ",")
      .split(/[,;/|]+/)
      .map(cleanNoteCandidate)
      .filter((part): part is string => Boolean(part))
      .slice(0, 10),
  );
}

const instructionLikeNotePattern =
  /\b(store|keep|apply|spray|avoid|use|hold|shake|twist|place|sunlight|humidity|heat|flammable|external|contact|warning|caution|safety|ingredient|packaging|bottle|product|delivery|invoice|retailer|available|disclaimer)\b/i;

function cleanNoteCandidate(value: string) {
  const candidate = value
    .replace(/\baccord\b/gi, "")
    .replace(/^[\s:.'"`-]+|[\s:.'"`-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (candidate.length < 3 || candidate.length > 36) return null;
  if (!/^\p{L}/u.test(candidate)) return null;
  if (candidate.split(/\s+/).length > 5) return null;
  if (instructionLikeNotePattern.test(candidate)) return null;
  if (/https?:|www\.|\d{2,}|[.!?].+\w/.test(candidate)) return null;
  return candidate;
}

function uniqueNotes(notes: string[]) {
  const seen = new Set<string>();
  return notes
    .map((note) => note.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map(formatNoteLabel)
    .filter((note) => {
      const key = note.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function formatNoteLabel(note: string) {
  const minorWords = new Set(["and", "of", "the", "with"]);
  return note
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part, index) => {
      if (/^\s+$/.test(part) || part === "-") return part;
      if (index > 0 && minorWords.has(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

export function bestRetailerSources(item: LivePerfume) {
  return uniqueRetailerSources(comparableSources(item));
}

export function buildPerfumeComparisons(items: LivePerfume[]) {
  const grouped = new Map<string, LivePerfume[]>();

  for (const item of items) {
    const key = perfumeComparisonKey(item);
    const existing = grouped.get(key) ?? [];
    existing.push(item);
    grouped.set(key, existing);
  }

  return [...grouped.entries()]
    .map((([key, groupItems]): PerfumeComparisonGroup | null => {
      const sources = uniqueRetailerSources(uniqueSources(groupItems.flatMap(comparableSources)));
      const sortedSources = sources.sort((a, b) => {
        const aValue = sourcePricePer100ml(a);
        const bValue = sourcePricePer100ml(b);
        return (
          (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY) ||
          (aValue ?? Number.POSITIVE_INFINITY) - (bValue ?? Number.POSITIVE_INFINITY)
        );
      });
      const bestSource = sortedSources[0];
      if (!bestSource || bestSource.price == null) return null;
      const priceValues = sortedSources.map((source) => source.price).filter((price): price is number => price != null && Number.isFinite(price));
      const valueValues = sortedSources.map(sourcePricePer100ml).filter((price): price is number => price != null && Number.isFinite(price));
      const representative = groupItems
        .slice()
        .sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY))[0];
      const highestPrice = priceValues.length ? Math.max(...priceValues) : bestSource.price;

      return {
        key,
        brand: representative.brand,
        name: representative.name,
        size: representative.size,
        currency: representative.currency,
        image_url: representative.image_url,
        description: representative.description,
        items: groupItems,
        sources: sortedSources,
        bestSource,
        lowestPrice: bestSource.price,
        highestPrice,
        bestValue: valueValues.length ? Math.min(...valueValues) : null,
        savings: Math.max(0, Math.round((highestPrice - bestSource.price) * 100) / 100),
      };
    }))
    .filter((group): group is PerfumeComparisonGroup => Boolean(group))
    .sort((a, b) => {
      const comparisonCount = b.sources.length - a.sources.length;
      if (comparisonCount !== 0) return comparisonCount;
      return (a.bestValue ?? a.lowestPrice) - (b.bestValue ?? b.lowestPrice);
    });
}

export function perfumeComparisonKey(item: LivePerfume) {
  const brand = normalizeComparableText(item.brand);
  const name = normalizeComparableName(item.name, item.brand);
  const ml = item.size_ml ?? sizeMl(item.size);
  return [brand, name, ml ? `${ml}ml` : normalizeComparableText(item.size ?? "")].filter(Boolean).join("|");
}

function uniqueSources(sources: LivePerfumeSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.source_url || [source.source_name, source.brand, source.name, source.size, source.price].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueRetailerSources(sources: LivePerfumeSource[]) {
  const byRetailer = new Map<string, LivePerfumeSource>();
  for (const source of sources) {
    const key = sourceRetailerKey(source);
    const existing = byRetailer.get(key);
    if (!existing || compareSourceValue(source, existing) < 0) {
      byRetailer.set(key, source);
    }
  }
  return [...byRetailer.values()].sort(compareSourceValue);
}

function compareSourceValue(a: LivePerfumeSource, b: LivePerfumeSource) {
  return (
    (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY) ||
    (sourcePricePer100ml(a) ?? Number.POSITIVE_INFINITY) - (sourcePricePer100ml(b) ?? Number.POSITIVE_INFINITY)
  );
}

function sourceRetailerKey(source: Pick<LivePerfumeSource, "retailer_slug" | "source_name">) {
  return (source.retailer_slug || source.source_name)
    .toLowerCase()
    .replace(/-shopify-suggest|-search-suggest/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeComparableName(name: string, brand: string) {
  return normalizeComparableText(name)
    .replace(new RegExp(`\\b${escapeRegExp(normalizeComparableText(brand))}\\b`, "g"), " ")
    .replace(/\b(eau de parfum|eau de toilette|edp|edt|parfum|perfume|fragrance|cologne|body mist|spray|for women|for men|women|men|unisex|by)\b/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(ml|l|oz)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9.\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
