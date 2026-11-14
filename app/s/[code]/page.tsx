"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FreeBoard } from "@/components/free-board";
import { EveningBoard } from "@/components/evening-board";
import { NewGameSheet } from "@/components/new-game-sheet";
import { FtnBoard } from "@/components/ftn-board";
import { PlayersSheet } from "@/components/players-sheet";
import { ShareSheet } from "@/components/share-sheet";
import { Sheet } from "@/components/sheet";
import { ErrorBox, Page, Spinner, TopBar } from "@/components/ui";
import { deleteSession, leaveSession, saveEntry, setSessionStatus } from "@/lib/actions";
import { GAMES, type Entry, type GameId, type Player, type Round } from "@/lib/games";
import { ensureSignedIn, errorText, supabase } from "@/lib/supabase";
import { useLiveSession } from "@/lib/use-live-session";

interface Preview {
  name: string;
  game: GameId;
  status: string;
  is_member: boolean;
  players: { name: string; claimed: boolean }[];
}

export default function SessionPage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = (rawCode ?? "").toUpperCase();
  const [me, setMe] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const uid = await ensureSignedIn();
      setMe(uid);
      const { data, error } = await supabase().rpc("session_preview", { p_code: code });
      if (error) throw error;
      const p = (data ?? null) as Preview | null;
      setPreview(p);
      if (!p) return;
      if (p.is_member) {
        const { data: s, error: e2 } = await supabase().from("sessions").select("id").eq("code", code).single();
        if (e2) throw e2;
        setSessionId(s.id as string);
      } else {
        // Per Code/QR beitreten = live zusehen
        const { data: id, error: e3 } = await supabase().rpc("join_session", { p_code: code });
        if (e3) throw e3;
        setSessionId(id as string);
      }
    })().catch((e) => setError(errorText(e)));
  }, [code]);

  if (error) {
    return (
      <>
        <TopBar title={code} back="/" />
        <Page><ErrorBox>{error}</ErrorBox></Page>
      </>
    );
  }
  if (preview === undefined || (preview && !sessionId)) {
    return (
      <>
        <TopBar title={code} back="/" />
        <Spinner />
      </>
    );
  }
  if (preview === null) {
    return (
      <>
        <TopBar title={code} back="/" />
        <Page>
          <div className="text-center py-10">
            <div className="text-4xl mb-3">🤷</div>
            <h1 className="font-display font-bold text-xl">Keine Session mit Code {code}</h1>
            <p className="text-sm mt-2 mb-6" style={{ color: "var(--color-text-muted)" }}>Code vertippt? Frag nochmal nach.</p>
            <Link href="/" className="btn btn-primary">Zur Startseite</Link>
          </div>
        </Page>
      </>
    );
  }
  return <SessionView sessionId={sessionId as string} me={me} />;
}

function SessionView({ sessionId, me }: { sessionId: string; me: string | null }) {
  const router = useRouter();
  const { data, error, connected, refresh, setData } = useLiveSession(sessionId);
  const [share, setShare] = useState(false);
  const [menu, setMenu] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // null = neueste Partie, "evening" = Abend-Gesamtstand, sonst Game-ID
  const [tab, setTab] = useState<string | null>(null);
  const [newGame, setNewGame] = useState(false);

  // Optimistisch lokal setzen, dann speichern; Realtime gleicht danach ab.
  const saveFtn = useCallback(
    (round: Round, player: Player, patch: Partial<Pick<Entry, "bid" | "tricks" | "hit">>) => {
      setData((d) => {
        if (!d) return d;
        const idx = d.entries.findIndex((e) => e.round_id === round.id && e.player_id === player.id);
        const entries = [...d.entries];
        if (idx >= 0) entries[idx] = { ...entries[idx], ...patch };
        else entries.push({ round_id: round.id, player_id: player.id, session_id: round.session_id, bid: null, tricks: null, hit: null, points: null, ...patch });
        return { ...d, entries };
      });
      saveEntry({ round_id: round.id, player_id: player.id, session_id: round.session_id, ...patch })
        .then(() => setSaveError(null))
        .catch((e) => {
          setSaveError(errorText(e));
          void refresh();
        });
    },
    [setData, refresh],
  );

  const patchLocal = useCallback(
    (roundId: string, roundPatch: Partial<Round>, entryPatch?: (e: Entry) => Entry) => {
      setData((d) =>
        d
          ? {
              ...d,
              rounds: d.rounds.map((r) => (r.id === roundId ? { ...r, ...roundPatch } : r)),
              entries: entryPatch ? d.entries.map((e) => (e.round_id === roundId ? entryPatch(e) : e)) : d.entries,
            }
          : d,
      );
    },
    [setData],
  );

  if (error && !data) {
    return (
      <>
        <TopBar title="Session" back="/" />
        <Page><ErrorBox>{error}</ErrorBox></Page>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <TopBar title="Session" back="/" />
        <Spinner />
      </>
    );
  }

  const { session, games } = data;
  const finished = session.status === "finished";
  const viewer = !data.canEdit;
  const game = games.find((g) => g.id === tab) ?? games.at(-1) ?? null;
  const showEvening = tab === "evening" && games.length > 0;
  // Ansicht nur auf die gewählte Partie beschränken
  const gameRounds = game ? data.rounds.filter((r) => r.game_id === game.id) : [];
  const gameRoundIds = new Set(gameRounds.map((r) => r.id));
  const gameLive = { ...data, rounds: gameRounds, entries: data.entries.filter((e) => gameRoundIds.has(e.round_id)) };

  return (
    <>
      <TopBar
        back="/"
        title={
          <span className="flex items-center gap-2">
            <span className="truncate">{session.name}</span>
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              title={connected ? "Live verbunden" : "Verbinde …"}
              style={{ background: connected ? "#5ad18a" : "#e0b04a" }}
            />
          </span>
        }
        right={
          <div className="flex items-center gap-1.5">
            <button className="chip font-display tracking-widest !text-[13px] !py-1" style={{ background: "rgb(255 255 255 / .14)", color: "white" }} onClick={() => setShare(true)}>
              {session.code}
            </button>
            <button className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Menü" onClick={() => setMenu(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
            </button>
          </div>
        }
      />
      <Page>
        <div className="flex items-center justify-between mb-4">
          <span className="chip" style={{ background: "var(--color-surface-soft)", color: "var(--color-ink)" }}>
            {GAMES[session.game]?.emoji} {GAMES[session.game]?.label}
          </span>
          {!finished && (
            <button className="text-sm font-semibold underline" style={{ color: "var(--color-ink-soft)" }} onClick={() => setShare(true)}>
              Mitspieler einladen
            </button>
          )}
        </div>

        {viewer && (
          <p className="card px-4 py-2.5 mb-4 text-sm flex items-center gap-2" style={{ background: "var(--color-surface-soft)" }}>
            <span aria-hidden>👀</span>
            <span>Du siehst live zu – eintragen kann nur, wer den Spieltag erstellt hat.</span>
          </p>
        )}

        {(saveError || error) && <div className="mb-3"><ErrorBox>{saveError ?? error}</ErrorBox></div>}

        {games.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-4" role="tablist" aria-label="Partien">
            {games.map((g) => {
              const sel = !showEvening && g.id === game?.id;
              return (
                <button
                  key={g.id}
                  role="tab"
                  aria-selected={sel}
                  className="chip shrink-0 !py-1.5"
                  style={sel ? { background: "var(--color-ink)", color: "white" } : { background: "var(--color-surface-soft)", color: "var(--color-ink)" }}
                  onClick={() => setTab(g.id)}
                >
                  Partie {g.number}
                  {g.status === "finished" ? " ✓" : " · läuft"}
                </button>
              );
            })}
            <button
              role="tab"
              aria-selected={showEvening}
              className="chip shrink-0 !py-1.5"
              style={showEvening ? { background: "var(--color-accent)", color: "white" } : { background: "var(--color-accent-soft)", color: "var(--color-ink)" }}
              onClick={() => setTab("evening")}
            >
              Σ Abend
            </button>
          </div>
        )}

        {showEvening ? (
          <EveningBoard live={data} me={me} onSelectGame={setTab} />
        ) : !game ? (
          <Spinner />
        ) : session.game === "ftn" ? (
          <FtnBoard
            key={game.id}
            live={gameLive}
            game={game}
            onNewGame={() => setNewGame(true)}
            me={me}
            save={saveFtn}
            refresh={() => void refresh()}
            onOpenPlayers={() => setPlayersOpen(true)}
            patchLocal={patchLocal}
            viewer={viewer}
          />
        ) : (
          <FreeBoard key={game.id} live={gameLive} game={game} onNewGame={() => setNewGame(true)} me={me} refresh={() => void refresh()} viewer={viewer} />
        )}
      </Page>

      <NewGameSheet
        open={newGame}
        onClose={() => setNewGame(false)}
        sessionId={session.id}
        game={session.game}
        games={games}
        playerCount={data.players.length}
        onCreated={(id) => {
          setNewGame(false);
          setTab(id);
          void refresh();
        }}
      />
      <ShareSheet open={share} onClose={() => setShare(false)} code={session.code} name={session.name} />
      <PlayersSheet
        open={playersOpen}
        onClose={() => setPlayersOpen(false)}
        sessionId={session.id}
        players={data.players}
        entries={data.entries}
        me={me}
        onChanged={() => void refresh()}
      />
      <Sheet open={menu} onClose={() => setMenu(false)} title="Session">
        <div className="flex flex-col gap-2">
          {!viewer && (
            <button className="btn btn-ghost justify-start" onClick={() => { setMenu(false); setPlayersOpen(true); }}>👥 Spieler verwalten</button>
          )}
          <button className="btn btn-ghost justify-start" onClick={() => { setMenu(false); setShare(true); }}>🔗 Code & QR teilen</button>
          {!finished && !viewer && (
            <button className="btn btn-ghost justify-start" onClick={() => { setMenu(false); setNewGame(true); }}>＋ Neue Partie</button>
          )}
          {games.length > 1 && (
            <button className="btn btn-ghost justify-start" onClick={() => { setMenu(false); setTab("evening"); }}>Σ Abend-Gesamtstand</button>
          )}
          {viewer ? null : finished ? (
            <button className="btn btn-ghost justify-start" onClick={() => void setSessionStatus(session.id, "active").then(refresh)}>↩︎ Spieltag wieder öffnen</button>
          ) : (
            <button className="btn btn-ghost justify-start" onClick={() => confirm("Spieltag beenden? Danach ist er nur noch lesbar.") && void setSessionStatus(session.id, "finished").then(() => { setMenu(false); void refresh(); })}>🏁 Spieltag beenden</button>
          )}
          {me && viewer && (
            <button
              className="btn btn-ghost justify-start"
              style={{ color: "var(--color-accent)" }}
              onClick={() => {
                if (!confirm("Session auf diesem Gerät verlassen? Mit dem Code kannst du jederzeit wieder beitreten.")) return;
                void leaveSession(session.id, me).then(() => router.push("/"));
              }}
            >
              🚪 Session verlassen
            </button>
          )}
          {me && !viewer && (session.created_by === me || session.account_id != null) && (
            <button
              className="btn btn-ghost justify-start"
              style={{ color: "var(--color-accent)" }}
              onClick={() => {
                if (!confirm(`„${session.name}“ endgültig löschen? Die Session verschwindet für alle Mitspieler und kann nicht wiederhergestellt werden.`)) return;
                deleteSession(session.id).then(
                  () => router.push("/"),
                  (e) => setSaveError(errorText(e)),
                );
              }}
            >
              🗑️ Session für alle löschen
            </button>
          )}
        </div>
      </Sheet>
    </>
  );
}
