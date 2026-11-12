import type { Entry, FreeConfig, Player, Round } from "./types";

export function defaultFreeConfig(): FreeConfig {
  return { lowWins: false, target: null };
}

export function freeTotals(players: Player[], rounds: Round[], entries: Entry[]) {
  const totals: Record<string, number> = {};
  for (const p of players) totals[p.id] = 0;
  const roundIds = new Set(rounds.map((r) => r.id));
  for (const e of entries) {
    if (roundIds.has(e.round_id) && e.points != null && e.player_id in totals) {
      totals[e.player_id] += e.points;
    }
  }
  return totals;
}

/** Hat jemand das Ziel erreicht? */
export function targetReached(config: FreeConfig, totals: Record<string, number>): boolean {
  if (config.target == null) return false;
  const values = Object.values(totals);
  return values.some((v) => v >= (config.target as number));
}
