"use client";

import { useMemo, useState } from "react";
import { createRound, deleteRound, setSessionStatus } from "@/lib/actions";
import type { Entry, FtnConfig, Player, Round } from "@/lib/games";
import {
  biddingOrder,
  cardPlan,
  dealerForRound,
  forbiddenDealerBid,
  ftnTotals,
  roundState,
} from "@/lib/games/ftn";
import type { LiveSession } from "@/lib/use-live-session";
import { errorText } from "@/lib/supabase";
import { Leaderboard } from "./leaderboard";
import { ErrorBox, Stepper } from "./ui";

type SaveFn = (round: Round, player: Player, patch: Partial<Pick<Entry, "bid" | "tricks">>) => void;

export function FtnBoard({
  live,
  me,
  save,
  refresh,
}: {
  live: LiveSession;
  me: string | null;
  save: SaveFn;
  refresh: () => void;
}) {
  const { session, players, rounds, entries } = live;
  const config = session.config as FtnConfig;
  const finished = session.status === "finished";
  const plan = useMemo(() => cardPlan(config), [config]);
  const totals = useMemo(() => ftnTotals(config, players, rounds, entries), [config, players, rounds, entries]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const last = rounds.at(-1) ?? null;
  const selected = rounds.find((r) => r.id === selectedId) ?? last;

  async function nextRound() {
    const n = (last?.round_number ?? 0) + 1;
    const cards = plan[Math.min(n, plan.length) - 1];
    setBusy(true);
    setError(null);
    try {
      const id = await createRound(session.id, n, cards, dealerForRound(players, n)?.id ?? null);
      setSelectedId(id);
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeLast() {
    if (!last || !confirm(`Runde ${last.round_number} mit allen Einträgen löschen?`)) return;
    try {
      await deleteRound(last.id);
      setSelectedId(null);
      refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function finish() {
    try {
      await setSessionStatus(session.id, "finished");
      refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const lastState = last ? roundState(last, players, entries) : null;
  const lastTricksOk = last ? sumOf(entries, last.id, "tricks") === last.cards : false;
  const planDone = (last?.round_number ?? 0) >= plan.length;

  return (
    <>
      <Leaderboard
        players={players}
        totals={totals.totals}
        me={me}
        finished={finished}
        extra={(p) => (rounds.length ? `${totals.hits[p.id]} von ${countDone(rounds, players, entries)} getroffen` : null)}
      />

      {error && <div className="mb-3"><ErrorBox>{error}</ErrorBox></div>}

      {!finished && players.length < 2 && (
        <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
          Warte auf Mitspieler oder füge sie unter „Spieler“ hinzu.
        </p>
      )}

      {!finished && !last && players.length >= 1 && (
        <button className="btn btn-accent w-full !py-3.5 text-base mb-5" disabled={busy} onClick={nextRound}>
          Runde 1 starten · {plan[0]} Karte{plan[0] === 1 ? "" : "n"}
        </button>
      )}

      {selected && (
        <RoundEditor
          key={selected.id}
          round={selected}
          isLast={selected.id === last?.id}
          players={players}
          entries={entries}
          config={config}
          me={me}
          readOnly={finished}
          save={save}
          onDelete={selected.id === last?.id && !finished ? removeLast : undefined}
        />
      )}

      {!finished && last && selected?.id === last.id && lastState === "done" && (
        <div className="mb-5">
          {!lastTricksOk ? (
            <ErrorBox>Die Stiche ergeben zusammen nicht {last.cards}. Bitte prüfen.</ErrorBox>
          ) : planDone ? (
            <button className="btn btn-accent w-full !py-3.5 text-base" onClick={finish}>
              🏁 Partie beenden
            </button>
          ) : (
            <button className="btn btn-accent w-full !py-3.5 text-base" disabled={busy} onClick={nextRound}>
              Nächste Runde · {plan[Math.min(last.round_number + 1, plan.length) - 1]} Karten
            </button>
          )}
        </div>
      )}

      {rounds.length > 0 && (
        <ScoreTable
          rounds={rounds}
          players={players}
          entries={entries}
          perRound={totals.perRound}
          totals={totals.totals}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          planLength={plan.length}
        />
      )}

      {!finished && rounds.length > 0 && !planDone && (
        <button className="btn btn-ghost w-full mt-4 text-sm" onClick={() => confirm("Partie jetzt beenden?") && void finish()}>
          Partie vorzeitig beenden
        </button>
      )}
    </>
  );
}

function sumOf(entries: Entry[], roundId: string, field: "bid" | "tricks") {
  return entries.filter((e) => e.round_id === roundId).reduce((s, e) => s + (e[field] ?? 0), 0);
}

function countDone(rounds: Round[], players: Player[], entries: Entry[]) {
  return rounds.filter((r) => roundState(r, players, entries) === "done").length;
}

function RoundEditor({
  round,
  isLast,
  players,
  entries,
  config,
  me,
  readOnly,
  save,
  onDelete,
}: {
  round: Round;
  isLast: boolean;
  players: Player[];
  entries: Entry[];
  config: FtnConfig;
  me: string | null;
  readOnly: boolean;
  save: SaveFn;
  onDelete?: () => void;
}) {
  const state = roundState(round, players, entries);
  const [tab, setTab] = useState<"bid" | "tricks">(state === "bidding" ? "bid" : "tricks");
  const cards = round.cards ?? 1;
  const order = biddingOrder(players, round.dealer_player_id);
  const dealer = players.find((p) => p.id === round.dealer_player_id);
  const entry = (pid: string) => entries.find((e) => e.round_id === round.id && e.player_id === pid);

  const bidSum = sumOf(entries, round.id, "bid");
  const trickSum = sumOf(entries, round.id, "tricks");
  const dealerEntry = dealer ? entry(dealer.id) : undefined;
  const othersBids = order.filter((p) => p.id !== dealer?.id).map((p) => entry(p.id)?.bid);
  const othersDone = othersBids.every((b) => b != null);
  const forbidden =
    config.dealerRule && dealer && othersDone ? forbiddenDealerBid(cards, othersBids as number[]) : null;
  const dealerViolates = forbidden != null && dealerEntry?.bid === forbidden;

  const diff = bidSum - cards;

  return (
    <section className="card p-4 mb-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display font-bold text-lg leading-tight">
            Runde {round.round_number}
            {!isLast && <span className="ml-2 chip" style={{ background: "var(--color-surface-soft)" }}>bearbeiten</span>}
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {cards} Karte{cards === 1 ? "" : "n"} · Geber: <b>{dealer?.name ?? "–"}</b>
          </p>
        </div>
        {onDelete && (
          <button className="text-xs underline" style={{ color: "var(--color-text-muted)" }} onClick={onDelete}>
            Runde löschen
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl mb-3" style={{ background: "var(--color-surface-soft)" }}>
        {(["bid", "tricks"] as const).map((t) => (
          <button
            key={t}
            className="rounded-lg py-2 text-sm font-semibold"
            style={{ background: tab === t ? "var(--color-surface)" : "transparent", boxShadow: tab === t ? "0 1px 2px rgb(0 0 0 / .08)" : undefined }}
            onClick={() => setTab(t)}
          >
            {t === "bid" ? "1 · Ansagen" : "2 · Stiche"}
          </button>
        ))}
      </div>

      <ul className="flex flex-col">
        {order.map((p) => {
          const e = entry(p.id);
          const isDealer = p.id === dealer?.id;
          const mine = p.user_id != null && p.user_id === me;
          const hit = e?.bid != null && e?.tricks != null ? e.bid === e.tricks : null;
          return (
            <li key={p.id} className="flex items-center gap-3 py-2 border-b last:border-b-0" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate" style={{ color: mine ? "var(--color-ink)" : undefined }}>
                  {p.name}
                  {mine && <span className="ml-1 text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>(du)</span>}
                </div>
                <div className="text-xs flex gap-1.5 items-center" style={{ color: "var(--color-text-muted)" }}>
                  {isDealer && <span className="chip !py-0 !px-1.5" style={{ background: "var(--color-ink)", color: "white" }}>Geber</span>}
                  {tab === "tricks" && <span>Ansage {e?.bid ?? "–"}</span>}
                  {tab === "bid" && isDealer && forbidden != null && <span style={{ color: "var(--color-accent)" }}>nicht {forbidden}</span>}
                  {tab === "tricks" && hit != null && (
                    <span style={{ color: hit ? "var(--color-good)" : "var(--color-accent)" }}>{hit ? "✓ getroffen" : "✗ daneben"}</span>
                  )}
                </div>
              </div>
              {tab === "bid" ? (
                <Stepper
                  value={e?.bid ?? null}
                  max={cards}
                  forbidden={isDealer ? forbidden : null}
                  disabled={readOnly}
                  onChange={(v) => save(round, p, { bid: v })}
                />
              ) : (
                <Stepper value={e?.tricks ?? null} max={cards} disabled={readOnly} onChange={(v) => save(round, p, { tricks: v })} />
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 text-sm flex items-center justify-between tabular">
        {tab === "bid" ? (
          <>
            <span style={{ color: "var(--color-text-muted)" }}>Summe Ansagen</span>
            <span className="font-semibold" style={{ color: dealerViolates ? "var(--color-accent)" : undefined }}>
              {bidSum} / {cards} {diff === 0 ? "· genau" : diff > 0 ? `· ${diff} drüber` : `· ${-diff} drunter`}
            </span>
          </>
        ) : (
          <>
            <span style={{ color: "var(--color-text-muted)" }}>Summe Stiche</span>
            <span className="font-semibold" style={{ color: trickSum > cards ? "var(--color-accent)" : undefined }}>
              {trickSum} / {cards}
            </span>
          </>
        )}
      </div>
      {tab === "bid" && dealerViolates && (
        <p className="text-xs mt-1" style={{ color: "var(--color-accent)" }}>Geber-Regel: Der Geber darf nicht {forbidden} ansagen.</p>
      )}
      {tab === "bid" && state !== "bidding" && !readOnly && (
        <button className="btn btn-primary w-full mt-3" onClick={() => setTab("tricks")}>
          Weiter zu den Stichen →
        </button>
      )}
    </section>
  );
}

function ScoreTable({
  rounds,
  players,
  entries,
  perRound,
  totals,
  selectedId,
  onSelect,
  planLength,
}: {
  rounds: Round[];
  players: Player[];
  entries: Entry[];
  perRound: Record<string, Record<string, number | null>>;
  totals: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  planLength: number;
}) {
  return (
    <section>
      <h2 className="font-display font-bold text-lg mb-2">
        Spielblock <span className="text-sm font-normal" style={{ color: "var(--color-text-muted)" }}>· Runde {rounds.length} von {planLength}</span>
      </h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm tabular border-collapse">
          <thead>
            <tr style={{ background: "var(--color-surface-soft)" }}>
              <th className="sticky left-0 px-2 py-2 text-left font-semibold" style={{ background: "var(--color-surface-soft)" }}>#</th>
              {players.map((p) => (
                <th key={p.id} className="px-2 py-2 font-semibold text-center min-w-16 truncate max-w-24">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => (
              <tr
                key={r.id}
                onClick={() => onSelect(r.id)}
                className="cursor-pointer border-t"
                style={{ borderColor: "var(--color-border)", background: r.id === selectedId ? "var(--color-accent-soft)" : undefined }}
              >
                <td className="sticky left-0 px-2 py-1.5 whitespace-nowrap" style={{ background: r.id === selectedId ? "var(--color-accent-soft)" : "var(--color-surface)" }}>
                  <span className="font-semibold">{r.round_number}</span>
                  <span className="text-xs ml-1" style={{ color: "var(--color-text-muted)" }}>({r.cards})</span>
                </td>
                {players.map((p) => {
                  const e = entries.find((x) => x.round_id === r.id && x.player_id === p.id);
                  const pts = perRound[r.id]?.[p.id];
                  const hit = e?.bid != null && e?.tricks != null && e.bid === e.tricks;
                  return (
                    <td key={p.id} className="px-2 py-1.5 text-center">
                      {pts != null ? (
                        <span className="font-bold" style={{ color: hit ? "var(--color-good)" : pts < 0 ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                          {pts}
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>·</span>
                      )}
                      <span className="block text-[10px] leading-tight" style={{ color: "var(--color-text-muted)" }}>
                        {e?.bid ?? "–"}/{e?.tricks ?? "–"}
                      </span>
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
      <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>Ansage/Stiche unter den Punkten. Runde antippen zum Bearbeiten.</p>
    </section>
  );
}
