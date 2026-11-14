"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteSession } from "@/lib/actions";
import { logoutAccount, type Account } from "@/lib/account";
import type { Session } from "@/lib/games";
import { errorText, supabase } from "@/lib/supabase";
import { LegalLink } from "./legal-link";
import { SessionList } from "./session-list";
import { ErrorBox, Page, TopBar } from "./ui";

/** Startseite für Geräte, die mit einem Spielecode angemeldet sind. */
export function AccountHome({ account }: { account: Account }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase()
      .from("sessions")
      .select("*")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(errorText(error));
        setSessions((data ?? []) as Session[]);
      });
  }, [account.id]);

  async function remove(s: Session) {
    if (!confirm(`„${s.name}“ endgültig löschen? Der Spieltag verschwindet für alle und kann nicht wiederhergestellt werden.`)) return;
    try {
      await deleteSession(s.id);
      setSessions((all) => (all ?? []).filter((x) => x.id !== s.id));
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function logout() {
    if (!confirm("Auf diesem Gerät abmelden? Deine Spieltage bleiben gespeichert.")) return;
    try {
      await logoutAccount();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const last = sessions?.[0];

  return (
    <>
      <TopBar
        title="GameGameGame"
        right={
          <span className="chip font-display tracking-wider !text-[12px] !py-1" style={{ background: "rgb(255 255 255 / .14)", color: "white" }}>
            🔑 {account.code}
          </span>
        }
      />
      <Page>
        <section className="mb-6">
          <h1 className="font-display font-extrabold text-3xl tracking-tight leading-tight" style={{ color: "var(--color-ink)" }}>
            Deine Spieltage
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {sessions == null
              ? "\u00a0"
              : last
                ? "Ein neuer Spieltag übernimmt Namen, Reihenfolge und Regeln vom letzten."
                : "Starte deinen ersten Spieltag. Mitspieler sehen per QR-Code live zu."}
          </p>
        </section>

        {error && <div className="mb-4"><ErrorBox>{error}</ErrorBox></div>}

        <Link href="/new" className="btn btn-accent w-full !py-3.5 text-base mb-6">
          <span className="text-lg leading-none">＋</span> Neuer Spieltag
        </Link>

        <SessionList
          sessions={sessions}
          empty="Noch keine Spieltage."
          deleteLabel={() => "Spieltag löschen"}
          onRemove={(s) => void remove(s)}
        />

        <div className="flex gap-2 mt-8">
          <Link href="/konto/passwort" className="btn btn-ghost flex-1">Passwort ändern</Link>
          <button className="btn btn-ghost flex-1" onClick={() => void logout()}>Abmelden</button>
        </div>
        <LegalLink />
      </Page>
    </>
  );
}
