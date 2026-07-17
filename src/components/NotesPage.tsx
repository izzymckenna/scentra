import { Link } from "react-router-dom";
import { notes, products } from "../data/products";

export function NotesPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-12">
      <section className="border-b border-border pb-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Notes</p>
        <h1 className="mt-3 font-display text-5xl font-normal leading-[1.05] text-primary md:text-6xl">A small guide to the notes people actually know.</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-muted">
          These are the building blocks that show up again and again in perfume. Each note here is linked to examples in the catalogue so the wording stays concrete.
        </p>
      </section>

      <section className="grid gap-5 py-10 sm:grid-cols-2 xl:grid-cols-3">
        {notes.map((note) => {
          const matches = products
            .filter((product) => {
              const haystack = [...product.notes, ...product.notePyramid.top, ...product.notePyramid.middle, ...product.notePyramid.base]
                .join(" ")
                .toLowerCase();
              return haystack.includes(note.name.toLowerCase());
            })
            .slice(0, 2);

          return (
            <article key={note.name} className="border border-border bg-white p-5">
              <h2 className="font-display text-3xl font-normal text-primary">{note.name}</h2>
              <p className="mt-3 text-sm leading-7 text-muted">{note.copy}</p>
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Appears in</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {matches.length ? (
                    matches.map((product) => (
                      <Link key={product.id} to={`/product/${product.id}`} className="border border-border bg-surface-soft px-3 py-1.5 text-xs font-bold text-primary no-underline transition hover:bg-white">
                        {product.brand}
                      </Link>
                    ))
                  ) : (
                    <span className="text-sm text-muted">No direct match in the current catalogue.</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
