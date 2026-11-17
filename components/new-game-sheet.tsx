"use client";

import { useState } from "react";
import { createGame, setGameStatus } from "@/lib/actions";
import type { FreeConfig, FtnConfig, Game, GameId, Player } from "@/lib/games";
import { defaultFreeConfig } from "@/lib/games/free";
import { defaultFtnConfig, normalizeFtnConfig } from "@/lib/games/ftn";
import { errorText } from "@/lib/supabase";
import { effectiveFtn, FreeSettings, FtnSettings, overrideFrom } from "./game-settings";
import { Sheet } from "./sheet";
import { WriterPicker } from "./writer-picker";
import { ErrorBox } from "./ui";

/** Neue Partie im selben Spieltag – Regeln der letzten Partie sind vorausgewählt. */
export function NewGameSheet({
  open,
  onClose,
  sessionId,
  game,
  games,
  playerCount,
  onCreated,
  players,
  askWriter,
}: {
  players: Player[];
  askWriter: boolean;
  open: boolean;
  onClose: () => void;
  sessionId: string;
  game: GameId;
  games: Game[];
  playerCount: number;
  onCreated: (id: string | null) => void;
}) {
  if (!open) return null;
  return (
    <Sheet open onClose={onClose} title="Neues Spiel">
      <NewGameForm sessionId={sessionId} game={game} games={games} playerCount={playerCount} onCreated={onCreated} players={players} askWriter={askWriter} />
    </Sheet>
  );
}

function NewGameForm({
  sessionId,
  game,
  games,
  playerCount,
  onCreated,
  players,
  askWriter,
}: {
  players: Player[];
  askWriter: boolean;
  sessionId: string;
  game: GameId;
  games: Game[];
  playerCount: number;
  onCreated: (id: string | null) => void;
}) {
  const last = games.at(-1);
  const [ftnBase, setFtnBase] = useState<FtnConfig>(() =>
    last ? normalizeFtnConfig(last.config as Partial<FtnConfig>) : defaultFtnConfig(playerCount),
  );
  const [maxOverride, setMaxOverride] = useState<number | null>(() => overrideFrom(ftnBase, playerCount));
  const [free, setFree] = useState<FreeConfig>(() => (last ? { ...defaultFreeConfig(), ...(last.config as FreeConfig) } : defaultFreeConfig()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const number = (games.at(-1)?.number ?? 0) + 1;
  const [writer, setWriter] = useState<string | null>(last?.writer_player_id ?? null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const config = game === "ftn" ? effectiveFtn(ftnBase, maxOverride, playerCount) : free;
      for (const g of games) if (g.status === "active") await setGameStatus(g.id, "finished");
      onCreated(await createGame(sessionId, number, config, writer));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Spiel {number} übernimmt Spieler und Regeln des letzten Spiels. Du kannst sie hier anpassen – ein laufendes Spiel wird beendet,
        seine Punkte bleiben unverändert.
      </p>
      {game === "ftn" ? (
        <FtnSettings base={ftnBase} setFtn={(fn) => setFtnBase(fn)} maxOverride={maxOverride} setMaxOverride={setMaxOverride} playerCount={playerCount} />
      ) : (
        <FreeSettings free={free} setFree={(fn) => setFree(fn)} />
      )}
      {askWriter && <WriterPicker players={players} value={writer} onChange={setWriter} />}
      {error && <ErrorBox>{error}</ErrorBox>}
      <button className="btn btn-accent w-full !py-3.5 text-base" disabled={busy} onClick={() => void start()}>
        {busy ? "Startet …" : `Spiel ${number} starten`}
      </button>
    </div>
  );
}
