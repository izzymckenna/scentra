export function parseMilliliters(value: string) {
  const match = value.toLowerCase().match(/(\d+(?:\.\d+)?)\s*ml/);
  return match ? Number(match[1]) : null;
}

export function standardizePrice(price: number, sizeLabel: string, targetMl: number) {
  const sizeMl = parseMilliliters(sizeLabel);
  if (!sizeMl || !Number.isFinite(price) || sizeMl <= 0 || targetMl <= 0) {
    return null;
  }

  return (price / sizeMl) * targetMl;
}
