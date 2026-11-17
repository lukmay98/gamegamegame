import type { DealerMode, Entry, FtnConfig, FtnScoring, Player, Round } from "./types";

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

export const DEFAULT_DECK_SIZE = 36;

export const DEALER_MODES: { id: DealerMode; label: string; hint: string }[] = [
  { id: "dayLeader", label: "Führender des Spieltags", hint: "Wer am Spieltag insgesamt die meisten Punkte hat" },
  { id: "lastGameWinner", label: "Gewinner des letzten Spiels", hint: "Wer das vorherige Spiel gewonnen hat" },
];

/** Fehlende Felder älterer Configs mit Standardwerten auffüllen. */
export function normalizeFtnConfig(c: Partial<FtnConfig> & { decks?: number }): FtnConfig {
  return {
    maxCards: c.maxCards ?? 10,
    sequence: c.sequence ?? "up-down",
    scoring: c.scoring ?? FTN_PRESETS.classic.scoring,
    scoringPreset: c.scoringPreset ?? "classic",
    dealerRule: c.dealerRule ?? true,
    deckSize: c.deckSize ?? (c.decks ? c.decks * 52 : DEFAULT_DECK_SIZE),
    // ältere Werte (order/leader/lastRoundWinner) auf die neuen Varianten abbilden
    dealerMode: (c.dealerMode as string) === "lastGameWinner" || (c.dealerMode as string) === "lastRoundWinner" ? "lastGameWinner" : "dayLeader",
    peakTwice: c.peakTwice ?? false,
    zeroHit: c.zeroHit ?? null,
  };
}

export function defaultFtnConfig(playerCount: number): FtnConfig {
  return normalizeFtnConfig({ maxCards: maxCardsFor(playerCount, DEFAULT_DECK_SIZE), peakTwice: true });
}

/** Größtmögliche Kartenzahl pro Spieler bei `deckSize` Karten insgesamt. */
export function maxCardsFor(playerCount: number, deckSize = DEFAULT_DECK_SIZE): number {
  const total = Math.max(1, Math.floor(deckSize));
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

/**
 * Erster Geber eines Spiels. `previous` = Punkte je Spieler der bisherigen Spiele des Spieltags.
 * - dayLeader: meiste Punkte über alle bisherigen Spiele
 * - lastGameWinner: meiste Punkte im letzten Spiel
 * Im ersten Spiel (oder ohne Punkte) beginnt der erste Platz; bei Gleichstand der Erste in Sitzreihenfolge.
 * Danach geht es innerhalb des Spiels reihum (nextDealer).
 */
export function firstDealer(mode: DealerMode, players: Player[], previous: Record<string, number>[]): Player | null {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  if (sorted.length === 0) return null;
  const relevant = mode === "lastGameWinner" ? previous.slice(-1) : previous;
  const sums: Record<string, number> = {};
  for (const g of relevant) for (const [id, pts] of Object.entries(g)) sums[id] = (sums[id] ?? 0) + pts;
  const scored = sorted.filter((p) => p.id in sums);
  if (scored.length === 0) return sorted[0];
  const best = Math.max(...scored.map((p) => sums[p.id]));
  return scored.find((p) => sums[p.id] === best) ?? sorted[0];
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

/**
 * Können sich `rest` Stiche so auf die Falsch-Liegenden verteilen, dass jeder
 * zwischen 0 und `cards` Stiche hat, aber nie genau seine Ansage?
 */
export function canSplitAmongMisses(rest: number, missBids: number[], cards: number): boolean {
  if (rest < 0) return false;
  let reach = new Set<number>([0]);
  for (const bid of missBids) {
    const next = new Set<number>();
    for (const sum of reach) {
      for (let t = 0; t <= cards && sum + t <= rest; t++) if (t !== bid) next.add(sum + t);
    }
    reach = next;
  }
  return reach.has(rest);
}

/**
 * Prüft, ob das Ergebnis einer Runde möglich ist. `hit: null` zählt als getroffen
 * (beim Abschließen werden nicht Angetippte als getroffen gewertet).
 *
 * K = Karten, R = K − Summe der Ansagen der Richtigen (= Stiche der Falschen).
 * Gültig, wenn sich R so auf die Falschen verteilen lässt, dass keiner genau seine Ansage trifft.
 * Gibt eine Fehlermeldung zurück oder null, wenn alles passt.
 */
export function roundProblem(
  cards: number,
  rows: { bid: number | null; hit: boolean | null; tricks: number | null }[],
  askTricks: boolean,
): string | null {
  const bids = rows.filter((r) => r.bid != null);
  if (bids.length === 0) return null;
  const hitters = bids.filter((r) => r.hit !== false);
  const misses = bids.filter((r) => r.hit === false);
  const sumHit = hitters.reduce((s, r) => s + (r.bid as number), 0);
  const rest = cards - sumHit;
  if (rest < 0) {
    return `Die Richtig-Liegenden haben zusammen ${sumHit} Stiche angesagt – es gibt aber nur ${cards}.`;
  }
  if (misses.length === 0) {
    return rest === 0
      ? null
      : `Es können nicht alle richtig liegen – die Ansagen ergeben ${sumHit} statt ${cards} Stiche. Mindestens einer lag daneben.`;
  }
  if (askTricks && misses.every((r) => r.tricks != null)) {
    const total = sumHit + misses.reduce((s, r) => s + (r.tricks as number), 0);
    return total === cards ? null : `Die Stiche ergeben zusammen ${total} statt ${cards}.`;
  }
  if (!canSplitAmongMisses(rest, misses.map((r) => r.bid as number), cards)) {
    return misses.length === 1
      ? `So geht die Runde nicht auf: Für den Falsch-Liegenden bleiben genau ${rest} Stich${rest === 1 ? "" : "e"} – das wäre seine Ansage. Bitte prüfen, wer daneben lag.`
      : `So geht die Runde nicht auf: Die übrigen ${rest} Stich${rest === 1 ? "" : "e"} lassen sich nicht so auf die Falsch-Liegenden verteilen, dass alle danebenliegen. Bitte prüfen, wer daneben lag.`;
  }
  return null;
}

/** Wer ist bei der Ansage dran? Links vom Geber beginnend, Geber zuletzt. null = alle haben angesagt. */
export function nextBidder(players: Player[], dealerId: string | null, bidOf: (pid: string) => number | null | undefined): Player | null {
  return biddingOrder(players, dealerId).find((p) => bidOf(p.id) == null) ?? null;
}
