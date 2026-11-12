"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LegalLink } from "@/components/legal-link";
import { ErrorBox, Page, TopBar } from "@/components/ui";
import { GAMES, type Session } from "@/lib/games";
import { deleteSession, leaveSession } from "@/lib/actions";
import { ensureSignedIn, errorText, supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);

  async function remove(s: Session) {
    if (!me) return;
    const host = s.created_by === me;
    const ok = confirm(
      host
        ? `„${s.name}“ endgültig löschen? Die Session verschwindet für alle Mitspieler und kann nicht wiederhergestellt werden.`
        : `„${s.name}“ aus deiner Liste entfernen? Mit dem Code ${s.code} kannst du jederzeit wieder beitreten.`,
    );
    if (!ok) return;
    try {
      if (host) await deleteSession(s.id);
      else await leaveSession(s.id, me);
      setSessions((all) => (all ?? []).filter((x) => x.id !== s.id));
    } catch (e) {
      setError(errorText(e));
    }
  }

  useEffect(() => {
    (async () => {
      setMe(await ensureSignedIn());
      const { data, error } = await supabase()
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      setSessions((data ?? []) as Session[]);
    })().catch((e) => {
      setError(errorText(e));
      setSessions([]);
    });
  }, []);

  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

  return (
    <>
      <TopBar title="GameGameGame" />
      <Page>
        <section className="mb-6">
          <h1 className="font-display font-extrabold text-3xl tracking-tight leading-tight" style={{ color: "var(--color-ink)" }}>
            Der Spielblock,
            <br />
            den alle sehen.
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Session starten, Code teilen, gemeinsam mitschreiben. Ganz ohne Konto.
          </p>
        </section>

        {error && <div className="mb-4"><ErrorBox>{error}</ErrorBox></div>}

        <Link href="/new" className="btn btn-accent w-full !py-3.5 text-base mb-3">
          <span className="text-lg leading-none">＋</span> Neue Session starten
        </Link>

        <form
          className="card p-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (cleanCode.length === 6) router.push(`/s/${cleanCode}`);
          }}
        >
          <input
            className="input font-display font-bold tracking-[0.3em] uppercase text-center"
            placeholder="CODE"
            value={cleanCode}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            aria-label="Session-Code"
          />
          <button className="btn btn-primary shrink-0" disabled={cleanCode.length !== 6}>
            Beitreten
          </button>
        </form>

        <h2 className="mt-8 mb-3 font-display font-bold text-lg">Meine Sessions</h2>
        {sessions == null ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Lädt …</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Noch keine. Sessions, die du startest oder denen du beitrittst, erscheinen hier.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-stretch gap-2">
                <Link href={`/s/${s.code}`} className="card flex-1 min-w-0 px-4 py-3 flex items-center gap-3 hover:border-[var(--color-ink)]">
                  <span className="text-2xl" aria-hidden>{GAMES[s.game]?.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">{s.name}</span>
                    <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {GAMES[s.game]?.label} · {new Date(s.created_at).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </span>
                  </span>
                  {s.status === "active" ? (
                    <span className="chip" style={{ background: "var(--color-good-soft)", color: "var(--color-good)" }}>● live</span>
                  ) : (
                    <span className="chip" style={{ background: "var(--color-surface-soft)", color: "var(--color-text-muted)" }}>beendet</span>
                  )}
                </Link>
                <button
                  className="card shrink-0 w-12 flex items-center justify-center hover:border-[var(--color-accent)]"
                  style={{ color: "var(--color-text-muted)" }}
                  aria-label={s.created_by === me ? `${s.name} löschen` : `${s.name} aus Liste entfernen`}
                  title={s.created_by === me ? "Für alle löschen" : "Aus meiner Liste entfernen"}
                  onClick={() => void remove(s)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        <LegalLink />
      </Page>
    </>
  );
}
