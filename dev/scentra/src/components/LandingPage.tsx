import { Link } from "react-router-dom";
import { notes, products } from "../data/products";
import { ProductCard } from "./ProductCard";
import scrapedPerfumes from "../data/scraped-perfumes.json";
import heroBlue from "../assets/hero-oud-incense.png";
import { priceLabel, retailerLabel } from "../lib/pricing";

type ScrapedPerfume = {
  brand: string;
  name: string;
  size?: string | null;
  price?: number | null;
  price_per_100ml?: number | null;
  currency: string;
  image_url?: string | null;
  source_name: string;
  source_url: string;
  source_price?: number | null;
  source_count: number;
};

const scrapedFragrances = ((scrapedPerfumes as { results: ScrapedPerfume[] }).results ?? [])
  .slice()
  .sort((a, b) => (a.price_per_100ml ?? a.price ?? Number.POSITIVE_INFINITY) - (b.price_per_100ml ?? b.price ?? Number.POSITIVE_INFINITY))
  .slice(0, 6);

const gourmandProducts = products.filter((product) => {
  const text = [product.category, product.description, ...product.notes, ...(product.badges ?? [])].join(" ").toLowerCase();
  return /gourmand|vanilla|caramel|tonka|sweet|chocolate|honey|sugar|dessert|toffee|pistachio|milk|cream/.test(text);
});

export function LandingPage() {
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
          </div>
          <Link to="/explore" className="hidden text-sm font-extrabold text-primary hover:text-accent sm:block">
            View all fragrances
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {scrapedFragrances.map((item) => (
              <article key={`${item.brand}-${item.name}-${item.source_url}`} className="border border-border bg-white p-4">
                <div className="aspect-[4/5] overflow-hidden border border-border bg-surface-soft">
                  {item.image_url ? <img className="h-full w-full object-cover" src={item.image_url} alt={`${item.brand} ${item.name}`} /> : null}
                </div>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{item.brand}</p>
                <h3 className="mt-1 font-display text-xl font-normal leading-tight text-primary">{item.name}</h3>
                <p className="mt-2 text-sm text-muted">{item.size ?? "Unknown size"}</p>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{priceLabel(item.source_name, item.source_url)}</p>
                  <div className="mt-1 flex flex-col gap-1">
                    <p className="text-sm font-extrabold text-primary">
                      {item.currency} {item.price?.toFixed(item.price != null && item.price % 1 !== 0 ? 2 : 0) ?? "—"}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                      {item.price_per_100ml != null ? `${item.currency} ${item.price_per_100ml.toFixed(item.price_per_100ml % 1 === 0 ? 0 : 2)} / 100ml` : "100ml compare unavailable"}
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{retailerLabel(item.source_name, item.source_url)}</p>
                  <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-extrabold uppercase tracking-[0.12em] text-primary hover:text-accent">
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
