import { Instagram, Twitter, Youtube } from "lucide-react";
import { Link } from "react-router-dom";

const groups = [
  { title: "Explore", links: ["Perfumes", "Notes", "About", "Forum"] },
  { title: "Browse", links: ["Explore", "Fragrance", "Deals"] },
  { title: "Account", links: ["Sign in"] },
];

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-bg text-primary">
      <div className="grid gap-12 px-6 py-12 md:grid-cols-4 md:px-12">
        <div>
          <Link to="/" className="mb-6 block font-display text-2xl uppercase tracking-[0.16em] no-underline">Scentra</Link>
          <p className="text-xs leading-5 text-muted">Curated fragrances for the sophisticated palette.</p>
          <div className="mt-6 flex gap-3">
            {[Instagram, Twitter, Youtube].map((Icon, index) => (
              <a key={index} href="/" aria-label="Social link" className="grid h-10 w-10 place-items-center border border-border bg-white text-primary transition hover:bg-surface-soft">
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="mb-6 text-xs font-semibold uppercase tracking-[0.16em] text-text">{group.title}</h2>
            <ul className="mt-5 space-y-3">
              {group.links.map((link) => (
                <li key={link}>
                  <Link
                    to={
                      link === "Perfumes"
                        ? "/perfumes"
                        : link === "About"
                          ? "/about"
                          : link === "Notes"
                            ? "/notes"
                            : link === "Forum"
                              ? "/forum"
                              : link === "Sign in"
                                ? "/sign-in"
                                : "/explore"
                    }
                    className="text-[13px] text-muted no-underline transition hover:text-primary"
                  >
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
