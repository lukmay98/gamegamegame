"use client";

import type { Player } from "@/lib/games";
import { rank } from "@/lib/games/ranking";

const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({
  players,
  totals,
  lowWins = false,
  me,
  extra,
  finished,
}: {
  players: Player[];
  totals: Record<string, number>;
  lowWins?: boolean;
  me: string | null;
  extra?: (p: Player) => string | null;
  finished?: boolean;
}) {
  const ranked = rank(players, totals, lowWins);
  const winners = ranked.filter((r) => r.rank === 1);

  return (
    <section className="mb-5">
      {finished && winners.length > 0 && (
        <div className="rounded-2xl px-4 py-3 mb-3 text-center" style={{ background: "var(--color-ink)", color: "white" }}>
          <div className="text-xs uppercase tracking-wider opacity-70">{winners.length > 1 ? "Gleichstand" : "Gewonnen"}</div>
          <div className="font-display font-extrabold text-2xl">🏆 {winners.map((w) => w.player.name).join(" & ")}</div>
        </div>
      )}
      <ol className="card divide-y" style={{ borderColor: "var(--color-border)" }}>
        {ranked.map((r) => {
          const mine = r.player.user_id != null && r.player.user_id === me;
          const sub = extra?.(r.player);
          return (
            <li key={r.player.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderColor: "var(--color-border)" }}>
              <span className="w-7 text-center font-display font-bold tabular" style={{ color: "var(--color-text-muted)" }}>
                {r.rank <= 3 && r.total !== 0 ? MEDALS[r.rank - 1] : `${r.rank}.`}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate">
                  {r.player.name}
                  {mine && <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>(du)</span>}
                </span>
                {sub && <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>{sub}</span>}
              </span>
              <span className="font-display font-extrabold text-xl tabular" style={{ color: r.total < 0 ? "var(--color-accent)" : "var(--color-ink)" }}>
                {r.total}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
