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
      <div className="card px-4 py-4 text-center">
        <div className="text-[13px] uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>{winners.length > 1 ? "Gleichstand" : "Gewonnen"}</div>
        <div className="font-display font-bold text-2xl mt-0.5">🏆 {winners.map((w) => w.player.name).join(" & ")}</div>
      </div>
    </section>
  );
}
