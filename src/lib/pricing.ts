const nzRetailerPatterns = [
  /life pharmacy/i,
  /healthpost/i,
  /chemist warehouse nz/i,
  /bargain chemist/i,
  /brand outlet/i,
  /perfume nz/i,
  /scent boutique/i,
  /miller road/i,
  /unichem/i,
  /flo & frankie/i,
  /flo and frankie/i,
  /gadgets online/i,
  /wally/i,
  /world/i,
  /sisters & co/i,
  /farmers/i,
  /lush nz/i,
  /sephora nz/i,
  /the warehouse/i,
];

export function isNzRetailer(sourceName: string, sourceUrl?: string) {
  const nameMatch = nzRetailerPatterns.some((pattern) => pattern.test(sourceName));
  const url = sourceUrl ?? "";
  const urlMatch = /\.co\.nz\b/i.test(url) || /\/nz(\/|$|\?)/i.test(url);
  return nameMatch || urlMatch;
}

export function priceLabel(sourceName: string, sourceUrl?: string) {
  return isNzRetailer(sourceName, sourceUrl) ? "Live NZ price" : "Source price";
}

export function retailerLabel(sourceName: string, sourceUrl?: string) {
  const normalized = sourceName.toLowerCase();
  let label = sourceName;
  if (normalized.includes("life-pharmacy")) label = "Life Pharmacy";
  else if (normalized.includes("chemist-warehouse")) label = "Chemist Warehouse NZ";
  else if (normalized.includes("bargain-chemist")) label = "Bargain Chemist";
  else if (normalized.includes("healthpost")) label = "HealthPost";
  else if (normalized.includes("the-warehouse")) label = "The Warehouse";
  else if (normalized.includes("brand-outlet")) label = "The Brand Outlet";
  else if (normalized.includes("perfume-nz")) label = "Perfume NZ";
  else if (normalized.includes("scent-boutique")) label = "Scent Boutique";
  else if (normalized.includes("miller-road")) label = "Miller Road";
  else if (normalized.includes("unichem")) label = "Unichem";
  else if (normalized.includes("flo-and-frankie")) label = "Flo & Frankie";
  else if (normalized.includes("gadgets-online")) label = "Gadgets Online";
  else if (normalized.includes("wally")) label = "Wally";
  else if (normalized.includes("world")) label = "WORLD";
  else if (normalized.includes("sisters-and-co")) label = "Sisters & Co";
  else if (normalized.includes("lush")) label = "Lush NZ";
  else if (normalized.includes("farmers")) label = "Farmers";

  return isNzRetailer(label, sourceUrl) ? `${label} · NZ retailer` : `${label} · not NZ retailer`;
}
