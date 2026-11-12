import type { GameId } from "./types";

export const GAMES: Record<GameId, { label: string; short: string; description: string; emoji: string }> = {
  ftn: {
    label: "Fuck the Neighbour",
    short: "FTN",
    description: "Stiche ansagen: Karten pro Runde steigen und fallen, wer genau trifft, punktet.",
    emoji: "🃏",
  },
  free: {
    label: "Freie Punkteliste",
    short: "Liste",
    description: "Für jedes andere Karten- oder Würfelspiel: pro Runde Punkte je Spieler eintragen.",
    emoji: "🎲",
  },
};

export * from "./types";
