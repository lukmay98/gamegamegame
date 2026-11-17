"use client";

import { useState } from "react";
import type { Player } from "@/lib/games";
import { Sheet } from "./sheet";
import { WriterPicker } from "./writer-picker";

/** Nach „Spiel beenden“: noch ein Spiel oder abrechnen? */
export function HomeSheet({
  open,
  players,
  askWriter,
  lastWriterId,
  onAnother,
  onSettle,
  onClose,
}: {
  open: boolean;
  players: Player[];
  askWriter: boolean;
  lastWriterId: string | null;
  onAnother: (writerId: string | null) => Promise<void>;
  onSettle: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"ask" | "writer">("ask");
  const [writer, setWriter] = useState<string | null>(lastWriterId);
  const [busy, setBusy] = useState(false);

  async function another(w: string | null) {
    setBusy(true);
    await onAnother(w);
    setBusy(false);
    setStep("ask");
  }

  return (
    <Sheet open={open} onClose={onClose} title="Wird schon heim gegangen? 🏠">
      {step === "ask" ? (
        <div className="flex flex-col gap-2">
          <button
            className="btn btn-accent w-full !py-3.5 text-base"
            disabled={busy}
            onClick={() => (askWriter ? setStep("writer") : void another(lastWriterId))}
          >
            {busy ? "Startet …" : "Nein, noch eine Runde 🃏"}
          </button>
          <button className="btn btn-ghost w-full !py-3.5 text-base" disabled={busy} onClick={onSettle}>
            Ja, jetzt wird abgerechnet 💶
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <WriterPicker players={players} value={writer} onChange={setWriter} />
          <button className="btn btn-accent w-full !py-3.5 text-base" disabled={busy || !writer} onClick={() => void another(writer)}>
            {busy ? "Startet …" : "Neues Spiel starten"}
          </button>
        </div>
      )}
    </Sheet>
  );
}
