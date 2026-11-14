import type { Player } from "./types";

export interface Payout {
  player: Player;
  points: number;
  /** Platz (geteilte Plätze bei Gleichstand) */
  rank: number;
  /** + bekommt, − zahlt (in Cent) */
  cents: number;
}

export interface Transfer {
  from: Player;
  to: Player;
  cents: number;
}

/**
 * Jeder rechnet mit jedem ab: pro Mitspieler die Punktedifferenz × Betrag pro Punkt.
 * Zusammengefasst: (Anzahl × eigene Punkte − Summe aller Punkte) × Betrag. Summe aller Beträge = 0.
 * Bei „wenig gewinnt“ zählen die Punkte umgekehrt.
 */
export function payouts(players: Player[], totals: Record<string, number>, centsPerPoint: number, lowWins = false): Payout[] {
  const n = players.length;
  const score = (p: Player) => (lowWins ? -1 : 1) * (totals[p.id] ?? 0);
  const sum = players.reduce((s, p) => s + score(p), 0);
  const list = players
    .map((player) => ({ player, points: totals[player.id] ?? 0, cents: (n * score(player) - sum) * centsPerPoint }))
    .sort((a, b) => b.cents - a.cents || a.player.seat - b.player.seat);
  let lastCents: number | null = null;
  let lastRank = 0;
  return list.map((x, i) => {
    const rank = x.cents === lastCents ? lastRank : i + 1;
    lastCents = x.cents;
    lastRank = rank;
    return { ...x, rank };
  });
}

/** Wer zahlt wem: größter Schuldner an größten Empfänger, bis alles ausgeglichen ist (wenige Überweisungen). */
export function transfers(list: Payout[]): Transfer[] {
  const creditors = list.filter((x) => x.cents > 0).map((x) => ({ p: x.player, left: x.cents }));
  const debtors = list.filter((x) => x.cents < 0).map((x) => ({ p: x.player, left: -x.cents }));
  const out: Transfer[] = [];
  creditors.sort((a, b) => b.left - a.left);
  debtors.sort((a, b) => b.left - a.left);
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    if (amount > 0) out.push({ from: debtors[i].p, to: creditors[j].p, cents: amount });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left === 0) i++;
    if (creditors[j].left === 0) j++;
  }
  return out;
}

export function euro(cents: number, signed = false): string {
  const s = (Math.abs(cents) / 100).toLocaleString("de-AT", { style: "currency", currency: "EUR" });
  if (!signed || cents === 0) return cents < 0 ? `−${s}` : s;
  return cents > 0 ? `+${s}` : `−${s}`;
}
