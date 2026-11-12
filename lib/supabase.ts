"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true } },
    );
  }
  return client;
}

let signingIn: Promise<string> | null = null;

/**
 * Stellt sicher, dass dieses Gerät angemeldet ist (anonym, ohne Konto).
 * Gibt die User-ID zurück. Die Anmeldung bleibt im Browser gespeichert.
 */
export function ensureSignedIn(): Promise<string> {
  if (!signingIn) {
    signingIn = (async () => {
      const sb = supabase();
      const { data } = await sb.auth.getSession();
      if (data.session) {
        sb.realtime.setAuth(data.session.access_token);
        return data.session.user.id;
      }
      const { data: anon, error } = await sb.auth.signInAnonymously();
      if (error || !anon.user) {
        signingIn = null;
        throw new Error(
          error?.message.includes("Anonymous sign-ins are disabled")
            ? "Anonyme Anmeldung ist in Supabase deaktiviert (siehe README, Schritt 1)."
            : (error?.message ?? "Anmeldung fehlgeschlagen"),
        );
      }
      if (anon.session) sb.realtime.setAuth(anon.session.access_token);
      return anon.user.id;
    })();
  }
  return signingIn;
}

/** Fehlermeldung aus Supabase/Postgres lesbar machen. */
export function errorText(err: unknown): string {
  if (!err) return "Unbekannter Fehler";
  if (typeof err === "string") return err;
  const e = err as { message?: string; code?: string };
  if (e.code === "23505") return "Das gibt es schon (doppelter Eintrag).";
  return e.message ?? "Unbekannter Fehler";
}
