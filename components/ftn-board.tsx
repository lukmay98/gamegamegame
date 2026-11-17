"use client";

import { useMemo, useState } from "react";
import { createRound, deleteRound, finishRound, reopenBids, setGameStatus, updateRound } from "@/lib/actions";
import type { Entry, FtnConfig, Game, Player, Round } from "@/lib/games";
import {
  cardPlan,
  entryPoints,
  forbiddenDealerBid,
  nextBidder,
  roundProblem,
  ftnTotals,
  needsTricks,
  normalizeFtnConfig,
  firstDealer,
  nextDealer,
  biddingOrder,
} from "@/lib/games/ftn";
import type { LiveSession } from "@/lib/use-live-session";
import { errorText } from "@/lib/supabase";
import { Leaderboard } from "./leaderboard";
import { ScoreGrid } from "./score-grid";
import { Sheet } from "./sheet";
import { ErrorBox, Stepper } from "./ui";

type EntryPatch = Partial<Pick<Entry, "bid" | "tricks" | "hit">>;
type SaveFn = (round: Round, player: Player, patch: EntryPatch) => void;
type PatchLocal = (roundId: string, roundPatch: Partial<Round>, entryPatch?: (e: Entry) => Entry) => void;

export function FtnBoard({
  live,
  game,
  onNewGame,
  me,
  save,
  refresh,
  patchLocal,
  viewer = false,
  previousGames = [],
  onFinished,
}: {
  /** nach „Spiel beenden“ – fragt „Wird schon heim gegangen?“ */
  onFinished?: () => void;
  viewer?: boolean;
  /** Punkte je Spieler der vorherigen Spiele dieses Spieltags (für den ersten Geber) */
  previousGames?: Record<string, number>[];
  live: LiveSession;
  game: Game;
  onNewGame: () => void;
  me: string | null;
  save: SaveFn;
  refresh: () => void;
  patchLocal: PatchLocal;
}) {
  const { session, players, rounds, entries } = live;
  const config = useMemo(() => normalizeFtnConfig(game.config as Partial<FtnConfig>), [game.config]);
  const finished = game.status === "finished" || session.status === "finished";
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => a.seat - b.seat), [players]);
  const plan = useMemo(() => cardPlan(config), [config]);
  const totals = useMemo(() => ftnTotals(config, sortedPlayers, rounds, entries), [config, sortedPlayers, rounds, entries]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dealerOpen, setDealerOpen] = useState(false);
  // Schreiber dieses Spiels (sonst: wer den Spieltag angelegt hat)
  const writerId = useMemo(
    () => game.writer_player_id ?? players.find((p) => p.user_id != null && p.user_id === session.created_by)?.id ?? null,
    [game.writer_player_id, players, session.created_by],
  );
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
    // Erste Runde: je nach Einstellung; danach reihum nach Sitzordnung
    const dealer = last ? nextDealer(sortedPlayers, last.dealer_player_id) : firstDealer(config.dealerMode, sortedPlayers, previousGames);
    setBusy(true);
    await run(async () => {
      const id = await createRound(session.id, game.id, n, cards, dealer?.id ?? null);
      setSelectedId(id);
    });
    setBusy(false);
  }

  async function removeLast() {
    if (!last || !confirm(`Runde ${last.round_number} mit allen Einträgen löschen?`)) return;
    setSelectedId(null);
    await run(() => deleteRound(last.id));
  }

  async function finish() {
    setSelectedId(null);
    await run(() => setGameStatus(game.id, "finished"));
    onFinished?.();
  }

  function setDealer(round: Round, pid: string) {
    setDealerOpen(false);
    patchLocal(round.id, { dealer_player_id: pid });
    void run(() => updateRound(round.id, { dealer_player_id: pid }));
  }

  const dealerName = sortedPlayers.find((p) => p.id === selected?.dealer_player_id)?.name;

  return (
    <>
      <Leaderboard
        players={sortedPlayers}
        totals={totals.totals}
        me={me}
        finished={finished}
      />

      {error && <div className="mb-3"><ErrorBox>{error}</ErrorBox></div>}

      {!viewer && game.status === "finished" && session.status !== "finished" && (
        <div className="flex gap-2 mb-5">
          <button className="btn btn-accent flex-1 !py-3.5 text-base" onClick={onNewGame}>
            ＋ Neues Spiel
          </button>
          <button className="btn btn-ghost" onClick={() => void run(() => setGameStatus(game.id, "active"))}>
            Wieder öffnen
          </button>
        </div>
      )}

      {viewer && !last && (
        <p className="card px-4 py-6 mb-5 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          {finished ? "Dieses Spiel hatte keine Runden." : "Warten auf die erste Runde …"}
        </p>
      )}

      {!viewer && !finished && !last && (
        <button className="btn btn-accent w-full !py-3.5 text-base mb-5" disabled={busy || players.length < 1} onClick={nextRound}>
          Runde 1 starten · {plan[0]} Karte{plan[0] === 1 ? "" : "n"}
        </button>
      )}

      {/* Nach Partie-Ende keine Rundenkarte mehr – nur wenn eine Runde im Spielblock angetippt wird */}
      {selected && (!finished || selectedId) && (
        <RoundCard
          key={selected.id}
          round={selected}
          isLast={selected.id === last?.id}
          players={sortedPlayers}
          entries={entries}
          config={config}
          readOnly={finished || viewer}
          save={save}
          run={run}
          patchLocal={patchLocal}
          writerId={writerId}
          onBackToCurrent={finished || selected.id !== last?.id ? () => setSelectedId(null) : undefined}
          backLabel={finished ? "schließen" : "zur aktuellen Runde"}
        />
      )}

      {!viewer && !finished && last && selected?.id === last.id && last.phase === "done" && (
        <div className="mb-5">
          {planDone ? (
            <button className="btn btn-accent w-full !py-3.5 text-base" onClick={() => void finish()}>
              🏁 Spiel beenden
            </button>
          ) : (
            <button className="btn btn-accent w-full !py-3.5 text-base" disabled={busy} onClick={nextRound}>
              Nächste Runde · {plan[Math.min(last.round_number + 1, plan.length) - 1]} Karten
            </button>
          )}
        </div>
      )}

      {rounds.length > 0 && (
        <ScoreGrid
          title="Spielblock"
          subtitle={`Runde ${rounds.length} von ${plan.length}`}
          players={sortedPlayers}
          rounds={rounds}
          totals={totals.totals}
          roundLabel={(r) => `${r.cards} K.`}
          totalSub={(p) => (totals.played[p.id] ? `${totals.hits[p.id]}/${totals.played[p.id]} ✓` : null)}
          selectedId={finished && !selectedId ? null : (selected?.id ?? null)}
          onSelect={setSelectedId}
          hint={`Punkte, darunter Ansage und ✓/✗. Runde antippen zum Ansehen${viewer || finished ? "" : " oder Korrigieren"}.`}
          cell={(r, p) => {
            const e = entries.find((x) => x.round_id === r.id && x.player_id === p.id);
            const pts = totals.perRound[r.id]?.[p.id];
            return (
              <>
                {pts != null ? (
                  <span className="block font-bold leading-tight" style={{ color: e?.hit ? "var(--color-good)" : pts < 0 ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                    {pts}
                  </span>
                ) : (
                  <span className="block leading-tight" style={{ color: "var(--color-text-muted)" }}>·</span>
                )}
                <span className="block text-[10px] leading-tight whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
                  {e?.bid ?? "–"}
                  {e?.hit === true ? " ✓" : e?.hit === false ? ` ✗${e.tricks != null ? `(${e.tricks})` : ""}` : ""}
                </span>
              </>
            );
          }}
        />
      )}

      {!viewer && !finished && selected && (
        <div className="flex flex-col gap-2 mt-4">
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost text-sm" onClick={() => setDealerOpen(true)}>
              Geber{dealerName ? `: ${dealerName}` : ""} ändern
            </button>
            {selected.id === last?.id ? (
              <button className="btn btn-ghost text-sm" onClick={() => void removeLast()}>
                Runde {last.round_number} löschen
              </button>
            ) : (
              <span />
            )}
          </div>
          {!planDone && (
            <button className="btn btn-ghost w-full text-sm" onClick={() => confirm("Spiel jetzt beenden?") && void finish()}>
              Spiel vorzeitig beenden
            </button>
          )}
        </div>
      )}

      {selected && (
        <Sheet open={dealerOpen} onClose={() => setDealerOpen(false)} title={`Geber in Runde ${selected.round_number}`}>
          <div className="grid grid-cols-2 gap-2">
            {sortedPlayers.map((p) => {
              const active = p.id === selected.dealer_player_id;
              return (
                <button
                  key={p.id}
                  className={`btn ${active ? "btn-primary" : "btn-ghost"} !py-3`}
                  onClick={() => setDealer(selected, p.id)}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </Sheet>
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
  readOnly,
  save,
  run,
  patchLocal,
  writerId,
  onBackToCurrent,
  backLabel,
}: {
  round: Round;
  isLast: boolean;
  players: Player[];
  entries: Entry[];
  config: FtnConfig;
  readOnly: boolean;
  save: SaveFn;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  patchLocal: PatchLocal;
  writerId: string | null;
  onBackToCurrent?: () => void;
  backLabel: string;
}) {
  const [editDone, setEditDone] = useState(false);
  const cards = round.cards ?? 1;
  const phase = round.phase;
  // Reihenfolge im Block bleibt immer die Sitzordnung – nur das Geber-Zeichen wandert
  const order = [...players].sort((a, b) => a.seat - b.seat);
  const dealer = players.find((p) => p.id === round.dealer_player_id) ?? null;
  const entry = (pid: string) => entries.find((e) => e.round_id === round.id && e.player_id === pid);
  const askTricks = needsTricks(config.scoring);

  // Geber-Regel
  const bidSum = sumBids(entries, round.id);
  const othersBids = order.filter((p) => p.id !== dealer?.id).map((p) => entry(p.id)?.bid);
  const othersDone = othersBids.every((b) => b != null);
  const editingBids = phase === "bidding" || (phase === "done" && editDone);
  const forbidden = config.dealerRule && dealer && othersDone && editingBids ? forbiddenDealerBid(cards, othersBids as number[]) : null;
  const dealerViolates = forbidden != null && dealer != null && entry(dealer.id)?.bid === forbidden;
  const allBids = players.length > 0 && players.every((p) => entry(p.id)?.bid != null);
  const diff = bidSum - cards;

  // Spieler, die in dieser Runde angesagt haben (wichtig, falls jemand später dazukommt)
  const bidders = order.filter((p) => entry(p.id)?.bid != null);
  const missingTricks = bidders.some((p) => entry(p.id)?.hit === false && askTricks && entry(p.id)?.tricks == null);

  // Logikprüfung: z. B. können nicht alle richtig liegen, wenn die Ansagen nicht aufgehen
  const rows = (override?: { pid: string; hit: boolean | null }) =>
    bidders.map((p) => {
      const e = entry(p.id)!;
      return { bid: e.bid, hit: override?.pid === p.id ? override.hit : e.hit, tricks: e.tricks };
    });
  const problem = phase === "bidding" ? null : roundProblem(cards, rows(), askTricks);
  const [blocked, setBlocked] = useState<string | null>(null);

  // Ansage der Reihe nach: links vom Geber beginnend, Geber zuletzt
  const turn = phase === "bidding" ? nextBidder(order, dealer?.id ?? null, (pid) => entry(pid)?.bid) : null;
  const turnIdx = turn ? biddingOrder(order, dealer?.id ?? null).findIndex((p) => p.id === turn.id) : -1;
  const waiting = (p: Player) =>
    turn != null && biddingOrder(order, dealer?.id ?? null).findIndex((x) => x.id === p.id) > turnIdx;

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
    setBlocked(null);
    if (phase === "done") {
      const next = e.hit === false ? true : false;
      const err = roundProblem(cards, rows({ pid: p.id, hit: next }), askTricks);
      if (err) {
        setBlocked(err);
        return;
      }
    }
    if (phase === "playing") {
      save(round, p, e.hit === false ? { hit: null, tricks: null } : { hit: false });
    } else {
      save(round, p, e.hit === false ? { hit: true, tricks: null } : { hit: false });
    }
  }

  const statusText =
    phase === "bidding" ? "Stiche ansagen" : phase === "playing" ? "Wer lag daneben? Antippen" : "Runde abgeschlossen";

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
              {backLabel}
            </button>
          )}
        </div>
      </div>

      {/* Phase 1: Ansagen */}
      {(phase === "bidding" || (phase === "done" && editDone)) && (
        <>
          <ul className="flex flex-col mt-2">
            {order.map((p) => {
              const e = entry(p.id);
              const isDealer = p.id === dealer?.id;
              // nur +/− sind gesperrt, bis der Vorherige etwas eingetragen hat
              const wait = !readOnly && waiting(p);
              return (
                <li key={p.id} className="flex items-center gap-3 py-2 border-b last:border-b-0" style={{ borderColor: "var(--color-border)" }}>
                  <div className="flex-1 min-w-0 transition-opacity" style={{ opacity: wait ? 0.45 : 1 }}>
                    <div className="font-semibold truncate">
                      {p.name}
                      {p.id === writerId && <span className="ml-1 text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>(Schreiber)</span>}
                    </div>
                    <div className="text-xs flex gap-1.5 items-center" style={{ color: "var(--color-text-muted)" }}>
                      {isDealer && <span className="chip !py-0 !px-1.5" style={{ background: "var(--color-ink)", color: "white" }}>Geber</span>}
                      {isDealer && forbidden != null && <span style={{ color: "var(--color-accent)" }}>nicht {forbidden}</span>}
                    </div>
                  </div>
                  {readOnly ? (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-lg tabular"
                      style={{ background: "var(--color-surface-soft)", color: e?.bid == null ? "var(--color-text-muted)" : "var(--color-ink)" }}
                    >
                      {e?.bid ?? "–"}
                    </div>
                  ) : (
                    <Stepper
                      value={e?.bid ?? null}
                      max={cards}
                      forbidden={isDealer ? forbidden : null}
                      disabled={wait}
                      onChange={(v) => save(round, p, { bid: v })}
                    />
                  )}
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
            <>
              {!dealerViolates && problem && (
                <p className="text-xs mt-2" style={{ color: "var(--color-accent)" }}>
                  {problem} Bitte Ansagen oder danach „daneben“ korrigieren.
                </p>
              )}
              <button className="btn btn-primary w-full mt-3" disabled={dealerViolates || !allBids} onClick={() => setEditDone(false)}>
                Fertig
              </button>
            </>
          )}
        </>
      )}

      {/* Phase 2 + 3: Treffer / daneben */}
      {(phase === "playing" || (phase === "done" && !editDone)) && (
        <>
          <ul className="flex flex-col mt-2">
            {bidders.map((p) => {
              const e = entry(p.id)!;
              const miss = e.hit === false;
              const hit = e.hit === true;
              const isDealer = p.id === dealer?.id;
              const pts = phase === "done" ? entryPoints(e, config) : null;
              return (
                <li
                  key={p.id}
                  role={readOnly ? undefined : "button"}
                  tabIndex={readOnly ? undefined : 0}
                  aria-pressed={readOnly ? undefined : miss}
                  onClick={() => !readOnly && toggleMiss(p)}
                  onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && !readOnly && toggleMiss(p)}
                  className={`py-2 border-b last:border-b-0 select-none -mx-2 px-2 rounded-lg transition-colors ${readOnly ? "" : "cursor-pointer"}`}
                  style={{ borderColor: "var(--color-border)", background: miss ? "var(--color-accent-soft)" : undefined }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate" style={{ color: miss ? "var(--color-accent)" : undefined }}>
                        {p.name}
                        {p.id === writerId && <span className="ml-1 text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>(Schreiber)</span>}
                      </div>
                      <div className="text-xs flex gap-1.5 items-center" style={{ color: "var(--color-text-muted)" }}>
                        {isDealer && <span className="chip !py-0 !px-1.5" style={{ background: "var(--color-ink)", color: "white" }}>Geber</span>}
                        {miss && <span style={{ color: "var(--color-accent)" }}>✗ daneben</span>}
                        {hit && <span style={{ color: "var(--color-good)" }}>✓ getroffen</span>}
                      </div>
                    </div>
                    {/* gleiche Position wie bei der Ansage: [−] [Zahl] [+] → [Status] [Zahl] [Punkte] */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-10 h-10 flex items-center justify-center text-lg font-bold" style={{ color: miss ? "var(--color-accent)" : "var(--color-good)" }}>
                        {miss ? "✗" : hit ? "✓" : ""}
                      </div>
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-lg tabular"
                        style={{
                          background: miss ? "var(--color-accent)" : "var(--color-surface-soft)",
                          color: miss ? "white" : "var(--color-ink)",
                        }}
                      >
                        {e.bid}
                      </div>
                      <div className="w-10 h-10 flex items-center justify-center font-display font-bold tabular" style={{ color: pts != null && pts < 0 ? "var(--color-accent)" : "var(--color-ink)" }}>
                        {pts != null ? pts : ""}
                      </div>
                    </div>
                  </div>
                  {miss && askTricks && readOnly && e.tricks != null && (
                    <p className="text-xs text-right mt-1" style={{ color: "var(--color-accent)" }}>{e.tricks} Stiche gemacht</p>
                  )}
                  {miss && askTricks && !readOnly && (
                    <div className="flex items-center justify-end gap-2 mt-1.5" onClick={(ev) => ev.stopPropagation()}>
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
              {problem && !missingTricks && (
                <p className="text-xs mt-3 font-semibold" style={{ color: "var(--color-accent)" }}>
                  {problem}
                </p>
              )}
              {missingTricks && (
                <p className="text-xs mt-3" style={{ color: "var(--color-accent)" }}>
                  Bitte bei allen, die daneben lagen, die tatsächlichen Stiche eintragen.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button className="btn btn-ghost" onClick={editBids}>
                  Ansagen bearbeiten
                </button>
                <button className="btn btn-accent" disabled={missingTricks || problem != null} onClick={closeRound}>
                  Runde abschließen
                </button>
              </div>
            </>
          )}

          {phase === "done" && !readOnly && (blocked || problem) && (
            <p className="text-xs mt-2 font-semibold" style={{ color: "var(--color-accent)" }}>
              {blocked ?? problem}
            </p>
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

