import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "./user-menu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/orgs"
              className="text-base font-semibold tracking-tight"
            >
              SCALA
            </Link>
            <Link
              href="/me"
              className="text-muted-foreground hover:text-foreground"
            >
              Minha escala
            </Link>
          </nav>
          {/* Reads the session, so it streams in behind a boundary (Cache Components). */}
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
