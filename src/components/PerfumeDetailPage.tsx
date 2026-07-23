import { ArrowLeft, ExternalLink, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  comparableSources,
  findPerfumeBySlug,
  formatMoney,
  perfumeSlug,
  scentProfileLabels,
  similarPerfumes,
  sourcePricePer100ml,
} from "../lib/perfumes";
import { retailerLabel } from "../lib/pricing";

export function PerfumeDetailPage() {
  const { slug } = useParams();
  const item = findPerfumeBySlug(slug);

  if (!item) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-12 md:px-10">
        <Link to="/perfumes" className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-primary no-underline">
          <ArrowLeft size={16} /> Perfumes
        </Link>
        <section className="mt-8 border border-border bg-white px-6 py-14 text-center">
          <h1 className="font-display text-4xl font-normal text-primary">Fragrance not found</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">The saved scrape snapshot does not include that fragrance page anymore.</p>
          <Link to="/perfumes" className="mt-6 inline-flex border border-primary px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-primary no-underline hover:bg-surface-soft">
            Search scraped perfumes
          </Link>
        </section>
      </main>
    );
  }

  const sources = comparableSources(item);
  const profiles = scentProfileLabels(item);
  const related = similarPerfumes(item);
  const best = sources[0];

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-10 lg:px-12">
      <Link to="/perfumes" className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-primary no-underline hover:text-sale">
        <ArrowLeft size={16} /> Scraped perfumes
      </Link>

      <section className="mt-6 grid gap-8 border-b border-border pb-8 lg:grid-cols-[360px_1fr]">
        <div className="border border-border bg-surface-soft">
          {item.image_url ? (
            <img src={item.image_url} alt={`${item.brand} ${item.name}`} className="aspect-[4/5] w-full object-cover" />
          ) : (
            <div className="grid aspect-[4/5] place-items-center px-6 text-center text-xs font-extrabold uppercase tracking-[0.16em] text-muted">No image</div>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-muted">{item.brand}</p>
          <h1 className="mt-3 font-display text-4xl font-normal leading-tight text-primary sm:text-5xl">{item.name}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="border border-border bg-white px-3 py-2 text-xs font-bold text-muted">{item.size ?? "Unknown size"}</span>
            <span className="border border-border bg-white px-3 py-2 text-xs font-bold text-muted">{sources.length} retailer listing{sources.length === 1 ? "" : "s"}</span>
            {profiles.map((profile) => (
              <Link key={profile} to={`/perfumes?profile=${encodeURIComponent(profile)}`} className="border border-border bg-white px-3 py-2 text-xs font-bold text-muted no-underline hover:bg-surface-soft">
                {profile}
              </Link>
            ))}
          </div>

          {item.description ? <p className="mt-5 max-w-3xl text-base leading-7 text-muted">{item.description}</p> : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Best price" value={formatMoney(item.price, item.currency)} />
            <Stat label="Value" value={item.price_per_100ml != null ? `${formatMoney(item.price_per_100ml, item.currency)} / 100ml` : "No size compare"} />
            <Stat label="Best source" value={best ? retailerLabel(best.source_name, best.source_url).replace(" · NZ retailer", "") : "Unknown"} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {best ? (
              <a href={best.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-primary bg-primary px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-white no-underline hover:bg-primary-2">
                Buy best match <ExternalLink size={15} />
              </a>
            ) : null}
            <a href="#compare" className="inline-flex items-center gap-2 border border-border bg-white px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-primary no-underline hover:bg-surface-soft">
              Compare listings
            </a>
            <Link to={`/perfumes?q=${encodeURIComponent(`${item.brand} ${item.name}`)}`} className="inline-flex items-center gap-2 border border-border bg-white px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-primary no-underline hover:bg-surface-soft">
              Find similar <Search size={15} />
            </Link>
          </div>
        </div>
      </section>

      <section id="compare" className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Compare</span>
            <h2 className="mt-1 font-display text-3xl font-normal text-primary">Find this fragrance at once</h2>
          </div>
          <p className="text-sm font-semibold text-muted">Sorted by lowest bottle price.</p>
        </div>

        <div className="overflow-x-auto border border-border bg-white">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="bg-surface-soft text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="border-b border-border px-4 py-3">Retailer</th>
                <th className="border-b border-border px-4 py-3">Listing</th>
                <th className="border-b border-border px-4 py-3">Size</th>
                <th className="border-b border-border px-4 py-3">Price</th>
                <th className="border-b border-border px-4 py-3">Value</th>
                <th className="border-b border-border px-4 py-3 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => {
                const value = sourcePricePer100ml(source);
                return (
                  <tr key={`${source.retailer_slug}-${source.source_url}`} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-4 text-sm font-extrabold text-primary">{retailerLabel(source.source_name, source.source_url).replace(" · NZ retailer", "")}</td>
                    <td className="px-4 py-4 text-sm text-muted">
                      <span className="block font-bold text-text">{source.brand}</span>
                      <span>{source.name}</span>
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-muted">{source.size ?? item.size ?? "Unknown"}</td>
                    <td className="px-4 py-4 text-lg font-extrabold text-primary">{formatMoney(source.price, source.currency)}</td>
                    <td className="px-4 py-4 text-sm font-bold text-success">{value != null ? `${formatMoney(value, source.currency)} / 100ml` : "No size compare"}</td>
                    <td className="px-4 py-4 text-right">
                      <a href={source.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-primary no-underline hover:text-sale">
                        Retailer <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {related.length ? (
        <section className="mt-8">
          <div className="mb-4 border-b border-border pb-3">
            <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Scent profile</span>
            <h2 className="mt-1 font-display text-3xl font-normal text-primary">Similar scraped fragrances</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {related.map((candidate) => (
              <Link key={perfumeSlug(candidate)} to={`/perfumes/${perfumeSlug(candidate)}`} className="grid grid-cols-[72px_1fr] border border-border bg-white text-inherit no-underline hover:shadow-hover">
                <div className="border-r border-border bg-surface-soft">
                  {candidate.image_url ? <img src={candidate.image_url} alt={`${candidate.brand} ${candidate.name}`} className="h-full min-h-[96px] w-full object-cover" loading="lazy" /> : null}
                </div>
                <div className="min-w-0 p-3">
                  <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{candidate.brand}</p>
                  <h3 className="mt-1 line-clamp-2 font-display text-base font-normal leading-tight text-primary">{candidate.name}</h3>
                  <p className="mt-2 text-xs font-bold text-success">{candidate.price_per_100ml != null ? `${formatMoney(candidate.price_per_100ml, candidate.currency)} / 100ml` : formatMoney(candidate.price, candidate.currency)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border bg-white px-4 py-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 truncate text-lg font-extrabold leading-tight text-primary">{value}</p>
    </div>
  );
}
