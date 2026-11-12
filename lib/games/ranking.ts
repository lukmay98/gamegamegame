import type { Player } from "./types";

export interface Ranked {
  player: Player;
  total: number;
  rank: number;
}

/** Rangliste mit geteilten Plätzen bei Gleichstand (1, 1, 3 …). */
export function rank(players: Player[], totals: Record<string, number>, lowWins = false): Ranked[] {
  const list = players
    .map((player) => ({ player, total: totals[player.id] ?? 0 }))
    .sort((a, b) => (lowWins ? a.total - b.total : b.total - a.total) || a.player.seat - b.player.seat);
  let lastTotal: number | null = null;
  let lastRank = 0;
  return list.map((item, i) => {
    const r = item.total === lastTotal ? lastRank : i + 1;
    lastTotal = item.total;
    lastRank = r;
    return { ...item, rank: r };
  });
}
