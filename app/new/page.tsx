"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ErrorBox, Page, Stepper, Toggle, TopBar } from "@/components/ui";
import { GAMES, type FreeConfig, type FtnConfig, type FtnScoring, type FtnSequence, type GameId } from "@/lib/games";
import { cardPlan, DEALER_MODES, defaultFtnConfig, FTN_PRESETS, maxCardsFor } from "@/lib/games/ftn";
import { defaultFreeConfig } from "@/lib/games/free";
import { saveLastName, useLastName } from "@/lib/last-name";
import { ensureSignedIn, errorText, supabase } from "@/lib/supabase";

const SEQUENCES: { id: FtnSequence; label: string }[] = [
  { id: "up-down", label: "Rauf & runter" },
  { id: "up", label: "Nur rauf" },
  { id: "down", label: "Nur runter" },
  { id: "constant", label: "Immer gleich" },
];

export default function NewSession() {
  const router = useRouter();
  const [game, setGame] = useState<GameId>("ftn");
  const [name, setName] = useState("");
  const storedName = useLastName();
  const [rawPlayers, setPlayers] = useState<string[]>(["", "", ""]);
  const [firstTouched, setFirstTouched] = useState(false);
  const [ftnBase, setFtn] = useState<FtnConfig>(defaultFtnConfig(3));
  const [maxOverride, setMaxOverride] = useState<number | null>(null);
  const [deckInput, setDeckInput] = useState(String(ftnBase.deckSize));
  const [free, setFree] = useState<FreeConfig>(defaultFreeConfig());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSignedIn().catch((e) => setError(errorText(e)));
  }, []);

  // Erster Spieler = du; vorbefüllt mit dem zuletzt verwendeten Namen
  const players = useMemo(
    () => (firstTouched ? rawPlayers : [storedName, ...rawPlayers.slice(1)]),
    [firstTouched, rawPlayers, storedName],
  );

  const names = useMemo(() => players.map((p) => p.trim()).filter(Boolean), [players]);
  const duplicate = new Set(names.map((n) => n.toLowerCase())).size !== names.length;
  const playerCount = Math.max(names.length, players.length, 1);
  const maxPossible = maxCardsFor(playerCount, ftnBase.deckSize);

  // Kartenzahl folgt der Spielerzahl, solange sie nicht manuell geändert wurde
  const ftn: FtnConfig = {
    ...ftnBase,
    maxCards: maxOverride != null ? Math.min(maxOverride, maxPossible) : maxPossible,
  };

  const plan = cardPlan(ftn);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await ensureSignedIn();
      saveLastName(names[0]);
      const { data, error } = await supabase().rpc("create_session", {
        p_name: name.trim() || `${GAMES[game].short} ${new Date().toLocaleDateString("de-AT")}`,
        p_game: game,
        p_config: game === "ftn" ? ftn : free,
        p_players: names,
      });
      if (error) throw error;
      router.push(`/s/${data as string}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const setScoring = (patch: Partial<FtnScoring>) =>
    setFtn((c) => ({ ...c, scoringPreset: "custom", scoring: { ...c.scoring, ...patch } }));

  return (
    <>
      <TopBar title="Neue Session" back="/" />
      <Page>
        <h2 className="label">Spiel</h2>
        <div className="grid gap-2 mb-6">
          {(Object.keys(GAMES) as GameId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setGame(id)}
              className="card text-left px-4 py-3 flex gap-3 items-start"
              style={{ borderColor: game === id ? "var(--color-ink)" : undefined, borderWidth: game === id ? 2 : 1 }}
            >
              <span className="text-2xl" aria-hidden>{GAMES[id].emoji}</span>
              <span>
                <span className="block font-semibold">{GAMES[id].label}</span>
                <span className="block text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{GAMES[id].description}</span>
              </span>
            </button>
          ))}
        </div>

        <label className="label" htmlFor="sname">Name der Session (optional)</label>
        <input id="sname" className="input mb-6" placeholder="z. B. Freitagsrunde" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />

        <h2 className="label">Spieler in Sitzreihenfolge</h2>
        <p className="text-xs -mt-1 mb-2" style={{ color: "var(--color-text-muted)" }}>
          Der erste Name bist du. Mitspieler können später auch selbst per Code beitreten.
        </p>
        <div className="flex flex-col gap-2 mb-2">
          {players.map((p, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="w-6 text-center text-sm font-semibold tabular" style={{ color: "var(--color-text-muted)" }}>{i + 1}</span>
              <input
                className="input"
                placeholder={i === 0 ? "Dein Name" : `Spieler ${i + 1}`}
                value={p}
                maxLength={30}
                onChange={(e) => {
                  if (i === 0) setFirstTouched(true);
                  setPlayers(players.map((x, j) => (j === i ? e.target.value : x)));
                }}
              />
              {players.length > 1 && i > 0 && (
                <button type="button" className="btn btn-ghost !px-3" aria-label="Spieler entfernen" onClick={() => {
                  setFirstTouched(true);
                  setPlayers(players.filter((_, j) => j !== i));
                }}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-soft w-full mb-1" onClick={() => {
          setFirstTouched(true);
          setPlayers([...players, ""]);
        }} disabled={players.length >= 12}>
          ＋ Spieler
        </button>
        {duplicate && <p className="text-xs mt-1" style={{ color: "var(--color-accent)" }}>Jeder Name darf nur einmal vorkommen.</p>}

        {game === "ftn" ? (
          <section className="card p-4 mt-6 flex flex-col gap-5">
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
                onBlur={() => setDeckInput(String(ftnBase.deckSize))}
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
              <div className="label">Nächster Geber</div>
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
                Das ist nur der Vorschlag – in jeder Runde kann der Geber per Antippen geändert werden.
              </p>
            </div>

            <Toggle
              checked={ftn.dealerRule}
              onChange={(v) => setFtn((c) => ({ ...c, dealerRule: v }))}
              label="Geber-Regel"
              hint="Der Geber sagt zuletzt an und darf nicht so ansagen, dass alle Ansagen zusammen genau die Kartenzahl ergeben."
            />
          </section>
        ) : (
          <section className="card p-4 mt-6 flex flex-col gap-5">
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
        )}

        {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}

        <div className="fixed bottom-0 left-0 right-0 p-4" style={{ background: "linear-gradient(transparent, var(--color-bg) 30%)" }}>
          <div className="max-w-lg mx-auto">
            <button className="btn btn-accent w-full !py-3.5 text-base" disabled={busy || names.length < 1 || !players[0].trim() || duplicate} onClick={create}>
              {busy ? "Wird erstellt …" : "Session starten"}
            </button>
          </div>
        </div>
      </Page>
    </>
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
