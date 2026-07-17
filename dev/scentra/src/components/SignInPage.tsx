import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function SignInPage() {
  const { user, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      setError("Enter an email and password.");
      return;
    }
    signIn(trimmedEmail, password);
    navigate("/explore");
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-5xl items-center px-6 py-12 md:px-12">
      <section className="grid w-full gap-8 border border-border bg-white p-6 md:grid-cols-[1.1fr_0.9fr] md:p-8">
        <div className="space-y-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Account</p>
          <h1 className="font-display text-5xl font-normal leading-tight text-primary">
            {user ? `Signed in as ${user.name}` : "Sign in"}
          </h1>
          <p className="max-w-xl text-sm leading-6 text-muted">
            Use your account to keep your wishlist and forum identity in one place.
          </p>
          {user ? (
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/explore" className="inline-flex items-center border border-border bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white no-underline">
                Go to explore
              </Link>
              <button
                type="button"
                onClick={() => {
                  signOut();
                  setPassword("");
                }}
                className="border border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary hover:bg-surface-soft"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>

        {!user ? (
          <form onSubmit={handleSubmit} className="space-y-4 border border-border bg-surface-soft p-5">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border border-border bg-white px-4 py-3 text-sm text-primary outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border border-border bg-white px-4 py-3 text-sm text-primary outline-none"
              />
            </div>
            {error ? <p className="text-sm text-sale">{error}</p> : null}
            <button type="submit" className="inline-flex w-full items-center justify-center border border-border bg-primary px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
              Sign in
            </button>
          </form>
        ) : (
          <div className="border border-border bg-surface-soft p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Session active</p>
            <p className="mt-2 text-sm text-primary">{user.email}</p>
          </div>
        )}
      </section>
    </main>
  );
}
