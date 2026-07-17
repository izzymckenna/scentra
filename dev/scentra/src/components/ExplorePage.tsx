import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { products, type Product } from "../data/products";
import { ProductCard } from "./ProductCard";
import { SearchBar } from "./SearchBar";

const categories = ["Fragrance"];
const families = ["Floral", "Woody", "Amber", "Fresh", "Citrus", "Gourmand", "Aquatic", "Spicy"];
const noteChips = ["Vanilla", "Rose", "Jasmine", "Bergamot", "Sandalwood", "Musk", "Patchouli", "Tonka", "Amber", "Coconut"];
const brands = [
  "Tom Ford",
  "Dior",
  "Yves Saint Laurent",
  "Byredo",
  "Maison Francis Kurkdjian",
  "Chanel",
  "Sol de Janeiro",
  "Britney Spears",
  "Clinique",
  "Elizabeth Arden",
  "Sabrina Carpenter",
  "Lattafa",
  "Lush",
  "Montblanc",
  "Estée Lauder",
  "Billie Eilish",
  "Emporio Armani",
];
const preferences = ["On sale", "Vegan", "Cruelty-free", "Long-lasting", "Travel size", "Giftable", "Trending"];
const sortOptions = ["Recommended", "Best deals", "Price: low to high", "Price: high to low", "Highest rated", "Newest"] as const;

type SortOption = (typeof sortOptions)[number];

function normalize(value: string) {
  return value.toLowerCase();
}

function getFamilyTags(product: Product) {
  const text = [product.category, ...product.notes, ...(product.badges ?? []), ...product.accords.map((item) => item.name)].join(" ").toLowerCase();
  const tags: string[] = [];

  if (/floral|rose|jasmine|peony|violet|orchid|lily|gardenia|iris/.test(text)) tags.push("Floral");
  if (/woody|cedar|sandalwood|vetiver|patchouli|amberwood|oakmoss|woods?/.test(text)) tags.push("Woody");
  if (/amber|vanilla|gourmand|caramel|tonka|sweet|chocolate|honey|sugar/.test(text)) tags.push("Amber");
  if (/fresh|clean|aldehyd|linen|mint|aromatic|aquatic|musk/.test(text)) tags.push("Fresh");
  if (/citrus|bergamot|orange|mandarin|lemon|grapefruit|neroli/.test(text)) tags.push("Citrus");
  if (/gourmand|dessert|sweet|caramel|vanilla|pistachio|chocolate|honey/.test(text)) tags.push("Gourmand");
  if (/aquatic|marine|sea|ocean|salt|water/.test(text)) tags.push("Aquatic");
  if (/spicy|warm spicy|pepper|saffron|ginger|cardamom|cinnamon/.test(text)) tags.push("Spicy");

  return [...new Set(tags)];
}

export function ExplorePage() {
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(500);
  const [sort, setSort] = useState<SortOption>("Recommended");

  const filteredProducts = useMemo(() => {
    const normalized = normalize(query.trim());

    const filtered = products.filter((product) => {
      const searchable = [product.brand, product.name, product.category, ...product.notes, ...(product.badges ?? [])].join(" ").toLowerCase();
      const matchesQuery = !normalized || searchable.includes(normalized);
      const matchesCategory = !selectedCategories.length || selectedCategories.some((value) => normalize(product.category).includes(normalize(value)));
      const matchesFamily = !selectedFamilies.length || selectedFamilies.some((value) => getFamilyTags(product).includes(value));
      const matchesNotes = !selectedNotes.length || selectedNotes.every((note) => searchable.includes(note.toLowerCase()));
      const matchesBrand = !selectedBrands.length || selectedBrands.includes(product.brand);
      const matchesPrice = product.price <= maxPrice;
      const badgeText = (product.badges ?? []).join(" ").toLowerCase();
      const matchesPreferences =
        !selectedPreferences.length ||
        selectedPreferences.every((preference) => {
          switch (preference) {
            case "On sale":
              return Boolean(product.originalPrice && product.originalPrice > product.price);
            case "Vegan":
              return badgeText.includes("vegan");
            case "Cruelty-free":
              return badgeText.includes("cruelty-free");
            case "Long-lasting":
              return badgeText.includes("long-lasting") || product.longevity >= 80;
            case "Travel size":
              return product.sizeMl <= 50 || badgeText.includes("travel");
            case "Giftable":
              return badgeText.includes("giftable");
            case "Trending":
              return badgeText.includes("trending") || product.reviewCount > 2000;
            default:
              return true;
          }
        });

      return matchesQuery && matchesCategory && matchesFamily && matchesNotes && matchesBrand && matchesPrice && matchesPreferences;
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "Best deals": {
          const aDiscount = a.discountPercent ?? (a.originalPrice && a.originalPrice > a.price ? ((a.originalPrice - a.price) / a.originalPrice) * 100 : 0);
          const bDiscount = b.discountPercent ?? (b.originalPrice && b.originalPrice > b.price ? ((b.originalPrice - b.price) / b.originalPrice) * 100 : 0);
          return bDiscount - aDiscount;
        }
        case "Price: low to high":
          return a.price - b.price;
        case "Price: high to low":
          return b.price - a.price;
        case "Highest rated":
          return b.rating - a.rating;
        case "Newest":
          return (b.launched ?? 0) - (a.launched ?? 0);
        case "Recommended":
        default:
          return b.rating - a.rating || a.price - b.price;
      }
    });
  }, [maxPrice, query, selectedBrands, selectedCategories, selectedFamilies, selectedNotes, selectedPreferences, sort]);

  function clearSearch() {
    setQuery("");
    setShowLoading(false);
    setSelectedCategories([]);
    setSelectedFamilies([]);
    setSelectedNotes([]);
    setSelectedBrands([]);
    setSelectedPreferences([]);
    setMaxPrice(500);
    setSort("Recommended");
  }

  function toggleValue(value: string, current: string[], setter: (next: string[]) => void) {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12">
      <section className="grid gap-6 border-b border-border pb-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <span className="mb-3 block text-[11px] uppercase tracking-[0.27em] text-muted">Explore</span>
          <h1 className="font-display text-4xl font-normal leading-tight text-primary sm:text-5xl">Browse the collection</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted">Search by scent, brand, note, category, price, or mood.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowLoading((value) => !value)}
          className="hidden border border-border bg-white px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-primary transition hover:bg-surface-soft md:inline-flex"
        >
          Toggle loading state
        </button>
      </section>

      <div className="mt-8">
        <SearchBar value={query} onChange={setQuery} onFilter={() => setSheetOpen(true)} />
      </div>

      <section className="mt-10 grid gap-8 lg:grid-cols-[290px_1fr]">
        <aside className="hidden lg:block">
          <FilterSidebar
            selectedCategories={selectedCategories}
            selectedFamilies={selectedFamilies}
            selectedNotes={selectedNotes}
            selectedBrands={selectedBrands}
            selectedPreferences={selectedPreferences}
            maxPrice={maxPrice}
            onToggleCategory={(value) => toggleValue(value, selectedCategories, setSelectedCategories)}
            onToggleFamily={(value) => toggleValue(value, selectedFamilies, setSelectedFamilies)}
            onToggleNote={(value) => toggleValue(value, selectedNotes, setSelectedNotes)}
            onToggleBrand={(value) => toggleValue(value, selectedBrands, setSelectedBrands)}
            onTogglePreference={(value) => toggleValue(value, selectedPreferences, setSelectedPreferences)}
            onPriceChange={setMaxPrice}
            onClear={clearSearch}
          />
        </aside>

        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-muted">
              {filteredProducts.length} results
              {query ? <span> for “{query}”</span> : null}
            </p>
            <label className="flex items-center gap-3 text-sm font-bold text-primary">
              Sort
              <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)} className="border border-border bg-white px-4 py-2 text-sm font-bold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
                {sortOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          {showLoading ? (
            <SkeletonGrid />
          ) : filteredProducts.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="border border-border bg-surface-deep px-6 py-16 text-center">
              <h2 className="font-display text-3xl font-normal text-primary sm:text-4xl">No products match these filters.</h2>
              <p className="mx-auto mt-3 max-w-md text-muted">Try removing a filter or searching for a broader note, brand, or category.</p>
              <button type="button" onClick={clearSearch} className="mt-7 bg-primary px-6 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-white transition hover:bg-primary-2">
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      {sheetOpen && (
        <div className="fixed inset-0 z-[60] bg-primary/35 lg:hidden" role="dialog" aria-modal="true" aria-label="Product filters">
          <button className="absolute inset-0 h-full w-full cursor-default" aria-label="Close filters" onClick={() => setSheetOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-auto bg-bg p-5 shadow-hover">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-3xl font-normal text-primary">Filters</h2>
              <button type="button" aria-label="Close filters" className="border border-border bg-white p-3 text-primary" onClick={() => setSheetOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <FilterSidebar
              mobile
              selectedCategories={selectedCategories}
              selectedFamilies={selectedFamilies}
              selectedNotes={selectedNotes}
              selectedBrands={selectedBrands}
              selectedPreferences={selectedPreferences}
              maxPrice={maxPrice}
              onToggleCategory={(value) => toggleValue(value, selectedCategories, setSelectedCategories)}
              onToggleFamily={(value) => toggleValue(value, selectedFamilies, setSelectedFamilies)}
              onToggleNote={(value) => toggleValue(value, selectedNotes, setSelectedNotes)}
              onToggleBrand={(value) => toggleValue(value, selectedBrands, setSelectedBrands)}
              onTogglePreference={(value) => toggleValue(value, selectedPreferences, setSelectedPreferences)}
              onPriceChange={setMaxPrice}
              onClear={clearSearch}
            />
            <div className="sticky bottom-0 mt-5 flex flex-col gap-3 border-t border-border bg-bg py-4 sm:flex-row">
              <button type="button" onClick={clearSearch} className="flex-1 border border-border bg-white px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-primary">
                Clear all
              </button>
              <button type="button" onClick={() => setSheetOpen(false)} className="flex-1 bg-primary px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-white">
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function FilterSidebar({
  mobile = false,
  selectedCategories,
  selectedFamilies,
  selectedNotes,
  selectedBrands,
  selectedPreferences,
  maxPrice,
  onToggleCategory,
  onToggleFamily,
  onToggleNote,
  onToggleBrand,
  onTogglePreference,
  onPriceChange,
  onClear,
}: {
  mobile?: boolean;
  selectedCategories: string[];
  selectedFamilies: string[];
  selectedNotes: string[];
  selectedBrands: string[];
  selectedPreferences: string[];
  maxPrice: number;
  onToggleCategory: (value: string) => void;
  onToggleFamily: (value: string) => void;
  onToggleNote: (value: string) => void;
  onToggleBrand: (value: string) => void;
  onTogglePreference: (value: string) => void;
  onPriceChange: (value: number) => void;
  onClear: () => void;
}) {
  return (
    <div className={`${mobile ? "" : "sticky top-28"} border border-border bg-surface-deep p-5`}>
      <div className="mb-5 flex items-center gap-2 text-primary">
        <SlidersHorizontal size={18} />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.27em] text-muted">Filters</h2>
      </div>
      <FilterGroup title="Category" items={categories} selected={selectedCategories} onToggle={onToggleCategory} />
      <FilterGroup title="Fragrance Family" items={families} selected={selectedFamilies} onToggle={onToggleFamily} />
      <div className="border-t border-border py-5">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.27em] text-muted">Notes</h3>
        <div className="flex flex-wrap gap-2">
          {noteChips.map((note) => (
            <button
              key={note}
              type="button"
              onClick={() => onToggleNote(note)}
              className={`border px-3 py-2 text-[11px] font-semibold transition ${
                selectedNotes.includes(note) ? "border-primary bg-primary text-white" : "border-border bg-white text-primary hover:bg-surface-soft"
              }`}
            >
              {note}
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-border py-5">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.27em] text-muted">Price</h3>
        <input aria-label="Maximum price" type="range" min="0" max="500" value={maxPrice} onChange={(event) => onPriceChange(Number(event.target.value))} className="w-full accent-accent" />
        <div className="mt-2 flex justify-between text-[11px] font-medium text-muted">
          <span>$0</span>
          <span>{`$${maxPrice}+`}</span>
        </div>
      </div>
      <FilterGroup title="Brand" items={brands} selected={selectedBrands} onToggle={onToggleBrand} searchable />
      <div className="border-t border-border py-5">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.27em] text-muted">Preferences</h3>
        <div className="flex flex-wrap gap-2">
          {preferences.map((preference) => (
            <button
              key={preference}
              type="button"
              onClick={() => onTogglePreference(preference)}
              className={`border px-3 py-2 text-[11px] font-semibold transition ${
                selectedPreferences.includes(preference) ? "border-primary bg-primary text-white" : "border-border bg-white text-primary hover:bg-surface-soft"
              }`}
            >
              {preference}
            </button>
          ))}
        </div>
      </div>
      {!mobile && (
        <div className="grid gap-3 border-t border-border pt-5">
          <button type="button" className="bg-primary px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-white transition hover:bg-primary-2">
            Apply Filters
          </button>
          <button type="button" onClick={onClear} className="border border-border bg-white px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-primary transition hover:bg-surface-soft">
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  title,
  items,
  searchable = false,
  selected,
  onToggle,
}: {
  title: string;
  items: string[];
  searchable?: boolean;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="border-t border-border py-5">
      <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.27em] text-muted">{title}</legend>
      {searchable && <input aria-label={`Search ${title}`} placeholder="Search brands" className="mb-3 h-10 w-full border border-border px-4 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            className={`border px-3 py-2 text-[11px] font-semibold transition ${
              selected.includes(item) ? "border-primary bg-primary text-white" : "border-border bg-white text-primary hover:bg-surface-soft"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="animate-pulse border border-border bg-white p-4">
          <div className="aspect-square bg-surface-soft" />
          <div className="mt-5 h-3 w-24 bg-surface-soft" />
          <div className="mt-3 h-5 w-4/5 bg-surface-soft" />
          <div className="mt-3 h-3 w-3/5 bg-surface-soft" />
          <div className="mt-6 h-11 bg-surface-soft" />
        </div>
      ))}
    </div>
  );
}
