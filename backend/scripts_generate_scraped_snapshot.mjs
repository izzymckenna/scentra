import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(repoRoot, "src/data/scraped-perfumes.json");
const retailerQuery =
  "retailer_slugs=life-pharmacy&retailer_slugs=chemist-warehouse-nz&retailer_slugs=bargain-chemist&retailer_slugs=healthpost&retailer_slugs=the-warehouse&retailer_slugs=perfume-nz&retailer_slugs=scent-boutique&retailer_slugs=miller-road&retailer_slugs=unichem&retailer_slugs=flo-and-frankie&retailer_slugs=gadgets-online&retailer_slugs=wally&retailer_slugs=world&retailer_slugs=sisters-and-co";
const apiUrl =
  process.env.SCENTRA_SNAPSHOT_API_URL ||
  `http://127.0.0.1:8010/api/perfumes/live?${retailerQuery}&limit_per_retailer=500`;
const snapshotInputPath = process.env.SCENTRA_SNAPSHOT_INPUT_PATH;

const data = snapshotInputPath
  ? JSON.parse(await fs.readFile(path.resolve(snapshotInputPath), "utf8"))
  : await fetchJson(apiUrl);
const approvedNzRetailers = new Set([
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
const freshResults = (Array.isArray(data.results) ? data.results : []).flatMap(normalizePerfume);
const existingData = await readExistingSnapshot();
const existingResults = (Array.isArray(existingData?.results) ? existingData.results : []).flatMap(normalizePerfume);
const results = mergePerfumes(existingResults, freshResults);

results.sort((a, b) => (a.price_per_100ml ?? a.price ?? 0) - (b.price_per_100ml ?? b.price ?? 0));

const payload = {
  generated_at: new Date().toISOString(),
  count: results.length,
  cheapest: results[0] ?? null,
  results,
  errors: Array.isArray(data.errors) ? data.errors : [],
};

await fs.writeFile(outPath, JSON.stringify(payload, null, 2));
console.log(`Wrote ${outPath} with ${results.length} perfumes (${freshResults.length} refreshed, ${existingResults.length} preserved)`);

function normalizePerfume(item) {
  const sources = (Array.isArray(item.sources) ? item.sources : []).filter((source) => approvedNzRetailers.has(source.retailer_slug));
  if (!sources.length) return [];
  sources.sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY));
  const bestSource = sources[0];
  const sizeMatch = bestSource.size?.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/);
  const sizeMl = sizeMatch ? Number(sizeMatch[1]) * (sizeMatch[2] === "l" ? 1000 : 1) : null;
  const pricePer100ml = sizeMl && bestSource.price != null ? (bestSource.price / sizeMl) * 100 : null;
  return [{
    ...item,
    source_name: bestSource.source_name,
    source_url: bestSource.source_url,
    source_price: bestSource.price ?? item.source_price,
    price: bestSource.price ?? item.price,
    price_per_100ml: pricePer100ml == null ? null : Number(pricePer100ml.toFixed(2)),
    currency: bestSource.currency || item.currency,
    image_url: bestSource.image_url || item.image_url,
    size: bestSource.size ?? item.size,
    source_count: sources.length,
    sources,
  }];
}

function mergePerfumes(existingResults, freshResults) {
  const merged = new Map();
  for (const item of [...existingResults, ...freshResults]) {
    const key = perfumeKey(item);
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, item);
      continue;
    }

    const sources = dedupeSources([...(item.sources || []), ...(previous.sources || [])]);
    const normalized = normalizePerfume({ ...previous, ...item, sources });
    if (normalized.length) merged.set(key, normalized[0]);
  }
  return [...merged.values()];
}

function perfumeKey(item) {
  return [item.brand, item.name, item.size]
    .map((value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
    .join("|");
}

function dedupeSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = source.source_url || [source.retailer_slug, source.brand, source.name, source.size].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readExistingSnapshot() {
  try {
    return JSON.parse(await fs.readFile(outPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const transport = url.startsWith("https:") ? https : http;
    const request = transport.get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Failed to fetch live perfumes: ${response.statusCode || "unknown"}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Live perfume response was not valid JSON: ${error.message}`));
        }
      });
    });
    request.setTimeout(20 * 60 * 1000, () => request.destroy(new Error("Live perfume scrape timed out after 20 minutes")));
    request.on("error", reject);
  });
}
