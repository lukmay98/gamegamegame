import { test } from "node:test";
import assert from "node:assert/strict";
import {
  biddingOrder,
  cardPlan,
  cardsForRound,
  defaultFtnConfig,
  entryPoints,
  forbiddenDealerBid,
  ftnTotals,
  FTN_PRESETS,
  maxCardsFor,
  needsTricks,
  nextDealer,
  normalizeFtnConfig,
  firstDealer,
} from "./ftn.ts";
import { freeTotals, targetReached } from "./free.ts";
import { rank } from "./ranking.ts";
import type { Entry, Player, Round } from "./types.ts";

const P = (id: string, seat: number): Player => ({ id, seat, name: id, session_id: "s", user_id: null });
const players = [P("a", 1), P("b", 2), P("c", 3)];
const R = (id: string, n: number, cards: number | null = null, phase: Round["phase"] = "done"): Round => ({
  id, round_number: n, cards, session_id: "s", dealer_player_id: null, phase, created_at: "",
});
const E = (round_id: string, player_id: string, x: Partial<Entry>): Entry => ({
  round_id, player_id, session_id: "s", bid: null, tricks: null, hit: null, points: null, ...x,
});

test("card plan", () => {
  assert.deepEqual(cardPlan({ maxCards: 4, sequence: "up-down" }), [1, 2, 3, 4, 3, 2, 1]);
  assert.deepEqual(cardPlan({ maxCards: 4, sequence: "up-down", peakTwice: true }), [1, 2, 3, 4, 4, 3, 2, 1]);
  assert.deepEqual(cardPlan({ maxCards: 3, sequence: "down" }), [3, 2, 1]);
  assert.deepEqual(cardPlan({ maxCards: 3, sequence: "down", peakTwice: true }), [3, 3, 2, 1]);
  assert.deepEqual(cardPlan({ maxCards: 3, sequence: "up", peakTwice: true }), [1, 2, 3, 3]);
  assert.deepEqual(cardPlan({ maxCards: 1, sequence: "up-down" }), [1]);
  const cfg = { ...defaultFtnConfig(4), maxCards: 3 };
  assert.equal(cfg.peakTwice, true); // Standard: höchste Runde zweimal
  assert.equal(cardsForRound(cfg, 3), 3);
  assert.equal(cardsForRound(cfg, 4), 3);
  assert.equal(cardsForRound(cfg, 6), 1);
  assert.equal(cardsForRound(cfg, 99), 1);
});

test("max cards with deck size", () => {
  assert.equal(maxCardsFor(4), 9); // Standard 36 Karten
  assert.equal(maxCardsFor(5), 7);
  assert.equal(maxCardsFor(4, 52), 13);
  assert.equal(maxCardsFor(6, 104), 17);
  assert.equal(maxCardsFor(3, 32), 10);
});

test("normalize old config", () => {
  const c = normalizeFtnConfig({ maxCards: 7, sequence: "up" });
  assert.equal(c.deckSize, 36);
  assert.equal(c.dealerMode, "dayLeader");
  assert.equal(normalizeFtnConfig({ decks: 2 } as never).deckSize, 104);
  assert.equal(c.peakTwice, false);
  assert.equal(c.zeroHit, null);
});

test("entry points", () => {
  const classic = defaultFtnConfig(4);
  assert.equal(needsTricks(classic.scoring), false);
  assert.equal(entryPoints({ bid: 0, hit: true, tricks: null }, classic), 10);
  assert.equal(entryPoints({ bid: 3, hit: true, tricks: null }, classic), 13);
  assert.equal(entryPoints({ bid: 3, hit: false, tricks: null }, classic), 0);
  assert.equal(entryPoints({ bid: 3, hit: null, tricks: null }, classic), null);
  const zero20 = { ...classic, zeroHit: 20 };
  assert.equal(entryPoints({ bid: 0, hit: true, tricks: null }, zero20), 20);
  assert.equal(entryPoints({ bid: 1, hit: true, tricks: null }, zero20), 11);
  const wizard = { ...classic, scoring: FTN_PRESETS.wizard.scoring };
  assert.equal(needsTricks(wizard.scoring), true);
  assert.equal(entryPoints({ bid: 2, hit: true, tricks: null }, wizard), 40);
  assert.equal(entryPoints({ bid: 2, hit: false, tricks: 5 }, wizard), -30);
  assert.equal(entryPoints({ bid: 2, hit: false, tricks: null }, wizard), null);
  const every = { ...classic, scoring: FTN_PRESETS.everyTrick.scoring };
  assert.equal(entryPoints({ bid: 2, hit: false, tricks: 3 }, every), 3);
});

test("dealer rule", () => {
  assert.equal(forbiddenDealerBid(3, [1, 1]), 1);
  assert.equal(forbiddenDealerBid(3, [2, 2]), null);
  assert.equal(forbiddenDealerBid(3, [0, 0]), 3);
});

test("next dealer and bidding order", () => {
  assert.equal(nextDealer(players, null)?.id, "a");
  assert.equal(nextDealer(players, "a")?.id, "b");
  assert.equal(nextDealer(players, "c")?.id, "a");
  assert.deepEqual(biddingOrder(players, "b").map((p) => p.id), ["c", "a", "b"]);
});

test("first dealer of a game", () => {
  // erstes Spiel: erster Platz
  assert.equal(firstDealer("dayLeader", players, [])?.id, "a");
  assert.equal(firstDealer("lastGameWinner", players, [])?.id, "a");
  const g1 = { a: 10, b: 30, c: 20 };
  const g2 = { a: 40, b: 0, c: 15 };
  // Führender des Spieltags: a 50, b 30, c 35
  assert.equal(firstDealer("dayLeader", players, [g1])?.id, "b");
  assert.equal(firstDealer("dayLeader", players, [g1, g2])?.id, "a");
  // Gewinner des letzten Spiels
  assert.equal(firstDealer("lastGameWinner", players, [g1, g2])?.id, "a");
  assert.equal(firstDealer("lastGameWinner", players, [g2, g1])?.id, "b");
  // Gleichstand → Erster in Sitzreihenfolge
  assert.equal(firstDealer("dayLeader", players, [{ a: 5, b: 9, c: 9 }])?.id, "b");
  // nicht mitgespielt zählt nicht
  assert.equal(firstDealer("lastGameWinner", players, [{ c: 3 }])?.id, "c");
});

test("totals only count finished rounds", () => {
  const cfg = defaultFtnConfig(3);
  const r1 = R("r1", 1, 1, "done");
  const r2 = R("r2", 2, 2, "playing");
  const entries = [
    E("r1", "a", { bid: 1, hit: true }),
    E("r1", "b", { bid: 0, hit: true }),
    E("r1", "c", { bid: 1, hit: false }),
    E("r2", "a", { bid: 1, hit: false }),
  ];
  const t = ftnTotals(cfg, players, [r1, r2], entries);
  assert.deepEqual(t.totals, { a: 11, b: 10, c: 0 });
  assert.equal(t.perRound.r2.a, null);
  assert.equal(t.hits.a, 1);
  assert.equal(t.played.c, 1);
});

test("free totals, target, ranking", () => {
  const rounds = [R("r1", 1), R("r2", 2)];
  const entries = [
    E("r1", "a", { points: 5 }), E("r1", "b", { points: 5 }), E("r1", "c", { points: 2 }),
    E("r2", "a", { points: -1 }), E("r2", "c", { points: 10 }),
  ];
  const totals = freeTotals(players, rounds, entries);
  assert.deepEqual(totals, { a: 4, b: 5, c: 12 });
  assert.equal(targetReached({ lowWins: false, target: 10 }, totals), true);
  assert.equal(targetReached({ lowWins: false, target: null }, totals), false);
  assert.deepEqual(rank(players, totals).map((x) => [x.player.id, x.rank]), [["c", 1], ["b", 2], ["a", 3]]);
  assert.deepEqual(
    rank(players, { a: 1, b: 1, c: 0 }).map((x) => x.rank),
    [1, 1, 3],
  );
  assert.equal(rank(players, totals, true)[0].player.id, "a");
});
