"use client";

import { useMemo, useState } from "react";
import { createRound, deleteRound, finishRound, reopenBids, setSessionStatus, updateRound } from "@/lib/actions";
import type { Entry, FtnConfig, Player, Round } from "@/lib/games";
import {
  biddingOrder,
  DEALER_MODES,
  cardPlan,
  entryPoints,
  forbiddenDealerBid,
  ftnTotals,
  needsTricks,
  normalizeFtnConfig,
  suggestDealer,
} from "@/lib/games/ftn";
import type { LiveSession } from "@/lib/use-live-session";
import { errorText } from "@/lib/supabase";
import { Leaderboard } from "./leaderboard";
import { ErrorBox, Stepper } from "./ui";

type EntryPatch = Partial<Pick<Entry, "bid" | "tricks" | "hit">>;
type SaveFn = (round: Round, player: Player, patch: EntryPatch) => void;
type PatchLocal = (roundId: string, roundPatch: Partial<Round>, entryPatch?: (e: Entry) => Entry) => void;

export function FtnBoard({
  live,
  me,
  save,
  refresh,
  onOpenPlayers,
  patchLocal,
}: {
  live: LiveSession;
  me: string | null;
  save: SaveFn;
  refresh: () => void;
  onOpenPlayers: () => void;
  patchLocal: PatchLocal;
}) {
  const { session, players, rounds, entries } = live;
  const config = useMemo(() => normalizeFtnConfig(session.config as Partial<FtnConfig>), [session.config]);
  const finished = session.status === "finished";
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => a.seat - b.seat), [players]);
  const plan = useMemo(() => cardPlan(config), [config]);
  const totals = useMemo(() => ftnTotals(config, sortedPlayers, rounds, entries), [config, sortedPlayers, rounds, entries]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const last = rounds.at(-1) ?? null;
  const selected = rounds.find((r) => r.id === selectedId) ?? last;
  const planDone = (last?.round_number ?? 0) >= plan.length;

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      refresh();
    }
  }

  async function nextRound() {
    const n = (last?.round_number ?? 0) + 1;
    const cards = plan[Math.min(n, plan.length) - 1];
    const dealer = suggestDealer(config.dealerMode, sortedPlayers, last, totals);
    setBusy(true);
    await run(async () => {
      const id = await createRound(session.id, n, cards, dealer?.id ?? null);
      setSelectedId(id);
    });
    setBusy(false);
  }

  async function removeLast() {
    if (!last || !confirm(`Runde ${last.round_number} mit allen Einträgen löschen?`)) return;
    setSelectedId(null);
    await run(() => deleteRound(last.id));
  }

  const finish = () => run(() => setSessionStatus(session.id, "finished"));

  return (
    <>
      <Leaderboard
        players={sortedPlayers}
        totals={totals.totals}
        me={me}
        finished={finished}
        extra={(p) => (totals.played[p.id] ? `${totals.hits[p.id]} von ${totals.played[p.id]} getroffen` : null)}
      />

      {error && <div className="mb-3"><ErrorBox>{error}</ErrorBox></div>}

      {!finished && !last && (
        <button className="btn btn-accent w-full !py-3.5 text-base mb-5" disabled={busy || players.length < 1} onClick={nextRound}>
          Runde 1 starten · {plan[0]} Karte{plan[0] === 1 ? "" : "n"}
        </button>
      )}

      {selected && (
        <RoundCard
          key={selected.id}
          round={selected}
          isLast={selected.id === last?.id}
          players={sortedPlayers}
          entries={entries}
          config={config}
          me={me}
          readOnly={finished}
          save={save}
          run={run}
          patchLocal={patchLocal}
          onOpenPlayers={onOpenPlayers}
          onDelete={selected.id === last?.id && !finished ? removeLast : undefined}
          onBackToCurrent={selected.id !== last?.id ? () => setSelectedId(null) : undefined}
        />
      )}

      {!finished && last && selected?.id === last.id && last.phase === "done" && (
        <div className="mb-5">
          {planDone ? (
            <button className="btn btn-accent w-full !py-3.5 text-base" onClick={() => void finish()}>
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
          players={sortedPlayers}
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

function sumBids(entries: Entry[], roundId: string) {
  return entries.filter((e) => e.round_id === roundId).reduce((s, e) => s + (e.bid ?? 0), 0);
}

function RoundCard({
  round,
  isLast,
  players,
  entries,
  config,
  me,
  readOnly,
  save,
  run,
  patchLocal,
  onOpenPlayers,
  onDelete,
  onBackToCurrent,
}: {
  round: Round;
  isLast: boolean;
  players: Player[];
  entries: Entry[];
  config: FtnConfig;
  me: string | null;
  readOnly: boolean;
  save: SaveFn;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  patchLocal: PatchLocal;
  onOpenPlayers: () => void;
  onDelete?: () => void;
  onBackToCurrent?: () => void;
}) {
  const [editDone, setEditDone] = useState(false);
  const cards = round.cards ?? 1;
  const phase = round.phase;
  const order = biddingOrder(players, round.dealer_player_id);
  const dealer = players.find((p) => p.id === round.dealer_player_id) ?? null;
  const entry = (pid: string) => entries.find((e) => e.round_id === round.id && e.player_id === pid);
  const askTricks = needsTricks(config.scoring);

  // Geber-Regel
  const bidSum = sumBids(entries, round.id);
  const othersBids = order.filter((p) => p.id !== dealer?.id).map((p) => entry(p.id)?.bid);
  const othersDone = othersBids.every((b) => b != null);
  const forbidden = config.dealerRule && dealer && othersDone ? forbiddenDealerBid(cards, othersBids as number[]) : null;
  const dealerViolates = forbidden != null && dealer != null && entry(dealer.id)?.bid === forbidden;
  const allBids = players.length > 0 && players.every((p) => entry(p.id)?.bid != null);
  const diff = bidSum - cards;

  // Spieler, die in dieser Runde angesagt haben (wichtig, falls jemand später dazukommt)
  const bidders = order.filter((p) => entry(p.id)?.bid != null);
  const missingTricks = bidders.some((p) => entry(p.id)?.hit === false && askTricks && entry(p.id)?.tricks == null);

  function setDealer(pid: string) {
    patchLocal(round.id, { dealer_player_id: pid });
    void run(() => updateRound(round.id, { dealer_player_id: pid }));
  }

  function confirmBids() {
    patchLocal(round.id, { phase: "playing" });
    void run(() => updateRound(round.id, { phase: "playing" }));
  }

  function editBids() {
    patchLocal(round.id, { phase: "bidding" }, (e) => ({ ...e, hit: null, tricks: null }));
    void run(() => reopenBids(round.id));
  }

  function closeRound() {
    patchLocal(round.id, { phase: "done" }, (e) => (e.hit == null && e.bid != null ? { ...e, hit: true } : e));
    void run(() => finishRound(round.id));
  }

  function toggleMiss(p: Player) {
    const e = entry(p.id);
    if (!e || e.bid == null) return;
    if (phase === "playing") {
      save(round, p, e.hit === false ? { hit: null, tricks: null } : { hit: false });
    } else {
      save(round, p, e.hit === false ? { hit: true, tricks: null } : { hit: false });
    }
  }

  const statusText =
    phase === "bidding" ? "1 · Stiche ansagen" : phase === "playing" ? "2 · Wer lag daneben? Antippen" : "Runde abgeschlossen";

  return (
    <section className="card p-4 mb-5">
      {/* Kopf */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg leading-tight">
            Runde {round.round_number}
            <span className="font-normal text-sm ml-2" style={{ color: "var(--color-text-muted)" }}>
              {cards} Karte{cards === 1 ? "" : "n"}
            </span>
          </h2>
          <p className="text-sm font-semibold mt-0.5" style={{ color: phase === "done" ? "var(--color-good)" : "var(--color-ink-soft)" }}>
            {statusText}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {onBackToCurrent && (
            <button className="text-xs underline" style={{ color: "var(--color-ink-soft)" }} onClick={onBackToCurrent}>
              zur aktuellen Runde
            </button>
          )}
          {onDelete && (
            <button className="text-xs underline" style={{ color: "var(--color-text-muted)" }} onClick={onDelete}>
              Runde löschen
            </button>
          )}
        </div>
      </div>

      {/* Geber-Auswahl */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="label !mb-0">
            Geber
            <span className="font-normal ml-1">· Vorschlag: {DEALER_MODES.find((m) => m.id === config.dealerMode)?.label}</span>
          </span>
          {!readOnly && (
            <button className="text-xs font-semibold underline" style={{ color: "var(--color-ink-soft)" }} onClick={onOpenPlayers}>
              Sitzordnung ändern
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {players.map((p) => {
            const active = p.id === dealer?.id;
            return (
              <button
                key={p.id}
                disabled={readOnly}
                onClick={() => setDealer(p.id)}
                className="chip !py-1.5 !px-3 !text-sm shrink-0 border"
                style={{
                  background: active ? "var(--color-ink)" : "transparent",
                  color: active ? "white" : "var(--color-text)",
                  borderColor: active ? "var(--color-ink)" : "var(--color-border)",
                }}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Phase 1: Ansagen */}
      {(phase === "bidding" || (phase === "done" && editDone)) && (
        <>
          <ul className="flex flex-col mt-2">
            {order.map((p) => {
              const e = entry(p.id);
              const isDealer = p.id === dealer?.id;
              const mine = p.user_id != null && p.user_id === me;
              return (
                <li key={p.id} className="flex items-center gap-3 py-2 border-b last:border-b-0" style={{ borderColor: "var(--color-border)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {p.name}
                      {mine && <span className="ml-1 text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>(du)</span>}
                    </div>
                    <div className="text-xs flex gap-1.5 items-center" style={{ color: "var(--color-text-muted)" }}>
                      {isDealer && <span className="chip !py-0 !px-1.5" style={{ background: "var(--color-ink)", color: "white" }}>Geber</span>}
                      {isDealer && forbidden != null && phase === "bidding" && <span style={{ color: "var(--color-accent)" }}>nicht {forbidden}</span>}
                    </div>
                  </div>
                  <Stepper
                    value={e?.bid ?? null}
                    max={cards}
                    forbidden={isDealer && phase === "bidding" ? forbidden : null}
                    disabled={readOnly}
                    onChange={(v) => save(round, p, { bid: v })}
                  />
                </li>
              );
            })}
          </ul>
          <div className="mt-3 text-sm flex items-center justify-between tabular">
            <span style={{ color: "var(--color-text-muted)" }}>Summe Ansagen</span>
            <span className="font-semibold" style={{ color: dealerViolates ? "var(--color-accent)" : undefined }}>
              {bidSum} / {cards} {diff === 0 ? "· genau" : diff > 0 ? `· ${diff} drüber` : `· ${-diff} drunter`}
            </span>
          </div>
          {dealerViolates && (
            <p className="text-xs mt-1" style={{ color: "var(--color-accent)" }}>
              Geber-Regel: {dealer?.name} darf nicht {forbidden} ansagen.
            </p>
          )}
          {phase === "bidding" && !readOnly && allBids && (
            <button className="btn btn-accent w-full mt-3 !py-3" disabled={dealerViolates} onClick={confirmBids}>
              ✓ Ansagen bestätigen
            </button>
          )}
          {phase === "done" && editDone && (
            <button className="btn btn-primary w-full mt-3" onClick={() => setEditDone(false)}>
              Fertig
            </button>
          )}
        </>
      )}

      {/* Phase 2 + 3: Treffer / daneben */}
      {(phase === "playing" || (phase === "done" && !editDone)) && (
        <>
          <ul className="flex flex-col gap-2 mt-3">
            {bidders.map((p) => {
              const e = entry(p.id)!;
              const miss = e.hit === false;
              const hit = e.hit === true;
              const pts = phase === "done" ? entryPoints(e, config) : null;
              const mine = p.user_id != null && p.user_id === me;
              return (
                <li key={p.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={miss}
                    onClick={() => !readOnly && toggleMiss(p)}
                    onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && !readOnly && toggleMiss(p)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 select-none cursor-pointer transition-colors"
                    style={{
                      borderColor: miss ? "var(--color-accent)" : hit ? "var(--color-good)" : "var(--color-border)",
                      background: miss ? "var(--color-accent-soft)" : hit ? "var(--color-good-soft)" : "var(--color-surface)",
                    }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-extrabold text-xl tabular shrink-0"
                      style={{
                        background: miss ? "var(--color-accent)" : hit ? "var(--color-good)" : "var(--color-surface-soft)",
                        color: miss || hit ? "white" : "var(--color-ink)",
                      }}
                    >
                      {e.bid}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">
                        {p.name}
                        {mine && <span className="ml-1 text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>(du)</span>}
                      </div>
                      <div className="text-xs" style={{ color: miss ? "var(--color-accent)" : hit ? "var(--color-good)" : "var(--color-text-muted)" }}>
                        {miss ? "✗ daneben" : hit ? "✓ getroffen" : `${e.bid} angesagt`}
                        {p.id === dealer?.id && " · Geber"}
                      </div>
                    </div>
                    {pts != null && (
                      <span className="font-display font-extrabold text-lg tabular" style={{ color: pts < 0 ? "var(--color-accent)" : "var(--color-ink)" }}>
                        {pts > 0 ? `+${pts}` : pts}
                      </span>
                    )}
                  </div>
                  {miss && askTricks && (
                    <div className="flex items-center justify-end gap-2 mt-1.5 pr-1" onClick={(ev) => ev.stopPropagation()}>
                      <span className="text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
                        Wie viele Stiche?
                      </span>
                      <Stepper
                        value={e.tricks ?? null}
                        max={cards}
                        forbidden={e.bid}
                        disabled={readOnly}
                        onChange={(v) => save(round, p, { tricks: v })}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {phase === "playing" && !readOnly && (
            <>
              <p className="text-xs mt-3" style={{ color: "var(--color-text-muted)" }}>
                Nur antippen, wer <b>falsch</b> lag. Alle anderen zählen beim Abschließen als getroffen.
              </p>
              {missingTricks && (
                <p className="text-xs mt-1" style={{ color: "var(--color-accent)" }}>
                  Bitte bei allen, die daneben lagen, die tatsächlichen Stiche eintragen.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button className="btn btn-ghost" onClick={editBids}>
                  Ansagen bearbeiten
                </button>
                <button className="btn btn-accent" disabled={missingTricks} onClick={closeRound}>
                  Runde abschließen
                </button>
              </div>
            </>
          )}

          {phase === "done" && !readOnly && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Antippen zum Korrigieren{isLast ? "" : " (ältere Runde)"}.
              </p>
              <button className="text-xs font-semibold underline" style={{ color: "var(--color-ink-soft)" }} onClick={() => setEditDone(true)}>
                Ansagen ändern
              </button>
            </div>
          )}
        </>
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
                  return (
                    <td key={p.id} className="px-2 py-1.5 text-center">
                      {pts != null ? (
                        <span className="font-bold" style={{ color: e?.hit ? "var(--color-good)" : pts < 0 ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                          {pts}
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>·</span>
                      )}
                      <span className="block text-[10px] leading-tight" style={{ color: "var(--color-text-muted)" }}>
                        {e?.bid ?? "–"}
                        {e?.hit === true ? " ✓" : e?.hit === false ? ` ✗${e.tricks != null ? ` (${e.tricks})` : ""}` : ""}
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
      <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>Ansage und ✓/✗ unter den Punkten. Runde antippen zum Ansehen oder Korrigieren.</p>
    </section>
  );
}
