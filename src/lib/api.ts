const normalizedBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

export function apiUrl(path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${suffix}`;
}
