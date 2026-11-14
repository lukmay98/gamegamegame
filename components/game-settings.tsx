"use client";

import { useState } from "react";
import type { FreeConfig, FtnConfig, FtnScoring, FtnSequence } from "@/lib/games";
import { cardPlan, DEALER_MODES, FTN_PRESETS, maxCardsFor } from "@/lib/games/ftn";
import { Stepper, Toggle } from "./ui";

const SEQUENCES: { id: FtnSequence; label: string }[] = [
  { id: "up-down", label: "Rauf & runter" },
  { id: "up", label: "Nur rauf" },
  { id: "down", label: "Nur runter" },
  { id: "constant", label: "Immer gleich" },
];

/** Höchste Kartenzahl: manuell gesetzter Wert (gedeckelt) oder das Maximum. */
export function effectiveFtn(base: FtnConfig, maxOverride: number | null, playerCount: number): FtnConfig {
  const maxPossible = maxCardsFor(playerCount, base.deckSize);
  return { ...base, maxCards: maxOverride != null ? Math.min(maxOverride, maxPossible) : maxPossible };
}

/** Vorbelegung für "manuell geändert", wenn eine bestehende Config übernommen wird. */
export function overrideFrom(config: FtnConfig, playerCount: number): number | null {
  return config.maxCards < maxCardsFor(playerCount, config.deckSize) ? config.maxCards : null;
}

export function FtnSettings({
  base,
  setFtn,
  maxOverride,
  setMaxOverride,
  playerCount,
}: {
  base: FtnConfig;
  setFtn: (fn: (c: FtnConfig) => FtnConfig) => void;
  maxOverride: number | null;
  setMaxOverride: (v: number | null) => void;
  playerCount: number;
}) {
  const [deckInput, setDeckInput] = useState(String(base.deckSize));
  const ftn = effectiveFtn(base, maxOverride, playerCount);
  const maxPossible = maxCardsFor(playerCount, base.deckSize);
  const plan = cardPlan(ftn);
  const setScoring = (patch: Partial<FtnScoring>) =>
    setFtn((c) => ({ ...c, scoringPreset: "custom", scoring: { ...c.scoring, ...patch } }));

  return (
          <section className="card p-4 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="decksize">
                <span className="block text-sm font-semibold">Karten im Spiel</span>
                <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>z. B. 36, 52 oder 104 (zwei Pakete)</span>
              </label>
              <input
                id="decksize"
                className="input !w-24 text-center font-display font-bold text-lg tabular"
                inputMode="numeric"
                value={deckInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                  setDeckInput(raw);
                  const n = parseInt(raw, 10);
                  if (Number.isFinite(n) && n >= 1) setFtn((c) => ({ ...c, deckSize: n }));
                }}
                onBlur={() => setDeckInput(String(base.deckSize))}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Höchste Kartenzahl</div>
                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  max. {maxPossible} bei {playerCount} Spielern ({ftn.deckSize} Karten)
                </div>
              </div>
              <Stepper
                value={ftn.maxCards}
                min={1}
                max={maxPossible}
                onChange={setMaxOverride}
              />
            </div>

            <div>
              <div className="label">Ablauf</div>
              <div className="grid grid-cols-2 gap-2">
                {SEQUENCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`btn ${ftn.sequence === s.id ? "btn-primary" : "btn-ghost"} !py-2 text-sm`}
                    onClick={() => setFtn((c) => ({ ...c, sequence: s.id }))}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {ftn.sequence !== "constant" && (
                <div className="mt-3">
                  <Toggle
                    checked={ftn.peakTwice}
                    onChange={(v) => setFtn((c) => ({ ...c, peakTwice: v }))}
                    label="Höchste Runde zweimal spielen"
                    hint={`Die Runde mit ${ftn.maxCards} Karten wird doppelt gespielt.`}
                  />
                </div>
              )}
              <p className="text-xs mt-3 tabular" style={{ color: "var(--color-text-muted)" }}>
                {plan.length} Runden: {plan.join(" · ")}
              </p>
            </div>

            <div>
              <div className="label">Punkte</div>
              <div className="flex flex-col gap-2">
                {Object.entries(FTN_PRESETS).map(([id, p]) => (
                  <button
                    key={id}
                    type="button"
                    className="text-left rounded-xl px-3 py-2.5 border"
                    style={{
                      borderColor: ftn.scoringPreset === id ? "var(--color-ink)" : "var(--color-border)",
                      background: ftn.scoringPreset === id ? "var(--color-surface-soft)" : "transparent",
                    }}
                    onClick={() => setFtn((c) => ({ ...c, scoringPreset: id, scoring: p.scoring }))}
                  >
                    <span className="block text-sm font-semibold">{p.label}</span>
                    <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>{p.hint}</span>
                  </button>
                ))}
              </div>
              <details className="mt-3" open={ftn.scoringPreset === "custom"}>
                <summary className="text-sm font-semibold cursor-pointer" style={{ color: "var(--color-ink-soft)" }}>
                  Eigene Regel {ftn.scoringPreset === "custom" && "· aktiv"}
                </summary>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <NumField label="Treffer: Grundpunkte" value={ftn.scoring.hitBase} onChange={(v) => setScoring({ hitBase: v })} />
                  <NumField label="Treffer: + pro Stich" value={ftn.scoring.hitPerTrick} onChange={(v) => setScoring({ hitPerTrick: v })} />
                  <NumField label="Daneben: − pro Abweichung" value={ftn.scoring.missPerOff} onChange={(v) => setScoring({ missPerOff: v })} />
                  <NumField label="Daneben: + pro Stich" value={ftn.scoring.missPerTrick} onChange={(v) => setScoring({ missPerTrick: v })} />
                </div>
              </details>
            </div>

            <div>
              <div className="label">Null-Ansage getroffen</div>
              <div className="flex flex-wrap gap-2">
                {[null, 5, 10, 20].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    className={`btn ${ftn.zeroHit === v ? "btn-primary" : "btn-ghost"} !py-2 !px-3 text-sm`}
                    onClick={() => setFtn((c) => ({ ...c, zeroHit: v }))}
                  >
                    {v == null ? `Normal (${ftn.scoring.hitBase})` : `${v} Punkte`}
                  </button>
                ))}
                <input
                  className="input !w-24 !py-2 text-sm tabular"
                  inputMode="numeric"
                  placeholder="eigene"
                  aria-label="Eigene Punkte für Null-Ansage"
                  value={ftn.zeroHit != null && ![5, 10, 20].includes(ftn.zeroHit) ? ftn.zeroHit : ""}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                    setFtn((c) => ({ ...c, zeroHit: Number.isFinite(n) ? n : null }));
                  }}
                />
              </div>
            </div>

            <div>
              <div className="label">Erster Geber eines Spiels</div>
              <div className="flex flex-col gap-2">
                {DEALER_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="text-left rounded-xl px-3 py-2.5 border"
                    style={{
                      borderColor: ftn.dealerMode === m.id ? "var(--color-ink)" : "var(--color-border)",
                      background: ftn.dealerMode === m.id ? "var(--color-surface-soft)" : "transparent",
                    }}
                    onClick={() => setFtn((c) => ({ ...c, dealerMode: m.id }))}
                  >
                    <span className="block text-sm font-semibold">{m.label}</span>
                    <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>{m.hint}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                Innerhalb eines Spiels geht der Geber reihum nach Sitzordnung. Im ersten Spiel des Spieltags beginnt der erste Platz.
                Der Geber lässt sich jederzeit unten über „Geber ändern“ anpassen.
              </p>
            </div>

            <Toggle
              checked={ftn.dealerRule}
              onChange={(v) => setFtn((c) => ({ ...c, dealerRule: v }))}
              label="Geber-Regel"
              hint="Der Geber sagt zuletzt an und darf nicht so ansagen, dass alle Ansagen zusammen genau die Kartenzahl ergeben."
            />
          </section>
  );
}

export function FreeSettings({ free, setFree }: { free: FreeConfig; setFree: (fn: (c: FreeConfig) => FreeConfig) => void }) {
  return (
          <section className="card p-4 flex flex-col gap-5">
            <Toggle
              checked={free.lowWins}
              onChange={(v) => setFree((c) => ({ ...c, lowWins: v }))}
              label="Wenigste Punkte gewinnen"
              hint="z. B. für Strafpunkte-Spiele wie Uno"
            />
            <div>
              <label className="label" htmlFor="target">Zielpunktzahl (optional)</label>
              <input
                id="target"
                className="input"
                inputMode="numeric"
                placeholder="z. B. 500"
                value={free.target ?? ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                  setFree((c) => ({ ...c, target: Number.isFinite(n) ? n : null }));
                }}
              />
            </div>
          </section>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input tabular"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
    </label>
  );
}
