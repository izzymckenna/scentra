import { Info, Menu, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";

const navItems = [
  { label: "Perfumes", to: "/perfumes" },
  { label: "Deals", to: "/explore?category=deals" },
  { label: "Fragrance", to: "/explore?category=fragrance" },
  { label: "Brands", to: "/explore?category=brands" },
  { label: "About", to: "/about" },
];

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/95 backdrop-blur">
      <div className="flex h-[72px] items-center justify-between px-6 md:px-12">
        <Link to="/" className="font-display text-2xl uppercase tracking-[0.16em] text-primary no-underline">
          Scentra
        </Link>
        <nav aria-label="Primary navigation" className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-text no-underline transition hover:text-primary"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <IconLink to="/explore" label="Search">
            <Search size={19} />
          </IconLink>
          <IconLink to="/about" label="About">
            <Info size={19} />
          </IconLink>
          {user ? (
            <>
              <Link to="/sign-in" className="border border-border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-primary no-underline transition hover:bg-surface-soft">
                {user.name}
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="border border-border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-primary transition hover:bg-surface-soft"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/sign-in" className="border border-border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-primary no-underline transition hover:bg-surface-soft">
              Sign in
            </Link>
          )}
        </div>
        <button className="border border-border bg-white p-3 text-primary md:hidden" aria-label="Open menu">
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}

function IconLink({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="grid h-10 w-10 place-items-center text-text transition hover:bg-surface-soft"
    >
      {children}
    </Link>
  );
}
