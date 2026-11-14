"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AccountHome } from "@/components/account-home";
import { LegalLink } from "@/components/legal-link";
import { Page, Spinner, TopBar } from "@/components/ui";
import { useAccount } from "@/lib/account";

export default function Start() {
  const router = useRouter();
  const { loading, account } = useAccount();

  // Erst ein eigenes Passwort setzen
  useEffect(() => {
    if (account?.must_change) router.replace("/konto/passwort");
  }, [account, router]);

  if (loading || account?.must_change) {
    return (
      <>
        <TopBar title="GameGameGame" />
        <Spinner />
      </>
    );
  }
  if (account) return <AccountHome account={account} />;

  return (
    <>
      <TopBar title="GameGameGame" />
      <Page>
        <section className="mb-8">
          <h1 className="font-display font-extrabold text-3xl tracking-tight leading-tight" style={{ color: "var(--color-ink)" }}>
            Der Spielblock,
            <br />
            den alle sehen.
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Punkte mitschreiben, Code teilen – alle sehen den Spielstand live.
          </p>
        </section>

        <div className="flex flex-col gap-3">
          <Link href="/login" className="card px-4 py-4 flex items-center gap-3 hover:border-[var(--color-ink)]">
            <span className="text-2xl" aria-hidden>🔑</span>
            <span className="flex-1">
              <span className="block font-semibold">Mit Spielecode anmelden</span>
              <span className="block text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Alle Spieltage gespeichert – Namen und Regeln werden übernommen.
              </span>
            </span>
            <Chevron />
          </Link>
          <Link href="/einmal" className="card px-4 py-4 flex items-center gap-3 hover:border-[var(--color-ink)]">
            <span className="text-2xl" aria-hidden>🎲</span>
            <span className="flex-1">
              <span className="block font-semibold">Einmal-Session ohne Login</span>
              <span className="block text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Schnell starten oder einer Session per Code beitreten.
              </span>
            </span>
            <Chevron />
          </Link>
        </div>

        <LegalLink />
        <p className="mt-3 text-center text-[11px]">
          <Link href="/admin" style={{ color: "var(--color-text-muted)", opacity: 0.6 }}>
            Admin
          </Link>
        </p>
      </Page>
    </>
  );
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: "var(--color-text-muted)" }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
