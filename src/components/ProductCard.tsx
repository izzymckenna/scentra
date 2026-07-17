import { Link } from "react-router-dom";
import type { Product } from "../data/products";
import { priceLabel, retailerLabel } from "../lib/pricing";

function formatMoney(amount: number, currency: Product["currency"]) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function ProductCard({ product }: { product: Product; deal?: boolean; compact?: boolean }) {
  return (
    <Link to={`/product/${product.id}`} className="group flex flex-col text-inherit no-underline transition duration-300 hover:-translate-y-1">
      <div className="relative aspect-[4/5] overflow-hidden border border-border bg-surface-soft">
        <img
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          src={product.image}
          alt={`${product.brand} ${product.name}`}
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{product.brand}</span>
        <h3 className="font-display text-base font-normal leading-tight text-primary sm:text-lg">{product.name}</h3>
        <p className="mt-1 text-sm text-muted">{product.sizeLabel}</p>
        <div className="mt-auto flex flex-col gap-1 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{priceLabel(product.sourceName, product.sourceUrl)}</span>
            <span className="text-lg font-extrabold leading-none text-primary sm:text-xl">{formatMoney(product.price, product.currency)}</span>
            {product.pricePer100Ml ? (
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                {product.sourceName === "Life Pharmacy" || product.sourceName === "Chemist Warehouse NZ" ? "NZ / 100ml compare" : "Source price only"}
              </span>
            ) : null}
          </div>
          <span className="max-w-none text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:max-w-[50%] sm:text-right">
            {retailerLabel(product.sourceName, product.sourceUrl)}
          </span>
        </div>
      </div>
    </Link>
  );
}
