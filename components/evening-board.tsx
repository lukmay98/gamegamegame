"use client";

import { useMemo } from "react";
import type { FreeConfig, FtnConfig, Game, Player, Round } from "@/lib/games";
import { freeTotals } from "@/lib/games/free";
import { ftnTotals, normalizeFtnConfig } from "@/lib/games/ftn";
import { rank } from "@/lib/games/ranking";
import type { LiveSession } from "@/lib/use-live-session";
import { Leaderboard } from "./leaderboard";
import { ScoreGrid } from "./score-grid";

export interface GameResult {
  game: Game;
  /** Punkte je Spieler; fehlt ein Spieler, hat er in dieser Partie nicht mitgespielt */
  points: Record<string, number>;
  winners: Set<string>;
  lowWins: boolean;
}

/** Ergebnisse je Partie. Jede Partie wird mit ihren eigenen Regeln gewertet. */
export function gameResults(live: LiveSession): GameResult[] {
  const { session, games, players, rounds, entries } = live;
  return games.map((game) => {
    const gRounds = rounds.filter((r) => r.game_id === game.id);
    const ids = new Set(gRounds.map((r) => r.id));
    const gEntries = entries.filter((e) => ids.has(e.round_id));
    const participants = players.filter((p) => gEntries.some((e) => e.player_id === p.id && (e.bid != null || e.points != null)));
    let all: Record<string, number>;
    let lowWins = false;
    if (session.game === "ftn") {
      all = ftnTotals(normalizeFtnConfig(game.config as Partial<FtnConfig>), players, gRounds, gEntries).totals;
    } else {
      lowWins = !!(game.config as FreeConfig).lowWins;
      all = freeTotals(players, gRounds, gEntries);
    }
    const points: Record<string, number> = {};
    for (const p of participants) points[p.id] = all[p.id] ?? 0;
    const winners = new Set<string>();
    if (game.status === "finished" && participants.length > 0) {
      for (const r of rank(participants, points, lowWins)) if (r.rank === 1) winners.add(r.player.id);
    }
    return { game, points, winners, lowWins };
  });
}

export function EveningBoard({ live, me, onSelectGame }: { live: LiveSession; me: string | null; onSelectGame: (id: string) => void }) {
  const results = useMemo(() => gameResults(live), [live]);
  const lowWins = results.at(-1)?.lowWins ?? false;

  const totals: Record<string, number> = {};
  const wins: Record<string, number> = {};
  for (const p of live.players) {
    totals[p.id] = 0;
    wins[p.id] = 0;
  }
  for (const r of results) {
    for (const [id, pts] of Object.entries(r.points)) totals[id] = (totals[id] ?? 0) + pts;
    for (const id of r.winners) wins[id] = (wins[id] ?? 0) + 1;
  }

  // Partien als Spalten der Tabelle
  const columns = results.map(
    (r) => ({ id: r.game.id, session_id: r.game.session_id, game_id: r.game.id, round_number: r.game.number }) as Round,
  );
  const byId = new Map(results.map((r) => [r.game.id, r]));
  const finished = live.session.status === "finished";

  return (
    <>
      <Leaderboard players={live.players} totals={totals} lowWins={lowWins} me={me} finished={finished} />
      <ScoreGrid
        title="Abend"
        subtitle={`${results.length} ${results.length === 1 ? "Partie" : "Partien"}`}
        players={live.players}
        rounds={columns}
        roundLabel={(c) => (byId.get(c.id)?.game.status === "finished" ? "fertig" : "läuft")}
        cell={(c: Round, p: Player) => {
          const r = byId.get(c.id);
          if (!r || !(p.id in r.points)) return <span style={{ color: "var(--color-text-muted)" }}>–</span>;
          return (
            <span className="font-semibold whitespace-nowrap">
              {r.points[p.id]}
              {r.winners.has(p.id) && <span aria-label="Partie gewonnen"> 🏆</span>}
            </span>
          );
        }}
        totals={totals}
        totalSub={(p) => `${wins[p.id] ?? 0} 🏆`}
        onSelect={onSelectGame}
        hint="Tippe auf eine Partie, um sie zu öffnen. Jede Partie wird mit ihren eigenen Regeln gewertet."
      />
    </>
  );
}
