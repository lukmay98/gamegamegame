import type { Entry, FtnConfig, FtnScoring, Player, Round } from "./types";

// "Fuck the Neighbour" in der Stiche-ansagen-Variante:
// Jede Runde bekommt jeder Spieler N Karten, sagt an, wie viele Stiche er
// macht, und wird danach je nach Treffer/Abweichung gewertet.

export const FTN_PRESETS: Record<string, { label: string; hint: string; scoring: FtnScoring }> = {
  classic: {
    label: "Klassisch",
    hint: "Treffer: 10 + Stiche · daneben: 0",
    scoring: { hitBase: 10, hitPerTrick: 1, missPerOff: 0, missPerTrick: 0 },
  },
  everyTrick: {
    label: "Jeder Stich zählt",
    hint: "1 Punkt pro Stich · +10 bei Treffer",
    scoring: { hitBase: 10, hitPerTrick: 1, missPerOff: 0, missPerTrick: 1 },
  },
  wizard: {
    label: "Wizard-Stil",
    hint: "Treffer: 20 + 10/Stich · daneben: −10 pro Stich Abweichung",
    scoring: { hitBase: 20, hitPerTrick: 10, missPerOff: 10, missPerTrick: 0 },
  },
};

export function defaultFtnConfig(playerCount: number): FtnConfig {
  return {
    maxCards: maxCardsFor(playerCount),
    sequence: "up-down",
    scoring: FTN_PRESETS.classic.scoring,
    scoringPreset: "classic",
    dealerRule: true,
  };
}

/** Größte sinnvolle Kartenzahl bei einem 52er-Blatt (max. 10 als Standard). */
export function maxCardsFor(playerCount: number, deckSize = 52): number {
  if (playerCount < 1) return 10;
  return Math.max(1, Math.min(10, Math.floor(deckSize / playerCount)));
}

/** Kartenplan für die ganze Partie, z. B. 1,2,3,…,max,…,2,1 */
export function cardPlan(config: Pick<FtnConfig, "maxCards" | "sequence">): number[] {
  const max = Math.max(1, Math.floor(config.maxCards));
  const up = Array.from({ length: max }, (_, i) => i + 1);
  switch (config.sequence) {
    case "up":
      return up;
    case "down":
      return [...up].reverse();
    case "constant":
      return Array.from({ length: max }, () => max);
    case "up-down":
    default:
      return [...up, ...up.slice(0, -1).reverse()];
  }
}

/** Karten für Runde n (1-basiert); nach Planende wird die letzte Zahl wiederholt. */
export function cardsForRound(config: FtnConfig, roundNumber: number): number {
  const plan = cardPlan(config);
  return plan[Math.min(roundNumber, plan.length) - 1];
}

export function scoreFtn(bid: number, tricks: number, s: FtnScoring): number {
  if (bid === tricks) return s.hitBase + s.hitPerTrick * tricks;
  return -s.missPerOff * Math.abs(bid - tricks) + s.missPerTrick * tricks;
}

/**
 * Für den Geber (sagt zuletzt an): welche Ansage ist verboten, damit die
 * Summe aller Ansagen nicht genau der Kartenzahl entspricht? null = keine.
 */
export function forbiddenDealerBid(cards: number, otherBids: number[]): number | null {
  const forbidden = cards - otherBids.reduce((a, b) => a + b, 0);
  return forbidden >= 0 && forbidden <= cards ? forbidden : null;
}

/** Spieler in Ansage-Reihenfolge: links vom Geber beginnend, Geber zuletzt. */
export function biddingOrder(players: Player[], dealerId: string | null): Player[] {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const idx = sorted.findIndex((p) => p.id === dealerId);
  if (idx < 0) return sorted;
  return [...sorted.slice(idx + 1), ...sorted.slice(0, idx + 1)];
}

/** Geber rotiert jede Runde einen Platz weiter. */
export function dealerForRound(players: Player[], roundNumber: number): Player | null {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  if (sorted.length === 0) return null;
  return sorted[(roundNumber - 1) % sorted.length];
}

export type RoundState = "bidding" | "playing" | "done";

export function roundState(round: Round, players: Player[], entries: Entry[]): RoundState {
  const mine = entries.filter((e) => e.round_id === round.id);
  const allBids = players.every((p) => mine.some((e) => e.player_id === p.id && e.bid != null));
  if (!allBids) return "bidding";
  const allTricks = players.every((p) => mine.some((e) => e.player_id === p.id && e.tricks != null));
  return allTricks ? "done" : "playing";
}

export interface FtnTotals {
  /** Punkte pro Spieler und Runde (null, wenn Runde noch offen) */
  perRound: Record<string, Record<string, number | null>>;
  totals: Record<string, number>;
  hits: Record<string, number>;
}

export function ftnTotals(
  config: FtnConfig,
  players: Player[],
  rounds: Round[],
  entries: Entry[],
): FtnTotals {
  const perRound: FtnTotals["perRound"] = {};
  const totals: Record<string, number> = {};
  const hits: Record<string, number> = {};
  for (const p of players) {
    totals[p.id] = 0;
    hits[p.id] = 0;
  }
  for (const r of rounds) {
    perRound[r.id] = {};
    for (const p of players) {
      const e = entries.find((x) => x.round_id === r.id && x.player_id === p.id);
      if (e && e.bid != null && e.tricks != null) {
        const pts = scoreFtn(e.bid, e.tricks, config.scoring);
        perRound[r.id][p.id] = pts;
        totals[p.id] += pts;
        if (e.bid === e.tricks) hits[p.id] += 1;
      } else {
        perRound[r.id][p.id] = null;
      }
    }
  }
  return { perRound, totals, hits };
}
