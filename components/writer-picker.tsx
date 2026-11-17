"use client";

import type { Player } from "@/lib/games";

/** Auswahl, wer in diesem Spiel mitschreibt (nur wenn mehrere Geräte mit dem Code angemeldet sind). */
export function WriterPicker({ players, value, onChange }: { players: Player[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div>
      <div className="label">Wer schreibt dieses Spiel?</div>
      <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
        Mehrere Geräte sind mit eurem Code angemeldet – nur einer ist Schreiber.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {[...players]
          .sort((a, b) => a.seat - b.seat)
          .map((p) => (
            <button key={p.id} type="button" className={`btn ${value === p.id ? "btn-primary" : "btn-ghost"} !py-2.5`} onClick={() => onChange(p.id)}>
              {p.name}
            </button>
          ))}
      </div>
    </div>
  );
}
