import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { apiUrl } from "../lib/api";
import scrapedPerfumes from "../data/scraped-perfumes.json";
import { priceLabel, retailerLabel } from "../lib/pricing";

type LivePerfume = {
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
  sources?: {
    retailer_slug: string;
    source_name: string;
    source_url: string;
    brand: string;
    name: string;
    size?: string | null;
    price?: number | null;
    currency: string;
    image_url?: string | null;
  }[];
};

type PerfumeResponse = {
  count: number;
  cheapest?: LivePerfume | null;
  results: LivePerfume[];
  errors?: { retailer_slug: string; error: string }[];
};

function formatMoney(amount: number | null | undefined, currency: string) {
  if (amount == null || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function localPerfumeData(): PerfumeResponse {
  return scrapedPerfumes as PerfumeResponse;
}

function mergePerfumeData(base: PerfumeResponse, incoming: PerfumeResponse): PerfumeResponse {
  const combined = new Map<string, LivePerfume>();

  for (const item of [...base.results, ...incoming.results]) {
    const key = [item.brand, item.name, item.size ?? ""].map((value) => value.toLowerCase()).join("|");
    const existing = combined.get(key);
    if (!existing) {
      combined.set(key, item);
      continue;
    }
    const existingScore = existing.price_per_100ml ?? existing.price ?? Number.POSITIVE_INFINITY;
    const incomingScore = item.price_per_100ml ?? item.price ?? Number.POSITIVE_INFINITY;
    if (incomingScore < existingScore) {
      combined.set(key, item);
    }
  }

  const results = [...combined.values()].sort((a, b) => (a.price_per_100ml ?? a.price ?? 0) - (b.price_per_100ml ?? b.price ?? 0));
  return {
    count: results.length,
    cheapest: results[0] ?? null,
    results,
    errors: incoming.errors,
  };
}

export function PerfumesPage() {
  const [data, setData] = useState<PerfumeResponse>(localPerfumeData());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(apiUrl("/perfumes/live?retailer_slugs=life-pharmacy&retailer_slugs=chemist-warehouse-nz&retailer_slugs=lush&limit_per_retailer=200"), {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }
        const json = (await response.json()) as PerfumeResponse;
        setData((current) => mergePerfumeData(current, json));
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Unable to load perfumes");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  const results = useMemo(() => data.results ?? [], [data]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 md:px-12">
      <section className="border-b border-border pb-5">
        <span className="block text-[11px] uppercase tracking-[0.27em] text-muted">Live Perfume Scrape</span>
        <h1 className="mt-3 font-display text-4xl font-normal leading-tight text-primary sm:text-5xl">All perfumes from the scraped sites</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
          Deduped across Life Pharmacy, Chemist Warehouse NZ, and Lush. Prices are shown as bottle price plus a 100ml comparison where available.
        </p>
      </section>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted">
            <LoaderCircle className="animate-spin" size={20} />
            Scraping perfume feeds...
          </div>
        </div>
      ) : (
        <>
          {error ? <div className="mt-8 border border-border bg-surface-soft p-4 text-sm text-muted">Live scrape unavailable, showing the local scraped perfume snapshot instead.</div> : null}
          {data.errors?.length ? (
            <div className="mt-8 border border-border bg-surface-soft p-4 text-sm text-muted">
              Some sources were blocked or failed to scrape: {data.errors.map((item) => item.retailer_slug).join(", ")}
            </div>
          ) : null}
          <section className="mt-8 grid gap-3 md:grid-cols-3">
            <Stat label="Unique perfumes" value={data?.count ?? 0} />
            <Stat label="Retailer-backed entries" value={results.length} />
            <Stat label="100ml comparisons" value={results.filter((item) => item.price_per_100ml != null).length} />
          </section>

          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between border-b border-border pb-4">
              <div>
                <span className="block text-[11px] uppercase tracking-[0.22em] text-muted">All results</span>
                <h2 className="mt-2 font-display text-3xl font-normal text-primary">Sorted by 100ml comparison price</h2>
              </div>
              <Link to="/explore" className="hidden text-sm font-extrabold text-primary hover:text-accent sm:block">
                Back to explore
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {results.map((item) => (
                <a
                  key={`${item.brand}-${item.name}-${item.size}-${item.source_url}`}
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col border border-border bg-white p-4 text-inherit no-underline transition duration-300 hover:-translate-y-1"
                >
                  <div className="aspect-[4/5] overflow-hidden border border-border bg-surface-soft">
                    {item.image_url ? <img src={item.image_url} alt={`${item.brand} ${item.name}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" /> : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 pt-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{item.brand}</span>
                    <h3 className="font-display text-base font-normal leading-tight text-primary sm:text-lg">{item.name}</h3>
                    <p className="mt-1 text-sm text-muted">{item.size ?? "Unknown size"}</p>
                    <div className="mt-auto flex flex-col gap-1 pt-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{priceLabel(item.source_name, item.source_url)}</span>
                        <span className="text-lg font-extrabold leading-none text-primary sm:text-xl">{formatMoney(item.price, item.currency)}</span>
                        <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
                          {item.price_per_100ml != null ? `${formatMoney(item.price_per_100ml, item.currency)} / 100ml` : "100ml compare unavailable"}
                        </span>
                      </div>
                      <span className="max-w-none text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:max-w-[50%] sm:text-right">
                        {retailerLabel(item.source_name, item.source_url)}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border bg-white p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-normal text-primary">{value}</p>
    </div>
  );
}
