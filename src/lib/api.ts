const normalizedBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

export function apiUrl(path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${suffix}`;
}

export function localApiUrls(path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.VITE_API_URL) return [apiUrl(suffix)];
  return [
    apiUrl(suffix),
    `http://127.0.0.1:8011/api${suffix}`,
    `http://127.0.0.1:8010/api${suffix}`,
    `http://127.0.0.1:8000/api${suffix}`,
  ];
}
