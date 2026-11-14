"use client";

import Link from "next/link";
import { GAMES, type Session } from "@/lib/games";

/** Liste von Sessions/Spieltagen mit Löschen-Knopf. */
export function SessionList({
  sessions,
  empty,
  deleteLabel,
  onRemove,
}: {
  sessions: Session[] | null;
  empty: string;
  deleteLabel: (s: Session) => string;
  onRemove: (s: Session) => void;
}) {
  if (sessions == null) return <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Lädt …</p>;
  if (sessions.length === 0) return <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{empty}</p>;
  return (
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
            aria-label={deleteLabel(s)}
            title={deleteLabel(s)}
            onClick={() => onRemove(s)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}
