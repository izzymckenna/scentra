import { SlidersHorizontal, Search, X } from "lucide-react";

export function SearchBar({ value = "", onChange, onFilter }: { value?: string; onChange?: (value: string) => void; onFilter?: () => void }) {
  return (
    <label className="relative block">
      <span className="sr-only">Search fragrances, brands, notes, and products</span>
      <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" size={20} />
      <input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder="Search fragrances, brands, notes, products..."
        className="h-14 w-full rounded-sm border border-border bg-white pl-14 pr-24 text-sm font-semibold text-primary shadow-card outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange?.("")} className="absolute right-14 top-1/2 -translate-y-1/2 rounded-sm p-2 text-muted hover:bg-surface-soft">
          <X size={18} />
        </button>
      )}
      <button type="button" aria-label="Open filters" onClick={onFilter} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-sm bg-primary text-white transition hover:bg-primary-2">
        <SlidersHorizontal size={18} />
      </button>
    </label>
  );
}
