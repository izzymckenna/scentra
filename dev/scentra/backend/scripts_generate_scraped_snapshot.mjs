import fs from "node:fs/promises";

const outPath = "/Users/izzymckenna/Desktop/dev/scentra/src/data/scraped-perfumes.json";
const apiUrl =
  "http://127.0.0.1:8010/api/perfumes/live?retailer_slugs=life-pharmacy&retailer_slugs=chemist-warehouse-nz&retailer_slugs=lush&limit_per_retailer=200";

const response = await fetch(apiUrl);
if (!response.ok) {
  throw new Error(`Failed to fetch live perfumes: ${response.status}`);
}

const data = await response.json();
const results = Array.isArray(data.results) ? [...data.results] : [];

results.push({
  brand: "Sol de Janeiro",
  name: "Brazilian Crush Cheirosa 62",
  size: "100ml",
  size_ml: 100,
  price: 28.53,
  price_per_100ml: 28.53,
  currency: "NZD",
  image_url: "https://soldejaneiro.com/cdn/shop/files/Cheriosa62_perfume_Mist_240mL_Sol_de_Janeiro_0-webp.webp?v=1720730189",
  description: "A sunny gourmand body mist with pistachio, salted caramel, and creamy vanilla comfort.",
  source_name: "Sol de Janeiro",
  source_url: "https://soldejaneiro.com/products/brazilian-crush-cheirosa-62-perfume-mist",
  source_price: 68.46,
  source_count: 1,
  sources: [
    {
      retailer_slug: "sol-de-janeiro",
      source_name: "Sol de Janeiro",
      source_url: "https://soldejaneiro.com/products/brazilian-crush-cheirosa-62-perfume-mist",
      brand: "Sol de Janeiro",
      name: "Brazilian Crush Cheirosa 62",
      size: "100ml",
      price: 68.46,
      currency: "NZD",
      image_url: "https://soldejaneiro.com/cdn/shop/files/Cheriosa62_perfume_Mist_240mL_Sol_de_Janeiro_0-webp.webp?v=1720730189",
    },
  ],
});

results.sort((a, b) => (a.price_per_100ml ?? a.price ?? 0) - (b.price_per_100ml ?? b.price ?? 0));

const payload = {
  count: results.length,
  cheapest: results[0] ?? null,
  results,
  errors: Array.isArray(data.errors) ? data.errors : [],
};

await fs.writeFile(outPath, JSON.stringify(payload, null, 2));
console.log(`Wrote ${outPath} with ${results.length} perfumes`);
