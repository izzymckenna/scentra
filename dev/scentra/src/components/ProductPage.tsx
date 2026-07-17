import { ArrowLeft, Heart, ShoppingBag } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { products, type Product } from "../data/products";
import { ProductCard } from "./ProductCard";
import { isNzRetailer, priceLabel, retailerLabel } from "../lib/pricing";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function ProductPage() {
  const { id } = useParams();
  const product = products.find((item) => item.id === id);

  if (!product) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-5xl px-5 py-16">
        <Link to="/explore" className="inline-flex items-center gap-2 text-sm font-extrabold text-primary hover:text-accent">
          <ArrowLeft size={17} />
          Back to explore
        </Link>
        <h1 className="mt-8 font-display text-5xl font-normal text-primary">Product not found</h1>
        <p className="mt-3 text-muted">Try another fragrance profile.</p>
      </main>
    );
  }

  const similar = products.filter((item) => item.id !== product.id).slice(0, 4);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <Link to="/explore" className="inline-flex items-center gap-2 text-sm font-extrabold text-primary hover:text-accent">
        <ArrowLeft size={17} />
        Back to explore
      </Link>

      <section className="mt-6 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="border border-border bg-white p-5 shadow-card">
            <div className="aspect-[3/4] overflow-hidden rounded-md bg-surface-soft">
              <img className="h-full w-full object-cover" src={product.image} alt={`${product.brand} ${product.name}`} />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" className="inline-flex items-center justify-center gap-2 border border-border bg-white px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-primary hover:bg-surface-soft">
                <Heart size={17} fill={product.isWishlisted ? "currentColor" : "none"} />
                Save
              </button>
              <button type="button" className="inline-flex items-center justify-center gap-2 bg-primary px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-white hover:bg-primary-2">
                <ShoppingBag size={17} />
                Bag
              </button>
            </div>
          </div>

          <InfoPanel product={product} />
        </aside>

        <section className="rounded-md border border-border bg-white p-5 shadow-card md:p-8">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-accent">{product.brand}</p>
          <h1 className="mt-2 font-display text-3xl font-normal leading-tight text-primary sm:text-4xl md:text-6xl">{product.name}</h1>
          <p className="mt-3 text-lg font-semibold text-muted">{product.category}</p>

          <p className="mt-6 max-w-3xl text-base leading-7 text-text">{product.description}</p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniFact label="Price" value={formatMoney(product.price, product.currency)} />
            <MiniFact label="Size" value={product.sizeLabel} />
            <MiniFact label="Retailer" value={product.sourceName} />
            <MiniFact label="Concentration" value={product.concentration ?? product.category} />
          </div>

          <div className="mt-7">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-primary">Reference notes</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <NoteColumn title="Top notes" notes={product.notePyramid.top} />
              <NoteColumn title="Middle notes" notes={product.notePyramid.middle} />
              <NoteColumn title="Base notes" notes={product.notePyramid.base} />
            </div>
          </div>
        </section>
      </section>

      <section className="py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-normal text-primary sm:text-4xl">People also compare</h2>
            <p className="mt-2 text-muted">Profiles with overlapping notes, mood, or category.</p>
          </div>
          <Link to="/explore" className="hidden text-sm font-extrabold text-primary hover:text-accent sm:block">
            View all
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {similar.map((item) => (
            <ProductCard key={item.id} product={item} compact />
          ))}
        </div>
      </section>
    </main>
  );
}

function NoteColumn({ title, notes }: { title: string; notes: string[] }) {
  return (
    <section className="rounded-md border border-border bg-bg p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {notes.map((note) => (
          <NoteChip key={note} note={note} />
        ))}
      </div>
    </section>
  );
}

function NoteChip({ note }: { note: string }) {
  const swatch = getNoteSwatch(note);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-white px-1.5 py-1 text-[10px] font-bold text-primary">
      <span aria-hidden="true" className="h-4 w-4 flex-none rounded-[2px]" style={{ background: swatch }} />
      <span className="max-w-[72px] truncate">{note}</span>
    </span>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-surface-soft px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 font-display text-[15px] font-normal leading-snug text-primary">{value}</p>
    </div>
  );
}

function getNoteSwatch(note: string) {
  const normalized = note.toLowerCase();
  if (/bergamot|citrus|mandarin|orange|neroli/.test(normalized)) {
    return "linear-gradient(135deg, #f6c85f, #f08a24)";
  }
  if (/rose|jasmine|peony|violet|orchid|lily|iris|gardenia|floral|white rose|lily-of-the-valley/.test(normalized)) {
    return "linear-gradient(135deg, #efc0cf, #b95f7b)";
  }
  return "linear-gradient(135deg, #d8c5a4, #8d6b44)";
}

function InfoPanel({ product }: { product: Product }) {
  const nzRetailer = isNzRetailer(product.sourceName, product.sourceUrl);

  return (
    <section className="rounded-md border border-border bg-white p-4 shadow-card">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Key facts</h2>
      <dl className="mt-4 grid gap-3">
        <div className="grid gap-1 border-b border-border pb-3 sm:flex sm:items-start sm:justify-between sm:gap-4">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{priceLabel(product.sourceName, product.sourceUrl)}</dt>
          <dd className="font-display text-[15px] font-normal text-primary sm:text-right">
            {formatMoney(nzRetailer ? product.pricePer100Ml : product.price, product.currency)}
          </dd>
        </div>
        {nzRetailer ? (
          <FactRow label="Source bottle" value={`${formatMoney(product.sourcePrice, product.sourceCurrency ?? product.currency)} / ${product.sourceSizeLabel}`} />
        ) : (
          <FactRow label="Source price" value={formatMoney(product.sourcePrice, product.sourceCurrency ?? product.currency)} />
        )}
        <FactRow label="Source retailer" value={retailerLabel(product.sourceName, product.sourceUrl)} />
        <FactRow label="NZ status" value={nzRetailer ? "Live NZ retailer" : "Not a New Zealand retailer"} />
        <FactRow label="Concentration" value={product.concentration ?? product.category} />
        <FactRow label="Launched" value={product.launched ? String(product.launched) : "Current"} />
        <FactRow label="Audience" value={product.gender} />
        <FactRow label="Perfumer" value={product.perfumer ?? "Brand studio"} />
      </dl>
    </section>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border pb-3 last:border-0 last:pb-0 sm:flex sm:items-start sm:justify-between sm:gap-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="font-display text-[13px] font-normal text-primary sm:text-right">{value}</dd>
    </div>
  );
}
