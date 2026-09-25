"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function NavBar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 border-b border-black/[0.06] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link
          href={user ? "/dashboard" : "/"}
          className="flex items-center gap-2 font-semibold tracking-tight focus-ring rounded"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-violet text-sm text-white">P</span>
          Prep Kit
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {!loading && user && (
            <>
              <Link href="/dashboard" className="rounded-lg px-2.5 py-1.5 text-ink/70 hover:bg-black/[0.04] hover:text-ink focus-ring">
                My kits
              </Link>
              <Link href="/kits/new" className="rounded-lg px-2.5 py-1.5 text-ink/70 hover:bg-black/[0.04] hover:text-ink focus-ring">
                New kit
              </Link>
              <span className="mx-1 hidden text-ink/40 sm:inline">{user.email}</span>
              <button
                className="btn-secondary btn-sm"
                onClick={async () => {
                  await logout();
                  router.push("/login");
                }}
              >
                Log out
              </button>
            </>
          )}
          {!loading && !user && (
            <>
              <Link href="/login" className="rounded-lg px-2.5 py-1.5 text-ink/70 hover:bg-black/[0.04] hover:text-ink focus-ring">
                Log in
              </Link>
              <Link href="/register" className="btn-primary-gradient btn-sm">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
