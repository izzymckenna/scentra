const nzRetailerPatterns = [
  /life pharmacy/i,
  /chemist warehouse nz/i,
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
  return isNzRetailer(sourceName, sourceUrl) ? `${sourceName} · NZ retailer` : `${sourceName} · not NZ retailer`;
}
