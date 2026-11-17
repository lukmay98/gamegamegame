"use client";

import type { Player } from "@/lib/games";
import { rank } from "@/lib/games/ranking";

/**
 * Sieger-Banner am Ende eines Spiels bzw. Spieltags (die Rangliste-Plaketten wurden entfernt).
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
  void me;

  if (!finished || winners.length === 0) return null;
  return (
    <section className="mb-4">
      <div className="rounded-2xl px-4 py-3 text-center" style={{ background: "var(--color-ink)", color: "white" }}>
        <div className="text-xs uppercase tracking-wider opacity-70">{winners.length > 1 ? "Gleichstand" : "Gewonnen"}</div>
        <div className="font-display font-extrabold text-2xl">🏆 {winners.map((w) => w.player.name).join(" & ")}</div>
      </div>
    </section>
  );
}
