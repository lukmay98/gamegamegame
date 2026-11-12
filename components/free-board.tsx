"use client";

import { useMemo, useState } from "react";
import { createRound, deleteRound, saveEntries, setSessionStatus } from "@/lib/actions";
import type { FreeConfig, Round } from "@/lib/games";
import { freeTotals, targetReached } from "@/lib/games/free";
import { errorText } from "@/lib/supabase";
import type { LiveSession } from "@/lib/use-live-session";
import { Leaderboard } from "./leaderboard";
import { ErrorBox } from "./ui";

export function FreeBoard({ live, me, refresh }: { live: LiveSession; me: string | null; refresh: () => void }) {
  const { session, players, rounds, entries } = live;
  const config = session.config as FreeConfig;
  const finished = session.status === "finished";
  const totals = useMemo(() => freeTotals(players, rounds, entries), [players, rounds, entries]);
  const reached = targetReached(config, totals);
  // "new" = neue Runde, sonst Round-ID, null = Editor zu
  const [editing, setEditing] = useState<string | "new" | null>(rounds.length === 0 ? "new" : null);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    try {
      await setSessionStatus(session.id, "finished");
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

      {!finished && editing && (
        <RoundForm
          key={editing}
          round={editRound}
          live={live}
          onDone={() => {
            setEditing(null);
            refresh();
          }}
          onCancel={rounds.length > 0 ? () => setEditing(null) : undefined}
        />
      )}

      {!finished && !editing && (
        <button className="btn btn-accent w-full !py-3.5 text-base mb-5" onClick={() => setEditing("new")}>
          ＋ Runde {rounds.length + 1} eintragen
        </button>
      )}

      {rounds.length > 0 && (
        <section>
          <h2 className="font-display font-bold text-lg mb-2">Spielblock</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm tabular border-collapse">
              <thead>
                <tr style={{ background: "var(--color-surface-soft)" }}>
                  <th className="sticky left-0 px-2 py-2 text-left" style={{ background: "var(--color-surface-soft)" }}>#</th>
                  {players.map((p) => (
                    <th key={p.id} className="px-2 py-2 text-center min-w-14 truncate max-w-24">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t cursor-pointer"
                    style={{ borderColor: "var(--color-border)", background: editing === r.id ? "var(--color-accent-soft)" : undefined }}
                    onClick={() => !finished && setEditing(r.id)}
                  >
                    <td className="sticky left-0 px-2 py-2 font-semibold" style={{ background: editing === r.id ? "var(--color-accent-soft)" : "var(--color-surface)" }}>{r.round_number}</td>
                    {players.map((p) => {
                      const v = entries.find((e) => e.round_id === r.id && e.player_id === p.id)?.points;
                      return (
                        <td key={p.id} className="px-2 py-2 text-center" style={{ color: v != null && v < 0 ? "var(--color-accent)" : undefined }}>
                          {v ?? <span style={{ color: "var(--color-text-muted)" }}>·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2" style={{ borderColor: "var(--color-ink)" }}>
                  <td className="sticky left-0 px-2 py-2 font-bold" style={{ background: "var(--color-surface)" }}>Σ</td>
                  {players.map((p) => (
                    <td key={p.id} className="px-2 py-2 text-center font-display font-extrabold text-base">{totals[p.id]}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          {!finished && <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>Runde antippen zum Bearbeiten.</p>}
        </section>
      )}

      {!finished && rounds.length > 0 && (
        <button className="btn btn-ghost w-full mt-4" onClick={() => confirm("Partie beenden?") && void finish()}>
          🏁 Partie beenden
        </button>
      )}
    </>
  );
}

function RoundForm({
  round,
  live,
  onDone,
  onCancel,
}: {
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
        roundId = await createRound(session.id, n, null, null);
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
