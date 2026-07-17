import { Link } from "react-router-dom";
import { notes, products } from "../data/products";

export function AboutPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-12">
      <section className="grid gap-8 border-b border-border pb-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">About Scentra</p>
          <h1 className="mt-3 font-display text-5xl font-normal leading-[1.05] text-primary md:text-6xl">
            Fragrance, priced and presented with more discipline.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-muted">
            Scentra is a fragrance-first catalogue built to scan quickly, compare honestly, and keep the presentation clean.
            We surface bottle sizes, source prices, and 100ml comparisons so the number you see has context.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/explore" className="inline-flex items-center justify-center border border-border bg-primary px-6 py-3 text-xs font-extrabold uppercase tracking-[0.14em] text-white no-underline transition hover:bg-primary-2">
              Browse fragrances
            </Link>
            <Link to="/notes" className="inline-flex items-center justify-center border border-border bg-white px-6 py-3 text-xs font-extrabold uppercase tracking-[0.14em] text-primary no-underline transition hover:bg-surface-soft">
              View note guide
            </Link>
          </div>
        </div>

        <div className="border border-border bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {products.slice(0, 3).map((product) => (
              <div key={product.id} className="border border-border bg-surface-soft p-2">
                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Focus" value="Fragrance" />
            <Metric label="Pricing" value="100ml" />
            <Metric label="Tone" value="Sleek" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 py-10 lg:grid-cols-3">
        <Panel title="What it does" copy="Lets you compare bottles without mixing in unrelated categories or opaque labels." />
        <Panel title="How it reads" copy="The interface stays dense but calm, with small note references and restrained color." />
        <Panel title="Where prices come from" copy="Source prices are kept separately from the 100ml comparison price so bottle size differences stay visible." />
      </section>

      <section className="border border-border bg-surface-deep p-6 md:p-10">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Approach</p>
            <h2 className="mt-2 font-display text-4xl font-normal text-primary">Built around scanning, not browsing forever.</h2>
          </div>
          <Link to="/explore" className="hidden text-sm font-extrabold text-primary hover:text-accent sm:block">
            Explore
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {notes.slice(0, 4).map((note) => (
            <article key={note.name} className="border border-border bg-white p-4">
              <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-primary">{note.name}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{note.copy}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-bg p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-lg font-extrabold text-primary">{value}</p>
    </div>
  );
}

function Panel({ title, copy }: { title: string; copy: string }) {
  return (
    <article className="border border-border bg-white p-5">
      <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-primary">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-muted">{copy}</p>
    </article>
  );
}
