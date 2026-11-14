"use client";

import { useMemo, useState } from "react";
import { createRound, deleteRound, saveEntries, setGameStatus } from "@/lib/actions";
import type { FreeConfig, Game, Round } from "@/lib/games";
import { freeTotals, targetReached } from "@/lib/games/free";
import { errorText } from "@/lib/supabase";
import type { LiveSession } from "@/lib/use-live-session";
import { Leaderboard } from "./leaderboard";
import { ScoreGrid } from "./score-grid";
import { ErrorBox } from "./ui";

export function FreeBoard({
  live,
  game,
  onNewGame,
  me,
  refresh,
  viewer = false,
}: {
  viewer?: boolean;
  live: LiveSession;
  game: Game;
  onNewGame: () => void;
  me: string | null;
  refresh: () => void;
}) {
  const { session, players, rounds, entries } = live;
  const config = game.config as FreeConfig;
  const finished = game.status === "finished" || session.status === "finished";
  // Zuschauer: alles nur lesen
  const locked = finished || viewer;
  const totals = useMemo(() => freeTotals(players, rounds, entries), [players, rounds, entries]);
  const reached = targetReached(config, totals);
  // "new" = neue Runde, sonst Round-ID, null = Editor zu
  const [editing, setEditing] = useState<string | "new" | null>(rounds.length === 0 ? "new" : null);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    try {
      await setGameStatus(game.id, "finished");
      refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const editRound = editing && editing !== "new" ? rounds.find((r) => r.id === editing) ?? null : null;

  return (
    <>
      <Leaderboard players={players} totals={totals} lowWins={config.lowWins} me={me} finished={finished} />

      {config.target != null && (
        <p className="text-sm -mt-3 mb-4" style={{ color: reached ? "var(--color-accent)" : "var(--color-text-muted)" }}>
          {reached ? `🎯 Ziel von ${config.target} Punkten erreicht!` : `Ziel: ${config.target} Punkte`}
        </p>
      )}
      {error && <div className="mb-3"><ErrorBox>{error}</ErrorBox></div>}

      {!viewer && game.status === "finished" && session.status !== "finished" && (
        <div className="flex gap-2 mb-5">
          <button className="btn btn-accent flex-1 !py-3.5 text-base" onClick={onNewGame}>
            ＋ Neues Spiel
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => void setGameStatus(game.id, "active").then(refresh, (e) => setError(errorText(e)))}
          >
            Wieder öffnen
          </button>
        </div>
      )}

      {viewer && rounds.length === 0 && (
        <p className="card px-4 py-6 mb-5 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          Warten auf die erste Runde …
        </p>
      )}

      {!locked && editing && (
        <RoundForm
          key={editing}
          gameId={game.id}
          round={editRound}
          live={live}
          onDone={() => {
            setEditing(null);
            refresh();
          }}
          onCancel={rounds.length > 0 ? () => setEditing(null) : undefined}
        />
      )}

      {!locked && !editing && (
        <button className="btn btn-accent w-full !py-3.5 text-base mb-5" onClick={() => setEditing("new")}>
          ＋ Runde {rounds.length + 1} eintragen
        </button>
      )}

      {rounds.length > 0 && (
        <ScoreGrid
          title="Spielblock"
          subtitle={`${rounds.length} Runde${rounds.length === 1 ? "" : "n"}`}
          players={[...players].sort((x, y) => x.seat - y.seat)}
          rounds={rounds}
          totals={totals}
          selectedId={editing && editing !== "new" ? editing : null}
          onSelect={locked ? undefined : (id) => setEditing(id)}
          hint={locked ? undefined : "Runde antippen zum Bearbeiten."}
          cell={(r, p) => {
            const v = entries.find((e) => e.round_id === r.id && e.player_id === p.id)?.points;
            return v != null ? (
              <span style={{ color: v < 0 ? "var(--color-accent)" : undefined }}>{v}</span>
            ) : (
              <span style={{ color: "var(--color-text-muted)" }}>·</span>
            );
          }}
        />
      )}

      {!locked && rounds.length > 0 && (
        <button className="btn btn-ghost w-full mt-4" onClick={() => confirm("Spiel beenden?") && void finish()}>
          🏁 Spiel beenden
        </button>
      )}
    </>
  );
}

function RoundForm({
  gameId,
  round,
  live,
  onDone,
  onCancel,
}: {
  gameId: string;
  round: Round | null;
  live: LiveSession;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { session, players, rounds, entries } = live;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of players) {
      const v = round ? entries.find((e) => e.round_id === round.id && e.player_id === p.id)?.points : null;
      init[p.id] = v != null ? String(v) : "";
    }
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = (s: string) => {
    const n = parseInt(s.replace(/[^0-9-]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  };

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      let roundId = round?.id ?? null;
      if (!roundId) {
        const n = (rounds.at(-1)?.round_number ?? 0) + 1;
        roundId = await createRound(session.id, gameId, n, null, null);
        if (!roundId) throw new Error("Jemand anderes hat gerade eine Runde angelegt. Bitte nochmal speichern.");
      }
      await saveEntries(
        players.map((p) => ({ round_id: roundId!, player_id: p.id, session_id: session.id, points: parse(values[p.id] ?? "") })),
      );
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function remove() {
    if (!round || !confirm(`Runde ${round.round_number} löschen?`)) return;
    try {
      await deleteRound(round.id);
      onDone();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <section className="card p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-lg">
          Runde {round?.round_number ?? (rounds.at(-1)?.round_number ?? 0) + 1}
        </h2>
        {round && (
          <button className="text-xs underline" style={{ color: "var(--color-text-muted)" }} onClick={remove}>Runde löschen</button>
        )}
      </div>
      {error && <div className="mb-3"><ErrorBox>{error}</ErrorBox></div>}
      <ul className="flex flex-col gap-2">
        {players.map((p) => {
          const v = values[p.id] ?? "";
          const neg = v.startsWith("-");
          return (
            <li key={p.id} className="flex items-center gap-2">
              <span className="flex-1 font-semibold truncate">{p.name}</span>
              <button
                type="button"
                className="btn btn-soft !p-0 w-10 h-11 font-bold"
                aria-label="Vorzeichen wechseln"
                onClick={() => setValues((all) => ({ ...all, [p.id]: neg ? v.slice(1) : `-${v}` }))}
                style={{ color: neg ? "var(--color-accent)" : undefined }}
              >
                ±
              </button>
              <input
                className="input !w-28 text-right font-display font-bold text-lg tabular"
                inputMode="numeric"
                placeholder="0"
                value={v}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9-]/g, "");
                  const clean = (raw.startsWith("-") ? "-" : "") + raw.replace(/-/g, "");
                  setValues((all) => ({ ...all, [p.id]: clean }));
                }}
              />
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 mt-4">
        {onCancel && <button className="btn btn-ghost flex-1" onClick={onCancel}>Abbrechen</button>}
        <button className="btn btn-primary flex-1" disabled={busy} onClick={submit}>{busy ? "Speichert …" : "Speichern"}</button>
      </div>
    </section>
  );
}
