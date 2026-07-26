import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { notes, products } from "../data/products";
import { ProductCard } from "./ProductCard";
import heroBlue from "../assets/hero-oud-incense.png";
import { fetchLatestPerfumeSnapshot, formatMoney, localPerfumeData, perfumeSlug, type PerfumeResponse } from "../lib/perfumes";
import { priceLabel, retailerLabel } from "../lib/pricing";

const gourmandProducts = products.filter((product) => {
  const text = [product.category, product.description, ...product.notes, ...(product.badges ?? [])].join(" ").toLowerCase();
  return /gourmand|vanilla|caramel|tonka|sweet|chocolate|honey|sugar|dessert|toffee|pistachio|milk|cream/.test(text);
});

export function LandingPage() {
  const [perfumeData, setPerfumeData] = useState<PerfumeResponse>(() => localPerfumeData());

  useEffect(() => {
    let ignore = false;
    fetchLatestPerfumeSnapshot()
      .then((snapshot) => {
        if (!ignore) setPerfumeData(snapshot);
      })
      .catch(() => {
        // Keep bundled scrape data if the latest GitHub snapshot is unavailable.
      });
    return () => {
      ignore = true;
    };
  }, []);

  const scrapedFragrances = useMemo(() => {
    return [...(perfumeData.results ?? [])]
      .sort((a, b) => (a.price_per_100ml ?? a.price ?? Number.POSITIVE_INFINITY) - (b.price_per_100ml ?? b.price ?? Number.POSITIVE_INFINITY))
      .slice(0, 8);
  }, [perfumeData.results]);

  return (
    <>
      <section className="grid gap-5 border-b border-border px-6 py-6 md:grid-cols-[1.12fr_0.88fr] md:gap-12 md:px-12 md:py-12">
        <div className="min-h-[320px] overflow-hidden border border-border bg-surface-deep md:min-h-[560px]">
          <img className="h-full w-full object-cover" src={heroBlue} alt="Fragrance hero" />
        </div>
        <div className="flex max-w-[560px] flex-col justify-center pt-1 md:pt-0">
          <span className="mb-4 block text-[11px] uppercase tracking-[0.27em] text-muted">Fragrance-first</span>
          <h1 className="max-w-[11ch] font-display text-[2.75rem] font-normal leading-[1] text-primary sm:text-[clamp(3.25rem,4.5vw,4.75rem)]">
            Fragrance, clearly priced.
          </h1>
          <p className="mt-5 max-w-[38ch] text-base leading-7 text-muted">
            A calm catalogue for comparing fragrance across NZ retailers with less noise and clearer hierarchy.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/perfumes"
              className="inline-flex w-full items-center justify-center bg-primary px-7 py-3 text-xs uppercase tracking-[0.18em] text-white no-underline transition hover:bg-primary-2 sm:w-fit"
            >
              View fragrances
            </Link>
            <Link
              to="/explore"
              className="inline-flex w-full items-center justify-center border border-border bg-white px-7 py-3 text-xs uppercase tracking-[0.18em] text-primary no-underline transition hover:bg-surface-soft sm:w-fit"
            >
              Explore catalogue
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:px-12">
        <div className="mb-5 flex items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <span className="mb-2 block text-[11px] uppercase tracking-[0.27em] text-muted">Live NZ Prices</span>
            <h2 className="font-display text-[32px] font-normal leading-tight text-primary">Scraped fragrances from NZ stores</h2>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">Stored GitHub scrape loaded: {perfumeData.count ?? 0}</p>
          </div>
          <Link to="/perfumes" className="hidden text-sm font-extrabold text-primary hover:text-accent sm:block">
            View all fragrances
          </Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-8">
          {scrapedFragrances.map((item) => (
            <article key={`${item.brand}-${item.name}-${item.source_url}`} className="border border-border bg-white p-2">
              <Link to={`/perfumes/${perfumeSlug(item)}`} className="block text-inherit no-underline">
                <div className="aspect-square overflow-hidden border border-border bg-surface-soft">
                  {item.image_url ? <img className="h-full w-full object-cover" src={item.image_url} alt={`${item.brand} ${item.name}`} /> : null}
                </div>
                <p className="mt-1.5 truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">{item.brand}</p>
                <h3 className="mt-0.5 line-clamp-2 font-display text-sm font-normal leading-tight text-primary">{item.name}</h3>
                <p className="mt-0.5 text-[10px] text-muted">{item.size ?? "Unknown size"}</p>
              </Link>
              <div className="mt-2 border-t border-border pt-2">
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">{priceLabel(item.source_name, item.source_url)}</p>
                <div className="mt-0.5 flex flex-col gap-0.5">
                  <p className="text-xs font-extrabold text-primary">{formatMoney(item.price, item.currency)}</p>
                  <p className="text-[9px] uppercase tracking-[0.12em] text-muted">
                    {item.price_per_100ml != null ? `${formatMoney(item.price_per_100ml, item.currency)} / 100ml` : "100ml compare unavailable"}
                  </p>
                </div>
                <p className="mt-1.5 line-clamp-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">{retailerLabel(item.source_name, item.source_url)}</p>
                <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-[9px] font-extrabold uppercase tracking-[0.1em] text-primary hover:text-accent">
                  View source
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="px-6 pb-12 md:px-12">
        <div className="mb-5 flex items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <span className="mb-2 block text-[11px] uppercase tracking-[0.27em] text-muted">Gourmand Picks</span>
            <h2 className="font-display text-[32px] font-normal leading-tight text-primary">Sweet, creamy, and edible-leaning</h2>
          </div>
          <Link to="/explore?note=vanilla" className="hidden text-sm font-extrabold text-primary hover:text-accent sm:block">
            Browse gourmand notes
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {gourmandProducts.slice(0, 6).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="mx-6 grid gap-12 border border-border bg-surface-deep p-6 md:mx-12 md:grid-cols-[1fr_2fr] md:p-12">
        <div>
          <span className="mb-4 block text-[11px] uppercase tracking-[0.27em] text-muted">Note Discovery</span>
          <h2 className="mb-4 font-display text-[32px] font-normal leading-tight text-primary">Filter by the Essence</h2>
          <p className="text-sm leading-6 text-muted">
            Understand the architecture of your scent. Select a note to find your perfect match.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {notes.slice(0, 6).map((note) => (
            <Link
              key={note.name}
              to={`/explore?note=${note.name.toLowerCase()}`}
              className="border border-border bg-bg p-6 text-center no-underline transition hover:border-primary hover:bg-white"
            >
              <span className="mb-2 block font-display text-2xl text-primary">{note.name[0]}</span>
              <span className="block text-[11px] uppercase tracking-[0.14em] text-text">{note.name}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
