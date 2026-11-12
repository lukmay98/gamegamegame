export type GameId = "ftn" | "free";

export type SessionStatus = "active" | "finished";

export interface Session {
  id: string;
  code: string;
  name: string;
  game: GameId;
  config: FtnConfig | FreeConfig;
  status: SessionStatus;
  created_by: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface Player {
  id: string;
  session_id: string;
  name: string;
  seat: number;
  user_id: string | null;
}

export interface Round {
  id: string;
  session_id: string;
  round_number: number;
  cards: number | null;
  dealer_player_id: string | null;
  created_at: string;
}

export interface Entry {
  round_id: string;
  player_id: string;
  session_id: string;
  bid: number | null;
  tricks: number | null;
  points: number | null;
}

// ── Fuck the Neighbour (Stiche ansagen) ──────────────────────
export type FtnSequence = "up-down" | "up" | "down" | "constant";

export interface FtnScoring {
  /** Grundpunkte bei genau getroffener Ansage */
  hitBase: number;
  /** zusätzliche Punkte pro Stich bei getroffener Ansage */
  hitPerTrick: number;
  /** Minuspunkte pro Stich Abweichung, wenn daneben */
  missPerOff: number;
  /** Punkte pro gemachtem Stich, auch wenn daneben */
  missPerTrick: number;
}

export interface FtnConfig {
  /** höchste Kartenzahl pro Spieler */
  maxCards: number;
  sequence: FtnSequence;
  scoring: FtnScoring;
  scoringPreset: string;
  /** Geber darf nicht so ansagen, dass Summe der Ansagen = Karten */
  dealerRule: boolean;
}

// ── Freie Punkteliste ────────────────────────────────────────
export interface FreeConfig {
  /** true: wer am wenigsten Punkte hat, gewinnt */
  lowWins: boolean;
  /** optionales Ziel: Spiel endet, wenn jemand es erreicht */
  target: number | null;
}
