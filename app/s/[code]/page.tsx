"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FreeBoard } from "@/components/free-board";
import { FtnBoard } from "@/components/ftn-board";
import { PlayersSheet } from "@/components/players-sheet";
import { ShareSheet } from "@/components/share-sheet";
import { Sheet } from "@/components/sheet";
import { LegalLink } from "@/components/legal-link";
import { ErrorBox, Page, Spinner, TopBar } from "@/components/ui";
import { deleteSession, leaveSession, saveEntry, setSessionStatus } from "@/lib/actions";
import { GAMES, type Entry, type GameId, type Player, type Round } from "@/lib/games";
import { saveLastName, useLastName } from "@/lib/last-name";
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
      if (p?.is_member) {
        const { data: s, error: e2 } = await supabase().from("sessions").select("id").eq("code", code).single();
        if (e2) throw e2;
        setSessionId(s.id as string);
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
  if (preview === undefined || (preview?.is_member && !sessionId)) {
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
  if (!sessionId) {
    return <JoinGate code={code} preview={preview} onJoined={setSessionId} />;
  }
  return <SessionView sessionId={sessionId} me={me} />;
}

function JoinGate({ code, preview, onJoined }: { code: string; preview: Preview; onJoined: (id: string) => void }) {
  const storedName = useLastName();
  const [typed, setName] = useState<string | null>(null);
  const name = typed ?? storedName;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(asName: string | null) {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await supabase().rpc("join_session", { p_code: code, p_name: asName });
      if (error) throw error;
      if (asName) saveLastName(asName);
      onJoined(data as string);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const free = preview.players.filter((p) => !p.claimed);
  const taken = preview.players.filter((p) => p.claimed);

  return (
    <>
      <TopBar title="Session beitreten" back="/" />
      <Page>
        <div className="text-center mb-6">
          <div className="text-4xl mb-2" aria-hidden>{GAMES[preview.game]?.emoji}</div>
          <h1 className="font-display font-extrabold text-2xl">{preview.name}</h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {GAMES[preview.game]?.label} · Code <b className="tracking-widest">{code}</b>
            {preview.status === "finished" && " · beendet"}
          </p>
        </div>

        {error && <div className="mb-4"><ErrorBox>{error}</ErrorBox></div>}

        {free.length > 0 && (
          <>
            <h2 className="label">Wer bist du?</h2>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {free.map((p) => (
                <button key={p.name} className="btn btn-primary !py-3" disabled={busy} onClick={() => join(p.name)}>
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}
        {taken.length > 0 && (
          <p className="text-xs mb-5" style={{ color: "var(--color-text-muted)" }}>
            Schon dabei: {taken.map((p) => p.name).join(", ")}
          </p>
        )}

        <form
          className="card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void join(name.trim());
          }}
        >
          <label className="label" htmlFor="jname">{free.length > 0 ? "Oder als neuer Spieler" : "Dein Name"}</label>
          <div className="flex gap-2">
            <input id="jname" className="input" value={name} maxLength={30} placeholder="Name" onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-accent shrink-0" disabled={busy || !name.trim()}>Mitspielen</button>
          </div>
        </form>

        <button className="btn btn-ghost w-full mt-3" disabled={busy} onClick={() => join(null)}>
          Nur zuschauen / mitschreiben
        </button>
        <LegalLink />
      </Page>
    </>
  );
}

function SessionView({ sessionId, me }: { sessionId: string; me: string | null }) {
  const router = useRouter();
  const { data, error, connected, refresh, setData } = useLiveSession(sessionId);
  const [share, setShare] = useState(false);
  const [menu, setMenu] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const { session } = data;
  const finished = session.status === "finished";

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

        {(saveError || error) && <div className="mb-3"><ErrorBox>{saveError ?? error}</ErrorBox></div>}

        {session.game === "ftn" ? (
          <FtnBoard live={data} me={me} save={saveFtn} refresh={() => void refresh()} onOpenPlayers={() => setPlayersOpen(true)} patchLocal={patchLocal} />
        ) : (
          <FreeBoard live={data} me={me} refresh={() => void refresh()} />
        )}
      </Page>

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
          <button className="btn btn-ghost justify-start" onClick={() => { setMenu(false); setPlayersOpen(true); }}>👥 Spieler verwalten</button>
          <button className="btn btn-ghost justify-start" onClick={() => { setMenu(false); setShare(true); }}>🔗 Code & QR teilen</button>
          {finished ? (
            <button className="btn btn-ghost justify-start" onClick={() => void setSessionStatus(session.id, "active").then(refresh)}>↩︎ Session wieder öffnen</button>
          ) : (
            <button className="btn btn-ghost justify-start" onClick={() => confirm("Session beenden? Danach ist sie nur noch lesbar.") && void setSessionStatus(session.id, "finished").then(() => { setMenu(false); void refresh(); })}>🏁 Session beenden</button>
          )}
          {me && session.created_by !== me && (
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
          {me && session.created_by === me && (
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
