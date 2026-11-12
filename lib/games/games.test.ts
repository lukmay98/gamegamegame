import { test } from "node:test";
import assert from "node:assert/strict";
import {
  biddingOrder,
  cardPlan,
  cardsForRound,
  dealerForRound,
  defaultFtnConfig,
  forbiddenDealerBid,
  ftnTotals,
  FTN_PRESETS,
  maxCardsFor,
  roundState,
  scoreFtn,
} from "./ftn.ts";
import { freeTotals, targetReached } from "./free.ts";
import { rank } from "./ranking.ts";
import type { Entry, Player, Round } from "./types.ts";

const P = (id: string, seat: number): Player => ({ id, seat, name: id, session_id: "s", user_id: null });
const players = [P("a", 1), P("b", 2), P("c", 3)];
const R = (id: string, n: number, cards: number | null = null): Round => ({
  id, round_number: n, cards, session_id: "s", dealer_player_id: null, created_at: "",
});
const E = (round_id: string, player_id: string, x: Partial<Entry>): Entry => ({
  round_id, player_id, session_id: "s", bid: null, tricks: null, points: null, ...x,
});

test("card plan up-down", () => {
  assert.deepEqual(cardPlan({ maxCards: 4, sequence: "up-down" }), [1, 2, 3, 4, 3, 2, 1]);
  assert.deepEqual(cardPlan({ maxCards: 3, sequence: "down" }), [3, 2, 1]);
  assert.deepEqual(cardPlan({ maxCards: 1, sequence: "up-down" }), [1]);
  const cfg = { ...defaultFtnConfig(4), maxCards: 3 };
  assert.equal(cardsForRound(cfg, 3), 3);
  assert.equal(cardsForRound(cfg, 5), 1);
  assert.equal(cardsForRound(cfg, 99), 1);
});

test("max cards", () => {
  assert.equal(maxCardsFor(4), 13);
  assert.equal(maxCardsFor(5), 10);
  assert.equal(maxCardsFor(6), 8);
  assert.equal(maxCardsFor(13), 4);
});

test("scoring presets", () => {
  const c = FTN_PRESETS.classic.scoring;
  assert.equal(scoreFtn(0, 0, c), 10);
  assert.equal(scoreFtn(3, 3, c), 13);
  assert.equal(scoreFtn(3, 1, c), 0);
  const w = FTN_PRESETS.wizard.scoring;
  assert.equal(scoreFtn(2, 2, w), 40);
  assert.equal(scoreFtn(2, 5, w), -30);
  const e = FTN_PRESETS.everyTrick.scoring;
  assert.equal(scoreFtn(2, 3, e), 3);
  assert.equal(scoreFtn(2, 2, e), 12);
});

test("dealer rule", () => {
  assert.equal(forbiddenDealerBid(3, [1, 1]), 1);
  assert.equal(forbiddenDealerBid(3, [2, 2]), null);
  assert.equal(forbiddenDealerBid(3, [0, 0]), 3);
});

test("dealer rotation and bidding order", () => {
  assert.equal(dealerForRound(players, 1)?.id, "a");
  assert.equal(dealerForRound(players, 4)?.id, "a");
  assert.equal(dealerForRound(players, 2)?.id, "b");
  assert.deepEqual(biddingOrder(players, "b").map((p) => p.id), ["c", "a", "b"]);
});

test("round state and totals", () => {
  const cfg = defaultFtnConfig(3);
  const r1 = R("r1", 1, 1);
  const r2 = R("r2", 2, 2);
  const entries = [
    E("r1", "a", { bid: 1, tricks: 1 }),
    E("r1", "b", { bid: 0, tricks: 0 }),
    E("r1", "c", { bid: 1, tricks: 0 }),
    E("r2", "a", { bid: 1 }),
  ];
  assert.equal(roundState(r1, players, entries), "done");
  assert.equal(roundState(r2, players, entries), "bidding");
  const t = ftnTotals(cfg, players, [r1, r2], entries);
  assert.deepEqual(t.totals, { a: 11, b: 10, c: 0 });
  assert.equal(t.perRound.r2.a, null);
  assert.equal(t.hits.a, 1);
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
