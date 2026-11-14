"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSignedIn, errorText, supabase } from "./supabase";
import type { Entry, Game, Player, Round, Session } from "./games/types";

export interface LiveSession {
  session: Session;
  games: Game[];
  players: Player[];
  rounds: Round[];
  entries: Entry[];
  /** darf dieses Gerät eintragen? (sonst nur zusehen) */
  canEdit: boolean;
}

/**
 * Lädt eine Session samt Spielern, Runden und Einträgen und hält sie über
 * Supabase Realtime live aktuell. Jede Änderung (egal von welchem Gerät)
 * löst ein kurzes, gebündeltes Neuladen aus.
 */
export function useLiveSession(sessionId: string | null) {
  const [data, setData] = useState<LiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const sb = supabase();
    const [s, g, p, r, e, c] = await Promise.all([
      sb.from("sessions").select("*").eq("id", sessionId).single(),
      sb.from("games").select("*").eq("session_id", sessionId).order("number"),
      sb.from("players").select("*").eq("session_id", sessionId).order("seat"),
      sb.from("rounds").select("*").eq("session_id", sessionId).order("round_number"),
      sb.from("entries").select("*").eq("session_id", sessionId),
      sb.rpc("can_edit", { p_session: sessionId }),
    ]);
    const err = s.error ?? g.error ?? p.error ?? r.error ?? e.error;
    if (err) {
      setError(errorText(err));
      return;
    }
    setError(null);
    setData({
      session: s.data as Session,
      games: (g.data ?? []) as Game[],
      players: (p.data ?? []) as Player[],
      rounds: (r.data ?? []) as Round[],
      entries: (e.data ?? []) as Entry[],
      canEdit: c.data === true,
    });
  }, [sessionId]);

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), 120);
  }, [load]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const sb = supabase();
    let channel: ReturnType<typeof sb.channel> | null = null;

    (async () => {
      await ensureSignedIn();
      if (cancelled) return;
      await load();
      const filter = `session_id=eq.${sessionId}`;
      channel = sb
        .channel(`session-${sessionId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "entries", filter }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "rounds", filter }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "players", filter }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "games", filter }, refresh)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
          refresh,
        )
        .subscribe((status) => {
          setConnected(status === "SUBSCRIBED");
          // nach Verbindungsabbruch (z. B. Handy im Standby) alles neu laden
          if (status === "SUBSCRIBED") refresh();
        });
    })().catch((err) => setError(errorText(err)));

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
      if (channel) void sb.removeChannel(channel);
    };
  }, [sessionId, load, refresh]);

  return { data, error, connected, refresh: load, setData };
}
