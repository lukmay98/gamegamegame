"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Player, Round } from "@/lib/games";

/**
 * Spielblock: Zeilen = Spieler, Spalten = Runden, letzte Spalte = Summe.
 * Ein- und ausklappbar; scrollt automatisch zur neuesten Runde.
 */
export function ScoreGrid({
  title,
  subtitle,
  players,
  rounds,
  cell,
  roundLabel,
  totals,
  totalSub,
  selectedId,
  onSelect,
  hint,
  highlightId,
}: {
  title: string;
  subtitle?: string;
  players: Player[];
  rounds: Round[];
  cell: (round: Round, player: Player) => ReactNode;
  roundLabel?: (round: Round) => ReactNode;
  totals: Record<string, number>;
  totalSub?: (player: Player) => ReactNode;
  selectedId?: string | null;
  onSelect?: (roundId: string) => void;
  hint?: string;
  /** Name rot hervorheben (Schreiber) */
  highlightId?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

  // neueste Runde sichtbar halten
  useEffect(() => {
    const el = scroller.current;
    if (el && open) el.scrollLeft = el.scrollWidth;
  }, [rounds.length, open]);

  const stickyLeft = "sticky left-0 z-10";
  const stickyRight = "sticky right-0 z-10";

  return (
    <section>
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 mb-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <h2 className="font-display font-bold text-lg">
          {title}
          {subtitle && <span className="text-sm font-normal ml-1.5" style={{ color: "var(--color-text-muted)" }}>· {subtitle}</span>}
        </h2>
        <span className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: "var(--color-ink-soft)" }}>
          {open ? "Einklappen" : "Ausklappen"}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 150ms" }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <>
          <div ref={scroller} className="card overflow-x-auto">
            <table className="text-sm tabular border-collapse min-w-full">
              <thead>
                <tr style={{ background: "var(--color-surface-soft)" }}>
                  <th className={`${stickyLeft} px-3 py-2 text-left font-semibold`} style={{ background: "var(--color-surface-soft)" }}>
                    Spieler
                  </th>
                  {rounds.map((r) => {
                    const sel = r.id === selectedId;
                    return (
                      <th
                        key={r.id}
                        className={`px-2 py-1.5 text-center font-semibold min-w-11 ${onSelect ? "cursor-pointer" : ""}`}
                        style={{ background: sel ? "var(--color-accent-soft)" : undefined }}
                        onClick={() => onSelect?.(r.id)}
                      >
                        <span className="block leading-tight">{r.round_number}</span>
                        {roundLabel && <span className="block text-[10px] font-normal leading-tight" style={{ color: "var(--color-text-muted)" }}>{roundLabel(r)}</span>}
                      </th>
                    );
                  })}
                  <th className={`${stickyRight} px-3 py-2 text-center font-bold`} style={{ background: "var(--color-surface-soft)", boxShadow: "-1px 0 0 var(--color-border)" }}>
                    Σ
                  </th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                    <td className={`${stickyLeft} px-3 py-1.5 font-semibold whitespace-nowrap max-w-28 truncate`} style={{ background: "var(--color-surface)", color: p.id === highlightId ? "var(--color-accent)" : undefined }}>
                      {p.name}
                    </td>
                    {rounds.map((r) => (
                      <td
                        key={r.id}
                        className={`px-2 py-1.5 text-center ${onSelect ? "cursor-pointer" : ""}`}
                        style={{ background: r.id === selectedId ? "var(--color-accent-soft)" : undefined }}
                        onClick={() => onSelect?.(r.id)}
                      >
                        {cell(r, p)}
                      </td>
                    ))}
                    <td className={`${stickyRight} px-3 py-1.5 text-center`} style={{ background: "var(--color-surface)", boxShadow: "-1px 0 0 var(--color-border)" }}>
                      <span className="block font-display font-extrabold text-base leading-tight" style={{ color: (totals[p.id] ?? 0) < 0 ? "var(--color-accent)" : "var(--color-ink)" }}>
                        {totals[p.id] ?? 0}
                      </span>
                      {totalSub && <span className="block text-[10px] leading-tight whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>{totalSub(p)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hint && <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>{hint}</p>}
        </>
      )}
    </section>
  );
}
