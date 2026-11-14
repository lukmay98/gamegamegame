"use client";

import type { Player } from "@/lib/games";
import { rank } from "@/lib/games/ranking";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Kompakter Gesamtstand: eine Zeile mit kleinen Plaketten (Platz · Name · Punkte),
 * bei vielen Spielern seitlich scrollbar. Am Partieende zusätzlich der Sieger.
 */
export function Leaderboard({
  players,
  totals,
  lowWins = false,
  me,
  finished,
}: {
  players: Player[];
  totals: Record<string, number>;
  lowWins?: boolean;
  me: string | null;
  finished?: boolean;
}) {
  const ranked = rank(players, totals, lowWins);
  const winners = ranked.filter((r) => r.rank === 1);
  const anyPoints = ranked.some((r) => r.total !== 0);

  return (
    <section className="mb-4">
      {finished && winners.length > 0 && (
        <div className="rounded-2xl px-4 py-3 mb-3 text-center" style={{ background: "var(--color-ink)", color: "white" }}>
          <div className="text-xs uppercase tracking-wider opacity-70">{winners.length > 1 ? "Gleichstand" : "Gewonnen"}</div>
          <div className="font-display font-extrabold text-2xl">🏆 {winners.map((w) => w.player.name).join(" & ")}</div>
        </div>
      )}
      <ol className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4" aria-label="Gesamtstand">
        {ranked.map((r) => {
          const mine = r.player.user_id != null && r.player.user_id === me;
          const leader = anyPoints && r.rank === 1;
          return (
            <li
              key={r.player.id}
              className="shrink-0 flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 text-sm border"
              style={{
                background: leader ? "var(--color-ink)" : "var(--color-surface)",
                color: leader ? "white" : "var(--color-text)",
                borderColor: leader ? "var(--color-ink)" : mine ? "var(--color-ink-soft)" : "var(--color-border)",
              }}
            >
              <span className="text-xs tabular opacity-70">{anyPoints && r.rank <= 3 ? MEDALS[r.rank - 1] : `${r.rank}.`}</span>
              <span className="font-semibold max-w-24 truncate">{r.player.name}</span>
              <span
                className="font-display font-extrabold tabular"
                style={{ color: leader ? "white" : r.total < 0 ? "var(--color-accent)" : "var(--color-ink)" }}
              >
                {r.total}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
