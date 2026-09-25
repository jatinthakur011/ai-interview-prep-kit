import Link from "next/link";

const FEATURES = [
  {
    title: "Company brief",
    desc: "A concise, sourced summary of who they are and what they do.",
    bg: "bg-accent",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 21V7a2 2 0 0 1 2-2h6l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
        <path d="M12 5v6h6" />
        <path d="M8 13h8M8 17h5" />
      </svg>
    ),
  },
  {
    title: "Question bank",
    desc: "Technical, behavioural, system-design and company-fit questions.",
    bg: "bg-violet",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 2-3 4" />
        <path d="M12 17h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    title: "Flashcards",
    desc: "Spaced-repetition practice mode that focuses on your weak spots.",
    bg: "bg-info",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="14" height="10" rx="2" />
        <path d="M7 19h14V9" />
      </svg>
    ),
  },
  {
    title: "Study schedule",
    desc: "A day-by-day plan that fits the time you have left.",
    bg: "bg-success",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18M8 2v4M16 2v4" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="relative">
      {/* Decorative background blobs, contained to the hero so they don't bleed into content below */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -right-16 top-10 h-64 w-64 rounded-full bg-violet/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-2xl py-14 text-center sm:py-24">
        <span className="badge border border-accent/20 bg-accent-soft text-accent">Built from real research</span>
        <h1 className="mt-5 text-5xl font-bold tracking-tight text-ink sm:text-6xl">
          Ace your next
          <br />
          <span className="gradient-text">technical interview</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-ink/60 sm:text-lg">
          Paste a job description and a company website. Get a company brief, a categorised question
          bank, flashcards and a day-by-day study schedule — not a single generic prompt.
        </p>
        <div className="mt-9 flex justify-center gap-3">
          <Link href="/register" className="btn-primary-gradient btn-lg">
            Get started — it&apos;s free
          </Link>
          <Link href="/login" className="btn-secondary btn-lg">
            Log in
          </Link>
        </div>

        <div className="mt-20 grid gap-4 text-left sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="card card-pad card-hover flex items-start gap-4 sm:p-5">
              <div className={`icon-badge ${f.bg}`}>{f.icon}</div>
              <div>
                <p className="font-semibold text-ink">{f.title}</p>
                <p className="mt-1 text-sm text-ink/60">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}