"use client";

import { db } from "./supabase";
import type { Entry } from "./games/types";

type EntryPatch = Pick<Entry, "round_id" | "player_id" | "session_id"> &
  Partial<Pick<Entry, "bid" | "tricks" | "points">>;

/** Ein Feld (Ansage, Stiche oder Punkte) eines Spielers in einer Runde setzen. */
export async function saveEntry(patch: EntryPatch) {
  const { error } = await (await db())
    .from("entries")
    .upsert({ ...patch, updated_at: new Date().toISOString() }, { onConflict: "round_id,player_id" });
  if (error) throw error;
}

export async function saveEntries(patches: EntryPatch[]) {
  if (patches.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await (await db())
    .from("entries")
    .upsert(patches.map((p) => ({ ...p, updated_at: now })), { onConflict: "round_id,player_id" });
  if (error) throw error;
}

/**
 * Neue Runde anlegen. Wenn zwei Geräte gleichzeitig tippen, gewinnt eines;
 * das andere bekommt einen Duplikat-Fehler, den wir ignorieren.
 */
export async function createRound(sessionId: string, roundNumber: number, cards: number | null, dealerId: string | null) {
  const { data, error } = await (await db())
    .from("rounds")
    .insert({ session_id: sessionId, round_number: roundNumber, cards, dealer_player_id: dealerId })
    .select("id")
    .single();
  if (error && error.code !== "23505") throw error;
  return (data?.id as string | undefined) ?? null;
}

export async function deleteRound(roundId: string) {
  const { error } = await (await db()).from("rounds").delete().eq("id", roundId);
  if (error) throw error;
}

export async function addPlayer(sessionId: string, name: string, seat: number) {
  const { error } = await (await db()).from("players").insert({ session_id: sessionId, name: name.trim(), seat });
  if (error) throw error;
}

export async function renamePlayer(playerId: string, name: string) {
  const { error } = await (await db()).from("players").update({ name: name.trim() }).eq("id", playerId);
  if (error) throw error;
}

export async function removePlayer(playerId: string) {
  const { error } = await (await db()).from("players").delete().eq("id", playerId);
  if (error) throw error;
}

export async function swapSeats(a: { id: string; seat: number }, b: { id: string; seat: number }) {
  const sb = await db();
  const r1 = await sb.from("players").update({ seat: b.seat }).eq("id", a.id);
  if (r1.error) throw r1.error;
  const r2 = await sb.from("players").update({ seat: a.seat }).eq("id", b.id);
  if (r2.error) throw r2.error;
}

export async function setSessionStatus(sessionId: string, status: "active" | "finished") {
  const { error } = await (await db())
    .from("sessions")
    .update({ status, finished_at: status === "finished" ? new Date().toISOString() : null })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function leaveSession(sessionId: string, userId: string) {
  const { error } = await (await db()).from("session_members").delete().eq("session_id", sessionId).eq("user_id", userId);
  if (error) throw error;
}

/** Session für alle löschen (nur wer sie angelegt hat; per RLS abgesichert). */
export async function deleteSession(sessionId: string) {
  const { data, error } = await (await db()).from("sessions").delete().eq("id", sessionId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Nur wer die Session angelegt hat, kann sie für alle löschen.");
}

export async function updateRound(roundId: string, patch: { phase?: "bidding" | "playing" | "done"; dealer_player_id?: string | null }) {
  const { error } = await (await db()).from("rounds").update(patch).eq("id", roundId);
  if (error) throw error;
}

/** Ansagen wieder öffnen: Runde zurück auf "bidding", Treffer-Markierungen löschen. */
export async function reopenBids(roundId: string) {
  const sb = await db();
  const r1 = await sb.from("entries").update({ hit: null, tricks: null }).eq("round_id", roundId);
  if (r1.error) throw r1.error;
  const r2 = await sb.from("rounds").update({ phase: "bidding" }).eq("id", roundId);
  if (r2.error) throw r2.error;
}

/** Runde abschließen: alle nicht als "daneben" markierten Ansagen zählen als getroffen. */
export async function finishRound(roundId: string) {
  const sb = await db();
  const r1 = await sb.from("entries").update({ hit: true }).eq("round_id", roundId).is("hit", null).not("bid", "is", null);
  if (r1.error) throw r1.error;
  const r2 = await sb.from("rounds").update({ phase: "done" }).eq("id", roundId);
  if (r2.error) throw r2.error;
}
