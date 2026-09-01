import { useMemo, useState } from "react";
import { AlertCircle, ArrowUpDown, ExternalLink, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  buildPerfumeComparisons,
  comparisonSearchText,
  formatMoney,
  localPerfumeData,
  perfumeNotes,
  perfumeSearchText,
  perfumeSlug,
  scentProfileLabels,
  scentProfileOptions,
  sourcePricePer100ml,
  type PerfumeComparisonGroup,
} from "../lib/perfumes";
import { priceLabel, retailerLabel } from "../lib/pricing";

type SortOption = "value" | "price" | "brand";
type ConcentrationOption = "all" | "edp" | "edt" | "parfum" | "cologne" | "mist" | "oil" | "other";

const concentrationOptions: { value: ConcentrationOption; label: string }[] = [
  { value: "all", label: "All concentrations" },
  { value: "edp", label: "EDP · Eau de Parfum" },
  { value: "edt", label: "EDT · Eau de Toilette" },
  { value: "parfum", label: "Parfum · Extrait" },
  { value: "cologne", label: "Cologne · EDC" },
  { value: "mist", label: "Mist · Body Spray" },
  { value: "oil", label: "Perfume Oil · Solid" },
  { value: "other", label: "Other / Unspecified" },
];

const storedPerfumeData = localPerfumeData();

export function PerfumesPage() {
  const [searchParams] = useSearchParams();
  const data = storedPerfumeData;
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [source, setSource] = useState("all");
  const [profile, setProfile] = useState(searchParams.get("profile") ?? "all");
  const [concentration, setConcentration] = useState<ConcentrationOption>("all");
  const [sort, setSort] = useState<SortOption>("value");

  const retailers = useMemo(() => {
    const names = new Set<string>();
    for (const item of data.results ?? []) {
      for (const source of item.sources?.length ? item.sources : [{ source_name: item.source_name, source_url: item.source_url }]) {
        names.add(retailerLabel(source.source_name, source.source_url));
      }
    }
    return ["all", ...[...names].sort((a, b) => a.localeCompare(b))];
  }, [data.results]);

  const profiles = useMemo(() => ["all", ...scentProfileOptions(data.results ?? [])], [data.results]);

  const comparisonGroups = useMemo(() => buildPerfumeComparisons(data.results ?? []), [data.results]);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = comparisonGroups.filter((group) => {
      const retailers = group.sources.map((item) => retailerLabel(item.source_name, item.source_url));
      const profiles = new Set(group.items.flatMap((item) => scentProfileLabels(item)));
      const concentrations = new Set(
        [...group.items.map((item) => item.name), ...group.sources.map((item) => item.name)].map(perfumeConcentration),
      );
      const searchable = [comparisonSearchText(group), retailers.join(" ")].join(" ");
      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (source === "all" || retailers.includes(source)) &&
        (profile === "all" || profiles.has(profile)) &&
        (concentration === "all" || concentrations.has(concentration))
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "price") return a.lowestPrice - b.lowestPrice;
      if (sort === "brand") return `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`);
      return (a.bestValue ?? Number.POSITIVE_INFINITY) - (b.bestValue ?? Number.POSITIVE_INFINITY);
    });
  }, [comparisonGroups, concentration, query, sort, source, profile]);

  const exactComparisons = results.filter((item) => item.sources.length > 1).length;
  const sizeComparisons = results.filter((item) => item.bestValue != null).length;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-10 lg:px-12">
      <section className="grid gap-6 border-b border-border pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-[0.24em] text-muted">Stored NZ retailer prices</span>
          <h1 className="mt-3 font-display text-4xl font-normal leading-tight text-primary sm:text-5xl">Current fragrance scrape</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
            Only saved fragrance listings from approved New Zealand retailers, sorted for quick value comparison.
          </p>
        </div>
        <Link to="/explore" className="inline-flex w-fit border border-primary bg-primary px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-white hover:bg-primary-2">
          Back to explore
        </Link>
      </section>

      <section className="mt-5 grid gap-2 sm:grid-cols-3">
        <Stat label="Matched perfumes" value={results.length} />
        <Stat label="Stored NZ listings" value={data.count ?? 0} />
        <Stat label="Retailer compares" value={exactComparisons} />
      </section>

      <section className="sticky top-0 z-20 mt-5 border border-border bg-bg/95 p-3 backdrop-blur">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_190px_180px_200px_210px]">
          <label className="flex min-h-12 items-center gap-3 border border-border bg-white px-4">
            <Search size={18} className="shrink-0 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search brand, perfume, note, profile, size, or retailer"
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
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Profile</span>
            <select value={profile} onChange={(event) => setProfile(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-primary outline-none">
              {profiles.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All profiles" : item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-12 items-center gap-3 border border-border bg-white px-4">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Type</span>
            <select
              value={concentration}
              onChange={(event) => setConcentration(event.target.value as ConcentrationOption)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-primary outline-none"
            >
              {concentrationOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
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

      <StatusMessage sourceErrors={data.errors ?? []} comparisons={sizeComparisons} exactComparisons={exactComparisons} />

      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Results</span>
            <h2 className="mt-1 font-display text-2xl font-normal text-primary sm:text-3xl">{results.length} perfumes grouped for price comparison</h2>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{exactComparisons} with 2+ retailer listings</p>
        </div>

        {results.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {results.map((group) => (
              <PerfumeCard key={group.key} group={group} />
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
    <div className="border border-border bg-white px-3 py-2">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-normal leading-none text-primary">{value}</p>
    </div>
  );
}

function perfumeConcentration(name: string): Exclude<ConcentrationOption, "all"> {
  const normalized = name.toLowerCase();
  if (/\b(eau de parfum|edp)\b/.test(normalized)) return "edp";
  if (/\b(eau de toilette|edt)\b/.test(normalized)) return "edt";
  if (/\b(extrait|parfum|pure perfume)\b/.test(normalized)) return "parfum";
  if (/\b(eau de cologne|edc|cologne)\b/.test(normalized)) return "cologne";
  if (/\b(body mist|fragrance mist|perfume mist|body spray)\b/.test(normalized)) return "mist";
  if (/\b(perfume oil|solid perfume)\b/.test(normalized)) return "oil";
  return "other";
}

function StatusMessage({
  sourceErrors,
  comparisons,
  exactComparisons,
}: {
  sourceErrors: { retailer_slug: string; error: string }[];
  comparisons: number;
  exactComparisons: number;
}) {
  if (sourceErrors.length) {
    return (
      <div className="mt-4 flex items-start gap-3 border border-border bg-surface-soft px-4 py-3 text-sm text-muted">
        <AlertCircle className="mt-0.5 shrink-0 text-sale" size={18} />
        <span>Some sources failed: {sourceErrors.map((item) => item.retailer_slug).join(", ")}</span>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-start gap-3 border border-border bg-white px-4 py-3 text-sm text-muted">
      <span className="mt-1 h-2.5 w-2.5 shrink-0 bg-success" />
      <span>Using the stored NZ-only scrape: {exactComparisons} same-fragrance retailer comparisons and {comparisons} size-normalized value comparisons.</span>
    </div>
  );
}

function PerfumeCard({ group }: { group: PerfumeComparisonGroup }) {
  const item = group.items[0];
  const compareLabel = group.bestValue != null ? `${formatMoney(group.bestValue, group.currency)} / 100ml` : "No 100ml comparison";
  const hasMeaningfulSavings = group.sources.length > 1 && group.savings >= 0.01;
  const profiles = [...new Set(group.items.flatMap((candidate) => scentProfileLabels(candidate)))].slice(0, 2);
  const notes = [...new Set(group.items.flatMap((candidate) => perfumeNotes(candidate).all))].slice(0, 3);
  const retailerCount = new Set(group.sources.map((source) => retailerLabel(source.source_name, source.source_url))).size;

  return (
    <article className="group grid min-h-[214px] border border-border bg-white text-inherit transition hover:-translate-y-0.5 hover:shadow-hover sm:grid-cols-[116px_1fr]">
      <div className="min-h-[150px] border-b border-border bg-surface-soft sm:min-h-[214px] sm:border-b-0 sm:border-r">
        {group.image_url ? (
          <img src={group.image_url} alt={`${group.brand} ${group.name}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-muted">No image</div>
        )}
      </div>
      <div className="flex min-w-0 flex-col p-3">
        <Link to={`/perfumes/${perfumeSlug(item)}`} className="flex items-start justify-between gap-2 text-inherit no-underline">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">{group.brand}</p>
            <h3 className="mt-0.5 line-clamp-2 font-display text-lg font-normal leading-tight text-primary">{group.name}</h3>
          </div>
          <span className="mt-0.5 shrink-0 border border-border px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-primary">Open</span>
        </Link>

        <div className="mt-2 flex flex-wrap gap-1">
          <span className="border border-border bg-surface-soft px-2 py-1 text-[10px] font-bold text-muted">{group.size ?? "Unknown size"}</span>
          <span className="border border-border bg-surface-soft px-2 py-1 text-[10px] font-bold text-muted">
            {retailerCount} retailer{retailerCount === 1 ? "" : "s"}
          </span>
          {profiles.map((profile) => (
            <span key={profile} className="border border-border bg-white px-2 py-1 text-[10px] font-bold text-muted">
              {profile}
            </span>
          ))}
          {notes.map((note) => (
            <span key={note} className="border border-border bg-white px-2 py-1 text-[10px] font-bold text-muted">
              {note}
            </span>
          ))}
        </div>

        <div className="mt-3 grid gap-2">
          {group.sources.slice(0, 4).map((source, index) => {
            const value = sourcePricePer100ml(source);
            return (
              <a
                key={`${source.source_url}-${index}`}
                href={source.source_url}
                target="_blank"
                rel="noreferrer"
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-border bg-surface-soft px-2.5 py-2 text-inherit no-underline hover:bg-white"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">{retailerLabel(source.source_name, source.source_url).replace(" · NZ retailer", "")}</span>
                  <span className="block truncate text-[10px] font-semibold text-muted">{source.size ?? group.size ?? "Unknown size"}</span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-extrabold leading-none text-primary">{formatMoney(source.price, source.currency)}</span>
                  <span className="mt-1 block text-[9px] font-bold text-success">{value != null ? `${formatMoney(value, source.currency)} / 100ml` : "Size unavailable"}</span>
                </span>
              </a>
            );
          })}
          {group.sources.length > 4 ? <p className="text-[10px] font-bold text-muted">+ {group.sources.length - 4} more listings on the detail page</p> : null}
        </div>

        <div className="mt-auto pt-3">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">{priceLabel(group.bestSource.source_name, group.bestSource.source_url)}</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
            <span className="text-xl font-extrabold leading-none text-primary">{formatMoney(group.lowestPrice, group.currency)}</span>
            <span className="text-right text-xs font-bold text-success">{compareLabel}</span>
          </div>
          {hasMeaningfulSavings ? <p className="mt-1 text-[10px] font-bold text-sale">Save {formatMoney(group.savings, group.currency)} against the highest matched price</p> : null}
          <a href={group.bestSource.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-primary no-underline hover:text-sale">
            {hasMeaningfulSavings ? "View lowest price" : "View retailer"} <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </article>
  );
}
