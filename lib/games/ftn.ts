import type { Entry, FtnConfig, FtnScoring, Player, Round } from "./types";

// "Fuck the Neighbour" in der Stiche-ansagen-Variante:
// Jede Runde bekommt jeder Spieler N Karten, sagt an, wie viele Stiche er
// macht. Nach der Runde wird nur markiert, wer daneben lag.

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

export const DECK_SIZE = 52;

/** Fehlende Felder älterer Configs mit Standardwerten auffüllen. */
export function normalizeFtnConfig(c: Partial<FtnConfig>): FtnConfig {
  return {
    maxCards: c.maxCards ?? 10,
    sequence: c.sequence ?? "up-down",
    scoring: c.scoring ?? FTN_PRESETS.classic.scoring,
    scoringPreset: c.scoringPreset ?? "classic",
    dealerRule: c.dealerRule ?? true,
    decks: c.decks ?? 1,
    peakTwice: c.peakTwice ?? false,
    zeroHit: c.zeroHit ?? null,
  };
}

export function defaultFtnConfig(playerCount: number): FtnConfig {
  return normalizeFtnConfig({ maxCards: maxCardsFor(playerCount, 1) });
}

/** Größtmögliche Kartenzahl pro Spieler bei `decks` × 52 Karten. */
export function maxCardsFor(playerCount: number, decks = 1): number {
  const total = DECK_SIZE * Math.max(1, decks);
  if (playerCount < 1) return total;
  return Math.max(1, Math.floor(total / playerCount));
}

/** Kartenplan für die ganze Partie, z. B. 1,2,…,max,(max),…,2,1 */
export function cardPlan(config: Pick<FtnConfig, "maxCards" | "sequence"> & { peakTwice?: boolean }): number[] {
  const max = Math.max(1, Math.floor(config.maxCards));
  const up = Array.from({ length: max }, (_, i) => i + 1);
  const twice = !!config.peakTwice;
  switch (config.sequence) {
    case "up":
      return twice ? [...up, max] : up;
    case "down":
      return twice ? [max, ...up.reverse()] : up.reverse();
    case "constant":
      return Array.from({ length: max }, () => max);
    case "up-down":
    default: {
      const down = up.slice(0, -1).reverse();
      return twice ? [...up, max, ...down] : [...up, ...down];
    }
  }
}

/** Karten für Runde n (1-basiert); nach Planende wird die letzte Zahl wiederholt. */
export function cardsForRound(config: FtnConfig, roundNumber: number): number {
  const plan = cardPlan(config);
  return plan[Math.min(roundNumber, plan.length) - 1];
}

/** Braucht die Wertung bei "daneben" die tatsächliche Stichzahl? */
export function needsTricks(s: FtnScoring): boolean {
  return s.missPerOff > 0 || s.missPerTrick > 0;
}

/** Punkte für einen Eintrag; null, wenn noch nicht wertbar. */
export function entryPoints(e: Pick<Entry, "bid" | "hit" | "tricks">, config: FtnConfig): number | null {
  if (e.bid == null || e.hit == null) return null;
  const s = config.scoring;
  if (e.hit) {
    if (e.bid === 0 && config.zeroHit != null) return config.zeroHit;
    return s.hitBase + s.hitPerTrick * e.bid;
  }
  if (!needsTricks(s)) return 0;
  if (e.tricks == null) return null;
  return -s.missPerOff * Math.abs(e.bid - e.tricks) + s.missPerTrick * e.tricks;
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

/** Nächster Geber: der Platz nach dem bisherigen Geber (oder der erste Platz). */
export function nextDealer(players: Player[], previousDealerId: string | null): Player | null {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  if (sorted.length === 0) return null;
  const idx = sorted.findIndex((p) => p.id === previousDealerId);
  return idx < 0 ? sorted[0] : sorted[(idx + 1) % sorted.length];
}

export interface FtnTotals {
  /** Punkte pro Runde und Spieler (null, wenn Runde noch nicht abgeschlossen) */
  perRound: Record<string, Record<string, number | null>>;
  totals: Record<string, number>;
  hits: Record<string, number>;
  /** abgeschlossene Runden, in denen der Spieler angesagt hat */
  played: Record<string, number>;
}

export function ftnTotals(config: FtnConfig, players: Player[], rounds: Round[], entries: Entry[]): FtnTotals {
  const perRound: FtnTotals["perRound"] = {};
  const totals: Record<string, number> = {};
  const hits: Record<string, number> = {};
  const played: Record<string, number> = {};
  for (const p of players) {
    totals[p.id] = 0;
    hits[p.id] = 0;
    played[p.id] = 0;
  }
  for (const r of rounds) {
    perRound[r.id] = {};
    for (const p of players) {
      const e = entries.find((x) => x.round_id === r.id && x.player_id === p.id);
      const pts = r.phase === "done" && e ? entryPoints(e, config) : null;
      perRound[r.id][p.id] = pts;
      if (pts != null && e) {
        totals[p.id] += pts;
        played[p.id] += 1;
        if (e.hit) hits[p.id] += 1;
      }
    }
  }
  return { perRound, totals, hits, played };
}
