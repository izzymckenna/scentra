import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowUpDown, ExternalLink, LoaderCircle, Search } from "lucide-react";
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

type SortOption = "value" | "price" | "brand";

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
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState<SortOption>("value");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(apiUrl("/perfumes/live?retailer_slugs=life-pharmacy&retailer_slugs=chemist-warehouse-nz&retailer_slugs=healthpost&retailer_slugs=the-warehouse&retailer_slugs=brand-outlet&retailer_slugs=perfume-nz&limit_per_retailer=200"), {
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

  const retailers = useMemo(() => {
    const names = new Set<string>();
    for (const item of data.results ?? []) {
      names.add(retailerLabel(item.source_name, item.source_url));
    }
    return ["all", ...[...names].sort((a, b) => a.localeCompare(b))];
  }, [data.results]);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = (data.results ?? []).filter((item) => {
      const retailer = retailerLabel(item.source_name, item.source_url);
      const searchable = [item.brand, item.name, item.size, retailer].filter(Boolean).join(" ").toLowerCase();
      return (!normalizedQuery || searchable.includes(normalizedQuery)) && (source === "all" || retailer === source);
    });

    return [...filtered].sort((a, b) => {
      if (sort === "price") return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
      if (sort === "brand") return `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`);
      return (a.price_per_100ml ?? Number.POSITIVE_INFINITY) - (b.price_per_100ml ?? Number.POSITIVE_INFINITY);
    });
  }, [data.results, query, sort, source]);

  const comparisons = results.filter((item) => item.price_per_100ml != null).length;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-10 lg:px-12">
      <section className="grid gap-6 border-b border-border pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-[0.24em] text-muted">Live retailer prices</span>
          <h1 className="mt-3 font-display text-4xl font-normal leading-tight text-primary sm:text-5xl">Scraped perfumes</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
            A cleaned-up price board from NZ retailer and perfume outlet sources, sorted for quick value comparison.
          </p>
        </div>
        <Link to="/explore" className="inline-flex w-fit border border-primary bg-primary px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-white hover:bg-primary-2">
          Back to explore
        </Link>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Showing" value={results.length} />
        <Stat label="Total scraped" value={data.count ?? 0} />
        <Stat label="100ml comparisons" value={comparisons} />
      </section>

      <section className="sticky top-0 z-20 mt-5 border border-border bg-bg/95 p-3 backdrop-blur">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <label className="flex min-h-12 items-center gap-3 border border-border bg-white px-4">
            <Search size={18} className="shrink-0 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search brand, perfume, size, or retailer"
              className="w-full bg-transparent text-sm font-semibold text-primary outline-none placeholder:font-medium placeholder:text-muted"
            />
          </label>
          <label className="flex min-h-12 items-center gap-3 border border-border bg-white px-4">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Source</span>
            <select value={source} onChange={(event) => setSource(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-primary outline-none">
              {retailers.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All retailers" : item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-12 items-center gap-3 border border-border bg-white px-4">
            <ArrowUpDown size={16} className="shrink-0 text-muted" />
            <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-primary outline-none">
              <option value="value">Best value / 100ml</option>
              <option value="price">Lowest bottle price</option>
              <option value="brand">Brand A-Z</option>
            </select>
          </label>
        </div>
      </section>

      <StatusMessage loading={loading} error={error} sourceErrors={data.errors ?? []} />

      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Results</span>
            <h2 className="mt-1 font-display text-2xl font-normal text-primary sm:text-3xl">{results.length} perfumes matched</h2>
          </div>
          <p className="text-sm font-semibold text-muted">Prices open at the source retailer.</p>
        </div>

        {results.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((item) => (
              <PerfumeCard key={`${item.brand}-${item.name}-${item.size}-${item.source_url}`} item={item} />
            ))}
          </div>
        ) : (
          <div className="border border-border bg-surface-soft px-6 py-14 text-center">
            <h3 className="font-display text-3xl font-normal text-primary">No perfumes match that search.</h3>
            <button type="button" onClick={() => setQuery("")} className="mt-5 border border-primary px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-primary hover:bg-white">
              Clear search
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border bg-white px-4 py-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-normal leading-none text-primary">{value}</p>
    </div>
  );
}

function StatusMessage({
  loading,
  error,
  sourceErrors,
}: {
  loading: boolean;
  error: string | null;
  sourceErrors: { retailer_slug: string; error: string }[];
}) {
  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-3 border border-border bg-white px-4 py-3 text-sm font-semibold text-muted">
        <LoaderCircle className="animate-spin" size={18} />
        Refreshing live prices...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 flex items-start gap-3 border border-border bg-surface-soft px-4 py-3 text-sm text-muted">
        <AlertCircle className="mt-0.5 shrink-0 text-sale" size={18} />
        <span>Live scrape unavailable, showing the latest saved snapshot.</span>
      </div>
    );
  }

  if (sourceErrors.length) {
    return (
      <div className="mt-4 flex items-start gap-3 border border-border bg-surface-soft px-4 py-3 text-sm text-muted">
        <AlertCircle className="mt-0.5 shrink-0 text-sale" size={18} />
        <span>Some sources failed: {sourceErrors.map((item) => item.retailer_slug).join(", ")}</span>
      </div>
    );
  }

  return null;
}

function PerfumeCard({ item }: { item: LivePerfume }) {
  const retailer = retailerLabel(item.source_name, item.source_url);
  const compareLabel = item.price_per_100ml != null ? `${formatMoney(item.price_per_100ml, item.currency)} / 100ml` : "No 100ml comparison";

  return (
    <a href={item.source_url} target="_blank" rel="noreferrer" className="group grid min-h-[178px] grid-cols-[104px_1fr] border border-border bg-white text-inherit no-underline transition hover:-translate-y-0.5 hover:shadow-hover sm:grid-cols-[118px_1fr]">
      <div className="h-full min-h-[178px] border-r border-border bg-surface-soft">
        {item.image_url ? (
          <img src={item.image_url} alt={`${item.brand} ${item.name}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-muted">No image</div>
        )}
      </div>
      <div className="flex min-w-0 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">{item.brand}</p>
            <h3 className="mt-1 line-clamp-2 font-display text-lg font-normal leading-tight text-primary">{item.name}</h3>
          </div>
          <ExternalLink size={16} className="mt-1 shrink-0 text-muted transition group-hover:text-primary" />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="border border-border bg-surface-soft px-2 py-1 text-[11px] font-bold text-muted">{item.size ?? "Unknown size"}</span>
          <span className="border border-border bg-surface-soft px-2 py-1 text-[11px] font-bold text-muted">{retailer}</span>
        </div>

        <div className="mt-auto pt-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{priceLabel(item.source_name, item.source_url)}</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <span className="text-2xl font-extrabold leading-none text-primary">{formatMoney(item.price, item.currency)}</span>
            <span className="text-right text-xs font-bold text-success">{compareLabel}</span>
          </div>
        </div>
      </div>
    </a>
  );
}
