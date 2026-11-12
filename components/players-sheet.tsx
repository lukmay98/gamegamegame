"use client";

import { useState } from "react";
import { addPlayer, removePlayer, renamePlayer, swapSeats } from "@/lib/actions";
import type { Entry, Player } from "@/lib/games";
import { errorText } from "@/lib/supabase";
import { Sheet } from "./sheet";
import { ErrorBox } from "./ui";

export function PlayersSheet({
  open,
  onClose,
  sessionId,
  players,
  entries,
  me,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  players: Player[];
  entries: Entry[];
  me: string | null;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sorted = [...players].sort((a, b) => a.seat - b.seat);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Spieler">
      <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
        Reihenfolge = Sitzreihenfolge (wichtig für den Geber). Spieler mit Einträgen können nicht entfernt werden.
      </p>
      {error && <div className="mb-3"><ErrorBox>{error}</ErrorBox></div>}
      <ul className="flex flex-col gap-2 mb-4">
        {sorted.map((p, i) => {
          const used = entries.some((e) => e.player_id === p.id);
          return (
            <li key={p.id} className="card px-3 py-2 flex items-center gap-2">
              <span className="w-5 text-sm font-semibold tabular" style={{ color: "var(--color-text-muted)" }}>{i + 1}</span>
              {editing === p.id ? (
                <form
                  className="flex-1 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editName.trim()) void run(() => renamePlayer(p.id, editName)).then(() => setEditing(null));
                  }}
                >
                  <input className="input !py-1.5" value={editName} maxLength={30} autoFocus onChange={(e) => setEditName(e.target.value)} />
                  <button className="btn btn-primary !py-1.5">OK</button>
                </form>
              ) : (
                <button
                  className="flex-1 text-left font-semibold truncate"
                  onClick={() => {
                    setEditing(p.id);
                    setEditName(p.name);
                  }}
                >
                  {p.name}
                  {p.user_id === me && <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>(du)</span>}
                  {p.user_id && p.user_id !== me && <span className="ml-1.5 text-xs" aria-label="eigenes Gerät">📱</span>}
                </button>
              )}
              <button className="btn btn-ghost !p-0 w-8 h-8" aria-label="nach oben" disabled={i === 0} onClick={() => void run(() => swapSeats(p, sorted[i - 1]))}>↑</button>
              <button className="btn btn-ghost !p-0 w-8 h-8" aria-label="nach unten" disabled={i === sorted.length - 1} onClick={() => void run(() => swapSeats(p, sorted[i + 1]))}>↓</button>
              <button
                className="btn btn-ghost !p-0 w-8 h-8"
                aria-label="entfernen"
                disabled={used}
                onClick={() => {
                  if (confirm(`${p.name} entfernen?`)) void run(() => removePlayer(p.id));
                }}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = newName.trim();
          if (!n) return;
          const seat = (sorted.at(-1)?.seat ?? 0) + 1;
          void run(() => addPlayer(sessionId, n, seat)).then(() => setNewName(""));
        }}
      >
        <input className="input" placeholder="Neuer Spieler" value={newName} maxLength={30} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn btn-primary shrink-0" disabled={!newName.trim()}>Hinzufügen</button>
      </form>
    </Sheet>
  );
}
