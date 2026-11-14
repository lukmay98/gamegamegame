"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { effectiveFtn, FreeSettings, FtnSettings, overrideFrom } from "@/components/game-settings";
import { ErrorBox, Page, Spinner, TopBar } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { GAMES, type FreeConfig, type FtnConfig, type GameId } from "@/lib/games";
import { defaultFtnConfig, normalizeFtnConfig } from "@/lib/games/ftn";
import { defaultFreeConfig } from "@/lib/games/free";
import { saveLastName, useLastName } from "@/lib/last-name";
import { ensureSignedIn, errorText, supabase } from "@/lib/supabase";

/** Vorlage aus dem letzten Spieltag eines Spielecodes. */
interface Template {
  game: GameId;
  names: string[];
  config: Partial<FtnConfig> | FreeConfig;
}

export default function NewSession() {
  const { loading, account } = useAccount();
  // undefined = lädt noch, null = keine Vorlage
  const [template, setTemplate] = useState<Template | null | undefined>(undefined);

  useEffect(() => {
    if (loading) return;
    if (!account) {
      Promise.resolve().then(() => setTemplate(null));
      return;
    }
    loadTemplate(account.id).then(setTemplate, () => setTemplate(null));
  }, [loading, account]);

  if (template === undefined) {
    return (
      <>
        <TopBar title={account ? "Neuer Spieltag" : "Neue Session"} back="/" />
        <Spinner />
      </>
    );
  }
  return <NewSessionForm template={template} isAccount={!!account} />;
}

async function loadTemplate(accountId: string): Promise<Template | null> {
  const sb = supabase();
  const { data: last } = await sb
    .from("sessions")
    .select("id, game, config")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return null;
  const [p, g] = await Promise.all([
    sb.from("players").select("name, seat").eq("session_id", last.id).order("seat"),
    sb.from("games").select("config").eq("session_id", last.id).order("number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    game: last.game as GameId,
    names: (p.data ?? []).map((x) => x.name as string),
    config: (g.data?.config ?? last.config ?? {}) as Template["config"],
  };
}

function NewSessionForm({ template, isAccount }: { template: Template | null; isAccount: boolean }) {
  const router = useRouter();
  const [game, setGame] = useState<GameId>(template?.game ?? "ftn");
  const [name, setName] = useState("");
  const storedName = useLastName();
  const [rawPlayers, setPlayers] = useState<string[]>(template && template.names.length > 0 ? template.names : ["", "", ""]);
  const [firstTouched, setFirstTouched] = useState(!!template && template.names.length > 0);
  const [ftnBase, setFtn] = useState<FtnConfig>(() =>
    template?.game === "ftn" ? normalizeFtnConfig(template.config as Partial<FtnConfig>) : defaultFtnConfig(3),
  );
  const [maxOverride, setMaxOverride] = useState<number | null>(() =>
    template?.game === "ftn" ? overrideFrom(normalizeFtnConfig(template.config as Partial<FtnConfig>), template.names.length) : null,
  );
  const [free, setFree] = useState<FreeConfig>(() =>
    template?.game === "free" ? { ...defaultFreeConfig(), ...(template.config as FreeConfig) } : defaultFreeConfig(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSignedIn().catch((e) => setError(errorText(e)));
  }, []);

  const noun = isAccount ? "Spieltag" : "Session";

  // Erster Spieler = du; vorbefüllt mit dem zuletzt verwendeten Namen
  const players = useMemo(
    () => (firstTouched ? rawPlayers : [storedName, ...rawPlayers.slice(1)]),
    [firstTouched, rawPlayers, storedName],
  );

  const names = useMemo(() => players.map((p) => p.trim()).filter(Boolean), [players]);
  const duplicate = new Set(names.map((n) => n.toLowerCase())).size !== names.length;
  const playerCount = Math.max(names.length, players.length, 1);
  // Kartenzahl folgt der Spielerzahl, solange sie nicht manuell geändert wurde
  const ftn = effectiveFtn(ftnBase, maxOverride, playerCount);

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

  return (
    <>
      <TopBar title={isAccount ? "Neuer Spieltag" : "Neue Session"} back="/" />
      <Page>
        {template && (
          <p className="text-sm mb-4 card px-4 py-3" style={{ background: "var(--color-surface-soft)" }}>
            ↺ Namen, Reihenfolge und Regeln vom letzten Spieltag übernommen – du kannst alles anpassen.
          </p>
        )}
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

        <label className="label" htmlFor="sname">Name {isAccount ? "des Spieltags" : "der Session"} (optional)</label>
        <input id="sname" className="input mb-6" placeholder="z. B. Freitagsrunde" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />

        <h2 className="label">Spieler in Sitzreihenfolge</h2>
        <p className="text-xs -mt-1 mb-2" style={{ color: "var(--color-text-muted)" }}>
          Der erste Name bist du. Mitspieler können per Code oder QR live zusehen.
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
          <div className="mt-6">
            <FtnSettings base={ftnBase} setFtn={setFtn} maxOverride={maxOverride} setMaxOverride={setMaxOverride} playerCount={playerCount} />
          </div>
        ) : (
          <div className="mt-6">
            <FreeSettings free={free} setFree={setFree} />
          </div>
        )}

        {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}

        <div className="fixed bottom-0 left-0 right-0 p-4" style={{ background: "linear-gradient(transparent, var(--color-bg) 30%)" }}>
          <div className="max-w-lg mx-auto">
            <button className="btn btn-accent w-full !py-3.5 text-base" disabled={busy || names.length < 1 || !players[0].trim() || duplicate} onClick={create}>
              {busy ? "Wird erstellt …" : `${noun} starten`}
            </button>
          </div>
        </div>
      </Page>
    </>
  );
}
