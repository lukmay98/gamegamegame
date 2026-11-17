"use client";

import { useState } from "react";
import type { Player } from "@/lib/games";
import { euro, payouts, transfers } from "@/lib/games/settle";
import { Sheet } from "./sheet";

const PRESETS = [5, 10, 20, 50, 100];

/** „Spieltag abrechnen“: Betrag pro Punkt wählen → Zahlbeträge und wer wem zahlt. */
export function SettlePanel({ players, totals, lowWins }: { players: Player[]; totals: Record<string, number>; lowWins: boolean }) {
  const [rate, setRate] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const list = rate != null ? payouts(players, totals, rate, lowWins) : [];
  const moves = rate != null ? transfers(list) : [];

  return (
    <section className="mt-6">
      {rate == null ? (
        <button className="btn btn-accent w-full !py-3.5 text-base" onClick={() => setOpen(true)} disabled={players.length < 2}>
          💶 Spieltag abrechnen
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="font-display font-bold text-lg">
              Abrechnung
              <span className="text-sm font-normal ml-1.5" style={{ color: "var(--color-text-muted)" }}>· {euro(rate)} pro Punkt</span>
            </h2>
            <button className="text-xs font-semibold underline shrink-0" style={{ color: "var(--color-ink-soft)" }} onClick={() => setOpen(true)}>
              Betrag ändern
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm tabular border-collapse">
              <thead>
                <tr style={{ background: "var(--color-surface-soft)" }}>
                  <th className="px-3 py-2 text-left font-semibold w-10">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Spieler</th>
                  <th className="px-3 py-2 text-right font-semibold">Endstand</th>
                  <th className="px-3 py-2 text-right font-semibold">Zahlbetrag</th>
                </tr>
              </thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.player.id} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                    <td className="px-3 py-2" style={{ color: "var(--color-text-muted)" }}>{x.rank}.</td>
                    <td className="px-3 py-2 font-semibold truncate max-w-32">{x.player.name}</td>
                    <td className="px-3 py-2 text-right">{x.points}</td>
                    <td
                      className="px-3 py-2 text-right font-display font-bold whitespace-nowrap"
                      style={{ color: x.cents > 0 ? "var(--color-good)" : x.cents < 0 ? "var(--color-accent)" : "var(--color-text-muted)" }}
                    >
                      {euro(x.cents, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="font-display font-bold text-base mt-5 mb-2">Wer zahlt wem?</h3>
          {moves.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Niemand muss zahlen – alle gleichauf. 🤝</p>
          ) : (
            <ul className="card divide-y" style={{ borderColor: "var(--color-border)" }}>
              {moves.map((m, i) => (
                <li key={i} className="flex items-center gap-2 px-4 py-2.5 text-sm" style={{ borderColor: "var(--color-border)" }}>
                  <span className="font-semibold truncate" style={{ color: "var(--color-accent)" }}>{m.from.name}</span>
                  <span style={{ color: "var(--color-text-muted)" }}>zahlt an</span>
                  <span className="font-semibold truncate" style={{ color: "var(--color-good)" }}>{m.to.name}</span>
                  <span className="ml-auto font-display font-bold whitespace-nowrap">{euro(m.cents)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
            {moves.length} {moves.length === 1 ? "Zahlung" : "Zahlungen"} statt jeder an jeden. Wer bei Spielen gefehlt hat, zählt dort mit 0 Punkten.
          </p>
        </>
      )}

      {open && (
        <RateSheet
          initial={rate}
          onClose={() => setOpen(false)}
          onPick={(r) => {
            setRate(r);
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}

function RateSheet({ initial, onClose, onPick }: { initial: number | null; onClose: () => void; onPick: (cents: number) => void }) {
  const [cents, setCents] = useState<number>(initial ?? 10);
  const [custom, setCustom] = useState(initial != null && !PRESETS.includes(initial) ? (initial / 100).toFixed(2).replace(".", ",") : "");
  const [info, setInfo] = useState(false);

  return (
    <Sheet open onClose={onClose} title="Spieltag abrechnen">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="label !mb-0">Wie viel pro Punkt?</span>
        <button
          type="button"
          className="w-8 h-8 rounded-full border flex items-center justify-center font-display font-bold text-sm"
          style={{ borderColor: info ? "var(--color-ink)" : "var(--color-border)", background: info ? "var(--color-ink)" : "transparent", color: info ? "white" : "var(--color-ink)" }}
          aria-label="Wie wird gerechnet?"
          aria-expanded={info}
          onClick={() => setInfo((v) => !v)}
        >
          i
        </button>
      </div>

      {info && (
        <div className="card p-4 mb-4 text-sm leading-relaxed" style={{ background: "var(--color-surface-soft)" }}>
          <p className="font-semibold mb-1">So wird gerechnet</p>
          <p>
            Jeder rechnet mit jedem ab: Gegen jeden Mitspieler bekommst du die Punktedifferenz × Betrag pro Punkt, wenn du vorne liegst – oder du
            zahlst sie, wenn du hinten liegst.
          </p>
          <p className="mt-2">
            Kurz: <b>(Spieler × eigene Punkte − Summe aller Punkte) × Betrag</b>. Wer über dem Durchschnitt liegt, bekommt Geld, wer darunter liegt,
            zahlt. Alles zusammen ergibt genau 0 – das Geld wechselt nur den Besitzer.
          </p>
          <p className="mt-2">
            Beispiel mit 1 € pro Punkt: Der Erste hat 63, die anderen 62, 57, 56, 54 und 49 Punkte → 1 + 6 + 7 + 9 + 14 = <b>37 €</b>.
          </p>
          <p className="mt-2">Danach wird ausgerechnet, wer wem zahlt – mit möglichst wenigen Überweisungen.</p>
          <p className="mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
            🍻 Kleiner Hinweis am Rande: Der Entwickler freut sich jederzeit über Spenden. Ein Bier beim nächsten Spieleabend zählt auch.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`btn ${cents === p && !custom ? "btn-primary" : "btn-ghost"} !py-3`}
            onClick={() => {
              setCents(p);
              setCustom("");
            }}
          >
            {euro(p)}
          </button>
        ))}
        <input
          className="input text-center !py-3"
          inputMode="decimal"
          placeholder="eigener"
          aria-label="Eigener Betrag pro Punkt in Euro"
          value={custom}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9,.]/g, "").slice(0, 6);
            setCustom(v);
            const n = Math.round(parseFloat(v.replace(",", ".")) * 100);
            if (Number.isFinite(n) && n > 0) setCents(n);
          }}
          style={{ boxShadow: custom ? "0 0 0 2px var(--color-ink)" : undefined }}
        />
      </div>

      <button className="btn btn-accent w-full !py-3.5 text-base mt-5" disabled={!(cents > 0)} onClick={() => onPick(cents)}>
        Abrechnen · {euro(cents)} pro Punkt
      </button>
    </Sheet>
  );
}
