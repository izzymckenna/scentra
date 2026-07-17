import { useMemo, useState } from "react";
import { ArrowRight, MessageSquarePlus, Search, ThumbsUp, User } from "lucide-react";

type ThreadCategory = "Advice" | "Recommendation" | "Layering" | "Dupes" | "Rotating";

type Thread = {
  id: string;
  title: string;
  body: string;
  author: string;
  category: ThreadCategory;
  tags: string[];
  likes: number;
  replies: number;
  lastActivity: string;
};

const initialThreads: Thread[] = [
  {
    id: "thread-1",
    title: "Need a warm, elegant fragrance for winter dinners",
    body: "Looking for something refined, not overly sweet. Open to niche or designer. I like amber, iris, and soft woods.",
    author: "Mila",
    category: "Advice",
    tags: ["amber", "winter", "elegant"],
    likes: 18,
    replies: 7,
    lastActivity: "12m ago",
  },
  {
    id: "thread-2",
    title: "Best floral fragrances that still feel modern?",
    body: "Most florals I try feel too powdery. I want something polished, bright, and easy to wear every day.",
    author: "Aroha",
    category: "Recommendation",
    tags: ["floral", "daytime", "everyday"],
    likes: 24,
    replies: 11,
    lastActivity: "31m ago",
  },
  {
    id: "thread-3",
    title: "What should I layer with Baccarat Rouge style scents?",
    body: "I’m after cleaner or creamier layer options that make it softer without killing the projection.",
    author: "Noah",
    category: "Layering",
    tags: ["layering", "woody", "sweet"],
    likes: 14,
    replies: 9,
    lastActivity: "52m ago",
  },
  {
    id: "thread-4",
    title: "Looking for a cheaper alternative to Libre Intense",
    body: "I like the lavender + vanilla direction, but I want to know which options stay close without going full clone.",
    author: "Jess",
    category: "Dupes",
    tags: ["dupes", "vanilla", "lavender"],
    likes: 31,
    replies: 16,
    lastActivity: "1h ago",
  },
  {
    id: "thread-5",
    title: "What are your current signature scents this season?",
    body: "Not chasing trends. I want to hear what people are actually wearing repeatedly and why it works.",
    author: "Theo",
    category: "Rotating",
    tags: ["signature scent", "seasonal", "discussion"],
    likes: 27,
    replies: 20,
    lastActivity: "2h ago",
  },
];

const categories: ThreadCategory[] = ["Advice", "Recommendation", "Layering", "Dupes", "Rotating"];
const popularTags = ["amber", "floral", "layering", "winter", "vanilla", "niche", "clean", "sweet", "woody"];

export function ForumPage() {
  const [threads, setThreads] = useState(initialThreads);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ThreadCategory | "All">("All");
  const [sort, setSort] = useState<"Latest" | "Top">("Latest");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagInput, setTagInput] = useState("");

  const visibleThreads = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return [...threads]
      .filter((thread) => (category === "All" ? true : thread.category === category))
      .filter((thread) => {
        if (!normalized) return true;
        const searchable = [thread.title, thread.body, thread.author, thread.category, ...thread.tags].join(" ").toLowerCase();
        return searchable.includes(normalized);
      })
      .sort((a, b) => {
        if (sort === "Top") return b.likes + b.replies - (a.likes + a.replies);
        return b.replies - a.replies || b.likes - a.likes;
      });
  }, [category, query, sort, threads]);

  function createThread() {
    if (!title.trim() || !body.trim()) return;

    const tags = tagInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 4);

    const thread: Thread = {
      id: `thread-${Date.now()}`,
      title: title.trim(),
      body: body.trim(),
      author: "You",
      category: "Advice",
      tags: tags.length ? tags : ["recommendation"],
      likes: 0,
      replies: 0,
      lastActivity: "just now",
    };

    setThreads((current) => [thread, ...current]);
    setTitle("");
    setBody("");
    setTagInput("");
    setCategory("All");
    setSort("Latest");
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12">
      <section className="grid gap-6 border-b border-border pb-5 lg:grid-cols-[1fr_360px] lg:items-end">
        <div>
          <span className="mb-3 block text-[11px] uppercase tracking-[0.27em] text-muted">Community forum</span>
          <h1 className="font-display text-5xl font-normal leading-tight text-primary">Ask for fragrance advice</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
            A place for recommendations, layering ideas, dupes, seasonal picks, and practical fragrance opinions.
          </p>
        </div>
        <div className="border border-border bg-surface-deep p-4">
          <div className="flex items-center gap-2 text-primary">
            <MessageSquarePlus size={18} />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.27em] text-muted">Start a thread</h2>
          </div>
          <button type="button" onClick={createThread} className="mt-4 w-full bg-primary px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-white">
            Post question
          </button>
        </div>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="border border-border bg-white p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
              <label className="relative block">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search threads, tags, or scents"
                  className="h-12 w-full border border-border bg-white pl-11 pr-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
              <label className="flex items-center gap-3 text-sm font-bold text-primary">
                Category
                <select value={category} onChange={(event) => setCategory(event.target.value as ThreadCategory | "All")} className="border border-border bg-white px-4 py-3 text-sm font-bold outline-none">
                  <option value="All">All</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 text-sm font-bold text-primary">
                Sort
                <select value={sort} onChange={(event) => setSort(event.target.value as "Latest" | "Top")} className="border border-border bg-white px-4 py-3 text-sm font-bold outline-none">
                  <option value="Latest">Latest</option>
                  <option value="Top">Top</option>
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-4">
            {visibleThreads.map((thread) => (
              <article key={thread.id} className="border border-border bg-white p-5 transition hover:-translate-y-0.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.27em] text-muted">{thread.category}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{thread.lastActivity}</span>
                </div>
                <h2 className="mt-3 font-display text-2xl font-normal leading-tight text-primary">{thread.title}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{thread.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {thread.tags.map((tag) => (
                    <span key={tag} className="border border-border bg-surface-soft px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
                  <div className="flex items-center gap-4 text-sm text-muted">
                    <span className="inline-flex items-center gap-1">
                      <User size={16} />
                      {thread.author}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp size={16} />
                      {thread.likes}
                    </span>
                    <span>{thread.replies} replies</span>
                  </div>
                  <button type="button" className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-primary">
                    View thread
                    <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <section className="border border-border bg-surface-deep p-5">
            <h2 className="font-display text-2xl font-normal text-primary">Ask for help</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Tell people what you like, what you already own, and what vibe you want.</p>
            <div className="mt-4 space-y-3">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Thread title" className="h-11 w-full border border-border bg-white px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Describe the scent profile, budget, season, or brands you like..."
                rows={6}
                className="w-full border border-border bg-white px-4 py-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="Tags, comma separated"
                className="h-11 w-full border border-border bg-white px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <button type="button" onClick={createThread} className="w-full bg-primary px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-white">
                Post question
              </button>
            </div>
          </section>

          <section className="border border-border bg-white p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.27em] text-muted">Popular tags</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {popularTags.map((tag) => (
                <button key={tag} type="button" onClick={() => setQuery(tag)} className="border border-border bg-surface-soft px-3 py-2 text-[11px] font-semibold text-primary">
                  {tag}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
